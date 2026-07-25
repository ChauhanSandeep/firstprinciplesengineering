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

  var GOOGLE_G =
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>'

  function renderSignIn() {
    clear(mount)
    var card = el("div", { class: "fpe-auth-card" })

    card.appendChild(el("h1", { class: "fpe-auth-title", text: "Sign in or sign up" }))
    card.appendChild(
      el("p", {
        class: "fpe-auth-sub",
        text: PASSWORD
          ? "Use your email and password, a one-time link, or continue with Google."
          : "Use just your email, or continue with Google.",
      }),
    )

    PROVIDERS.forEach(function (p) {
      var btn = el("button", {
        class: "fpe-auth-oauth fpe-auth-oauth-" + p,
        type: "button",
        onclick: function () {
          signInOAuth(p)
        },
      })
      if (p === "google") btn.appendChild(el("span", { class: "fpe-auth-oauth-icon", html: GOOGLE_G }))
      btn.appendChild(
        el("span", {
          text: p === "google" ? "Continue with Google" : "Continue with " + p,
        }),
      )
      card.appendChild(btn)
    })

    if (PROVIDERS.length && (PASSWORD || MAGIC)) {
      card.appendChild(
        el("div", { class: "fpe-auth-divider" }, [
          el("span", { text: "or continue with" }),
        ]),
      )
    }

    var note = el("p", { class: "fpe-auth-note", role: "status", "aria-live": "polite" })
    function setNote(text, isError) {
      note.textContent = text || ""
      note.className = "fpe-auth-note" + (text ? (isError ? " is-error" : " is-ok") : "")
    }

    var email = el("input", {
      class: "fpe-auth-input",
      type: "email",
      placeholder: "Email",
      autocomplete: "email",
      "aria-label": "Email",
    })
    card.appendChild(email)

    var pass = null
    if (PASSWORD) {
      pass = el("input", {
        class: "fpe-auth-input",
        type: "password",
        placeholder: "Password",
        autocomplete: "current-password",
        "aria-label": "Password",
      })
      card.appendChild(pass)
    }

    // Primary action: password sign-in when enabled, else magic link.
    var primary = el("button", {
      class: "fpe-auth-primary",
      type: "button",
      text: PASSWORD ? "Sign in" : "Email me a sign-in link",
      onclick: function () {
        PASSWORD ? submit("signin") : submit("magic")
      },
    })
    card.appendChild(primary)

    if (PASSWORD) {
      card.appendChild(
        el("button", {
          class: "fpe-auth-secondary",
          type: "button",
          text: "Create account",
          onclick: function () {
            submit("signup")
          },
        }),
      )
    }

    // Secondary text links.
    var links = el("div", { class: "fpe-auth-links" })
    if (PASSWORD) {
      links.appendChild(
        el("button", {
          class: "fpe-auth-link",
          type: "button",
          text: "Forgot password?",
          onclick: function () {
            submit("reset")
          },
        }),
      )
    }
    if (MAGIC && PASSWORD) {
      links.appendChild(
        el("button", {
          class: "fpe-auth-link",
          type: "button",
          text: "Email me a link instead",
          onclick: function () {
            submit("magic")
          },
        }),
      )
    }
    if (links.childNodes.length) card.appendChild(links)
    card.appendChild(note)

    // Submit on Enter from either field.
    ;[email, pass].forEach(function (inp) {
      if (!inp) return
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault()
          PASSWORD ? submit("signin") : submit("magic")
        }
      })
    })

    async function submit(mode) {
      var e = (email.value || "").trim()
      var p = pass ? pass.value || "" : ""
      if (!e) return setNote("Enter your email address.", true)

      if (mode === "magic") {
        setNote("Sending your sign-in link…")
        var mr = await sb.auth.signInWithOtp({ email: e, options: { emailRedirectTo: redirectUrl() } })
        return setNote(mr.error ? mr.error.message : "Check your inbox for a sign-in link.", !!mr.error)
      }
      if (mode === "reset") {
        setNote("Sending a reset link…")
        var rr = await sb.auth.resetPasswordForEmail(e, {
          redirectTo: window.location.origin + ACCOUNT_HREF,
        })
        return setNote(rr.error ? rr.error.message : "Check your inbox to reset your password.", !!rr.error)
      }
      if (!p) return setNote("Enter your password.", true)
      if (mode === "signup") {
        setNote("Creating your account…")
        var sr = await sb.auth.signUp({ email: e, password: p, options: { emailRedirectTo: redirectUrl() } })
        if (sr.error) return setNote(sr.error.message, true)
        if (sr.data && sr.data.session) return go()
        return setNote("Account created. Check your inbox to confirm, then sign in.", false)
      }
      setNote("Signing you in…")
      var ir = await sb.auth.signInWithPassword({ email: e, password: p })
      if (ir.error) setNote(ir.error.message, true)
    }

    mount.appendChild(card)
    email.focus()
  }

  async function signInOAuth(provider) {
    await sb.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: redirectUrl() },
    })
  }
})()
