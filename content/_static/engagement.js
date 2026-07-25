/*
 * content/_static/engagement.js  →  served at /_static/engagement.js
 * -------------------------------------------------------------------------
 * Reader-engagement widget for First Principles Engineering.
 *
 * Injected onto every article page by scripts/build/inject-engagement.mjs,
 * which also writes a small inline `window.__FPE_ENGAGEMENT__` config object
 * (slug, title, Supabase URL + anon key, feature flags) just before loading
 * this module. This file renders, inside the page:
 *
 *   • an auth bar (Google one-click and/or email magic-link),
 *   • a like button with a live count,
 *   • a "mark as read" toggle (localStorage instantly; synced across a
 *     reader's devices once signed in),
 *   • an inline, one-level comment thread (plain text).
 *
 * The Quartz site stays static; this talks directly to Supabase from the
 * browser using the anon key. Row-level security (see supabase/schema.sql)
 * is the security boundary — a reader can only write their own rows.
 *
 * No article content is read or sent here; everything is keyed by `slug`.
 */
;(function () {
  "use strict"

  var CFG = window.__FPE_ENGAGEMENT__
  if (!CFG || !CFG.supabaseUrl || !CFG.supabaseAnonKey) return
  var mount = document.querySelector("[data-fpe-engage]")
  if (!mount) return

  var SLUG = CFG.slug
  var FEATURES = CFG.features || {}
  var AUTH = CFG.auth || {}
  var COMMENTS_CFG = CFG.comments || {}
  var ACCOUNT_HREF = CFG.accountHref || "/account"
  var SIGNIN_HREF = CFG.signinHref || "/signin"
  var LS_READ_KEY = "fpe:read:" + SLUG
  var LS_LAST_KEY = "fpe:last:" + SLUG


  // Record this visit so the homepage can offer a "Continue reading" nudge.
  // Purely local (no network, no auth); independent of read-state.
  ;(function recordVisit() {
    try {
      localStorage.setItem(
        LS_LAST_KEY,
        JSON.stringify({
          t: new Date().toISOString(),
          title: CFG.title || SLUG,
          href: window.location.pathname,
        }),
      )
    } catch (e) {}
  })()

  // ---- tiny DOM helpers ---------------------------------------------------
  function el(tag, attrs, children) {
    var n = document.createElement(tag)
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k]
        else if (k === "text")
          n.textContent = attrs[k] // safe: textContent
        else if (k === "html")
          n.innerHTML = attrs[k] // only for trusted icons
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

  var HEART =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>'
  var CHECK =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
  var COMMENT_BUBBLE =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'

  // ---- state --------------------------------------------------------------
  var sb = null
  var user = null
  var els = {} // cached DOM references

  boot()

  async function boot() {
    var mod
    try {
      mod = await import("https://esm.sh/@supabase/supabase-js@2")
    } catch (e) {
      renderOffline()
      return
    }
    sb = mod.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    })
    renderShell()

    var sess = await sb.auth.getSession()
    user = sess && sess.data && sess.data.session ? sess.data.session.user : null

    sb.auth.onAuthStateChange(function (_evt, session) {
      var was = user
      user = session ? session.user : null
      renderAuthBar()
      if (FEATURES.likes) refreshLike()
      if (FEATURES.readState) reflectRead()
      if (FEATURES.comments) refreshComments()
      // First sign-in in this tab: push any local read-state up to the DB.
      if (!was && user && FEATURES.readState) syncLocalReadUp()
    })

    renderAuthBar()
    if (FEATURES.likes) refreshLike()
    if (FEATURES.readState) reflectRead()
    if (FEATURES.comments) refreshComments()
  }

  // ---- shell / layout -----------------------------------------------------
  function renderShell() {
    clear(mount)
    els.authbar = el("div", { class: "fpe-engage-authbar" })
    var actions = el("div", { class: "fpe-engage-actions" })

    if (FEATURES.likes) {
      els.likeBtn = el("button", {
        class: "fpe-engage-like",
        type: "button",
        "aria-pressed": "false",
        onclick: onToggleLike,
      })
      els.likeIcon = el("span", { class: "fpe-engage-like-icon", html: HEART })
      els.likeCount = el("span", { class: "fpe-engage-like-count", text: "0" })
      els.likeBtn.appendChild(els.likeIcon)
      els.likeBtn.appendChild(els.likeCount)
      actions.appendChild(els.likeBtn)
    }
    if (FEATURES.readState) {
      els.readBtn = el("button", {
        class: "fpe-engage-read",
        type: "button",
        "aria-pressed": "false",
        onclick: onToggleRead,
      })
      els.readBtn.appendChild(el("span", { class: "fpe-engage-read-icon", html: CHECK }))
      els.readLabel = el("span", { class: "fpe-engage-read-label", text: "Mark as read" })
      els.readBtn.appendChild(els.readLabel)
      actions.appendChild(els.readBtn)
    }

    mount.appendChild(els.authbar)
    if (FEATURES.likes || FEATURES.readState) mount.appendChild(actions)

    if (FEATURES.comments) {
      els.comments = el("div", { class: "fpe-engage-comments" }, [
        el("h3", { class: "fpe-engage-comments-heading" }, [
          el("span", { class: "fpe-engage-comments-icon", html: COMMENT_BUBBLE }),
          el("span", { class: "fpe-engage-comments-title", text: "Comments" }),
          (els.commentsCount = el("span", { class: "fpe-engage-comments-count", text: "" })),
        ]),
        (els.commentForm = el("div", { class: "fpe-engage-comment-form" })),
        (els.commentList = el("div", { class: "fpe-engage-comment-list" })),
      ])
      mount.appendChild(els.comments)
    }
    els.msg = el("div", { class: "fpe-engage-msg", role: "status", "aria-live": "polite" })
    mount.appendChild(els.msg)
  }

  function renderOffline() {
    clear(mount)
    mount.appendChild(
      el("p", {
        class: "fpe-engage-offline",
        text: "Comments and likes are temporarily unavailable.",
      }),
    )
  }

  function flash(text, kind) {
    if (!els.msg) return
    els.msg.textContent = text || ""
    els.msg.className = "fpe-engage-msg" + (kind ? " is-" + kind : "")
    if (text)
      setTimeout(function () {
        if (els.msg.textContent === text) els.msg.textContent = ""
      }, 4000)
  }

  // ---- auth ---------------------------------------------------------------
  function renderAuthBar() {
    if (!els.authbar) return
    clear(els.authbar)
    if (user) {
      var meta = user.user_metadata || {}
      var name = meta.full_name || meta.name || (user.email ? user.email.split("@")[0] : "you")
      var avatar = meta.avatar_url
      var who = el("span", { class: "fpe-engage-who" }, [
        avatar
          ? el("img", { class: "fpe-engage-avatar", src: avatar, alt: "", loading: "lazy" })
          : null,
        el("span", { class: "fpe-engage-name", text: name }),
      ])
      els.authbar.appendChild(who)
      els.authbar.appendChild(
        el("button", {
          class: "fpe-engage-signout",
          type: "button",
          text: "Sign out",
          onclick: async function () {
            await sb.auth.signOut()
          },
        }),
      )
    } else {
      els.authbar.appendChild(
        el("span", {
          class: "fpe-engage-signin-lede",
          text: "Sign in to like, comment, and track what you've read.",
        }),
      )
      els.authbar.appendChild(
        el("a", { class: "fpe-engage-signin-link", href: signinLink() }, ["Sign in"]),
      )
    }
  }

  function signinLink() {
    var here = window.location.pathname + window.location.search
    return SIGNIN_HREF + "?redirect=" + encodeURIComponent(here)
  }

  function requireAuth() {
    window.location.assign(signinLink())
  }

  // ---- likes --------------------------------------------------------------
  async function refreshLike() {
    if (!FEATURES.likes || !els.likeBtn) return
    var countRes = await sb
      .from("article_likes")
      .select("*", { count: "exact", head: true })
      .eq("slug", SLUG)
    var count = countRes.count || 0
    var liked = false
    if (user) {
      var mine = await sb
        .from("article_likes")
        .select("slug")
        .eq("slug", SLUG)
        .eq("user_id", user.id)
        .maybeSingle()
      liked = !!(mine && mine.data)
    }
    setLikeUI(count, liked)
  }
  function setLikeUI(count, liked) {
    els.likeCount.textContent = String(count)
    els.likeBtn.setAttribute("aria-pressed", liked ? "true" : "false")
    els.likeBtn.classList.toggle("is-liked", !!liked)
    els.likeBtn.setAttribute(
      "aria-label",
      (liked ? "Unlike" : "Like") + " this article (" + count + ")",
    )
  }
  async function onToggleLike() {
    if (!user) return requireAuth()
    var liked = els.likeBtn.classList.contains("is-liked")
    var count = parseInt(els.likeCount.textContent, 10) || 0
    setLikeUI(liked ? Math.max(0, count - 1) : count + 1, !liked) // optimistic
    var res = liked
      ? await sb.from("article_likes").delete().eq("slug", SLUG).eq("user_id", user.id)
      : await sb.from("article_likes").insert({ slug: SLUG, user_id: user.id })
    if (res.error) {
      setLikeUI(count, liked) // revert
      flash("Couldn't save your like. Try again.", "error")
    }
  }

  // ---- read state ---------------------------------------------------------
  function localRead() {
    try {
      return localStorage.getItem(LS_READ_KEY) === "1"
    } catch (e) {
      return false
    }
  }
  function setLocalRead(v) {
    try {
      if (v) localStorage.setItem(LS_READ_KEY, "1")
      else localStorage.removeItem(LS_READ_KEY)
    } catch (e) {}
  }
  async function reflectRead() {
    if (!FEATURES.readState || !els.readBtn) return
    var read = localRead()
    if (user) {
      var r = await sb
        .from("article_reads")
        .select("slug")
        .eq("slug", SLUG)
        .eq("user_id", user.id)
        .maybeSingle()
      read = !!(r && r.data)
      setLocalRead(read)
    }
    setReadUI(read)
  }
  function setReadUI(read) {
    els.readBtn.classList.toggle("is-read", !!read)
    els.readBtn.setAttribute("aria-pressed", read ? "true" : "false")
    els.readLabel.textContent = read ? "Read" : "Mark as read"
  }
  async function onToggleRead() {
    var read = !els.readBtn.classList.contains("is-read")
    setReadUI(read)
    setLocalRead(read) // instant, works signed-out
    if (!user) return
    var res = read
      ? await sb
          .from("article_reads")
          .upsert({ slug: SLUG, user_id: user.id }, { onConflict: "slug,user_id" })
      : await sb.from("article_reads").delete().eq("slug", SLUG).eq("user_id", user.id)
    if (res.error) flash("Saved on this device; couldn't sync across devices.", "error")
  }
  async function syncLocalReadUp() {
    if (localRead() && user) {
      await sb
        .from("article_reads")
        .upsert({ slug: SLUG, user_id: user.id }, { onConflict: "slug,user_id" })
    }
  }

  // ---- comments -----------------------------------------------------------
  function renderCommentForm() {
    clear(els.commentForm)
    if (!user) {
      var nudge = el("div", { class: "fpe-engage-comment-nudge" }, [
        el("button", {
          class: "fpe-engage-comment-nudge-btn",
          type: "button",
          text: "Sign in to join the discussion",
          onclick: requireAuth,
        }),
        el("p", {
          class: "fpe-engage-comment-nudge-sub",
          text: "Your account is free — sign in with Google or a magic link.",
        }),
      ])
      els.commentForm.appendChild(nudge)
      return
    }
    var ta = el("textarea", {
      class: "fpe-engage-textarea",
      rows: "3",
      maxlength: String(COMMENTS_CFG.maxLength || 4000),
      placeholder: "Add a comment…",
      "aria-label": "Write a comment",
    })
    var form = el("form", { class: "fpe-engage-comment-compose" }, [
      ta,
      el("div", { class: "fpe-engage-compose-row" }, [
        el("button", { class: "fpe-engage-comment-submit", type: "submit", text: "Post comment" }),
      ]),
    ])
    form.addEventListener("submit", function (e) {
      e.preventDefault()
      postComment(ta.value, null, form)
    })
    els.commentForm.appendChild(form)
  }

  async function postComment(body, parentId, formNode) {
    body = (body || "").trim()
    if (!body) return
    if (!user) return requireAuth()
    var btn = formNode ? formNode.querySelector("button[type=submit]") : null
    if (btn) btn.disabled = true
    var res = await sb
      .from("article_comments")
      .insert({ slug: SLUG, user_id: user.id, parent_id: parentId, body: body })
    if (btn) btn.disabled = false
    if (res.error) {
      flash("Couldn't post your comment. Try again.", "error")
      return
    }
    if (formNode) {
      var ta = formNode.querySelector("textarea")
      if (ta) ta.value = ""
    }
    refreshComments()
  }

  async function refreshComments() {
    if (!FEATURES.comments || !els.commentList) return
    renderCommentForm()
    // Two simple queries instead of a PostgREST embedded join: the widget
    // must not depend on a foreign key between article_comments and
    // profiles (both reference auth.users, so no direct FK exists). This
    // is resilient to the schema as shipped in supabase/schema.sql.
    var res = await sb
      .from("article_comments")
      .select("id, user_id, parent_id, body, created_at")
      .eq("slug", SLUG)
      .order("created_at", { ascending: true })
    if (res.error) {
      clear(els.commentList)
      els.commentList.appendChild(
        el("p", { class: "fpe-engage-comment-empty", text: "Couldn't load comments." }),
      )
      return
    }
    var rows = res.data || []
    var profilesMap = await fetchProfiles(rows)
    renderCommentTree(rows, profilesMap)
  }

  // Resolve display_name / avatar_url for the authors of the given rows in
  // a single `id=in.(…)` query. Returns {} on any error so comments still
  // render (with a generic name) rather than failing outright.
  async function fetchProfiles(rows) {
    var ids = {}
    rows.forEach(function (r) {
      if (r.user_id) ids[r.user_id] = true
    })
    var list = Object.keys(ids)
    if (!list.length) return {}
    var res = await sb.from("profiles").select("id, display_name, avatar_url").in("id", list)
    if (res.error || !res.data) return {}
    var map = {}
    res.data.forEach(function (p) {
      map[p.id] = p
    })
    return map
  }

  function renderCommentTree(rows, profilesMap) {
    clear(els.commentList)
    if (els.commentsCount) {
      els.commentsCount.textContent = rows.length ? "(" + rows.length + ")" : ""
    }
    if (!rows.length) {
      els.commentList.appendChild(
        el("p", { class: "fpe-engage-comment-empty", text: "No comments yet. Be the first." }),
      )
      return
    }
    var byParent = {}
    rows.forEach(function (r) {
      var k = r.parent_id || "root"
      ;(byParent[k] = byParent[k] || []).push(r)
    })
    ;(byParent.root || []).forEach(function (r) {
      els.commentList.appendChild(renderComment(r, byParent[r.id] || [], profilesMap))
    })
  }

  function renderComment(row, replies, profilesMap) {
    var prof = (profilesMap && profilesMap[row.user_id]) || {}
    var name = prof.display_name || "Reader"
    var head = el("div", { class: "fpe-engage-comment-head" }, [
      prof.avatar_url
        ? el("img", { class: "fpe-engage-avatar", src: prof.avatar_url, alt: "", loading: "lazy" })
        : null,
      el("span", { class: "fpe-engage-comment-author", text: name }),
      el("span", { class: "fpe-engage-comment-time", text: timeAgo(row.created_at) }),
    ])
    var body = el("div", { class: "fpe-engage-comment-body", text: row.body }) // textContent: safe
    var node = el("div", { class: "fpe-engage-comment" }, [head, body])

    var actions = el("div", { class: "fpe-engage-comment-actions" })
    if (COMMENTS_CFG.allowReplies && user) {
      actions.appendChild(
        el("button", {
          class: "fpe-engage-comment-reply",
          type: "button",
          text: "Reply",
          onclick: function () {
            toggleReplyBox(node, row.id)
          },
        }),
      )
    }
    if (user && row.user_id === user.id) {
      actions.appendChild(
        el("button", {
          class: "fpe-engage-comment-delete",
          type: "button",
          text: "Delete",
          onclick: async function () {
            var r = await sb.from("article_comments").delete().eq("id", row.id)
            if (r.error) flash("Couldn't delete. Try again.", "error")
            else refreshComments()
          },
        }),
      )
    }
    if (actions.childNodes.length) node.appendChild(actions)

    if (replies && replies.length) {
      var kids = el("div", { class: "fpe-engage-comment-replies" })
      replies.forEach(function (rp) {
        kids.appendChild(renderComment(rp, [], profilesMap)) // one level only
      })
      node.appendChild(kids)
    }
    return node
  }

  function toggleReplyBox(node, parentId) {
    var existing = node.querySelector(":scope > .fpe-engage-reply-box")
    if (existing) {
      existing.remove()
      return
    }
    var ta = el("textarea", {
      class: "fpe-engage-textarea",
      rows: "2",
      maxlength: String(COMMENTS_CFG.maxLength || 4000),
      placeholder: "Write a reply…",
      "aria-label": "Write a reply",
    })
    var form = el("form", { class: "fpe-engage-reply-box" }, [
      ta,
      el("button", { class: "fpe-engage-comment-submit", type: "submit", text: "Reply" }),
    ])
    form.addEventListener("submit", function (e) {
      e.preventDefault()
      postComment(ta.value, parentId, form)
    })
    node.appendChild(form)
    ta.focus()
  }
})()
