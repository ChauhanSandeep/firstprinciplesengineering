#!/usr/bin/env node
/**
 * scripts/build/inject-comments.mjs
 *
 * Post-build step: appends a Giscus comments mount to every article
 * page in `public/`. Configuration lives in `comments.config.mjs` at
 * the repo root — until that file's `enabled: true` flag flips and
 * the placeholder IDs are replaced with real ones, this script logs
 * "comments disabled" and exits without touching any file.
 *
 * Insertion point: immediately after the `<aside id="fpe-prev-next-
 * related">` block from Phase 3 (so the conversational footer reads
 * top-down as "you just finished this · here's what's next · here's
 * the discussion"). Falls back to inserting before `</article>` if
 * the Phase 3 aside isn't found.
 *
 * What gets injected:
 *
 *   <section id="fpe-comments" class="fpe-comments">
 *     <h2>Discussion</h2>
 *     <p>…fallback link to the GitHub Discussions thread…</p>
 *     <div class="fpe-comments-mount"></div>
 *   </section>
 *   <script>
 *     // Lazy-loads the Giscus client when the mount enters the
 *     // viewport. Re-themes the iframe when the page's data-theme
 *     // attribute changes (so dark-mode toggle is reflected).
 *   </script>
 *
 * The Giscus iframe is loaded lazily via IntersectionObserver — page
 * weight on first paint is unchanged. The fallback "Discuss on
 * GitHub" link is rendered as plain HTML and works without JS.
 *
 * Skipped: home, about, 404, all landing/index/tag pages, and series
 * landings. Comments belong on the article you finished reading, not
 * on a list page.
 */
import fs from "node:fs/promises"
import path from "node:path"
import url from "node:url"
import config from "../../comments.config.mjs"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SITE_ROOT = path.resolve(__dirname, "..", "..")
const PUBLIC_DIR = path.join(SITE_ROOT, "public")
const MARKER = `id="fpe-comments"`

const SKIP_SLUG_RE = [
  /^index$/,
  /^about$/,
  /^404$/,
  /\/index$/,
  /^tags(\/|$)/,
]

const PREV_NEXT_END_RE =
  /(<\/aside>\s*)(?=(?:<[^>]+>\s*)*<\/article>|<\/article>)/i
