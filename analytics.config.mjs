/**
 * analytics.config.mjs
 *
 * Configuration for the Plausible analytics tag injected into every
 * page <head> by scripts/build/inject-analytics.mjs.
 *
 * Why Plausible (vs GA4, GoatCounter, Umami):
 *   - Cookieless → no consent banner required under GDPR / EPR
 *   - ~1 KB script → minimal performance cost
 *   - Lightweight UI focused on the metrics that matter
 *     (top pages, entry pages, referrers, search queries, bounce)
 *   - Honors Do-Not-Track by default
 *   - GA4 was explicitly rejected — its consent-banner burden + 35+ KB
 *     gtag.js conflicts with the "minimal, premium" feel of this site.
 *
 * Status — placeholder. To enable:
 *
 *   1. Sign up at https://plausible.io and add this domain:
 *      firstprinciplesengineering.tech
 *      (or set up self-hosted Plausible if you want $0).
 *   2. Set `enabled: true` below.
 *   3. (Optional) toggle the addOnVariants — outbound-links and
 *      file-downloads pull in two extra script bundles that record
 *      those custom events.
 *
 * Until enabled, inject-analytics logs "disabled" and exits without
 * touching any HTML — the build is unaffected.
 */

export default {
  // Flip to true once the domain is added in Plausible.
  enabled: false,

  // The site domain registered in Plausible. For self-hosted,
  // change `scriptHost` too.
  domain: "firstprinciplesengineering.tech",

  // Plausible script host. Use "https://plausible.io" for hosted,
  // your own URL for self-hosted.
  scriptHost: "https://plausible.io",

  // Which script bundle to use. Plausible publishes named bundles
  // that pre-enable specific feature sets:
  //   "script.js"                  — minimal (page views only)
  //   "script.outbound-links.js"   — + outbound link clicks
  //   "script.file-downloads.js"   — + file download clicks
  //   "script.tagged-events.js"    — + custom events via data attrs
  //   "script.hash.js"             — for hash-based routing (N/A here)
  // Combine via "script.outbound-links.tagged-events.js" style.
  scriptName: "script.outbound-links.tagged-events.js",
}
