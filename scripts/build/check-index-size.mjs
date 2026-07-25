#!/usr/bin/env node
/**
 * scripts/build/check-index-size.mjs
 *
 * Early-warning alarm for the biggest scaling cliff in the Engineering audit
 * (§1 / §10): `public/static/contentIndex.json` embeds the full body of every
 * note, so it grows linearly with the corpus (~23 KB/note today). At ~500 notes
 * it is ~11 MB; at ~5,000 notes ~110 MB — enough to make client-side search
 * unusable on mobile. This check fails the build if the index exceeds a budget,
 * so the regression is caught long before users feel it.
 *
 * Budget can be overridden with CONTENT_INDEX_BUDGET_KB. Default 3072 KB (3 MB)
 * — comfortably above today's ~1.2 MB, tripping well before the ~11 MB pain.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..", "..")
const INDEX = path.join(ROOT, "public", "static", "contentIndex.json")

const BUDGET_KB = Number(process.env.CONTENT_INDEX_BUDGET_KB || 3072)

async function main() {
  let stat
  try {
    stat = await fs.stat(INDEX)
  } catch {
    console.warn(`check-index-size: ${INDEX} not found — skipping (run after quartz build).`)
    return
  }
  const kb = stat.size / 1024
  const pct = ((kb / BUDGET_KB) * 100).toFixed(0)
  const line = `check-index-size: contentIndex.json = ${kb.toFixed(1)} KB (budget ${BUDGET_KB} KB, ${pct}% used)`
  if (kb > BUDGET_KB) {
    console.error(
      `${line}\n` +
        `❌ Search index exceeds budget. The full note body is embedded per entry; ` +
        `move to a sharded index (e.g. Pagefind) or strip the "content" field before this ships.`,
    )
    process.exit(1)
  }
  if (kb > BUDGET_KB * 0.7) {
    console.warn(`${line}\n⚠️  Over 70% of budget — plan the Pagefind migration soon.`)
  } else {
    console.log(line)
  }
}

main().catch((e) => {
  console.error("check-index-size failed:", e)
  process.exit(1)
})
