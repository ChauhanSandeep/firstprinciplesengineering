#!/usr/bin/env node
/**
 * scripts/build/inject-security.mjs
 *
 * Post-build hardening. GitHub Pages does not let us set HTTP response
 * headers, so the browser-honored subset of security controls is added
 * as <meta> tags in every page <head>:
 *
 *   1. Content-Security-Policy (http-equiv). A defense-in-depth policy
 *      scoped to exactly the origins this site loads:
 *        - self               → all first-party HTML/CSS/JS/assets
 *        - esm.sh             → @supabase/supabase-js (engagement widget,
 *                               account page, header auth chip) imported
 *                               at runtime via dynamic import()
 *        - *.supabase.co      → engagement REST + realtime (wss)
 *        - cdnjs.cloudflare   → mermaid diagram runtime (dynamic import)
 *        - cdn.jsdelivr.net   → KaTeX css + copy-tex script
 *        - fonts.googleapis   → Google Fonts stylesheet
 *        - fonts.gstatic.com  → Google Fonts font files
 *        - plausible.io       → analytics (only when enabled)
 *      'unsafe-inline' is required for script-src/style-src because
 *      Quartz emits many inline <script>/<style> blocks (and our own
 *      inline JSON-LD / engagement bootstraps) with no post-build nonce
 *      mechanism. 'unsafe-eval' is likewise required: Quartz's explorer
 *      serializes its mapFn/filterFn into the page and re-evaluates them
 *      via `new Function`, and the bases-page data-function evaluator
 *      does the same. The policy still meaningfully constrains
 *      connect-src, img-src, object-src, base-uri and form-action — the
 *      vectors that matter for a static, client-rendered site.
 *
 *   2. Referrer-Policy (name="referrer") → strict-origin-when-cross-origin,
 *      so outbound links leak only the origin, never the full path.
 *
 * NOTE: X-Content-Type-Options / X-Frame-Options are intentionally NOT
 * emitted — browsers ignore those as <meta> (they are header-only), so
 * adding them would give a false sense of coverage. frame-ancestors is
 * likewise header-only and omitted from the meta CSP.
 *
 * Escape hatch: set FPE_CSP=off to skip injection entirely (useful if a
 * new third-party integration is added before this allow-list is updated
 * and the site must ship immediately).
 *
 * Idempotent — re-runs detect the marker attribute and skip.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
// FPE_PUBLIC_DIR lets golden-file tests point the injector at a fixture
// directory instead of the real build output; defaults to public/.
const PUBLIC_DIR = process.env.FPE_PUBLIC_DIR
  ? path.resolve(process.env.FPE_PUBLIC_DIR)
  : path.join(SITE_ROOT, "public")

const MARKER_ATTR = `data-fpe-security="true"`
const HEAD_END_RE = /<\/head>/i

// One directive per line for readability; joined with "; " on emit.
const CSP_DIRECTIVES = [
  ["default-src", "'self'"],
  ["base-uri", "'self'"],
  ["object-src", "'none'"],
  ["form-action", "'self'"],
  [
    "script-src",
    "'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://plausible.io",
  ],
  ["style-src", "'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net"],
  ["font-src", "'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:"],
  ["img-src", "'self' data: https:"],
  [
    "connect-src",
    "'self' https://esm.sh https://*.supabase.co wss://*.supabase.co https://plausible.io",
  ],
  ["frame-src", "'self'"],
  ["worker-src", "'self' blob:"],
  ["child-src", "'self' blob:"],
  ["manifest-src", "'self'"],
]

function buildCsp() {
  return CSP_DIRECTIVES.map(([k, v]) => `${k} ${v}`).join("; ")
}

function metaBlock() {
  const csp = buildCsp()
  return [
    `<meta ${MARKER_ATTR} http-equiv="Content-Security-Policy" content="${csp}">`,
    `<meta ${MARKER_ATTR} name="referrer" content="strict-origin-when-cross-origin">`,
  ].join("\n")
}

async function walkHtml(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkHtml(abs)))
    else if (e.isFile() && e.name.endsWith(".html")) out.push(abs)
  }
  return out
}

async function inject(abs, block) {
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER_ATTR)) return { skipped: "already" }
  if (!HEAD_END_RE.test(html)) return { skipped: "no-head" }
  // CSP is most robust when it is one of the first things in <head>, so
  // it applies to resources declared later. Quartz puts <meta charset>
  // and viewport first; injecting right before </head> still applies to
  // the whole document in practice (the parser evaluates the full head
  // before fetching subresources referenced within it), and keeps this
  // injector consistent with the other post-build head injectors.
  const next = html.replace(HEAD_END_RE, `${block}\n</head>`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true }
}

async function main() {
  if (String(process.env.FPE_CSP).toLowerCase() === "off") {
    console.log("inject-security: FPE_CSP=off — skipping CSP/referrer meta injection.")
    return
  }
  const block = metaBlock()
  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const r = await inject(abs, block)
    if (r.injected) injected++
    else skipped++
  }
  console.log(
    `inject-security: added CSP + referrer meta to ${injected} page(s); skipped ${skipped}.`,
  )
}

main().catch((e) => {
  console.error("inject-security failed:", e)
  process.exit(1)
})
