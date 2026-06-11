#!/usr/bin/env node
/**
 * validate-home-cards.mjs
 *
 * Guard against the most common way to silently ship a broken front page:
 * homepage Featured / Reading Series cards in `content/index.md` pointing
 * at notes that don't exist (because the target was renamed, unpublished,
 * or never synced from the vault).
 *
 * Rationale
 * ---------
 * Internal wikilinks inside body notes are allowed to 404 by design —
 * this site selectively publishes from a larger private vault, so a
 * dangling `[[Some Note]]` is just "more here that isn't public yet".
 *
 * The hand-curated cards on `index.md` are different: they're the front
 * door. A 404 on a Featured card is a real user-facing bug. This script
 * checks them and only them.
 *
 * What it validates
 * -----------------
 *   <a class="fpe-article-card" href="…">  →  must resolve to a note
 *   <a class="fpe-path-card"    href="…">  →  must resolve to a note or
 *                                              a folder (index.md)
 *
 * Resolution is filesystem-only against `content/`:
 *   `foo/bar`   → `content/foo/bar.md` OR `content/foo/bar/index.md`
 *   `foo/bar/`  → `content/foo/bar/index.md`
 *
 * External URLs (http://, https://, mailto:, #anchor) and the bare
 * `about` link are ignored — those are not vault-backed paths.
 *
 * Exit code
 * ---------
 *   0  all card hrefs resolve
 *   1  one or more cards point at a missing note (build should stop
 *      before deploy)
 *
 * Wired into `npm run build` between `sync` and `quartz build` so the
 * build fails fast — before producing HTML that links to 404s.
 */

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CONTENT_DIR = path.join(ROOT, "content")
const INDEX_MD = path.join(CONTENT_DIR, "index.md")

// Card classes we validate. Anything else on index.md is ignored.
const CARD_CLASSES = ["fpe-article-card", "fpe-path-card"]

// Match `<a class="… fpe-article-card …" … href="…">`. Tolerates other
// classes mixed in, different attribute ordering, and single/double quotes.
const ANCHOR_RE = /<a\b([^>]*)>/gi
const ATTR_RE = (name) =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")

const exists = async (p) => {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

// Is the href something we should skip (not a vault-backed note)?
const isExternal = (href) =>
  /^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)

// Resolve a card href to a candidate filesystem path inside content/.
// Returns the path that exists, or null if neither variant exists.
async function resolveHref(href, cardClass) {
  // Strip leading slash if any; treat as relative to content/.
  const cleaned = href.replace(/^\/+/, "")
  // Path cards with a trailing slash explicitly mean "folder".
  const explicitFolder = cleaned.endsWith("/")
  const stem = explicitFolder ? cleaned.slice(0, -1) : cleaned

  const candidates = []
  if (!explicitFolder) candidates.push(path.join(CONTENT_DIR, `${stem}.md`))
  candidates.push(path.join(CONTENT_DIR, stem, "index.md"))

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate
  }
  return null
}

async function main() {
  if (!(await exists(INDEX_MD))) {
    console.error(`❌ validate-home-cards: ${INDEX_MD} not found.`)
    process.exit(1)
  }

  const src = await fs.readFile(INDEX_MD, "utf8")

  // Pull every <a …> tag, then filter to the ones whose class list
  // contains one of our card classes. Each entry preserves the source
  // class (so we can render a useful error) plus the href.
  const cards = []
  for (const m of src.matchAll(ANCHOR_RE)) {
    const attrs = m[1] || ""
    const classMatch = attrs.match(ATTR_RE("class"))
    const cls = classMatch ? classMatch[1] || classMatch[2] || "" : ""
    const matched = CARD_CLASSES.find((c) => cls.split(/\s+/).includes(c))
    if (!matched) continue
    const hrefMatch = attrs.match(ATTR_RE("href"))
    const href = hrefMatch ? hrefMatch[1] || hrefMatch[2] || "" : ""
    if (!href) {
      cards.push({ cls: matched, href: "", missing: true, reason: "no href" })
      continue
    }
    if (isExternal(href)) continue
    cards.push({ cls: matched, href })
  }

  const broken = []
  for (const card of cards) {
    if (card.missing) {
      broken.push(card)
      continue
    }
    const resolved = await resolveHref(card.href, card.cls)
    if (!resolved) broken.push(card)
  }

  const checked = cards.filter((c) => !c.missing).length
  if (broken.length === 0) {
    console.log(
      `✅ validate-home-cards: all ${checked} homepage card href(s) resolve.`,
    )
    return
  }

  console.error(
    `\n❌ validate-home-cards: ${broken.length} of ${cards.length} homepage card(s) point at missing notes.\n`,
  )
  for (const card of broken) {
    if (card.missing) {
      console.error(`   • ${card.cls}: ${card.reason}`)
      continue
    }
    const cleaned = card.href.replace(/^\/+/, "")
    const explicitFolder = cleaned.endsWith("/")
    const stem = explicitFolder ? cleaned.slice(0, -1) : cleaned
    const triedRel = []
    if (!explicitFolder) triedRel.push(`content/${stem}.md`)
    triedRel.push(`content/${stem}/index.md`)
    console.error(`   • ${card.cls}  href="${card.href}"`)
    console.error(`       tried: ${triedRel.join("  |  ")}`)
  }
  console.error(
    `\nFix: either re-add the missing note(s) to the vault and re-run \`npm run sync\`,\n` +
      `or update the card href(s) in content/index.md to point at a published note.\n`,
  )
  process.exit(1)
}

await main()
