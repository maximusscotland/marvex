/**
 * Unit smoke test for `buildDefaultMap(t)` in /app/frontend/src/lib/storage.js.
 *
 * Verifies the seed map is produced in the user's detected language when
 * a translator function is provided, and falls back cleanly to English
 * when no t is passed.
 *
 * Run: node tests/test_localized_seed.mjs
 */

import { buildDefaultMap } from "../src/lib/storage.js";

let pass = 0;
let fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

console.log("localized seed — buildDefaultMap");

t("no translator → English fallback", () => {
  const m = buildDefaultMap();
  if (m.title !== "Core Concept") throw new Error(`title: ${m.title}`);
  const kids = m.children.map((c) => c.title);
  if (kids.join("|") !== "Idea One|Idea Two|Idea Three|Idea Four|Idea Five")
    throw new Error(`kids: ${kids.join("|")}`);
});

t("passes the requested key to the translator", () => {
  const seen = [];
  const fakeT = (key, opts) => {
    seen.push(key);
    return `<${key}:${opts?.defaultValue || ""}>`;
  };
  const m = buildDefaultMap(fakeT);
  if (seen[0] !== "studio.defaults.coreConcept") throw new Error(`first key: ${seen[0]}`);
  if (m.title !== "<studio.defaults.coreConcept:Core Concept>") throw new Error(`title shape: ${m.title}`);
  if (m.children.length !== 5) throw new Error(`children count: ${m.children.length}`);
});

t("falls back through defaultValue when translator returns undefined", () => {
  // Simulate a partially-loaded locale where some keys aren't translated
  const partialT = (key, opts) => {
    if (key === "studio.defaults.coreConcept") return "コア概念";
    return opts?.defaultValue;
  };
  const m = buildDefaultMap(partialT);
  if (m.title !== "コア概念") throw new Error(`expected コア概念, got: ${m.title}`);
  if (m.children[0].title !== "Idea One") throw new Error(`first child should fall back to Idea One`);
});

t("preserves node structure (shape, fill, stroke, children array)", () => {
  const m = buildDefaultMap();
  if (m.shape !== "rect") throw new Error(`shape: ${m.shape}`);
  if (m.stroke !== "#00f0ff") throw new Error(`stroke: ${m.stroke}`);
  for (const c of m.children) {
    if (c.shape !== "ellipse") throw new Error(`child shape: ${c.shape}`);
    if (!Array.isArray(c.children)) throw new Error(`child missing children array`);
  }
});

t("generates a fresh id per call", () => {
  const a = buildDefaultMap();
  const b = buildDefaultMap();
  if (a.id === b.id) throw new Error("ids collided");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
