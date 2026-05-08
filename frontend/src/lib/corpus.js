/**
 * Public-domain corpus connector — arXiv + Project Gutenberg.
 * All requests go through our backend (/api/corpus/*) to sidestep CORS and
 * let us synthesise PDFs from Gutenberg plain-text entries.
 */
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const searchCorpus = async ({ source, q, limit = 20 }) => {
  const res = await axios.get(`${API}/corpus/search`, {
    params: { source, q, limit },
    timeout: 25000,
  });
  return res.data;
};

/**
 * Fetch a public-domain PDF via the backend proxy. Returns a `File` blob
 * ready to drop into the intake queue.
 */
export const fetchCorpusFile = async ({ source, url, title }) => {
  const res = await axios.get(`${API}/corpus/fetch`, {
    params: { source, url, title: title || "" },
    responseType: "blob",
    timeout: 120000,
  });
  const safeTitle = (title || "corpus").replace(/[^\w\-. ]+/g, "_");
  return new File([res.data], `${safeTitle}.pdf`, { type: "application/pdf" });
};

/**
 * Premium UK Law — BAILII full-text search.
 * Gated server-side; UI must check entitlement before calling.
 */
export const searchBailii = async ({ q, limit = 12 }) => {
  const res = await axios.get(`${API}/premium/bailii/search`, {
    params: { q, limit },
    withCredentials: true,
    timeout: 25000,
  });
  return res.data;
};

/**
 * AI case summary — backend fetches the judgment HTML, strips it, and
 * routes through the user's BYOK LLM key (or shared Emergent key) to
 * produce a structured case-note JSON. Premium UK Law required.
 */
export const summariseCase = async ({ url, title, citation, userKey }) => {
  const headers = { "Content-Type": "application/json" };
  if (userKey && userKey.key) {
    headers["x-user-api-key"] = userKey.key;
    headers["x-user-api-provider"] = userKey.provider || "anthropic";
  }
  const res = await axios.post(
    `${API}/premium/case-summary`,
    { url, title: title || "", citation: citation || "" },
    { headers, withCredentials: true, timeout: 180000 },
  );
  return res.data;
};

export const getPremiumStatus = async () => {
  const res = await axios.get(`${API}/premium/status`, { withCredentials: true, timeout: 10000 });
  return res.data;
};

export const startPremiumUkLawCheckout = async () => {
  const res = await axios.post(
    `${API}/billing/create-addon-checkout`,
    { addon: "premium_uk_law", origin_url: window.location.origin },
    { withCredentials: true, timeout: 20000 },
  );
  return res.data;
};

export const saveLexisToken = async (token) => {
  const res = await axios.put(
    `${API}/premium/lexisnexis/token`,
    { token },
    { withCredentials: true, timeout: 10000 },
  );
  return res.data;
};

export const deleteLexisToken = async () => {
  const res = await axios.delete(`${API}/premium/lexisnexis/token`, { withCredentials: true, timeout: 10000 });
  return res.data;
};

export const probeLexisToken = async () => {
  const res = await axios.get(`${API}/premium/lexisnexis/probe`, { withCredentials: true, timeout: 15000 });
  return res.data;
};
