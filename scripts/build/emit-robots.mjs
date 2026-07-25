#!/usr/bin/env node
/**
 * scripts/build/emit-robots.mjs
 *
 * Emit a root-level `public/robots.txt` (Engineering audit §7). Quartz emits
 * `sitemap.xml`/`index.xml` but no robots.txt, so crawlers have no explicit
 * allow/sitemap directive. We generate one at build time, deriving the sitemap
 * URL from `baseUrl` in quartz.config.yaml so it stays correct if the domain
 * ever changes.
 *
 * Idempotent: overwrites the file with the same deterministic content each run.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(ROOT, "public")
const CONFIG = path.join(ROOT, "quartz.config.yaml")

async function baseUrl() {
  const raw = await fs.readFile(CONFIG, "utf8")
  const m = raw.match(/^\s*baseUrl:\s*["']?([^"'\s]+)["']?\s*$/m)
  if (!m) throw new Error("could not parse baseUrl from quartz.config.yaml")
  return m[1].replace(/\/+$/, "")
}

async function main() {
  const domain = await baseUrl()
  const sitemap = `https://${domain}/sitemap.xml`
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemap}`,
    "",
  ].join("\n")
  const out = path.join(PUBLIC_DIR, "robots.txt")
  await fs.writeFile(out, body, "utf8")
  console.log(`emit-robots: wrote ${out} (sitemap ${sitemap})`)
}

main().catch((e) => {
  console.error("emit-robots failed:", e)
  process.exit(1)
})
