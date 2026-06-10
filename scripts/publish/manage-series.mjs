#!/usr/bin/env node
/**
 * scripts/publish/manage-series.mjs
 *
 * Two responsibilities, mirroring the Featured-grid mutator:
 *
 *  1. Idempotent mutator for the Reading Series grid in content/index.md
 *     (`.fpe-learning-paths` block with `.fpe-path-card` entries).
 *  2. Creator / updater for series LANDING PAGES that live in the vault at
 *     `02-Series/<slug>.md`. New series get a publishable landing page with
 *     `publish: true`, a title, a description, and a "Read in order" list
 *     ordered by each note's `series_order` frontmatter.
 *
 * Plan JSON (stdin or --plan <path>):
 *   {
 *     series_add:    [{ slug, title, description, href, count, order? }, ...],
 *     series_remove: ["slug1", ...],
 *     series_update: [{ slug, ... }, ...],
 *     series_pages:  [{                  // landing-page creation/update
 *       slug,                            // e.g. "ai-systems-in-production"
 *       title,                           // human-readable
 *       description,                     // intro paragraph
 *       notes: [{                        // ordered list for "Read in order"
 *         vaultPath, displayTitle, blurb
 *       }],
 *     }],
 *   }
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import publishConfig from "../../publish.config.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUARTZ_ROOT = path.resolve(__dirname, "..", "..")
const VAULT_ROOT = path.resolve(
  QUARTZ_ROOT,
  process.env.QUARTZ_VAULT_ROOT || publishConfig.vaultRoot || "..",
)
const INDEX_PATH_DEFAULT = path.join(QUARTZ_ROOT, "content", "index.md")
const SERIES_DIR_DEFAULT = path.join(VAULT_ROOT, "02-Series")

const BEGIN_MARK = "<!-- publish-skill:series-begin -->"
const END_MARK = "<!-- publish-skill:series-end -->"
const GRID_OPEN = '<div class="fpe-learning-paths">'
const GRID_CLOSE = "</div>"

const PATH_CARD_RE =
  /<a class="fpe-path-card"[^>]*href="([^"]+)"[^>]*>\s*<span class="path-title">([\s\S]*?)<\/span>\s*<span class="path-desc">([\s\S]*?)<\/span>\s*<span class="path-count">([\s\S]*?)<\/span>\s*<\/a>/g

function getFlag(name, dflt = null) {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt
}

async function readPlan() {
  const planPath = getFlag("--plan")
  if (planPath) return JSON.parse(await fs.readFile(planPath, "utf8"))
  if (process.stdin.isTTY) {
    process.stderr.write("usage: manage-series.mjs --plan <plan.json>\n")
    process.exit(2)
  }
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function parseExisting(section) {
  const cards = []
  let m
  PATH_CARD_RE.lastIndex = 0
  while ((m = PATH_CARD_RE.exec(section)) !== null) {
    cards.push({
      href: m[1].trim(),
      title: m[2].trim(),
      description: m[3].trim(),
      count: m[4].trim(),
      order: null,
    })
  }
  return cards
}

function renderPathCard(c) {
  return (
    `<a class="fpe-path-card" href="${c.href}">\n` +
    `  <span class="path-title">${c.title}</span>\n` +
    `  <span class="path-desc">${c.description}</span>\n` +
    `  <span class="path-count">${c.count}</span>\n` +
    `</a>`
  )
}

function sortPathCards(cards) {
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

function applySeriesPlan(existing, plan) {
  const removeSet = new Set(
    (plan.series_remove || []).flatMap((s) => [s, hrefForSlug(s)]),
  )
  let merged = existing.filter(
    (c) => !removeSet.has(c.href) && !removeSet.has(slugForHref(c.href)),
  )

  for (const u of plan.series_update || []) {
    const target = u.href || hrefForSlug(u.slug)
    const idx = merged.findIndex(
      (c) => c.href === target || slugForHref(c.href) === u.slug,
    )
    if (idx >= 0) {
      merged[idx] = {
        ...merged[idx],
        ...(u.title && { title: u.title }),
        ...(u.description && { description: u.description }),
        ...(u.count != null && {
          count: typeof u.count === "number" ? `${u.count} articles` : u.count,
        }),
        ...(u.order != null && { order: u.order }),
      }
    }
  }

  const existingHrefs = new Set(merged.map((c) => c.href))
  const additions = (plan.series_add || [])
    .map((a) => ({
      href: a.href || hrefForSlug(a.slug),
      title: a.title,
      description: a.description,
      count: typeof a.count === "number" ? `${a.count} articles` : a.count,
      order: a.order ?? null,
    }))
    .filter((c) => !existingHrefs.has(c.href))

  merged = [...merged, ...additions]
  return sortPathCards(merged)
}

function hrefForSlug(slug) {
  return `02-Series/${slug}`
}

function slugForHref(href) {
  const m = href.match(/02-Series\/(.+?)\/?$/i)
  return m ? m[1] : null
}

function buildSection(cards) {
  const inner = cards.map(renderPathCard).join("\n\n")
  return [BEGIN_MARK, "", GRID_OPEN, "", inner, "", GRID_CLOSE, "", END_MARK].join(
    "\n",
  )
}

function spliceSeries(source, newSection) {
  if (source.includes(BEGIN_MARK) && source.includes(END_MARK)) {
    const before = source.slice(0, source.indexOf(BEGIN_MARK))
    const after = source.slice(source.indexOf(END_MARK) + END_MARK.length)
    return before + newSection + after
  }
  const openRe = new RegExp(
    "<div class=\"fpe-learning-paths\">[\\s\\S]*?</div>",
    "m",
  )
  if (openRe.test(source)) return source.replace(openRe, newSection)
  throw new Error(
    "could not locate Reading Series grid in content/index.md (no markers and no `<div class=\"fpe-learning-paths\">` block).",
  )
}

function renderLandingPage(spec) {
  // YAML frontmatter + simple body listing the ordered notes. Wikilinks use
  // the bare basename (without extension) so they resolve via Quartz's
  // shortest-link strategy.
  const fm = [
    "---",
    `title: "${escapeYaml(spec.title)}"`,
    `description: "${escapeYaml(spec.description)}"`,
    "publish: true",
    "---",
    "",
  ].join("\n")

  const intro = spec.description.trim() + "\n"

  const list = spec.notes
    .map((n, i) => {
      const stem = path.basename(n.vaultPath, ".md")
      const display = n.displayTitle || stem.replace(/^\d+[-_]/, "").replace(/[-_]/g, " ")
      return `${i + 1}. **[[${stem}|${display}]]** — ${n.blurb}`
    })
    .join("\n")

  return [fm, intro, "", "## Read in order", "", list, ""].join("\n")
}

function escapeYaml(s) {
  return String(s).replace(/"/g, '\\"')
}

async function writeLandingPages(specs, seriesDir) {
  await fs.mkdir(seriesDir, { recursive: true })
  const written = []
  for (const spec of specs || []) {
    const target = path.join(seriesDir, `${spec.slug}.md`)
    const next = renderLandingPage(spec)
    let prev = null
    try {
      prev = await fs.readFile(target, "utf8")
    } catch {}
    if (prev === next) {
      written.push({ slug: spec.slug, path: target, changed: false })
      continue
    }
    await fs.writeFile(target, next, "utf8")
    written.push({ slug: spec.slug, path: target, changed: true })
  }
  return written
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const indexPath = getFlag("--index", INDEX_PATH_DEFAULT)
  const seriesDir = getFlag("--series-dir", SERIES_DIR_DEFAULT)
  const plan = await readPlan()

  // 1. Mutate the home page grid.
  const source = await fs.readFile(indexPath, "utf8")
  let currentSection
  if (source.includes(BEGIN_MARK) && source.includes(END_MARK)) {
    currentSection = source.slice(
      source.indexOf(BEGIN_MARK),
      source.indexOf(END_MARK) + END_MARK.length,
    )
  } else {
    const m = source.match(/<div class="fpe-learning-paths">[\s\S]*?<\/div>/m)
    currentSection = m ? m[0] : ""
  }
  const existing = parseExisting(currentSection)
  const merged = applySeriesPlan(existing, plan)
  const newSection = buildSection(merged)
  const next = spliceSeries(source, newSection)

  let homeChanged = false
  if (next !== source) {
    homeChanged = true
    if (!dryRun) await fs.writeFile(indexPath, next, "utf8")
  }

  // 2. Write landing pages.
  let landings = []
  if (!dryRun) {
    landings = await writeLandingPages(plan.series_pages, seriesDir)
  } else {
    landings = (plan.series_pages || []).map((s) => ({
      slug: s.slug,
      path: path.join(seriesDir, `${s.slug}.md`),
      changed: "dry-run",
    }))
  }

  process.stdout.write(
    JSON.stringify(
      {
        homeChanged,
        homeCards: merged.length,
        added: (plan.series_add || []).length,
        removed: (plan.series_remove || []).length,
        updated: (plan.series_update || []).length,
        landingPages: landings,
        dryRun,
      },
      null,
      2,
    ) + "\n",
  )
}

main().catch((e) => {
  process.stderr.write(`manage-series failed: ${e.message}\n`)
  process.exit(1)
})
