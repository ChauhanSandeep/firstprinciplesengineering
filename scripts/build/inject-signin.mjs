#!/usr/bin/env node
/**
 * scripts/build/inject-signin.mjs
 *
 * Post-build step: wires the dedicated sign-in page hydration module
 * (content/_static/signin.js) into the generated /signin page. The page
 * body is authored in content/signin.md (a `[data-fpe-signin]` mount); this
 * script only appends the inline config + module <script> tags, so the anon
 * key and derived hrefs stay out of version-controlled markdown.
 *
 * Configuration is shared with the article widget via engagement.config.mjs.
 * While its `enabled` flag is false or the keys are placeholders, this
 * script logs "disabled" and exits without touching any file — identical
 * contract to inject-account.
 *
 * Idempotent: re-runs detect the injected marker and skip.
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
const SIGNIN_HTML = path.join(PUBLIC_DIR, "signin.html")
const MARKER = `id="fpe-signin-boot"`

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
    console.log("inject-signin: disabled in engagement.config.mjs; skipping.")
    return
  }
  if (
    !config.supabaseUrl ||
    config.supabaseUrl === "REPLACE_ME" ||
    !config.supabaseAnonKey ||
    config.supabaseAnonKey === "REPLACE_ME"
  ) {
    console.log("inject-signin: supabaseUrl/supabaseAnonKey unset or REPLACE_ME; skipping.")
    return
  }

  let html
  try {
    html = await fs.readFile(SIGNIN_HTML, "utf8")
  } catch (e) {
    console.warn(
      `inject-signin: ${SIGNIN_HTML} not found; skipping (is content/signin.md published?).`,
    )
    return
  }
  if (html.includes(MARKER)) {
    console.log("inject-signin: already injected; skipping.")
    return
  }
  if (!html.includes("data-fpe-signin")) {
    console.warn("inject-signin: [data-fpe-signin] mount not found in signin.html; skipping.")
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
    emailPassword: !!auth.emailPassword,
    accountHref: hrefForSlug(base, "account"),
  }

  const block = [
    `<script ${MARKER}>window.__FPE_SIGNIN__=${safeJson(cfg)};</script>`,
    `<script type="module" src="${base}/_static/signin.js" defer></script>`,
  ].join("\n")

  let next
  if (/<\/article>/i.test(html)) {
    next = html.replace(/(<\/article>)/i, `${block}\n$1`)
  } else if (/<\/body>/i.test(html)) {
    next = html.replace(/(<\/body>)/i, `${block}\n$1`)
  } else {
    console.warn("inject-signin: no </article> or </body> anchor; skipping.")
    return
  }

  await fs.writeFile(SIGNIN_HTML, next, "utf8")
  console.log("inject-signin: injected sign-in hydration script.")
}

main().catch((e) => {
  console.error("inject-signin failed:", e)
  process.exit(1)
})
