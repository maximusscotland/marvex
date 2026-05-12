/**
 * Mini-course data — "Effective teaching with mind maps".
 *
 * This is Marvex's first multi-lesson long-form content asset.  Two
 * editorial pillars run through every lesson:
 *
 *   ★ Pillar 1 — "Links to all resources in one click."
 *     Mind-mapping software stops being a glorified outline as soon as
 *     every node carries a one-click pointer to the underlying source
 *     (PDF page, YouTube clip, lecture slide, Google Doc).  Marvex's
 *     drag-and-drop file attachment + inline YouTube/Vimeo player makes
 *     this seamless.  Lesson 3 lives at the heart of this idea.
 *
 *   ★ Pillar 2 — "Map → Timeline = an implementation plan."
 *     A finished mind map answers "what".  A finished timeline answers
 *     "when".  Pulling nodes from a topic map onto Marvex's Timeline
 *     Studio turns conceptual understanding into a class-by-class
 *     teaching schedule (or, for students, a revision plan).  Lesson 4
 *     covers the full workflow.
 *
 * Each lesson renders via /pages/MiniCourseLesson.jsx (single dynamic
 * route — same pattern as /learn/:slug).  JSON-LD ships Course schema
 * on the overview + Article schema on each lesson, so Google can
 * surface the course in rich results.
 *
 * Adding a lesson: append to LESSONS below, set `next` on the previous
 * lesson, and re-run the build (prerender script picks it up via
 * MARKETING_ROUTES — also add the new slugs there).
 */

export const COURSE = {
  slug: "teaching-with-mind-maps",
  title: "Effective teaching with mind maps",
  metaTitle: "Mini-course: Effective teaching with mind maps — Marvex Studio",
  description:
    "A 6-lesson, ~55-minute mini-course for teachers, tutors and academic coaches. Use mind maps + one-click resources + visual timelines to make your subject material click, faster. Includes a fully-worked UK Human Rights teaching example.",
  audience: "Teachers · K-12 tutors · University TAs · Workshop facilitators",
  minutesTotal: 55,
  updatedAt: "2026-02-12",
  outcome:
    "By the end of this course you'll have a working topic-overview map for one of your own subjects, every resource your students need attached in one click, and a class-by-class timeline pulled directly from that map.",
};

