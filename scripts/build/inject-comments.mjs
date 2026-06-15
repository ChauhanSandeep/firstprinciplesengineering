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

async function inject(abs, slug, block) {
  if (SKIP_SLUG_RE.some((re) => re.test(slug))) return { skipped: "filter" }
  const html = await fs.readFile(abs, "utf8")
  if (html.includes(MARKER)) return { skipped: "already" }
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

  const block = renderCommentsBlock()
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
    `inject-comments: injected into ${injected} article(s); skipped ${skipped}.`,
  )
}

main().catch((e) => {
  console.error("inject-comments failed:", e)
  process.exit(1)
})
