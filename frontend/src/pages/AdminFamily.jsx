import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowLeft, ShieldCheck, Trash2, AlertCircle, Plus, Lock, UserPlus, Ticket, Copy, Ban, QrCode, Download, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
};

/**
 * /admin/family — self-serve unlimited-access management. The owner types an
 * email + optional note, clicks Grant, and that account gets lifetime Pro
 * the next time they sign in (or immediately if they're already a registered
 * user).  No SSH, no env-edit, no restart.
 *
 * Two sources of truth surface here:
 *   - "static" (env-var FAMILY_EMAILS) — read-only, shown for transparency
 *   - "dynamic" (Mongo `family_allowlist`) — managed via this UI
 */
export default function AdminFamily() {
  const [data, setData] = useState({ static: [], dynamic: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  // Invite-code section state
  const [invites, setInvites] = useState([]);
  const [invLabel, setInvLabel] = useState("");
  const [invMax, setInvMax] = useState("");
  const [invDays, setInvDays] = useState("");
  const [invBusy, setInvBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, ri] = await Promise.all([
        axios.get(`${API}/admin/family/emails`, { withCredentials: true }),
        axios.get(`${API}/admin/invites`, { withCredentials: true }),
      ]);
      setData(r.data || { static: [], dynamic: [] });
      setInvites(ri.data?.invites || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const grant = async (e) => {
    e?.preventDefault?.();
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(clean)) {
      toast.error("That doesn't look like an email");
      return;
    }
    setBusy(true);
    try {
      const r = await axios.post(`${API}/admin/family/emails`, { email: clean, note }, { withCredentials: true });
      toast.success(r.data?.retro_granted
        ? `${clean} now has unlimited access (granted immediately — they're already signed up)`
        : `${clean} added — they'll get unlimited access on their next sign-in`);
      setEmail("");
      setNote("");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (em) => {
    if (!window.confirm(`Remove ${em} from the family allowlist?\n\nNote: this won't downgrade their account immediately — they'll keep current Pro until you manually downgrade them in MongoDB if needed.`)) return;
    try {
      await axios.delete(`${API}/admin/family/emails/${encodeURIComponent(em)}`, { withCredentials: true });
      toast.success("Removed from allowlist");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const createInvite = async (e) => {
    e?.preventDefault?.();
    setInvBusy(true);
    try {
      const body = { label: invLabel.trim() };
      const max = parseInt(invMax, 10);
      const days = parseInt(invDays, 10);
      if (Number.isFinite(max) && max > 0) body.max_redemptions = max;
      if (Number.isFinite(days) && days > 0) body.expires_in_days = days;
      const r = await axios.post(`${API}/admin/invites`, body, { withCredentials: true });
      toast.success(`Invite created: ${r.data.code}`);
      setInvLabel(""); setInvMax(""); setInvDays("");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create invite");
    } finally {
      setInvBusy(false);
    }
  };

  const copyInvite = async (code) => {
    const url = `${window.location.origin}/redeem?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Redemption link copied", { description: url });
    } catch {
      toast.error("Couldn't copy — long-press to copy manually");
    }
  };

  const copyInviteCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Code ${code} copied`);
    } catch {
      toast.error("Couldn't copy — long-press to copy manually");
    }
  };

  const revokeInvite = async (code) => {
    if (!window.confirm(`Revoke ${code}?\n\nFurther redemption attempts will fail. Already-redeemed users keep their Pro grant.`)) return;
    try {
      await axios.post(`${API}/admin/invites/${code}/revoke`, null, { withCredentials: true });
      toast.success("Invite revoked");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  // QR-code modal — admin clicks "QR" on an invite row to surface a printable
  // matrix that encodes the full /redeem?code=… URL. Useful for posters,
  // classroom flyers, conference badges. Pure-canvas, generated client-side.
  const [qrInvite, setQrInvite] = useState(null);   // { code, url, dataUrl }

  const openQr = async (code) => {
    const url = `${window.location.origin}/redeem?code=${code}`;
    try {
      // High error-correction so a printed sticker tolerates a coffee stain.
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "H",
        margin: 2,
        scale: 10,
        color: { dark: "#0b1535", light: "#ffffff" },
      });
      setQrInvite({ code, url, dataUrl });
    } catch (e) {
      toast.error("Couldn't generate QR — " + (e?.message || "unknown error"));
    }
  };

  const downloadQr = () => {
    if (!qrInvite) return;
    const a = document.createElement("a");
    a.href = qrInvite.dataUrl;
    a.download = `mind-mapper-invite-${qrInvite.code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("QR saved as PNG");
  };

  return (
    <div className="min-h-screen cosmic-bg text-white">
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between">
        <Link to="/" className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 inline-flex items-center gap-1.5">
          <ArrowLeft size={12} /> marvex.app
        </Link>
        <span className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 inline-flex items-center gap-1.5">
          <ShieldCheck size={11} /> Admin
        </span>
      </header>

      <main className="max-w-3xl mx-auto px-6 lg:px-12 pt-6 pb-20" data-testid="admin-family-page">
        <div className="mb-8">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-emerald-300/80 mb-2 inline-flex items-center gap-1.5">
            <UserPlus size={11} /> Gifted access
          </div>
          <h1 className="text-3xl font-bold mb-2">Unlimited access for family & friends</h1>
          <p className="text-[14px] text-[#a4b4d8] leading-relaxed max-w-2xl">
            Add a Google email here to grant lifetime Pro at no charge. Idempotent — paste a list, no
            duplicates. Removing a row stops auto-grant on future logins (existing Pro stays until you
            manually downgrade if needed).
          </p>
        </div>

        {/* Add form */}
        <form onSubmit={grant} className="rounded-xl border border-emerald-400/30 bg-emerald-500/[0.04] p-5 mb-8" data-testid="admin-family-form">
          <div className="grid sm:grid-cols-[2fr_2fr_auto] gap-2.5">
            <input
              data-testid="admin-family-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@gmail.com"
              required
              autoComplete="off"
              className="bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white outline-none focus:border-emerald-400/60"
            />
            <input
              data-testid="admin-family-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="Optional note (sister, beta tester, etc.)"
              className="bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white outline-none focus:border-emerald-400/60"
            />
            <button
              data-testid="admin-family-grant-btn"
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-emerald-500 hover:bg-emerald-400 text-[#03060f] disabled:opacity-50 transition"
            >
              <Plus size={13} /> {busy ? "…" : "Grant unlimited"}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-[#7a87ad]">
            They'll see no payment screen, no quota, no upsells — just unlimited Pro the moment they sign in with that Google account.
          </p>
        </form>

        {loading && <div className="text-[#9aaad0] text-[13px]">Loading…</div>}
        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-5 flex items-start gap-3 mb-6" data-testid="admin-family-error">
            <AlertCircle size={16} className="text-amber-300 mt-0.5" />
            <div className="text-[13px] text-amber-100">{error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {data.static.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-white mb-2 inline-flex items-center gap-2">
                  <Lock size={12} className="text-[#7a87ad]" />
                  From <code className="bg-white/5 px-1.5 py-0.5 rounded text-[11px] text-cyan-200">FAMILY_EMAILS</code> env var (read-only)
                </h3>
                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  {data.static.map((row) => (
                    <div key={row.email} className="px-4 py-2.5 border-b border-white/5 last:border-b-0 flex items-center gap-3">
                      <span className="text-[#cfdaf3] font-mono text-[12px] flex-1">{row.email}</span>
                      <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad]">env</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Added via this UI</h3>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" data-testid="admin-family-list">
                {data.dynamic.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[#7a87ad] text-[13px]" data-testid="admin-family-empty">
                    No emails added yet. Use the form above to invite your first family member.
                  </div>
                ) : data.dynamic.map((row) => (
                  <div key={row.email} className="px-4 py-2.5 border-b border-white/5 last:border-b-0 flex items-center gap-3" data-testid={`admin-family-row-${row.email}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[#cfdaf3] font-mono text-[12px] truncate">{row.email}</div>
                      {row.note && <div className="text-[11px] text-[#7a87ad] truncate">{row.note}</div>}
                    </div>
                    {row.added_by && (
                      <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187] hidden sm:inline">
                        by {row.added_by.split("@")[0]}
                      </span>
                    )}
                    <button
                      data-testid={`admin-family-revoke-${row.email}`}
                      onClick={() => revoke(row.email)}
                      title="Remove from allowlist"
                      className="p-1.5 rounded text-[#7a87ad] hover:bg-red-500/15 hover:text-red-300 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ------------- INVITE CODES ------------- */}
            <div className="mt-12">
              <div className="mb-4">
                <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-1 inline-flex items-center gap-1.5">
                  <Ticket size={11} /> Invite codes
                </div>
                <h2 className="text-xl font-semibold text-white mb-1">Sharable invite links</h2>
                <p className="text-[13px] text-[#9aaad0] leading-relaxed max-w-2xl">
                  Generate a code (looks like <code className="text-cyan-200 font-mono">MIND-FAM-7K2A</code>), DM it to anyone — they paste it at <Link to="/redeem" className="text-cyan-300 hover:underline">/redeem</Link> after signing in and get lifetime Pro instantly. Optional cap on redemptions and expiry. No emails needed up-front.
                </p>
              </div>

              <form onSubmit={createInvite} className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/[0.04] p-5 mb-6" data-testid="admin-invite-form">
                <div className="grid sm:grid-cols-[2fr_1fr_1fr_auto] gap-2.5">
                  <input
                    data-testid="admin-invite-label"
                    type="text"
                    value={invLabel}
                    onChange={(e) => setInvLabel(e.target.value.slice(0, 120))}
                    placeholder="Label (e.g. Family, Beta cohort A)"
                    className="bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white outline-none focus:border-fuchsia-400/60"
                  />
                  <input
                    data-testid="admin-invite-max"
                    type="number"
                    min={1}
                    value={invMax}
                    onChange={(e) => setInvMax(e.target.value)}
                    placeholder="Max uses (blank = ∞)"
                    className="bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white outline-none focus:border-fuchsia-400/60"
                  />
                  <input
                    data-testid="admin-invite-days"
                    type="number"
                    min={1}
                    value={invDays}
                    onChange={(e) => setInvDays(e.target.value)}
                    placeholder="Expires in days (blank = never)"
                    className="bg-[#0a0f24] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white outline-none focus:border-fuchsia-400/60"
                  />
                  <button
                    data-testid="admin-invite-create-btn"
                    type="submit"
                    disabled={invBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-medium bg-fuchsia-500 hover:bg-fuchsia-400 text-[#03060f] disabled:opacity-50 transition"
                  >
                    <Plus size={13} /> {invBusy ? "…" : "Create"}
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" data-testid="admin-invite-list">
                {invites.length === 0 ? (
                  <div className="px-4 py-10 text-center text-[#7a87ad] text-[13px]" data-testid="admin-invite-empty">
                    No invite codes yet. Generate one and DM it to anyone.
                  </div>
                ) : invites.map((inv) => {
                  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/redeem?code=${inv.code}`;
                  return (
                  <div key={inv.code} className="px-4 py-3 border-b border-white/5 last:border-b-0 flex items-center gap-3 flex-wrap" data-testid={`admin-invite-row-${inv.code}`}>
                    <div className="flex-1 min-w-[260px]">
                      <div className={`font-mono text-[14px] tracking-wider ${inv.revoked ? "text-[#566187] line-through" : "text-cyan-200"}`}>
                        {inv.code}
                      </div>
                      <div className="text-[11px] text-[#7a87ad]">
                        {inv.label || "—"}
                        {" · "}
                        <span className="text-[#cfdaf3]">{inv.redemptions}</span> / {inv.max_redemptions || "∞"} used
                        {inv.expires_at && <> · expires {fmtDate(inv.expires_at)}</>}
                        {inv.revoked && <span className="text-amber-300"> · revoked</span>}
                      </div>
                      {!inv.revoked && (
                        <div
                          className="mt-1 text-[10px] font-mono text-[#5e6a91] break-all select-all"
                          data-testid={`admin-invite-url-${inv.code}`}
                          title="Full redemption URL — click any button on the right to copy"
                        >
                          {url}
                        </div>
                      )}
                    </div>
                    <button
                      data-testid={`admin-invite-qr-${inv.code}`}
                      onClick={() => openQr(inv.code)}
                      disabled={inv.revoked}
                      title="Show printable QR code for this invite"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium border border-fuchsia-400/40 bg-fuchsia-500/[0.08] hover:bg-fuchsia-500/[0.16] text-fuchsia-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <QrCode size={11} /> QR
                    </button>
                    <button
                      data-testid={`admin-invite-copy-code-${inv.code}`}
                      onClick={() => copyInviteCode(inv.code)}
                      disabled={inv.revoked}
                      title="Copy just the code (no URL)"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-[#cfdaf3] disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <Copy size={11} /> Code
                    </button>
                    <button
                      data-testid={`admin-invite-copy-${inv.code}`}
                      onClick={() => copyInvite(inv.code)}
                      disabled={inv.revoked}
                      title="Copy the full /redeem?code=... URL"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#03060f] disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <Copy size={11} /> Copy link
                    </button>
                    {!inv.revoked && (
                      <button
                        data-testid={`admin-invite-revoke-${inv.code}`}
                        onClick={() => revokeInvite(inv.code)}
                        title="Revoke (further redemptions will fail)"
                        className="p-1.5 rounded text-[#7a87ad] hover:bg-red-500/15 hover:text-red-300 transition"
                      >
                        <Ban size={13} />
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* QR-code preview modal — appears after clicking "QR" on an invite row.
          Shows a 512px-rendered matrix encoding the full /redeem?code=… URL,
          plus a download button so the admin can drop it into a flyer / poster
          / classroom handout in one tap. Pure-canvas, no server roundtrip. */}
      {qrInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          data-testid="admin-invite-qr-modal"
          onClick={() => setQrInvite(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0f24] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setQrInvite(null)}
              data-testid="admin-invite-qr-close"
              className="absolute top-3 right-3 p-1.5 rounded text-[#7a87ad] hover:bg-white/[0.06] hover:text-white transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <div className="text-center">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2 inline-flex items-center gap-1.5">
                <QrCode size={11} /> Scannable invite
              </div>
              <div className="font-mono text-[15px] tracking-wider text-cyan-200 mb-4">{qrInvite.code}</div>
              <div className="rounded-xl bg-white p-4 inline-block mb-4">
                <img
                  src={qrInvite.dataUrl}
                  alt={`QR code for ${qrInvite.code}`}
                  data-testid="admin-invite-qr-image"
                  className="w-64 h-64 block"
                />
              </div>
              <div className="text-[11px] font-mono text-[#7a87ad] break-all mb-5 select-all">{qrInvite.url}</div>
              <button
                onClick={downloadQr}
                data-testid="admin-invite-qr-download"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold bg-fuchsia-500 hover:bg-fuchsia-400 text-[#03060f] transition"
              >
                <Download size={13} /> Download PNG
              </button>
              <p className="mt-4 text-[11px] text-[#566187] leading-relaxed">
                Scan with any phone camera → opens <span className="text-cyan-300">/redeem</span> with the code pre-filled.
                Anyone signed in to Google gets lifetime Pro instantly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
