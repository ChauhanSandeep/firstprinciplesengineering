#!/usr/bin/env node
/**
 * scripts/publish/update-home-cards.mjs
 *
 * Idempotent mutator for the Featured grid in content/index.md.
 *
 * Reads a JSON "plan" from stdin (or --plan <path>) with shape:
 *   {
 *     featured_add:    [{ href, eyebrow, title, description, order? }, ...],
 *     featured_remove: ["href1", ...],   // hrefs to drop from the grid
 *     featured_update: [{ href, eyebrow?, title?, description?, order? }, ...]
 *   }
 *
 * Applies the changes to content/index.md and writes back.
 *
 * Ordering rules:
 *   - Cards with an explicit `order` are sorted ascending by that number.
 *   - Cards without `order` retain their existing relative position.
 *   - New cards without `order` are inserted at the top (most-recent-first).
 *
 * Idempotent: running with an empty plan is a no-op. Running the same plan
 * twice produces the same file.
 *
 * Safety:
 *   - Enforces a max of MAX_FEATURED cards in the grid (default 12, override
 *     via --max).
 *   - Refuses to silently drop cards beyond the cap; exits non-zero with a
 *     critical error if exceeded.
 *   - Validates that every href is non-empty and looks like a relative path.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUARTZ_ROOT = path.resolve(__dirname, "..", "..")
const DEFAULT_INDEX_PATH = path.join(QUARTZ_ROOT, "content", "index.md")

const FEATURED_OPEN = '<div class="fpe-featured-grid">'
const FEATURED_CLOSE = "</div>"
// Marker that wraps the auto-managed Featured block. We embed comments so a
// human glancing at the source knows not to edit between them.
const BEGIN_MARK = "<!-- publish-skill:featured-begin -->"
const END_MARK = "<!-- publish-skill:featured-end -->"

const CARD_RE =
  /<a class="fpe-article-card"[^>]*href="([^"]+)"[^>]*>\s*<span class="article-eyebrow">([\s\S]*?)<\/span>\s*<span class="article-title">([\s\S]*?)<\/span>\s*<span class="article-desc">([\s\S]*?)<\/span>\s*<\/a>/g

function getFlag(name, dflt = null) {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt
}

async function readPlan() {
  const planPath = getFlag("--plan")
  if (planPath) return JSON.parse(await fs.readFile(planPath, "utf8"))
  if (process.stdin.isTTY) {
    process.stderr.write("usage: update-home-cards.mjs --plan <plan.json>\n")
    process.exit(2)
  }
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function parseExistingCards(section) {
  const cards = []
  let m
  CARD_RE.lastIndex = 0
  while ((m = CARD_RE.exec(section)) !== null) {
    cards.push({
      href: m[1].trim(),
      eyebrow: m[2].trim(),
      title: m[3].trim(),
      description: m[4].trim(),
      order: null,
    })
  }
  return cards
}

function renderCard(c) {
  return (
    `<a class="fpe-article-card" href="${c.href}">\n` +
    `  <span class="article-eyebrow">${c.eyebrow}</span>\n` +
    `  <span class="article-title">${c.title}</span>\n` +
    `  <span class="article-desc">${c.description}</span>\n` +
    `</a>`
  )
}

function sortCards(cards) {
  // Stable sort: explicit order ascending, then preserve original index for
  // tie-breakers. Cards without `order` are treated as Infinity (stay after
  // ordered ones) — except in the merge step we'll prepend new ones first.
  return cards
    .map((c, i) => ({ ...c, _i: i }))
    .sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : Infinity
      const bo = Number.isFinite(b.order) ? b.order : Infinity
      if (ao !== bo) return ao - bo
      return a._i - b._i
    })
    .map(({ _i, ...rest }) => rest)
}

function applyPlan(existing, plan) {
  const removeSet = new Set(plan.featured_remove || [])
  let merged = existing.filter((c) => !removeSet.has(c.href))

  // Updates: in-place patch of any matching href.
  for (const u of plan.featured_update || []) {
    const idx = merged.findIndex((c) => c.href === u.href)
    if (idx >= 0) merged[idx] = { ...merged[idx], ...u }
  }

  // Adds: skip dupes (already present), prepend at top in plan order so
  // newest entries surface first.
  const existingHrefs = new Set(merged.map((c) => c.href))
  const additions = (plan.featured_add || []).filter(
    (c) => !existingHrefs.has(c.href),
  )
  merged = [...additions, ...merged]

  return sortCards(merged)
}

function validateCards(cards, max) {
  if (cards.length > max) {
    throw new Error(
      `featured grid would have ${cards.length} cards, exceeds cap of ${max}. ` +
        `Remove some via featured_remove or raise --max.`,
    )
  }
  for (const c of cards) {
    if (!c.href || c.href.startsWith("http")) {
      throw new Error(
        `invalid href: '${c.href}'. Use a site-relative path (no leading slash).`,
      )
    }
    if (!c.title || !c.eyebrow || !c.description) {
      throw new Error(
        `card for '${c.href}' is missing required field (eyebrow/title/description).`,
      )
    }
  }
}

function buildSection(cards) {
  const inner = cards.map(renderCard).join("\n\n")
  return [
    BEGIN_MARK,
    "",
    FEATURED_OPEN,
    "",
    inner,
    "",
    FEATURED_CLOSE,
    "",
    END_MARK,
  ].join("\n")
}

function spliceFeatured(source, newSection) {
  // Preferred: replace between markers if they exist (idempotent on re-runs).
  if (source.includes(BEGIN_MARK) && source.includes(END_MARK)) {
    const before = source.slice(0, source.indexOf(BEGIN_MARK))
    const after = source.slice(source.indexOf(END_MARK) + END_MARK.length)
    return before + newSection + after
  }
  // First-time migration: replace the raw `<div class="fpe-featured-grid">…</div>`
  // block under the `## Featured` heading. We anchor on the heading + open tag
  // to avoid clobbering any other div on the page.
  const headingRe = /(## Featured\s*\n+)/
  const openRe = new RegExp(
    "<div class=\"fpe-featured-grid\">[\\s\\S]*?</div>",
    "m",
  )
  if (headingRe.test(source) && openRe.test(source)) {
    return source.replace(openRe, newSection)
  }
  throw new Error(
    "could not locate Featured grid in content/index.md (no markers and no `<div class=\"fpe-featured-grid\">` block under `## Featured`).",
  )
}

async function main() {
  const max = parseInt(getFlag("--max", "12"), 10)
  const dryRun = process.argv.includes("--dry-run")
  const indexPath = getFlag("--index", DEFAULT_INDEX_PATH)
  const plan = await readPlan()

  const source = await fs.readFile(indexPath, "utf8")
  // Extract the current featured section (between markers if present,
  // otherwise from the raw div block).
  let currentSection
  if (source.includes(BEGIN_MARK) && source.includes(END_MARK)) {
    currentSection = source.slice(
      source.indexOf(BEGIN_MARK),
      source.indexOf(END_MARK) + END_MARK.length,
    )
  } else {
    const m = source.match(
      /<div class="fpe-featured-grid">[\s\S]*?<\/div>/m,
    )
    currentSection = m ? m[0] : ""
  }

  const existing = parseExistingCards(currentSection)
  const merged = applyPlan(existing, plan)
  validateCards(merged, max)

  const newSection = buildSection(merged)
  const next = spliceFeatured(source, newSection)

  if (next === source) {
    process.stdout.write(
      JSON.stringify(
        { changed: false, cards: merged.length, source: "no-op" },
        null,
        2,
      ) + "\n",
    )
    return
  }

  if (!dryRun) {
    await fs.writeFile(indexPath, next, "utf8")
  }

  process.stdout.write(
    JSON.stringify(
      {
        changed: true,
        cards: merged.length,
        added: (plan.featured_add || []).length,
        removed: (plan.featured_remove || []).length,
        updated: (plan.featured_update || []).length,
        dryRun,
      },
      null,
      2,
    ) + "\n",
  )
}

main().catch((e) => {
  process.stderr.write(`update-home-cards failed: ${e.message}\n`)
  process.exit(1)
})
