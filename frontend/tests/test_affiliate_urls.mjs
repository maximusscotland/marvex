/**
 * Verifies the configured .env affiliate IDs produce valid Amazon + Bookshop
 * URLs via the lib/affiliates.js helpers.
 *
 * Run: node tests/test_affiliate_urls.mjs
 */

// Stub localStorage (the affiliate lib checks pro status there)
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

// Force the exact env values the user plugged in
process.env.REACT_APP_OWNER_AMAZON_TAG = "source67-20";
process.env.REACT_APP_OWNER_AMAZON_DOMAIN = "com";
process.env.REACT_APP_OWNER_BOOKSHOP_ID = "17338";

const {
  getOwnerConfig,
  getEffectiveConfig,
  buildAmazonSearchUrl,
  buildBookshopUrl,
  buildBookLink,
  maybeTagAmazonUrl,
  hasAnyAffiliate,
} = await import("../src/lib/affiliates.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

console.log("affiliates — live .env config");

t("owner config reflects .env", () => {
  const o = getOwnerConfig();
  if (o.amazonTag !== "source67-20") throw new Error(`amazonTag: ${o.amazonTag}`);
  if (o.amazonDomain !== "com") throw new Error(`domain: ${o.amazonDomain}`);
  if (o.bookshopId !== "17338") throw new Error(`bookshopId: ${o.bookshopId}`);
});

t("hasAnyAffiliate returns true for free users (owner tags)", () => {
  if (!hasAnyAffiliate(false)) throw new Error("expected true");
});

t("Amazon search URL includes tag=source67-20", () => {
  const u = buildAmazonSearchUrl({ query: "Gödel Escher Bach", tag: "source67-20", domain: "com" });
  if (!u.includes("tag=source67-20")) throw new Error(`missing tag: ${u}`);
  if (!u.startsWith("https://www.amazon.com/s?")) throw new Error(`bad base: ${u}`);
});

t("Bookshop URL includes affiliate=17338", () => {
  const u = buildBookshopUrl({ query: "Thinking Fast and Slow", affiliateId: "17338" });
  if (!u.includes("affiliate=17338")) throw new Error(`missing id: ${u}`);
  if (!u.startsWith("https://bookshop.org/beta-search?")) throw new Error(`bad base: ${u}`);
});

t("buildBookLink (free user, amazon preferred) picks Amazon with owner tag", () => {
  const link = buildBookLink("Sapiens", { isPro: false });
  if (!link) throw new Error("no link");
  if (link.program !== "amazon") throw new Error(`program: ${link.program}`);
  if (link.source !== "owner") throw new Error(`source: ${link.source}`);
  if (!link.url.includes("tag=source67-20")) throw new Error(`url: ${link.url}`);
});

t("maybeTagAmazonUrl injects tag into a raw Amazon URL without tag", () => {
  const raw = "https://www.amazon.com/dp/0143111590";
  const out = maybeTagAmazonUrl(raw, { isPro: false });
  if (!out.includes("tag=source67-20")) throw new Error(`no tag: ${out}`);
});

t("maybeTagAmazonUrl preserves an existing tag", () => {
  const raw = "https://www.amazon.com/dp/0143111590?tag=someoneelse-20";
  const out = maybeTagAmazonUrl(raw, { isPro: false });
  if (out !== raw) throw new Error(`mutated: ${out}`);
});

t("maybeTagAmazonUrl skips non-Amazon URLs", () => {
  const raw = "https://example.com/book";
  const out = maybeTagAmazonUrl(raw, { isPro: false });
  if (out !== raw) throw new Error(`mutated: ${out}`);
});

t("getEffectiveConfig falls back to owner tag when Pro user has no override", () => {
  const eff = getEffectiveConfig({ isPro: true });
  if (eff.amazonTag !== "source67-20") throw new Error(`tag: ${eff.amazonTag}`);
  if (eff.source !== "owner") throw new Error(`source: ${eff.source}`);
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
