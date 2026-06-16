#!/usr/bin/env node
/**
 * scripts/build/inject-recent.mjs
 *
 * Post-build step: rewrites the "Recent articles" placeholder in
 * `public/index.html` with the 5 most-recently-modified article pages.
 *
 * Why post-build (not at sync time)? The `created-modified-date` plugin
 * runs during the Quartz build and writes the authoritative `<time
 * datetime="...">` value into every page's header. Reading from those
 * built HTML files keeps "recent" perfectly in sync with what readers
 * actually see on each article page — no separate source of truth.
 *
 * How it works:
 *   1. Walk every *.html file under `public/`.
 *   2. Skip pages that aren't articles: home, about, tag indexes, folder
 *      indexes, series landings, the 404 page.
 *   3. Extract <time datetime="..."> + <h1>{title}</h1> + breadcrumb tail.
 *   4. Sort by datetime desc, take the first 5.
 *   5. Replace the inner content of `<div id="fpe-recent-auto-slot">…</div>`
 *      in `public/index.html` with a freshly rendered
 *      <a class="fpe-article-card"> per pick.
 *
 * The slot div lives in `content/index.md` so the file is self-documenting,
 * and HTML comments would be stripped by the markdown processor:
 *
 *   <div id="fpe-recent-auto-slot">
 *   <p class="fpe-section-empty">No recent articles yet.</p>
 *   </div>
 *
 * The fallback text inside the slot ships if the script never runs
 * (e.g. during `npx quartz build` without the wrapper); the script
 * replaces it with real cards when invoked from `npm run build`.
 *
 * Idempotent: running twice yields the same output.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const HOME_HTML = path.join(PUBLIC_DIR, "index.html")
const BASE_PATH = "/firstprinciplesengineering"
const TOP_N = 5
const SLOT_ID = "fpe-recent-auto-slot"
// Match `<div id="fpe-recent-auto-slot" …>…</div>` allowing other attrs and
// any inner content (the markdown processor may also add a class or two).
const SLOT_RE = new RegExp(
  `(<div\\b[^>]*\\bid="${SLOT_ID}"[^>]*>)([\\s\\S]*?)(</div>)`,
  "i",
)

// Skip the home, the about, the 404, and the auto-generated folder/tag
// listings (they don't carry editorial value as "recent articles" — they
// are just indexes that move every build).
const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/, // folder/series landing pages
  /^tags\//,
]

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
    if (e.isDirectory()) {
      out.push(...(await walkHtml(abs)))
    } else if (e.isFile() && e.name.endsWith(".html")) {
      out.push(abs)
    }
  }
  return out
}

function slugFromHtml(abs) {
  const rel = path.relative(PUBLIC_DIR, abs)
  return rel.replace(/\.html$/, "").split(path.sep).join("/")
}

const TIME_RE = /<time[^>]*\bdatetime="([^"]+)"/i
const H1_RE = /<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
const BREADCRUMB_RE =
  /<nav[^>]*class="[^"]*breadcrumb-container[^"]*"[\s\S]*?<\/nav>/i
const BREADCRUMB_ITEM_RE = /<a[^>]*>([^<]+)<\/a>/g
const DESC_RE = /<meta[^>]*name="description"[^>]*content="([^"]*)"/i

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function eyebrowFromBreadcrumb(html) {
  const m = html.match(BREADCRUMB_RE)
  if (!m) return ""
  const items = [...m[0].matchAll(BREADCRUMB_ITEM_RE)].map((x) =>
    stripHtml(x[1]),
  )
  // Items look like: ["Home", "01-Fundamentals", "02-Databases", "Database Internals", "MVCC"]
  // The eyebrow we want is the deepest non-leaf, prettified. Drop any
  // ordering prefix like "NN-" and turn dashes into spaces.
  const candidates = items
    .slice(1, -1) // drop "Home" and the leaf title (the leaf is also the H1)
    .map((s) => s.replace(/^\d+[-_]/, "").replace(/[-_]/g, " ").trim())
    .filter(Boolean)
  return candidates.length ? candidates[candidates.length - 1] : ""
}

async function readMeta(absHtml) {
  const slug = slugFromHtml(absHtml)
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return null
  const html = await fs.readFile(absHtml, "utf8")
  const mt = html.match(TIME_RE)
  const mh = html.match(H1_RE)
  if (!mt || !mh) return null
  const title = stripHtml(mh[1])
  if (!title) return null
  const md = html.match(DESC_RE)
  const desc = md ? md[1] : ""
  const eyebrow = eyebrowFromBreadcrumb(html)
  return {
    slug,
    title,
    eyebrow,
    desc: desc.length > 180 ? desc.slice(0, 177).trimEnd() + "…" : desc,
    iso: mt[1],
    href: `${BASE_PATH}/${slug}`,
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderCard(m) {
  return [
    `<a class="fpe-article-card fpe-recent-card" href="${escapeHtml(m.href)}">`,
    m.eyebrow
      ? `  <span class="article-eyebrow">${escapeHtml(m.eyebrow)}</span>`
      : "",
    `  <span class="article-title">${escapeHtml(m.title)}</span>`,
    m.desc
      ? `  <span class="article-desc">${escapeHtml(m.desc)}</span>`
      : "",
    `</a>`,
  ]
    .filter(Boolean)
    .join("\n")
}

async function main() {
  const homeHtml = await fs.readFile(HOME_HTML, "utf8").catch(() => null)
  if (!homeHtml) {
    console.error("inject-recent: public/index.html not found; skipping.")
    return
  }
  if (!SLOT_RE.test(homeHtml)) {
    console.log(
      `inject-recent: slot <div id="${SLOT_ID}"> not present; homepage uses the right-rail Newly Released list instead.`,
    )
    return
  }

  const all = await walkHtml(PUBLIC_DIR)
  const metas = (await Promise.all(all.map(readMeta))).filter(Boolean)
  metas.sort((a, b) => b.iso.localeCompare(a.iso))
  const picks = metas.slice(0, TOP_N)
  if (picks.length === 0) {
    console.error("inject-recent: no candidate articles found.")
    return
  }

  const inner = [
    `<div class="fpe-recent-list">`,
    ...picks.map((m) => renderCard(m)),
    `</div>`,
  ].join("\n")

  const next = homeHtml.replace(SLOT_RE, (_match, open, _body, close) =>
    `${open}\n${inner}\n${close}`,
  )
  if (next === homeHtml) {
    console.error("inject-recent: slot regex did not match — bug in script.")
    process.exit(1)
  }
  await fs.writeFile(HOME_HTML, next, "utf8")
  console.log(
    `inject-recent: wrote ${picks.length} recent cards to public/index.html`,
  )
  for (const p of picks) console.log(`  • ${p.iso}  ${p.slug}`)
}

main().catch((e) => {
  console.error("inject-recent failed:", e)
  process.exit(1)
})
