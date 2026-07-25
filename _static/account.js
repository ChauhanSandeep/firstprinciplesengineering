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

  var ARTICLE_BASE = CFG.articleBase || ""
  var SIGNIN_HREF = CFG.signinHref || "/signin"
  var CONTENT_INDEX_URL = CFG.contentIndexUrl || "/static/contentIndex.json"

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
    var here = window.location.pathname + window.location.search
    var link = SIGNIN_HREF + "?redirect=" + encodeURIComponent(here)
    mount.appendChild(
      el("div", { class: "fpe-account-card fpe-account-signin" }, [
        el("h2", { class: "fpe-account-h", text: "Sign in to your account" }),
        el("p", {
          class: "fpe-account-lede",
          text: "Sign in to edit your profile and review what you've liked, read, and commented on.",
        }),
        el("a", { class: "fpe-account-oauth fpe-account-signin-link", href: link }, ["Sign in"]),
      ]),
    )
  }

  // ---- signed in ----------------------------------------------------------
  async function renderSignedIn() {
    mount.appendChild(await renderProfileCard())
    mount.appendChild(await renderActivityCard())
    mount.appendChild(renderDangerCard())
  }

  async function renderProfileCard() {
    var meta = user.user_metadata || {}
    var prof = (await loadProfile()) || {}
    var currentName = prof.display_name || meta.full_name || meta.name || ""
    var avatar = prof.avatar_url || meta.avatar_url

    var head = el("div", { class: "fpe-account-profile-head" }, [
      avatar
        ? el("img", { class: "fpe-account-avatar", src: avatar, alt: "", loading: "lazy" })
        : el("span", { class: "fpe-account-avatar fpe-account-avatar-empty", text: "" }),
      el("div", { class: "fpe-account-profile-id" }, [
        el("div", { class: "fpe-account-profile-name", text: currentName || "Reader" }),
        el("div", { class: "fpe-account-profile-email", text: user.email || "" }),
      ]),
    ])

    function textInput(attrs) {
      return el("input", Object.assign({ class: "fpe-account-input", type: "text" }, attrs))
    }
    function field(labelText, inputEl, hint) {
      var kids = [el("label", { class: "fpe-account-label", text: labelText }), inputEl]
      if (hint) kids.push(el("span", { class: "fpe-account-hint", text: hint }))
      return el("div", { class: "fpe-account-field" }, kids)
    }

    var firstEl = textInput({ value: prof.first_name || "", maxlength: "80", placeholder: "First name", autocomplete: "given-name", "aria-label": "First name" })
    var lastEl = textInput({ value: prof.last_name || "", maxlength: "80", placeholder: "Last name", autocomplete: "family-name", "aria-label": "Last name" })
    var companyEl = textInput({ value: prof.company || "", maxlength: "120", placeholder: "Company", autocomplete: "organization", "aria-label": "Company" })
    var titleEl = textInput({ value: prof.job_title || "", maxlength: "120", placeholder: "Role / title", autocomplete: "organization-title", "aria-label": "Role or title" })
    var yoeEl = el("input", {
      class: "fpe-account-input",
      type: "number",
      min: "0",
      max: "80",
      step: "1",
      value: prof.years_experience != null ? String(prof.years_experience) : "",
      placeholder: "Years",
      "aria-label": "Years of experience",
    })
    var locationEl = textInput({ value: prof.location || "", maxlength: "120", placeholder: "City, Country", "aria-label": "Location" })
    var linkedinEl = el("input", {
      class: "fpe-account-input",
      type: "url",
      value: prof.linkedin_url || "",
      maxlength: "300",
      placeholder: "https://www.linkedin.com/in/…",
      "aria-label": "LinkedIn URL",
    })
    var bioEl = el("textarea", {
      class: "fpe-account-input fpe-account-textarea",
      rows: "3",
      maxlength: "500",
      placeholder: "A short bio (optional)",
      "aria-label": "Short bio",
    })
    bioEl.value = prof.bio || ""

    var status = el("span", {
      class: "fpe-account-save-status",
      role: "status",
      "aria-live": "polite",
    })
    var saveBtn = el("button", {
      class: "fpe-account-save",
      type: "button",
      text: "Save profile",
      onclick: async function () {
        function v(elm) {
          return (elm.value || "").trim()
        }
        var first = v(firstEl)
        var last = v(lastEl)
        var yoeRaw = v(yoeEl)
        var yoe = yoeRaw === "" ? null : parseInt(yoeRaw, 10)
        if (yoe !== null && (isNaN(yoe) || yoe < 0 || yoe > 80)) {
          status.textContent = "Years of experience must be between 0 and 80."
          status.className = "fpe-account-save-status is-error"
          return
        }
        var display = [first, last].filter(Boolean).join(" ") || currentName || null
        var patch = {
          id: user.id,
          first_name: first || null,
          last_name: last || null,
          company: v(companyEl) || null,
          job_title: v(titleEl) || null,
          years_experience: yoe,
          location: v(locationEl) || null,
          linkedin_url: v(linkedinEl) || null,
          bio: v(bioEl) || null,
        }
        if (display) patch.display_name = display

        saveBtn.disabled = true
        status.textContent = "Saving…"
        status.className = "fpe-account-save-status"
        var res = await sb.from("profiles").upsert(patch, { onConflict: "id" })
        saveBtn.disabled = false
        if (res.error) {
          status.textContent = "Couldn't save. Try again."
          status.className = "fpe-account-save-status is-error"
        } else {
          status.textContent = "Saved."
          status.className = "fpe-account-save-status is-ok"
          currentName = display || currentName
          var nameEl = head.querySelector(".fpe-account-profile-name")
          if (nameEl) nameEl.textContent = currentName || "Reader"
        }
      },
    })

    var form = el("div", { class: "fpe-account-profile-form" }, [
      el("div", { class: "fpe-account-field-row" }, [
        field("First name", firstEl),
        field("Last name", lastEl),
      ]),
      el("div", { class: "fpe-account-field-row" }, [
        field("Company", companyEl),
        field("Role / title", titleEl),
      ]),
      el("div", { class: "fpe-account-field-row" }, [
        field("Years of experience", yoeEl),
        field("Location", locationEl),
      ]),
      field("LinkedIn", linkedinEl),
      field("Short bio", bioEl),
      el("div", { class: "fpe-account-save-row" }, [saveBtn, status]),
    ])

    return el("section", { class: "fpe-account-card" }, [
      el("h2", { class: "fpe-account-h", text: "Profile" }),
      el("p", { class: "fpe-account-sub", text: "All fields are optional. Only your name appears publicly on comments." }),
      head,
      form,
    ])
  }

  async function loadProfile() {
    var res = await sb
      .from("profiles")
      .select(
        "display_name, avatar_url, first_name, last_name, company, job_title, years_experience, location, linkedin_url, bio",
      )
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
