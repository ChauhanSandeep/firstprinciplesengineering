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
    const encUrl = encodeURIComponent(pageUrl)
    const encTitle = encodeURIComponent(title)
    const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`
    const twitterHref = `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`

    const row = document.createElement("div")
    row.className = "fpe-share"

    const mkLink = (href, cls, label) =>
      '<a class="fpe-share-link ' + cls + '" href="' + href + '" target="_blank" rel="noopener">' + label + '</a>'

    row.innerHTML =
      '<span class="fpe-share-label">Share this post:</span>' +
      '<button class="fpe-share-link fpe-share-secondary fpe-share-copy" type="button" aria-live="polite">🔗 Copy link</button>' +
      mkLink(twitterHref, "fpe-share-secondary fpe-share-x", "𝕏 Post") +
      mkLink(linkedinHref, "fpe-share-secondary fpe-share-linkedin", "↗ LinkedIn")

    const prevNext = article.querySelector(".fpe-prev-next")
    if (prevNext) article.insertBefore(row, prevNext)
    else article.appendChild(row)

    const copyBtn = row.querySelector(".fpe-share-copy")
    if (copyBtn) {
      const originalLabel = copyBtn.textContent
      let revertTimer = null
      copyBtn.addEventListener("click", async () => {
        const showCopied = () => {
          copyBtn.textContent = "✓ Copied!"
          copyBtn.classList.add("fpe-share-copied")
          if (revertTimer) clearTimeout(revertTimer)
          revertTimer = setTimeout(() => {
            copyBtn.textContent = originalLabel
            copyBtn.classList.remove("fpe-share-copied")
          }, 1600)
        }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(pageUrl)
            showCopied()
            return
          }
        } catch (_) {
          // fall through to legacy path
        }
        try {
          const ta = document.createElement("textarea")
          ta.value = pageUrl
          ta.setAttribute("readonly", "")
          ta.style.position = "absolute"
          ta.style.left = "-9999px"
          document.body.appendChild(ta)
          ta.select()
          document.execCommand("copy")
          document.body.removeChild(ta)
          showCopied()
        } catch (_) {
          copyBtn.textContent = "Copy failed"
          if (revertTimer) clearTimeout(revertTimer)
          revertTimer = setTimeout(() => {
            copyBtn.textContent = originalLabel
          }, 1600)
        }
      })
    }
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

  function ensureRichFooter() {
    const footer = document.querySelector("footer")
    if (!footer) return
    if (footer.querySelector(".fpe-footer-rich")) return

    const basePath = (document.body && document.body.dataset && document.body.dataset.basepath) || ""
    const home = (basePath || "") + "/"
    const about = (basePath || "") + "/about"
    const ghRepo = "https://github.com/chauhansandeep/firstprinciplesengineering"
    const linkedinUrl = "https://www.linkedin.com/in/sandeepcode/"
    const emailAddr = "engineeringfromfirstprinciples@gmail.com"

    // Inline Lucide-style stroke icons (24x24 viewBox, currentColor) for the Connect column.
    const ICON = {
      github:
        '<svg class="fpe-footer-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.27-1.68-1.27-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.73.81 1.18 1.84 1.18 3.1 0 4.42-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>' +
        '</svg>',
      issue:
        '<svg class="fpe-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="12"></line><circle cx="12" cy="16" r="1"></circle>' +
        '</svg>',
      linkedin:
        '<svg class="fpe-footer-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.47-.89 1.63-1.83 3.36-1.83 3.59 0 4.26 2.36 4.26 5.43v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0z"/>' +
        '</svg>',
      email:
        '<svg class="fpe-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="14" rx="2"></rect><polyline points="3 7 12 13 21 7"></polyline>' +
        '</svg>',
      rss:
        '<svg class="fpe-footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none"></circle>' +
        '</svg>',
    }

    const mkConnect = (href, label, iconKey, external) => {
      const target = external ? ' target="_blank" rel="noopener"' : ''
      return '<li><a href="' + href + '"' + target + '>' + ICON[iconKey] + '<span>' + label + '</span></a></li>'
    }

    const rich = document.createElement("div")
    rich.className = "fpe-footer-rich"
    rich.innerHTML =
      '<div class="fpe-footer-col fpe-footer-brand">' +
        '<div class="fpe-footer-title">First Principles Engineering</div>' +
        '<p class="fpe-footer-tagline">Notes on distributed systems, system design, databases, networking, and the fundamentals that survive every architecture trend.</p>' +
        '<p class="fpe-footer-byline">By <strong>Sandeep Chauhan</strong> — Senior Software Engineer @ LinkedIn</p>' +
      '</div>' +
      '<div class="fpe-footer-col fpe-footer-browse">' +
        '<div class="fpe-footer-col-title">Browse</div>' +
        '<ul>' +
          '<li><a href="' + home + '">Home</a></li>' +
          '<li><a href="' + about + '">About Me</a></li>' +
        '</ul>' +
      '</div>' +
      '<div class="fpe-footer-col fpe-footer-connect fpe-footer-connect-iconified">' +
        '<div class="fpe-footer-col-title">Connect</div>' +
        '<ul>' +
          mkConnect(ghRepo, "GitHub", "github", true) +
          mkConnect(linkedinUrl, "LinkedIn", "linkedin", true) +
          mkConnect("mailto:" + emailAddr, "Email", "email", false) +
        '</ul>' +
      '</div>'

    footer.insertBefore(rich, footer.firstChild)
    footer.classList.add("fpe-footer-enhanced")
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
    ensureRichFooter()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
  // Quartz fires this after SPA navigation
  document.addEventListener("nav", init)
})()
