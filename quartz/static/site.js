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

      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "copy-btn"
      btn.setAttribute("aria-label", "Copy code")
      btn.textContent = "copy"

      btn.addEventListener("click", async (ev) => {
        ev.preventDefault()
        const text = pre.innerText.replace(/^copy\n/, "").trim()
        try {
          await navigator.clipboard.writeText(text)
          btn.textContent = "copied"
          btn.classList.add("copied")
          setTimeout(() => {
            btn.textContent = "copy"
            btn.classList.remove("copied")
          }, 1500)
        } catch {
          btn.textContent = "err"
          setTimeout(() => (btn.textContent = "copy"), 1500)
        }
      })
      pre.appendChild(btn)
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

  function hydrateExcalidrawZoom(root) {
    const imgs = (root || document).querySelectorAll('img[src$=".excalidraw.svg"]')
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
  // Quartz fires this after SPA navigation
  document.addEventListener("nav", init)
})()
