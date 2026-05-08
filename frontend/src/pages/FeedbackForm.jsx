import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Send, CheckCircle2, MessageSquare, Star } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_OPTIONS = [
  "Student / PhD researcher",
  "Indie writer / author",
  "Knowledge worker / consultant",
  "Educator / teacher",
  "Founder / product person",
  "Lifelong learner",
  "Other",
];

const VOLUME_OPTIONS = ["<5/week", "5-20/week", "20-50/week", "50+/week"];
const HOURS_OPTIONS  = ["<1", "1-3", "3-5", "5+"];

/**
 * Reviewer-application form — replaces the generic "email us" CTA on the
 * landing page.  Designed to elicit the specific signal we need to ship a
 * better V1: who you are, how you'd actually use it, what you currently
 * use, and your honest first impression.  Cosmic dark, narrow column,
 * progress chips along the way.  Submits to POST /api/reviewer/apply.
 */
export default function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [field, setField] = useState("");
  const [country, setCountry] = useState("");
  const [useCase, setUseCase] = useState("");
  const [volume, setVolume] = useState("");
  const [currentTools, setCurrentTools] = useState("");
  const [firstImpression, setFirstImpression] = useState("");
  const [biggestFriction, setBiggestFriction] = useState("");
  const [missingFeature, setMissingFeature] = useState("");
  const [canScreenshots, setCanScreenshots] = useState(true);
  const [canVideo, setCanVideo] = useState(false);
  const [canPublic, setCanPublic] = useState(false);
  const [hours, setHours] = useState("");
  const [referral, setReferral] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const valid = name.trim() && email.trim() && role && useCase.trim().length >= 10 && volume && firstImpression.trim().length >= 10;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/reviewer/apply`, {
        name: name.trim(),
        email: email.trim(),
        role,
        field: field.trim() || null,
        country: country.trim() || null,
        use_case: useCase.trim(),
        typical_pdf_volume: volume,
        current_tools: currentTools.trim() || null,
        first_impression: firstImpression.trim(),
        biggest_friction: biggestFriction.trim() || null,
        missing_feature: missingFeature.trim() || null,
        can_share_screenshots: !!canScreenshots,
        can_share_video: !!canVideo,
        can_share_publicly: !!canPublic,
        weekly_hours: hours || null,
        referral_source: referral.trim() || null,
        notes: notes.trim() || null,
      });
      setSubmitted(true);
      toast.success("Application sent — we'll be in touch.");
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Couldn't send";
      toast.error(typeof msg === "string" ? msg : "Couldn't send");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="cosmic-bg min-h-screen text-white flex items-center justify-center px-6 py-16">
        <div className="max-w-xl w-full text-center fade-up">
          <CheckCircle2 size={56} className="text-emerald-300 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold mb-3">You're in the queue.</h1>
          <p className="text-[#a4b4d8] text-[15px] leading-relaxed mb-8">
            Thanks for applying — we read every form personally. Approved reviewers
            get a Pro access code by email within 7 days. In the meantime, the free
            tier is fully open.
          </p>
          <Link to="/library" data-testid="feedback-go-library" className="cta-pill text-[14px]">
            Open Library →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cosmic-bg min-h-screen text-white">
      <header className="px-6 lg:px-12 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
        <Link to="/" data-testid="feedback-back" className="mono text-[10px] uppercase tracking-[0.22em] text-[#9aa7c7] hover:text-cyan-300 flex items-center gap-1.5">
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 flex items-center gap-1.5">
          <Sparkles size={11} /> Reviewer programme
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Apply to be a <span className="gradient-text">reviewer.</span>
          </h1>
          <p className="text-[#a4b4d8] text-[15px] leading-relaxed">
            Free month of Pro for honest feedback. We're looking for ~50 active researchers,
            writers, and knowledge workers who'll <strong className="text-white">actually use</strong> Marvex Studio
            for a week and tell us what's broken. Approved within 7 days.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-6" data-testid="feedback-form">
          <Section icon={MessageSquare} label="Who you are">
            <Field label="Name *">
              <input data-testid="feedback-name" required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Email *">
              <input data-testid="feedback-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Role *">
              <select data-testid="feedback-role" required value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                <option value="">Pick one…</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Field / discipline">
                <input data-testid="feedback-field" placeholder="e.g. Cognitive science" value={field} onChange={(e) => setField(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Country">
                <input data-testid="feedback-country" placeholder="e.g. UK" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section icon={Star} label="How you'd use it">
            <Field label="Your typical use case * (1-2 sentences)">
              <textarea
                data-testid="feedback-usecase"
                required
                rows={3}
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. I read 20 papers a week for my dissertation on attention; I want to map cross-references without losing citations."
                className={inputCls}
              />
            </Field>
            <Field label="PDFs you process per week *">
              <div className="flex flex-wrap gap-2">
                {VOLUME_OPTIONS.map((v) => (
                  <Chip key={v} testid={`feedback-volume-${v.replace(/[^a-z0-9]+/gi, "_")}`} active={volume === v} onClick={() => setVolume(v)}>{v}</Chip>
                ))}
              </div>
            </Field>
            <Field label="Tools you currently use">
              <input data-testid="feedback-tools" placeholder="e.g. Notion, Obsidian, Zotero, Mendeley, MarginNote…" value={currentTools} onChange={(e) => setCurrentTools(e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <Section icon={Sparkles} label="Your honest first impression">
            <Field label="What's your gut reaction after a quick play? *">
              <textarea
                data-testid="feedback-impression"
                required
                rows={4}
                value={firstImpression}
                onChange={(e) => setFirstImpression(e.target.value)}
                placeholder="Be brutal. What works, what feels off, what's confusing?"
                className={inputCls}
              />
            </Field>
            <Field label="Biggest friction you hit">
              <textarea data-testid="feedback-friction" rows={2} value={biggestFriction} onChange={(e) => setBiggestFriction(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Missing feature that would make you switch fully">
              <textarea data-testid="feedback-missing" rows={2} value={missingFeature} onChange={(e) => setMissingFeature(e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <Section icon={CheckCircle2} label="Commitment">
            <Field label="Willing to share…">
              <div className="flex flex-col gap-2 pt-1">
                <Toggle data-testid="feedback-screenshots" checked={canScreenshots} onChange={setCanScreenshots}>Screenshots of your maps (anonymised OK)</Toggle>
                <Toggle data-testid="feedback-video" checked={canVideo} onChange={setCanVideo}>A 2-min screen-recording walkthrough</Toggle>
                <Toggle data-testid="feedback-public" checked={canPublic} onChange={setCanPublic}>OK to be credited publicly as a reviewer</Toggle>
              </div>
            </Field>
            <Field label="Hours per week you can give">
              <div className="flex flex-wrap gap-2">
                {HOURS_OPTIONS.map((h) => (
                  <Chip key={h} testid={`feedback-hours-${h.replace(/[^a-z0-9]+/gi, "_")}`} active={hours === h} onClick={() => setHours(h)}>{h} h</Chip>
                ))}
              </div>
            </Field>
            <Field label="How did you hear about us?">
              <input data-testid="feedback-referral" value={referral} onChange={(e) => setReferral(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Anything else">
              <textarea data-testid="feedback-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <div className="pt-2 flex items-center justify-end gap-3">
            <p className="text-[11px] text-[#566187] mr-auto">
              We never sell your data. Approved reviewers get a 30-day Pro grant.
            </p>
            <button
              type="submit"
              data-testid="feedback-submit"
              disabled={!valid || submitting}
              className="cta-pill text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send application"} <Send size={13} />
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

const inputCls = "w-full bg-[#0a0f24] border border-white/10 rounded-md px-3 py-2 text-[13px] text-white placeholder-[#566187] focus:outline-none focus:border-cyan-400/60 transition";

const Field = ({ label, children }) => (
  <label className="block">
    <div className="mono text-[10px] uppercase tracking-[0.18em] text-[#9aaad0] mb-1.5">{label}</div>
    {children}
  </label>
);

const Section = ({ icon: Icon, label, children }) => (
  <section className="rounded-xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
    <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/90">
      <Icon size={12} /> {label}
    </div>
    {children}
  </section>
);

const Chip = ({ active, onClick, children, testid }) => (
  <button
    type="button"
    data-testid={testid}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-[11px] mono uppercase tracking-[0.18em] border transition ${
      active
        ? "border-cyan-400/80 bg-cyan-500/15 text-cyan-200"
        : "border-white/10 bg-white/[0.02] text-[#9aaad0] hover:border-cyan-400/40 hover:text-cyan-200"
    }`}
  >
    {children}
  </button>
);

const Toggle = ({ checked, onChange, children, ...rest }) => (
  <label className="flex items-start gap-2 cursor-pointer text-[12px] text-[#cfdaf3] hover:text-white">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5 accent-cyan-400"
      {...rest}
    />
    <span>{children}</span>
  </label>
);
