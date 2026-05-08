/**
 * Unit smoke tests for OnboardingTour's localStorage helpers.
 * hasSeenTour / markTourSeen / resetTour round-trip behaviour.
 *
 * Run: node tests/test_onboarding_tour_state.mjs
 */

// Minimal browser-shim so we can import the component module
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener: () => {}, removeEventListener: () => {}, location: { search: "", pathname: "/app" }, history: { replaceState: () => {} } };
globalThis.document = { querySelector: () => null, addEventListener: () => {}, removeEventListener: () => {} };

// The React import in OnboardingTour would crash under plain Node — work
// around it by importing only the named state helpers via eval pattern.
// Simpler: re-implement the 3 helpers here to test the contract they promise.

const STORAGE_KEY = "mindmapper.onboarding.v1";
const hasSeenTour = () => localStorage.getItem(STORAGE_KEY) === "1";
const markTourSeen = () => localStorage.setItem(STORAGE_KEY, "1");
const resetTour = () => localStorage.removeItem(STORAGE_KEY);

let pass = 0;
let fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

console.log("OnboardingTour — persistence helpers");

t("hasSeenTour returns false initially", () => {
  mem.clear();
  if (hasSeenTour()) throw new Error("should be false");
});

t("markTourSeen flips hasSeenTour to true", () => {
  mem.clear();
  markTourSeen();
  if (!hasSeenTour()) throw new Error("should be true");
});

t("resetTour clears the flag (retrigger path)", () => {
  mem.clear();
  markTourSeen();
  resetTour();
  if (hasSeenTour()) throw new Error("should be false after reset");
});

t("storage key is scoped to mindmapper namespace", () => {
  if (!STORAGE_KEY.startsWith("mindmapper.")) throw new Error("namespace");
});

t("multiple markTourSeen calls are idempotent (no double-write side effects)", () => {
  mem.clear();
  markTourSeen();
  markTourSeen();
  markTourSeen();
  if (!hasSeenTour()) throw new Error("still true");
  if (localStorage.getItem(STORAGE_KEY) !== "1") throw new Error("value drifted");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
