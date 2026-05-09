/**
 * Lightweight currency display helper for Marvex pricing pages.
 *
 * Marvex bills exclusively in USD via Stripe — the actual charge to the
 * user's card is always USD. This module exists purely to render
 * approximate prices in the visitor's preferred currency on the
 * /pricing page so the sticker shock is calibrated to their wallet.
 *
 * Why FX rates baked into code instead of a live API?
 *   • Pricing is approximate by definition — Stripe's currency
 *     conversion at checkout will differ by a fraction of a percent.
 *   • Avoids a runtime dependency on an FX provider (rate-limit risk,
 *     downtime risk, GDPR risk if the provider sets cookies).
 *   • Updating rates is a 1-line edit when they drift — typically a
 *     quarterly chore, not a daily one.
 *
 * Rates as of Feb 2026 — refresh from xe.com / oanda when they drift
 * more than ~3% off the spot rate.
 */

const FX = {
  USD: 1.00,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.41,
  AUD: 1.53,
  JPY: 152.0,
  INR: 87.5,
  BRL: 5.85,
};

const SYMBOL = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
  INR: "₹",
  BRL: "R$",
};

const FORMAT = {
  USD: { decimals: 0 },
  GBP: { decimals: 0 },
  EUR: { decimals: 0 },
  CAD: { decimals: 0 },
  AUD: { decimals: 0 },
  JPY: { decimals: 0 },
  INR: { decimals: 0 },
  BRL: { decimals: 0 },
};

export const SUPPORTED_CURRENCIES = Object.keys(FX);

/**
 * Default currency for the pricing page.
 *
 * Policy: USD by default. We don't infer the visitor's currency from
 * `navigator.language` because browser language ≠ shopper location (UK
 * users routinely run en-US browsers, US users run en-GB, etc.) and
 * showing the wrong currency at the top of /pricing creates confusion
 * + extra Stripe FX fees. The `<CurrencySwitcher />` lets visitors flip
 * to GBP / EUR / AUD / etc. on demand and that choice is cached in
 * sessionStorage so a refresh keeps it.
 *
 * If we later add proper IP-geolocation (server-side, e.g. via the
 * Cloudflare CF-IPCountry header) we can override this with a real
 * geo-derived guess. Until then USD is the safe default.
 */
export function detectDefaultCurrency() {
  try {
    const cached = sessionStorage.getItem("marvex_currency");
    if (cached && SUPPORTED_CURRENCIES.includes(cached)) return cached;
  } catch { /* ignore */ }
  return "USD";
}

export function setCurrency(code) {
  if (!SUPPORTED_CURRENCIES.includes(code)) return;
  try { sessionStorage.setItem("marvex_currency", code); } catch { /* ignore */ }
}

/**
 * Convert a USD amount to the target currency. Returns a render-ready
 * string with symbol and locale-aware separators. Use `priceLabel` to
 * fold in the suffix (`/mo`, `/yr`, `once`).
 */
export function formatPrice(usdAmount, code = "USD") {
  const rate = FX[code] || 1;
  const decimals = (FORMAT[code] && FORMAT[code].decimals) ?? 0;
  const converted = usdAmount * rate;
  const rounded = decimals === 0 ? Math.round(converted) : Number(converted.toFixed(decimals));
  const formatted = rounded.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${SYMBOL[code] || code}${formatted}`;
}

export function priceLabel(usdAmount, code, suffix) {
  const head = formatPrice(usdAmount, code);
  return suffix ? `${head}${suffix}` : head;
}
