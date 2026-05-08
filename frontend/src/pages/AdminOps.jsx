/**
 * /admin/ops — Owner Responsibilities Dashboard
 *
 * Single-screen aggregation of every ongoing thing the owner needs to
 * stay on top of.  Powered by `GET /api/admin/ops` which bundles eight
 * sections + a user-editable task list into one payload.
 *
 * Access is gated by `ADMIN_EMAILS` env var on the backend — if the
 * signed-in user's email isn't in that list, the API returns 403 and
 * the page shows an "admin-only" splash.
 *
 * Design posture: this is an internal tool — function over flourish.
 * Cards are dense, action buttons are prominent, monetary figures are
 * formatted like financial dashboards (right-aligned, USD default).
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, Sparkles, Users, Gift, Mail, Webhook,
  Check, X as XIcon, Plus, Trash2, Clock, TrendingUp, AlertTriangle,
  Heart, Key, Loader2,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const cents = (c) => `$${((Number(c) || 0) / 100).toFixed(2)}`;
const shortDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
};

// ---------------------------------------------------------------------
// Tiny presentational helpers
// ---------------------------------------------------------------------
function Card({ title, icon: Icon, accent = "cyan", children, testid }) {
  const accentClass = {
    cyan: "border-cyan-400/20 bg-cyan-400/[0.02]",
    emerald: "border-emerald-400/20 bg-emerald-400/[0.02]",
    amber: "border-amber-400/20 bg-amber-400/[0.02]",
    fuchsia: "border-fuchsia-400/20 bg-fuchsia-400/[0.02]",
    red: "border-red-400/25 bg-red-400/[0.03]",
    slate: "border-white/10 bg-white/[0.02]",
  }[accent] || "border-white/10 bg-white/[0.02]";
  const textAccent = {
    cyan: "text-cyan-300", emerald: "text-emerald-300", amber: "text-amber-300",
    fuchsia: "text-fuchsia-300", red: "text-red-300", slate: "text-[#9aa7c7]",
  }[accent];

  return (
    <div data-testid={testid} className={`rounded-2xl border p-5 ${accentClass}`}>
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon size={14} className={textAccent} />}
        <div className={`mono text-[10px] uppercase tracking-[0.22em] ${textAccent}`}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, tone = "default" }) {
  const toneClass = {
    default: "text-white", good: "text-emerald-300", warn: "text-amber-300", bad: "text-red-300",
  }[tone] || "text-white";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mono">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Task list — supports check/uncheck, add, delete
// ---------------------------------------------------------------------
function TaskList({ tasks, onChange }) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [busyIds, setBusyIds] = useState(new Set());

  const mark = (id, v) => {
    setBusyIds((s) => new Set([...s, id]));
  };
  const unmark = (id) => {
    setBusyIds((s) => {
      const n = new Set(s); n.delete(id); return n;
    });
  };

  const toggle = async (task) => {
    mark(task.id);
    try {
      await axios.patch(`${API}/admin/ops/tasks/${task.id}`, { done: !task.done });
      toast.success(task.done ? "Task reopened" : "Task marked done");
      onChange();
    } catch {
      toast.error("Couldn't update — are you signed in as admin?");
    } finally { unmark(task.id); }
  };
  const remove = async (task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    mark(task.id);
    try {
      await axios.delete(`${API}/admin/ops/tasks/${task.id}`);
      toast.success("Task deleted");
      onChange();
    } catch {
      toast.error("Couldn't delete");
    } finally { unmark(task.id); }
  };
  const add = async () => {
    if (!newTitle.trim()) return;
    try {
      await axios.post(`${API}/admin/ops/tasks`, { title: newTitle.trim(), due_date: newDue || null });
      setNewTitle(""); setNewDue(""); setAdding(false);
      onChange();
    } catch {
      toast.error("Couldn't create");
    }
  };

  return (
    <div className="space-y-2" data-testid="ops-tasklist">
      {tasks.length === 0 && (
        <div className="text-[13px] text-[#7a87ad] italic">No tasks — add one below.</div>
      )}
      {tasks.map((task) => {
        const busy = busyIds.has(task.id);
        const overdue = !task.done && task.due_date && new Date(task.due_date) < new Date();
        return (
          <div
            key={task.id}
            data-testid={`ops-task-${task.id}`}
            className={`flex items-start gap-3 rounded-lg border p-3 transition ${
              task.done ? "border-white/5 bg-white/[0.01] opacity-60" : "border-white/10 bg-white/[0.02] hover:border-cyan-400/30"
            }`}
          >
            <button
              onClick={() => toggle(task)}
              disabled={busy}
              data-testid={`ops-task-toggle-${task.id}`}
              className={`mt-0.5 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition ${
                task.done ? "bg-cyan-400/80 border-cyan-400 text-black" : "border-white/20 hover:border-cyan-400"
              }`}
            >
              {task.done && <Check size={12} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-[13.5px] font-medium ${task.done ? "text-[#7a87ad] line-through" : "text-white"}`}>
                {task.title}
              </div>
              {task.notes && (
                <div className="text-[12px] text-[#9aa7c7] mt-1 leading-relaxed">{task.notes}</div>
              )}
              {task.due_date && (
                <div className={`mono text-[10px] uppercase tracking-[0.18em] mt-1.5 inline-flex items-center gap-1 ${
                  overdue ? "text-red-300" : "text-[#7a87ad]"
                }`}>
                  <Clock size={10} />
                  {overdue ? "Overdue " : "Due "}{shortDate(task.due_date)}
                </div>
              )}
            </div>
            <button
              onClick={() => remove(task)}
              disabled={busy}
              data-testid={`ops-task-delete-${task.id}`}
              className="text-[#566187] hover:text-red-300 p-1"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}

      {adding ? (
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-400/[0.03] p-3" data-testid="ops-task-add-form">
          <input
            type="text"
            autoFocus
            placeholder="Task title (what needs doing?)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }}
            data-testid="ops-task-add-title"
            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-[13px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60 mb-2"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              data-testid="ops-task-add-due"
              className="flex-1 bg-black/30 border border-white/10 rounded-md px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/60"
            />
            <button onClick={add} data-testid="ops-task-add-save" className="cta-ghost text-[12px] px-3 py-2">
              <Check size={12} /> Save
            </button>
            <button onClick={() => setAdding(false)} className="text-[12px] text-[#7a87ad] hover:text-white px-2">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          data-testid="ops-task-add-trigger"
          className="w-full rounded-lg border border-dashed border-white/15 text-[13px] text-[#7a87ad] hover:text-cyan-200 hover:border-cyan-400/40 py-2.5 inline-flex items-center justify-center gap-1.5 transition"
        >
          <Plus size={13} /> Add a responsibility
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// BAILII donation recorder — small inline form to reduce pledge_owed
// ---------------------------------------------------------------------
function BailiiRecordForm({ onChange }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const dollars = parseFloat(amount);
    if (!dollars || dollars <= 0) {
      toast.error("Enter a donation amount");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/admin/ops/donations/bailii`, {
        amount_cents: Math.round(dollars * 100),
        note: note.trim(),
      });
      toast.success("Donation recorded");
      setAmount(""); setNote("");
      onChange();
    } catch {
      toast.error("Couldn't record donation");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/5" data-testid="bailii-record-form">
      <div className="mono text-[10px] uppercase tracking-[0.18em] text-emerald-300 mb-2">
        Record a donation
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          placeholder="$ amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          data-testid="bailii-record-amount"
          className="w-28 bg-black/30 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-emerald-400/60"
        />
        <input
          type="text"
          placeholder="Reference / note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid="bailii-record-note"
          className="flex-1 bg-black/30 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-emerald-400/60"
        />
        <button
          onClick={submit}
          disabled={busy}
          data-testid="bailii-record-save"
          className="mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-md bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/40 text-emerald-100 disabled:opacity-40"
        >
          {busy ? "…" : "Record"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------
export default function AdminOps() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await axios.get(`${API}/admin/ops`);
      setData(r.data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setError("admin-only");
      else if (status === 401) setError("signed-out");
      else setError("generic");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const markPaid = async (userId, label) => {
    if (!window.confirm(`Mark ${label || userId} as paid? (records you've sent the commission externally — doesn't actually move money)`)) return;
    setMarking((s) => new Set([...s, userId]));
    try {
      await axios.post(`${API}/affiliate/admin/affiliates/${userId}/mark-paid`);
      toast.success("Marked paid");
      load();
    } catch {
      toast.error("Couldn't mark paid");
    } finally {
      setMarking((s) => { const n = new Set(s); n.delete(userId); return n; });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="cosmic-bg min-h-screen grid place-items-center text-[#9aa7c7]" data-testid="ops-loading">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (error === "admin-only") {
    return (
      <div className="cosmic-bg min-h-screen grid place-items-center px-6 text-center" data-testid="ops-admin-only">
        <div className="max-w-md">
          <AlertTriangle size={28} className="text-amber-300 mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-3">Admin only</h1>
          <p className="text-[14px] text-[#a4b4d8] leading-relaxed mb-5">
            Add your email to <code className="text-cyan-300">ADMIN_EMAILS</code> in <code>backend/.env</code> (comma-separated if multiple)
            and restart the backend to access this dashboard.
          </p>
          <Link to="/" className="cta-ghost text-[13px]">
            <ArrowLeft size={13} /> Back to site
          </Link>
        </div>
      </div>
    );
  }
  if (error === "signed-out") {
    return (
      <div className="cosmic-bg min-h-screen grid place-items-center px-6 text-center" data-testid="ops-signed-out">
        <div className="max-w-md">
          <h1 className="text-xl font-bold mb-3">Sign in required</h1>
          <Link to="/library" className="cta-pill text-[13px]">Sign in</Link>
        </div>
      </div>
    );
  }
  if (error === "generic") {
    return (
      <div className="cosmic-bg min-h-screen grid place-items-center px-6 text-center" data-testid="ops-error">
        <div>
          <p className="text-red-300 mb-4">Couldn&apos;t load the dashboard.</p>
          <button onClick={load} className="cta-ghost text-[13px]"><RefreshCw size={13} /> Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pledgeOwedMinusDonations = Math.max(
    0,
    data.bailii_pledge.pledge_owed_cents - (data.bailii_pledge.last_donation?.amount_cents || 0),
  );

  return (
    <div className="cosmic-bg min-h-screen text-white" data-testid="ops-page">
      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" data-testid="ops-home" className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 hover:text-cyan-200 inline-flex items-center gap-1.5">
          <ArrowLeft size={12} /> Back to site
        </Link>
        <div className="flex items-center gap-3 text-[12px] text-[#7a87ad]">
          <span>Signed in as <span className="text-white">{user?.email}</span></span>
          <button onClick={load} data-testid="ops-refresh" className="cta-ghost text-[12px] px-3 py-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-20">
        <div className="mb-8">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={11} /> Owner dashboard · Marvex Ops
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Everything you owe, everyone you owe it to.</h1>
          <p className="mono text-[10px] uppercase tracking-[0.18em] text-[#566187] mt-2">
            Data as of {shortDate(data.generated_at)} · auto-refresh on page load
          </p>
        </div>

        {/* Grid */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* 1. Affiliate payouts */}
          <Card title="Affiliate payouts due" icon={Users} accent="fuchsia" testid="ops-card-affiliates">
            <div className="flex items-end justify-between mb-4">
              <Stat label="Pending" value={cents(data.affiliate_payouts.total_cents)} tone={data.affiliate_payouts.total_cents > 0 ? "warn" : "good"} />
              <div className="text-[11px] text-[#7a87ad] mono uppercase tracking-[0.18em]">
                ≥ {cents(data.affiliate_payouts.threshold_cents)} · {data.affiliate_payouts.hold_days}-day hold
              </div>
            </div>
            {data.affiliate_payouts.affiliates_due.length === 0 ? (
              <div className="text-[13px] text-[#7a87ad] italic">No one over threshold right now.</div>
            ) : (
              <div className="space-y-2">
                {data.affiliate_payouts.affiliates_due.map((a) => (
                  <div key={a.user_id} data-testid={`ops-aff-${a.user_id}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div>
                      <div className="text-[13px] font-medium text-white">{a.email || a.user_id}</div>
                      <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad]">{a.count} commissions · {cents(a.total_cents)}</div>
                    </div>
                    <button
                      onClick={() => markPaid(a.user_id, a.email)}
                      disabled={marking.has(a.user_id)}
                      data-testid={`ops-aff-mark-paid-${a.user_id}`}
                      className="mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-md bg-fuchsia-400/15 hover:bg-fuchsia-400/25 border border-fuchsia-400/40 text-fuchsia-200 disabled:opacity-40"
                    >
                      {marking.has(a.user_id) ? "…" : "Mark paid"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 2. BAILII pledge */}
          <Card title="BAILII 1% pledge" icon={Heart} accent="emerald" testid="ops-card-bailii">
            <div className="grid grid-cols-3 gap-4 mb-3">
              <Stat label="Law Packs sold" value={data.bailii_pledge.law_pack_count} />
              <Stat label="1% owed" value={cents(data.bailii_pledge.pledge_owed_cents)} tone={pledgeOwedMinusDonations > 0 ? "warn" : "good"} />
              <Stat label="Last donated" value={data.bailii_pledge.last_donation ? cents(data.bailii_pledge.last_donation.amount_cents) : "—"} />
            </div>
            {data.bailii_pledge.last_donation && (
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mb-2">
                Last: {shortDate(data.bailii_pledge.last_donation.date)} · {data.bailii_pledge.last_donation.note || "no note"}
              </div>
            )}
            <a
              href="https://www.bailii.org/bailii/contact.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-emerald-300 hover:text-emerald-200 underline-offset-4 hover:underline"
              data-testid="ops-bailii-donate-link"
            >
              bailii.org donation page →
            </a>
            <BailiiRecordForm onChange={load} />
          </Card>

          {/* 3. Waitlist */}
          <Card title="Waitlist & signups" icon={Mail} accent="cyan" testid="ops-card-waitlist">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat label="All-time" value={data.waitlist.total} />
              <Stat label="Last 7d" value={data.waitlist.signups_7d} tone="good" />
              <Stat label="Last 30d" value={data.waitlist.signups_30d} />
            </div>
            {data.waitlist.sources_30d.length > 0 && (
              <>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mb-2">
                  Top sources (30d)
                </div>
                <div className="space-y-1">
                  {data.waitlist.sources_30d.map((s) => (
                    <div key={s.source} className="flex justify-between text-[12.5px] text-[#cfdaf3]">
                      <span>{s.source}</span>
                      <span className="mono text-[11px] text-cyan-300">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* 4. Subscription health */}
          <Card title="Subscription health" icon={TrendingUp} accent={data.subscriptions.past_due > 0 ? "red" : "emerald"} testid="ops-card-subs">
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Stat label="Active" value={data.subscriptions.active} tone="good" />
              <Stat label="Trialing" value={data.subscriptions.trialing} />
              <Stat label="Past due" value={data.subscriptions.past_due} tone={data.subscriptions.past_due > 0 ? "bad" : "default"} />
              <Stat label="Canceled" value={data.subscriptions.canceled} tone="warn" />
            </div>
            {data.subscriptions.past_due_accounts.length > 0 && (
              <>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-red-300 mb-2">
                  Past due — reach out
                </div>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                  {data.subscriptions.past_due_accounts.map((a) => (
                    <div key={a.user_id} data-testid={`ops-past-due-${a.user_id}`} className="flex items-center justify-between text-[12px]">
                      <a href={`mailto:${a.email}`} className="text-cyan-300 hover:text-cyan-200 truncate">{a.email}</a>
                      <span className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] ml-2">{a.plan}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* 5. Founder badges */}
          <Card title="Founder badges" icon={Gift} accent="amber" testid="ops-card-founders">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Stat label="Taken" value={data.founders.taken} tone="good" />
              <Stat label="Limit" value={data.founders.limit} />
              <Stat label="Remaining" value={data.founders.remaining} tone={data.founders.remaining === 0 ? "warn" : "default"} />
            </div>
            {data.founders.recent.length > 0 && (
              <>
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mb-2">
                  Recent founders
                </div>
                <div className="space-y-1">
                  {data.founders.recent.map((f) => (
                    <div key={f.email || f.number} className="flex justify-between text-[12px] text-[#cfdaf3]">
                      <span className="truncate">{f.email}</span>
                      <span className="mono text-amber-300 ml-2">#{f.number}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* 6. Access codes */}
          <Card title="Access codes" icon={Key} accent="slate" testid="ops-card-access">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Defined" value={data.access_codes.defined_count} />
              <Stat label="Redeemed" value={data.access_codes.redeemed_count} />
            </div>
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mt-4">
              Codes live in <code className="text-cyan-300">ACCESS_CODES</code> in backend/.env
            </div>
          </Card>

          {/* 7. Stripe webhook health */}
          <Card title="Stripe webhook health" icon={Webhook} accent={data.stripe_webhooks.failures_7d > 0 ? "red" : "emerald"} testid="ops-card-webhooks">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#7a87ad] mono">Last event</div>
                <div className="text-[14px] text-white font-medium mt-1">
                  {data.stripe_webhooks.last_event?.event_type || "—"}
                </div>
                <div className="mono text-[10px] text-[#7a87ad] mt-0.5">
                  {shortDate(data.stripe_webhooks.last_event?.received_at)}
                </div>
              </div>
              <Stat
                label="Failures (7d)"
                value={data.stripe_webhooks.failures_7d}
                tone={data.stripe_webhooks.failures_7d > 0 ? "bad" : "good"}
              />
            </div>
            {data.stripe_webhooks.failures_7d > 0 && (
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-red-300/80 flex items-center gap-1.5">
                <AlertTriangle size={10} /> Investigate in the Stripe dashboard → Events
              </div>
            )}
          </Card>

          {/* 8. Task list — spans full width */}
          <div className="lg:col-span-2">
            <Card title="Your responsibilities" icon={Check} accent="cyan" testid="ops-card-tasks">
              <TaskList tasks={data.tasks} onChange={load} />
            </Card>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-10 text-center mono text-[10px] uppercase tracking-[0.22em] text-[#566187]">
          Data aggregated from MongoDB · Stripe webhooks · BAILII pledge ledger
        </div>
      </main>
    </div>
  );
}
