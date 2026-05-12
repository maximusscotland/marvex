/* eslint-disable react/prop-types */
import React, { useEffect, useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, CheckCircle2, BookOpen, GraduationCap, Download } from "lucide-react";
import Logo from "@/components/Logo";
import SiteLinksFooter from "@/components/SiteLinksFooter";
import { COURSE, LESSONS, LESSON_BY_SLUG } from "@/lib/miniCourse";
import usePageMeta from "@/lib/usePageMeta";
import { encodeMmap } from "@/lib/mapFile";
import { UK_HUMAN_RIGHTS_TEMPLATE } from "@/lib/templates/ukHumanRights";
import { track } from "@/lib/posthog";
import MiniMap from "@/components/MiniMap";
import MiniTimeline from "@/components/MiniTimeline";
import * as CourseMaps from "@/lib/courseMaps";

const SITE = "https://marvex.app";
const COURSE_BASE = `/mini-course/${COURSE.slug}`;

/**
 * /mini-course/<course-slug>/lesson/<lesson-slug>
 *
 * Renders one lesson. Includes:
 *  - Sticky sidebar (desktop) with all lesson titles + which is current
 *  - TL;DR pull-out
 *  - Sections + paragraphs
 *  - "Next lesson" CTA
 *  - FAQ + Article + BreadcrumbList JSON-LD
 *
 * Markdown-style inline tokens (**bold**, [label](url)) supported — same
 * parser as /learn/<slug> so authors can write `**term**` and `[link](/url)`
 * directly in the data file without learning a different syntax.
 */
const TOKEN_RE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

const renderInline = (text) => {
  const parts = text.split(TOKEN_RE).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="text-white">{p.slice(2, -2)}</strong>;
    }
    const m = p.match(LINK_RE);
    if (m) {
      const [, label, href] = m;
      const isInternal = href.startsWith("/");
      const cls = "text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 hover:decoration-cyan-300 underline-offset-4";
      return isInternal
        ? <Link key={i} to={href} className={cls}>{label}</Link>
        : <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
};

function LessonJsonLd({ lesson }) {
  useEffect(() => {
    const url = `${SITE}${COURSE_BASE}/lesson/${lesson.slug}`;
    const articleLd = {
      "@context": "https://schema.org",
      "@type": "LearningResource",
      "name": lesson.title,
      "headline": lesson.title,
      "description": lesson.description,
      "url": url,
      "dateModified": COURSE.updatedAt,
      "isPartOf": {
        "@type": "Course",
        "name": COURSE.title,
        "url": `${SITE}${COURSE_BASE}`,
      },
      "timeRequired": `PT${lesson.minutesRead}M`,
      "learningResourceType": "Lesson",
      "educationalLevel": "professional development",
      "audience": { "@type": "EducationalAudience", "educationalRole": "teacher" },
    };
    const faqLd = lesson.faq?.length ? {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": lesson.faq.map((f) => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    } : null;
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: COURSE.title, item: `${SITE}${COURSE_BASE}` },
        { "@type": "ListItem", position: 3, name: lesson.title, item: url },
      ],
    };
    const tags = [articleLd, faqLd, breadcrumbLd].filter(Boolean).map((ld, i) => {
      const tag = document.createElement("script");
      tag.type = "application/ld+json";
      tag.id = `lesson-jsonld-${i}`;
      tag.textContent = JSON.stringify(ld);
      document.getElementById(`lesson-jsonld-${i}`)?.remove();
      document.head.appendChild(tag);
      return tag;
    });
    return () => tags.forEach((t) => t.remove());
  }, [lesson]);
  return null;
}

