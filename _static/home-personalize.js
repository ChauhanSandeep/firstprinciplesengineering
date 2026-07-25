/*
 * content/_static/home-personalize.js  →  served at /_static/home-personalize.js
 * -------------------------------------------------------------------------
 * Auth-aware personalization for the First Principles Engineering home page.
 *
 * Injected onto the home page only by scripts/build/inject-home-personalize.mjs,
 * which also writes an inline `window.__FPE_HOME__` config (Supabase URL +
 * anon key, article base path). It adds two signed-in touches:
 *
 *   • A "Continue reading" strip above Recommended Reads, built from the
 *     reader's most recently visited-but-not-finished articles (recorded in
 *     localStorage by the article widget — see engagement.js `fpe:last:*`).
 *   • A small "Read" badge on any home card whose article the reader has
 *     finished (localStorage `fpe:read:*`, plus their synced article_reads
 *     when signed in for cross-device accuracy).
 *
 * Read-state is resolved from localStorage first (instant, zero network); a
 * Supabase session, if present, backfills reads made on other devices. No
 * article content is touched.
 */
;(function () {
  "use strict"

  var CFG = window.__FPE_HOME__ || {}
  var ARTICLE_BASE = CFG.articleBase || ""

  // ---- tiny DOM helpers ---------------------------------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag)
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k]
        else if (k === "text") n.textContent = attrs[k]
        else if (k === "html") n.innerHTML = attrs[k]
        else if (attrs[k] != null) n.setAttribute(k, attrs[k])
      })
    }
    ;(children || []).forEach(function (c) {
      if (c == null) return
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    })
    return n
  }

  // Normalize any card href to a bare slug matching the localStorage /
  // Supabase key format (lowercase path, no base, no leading/trailing slash).
  function slugFromHref(href) {
    if (!href) return ""
    var s = href.split("#")[0].split("?")[0]
    try {
      s = new URL(s, window.location.origin).pathname
    } catch (e) {}
    if (ARTICLE_BASE && s.indexOf(ARTICLE_BASE) === 0) s = s.slice(ARTICLE_BASE.length)
    return s.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase()
  }

  function localRead(slug) {
    try {
      return localStorage.getItem("fpe:read:" + slug) === "1"
    } catch (e) {
      return false
    }
  }

  function collectVisits() {
    var out = []
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (!k || k.indexOf("fpe:last:") !== 0) continue
        var slug = k.slice("fpe:last:".length)
        var v
        try {
          v = JSON.parse(localStorage.getItem(k))
        } catch (e) {
          continue
        }
        if (v && v.t) out.push({ slug: slug, t: v.t, title: v.title, href: v.href })
      }
    } catch (e) {}
    return out
  }

  var CARDS = Array.prototype.slice.call(
    document.querySelectorAll("a.fpe-article-card, a.fpe-rail-card"),
  )

  var readSet = {} // slug -> true

  boot()

  async function boot() {
    // 1) Instant pass from localStorage.
    CARDS.forEach(function (card) {
      var slug = slugFromHref(card.getAttribute("href"))
      if (slug && localRead(slug)) readSet[slug] = true
    })
    paint()

    // 2) Optional backfill from Supabase for cross-device reads.
    if (CFG.supabaseUrl && CFG.supabaseAnonKey) {
      try {
        var mod = await import("https://esm.sh/@supabase/supabase-js@2")
        var sb = mod.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        })
        var sess = await sb.auth.getSession()
        var user = sess && sess.data && sess.data.session ? sess.data.session.user : null
        if (user) {
          var res = await sb.from("article_reads").select("slug").eq("user_id", user.id)
          if (res && res.data) {
            res.data.forEach(function (r) {
              readSet[(r.slug || "").toLowerCase()] = true
              try {
                localStorage.setItem("fpe:read:" + r.slug, "1")
              } catch (e) {}
            })
            paint()
          }
        }
      } catch (e) {
        /* fail silent — localStorage pass already ran */
      }
    }
  }

  function paint() {
    paintBadges()
    paintContinue()
  }

  function paintBadges() {
    CARDS.forEach(function (card) {
      var slug = slugFromHref(card.getAttribute("href"))
      var has = card.querySelector(":scope > .fpe-card-read-badge")
      if (slug && readSet[slug]) {
        card.classList.add("is-read")
        if (!has) {
          card.appendChild(
            el("span", {
              class: "fpe-card-read-badge",
              "aria-label": "You've read this",
              text: "✓ Read",
            }),
          )
        }
      } else {
        card.classList.remove("is-read")
        if (has) has.remove()
      }
    })
  }

  function paintContinue() {
    var mount = document.querySelector("[data-fpe-home-continue]")
    if (!mount) return
    var visits = collectVisits()
      .filter(function (v) {
        return !readSet[v.slug] && !localRead(v.slug)
      })
      .sort(function (a, b) {
        return new Date(b.t).getTime() - new Date(a.t).getTime()
      })
      .slice(0, 3)

    if (!visits.length) {
      mount.hidden = true
      mount.textContent = ""
      return
    }

    mount.textContent = ""
    mount.hidden = false
    mount.appendChild(el("h2", { class: "fpe-continue-h", text: "Continue reading" }))
    var list = el("div", { class: "fpe-continue-list" })
    visits.forEach(function (v) {
      var href = v.href || ARTICLE_BASE + "/" + v.slug
      list.appendChild(
        el("a", { class: "fpe-continue-card", href: href }, [
          el("span", { class: "fpe-continue-eyebrow", text: "Pick up where you left off" }),
          el("span", { class: "fpe-continue-title", text: v.title || v.slug }),
        ]),
      )
    })
    mount.appendChild(list)
  }
})()
