<!-- 3point0 Labs · foundation/design-system.md · Last updated: 2026-04-17 by Marquel -->

# Stone & Cognac — 3point0 Labs Design System

## What this is

The visual system for every 3point0 Labs surface: 3point0 OS (the internal operating system), the Mailroom (pixel-office view), podcast landing pages, partner decks, outbound PDFs, Loom thumbnails — everything.

It is **warm, dense, and unfussy**. Think architect's office, not a SaaS dashboard:

- **Stone** for surfaces — a soft, paper-textured background that doesn't fight the content.
- **Cognac** for intent — a single leather-brown accent that only shows up where something is clickable or active. No rainbow semantic colors.
- **Mono tracks** for data — tight, uppercase, high-tracking monospace so numbers, labels, and statuses read like an instrument panel.
- **Serif for headlines** — Instrument Serif with italic for emphasis, one grade above everything else.

Cognac is not decorative. If a cognac element isn't an action or an active state, it's a bug.

The source of truth for tokens and rules is this file. Implementations must match. If `src/app/globals.css` and this doc disagree, the doc wins and the code gets updated.

---

## Palette

### Semantic tokens

| Token | Hex / value | Role |
|---|---|---|
| `--bg` | `#E8E0D4` | Page background (stone) |
| `--bg-elevated` | `#DDD3C4` | Elevated stone (hover rows, scrollbar thumb) |
| `--bg-warm` | `#F2ECE1` | Cream panels (cards, inputs, login card) |
| `--bg-dark` | `#2A1F17` | Inverse / dark surfaces (modal scrim, rare) |
| `--fg` | `#2A1F17` | Body text |
| `--fg-dim` | `#6B5A4A` | Secondary text, table headers |
| `--fg-mute` | `#A89885` | Placeholders, tertiary text, offline dots |
| `--border` | `rgba(42, 31, 23, 0.12)` | Default 1px border |
| `--border-strong` | `rgba(42, 31, 23, 0.22)` | Stat card rings, emphasized separators |
| `--accent` | `#8B4513` | Primary accent (cognac) |
| `--accent-hover` | `#A0552A` | Accent hover / warmer variant |
| `--accent-rgb` | `139, 69, 19` | Same, exposed as channels for `rgba()` |

### Per-workspace accent override

The podcast switcher remaps `--accent` and `--accent-rgb` at runtime so each workspace gets its own flavor of cognac:

- **One54** → `#8B4513` (cognac, `139, 69, 19`)
- **Pressbox Chronicles** → `#A0552A` (warmer cognac, `160, 85, 42`)

Both are earth tones inside the stone palette. Never route one brand to e.g. blue.

### Legacy aliases

For components that haven't been migrated, these older variable names are mapped to the new tokens and will keep working:

```
--color-bg-primary       →  --bg
--color-bg-secondary     →  --bg-warm
--color-bg-tertiary      →  --bg-elevated
--color-accent-primary   →  --accent
--color-accent-coral     →  --accent-hover
--color-accent-eggshell  →  --fg
--color-text-secondary   →  --fg-dim
--color-border           →  --border
--color-border-strong    →  --border-strong
--color-coral-rgb        →  160, 85, 42
--color-leather-rgb      →  139, 69, 19
--background             →  --bg
--foreground             →  --fg
```

New code should use the new tokens. Aliases exist so we can migrate at our own pace without a flag day.

---

## Typography

Three fonts, loaded once in `src/app/layout.tsx` via `next/font/google` and exposed as CSS variables so Tailwind utilities and raw CSS both pick them up.

| Variable | Family | Weights |
|---|---|---|
| `--font-geist-sans` | Geist | 300, 400, 500 |
| `--font-instrument-serif` | Instrument Serif | 400 (regular + italic) |
| `--font-jetbrains-mono` | JetBrains Mono | 400, 500, 700 |

### How each is used

**Geist — body & UI (default).**
Weight **300** for running text, 400–500 for emphasis. Antialiased. Compact line-height (~1.5 on mobile).

**Instrument Serif — display headlines.**
Apply the `.font-display` or `.font-serif-display` class. Slight negative letter-spacing (`-0.01em`). Italicize via `<em>` for emphasis — the system treats `font-display em` as expressive italic on purpose.

**JetBrains Mono — data, labels, stats, nav chips, timestamps.**
Every element tagged `.font-mono` (or any Tailwind utility that matches `[class*="font-mono"]`) is globally **uppercased** with **`0.14em` letter-spacing**. This is the instrument-panel register.

**Opting out of mono uppercasing.** Add `.mono-raw` to any mono element that must preserve case or spacing (email addresses, code snippets, user-typed input). The following already opt out by default: `code`, `pre`, `input.font-mono`, `textarea.font-mono`.

---

## Paper grain

Every page renders an 8% opacity SVG `fractalNoise` overlay, multiply-blended on top of the background. This gives surfaces their "warm paper" feel and prevents large flat areas from looking sterile.

- **Technique:** SVG filter `feTurbulence` (`baseFrequency='0.9'`, `numOctaves='2'`, `stitchTiles='stitch'`), colored through a brown `feColorMatrix`, painted into a 240×240 tile and repeated across `body::before`.
- **Opacity:** 0.08.
- **Blend mode:** `multiply`.
- **z-index:** 0, non-interactive (`pointer-events: none`), sits under all content (`body > *` gets `z-index: 1`).

Never darken the page with a separate overlay layer. The grain is the texture.

---

## Surfaces

### Cards & panels

Classes `.mission-card` and `.glass-card` are the two supported surface primitives. They are **visually identical** — `.glass-card` is kept as an alias so legacy components keep working without edits. New code should prefer `.mission-card`.

