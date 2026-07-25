#!/usr/bin/env node
/**
 * scripts/build/inject-home-personalize.mjs
 *
 * Post-build step (home page only): inserts a `[data-fpe-home-continue]`
 * mount just above the "Recommended Reads" section and wires the
 * personalization module (content/_static/home-personalize.js), which adds a
 * "Continue reading" strip and "Read" badges to home cards for returning /
 * signed-in readers.
 *
 * Runs after inject-home-rail so the right-rail cards exist and can also
 * receive "Read" badges. Configuration is shared via engagement.config.mjs;
 * while disabled or unconfigured it logs "disabled" and touches nothing —
 * identical contract to inject-engagement.
 *
 * Idempotent: re-runs detect the injected marker and skip.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import config from "../../engagement.config.mjs"
import { readSiteUrlConfig } from "./site-url.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const HOME_HTML = path.join(PUBLIC_DIR, "index.html")
const MARKER = `id="fpe-home-personalize"`
const MOUNT_MARKER = `data-fpe-home-continue`

// Insert the Continue-reading mount immediately before the Recommended
// Reads heading Quartz renders as <h2 id="recommended-reads">.
const RECO_RE = /(<h2 id="recommended-reads">)/i

function safeJson(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}

async function main() {
  if (!config.enabled) {
    console.log("inject-home-personalize: disabled in engagement.config.mjs; skipping.")
    return
  }
  if (
    !config.supabaseUrl ||
    config.supabaseUrl === "REPLACE_ME" ||
    !config.supabaseAnonKey ||
    config.supabaseAnonKey === "REPLACE_ME"
  ) {
    console.log(
      "inject-home-personalize: supabaseUrl/supabaseAnonKey unset or REPLACE_ME; skipping.",
    )
    return
  }

  let html
  try {
    html = await fs.readFile(HOME_HTML, "utf8")
  } catch (e) {
    console.warn(`inject-home-personalize: cannot read ${HOME_HTML}; skipping.`)
    return
  }
  if (html.includes(MARKER)) {
    console.log("inject-home-personalize: already injected; skipping.")
    return
  }

  const { basePath } = await readSiteUrlConfig()
  const base = basePath || ""
  const cfg = {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    articleBase: base,
  }

  let next = html

  // 1) Insert the Continue-reading mount before Recommended Reads (if the
  //    section exists — it's authored in content/index.md).
  if (RECO_RE.test(next) && !next.includes(MOUNT_MARKER)) {
    const mount = `<section id="fpe-home-continue" class="fpe-home-continue" ${MOUNT_MARKER} hidden aria-label="Continue reading"></section>\n`
    next = next.replace(RECO_RE, `${mount}$1`)
  }

  // 2) Append the config + module script before </body>.
  const block = [
    `<script ${MARKER}>window.__FPE_HOME__=${safeJson(cfg)};</script>`,
    `<script type="module" src="${base}/_static/home-personalize.js" defer></script>`,
  ].join("\n")
  if (/<\/body>/i.test(next)) {
    next = next.replace(/(<\/body>)/i, `${block}\n$1`)
  } else {
    console.warn("inject-home-personalize: no </body> anchor; skipping.")
    return
  }

  if (next === html) {
    console.log("inject-home-personalize: nothing to change; skipping.")
    return
  }
  await fs.writeFile(HOME_HTML, next, "utf8")
  console.log("inject-home-personalize: injected continue-reading mount + personalization script.")
}

main().catch((e) => {
  console.error("inject-home-personalize failed:", e)
  process.exit(1)
})
