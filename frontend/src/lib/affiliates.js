/**
 * Affiliate link helpers — HYBRID architecture (Feb 2026).
 *
 *  - Owner's tags live in frontend/.env (REACT_APP_OWNER_AMAZON_TAG /
 *    REACT_APP_OWNER_BOOKSHOP_ID / REACT_APP_OWNER_AMAZON_DOMAIN).
 *  - Free users: every outbound click uses the owner's tag.
 *  - Pro users may override with their own tags in Settings (earning for
 *    themselves is a Pro perk).
 *
 * Pro status is cached to `mindmapper.proStatus.v1` by the Auth provider so
 * these pure util functions can access it without coupling to React context.
 */

const KEY = "mindmapper.affiliates.v1";
const PRO_KEY = "mindmapper.proStatus.v1";

const OWNER = {
  amazonTag: process.env.REACT_APP_OWNER_AMAZON_TAG || "",
  amazonDomain: process.env.REACT_APP_OWNER_AMAZON_DOMAIN || "com",
  bookshopId: process.env.REACT_APP_OWNER_BOOKSHOP_ID || "",
};

const USER_DEFAULTS = {
  amazonTag: "",
  bookshopId: "",
  preferred: "amazon",
  amazonDomain: "com",
};

/* ---------- Persistence ---------- */

export const getAffiliateConfig = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...USER_DEFAULTS };
    return { ...USER_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...USER_DEFAULTS };
  }
};

