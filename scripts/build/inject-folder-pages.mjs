#!/usr/bin/env node
/**
 * scripts/build/inject-folder-pages.mjs
 *
 * Normalize Quartz's auto-generated folder index pages so that the
 * page title, breadcrumb crumbs, and card titles all read like
 * curated topic names — not like raw vault folder slugs
 * (`01-Concepts`, `03-Data`, `04-Caching`, …).
 *
 * Also gives bare folder cards (subfolders that have no landing
 * `index.md`) a consistent footer ("📁 N items") so they don't sit
 * next to richer cards as empty blank boxes.
 *
 * Why post-build (not a Quartz override): Quartz Community ships its
 * FolderPage/FolderContent components from `github:` repos — patching
 * them in-repo means forking the plugin. The HTML post-process is
 * targeted, idempotent, and survives Quartz upgrades.
 *
 * Rules
 * -----
 * 1. `<h1 class="article-title">NN-Something</h1>` → strip prefix +
 *    humanize ("01-Concepts" → "Concepts", "05-AI-ML" → "AI ML").
 *    Only when the title literally matches the slug pattern — if the
 *    page has a landing `index.md` with a real frontmatter `title:`,
 *    we leave it alone.
 * 2. Last breadcrumb element (the inactive one, `<a href>`): same
 *    transform. Earlier crumbs (with `href="…"`) get the same
 *    treatment.
 * 3. Each `<li class="section-li">` card: if the `<h3><a>` text
 *    matches `NN-Something`, strip and humanize.
 * 4. If a card has an empty `<p class="meta">` AND empty
 *    `<ul class="tags">`, treat it as a bare folder card — replace
 *    the empty meta with a "📁 N items" footer by counting
 *    `*.html` files inside the linked folder.
 *
 * Idempotent: each rewrite is checked against the current value, so
 * re-running the script is a no-op.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

const PAGE_LISTING_MARKER = `class="page-listing"`
const FOLDER_NORMALIZED_MARKER = `data-fpe-folder-normalized`

// Match `NN-Something` or `NNN-Something` (numeric prefix + hyphen).
const PREFIX_RE = /^\s*\d{1,3}-(.+?)\s*$/

function humanize(raw) {
  // "AI-ML" → "AI ML"; "API" stays "API"; "Hello-World" → "Hello World"
  return raw.replace(/-/g, " ")
}

function stripPrefix(text) {
  const m = PREFIX_RE.exec(text)
  if (!m) return null
  return humanize(m[1])
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function countFolderItems(absDir) {
  // Count direct .html children of `absDir`, excluding `index.html`
  // itself and og-image webp/png siblings. This is what the user sees
  // as "items in this folder" — subfolders + notes.
  try {
    const entries = await fs.readdir(absDir, { withFileTypes: true })
    let count = 0
    for (const e of entries) {
      if (e.isDirectory()) {
        // Subfolders count if they themselves have an index.html
        try {
          await fs.access(path.join(absDir, e.name, "index.html"))
          count++
        } catch {}
      } else if (
        e.isFile() &&
        e.name.endsWith(".html") &&
        e.name !== "index.html"
      ) {
        count++
      }
    }
    return count
  } catch {
    return 0
  }
}

async function walkFolderIndexHtml(dir) {
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
      out.push(...(await walkFolderIndexHtml(abs)))
    } else if (e.isFile() && e.name === "index.html") {
      out.push(abs)
    }
  }
  return out
}

// Rewrite <h1 class="article-title">…</h1> if its text matches NN-Foo.
function rewriteH1(html) {
  return html.replace(
    /(<h1[^>]*class="article-title"[^>]*>)([^<]+)(<\/h1>)/i,
    (m, open, inner, close) => {
      const next = stripPrefix(inner)
      if (!next || next === inner) return m
      return `${open}${escHtml(next)}${close}`
    },
  )
}

// Rewrite all breadcrumb anchor texts that match NN-Foo. We touch
// only the text inside <a> (and the inactive last <a href> too).
function rewriteBreadcrumbs(html) {
  const re = /(<nav[^>]*class="breadcrumb-container"[^>]*>)([\s\S]*?)(<\/nav>)/i
  return html.replace(re, (_m, open, inner, close) => {
    const next = inner.replace(
      /(<a[^>]*>)([^<]+)(<\/a>)/g,
      (mm, ao, txt, ac) => {
        const stripped = stripPrefix(txt)
        if (!stripped || stripped === txt) return mm
        return `${ao}${escHtml(stripped)}${ac}`
      },
    )
    return `${open}${next}${close}`
  })
}

// Rewrite each <li class="section-li"> card. For each:
//   - Strip NN- prefix from the <h3><a> title.
//   - If both <p class="meta"> and <ul class="tags"> are empty,
//     replace the meta line with "📁 N items" footer.
async function rewriteCards(html, htmlAbsPath) {
  const cardRe = /<li class="section-li">([\s\S]*?)<\/li>/g
  const parts = []
  let lastIndex = 0
  let m
  while ((m = cardRe.exec(html)) !== null) {
    parts.push(html.slice(lastIndex, m.index))
    let body = m[1]

    // Strip NN- in title
    body = body.replace(
      /(<h3>\s*<a[^>]*href="([^"]+)"[^>]*>)([^<]+)(<\/a>\s*<\/h3>)/i,
      (mm, open, href, txt, close) => {
        const next = stripPrefix(txt)
        if (!next || next === txt) return mm
        return `${open}${escHtml(next)}${close}`
      },
    )

    // Detect bare folder cards (empty meta + empty tags) and inject
    // a "N items" footer based on the linked href.
    const emptyMeta = /<p class="meta">\s*<\/p>/.test(body)
    const emptyTags = /<ul class="tags">\s*<\/ul>/.test(body)
    if (emptyMeta && emptyTags) {
      // Extract href from <h3><a href="…">
      const hrefM = /<h3>\s*<a[^>]*href="([^"]+)"/i.exec(body)
      if (hrefM) {
        // Resolve the linked folder relative to the current page,
        // then count items.
        const href = hrefM[1]
        const pageDir = path.dirname(htmlAbsPath)
        const targetDir = path.resolve(pageDir, href)
        const items = await countFolderItems(targetDir)
        const label = items === 1 ? "1 item" : `${items} items`
        body = body.replace(
          /<p class="meta">\s*<\/p>/,
          `<p class="meta fpe-folder-meta"><span class="fpe-folder-meta-icon" aria-hidden="true">📁</span> ${escHtml(label)}</p>`,
        )
      }
    }

    parts.push(`<li class="section-li">${body}</li>`)
    lastIndex = cardRe.lastIndex
  }
  parts.push(html.slice(lastIndex))
  return parts.join("")
}

async function processOne(abs) {
  let html
  try {
    html = await fs.readFile(abs, "utf8")
  } catch {
    return { skipped: true }
  }
  if (!html.includes(PAGE_LISTING_MARKER)) return { skipped: true }
  if (html.includes(FOLDER_NORMALIZED_MARKER)) return { skipped: true }

  const before = html
  html = rewriteH1(html)
  html = rewriteBreadcrumbs(html)
  html = await rewriteCards(html, abs)

  // Mark the page as normalized to keep this idempotent.
  html = html.replace(
    /(<div class="page-listing")(>)/,
    `$1 ${FOLDER_NORMALIZED_MARKER}$2`,
  )

  if (html === before) return { skipped: true }
  await fs.writeFile(abs, html, "utf8")
  return { rewrote: true }
}

async function main() {
  const all = await walkFolderIndexHtml(PUBLIC_DIR)
  let rewrote = 0
  let skipped = 0
  for (const abs of all) {
    const r = await processOne(abs)
    if (r.rewrote) rewrote++
    else skipped++
  }
  console.log(
    `inject-folder-pages: normalized ${rewrote} folder index page(s); skipped ${skipped} (non-listing or unchanged).`,
  )
}

main().catch((e) => {
  console.error("inject-folder-pages failed:", e)
  process.exit(1)
})
