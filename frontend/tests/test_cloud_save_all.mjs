/**
 * Unit smoke tests for the "Save to all targets" fan-out logic in
 * CloudSaveMenu.jsx. We import the helper indirectly by re-exporting it
 * via a tiny test-only shim — but since `runTarget` is a module-local
 * helper, we instead test the aggregation via mocked target implementations.
 *
 * Run: node tests/test_cloud_save_all.mjs
 */

let pass = 0;
let fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

/**
 * Re-implement the aggregation rule in isolation so we can verify the
 * contract. If the menu implementation drifts, the real integration test
 * (Playwright) will catch it; this guards the semantics.
 */
const fanOut = async (runners) => {
  const results = await Promise.allSettled(runners.map((r) => r()));
  const flat = results.map((r) =>
    r.status === "fulfilled" ? r.value : { label: "?", ok: false, error: String(r.reason) }
  );
  return {
    flat,
    okCount: flat.filter((x) => x.ok).length,
    skippedCount: flat.filter((x) => x.skipped).length,
    failedCount: flat.filter((x) => !x.ok && !x.skipped).length,
  };
};

console.log("cloud-save-all — fan-out semantics");

await t("all three OK → okCount=3, failedCount=0, skippedCount=0", async () => {
  const res = await fanOut([
    async () => ({ label: "Drive",   ok: true, name: "a.pdf", link: "https://drive" }),
    async () => ({ label: "Dropbox", ok: true, name: "a.pdf", link: "https://dbx" }),
    async () => ({ label: "Zotero",  ok: true, name: "note",  link: "https://zot" }),
  ]);
  if (res.okCount !== 3) throw new Error(`okCount=${res.okCount}`);
  if (res.skippedCount !== 0) throw new Error(`skippedCount=${res.skippedCount}`);
  if (res.failedCount !== 0) throw new Error(`failedCount=${res.failedCount}`);
});

await t("mixed ok/skipped/failed — each counted independently", async () => {
  const res = await fanOut([
    async () => ({ label: "Drive",   ok: true, name: "a.pdf", link: "https://drive" }),
    async () => ({ label: "Dropbox", skipped: true, reason: "Dropbox key not set" }),
    async () => ({ label: "Zotero",  ok: false, error: "Zotero rejected your API key" }),
  ]);
  if (res.okCount !== 1) throw new Error(`okCount=${res.okCount}`);
  if (res.skippedCount !== 1) throw new Error(`skippedCount=${res.skippedCount}`);
  if (res.failedCount !== 1) throw new Error(`failedCount=${res.failedCount}`);
  if (res.flat[0].label !== "Drive") throw new Error("order preserved");
  if (res.flat[1].reason !== "Dropbox key not set") throw new Error("skip reason preserved");
});

await t("rejected promise (thrown error) maps to failed entry, doesn't block others", async () => {
  const res = await fanOut([
    async () => ({ label: "Drive", ok: true, name: "x" }),
    async () => { throw new Error("boom"); },
    async () => ({ label: "Zotero", ok: true, name: "y" }),
  ]);
  if (res.okCount !== 2) throw new Error(`okCount=${res.okCount}`);
  if (res.failedCount !== 1) throw new Error(`failedCount=${res.failedCount}`);
  if (res.flat[1].label !== "?") throw new Error("expected fallback label");
});

await t("all skipped — okCount=0 but no failures (UI shows 'connect targets' hint)", async () => {
  const res = await fanOut([
    async () => ({ label: "Drive",   skipped: true, reason: "Drive keys not set" }),
    async () => ({ label: "Dropbox", skipped: true, reason: "Dropbox key not set" }),
    async () => ({ label: "Zotero",  skipped: true, reason: "Zotero not connected" }),
  ]);
  if (res.okCount !== 0) throw new Error(`okCount=${res.okCount}`);
  if (res.skippedCount !== 3) throw new Error(`skippedCount=${res.skippedCount}`);
  if (res.failedCount !== 0) throw new Error(`failedCount=${res.failedCount}`);
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
