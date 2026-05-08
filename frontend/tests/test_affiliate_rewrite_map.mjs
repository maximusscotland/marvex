/**
 * Tests the nested affiliate rewrite logic — rewriteTextAffiliates and
 * rewriteMapAffiliates. Ensures Amazon + Bookshop URLs buried inside node
 * summaries (at any depth) get the owner's affiliate tag appended, and that
 * unrelated URLs / already-tagged URLs are left alone.
 *
 * Run: node tests/test_affiliate_rewrite_map.mjs
 */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

process.env.REACT_APP_OWNER_AMAZON_TAG = "source67-20";
process.env.REACT_APP_OWNER_AMAZON_DOMAIN = "com";
process.env.REACT_APP_OWNER_BOOKSHOP_ID = "17338";

const {
  maybeTagBookshopUrl,
  rewriteTextAffiliates,
  rewriteMapAffiliates,
} = await import("../src/lib/affiliates.js");

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log(`  ✓ ${name}`); pass += 1; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); fail += 1; }
};

console.log("affiliates — nested rewrite");

t("maybeTagBookshopUrl tags a product URL with ?aff=<id>", () => {
  const out = maybeTagBookshopUrl("https://bookshop.org/p/books/sapiens/12345");
  if (!out.includes("aff=17338")) throw new Error(out);
});

t("maybeTagBookshopUrl tags a search URL with ?affiliate=<id>", () => {
  const out = maybeTagBookshopUrl("https://bookshop.org/beta-search?keywords=plato");
  if (!out.includes("affiliate=17338")) throw new Error(out);
});

t("maybeTagBookshopUrl preserves an existing affiliate param", () => {
  const raw = "https://bookshop.org/p/books/x?aff=someoneelse";
  const out = maybeTagBookshopUrl(raw);
  if (out !== raw) throw new Error(`mutated: ${out}`);
});

t("maybeTagBookshopUrl skips non-Bookshop hosts", () => {
  const raw = "https://example.com/book";
  if (maybeTagBookshopUrl(raw) !== raw) throw new Error("mutated");
});

t("rewriteTextAffiliates rewrites URLs inside prose", () => {
  const prose = "See Sapiens (https://www.amazon.com/dp/0062316095) or the Bookshop listing https://bookshop.org/p/books/sapiens.";
  const out = rewriteTextAffiliates(prose);
  if (!out.includes("tag=source67-20")) throw new Error(`no amazon tag: ${out}`);
  if (!out.includes("aff=17338")) throw new Error(`no bookshop aff: ${out}`);
});

t("rewriteTextAffiliates preserves trailing punctuation", () => {
  const prose = "Buy at https://www.amazon.com/dp/X.";
  const out = rewriteTextAffiliates(prose);
  if (!out.endsWith(".")) throw new Error(`lost trailing dot: ${out}`);
  if (!out.includes("tag=source67-20")) throw new Error(`no tag: ${out}`);
});

t("rewriteTextAffiliates leaves non-affiliate URLs untouched", () => {
  const prose = "See https://example.com/paper for the original.";
  const out = rewriteTextAffiliates(prose);
  if (out !== prose) throw new Error(`mutated: ${out}`);
});

t("rewriteMapAffiliates walks children and rewrites summaries at every depth", () => {
  const input = {
    id: "root",
    title: "Root",
    summary: "Top: https://www.amazon.com/dp/AAA",
    children: [
      {
        id: "c1",
        title: "Branch 1",
        summary: "Mid: https://bookshop.org/p/books/mid",
        link: "https://www.amazon.com/dp/LLL",
        children: [
          { id: "c1a", title: "Leaf", summary: "Deep: https://www.amazon.com/dp/BBB", children: [] },
        ],
      },
    ],
  };
  const out = rewriteMapAffiliates(input);

  if (!out.summary.includes("tag=source67-20")) throw new Error("root summary not tagged");
  if (!out.children[0].summary.includes("aff=17338")) throw new Error("branch summary not tagged");
  if (!out.children[0].link.includes("tag=source67-20")) throw new Error("branch link not tagged");
  if (!out.children[0].children[0].summary.includes("tag=source67-20")) throw new Error("leaf summary not tagged");
  // Immutability — original untouched
  if (input.summary.includes("tag=")) throw new Error("input mutated");
});

t("rewriteMapAffiliates gracefully handles missing/non-string fields", () => {
  const out = rewriteMapAffiliates({ id: "x", title: "t", summary: null, children: undefined });
  if (out.id !== "x") throw new Error("lost id");
});

t("rewriteMapAffiliates returns the input when not an object", () => {
  if (rewriteMapAffiliates(null) !== null) throw new Error("null");
  if (rewriteMapAffiliates("str") !== "str") throw new Error("str");
});

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
