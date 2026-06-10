#!/usr/bin/env node
/**
 * scripts/publish/discover.mjs
 *
 * Phase 1 of the quartz-publish-notes skill. Walks the Obsidian vault, parses each
 * note's frontmatter, applies the same publish rules the sync script does,
 * and classifies every candidate against the current content/ directory.
 *
 * Output: a single JSON object to stdout.
 *
 * Schema:
 *   {
 *     vaultRoot: string,
 *     contentRoot: string,
 *     candidates: [{
 *       vaultPath, vaultAbs, contentPath, contentAbs, slug,
 *       frontmatter, status: 'new'|'changed'|'unchanged',
 *       publishSource: 'flag'|'folder',
 *       featured: bool, series: string|null, seriesOrder: number|null,
 *       card: { eyebrow, title, description, order } | null,
 *     }],
 *     removed: [{ contentPath, reason }],
 *     stats: { ... }
 *   }
 *
 * No side effects — read-only by design.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import matter from "gray-matter"
import { minimatch } from "minimatch"
import publishConfig from "../../publish.config.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const QUARTZ_ROOT = path.resolve(__dirname, "..", "..")
const VAULT_ROOT = path.resolve(
  QUARTZ_ROOT,
  process.env.QUARTZ_VAULT_ROOT || publishConfig.vaultRoot || "..",
)
const CONTENT_DIR = path.join(QUARTZ_ROOT, "content")
const MANIFEST_PATH = path.join(
  VAULT_ROOT,
  publishConfig.manifestFile || "PUBLISH.md",
)

// Mirror sync-from-vault.mjs's VAULT_IGNORE so discover sees exactly the same
// files the sync would consider.
const VAULT_IGNORE = new Set([
  ".git",
  ".github",
  ".obsidian",
  ".trash",
  ".venv",
  ".claude",
  ".claudian",
  "node_modules",
  "quartz",
  "ObsidianNotes",
  "__pycache__",
  "templates",
  "_drafts",
  "_scratch",
  "scratch",
  "drafts",
  "private",
])

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function walk(dir, base = dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (VAULT_IGNORE.has(e.name)) continue
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walk(abs, base)))
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push({ abs, rel: path.relative(base, abs).split(path.sep).join("/") })
    }
  }
  return out
}

async function loadManifestPatterns() {
  if (!(await exists(MANIFEST_PATH))) return []
  const raw = await fs.readFile(MANIFEST_PATH, "utf8")
  const fm = matter(raw).data || {}
  const list = fm.publish ?? fm.publishFolders ?? fm.paths ?? []
  if (!Array.isArray(list)) return []
  return list
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s && !s.startsWith("#"))
}

function deriveSlug(relPath) {
  // Sync preserves the vault path verbatim in content/ and lowercases for
  // URL slugs at build time via Quartz's path util. For diff classification
  // we use the exact path (case preserved) since that's what lands on disk.
  return relPath.replace(/\.md$/, "").toLowerCase().replace(/\s+/g, "-")
}

function eyebrowFromPath(relPath) {
  // First non-numeric folder segment, prettified.
  // e.g. 01-Fundamentals/05-AI-ML/04-RAG-Architecture.md → "AI ML"
  // We pick the last folder segment to match the visible category in URLs.
  const parts = relPath.split("/")
  parts.pop() // drop filename
  if (parts.length === 0) return ""
  const seg = parts[parts.length - 1]
  return seg.replace(/^\d+[-_]/, "").replace(/[-_]/g, " ").trim()
}

function shouldPublish(rel, fm, manifestPatterns) {
  if (fm?.publish === false) return { publish: false, source: null }
  if (fm?.publish === true) return { publish: true, source: "flag" }
  const matched = manifestPatterns.some((p) => minimatch(rel, p, { dot: false }))
  if (matched) return { publish: true, source: "folder" }
  return { publish: false, source: null }
}

async function classifyStatus(vaultAbs, contentAbs) {
  // Sync uses fs.copyFile, which preserves mtime. So vault mtime === content
  // mtime right after a sync. If the user edits the vault file, vault mtime
  // advances past content mtime. This is much more reliable than content-hash
  // diffing because the sync rewrites wikilinks, injects `publish: true`,
  // strips duplicate H1s, etc. — none of which we want to re-implement here.
  try {
    const [vStat, cStat] = await Promise.all([
      fs.stat(vaultAbs),
      fs.stat(contentAbs),
    ])
    if (vStat.mtimeMs > cStat.mtimeMs + 1) return "changed"
    return "unchanged"
  } catch {
    return "new"
  }
}

async function main() {
  const manifestPatterns = await loadManifestPatterns()
  const allMds = await walk(VAULT_ROOT)

  const candidates = []
  const skipped = []
  let parseFailures = 0

  for (const f of allMds) {
    if (f.rel === (publishConfig.manifestFile || "PUBLISH.md")) continue
    if (f.rel.endsWith(".excalidraw.md")) continue

    let parsed
    try {
      const raw = await fs.readFile(f.abs, "utf8")
      parsed = matter(raw)
    } catch (e) {
      parseFailures++
      skipped.push({ vaultPath: f.rel, reason: `frontmatter parse: ${e.message}` })
      continue
    }

    const decision = shouldPublish(f.rel, parsed.data, manifestPatterns)
    if (!decision.publish) {
      skipped.push({
        vaultPath: f.rel,
        reason: parsed.data?.publish === false ? "publish:false" : "not publishable",
      })
      continue
    }

    const contentPath = f.rel
    const contentAbs = path.join(CONTENT_DIR, contentPath)
    const status = await classifyStatus(f.abs, contentAbs)

    const fm = parsed.data || {}
    const featured = fm.featured === true
    const series = typeof fm.series === "string" ? fm.series.trim() : null
    const seriesOrder = Number.isFinite(fm.series_order)
      ? fm.series_order
      : null

    // Card metadata: explicit fm keys override; otherwise we leave nulls and
    // let the skill draft them in-context (drafting is judgement work, not
    // deterministic enough for this script).
    const card =
      featured || series
        ? {
            eyebrow:
              typeof fm.card_eyebrow === "string"
                ? fm.card_eyebrow
                : eyebrowFromPath(f.rel),
            title: typeof fm.card_title === "string" ? fm.card_title : null,
            description:
              typeof fm.card_description === "string"
                ? fm.card_description
                : null,
            order: Number.isFinite(fm.card_order) ? fm.card_order : null,
          }
        : null

    candidates.push({
      vaultPath: f.rel,
      vaultAbs: f.abs,
      contentPath,
      contentAbs,
      slug: deriveSlug(f.rel),
      frontmatter: fm,
      status,
      publishSource: decision.source,
      featured,
      series,
      seriesOrder,
      card,
    })
  }

  // Removed = files that currently live in content/ but aren't backed by a
  // publishable vault file. We only check content/**/*.md (excluding the
  // hand-maintained preserved files).
  const PRESERVE = new Set(["index.md", "about.md", "_static"])
  const candidateContentPaths = new Set(candidates.map((c) => c.contentPath))
  const removed = []
  async function walkContent(dir, base = CONTENT_DIR) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (dir === CONTENT_DIR && PRESERVE.has(e.name)) continue
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walkContent(abs, base)
      } else if (e.isFile() && e.name.endsWith(".md")) {
        const rel = path.relative(base, abs).split(path.sep).join("/")
        if (!candidateContentPaths.has(rel)) {
          removed.push({
            contentPath: rel,
            reason: "no matching publishable vault note",
          })
        }
      }
    }
  }
  await walkContent(CONTENT_DIR)

  const counts = {
    parsed: allMds.length,
    candidates: candidates.length,
    new: candidates.filter((c) => c.status === "new").length,
    changed: candidates.filter((c) => c.status === "changed").length,
    unchanged: candidates.filter((c) => c.status === "unchanged").length,
    skipped: skipped.length,
    removed: removed.length,
    parseFailures,
  }

  process.stdout.write(
    JSON.stringify(
      {
        vaultRoot: VAULT_ROOT,
        contentRoot: CONTENT_DIR,
        candidates,
        removed,
        skipped,
        stats: counts,
      },
      null,
      2,
    ) + "\n",
  )
}

main().catch((e) => {
  process.stderr.write(`discover failed: ${e.stack || e.message}\n`)
  process.exit(1)
})
