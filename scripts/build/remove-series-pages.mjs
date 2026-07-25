#!/usr/bin/env node
/**
 * Remove public pages that used to represent Reading Series.
 *
 * Quartz's FolderPage plugin auto-generates `index.html` for folders even
 * when no vault `index.md` exists. The product decision is that Reading Series
 * are not a public surface, so these former series URLs must 404 rather than
 * falling back to generic folder listings.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

const REMOVE_PATHS = [
  "02-series",
  "01-fundamentals/01-concepts/01-distributed-systems/index.html",
  "01-fundamentals/01-concepts/01-distributed-systems/index-og-image.webp",
  "01-fundamentals/01-concepts/02-architecture/index.html",
  "01-fundamentals/01-concepts/02-architecture/index-og-image.webp",
  "01-fundamentals/02-databases/01-fundamentals/index.html",
  "01-fundamentals/02-databases/01-fundamentals/index-og-image.webp",
  "01-fundamentals/05-ai-ml/index.html",
  "01-fundamentals/05-ai-ml/index-og-image.webp",
]

let removed = 0
for (const rel of REMOVE_PATHS) {
  const target = path.join(PUBLIC_DIR, rel)
  try {
    await fs.rm(target, { recursive: true, force: true })
    removed++
  } catch (e) {
    console.warn(`remove-series-pages: failed to remove ${rel}: ${e.message}`)
  }
}

// The folder pages above are gone, but breadcrumbs and parent folder listings
// still emit <a> links to them — dangling internal 404s (the top UX/Eng audit
// finding). Rewrite any anchor whose href resolves to a removed folder URL
// into non-clickable text so the label stays but the dead link disappears.
const REMOVED_FOLDER_SLUGS = REMOVE_PATHS.filter((p) => p.endsWith("/index.html"))
  .map((p) => p.replace(/\/index\.html$/, ""))
  .filter((p) => p && !p.includes("."))

function hrefTargetsRemovedFolder(href) {
  let h = href.split("#")[0].split("?")[0].trim()
  if (!h || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:)/i.test(h)) return false
  h = h
    .replace(/^(?:\.\.?\/)+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
  return REMOVED_FOLDER_SLUGS.includes(h)
}

async function walkHtml(dir) {
  const out = []
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkHtml(abs)))
    else if (e.isFile() && abs.endsWith(".html")) out.push(abs)
  }
  return out
}

const anchorRe = /<a\b[^>]*?\bhref="([^"]*)"[^>]*?>([\s\S]*?)<\/a>/gi
let neutralized = 0
let pagesTouched = 0
for (const abs of await walkHtml(PUBLIC_DIR)) {
  const html = await fs.readFile(abs, "utf8")
  let changed = false
  const next = html.replace(anchorRe, (full, href, inner) => {
    if (!hrefTargetsRemovedFolder(href)) return full
    changed = true
    neutralized++
    return `<span class="fpe-breadcrumb-inactive">${inner}</span>`
  })
  if (changed) {
    await fs.writeFile(abs, next, "utf8")
    pagesTouched++
  }
}

console.log(
  `remove-series-pages: removed ${removed} former series path(s); ` +
    `neutralized ${neutralized} dead link(s) to removed folders across ${pagesTouched} page(s).`,
)
