#!/usr/bin/env node
/**
 * scripts/build/trim-search-index.mjs
 *
 * Softens the biggest scaling cliff from the Engineering audit (§1 / §10):
 * `public/static/contentIndex.json` embeds the FULL body of every note, so it
 * grows unbounded per note (~14 KB median, ~52 KB max today) and would reach
 * ~110 MB at ~5,000 notes — enough to make client-side search unusable on
 * mobile.
 *
 * This is the pragmatic mitigation (the structural fix is migrating to a
 * sharded index like Pagefind — deliberately deferred to avoid rewriting the
 * working ⌘K search UI). We:
 *   1. Collapse runs of whitespace in each entry's `content` (search previews
 *      don't need the original line breaks).
 *   2. Cap `content` to SEARCH_CONTENT_CAP characters (default 8000) at a word
 *      boundary. Notes shorter than the cap are untouched.
 *
 * Effect: worst-case per-note index size is bounded instead of unbounded.
 * Trade-off: full-text search only matches within the first ~SEARCH_CONTENT_CAP
 * characters of long notes (the lead + first sections, where the vast majority
 * of query terms occur). Titles and tags remain fully searchable.
 *
 * The `check-index-size.mjs` budget guard (runs after this) stays as the alarm
 * for when even the capped index approaches the point where Pagefind becomes
 * necessary.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..", "..")
const INDEX = path.join(ROOT, "public", "static", "contentIndex.json")

const CAP = Math.max(0, Number(process.env.SEARCH_CONTENT_CAP || 8000))

function capContent(text) {
  const collapsed = String(text).replace(/\s+/g, " ").trim()
  if (CAP === 0 || collapsed.length <= CAP) return { text: collapsed, trimmed: false }
  const cut = collapsed.slice(0, CAP)
  const lastSpace = cut.lastIndexOf(" ")
  const out = (lastSpace > CAP * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s]+$/, "") + "…"
  return { text: out, trimmed: true }
}

async function main() {
  let raw
  try {
    raw = await fs.readFile(INDEX, "utf8")
  } catch {
    console.warn(`trim-search-index: ${INDEX} not found — skipping (run after quartz build).`)
    return
  }
  const beforeKb = Buffer.byteLength(raw) / 1024
  const index = JSON.parse(raw)

  let trimmedCount = 0
  for (const entry of Object.values(index)) {
    if (typeof entry?.content !== "string") continue
    const { text, trimmed } = capContent(entry.content)
    entry.content = text
    if (trimmed) trimmedCount++
  }

  const out = JSON.stringify(index)
  await fs.writeFile(INDEX, out, "utf8")
  const afterKb = Buffer.byteLength(out) / 1024
  const saved = beforeKb - afterKb
  console.log(
    `trim-search-index: cap ${CAP} chars/note — trimmed ${trimmedCount} of ${
      Object.keys(index).length
    } note(s); index ${beforeKb.toFixed(1)} KB → ${afterKb.toFixed(1)} KB ` +
      `(saved ${saved.toFixed(1)} KB, ${((saved / beforeKb) * 100).toFixed(0)}%).`,
  )
}

main().catch((e) => {
  console.error("trim-search-index failed:", e)
  process.exit(1)
})
