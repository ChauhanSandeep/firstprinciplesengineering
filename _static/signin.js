/*
 * content/_static/signin.js  →  served at /_static/signin.js
 * -------------------------------------------------------------------------
 * Hydrates the dedicated /signin page for First Principles Engineering.
 *
 * Injected by scripts/build/inject-signin.mjs, which also writes an inline
 * `window.__FPE_SIGNIN__` config (Supabase URL + anon key, OAuth providers,
 * magic-link + password flags, and the account href used as the default
 * post-sign-in destination).
 *
 * This is the single place that hosts the actual sign-in / create-account
 * forms, so article pages, the header chip, and /account stay uncluttered —
 * they just link here (optionally with `?redirect=<local path>` to return
 * the reader to where they were once signed in).
 *
 * Already signed in → immediately forwarded to the redirect target.
 * Signed out → Google, email + password (sign in / create account / forgot),
 *              and email magic-link, mirroring the shared auth options.
 *
 * Shares the Supabase auth session (localStorage) with every other widget,
 * so signing in here lights up the whole site. No article content is
 * touched.
 */
;(function () {
  "use strict"

  var CFG = window.__FPE_SIGNIN__
  var mount = document.querySelector("[data-fpe-signin]")
  if (!mount) return
  if (!CFG || !CFG.supabaseUrl || !CFG.supabaseAnonKey) {
    mount.textContent = "Sign-in is not configured."
    return
  }

  var PROVIDERS = CFG.oauthProviders || []
  var MAGIC = !!CFG.emailMagicLink
  var PASSWORD = !!CFG.emailPassword
  var ACCOUNT_HREF = CFG.accountHref || "/account"
  var OAUTH_LABELS = { google: "Continue with Google", github: "Continue with GitHub" }

  // ---- tiny DOM helpers (mirrors account.js) ------------------------------
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

  // Only allow same-origin local paths as a redirect target (no open redirect).
  function safeRedirectPath() {
    try {
      var r = new URLSearchParams(window.location.search).get("redirect")
      if (r && r.charAt(0) === "/" && r.charAt(1) !== "/") return r
    } catch (e) {}
    return ACCOUNT_HREF
  }
  function redirectUrl() {
    return window.location.origin + safeRedirectPath()
  }
  function go() {
    window.location.assign(safeRedirectPath())
  }

  var sb = null

  boot()

  async function boot() {
    mount.appendChild(el("p", { class: "fpe-account-loading", text: "Loading…" }))
    var mod
    try {
      mod = await import("https://esm.sh/@supabase/supabase-js@2")
    } catch (e) {
      renderMessage("Sign-in is temporarily unavailable.")
      return
    }
    sb = mod.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    })

    var sess = await sb.auth.getSession()
    if (sess && sess.data && sess.data.session) {
      go()
      return
    }
    renderSignIn()

    sb.auth.onAuthStateChange(function (evt, session) {
      if (session && (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED")) go()
    })
  }

  function renderMessage(text) {
    clear(mount)
    mount.appendChild(el("p", { class: "fpe-account-msg", text: text }))
  }

  function renderSignIn() {
    clear(mount)
    var card = el("div", { class: "fpe-account-card fpe-account-signin" }, [
      el("h1", { class: "fpe-account-h", text: "Sign in or create an account" }),
      el("p", {
        class: "fpe-account-lede",
        text: "Sign in to like, comment, and track what you've read across your devices.",
      }),
    ])
    PROVIDERS.forEach(function (p) {
      card.appendChild(
        el("button", {
          class: "fpe-account-oauth fpe-account-oauth-" + p,
          type: "button",
          text: OAUTH_LABELS[p] || "Continue with " + p,
          onclick: function () {
            signInOAuth(p)
          },
        }),
      )
    })
    if (PASSWORD) card.appendChild(buildPasswordForm())
    if (MAGIC) card.appendChild(buildMagicForm())
    mount.appendChild(card)
  }

  async function signInOAuth(provider) {
    await sb.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: redirectUrl() },
    })
  }

  function buildMagicForm() {
    var input = el("input", {
      class: "fpe-account-email",
      type: "email",
      placeholder: "you@example.com",
      autocomplete: "email",
      "aria-label": "Email for a sign-in link",
    })
    var form = el("form", { class: "fpe-account-magic" }, [
      input,
      el("button", { class: "fpe-account-magic-btn", type: "submit", text: "Email me a link" }),
    ])
    form.addEventListener("submit", async function (e) {
      e.preventDefault()
      var email = (input.value || "").trim()
      if (!email) return
      var res = await sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: redirectUrl() },
      })
      var note = el("p", {
        class: "fpe-account-note" + (res.error ? " is-error" : ""),
        text: res.error ? res.error.message : "Check your inbox for a sign-in link.",
      })
      form.appendChild(note)
    })
    return form
  }

  function buildPasswordForm() {
    var email = el("input", {
      class: "fpe-account-email",
      type: "email",
      placeholder: "you@example.com",
      autocomplete: "email",
      "aria-label": "Email",
    })
    var pass = el("input", {
      class: "fpe-account-password",
      type: "password",
      placeholder: "Password",
      autocomplete: "current-password",
      "aria-label": "Password",
    })
    var signInBtn = el("button", {
      class: "fpe-account-pw-btn",
      type: "submit",
      text: "Sign in",
    })
    var signUpBtn = el("button", {
      class: "fpe-account-pw-btn fpe-account-pw-secondary",
      type: "button",
      text: "Create account",
      onclick: function () {
        submit("signup")
      },
    })
    var forgot = el("button", {
      class: "fpe-account-pw-forgot",
      type: "button",
      text: "Forgot password?",
      onclick: function () {
        submit("reset")
      },
    })
    var form = el("form", { class: "fpe-account-pwform" }, [
      email,
      pass,
      el("div", { class: "fpe-account-pw-actions" }, [signInBtn, signUpBtn]),
      forgot,
    ])
    form.addEventListener("submit", function (e) {
      e.preventDefault()
      submit("signin")
    })
    function note(text, isError) {
      var existing = form.querySelector(".fpe-account-note")
      if (existing) existing.parentNode.removeChild(existing)
      form.appendChild(
        el("p", { class: "fpe-account-note" + (isError ? " is-error" : ""), text: text }),
      )
    }
    async function submit(mode) {
      var e = (email.value || "").trim()
      var p = pass.value || ""
      if (!e) return note("Enter your email address.", true)
      if (mode === "reset") {
        var rr = await sb.auth.resetPasswordForEmail(e, {
          redirectTo: window.location.origin + ACCOUNT_HREF,
        })
        return note(
          rr.error ? rr.error.message : "Check your inbox to reset your password.",
          !!rr.error,
        )
      }
      if (!p) return note("Enter your password.", true)
      if (mode === "signup") {
        var sr = await sb.auth.signUp({
          email: e,
          password: p,
          options: { emailRedirectTo: redirectUrl() },
        })
        if (sr.error) return note(sr.error.message, true)
        if (sr.data && sr.data.session) return go()
        return note("Account created. Check your inbox to confirm, then sign in.", false)
      }
      var ir = await sb.auth.signInWithPassword({ email: e, password: p })
      if (ir.error) note(ir.error.message, true)
    }
    return form
  }
})()
