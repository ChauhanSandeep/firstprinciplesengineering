#!/usr/bin/env node
/**
 * scripts/build/inject-engagement.mjs
 *
 * Post-build step: mounts the Supabase-backed reader-engagement widget
 * (like button, mark-as-read, inline comments, Google / email sign-in) on
 * every article page in `public/`. Configuration lives in
 * `engagement.config.mjs` at the repo root — until its `enabled: true`
 * flag flips and the Supabase URL + anon key are real, this script logs
 * "disabled" and exits without touching any file (same contract as
 * inject-analytics).
 *
 * For each qualifying article page it injects, right after the Phase-3
 * `<aside id="fpe-prev-next-related">` (falling back to before
 * `</article>`):
 *
 *   <section id="fpe-engage" class="fpe-engage" data-fpe-engage></section>
 *   <script>window.__FPE_ENGAGEMENT__ = { …per-page config… }</script>
 *   <script type="module" src="/_static/engagement.js" defer></script>
 *
 * The heavy lifting (auth, likes, comments, read state) is in the shared
 * static module content/_static/engagement.js → /_static/engagement.js,
 * so per-page HTML stays tiny and the module is cached across pages. No
 * article body is read or transmitted — the widget is keyed only by slug.
 *
 * Skipped: home, about, 404, and all list/tag/index pages — engagement
 * belongs on the article you just read, not on a listing.
 *
 * Idempotent: re-runs detect `id="fpe-engage"` and skip.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import config from "../../engagement.config.mjs"
import { readSiteUrlConfig } from "./site-url.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const MARKER = `id="fpe-engage"`

const SKIP_SLUG_RE = [/^index$/, /^about$/, /^account$/, /^404$/, /\/index$/, /^tags(\/|$)/]

const PREV_NEXT_END_RE = /(<\/aside>\s*)(?=(?:<[^>]+>\s*)*<\/article>|<\/article>)/i
const ARTICLE_END_RE = /(<\/article>)/i

function readTitleFromHtml(html) {
  const m = html.match(/<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  return (
    m[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || null
  )
}

// JSON destined for an inline <script>; escape the sequences that could
// break out of the element or be mangled by the HTML parser.
function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

function renderBlock({ slug, title, basePath }) {
  const cfg = {
    slug,
    title: title || slug,
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    features: config.features || {},
    auth: config.auth || {},
    comments: config.comments || {},
    accountHref: `${basePath || ""}/account`,
  }
  const moduleSrc = `${basePath || ""}/_static/engagement.js`
  return [
    `<section ${MARKER} class="fpe-engage" data-fpe-engage aria-label="Reader engagement">`,
    `  <noscript>Enable JavaScript to like, comment, and track your reading.</noscript>`,
    `</section>`,
    `<script>window.__FPE_ENGAGEMENT__=${safeJson(cfg)};</script>`,
    `<script type="module" src="${moduleSrc}" defer></script>`,
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

function slugFromHtml(abs) {
  const rel = path.relative(PUBLIC_DIR, abs)
  return rel
    .replace(/\.html$/, "")
    .split(path.sep)
    .join("/")
    .toLowerCase()
}

async function inject(abs, slug, siteUrlConfig) {
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return { skipped: "filter" }
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
  const block = renderBlock({
    slug,
    title: readTitleFromHtml(html),
    basePath: siteUrlConfig.basePath,
  })
  let next
  if (PREV_NEXT_END_RE.test(html)) {
    next = html.replace(PREV_NEXT_END_RE, `$1\n${block}\n`)
  } else if (ARTICLE_END_RE.test(html)) {
    next = html.replace(ARTICLE_END_RE, `${block}\n$1`)
  } else {
    return { skipped: "no-anchor" }
  }
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true }
}

async function main() {
  if (!config.enabled) {
    console.log("inject-engagement: disabled in engagement.config.mjs; skipping.")
    return
  }
  if (
    !config.supabaseUrl ||
    config.supabaseUrl === "REPLACE_ME" ||
    !config.supabaseAnonKey ||
    config.supabaseAnonKey === "REPLACE_ME"
  ) {
    console.log(
      "inject-engagement: supabaseUrl/supabaseAnonKey unset or REPLACE_ME in " +
        "engagement.config.mjs; skipping (see the file header for setup).",
    )
    return
  }

  const siteUrlConfig = await readSiteUrlConfig()
  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    const r = await inject(abs, slug, siteUrlConfig)
    if (r.injected) injected++
    else skipped++
  }
  console.log(`inject-engagement: injected into ${injected} article(s); skipped ${skipped}.`)
}

main().catch((e) => {
  console.error("inject-engagement failed:", e)
  process.exit(1)
})