export const setAffiliateConfig = (patch) => {
  const next = { ...getAffiliateConfig(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
};

/** Used by <AuthProvider/> to stash a boolean the pure-util functions can read. */
export const setProStatusCache = (isPro) => {
  try { localStorage.setItem(PRO_KEY, isPro ? "1" : "0"); } catch { /* ignore */ }
};

const readProStatus = () => {
  try { return localStorage.getItem(PRO_KEY) === "1"; } catch { return false; }
};

/* ---------- Effective config (owner vs Pro override) ---------- */

export const getOwnerConfig = () => ({ ...OWNER });

/**
 * Resolve which affiliate IDs apply for the current click:
 *  - Pro users who have configured their own tag → their tag
 *  - Everyone else → owner defaults from .env
 */
export const getEffectiveConfig = (optsOrIsPro = {}) => {
  const isPro =
    typeof optsOrIsPro === "boolean" ? optsOrIsPro : (optsOrIsPro.isPro ?? readProStatus());
  const user = getAffiliateConfig();

  const amazonTag =
    isPro && user.amazonTag ? user.amazonTag : OWNER.amazonTag;
  const amazonDomain =
    isPro && user.amazonTag ? user.amazonDomain : OWNER.amazonDomain;
  const bookshopId =
    isPro && user.bookshopId ? user.bookshopId : OWNER.bookshopId;

  const source =
    isPro && (user.amazonTag || user.bookshopId) ? "user" : "owner";

  return { amazonTag, amazonDomain, bookshopId, preferred: user.preferred, source };
};

export const hasAnyAffiliate = (optsOrIsPro) => {
  const eff = getEffectiveConfig(optsOrIsPro);
  return !!(eff.amazonTag || eff.bookshopId);
};

/* ---------- URL builders ---------- */

export const buildAmazonSearchUrl = ({ query, tag, domain = "com" }) => {
  const base = `https://www.amazon.${domain}/s`;
  const params = new URLSearchParams({ k: query || "" });
  if (tag) params.set("tag", tag);
  return `${base}?${params.toString()}`;
};

export const buildKuTrialUrl = ({ tag, domain = "com" }) => {
  const path = domain === "com" ? "/kindle-dbs/hz/signup" : "/kindleunlimited";
  const base = `https://www.amazon.${domain}${path}`;
  return tag ? `${base}?tag=${encodeURIComponent(tag)}` : base;
};

export const buildBookshopUrl = ({ query, affiliateId }) => {
  const base = "https://bookshop.org/beta-search";
  const params = new URLSearchParams({ keywords: query || "" });
  if (affiliateId) params.set("affiliate", affiliateId);
  return `${base}?${params.toString()}`;
};

/**
 * Build the "best link" for a free-form book query, respecting the Pro / owner
 * hybrid. Returns { label, url, program, source } or null.
 */
export const buildBookLink = (query, opts = {}) => {
  const q = String(query || "").trim();
  if (!q) return null;
  const eff = getEffectiveConfig(opts);
  const want = eff.preferred;

  if (want === "bookshop" && eff.bookshopId) {
    return {
      label: "Bookshop.org",
      url: buildBookshopUrl({ query: q, affiliateId: eff.bookshopId }),
      program: "bookshop",
      source: eff.source,
    };
  }
  if (want === "ku" && eff.amazonTag) {
    return {
      label: "Kindle Unlimited",
      url: buildKuTrialUrl({ tag: eff.amazonTag, domain: eff.amazonDomain }),
      program: "ku",
      source: eff.source,
    };
  }
  if (eff.amazonTag) {
    return {
      label: "Find on Amazon",
      url: buildAmazonSearchUrl({ query: q, tag: eff.amazonTag, domain: eff.amazonDomain }),
      program: "amazon",
      source: eff.source,
    };
  }
  if (eff.bookshopId) {
    return {
      label: "Bookshop.org",
      url: buildBookshopUrl({ query: q, affiliateId: eff.bookshopId }),
      program: "bookshop",
      source: eff.source,
    };
  }
  return null;
};

/**
 * Auto-rewrite a raw user-pasted URL to include the effective Amazon tag.
 * Non-Amazon URLs are returned as-is. Existing tags are preserved.
 */
export const maybeTagAmazonUrl = (raw, opts = {}) => {
  const eff = getEffectiveConfig(opts);
  if (!eff.amazonTag) return raw;
  try {
    const u = new URL(raw);
    if (!/(^|\.)amazon\.[a-z.]+$/.test(u.hostname)) return raw;
    if (u.searchParams.has("tag")) return raw;
    u.searchParams.set("tag", eff.amazonTag);
    return u.toString();
  } catch {
    return raw;
  }
};

/**
 * Auto-rewrite a raw Bookshop.org URL to include the effective affiliate id.
 * Non-Bookshop URLs are returned as-is. Existing affiliate params are preserved.
 * Bookshop accepts ?aff=<id> on product pages and ?affiliate=<id> on search.
 */
export const maybeTagBookshopUrl = (raw, opts = {}) => {
  const eff = getEffectiveConfig(opts);
  if (!eff.bookshopId) return raw;
  try {
    const u = new URL(raw);
    if (!/(^|\.)bookshop\.org$/.test(u.hostname)) return raw;
    // Already tagged (either param) — never clobber
    if (u.searchParams.has("aff") || u.searchParams.has("affiliate")) return raw;
    // Search endpoints use ?affiliate=, product pages use ?aff=
    const param = u.pathname.includes("search") ? "affiliate" : "aff";
    u.searchParams.set(param, eff.bookshopId);
    return u.toString();
  } catch {
    return raw;
  }
};

/**
 * Rewrite every supported-affiliate URL inside a free-form text blob.
 * Scans for http(s) URLs, runs each through maybeTagAmazonUrl + maybeTagBookshopUrl.
 * Used to tag links embedded in AI-generated node summaries.
 */
const URL_RE = /https?:\/\/[^\s<>"')]+/g;
export const rewriteTextAffiliates = (text, opts = {}) => {
  if (!text || typeof text !== "string") return text;
  return text.replace(URL_RE, (raw) => {
    // Strip common trailing punctuation so we don't break sentences.
    const m = raw.match(/[.,;:!?)]+$/);
    const trailing = m ? m[0] : "";
    const core = trailing ? raw.slice(0, -trailing.length) : raw;
    let out = maybeTagAmazonUrl(core, opts);
    out = maybeTagBookshopUrl(out, opts);
    return out + trailing;
  });
};

/**
 * Recursively walk a mind-map tree and rewrite every Amazon/Bookshop URL
 * inside node titles, summaries, link fields, and children — so affiliate
 * commissions flow regardless of where the AI (or an imported JSON) put a
 * book link. Returns a NEW tree; the input is not mutated.
 */
export const rewriteMapAffiliates = (node, opts = {}) => {
  if (!node || typeof node !== "object") return node;
  const next = { ...node };
  if (typeof next.title === "string") next.title = rewriteTextAffiliates(next.title, opts);
  if (typeof next.summary === "string") next.summary = rewriteTextAffiliates(next.summary, opts);
  if (typeof next.description === "string") next.description = rewriteTextAffiliates(next.description, opts);
  if (typeof next.link === "string" && next.link) {
    let l = maybeTagAmazonUrl(next.link, opts);
    l = maybeTagBookshopUrl(l, opts);
    next.link = l;
  }
  if (Array.isArray(next.children)) {
    next.children = next.children.map((c) => rewriteMapAffiliates(c, opts));
  }
  return next;
};
