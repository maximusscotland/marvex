import React, { useEffect, useState, useRef } from "react";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";

// `alt` is keyword-rich and descriptive for SEO + screen-readers. Where it
// adds nothing beyond the eyebrow we set it identical, but for product
// screenshots we explicitly mention "Marvex Studio" + the visible
// feature so search engines can index the imagery.
const FRAMES = [
  {
    src: "/teaser/book-to-map.png",
    eyebrow: "PDF → Mind Map in 60 seconds",
    alt: "Marvex Studio screenshot — a PDF document being converted into an interactive AI-generated mind map on an infinite canvas",
    title: "Drop a paper.\nWatch it crystallise.",
    sub: "Every concept, relationship, and hierarchy — extracted by AI and rendered on an infinite, interactive canvas you can zoom, pan and edit. Your key, your bill. Zero cost to us.",
    accent: "#00f0ff",
  },
  {
    src: "/teaser/mind-mapper-1.png",
    eyebrow: "The studio · live and editable",
    alt: "Marvex Studio interactive canvas — drag-and-drop map elements, free-floating shapes, lines, clipart and images on a dark cosmic mind map",
    title: "All subjects.\nAll related tools and data.\nAll sorted!",
    sub: "Right-click anywhere to insert map elements, free-floating shapes, lines, clipart and images. Everything is editable, draggable, and saved automatically to your local library.",
    accent: "#6ad8ff",
  },
  {
    src: "/teaser/mind-mapper-2.png",
    eyebrow: "Onboarding · 60 seconds in",
    alt: "Marvex Studio onboarding tour — interactive walkthrough teaching mind-map shortcuts, right-click menus and AI workflow",
    title: "Built-in tour.\nMaster every shortcut.",
    sub: "An interactive walkthrough teaches you the canvas, right-click menus, and AI workflow on first launch — so you're productive before your coffee cools.",
    accent: "#b88dff",
  },
  {
    src: "/teaser/mind-mapper-3.png",
    eyebrow: "Real research, real maps",
    alt: "Marvex Studio research workspace — PDF highlights dropped onto a mind map with semantic connectors, mini-maps and floating heading shapes",
    title: "From abstract to argument.\nIn one canvas.",
    sub: "Highlight passages in any PDF, drop them onto the canvas, and watch the structure emerge — connectors with semantic labels, side-by-side mini-maps, and floating shapes for headings.",
    accent: "#ff6ad5",
  },
  {
    src: "/teaser/zero-cloud.png",
    eyebrow: "Zero cloud · local-first always",
    alt: "Marvex Studio local-first privacy — mind maps stored in the browser, no accounts required, no telemetry, no silent cloud uploads",
    title: "Your data stays\non your machine.",
    sub: "No accounts required. No telemetry on by default. No silent uploads. Your maps live in your browser and your filesystem — and only sync where you tell them to.",
    accent: "#39e0ff",
  },
  {
    src: "/teaser/byok-ai.png",
    eyebrow: "Bring Your Own Key · use any AI",
    alt: "Marvex Studio Bring-Your-Own-Key AI — connect OpenAI, Anthropic Claude or Google Gemini API keys to power mind-map generation",
    title: "OpenAI. Anthropic.\nGemini. You choose.",
    sub: "One studio, every major model. Plug in your own API key, switch providers per task, and pay the LLM provider directly — never us.",
    accent: "#b88dff",
  },
  // Final frame — every map element is a launchpad to your local files,
  // documents, programs, music, films, images, and browser bookmarks.
  {
    src: "/teaser/byok-launchpad.png",
    eyebrow: "Every map element, a launchpad",
    alt: "Marvex Studio launchpad — every mind-map element linking to local files, documents, music, video, images and browser bookmarks",
    title: "Master Information\nOrganisation Visually",
    sub: "Every map element can link to your files, documents, programs, music, film, images — even web pages and bookmarks. One click on a map element opens the source it points at. No matter the type or scope of the information you have to record, interpret, study, edit, access or research, Marvex Studio is the indispensable tool!",
    accent: "#39e0ff",
  },
];

const FRAME_MS = 5000; // 5 s per frame

