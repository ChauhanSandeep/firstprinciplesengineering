#!/usr/bin/env node
/**
 * scripts/build/inject-topic-nav.mjs
 *
 * Post-build step: injects a horizontal topic navigation strip into:
 *
 *   - the home page (`public/index.html`)
 *   - each of the 7 top-level topic landing pages configured in
 *     `topics.config.mjs` (e.g. `01-fundamentals/02-databases/01-fundamentals/`)
 *
 * The strip is intentionally NOT injected on deeper folder index
 * pages (`01-fundamentals/01-concepts/`, `01-fundamentals/02-databases/`,
 * …) — once a reader is deep inside a topic, the left explorer +
 * breadcrumbs are the right wayfinding, and a row of 7 unrelated
 * top-level topic tabs adds confusion, not value.
 *
 * Goal — give visitors a topic-first jump bar so they can reach
 * "Databases" without first parsing the vault's internal folder
 * structure (`01-Fundamentals/02-Databases/01-Fundamentals/`).
 *
 * Implementation choice
 * ---------------------
 * Quartz Community layout plugins all source from `github:` repos —
 * adding a local component is significantly more wiring than a
 * post-build HTML injection. The injection is cheap, idempotent, and
 * scoped to exactly the pages where it earns its keep.
 *
 * Where the strip lands
 * ---------------------
 * Immediately above the article container, inside the page-content
 * region. The strip carries `id="fpe-topic-nav"`. Idempotency check:
 * if the marker is already present we skip the page.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import { topics, BASE_PATH } from "../../topics.config.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

// Eligible-page check — built from topics.config.mjs once at startup.
// A page qualifies iff its slug is either "" (home) or matches one
// of the configured topic paths (stripped of trailing slash, lower-cased).
const ELIGIBLE_SLUGS = new Set(
  topics.map((t) => t.path.replace(/^\/+|\/+$/g, "").toLowerCase()),
)
ELIGIBLE_SLUGS.add("") // home

// Inject after the breadcrumb container if present, else immediately
// before the page <article>. Both options keep the strip inside the
// main content column so it inherits the page's max-width.
const INJECT_ANCHOR_RE = /(<article\b)/i
const TOPIC_NAV_MARKER = `id="fpe-topic-nav"`

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderTopicNav(currentHref) {
  const currentLc = currentHref.toLowerCase()
  const items = [...topics]
    .sort((a, b) => a.order - b.order)
    .map((t) => {
      const href = `${BASE_PATH}/${t.path.replace(/^\/+/, "")}`
      const hrefLc = href.toLowerCase()
      const isActive =
        currentLc === hrefLc ||
        currentLc.startsWith(hrefLc.replace(/\/$/, "") + "/")
      return [
        `<a class="fpe-topic-nav-item${isActive ? " is-active" : ""}" href="${escapeHtml(href)}"${isActive ? ' aria-current="page"' : ""}>`,
        `  <span class="fpe-topic-nav-icon" aria-hidden="true">${t.icon}</span>`,
        `  <span class="fpe-topic-nav-label">${escapeHtml(t.label)}</span>`,
        `</a>`,
      ].join("")
    })
    .join("")

  return [
    `<nav ${TOPIC_NAV_MARKER} class="fpe-topic-nav" aria-label="Topics">`,
    `  <div class="fpe-topic-nav-inner">${items}</div>`,
    `</nav>`,
  ].join("")
}

async function walkLandingPages(dir, rel = "") {
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
      out.push(...(await walkLandingPages(abs, path.join(rel, e.name))))
    } else if (e.isFile() && e.name === "index.html") {
      out.push({ abs, slug: rel.split(path.sep).join("/") })
    }
  }
  return out
}

async function injectInto(abs, slug) {
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(TOPIC_NAV_MARKER)) return { abs, skipped: "already-present" }
  if (!INJECT_ANCHOR_RE.test(html)) return { abs, skipped: "no-anchor" }

  const currentHref =
    slug === "" ? `${BASE_PATH}/` : `${BASE_PATH}/${slug}/`
  const nav = renderTopicNav(currentHref)
  const next = html.replace(INJECT_ANCHOR_RE, `${nav}\n$1`)
  if (next === html) return { abs, skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { abs, injected: true }
}

async function main() {
  const pages = await walkLandingPages(PUBLIC_DIR)
  // Only inject on home + the configured top-level topic landing pages.
  // Deeper folder indexes get the explorer + breadcrumbs instead.
  const targets = pages.filter((p) => ELIGIBLE_SLUGS.has(p.slug.toLowerCase()))

  let injected = 0
  let skipped = 0
  for (const p of targets) {
    const r = await injectInto(p.abs, p.slug)
    if (r.injected) injected++
    else skipped++
  }
  console.log(
    `inject-topic-nav: injected into ${injected} landing page(s); skipped ${skipped} eligible; ` +
      `total folder index pages scanned: ${pages.length}.`,
  )
}

main().catch((e) => {
  console.error("inject-topic-nav failed:", e)
  process.exit(1)
})
