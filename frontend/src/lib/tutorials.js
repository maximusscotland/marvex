/**
 * Tutorial metadata — the structure drives both /learn (index) and
 * /learn/:slug (single tutorial). Actual copy lives in i18n bundles under
 * `learn.tutorials.<key>.*` so every tutorial translates automatically.
 */

import { Sparkles, FileText, Brain, Layers } from "lucide-react";

export const TUTORIALS = [
  {
    slug: "first-map",
    key: "firstMap",
    icon: Sparkles,
    accent: "cyan",
    steps: 6,
  },
  {
    slug: "pdf-studio",
    key: "pdfStudio",
    icon: FileText,
    accent: "violet",
    steps: 6,
  },
  {
    slug: "ai-research",
    key: "aiResearch",
    icon: Brain,
    accent: "fuchsia",
    steps: 6,
  },
  {
    slug: "reorganise",
    key: "reorganise",
    icon: Layers,
    accent: "amber",
    steps: 6,
  },
];

export const getTutorial = (slug) => TUTORIALS.find((tut) => tut.slug === slug);
