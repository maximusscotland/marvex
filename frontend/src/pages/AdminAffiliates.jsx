import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { apiErrorMessage } from "@/lib/apiError";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const fmtUsd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
};

/**
 * /admin/affiliates — single page used to clear the quarterly payout queue.
 * Lists every affiliate with totals, lets the admin click a row to mark all
 * pending events for that user as paid (we record method + reference). Same
 * ADMIN_EMAILS gate as /admin/testimonials.
 */
export default function AdminAffiliates() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await axios.get(`${API}/admin/affiliates`, { withCredentials: true });
      setRows(r.data?.affiliates || []);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const markPaid = async (row) => {
    if (row.pending_cents <= 0) return;
    const method = window.prompt(`Payout method for ${row.email}? (wise / paypal / manual)`, "wise");
    if (method === null) return;
    const ref = window.prompt(`Payout reference (transaction id)?`, "");
    if (ref === null) return;
    setBusyId(row.user_id);
    try {
      const r = await axios.post(
        `${API}/admin/affiliates/${row.user_id}/mark-paid`,
        null,
        { params: { payout_method: method.trim() || "manual", payout_ref: ref.trim() }, withCredentials: true },
      );
      toast.success(`Marked ${r.data?.events_paid} events paid (${r.data?.payout_id})`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Mark-paid failed");
    } finally {
      setBusyId(null);
    }
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

      <main className="max-w-6xl mx-auto px-6 lg:px-12 pt-6 pb-20">
        <h1 className="text-3xl font-bold mb-6">Affiliate payouts</h1>

        {loading && <div className="text-[#9aaad0] text-[13px]">Loading…</div>}
        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-5 flex items-start gap-3" data-testid="admin-affiliates-error">
            <AlertCircle size={16} className="text-amber-300 mt-0.5" />
            <div className="text-[13px] text-amber-100">{error}</div>
          </div>
        )}
        {!loading && !error && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" data-testid="admin-affiliates-table">
            <table className="w-full text-[13px]">
              <thead className="bg-white/[0.02] text-[#7a87ad]">
                <tr>
                  <th className="text-left font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Email</th>
                  <th className="text-left font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Tier</th>
                  <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Events</th>
                  <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Pending</th>
                  <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Paid</th>
                  <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Last</th>
                  <th className="text-right font-normal mono text-[10px] uppercase tracking-[0.18em] px-4 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[#7a87ad]">No affiliates yet.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.user_id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-[#cfdaf3] font-mono text-[12px]">{r.email || r.user_id}</td>
                    <td className="px-4 py-2.5 text-[#9aaad0] capitalize">{r.tier || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-[#cfdaf3]">{r.total_events}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={r.pending_cents > 0 ? "text-amber-300 font-medium" : "text-[#7a87ad]"}>
                        {fmtUsd(r.pending_cents)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-300/90">{fmtUsd(r.paid_cents)}</td>
                    <td className="px-4 py-2.5 text-right text-[#7a87ad]">{fmtDate(r.last_event_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        data-testid={`admin-aff-payout-${r.user_id}`}
                        onClick={() => markPaid(r)}
                        disabled={r.pending_cents <= 0 || busyId === r.user_id}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium bg-cyan-500 hover:bg-cyan-400 text-[#03060f] disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 size={11} /> {busyId === r.user_id ? "…" : "Mark paid"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[12px] text-[#7a87ad]">
          Mark-paid bulk-flips every pending event for that affiliate. Capture the Wise/PayPal transaction reference when prompted.
        </p>
      </main>
    </div>
  );
}
