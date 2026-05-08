import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Check, X, MessageSquare, ExternalLink } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin viewer for reviewer applications.  Shows all applications in
 * reverse-chronological order, with one-click Approve / Reject controls
 * and an expand-row to read the full submitted text.  Approving grants a
 * 30-day Pro window on the user record (server-side).
 */
export default function AdminReviewers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const url = filter ? `${API}/reviewer/admin/applications?status=${filter}` : `${API}/reviewer/admin/applications`;
      const res = await axios.get(url, { withCredentials: true });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const approve = async (email) => {
    try {
      await axios.post(`${API}/reviewer/admin/applications/${encodeURIComponent(email)}/approve`, null, { withCredentials: true });
      toast.success(`${email} approved · 30-day Pro granted`);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't approve");
    }
  };
  const reject = async (email) => {
    if (!window.confirm(`Reject ${email}?`)) return;
    try {
      await axios.post(`${API}/reviewer/admin/applications/${encodeURIComponent(email)}/reject`, null, { withCredentials: true });
      toast.success("Rejected");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Couldn't reject");
    }
  };

  return (
    <div className="cosmic-bg min-h-screen text-white">
      <header className="px-6 lg:px-12 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5">
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 flex items-center gap-1.5">
          <MessageSquare size={11} /> Reviewer Applications
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Reviewer queue <span className="text-[#566187] text-base font-normal">({rows.length})</span></h1>
          <div className="flex gap-1">
            {[
              { v: "",         l: "All" },
              { v: "new",      l: "New" },
              { v: "approved", l: "Approved" },
              { v: "rejected", l: "Rejected" },
            ].map((f) => (
              <button
                key={f.v}
                data-testid={`admin-reviewers-filter-${f.v || "all"}`}
                onClick={() => setFilter(f.v)}
                className={`mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded transition ${
                  filter === f.v ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40" : "border border-white/10 text-[#9aa7c7] hover:text-white"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-[#9aa7c7] py-20 text-center mono text-[12px] uppercase tracking-[0.18em]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-12 text-center text-[#9aa7c7]">
            No applications yet. Share <Link to="/feedback" className="text-cyan-300 hover:underline">/feedback</Link> on the landing page to start collecting.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const isOpen = expanded === r.email;
              return (
                <div key={r.email} data-testid={`admin-reviewer-row-${r.email}`} className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto] gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : r.email)}
                      className="text-left flex flex-col gap-1 min-w-0 hover:text-white"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[14px] text-white truncate">{r.name}</span>
                        <span className="text-[12px] text-[#7a87ad]">· {r.email}</span>
                        {r.status && (
                          <span className={`mono text-[9px] uppercase tracking-[0.22em] px-1.5 py-0.5 rounded border ${
                            r.status === "approved" ? "border-emerald-400/40 text-emerald-300 bg-emerald-500/10" :
                            r.status === "rejected" ? "border-red-400/40 text-red-300 bg-red-500/10" :
                            "border-cyan-400/40 text-cyan-300 bg-cyan-500/10"
                          }`}>{r.status}</span>
                        )}
                      </div>
                      <div className="text-[12px] text-[#9aaad0] truncate">
                        <span className="text-[#cfdaf3]">{r.role}</span>
                        {r.field && <> · {r.field}</>}
                        {r.country && <> · {r.country}</>}
                        · {r.typical_pdf_volume} PDFs
                      </div>
                      <div className="text-[12px] text-[#7a87ad] line-clamp-1">{r.use_case}</div>
                    </button>
                    <div className="flex items-center gap-1">
                      {r.status !== "approved" && (
                        <button
                          data-testid={`admin-reviewer-approve-${r.email}`}
                          onClick={() => approve(r.email)}
                          title="Approve · grant 30-day Pro"
                          className="p-1.5 rounded text-emerald-300 hover:bg-emerald-500/15"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {r.status !== "rejected" && (
                        <button
                          data-testid={`admin-reviewer-reject-${r.email}`}
                          onClick={() => reject(r.email)}
                          title="Reject"
                          className="p-1.5 rounded text-red-300 hover:bg-red-500/15"
                        >
                          <X size={14} />
                        </button>
                      )}
                      <a
                        href={`mailto:${r.email}?subject=Marvex Studio%20Reviewer%20Programme`}
                        title="Email applicant"
                        className="p-1.5 rounded text-[#7a87ad] hover:text-cyan-300"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-white/5 p-4 grid md:grid-cols-2 gap-4 text-[12px] text-[#cfdaf3] bg-[#04060d]">
                      <DetailField label="Use case" value={r.use_case} />
                      <DetailField label="First impression" value={r.first_impression} />
                      <DetailField label="Biggest friction" value={r.biggest_friction} />
                      <DetailField label="Missing feature" value={r.missing_feature} />
                      <DetailField label="Current tools" value={r.current_tools} />
                      <DetailField label="Hours / week" value={r.weekly_hours} />
                      <DetailField label="Referral source" value={r.referral_source} />
                      <DetailField label="Notes" value={r.notes} />
                      <DetailField label="Share screenshots?" value={r.can_share_screenshots ? "Yes" : "No"} />
                      <DetailField label="Share video?" value={r.can_share_video ? "Yes" : "No"} />
                      <DetailField label="Public credit?" value={r.can_share_publicly ? "Yes" : "No"} />
                      <DetailField label="Submitted" value={r.created_at?.slice(0, 10)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

const DetailField = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#7a87ad] mb-1">{label}</div>
      <div className="text-[12px] text-[#cfdaf3] whitespace-pre-wrap">{value}</div>
    </div>
  );
};
