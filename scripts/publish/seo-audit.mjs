#!/usr/bin/env node
/**
 * scripts/publish/seo-audit.mjs
 *
 * Read-only audit of every page in `public/` for the SEO fundamentals:
 *
 *   - <title> length 35–60 chars (Google truncates ~60)
 *   - <meta name="description"> length 130–160 chars
 *   - <meta property="og:image"> present
 *   - <link rel="canonical"> present
 *   - <h1> present (exactly one)
 *   - Article + BreadcrumbList JSON-LD present on article pages
 *
 * Output: a single Markdown report grouped by issue type, with file
 * paths and current vs. expected values. Does NOT auto-fix — most
 * fixes belong in the vault note's frontmatter (`title:`,
 * `description:`) rather than in built HTML.
 *
 * Exit code:
 *   0  audit completed (issues reported but non-fatal)
 *   1  the public/ directory doesn't exist (build first)
 *
 * Usage:
 *   node scripts/publish/seo-audit.mjs                  # full report to stdout
 *   node scripts/publish/seo-audit.mjs --json           # machine-readable
 *   node scripts/publish/seo-audit.mjs --out audit.md   # write file
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

const TITLE_MIN = 35
const TITLE_MAX = 60
const DESC_MIN = 130
const DESC_MAX = 160

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/,
  /^tags(\/|$)/,
]

const TITLE_RE = /<title>([\s\S]*?)<\/title>/i
const DESC_RE = /<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/i
const OG_IMAGE_RE =
  /<meta\b[^>]*\bproperty="og:image"[^>]*\bcontent="([^"]+)"/i
const CANONICAL_RE = /<link\b[^>]*\brel="canonical"/i
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i
const H1_COUNT_RE = /<h1\b/gi
const ART_JSONLD_RE = /data-fpe-jsonld="article"/
const BC_JSONLD_RE = /data-fpe-jsonld="breadcrumb"/

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

function audit(html, slug) {
  const issues = []
  const isArticle = !SKIP_SLUG_RE.some((re) => re.test(slug))

  const t = html.match(TITLE_RE)
  const title = t ? stripHtml(t[1]) : ""
  if (!title) issues.push({ kind: "missing-title" })
  else if (title.length < TITLE_MIN)
    issues.push({ kind: "short-title", length: title.length, value: title })
  else if (title.length > TITLE_MAX)
    issues.push({ kind: "long-title", length: title.length, value: title })

  const d = html.match(DESC_RE)
  const desc = d ? d[1] : ""
  if (!desc) issues.push({ kind: "missing-description" })
  else if (desc.length < DESC_MIN)
    issues.push({ kind: "short-description", length: desc.length, value: desc })
  else if (desc.length > DESC_MAX)
    issues.push({ kind: "long-description", length: desc.length, value: desc })

  if (!OG_IMAGE_RE.test(html)) issues.push({ kind: "missing-og-image" })
  if (!CANONICAL_RE.test(html)) issues.push({ kind: "missing-canonical" })

  const h1Count = (html.match(H1_COUNT_RE) || []).length
  if (h1Count === 0) issues.push({ kind: "missing-h1" })
  else if (h1Count > 1) issues.push({ kind: "multiple-h1", count: h1Count })

  if (isArticle) {
    if (!ART_JSONLD_RE.test(html))
      issues.push({ kind: "missing-article-jsonld" })
    if (!BC_JSONLD_RE.test(html))
      issues.push({ kind: "missing-breadcrumb-jsonld" })
  }

  return { slug, issues, title }
}

const KIND_DESCRIPTIONS = {
  "missing-title": "No <title> tag",
  "short-title": `Title shorter than ${TITLE_MIN} chars (may underwhelm in SERP)`,
  "long-title": `Title longer than ${TITLE_MAX} chars (Google truncates)`,
  "missing-description": "No <meta name='description'>",
  "short-description": `Description shorter than ${DESC_MIN} chars (low SERP yield)`,
  "long-description": `Description longer than ${DESC_MAX} chars (Google truncates)`,
  "missing-og-image": "No <meta property='og:image'>",
  "missing-canonical": "No <link rel='canonical'>",
  "missing-h1": "No <h1>",
  "multiple-h1": "Multiple <h1> tags",
  "missing-article-jsonld": "No Article JSON-LD (run inject-seo)",
  "missing-breadcrumb-jsonld": "No BreadcrumbList JSON-LD (run inject-seo)",
}

function renderMarkdown(results) {
  const buckets = {}
  let totalIssues = 0
  for (const r of results) {
    for (const i of r.issues) {
      totalIssues++
      ;(buckets[i.kind] = buckets[i.kind] || []).push({ slug: r.slug, ...i })
    }
  }
  const lines = []
  lines.push(`# SEO audit`, "")
  lines.push(
    `**${results.length}** page(s) scanned · **${totalIssues}** issue(s) found · ${results.filter((r) => r.issues.length === 0).length} page(s) clean.`,
    "",
  )
  if (totalIssues === 0) {
    lines.push("All pages pass the SEO checks. 🎉", "")
    return lines.join("\n")
  }
  // Stable kind order: severity-ish
  const order = [
    "missing-title",
    "missing-h1",
    "multiple-h1",
    "missing-description",
    "missing-canonical",
    "missing-og-image",
    "missing-article-jsonld",
    "missing-breadcrumb-jsonld",
    "long-title",
    "short-title",
    "long-description",
    "short-description",
  ]
  for (const kind of order) {
    if (!buckets[kind]) continue
    lines.push(`## ${KIND_DESCRIPTIONS[kind]} (${buckets[kind].length})`, "")
    for (const i of buckets[kind]) {
      let row = `- \`${i.slug}\``
      if (i.length !== undefined) row += ` (${i.length} chars)`
      if (i.count !== undefined) row += ` (count: ${i.count})`
      if (i.value) {
        const preview =
          i.value.length > 100 ? i.value.slice(0, 97) + "…" : i.value
        row += `\n  > ${preview}`
      }
      lines.push(row)
    }
    lines.push("")
  }
  return lines.join("\n")
}

async function main() {
  let exists = true
  try {
    await fs.access(PUBLIC_DIR)
  } catch {
    exists = false
  }
  if (!exists) {
    console.error(
      "seo-audit: public/ not found. Run `npm run build` first.",
    )
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const wantJson = args.includes("--json")
  const outIdx = args.indexOf("--out")
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null

  const files = await walkHtml(PUBLIC_DIR)
  const results = []
  for (const abs of files) {
    const slug = slugFromHtml(abs)
    const html = await fs.readFile(abs, "utf8")
    results.push(audit(html, slug))
  }
  results.sort((a, b) => a.slug.localeCompare(b.slug))

  let output
  if (wantJson) output = JSON.stringify(results, null, 2)
  else output = renderMarkdown(results)

  if (outPath) {
    await fs.writeFile(outPath, output, "utf8")
    console.log(`seo-audit: wrote ${outPath}`)
  } else {
    console.log(output)
  }
}

main().catch((e) => {
  console.error("seo-audit failed:", e)
  process.exit(1)
})