export default function MiniCourseLesson() {
  const { lessonSlug } = useParams();
  const lesson = useMemo(() => LESSON_BY_SLUG[lessonSlug], [lessonSlug]);

  usePageMeta({
    title: lesson?.metaTitle || `${lesson?.title} — Marvex Studio`,
    description: lesson?.description,
    canonical: lesson ? `${SITE}${COURSE_BASE}/lesson/${lesson.slug}` : undefined,
  });

  if (!lesson) return <Navigate to={COURSE_BASE} replace />;

  const nextLesson = lesson.next ? LESSON_BY_SLUG[lesson.next] : null;

  return (
    <div data-testid="mini-course-lesson" className="min-h-screen cosmic-bg text-white">
      <LessonJsonLd lesson={lesson} />

      <header className="relative z-20 px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Logo size={28} />
          <span className="mono text-[11px] uppercase tracking-[0.32em] text-cyan-300/80">Marvex Studio</span>
        </Link>
        <Link
          to={COURSE_BASE}
          data-testid="lesson-back-course"
          className="flex items-center gap-1.5 text-[12px] text-[#9aa7c7] hover:text-cyan-200 transition"
        >
          <ArrowLeft size={13} /> Course overview
        </Link>
      </header>

      <main className="relative z-10 px-6 lg:px-12 pt-8 pb-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          {/* Sticky sidebar — lesson list */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-4 flex items-center gap-2">
                <GraduationCap size={13} /> Lessons
              </div>
              <ol className="space-y-1.5">
                {LESSONS.map((l) => {
                  const active = l.slug === lesson.slug;
                  return (
                    <li key={l.slug}>
                      <Link
                        to={`${COURSE_BASE}/lesson/${l.slug}`}
                        data-testid={`lesson-nav-${l.slug}`}
                        className={`block rounded-lg px-3 py-2 text-[12.5px] leading-snug transition ${
                          active
                            ? "bg-cyan-400/10 border border-cyan-400/40 text-cyan-100"
                            : "border border-transparent text-[#9aa7c7] hover:text-cyan-200 hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className="mono text-[10px] text-cyan-300/70 mr-1.5">{String(l.order).padStart(2, "0")}</span>
                        {l.title}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          {/* Article body */}
          <article className="max-w-2xl">
            <div className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-4 flex items-center gap-2 flex-wrap">
              <span>Lesson {String(lesson.order).padStart(2, "0")} of {LESSONS.length}</span>
              <span className="text-fuchsia-300/30">·</span>
              <Clock size={11} />
              <span>{lesson.minutesRead}-min read</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] mb-5">
              {lesson.title}
            </h1>
            <p className="text-lg text-[#a4b4d8] leading-relaxed mb-8">
              {lesson.description}
            </p>

            {lesson.tldr && (
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.04] p-5 mb-10">
                <div className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 mb-2">TL;DR</div>
                <p className="text-[14px] text-[#cfdaf3] leading-relaxed">{lesson.tldr}</p>
              </div>
            )}

            {/* Visual illustration — every lesson ships at least one
                concrete map / timeline so visitors *see* the artefact
                we're describing, not just read about it.  See
                lib/courseMaps.js for the per-lesson data. */}
            {lesson.visualAfter?.kind === "map" && CourseMaps[lesson.visualAfter.id] && (
              <MiniMap
                map={CourseMaps[lesson.visualAfter.id]}
                caption={lesson.visualAfter.caption}
                testid={`lesson-visual-${lesson.slug}`}
              />
            )}
            {lesson.visualAfter?.kind === "map-and-timeline" && (
              <div data-testid={`lesson-visual-${lesson.slug}`}>
                <MiniMap
                  map={CourseMaps[lesson.visualAfter.mapId]}
                  caption="The 'what' — topic-overview map"
                  testid={`lesson-visual-map-${lesson.slug}`}
                />
                <MiniTimeline
                  timeline={CourseMaps[lesson.visualAfter.timelineId]}
                  caption={lesson.visualAfter.caption}
                  testid={`lesson-visual-timeline-${lesson.slug}`}
                />
              </div>
            )}

            <div className="prose-cosmic space-y-10">
              {lesson.sections.map((s, i) => (
                <section key={i}>
                  {/* h2 — every lesson section. Crawlers + screen-readers
                      both see a clean h1→h2→(faq h3) outline. */}
                  <h2 className="text-2xl font-bold text-white mb-4">{s.heading}</h2>
                  {s.paragraphs.map((p, j) => (
                    <p key={j} className="text-[15px] text-[#dbe5ff] leading-[1.75] mb-4">
                      {renderInline(p)}
                    </p>
                  ))}
                </section>
              ))}
            </div>

            {lesson.slug === "worked-example-uk-human-rights" && (
              <section className="mt-12" data-testid="lesson-template-download">
                <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.06] via-fuchsia-500/[0.03] to-transparent p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl grid place-items-center bg-cyan-400/10 border border-cyan-300/40 shrink-0">
                      <Download size={20} className="text-cyan-200" />
                    </div>
                    <div className="flex-1">
                      <h2 className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 mb-2 m-0">
                        Skip the typing — grab the template
                      </h2>
                      <p className="text-[15px] font-semibold text-white mb-2">
                        Download the full UK Human Rights Act mind map
                      </p>
                      <p className="text-[13px] text-[#a4b4d8] leading-relaxed mb-4">
                        Includes the central question, all eleven branches with colour-coded absolute / qualified rights, every landmark case, public-authority obligation node, and pre-attached gov.uk source links. Open it in Marvex Studio, customise for your class, and share with one click.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <button
                          type="button"
                          data-testid="download-hr-template"
                          onClick={() => {
                            try {
                              const buf = encodeMmap(UK_HUMAN_RIGHTS_TEMPLATE);
                              const blob = new Blob([buf], { type: "application/octet-stream" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = "uk-human-rights-act-1998.mmap";
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                              try {
                                track("course_template_downloaded", {
                                  template: "uk-human-rights",
                                  lesson: lesson.slug,
                                });
                              } catch { /* posthog unavailable — fine */ }
                            } catch (e) {
                              // eslint-disable-next-line no-console
                              console.error("[template-download] failed", e);
                            }
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-400/15 border border-cyan-300/60 text-cyan-100 hover:bg-cyan-400/25 transition font-medium text-[14px]"
                        >
                          <Download size={14} /> Download .mmap template
                        </button>
                        <span className="text-[12px] text-[#7a87ad]">
                          Then open it in <Link to="/app" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4">Marvex Studio</Link> · File → Open
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {lesson.faq?.length > 0 && (
              <section className="mt-14">
                <div className="flex items-center gap-2 mb-5">
                  <BookOpen size={14} className="text-cyan-300/80" />
                  <h2 className="mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/80 m-0">
                    Questions teachers ask
                  </h2>
                </div>
                <div className="space-y-3">
                  {lesson.faq.map((f, i) => (
                    <details
                      key={i}
                      data-testid={`lesson-faq-${i}`}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-5 group"
                    >
                      <summary className="cursor-pointer flex items-center justify-between gap-4 list-none">
                        {/* h3 = the question itself — semantic outline. */}
                        <h3 className="font-semibold text-white text-[15px] m-0">{f.q}</h3>
                        <span className="mono text-[14px] text-cyan-300/60 group-open:rotate-45 transition-transform shrink-0">+</span>
                      </summary>
                      <p className="text-[14px] text-[#a4b4d8] leading-relaxed mt-3">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <div className="mt-14 flex flex-col sm:flex-row gap-4 items-stretch">
              <Link
                to={COURSE_BASE}
                data-testid="lesson-back-overview"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] hover:border-cyan-400/30 transition p-4 flex items-center gap-3"
              >
                <ArrowLeft size={14} className="text-cyan-300/80" />
                <div>
                  <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/60 mb-1">Back</div>
                  <div className="text-[14px] font-semibold text-white">Course overview</div>
                </div>
              </Link>
              {nextLesson ? (
                <Link
                  to={`${COURSE_BASE}/lesson/${nextLesson.slug}`}
                  data-testid="lesson-next"
                  className="flex-1 rounded-xl border border-cyan-400/30 bg-cyan-500/[0.05] hover:bg-cyan-500/[0.1] transition p-4 flex items-center gap-3 justify-between"
                >
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80 mb-1">
                      Next · Lesson {String(nextLesson.order).padStart(2, "0")}
                    </div>
                    <div className="text-[14px] font-semibold text-white">{nextLesson.title}</div>
                  </div>
                  <ArrowRight size={14} className="text-cyan-200 shrink-0" />
                </Link>
              ) : (
                <Link
                  to="/app"
                  data-testid="lesson-build-map"
                  className="flex-1 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/[0.05] hover:bg-fuchsia-500/[0.1] transition p-4 flex items-center gap-3 justify-between"
                >
                  <div>
                    <div className="mono text-[10px] uppercase tracking-[0.22em] text-fuchsia-300/80 mb-1 flex items-center gap-1">
                      <CheckCircle2 size={11} /> Course complete
                    </div>
                    <div className="text-[14px] font-semibold text-white">Build your first map →</div>
                  </div>
                  <ArrowRight size={14} className="text-fuchsia-200 shrink-0" />
                </Link>
              )}
            </div>
          </article>
        </div>
      </main>

      <SiteLinksFooter />
    </div>
  );
}
