/**
 * UK Human Rights teaching template — the worked map described in
 * lesson 6 of the "Effective teaching with mind maps" mini-course.
 *
 * Distributed via:
 *   1. Download button on the lesson 6 page (`/mini-course/.../lesson/
 *      worked-example-uk-human-rights`).  Clicking it generates a
 *      `.mmap` binary in the browser and triggers a download.  Users
 *      drag the file onto Studio's canvas (or File → Open) to import.
 *   2. Future: pre-bundled as a built-in template in Studio's "New
 *      map → Templates" menu when that UI lands.
 *
 * Editorial notes:
 *   • Branch colours: blue (`#22d3ee`-ish) for absolute rights, amber
 *     (`#fbbf24`-ish) for qualified, fuchsia for the central Article
 *     14 modifier.  Marvex's render layer reads `fill` if present.
 *   • Landmark cases sit as second-level nodes under each Article and
 *     reference the case + year + court so teachers can drop the case
 *     PDF onto them later.
 *   • Resource link slots are stubbed with the canonical free
 *     authority for each Article — teachers replace these with their
 *     own preferred resources but the defaults are all classroom-safe
 *     (legislation.gov.uk, Liberty, EHRC).
 *   • Every node has a `summary` that doubles as the teacher's
 *     speaking-note when the map is presented in class — visible in
 *     the Studio summary panel without cluttering the canvas itself.
 */
const node = (id, title, opts = {}) => ({
  id,
  title,
  shape: opts.shape || "rect",
  summary: opts.summary || "",
  ...(opts.fill ? { fill: opts.fill } : {}),
  ...(opts.link ? { link: opts.link } : {}),
  children: opts.children || [],
});

// Colour palette aligned with the cosmic theme but readable on the
// printed/exported map too.  These are vetted for AA-contrast on
// Marvex's default dark canvas.
const ABSOLUTE  = "#67e8f9"; // cyan — absolute rights
const QUALIFIED = "#fbbf24"; // amber — qualified rights
const MODIFIER  = "#e879f9"; // fuchsia — Article 14 (modifier)
const PROPERTY  = "#a3e635"; // lime — Protocol 1 (property/economic)

