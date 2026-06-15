#!/usr/bin/env node
/**
 * scripts/build/inject-seo.mjs
 *
 * Post-build SEO polish. For every HTML page under public/:
 *
 *   1. Adds <link rel="canonical" href="…"> if missing. Source: the
 *      existing <meta property="og:url"> tag, which the og-image
 *      plugin already populates per page.
 *
 *   2. Adds <script type="application/ld+json"> with the Article
 *      schema for article pages (skipped on home / about / 404 /
 *      landings / tag pages). Fields:
 *        - headline       from <h1 class="article-title">
 *        - datePublished  from <time datetime="…"> (only one date is
 *                         emitted on every page; we use it for both
 *                         published and modified)
 *        - dateModified   same as above
 *        - description    from <meta name="description">
 *        - image          from <meta property="og:image">
 *        - mainEntityOfPage  the canonical URL
 *        - author         { "@type": "Person", "name": "Sandeep Chauhan",
 *                          "url": "https://www.linkedin.com/in/sandeepcode/" }
 *
 *   3. Adds <script type="application/ld+json"> with the
 *      BreadcrumbList schema, built from the existing <nav
 *      class="breadcrumb-container"> in the page header. Helps Google
 *      render breadcrumbs in SERP. Skipped on the same set of non-
 *      article pages.
 *
 * Idempotent. Each injection is gated on a marker:
 *   - <link rel="canonical">         → presence check
 *   - JSON-LD                        → data-fpe-jsonld="article|breadcrumb"
 *
 * Insertion point: before </head>.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

const SITE_NAME = "First Principles Engineering"
const AUTHOR = {
  "@type": "Person",
  name: "Sandeep Chauhan",
  url: "https://www.linkedin.com/in/sandeepcode/",
}

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/,
  /^tags(\/|$)/,
]

const OG_URL_RE = /<meta\b[^>]*\bproperty="og:url"[^>]*\bcontent="([^"]+)"/i
const OG_IMAGE_RE =
  /<meta\b[^>]*\bproperty="og:image"[^>]*\bcontent="([^"]+)"/i
const DESC_RE = /<meta\b[^>]*\bname="description"[^>]*\bcontent="([^"]*)"/i
const H1_RE =
  /<h1\b[^>]*\bclass="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i
const TIME_RE = /<time\b[^>]*\bdatetime="([^"]+)"/i
const BREADCRUMB_NAV_RE =
  /<nav\b[^>]*\bclass="[^"]*breadcrumb-container[^"]*"[^>]*>([\s\S]*?)<\/nav>/i
const BC_ELEMENT_RE =
  /<div\b[^>]*\bclass="[^"]*breadcrumb-element[^"]*"[^>]*>([\s\S]*?)<\/div>/g
const A_HREF_TEXT_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/i
const HREF_RE = /\bhref="([^"]*)"/i
const HAS_CANONICAL_RE = /<link\b[^>]*\brel="canonical"/i
const HAS_ARTICLE_JSONLD_RE = /data-fpe-jsonld="article"/
const HAS_BREADCRUMB_JSONLD_RE = /data-fpe-jsonld="breadcrumb"/
const HEAD_END_RE = /<\/head>/i

function stripHtml(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function resolveBreadcrumbHref(href, pageUrl) {
  if (!href) return null
  try {
    return new URL(href, pageUrl).toString()
  } catch {
    return null
  }
}

function parseBreadcrumbs(navHtml, pageUrl) {
  if (!navHtml) return []
  const items = []
  let i = 0
  for (const m of navHtml.matchAll(BC_ELEMENT_RE)) {
    const inner = m[1]
    const aMatch = inner.match(A_HREF_TEXT_RE)
    if (!aMatch) continue
    const name = stripHtml(aMatch[2])
    const hrefMatch = aMatch[1].match(HREF_RE)
    const href = hrefMatch ? hrefMatch[1] : null
    // Last element typically has no href (current page). Use pageUrl.
    const resolved = href ? resolveBreadcrumbHref(href, pageUrl) : pageUrl
    if (!name) continue
    items.push({
      "@type": "ListItem",
      position: ++i,
      name,
      item: resolved,
    })
  }
  return items
}

function jsonLdScript(kind, obj) {
  return `<script type="application/ld+json" data-fpe-jsonld="${kind}">${JSON.stringify(obj)}</script>`
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

function isArticle(slug) {
  return !SKIP_SLUG_RE.some((re) => re.test(slug))
}

async function process(abs, slug) {
  const html = await fs.readFile(abs, "utf8")
  if (!HEAD_END_RE.test(html)) return { skipped: "no-head" }

  const ogUrlMatch = html.match(OG_URL_RE)
  const pageUrl = ogUrlMatch ? ogUrlMatch[1] : null

  const additions = []

  // (1) canonical link
  if (pageUrl && !HAS_CANONICAL_RE.test(html)) {
    additions.push(`<link rel="canonical" href="${pageUrl}"/>`)
  }

  // (2) Article JSON-LD
  const article = isArticle(slug)
  if (article && pageUrl && !HAS_ARTICLE_JSONLD_RE.test(html)) {
    const h1 = html.match(H1_RE)
    const t = html.match(TIME_RE)
    const desc = html.match(DESC_RE)
    const img = html.match(OG_IMAGE_RE)
    if (h1 && t) {
      const articleLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: stripHtml(h1[1]),
        datePublished: t[1],
        dateModified: t[1],
        author: AUTHOR,
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": pageUrl,
        },
      }
      if (desc && desc[1]) articleLd.description = desc[1]
      if (img && img[1]) articleLd.image = img[1]
      additions.push(jsonLdScript("article", articleLd))
    }
  }

  // (3) BreadcrumbList JSON-LD (article pages only)
  if (article && pageUrl && !HAS_BREADCRUMB_JSONLD_RE.test(html)) {
    const navMatch = html.match(BREADCRUMB_NAV_RE)
    if (navMatch) {
      const items = parseBreadcrumbs(navMatch[1], pageUrl)
      if (items.length > 0) {
        additions.push(
          jsonLdScript("breadcrumb", {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: items,
          }),
        )
      }
    }
  }

  if (additions.length === 0) return { skipped: "no-additions" }
  const block = additions.join("\n")
  const next = html.replace(HEAD_END_RE, `${block}\n</head>`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return {
    injected: true,
    bits: additions.length,
    canonical: additions.some((a) => a.includes("canonical")),
    article: additions.some((a) => a.includes('jsonld="article"')),
    breadcrumb: additions.some((a) => a.includes('jsonld="breadcrumb"')),
  }
}

async function main() {
  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let canonical = 0
  let article = 0
  let breadcrumb = 0
  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    const r = await process(abs, slug)
    if (r.injected) {
      injected++
      if (r.canonical) canonical++
      if (r.article) article++
      if (r.breadcrumb) breadcrumb++
    }
  }
  console.log(
    `inject-seo: injected on ${injected} page(s) ` +
      `(canonical: ${canonical}, Article JSON-LD: ${article}, BreadcrumbList JSON-LD: ${breadcrumb}).`,
  )
}

main().catch((e) => {
  console.error("inject-seo failed:", e)
  process.exit(1)
})
