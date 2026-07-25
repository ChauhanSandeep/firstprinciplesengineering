#!/usr/bin/env node
/**
 * scripts/build/inject-analytics.mjs
 *
 * Post-build step: appends a Plausible script tag into the <head> of
 * every HTML file under public/. Reads its config from
 * `analytics.config.mjs` at the repo root; when `enabled: false` (the
 * default), it logs and exits without touching any file.
 *
 * Tag emitted:
 *   <script defer
 *           data-domain="{domain}"
 *           src="{scriptHost}/js/{scriptName}"></script>
 *
 * Plus a small inline shim so `plausible(...)` is safe to call before
 * the deferred script has executed (custom-event queueing pattern
 * recommended by Plausible's docs).
 *
 * Idempotent — re-runs detect `data-fpe-analytics="true"` and skip.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import config from "../../analytics.config.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const MARKER_ATTR = `data-fpe-analytics="true"`

// Insert before </head>.
const HEAD_END_RE = /<\/head>/i

function escapeAttr(s) {
  return String(s).replace(/"/g, "&quot;")
}

function renderTag() {
  const src = `${config.scriptHost.replace(/\/$/, "")}/js/${config.scriptName}`
  return [
    `<script ${MARKER_ATTR} defer data-domain="${escapeAttr(config.domain)}" src="${escapeAttr(src)}"></script>`,
    // Queueing shim so `plausible('Some Event')` calls placed inline
    // anywhere in the document don't lose data while the deferred
    // bundle is still downloading.
    `<script ${MARKER_ATTR}>window.plausible = window.plausible || function() { (window.plausible.q = window.plausible.q || []).push(arguments) }</script>`,
    // Error beacon: uncaught errors + unhandled promise rejections are
    // reported as Plausible custom events (needs a *.tagged-events.js
    // bundle, which analytics.config.mjs uses by default). Messages are
    // truncated and only the path (never query/hash) is sent — no PII.
    // Silently no-ops when Plausible is disabled (the shim just queues).
    `<script ${MARKER_ATTR}>(function(){function r(n,m){try{window.plausible&&window.plausible(n,{props:{m:String(m||"unknown").slice(0,200),p:location.pathname}})}catch(e){}}window.addEventListener("error",function(e){r("JS Error",e&&e.message)});window.addEventListener("unhandledrejection",function(e){var x=e&&e.reason;r("Promise Rejection",x&&(x.message||x))})})();</script>`,
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

async function inject(abs, block) {
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER_ATTR)) return { skipped: "already" }
  if (!HEAD_END_RE.test(html)) return { skipped: "no-head" }
  const next = html.replace(HEAD_END_RE, `${block}\n</head>`)
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true }
}

async function main() {
  if (!config.enabled) {
    console.log("inject-analytics: analytics disabled in analytics.config.mjs; skipping.")
    return
  }
  const block = renderTag()
  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const r = await inject(abs, block)
    if (r.injected) injected++
    else skipped++
  }
  console.log(`inject-analytics: injected into ${injected} page(s); skipped ${skipped}.`)
}

main().catch((e) => {
  console.error("inject-analytics failed:", e)
  process.exit(1)
})
