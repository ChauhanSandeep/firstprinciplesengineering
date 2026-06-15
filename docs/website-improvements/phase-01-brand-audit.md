# Phase 1 — Brand audit notes

Quick audit of the existing visual system before adding Phase 1's new
sections. Goal: catch any sloppy ramp / spacing / icon-weight issues
that the new sections would inherit and amplify. **Approach: keep what
works, fix only the things that break consistency.** The Anthropic-
inspired palette + Inter / Atkinson Hyperlegible / JetBrains Mono is
explicitly out of scope.

## Typography

- **Headers (Inter)** ramp: existing `h1 ≈ 1.75rem`, `h2 ≈ 1.4rem`,
  `h3 ≈ 1.15rem`. Good rhythm; nothing to change.
- **Body (Atkinson Hyperlegible)** at 1rem with `line-height: 1.6` —
  matches the long-form reading goal.
- **Code (JetBrains Mono)** — used for eyebrows + `.path-count` +
  inline `code`. Phase 1 reuses it for `.roadmap-status`,
  `.placeholder-eyebrow`, `.about-strip-eyebrow`. Consistent.

Conclusion: no type-ramp changes.

## Spacing scale

Existing scale (from observation of `custom.scss`): 0.25 / 0.4 / 0.5 /
0.6 / 0.75 / 0.85 / 1 / 1.25 / 1.5 / 2 / 2.5 / 2.75 rem. That's an
8-ish-pixel base step with a few half-steps for tight card internals.

Phase 1 keeps this scale strictly. New section-to-section spacing uses
**2.5rem** between sections and **2.75rem** above an `h2` that follows
a card grid — the latter is a single new rule
(`.fpe-X + h2 { margin-top: 2.75rem; }`) so all the new sections
breathe like the existing ones do.

Conclusion: no spacing changes; new rules respect the existing scale.

## Icons

The existing site has a mix of icon sources:

- Footer connect icons — SVG, 22×22, `fill: currentColor`.
- Hero arrow — `→` glyph.
- Contact rows in `/about/` — SVG, 22×22, `stroke=currentColor stroke-width=2`.

Phase 1 adds icons in two new families:

- **Topic-pill icons** (Topics section, six icons): 20×20,
  `stroke=currentColor stroke-width=1.8`. Slightly lighter weight than
  the contact-row icons (1.8 vs 2.0) because they sit inside a tinted
  rounded tile that already carries visual weight.
- **Placeholder-card icons** (YouTube, Newsletter): 22×22, mixed —
  YouTube uses a filled play triangle (filled because that's the
  recognised YouTube glyph), Newsletter uses the same `stroke=currentColor
  stroke-width=1.8` envelope.

Conclusion: standardised on **1.8 stroke for new outline icons**,
matching the lightest existing weight (sidebar-social svg also uses
1.5–1.8). Filled icons reserved for service marks (YouTube).

## Card hover affordance

Existing `.fpe-article-card` / `.fpe-path-card` lift on hover
(`transform: translateY(-3px)`, secondary-tinted border + shadow).

Phase 1 reuses this pattern for `.fpe-topic-pill`,
`.fpe-popular-item`, `.fpe-roadmap-card`, `.fpe-recent-card`. The
lift distance is slightly smaller for the more compact cards
(`-1px` for popular, `-2px` for topic/roadmap) so a row of 4–6
elements doesn't visually jitter when the cursor traverses them.

Placeholder cards (YouTube, Newsletter) and the About strip are
**not** interactive at the card level — no hover lift. Each contains
a regular text link that uses the standard link affordance.

Conclusion: hover system is consistent; new cards explicitly opt-out
of the lift when they aren't single-link cards.

## Header & Footer

Out of scope for Phase 1. Both are working and on-brand. The Topics
section the user requested lives in the page body, not in the global
header — Phase 2 (`<TopicNav>` component) will introduce a
sub-header-like horizontal nav strip if the explorer reshape exposes
a need for it.

## What changed in CSS as a result of this audit

Nothing. The audit's outcome was "the existing system is solid;
Phase 1's new sections fit inside it with additive rules only." All
deltas are net-new selectors at the bottom of `custom.scss`; no
existing selector or declaration is modified.
