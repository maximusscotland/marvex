import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getApiKey } from "@/lib/settings";
import { getAiLedger } from "@/lib/aiLedger";
import { track } from "@/lib/posthog";

/**
 * LlmFuelGauge — 6 horizontal cubes (segmented row) showing AI capacity.
 *
 * Layout:  [R][R][A][A][G][G]   ← always-visible track, 2 red · 2 amber · 2 green
 *
 * Active cubes glow at full intensity, inactive cubes show as faint outlines.
 * Number of glowing cubes = round(level * 6). No flashing — colour alone
 * communicates state.
 *
 * Fuel level = "how much LLM runway you have right now":
 *   - BYOK key configured → drains as the user makes calls (24h rolling).
 *   - Pro user + no key → shared 24h budget.
 *   - Free + N free calls remaining (max 3) → N/3 of the tank.
 *   - Anonymous (signed-out) free user with no key → all cubes empty.
 */
const STATES = {
  full:   { color: "#3ddc84", glow: "rgba(61,220,132,0.55)",  label: "Connected" },
  good:   { color: "#7be0a8", glow: "rgba(123,224,168,0.45)", label: "Good runway" },
  ok:     { color: "#ffb547", glow: "rgba(255,181,71,0.55)",  label: "Getting low" },
  low:    { color: "#ff8a3d", glow: "rgba(255,138,61,0.6)",   label: "Low runway" },
  empty:  { color: "#ff4f5e", glow: "rgba(255,79,94,0.7)",    label: "Empty" },
};

// Pick a discrete state from a continuous fuel level (0..1).
const stateFromLevel = (level) => {
  if (level >= 0.85) return "full";
  if (level >= 0.55) return "good";
  if (level >= 0.30) return "ok";
  if (level > 0.0)   return "low";
  return "empty";
};

const computeState = ({ hasKey, provider, isPro, freeRemaining }) => {
  // BYOK or Pro: gauge drains with usage over a rolling 24h window.
  if (hasKey || isPro) {
    const { used, tank, level } = getAiLedger(hasKey ? provider : "shared");
    return { key: stateFromLevel(level), level, used, tank };
  }
  // Free tier: gauge tracks server-enforced 3-call counter.
  const r = typeof freeRemaining === "number" ? freeRemaining : 0;
  if (r >= 3) return { key: "good",  level: 1.0,   used: 0, tank: 3 };
  if (r === 2) return { key: "good", level: 0.66,  used: 1, tank: 3 };
  if (r === 1) return { key: "low",  level: 0.33,  used: 2, tank: 3 };
  return { key: "empty", level: 0.04, used: 3, tank: 3 };
};

