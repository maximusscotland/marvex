import React from "react";
import { ExternalLink, BookOpen } from "lucide-react";

/**
 * <References /> — small, citation-style "Further reading" block for
 * the bottom of academic / research-flavoured pages.
 *
 * Mind mapping is a category with a real academic literature behind it
 * (Buzan's original work, Novak's concept-mapping research, dual-coding
 * theory, etc.). Linking to the primary sources at the bottom of any
 * page that makes a learning-science claim:
 *   1. Improves SEO E-E-A-T signal (Google rewards pages that cite).
 *   2. Builds reader trust — we're not making it up.
 *   3. Lets curious users dive deeper without us paraphrasing them.
 *
 * Pass an array of `{ author, year, title, source, url? }` items.
 * `url` is optional — academic citations frequently lack a free URL
 * because the source is a paywalled journal or out-of-print book.
 */
export default function References({ items, heading = "Further reading & references", testid = "references-block" }) {
  if (!items || items.length === 0) return null;
  return (
    <section
      data-testid={testid}
      className="max-w-3xl mx-auto px-6 lg:px-12 pb-12 pt-2 border-t border-white/5 mt-10"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-400/30 grid place-items-center text-cyan-300">
          <BookOpen size={13} />
        </div>
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80">
          {heading}
        </div>
      </div>
      <ol className="space-y-2.5 text-[13px] text-[#9aa7c7] leading-relaxed list-decimal list-inside">
        {items.map((it, i) => (
          <li key={i} className="pl-1">
            <span className="text-[#cfdaf3]">{it.author}</span>
            {it.year ? <span className="text-[#7a87ad]"> ({it.year})</span> : null}
            {". "}
            {it.url ? (
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 underline decoration-cyan-400/40 underline-offset-4"
              >
                {it.title}
                <ExternalLink size={10} className="inline ml-1 -mt-0.5" />
              </a>
            ) : (
              <span className="text-[#cfdaf3]">{it.title}</span>
            )}
            {it.source ? <span className="text-[#7a87ad]"> · <em>{it.source}</em></span> : null}
            {it.note ? <span className="text-[#566187]"> — {it.note}</span> : null}
          </li>
        ))}
      </ol>
      <p className="mono text-[10px] uppercase tracking-[0.22em] text-[#566187] mt-5">
        Sources are listed for transparency · Marvex Studio is not affiliated with any cited authors or publishers.
      </p>
    </section>
  );
}

/**
 * Curated reference set for the mind-mapping / PDF-to-map / study-tools
 * category. Used by /pdf-to-mind-map and /learn academic articles.
 */
export const MIND_MAPPING_REFERENCES = [
  {
    author: "Buzan, T.",
    year: "1974",
    title: "Use Your Head",
    source: "BBC Active",
    note: "Original codification of mind-mapping as a learning technique.",
  },
  {
    author: "Novak, J. D., & Cañas, A. J.",
    year: "2008",
    title: "The Theory Underlying Concept Maps and How to Construct and Use Them",
    source: "IHMC CmapTools Technical Report",
    url: "https://cmap.ihmc.us/docs/theory-of-concept-maps",
  },
  {
    author: "Paivio, A.",
    year: "1986",
    title: "Mental Representations: A Dual Coding Approach",
    source: "Oxford University Press",
    note: "Dual-coding theory — why visual + verbal encoding outperforms either alone.",
  },
  {
    author: "Mayer, R. E.",
    year: "2009",
    title: "Multimedia Learning (2nd ed.)",
    source: "Cambridge University Press",
    note: "Cognitive theory of multimedia learning — applied here to PDF-to-map conversion.",
  },
  {
    author: "Farrand, P., Hussain, F., & Hennessy, E.",
    year: "2002",
    title: "The efficacy of the 'mind map' study technique",
    source: "Medical Education, 36(5), 426–431",
    url: "https://onlinelibrary.wiley.com/doi/abs/10.1046/j.1365-2923.2002.01205.x",
    note: "Empirical study showing mind-mapping improves recall by ~10% over linear notes.",
  },
  {
    author: "Davies, M.",
    year: "2011",
    title: "Concept mapping, mind mapping and argument mapping: what are the differences and do they matter?",
    source: "Higher Education, 62(3), 279–301",
    url: "https://link.springer.com/article/10.1007/s10734-010-9387-6",
  },
];
