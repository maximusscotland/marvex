/**
 * Single source of truth for legal/regulatory identifiers shown across
 * the Marvex site. When a real value lands (e.g. ICO registration after
 * the application clears in 3–10 days) update it here once and every
 * page that imports from this module — Privacy Policy, FAQ, footer —
 * picks it up automatically.
 *
 * Pattern: each value is either a confirmed identifier OR `null` /
 * `"PENDING"`. Components show a polite "registration in progress"
 * note when the value is still pending so visitors aren't left with a
 * placeholder that screams "this site is unfinished".
 */

// UK Information Commissioner's Office (ICO) — Data Protection
// (Charges and Information) Regulations 2018 fee registration.
// Application submitted 8 Feb 2026 (ref C1928205); registration number
// arrives by post / email within 3–10 working days. Update the
// `registrationNumber` field below from `null` → "ZA######" the moment
// it lands.
export const ICO = {
  applicationReference: "C1928205",
  registrationNumber: null, // <-- replace with "ZA######" once issued
  // Public verification URL where customers can check the registration
  // exists (the ICO Data Protection Public Register).
  verifyUrl: "https://ico.org.uk/ESDWebPages/Search",
  // Where users escalate complaints if they're unhappy with how Marvex
  // has handled their data — required wording for GDPR transparency.
  complaintsUrl: "https://ico.org.uk/concerns",
};

/**
 * `true` once the registration number has come through. Use this in
 * conditional copy: `{ICO.registrationNumber ? <verified /> : <pending />}`.
 */
export const ICO_REGISTERED = !!ICO.registrationNumber;

/**
 * Render-ready label for the registration row. Renders one of:
 *   "ZA123456" when issued
 *   "Application pending (ref C1928205)" while we wait
 */
export const icoLabel = () =>
  ICO.registrationNumber || `Application pending (ref ${ICO.applicationReference})`;

/**
 * Legal trading entity disclosure. Marvex Studio currently operates as
 * a UK sole trader (no Companies House registration). UK sole traders
 * are not legally required to disclose their full home address online,
 * but transparent disclosure of the trading model + a contact email
 * builds trust and satisfies the "identity of the controller" GDPR
 * Article 13(1)(a) requirement.
 *
 * If/when you incorporate as a Ltd company, swap the values below to:
 *   `legalEntity: "Marvex Ltd"`,
 *   `companiesHouseNumber: "12345678"`,
 *   `registeredOffice: "1 Example St, London, EC1A 1AA"`.
 * Every page that imports from this module picks up the change.
 */
export const ENTITY = {
  brandName: "Marvex Studio",
  domain: "marvex.app",
  legalEntity: "operated as a sole trader in the United Kingdom",
  // Companies House number — null while unincorporated.
  companiesHouseNumber: null,
  // Public-facing address. We use the ceo@ contact route rather than a
  // physical address because (a) UK sole traders trading purely online
  // can use a contact email and (b) we don't want to publish the
  // founder's home address. If you ever switch to a virtual / serviced
  // office, drop the address here and the Terms page will surface it.
  registeredOffice: null,
  contactEmail: "ceo@marvex.app",
  jurisdiction: "England & Wales",
};

/**
 * Subprocessors disclosure — required reading for GDPR-conscious
 * customers and any potential B2B buyer. Lists every third party that
 * processes personal data on Marvex's behalf, plus the purpose, the
 * data category they touch, and where they're hosted (so EU users can
 * see what crosses borders).
 *
 * BYOK AI providers (OpenAI / Anthropic / Google AI) are intentionally
 * EXCLUDED — when you use them, Marvex is not the processor. Your
 * browser sends the request directly to the provider with your own
 * API key. Marvex servers never see the request, the response, or the
 * key. The user has a direct contractual relationship with the AI
 * provider, not via us.
 */
export const SUBPROCESSORS = [
  {
    name: "Stripe",
    purpose: "Payment processing for paid plans and the Law Pack add-on",
    data: "Email, billing address, card token (we never see the card)",
    region: "Ireland (EU) / United States",
    url: "https://stripe.com/privacy",
  },
  {
    name: "Google",
    purpose: "Sign-in via OAuth (only when the user clicks 'Sign in with Google')",
    data: "Name, email, profile picture URL",
    region: "United States (with EU data centre routing)",
    url: "https://policies.google.com/privacy",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery (welcome, press codes, bug-report receipts)",
    data: "Email address, message content",
    region: "United States",
    url: "https://resend.com/legal/privacy-policy",
  },
  {
    name: "PostHog",
    purpose: "Privacy-friendly product analytics (page views, feature usage events). User-disablable via cookie banner.",
    data: "Anonymous usage events, IP address (truncated), referrer",
    region: "European Union (eu.posthog.com)",
    url: "https://posthog.com/privacy",
  },
  {
    name: "Sentry",
    purpose: "Error monitoring and crash reporting",
    data: "Stack traces, browser type, route, anonymised user id",
    region: "Germany / EU (ingest.de.sentry.io)",
    url: "https://sentry.io/privacy/",
  },
  {
    name: "MongoDB Atlas",
    purpose: "Encrypted database hosting for account, subscription, and waitlist data",
    data: "All structured account data — encrypted at rest",
    region: "European Union",
    url: "https://www.mongodb.com/legal/privacy/privacy-policy",
  },
  {
    name: "Cloudflare",
    purpose: "DNS, CDN, DDoS protection, and inbound email routing for press@/tech@/support@/ceo@marvex.app",
    data: "IP address, request metadata, email forwarding metadata",
    region: "United States (with EU edge presence)",
    url: "https://www.cloudflare.com/privacypolicy/",
  },
];

