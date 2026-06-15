#!/usr/bin/env node
/**
 * scripts/build/inject-prev-next-related.mjs
 *
 * Post-build step: appends a "Continue reading" footer to every
 * article page in `public/`. The footer contains:
 *
 *   1. Series strip — if the article belongs to a Reading Series
 *      (any `02-Series/<slug>.md` file under content/), show the
 *      series name + position (e.g. "Series: APIs & Networking · 3 / 5")
 *      with prev / next links derived from the order of wikilinks in
 *      the series landing page's "Read in order" block.
 *
 *   2. Sibling prev / next — within the same parent folder, prior and
 *      next articles by NN- ordering prefix (or alphabetical if no
 *      prefix). Skips index pages.
 *
 *   3. Related articles — up to 5 distinct other articles, scored by:
 *        - same series              (+3)
 *        - same parent folder       (+2)
 *        - same grandparent folder  (+1)
 *        - target appears in this   (+1)  (backlink signal — taken
 *          page's outgoing links            from contentIndex.json)
 *      Exclude self, prev, next, and series strip.
 *
 * Insertion point: immediately AFTER the closing </article> tag and
 * BEFORE the Quartz backlinks block. Carries id="fpe-prev-next-related"
 * so the injector is idempotent.
 *
 * Source data:
 *   - `public/static/contentIndex.json` — canonical slug → {title,
 *     filePath, links, tags, content}.
 *   - `content/02-Series/*.md` — series definitions parsed at build
 *     time for series order.
 *
 * Skips:
 *   - home, about, 404
 *   - folder/series landing pages (their job is to send users INTO
 *     articles; they don't need a continuation footer)
 *   - tag pages
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
const INDEX_PATH = path.join(PUBLIC_DIR, "static", "contentIndex.json")
const BASE_PATH = "/firstprinciplesengineering"
const MAX_RELATED = 5
const MARKER = `id="fpe-prev-next-related"`

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/, // folder/series landing pages
  /^tags(\/|$)/,
]

// ---- Source-data loaders -------------------------------------------------

async function loadContentIndex() {
  const raw = await fs.readFile(INDEX_PATH, "utf8")
  return JSON.parse(raw)
}

// Parse content/02-Series/<slug>.md files for an ordered list of
// member-article slugs. The convention is a numbered list under a
// "## Read in order" heading, where each entry starts with a wikilink:
//   1. **[[Target|Display]]** — …
// Wikilinks can use either the file basename (matched against the
// content tree) or a slug. We resolve against the contentIndex.
async function loadSeries(contentIndex) {
  // Map: seriesSlug → { title, ordered: [contentIndexSlug, …] }
  const seriesBySlug = new Map()
  // Reverse: articleSlug → { seriesSlug, position (1-based), total }
  const seriesByArticle = new Map()

  let files
  try {
    files = await fs.readdir(SERIES_DIR)
  } catch {
    return { seriesBySlug, seriesByArticle }
  }

  // Build a lookup from basename (no extension, lowercase) → contentIndex slug.
  // Quartz lowercases its slugs; the wikilink target is typically the file basename.
  const basenameToSlug = new Map()
  for (const slug of Object.keys(contentIndex)) {
    const fp = contentIndex[slug].filePath || ""
    const base = path
      .basename(fp, ".md")
      .toLowerCase()
    if (base && !basenameToSlug.has(base)) basenameToSlug.set(base, slug)
  }

  for (const f of files) {
    if (!f.endsWith(".md")) continue
    const abs = path.join(SERIES_DIR, f)
    const raw = await fs.readFile(abs, "utf8")
    const seriesSlug = `02-series/${f.replace(/\.md$/i, "")}`
    const titleMatch = raw.match(/^title:\s*(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim().replace(/^["']|["']$/g, "") : f

    // Find the "Read in order" section and pull wikilink targets.
    const headingIdx = raw.search(/^##\s*Read in order/im)
    if (headingIdx === -1) continue
    const after = raw.slice(headingIdx)
    const nextHeadingIdx = after.search(/\n##\s+/i)
    const section =
      nextHeadingIdx > 0 ? after.slice(0, nextHeadingIdx) : after
    const ordered = []
    for (const m of section.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
      const target = m[1].trim().toLowerCase()
      // Resolve against basenameToSlug; fall back to scanning slugs ending with target.
      let slug = basenameToSlug.get(target)
      if (!slug) {
        slug = Object.keys(contentIndex).find(
          (s) =>
            s.toLowerCase().endsWith(`/${target}`) ||
            s.toLowerCase() === target,
        )
      }
      if (slug && !ordered.includes(slug)) ordered.push(slug)
    }
    if (ordered.length === 0) continue
    seriesBySlug.set(seriesSlug, { title, ordered, seriesPageSlug: seriesSlug })
    ordered.forEach((s, i) => {
      seriesByArticle.set(s, {
        seriesSlug,
        seriesTitle: title,
        position: i + 1,
        total: ordered.length,
        prev: i > 0 ? ordered[i - 1] : null,
        next: i + 1 < ordered.length ? ordered[i + 1] : null,
      })
    })
  }
  return { seriesBySlug, seriesByArticle }
}

// ---- Sibling prev/next ---------------------------------------------------

function pickSiblings(slug, contentIndex) {
  const parts = slug.split("/")
  if (parts.length < 2) return { prev: null, next: null }
  const parent = parts.slice(0, -1).join("/")
  const self = parts[parts.length - 1]
  const siblings = []
  for (const otherSlug of Object.keys(contentIndex)) {
    const op = otherSlug.split("/")
    if (op.length !== parts.length) continue
    if (op.slice(0, -1).join("/") !== parent) continue
    const leaf = op[op.length - 1]
    if (leaf === "index") continue
    siblings.push({ slug: otherSlug, leaf })
  }
  siblings.sort((a, b) => a.leaf.localeCompare(b.leaf, "en", { numeric: true }))
  const idx = siblings.findIndex((s) => s.leaf === self)
  if (idx < 0) return { prev: null, next: null }
  return {
    prev: idx > 0 ? siblings[idx - 1].slug : null,
    next: idx + 1 < siblings.length ? siblings[idx + 1].slug : null,
  }
}

// ---- Related --------------------------------------------------------------

function pickRelated(slug, contentIndex, seriesByArticle, exclude) {
  const parts = slug.split("/")
  const parent = parts.slice(0, -1).join("/")
  const grandparent = parts.slice(0, -2).join("/")
  const here = contentIndex[slug] || {}
  const outgoing = new Set((here.links || []).map((l) => l.toLowerCase()))
  const mySeries = seriesByArticle.get(slug)?.seriesSlug

  const scored = []
  for (const [otherSlug, meta] of Object.entries(contentIndex)) {
    if (otherSlug === slug) continue
    if (exclude.has(otherSlug)) continue
    if (SKIP_SLUG_RE.some((re) => re.test(otherSlug))) continue
    const op = otherSlug.split("/")
    const oparent = op.slice(0, -1).join("/")
    const ogrand = op.slice(0, -2).join("/")
    let score = 0
    const otherSeries = seriesByArticle.get(otherSlug)?.seriesSlug
    if (mySeries && otherSeries === mySeries) score += 3
    if (parent && oparent === parent) score += 2
    if (grandparent && ogrand === grandparent) score += 1
    if (outgoing.has(otherSlug.toLowerCase())) score += 1
    if (score === 0) continue
    scored.push({ slug: otherSlug, title: meta.title, score })
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
  return scored.slice(0, MAX_RELATED)
}

// ---- HTML rendering -------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function slugToHref(slug) {
  return `${BASE_PATH}/${slug}`
}

function renderSeriesStrip(seriesMeta, contentIndex) {
  const { seriesSlug, seriesTitle, position, total, prev, next } = seriesMeta
  const prevTitle = prev ? contentIndex[prev]?.title : null
  const nextTitle = next ? contentIndex[next]?.title : null
  const pieces = []
  pieces.push(
    `<div class="fpe-series-row">`,
    `  <a class="fpe-series-tag" href="${escapeHtml(slugToHref(seriesSlug))}">`,
    `    <span class="fpe-series-eyebrow">Series</span>`,
    `    <span class="fpe-series-name">${escapeHtml(seriesTitle)}</span>`,
    `    <span class="fpe-series-position">${position} / ${total}</span>`,
    `  </a>`,
    `</div>`,
  )
  if (prev || next) {
    pieces.push(`<div class="fpe-series-pn">`)
    if (prev && prevTitle) {
      pieces.push(
        `  <a class="fpe-pn-card fpe-pn-prev" href="${escapeHtml(slugToHref(prev))}">`,
        `    <span class="fpe-pn-eyebrow">← Previous in series</span>`,
        `    <span class="fpe-pn-title">${escapeHtml(prevTitle)}</span>`,
        `  </a>`,
      )
    } else {
      pieces.push(`  <span class="fpe-pn-card fpe-pn-empty"></span>`)
    }
    if (next && nextTitle) {
      pieces.push(
        `  <a class="fpe-pn-card fpe-pn-next" href="${escapeHtml(slugToHref(next))}">`,
        `    <span class="fpe-pn-eyebrow">Next in series →</span>`,
        `    <span class="fpe-pn-title">${escapeHtml(nextTitle)}</span>`,
        `  </a>`,
      )
    } else {
      pieces.push(`  <span class="fpe-pn-card fpe-pn-empty"></span>`)
    }
    pieces.push(`</div>`)
  }
  return pieces.join("\n")
}

function renderSiblings(prevSlug, nextSlug, contentIndex) {
  if (!prevSlug && !nextSlug) return ""
  const pieces = []
  pieces.push(`<div class="fpe-sibling-row">`)
  if (prevSlug) {
    pieces.push(
      `  <a class="fpe-pn-card fpe-pn-prev" href="${escapeHtml(slugToHref(prevSlug))}">`,
      `    <span class="fpe-pn-eyebrow">← Previous</span>`,
      `    <span class="fpe-pn-title">${escapeHtml(contentIndex[prevSlug].title)}</span>`,
      `  </a>`,
    )
  } else {
    pieces.push(`  <span class="fpe-pn-card fpe-pn-empty"></span>`)
  }
  if (nextSlug) {
    pieces.push(
      `  <a class="fpe-pn-card fpe-pn-next" href="${escapeHtml(slugToHref(nextSlug))}">`,
      `    <span class="fpe-pn-eyebrow">Next →</span>`,
      `    <span class="fpe-pn-title">${escapeHtml(contentIndex[nextSlug].title)}</span>`,
      `  </a>`,
    )
  } else {
    pieces.push(`  <span class="fpe-pn-card fpe-pn-empty"></span>`)
  }
  pieces.push(`</div>`)
  return pieces.join("\n")
}

function renderRelated(related) {
  if (related.length === 0) return ""
  return [
    `<div class="fpe-related">`,
    `  <p class="fpe-related-eyebrow">Related</p>`,
    `  <ul class="fpe-related-list">`,
    ...related.map(
      (r) =>
        `    <li><a class="fpe-related-link" href="${escapeHtml(slugToHref(r.slug))}">${escapeHtml(r.title)}</a></li>`,
    ),
    `  </ul>`,
    `</div>`,
  ].join("\n")
}

function renderFooter(seriesMeta, siblingPrev, siblingNext, related, contentIndex) {
  const inner = []
  if (seriesMeta) inner.push(renderSeriesStrip(seriesMeta, contentIndex))
  // Avoid duplicate prev/next: if series provides them, don't repeat
  // the sibling row unless siblings differ from series.
  const seriesProvides = !!(seriesMeta && (seriesMeta.prev || seriesMeta.next))
  const siblingDiffers =
    (siblingPrev && siblingPrev !== seriesMeta?.prev) ||
    (siblingNext && siblingNext !== seriesMeta?.next)
  if ((siblingPrev || siblingNext) && (!seriesProvides || siblingDiffers)) {
    inner.push(renderSiblings(siblingPrev, siblingNext, contentIndex))
  }
  inner.push(renderRelated(related))
  if (inner.length === 0) return null
  return [
    `<aside ${MARKER} class="fpe-prev-next-related" aria-label="Continue reading">`,
    ...inner,
    `</aside>`,
  ].join("\n")
}

// ---- Walker --------------------------------------------------------------

async function walkArticles(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkArticles(abs)))
    else if (e.isFile() && e.name.endsWith(".html")) out.push(abs)
  }
  return out
}

function slugFromHtml(abs) {
  const rel = path.relative(PUBLIC_DIR, abs)
  return rel.replace(/\.html$/, "").split(path.sep).join("/").toLowerCase()
}

const ARTICLE_END_RE = /(<\/article>)/i

async function inject(abs, slug, contentIndex, series) {
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return { skipped: "filter" }
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
  if (!ARTICLE_END_RE.test(html)) return { skipped: "no-article" }
  if (!contentIndex[slug]) return { skipped: "not-in-index" }

  const seriesMeta = series.seriesByArticle.get(slug) || null
  const { prev: sibPrev, next: sibNext } = pickSiblings(slug, contentIndex)

  const exclude = new Set([slug])
  if (seriesMeta?.prev) exclude.add(seriesMeta.prev)
  if (seriesMeta?.next) exclude.add(seriesMeta.next)
  if (sibPrev) exclude.add(sibPrev)
  if (sibNext) exclude.add(sibNext)

  const related = pickRelated(slug, contentIndex, series.seriesByArticle, exclude)

  const footer = renderFooter(
    seriesMeta,
    sibPrev,
    sibNext,
    related,
    contentIndex,
  )
  if (!footer) return { skipped: "empty-footer" }

  const next = html.replace(ARTICLE_END_RE, `$1\n${footer}`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true, hasSeries: !!seriesMeta, related: related.length }
}

async function main() {
  const contentIndex = await loadContentIndex()
  const series = await loadSeries(contentIndex)
  const pages = await walkArticles(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  let withSeries = 0
  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    const r = await inject(abs, slug, contentIndex, series)
    if (r.injected) {
      injected++
      if (r.hasSeries) withSeries++
    } else {
      skipped++
    }
  }
  console.log(
    `inject-prev-next-related: injected into ${injected} article(s) ` +
      `(${withSeries} with series strip); skipped ${skipped}.`,
  )
}

main().catch((e) => {
  console.error("inject-prev-next-related failed:", e)
  process.exit(1)
})
