/**
 * comments.config.mjs
 *
 * Configuration for the Giscus comments mount used by
 * scripts/build/inject-comments.mjs.
 *
 * Status — placeholder. To enable comments on the live site:
 *
 *   1. In the GitHub repo, enable Discussions:
 *      Settings → General → Features → Discussions ✓
 *   2. Create a Discussion category named "Comments"
 *      (any type — "General" or "Announcement" works).
 *   3. Install the Giscus GitHub App on the repo:
 *      https://github.com/apps/giscus
 *   4. Visit https://giscus.app, paste the repo (chauhansandeep/
 *      firstprinciplesengineering), select the category, and copy
 *      the four IDs the configurator emits.
 *   5. Replace the four placeholder values below.
 *   6. Set `enabled: true`.
 *
 * Until the values are real, scripts/build/inject-comments.mjs logs
 * "comments disabled" and exits zero — the build is unaffected.
 */

export default {
  // Flip to true after the IDs below are real values.
  enabled: true,

  // Rendering mode:
  //   "discuss-cta"  — zero-friction CTA: LinkedIn DM / email / GitHub
  //                    repo link. No reader account required. Best for
  //                    early-stage blogs where the visitor login flow
  //                    of Giscus / utterances kills participation.
  //   "giscus"       — full Giscus threaded comments. Requires GitHub
  //                    login to post. All `repo*`, `category*`, theme,
  //                    mapping fields below are used in this mode.
  //   "off"          — inject nothing.
  // Toggle this string to swap between modes without losing the other
  // mode's config.
  mode: "discuss-cta",

  // ---- discuss-cta mode ---------------------------------------------------
  // These are surfaced as the three buttons in the CTA. Drop one by
  // setting its value to null/undefined.
  discuss: {
    linkedinUrl: "https://www.linkedin.com/in/sandeepcode/",
    email: "engineeringfromfirstprinciples@gmail.com",
    githubRepo: "chauhansandeep/firstprinciplesengineering",
  },

  // ---- giscus mode --------------------------------------------------------
  // GitHub repo to host Discussions (must already exist).
  repo: "ChauhanSandeep/firstprinciplesengineering",

  // Numeric repo ID — emitted by giscus.app after you select the repo.
  // Format: "R_kgDOXXXXXXX"
  repoId: "R_kgDOS2EPxA",

  // Discussion category name and ID.
  category: "Announcements",
  // Format: "DIC_kwDOXXXXXXX"
  categoryId: "DIC_kwDOS2EPxM4C_OKT",

  // Page ↔ Discussion mapping strategy.
  //   "pathname" — Giscus matches by URL pathname (recommended for sites
  //                with stable URLs). Each article gets its own thread.
  mapping: "pathname",

  // Strict matching: 1 = require an exact pathname match.
  strict: "1",

  // Reactions on the parent thread.
  reactionsEnabled: "1",

  // Don't fetch meta info from this site.
  emitMetadata: "0",

  // "top" or "bottom" — where the input box renders relative to the
  // existing thread.
  inputPosition: "bottom",

  // Theme name — "preferred_color_scheme" makes Giscus follow the
  // OS dark mode. On dark-mode toggles we also post a message to the
  // iframe (handled in the bootstrap snippet that the injector emits)
  // so the change is instant.
  theme: "preferred_color_scheme",

  // Lazy load — Giscus iframe is only fetched when scrolled near.
  loading: "lazy",
}
