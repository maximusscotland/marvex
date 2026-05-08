/**
 * seedExamples — first-run sample maps that ship with mind-mapper.
 *
 * Why? An empty Library is a dead end. Two well-built example maps give the
 * new user a tactile idea of "what's possible here" — they can open, edit,
 * share, or learn from them. Both maps are small (no PDFs attached, all
 * inline) so they stay under any storage quota.
 *
 * Behaviour: runs ONCE per browser. After the seed runs, we set a flag
 * (`mindmapper.examples.seeded.v1`) so we don't re-add the maps if the user
 * deletes them — that would be annoying.
 */

import { listMaps, saveMap, deleteMap } from "./storage";

const SEED_FLAG = "mindmapper.examples.seeded.v3";

/**
 * One-time silent migration: remove the (now-retired) Attention-Is-All-You-
 * Need transformer demo from any user library that has it. Tracked by its
 * own flag so we only run the delete once — if a user re-creates a map
 * with the same id deliberately, we don't keep nuking it.
 *
 * Brand decision (creator): the AI-paper demo doesn't fit the app's
 * mainstream-learning audience, so it's been pulled from seeds. This
 * migration keeps existing user libraries in sync without forcing them
 * to manually delete it.
 */
const ATTENTION_REMOVED_FLAG = "mindmapper.attention-demo.removed.v1";
export const removeRetiredAttentionDemo = () => {
  try {
    if (localStorage.getItem(ATTENTION_REMOVED_FLAG)) return;
    const all = listMaps();
    if (all.some((m) => m.id === "ai-demo-attention-is-all-you-need")) {
      deleteMap("ai-demo-attention-is-all-you-need");
    }
    localStorage.setItem(ATTENTION_REMOVED_FLAG, "1");
  } catch { /* ignore */ }
};

/**
 * "How to use Marvex Studio for learning success" — the same content we ship
 * to waitlist sign-ups as a PDF, but as a clickable mind-map so visitors can
 * see the structure visually right after first sign-in.
 */
