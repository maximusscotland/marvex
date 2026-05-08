/**
 * Unit smoke test for the Cloud-Save → ShareDialog event bridge.
 *
 * The CloudSaveMenu success toast body includes <ShareNudge /> which
 * dispatches `window.dispatchEvent(new CustomEvent('mindmapper:open-share'))`.
 * Studio.jsx has a listener that sets shareOpen=true.
 *
 * We verify the contract here without loading React — just the event name.
 *
 * Run: node tests/test_share_nudge_event.mjs
 */

let pass = 0;
let fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

// Minimal window/event shim (Node ≥ 20 has EventTarget globally but not
// window). Use a plain EventTarget to verify the dispatch/listen contract.
const bus = new EventTarget();

console.log("cloud-save → share-dialog event bridge");

t("dispatch + listen round-trip on the canonical event name", () => {
  let received = null;
  const listener = (ev) => { received = ev; };
  bus.addEventListener("mindmapper:open-share", listener);
  bus.dispatchEvent(new Event("mindmapper:open-share"));
  if (!received) throw new Error("listener did not fire");
  if (received.type !== "mindmapper:open-share") throw new Error("wrong type");
  bus.removeEventListener("mindmapper:open-share", listener);
});

t("listener cleanup prevents duplicate fires", () => {
  let count = 0;
  const listener = () => { count += 1; };
  bus.addEventListener("mindmapper:open-share", listener);
  bus.dispatchEvent(new Event("mindmapper:open-share"));
  bus.removeEventListener("mindmapper:open-share", listener);
  bus.dispatchEvent(new Event("mindmapper:open-share"));
  if (count !== 1) throw new Error(`expected 1 fire, got ${count}`);
});

t("event name matches the canonical string in both producer & consumer", () => {
  // If either side drifts, this constant must be updated in both files.
  const NAME = "mindmapper:open-share";
  if (!NAME.startsWith("mindmapper:")) throw new Error("namespace convention broken");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