export default function CinematicTeaser() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef(null);

  // Auto-advance with progress ticker
  useEffect(() => {
    if (!playing) return;
    const start = Date.now();
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / FRAME_MS);
      setProgress(p);
      if (p >= 1) {
        setIdx((i) => (i + 1) % FRAMES.length);
        setProgress(0);
        clearInterval(tickRef.current);
      }
    }, 60);
    return () => clearInterval(tickRef.current);
  }, [idx, playing]);

  const go = (n) => {
    setIdx(((n % FRAMES.length) + FRAMES.length) % FRAMES.length);
    setProgress(0);
  };

  const frame = FRAMES[idx];

  return (
    <section
      id="teaser"
      data-testid="cinematic-teaser"
      className="relative z-20 px-6 lg:px-12 py-24 border-t border-white/5"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300 mb-3">
            The Experience
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Watch the <span className="gradient-text">magic</span> unfold.
          </h2>
        </div>

        {/* Player */}
        <div
          className="relative w-full overflow-hidden rounded-3xl border"
          style={{
            aspectRatio: "16 / 9",
            borderColor: "rgba(0,240,255,0.18)",
            boxShadow:
              "0 30px 80px -20px rgba(0,0,0,0.7), 0 0 40px rgba(0,240,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.03)",
            background: "#03040a",
          }}
          onClick={() => setPlaying((p) => !p)}
        >
          {/* Frames */}
          {FRAMES.map((f, i) => (
            <div
              key={f.src}
              data-testid={`teaser-frame-${i}`}
              aria-hidden={i !== idx}
              className="absolute inset-0 transition-opacity duration-1000 ease-out"
              style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
            >
              <img
                src={f.src}
                alt={f.alt || f.eyebrow}
                className="absolute inset-0 w-full h-full object-cover"
                style={{
                  animation: i === idx ? "kenBurns 12s ease-out both" : "none",
                }}
                draggable={false}
              />
              {/* Vignette + gradient for legibility */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(3,4,10,0.15) 0%, rgba(3,4,10,0.35) 55%, rgba(3,4,10,0.88) 100%)",
                }}
              />

              {/* Copy overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-14">
                <div className="max-w-2xl">
                  <div
                    className="mono text-[11px] uppercase tracking-[0.3em] mb-3"
                    style={{ color: f.accent, textShadow: `0 0 12px ${f.accent}80` }}
                  >
                    {f.eyebrow}
                  </div>
                  <h3
                    className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-[0.95] text-white whitespace-pre-line mb-4"
                    style={{ textShadow: "0 2px 24px rgba(0,0,0,0.7)" }}
                  >
                    {f.title}
                  </h3>
                  <p className="text-[15px] md:text-lg text-[#cfdaf3] leading-relaxed max-w-xl">
                    {f.sub}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Play/pause indicator (fades out after a moment) */}
          <div
            className="absolute top-5 right-5 flex items-center gap-2 mono text-[10px] uppercase tracking-[0.22em] text-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              data-testid="teaser-toggle"
              onClick={() => setPlaying((p) => !p)}
              className="w-9 h-9 rounded-full grid place-items-center bg-black/40 backdrop-blur border border-white/15 hover:border-cyan-400/60 hover:text-cyan-300 transition"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span className="hidden md:inline">
              {String(idx + 1).padStart(2, "0")} / {String(FRAMES.length).padStart(2, "0")}
            </span>
          </div>

          {/* Prev / Next */}
          <button
            data-testid="teaser-prev"
            onClick={(e) => { e.stopPropagation(); go(idx - 1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full grid place-items-center bg-black/40 backdrop-blur border border-white/15 text-white/80 hover:border-cyan-400/60 hover:text-cyan-300 transition"
            aria-label="Previous frame"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            data-testid="teaser-next"
            onClick={(e) => { e.stopPropagation(); go(idx + 1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full grid place-items-center bg-black/40 backdrop-blur border border-white/15 text-white/80 hover:border-cyan-400/60 hover:text-cyan-300 transition"
            aria-label="Next frame"
          >
            <ChevronRight size={18} />
          </button>

          {/* Progress bar + chapter dots */}
          <div
            className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 flex gap-2">
              {FRAMES.map((_, i) => {
                const active = i === idx;
                const done = i < idx;
                return (
                  <button
                    key={i}
                    data-testid={`teaser-dot-${i}`}
                    onClick={() => go(i)}
                    className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/15 transition"
                    aria-label={`Go to frame ${i + 1}`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: done ? "100%" : active ? `${progress * 100}%` : "0%",
                        background: frame.accent,
                        boxShadow: `0 0 10px ${frame.accent}`,
                        transition: active ? "none" : "width 0.4s ease",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sub-label */}
        <div className="mt-6 text-center mono text-[11px] uppercase tracking-[0.22em] text-[#566187]">
          Tap to pause · Click arrows to jump · Auto-advance every 5s
        </div>
      </div>

      {/* Local keyframes */}
      <style>{`
        @keyframes kenBurns {
          0%   { transform: scale(1.02) translate(0, 0); }
          100% { transform: scale(1.15) translate(-1.5%, -1%); }
        }
      `}</style>
    </section>
  );
}
