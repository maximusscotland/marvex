import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * SEOContent — discreet, expandable knowledge section.
 *
 * Why this exists: search engines reward pages that genuinely answer the
 * questions users type into Google. Naked landing copy ("BYOK", "60-second
 * map") doesn't match queries like "how to create a mind map from a PDF" or
 * "best mind mapping software for students" — so traffic dries up.
 *
 * This component injects substantive answers to those queries directly into
 * the page DOM (so crawlers index the full text) while keeping the visible
 * surface clean: only the section heading shows by default, and visitors
 * who want depth can expand any sub-section. No flashy marketing energy —
 * deliberately quiet, conversational, useful.
 *
 * Headings used (all H2): What is Mind Mapping? · Benefits · How To · Tips
 * · FAQ. The page-level H1 ("Turn Any PDF into an Interactive Mind Map")
 * lives elsewhere as an `sr-only` string; the brand-voice "Read · Compress ·
 * Map · Master." headline below the hero is now an H2 so the page has
 * exactly one H1 (an SEO best-practice).
 */

const Accordion = ({ title, defaultOpen = false, children, idx }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        data-testid={`seo-accordion-${idx}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left group"
      >
        <h2 className="text-base md:text-lg font-medium text-[#cfdaf3] group-hover:text-cyan-200 transition-colors">
          {title}
        </h2>
        <ChevronDown
          size={16}
          className={`text-[#566187] transition-transform ${open ? "rotate-180 text-cyan-300" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? "max-h-[1400px] pb-5" : "max-h-0"}`}
      >
        <div className="text-[14px] text-[#a4b4d8] leading-relaxed space-y-3 pr-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function SEOContent() {
  return (
    <section
      data-testid="seo-content"
      aria-label="About mind mapping"
      className="relative z-20 px-6 lg:px-12 py-16 border-t border-white/5"
    >
      <div className="max-w-3xl mx-auto">
        <div className="mono text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 mb-3 text-center">
          The Mind-Mapping Handbook
        </div>
        <p className="text-center text-[#9aaad0] text-[13px] mb-10 max-w-xl mx-auto leading-relaxed">
          A short primer on the technique, the science behind it, and how to make
          a mind map from a PDF in under a minute with{" "}
          <span className="text-cyan-300">mind mapping software</span> like ours.
        </p>

        <div className="rounded-2xl border border-white/5 bg-white/[0.015] px-6 md:px-8">
          <Accordion idx={0} title="What is Mind Mapping?" defaultOpen>
            <p>
              Mind mapping is a visual note-taking technique where a central
              idea sits at the centre of the page and related concepts radiate
              outward as labelled branches. Each branch can split into
              sub-branches, creating a hierarchical tree of meaning that mirrors
              how the brain naturally associates information.
            </p>
            <p>
              Great credit is due to Tony Buzan who brought the technique to
              prominence in the 1970&apos;s. From a personal point of view, as
              the creator of Marvex Studio, I discovered Tony&apos;s
              breakthrough thinking when I read{" "}
              <em>Use Your Head</em> for the first time in the 1990&apos;s.
              Unfortunately, this came a little too late to influence my
              academic performance in Secondary Education. They have, however,
              proved a very effective way to organise and learn quickly, any
              subject you are required to master. They have reliably came to my
              rescue on many occasions since, from professional exams to
              learning new skills or even as a planning / organisational tool.
            </p>
            <p>
              Modern{" "}
              <strong className="text-[#cfdaf3]">interactive mind maps</strong>{" "}
              go further than paper diagrams: nodes can carry links, files,
              colours, icons, and embedded media, and you can pan, zoom, fold
              branches, and search the entire map by keyword. They become a
              navigable second brain rather than a static drawing.
            </p>
          </Accordion>

          <Accordion idx={1} title="Benefits of Marvex Studio">
            <p>
              Marvex Studio takes the powers offered by mind mapping and
              injects them with superpower — by being{" "}
              <strong className="text-[#cfdaf3]">INTERACTIVE</strong>! The
              benefits are enormous.
            </p>
            <p>
              Imagine a lawyer, for example, using an interactive mind map to
              detail any case. The lawyer can sit in the pressure of a
              courtroom, have a clear overview of all information and can
              access any relevant material in{" "}
              <strong className="text-[#cfdaf3]">no more than 1 click</strong>!
            </p>
            <p>
              The advantages offered by Marvex Studio are not just limited
              to professions where organisation of information plays a key
              role. Practical applications of Marvex Studio are infinite
              in number, and I would personally be very excited to see some of
              the unique, innovative or practical examples created by our
              members. An example would be giving access to an interactive
              mind map for an elderly relative. If they can just access the
              map, then they can easily and visually see any relevant,
              important information in just 1 click. This could be an{" "}
              <em>emergency contacts</em> mind map or even just a{" "}
              <em>Grandkids&apos; birthdays</em> mind map. The permutations
              and uses of Marvex Studio are endless and limited only by
              the imagination.
            </p>
            <p>
              The reason mind mapping has stuck around for half a century is
              that it leverages how memory actually works. Studies in cognitive
              science consistently show that visual, hierarchical, colour-coded
              notes outperform linear text on three measures:
            </p>
            <ul className="list-disc list-outside pl-5 space-y-1.5">
              <li>
                <strong className="text-[#cfdaf3]">Recall</strong> — students
                using mind maps remember 10–15% more material a week later
                versus those using bulleted notes.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Comprehension</strong> —
                building the map forces you to identify hierarchy and
                relationships, not just transcribe.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Synthesis</strong> — once you
                have several maps, connections between separate documents
                become obvious. It&apos;s why mind mapping is so popular among
                researchers, lawyers, and consultants.
              </li>
            </ul>
            <p>
              Mind mapping is particularly powerful for{" "}
              <strong className="text-[#cfdaf3]">visual learners</strong> — the
              ~65% of the population who absorb information faster from spatial
              and graphical formats than from running text. If lecture notes
              feel like a fight, give a mind map a try.
            </p>
          </Accordion>

          <Accordion idx={2} title="How to Create a Mind Map from a PDF">
            <p>
              The slowest part of mind mapping has always been{" "}
              <em>making</em> the map. Reading a 30-page paper, identifying
              the central thesis, and arranging every sub-claim by hand can
              easily take an hour. Marvex Studio compresses that into ~60
              seconds:
            </p>
            <ol className="list-decimal list-outside pl-5 space-y-1.5">
              <li>
                Open the Studio and click{" "}
                <strong className="text-[#cfdaf3]">Drop a PDF</strong> (or
                drag-and-drop onto the canvas).
              </li>
              <li>
                Choose your AI provider — Claude, GPT, or Gemini. Bring your
                own key; we never mark up inference.
              </li>
              <li>
                The AI extracts every concept, relationship, and hierarchy from
                the document and renders them as draggable nodes.
              </li>
              <li>
                Edit, expand, link, or annotate any node. Right-click for
                shapes, clipart, icons, WordArt, and AI Expand.
              </li>
              <li>
                Push the finished map to Google Drive, Dropbox, Zotero, or
                back out as a polished PDF or Markdown brief.
              </li>
            </ol>
            <p>
              That's the entire <strong className="text-[#cfdaf3]">PDF to mind map</strong>{" "}
              workflow. It works equally well for research papers, textbook
              chapters, business reports, and even long-form articles you
              save as PDF from your browser.
            </p>
          </Accordion>

          <Accordion idx={3} title="Tips for Effective Mind Mapping">
            <ul className="list-disc list-outside pl-5 space-y-1.5">
              <li>
                <strong className="text-[#cfdaf3]">Keep map element text short.</strong>{" "}
                A map element should be a noun phrase, not a sentence. Long text
                kills the visual scan-ability that makes mind maps work.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Use colour as a code.</strong>{" "}
                Pick a meaning for each colour — e.g. green = evidence, red =
                counter-argument, cyan = your own commentary — and stick to it
                across maps.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Branch radially, not linearly.</strong>{" "}
                Resist the urge to lay map elements out top-to-bottom like an outline.
                The radial layout is what unlocks recall.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Link, don't duplicate.</strong>{" "}
                If the same idea appears in two papers, draw a connector
                between the two map elements rather than retyping the concept.
                Cross-map links are where the second-brain effect kicks in.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Revisit, don't recreate.</strong>{" "}
                Spaced retrieval works for maps too. Open an old map a week
                later, expand a few branches from memory, then check yourself.
              </li>
              <li>
                <strong className="text-[#cfdaf3]">Treat each map as a map element itself.</strong>{" "}
                A good <em>interactive mind mapping technique</em> is to add a
                link to a related map at the root — your library becomes a
                graph, not a folder.
              </li>
            </ul>
          </Accordion>

          <Accordion idx={4} title="Frequently Asked Questions">
            <div className="space-y-4">
              <div>
                <p className="text-[#cfdaf3] font-medium mb-1">
                  Is Marvex Studio good for students?
                </p>
                <p>
                  Yes — and it's free for educational use during the founders'
                  round. Most of our early users are PhD candidates, medical
                  students, and law-school readers who use it to compress dense
                  reading lists. We're consistently rated among the{" "}
                  <strong className="text-[#cfdaf3]">best mind mapping software for students</strong>{" "}
                  on early-access boards.
                </p>
              </div>
              <div>
                <p className="text-[#cfdaf3] font-medium mb-1">
                  Can I create mind maps online without installing anything?
                </p>
                <p>
                  Yes. Marvex Studio works in any modern browser — Chrome, Edge,
                  Safari, Firefox. There's also a native desktop version for
                  Windows, macOS, and Linux if you prefer a full-screen,
                  offline-capable app.
                </p>
              </div>
              <div>
                <p className="text-[#cfdaf3] font-medium mb-1">
                  Are my maps private?
                </p>
                <p>
                  Yes. By default every map lives in your browser's local
                  storage — no account, no upload, no tracking. You can opt
                  in to back up to Google Drive, Dropbox, or Zotero with a
                  single click, but nothing is uploaded automatically.
                </p>
              </div>
              <div>
                <p className="text-[#cfdaf3] font-medium mb-1">
                  How does Marvex Studio compare to other mind mapping tools?
                </p>
                <p>
                  Most mind mapping tools are diagram editors. Marvex Studio is a
                  research lab: PDF-to-map ingestion, AI expansion, global
                  search across every map, smart link routing into your OS
                  default apps, calendar reminders, Chrome bookmarks import,
                  and a built-in PDF reader where you highlight and send
                  selections back to the canvas.
                </p>
              </div>
              <div>
                <p className="text-[#cfdaf3] font-medium mb-1">
                  Do I need to pay for the AI?
                </p>
                <p>
                  You bring your own key (BYOK) — your key, your bill, your
                  data. Free tiers exist on Anthropic, OpenAI, and Google AI
                  Studio. Marvex Studio itself never marks up inference.
                </p>
              </div>
              <div>
                <p className="text-[#cfdaf3] font-medium mb-1">
                  Does Marvex Studio work offline?
                </p>
                <p>
                  The core editing experience does — your maps are local-first.
                  The AI features need a network call to your chosen provider.
                  The desktop app caches everything for full offline reading
                  and editing.
                </p>
              </div>
            </div>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
