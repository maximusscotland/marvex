/**
 * Unit smoke tests for the Zotero push-side logic in /app/frontend/src/lib/zotero.js
 *   - buildMapHtmlNote (implicitly via saveMapToZotero's HTML body)
 *   - isZoteroConnected (creds gate)
 *
 * Run: node tests/test_zotero_push.mjs
 */

// Tiny in-memory localStorage stub so zotero.js creds functions work.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

// We need a `fetch` stub for `saveMapToZotero` — capture calls so we can
// assert the HTML payload Zotero would receive.
let calls = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, opts });
  // Respond with a fake Zotero /items success
  return {
    ok: true,
    status: 200,
    json: async () => ({
      successful: {
        "0": { key: "ABCD1234", version: 1 },
      },
      failed: {},
    }),
    text: async () => "",
  };
};

const zotero = await import("../src/lib/zotero.js");

let pass = 0;
let fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

const sampleMap = {
  id: "m1",
  title: "Gödel, Escher, Bach",
  summary: "An Eternal Golden Braid",
  shape: "rect",
  children: [
    { id: "b1", title: "Strange loops", summary: "", children: [
      { id: "b1a", title: "Tangled hierarchies", children: [] },
    ]},
    { id: "b2", title: "Formal systems", children: [] },
  ],
};

console.log("zotero — push side");

await t("isZoteroConnected returns false without creds", () => {
  mem.clear();
  if (zotero.isZoteroConnected() !== false) throw new Error("expected false");
});

await t("isZoteroConnected returns true with creds", () => {
  mem.clear();
  zotero.setZoteroCreds({ apiKey: "k", userId: "42" });
  if (zotero.isZoteroConnected() !== true) throw new Error("expected true");
});

await t("saveMapToZotero throws without creds", async () => {
  mem.clear();
  let threw = false;
  try { await zotero.saveMapToZotero({ map: sampleMap }); } catch { threw = true; }
  if (!threw) throw new Error("expected throw");
});

await t("saveMapToZotero posts parent + note with HTML body", async () => {
  mem.clear();
  calls = [];
  zotero.setZoteroCreds({ apiKey: "test-key", userId: "42" });
  const result = await zotero.saveMapToZotero({ map: sampleMap });

  if (calls.length !== 2) throw new Error(`expected 2 POSTs, got ${calls.length}`);

  // First call: parent report item
  const [parentCall, noteCall] = calls;
  if (!parentCall.url.includes("/users/42/items")) throw new Error(`bad parent url: ${parentCall.url}`);
  const parentBody = JSON.parse(parentCall.opts.body);
  if (parentBody[0].itemType !== "report") throw new Error("parent itemType");
  if (!parentBody[0].title.includes("Gödel")) throw new Error("parent title missing map title");
  if (parentBody[0].tags?.[0]?.tag !== "mind-mapper") throw new Error("missing mind-mapper tag");

  // Second call: child note with HTML body
  const noteBody = JSON.parse(noteCall.opts.body);
  if (noteBody[0].itemType !== "note") throw new Error("expected note item");
  if (noteBody[0].parentItem !== "ABCD1234") throw new Error("parent ref missing");
  const html = noteBody[0].note;
  if (!html.includes("<h1>Gödel, Escher, Bach</h1>")) throw new Error("h1 missing");
  if (!html.includes("<h2>Strange loops</h2>")) throw new Error("branch h2 missing");
  if (!html.includes("<h3>Tangled hierarchies</h3>")) throw new Error("sub h3 missing");
  if (!html.includes("marvex.app")) throw new Error("attribution missing");

  if (result.parentKey !== "ABCD1234") throw new Error("parent key not returned");
  if (!result.zoteroUrl.includes("zotero.org/users/42/items/ABCD1234")) throw new Error("zoteroUrl malformed");
});

await t("HTML escapes untrusted map content", async () => {
  mem.clear();
  calls = [];
  zotero.setZoteroCreds({ apiKey: "k", userId: "1" });
  const malicious = {
    title: "<script>alert(1)</script>",
    summary: "",
    children: [{ id: "x", title: "Fine", children: [] }],
  };
  await zotero.saveMapToZotero({ map: malicious });
  const noteCall = calls[1];
  const html = JSON.parse(noteCall.opts.body)[0].note;
  if (html.includes("<script>")) throw new Error("script tag not escaped");
  if (!html.includes("&lt;script&gt;")) throw new Error("expected escaped form");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
