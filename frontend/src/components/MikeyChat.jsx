/* eslint-disable react/prop-types */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { Send, X, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLicense } from "@/lib/license";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STORAGE_KEY = "marvex.mikey.session.v1";
// Session-scoped dismissal flag for the launcher pill. Survives route
// changes within the tab but resets on browser-tab close so a user
// who gets back tomorrow still sees Mikey is available. Persistent
// dismissal would risk users forgetting the help exists when they
// later need it — sessionStorage is the gentler default.
const DISMISS_KEY = "marvex.mikey.launcher.dismissed.v1";

/**
 * MikeyChat — floating "Ask Mikey" tutor.
 *
 * Layout:
 *   - Always-visible launcher pill in the bottom-LEFT (avoids the
 *     bottom-right where the analytics banner + Made-with-Emergent
 *     badge live).
 *   - Click → side panel slides in from the left, 380×640, glass
 *     cosmic. Click outside / press Esc / click X → close.
 *   - Survives route changes — mounted globally in App.js.
 *
 * Persistence:
 *   - Session lives in sessionStorage so a refresh keeps the chat
 *     while a fresh tab starts clean. Key: `marvex.mikey.session.v1`.
 *   - Stable `session_id` is generated on first open and travels
 *     with every request so backend logs can stitch a thread.
 *
 * Smart defaults:
 *   - On first open, Mikey says hello with a context-aware greeting.
 *   - Three "starter chip" suggestions to nudge users into the flow.
 *   - Shows route + tier as a small pill so users know Mikey can see
 *     where they are (no surprises if Mikey's answer is tailored).
 */

const STARTERS = [
  "How do I create a mind map?",
  "What's the difference between Lite and Pro?",
  "How does the AI work? Do I pay extra?",
];

