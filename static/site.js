// First Principles Engineering — site-wide enhancement JS
// Loaded from Head.tsx as `<script src="static/site.js" defer>`.
// Idempotent: safe to run on Quartz's SPA navigation events.

(function () {
  function hydrateCodeBlocks(root) {
    const blocks = (root || document).querySelectorAll("pre")
    blocks.forEach((pre) => {
      if (pre.dataset.fpeEnhanced === "1") return
      pre.dataset.fpeEnhanced = "1"

      // Surface language hint for the SCSS `::before` badge
      const codeEl = pre.querySelector("code")
      if (codeEl && !pre.dataset.language) {
        const cls = Array.from(codeEl.classList).find((c) =>
          c.startsWith("language-"),
        )
        if (cls) pre.dataset.language = cls.slice("language-".length)
      }

      // Copy button is injected by Quartz core (.clipboard-button via the
      // syntax-highlighting plugin). We just style it via custom.scss.
    })
  }

  function ensureProgressBar() {
    // Only on article-style pages: a single <article> with substantial scroll.
    if (!document.querySelector("article")) return
    if (document.getElementById("scroll-progress")) return
    const bar = document.createElement("div")
    bar.id = "scroll-progress"
    document.body.prepend(bar)

    // CSS handles the animation natively where scroll-driven animations
    // are supported; otherwise fall back to a scroll listener.
    if (CSS && CSS.supports && CSS.supports("animation-timeline", "scroll()")) {
      return
    }
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      const pct = max > 0 ? h.scrollTop / max : 0
      bar.style.transform = `scaleX(${pct})`
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
  }

  // Strip `NN-` ordering prefix and convert dashes to spaces. Mirrors the
  // sync script's prettifyName() and the Explorer mapFn so display is
  // consistent across all UI surfaces.
  function prettify(s) {
    if (!s || typeof s !== "string") return s
    return s.replace(/^\d+[-_]/, "").replace(/[-_]/g, " ").trim()
  }

  // Breadcrumbs are server-rendered with raw folder slugs (e.g. "01-Fundamentals
  // > 01-Concepts > ..."). The breadcrumb plugin doesn't expose a mapFn the
  // way Explorer does, so we rewrite the text on the client. Idempotent.
  function prettifyBreadcrumbs(root) {
    const links = (root || document).querySelectorAll(
      ".breadcrumb-container .breadcrumb-element > a",
    )
    links.forEach((a) => {
      if (a.dataset.fpePretty === "1") return
      const original = a.textContent
      const cleaned = prettify(original)
      if (cleaned && cleaned !== original) a.textContent = cleaned
      a.dataset.fpePretty = "1"
    })
  }

  // Floating "back to top" button. Appears after scrolling past one viewport
  // height on any article page. Smooth-scrolls to top.
  function ensureBackToTop() {
    if (!document.querySelector("article")) return
    if (document.getElementById("fpe-back-to-top")) return
    const btn = document.createElement("button")
    btn.id = "fpe-back-to-top"
    btn.type = "button"
    btn.setAttribute("aria-label", "Back to top")
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"></polyline></svg>'
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" })
    })
    document.body.appendChild(btn)
    const onScroll = () => {
      const h = document.documentElement
      btn.classList.toggle("visible", h.scrollTop > h.clientHeight * 0.6)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
  }

  // Inject a kbd badge inside the search launcher to surface the Cmd/Ctrl+K
  // shortcut (the search plugin already binds the shortcut; we just expose it).
  function decorateSearchButton(root) {
    const btn = (root || document).querySelector(".search > .search-button")
    if (!btn || btn.dataset.fpeKbd === "1") return
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    const kbd = document.createElement("kbd")
    kbd.className = "fpe-search-kbd"
    kbd.setAttribute("aria-hidden", "true")
    kbd.textContent = isMac ? "⌘K" : "Ctrl K"
    btn.appendChild(kbd)
    btn.dataset.fpeKbd = "1"
  }

  // Prev / next article navigation: derives the article's "sibling list" from
  // its slug ancestry using the JSON index Quartz emits. We pick the parent
  // folder, list its published children (excluding folder indexes), sort them
  // by slug (which gives natural ordering because the vault uses `NN-` prefixes),
  // and link to the immediate prev/next entry.
  let _contentIndexPromise = null
  function loadContentIndex() {
    if (_contentIndexPromise) return _contentIndexPromise
    const body = document.body
    const basepath = (body && body.dataset && body.dataset.basepath) || ""
    const base = basepath.replace(/\/$/, "")
    const url = (base ? base : "") + "/static/contentIndex.json"
    _contentIndexPromise = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
    return _contentIndexPromise
  }
  async function ensurePrevNext() {
    const article = document.querySelector("article")
    if (!article) return
    if (article.querySelector(".fpe-prev-next")) return

    const body = document.body
    const slug = body && body.dataset && body.dataset.slug
    if (!slug || slug === "index" || slug.endsWith("/index")) return

    const data = await loadContentIndex()
    if (!data) return
    const index = data.content || data

    const parts = slug.split("/")
    if (parts.length < 2) return
    const parent = parts.slice(0, -1).join("/")

    const entries = Object.entries(index)
      .filter(([s]) => {
        if (!s.startsWith(parent + "/")) return false
        const rest = s.slice(parent.length + 1)
        if (rest.includes("/")) return false
        if (rest === "index" || rest.endsWith("/index")) return false
        return true
      })
      .map(([s, v]) => ({ slug: s, title: (v && v.title) || s.split("/").pop() }))
      .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }))

    const idx = entries.findIndex((e) => e.slug === slug)
    if (idx < 0) return
    const prev = idx > 0 ? entries[idx - 1] : null
    const next = idx < entries.length - 1 ? entries[idx + 1] : null
    if (!prev && !next) return

    const basepath = (body && body.dataset && body.dataset.basepath) || ""
    const join = (b, s) => {
      const left = b.replace(/\/$/, "")
      const right = String(s).replace(/^\//, "")
      return left ? left + "/" + right : right
    }
    const nav = document.createElement("nav")
    nav.className = "fpe-prev-next"
    nav.setAttribute("aria-label", "Article navigation")
    const make = (entry, direction, label) => {
      if (!entry) return '<span class="fpe-pn-spacer"></span>'
      const href = join(basepath, entry.slug)
      const cleanTitle = prettify(entry.title)
      return (
        '<a class="fpe-pn ' + direction + '" href="' + href + '">' +
        '<span class="fpe-pn-label">' + label + '</span>' +
        '<span class="fpe-pn-title">' + cleanTitle + '</span>' +
        "</a>"
      )
    }
    nav.innerHTML = make(prev, "prev", "← Previous") + make(next, "next", "Next →")
    article.appendChild(nav)
  }

  function ensureShareRow() {
    const article = document.querySelector("article")
    if (!article) return
    if (article.querySelector(".fpe-share")) return

    const body = document.body
    const slug = body && body.dataset && body.dataset.slug
    if (!slug || slug === "index" || slug.endsWith("/index") || slug === "404") return

    const title = (document.querySelector("h1.article-title")?.textContent || document.title || "").trim()
    const pageUrl = location.origin + location.pathname
    const repo = "chauhansandeep/firstprinciplesengineering"
    const issueBody = encodeURIComponent(`Re: [${title}](${pageUrl})\n\n`)
    const issueTitle = encodeURIComponent(`Discussion: ${title}`)
    const discussHref = `https://github.com/${repo}/issues/new?title=${issueTitle}&body=${issueBody}`
    const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`

    const row = document.createElement("div")
    row.className = "fpe-share"
    row.innerHTML =
      '<span class="fpe-share-label">Found a flaw, a sharper take, or a counter-example?</span>' +
      '<a class="fpe-share-link" href="' + discussHref + '" target="_blank" rel="noopener">💬 Discuss on GitHub</a>' +
      '<a class="fpe-share-link fpe-share-secondary" href="' + linkedinHref + '" target="_blank" rel="noopener">↗ Share on LinkedIn</a>'

    const prevNext = article.querySelector(".fpe-prev-next")
    if (prevNext) article.insertBefore(row, prevNext)
    else article.appendChild(row)
  }

  function wrapInScrollable(el, className) {
    if (!el || el.dataset.fpeWrapped === "1") return
    if (el.parentElement && el.parentElement.classList.contains(className)) {
      el.dataset.fpeWrapped = "1"
      return
    }
    const wrap = document.createElement("div")
    wrap.className = className
    el.parentNode.insertBefore(wrap, el)
    wrap.appendChild(el)
    el.dataset.fpeWrapped = "1"
  }

  function wrapKatex(root) {
    const blocks = (root || document).querySelectorAll("article .katex-display")
    blocks.forEach((k) => wrapInScrollable(k, "fpe-katex-wrap"))
  }

  function hydrateExcalidrawZoom(root) {
    // Match all three sidecar variants: legacy single `.excalidraw.svg`,
    // and the dark/light pair `.excalidraw.{dark,light}.svg` produced by
    // the Obsidian Excalidraw plugin's "Export both" mode. CSS hides the
    // off-theme duplicate via `display:none`, so click events only land on
    // the variant the reader currently sees — no theme-routing needed here.
    const imgs = (root || document).querySelectorAll('img[src*=".excalidraw."]')
    imgs.forEach((img) => {
      if (img.dataset.fpeZoom === "1") return
      img.dataset.fpeZoom = "1"
      img.title = "Click to view full size"
      img.addEventListener("click", () => openLightbox(img.src, img.alt))
    })
  }

  function openLightbox(src, alt) {
    let overlay = document.getElementById("fpe-lightbox")
    if (overlay) overlay.remove()
    overlay = document.createElement("div")
    overlay.id = "fpe-lightbox"
    overlay.setAttribute("role", "dialog")
    overlay.setAttribute("aria-label", "Diagram viewer")
    overlay.innerHTML =
      '<button type="button" class="fpe-lightbox-close" aria-label="Close">×</button>' +
      '<img alt="' + (alt || "") + '" />'
    overlay.querySelector("img").src = src
    const close = () => overlay.remove()
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.classList.contains("fpe-lightbox-close")) close()
    })
    document.addEventListener(
      "keydown",
      function onKey(e) {
        if (e.key === "Escape") {
          close()
          document.removeEventListener("keydown", onKey)
        }
      },
    )
    document.body.appendChild(overlay)
  }

  function init() {
    hydrateCodeBlocks(document)
    ensureProgressBar()
    hydrateExcalidrawZoom(document)
    wrapKatex(document)
    prettifyBreadcrumbs(document)
    decorateSearchButton(document)
    ensureBackToTop()
    ensurePrevNext()
    ensureShareRow()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
  // Quartz fires this after SPA navigation
  document.addEventListener("nav", init)
})()
