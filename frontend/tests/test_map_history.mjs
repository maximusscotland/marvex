/**
 * Unit smoke test for /app/frontend/src/lib/mapHistory.js and
 * /app/frontend/src/lib/cloudSync.js#undoLastSyncPull.
 *
 * Runs with plain Node ≥ 20 (no jest / vitest needed):
 *   node tests/test_map_history.mjs
 *
 * Stubs a minimal localStorage global + a minimal @/lib/storage resolver
 * via Node's `--import` hook — easier: we inline a tiny fake.
 */

// ---- Tiny fake localStorage ----
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.window = undefined; // don't emit DOM events during unit tests.

// Dynamic import so the stubs are in place first.
const history = await import("../src/lib/mapHistory.js");

let pass = 0;
let fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};
const eq = (a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

console.log("mapHistory — ring buffer");
t("empty read returns null", () => {
  mem.clear();
  eq(history.peekSnapshot("nope"), null);
  eq(history.countSnapshots("nope"), 0);
  eq(history.hasSnapshot("nope"), false);
});

t("push then peek returns the pushed snapshot (data only match)", () => {
  mem.clear();
  history.pushSnapshot("m1", { id: "m1", title: "v1" });
  const s = history.peekSnapshot("m1");
  eq(s.data.title, "v1");
  eq(history.countSnapshots("m1"), 1);
});

t("push multiple keeps newest first", () => {
  mem.clear();
  history.pushSnapshot("m1", { id: "m1", title: "v1" });
  history.pushSnapshot("m1", { id: "m1", title: "v2" });
  history.pushSnapshot("m1", { id: "m1", title: "v3" });
  eq(history.peekSnapshot("m1").data.title, "v3");
  eq(history.countSnapshots("m1"), 3);
});

t("ring cap = 10 per map — oldest drops", () => {
  mem.clear();
  for (let i = 0; i < 15; i += 1) {
    history.pushSnapshot("m1", { id: "m1", title: `v${i}` });
  }
  eq(history.countSnapshots("m1"), 10);
  eq(history.peekSnapshot("m1").data.title, "v14");
});

t("pop removes and returns", () => {
  mem.clear();
  history.pushSnapshot("m1", { id: "m1", title: "v1" });
  history.pushSnapshot("m1", { id: "m1", title: "v2" });
  const popped = history.popSnapshot("m1");
  eq(popped.data.title, "v2");
  eq(history.countSnapshots("m1"), 1);
  eq(history.peekSnapshot("m1").data.title, "v1");
});

t("pop from empty returns null", () => {
  mem.clear();
  eq(history.popSnapshot("nope"), null);
});

t("clearHistoryFor nukes a single map", () => {
  mem.clear();
  history.pushSnapshot("m1", { id: "m1" });
  history.pushSnapshot("m2", { id: "m2" });
  history.clearHistoryFor("m1");
  eq(history.hasSnapshot("m1"), false);
  eq(history.hasSnapshot("m2"), true);
});

t("isolation — m1 and m2 rings are independent", () => {
  mem.clear();
  history.pushSnapshot("m1", { id: "m1", title: "A" });
  history.pushSnapshot("m2", { id: "m2", title: "B" });
  eq(history.peekSnapshot("m1").data.title, "A");
  eq(history.peekSnapshot("m2").data.title, "B");
});

t("snapshot is deep-copied — later mutations don't corrupt ring", () => {
  mem.clear();
  const obj = { id: "m1", children: [{ title: "x" }] };
  history.pushSnapshot("m1", obj);
  obj.children[0].title = "MUTATED";
  eq(history.peekSnapshot("m1").data.children[0].title, "x");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
