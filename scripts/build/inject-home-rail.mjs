#!/usr/bin/env node
/**
 * scripts/build/inject-home-rail.mjs
 *
 * Populate the home page's right sidebar with a "Newly Released"
 * panel — a vertical list of the most recently new/updated articles,
 * each with a status pill, eyebrow, title, and date.
 *
 * On every non-home page the right sidebar already carries the Table
 * of Contents (Quartz Community ToC plugin, `condition: not-index`).
 * On the home page that condition omits the ToC and leaves the right
 * sidebar empty — wasted space. We fill it with discovery surface.
 *
 * Data source: `public/static/statusIndex.json` (written by
 * inject-status-badges.mjs) joined with `public/static/contentIndex.json`
 * for titles. Sort by `modified` desc, take the top N.
 *
 * Idempotent via `id="fpe-home-rail"`.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { hrefForRootAnchor, hrefForSlug, readSiteUrlConfig } from "./site-url.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const HOME_HTML = path.join(PUBLIC_DIR, "index.html")
const STATUS_INDEX = path.join(PUBLIC_DIR, "static", "statusIndex.json")
const CONTENT_INDEX = path.join(PUBLIC_DIR, "static", "contentIndex.json")

const MAX_ITEMS = 4
const MARKER_ID = "fpe-home-rail"
const RIGHT_SIDEBAR_RE = /(<div class="right sidebar"[^>]*>)([\s\S]*?)(<\/div>)/i

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// Map a slug to a short eyebrow label.
// `01-fundamentals/02-databases/01-fundamentals/06-mvcc` → "Databases"
// `03-roadmaps/ai-systems-roadmap` → "Roadmaps"
const EYEBROW_MAP = {
  "01-fundamentals/01-concepts/01-distributed-systems": "Distributed Systems",
  "01-fundamentals/01-concepts/02-architecture": "Architecture",
  "01-fundamentals/01-concepts/03-data": "Data",
  "01-fundamentals/01-concepts/04-caching": "Caching",
  "01-fundamentals/01-concepts/05-api": "APIs",
  "01-fundamentals/01-concepts/06-security": "Security",
  "01-fundamentals/01-concepts/07-operations": "Operations",
  "01-fundamentals/02-databases": "Databases",
  "01-fundamentals/03-technologies": "Systems",
  "01-fundamentals/04-networking": "Networking",
  "01-fundamentals/05-ai-ml": "AI Systems",
  "03-roadmaps": "Roadmaps",
}

function eyebrowFor(slug) {
  // Pick the longest prefix in EYEBROW_MAP that matches.
  let best = ""
  for (const k of Object.keys(EYEBROW_MAP)) {
    if (slug.startsWith(k + "/") && k.length > best.length) best = k
  }
  return best ? EYEBROW_MAP[best] : "Notes"
}

function formatDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function renderItem(entry, basePath) {
  const href = hrefForSlug(basePath, entry.slug)
  const eyebrow = eyebrowFor(entry.slug)
  const date = formatDate(entry.modified || entry.created)
  const kind = entry.status === "new" ? "new" : "updated"
  const kindLabel = kind === "new" ? "New" : "Updated"
  return `<a class="fpe-rail-card" href="${esc(href)}">
    <div class="fpe-rail-card-eyebrow">${esc(eyebrow)}</div>
    <div class="fpe-rail-card-title">${esc(entry.title || entry.slug)}</div>
    <div class="fpe-rail-card-meta">
      <span class="fpe-rail-pill fpe-rail-pill--${kind}">${esc(kindLabel)}</span>
      <span class="fpe-rail-meta-sep" aria-hidden="true">•</span>
      <span class="fpe-rail-date">${esc(date)}</span>
    </div>
  </a>`
}

function renderRail(items, basePath) {
  return `<aside id="${MARKER_ID}" class="fpe-home-rail" aria-label="Newly released content">
  <div class="fpe-rail-header">
    <svg class="fpe-rail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z"/></svg>
    <span class="fpe-rail-title">Newly Released</span>
  </div>
  <div class="fpe-rail-list">${items.map((item) => renderItem(item, basePath)).join("")}</div>
  <a class="fpe-rail-footer" href="${hrefForRootAnchor(basePath, "recommended-reads")}">Explore recommended reads →</a>
</aside>`
}

async function readJsonOr(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"))
  } catch {
    return fallback
  }
}

async function main() {
  const { basePath } = await readSiteUrlConfig()
  const statusIndex = await readJsonOr(STATUS_INDEX, {})
  const contentIndex = await readJsonOr(CONTENT_INDEX, {})

  const entries = Object.entries(statusIndex)
    .filter(([, v]) => v.status === "new" || v.status === "updated")
    .map(([slug, v]) => ({
      slug,
      status: v.status,
      modified: v.modified,
      created: v.created,
      title: contentIndex[slug]?.title || slug,
    }))
    .sort(
      (a, b) =>
        new Date(b.modified || b.created).getTime() - new Date(a.modified || a.created).getTime(),
    )
    .slice(0, MAX_ITEMS)

  if (entries.length === 0) {
    console.log("inject-home-rail: no candidate items; skipping.")
    return
  }

  let html
  try {
    html = await fs.readFile(HOME_HTML, "utf8")
  } catch (e) {
    console.error(`inject-home-rail: cannot read ${HOME_HTML}: ${e.message}`)
    return
  }

  if (html.includes(`id="${MARKER_ID}"`)) {
    console.log("inject-home-rail: rail already present; skipping.")
    return
  }

  if (!RIGHT_SIDEBAR_RE.test(html)) {
    console.warn(`inject-home-rail: right sidebar marker not found in ${HOME_HTML}`)
    return
  }

  const rail = renderRail(entries, basePath)
  const next = html.replace(
    RIGHT_SIDEBAR_RE,
    (_m, open, inner, close) => `${open}${inner}${rail}${close}`,
  )

  await fs.writeFile(HOME_HTML, next, "utf8")
  console.log(`inject-home-rail: injected ${entries.length} item(s) into the home right rail.`)
}

main().catch((e) => {
  console.error("inject-home-rail failed:", e)
  process.exit(1)
})
