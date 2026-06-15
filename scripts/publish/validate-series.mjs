#!/usr/bin/env node
/**
 * scripts/publish/validate-series.mjs
 *
 * Read-only audit of every series landing page in
 * `content/02-Series/*.md`. For each series:
 *
 *   - Parse the "## Read in order" block.
 *   - Resolve every wikilink against the synced content/ tree.
 *   - Report:
 *       * Members the link can't resolve to a published note.
 *       * Duplicate members within a series.
 *       * Members that also appear in another series (warn — usually
 *         not a bug, but a signal to think about which series owns
 *         the article for prev/next).
 *       * Series with < 3 members (warn — Phase 3 of the publish skill
 *         already flags this, but having it here keeps validation
 *         localized).
 *
 * Exit code:
 *   0  no errors (warnings allowed)
 *   1  at least one error (broken wikilink or duplicate)
 *
 * Usage:
 *   node scripts/publish/validate-series.mjs
 *   node scripts/publish/validate-series.mjs --json
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const CONTENT_DIR = path.join(SITE_ROOT, "content")
const SERIES_DIR = path.join(CONTENT_DIR, "02-Series")

const WANT_JSON = process.argv.includes("--json")

async function walkMd(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkMd(abs)))
    else if (e.isFile() && e.name.endsWith(".md")) out.push(abs)
  }
  return out
}

function basenameStem(p) {
  return path.basename(p, ".md").toLowerCase()
}

function resolveByBasename(target, files) {
  const norm = target.toLowerCase().replace(/\.md$/, "")
  for (const f of files) {
    if (basenameStem(f) === norm) return f
  }
  return null
}

async function main() {
  const allMd = (await walkMd(CONTENT_DIR)).filter(
    (f) => !path.basename(f).startsWith("_"),
  )
  let seriesFiles
  try {
    seriesFiles = (await fs.readdir(SERIES_DIR))
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(SERIES_DIR, f))
  } catch {
    seriesFiles = []
  }

  const memberToSeries = new Map() // member-abs-path → [seriesSlug, …]
  const reports = []

  for (const abs of seriesFiles) {
    const raw = await fs.readFile(abs, "utf8")
    const seriesSlug = "02-series/" + path.basename(abs, ".md")
    const lower = raw.toLowerCase()
    const startIdx = lower.search(/##\s*read in order/im)
    if (startIdx < 0) {
      reports.push({
        series: seriesSlug,
        errors: ["no '## Read in order' section"],
        warnings: [],
        members: [],
      })
      continue
    }
    let endIdx = raw.indexOf("\n## ", startIdx + 1)
    if (endIdx < 0) endIdx = raw.length
    const block = raw.slice(startIdx, endIdx)
    const itemRe = /\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g
    const targets = []
    let m
    while ((m = itemRe.exec(block)) !== null) targets.push(m[1].trim())

    const errors = []
    const warnings = []
    const resolvedMembers = []
    const seen = new Set()
    for (const t of targets) {
      const r = resolveByBasename(t, allMd)
      if (!r) {
        errors.push(`unresolved wikilink: [[${t}]]`)
        continue
      }
      if (seen.has(r)) {
        errors.push(`duplicate member: [[${t}]]`)
        continue
      }
      seen.add(r)
      resolvedMembers.push(r)
      if (!memberToSeries.has(r)) memberToSeries.set(r, [])
      memberToSeries.get(r).push(seriesSlug)
    }
    if (resolvedMembers.length < 3) {
      warnings.push(
        `only ${resolvedMembers.length} member(s) — series usually needs >= 3 to feel like one`,
      )
    }
    reports.push({
      series: seriesSlug,
      errors,
      warnings,
      members: resolvedMembers.map((p) =>
        path.relative(CONTENT_DIR, p).split(path.sep).join("/"),
      ),
    })
  }

  // Cross-series duplicate signal — surface as warning, not error.
  for (const [member, seriesList] of memberToSeries) {
    if (seriesList.length > 1) {
      const rel = path.relative(CONTENT_DIR, member).split(path.sep).join("/")
      for (const s of seriesList) {
        const r = reports.find((x) => x.series === s)
        if (r) {
          r.warnings.push(
            `member also in another series: ${rel} (also in ${seriesList.filter((x) => x !== s).join(", ")})`,
          )
        }
      }
    }
  }

  const totalErrors = reports.reduce((a, r) => a + r.errors.length, 0)
  const totalWarnings = reports.reduce((a, r) => a + r.warnings.length, 0)

  if (WANT_JSON) {
    console.log(
      JSON.stringify(
        { reports, totalErrors, totalWarnings },
        null,
        2,
      ),
    )
  } else {
    console.log(`# Series validation`)
    console.log(
      `\n${reports.length} series scanned · ${totalErrors} error(s) · ${totalWarnings} warning(s)\n`,
    )
    for (const r of reports) {
      console.log(`## ${r.series} (${r.members.length} member(s))`)
      if (r.errors.length === 0 && r.warnings.length === 0)
        console.log("  OK\n")
      else {
        for (const e of r.errors) console.log(`  ❌ ${e}`)
        for (const w of r.warnings) console.log(`  ⚠️  ${w}`)
        console.log()
      }
    }
  }
  process.exit(totalErrors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error("validate-series failed:", e)
  process.exit(1)
})
