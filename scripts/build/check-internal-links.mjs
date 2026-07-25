#!/usr/bin/env node
/**
 * scripts/build/check-internal-links.mjs
 *
 * Publish gate for the top finding in both audits (UX §7.1 / Eng): internal
 * links that 404. Crawls every emitted `public/**\/*.html`, extracts same-site
 * <a href> targets, and verifies each resolves to a real emitted file. Any
 * dangling internal link fails the build so it can never ship.
 *
 * This complements the sync-time neutralization (dead wikilinks are rendered as
 * plain "coming soon" text): this check is the backstop that catches anything
 * that slips through — moved pages, hand-authored hrefs, injector bugs.
 *
 * Scope / non-goals:
 *   - Only same-site links are checked. External (http/https/protocol-relative),
 *     mailto:, tel:, javascript:, and pure `#fragment` links are ignored.
 *   - Query strings and #fragments are stripped before resolution (we verify the
 *     page/asset exists, not that an anchor is present).
 *
 * Soft mode: pass `--soft` or set CHECK_LINKS_SOFT=1 to warn instead of fail.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC = path.join(ROOT, "public")

const SOFT = process.argv.includes("--soft") || process.env.CHECK_LINKS_SOFT === "1"

async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(abs)))
    else if (e.isFile()) out.push(abs)
  }
  return out
}

// A URL path (leading-slash, no query/hash) "exists" if it maps to an emitted
// file. Handles directory-style URLs (→ index.html), extension-less page URLs
// (→ .html), and exact asset files.
function makeResolver(fileSet) {
  const has = (p) => fileSet.has(p)
  return (urlPath) => {
    let p = urlPath.replace(/\/+$/, "") // strip trailing slash
    if (p === "") return has("/index.html")
    if (has(p)) return true // exact file (asset or *.html)
    if (has(p + "/index.html")) return true // directory URL
    if (has(p + ".html")) return true // extension-less page
    return false
  }
}

function decode(href) {
  try {
    return decodeURI(href)
  } catch {
    return href
  }
}

async function main() {
  const allFiles = await walk(PUBLIC)
  const fileSet = new Set(
    allFiles.map((abs) => "/" + path.relative(PUBLIC, abs).split(path.sep).join("/")),
  )
  const resolves = makeResolver(fileSet)
  const htmlFiles = allFiles.filter((f) => f.endsWith(".html"))

  const hrefRe = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
  const broken = []
  let checked = 0

  for (const abs of htmlFiles) {
    const html = await fs.readFile(abs, "utf8")
    const selfUrl = "/" + path.relative(PUBLIC, abs).split(path.sep).join("/")
    const selfDir = selfUrl.replace(/[^/]*$/, "") // directory of the current page
    let m
    while ((m = hrefRe.exec(html)) !== null) {
      let href = (m[1] ?? m[2] ?? "").trim()
      if (!href) continue
      // Ignore non-navigational / external schemes and fragments.
      if (
        /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(href) ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        continue
      }
      href = decode(href)
      // Strip query + fragment.
      href = href.split("#")[0].split("?")[0]
      if (!href) continue
      // Resolve relative to the current page's directory; absolute stays.
      let target = href.startsWith("/")
        ? href
        : "/" + path.posix.normalize(path.posix.join(selfDir, href)).replace(/^\/+/, "")
      // path.posix.join may collapse a trailing slash we care about; re-add if
      // the original href ended with one.
      if (href.endsWith("/") && !target.endsWith("/")) target += "/"
      checked++
      if (!resolves(target)) {
        broken.push({ page: selfUrl, href: m[1] ?? m[2], target })
      }
    }
  }

  console.log(
    `check-internal-links: scanned ${htmlFiles.length} page(s), ${checked} internal link(s).`,
  )
  if (broken.length === 0) {
    console.log("check-internal-links: ✅ no broken internal links.")
    return
  }

  // De-dupe identical (page,target) pairs for readability.
  const seen = new Set()
  const uniq = broken.filter((b) => {
    const k = b.page + " -> " + b.target
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const label = SOFT ? "⚠️ " : "❌"
  console[SOFT ? "warn" : "error"](
    `${label} ${uniq.length} broken internal link(s) (${broken.length} occurrence(s)):`,
  )
  for (const b of uniq.slice(0, 30)) {
    console[SOFT ? "warn" : "error"](`   ${b.page}  →  ${b.href}`)
  }
  if (uniq.length > 30) {
    console[SOFT ? "warn" : "error"](`   ... and ${uniq.length - 30} more`)
  }
  if (!SOFT) process.exit(1)
}

main().catch((e) => {
  console.error("check-internal-links failed:", e)
  process.exit(1)
})
