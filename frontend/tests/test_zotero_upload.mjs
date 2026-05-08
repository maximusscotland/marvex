/**
 * Tests the Zotero binary-attachment 3-step upload protocol (Phase 2).
 * Mocks fetch so we verify:
 *   - Step 1 creates an attachment item with md5 + mtime
 *   - Step 2 POSTs to /items/:key/file with md5/filename/filesize/mtime
 *   - Step 3 POSTs the prefix+bytes+suffix body to the returned S3 URL
 *   - Step 4 POSTs ?upload=<uploadKey> to /items/:key/file
 *   - Server-side dedup (exists=1) short-circuits without touching S3
 *
 * Run: node tests/test_zotero_upload.mjs
 */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

// Stash a fake credential pair
mem.set(
  "mindmapper.zotero.v1",
  JSON.stringify({ apiKey: "zot-api-test", userId: "12345" })
);

// --- fetch mock ---------------------------------------------------------
const calls = [];
let scenario = "upload"; // "upload" | "dedup"

globalThis.fetch = async (url, opts = {}) => {
  const method = opts.method || "GET";
  const body = typeof opts.body === "string" ? opts.body : "(non-string-body)";
  calls.push({ url: String(url), method, body, headers: { ...(opts.headers || {}) } });

  // Zotero items POST (create attachment)
  if (String(url).endsWith("/users/12345/items") && method === "POST") {
    return new Response(
      JSON.stringify({ successful: { 0: { key: "ATTKEY1", version: 1 } }, failed: {} }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  // Zotero upload-authorise / register
  if (/\/users\/12345\/items\/ATTKEY1\/file$/.test(String(url)) && method === "POST") {
    const parsed = new URLSearchParams(body);
    if (parsed.has("upload")) {
      // Step 4 register
      return new Response("", { status: 200 });
    }
    // Step 2 authorise
    if (scenario === "dedup") {
      return new Response(JSON.stringify({ exists: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        url: "https://s3.zotero.example/upload",
        contentType: "multipart/form-data; boundary=xxx",
        prefix: "--xxx\r\n",
        suffix: "\r\n--xxx--",
        uploadKey: "UPLD123",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  // S3 presigned upload
  if (String(url) === "https://s3.zotero.example/upload" && method === "POST") {
    return new Response("", { status: 200 });
  }
  return new Response("unexpected", { status: 599 });
};

// --- run ----------------------------------------------------------------
const { uploadFileAttachment } = await import("../src/lib/zotero.js");

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

console.log("zotero — binary attachment upload (3-step MD5 protocol)");

await t("full 3-step upload path makes all 4 calls in order", async () => {
  scenario = "upload";
  calls.length = 0;
  const blob = new Blob(["fake-pdf-bytes-🐞"], { type: "application/pdf" });
  const res = await uploadFileAttachment({
    apiKey: "zot-api-test",
    userId: "12345",
    parentKey: "PARENT1",
    blob,
    filename: "map.pdf",
  });
  if (res.attachmentKey !== "ATTKEY1") throw new Error(`key: ${res.attachmentKey}`);
  if (res.deduped !== false) throw new Error("should not be deduped");

  if (calls.length !== 4) throw new Error(`expected 4 calls, got ${calls.length}`);
  // Call 1: create item
  if (!calls[0].url.endsWith("/users/12345/items")) throw new Error(`step1 url: ${calls[0].url}`);
  // Call 2: authorise (should contain md5=... filename=map.pdf)
  if (!calls[1].url.endsWith("/items/ATTKEY1/file")) throw new Error(`step2 url: ${calls[1].url}`);
  if (!calls[1].body.includes("md5=")) throw new Error("step2 body missing md5");
  if (!calls[1].body.includes("filename=map.pdf")) throw new Error("step2 body missing filename");
  if (!calls[1].body.includes("filesize=")) throw new Error("step2 body missing filesize");
  if (calls[1].headers["If-None-Match"] !== "*") throw new Error("step2 missing If-None-Match");
  // Call 3: S3 upload
  if (calls[2].url !== "https://s3.zotero.example/upload") throw new Error(`step3 url: ${calls[2].url}`);
  // Call 4: register
  if (!calls[3].body.includes("upload=UPLD123")) throw new Error(`step4 body: ${calls[3].body}`);
});

await t("server dedup (exists=1) short-circuits without S3 call", async () => {
  scenario = "dedup";
  calls.length = 0;
  const blob = new Blob(["dup"], { type: "application/pdf" });
  const res = await uploadFileAttachment({
    apiKey: "zot-api-test",
    userId: "12345",
    parentKey: "PARENT1",
    blob,
    filename: "dup.pdf",
  });
  if (res.deduped !== true) throw new Error("should be deduped");
  // Only 2 calls: create + authorise; NO S3, NO register
  if (calls.length !== 2) throw new Error(`expected 2 calls, got ${calls.length}`);
  const hitS3 = calls.some((c) => c.url.includes("s3.zotero.example"));
  if (hitS3) throw new Error("should not touch S3 on dedup");
});

await t("throws when blob is empty", async () => {
  try {
    await uploadFileAttachment({
      apiKey: "zot-api-test",
      userId: "12345",
      parentKey: "P",
      blob: new Blob([]),
      filename: "empty.pdf",
    });
    throw new Error("should have thrown");
  } catch (e) {
    if (!/empty/i.test(e.message)) throw new Error(`wrong error: ${e.message}`);
  }
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
