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
