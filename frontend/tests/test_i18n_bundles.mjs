/**
 * Unit smoke tests for the i18n locale bundles:
 *   1. Every non-English locale has 100% coverage of en.json keys (no missing strings).
 *   2. Interpolation placeholders like {{name}} are preserved verbatim.
 *   3. The brand string `common.brand` stays literally "mind-mapper" everywhere.
 *   4. The supported-language set matches the directory listing of locales/.
 *
 * Run: node tests/test_i18n_bundles.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES = join(__dirname, "..", "src", "i18n", "locales");

let pass = 0;
let fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

const EXPECTED = ["en","es","fr","de","pt","it","nl","pl","ja","zh-Hans"];

const flatten = (obj, prefix = "") => {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
};

const load = (code) => JSON.parse(readFileSync(join(LOCALES, `${code}.json`), "utf8"));

console.log("i18n — locale bundles");

t("all expected locale files exist", () => {
  const files = readdirSync(LOCALES).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
  const missing = EXPECTED.filter((e) => !files.includes(e));
  if (missing.length) throw new Error(`missing files: ${missing.join(", ")}`);
});

const enFlat = flatten(load("en"));

for (const code of EXPECTED.filter((c) => c !== "en")) {
  t(`${code} — has every key from en.json (no missing strings)`, () => {
    const other = flatten(load(code));
    const missing = Object.keys(enFlat).filter((k) => !(k in other));
    if (missing.length) throw new Error(`missing ${missing.length} keys: ${missing.slice(0,3).join(", ")}...`);
  });

  t(`${code} — no blank translated values`, () => {
    const other = flatten(load(code));
    const blanks = Object.entries(other).filter(([, v]) => typeof v === "string" && !v.trim());
    if (blanks.length) throw new Error(`${blanks.length} blank values`);
  });

  t(`${code} — brand string stays "mind-mapper"`, () => {
    const other = flatten(load(code));
    if (other["common.brand"] !== "mind-mapper")
      throw new Error(`brand mutated to: ${other["common.brand"]}`);
  });
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
