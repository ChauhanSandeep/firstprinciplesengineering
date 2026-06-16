#!/usr/bin/env node
/**
 * scripts/build/inject-prev-next-related.mjs
 *
 * Post-build step: appends a "Continue reading" footer to every
 * article page in `public/`. The footer contains:
 *
 *   1. Sibling prev / next — within the same parent folder, prior and
 *      next articles by NN- ordering prefix (or alphabetical if no
 *      prefix). Skips index pages.
 *
 *   2. Related articles — up to 5 distinct other articles, scored by:
 *        - same parent folder       (+2)
 *        - same grandparent folder  (+1)
 *        - target appears in this   (+1)  (backlink signal — taken
 *          page's outgoing links            from contentIndex.json)
 *      Exclude self, prev, and next.
 *
 * Insertion point: immediately AFTER the closing </article> tag and
 * BEFORE the Quartz backlinks block. Carries id="fpe-prev-next-related"
 * so the injector is idempotent.
 *
 * Source data:
 *   - `public/static/contentIndex.json` — canonical slug → {title,
 *     filePath, links, tags, content}.
 * Skips:
 *   - home, about, 404
 *   - folder landing pages
 *   - tag pages
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const INDEX_PATH = path.join(PUBLIC_DIR, "static", "contentIndex.json")
const BASE_PATH = "/firstprinciplesengineering"
const MAX_RELATED = 5
const MARKER = `id="fpe-prev-next-related"`

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/, // folder landing pages
  /^tags(\/|$)/,
]

// ---- Source-data loaders -------------------------------------------------

async function loadContentIndex() {
  const raw = await fs.readFile(INDEX_PATH, "utf8")
  return JSON.parse(raw)
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

function pickRelated(slug, contentIndex, exclude) {
  const parts = slug.split("/")
  const parent = parts.slice(0, -1).join("/")
  const grandparent = parts.slice(0, -2).join("/")
  const here = contentIndex[slug] || {}
  const outgoing = new Set((here.links || []).map((l) => l.toLowerCase()))

  const scored = []
  for (const [otherSlug, meta] of Object.entries(contentIndex)) {
    if (otherSlug === slug) continue
    if (exclude.has(otherSlug)) continue
    if (SKIP_SLUG_RE.some((re) => re.test(otherSlug))) continue
    const op = otherSlug.split("/")
    const oparent = op.slice(0, -1).join("/")
    const ogrand = op.slice(0, -2).join("/")
    let score = 0
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

function renderFooter(siblingPrev, siblingNext, related, contentIndex) {
  const inner = []
  if (siblingPrev || siblingNext) {
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

async function inject(abs, slug, contentIndex) {
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return { skipped: "filter" }
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
  if (!ARTICLE_END_RE.test(html)) return { skipped: "no-article" }
  if (!contentIndex[slug]) return { skipped: "not-in-index" }

  const { prev: sibPrev, next: sibNext } = pickSiblings(slug, contentIndex)

  const exclude = new Set([slug])
  if (sibPrev) exclude.add(sibPrev)
  if (sibNext) exclude.add(sibNext)

  const related = pickRelated(slug, contentIndex, exclude)

  const footer = renderFooter(
    sibPrev,
    sibNext,
    related,
    contentIndex,
  )
  if (!footer) return { skipped: "empty-footer" }

  const next = html.replace(ARTICLE_END_RE, `$1\n${footer}`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true, related: related.length }
}

async function main() {
  const contentIndex = await loadContentIndex()
  const pages = await walkArticles(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    const r = await inject(abs, slug, contentIndex)
    if (r.injected) {
      injected++
    } else {
      skipped++
    }
  }
  console.log(
    `inject-prev-next-related: injected into ${injected} article(s); skipped ${skipped}.`,
  )
}

main().catch((e) => {
  console.error("inject-prev-next-related failed:", e)
  process.exit(1)
})
