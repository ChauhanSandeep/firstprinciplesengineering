/*
 * content/_static/account.js  →  served at /_static/account.js
 * -------------------------------------------------------------------------
 * Hydrates the /account page for First Principles Engineering.
 *
 * Injected onto the account page by scripts/build/inject-account.mjs, which
 * also writes an inline `window.__FPE_ACCOUNT__` config (Supabase URL + anon
 * key, OAuth providers, magic-link flag, article base path, and the URL of
 * the static contentIndex.json used to resolve slugs → titles).
 *
 * Signed out → a sign-in prompt (Google / email magic-link).
 * Signed in  → editable profile (display name + Google avatar), the reader's
 *              activity (Liked / Read / Commented articles), and account
 *              actions (Sign out, Delete my data).
 *
 * All reads/writes go through Supabase with the anon key; row-level security
 * (supabase/schema.sql) guarantees a reader only ever sees/edits their own
 * rows. No article content is stored or transmitted — only slugs, which are
 * resolved to titles client-side via the static content index.
 */
;(function () {
  "use strict"

  var CFG = window.__FPE_ACCOUNT__
  var mount = document.querySelector("[data-fpe-account]")
  if (!mount) return
  if (!CFG || !CFG.supabaseUrl || !CFG.supabaseAnonKey) {
    mount.textContent = "Account features are not configured."
    return
  }

  var PROVIDERS = CFG.oauthProviders || []
  var MAGIC = !!CFG.emailMagicLink
  var PASSWORD = !!CFG.emailPassword
  var ARTICLE_BASE = CFG.articleBase || ""
  var CONTENT_INDEX_URL = CFG.contentIndexUrl || "/static/contentIndex.json"
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
  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
    var u = [
      ["year", 31536000],
      ["month", 2592000],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ]
    for (var i = 0; i < u.length; i++) {
      var v = Math.floor(s / u[i][1])
      if (v >= 1) return v + " " + u[i][0] + (v > 1 ? "s" : "") + " ago"
    }
    return "just now"
  }
  function hrefForSlug(slug) {
    return ARTICLE_BASE + "/" + slug
  }

  var sb = null
  var user = null
  var contentIndex = null
  var recovery = false

  boot()

  async function boot() {
    mount.appendChild(el("p", { class: "fpe-account-loading", text: "Loading your account…" }))
    var mod
    try {
      mod = await import("https://esm.sh/@supabase/supabase-js@2")
    } catch (e) {
      renderMessage("Account features are temporarily unavailable.")
      return
    }
    sb = mod.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    })

    var sess = await sb.auth.getSession()
    user = sess && sess.data && sess.data.session ? sess.data.session.user : null
    await render()

    sb.auth.onAuthStateChange(function (evt, session) {
      user = session ? session.user : null
      if (evt === "PASSWORD_RECOVERY") recovery = true
      render()
    })
  }

  function renderMessage(text) {
    clear(mount)
    mount.appendChild(el("p", { class: "fpe-account-msg", text: text }))
  }

  async function render() {
    clear(mount)
    if (recovery && user) return renderSetPassword()
    if (user) await renderSignedIn()
    else renderSignedOut()
  }

  // ---- password recovery (set a new password) -----------------------------
  function renderSetPassword() {
    var pass = el("input", {
      class: "fpe-account-password",
      type: "password",
      placeholder: "New password",
      autocomplete: "new-password",
      "aria-label": "New password",
      minlength: "6",
    })
    var status = el("span", {
      class: "fpe-account-save-status",
      role: "status",
      "aria-live": "polite",
    })
    var btn = el("button", {
      class: "fpe-account-save",
      type: "submit",
      text: "Update password",
    })
    var form = el("form", { class: "fpe-account-name-form" }, [
      el("label", { class: "fpe-account-label", text: "Choose a new password" }),
      el("div", { class: "fpe-account-name-row" }, [pass, btn]),
      status,
    ])
    form.addEventListener("submit", async function (e) {
      e.preventDefault()
      var p = pass.value || ""
      if (p.length < 6) {
        status.textContent = "Use at least 6 characters."
        status.className = "fpe-account-save-status is-error"
        return
      }
      btn.disabled = true
      status.textContent = "Updating…"
      var res = await sb.auth.updateUser({ password: p })
      btn.disabled = false
      if (res.error) {
        status.textContent = res.error.message
        status.className = "fpe-account-save-status is-error"
        return
      }
      recovery = false
      render()
    })
    mount.appendChild(
      el("section", { class: "fpe-account-card fpe-account-signin" }, [
        el("h2", { class: "fpe-account-h", text: "Set a new password" }),
        el("p", {
          class: "fpe-account-lede",
          text: "Enter a new password for your account below.",
        }),
        form,
      ]),
    )
  }

  // ---- signed out ---------------------------------------------------------
  function renderSignedOut() {
    var card = el("div", { class: "fpe-account-card fpe-account-signin" }, [
      el("h2", { class: "fpe-account-h", text: "Sign in to your account" }),
      el("p", {
        class: "fpe-account-lede",
        text: "Sign in to edit your profile and review what you've liked, read, and commented on.",
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
    if (PASSWORD) {
      card.appendChild(buildPasswordForm())
    }
    if (MAGIC) {
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
          options: { emailRedirectTo: window.location.href },
        })
        var note = el("p", {
          class: "fpe-account-note" + (res.error ? " is-error" : ""),
          text: res.error ? res.error.message : "Check your inbox for a sign-in link.",
        })
        form.appendChild(note)
      })
      card.appendChild(form)
    }
    mount.appendChild(card)
  }

  async function signInOAuth(provider) {
    await sb.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: window.location.href },
    })
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
        var rr = await sb.auth.resetPasswordForEmail(e, { redirectTo: window.location.href })
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
          options: { emailRedirectTo: window.location.href },
        })
        if (sr.error) return note(sr.error.message, true)
        return note(
          sr.data && sr.data.session
            ? "Account created — you're signed in."
            : "Account created. Check your inbox to confirm, then sign in.",
          false,
        )
      }
      var ir = await sb.auth.signInWithPassword({ email: e, password: p })
      if (ir.error) note(ir.error.message, true)
    }
    return form
  }

  // ---- signed in ----------------------------------------------------------
  async function renderSignedIn() {
    mount.appendChild(await renderProfileCard())
    mount.appendChild(await renderActivityCard())
    mount.appendChild(renderDangerCard())
  }

  async function renderProfileCard() {
    var meta = user.user_metadata || {}
    var prof = await loadProfile()
    var currentName = (prof && prof.display_name) || meta.full_name || meta.name || ""
    var avatar = (prof && prof.avatar_url) || meta.avatar_url

    var head = el("div", { class: "fpe-account-profile-head" }, [
      avatar
        ? el("img", { class: "fpe-account-avatar", src: avatar, alt: "", loading: "lazy" })
        : el("span", { class: "fpe-account-avatar fpe-account-avatar-empty", text: "" }),
      el("div", { class: "fpe-account-profile-id" }, [
        el("div", { class: "fpe-account-profile-name", text: currentName || "Reader" }),
        el("div", { class: "fpe-account-profile-email", text: user.email || "" }),
      ]),
    ])

    var input = el("input", {
      class: "fpe-account-name-input",
      type: "text",
      value: currentName,
      maxlength: "80",
      placeholder: "Your display name",
      "aria-label": "Display name",
    })
    var status = el("span", {
      class: "fpe-account-save-status",
      role: "status",
      "aria-live": "polite",
    })
    var saveBtn = el("button", {
      class: "fpe-account-save",
      type: "button",
      text: "Save",
      onclick: async function () {
        var name = (input.value || "").trim()
        saveBtn.disabled = true
        status.textContent = "Saving…"
        var res = await sb
          .from("profiles")
          .upsert({ id: user.id, display_name: name }, { onConflict: "id" })
        saveBtn.disabled = false
        if (res.error) {
          status.textContent = "Couldn't save. Try again."
          status.className = "fpe-account-save-status is-error"
        } else {
          status.textContent = "Saved."
          status.className = "fpe-account-save-status is-ok"
          var nameEl = head.querySelector(".fpe-account-profile-name")
          if (nameEl) nameEl.textContent = name || "Reader"
        }
      },
    })

    var form = el("div", { class: "fpe-account-name-form" }, [
      el("label", { class: "fpe-account-label", text: "Display name" }),
      el("div", { class: "fpe-account-name-row" }, [input, saveBtn]),
      status,
    ])

    return el("section", { class: "fpe-account-card" }, [
      el("h2", { class: "fpe-account-h", text: "Profile" }),
      head,
      form,
    ])
  }

  async function loadProfile() {
    var res = await sb
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
    return res && res.data ? res.data : null
  }

  async function renderActivityCard() {
    var card = el("section", { class: "fpe-account-card" }, [
      el("h2", { class: "fpe-account-h", text: "Your activity" }),
    ])
    var body = el("div", { class: "fpe-account-activity" })
    card.appendChild(body)

    body.appendChild(el("p", { class: "fpe-account-loading", text: "Loading your activity…" }))

    var results = await Promise.all([
      loadLikes(),
      loadReads(),
      loadComments(),
      ensureContentIndex(),
    ])
    var likes = results[0]
    var reads = results[1]
    var comments = results[2]

    clear(body)
    body.appendChild(
      renderList(
        "Liked",
        likes.map(function (r) {
          return { slug: r.slug, meta: timeAgo(r.created_at) }
        }),
        "You haven't liked anything yet.",
      ),
    )
    body.appendChild(
      renderList(
        "Read",
        reads.map(function (r) {
          return { slug: r.slug, meta: timeAgo(r.read_at) }
        }),
        "You haven't marked anything as read yet.",
      ),
    )
    body.appendChild(renderCommentList(comments))
    return card
  }

  async function loadLikes() {
    var res = await sb
      .from("article_likes")
      .select("slug, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    return (res && res.data) || []
  }
  async function loadReads() {
    var res = await sb
      .from("article_reads")
      .select("slug, read_at")
      .eq("user_id", user.id)
      .order("read_at", { ascending: false })
    return (res && res.data) || []
  }
  async function loadComments() {
    var res = await sb
      .from("article_comments")
      .select("id, slug, body, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    return (res && res.data) || []
  }

  async function ensureContentIndex() {
    if (contentIndex) return contentIndex
    try {
      var r = await fetch(CONTENT_INDEX_URL, { credentials: "omit" })
      contentIndex = r.ok ? await r.json() : {}
    } catch (e) {
      contentIndex = {}
    }
    return contentIndex
  }
  function titleFor(slug) {
    var entry = contentIndex && contentIndex[slug]
    return (entry && entry.title) || slug
  }

  function renderList(label, items, emptyText) {
    var group = el("div", { class: "fpe-account-group" }, [
      el("h3", { class: "fpe-account-group-h" }, [
        label,
        el("span", { class: "fpe-account-count", text: String(items.length) }),
      ]),
    ])
    if (!items.length) {
      group.appendChild(el("p", { class: "fpe-account-empty", text: emptyText }))
      return group
    }
    var list = el("ul", { class: "fpe-account-item-list" })
    items.forEach(function (it) {
      list.appendChild(
        el("li", { class: "fpe-account-item" }, [
          el("a", { class: "fpe-account-item-link", href: hrefForSlug(it.slug) }, [
            titleFor(it.slug),
          ]),
          it.meta ? el("span", { class: "fpe-account-item-meta", text: it.meta }) : null,
        ]),
      )
    })
    group.appendChild(list)
    return group
  }

  function renderCommentList(comments) {
    var group = el("div", { class: "fpe-account-group" }, [
      el("h3", { class: "fpe-account-group-h" }, [
        "Commented",
        el("span", { class: "fpe-account-count", text: String(comments.length) }),
      ]),
    ])
    if (!comments.length) {
      group.appendChild(el("p", { class: "fpe-account-empty", text: "You haven't commented yet." }))
      return group
    }
    var list = el("ul", { class: "fpe-account-item-list" })
    comments.forEach(function (c) {
      list.appendChild(
        el("li", { class: "fpe-account-item fpe-account-comment-item" }, [
          el("a", { class: "fpe-account-item-link", href: hrefForSlug(c.slug) }, [
            titleFor(c.slug),
          ]),
          el("span", { class: "fpe-account-item-meta", text: timeAgo(c.created_at) }),
          el("blockquote", { class: "fpe-account-comment-quote", text: c.body }),
        ]),
      )
    })
    group.appendChild(list)
    return group
  }

  // ---- account actions ----------------------------------------------------
  function renderDangerCard() {
    var status = el("span", {
      class: "fpe-account-danger-status",
      role: "status",
      "aria-live": "polite",
    })
    var signOut = el("button", {
      class: "fpe-account-signout",
      type: "button",
      text: "Sign out",
      onclick: async function () {
        await sb.auth.signOut()
      },
    })
    var del = el("button", {
      class: "fpe-account-delete",
      type: "button",
      text: "Delete my data",
      onclick: async function () {
        if (
          !window.confirm(
            "Delete all your likes, reads, comments, and profile from this site? " +
              "This can't be undone. You'll be signed out afterwards.",
          )
        )
          return
        del.disabled = true
        status.textContent = "Deleting…"
        var uid = user.id
        var errs = []
        var ops = [
          sb.from("article_comments").delete().eq("user_id", uid),
          sb.from("article_likes").delete().eq("user_id", uid),
          sb.from("article_reads").delete().eq("user_id", uid),
          sb.from("profiles").delete().eq("id", uid),
        ]
        var settled = await Promise.all(ops)
        settled.forEach(function (r) {
          if (r && r.error) errs.push(r.error.message)
        })
        if (errs.length) {
          del.disabled = false
          status.textContent = "Some data couldn't be deleted. Try again."
          status.className = "fpe-account-danger-status is-error"
          return
        }
        // Clear local read-state markers for a clean slate on this device.
        try {
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i)
            if (k && (k.indexOf("fpe:read:") === 0 || k.indexOf("fpe:last:") === 0))
              localStorage.removeItem(k)
          }
        } catch (e) {}
        await sb.auth.signOut()
      },
    })

    return el("section", { class: "fpe-account-card fpe-account-danger" }, [
      el("h2", { class: "fpe-account-h", text: "Account" }),
      el("div", { class: "fpe-account-danger-row" }, [signOut, del]),
      el("p", {
        class: "fpe-account-danger-note",
        text: "Deleting your data removes your likes, reads, comments, and profile from this site and signs you out.",
      }),
      status,
    ])
  }
})()
