import React, { useEffect, useState } from "react";
import { ChevronDown, Coins } from "lucide-react";
import { SUPPORTED_CURRENCIES, detectDefaultCurrency, setCurrency } from "@/lib/currency";

/**
 * <CurrencySwitcher /> — compact dropdown for /pricing and other
 * selling pages so visitors can see prices in their own currency.
 *
 * Calls `onChange(code)` whenever the user picks a different currency
 * so the parent page can re-render its price labels. Stores the
 * choice in sessionStorage via `setCurrency` so a page refresh
 * doesn't flicker.
 *
 * Marvex always charges in USD — Stripe handles the conversion at
 * checkout. The label inside the dropdown explains this so users
 * aren't surprised when the card statement shows a different number.
 */
export default function CurrencySwitcher({ onChange, className = "" }) {
  const [code, setCode] = useState("USD");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const initial = detectDefaultCurrency();
    setCode(initial);
    onChange?.(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (c) => {
    setCode(c);
    setCurrency(c);
    setOpen(false);
    onChange?.(c);
  };

  return (
    <div className={`relative ${className}`} data-testid="currency-switcher">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        data-testid="currency-switcher-toggle"
        className="mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[#cfdaf3] hover:text-cyan-200 hover:border-cyan-400/40 transition flex items-center gap-1.5"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Coins size={11} />
        Show in {code}
        <ChevronDown size={10} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      {open && (
        <div
          role="listbox"
          data-testid="currency-switcher-menu"
          className="absolute right-0 mt-1.5 z-30 min-w-[170px] rounded-lg border border-white/10 bg-[#0a1428]/95 backdrop-blur-md shadow-xl py-1.5"
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              data-testid={`currency-option-${c}`}
              className={`w-full text-left mono text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 transition ${
                c === code
                  ? "bg-cyan-500/15 text-cyan-200"
                  : "text-[#9aa7c7] hover:bg-white/5 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
          <div className="px-3 py-2 mono text-[9.5px] uppercase tracking-[0.22em] text-[#566187] border-t border-white/5 mt-1">
            Charged in USD · approx FX
          </div>
        </div>
      )}
    </div>
  );
}
