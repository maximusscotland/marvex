import React, { useState } from "react";
import { ExternalLink, DollarSign, Info, Lock } from "lucide-react";
import { getAffiliateConfig, setAffiliateConfig, getOwnerConfig } from "@/lib/affiliates";
import { useAuth } from "@/lib/auth";

/**
 * AffiliateSettings — hybrid model. Owner's tags (from .env) are already in use
 * for every free user. Pro users can OVERRIDE with their own tags if they want
 * their own account to earn instead.
 */
export default function AffiliateSettings() {
  const [cfg, setCfg] = useState(() => getAffiliateConfig());
  const { user } = useAuth();
  const isPro = user && (user.subscription_status === "active" || user.subscription_status === "trialing");
  const owner = getOwnerConfig();

  const update = (patch) => setCfg(setAffiliateConfig(patch));

  const hasAny = cfg.amazonTag || cfg.bookshopId;
  const ownerActive = !!(owner.amazonTag || owner.bookshopId);
  const locked = !isPro;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.015] p-4" data-testid="affiliate-settings">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1 flex items-center gap-1.5">
            <DollarSign size={11} /> Affiliate override
            {locked && <Lock size={10} className="text-violet-300" />}
          </div>
          <div className="text-[13px] text-[#cfdaf3] font-medium">
            {isPro ? "Route book links through your own accounts" : "Pro-only — override the default affiliate"}
          </div>
        </div>
        <span
          className={`mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded border ${
            isPro && hasAny
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              : "bg-[#0a0f24] text-[#7a87ad] border-white/10"
          }`}
        >
          {isPro && hasAny ? "Overriding" : ownerActive ? "Default active" : "Not set"}
        </span>
      </div>

      <p className="text-[12px] text-[#7a87ad] leading-relaxed mb-3 flex items-start gap-1.5">
        <Info size={12} className="mt-[2px] shrink-0" />
        <span>
          {isPro
            ? "Paste your Amazon Associates / Bookshop.org IDs to route ALL outbound book clicks through your own affiliate account instead of the Marvex Studio default."
            : "Book links on map elements already earn commission for the Marvex Studio team. Upgrade to Pro to replace them with your own affiliate IDs — payouts flow directly to you."}
        </span>
      </p>

      {/* Amazon */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7]">
            Amazon Associates tag
          </label>
          <a
            href="https://affiliate-program.amazon.com/"
            target="_blank"
            rel="noreferrer"
            className="mono text-[9px] uppercase tracking-[0.2em] text-cyan-300 hover:text-cyan-200"
          >
            Apply <ExternalLink size={9} className="inline -translate-y-[1px]" />
          </a>
        </div>
        <div className="flex gap-2">
          <input
            data-testid="affiliate-amazon-tag"
            value={cfg.amazonTag}
            onChange={(e) => update({ amazonTag: e.target.value.trim() })}
            placeholder={isPro ? "yourname-20" : "Upgrade to override"}
            disabled={locked}
            className="flex-1 bg-[#0a0f24] border border-white/10 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-cyan-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <select
            data-testid="affiliate-amazon-domain"
            value={cfg.amazonDomain}
            onChange={(e) => update({ amazonDomain: e.target.value })}
            disabled={locked}
            className="bg-[#0a0f24] border border-white/10 rounded px-2 text-[12px] text-[#cfdaf3] disabled:opacity-50"
          >
            <option value="com">.com</option>
            <option value="co.uk">.co.uk</option>
            <option value="ca">.ca</option>
            <option value="com.au">.com.au</option>
            <option value="de">.de</option>
            <option value="fr">.fr</option>
            <option value="in">.in</option>
          </select>
        </div>
      </div>

      {/* Bookshop */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7]">
            Bookshop.org ID (10% commission)
          </label>
          <a
            href="https://bookshop.org/info/affiliates"
            target="_blank"
            rel="noreferrer"
            className="mono text-[9px] uppercase tracking-[0.2em] text-cyan-300 hover:text-cyan-200"
          >
            Apply <ExternalLink size={9} className="inline -translate-y-[1px]" />
          </a>
        </div>
        <input
          data-testid="affiliate-bookshop-id"
          value={cfg.bookshopId}
          onChange={(e) => update({ bookshopId: e.target.value.trim() })}
          placeholder={isPro ? "your-bookshop-handle" : "Upgrade to override"}
          disabled={locked}
          className="w-full bg-[#0a0f24] border border-white/10 rounded px-3 py-2 text-[13px] focus:outline-none focus:border-cyan-400/60 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Preferred */}
      <div>
        <label className="mono text-[10px] uppercase tracking-[0.2em] text-[#9aa7c7] block mb-2">
          Preferred storefront
        </label>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "amazon", label: "Amazon" },
            { id: "bookshop", label: "Bookshop.org" },
            { id: "ku", label: "Kindle Unlimited" },
          ].map((opt) => (
            <button
              key={opt.id}
              data-testid={`affiliate-preferred-${opt.id}`}
              onClick={() => update({ preferred: opt.id })}
              className={`mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border transition ${
                cfg.preferred === opt.id
                  ? "bg-cyan-400 text-[#03131e] border-cyan-400 font-bold"
                  : "text-[#9aa7c7] border-white/10 hover:border-cyan-400/50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mono text-[9px] uppercase tracking-[0.18em] text-[#566187] mt-2">
          {isPro && hasAny
            ? `Source · ${cfg.amazonTag || cfg.bookshopId || "default"}`
            : "Amazon Associates disclosure appears on the landing page footer."}
        </p>
      </div>
    </div>
  );
}