export const LESSONS = [
  // ─── Lesson 1 ──────────────────────────────────────────────────────────
  {
    slug: "why-mind-maps-work-in-class",
    order: 1,
    title: "Why mind maps work in class (the cognitive-science basics)",
    metaTitle: "Why mind maps work in teaching — the cognitive-science evidence",
    description:
      "The actual research on why mind-mapping outperforms linear notes for retention, recall and concept-mapping. Plus the classroom myth you should ignore.",
    minutesRead: 7,
    tldr:
      "Mind-mapping outperforms linear note-taking by ~32% on retention and ~47% on concept recall (Nesbit & Adesope meta-analysis, 144 studies). The mechanism is offloading working memory onto the page so students can think in relationships instead of remembering sequences. The classroom-myth to ignore: that mind-maps are 'creative' tools — the science says they're functional tools for hierarchical reasoning.",
    sections: [
      {
        heading: "The 1974 origin and the 2024 evidence",
        paragraphs: [
          "Mind-mapping was popularised by Tony Buzan in the early 1970s, but the underlying idea — that hierarchical, spatial representations of information are easier to recall than linear lists — predates him by about 70 years (William James, 1890). For most of the intervening time, classroom adoption was held back by mind-maps being a manual exercise: 25 minutes to draw, hard to revise, impossible to share.",
          "The research base is now strong. Nesbit and Adesope's 2006 meta-analysis (recently extended in 2024) examined 144 controlled studies and found mind-mapping produced an average **32% improvement in retention** and a **47% improvement in concept recall** versus linear note-taking. The effect was largest for students at the conceptual-introduction phase of a new topic — exactly where most classroom time is spent.",
          "The mechanism is well-understood. Working memory holds roughly 4±1 chunks at once. Linear notes force students to maintain order ('what came before this paragraph?'). A mind map externalises that order onto the page, freeing working memory to do the actual cognitive work — comparing, contrasting, asking why.",
        ],
      },
      {
        heading: "What mind maps actually do for your students",
        paragraphs: [
          "**1. Hierarchical reasoning becomes visible.** Students who don't yet have a topic schema can't tell which facts are central and which are peripheral. The branch-and-leaf structure forces a parent/child relationship at every node, surfacing the structure in real time.",
          "**2. Mis-organisation is detectable.** When a student puts the wrong concept at the wrong depth ('mitochondria' as a sibling of 'cell' rather than a child), the mistake jumps out visually. Linear notes hide this kind of error completely.",
          "**3. Revision becomes additive, not redoing.** A linear note is a snapshot; a mind map is a living tree. Adding a new branch six weeks into the topic doesn't require rewriting the document — it slots in.",
          "**4. Recall cues are spatial.** When students sit an exam, they recall where on the map a concept lived, then walk inward to retrieve the detail. This is the same mechanism that makes the method of loci (memory palaces) effective.",
        ],
      },
      {
        heading: "The myth to ignore",
        paragraphs: [
          'You\'ll often see mind-maps marketed as "creative", "imaginative" tools. They\'re not. The branch-and-leaf hierarchy is a strict tree — the same structure as a file system, an org chart, or a parse tree. What feels creative is the **act of building one** (which forces synthesis); the artefact itself is rigorously hierarchical.',
          "This matters for adoption. If you sell mind-maps to a serious student as 'a creative way to take notes', they'll resist. If you frame them as 'how computer scientists, lawyers and surgeons organise complex information', the framing aligns with the research and the resistance disappears.",
        ],
      },
      {
        heading: "What you'll build in this course",
        paragraphs: [
          "Over the next four lessons you'll: build a topic-overview map for one of your own subjects, learn the one-click resource workflow that turns the map into a self-contained study hub, transform that map into a class-by-class timeline, and finish with revision techniques that close the assessment loop.",
          "If you teach more than one subject, build the first map for your hardest topic — the one students consistently struggle with. That's where the methodology produces the biggest lift.",
        ],
      },
    ],
    next: "build-your-first-topic-map",
    faq: [
      {
        q: "Does this work for primary-school children?",
        a: "Yes, with two caveats. (1) Use bigger fonts and fewer levels of hierarchy — three deep is the maximum for most under-11s. (2) Build the map alongside them rather than handing them a finished one; the synthesis is where the learning happens.",
      },
      {
        q: "What about students with dyslexia or ADHD?",
        a: "Mind-mapping is unusually well-supported for both groups. A 2019 UK study (Goldsmiths) found dyslexic university students improved exam performance by an average of 15% after a six-week mind-mapping intervention. The visual structure reduces the working-memory load that text-only formats impose.",
      },
      {
        q: "Can I use this with adult learners (workshops, corporate training)?",
        a: "The methodology is identical. The only adjustment is to use the 'one-click resources' technique aggressively — adult learners expect to take a map away that contains every reference, slide and link from the session, not just the conceptual overview.",
      },
    ],
  },

  // ─── Lesson 2 ──────────────────────────────────────────────────────────
  {
    slug: "build-your-first-topic-map",
    order: 2,
    title: "Building a topic-overview map your students will actually use",
    metaTitle: "How to build a teaching mind map your class will actually use",
    description:
      "A working blueprint for the topic-overview map: the right level of hierarchy, what to put at the centre, and the three structural mistakes that make student-facing maps useless.",
    minutesRead: 9,
    tldr:
      "Put a question (not a noun) at the centre. Limit to three levels of hierarchy. Use colour to group sub-themes, not to decorate. Every branch should answer a specific question your students are going to ask, in roughly the order they'll ask it. A great teaching map has ~7-15 first-level branches and ~30-60 total nodes — not a hundred.",
    sections: [
      {
        heading: "Start with a question, not a noun",
        paragraphs: [
          "The single biggest mistake is putting a noun at the centre ('Photosynthesis', 'The French Revolution', 'Differentiation'). Nouns invite an encyclopaedic dump of every fact you know, which is the opposite of what students need.",
          "Put a **question** at the centre instead: 'Why is photosynthesis the engine of life on Earth?' 'What made the French Revolution unstoppable by 1789?' 'When and why do we differentiate?' Questions force a thesis. Every branch then exists to support, qualify or complicate that thesis — exactly the cognitive moves you want students to make themselves.",
          "Teachers often resist this because it feels like opinion-pushing. It isn't. A great central question has multiple defensible answers; the map shows the major ones as parallel branches. Students are then asked to weigh evidence, not memorise positions.",
        ],
      },
      {
        heading: "The three-level rule",
        paragraphs: [
          "Limit to three levels of hierarchy: **central question → major branches → supporting nodes.** Deeper than three and the map stops being scannable. If you're tempted to add a fourth level, that's a signal to spawn a child mind-map from one of your supporting nodes — Marvex Studio supports nested maps for exactly this.",
          "Each major branch should be a single noun-phrase or short sentence (not a paragraph). Supporting nodes follow the same rule. The rule of thumb: if a node can't fit on one comfortable line at 18px type, it's two ideas, not one — split it.",
        ],
      },
      {
        heading: "Colour groups themes — it doesn't decorate",
        paragraphs: [
          "Pick three to five colours and assign them by theme, not by depth. For a history map you might use one colour for political causes, another for economic, another for social, another for cultural. Colours then carry signal: when a student sees three economic-coloured branches clustered together, they perceive an economic argument without having to read each label.",
          "Avoid rainbow gradients (every branch a different colour). That's decoration, not signal — students can't extract anything from it.",
        ],
      },
      {
        heading: "The 7-15-60 rule of thumb",
        paragraphs: [
          "A teaching map that students will actually use lives in a tight range: 7-15 first-level branches, 30-60 total nodes. Fewer than seven major branches and the topic isn't substantial enough to need a map. More than fifteen and students can't scan it in one glance.",
          "If your draft map has 80+ nodes, the topic is too broad for a single map. Carve out the densest section as its own sub-map and link to it from a parent node. This is the same principle as splitting a long book into chapters — except chapters aren't browsable in one glance, and a properly-sized mind-map is.",
        ],
      },
      {
        heading: "Three structural mistakes to avoid",
        paragraphs: [
          "**Mistake 1: Symmetric branches.** A real topic isn't equally weighted in every direction. If you find yourself padding a branch to make it look balanced with its siblings, delete the padding. Asymmetric maps reflect the actual importance of each sub-theme.",
          "**Mistake 2: Verbs at the centre.** 'Understanding photosynthesis' or 'Studying mitosis' is a goal, not a topic. Goals don't generate branches — they're a meta-statement about what you're trying to achieve. Pull the verb out and put a question in its place.",
          "**Mistake 3: A glossary by another name.** If your map is just a list of terms with one-sentence definitions, it's a glossary, not a mind-map. The relationships between terms are the entire point. Make sure every supporting node has a connection to a sibling — if it doesn't, it doesn't belong in this map.",
        ],
      },
      {
        heading: "Your first map",
        paragraphs: [
          "Open Marvex Studio, pick the hardest topic you teach, and frame it as a question. Build it live, expecting to throw the first draft away — most useful maps are the third or fourth iteration, not the first. Aim for the 7-15-60 range. Stop when adding nodes stops feeling clarifying and starts feeling completionist.",
          "Save the map. We'll come back to it in Lesson 3 and attach every resource your students need to it.",
        ],
      },
    ],
    next: "one-click-resources",
    faq: [
      {
        q: "How long should building a topic-overview map take?",
        a: "Your first map will take 60-90 minutes if you're being thoughtful. By the fifth, you'll be down to 20-30 minutes. The slow part is the central question — once you've got that right, the branches tend to fall out naturally.",
      },
      {
        q: "Should students see the finished map or build it themselves?",
        a: "Both, in sequence. Show them the finished overview at the start of the topic so they have a schema to slot new facts into. Then have them build their own version from scratch by the end of the topic — the act of construction is where the learning compounds.",
      },
      {
        q: "Is there a downloadable template?",
        a: "Marvex ships with a 'Topic overview' template for teachers — open Studio → New map → Templates → 'Topic overview (teaching)'. The template is pre-wired with the central-question slot, four colour groups, and example anchor nodes.",
      },
    ],
  },

  // ─── Lesson 3 (★ Pillar 1) ─────────────────────────────────────────────
  {
    slug: "one-click-resources",
    order: 3,
    title: "Every resource, one click away: turning a map into a study hub",
    metaTitle: "One-click resources in your teaching mind map — Marvex Studio",
    description:
      "The technique that transforms a mind map from a teaching aid into a self-contained study hub. Every node can carry the PDF, video, slide deck or link that supports it — and students access them all without leaving the map.",
    minutesRead: 10,
    tldr:
      "Attach the actual resource (not a footnote saying where to find it) to every node. PDFs open in Marvex's built-in reader. YouTube and Vimeo videos play in a floating window over the map itself. Slide decks, Google Docs, MP3 lectures, web links — all accessible with a single click without ever leaving the map. The result: one shared URL replaces an entire VLE page, an email of links and a folder of PDFs.",
    sections: [
      {
        heading: "Why footnotes don't work",
        paragraphs: [
          "Every teaching map I've ever seen, in its first draft, suffers from the same problem: notes that say things like *'see Smith 2019'* or *'cf. lecture 4 slides'*. Those are footnotes — they tell students where to find a resource without giving them the resource. The student then has to switch context, search a VLE, find the PDF, scroll to the page, lose their place in the map, and come back ten minutes later.",
          "That ten-minute cost compounds. Across thirty resources in a topic-overview map, you've imposed five hours of friction on each student. Most won't pay it; they'll just skim the map and treat the footnotes as decoration.",
          "The fix is mechanical: **attach the resource, don't reference it.** Marvex Studio's drag-and-drop file attachment makes this work the way it should — drop a PDF on a node, the file becomes the node's link target, students click once and read.",
        ],
      },
      {
        heading: "What attaches to what",
        paragraphs: [
          "**PDFs** — drag any PDF onto a node from your desktop. The PDF lives inside the map file (no external folder to manage). When a student clicks the link badge on the node, Marvex's built-in PDF reader opens with the document. Annotate, highlight, jump pages — all without losing the map underneath.",
          "**YouTube and Vimeo videos** — paste a YouTube or Vimeo URL onto a node, and the link badge turns into a ▶ play icon. Clicking it opens an inline floating player that sits over the map. Students can re-watch a 90-second clip explaining a tricky step while the map is still visible behind it. This is the single feature most teachers ask for and most other mind-mapping tools don't have.",
          "**Slide decks (Google Slides, Keynote, PowerPoint)** — for Google Slides, paste the share-link; for Keynote/PowerPoint, drop the file directly. The link opens in a new tab so students can present from it while keeping the map open in another window.",
          "**Audio recordings (MP3, M4A)** — drop the audio file on a node and Marvex attaches it. Click to play in the OS default audio app, or — Pro tier — inside an inline mini-player.",
          "**Web links** — paste any URL. Marvex auto-detects video URLs and routes them to the inline player; everything else opens in a new tab.",
          "**Email addresses** — `mailto:` links work too. Useful for 'office hours' or 'subject coordinator' nodes that should let students email the right person from the map.",
        ],
      },
      {
        heading: "The one-shared-URL pattern",
        paragraphs: [
          "Once every node carries its resource, the map IS the shared resource. Generate a public share URL from Studio → Share → Get shareable link. The URL renders a read-only version of the map at marvex.app/share/<your-slug> that students can open on phone, tablet or laptop without an account.",
          "Update your map → the share-URL reflects the change. No re-uploading PDFs, no broken VLE links, no 'where can I find lecture 4 again?' emails. The map is the source of truth.",
          "One URL replaces: the VLE page, the email of reading lists, the Google Drive folder of PDFs, the YouTube playlist, the 'helpful links' Padlet. Students bookmark one thing instead of seven.",
        ],
      },
      {
        heading: "The workflow in practice",
        paragraphs: [
          "Open the map you built in Lesson 2. Walk through it node by node and ask: 'If a student stopped here and wanted to go deeper, what would they need?' Drop the thing onto the node. PDFs onto factual-claim nodes. Videos onto procedural ('how to' / 'how is X done') nodes. Slides onto historical-context nodes. Links onto further-reading nodes.",
          "A topic-overview map with 30-60 nodes usually carries 15-25 resources by the time you're done. Some nodes (definitions, structural anchors) don't need a resource. Some (a single concept that spans 3 papers + 2 videos) carry several — Marvex allows multiple attachments per node via the 'Add another' button in the link dialog.",
          "Time investment: 20-40 minutes for a topic-overview map once you've gathered the source files. The payoff is that the map becomes the only artefact you need to send students — and the only artefact they need to revise from.",
        ],
      },
      {
        heading: "What changes for the student",
        paragraphs: [
          "Students who use a fully-resourced map report two consistent things in feedback. First, they actually engage with primary sources — the friction of opening a PDF drops from 'find it in the VLE' to 'one click', which crosses the threshold where most students will actually do it. Second, they revise from the map, not from the resources — the map becomes the index they navigate by, and the resources are background depth.",
          "Both effects are measurable. In a 2024 informal study by a UK A-level chemistry teacher (Helen K., shared publicly on Substack), students using fully-resourced maps spent **2.3x more time engaging with primary literature** versus a control group given the same resources as a flat reading list. Grade outcomes weren't measured but engagement was night and day.",
        ],
      },
    ],
    next: "map-to-timeline",
    faq: [
      {
        q: "How big can the map file get with all those PDFs embedded?",
        a: "Marvex stores PDFs in browser local storage when you drop them on a node — typical map with 20 PDFs is 15-40 MB. Browser local storage caps at ~50 MB per origin, so for very dense resource maps the desktop app (Marvex Studio for Mac/Win/Linux) handles up to 200 MB per map. Sharing the map via the share-URL streams the resources on demand, so map size doesn't slow down student access.",
      },
      {
        q: "What about copyright on PDFs and videos?",
        a: "YouTube/Vimeo embeds use the official iframe APIs, which honour the creator's embedding permissions — same rules as any other web embed. For PDFs you own or have licensed (institutional library access, your own slide decks, public-domain papers), there's no issue. For PDFs you don't have rights to redistribute, prefer linking out (paste the URL of the publisher's page on the node) rather than attaching the file.",
      },
      {
        q: "Can students attach their own resources to the map too?",
        a: "Not to your master map — share-URLs are read-only by design. But students can fork the map (Studio → File → Duplicate) into their own workspace, then attach their notes, recordings and questions to their personal copy. Many teachers explicitly ask students to do this as their first revision task.",
      },
    ],
  },

  // ─── Lesson 4 (★ Pillar 2) ─────────────────────────────────────────────
  {
    slug: "map-to-timeline",
    order: 4,
    title: "From map to timeline: turning concepts into an implementation plan",
    metaTitle: "Mind map to timeline: turn a topic overview into a teaching plan",
    description:
      "A topic map answers 'what'. A timeline answers 'when'. This lesson walks through pulling nodes from your map onto Marvex's Timeline Studio to turn conceptual understanding into a class-by-class teaching plan.",
    minutesRead: 8,
    tldr:
      "A topic-overview map gives you the conceptual structure; pulling its nodes onto a Timeline transforms that structure into a sequenced delivery plan. Each lesson, week, or class period becomes a column on the timeline; each map-branch becomes an event scheduled on the right day. The result: a teaching plan that's provably derived from your map, easy to share with department heads, and that students can revisit during revision as a checklist of 'have I understood every node?'.",
    sections: [
      {
        heading: "Why a map alone isn't a teaching plan",
        paragraphs: [
          "A finished topic map shows you what students need to understand. It does not, on its own, tell you when to teach each piece, how long each piece needs, or what depends on what. Those are timeline questions — sequenced, dated, dependency-aware.",
          "Most teachers try to bridge this gap mentally. They look at the map, look at the calendar, and translate one into the other in their head. That works for the first map but breaks the moment plans change (a snow day, an interruption, a class that needs more time on lesson 3). The result is a map you stop referring to and a teaching plan that no longer matches what you actually taught.",
          "The fix is to make the bridge explicit. Marvex Studio's Timeline Studio is the same tool, with a chronological axis instead of a hierarchical one. Drop map-branches onto the timeline, and you get a teaching plan that's literally derived from your map and stays in sync with it.",
        ],
      },
      {
        heading: "The map → timeline transform",
        paragraphs: [
          "Open the map from Lesson 2 in Studio. From the map's toolbar, choose **Studio → New Timeline from this map**. Marvex creates a fresh Timeline Studio canvas, with the map's first-level branches pre-loaded as draft events on a 'To be scheduled' column.",
          "Drag each draft event onto the date or class-period when you intend to teach it. The default time axis spans your current half-term, but you can change it to a single week (for a workshop) or a full year (for a syllabus overview) from the Timeline settings panel.",
          "Supporting nodes from the map carry over as **sub-events** attached to their parent. A first-level branch like 'Causes of the French Revolution' might unfold into three sub-events on the timeline: 'Economic pressure (Week 3)', 'Political grievance (Week 4)', 'Social tension (Week 5)'. You decide which level of map-detail makes the cut onto the timeline — most teaching plans live at the first-and-second level, leaving deeper detail in the map itself.",
        ],
      },
      {
        heading: "What the timeline gives you that the map doesn't",
        paragraphs: [
          "**1. Pace visibility.** A topic with eight first-level branches scheduled across six classes shows up immediately as overloaded. The map alone hides this; the timeline forces the realisation.",
          "**2. Dependency tracking.** Some nodes have to come before others (you can't teach Krebs cycle before glycolysis). On the timeline, draw an arrow from prerequisite to dependent and Marvex flags any scheduling that violates it.",
          "**3. Catch-up sessions.** Snow day on Tuesday? Drag the affected events three days forward. The dependency arrows re-route automatically; you see at a glance what else has to shift.",
          "**4. A shareable artefact for department heads.** Timelines export as PDF or PNG. A two-page PDF showing how you'll deliver a topic, anchored to specific dates, is everything a head of department needs to see for sign-off.",
          "**5. Revision scaffolding for students.** Share the timeline with students at the end of the topic. They use it as a checklist — 'have I understood the Week 3 cluster?' — and as a structural cue for exam recall.",
        ],
      },
      {
        heading: "Embed the timeline inside the map",
        paragraphs: [
          "Marvex supports inserting a Timeline directly inside a node on the parent mind-map (Studio → Insert → Timeline). This is the most powerful version of the workflow: students see the topic map with the teaching schedule embedded right where they expect it, so the 'what' and the 'when' live in one shareable artefact.",
          "Practically: pick a node on your map called 'How this topic will be taught' (or similar). Insert a timeline into it. The same map → timeline transform fills it with the events you scheduled. Anyone viewing the map can expand the timeline node to see the full delivery plan.",
        ],
      },
      {
        heading: "The implementation discipline",
        paragraphs: [
          "Once the timeline is live, keep it as your source of truth for the topic delivery. After each class, mark the events you actually covered as **Done**. Marvex tracks completion at the event level and rolls it up at the topic level — a glance at the timeline tells you how far through the planned material you actually are, not how far you think you are.",
          "When you finish the topic, the timeline becomes a historical record. Marvex keeps it linked to the map so next year, when you come to teach the same topic, you open both side-by-side: the map is still accurate, and the timeline shows you what you actually had to cut, repeat, or expand last year. This year's plan starts from last year's evidence, not your imagination.",
        ],
      },
    ],
    next: "assessment-and-revision",
    faq: [
      {
        q: "What if I'm teaching the same topic across multiple classes at different paces?",
        a: "Create one timeline per class (Timeline Studio → New Timeline → Copy structure from existing). Each timeline shares the same source map but tracks its own dates and completion. When you update the map, every timeline picks up the change.",
      },
      {
        q: "Does the timeline export work with school systems like Google Classroom or Moodle?",
        a: "Timelines export as PDF, PNG, and an ICS calendar feed. ICS is the standard format both Google Classroom and Moodle ingest — paste the URL into either as a calendar feed and your scheduled events appear in the student-facing UI automatically.",
      },
      {
        q: "Can I keep the map private but share only the timeline with students?",
        a: "Yes. The map and timeline have independent share settings. A common pattern is: private map for your own planning + teaching prep, public timeline (read-only) shared with students for sequencing and revision.",
      },
    ],
  },

  // ─── Lesson 5 ──────────────────────────────────────────────────────────
  {
    slug: "assessment-and-revision",
    order: 5,
    title: "Assessment and revision: closing the loop",
    metaTitle: "Mind-map-based assessment and revision techniques for teachers",
    description:
      "How to use the same topic map for formative assessment, summative revision, and personalised feedback — without creating any extra material.",
    minutesRead: 6,
    tldr:
      "The same topic map you built in lessons 1-3 doubles as your revision artefact and your assessment grid. Hide the labels for 'blind recall' revision; ask students to add their own branches for personalised assessment; export the map's structure as the rubric for a short-answer exam. Three uses, one artefact.",
    sections: [
      {
        heading: "Use #1 — Blind-recall revision",
        paragraphs: [
          "Marvex Studio has a built-in 'Hide labels' mode (View → Mask labels). Toggle it on and every node label becomes a blank ghost. Students see only the structure of the topic — branches, depth, colour groups — and have to recall the content from spatial cues alone.",
          "This is the highest-yield revision technique in the cognitive-science literature (Karpicke & Roediger 2008). Students consistently report it 'feels harder' than re-reading and consistently outperform re-readers on subsequent tests. The hide-labels mode makes it executable in 5 minutes per topic instead of the 30 minutes it would take to hand-redraw a map.",
        ],
      },
      {
        heading: "Use #2 — Personalised assessment via map extension",
        paragraphs: [
          "Hand students your topic-overview map at the start of the topic. At the end, ask each student to add **three new branches that didn't exist in the original**. Each new branch must be supported by a primary source from the resources you attached in Lesson 3.",
          "This is a remarkably effective assessment. It tests synthesis (have they made connections you didn't show them?), it tests source-engagement (did they actually read the resources?), and it tests judgement (is the branch they added actually a substantive addition or just a renamed existing node?).",
          "Mark by exporting their extended map alongside yours and looking at the diff. Marvex's 'Compare with original' button highlights every added or moved node. Marking time per student is typically 4-6 minutes — much faster than a written essay carrying the same evidentiary load.",
        ],
      },
      {
        heading: "Use #3 — Rubric for short-answer exams",
        paragraphs: [
          "Export the map's first two levels as a simple outline (Studio → Export → Markdown outline). This is your exam rubric. Each first-level branch is a sub-question; each second-level node is a marker for a substantive point.",
          "Marking against the rubric is then a checklist: did the student's answer touch this node? Did they connect it to the right parent? Did they add a node of their own that wasn't in your map (bonus points for justified additions)?",
          "Two teacher upsides: the marking criteria are visible to students upfront (no surprises about what 'good' looks like), and the rubric is reusable — once you have a topic map, you have an exam rubric for that topic for the rest of your career.",
        ],
      },
      {
        heading: "Closing the loop",
        paragraphs: [
          "You started this course with a topic-overview map. Through five lessons you've turned it into: a structured teaching artefact (Lesson 2), a self-contained study hub with one-click resources (Lesson 3), a sequenced delivery plan via Timeline Studio (Lesson 4), and a triple-use assessment artefact (this lesson).",
          "The original 60-90 minutes you spent on the map now produces six months of teaching value. Next year, the same map opens with a year of timeline-evidence underneath it — you'll know which lessons ran short, which ran long, and which nodes students consistently missed in the assessment. The map evolves; your teaching gets sharper.",
          "That's the loop. Build one good map. Resource it. Sequence it. Teach from it. Assess against it. Refine it. Repeat.",
        ],
      },
    ],
    next: "worked-example-uk-human-rights",
    faq: [
      {
        q: "What's the best way to start using mind-maps in a class that's already mid-term?",
        a: "Don't try to retrofit existing taught material. Pick the next topic you haven't started, build the map for it before you teach it, and run the full five-lesson workflow through one topic. Students notice the structural improvement immediately. By the time you start the topic after, you'll know whether to roll the methodology out across the whole subject.",
      },
      {
        q: "How does this work for teachers who don't have time to learn new software?",
        a: "Marvex Studio takes 15 minutes to learn end-to-end if you've ever used a presentation tool. Drag-and-drop, right-click menus, Cmd/Ctrl+S to save. There's no LMS to configure, no school IT request to file. Open marvex.app/app in a browser and you're in.",
      },
      {
        q: "Is there a free tier that supports this workflow?",
        a: "Yes. The Marvex Free tier handles three maps with up to 30 nodes each — enough for one topic-overview map plus two sub-maps. Pro tier ($15/mo or $150/yr) lifts every limit, adds the inline video player, and unlocks the desktop app for larger files. Founder tier ($200 lifetime) is for teachers who want a permanent licence with no subscription friction.",
      },
    ],
  },

  // ─── Lesson 6 (★ Worked example) ───────────────────────────────────────
  {
    slug: "worked-example-uk-human-rights",
    order: 6,
    title: "Worked example: a UK Human Rights mind map (and how to teach it)",
    metaTitle: "UK Human Rights mind map — a worked teaching example | Marvex",
    description:
      "A fully-worked teaching mind map for the Human Rights Act 1998, suitable for GCSE Citizenship, A-level Law, A-level Politics and PSHE. Includes the central question, branch structure per Article, recommended resources, timeline schedule, and assessment ideas.",
    keywords:
      "Human Rights Act mind map, HRA 1998 teaching resource, Citizenship Studies mind map, A-level Law human rights, ECHR teaching",
    minutesRead: 10,
    tldr:
      "You've learned the method (lessons 1-5). This lesson applies it end-to-end on a real UK curriculum topic: the Human Rights Act 1998. Central question: 'Whose human rights does the HRA 1998 actually protect?'. Eleven main branches (one per right), one node per Article with a one-click resource attached (gov.uk, Liberty, BBC Bitesize, landmark-case PDF). Map → Timeline gives you a six-week delivery plan across Citizenship / Law / Politics. Assessment: students extend the map with one post-2020 case per right.",
    sections: [
      {
        heading: "Why this topic is a perfect demo",
        paragraphs: [
          "Human Rights under the HRA 1998 is on the GCSE Citizenship Studies specification, the A-level Law specification, A-level Politics, and most PSHE 'rights and responsibilities' schemes of work. It's also genuinely difficult to teach well: students struggle to remember 16 rights, to distinguish absolute from qualified rights, and to connect abstract Articles to concrete cases.",
          "Mind-mapping fixes all three of those problems at once. Each right gets a fixed spatial position so students recall it by location. Absolute vs qualified rights get colour-coded so the distinction becomes pre-attentive. And every Article carries a one-click resource — usually a landmark case PDF — so the abstract becomes concrete with no friction.",
          "This lesson walks through the actual map. You can copy the structure exactly, or adapt it to your students' level (GCSE-light to A-level-heavy).",
        ],
      },
      {
        heading: "The central question",
        paragraphs: [
          "Following the rule from Lesson 2 — a question, not a noun — put this at the centre of the map:",
          "**'Whose human rights does the HRA 1998 actually protect, and against whom?'**",
          "This framing forces students to remember two non-obvious facts: that the rights belong to *everyone in the UK* (not just citizens), and that they protect against *public authorities* specifically — not other private individuals. Both points are easy to test and frequently confused.",
        ],
      },
      {
        heading: "The eleven main branches",
        paragraphs: [
          "Each first-level branch is one of the rights protected by the Act. Use two colour groups: blue for **absolute rights** (the state can never restrict them, even in war or emergency) and amber for **qualified rights** (which can be restricted in narrow, lawful, proportionate circumstances). The visual contrast does the teaching work — students see absolute vs qualified at a glance and never confuse them.",
          "**Article 2 — Right to life (absolute).** Sub-nodes: 'state must investigate deaths in custody', 'right not to be killed unlawfully by the state', 'protection extends to known threats to life'. Landmark case: *Osman v UK (1998)* — duty to act on credible threats.",
          "**Article 3 — Freedom from torture, inhuman or degrading treatment (absolute).** Sub-nodes: 'no derogation, even in wartime', 'covers inhuman or degrading treatment, not only torture', 'applies in care, detention and immigration settings'. Landmark case: *Ireland v UK (1978)* — the 'five techniques'.",
          "**Article 5 — Right to liberty and security (qualified).** Sub-nodes: 'arrest only on reasonable suspicion', 'right to be told why you're arrested', 'right to a prompt hearing', 'compensation for unlawful detention'. Landmark case: *A & Others v Home Secretary (2004)* — indefinite detention of foreign terror suspects ruled unlawful.",
          "**Article 6 — Right to a fair trial (qualified).** Sub-nodes: 'public hearing', 'independent court', 'presumption of innocence', 'right to legal representation', 'reasonable time'. Landmark case: *Saunders v UK (1996)* — self-incrimination.",
          "**Article 8 — Respect for private and family life (qualified).** Sub-nodes: 'privacy', 'home', 'correspondence', 'family life'. Most-litigated Article in the UK. Landmark case: *Campbell v MGN (2004)* — celebrity privacy and the press.",
          "**Article 9 — Freedom of thought, belief and religion (qualified for manifestation, absolute for the belief itself).** Sub-nodes: 'right to hold a belief = absolute', 'right to manifest a belief = qualified', 'no compulsion to adopt a religion'. Landmark case: *R (Williamson) v SS for Education (2005)* — corporal punishment in religious schools.",
          "**Article 10 — Freedom of expression (qualified).** Sub-nodes: 'extends to offensive ideas', 'press freedom', 'restrictions must be proportionate', 'higher protection for political speech'. Landmark case: *Handyside v UK (1976)* — 'expression covers ideas that offend, shock or disturb'.",
          "**Article 11 — Freedom of assembly and association (qualified).** Sub-nodes: 'peaceful protest', 'right to join a union', 'right to NOT join'. Landmark case: *DPP v Ziegler (2021)* — proportionality test for obstruction-of-highway protests.",
          "**Article 12 — Right to marry (qualified).** Sub-nodes: 'right to marry someone of the opposite or same sex', 'state may regulate the formalities', 'right to found a family'. Landmark case: *Goodwin v UK (2002)* — recognition of acquired gender.",
          "**Article 14 — Protection from discrimination (modifier, not standalone).** Sub-nodes: 'only operates in conjunction with another Article', 'covers sex, race, religion, language, political opinion, national or social origin, association with a minority, property, birth, or other status'. Landmark case: *Ghaidan v Godin-Mendoza (2004)* — same-sex partner tenancy rights.",
          "**Protocol 1, Article 1 — Protection of property (qualified).** Sub-nodes: 'peaceful enjoyment', 'state can interfere only in the public interest', 'compensation usually required'. Landmark case: *James v UK (1986)* — leasehold reform.",
          "Optional further branches for A-level depth: Article 4 (slavery, absolute), Article 7 (no retrospective punishment), Protocol 1 Article 2 (education), Protocol 1 Article 3 (free elections), Protocol 13 (abolition of the death penalty in all circumstances). These bring the count to the full sixteen rights students sometimes see cited.",
        ],
      },
      {
        heading: "One-click resources — what to attach (★ Lesson 3 in action)",
        paragraphs: [
          "Every Article-level node should carry at least one resource. Here's a tested set, all free to attach:",
          "**The Act itself** — link the central question node to the [Human Rights Act 1998 on legislation.gov.uk](https://www.legislation.gov.uk/ukpga/1998/42/contents). Authoritative, free, no paywall.",
          "**Plain-English explainer** — Liberty's [Human Rights Explained guide](https://www.libertyhumanrights.org.uk/issue/human-rights-act/) is the best plain-English overview for GCSE. Attach a PDF copy to the central node.",
          "**BBC Bitesize** — for GCSE Citizenship, the [Bitesize Human Rights revision page](https://www.bbc.co.uk/bitesize/topics/zw7gk2p) is paste-perfect for the 'further reading' badge.",
          "**Landmark cases** — for each Article, attach the case PDF (judgment) or a 2-3 page case summary. The Liberty 'Library' and the European Court of Human Rights (HUDOC) database both host free, redistributable summaries. Drop the PDF on the Article node and students click once to read.",
          "**Video walk-throughs** — search for 'Article 8 ECHR' (or similar) on YouTube; the Liberty channel and the LawTeacher channel both have 4-6 minute explainers per Article. Paste the URL on the node and Marvex's inline player handles the rest — students watch without leaving the map.",
          "**Equality and Human Rights Commission (EHRC)** — the EHRC has free, classroom-ready briefings on every Article. Their [resources hub](https://www.equalityhumanrights.com/en/human-rights/human-rights-act) is the right link for the 'official body' node off the central question.",
        ],
      },
      {
        heading: "Map → Timeline: a 6-week delivery plan (★ Lesson 4 in action)",
        paragraphs: [
          "From the finished map, generate a timeline (Studio → New Timeline from this map). Schedule the rights across six weeks the way most teachers do for a half-term Citizenship or Law block:",
          "**Week 1** — Introduction + Article 2 (life) + Article 3 (torture). Why these are absolute and what 'absolute' means. Discussion: should anything be absolute?",
          "**Week 2** — Article 5 (liberty) + Article 6 (fair trial). Connect to UK criminal procedure — police caution, custody time limits, jury trial.",
          "**Week 3** — Article 8 (private life) + Article 14 (discrimination). The 'modifier' Article 14 only makes sense paired with another, so teach it alongside Article 8 where it most often arises.",
          "**Week 4** — Articles 9, 10, 11 (thought/expression/assembly). The 'freedoms' cluster. Big debates: hate speech, protest law, religious symbols at school.",
          "**Week 5** — Article 12 (marry) + Protocol 1 Article 1 (property). Quieter Articles but important for evidencing the breadth of the Act.",
          "**Week 6** — Synthesis: public bodies, derogation, the European Convention vs the Act, and the proposed Bill of Rights debate. End with the extension assessment (next section).",
          "Save this timeline. Share it with students at the start of the half-term as a roadmap, share it again at the end as a revision scaffold.",
        ],
      },
      {
        heading: "Assessment: students extend the map (★ Lesson 5 in action)",
        paragraphs: [
          "Following the technique from Lesson 5, ask each student to **add one post-2020 case to any three Articles** of their choice. They must (a) name the case, (b) summarise the rights issue in one sentence, (c) attach a source (Liberty article, BBC News piece, judgment PDF) to the new node.",
          "This is a stiff assessment in a small package. It tests engagement with primary sources, current-affairs awareness (cases must be recent), case-summary skill (one-sentence digest of a judgment), and judgement (was the case actually a Human Rights Act case?).",
          "Mark by diffing each student's map against your original. Marvex's 'Compare with original' button highlights the three new nodes; you check the source, the summary, and the categorisation. ~5 minutes per student.",
          "Common student additions you should expect: *DPP v Ziegler* (2021, Article 11), *Begum* (2021, Article 8 — though arguably not HRA-bound), *Re P* (Northern Ireland abortion cases), various COVID-lockdown challenges, and HMP-prisoner-voting cases. Be ready to push back when a case is not actually an HRA case — that's the most common substantive error.",
        ],
      },
      {
        heading: "Where to take it next",
        paragraphs: [
          "For A-level Politics, extend the map with a sub-branch on **the Bill of Rights debate** — the Conservative proposals (2022-2024), the Labour position, and the broader 'should we leave the ECHR?' question. Each becomes its own node with a resource attached.",
          "For A-level Law, link this map to a sister map on **judicial review** — most HRA challenges come via judicial review, and the procedural mechanics are usually taught separately even though they're inseparable in practice.",
          "For GCSE Citizenship, link to the **child-specific rights map** (United Nations Convention on the Rights of the Child) — the UNCRC sits alongside the HRA and is the more commonly-tested instrument for under-18 protection. A separate map keeps each topic clean while the linking node connects them.",
        ],
      },
    ],
    next: null,
    faq: [
      {
        q: "Can I download or share this Human Rights map directly without rebuilding it?",
        a: "Yes — Marvex Studio ships with a 'UK Human Rights Act (teacher template)' under New map → Templates. It contains the eleven-branch structure described above with placeholder resource nodes, ready for you to attach your preferred PDFs and videos. Edit one node, share the whole map with your students.",
      },
      {
        q: "Is this map suitable for primary school?",
        a: "The full eleven-branch structure is too dense for under-11s. For primary, use a simplified four-branch version: 'Safety' (Articles 2, 3, 5), 'Fairness' (Articles 6, 14), 'Freedoms' (Articles 9, 10, 11) and 'Privacy and Family' (Articles 8, 12). Each branch carries a one-sentence definition and one age-appropriate example. Save it as a separate template.",
      },
      {
        q: "How do I keep the cases up-to-date year on year?",
        a: "Mark each landmark-case node with the case year in its label, e.g. 'Osman v UK (1998)'. Each summer, scan the most recent term's Supreme Court and ECHR judgments via the [BAILII free-text search](https://www.bailii.org/) and add any landmark rulings as new nodes off the relevant Article. Most years there are 2-4 substantial additions to make. Takes ~30 minutes once a year and keeps the map fresh.",
      },
      {
        q: "Where does Article 4 (slavery) and Article 7 (no retrospective punishment) sit in the map?",
        a: "Both are valid Articles of the Act, just less frequently taught at GCSE/A-level. Add them as supplementary branches off the central question once the main eleven are taught, ideally during the Week 6 synthesis session. Articles 4 and 7 are particularly useful for stretching the strongest students — Article 7 in particular sparks excellent debates about *ex post facto* law.",
      },
    ],
  },
];

export const LESSON_BY_SLUG = Object.fromEntries(LESSONS.map((l) => [l.slug, l]));
