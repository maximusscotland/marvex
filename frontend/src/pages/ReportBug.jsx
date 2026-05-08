import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Bug, Mail, Send, CheckCircle2 } from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import usePageMeta from "@/lib/usePageMeta";
import { captureBugReport } from "@/lib/sentry";

const SITE = "https://marvex.app";
const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

/**
 * /report-bug — public bug-report intake form.
 *
 * Accessible from:
 *   • SiteLinksFooter "Report a bug" link (web)
 *   • Desktop Help → "Report a bug…" (opens this URL externally)
 *
 * Submitting fires both:
 *   1. POST /api/bugreport/submit  → emails tech@marvex.app via Resend.
 *   2. captureBugReport()          → mirrors to Sentry (when configured).
 *
 * The desktop app passes ?source=desktop&v=<app_version> in the query
 * string so the email subject correctly says "[DESKTOP]" and the
 * version is captured in the report.
 */
export default function ReportBug() {
  const [params] = useSearchParams();
  const source = (params.get("source") || "web").toLowerCase() === "desktop" ? "desktop" : "web";
  const appVersion = (params.get("v") || "").slice(0, 32);

  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);  // { id } when success

  usePageMeta({
    title: "Report a bug — Marvex Studio",
    description:
      "Found something off in Marvex Studio? Send us the details and we'll fix it. Replies land in tech@marvex.app.",
    type: "website",
    url: `${SITE}/report-bug`,
  });

  // Best-effort context capture so the support team has something to
  // work with even when the user forgets to describe their setup.
  const buildConsoleContext = () => {
    try {
      const ctx = {
        ts: new Date().toISOString(),
        ua: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href,
        source,
        app_version: appVersion || undefined,
      };
      return JSON.stringify(ctx, null, 2);
    } catch {
      return "";
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !subject.trim() || description.trim().length < 10) {
      toast.error("Please fill in your email, a short subject, and at least 10 characters of description.");
      return;
    }
    setSubmitting(true);
    const console_logs = buildConsoleContext();
    try {
      const { data } = await axios.post(`${API}/bugreport/submit`, {
        email: email.trim(),
        subject: subject.trim(),
        description: description.trim(),
        source,
        app_version: appVersion || undefined,
        url: window.location.href,
        user_agent: navigator.userAgent,
        console_logs,
      });
      // Mirror to Sentry — no-op when DSN isn't set.
      try {
        captureBugReport({
          subject: subject.trim(),
          description: description.trim(),
          email: email.trim(),
          source,
          extra: { app_version: appVersion, ref_id: data?.id },
        });
      } catch { /* sentry never breaks the flow */ }

      setDone({ id: data?.id || "" });
      toast.success("Got it — we'll be in touch.");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not submit — please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Scroll to top on mount in case the user landed deep on a long page.
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen cosmic-bg text-white" data-testid="report-bug-page">
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 text-[#9aa7c7] hover:text-cyan-200 transition" data-testid="report-bug-home">
          <ArrowLeft size={14} />
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.22em]">marvex / report a bug</span>
        </Link>
        <Link to="/learn" className="cta-ghost text-[12px]">
          Learn <ArrowRight size={12} />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-6 pb-20">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300 mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/[0.06]">
          <Bug size={12} /> {source === "desktop" ? "Desktop" : "Web"} report
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05] mb-4">
          Found something off?<br/>
          <span className="gradient-text">Tell us about it.</span>
        </h1>
        <p className="text-[15px] text-[#a4b4d8] leading-relaxed mb-8">
          Replies land in <span className="text-cyan-200">tech@marvex.app</span>. We
          read every report and most fixes ship within a few days. The more
          detail you give — what you clicked, what you expected, what
          happened — the faster we can squash it.
        </p>

        {done ? (
          <div
            data-testid="report-bug-success"
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] p-7 text-center"
          >
            <CheckCircle2 size={36} className="mx-auto text-emerald-300 mb-3" />
            <h2 className="text-2xl font-bold mb-2">Report received</h2>
            <p className="text-[14px] text-[#cfdaf3] mb-4">
              Thanks — we&apos;ll dig in shortly. Check your inbox if we
              need more details.
            </p>
            <p className="mono text-[11px] uppercase tracking-[0.18em] text-[#7a87ad]">
              Ref · {done.id || "saved"}
            </p>
            <div className="mt-6">
              <Link to="/" className="cta-pill" data-testid="report-bug-back-home">
                Back to Marvex <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5" data-testid="report-bug-form">
            <div>
              <label className="block mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">
                Your email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a87ad]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="report-bug-email"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60"
                />
              </div>
            </div>

            <div>
              <label className="block mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">
                Subject
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="One-line summary — e.g. 'Drag-and-drop crashes Studio in Safari'"
                data-testid="report-bug-subject"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60"
              />
            </div>

            <div>
              <label className="block mono text-[10px] uppercase tracking-[0.22em] text-[#7a87ad] mb-2">
                What happened?
              </label>
              <textarea
                required
                minLength={10}
                maxLength={4000}
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"Steps to reproduce + what you expected vs what happened.\n\n1. Opened Studio…\n2. Clicked…\n3. Saw…\nExpected: …"}
                data-testid="report-bug-description"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-[14px] text-white placeholder:text-[#566187] outline-none focus:border-cyan-400/60 leading-relaxed"
              />
              <div className="mono text-[10px] text-[#566187] mt-1.5 text-right">
                {description.length} / 4000
              </div>
            </div>

            {appVersion && (
              <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 mono text-[11px] text-[#9aa7c7]">
                Desktop · v{appVersion}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="cta-pill w-full justify-center"
              data-testid="report-bug-submit"
            >
              {submitting ? "Sending…" : (<>Send report <Send size={14} /></>)}
            </button>

            <p className="text-[11px] text-[#566187] text-center pt-2">
              We capture the page URL, browser, and viewport size automatically — nothing else.
            </p>
          </form>
        )}
      </main>

      <SiteLinksFooter />
    </div>
  );
}