const learningMap = () => ({
  id: "example-learning-success",
  title: "How to use Marvex Studio for learning success",
  source: "example",
  example: true,
  summary: "A 5-minute guide for students, researchers, and anyone who reads with a pen in hand.",
  shape: "round",
  stroke: "#FFC857",
  fill: "rgba(255, 200, 87, 0.08)",
  icon: "grad",
  children: [
    {
      id: "ls-1",
      title: "Why mind-maps work for learning",
      shape: "ellipse",
      children: [
        { id: "ls-1-1", title: "The brain stores knowledge as a network, not a list", shape: "ellipse", children: [] },
        { id: "ls-1-2", title: "A map externalises the structure your mind is already building", shape: "ellipse", children: [] },
        { id: "ls-1-3", title: "Slower than highlighting · faster than re-reading", shape: "ellipse", children: [] },
      ],
    },
    {
      id: "ls-2",
      title: "The 3-pass method",
      shape: "rect",
      stroke: "#00f0ff",
      fill: "rgba(0, 240, 255, 0.08)",
      children: [
        {
          id: "ls-2-1",
          title: "Pass 1 — Skim and seed",
          shape: "rect",
          stroke: "#00f0ff",
          children: [
            { id: "ls-2-1-1", title: "Open PDF in Reader", shape: "rect", stroke: "#00f0ff", children: [] },
            { id: "ls-2-1-2", title: "Capture each subheading as a map element", shape: "rect", stroke: "#00f0ff", children: [] },
            { id: "ls-2-1-3", title: "Don't worry about hierarchy yet", shape: "rect", stroke: "#00f0ff", children: [] },
          ],
        },
        {
          id: "ls-2-2",
          title: "Pass 2 — Read and connect",
          shape: "rect",
          stroke: "#00f0ff",
          children: [
            { id: "ls-2-2-1", title: "Drag explanations onto their parent ideas", shape: "rect", stroke: "#00f0ff", children: [] },
            { id: "ls-2-2-2", title: "Shift-click two map elements → 'Join with line' for relationships", shape: "rect", stroke: "#00f0ff", children: [] },
          ],
        },
        {
          id: "ls-2-3",
          title: "Pass 3 — Compress and explain",
          shape: "rect",
          stroke: "#00f0ff",
          children: [
            { id: "ls-2-3-1", title: "Walk every branch out loud one week later", shape: "rect", stroke: "#00f0ff", children: [] },
            { id: "ls-2-3-2", title: "Where you stumble = your real study list", shape: "rect", stroke: "#00f0ff", children: [] },
          ],
        },
      ],
    },
    {
      id: "ls-3",
      title: "Three tips students use",
      shape: "hexagon",
      stroke: "#FF6AD5",
      fill: "rgba(255, 106, 213, 0.08)",
      children: [
        { id: "ls-3-1", title: "One PDF → one map (don't mass-map a textbook)", shape: "hexagon", stroke: "#FF6AD5", children: [] },
        { id: "ls-3-2", title: "Yellow stickies for confusion → /output collects them", shape: "hexagon", stroke: "#FF6AD5", children: [] },
        { id: "ls-3-3", title: "Highlight loosely on pass 1, organise on pass 2", shape: "hexagon", stroke: "#FF6AD5", children: [] },
      ],
    },
    {
      id: "ls-4",
      title: "Why local-first matters for learners",
      shape: "ellipse",
      stroke: "#3DDC84",
      fill: "rgba(61, 220, 132, 0.08)",
      children: [
        { id: "ls-4-1", title: "Maps live in your browser by default", shape: "ellipse", stroke: "#3DDC84", children: [] },
        { id: "ls-4-2", title: "We never see them", shape: "ellipse", stroke: "#3DDC84", children: [] },
        { id: "ls-4-3", title: "One-click mirror to Drive · Dropbox · Zotero — when YOU decide", shape: "ellipse", stroke: "#3DDC84", children: [] },
      ],
    },
    {
      id: "ls-5",
      title: "Bring your own AI key",
      shape: "diamond",
      stroke: "#A78BFA",
      fill: "rgba(167, 139, 250, 0.08)",
      children: [
        { id: "ls-5-1", title: "You only pay for what you use — cents per heavy week", shape: "diamond", stroke: "#A78BFA", children: [] },
        { id: "ls-5-2", title: "Your reading stays private — chapters never touch our servers", shape: "diamond", stroke: "#A78BFA", children: [] },
        { id: "ls-5-3", title: "Fuel-gauge in the top-right shows remaining capacity", shape: "diamond", stroke: "#A78BFA", children: [] },
      ],
    },
    {
      id: "ls-6",
      title: "Build a habit",
      shape: "round",
      stroke: "#FFC857",
      children: [
        { id: "ls-6-1", title: "One PDF a day — even 5 map elements counts", shape: "round", stroke: "#FFC857", children: [] },
        { id: "ls-6-2", title: "After a month, /galaxy shows your knowledge universe", shape: "round", stroke: "#FFC857", children: [] },
      ],
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const guideMap = () => ({
  id: "example-guide-research",
  title: "Guide · Research with mind-mapper",
  source: "example",
  example: true,
  summary: "A 60-second tour of how to build a literature review with this app.",
  shape: "round",
  stroke: "#00f0ff",
  fill: "rgba(0, 240, 255, 0.08)",
  icon: "book",
  children: [
    {
      id: "g-1",
      title: "1. Drop your sources",
      shape: "ellipse",
      stroke: "#ffec3d",
      fill: "rgba(255, 236, 61, 0.08)",
      icon: "pdf",
      children: [
        { id: "g-1-1", title: "PDF Studio → Quick Outline = headings tree", shape: "rect", children: [] },
        { id: "g-1-2", title: "PDF Studio → AI Analysis = themed map", shape: "rect", children: [] },
        { id: "g-1-3", title: "Each PDF auto-attaches to its map's root", shape: "rect", children: [] },
      ],
    },
    {
      id: "g-2",
      title: "2. Map your way through",
      shape: "ellipse",
      stroke: "#ff6ad5",
      fill: "rgba(255, 106, 213, 0.08)",
      icon: "brain",
      children: [
        { id: "g-2-1", title: "Right-click → Add icon, link, or upload file", shape: "rect", children: [] },
        { id: "g-2-2", title: "Right-click → Send to Research Assistant", shape: "rect", children: [] },
        { id: "g-2-3", title: "Drop sticky notes for things to come back to", shape: "rect", children: [] },
      ],
    },
    {
      id: "g-3",
      title: "3. Keep it visible",
      shape: "ellipse",
      stroke: "#ffb547",
      fill: "rgba(255, 181, 71, 0.08)",
      icon: "lightbulb",
      children: [
        { id: "g-3-1", title: "Stickies auto-collect in /output as Reminders", shape: "rect", children: [] },
        { id: "g-3-2", title: "Cloud Save mirrors to Drive, Dropbox, or Zotero", shape: "rect", children: [] },
        { id: "g-3-3", title: "Share map via /m/<slug> — view-only public link", shape: "rect", children: [] },
      ],
    },
    {
      id: "g-4",
      title: "4. Bring your own AI key",
      shape: "ellipse",
      stroke: "#7d6cff",
      fill: "rgba(125, 108, 255, 0.08)",
      icon: "sparkles",
      children: [
        { id: "g-4-1", title: "Settings → paste Claude / OpenAI / Gemini key", shape: "rect", children: [] },
        { id: "g-4-2", title: "Or use Galaxy.ai for one-subscription access", shape: "rect", children: [] },
        { id: "g-4-3", title: "Your key, your spend — we never proxy or store it", shape: "rect", children: [] },
      ],
    },
  ],
  annotations: [
    {
      id: "g-sticky-1",
      type: "sticky",
      x: 240,
      y: -180,
      w: 220,
      h: 130,
      text: "Tip: drop a real PDF into /intake to see this come alive.",
      done: false,
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const welcomeMap = () => ({
  id: "example-welcome",
  title: "Welcome to mind-mapper",
  source: "example",
  example: true,
  summary: "A first map to play with — try right-clicking, dragging, and the toolbar.",
  shape: "round",
  stroke: "#ff6ad5",
  fill: "rgba(255, 106, 213, 0.08)",
  icon: "sparkles",
  children: [
    {
      id: "w-1",
      title: "Try right-clicking me",
      shape: "ellipse",
      icon: "compass",
      children: [
        { id: "w-1-1", title: "Add child / sibling", shape: "rect", children: [] },
        { id: "w-1-2", title: "Change shape & colour", shape: "rect", children: [] },
        { id: "w-1-3", title: "Add an icon · video / pdf / music", shape: "rect", children: [] },
      ],
    },
    {
      id: "w-2",
      title: "Try the toolbar",
      shape: "ellipse",
      icon: "zap",
      children: [
        { id: "w-2-1", title: "Yellow icon = sticky note", shape: "rect", children: [] },
        { id: "w-2-2", title: "T = text box", shape: "rect", children: [] },
        { id: "w-2-3", title: "Image button = upload an image", shape: "rect", children: [] },
      ],
    },
    {
      id: "w-3",
      title: "Try sharing",
      shape: "ellipse",
      icon: "globe",
      children: [
        { id: "w-3-1", title: "Save → public /m/<slug> link", shape: "rect", children: [] },
        { id: "w-3-2", title: "Export → PNG / SVG / PDF / Markdown", shape: "rect", children: [] },
      ],
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/**
 * AI-demo maps — pre-baked outputs that look like a real "AI Analysis" run
 * on a popular public-domain document. We ship them so a brand-new user can
 * see the depth and shape of an AI-extracted mind map BEFORE paying for any
 * tokens. Marked with `source: "ai-demo"` and `demo: true` so the Library /
 * Bookshelf UI can badge them distinctly from user-built maps.
 *
 * Each map mirrors the structure our actual AI prompt produces: a single
 * root, 4–6 thematic branches, ~3–5 leaves per branch, branch-specific
 * stroke colours so the radial layout reads like a colour-coded outline.
 */

const transformerPaperDemo = () => ({
  id: "ai-demo-attention-is-all-you-need",
  title: "Demo · Attention Is All You Need (Vaswani 2017)",
  source: "ai-demo",
  example: true,
  demo: true,
  summary:
    "AI Analysis demo of the seminal Transformer paper — what it proposes, why it works, and what changed because of it.",
  shape: "round",
  stroke: "#00f0ff",
  fill: "rgba(0, 240, 255, 0.08)",
  icon: "brain",
  children: [
    {
      id: "ai-att-1",
      title: "Core proposal",
      shape: "rect",
      stroke: "#00f0ff",
      children: [
        { id: "ai-att-1-1", title: "Replace recurrence + convolutions with attention only", shape: "rect", stroke: "#00f0ff", children: [] },
        { id: "ai-att-1-2", title: "Encoder–decoder, both stacks of self-attention", shape: "rect", stroke: "#00f0ff", children: [] },
        { id: "ai-att-1-3", title: "Parallelisable across sequence positions", shape: "rect", stroke: "#00f0ff", children: [] },
      ],
    },
    {
      id: "ai-att-2",
      title: "Scaled dot-product attention",
      shape: "rect",
      stroke: "#39E0FF",
      children: [
        { id: "ai-att-2-1", title: "softmax(QKᵀ/√dₖ) · V", shape: "rect", stroke: "#39E0FF", children: [] },
        { id: "ai-att-2-2", title: "Scaling stops gradients vanishing at large dₖ", shape: "rect", stroke: "#39E0FF", children: [] },
        { id: "ai-att-2-3", title: "Masking enforces left-to-right in the decoder", shape: "rect", stroke: "#39E0FF", children: [] },
      ],
    },
    {
      id: "ai-att-3",
      title: "Multi-head attention",
      shape: "ellipse",
      stroke: "#A78BFA",
      children: [
        { id: "ai-att-3-1", title: "Project Q,K,V into h subspaces, attend in parallel", shape: "ellipse", stroke: "#A78BFA", children: [] },
        { id: "ai-att-3-2", title: "Each head learns a different relationship", shape: "ellipse", stroke: "#A78BFA", children: [] },
        { id: "ai-att-3-3", title: "Concatenate then project — preserves d_model", shape: "ellipse", stroke: "#A78BFA", children: [] },
      ],
    },
    {
      id: "ai-att-4",
      title: "Why it beats RNNs",
      shape: "hex",
      stroke: "#FFB547",
      children: [
        { id: "ai-att-4-1", title: "O(1) path between any two positions vs O(n)", shape: "hex", stroke: "#FFB547", children: [] },
        { id: "ai-att-4-2", title: "Trains in days instead of weeks on the same data", shape: "hex", stroke: "#FFB547", children: [] },
        { id: "ai-att-4-3", title: "BLEU 28.4 on WMT-14 EN-DE — SOTA at the time", shape: "hex", stroke: "#FFB547", children: [] },
      ],
    },
    {
      id: "ai-att-5",
      title: "Positional encoding",
      shape: "diamond",
      stroke: "#FF6AD5",
      children: [
        { id: "ai-att-5-1", title: "Attention is permutation-invariant — needs order info", shape: "diamond", stroke: "#FF6AD5", children: [] },
        { id: "ai-att-5-2", title: "Sinusoidal patterns of different frequencies", shape: "diamond", stroke: "#FF6AD5", children: [] },
        { id: "ai-att-5-3", title: "Learned embeddings work too — sinusoids generalise to longer seqs", shape: "diamond", stroke: "#FF6AD5", children: [] },
      ],
    },
    {
      id: "ai-att-6",
      title: "Aftermath",
      shape: "ellipse",
      stroke: "#3DDC84",
      children: [
        { id: "ai-att-6-1", title: "BERT, GPT, T5 — all built on this backbone", shape: "ellipse", stroke: "#3DDC84", children: [] },
        { id: "ai-att-6-2", title: "Vision Transformers ported the idea to images", shape: "ellipse", stroke: "#3DDC84", children: [] },
        { id: "ai-att-6-3", title: "The dominant architecture in 2025+", shape: "ellipse", stroke: "#3DDC84", children: [] },
      ],
    },
  ],
  researchMeta: {
    sourceMapTitle: "Attention Is All You Need (Vaswani et al., 2017)",
    sourceNodeTitle: "arxiv.org/abs/1706.03762",
    createdAt: Date.now(),
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const prideAndPrejudiceDemo = () => ({
  id: "ai-demo-pride-and-prejudice",
  title: "Demo · Pride and Prejudice (Austen)",
  source: "ai-demo",
  example: true,
  demo: true,
  summary:
    "AI Analysis demo of the Austen novel — themes, character arcs, structure, and why the opening sentence still works.",
  shape: "round",
  stroke: "#A78BFA",
  fill: "rgba(167, 139, 250, 0.08)",
  icon: "book",
  children: [
    {
      id: "ai-pp-1",
      title: "The famous opening",
      shape: "rect",
      stroke: "#A78BFA",
      children: [
        { id: "ai-pp-1-1", title: "\"A truth universally acknowledged…\"", shape: "rect", stroke: "#A78BFA", children: [] },
        { id: "ai-pp-1-2", title: "Sets up the marriage plot in 23 words", shape: "rect", stroke: "#A78BFA", children: [] },
        { id: "ai-pp-1-3", title: "Ironic — Austen is satirising the truth she states", shape: "rect", stroke: "#A78BFA", children: [] },
      ],
    },
    {
      id: "ai-pp-2",
      title: "Major themes",
      shape: "ellipse",
      stroke: "#FF6AD5",
      children: [
        { id: "ai-pp-2-1", title: "Pride — Darcy's class condescension", shape: "ellipse", stroke: "#FF6AD5", children: [] },
        { id: "ai-pp-2-2", title: "Prejudice — Elizabeth's snap judgements", shape: "ellipse", stroke: "#FF6AD5", children: [] },
        { id: "ai-pp-2-3", title: "Marriage as economic survival for women", shape: "ellipse", stroke: "#FF6AD5", children: [] },
        { id: "ai-pp-2-4", title: "Reputation in a small society", shape: "ellipse", stroke: "#FF6AD5", children: [] },
      ],
    },
    {
      id: "ai-pp-3",
      title: "Elizabeth Bennet",
      shape: "hex",
      stroke: "#FFC857",
      children: [
        { id: "ai-pp-3-1", title: "Witty, defiant, refuses Collins's proposal", shape: "hex", stroke: "#FFC857", children: [] },
        { id: "ai-pp-3-2", title: "Misreads Wickham as victim, Darcy as villain", shape: "hex", stroke: "#FFC857", children: [] },
        { id: "ai-pp-3-3", title: "Self-recognition after Darcy's letter — the novel's pivot", shape: "hex", stroke: "#FFC857", children: [] },
      ],
    },
    {
      id: "ai-pp-4",
      title: "Mr Darcy",
      shape: "hex",
      stroke: "#39E0FF",
      children: [
        { id: "ai-pp-4-1", title: "Aloof at first ball, insults Elizabeth's looks", shape: "hex", stroke: "#39E0FF", children: [] },
        { id: "ai-pp-4-2", title: "Letter at Hunsford forces him to be honest", shape: "hex", stroke: "#39E0FF", children: [] },
        { id: "ai-pp-4-3", title: "Pemberley scenes — Elizabeth sees him through staff who love him", shape: "hex", stroke: "#39E0FF", children: [] },
      ],
    },
    {
      id: "ai-pp-5",
      title: "Structure",
      shape: "diamond",
      stroke: "#3DDC84",
      children: [
        { id: "ai-pp-5-1", title: "Three volumes — proposal, refusal, reconciliation", shape: "diamond", stroke: "#3DDC84", children: [] },
        { id: "ai-pp-5-2", title: "Free indirect discourse: narrator slips into Lizzy's head", shape: "diamond", stroke: "#3DDC84", children: [] },
        { id: "ai-pp-5-3", title: "Comedy of manners + romance + bildungsroman", shape: "diamond", stroke: "#3DDC84", children: [] },
      ],
    },
    {
      id: "ai-pp-6",
      title: "Why it endures",
      shape: "ellipse",
      stroke: "#FFB547",
      children: [
        { id: "ai-pp-6-1", title: "First English novel where the heroine has interior life and wins", shape: "ellipse", stroke: "#FFB547", children: [] },
        { id: "ai-pp-6-2", title: "Dialogue still feels modern — almost no exposition", shape: "ellipse", stroke: "#FFB547", children: [] },
        { id: "ai-pp-6-3", title: "Has been adapted ~20× on screen since 1940", shape: "ellipse", stroke: "#FFB547", children: [] },
      ],
    },
  ],
  researchMeta: {
    sourceMapTitle: "Pride and Prejudice (Jane Austen, 1813)",
    sourceNodeTitle: "Project Gutenberg #1342",
    createdAt: Date.now(),
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const republicDemo = () => ({
  id: "ai-demo-the-republic",
  title: "Demo · The Republic (Plato)",
  source: "ai-demo",
  example: true,
  demo: true,
  summary:
    "AI Analysis demo of Plato's Republic — the ideal city, the soul, the philosopher-king, and why we still argue about it.",
  shape: "round",
  stroke: "#FF6AD5",
  fill: "rgba(255, 106, 213, 0.08)",
  icon: "lightbulb",
  children: [
    {
      id: "ai-r-1",
      title: "The central question",
      shape: "rect",
      stroke: "#FF6AD5",
      children: [
        { id: "ai-r-1-1", title: "What is justice — for the city, for the soul?", shape: "rect", stroke: "#FF6AD5", children: [] },
        { id: "ai-r-1-2", title: "Is the just life happier than the unjust life?", shape: "rect", stroke: "#FF6AD5", children: [] },
        { id: "ai-r-1-3", title: "Glaucon's challenge — \"prove it would be true even if invisible\"", shape: "rect", stroke: "#FF6AD5", children: [] },
      ],
    },
    {
      id: "ai-r-2",
      title: "The city in speech (Kallipolis)",
      shape: "ellipse",
      stroke: "#A78BFA",
      children: [
        { id: "ai-r-2-1", title: "Three classes — producers, guardians, philosopher-rulers", shape: "ellipse", stroke: "#A78BFA", children: [] },
        { id: "ai-r-2-2", title: "Each class does only its own work — that IS justice", shape: "ellipse", stroke: "#A78BFA", children: [] },
        { id: "ai-r-2-3", title: "Property + family in common for the guardians", shape: "ellipse", stroke: "#A78BFA", children: [] },
      ],
    },
    {
      id: "ai-r-3",
      title: "The soul mirrors the city",
      shape: "hex",
      stroke: "#39E0FF",
      children: [
        { id: "ai-r-3-1", title: "Reason · Spirit · Appetite — three parts", shape: "hex", stroke: "#39E0FF", children: [] },
        { id: "ai-r-3-2", title: "Justice = each part doing its job, ruled by reason", shape: "hex", stroke: "#39E0FF", children: [] },
        { id: "ai-r-3-3", title: "Tyranny = appetite enslaving reason", shape: "hex", stroke: "#39E0FF", children: [] },
      ],
    },
    {
      id: "ai-r-4",
      title: "Three famous images",
      shape: "diamond",
      stroke: "#FFC857",
      children: [
        { id: "ai-r-4-1", title: "Sun — the Form of the Good illuminates all knowledge", shape: "diamond", stroke: "#FFC857", children: [] },
        { id: "ai-r-4-2", title: "Divided Line — opinion vs knowledge, image vs reality", shape: "diamond", stroke: "#FFC857", children: [] },
        { id: "ai-r-4-3", title: "Cave — most see shadows; education turns the soul to the sun", shape: "diamond", stroke: "#FFC857", children: [] },
      ],
    },
    {
      id: "ai-r-5",
      title: "Decline of the regimes",
      shape: "rect",
      stroke: "#FFB547",
      children: [
        { id: "ai-r-5-1", title: "Aristocracy → timocracy → oligarchy → democracy → tyranny", shape: "rect", stroke: "#FFB547", children: [] },
        { id: "ai-r-5-2", title: "Each fall driven by which part of the soul takes charge", shape: "rect", stroke: "#FFB547", children: [] },
        { id: "ai-r-5-3", title: "Democracy = freedom for appetite, breeds the demagogue", shape: "rect", stroke: "#FFB547", children: [] },
      ],
    },
    {
      id: "ai-r-6",
      title: "Why we still argue",
      shape: "ellipse",
      stroke: "#3DDC84",
      children: [
        { id: "ai-r-6-1", title: "Popper — first totalitarian blueprint", shape: "ellipse", stroke: "#3DDC84", children: [] },
        { id: "ai-r-6-2", title: "Strauss — read it as deliberate provocation, not policy", shape: "ellipse", stroke: "#3DDC84", children: [] },
        { id: "ai-r-6-3", title: "Setting the curriculum for political philosophy ever since", shape: "ellipse", stroke: "#3DDC84", children: [] },
      ],
    },
  ],
  researchMeta: {
    sourceMapTitle: "The Republic (Plato, c. 375 BC · Jowett translation)",
    sourceNodeTitle: "Project Gutenberg #1497",
    createdAt: Date.now(),
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
});


/**
 * Seed example maps if this is the first run AND the library is empty.
 *
 * Returns the count of maps added.
 */
export const seedExamplesIfFirstRun = () => {
  try {
    const existing = listMaps();

    // Self-heal: if the library is COMPLETELY empty (e.g. user wiped
    // localStorage, or never seeded due to an old bumped flag), always
    // re-seed the starter set even if the SEED_FLAG is set. An empty
    // library is a dead end and a regression we don't want.
    if (existing.length === 0) {
      saveMap(welcomeMap());
      saveMap(learningMap());
      saveMap(guideMap());
      saveMap(prideAndPrejudiceDemo());
      saveMap(republicDemo());
      localStorage.setItem(SEED_FLAG, "1");
      return 5;
    }

    if (localStorage.getItem(SEED_FLAG)) return 0;

    // User already has maps — don't overwrite their library, but ensure
    // the AI demo trio is added when an existing user upgrades to v3 —
    // they should see what AI Analysis produces without paying.
    // (Note: 'attention-is-all-you-need' demo intentionally NOT in this
    // upgrades list — the creator decided it was off-brand for the app.)
    const upgrades = [
      ["example-learning-success", learningMap],
      ["ai-demo-pride-and-prejudice", prideAndPrejudiceDemo],
      ["ai-demo-the-republic", republicDemo],
    ];
    for (const [id, mk] of upgrades) {
      if (!existing.some((m) => m.id === id)) {
        try { saveMap(mk()); } catch { /* ignore */ }
      }
    }
    localStorage.setItem(SEED_FLAG, "1");
    return 0;
  } catch {
    return 0;
  }
};

/**
 * Force-ensure a specific example map exists, regardless of seed state.
 * Used by `/app?example=guide|welcome|learning|transformer|austen|plato` so
 * the landing-page CTA always works even for users who already have other
 * maps in their library.
 */
export const ensureExampleMap = (which) => {
  try {
    let m;
    if (which === "welcome") m = welcomeMap();
    else if (which === "learning") m = learningMap();
    else if (which === "transformer") m = transformerPaperDemo();
    else if (which === "austen" || which === "pride") m = prideAndPrejudiceDemo();
    else if (which === "plato" || which === "republic") m = republicDemo();
    else m = guideMap();
    const existing = listMaps();
    if (!existing.some((x) => x.id === m.id)) {
      saveMap(m);
    }
    return m.id;
  } catch {
    return null;
  }
};


/**
 * Wipe the user's library and restore the original "How to use" + welcome +
 * guide seeds + AI demo trio. Used by the Studio settings "Reset demo data"
 * button so the owner can return to a pristine demo state between recording
 * takes.
 *
 * Returns the count of maps after re-seeding so the caller can toast.
 */
export const resetDemoData = () => {
  try {
    // Storage key is the same one storage.js uses ("mindmapper.maps.v1").
    localStorage.removeItem("mindmapper.maps.v1");
    localStorage.removeItem(SEED_FLAG);
    // Also clear ink strokes, tombstones, and recents so a re-render starts
    // truly clean — otherwise an old recent might bring a stale title back.
    localStorage.removeItem("mindmapper.ink.v1");
    localStorage.removeItem("mindmapper.cloudSync.tombstones.v1");
    localStorage.removeItem("mindmapper.recents.v1");
  } catch { /* ignore quota / private-mode */ }
  // Re-seed everything (transformer demo intentionally excluded — see
  // creator's brand decision in seedExamplesIfFirstRun).
  saveMap(welcomeMap());
  saveMap(learningMap());
  saveMap(guideMap());
  saveMap(prideAndPrejudiceDemo());
  saveMap(republicDemo());
  try { localStorage.setItem(SEED_FLAG, "1"); } catch { /* ignore */ }
  return 6;
};
