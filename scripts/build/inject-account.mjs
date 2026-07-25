#!/usr/bin/env node
/**
 * scripts/build/inject-account.mjs
 *
 * Post-build step: wires the account-page hydration module
 * (content/_static/account.js) into the generated account page. The page
 * body is authored in content/account.md (a `[data-fpe-account]` mount);
 * this script only appends the inline config + module <script> tags, so the
 * anon key and derived hrefs stay out of version control's markdown.
 *
 * Configuration is shared with the article widget via engagement.config.mjs.
 * While its `enabled` flag is false or the keys are placeholders, this
 * script logs "disabled" and exits without touching any file — identical
 * contract to inject-engagement.
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
const ACCOUNT_HTML = path.join(PUBLIC_DIR, "account.html")
const MARKER = `id="fpe-account-boot"`

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
    console.log("inject-account: disabled in engagement.config.mjs; skipping.")
    return
  }
  if (
    !config.supabaseUrl ||
    config.supabaseUrl === "REPLACE_ME" ||
    !config.supabaseAnonKey ||
    config.supabaseAnonKey === "REPLACE_ME"
  ) {
    console.log("inject-account: supabaseUrl/supabaseAnonKey unset or REPLACE_ME; skipping.")
    return
  }

  let html
  try {
    html = await fs.readFile(ACCOUNT_HTML, "utf8")
  } catch (e) {
    console.warn(
      `inject-account: ${ACCOUNT_HTML} not found; skipping (is content/account.md published?).`,
    )
    return
  }
  if (html.includes(MARKER)) {
    console.log("inject-account: already injected; skipping.")
    return
  }
  if (!html.includes("data-fpe-account")) {
    console.warn("inject-account: [data-fpe-account] mount not found in account.html; skipping.")
    return
  }

  const { basePath } = await readSiteUrlConfig()
  const base = basePath || ""
  const auth = config.auth || {}
  const cfg = {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    oauthProviders: auth.oauthProviders || [],
    emailMagicLink: !!auth.emailMagicLink,
    articleBase: base,
    contentIndexUrl: `${base}/static/contentIndex.json`,
  }

  const block = [
    `<script ${MARKER}>window.__FPE_ACCOUNT__=${safeJson(cfg)};</script>`,
    `<script type="module" src="${base}/_static/account.js" defer></script>`,
  ].join("\n")

  let next
  if (/<\/article>/i.test(html)) {
    next = html.replace(/(<\/article>)/i, `${block}\n$1`)
  } else if (/<\/body>/i.test(html)) {
    next = html.replace(/(<\/body>)/i, `${block}\n$1`)
  } else {
    console.warn("inject-account: no </article> or </body> anchor; skipping.")
    return
  }

  await fs.writeFile(ACCOUNT_HTML, next, "utf8")
  console.log("inject-account: injected account hydration script.")
}

main().catch((e) => {
  console.error("inject-account failed:", e)
  process.exit(1)
})