export const UK_HUMAN_RIGHTS_TEMPLATE = {
  id: "tpl-uk-human-rights-act-1998",
  title: "UK Human Rights Act 1998 — Teaching map",
  summary:
    "Worked example from the Marvex mini-course (lesson 6). Central question forces students to remember scope (everyone in UK) and target (public authorities). Eleven main branches colour-coded by category: cyan = absolute rights, amber = qualified, fuchsia = modifier (Article 14), lime = property/economic (Protocol 1).",
  shape: "rect",
  children: [
    // ─── Article 2 — Life (absolute) ─────────────────────────────────
    node("a2", "Article 2 — Right to life", {
      fill: ABSOLUTE,
      summary: "Absolute right. State must investigate any death in custody or unlawful killing. Extends to known credible threats to life (positive obligation).",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/2",
      children: [
        node("a2-1", "State investigation duty (Article 2 procedural)", {
          summary: "Where the state may be responsible for a death, an independent investigation is required.",
        }),
        node("a2-2", "Positive obligation on known threats", {
          summary: "State must take operational steps where there is a real and immediate risk to life it knew or should have known about.",
        }),
        node("a2-3", "Landmark case: Osman v UK (1998)", {
          summary: "ECHR established the duty to act on credible threats. School/police failed to protect family from known stalker.",
        }),
      ],
    }),

    // ─── Article 3 — Torture (absolute) ──────────────────────────────
    node("a3", "Article 3 — Freedom from torture, inhuman or degrading treatment", {
      fill: ABSOLUTE,
      summary: "Absolute. No derogation, even in wartime. Covers a spectrum: torture > inhuman > degrading treatment.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/3",
      children: [
        node("a3-1", "Three-tier severity: torture / inhuman / degrading", {
          summary: "Severity determines which limb engages, but all three are absolutely prohibited.",
        }),
        node("a3-2", "Applies in care, detention, immigration settings", {
          summary: "Common UK contexts: prison conditions, immigration removal to risk countries, NHS-care neglect.",
        }),
        node("a3-3", "Landmark case: Ireland v UK (1978)", {
          summary: "The 'five techniques' — wall-standing, hooding, noise, sleep + food deprivation — held to be inhuman and degrading.",
        }),
      ],
    }),

    // ─── Article 5 — Liberty (qualified) ─────────────────────────────
    node("a5", "Article 5 — Right to liberty and security", {
      fill: QUALIFIED,
      summary: "Qualified. Detention only on six enumerated grounds (conviction, arrest on suspicion, etc). Robust procedural protections.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/5",
      children: [
        node("a5-1", "Arrest on reasonable suspicion only", {}),
        node("a5-2", "Right to be told why you are arrested", {}),
        node("a5-3", "Prompt judicial hearing", {}),
        node("a5-4", "Compensation for unlawful detention", {}),
        node("a5-5", "Landmark case: A & Others v Home Secretary (2004)", {
          summary: "Indefinite detention of foreign terror suspects under ATCSA 2001 ruled incompatible with Article 5.",
        }),
      ],
    }),

    // ─── Article 6 — Fair trial (qualified) ──────────────────────────
    node("a6", "Article 6 — Right to a fair trial", {
      fill: QUALIFIED,
      summary: "Qualified for criminal, civil and disciplinary proceedings. Public hearing, independent tribunal, presumption of innocence, legal representation, reasonable time.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/6",
      children: [
        node("a6-1", "Public hearing + independent tribunal", {}),
        node("a6-2", "Presumption of innocence", {}),
        node("a6-3", "Legal representation + adequate prep time", {}),
        node("a6-4", "Decision in reasonable time", {}),
        node("a6-5", "Landmark case: Saunders v UK (1996)", {
          summary: "Use of compelled witness testimony at trial breached the right against self-incrimination.",
        }),
      ],
    }),

    // ─── Article 8 — Private life (qualified) ────────────────────────
    node("a8", "Article 8 — Respect for private and family life", {
      fill: QUALIFIED,
      summary: "Most-litigated Article in the UK. Four protected interests: private life, family life, home, correspondence. Interference must be lawful, in pursuit of a legitimate aim, and proportionate.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/8",
      children: [
        node("a8-1", "Private life — bodily integrity, sexuality, data", {}),
        node("a8-2", "Family life — non-traditional families included", {}),
        node("a8-3", "Home — broader than property ownership", {}),
        node("a8-4", "Correspondence — phone calls, emails, letters", {}),
        node("a8-5", "Landmark case: Campbell v MGN (2004)", {
          summary: "Naomi Campbell vs Mirror Group: photographs of NA meetings were a breach of confidence and Article 8.",
        }),
      ],
    }),

    // ─── Article 9 — Religion (mixed) ────────────────────────────────
    node("a9", "Article 9 — Freedom of thought, belief and religion", {
      fill: ABSOLUTE,
      summary: "Holding a belief = absolute. Manifesting it = qualified. Schools, workplaces, prisons all routinely engage Article 9.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/9",
      children: [
        node("a9-1", "Holding a belief — absolute", {}),
        node("a9-2", "Manifesting a belief — qualified", {}),
        node("a9-3", "No compulsion to adopt a religion", {}),
        node("a9-4", "Landmark case: R (Williamson) v SS for Education (2005)", {
          summary: "Christian parents claimed school corporal punishment ban violated Article 9 — Lords ruled the ban proportionate.",
        }),
      ],
    }),

    // ─── Article 10 — Expression (qualified) ─────────────────────────
    node("a10", "Article 10 — Freedom of expression", {
      fill: QUALIFIED,
      summary: "Qualified. Protects ideas that offend, shock or disturb (Handyside). Political speech gets the highest protection; commercial speech the lowest.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/10",
      children: [
        node("a10-1", "Covers offensive + shocking ideas (Handyside)", {}),
        node("a10-2", "Press freedom + protection of sources", {}),
        node("a10-3", "Restrictions must be proportionate", {}),
        node("a10-4", "Political speech > commercial speech", {}),
        node("a10-5", "Landmark case: Handyside v UK (1976)", {
          summary: "'The Little Red Schoolbook' obscenity prosecution. Court stated expression covers 'ideas that offend, shock or disturb'.",
        }),
      ],
    }),

    // ─── Article 11 — Assembly (qualified) ───────────────────────────
    node("a11", "Article 11 — Freedom of assembly and association", {
      fill: QUALIFIED,
      summary: "Qualified. Peaceful protest, trade union membership, right NOT to join an association. Proportionality test for obstruction-based public-order responses.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/11",
      children: [
        node("a11-1", "Peaceful protest", {}),
        node("a11-2", "Right to join (and not join) a union", {}),
        node("a11-3", "Landmark case: DPP v Ziegler (2021)", {
          summary: "Supreme Court: proportionality test must be applied to obstruction-of-highway protest convictions.",
        }),
      ],
    }),

    // ─── Article 12 — Marry (qualified) ──────────────────────────────
    node("a12", "Article 12 — Right to marry and found a family", {
      fill: QUALIFIED,
      summary: "Qualified. State may regulate formalities of marriage but not erect arbitrary bars. Marriage (Same Sex Couples) Act 2013 extended scope in UK.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/12",
      children: [
        node("a12-1", "Marry opposite or same sex (post-2013)", {}),
        node("a12-2", "State regulates formalities", {}),
        node("a12-3", "Right to found a family", {}),
        node("a12-4", "Landmark case: Goodwin v UK (2002)", {
          summary: "Trans woman's right to marry in her acquired gender — ECHR ruled UK in breach; led to Gender Recognition Act 2004.",
        }),
      ],
    }),

    // ─── Article 14 — Discrimination (modifier) ──────────────────────
    node("a14", "Article 14 — Protection from discrimination", {
      fill: MODIFIER,
      summary: "MODIFIER — not free-standing. Engages only in conjunction with another Article. Covers sex, race, religion, language, political opinion, national/social origin, association with a minority, property, birth, OR OTHER STATUS.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/I/chapter/14",
      children: [
        node("a14-1", "Modifier — pairs with another Article", {}),
        node("a14-2", "Open-ended 'other status' category", {
          summary: "The 'or other status' catch-all is what makes Article 14 doctrinally fertile — courts have read in sexual orientation, age, immigration status, etc.",
        }),
        node("a14-3", "Landmark case: Ghaidan v Godin-Mendoza (2004)", {
          summary: "Same-sex partner's tenancy succession rights read into Rent Act 1977 via s.3 HRA. Showcase Article 14 + Article 8 pairing.",
        }),
      ],
    }),

    // ─── Protocol 1, Article 1 — Property (qualified) ────────────────
    node("p1a1", "Protocol 1, Article 1 — Protection of property", {
      fill: PROPERTY,
      summary: "Qualified. Three rules: peaceful enjoyment, no deprivation without legal basis + public interest + (usually) compensation, control of use in the general interest.",
      link: "https://www.legislation.gov.uk/ukpga/1998/42/schedule/1/part/II/chapter/1",
      children: [
        node("p1a1-1", "Peaceful enjoyment", {}),
        node("p1a1-2", "Interference only in public interest + lawful", {}),
        node("p1a1-3", "Usually requires compensation", {}),
        node("p1a1-4", "Landmark case: James v UK (1986)", {
          summary: "Duke of Westminster's challenge to leasehold reform legislation — court upheld interference as proportionate.",
        }),
      ],
    }),

    // ─── Public authority obligation (foundational node) ─────────────
    node("pao", "Public authority obligation (s.6 HRA)", {
      summary: "Section 6 makes it unlawful for a public authority to act incompatibly with a Convention right. Covers courts, police, local councils, schools and any body 'exercising functions of a public nature'. Rights are enforceable against public authorities — not private individuals (vertical effect, not horizontal).",
      children: [
        node("pao-1", "Vertical effect — protects against the state", {}),
        node("pao-2", "Includes courts, police, councils, schools", {}),
        node("pao-3", "Hybrid bodies — public function test", {
          summary: "A private body 'exercising functions of a public nature' (e.g. a privately-run care home funded by the council) can be a public authority for HRA purposes.",
        }),
      ],
    }),
  ],
};
