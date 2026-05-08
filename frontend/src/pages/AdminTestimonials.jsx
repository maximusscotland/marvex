import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  Save,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const EMPTY_DRAFT = {
  quote: "",
  name: "",
  role: "",
  organization: "",
  display_order: 0,
  published: true,
};

/**
 * Admin-only testimonials curator.
 *
 * Hits /api/admin/testimonials (gated by the ADMIN_EMAILS env var server-side).
 * Renders a table of every testimonial with inline publish toggle, edit, and
 * delete; plus a "New testimonial" form at the top. Once at least 3 published
 * entries exist, the landing page swaps the placeholder personas section for
 * a real testimonials grid (see Landing.jsx).
 *
 * Auth gating
 * -----------
 * - Not signed in       → renders sign-in CTA
 * - Signed in, not admin → renders 403 with email shown so the user knows what
 *                         to add to ADMIN_EMAILS in /app/backend/.env
 * - Signed in admin     → full UI
 */
export default function AdminTestimonials() {
  const { user, signIn } = useAuth();
  const [whoami, setWhoami] = useState(null); // { email, is_admin } | null
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // id of currently-edited row
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);

  // Probe admin status the moment the user object is available.
  useEffect(() => {
    if (!user) { setWhoami(null); return; }
    axios.get(`${API}/admin/whoami`, { withCredentials: true })
      .then((r) => setWhoami(r.data))
      .catch(() => setWhoami({ email: user.email, is_admin: false }));
  }, [user]);

  const refresh = async () => {
    try {
      const r = await axios.get(`${API}/admin/testimonials`, { withCredentials: true });
      setItems(r.data?.testimonials || []);
    } catch (e) {
      if (e?.response?.status !== 403) {
        toast.error("Failed to load testimonials");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (whoami?.is_admin) {
      refresh();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whoami?.is_admin]);

  const create = async () => {
    if (!draft.quote.trim() || !draft.name.trim()) {
      toast.error("Quote and name are required");
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/admin/testimonials`, draft, { withCredentials: true });
      toast.success("Testimonial added");
      setDraft(EMPTY_DRAFT);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const update = async (id, patch) => {
    try {
      await axios.patch(`${API}/admin/testimonials/${id}`, patch, { withCredentials: true });
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update");
    }
  };

  const remove = async (id) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Delete this testimonial? This can't be undone.")) return;
    try {
      await axios.delete(`${API}/admin/testimonials/${id}`, { withCredentials: true });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to delete");
    }
  };

  const startEdit = (t) => {
    setEditing(t.id);
    setEditDraft({
      quote: t.quote,
      name: t.name,
      role: t.role || "",
      organization: t.organization || "",
      display_order: t.display_order || 0,
      published: !!t.published,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    await update(editing, editDraft);
    setEditing(null);
    toast.success("Updated");
  };

  // ---- Render guards ----
  if (!user) {
    return (
      <Shell>
        <div className="text-center py-20" data-testid="admin-signin-gate">
          <h2 className="text-2xl font-bold mb-3">Sign in required</h2>
          <p className="text-[#9aaad0] mb-6">Admin access requires you to be signed in.</p>
          <button onClick={signIn} className="cta-pill text-sm" data-testid="admin-signin-btn">
            Sign in with Google
          </button>
        </div>
      </Shell>
    );
  }

  if (whoami && !whoami.is_admin) {
    return (
      <Shell>
        <div
          className="text-center py-16 max-w-2xl mx-auto"
          data-testid="admin-not-admin-gate"
        >
          <h2 className="text-2xl font-bold mb-3">Admins only</h2>
          <p className="text-[#9aaad0] mb-6 leading-relaxed">
            Your account (<span className="text-cyan-300 mono">{whoami.email}</span>) isn&apos;t
            on the admin list. To grant yourself access, add this email to{" "}
            <code className="text-cyan-300 bg-white/5 px-1.5 py-0.5 rounded text-[12px]">
              ADMIN_EMAILS
            </code>{" "}
            in <code className="text-cyan-300 bg-white/5 px-1.5 py-0.5 rounded text-[12px]">/app/backend/.env</code>{" "}
            (comma-separated list), then restart the backend:
          </p>
          <pre className="text-left bg-[#0a0f24] border border-white/10 rounded-lg p-4 text-[12px] text-[#cfdaf3] overflow-x-auto mono">
{`# /app/backend/.env
ADMIN_EMAILS=${whoami.email}

# Then:
sudo supervisorctl restart backend`}
          </pre>
        </div>
      </Shell>
    );
  }

  if (loading || !whoami) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20 text-[#9aaad0]">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading…
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300 mb-2">
            Admin · Testimonials
          </div>
          <h1 className="text-3xl font-bold">Curate landing page social proof</h1>
          <p className="text-[#9aa7c7] mt-2 text-[14px] leading-relaxed">
            When you have <span className="text-cyan-300">3+ published</span> testimonials, the
            landing page automatically replaces the placeholder personas with real quotes.
            Until then, personas stay visible. Drafts (unpublished) won&apos;t show.
          </p>
        </header>

        {/* New testimonial form */}
        <section
          data-testid="admin-create-form"
          className="rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.03] p-5 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-white flex items-center gap-2">
              <Plus size={16} className="text-cyan-300" /> New testimonial
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
              {items.filter((i) => i.published).length} published · {items.length} total
            </span>
          </div>
          <DraftFields draft={draft} onChange={setDraft} testidPrefix="admin-create" />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={create}
              disabled={saving}
              data-testid="admin-create-submit"
              className="cta-pill text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save testimonial
            </button>
            <button
              onClick={() => setDraft(EMPTY_DRAFT)}
              className="cta-ghost text-sm"
            >
              Clear
            </button>
          </div>
        </section>

        {/* List */}
        <section data-testid="admin-list">
          {items.length === 0 ? (
            <div
              data-testid="admin-list-empty"
              className="text-center py-12 text-[#7a87ad] border border-white/5 rounded-xl bg-white/[0.01]"
            >
              No testimonials yet. Add the first one above.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((t) => {
                const isEditing = editing === t.id;
                return (
                  <article
                    key={t.id}
                    data-testid={`admin-item-${t.id}`}
                    className={`rounded-xl border p-4 ${
                      t.published
                        ? "border-white/10 bg-white/[0.02]"
                        : "border-amber-400/20 bg-amber-500/[0.04]"
                    }`}
                  >
                    {!isEditing ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] text-[#cfdaf3] leading-relaxed mb-2 italic">
                              &ldquo;{t.quote}&rdquo;
                            </p>
                            <div className="text-[12px] text-cyan-300/90 font-semibold">
                              {t.name}
                              {t.role && <span className="text-[#9aaad0] font-normal"> · {t.role}</span>}
                              {t.organization && (
                                <span className="text-[#9aaad0] font-normal"> · {t.organization}</span>
                              )}
                            </div>
                            <div className="mono text-[9px] uppercase tracking-[0.22em] text-[#566187] mt-1">
                              order: {t.display_order} · {t.published ? "published" : "draft"}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => update(t.id, { published: !t.published })}
                              data-testid={`admin-toggle-${t.id}`}
                              title={t.published ? "Unpublish" : "Publish"}
                              className={`p-1.5 rounded-lg border transition ${
                                t.published
                                  ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                  : "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                              }`}
                            >
                              {t.published ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              onClick={() => startEdit(t)}
                              data-testid={`admin-edit-${t.id}`}
                              className="cta-ghost text-[11px] py-1.5 px-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => remove(t.id)}
                              data-testid={`admin-delete-${t.id}`}
                              title="Delete"
                              className="p-1.5 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <DraftFields draft={editDraft} onChange={setEditDraft} testidPrefix={`admin-edit-${t.id}`} />
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={saveEdit}
                            data-testid={`admin-edit-save-${t.id}`}
                            className="cta-pill text-[12px]"
                          >
                            <Check size={13} /> Save
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="cta-ghost text-[12px]"
                          >
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div data-testid="admin-testimonials-page" className="min-h-screen text-white cosmic-bg">
      <header className="max-w-6xl mx-auto px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">Marvex Studio</span>
        </Link>
        <Link to="/app" className="cta-ghost text-[13px]">Studio</Link>
      </header>
      <main className="max-w-6xl mx-auto px-6 lg:px-12 pb-24">{children}</main>
    </div>
  );
}

function DraftFields({ draft, onChange, testidPrefix }) {
  const set = (k) => (e) => onChange({ ...draft, [k]: e.target.value });
  const setBool = (k) => (e) => onChange({ ...draft, [k]: e.target.checked });
  const setNum = (k) => (e) => onChange({ ...draft, [k]: Number(e.target.value) || 0 });
  return (
    <div className="space-y-2">
      <textarea
        value={draft.quote}
        onChange={set("quote")}
        placeholder="The quote — keep it short and human (1–3 sentences)"
        rows={3}
        data-testid={`${testidPrefix}-quote`}
        className="w-full bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187]"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={draft.name}
          onChange={set("name")}
          placeholder="Name (Sarah Chen)"
          data-testid={`${testidPrefix}-name`}
          className="bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187]"
        />
        <input
          value={draft.role}
          onChange={set("role")}
          placeholder="Role (PhD candidate)"
          data-testid={`${testidPrefix}-role`}
          className="bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187]"
        />
        <input
          value={draft.organization}
          onChange={set("organization")}
          placeholder="Org (Stanford)"
          data-testid={`${testidPrefix}-org`}
          className="bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={draft.display_order}
          onChange={setNum("display_order")}
          placeholder="Order"
          data-testid={`${testidPrefix}-order`}
          className="bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] outline-none focus:border-cyan-400/60 text-white placeholder-[#566187]"
        />
        <label className="flex items-center gap-2 text-[13px] text-[#cfdaf3] px-1">
          <input
            type="checkbox"
            checked={!!draft.published}
            onChange={setBool("published")}
            data-testid={`${testidPrefix}-published`}
            className="w-4 h-4 accent-cyan-400"
          />
          Published (visible on landing page)
        </label>
      </div>
    </div>
  );
}