export default function LlmFuelGauge({ freeRemaining = null, isPro = false, onClick }) {
  const [entry, setEntry] = useState(() => getApiKey());
  const [ledgerTick, setLedgerTick] = useState(0);
  useEffect(() => {
    const refresh = () => setEntry(getApiKey());
    const ledger  = () => setLedgerTick((n) => n + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("mindmapper:apikey-changed", refresh);
    window.addEventListener("mindmapper:ai-ledger-changed", ledger);
    // Re-evaluate every 10 minutes so old calls aging out of the 24h window
    // refill the gauge automatically.
    const id = setInterval(ledger, 10 * 60 * 1000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("mindmapper:apikey-changed", refresh);
      window.removeEventListener("mindmapper:ai-ledger-changed", ledger);
      clearInterval(id);
    };
  }, []);

  const hasKey = !!entry?.provider;
  const { key: stateKey, level, used, tank } = useMemo(
    () => computeState({ hasKey, provider: entry?.provider, isPro, freeRemaining }),
    [hasKey, entry?.provider, isPro, freeRemaining, ledgerTick],
  );
  const st = STATES[stateKey];

  // Telemetry + Pro nudge — fires once per session per state-transition. Lets
  // us measure how often users hit the BYOK soft-cap and times the upgrade
  // CTA precisely when motivation is highest.
  const lastStateRef = useRef(null);
  const nudgedRef = useRef(false);
  useEffect(() => {
    if (lastStateRef.current && lastStateRef.current !== stateKey) {
      track("gauge_state_changed", {
        from: lastStateRef.current,
        to: stateKey,
        used,
        tank,
        has_key: hasKey,
        provider: hasKey ? entry?.provider : "none",
        is_pro: !!isPro,
      });
      // Surface a friendly upgrade nudge when a non-Pro user hits empty for
      // the first time in this session. We only nudge BYOK + free — Pro is
      // unaffected (they already converted).
      if (
        stateKey === "empty" &&
        !isPro &&
        !nudgedRef.current &&
        (hasKey || (typeof freeRemaining === "number" && freeRemaining === 0))
      ) {
        nudgedRef.current = true;
        toast.message("Working hard?", {
          description:
            "Pro removes the cap of 30 map elements and unlocks Cloud Save to your Drive / Dropbox / Zotero. $15/mo, no quota anxiety.",
          duration: 9000,
          action: {
            label: "See Pro",
            onClick: () => {
              track("gauge_nudge_clicked", { from_state: stateKey });
              window.open("/pricing", "_blank", "noopener,noreferrer");
            },
          },
        });
        track("gauge_nudge_shown", { state: stateKey });
      }
    }
    lastStateRef.current = stateKey;
  }, [stateKey, used, tank, hasKey, entry?.provider, isPro, freeRemaining]);

  // Number of glowing cubes ∈ {0..6}. 6-cube layout: [R R][A A][G G].
  // Each cube's "zone" colour stays even when inactive (faint), so the user
  // always sees red-on-the-left, amber-middle, green-right.
  const cubeCount = Math.round(Math.max(0, Math.min(1, level)) * 6);
  const ZONE_COLORS = [
    "#ff4f5e", "#ff4f5e",   // 0,1 — red
    "#ffb547", "#ffb547",   // 2,3 — amber
    "#3ddc84", "#3ddc84",   // 4,5 — green
  ];

  // One-shot pulse on the cube that JUST lit up or drained.  Stores
  // {idx, dir, ts} for the most recent transition; the matching cube renders
  // with `llm-cube-pulse-in/out` class for ~360ms then the class is dropped.
  const prevCubeCountRef = useRef(cubeCount);
  const [pulse, setPulse] = useState(null);
  useEffect(() => {
    const prev = prevCubeCountRef.current;
    if (cubeCount !== prev) {
      // The cube that changed is at index min(prev, cubeCount) (the boundary).
      const idx = Math.min(prev, cubeCount);
      const dir = cubeCount > prev ? "in" : "out";
      setPulse({ idx, dir, ts: Date.now() });
      prevCubeCountRef.current = cubeCount;
      const id = setTimeout(() => setPulse(null), 380);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [cubeCount]);

  const tipLabel = hasKey
    ? `Using your ${entry.provider} key · ${used}/${tank} AI calls in last 24h${stateKey === "low" || stateKey === "empty" ? " · slow down or check provider quota" : ""}`
    : isPro
      ? `Pro · ${used}/${tank} AI calls in last 24h`
      : typeof freeRemaining === "number"
        ? `${freeRemaining} free AI ${freeRemaining === 1 ? "call" : "calls"} remaining · click to add a key`
        : "Sign in or add a key to use AI";

  return (
    <button
      data-testid="llm-fuel-gauge"
      data-state={stateKey}
      data-cubes={cubeCount}
      onClick={onClick}
      title={tipLabel}
      className="group relative inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#0a0f24]/70 backdrop-blur-sm hover:border-cyan-400/40 transition px-2 py-1.5"
      // No key AND no free calls → static "dead" gauge, no glow at all.
      // Glow the outer button only when there's actually fuel to show.
      // st.glow is already an rgba(...) string (full alpha included), so we
      // drop the legacy `33` suffix that was producing invalid CSS and
      // silently disabling the glow entirely.
      style={{ boxShadow: cubeCount > 0 ? `0 0 10px ${st.glow}` : "none" }}
    >
      {ZONE_COLORS.map((zoneColor, idx) => {
        const active = idx < cubeCount;
        const pulsing = pulse && pulse.idx === idx;
        return (
          <span
            key={idx}
            data-testid={`llm-fuel-cube-${idx}`}
            data-active={active ? "1" : "0"}
            data-pulse={pulsing ? pulse.dir : undefined}
            aria-hidden
            className={`rounded-[3px] transition-all duration-300 ${
              pulsing ? (pulse.dir === "in" ? "llm-cube-pulse-in" : "llm-cube-pulse-out") : ""
            }`}
            style={{
              width: 10,
              height: 16,
              background: active ? zoneColor : "transparent",
              border: `1px solid ${active ? zoneColor : "rgba(255,255,255,0.18)"}`,
              boxShadow: active ? `0 0 6px ${zoneColor}cc, inset 0 0 4px rgba(255,255,255,0.18)` : "none",
              opacity: active ? 1 : 0.45,
              "--pulse-color": zoneColor,
            }}
          />
        );
      })}
    </button>
  );
}
