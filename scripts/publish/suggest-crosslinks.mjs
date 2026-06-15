#!/usr/bin/env node
/**
 * scripts/publish/suggest-crosslinks.mjs
 *
 * Read-only analysis of the vault's published notes. For each note,
 * find candidate places where another published note could be linked
 * but currently isn't. The candidate signal is conservative on
 * purpose:
 *
 *   - Substring match of the candidate's title (>= 6 chars, case
 *     insensitive) against the source note's body text.
 *   - The candidate must be a published note (in content/), not the
 *     source itself, and not already wikilinked from the source.
 *   - The mention must occur OUTSIDE code fences, inline code, and
 *     existing wikilinks/markdown links — to avoid suggesting we
 *     turn a code identifier or a heading anchor into a link.
 *
 * Output: a Markdown report grouped by source note, citing the
 * substring + a small surrounding context window. **Never auto-fixes
 * anything** — manual review in a follow-up vault PR is the point.
 *
 * Why no fuzzy / NLP matching: false positives in cross-link
 * suggestions destroy the signal-to-noise ratio of the report. A
 * conservative literal match keeps the report scannable.
 *
 * Usage:
 *   node scripts/publish/suggest-crosslinks.mjs
 *   node scripts/publish/suggest-crosslinks.mjs --json
 *   node scripts/publish/suggest-crosslinks.mjs --out crosslinks.md
 *   node scripts/publish/suggest-crosslinks.mjs --min-title 8
 *   node scripts/publish/suggest-crosslinks.mjs --per-note 3
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import matter from "gray-matter"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const CONTENT_DIR = path.join(SITE_ROOT, "content")

const args = process.argv.slice(2)
function flag(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}
const MIN_TITLE = parseInt(flag("--min-title", "6"), 10)
const PER_NOTE = parseInt(flag("--per-note", "5"), 10)
const WANT_JSON = args.includes("--json")
const OUT_PATH = flag("--out", null)

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

/**
 * Replace code fences, inline code, wikilinks, and markdown links with
 * spaces of the same length. Preserves indices so a downstream
 * `indexOf` reports a real offset into the original body — useful for
 * citing line numbers.
 */
function maskNonProse(body) {
  let out = body
  // Triple-backtick fences (greedy across lines)
  out = out.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length))
  // Inline code `…`
  out = out.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length))
  // Wikilinks [[…]] (including aliased and embedded)
  out = out.replace(/!?\[\[[^\]]*\]\]/g, (m) => " ".repeat(m.length))
  // Markdown links [text](url)
  out = out.replace(/\[[^\]]*\]\([^)]*\)/g, (m) => " ".repeat(m.length))
  // HTML tags
  out = out.replace(/<[^>]+>/g, (m) => " ".repeat(m.length))
  return out
}

function titleFromFrontmatter(fm, fallbackStem) {
  if (fm && typeof fm.title === "string" && fm.title.trim()) return fm.title.trim()
  return fallbackStem
}

function lineAt(body, idx) {
  let line = 1
  for (let i = 0; i < idx && i < body.length; i++) {
    if (body[i] === "\n") line++
  }
  return line
}

function contextWindow(body, idx, len, span = 60) {
  const start = Math.max(0, idx - span)
  const end = Math.min(body.length, idx + len + span)
  let snippet = body.slice(start, end).replace(/\n+/g, " ").trim()
  if (start > 0) snippet = "…" + snippet
  if (end < body.length) snippet = snippet + "…"
  return snippet
}

async function main() {
  const files = (await walkMd(CONTENT_DIR)).filter(
    (f) => !path.basename(f).startsWith("_"),
  )

  const notes = []
  for (const abs of files) {
    const raw = await fs.readFile(abs, "utf8")
    let parsed
    try {
      parsed = matter(raw)
    } catch {
      continue
    }
    const rel = path.relative(CONTENT_DIR, abs).split(path.sep).join("/")
    const stem = path.basename(rel, ".md")
    const title = titleFromFrontmatter(parsed.data, stem)
    notes.push({
      rel,
      stem,
      title,
      body: parsed.content,
      masked: maskNonProse(parsed.content),
      titleLower: title.toLowerCase(),
    })
  }

  // Eligible candidate titles: at least MIN_TITLE chars after trimming,
  // and not a top-level index page (those are landing pages — linking
  // their title from arbitrary prose is usually wrong).
  const candidates = notes.filter(
    (n) => n.title.length >= MIN_TITLE && n.stem !== "index",
  )

  const suggestions = []
  for (const source of notes) {
    const hits = []
    for (const cand of candidates) {
      if (cand.rel === source.rel) continue
      const needle = cand.titleLower
      let pos = 0
      const matches = []
      while ((pos = source.masked.toLowerCase().indexOf(needle, pos)) !== -1) {
        matches.push(pos)
        pos += needle.length
      }
      if (matches.length === 0) continue
      // Only the first match per candidate — many matches = the source
      // is *about* that topic and probably shouldn't be re-linked.
      const idx = matches[0]
      hits.push({
        candidate: cand,
        line: lineAt(source.body, idx),
        snippet: contextWindow(source.body, idx, cand.title.length),
      })
    }
    if (hits.length === 0) continue
    // Keep top-N per source for review tractability; rank by candidate
    // title length descending (longer matches are more specific).
    hits.sort((a, b) => b.candidate.title.length - a.candidate.title.length)
    suggestions.push({ source, hits: hits.slice(0, PER_NOTE) })
  }

  if (WANT_JSON) {
    const json = suggestions.map((s) => ({
      source: s.source.rel,
      title: s.source.title,
      hits: s.hits.map((h) => ({
        candidate: h.candidate.rel,
        candidateTitle: h.candidate.title,
        line: h.line,
        snippet: h.snippet,
      })),
    }))
    const out = JSON.stringify(json, null, 2)
    if (OUT_PATH) await fs.writeFile(OUT_PATH, out, "utf8")
    else console.log(out)
    return
  }

  const lines = []
  lines.push(`# Cross-link suggestions`, "")
  lines.push(
    `Scanned **${notes.length}** published notes; **${candidates.length}** are eligible candidates (title >= ${MIN_TITLE} chars, non-index). **${suggestions.length}** source notes have at least one suggestion. Top ${PER_NOTE} per source by candidate-title length.`,
    "",
  )
  lines.push(
    `Heuristic: literal title match in prose (outside code, wikilinks, and HTML). False positives expected — this is a triage list, not an auto-fix. Manual review only.`,
    "",
  )
  if (suggestions.length === 0) {
    lines.push("No suggestions. 🎉", "")
  } else {
    for (const { source, hits } of suggestions) {
      lines.push(`## \`${source.rel}\` — ${source.title}`, "")
      for (const h of hits) {
        lines.push(
          `- Line ${h.line}: link to **[[${h.candidate.stem}|${h.candidate.title}]]**`,
        )
        lines.push(`  > ${h.snippet}`)
      }
      lines.push("")
    }
  }
  const out = lines.join("\n")
  if (OUT_PATH) {
    await fs.writeFile(OUT_PATH, out, "utf8")
    console.log(`suggest-crosslinks: wrote ${OUT_PATH}`)
  } else {
    console.log(out)
  }
}

main().catch((e) => {
  console.error("suggest-crosslinks failed:", e)
  process.exit(1)
})
