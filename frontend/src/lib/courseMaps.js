/**
 * Sample maps used as illustrations inside the mini-course lessons.
 *
 * Each export is a plain map tree (no IDs needed — MiniMap doesn't
 * mutate). Shape is intentionally consistent with what a real map in
 * Marvex Studio would look like, so visitors learn the visual idiom
 * while they read.
 *
 * Pillar 1 (Lesson 3) leans on the `link` / `videoLink` props to draw
 * the resource badges on elements — same visual that appears on real
 * maps in Studio.
 *
 * Pillar 2 (Lesson 4) ships TWO views of the same content: a mind-map
 * AND a timeline (lib/courseMaps.js exports the timeline as `MAP_TO_TIMELINE`).
 */

// Lesson 1 — working-memory cognitive science basics.
export const MAP_WHY_WORKS = {
  title: "Why mind maps work",
  children: [
    { title: "Hierarchical reasoning", children: [
      { title: "Parent / child surfaces structure" },
      { title: "Mis-organisation jumps out" },
    ]},
    { title: "Working memory offload", children: [
      { title: "Order lives on the page" },
      { title: "Free RAM for synthesis" },
    ]},
    { title: "Spatial recall cues", children: [
      { title: "Method of loci-like" },
    ]},
    { title: "Additive revision", children: [
      { title: "Add branches, don't rewrite" },
    ]},
  ],
};

// Lesson 2 — topic overview, question at centre, three levels.
export const MAP_TOPIC_OVERVIEW = {
  title: "Why is photosynthesis the engine of life on Earth?",
  children: [
    { title: "Light reactions", fill: "#a3e635", children: [
      { title: "Chlorophyll absorbs photons" },
      { title: "Water split → O₂" },
      { title: "ATP + NADPH produced" },
    ]},
    { title: "Calvin cycle", fill: "#a3e635", children: [
      { title: "CO₂ fixation by RuBisCO" },
      { title: "Glucose synthesis" },
    ]},
    { title: "Ecosystem dependency", fill: "#fbbf24", children: [
      { title: "Base of food chain" },
      { title: "Oxygen for respiration" },
    ]},
    { title: "Climate role", fill: "#fbbf24", children: [
      { title: "Carbon sink" },
    ]},
    { title: "Evolutionary scale", fill: "#e879f9", children: [
      { title: "3.5 billion years old" },
    ]},
  ],
};

// Lesson 3 — same map with resource badges visible on every element.
export const MAP_ONE_CLICK_RESOURCES = {
  title: "Why is photosynthesis the engine of life?",
  children: [
    { title: "Light reactions", fill: "#a3e635", link: true, children: [
      { title: "Textbook chapter 7 (PDF)", link: true },
      { title: "Animated walkthrough", videoLink: true },
      { title: "Lab transcript", link: true },
    ]},
    { title: "Calvin cycle", fill: "#a3e635", link: true, children: [
      { title: "BBC Bitesize page", link: true },
      { title: "Khan Academy video", videoLink: true },
    ]},
    { title: "Ecosystem dependency", fill: "#fbbf24", link: true, children: [
      { title: "Nat Geo article", link: true },
    ]},
    { title: "Climate role", fill: "#fbbf24", link: true, children: [
      { title: "IPCC summary (PDF)", link: true },
    ]},
  ],
};

// Lesson 5 — blind recall: same map with labels hidden so structure
// alone is visible. We pass plain titles like "•••" to evoke the
// in-app "Mask labels" mode.
export const MAP_BLIND_RECALL = {
  title: "▢▢▢▢▢▢▢▢▢▢",
  children: [
    { title: "▢▢▢▢▢▢▢▢▢", fill: "#a3e635", children: [
      { title: "▢▢▢▢▢▢▢▢▢▢" },
      { title: "▢▢▢▢▢▢▢" },
      { title: "▢▢▢▢▢▢▢▢▢" },
    ]},
    { title: "▢▢▢▢▢▢▢", fill: "#a3e635", children: [
      { title: "▢▢▢▢▢▢▢▢▢" },
      { title: "▢▢▢▢▢" },
    ]},
    { title: "▢▢▢▢▢▢▢▢▢▢", fill: "#fbbf24", children: [
      { title: "▢▢▢▢▢▢▢▢" },
      { title: "▢▢▢▢▢▢▢▢▢" },
    ]},
    { title: "▢▢▢▢▢▢▢▢", fill: "#fbbf24" },
  ],
};

// Lesson 4 — same content as a TIMELINE. Each event is a week of
// teaching delivery scheduled across a half-term.  Lib/MiniTimeline
// renders this as a horizontal Gantt-style strip.
export const TIMELINE_DELIVERY_PLAN = {
  title: "Half-term delivery plan — Photosynthesis",
  weeks: 6,
  events: [
    { week: 1, label: "Light reactions intro", colour: "#a3e635" },
    { week: 2, label: "Chlorophyll + photons", colour: "#a3e635" },
    { week: 3, label: "Calvin cycle", colour: "#a3e635" },
    { week: 4, label: "Ecosystem dependency", colour: "#fbbf24" },
    { week: 5, label: "Climate role", colour: "#fbbf24" },
    { week: 6, label: "Synthesis + assessment", colour: "#e879f9" },
  ],
};

// Lesson 6 — preview of the UK Human Rights map. We pull the first 6
// branches (out of 12) to keep the preview compact; the full template
// is downloadable via the lesson's button.
import { UK_HUMAN_RIGHTS_TEMPLATE } from "@/lib/templates/ukHumanRights";

const _firstSix = UK_HUMAN_RIGHTS_TEMPLATE.children.slice(0, 6).map((c) => ({
  title: c.title,
  fill: c.fill,
  link: !!c.link,
  children: (c.children || []).slice(0, 2).map((s) => ({ title: s.title })),
}));

export const MAP_UK_HUMAN_RIGHTS_PREVIEW = {
  title: "Whose human rights does the HRA 1998 actually protect?",
  children: _firstSix,
};
