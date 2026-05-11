import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Share2, Copy, Trash2, Loader2, Check, ExternalLink, Eye, AlertTriangle, Image as ImageIcon, Link2, Link2Off } from "lucide-react";
import { createShare, revokeShare } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { saveMap } from "@/lib/storage";
import { applyLinkVisibility, collectLinkedNodes, toggleLinkVisibility } from "@/lib/linkVisibility";

const LS_KEY = "mindmapper.shares.v1";

const readShareRegistry = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
};
const writeShareRegistry = (reg) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(reg)); } catch { /* ignore */ }
};

/**
 * ShareDialog — one modal that (a) creates a share snapshot of the
 * active map, (b) exposes the URL + view-count + revoke, (c) nudges
 * the user to sign in when they aren't yet.
 *
 * Local registry (mindmapper.shares.v1) maps { [mapId]: slug } so we
 * can show "already shared" state without a network round-trip. The
 * backend is the source of truth for view_count and aliveness.
 */
export default function ShareDialog({ open, map, onClose, onOpenShareCard }) {
  const { user, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState(null);
  const [copied, setCopied] = useState(false);
  // Local mirror of map.linkVisibility so we can toggle without mutating
  // the prop until the user actually creates the share.  Persisted back to
  // the user's local map (saveMap) on Create — that way the next share /
  // export remembers the choice.
  const [vis, setVis] = useState(() => map?.linkVisibility || {});
  // All link-bearing nodes — recomputed only when the modal first opens
  // (cheap walk, but still nice to memoise on a 1000-node map).
  const linkedNodes = useMemo(() => (open && map ? collectLinkedNodes(map) : []), [open, map]);
  const hiddenCount = linkedNodes.filter((n) => vis[n.id] === false).length;
  const visibleCount = linkedNodes.length - hiddenCount;

  // Close on Escape for parity with UpgradeDialog.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // On open, look up any existing share for this map in local registry.
  useEffect(() => {
    if (!open || !map) { setSlug(null); return; }
    const reg = readShareRegistry();
    setSlug(reg[map.id] || null);
    setCopied(false);
    setVis(map.linkVisibility || {});
  }, [open, map]);

  if (!open || !map) return null;

  // Universal share URL — points at the backend's `/api/share/:slug/unfurl`
  // endpoint which returns server-rendered HTML with full OG / Twitter
  // meta tags. This means link previews unfurl correctly on EVERY platform
  // (Slack, Discord, WhatsApp, iMessage, Twitter, LinkedIn, Facebook).
  // Real human visitors are transparently redirected to the interactive
  // SPA viewer via `<meta http-equiv="refresh">` inside the unfurl page.
  const shareUrl = slug ? `${window.location.origin}/api/share/${slug}/unfurl` : "";
  const directViewerUrl = slug ? `${window.location.origin}/share/${slug}` : "";

  const handleCreate = async () => {
    if (!user) { signIn(); return; }
    setBusy(true);
    try {
      // Persist the user's link-visibility choice back onto the local map
      // BEFORE we strip — so future exports / shares default to the same
      // selections.  Best-effort: a localStorage failure must NOT block the
      // share create itself.
      try { saveMap({ ...map, linkVisibility: vis, updatedAt: Date.now() }); } catch { /* ignore */ }

      // Apply visibility (drops opt-out URLs entirely + removes the
      // linkVisibility metadata so it never travels to the server).
      const filtered = applyLinkVisibility({ ...map, linkVisibility: vis });

      // Strip huge inline assets to keep the snapshot lean; shared links
      // aren't the right home for full high-res backgrounds / annotations.
      const snap = { ...filtered };
      delete snap.background;
      delete snap.annotations;
      const res = await createShare(snap);
      setSlug(res.slug);
      const reg = readShareRegistry();
      reg[map.id] = res.slug;
      writeShareRegistry(reg);
      // First-share celebration — fire only once per user (localStorage
      // flag, not registry size, so a user who shared, revoked, and
      // re-shared the same map doesn't get spammed). The Tweet button
      // on the toast pre-fills with the new slug + utm_source=twitter
      // so the resulting tweet is tracked end-to-end in PostHog.
      try {
        const FLAG = "marvex.share.firstCelebrated.v1";
        if (!localStorage.getItem(FLAG)) {
          localStorage.setItem(FLAG, new Date().toISOString());
          const url = `${window.location.origin}/share/${res.slug}?utm_source=twitter&utm_medium=social`;
          const text = `🎉 Just shared my first mind-map on @MarvexStudio — PDF → mind map in 1 minute, your own AI key.\n\n${map?.title ? `📌 ${map.title}\n` : ""}`;
          const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
          // Sonner's rich toast: bigger, longer, with an action button.
          toast(
            "🎉 First share — nice one!",
            {
              description: "Want a one-click tweet about it? Auto-tracked so you'll see the signups it brings in.",
              duration: 12000,
              action: {
                label: "Tweet it",
                onClick: () => {
                  try {
                    window.open(tweetHref, "_blank", "noopener,noreferrer");
                  } catch { /* ignore */ }
                },
              },
            },
          );
        } else {
          toast.success("Share link created");
        }
      } catch {
        toast.success("Share link created");
      }
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 401 || status === 403) {
        toast.error("Sign in to create a share link");
      } else if (status === 413) {
        toast.error(detail || "Map is too large to share — remove images / backgrounds first");
      } else {
        toast.error(detail || err?.message || "Could not create share");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Link copied");
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };

  const handleRevoke = async () => {
    if (!slug) return;
    setBusy(true);
    try {
      await revokeShare(slug);
      const reg = readShareRegistry();
      delete reg[map.id];
      writeShareRegistry(reg);
      setSlug(null);
      toast.success("Link revoked");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not revoke");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="share-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(3,4,10,0.78)", backdropFilter: "blur(10px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full max-w-lg glass-panel rounded-2xl p-6 fade-up"
        style={{ borderColor: "rgba(0,240,255,0.25)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1 flex items-center gap-1.5">
              <Share2 size={10} /> Share
            </div>
            <h3 id="share-dialog-title" className="text-xl font-bold text-white">
              Share <span className="gradient-text">{map.title || "this map"}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            data-testid="share-dialog-close"
            className="text-[#7a87ad] hover:text-white p-1.5 rounded-md hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {!user ? (
          <div className="space-y-4 py-4">
            <div className="text-[13px] text-[#9aa7c7] leading-relaxed">
              Sign in to publish a read-only link. Viewers don&apos;t need an account — they can
              zoom, pan and explore, but not edit or steal your map.
            </div>
            <button
              onClick={signIn}
              data-testid="share-signin"
              className="cta-pill w-full justify-center text-[14px] py-2.5"
            >
              Sign in with Google
            </button>
          </div>
        ) : !slug ? (
          <div className="space-y-4">
            <p className="text-[13px] text-[#9aa7c7] leading-relaxed">
              Publish a read-only snapshot of this map. Anyone with the link can view it — no
              account required. You can revoke the link any time.
            </p>
            <ul className="space-y-1.5 text-[12.5px] text-[#cfdaf3] pl-1">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-cyan-300 shrink-0" /> Read-only — viewers can&apos;t edit
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-cyan-300 shrink-0" /> Large images &amp; backgrounds are stripped from the snapshot
              </li>
              <li className="flex items-center gap-2">
                <Check size={14} className="text-cyan-300 shrink-0" /> Revoke any time from this dialog
              </li>
            </ul>

            {linkedNodes.length > 0 && (
              <details
                data-testid="share-link-visibility"
                className="rounded-lg border border-white/10 bg-white/[0.015] px-3 py-2 group"
              >
                <summary className="cursor-pointer mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 list-none flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 size={11} /> Visible links
                    <span className="ml-1 text-cyan-300/90 normal-case tracking-normal">
                      {visibleCount} of {linkedNodes.length}
                    </span>
                  </span>
                  <span className="text-[9px] text-[#566187] group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="mt-2.5 space-y-2">
                  <div className="text-[11.5px] text-[#7a87ad] leading-relaxed">
                    Untick any link you want to keep private. Hidden URLs are stripped from the
                    snapshot before it leaves your browser — recipients never see them.
                  </div>
                  <div className="flex items-center gap-2 text-[10px] mono uppercase tracking-[0.18em]">
                    <button
                      type="button"
                      data-testid="share-vis-show-all"
                      onClick={() => setVis({})}
                      className="px-2 py-1 rounded border border-white/10 text-cyan-300/90 hover:bg-cyan-400/10 transition"
                    >
                      Show all
                    </button>
                    <button
                      type="button"
                      data-testid="share-vis-hide-all"
                      onClick={() => setVis(Object.fromEntries(linkedNodes.map((n) => [n.id, false])))}
                      className="px-2 py-1 rounded border border-white/10 text-red-300/90 hover:bg-red-500/10 transition"
                    >
                      Hide all
                    </button>
                  </div>
                  <ul
                    data-testid="share-vis-list"
                    className="max-h-44 overflow-y-auto pr-1 space-y-1 -mx-1 px-1"
                  >
                    {linkedNodes.map((n) => {
                      const visible = vis[n.id] !== false;
                      return (
                        <li key={n.id}>
                          <label
                            className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition ${
                              visible ? "bg-white/[0.025] hover:bg-cyan-400/10" : "bg-red-500/[0.06] hover:bg-red-500/10 opacity-80"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={visible}
                              onChange={(e) => setVis((cur) => toggleLinkVisibility(cur, n.id, e.target.checked))}
                              data-testid={`share-vis-toggle-${n.id}`}
                              className="mt-[3px] accent-cyan-400 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] text-white truncate flex items-center gap-1.5">
                                {visible ? <Link2 size={10} className="text-cyan-300/80 shrink-0" /> : <Link2Off size={10} className="text-red-300/80 shrink-0" />}
                                {n.title}
                              </div>
                              <div className="text-[10px] text-[#6c7aa3] truncate font-mono">{n.link}</div>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            )}

            <button
              onClick={handleCreate}
              disabled={busy}
              data-testid="share-create"
              className="cta-pill w-full justify-center text-[14px] py-2.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              {busy ? "Creating link…" : "Create share link"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1.5 flex items-center gap-1.5">
                <Share2 size={10} /> Universal share link
                <span className="text-[9px] text-[#566187] normal-case tracking-normal">· works on Slack · Discord · WhatsApp · X · LinkedIn</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  data-testid="share-url"
                  className="flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-cyan-200 font-mono focus:outline-none focus:border-cyan-400/60"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  data-testid="share-copy"
                  className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2 rounded-lg bg-cyan-400/15 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/25 transition flex items-center gap-1.5"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-1.5 text-[10.5px] text-[#566187] leading-relaxed">
                Generates a full preview card with image &amp; title on every platform. Humans are redirected straight to the interactive viewer.
              </div>
            </div>

            {/* Direct viewer link — for users who want the prettier /share/:slug
                URL or who are linking from inside email signatures, blog posts, etc. */}
            <details
              data-testid="share-unfurl-details"
              className="rounded-lg border border-white/10 bg-white/[0.015] px-3 py-2 group"
            >
              <summary className="cursor-pointer mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 list-none flex items-center justify-between">
                <span>Direct viewer link (no preview card)</span>
                <span className="text-[9px] text-[#566187] group-open:rotate-180 transition-transform">▾</span>
              </summary>
              <div className="mt-2 space-y-2">
                <div className="text-[11.5px] text-[#7a87ad] leading-relaxed">
                  Skips the preview redirect — opens the interactive map immediately. Use for emails, blog embeds, or anywhere you want the cleanest URL.
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={directViewerUrl}
                    data-testid="share-unfurl-url"
                    className="flex-1 bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-fuchsia-200 font-mono focus:outline-none focus:border-fuchsia-400/60"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(directViewerUrl); toast("Direct link copied"); } catch { toast.error("Copy failed"); }
                    }}
                    data-testid="share-unfurl-copy"
                    className="mono text-[10px] uppercase tracking-[0.22em] px-3 py-2 rounded-lg bg-fuchsia-400/15 border border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-400/25 transition flex items-center gap-1.5"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </details>

            <div className="flex items-center justify-between px-1">
              <a
                href={directViewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="share-preview"
                className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 hover:text-white flex items-center gap-1.5"
              >
                <ExternalLink size={11} /> Preview
              </a>
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-[#6c7aa3] flex items-center gap-1.5">
                <Eye size={11} /> Live link
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-start gap-2 text-[11.5px] text-[#7a87ad] leading-relaxed">
              <AlertTriangle size={14} className="text-amber-300/80 shrink-0 mt-[2px]" />
              <div>
                Edits you make to this map from now on <strong>won&apos;t</strong> update the shared
                snapshot. Revoke &amp; re-share to publish fresh content.
              </div>
            </div>

            <button
              onClick={handleRevoke}
              disabled={busy}
              data-testid="share-revoke"
              className="mono text-[10px] uppercase tracking-[0.22em] w-full py-2 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 hover:border-red-400/60 transition flex items-center justify-center gap-1.5"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Revoke link
            </button>
          </div>
        )}

        {/* Share card — always available (works offline, no auth) */}
        {onOpenShareCard && (
          <button
            onClick={() => { onOpenShareCard(); onClose?.(); }}
            data-testid="share-open-card"
            className="mt-3 mono text-[10px] uppercase tracking-[0.22em] w-full py-2.5 rounded-lg bg-gradient-to-br from-cyan-400/15 to-violet-400/10 border border-cyan-400/30 text-cyan-200 hover:bg-cyan-400/20 hover:border-cyan-400/60 transition flex items-center justify-center gap-1.5"
          >
            <ImageIcon size={12} /> Generate share card (image)
          </button>
        )}
      </div>
    </div>
  );
}