const newSessionId = () =>
  `mikey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Lightweight markdown renderer for Mikey replies — bold, italic,
 *  inline code, /routes auto-linkified. Done inline (rather than
 *  pulling in react-markdown) because Mikey's output is short and
 *  predictable. */
const renderInline = (text) => {
  // Split on `code`, **bold**, *italic*, /routes, plain.
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\/[a-z][a-z0-9/_-]+)/g;
  let last = 0;
  let m;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<span key={`t${key++}`}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("`") && tok.endsWith("`")) {
      parts.push(<code key={`c${key++}`} className="px-1 py-0.5 rounded bg-white/[0.08] text-cyan-200 text-[11px] font-mono">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**") && tok.endsWith("**")) {
      parts.push(<strong key={`b${key++}`} className="text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*") && tok.endsWith("*")) {
      parts.push(<em key={`i${key++}`} className="italic text-cyan-100">{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("/")) {
      parts.push(
        <a
          key={`l${key++}`}
          href={tok}
          className="text-cyan-300 underline decoration-cyan-300/40 hover:decoration-cyan-300 transition"
        >
          {tok}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<span key={`t${key++}`}>{text.slice(last)}</span>);
  return parts;
};

/** Render Mikey's reply with paragraph + bullet-list awareness. */
const RenderReply = ({ text }) => {
  const blocks = String(text || "").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => /^\s*[-•*]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1 my-1.5">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <React.Fragment key={li}>
                {renderInline(l)}
                {li < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
};

export default function MikeyChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [launcherDismissed, setLauncherDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const location = useLocation();
  const { user } = useAuth();
  const license = useLicense();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Persisted session state — { sessionId, messages: [{role, content}] }
  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.sessionId && Array.isArray(parsed.messages)) return parsed;
      }
    } catch { /* ignore */ }
    return { sessionId: newSessionId(), messages: [] };
  });

  // Sync to sessionStorage on every change.
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // The "Meet Mikey" CTA / hero button etc. dispatch this event to
  // pop the chat — they should also un-hide the launcher so the user
  // can dismiss it again later via the × on the pill.
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setLauncherDismissed(false);
      try { sessionStorage.removeItem(DISMISS_KEY); } catch { /* ignore */ }
    };
    window.addEventListener("marvex:openMikey", onOpen);
    return () => window.removeEventListener("marvex:openMikey", onOpen);
  }, []);

  const dismissLauncher = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setLauncherDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  // Tier label sent to backend for context-aware answers.
  const tierLabel = useMemo(() => {
    if (license.tier === "tester") return "tester (full access)";
    if (license.founder) return "founder (lifetime Pro)";
    if (license.isProOnly) return "pro";
    if (license.isLite) return "lite";
    return user ? "free (signed in)" : "free (signed out)";
  }, [license, user]);

  // Auto-scroll to latest message whenever the thread or busy state changes.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages, busy, open]);

  // Esc to close, /'?' inside the panel to scroll to bottom.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-focus input on open + greet on first open.
  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 100);
    if (state.messages.length === 0) {
      const greet = `Hey 👋 I'm Mikey, your guide to Marvex Studio. Ask me anything — how to build a mind map, what's in Pro, how the AI works, anything. I can see you're on \`${location.pathname}\` so I'll tailor answers to where you are.`;
      setState((s) => ({ ...s, messages: [{ role: "assistant", content: greet }] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sendMessage = useCallback(async (text) => {
    const clean = (text || "").trim();
    if (!clean || busy) return;
    setError(null);
    const next = [...state.messages, { role: "user", content: clean }];
    setState({ ...state, messages: next });
    setInput("");
    setBusy(true);
    try {
      const r = await axios.post(`${API}/mikey/chat`, {
        messages: next,
        route: location.pathname,
        tier: tierLabel,
        session_id: state.sessionId,
      }, { timeout: 30000 });
      const reply = (r.data?.reply || "").trim() || "Hmm, I drew a blank — try asking again?";
      setState((s) => ({ ...s, messages: [...next, { role: "assistant", content: reply }] }));
    } catch (e) {
      const msg = e?.response?.status === 429
        ? "You've hit the chat rate limit — give it a minute and try again."
        : "Couldn't reach me just now. Refresh and try again, or email support@marvex.app.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [busy, state, location.pathname, tierLabel]);

  const onSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const reset = () => {
    setState({ sessionId: newSessionId(), messages: [] });
    setError(null);
  };

  return (
    <>
      {/* Launcher — circular floating Mikey avatar with "Ask the Prof"
          label underneath (bottom-LEFT; right side has the analytics
          banner + Emergent badge). Hidden when the user has dismissed
          it via the × this tab session — comes back on tab refresh /
          new tab so the help isn't permanently lost. */}
      {!open && !launcherDismissed && (
        <div className="fixed bottom-5 left-5 z-[55] flex flex-col items-center">
          <button
            onClick={() => setOpen(true)}
            data-testid="mikey-launcher"
            aria-label="Open Ask the Prof"
            title="Ask the Prof"
            className="group relative w-28 h-28 rounded-full overflow-hidden border-2 border-violet-400/60 bg-[#03040a] hover:border-fuchsia-300/70 transition"
            style={{ boxShadow: "0 0 14px rgba(255,106,213,0.45), 0 8px 28px rgba(122,59,255,0.45)" }}
          >
            <img
              src="/mikey/mikey-thinking-bubble.png"
              alt="Mikey"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#03040a] shadow-[0_0_10px_rgba(52,211,153,0.85)] animate-pulse"
            />
          </button>
          <span
            data-testid="mikey-launcher-label"
            className="mt-2 mono text-[11px] uppercase tracking-[0.22em] text-violet-200/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] flex items-center gap-1.5 select-none"
          >
            Ask the Prof
            <Sparkles size={10} className="text-fuchsia-300" />
          </span>
          {/* Tiny dismiss × in the top-LEFT corner of the avatar — sits
              above Mikey's head so power-users who find him a pain can
              hide the launcher for the session without losing access
              entirely (refresh brings him back). Stops propagation so
              clicking × doesn't also open the panel. */}
          <button
            onClick={dismissLauncher}
            data-testid="mikey-launcher-dismiss"
            aria-label="Hide Mikey"
            title="Hide for this session (refresh to bring back)"
            className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full grid place-items-center bg-[#0a0f24] border border-white/15 text-[#7a87ad] hover:text-white hover:border-white/40 hover:bg-[#1a1632] transition shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Side panel */}
      {open && (
        <>
          {/* Click-outside scrim — subtle, doesn't darken too much. */}
          <div
            onClick={() => setOpen(false)}
            data-testid="mikey-scrim"
            className="fixed inset-0 z-[55] bg-black/30 backdrop-blur-[2px] fade-in"
          />
          <aside
            data-testid="mikey-panel"
            role="dialog"
            aria-label="Ask the Prof"
            className="fixed left-4 bottom-4 top-4 sm:top-auto sm:bottom-5 sm:h-[640px] z-[56] w-[calc(100%-2rem)] sm:w-[400px] flex flex-col rounded-2xl border border-violet-400/35 bg-[#0a0f24]/95 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_50px_rgba(122,59,255,0.25)] fade-up"
          >
            {/* Header */}
            <header className="flex items-center gap-3 p-3.5 border-b border-white/8">
              <span
                className="w-9 h-9 rounded-xl overflow-hidden border border-violet-400/50 grid place-items-center bg-[#03040a] flex-shrink-0"
                style={{ boxShadow: "0 0 10px rgba(255,106,213,0.45)" }}
              >
                <img src="/mikey/mikey-thinking-bubble.png" alt="" className="w-full h-full object-cover" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-white font-semibold leading-tight">Ask the Prof</div>
                <div className="mono text-[9px] uppercase tracking-[0.22em] text-violet-300/80 flex items-center gap-1.5 leading-tight mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  online · {tierLabel}
                </div>
              </div>
              <button
                onClick={reset}
                data-testid="mikey-reset"
                className="mono text-[9px] uppercase tracking-[0.22em] px-2 py-1 rounded text-[#7a87ad] hover:text-cyan-200 hover:bg-white/[0.04] transition"
                title="Start a fresh chat"
              >
                Reset
              </button>
              <button
                onClick={() => setOpen(false)}
                data-testid="mikey-close"
                className="w-7 h-7 rounded-lg grid place-items-center text-[#7a87ad] hover:text-white hover:bg-white/[0.06] transition"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </header>

            {/* Thread */}
            <div
              ref={scrollRef}
              data-testid="mikey-thread"
              className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 scroll-smooth"
            >
              {state.messages.map((m, i) => (
                <div
                  key={i}
                  data-testid={`mikey-msg-${m.role}`}
                  className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}
                >
                  {m.role === "assistant" && (
                    <span
                      className="w-7 h-7 rounded-lg overflow-hidden border border-violet-400/40 flex-shrink-0 mt-0.5"
                      style={{ boxShadow: "0 0 6px rgba(160,140,255,0.35)" }}
                    >
                      <img src="/mikey/mikey-thinking-bubble.png" alt="" className="w-full h-full object-cover" />
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-cyan-500/25 to-violet-500/15 border border-cyan-400/30 text-white rounded-br-sm"
                        : "bg-white/[0.04] border border-white/10 text-[#e2eaff] rounded-bl-sm"
                    }`}
                  >
                    {m.role === "assistant" ? <RenderReply text={m.content} /> : m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-2 items-center">
                  <span
                    className="w-7 h-7 rounded-lg overflow-hidden border border-violet-400/40 flex-shrink-0 animate-pulse"
                    style={{ boxShadow: "0 0 8px rgba(255,106,213,0.55)" }}
                  >
                    <img src="/mikey/mikey-thinking-bubble.png" alt="" className="w-full h-full object-cover" />
                  </span>
                  <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white/[0.04] border border-white/10 flex items-center gap-2 text-[12px] text-[#a4b4d8]">
                    <Loader2 size={11} className="animate-spin text-violet-300" />
                    Mikey is thinking…
                  </div>
                </div>
              )}
              {error && (
                <div
                  data-testid="mikey-error"
                  className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/30 text-[12px] text-rose-200"
                >
                  {error}
                </div>
              )}
              {/* Starter chips — only shown when the thread is fresh (just the
                  greeting message and nothing else). */}
              {state.messages.length <= 1 && !busy && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {STARTERS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      data-testid={`mikey-starter-${i}`}
                      className="text-left text-[11px] px-2.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-400/40 text-[#cfdaf3] hover:text-cyan-100 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <form onSubmit={onSubmit} className="p-3 border-t border-white/8">
              <div className="relative">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  data-testid="mikey-input"
                  placeholder="Ask anything about Marvex…"
                  maxLength={2000}
                  disabled={busy}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-full bg-[#03040a] border border-white/15 text-[13px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60 transition disabled:opacity-60"
                />
                <button
                  type="submit"
                  data-testid="mikey-send"
                  disabled={busy || !input.trim()}
                  className="absolute right-1 top-1 bottom-1 px-2 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-[#03131e] disabled:opacity-30 disabled:cursor-not-allowed grid place-items-center transition hover:shadow-[0_0_10px_rgba(0,240,255,0.45)]"
                  aria-label="Send"
                >
                  <Send size={13} />
                </button>
              </div>
              <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] text-center mt-2">
                Powered by Mikey · context-aware · ~free for you
              </div>
            </form>
          </aside>
        </>
      )}
    </>
  );
}
