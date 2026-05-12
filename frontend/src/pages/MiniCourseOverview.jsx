/* eslint-disable react/prop-types */
import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, GraduationCap, CheckCircle2, Link2, CalendarDays, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import RelatedReads from "@/components/RelatedReads";
import { COURSE, LESSONS } from "@/lib/miniCourse";
import usePageMeta from "@/lib/usePageMeta";

const SITE = "https://marvex.app";

/**
 * /mini-course/teaching-with-mind-maps — overview / landing page for the
 * mini-course. Renders Course JSON-LD so Google can show the course in
 * rich results (course carousel, "find a course" intent).
 *
 * Visual narrative:
 *   1. Hero — title, audience, total time, outcome statement.
 *   2. "Two pillars" strip — the editorial pillars of the course
 *      (one-click resources + map-to-timeline). These are also the two
 *      Marvex differentiators most likely to convert a casual teacher
 *      visitor into a Pro subscriber.
 *   3. Lesson grid — five tiles, each clicks into the lesson route.
 *   4. CTA — start with lesson 1.
 *   5. RelatedReads → footer.
 */
function CourseJsonLd() {
  useEffect(() => {
    const data = {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": COURSE.title,
      "description": COURSE.description,
      "provider": {
        "@type": "Organization",
        "name": "Marvex Studio",
        "url": SITE,
      },
      "url": `${SITE}/mini-course/${COURSE.slug}`,
      "dateModified": COURSE.updatedAt,
      "audience": { "@type": "EducationalAudience", "educationalRole": "teacher" },
      "timeRequired": `PT${COURSE.minutesTotal}M`,
      "hasCourseInstance": {
        "@type": "CourseInstance",
        "courseMode": "online",
        "courseWorkload": `PT${COURSE.minutesTotal}M`,
        "instructor": { "@type": "Organization", "name": "Marvex Studio" },
      },
      "hasPart": LESSONS.map((l) => ({
        "@type": "LearningResource",
        "name": l.title,
        "url": `${SITE}/mini-course/${COURSE.slug}/lesson/${l.slug}`,
        "timeRequired": `PT${l.minutesRead}M`,
      })),
    };
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = "course-jsonld";
    tag.textContent = JSON.stringify(data);
    // Remove a stale one (StrictMode double-mount safety).
    document.getElementById("course-jsonld")?.remove();
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);
  return null;
}

export default function MiniCourseOverview() {
  usePageMeta({
    title: COURSE.metaTitle,
    description: COURSE.description,
    canonical: `${SITE}/mini-course/${COURSE.slug}`,
    ogImage: `${SITE}/og/mini-course-teaching.png`,
  });

  const totalLessons = LESSONS.length;

  return (
    <div data-testid="mini-course-overview" className="min-h-screen cosmic-bg text-white">
      <CourseJsonLd />

      <header className="relative z-20 px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" data-testid="course-logo-home" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.32em] text-cyan-300/80">Marvex Studio</span>
        </Link>
        <Link to="/learn" data-testid="course-back-learn" className="flex items-center gap-1.5 text-[12px] text-[#9aa7c7] hover:text-cyan-200 transition">
          <ArrowLeft size={13} /> All tutorials
        </Link>
      </header>

      <main className="relative z-10 px-6 lg:px-12 pt-8 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-4 flex items-center gap-2">
            <GraduationCap size={13} className="text-fuchsia-300/80" />
            Mini-course · {totalLessons} lessons · ~{COURSE.minutesTotal} min
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-6">
            {COURSE.title}
          </h1>
          <p className="text-lg text-[#a4b4d8] leading-relaxed mb-3">
            {COURSE.description}
          </p>
          <p className="text-[13px] mono uppercase tracking-[0.22em] text-cyan-300/80 mb-10">
            For: {COURSE.audience}
          </p>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-6 mb-12">
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-2">
              By the end of the course you'll have:
            </div>
            <p className="text-[15px] text-[#dbe5ff] leading-relaxed">
              {COURSE.outcome}
            </p>
          </div>

          {/* Two editorial pillars — these are the two specific features
              the course teaches, and the two reasons most teachers will
              find Marvex more useful than the tool they're using today. */}
          <h2 className="text-2xl font-bold mb-6 mt-4">What makes this course different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-14">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={14} className="text-cyan-300/80" />
                <h3 className="text-[15px] font-semibold text-white m-0">One-click resources on every node</h3>
              </div>
              <p className="text-[13px] text-[#a4b4d8] leading-relaxed">
                Stop telling students "see Smith 2019" and start attaching the actual PDF, YouTube clip, or slide deck to the relevant node. One shared map URL replaces a VLE page, an email of links and a folder of files.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} className="text-cyan-300/80" />
                <h3 className="text-[15px] font-semibold text-white m-0">Map → Timeline = a delivery plan</h3>
              </div>
              <p className="text-[13px] text-[#a4b4d8] leading-relaxed">
                A topic map answers "what". A timeline answers "when". Pull nodes from your map onto Marvex's Timeline Studio and your conceptual overview becomes a class-by-class teaching plan students can revisit during revision.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-6">The {totalLessons === 6 ? "six" : totalLessons === 5 ? "five" : totalLessons} lessons</h2>
          <ol className="space-y-3 mb-12">
            {LESSONS.map((l) => (
              <li key={l.slug}>
                <Link
                  to={`/mini-course/${COURSE.slug}/lesson/${l.slug}`}
                  data-testid={`course-lesson-tile-${l.slug}`}
                  className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-cyan-400/40 hover:bg-white/[0.04] transition group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full grid place-items-center mono text-[12px] text-cyan-300 shrink-0"
                         style={{ background: "rgba(0,240,255,0.06)", border: "1px solid rgba(0,240,255,0.4)" }}>
                      {String(l.order).padStart(2, "0")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[16px] font-semibold text-white group-hover:text-cyan-100 transition mb-1 m-0">
                        {l.title}
                      </h3>
                      <p className="text-[13px] text-[#8794b8] leading-snug line-clamp-2">
                        {l.description}
                      </p>
                    </div>
                    <div className="text-[11px] mono uppercase tracking-[0.18em] text-[#7a87ad] shrink-0 hidden sm:flex items-center gap-1.5">
                      <Clock size={11} /> {l.minutesRead}m
                    </div>
                    <ArrowRight size={16} className="text-cyan-300/60 group-hover:text-cyan-200 transition shrink-0" />
                  </div>
                </Link>
              </li>
            ))}
          </ol>

          <div className="rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/[0.08] via-cyan-500/[0.04] to-transparent p-8 text-center">
            <Sparkles size={20} className="text-fuchsia-300 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">Ready to start?</h2>
            <p className="text-[13px] text-[#a4b4d8] mb-5">
              Begin with the cognitive-science basics in lesson 1. You'll have a working topic map by the end of lesson 2.
            </p>
            <Link
              to={`/mini-course/${COURSE.slug}/lesson/${LESSONS[0].slug}`}
              data-testid="course-cta-start"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-400/15 border border-cyan-300/60 text-cyan-100 hover:bg-cyan-400/25 transition font-medium"
            >
              Start Lesson 1
              <ArrowRight size={15} />
            </Link>
            <div className="mt-4 text-[11px] mono uppercase tracking-[0.22em] text-cyan-300/70 flex items-center justify-center gap-2">
              <CheckCircle2 size={11} /> Free · No signup · ~{COURSE.minutesTotal} min total
            </div>
          </div>
        </div>
      </main>

      <RelatedReads kind="article" currentSlug="" limit={3} title="Further reading" />
      <SiteLinksFooter />
    </div>
  );
}