```
background:     var(--bg-warm)    /* cream */
border:         1px solid var(--border)
border-radius:  0
box-shadow:     none
backdrop-filter: none
```

On hover: `box-shadow: 0 1px 0 rgba(42, 31, 23, 0.06)`. That's the only shadow allowed anywhere in the system.

`.stat-card-ring` is an inset 1px `--border-strong` stroke, used on pipeline stat cards to add weight without a heavier border.

### Global shadow/gradient enforcement

The globals.css layer strips Tailwind's `shadow-*` and `bg-gradient-*` / `from-*` / `to-*` / `via-*` utilities site-wide:

```
[class*="shadow-"]      { box-shadow: none !important; }
[class*="shadow-"]:hover{ box-shadow: 0 1px 0 rgba(42,31,23,0.06) !important; }
[class*="bg-gradient-"],
[class*="from-"],
[class*="to-"],
[class*="via-"]         { background-image: none !important; }
```

This means you can keep `shadow-sm` / `shadow-lg` in legacy markup and the system will neutralize it. Don't reach for `!important` overrides in component files — the design rule is enforced here.

---

## Buttons

Every `button`, `a[role="button"]`, `input[type="submit"]`, and `input[type="button"]` is forced to `border-radius: 0`. Crisp edges, no pills.

Focus ring: `1px solid var(--accent)` with `1px` offset. Keyboard users always see the accent.

### Primary CTA — `.btn-cta`

```
min-height:      44px
padding:         0.625rem 1rem
font-family:     JetBrains Mono
font-size:       0.6875rem  (11px)
font-weight:     500
letter-spacing:  0.14em
text-transform:  uppercase
border:          1px solid var(--accent)
background:      var(--accent)
color:           var(--bg-warm)
```

Hover swaps both background and border to `--accent-hover`. Disabled state: `opacity: 0.45`, `cursor: not-allowed`.

### Progress meter — `.leather-progress`

Flat 2px bar in `--accent`. No radius, no animation.

---

## Forms

```
input, textarea, select {
  background:     var(--bg-warm)
  color:          var(--fg)
  border-radius:  0
}

input::placeholder,
textarea::placeholder {
  color: var(--fg-mute)
}
```

Borders are inherited from the global `* { border-color: var(--border); }` rule. Focus styling piggybacks on the button focus ring.

---

## Tables

Dense mono labels, thin separators. No alternating row colors.

```
table thead th {
  font-family:     JetBrains Mono
  text-transform:  uppercase
  letter-spacing:  0.14em
  font-size:       0.6875rem   (11px)
  color:           var(--fg-dim)
  border-bottom:   1px solid var(--border)
}

table tbody tr { border-bottom: 1px solid var(--border); }
```

---

## Scrollbars

Webkit-only styling, aligned to the palette:

```
::-webkit-scrollbar            { width: 10px; height: 10px; }
::-webkit-scrollbar-track      { background: var(--bg); }
::-webkit-scrollbar-thumb      { background: var(--bg-elevated); border: 2px solid var(--bg); }
::-webkit-scrollbar-thumb:hover{ background: var(--fg-mute); }
```

---

## Login screen

`.login-page-bg` and `.login-card` exist to guarantee the sign-in surface matches the rest of the system:

- `.login-page-bg` — solid `--bg`, no image, no animation.
- `.login-card` — cream `--bg-warm`, 1px `--border`, no radius, no shadow, no backdrop filter.

---

## Modals & drawers — the scrim

Use the `.scrim` class on any backdrop that darkens the page:

```
.scrim { background: rgba(42, 31, 23, 0.4); }
```

40% dark-brown. Never pure black, never fully opaque. Modals themselves are `.mission-card` surfaces inside the scrim.

---

## Design principles

These constrain anyone (human or agent) designing new surfaces:

1. **Dense tables, not drama.** Information per square inch beats hero sections.
2. **Mono tracks on everything data-related.** Labels, timestamps, IDs, stats — all JetBrains Mono uppercase, `0.14em` tracking.
3. **Stone background, cream panels.** Never white-on-white. Never pure black anywhere.
4. **Cognac accents only on primary actions and active states.** If it isn't clickable or currently selected, it shouldn't be cognac.
5. **Light paper grain** via SVG `fractalNoise` at 0.08 opacity, multiply blend.
6. **No gradients. No shadows except subtle on hover.**
7. **1px borders, crisp edges, zero border-radius on buttons.** Pills are only acceptable on non-interactive status chips and avatars, and only via explicit utilities.
8. **Display headlines in Instrument Serif, italicized for emphasis.**
9. **Desktop-first, mobile-friendly.** Every interactive target hits 44px minimum height on touch.
10. **Dark theme-aware components survive the light theme.** The legacy `--color-*` aliases exist so nothing has to break while we migrate.

---

## Source files

- `src/app/globals.css` — the authoritative CSS implementation. Treat this file as a mirror of this doc.
- `src/app/layout.tsx` — font loading (`Geist`, `Instrument_Serif`, `JetBrains_Mono` via `next/font/google`) and the `<html>` variable wiring.
- `src/components/PodcastWorkspaceProvider.tsx` — per-workspace accent override (`One54` / `Pressbox Chronicles`).
- `.cursorrules` and `CLAUDE.md` — the originating project directives. Do not contradict them.

## Change protocol

1. Propose the change in this doc first. Include the rationale.
2. Only after the doc is updated, mirror the change into `globals.css` (and `layout.tsx` / provider files if needed).
3. If the change introduces a new token, add it to both the semantic table and — if it replaces something legacy — the alias list.
4. Run the site visually end-to-end; if any surface regresses, revert and try again.
5. Commit with a scope prefix: `style(design-system): <change>`.

Breaking changes to tokens require a paragraph in the commit body explaining the migration path for legacy aliases.
