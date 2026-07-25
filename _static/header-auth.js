/*
 * content/_static/header-auth.js  →  served at /_static/header-auth.js
 * -------------------------------------------------------------------------
 * Global header auth chip for First Principles Engineering.
 *
 * Injected into the left sidebar (below the site title) of EVERY page by
 * scripts/build/inject-header-auth.mjs, which also writes an inline
 * `window.__FPE_AUTHCHIP__` config (Supabase URL + anon key, OAuth
 * providers, magic-link flag, and the /account href) just before loading
 * this module.
 *
 *   • Signed out → a compact "Sign in" button that opens a small popover
 *     with the same Google / email options as the article widget.
 *   • Signed in  → the reader's avatar + name, opening a menu with links
 *     to their Account page and a Sign out action.
 *
 * Shares the Supabase auth session (persisted in localStorage) with the
 * article engagement widget and the /account page, so signing in anywhere
 * lights up everywhere. No article content is touched.
 */
;(function () {
  "use strict"

  var CFG = window.__FPE_AUTHCHIP__
  if (!CFG || !CFG.supabaseUrl || !CFG.supabaseAnonKey) return
  var mount = document.querySelector("[data-fpe-authchip]")
  if (!mount) return

  var PROVIDERS = CFG.oauthProviders || []
  var MAGIC = !!CFG.emailMagicLink
  var ACCOUNT_HREF = CFG.accountHref || "/account"
  var OAUTH_LABELS = { google: "Continue with Google", github: "Continue with GitHub" }

  // ---- tiny DOM helpers (mirrors engagement.js) ---------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag)
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k]
        else if (k === "text") n.textContent = attrs[k]
        else if (k === "html") n.innerHTML = attrs[k]
        else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function")
          n.addEventListener(k.slice(2), attrs[k])
        else if (attrs[k] != null) n.setAttribute(k, attrs[k])
      })
    }
    ;(children || []).forEach(function (c) {
      if (c == null) return
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    })
    return n
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  var USER_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'

  var sb = null
  var user = null
  var openPanel = null

  boot()

  async function boot() {
    var mod
    try {
      mod = await import("https://esm.sh/@supabase/supabase-js@2")
    } catch (e) {
      return // fail silent: the chip simply doesn't appear
    }
    sb = mod.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })

    var sess = await sb.auth.getSession()
    user = sess && sess.data && sess.data.session ? sess.data.session.user : null
    render()

    sb.auth.onAuthStateChange(function (_evt, session) {
      user = session ? session.user : null
      render()
    })

    // Close any open popover on outside click / Escape.
    document.addEventListener("click", function (e) {
      if (openPanel && !mount.contains(e.target)) closePanel()
    })
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePanel()
    })
  }

  function closePanel() {
    if (openPanel && openPanel.parentNode) openPanel.parentNode.removeChild(openPanel)
    openPanel = null
  }

  function togglePanel(build) {
    if (openPanel) {
      closePanel()
      return
    }
    openPanel = build()
    mount.appendChild(openPanel)
  }

  function render() {
    closePanel()
    clear(mount)
    if (user) renderSignedIn()
    else renderSignedOut()
  }

  // ---- signed out ---------------------------------------------------------
  function renderSignedOut() {
    var btn = el("button", {
      class: "fpe-authchip-trigger",
      type: "button",
      "aria-haspopup": "true",
      "aria-expanded": "false",
      onclick: function (e) {
        e.stopPropagation()
        togglePanel(buildSignInPanel)
        btn.setAttribute("aria-expanded", openPanel ? "true" : "false")
      },
    })
    btn.appendChild(el("span", { class: "fpe-authchip-icon", html: USER_ICON }))
    btn.appendChild(el("span", { class: "fpe-authchip-label", text: "Sign in" }))
    mount.appendChild(btn)
  }

  function buildSignInPanel() {
    var panel = el("div", { class: "fpe-authchip-panel", role: "menu" })
    panel.appendChild(
      el("p", {
        class: "fpe-authchip-lede",
        text: "Sign in to like, comment, and track what you've read.",
      }),
    )
    PROVIDERS.forEach(function (p) {
      panel.appendChild(
        el("button", {
          class: "fpe-authchip-oauth fpe-authchip-oauth-" + p,
          type: "button",
          text: OAUTH_LABELS[p] || "Continue with " + p,
          onclick: function () {
            signInOAuth(p)
          },
        }),
      )
    })
    if (MAGIC) {
      var input = el("input", {
        class: "fpe-authchip-email",
        type: "email",
        placeholder: "you@example.com",
        autocomplete: "email",
        "aria-label": "Email for a sign-in link",
      })
      var form = el("form", { class: "fpe-authchip-magic" }, [
        input,
        el("button", { class: "fpe-authchip-magic-btn", type: "submit", text: "Email me a link" }),
      ])
      form.addEventListener("submit", async function (e) {
        e.preventDefault()
        var email = (input.value || "").trim()
        if (!email) return
        var res = await sb.auth.signInWithOtp({
          email: email,
          options: { emailRedirectTo: window.location.href },
        })
        var note = el("p", {
          class: "fpe-authchip-note" + (res.error ? " is-error" : ""),
          text: res.error ? res.error.message : "Check your inbox for a sign-in link.",
        })
        form.appendChild(note)
      })
      panel.appendChild(form)
    }
    return panel
  }

  async function signInOAuth(provider) {
    await sb.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.href },
    })
  }

  // ---- signed in ----------------------------------------------------------
  function renderSignedIn() {
    var meta = user.user_metadata || {}
    var name = meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : "you")
    var avatar = meta.avatar_url

    var btn = el("button", {
      class: "fpe-authchip-trigger fpe-authchip-user",
      type: "button",
      "aria-haspopup": "true",
      "aria-expanded": "false",
      onclick: function (e) {
        e.stopPropagation()
        togglePanel(buildUserMenu)
        btn.setAttribute("aria-expanded", openPanel ? "true" : "false")
      },
    })
    if (avatar)
      btn.appendChild(
        el("img", { class: "fpe-authchip-avatar", src: avatar, alt: "", loading: "lazy" }),
      )
    else btn.appendChild(el("span", { class: "fpe-authchip-icon", html: USER_ICON }))
    btn.appendChild(el("span", { class: "fpe-authchip-label", text: name }))
    mount.appendChild(btn)
  }

  function buildUserMenu() {
    var menu = el("div", { class: "fpe-authchip-panel", role: "menu" })
    menu.appendChild(
      el("a", { class: "fpe-authchip-menu-item", href: ACCOUNT_HREF, role: "menuitem" }, [
        "Account",
      ]),
    )
    menu.appendChild(
      el("button", {
        class: "fpe-authchip-menu-item fpe-authchip-signout",
        type: "button",
        role: "menuitem",
        text: "Sign out",
        onclick: async function () {
          closePanel()
          await sb.auth.signOut()
        },
      }),
    )
    return menu
  }
})()