const ARTICLE_END_RE = /(<\/article>)/i

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderDiscussCtaBlock() {
  const d = config.discuss || {}
  const buttons = []
  if (d.linkedinUrl) {
    buttons.push(
      `    <a class="fpe-discuss-link fpe-discuss-linkedin" href="${escapeHtml(d.linkedinUrl)}" target="_blank" rel="noopener">` +
        `<span class="fpe-discuss-icon" aria-hidden="true">` +
          `<svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5V9h3v10zM6.5 7.7A1.7 1.7 0 1 1 6.5 4.3a1.7 1.7 0 0 1 0 3.4zM19 19h-3v-5c0-1.2-.5-2-1.6-2-1.2 0-1.9.8-1.9 2v5h-3V9h2.9v1.3A3.4 3.4 0 0 1 15.6 9c2.1 0 3.4 1.4 3.4 4v6z"/></svg>` +
        `</span>` +
        `<span class="fpe-discuss-label">Message on LinkedIn</span>` +
      `</a>`,
    )
  }
  if (d.email) {
    buttons.push(
      `    <a class="fpe-discuss-link fpe-discuss-email" href="mailto:${escapeHtml(d.email)}">` +
        `<span class="fpe-discuss-icon" aria-hidden="true">` +
          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>` +
        `</span>` +
        `<span class="fpe-discuss-label">Send an email</span>` +
      `</a>`,
    )
  }
  if (d.githubRepo) {
    const repoUrl = `https://github.com/${d.githubRepo}/issues/new`
    buttons.push(
      `    <a class="fpe-discuss-link fpe-discuss-github" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener">` +
        `<span class="fpe-discuss-icon" aria-hidden="true">` +
          `<svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d="M12 1a11 11 0 0 0-3.5 21.4c.55.1.75-.24.75-.53v-1.8c-3.06.67-3.7-1.48-3.7-1.48-.5-1.27-1.22-1.6-1.22-1.6-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.69 2.58 1.2 3.21.92.1-.72.39-1.21.7-1.49-2.45-.28-5.02-1.22-5.02-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.4 10.4 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.51.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.14-5.04 5.42.4.34.75 1.02.75 2.06v3.05c0 .3.2.64.76.53A11 11 0 0 0 12 1z"/></svg>` +
        `</span>` +
        `<span class="fpe-discuss-label">Open an issue on GitHub</span>` +
      `</a>`,
    )
  }
  return [
    `<section ${MARKER} class="fpe-discuss-cta" aria-label="Discussion">`,
    `  <h2 class="fpe-discuss-heading">Have a question or a correction?</h2>`,
    `  <p class="fpe-discuss-lede">These notes are learning in public. If something is wrong, unclear, or contradicts your production experience, I'd genuinely like to hear about it.</p>`,
    `  <div class="fpe-discuss-links">`,
    ...buttons,
    `  </div>`,
    `</section>`,
  ].join("\n")
}

function renderCommentsBlock() {
  const repoQuoted = escapeHtml(config.repo)
  const repoIdQ = escapeHtml(config.repoId)
  const catQ = escapeHtml(config.category)
  const catIdQ = escapeHtml(config.categoryId)
  const themeQ = escapeHtml(config.theme)
  const mappingQ = escapeHtml(config.mapping)
  const strictQ = escapeHtml(config.strict)
  const reactionsQ = escapeHtml(config.reactionsEnabled)
  const emitQ = escapeHtml(config.emitMetadata)
  const inputPosQ = escapeHtml(config.inputPosition)
  const loadingQ = escapeHtml(config.loading)
  const discussionsUrl = `https://github.com/${config.repo}/discussions`

  return [
    `<section ${MARKER} class="fpe-comments" aria-label="Discussion">`,
    `  <h2 class="fpe-comments-heading">Discussion</h2>`,
    `  <p class="fpe-comments-fallback">`,
    `    Have a correction or a counter-argument?`,
    `    <a href="${escapeHtml(discussionsUrl)}" rel="noopener" target="_blank">Discuss on GitHub →</a>`,
    `  </p>`,
    `  <div class="fpe-comments-mount" data-fpe-comments`,
    `       data-repo="${repoQuoted}"`,
    `       data-repo-id="${repoIdQ}"`,
    `       data-category="${catQ}"`,
    `       data-category-id="${catIdQ}"`,
    `       data-mapping="${mappingQ}"`,
    `       data-strict="${strictQ}"`,
    `       data-reactions-enabled="${reactionsQ}"`,
    `       data-emit-metadata="${emitQ}"`,
    `       data-input-position="${inputPosQ}"`,
    `       data-theme="${themeQ}"`,
    `       data-loading="${loadingQ}"></div>`,
    `</section>`,
    `<script>`,
    `(function(){`,
    `  var mount = document.querySelector("[data-fpe-comments]");`,
    `  if (!mount) return;`,
    `  function load(){`,
    `    if (mount.dataset.loaded === "1") return;`,
    `    mount.dataset.loaded = "1";`,
    `    var s = document.createElement("script");`,
    `    s.src = "https://giscus.app/client.js";`,
    `    s.crossOrigin = "anonymous";`,
    `    s.async = true;`,
    `    s.setAttribute("data-repo", mount.dataset.repo);`,
    `    s.setAttribute("data-repo-id", mount.dataset.repoId);`,
    `    s.setAttribute("data-category", mount.dataset.category);`,
    `    s.setAttribute("data-category-id", mount.dataset.categoryId);`,
    `    s.setAttribute("data-mapping", mount.dataset.mapping);`,
    `    s.setAttribute("data-strict", mount.dataset.strict);`,
    `    s.setAttribute("data-reactions-enabled", mount.dataset.reactionsEnabled);`,
    `    s.setAttribute("data-emit-metadata", mount.dataset.emitMetadata);`,
    `    s.setAttribute("data-input-position", mount.dataset.inputPosition);`,
    `    s.setAttribute("data-theme", mount.dataset.theme);`,
    `    s.setAttribute("data-loading", mount.dataset.loading);`,
    `    mount.appendChild(s);`,
    `  }`,
    `  // Lazy-load when the mount nears the viewport.`,
    `  if ("IntersectionObserver" in window){`,
    `    var io = new IntersectionObserver(function(es){`,
    `      es.forEach(function(e){ if (e.isIntersecting){ load(); io.disconnect(); } });`,
    `    }, { rootMargin: "200px 0px" });`,
    `    io.observe(mount);`,
    `  } else { load(); }`,
    `  // Re-theme the iframe when the page theme toggles.`,
    `  function postTheme(){`,
    `    var iframe = document.querySelector("iframe.giscus-frame");`,
    `    if (!iframe) return;`,
    `    var theme = document.documentElement.getAttribute("saved-theme") === "dark" ? "dark" : "light";`,
    `    iframe.contentWindow.postMessage({ giscus: { setConfig: { theme: theme } } }, "https://giscus.app");`,
    `  }`,
    `  var mo = new MutationObserver(postTheme);`,
    `  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["saved-theme"] });`,
    `})();`,
    `</script>`,
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

function slugFromHtml(abs) {
  const rel = path.relative(PUBLIC_DIR, abs)
  return rel.replace(/\.html$/, "").split(path.sep).join("/").toLowerCase()
}

function renderCusdisBlock({ slug, title }) {
  const appId = escapeHtml(config.cusdisAppId)
  const host = escapeHtml(config.cusdisHost || "https://cusdis.com")
  const pageId = escapeHtml(slug)
  const pageUrl = `https://chauhansandeep.github.io/firstprinciplesengineering/${slug}`
  const pageTitle = escapeHtml(title || slug)
  return [
    `<section ${MARKER} class="fpe-cusdis" aria-label="Discussion">`,
    `  <h2 class="fpe-cusdis-heading">Discussion</h2>`,
    `  <p class="fpe-cusdis-lede">Comments are open. Anonymous is fine — pick any name and post. Comments appear after a quick moderation check.</p>`,
    `  <div id="cusdis_thread"`,
    `       data-host="${host}"`,
    `       data-app-id="${appId}"`,
    `       data-page-id="${pageId}"`,
    `       data-page-url="${escapeHtml(pageUrl)}"`,
    `       data-page-title="${pageTitle}"`,
    `       data-theme="auto"></div>`,
    `  <script async defer src="${host}/js/cusdis.es.js"></script>`,
    `  <script>`,
    `  (function(){`,
    `    // Cusdis's data-theme="auto" only listens to OS prefers-color-scheme;`,
    `    // our site has its own theme toggle that writes saved-theme on <html>.`,
    `    // Bridge the two: whenever saved-theme changes, push setTheme to the`,
    `    // Cusdis iframe via its window.CUSDIS.setTheme() API.`,
    `    function currentTheme(){`,
    `      var t = document.documentElement.getAttribute("saved-theme");`,
    `      if (t === "dark" || t === "light") return t;`,
    `      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";`,
    `    }`,
    `    function applyTheme(){`,
    `      if (window.CUSDIS && typeof window.CUSDIS.setTheme === "function") {`,
    `        window.CUSDIS.setTheme(currentTheme());`,
    `        return true;`,
    `      }`,
    `      return false;`,
    `    }`,
    `    // 1) Observe future theme toggles.`,
    `    var mo = new MutationObserver(applyTheme);`,
    `    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["saved-theme"] });`,
    `    // 2) Poll briefly until CUSDIS is ready, then apply current theme.`,
    `    var tries = 0;`,
    `    var iv = setInterval(function(){`,
    `      tries++;`,
    `      if (applyTheme() || tries > 40) clearInterval(iv);`,
    `    }, 250);`,
    `  })();`,
    `  </script>`,
    `</section>`,
  ].join("\n")
}

function readTitleFromHtml(html) {
  const m = html.match(/<h1[^>]*class="[^"]*article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
  if (!m) return null
  return m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null
}

async function inject(abs, slug, blockOrBuilder) {
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return { skipped: "filter" }
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
  const block =
    typeof blockOrBuilder === "function"
      ? blockOrBuilder({ slug, title: readTitleFromHtml(html) })
      : blockOrBuilder
  // Prefer to land after the Phase-3 prev/next aside; fall back to
  // before </article>.
  let next
  if (PREV_NEXT_END_RE.test(html)) {
    next = html.replace(PREV_NEXT_END_RE, `$1\n${block}\n`)
  } else if (ARTICLE_END_RE.test(html)) {
    next = html.replace(ARTICLE_END_RE, `${block}\n$1`)
  } else {
    return { skipped: "no-anchor" }
  }
  if (next === html) return { skipped: "no-change" }
  await fs.writeFile(abs, next, "utf8")
  return { injected: true }
}

async function main() {
  if (!config.enabled) {
    console.log(
      "inject-comments: comments disabled in comments.config.mjs; skipping.",
    )
    return
  }
  const mode = config.mode || "giscus"
  if (mode === "off") {
    console.log("inject-comments: mode='off' in comments.config.mjs; skipping.")
    return
  }

  let block // string (static) or function ({ slug, title }) -> string
  if (mode === "discuss-cta") {
    if (
      !config.discuss ||
      (!config.discuss.linkedinUrl && !config.discuss.email && !config.discuss.githubRepo)
    ) {
      console.log(
        "inject-comments: mode='discuss-cta' but no discuss.* contact URLs " +
          "configured; skipping.",
      )
      return
    }
    block = renderDiscussCtaBlock()
  } else if (mode === "cusdis") {
    if (!config.cusdisAppId || config.cusdisAppId === "REPLACE_ME") {
      console.log(
        "inject-comments: mode='cusdis' but cusdisAppId is unset/REPLACE_ME " +
          "in comments.config.mjs; skipping.",
      )
      return
    }
    block = renderCusdisBlock
  } else if (mode === "giscus") {
    if (
      config.repoId === "REPLACE_ME" ||
      config.categoryId === "REPLACE_ME"
    ) {
      console.log(
        "inject-comments: placeholder IDs in comments.config.mjs; skipping " +
          "(see file's header for setup steps).",
      )
      return
    }
    block = renderCommentsBlock()
  } else {
    console.log(
      `inject-comments: unknown mode '${mode}'; expected one of ` +
        `'discuss-cta' | 'cusdis' | 'giscus' | 'off'. Skipping.`,
    )
    return
  }

  const pages = await walkHtml(PUBLIC_DIR)
  let injected = 0
  let skipped = 0
  for (const abs of pages) {
    const slug = slugFromHtml(abs)
    const r = await inject(abs, slug, block)
    if (r.injected) injected++
    else skipped++
  }
  console.log(
    `inject-comments: mode=${mode}; injected into ${injected} article(s); skipped ${skipped}.`,
  )
}

main().catch((e) => {
  console.error("inject-comments failed:", e)
  process.exit(1)
})
