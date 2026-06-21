import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const QUARTZ_CONFIG = path.join(SITE_ROOT, "quartz.config.yaml")

export async function readSiteUrlConfig() {
  const raw = await fs.readFile(QUARTZ_CONFIG, "utf8")
  const match = raw.match(/^\s*baseUrl:\s*["']?([^"'\s]+)["']?\s*$/m)
  if (!match) {
    throw new Error(`could not parse baseUrl from ${QUARTZ_CONFIG}`)
  }

  const baseUrl = match[1].replace(/^https?:\/\//, "").replace(/\/+$/, "")
  const pathname = new URL(`https://${baseUrl}`).pathname.replace(/\/$/, "")
  const basePath = pathname === "/" ? "" : pathname

  return { baseUrl, basePath }
}

export function hrefForSlug(basePath, slug) {
  return `${basePath}/${slug}`
}

export function hrefForRootAnchor(basePath, anchor) {
  return `${basePath || ""}/#${anchor}`
}

export function siteUrlForSlug(baseUrl, slug) {
  return new URL(slug, `https://${baseUrl}/`).toString()
}
