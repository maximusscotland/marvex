/**
 * Unit smoke test for `buildMapBlob` (Markdown / JSON formats) in
 * /app/frontend/src/lib/exportPng.js — covers the blob-builder path used
 * by the Cloud-Save menu without needing jsdom/canvas for PDF/PNG.
 *
 *   node tests/test_build_map_blob.mjs
 */

import { buildMapBlob, buildMarkdown } from "../src/lib/exportPng.js";

let pass = 0;
let fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

const map = {
  id: "m1",
  title: "Cosmic Research",
  summary: "test map",
  shape: "rect",
  children: [
    { id: "a", title: "Branch A", summary: "", children: [
      { id: "a1", title: "Leaf A1", children: [] },
    ]},
    { id: "b", title: "Branch B", children: [] },
  ],
};

console.log("buildMapBlob — pure text formats");

await t("markdown format returns text/markdown blob with correct filename", async () => {
  const res = await buildMapBlob(map, "md");
  if (!res.blob) throw new Error("no blob");
  if (res.mimeType !== "text/markdown") throw new Error(`mime: ${res.mimeType}`);
  if (res.filename !== "Cosmic_Research.md") throw new Error(`filename: ${res.filename}`);
  const text = await res.blob.text();
  if (!text.includes("# Cosmic Research")) throw new Error("missing title heading");
  if (!text.includes("## Branch A")) throw new Error("missing branch heading");
  if (!text.includes("marvex.app")) throw new Error("missing attribution footer");
});

await t("json format returns application/json blob with full map", async () => {
  const res = await buildMapBlob(map, "json");
  if (res.mimeType !== "application/json") throw new Error(`mime: ${res.mimeType}`);
  if (res.filename !== "Cosmic_Research.json") throw new Error(`filename: ${res.filename}`);
  const parsed = JSON.parse(await res.blob.text());
  if (parsed.id !== "m1" || parsed.children.length !== 2) throw new Error("round-trip failed");
});

await t("svg format returns image/svg+xml blob", async () => {
  const res = await buildMapBlob(map, "svg");
  if (res.mimeType !== "image/svg+xml") throw new Error(`mime: ${res.mimeType}`);
  if (res.filename !== "Cosmic_Research.svg") throw new Error(`filename: ${res.filename}`);
  const svg = await res.blob.text();
  if (!svg.includes("<svg")) throw new Error("not an svg doc");
});

await t("unknown format throws", async () => {
  let threw = false;
  try { await buildMapBlob(map, "docx"); } catch { threw = true; }
  if (!threw) throw new Error("expected throw");
});

await t("missing title falls back to 'mindmap'", async () => {
  const res = await buildMapBlob({ title: "", children: [] }, "md");
  if (res.filename !== "mindmap.md") throw new Error(`filename: ${res.filename}`);
});

await t("buildMarkdown is pure export, callable directly", async () => {
  const md = buildMarkdown(map);
  if (!md.includes("# Cosmic Research")) throw new Error("buildMarkdown failed");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
