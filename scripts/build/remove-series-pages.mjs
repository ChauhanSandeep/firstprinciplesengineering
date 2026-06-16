#!/usr/bin/env node
/**
 * Remove public pages that used to represent Reading Series.
 *
 * Quartz's FolderPage plugin auto-generates `index.html` for folders even
 * when no vault `index.md` exists. The product decision is that Reading Series
 * are not a public surface, so these former series URLs must 404 rather than
 * falling back to generic folder listings.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")

const REMOVE_PATHS = [
  "02-series",
  "01-fundamentals/01-concepts/01-distributed-systems/index.html",
  "01-fundamentals/01-concepts/01-distributed-systems/index-og-image.webp",
  "01-fundamentals/01-concepts/02-architecture/index.html",
  "01-fundamentals/01-concepts/02-architecture/index-og-image.webp",
  "01-fundamentals/02-databases/01-fundamentals/index.html",
  "01-fundamentals/02-databases/01-fundamentals/index-og-image.webp",
  "01-fundamentals/05-ai-ml/index.html",
  "01-fundamentals/05-ai-ml/index-og-image.webp",
]

let removed = 0
for (const rel of REMOVE_PATHS) {
  const target = path.join(PUBLIC_DIR, rel)
  try {
    await fs.rm(target, { recursive: true, force: true })
    removed++
  } catch (e) {
    console.warn(`remove-series-pages: failed to remove ${rel}: ${e.message}`)
  }
}

console.log(`remove-series-pages: removed ${removed} former series path(s).`)
