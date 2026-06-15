#!/usr/bin/env node
/**
 * scripts/build/inject-series-header.mjs
 *
 * For every article that belongs to a series defined in
 * `content/02-Series/*.md`, inject a slim header strip at the top of
 * the article body:
 *
 *     ┌────────────────────────────────────────────────────┐
 *     │ Part of  APIs & Networking    Step 3 of 5  ←→ Index │
 *     └────────────────────────────────────────────────────┘
 *
 * Why a separate injector from inject-prev-next-related:
 *   - prev/next-related lives at the END of the article (footer).
 *   - This is the "where am I in this series" header — readers should
 *     see it BEFORE reading, not after.
 *   - The footer strip is the "where do I go next" navigation; the
 *     header strip is the "what am I in the middle of" wayfinding.
 *
 * Insertion point: immediately AFTER the opening <article …> tag and
 * before its first child block. Idempotent via id="fpe-series-header".
 *
 * Reads the same series-membership data structure that
 * inject-prev-next-related.mjs builds from
 * `content/02-Series/*.md` "Read in order" lists. Duplicated here
 * (rather than imported) to keep each build step independently
 * runnable.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const CONTENT_DIR = path.join(SITE_ROOT, "content")
const SERIES_DIR = path.join(CONTENT_DIR, "02-Series")
const CONTENT_INDEX = path.join(PUBLIC_DIR, "static", "contentIndex.json")

const BASE_PATH = "/firstprinciplesengineering"
const MARKER = 'id="fpe-series-header"'

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/,
  /^tags(\/|$)/,
  /^02-series\//,
  /^03-roadmaps\//,
]

const ARTICLE_OPEN_RE = /(<article\b[^>]*>)/i

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function loadContentIndex() {
  try {
    const raw = await fs.readFile(CONTENT_INDEX, "utf8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function buildBasenameIndex(contentIndex) {
  const map = new Map()
  for (const slug of Object.keys(contentIndex)) {
    const base = slug.split("/").pop()
    if (!map.has(base)) map.set(base, [])
    map.get(base).push(slug)
  }
  return map
}

async function loadSeries(contentIndex) {
  const byArticle = new Map()
  let files
  try {
    files = await fs.readdir(SERIES_DIR)
  } catch {
    return byArticle
  }
  const basenameIdx = buildBasenameIndex(contentIndex)
  for (const f of files) {
    if (!f.endsWith(".md")) continue
    const abs = path.join(SERIES_DIR, f)
    const raw = await fs.readFile(abs, "utf8")
    const seriesPageSlug = `02-series/${f.replace(/\.md$/i, "")}`
    const titleMatch = raw.match(/^title:\s*["']?([^"'\n]+)["']?/m)
    const title = titleMatch ? titleMatch[1].trim() : seriesPageSlug
    // Parse "## Read in order" block via index-based slicing (no \Z in JS regex)
    const lower = raw.toLowerCase()
    const startIdx = lower.search(/##\s*read in order/im)
    if (startIdx < 0) continue
    let endIdx = raw.indexOf("\n## ", startIdx + 1)
    if (endIdx < 0) endIdx = raw.length
    const block = raw.slice(startIdx, endIdx)
    const itemRe = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g
    const ordered = []
    let m
    while ((m = itemRe.exec(block)) !== null) {
      const target = m[1].trim()
      // Resolve by basename match
      const base = target.toLowerCase()
      let slug = null
      const hits = basenameIdx.get(base)
      if (hits && hits.length > 0) slug = hits[0]
      if (!slug) {
        for (const s of Object.keys(contentIndex)) {
          if (s.toLowerCase().endsWith("/" + base)) {
            slug = s
            break
          }
        }
      }
      if (slug) ordered.push(slug)
    }
    if (ordered.length === 0) continue
    ordered.forEach((s, i) => {
      byArticle.set(s, {
        seriesSlug: seriesPageSlug,
        seriesTitle: title,
        position: i + 1,
        total: ordered.length,
      })
    })
  }
  return byArticle
}

function renderHeader(meta) {
  const { seriesSlug, seriesTitle, position, total } = meta
  const href = `${BASE_PATH}/${seriesSlug}`
  return [
    `<div ${MARKER} class="fpe-series-header" role="navigation" aria-label="Series wayfinding">`,
    `  <span class="fpe-series-header-eyebrow">Part of</span>`,
    `  <a class="fpe-series-header-link" href="${escapeHtml(href)}">${escapeHtml(seriesTitle)}</a>`,
    `  <span class="fpe-series-header-sep" aria-hidden="true">·</span>`,
    `  <span class="fpe-series-header-pos">Step ${position} of ${total}</span>`,
    `</div>`,
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
  return rel.replace(/\.html$/, "").split(path.sep).join("/").toLowerCase()
}

async function inject(abs, slug, byArticle) {
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return { skipped: "filter" }
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
  if (!ARTICLE_OPEN_RE.test(html)) return { skipped: "no-article" }
  const meta = byArticle.get(slug)
  if (!meta) return { skipped: "not-in-series" }
  const header = renderHeader(meta)
  const next = html.replace(ARTICLE_OPEN_RE, `$1\n${header}`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true }
}

async function main() {
  const contentIndex = await loadContentIndex()
  const byArticle = await loadSeries(contentIndex)
  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    const r = await inject(abs, slug, byArticle)
    if (r.injected) injected++
    else skipped++
  }
  console.log(
    `inject-series-header: injected into ${injected} article(s); skipped ${skipped}.`,
  )
}

main().catch((e) => {
  console.error("inject-series-header failed:", e)
  process.exit(1)
})
