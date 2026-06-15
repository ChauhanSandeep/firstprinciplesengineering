#!/usr/bin/env node
/**
 * scripts/build/inject-search-hint.mjs
 *
 * Replace the Quartz Search component's default placeholder ("Search
 * for something...") with a richer hint that nudges visitors to try
 * a few topics that exist on the site. Done post-build because the
 * Search component ships from the @quartz-community/plugin-search
 * package whose i18n is bundled and gitignored — editing it locally
 * would not survive a `npx quartz plugin install`.
 *
 * Replaces a single, well-known string. Idempotent (skips files that
 * already use the new placeholder). No-op on pages without the
 * Search input.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.resolve(__dirname, "..", "..", "public")

const DEFAULT_PLACEHOLDER = "Search for something..."
const NEW_PLACEHOLDER = "Try: MVCC, RAG, consistent hashing…"
// aria-label uses the same string in Quartz's Search component, so we
// flip both occurrences. Match the html attribute form so we don't
// touch any unrelated prose that happens to contain the phrase.
const NEEDLES = [
  [`placeholder="${DEFAULT_PLACEHOLDER}"`, `placeholder="${NEW_PLACEHOLDER}"`],
  [
    `aria-label="${DEFAULT_PLACEHOLDER}"`,
    `aria-label="${NEW_PLACEHOLDER}"`,
  ],
]

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

async function main() {
  const pages = await walkHtml(PUBLIC_DIR)
  let updated = 0
  for (const abs of pages) {
    const html = await fs.readFile(abs, "utf8")
    let next = html
    for (const [from, to] of NEEDLES) {
      if (next.includes(from)) next = next.split(from).join(to)
    }
    if (next !== html) {
      await fs.writeFile(abs, next, "utf8")
      updated++
    }
  }
  console.log(`inject-search-hint: updated ${updated} page(s).`)
}

main().catch((e) => {
  console.error("inject-search-hint failed:", e)
  process.exit(1)
})
