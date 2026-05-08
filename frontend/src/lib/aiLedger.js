/**
 * AI usage ledger — local-first counter that powers the petrol-gauge "drain"
 * effect for BYOK users.
 *
 * Design:
 *  - Every successful AI call writes a timestamp into a rolling array,
 *    keyed by provider ("anthropic" | "openai" | "gemini" | "llmgateway").
 *  - The gauge reads the count of calls in the last 24h and divides by a
 *    soft "tank size" (default 30 calls / day) to compute a 0..1 fuel level.
 *    Free-tier users still hit a hard cap at 3 server-side; this ledger is
 *    purely a UX signal for BYOK users so they can see their usage trend.
 *  - The ledger is provider-scoped — switching keys resets the count.
 *  - Cleared automatically on logout via clearApiKey().
 *
 * This is intentionally local-only — your provider's actual quota is enforced
 * by the provider; we just visualise the pace at which you're spending it.
 */

const KEY = "mindmapper.aiLedger.v1";
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24h rolling window
const DEFAULT_TANK = 30; // calls/day before the gauge reads "empty"

const read = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const write = (next) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded — drop silently */
  }
};

/**
 * Record a successful AI call against the active provider. Idempotent — safe
 * to call from the success path of every endpoint that hits the LLM.
 *
 * @param {string} provider — "anthropic" | "openai" | "gemini" | "llmgateway"
 */
export const recordAiCall = (provider = "unknown") => {
  if (!provider) return;
  const all = read();
  const list = Array.isArray(all[provider]) ? all[provider] : [];
  const now = Date.now();
  // Prune anything older than the window then push the new timestamp.
  const fresh = list.filter((ts) => now - ts < WINDOW_MS);
  fresh.push(now);
  // Cap stored entries at the tank size to keep localStorage tidy. Once
  // we're past the tank, every additional call still pegs the gauge at 0.
  all[provider] = fresh.slice(-DEFAULT_TANK * 2);
  write(all);
  // Notify gauge / settings panel
  try {
    window.dispatchEvent(new CustomEvent("mindmapper:ai-ledger-changed", { detail: { provider } }));
  } catch { /* ignore */ }
};

/**
 * Returns { used, tank, level } for the given provider.
 *  - used: calls in the last 24h
 *  - tank: soft tank size (default 30)
 *  - level: 0..1 fuel level (1.0 = full, 0.0 = empty)
 */
export const getAiLedger = (provider = "unknown", tank = DEFAULT_TANK) => {
  if (!provider) return { used: 0, tank, level: 1.0 };
  const all = read();
  const list = Array.isArray(all[provider]) ? all[provider] : [];
  const now = Date.now();
  const used = list.filter((ts) => now - ts < WINDOW_MS).length;
  const level = Math.max(0, Math.min(1, (tank - used) / tank));
  return { used, tank, level };
};

/**
 * Clear all recorded calls. Used on logout, BYOK key removal, or by an
 * explicit user action ("reset gauge").
 */
export const resetAiLedger = (provider = null) => {
  if (provider) {
    const all = read();
    delete all[provider];
    write(all);
  } else {
    write({});
  }
  try {
    window.dispatchEvent(new CustomEvent("mindmapper:ai-ledger-changed", { detail: { provider } }));
  } catch { /* ignore */ }
};
