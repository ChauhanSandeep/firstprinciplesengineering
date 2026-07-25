#!/usr/bin/env node
/**
 * scripts/build/inject-header-auth.mjs
 *
 * Post-build step: mounts the global account/auth chip (content/_static/
 * header-auth.js) into the full-width top navigation bar of EVERY generated
 * page, at the right edge (.fpe-topbar-actions). Signed-out readers see a
 * "Sign in" button; signed-in readers see their avatar + name with a menu
 * linking to the /account page and a sign-out action.
 *
 * Configuration is shared with the article widget via engagement.config.mjs
 * (same Supabase URL + anon key + OAuth providers). While its `enabled`
 * flag is false or the keys are placeholders, this script logs "disabled"
 * and exits without touching any file — identical contract to
 * inject-engagement.
 *
 *   <span id="fpe-authchip" class="fpe-authchip" data-fpe-authchip></span>
 *   <script>window.__FPE_AUTHCHIP__ = { …config… }</script>
 *   <script type="module" src="/_static/header-auth.js" defer></script>
 *
 * Idempotent: re-runs detect `id="fpe-authchip"` and skip.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import config from "../../engagement.config.mjs"
import { hrefForSlug, readSiteUrlConfig } from "./site-url.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const MARKER = `id="fpe-authchip"`

// Inject inside the top bar's actions cluster
// (<div class="fpe-topbar-actions" data-fpe-topbar-actions>) that DefaultFrame
// renders at the right edge of the full-width top navigation bar on every page.
const TITLE_END_RE = /(<div class="fpe-topbar-actions"[^>]*>)/i

function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

function renderBlock(cfg) {
  return [
    `<span ${MARKER} class="fpe-authchip" data-fpe-authchip aria-label="Account"></span>`,
    `<script>window.__FPE_AUTHCHIP__=${safeJson(cfg)};</script>`,
    `<script type="module" src="${cfg.moduleSrc}" defer></script>`,
  ].join("\n")
}

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

async function inject(abs, cfg) {
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
  if (!TITLE_END_RE.test(html)) return { skipped: "no-anchor" }
  const block = renderBlock(cfg)
  const next = html.replace(TITLE_END_RE, `$1\n${block}\n`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true }
}

async function main() {
  if (!config.enabled) {
    console.log("inject-header-auth: disabled in engagement.config.mjs; skipping.")
    return
  }
  if (
    !config.supabaseUrl ||
    config.supabaseUrl === "REPLACE_ME" ||
    !config.supabaseAnonKey ||
    config.supabaseAnonKey === "REPLACE_ME"
  ) {
    console.log("inject-header-auth: supabaseUrl/supabaseAnonKey unset or REPLACE_ME; skipping.")
    return
  }

  const siteUrlConfig = await readSiteUrlConfig()
  const basePath = siteUrlConfig.basePath || ""
  const auth = config.auth || {}
  const cfg = {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    oauthProviders: auth.oauthProviders || [],
    emailMagicLink: !!auth.emailMagicLink,
    emailPassword: !!auth.emailPassword,
    accountHref: hrefForSlug(basePath, "account"),
    moduleSrc: `${basePath}/_static/header-auth.js`,
  }

  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const r = await inject(abs, cfg)
    if (r.injected) injected++
    else skipped++
  }
  console.log(`inject-header-auth: injected into ${injected} page(s); skipped ${skipped}.`)
}

main().catch((e) => {
  console.error("inject-header-auth failed:", e)
  process.exit(1)
})
