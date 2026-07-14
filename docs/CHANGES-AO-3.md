# CHANGES-AO-3 — Arcane Observatory Phase 3: global shell migration

Date: 2026-07-14. Author: Fable. Gates 1+2 passed by owner; accent locked
to old gold `#b3924a`/`#d9b967` (10-option comparison, option 2).

## What changed

First user-visible change of the redesign. The theme attribute is now ON:
`<body data-theme="arcane-observatory">` in `src/app/layout.tsx`. All
overrides live in the Phase 3 block of `src/app/arcane-observatory.css`,
scoped to the attribute — removing the attribute restores the legacy shell
wholesale (that is the rollback).

- **Tokens:** `--border-brass(-bright)` updated to the owner-picked old
  gold. Everything brass-accented (primitives, showcase) follows.
- **App field:** the `heroes-backdrop.jpg` photo + washes behind the
  logged-in app (`.builder-shell::before`) replaced with the matte void
  (`--surface-app`) and a faint engraved grid. The grain texture pass
  stays. Splash and auth screens keep the photo for now — explicit Gate 3
  question.
- **Top bar** (`.builder-topbar.ledger-topbar`): shell surface, engraved
  lower edge, old-gold "FORGE & FABLE" eyebrow, warm-white wordmark, muted
  secondary chrome, focus-visible outlines on icon actions.
- **Roster rail** (`.vault-rail.ledger-rail`): re-pointed the rail's
  `--ledger-*` local variables at shell tokens, so the entire legacy rail
  rule-set re-materializes dark without touching any of its rules.
  **Intentional behavior of note: the rail is no longer tinted by the
  selected character's skin** — skins now theme the sheet (and the toast
  seal) only, per the plan's containment rule. The inline `--paper`/`--ink`
  vars still flow to the sheet unchanged.
- **Main plate frame** (`.studio-surface`): recessed dark well; the
  `:has()` transparent variants inherit the new void. Paper interiors
  (onboarding, commission picker, creator, sheet) intentionally unchanged —
  they now read as documents in a dark frame, which is the target
  hierarchy, and migrate properly in Phase 4A–4C.
- **Toasts** (`.ff-toast`): opaque shell surface, overlay shadow; the
  active character's accent survives as the left seal rule.

## Behavior preserved

No TSX logic changed anywhere (layout.tsx attribute only). Auth, roster
selection, creation flows, sheet, campaigns, DM table all render their
existing components; only shell chrome colors/materials changed. No
gameplay/persistence/API changes. No backdrop-filter/glass/glow introduced.

## Verification

- `npm run build` ✓ · `npm test` 264 ✓ · `npm run lint` 0 errors ✓.
- Recaptured against :3010 production build (scripts pass 1/2/5):
  roster+sheet (all 4 breakpoints + 5 tabs), onboarding fork, commission
  picker (default + chosen), creator, campaigns, mobile 390x844. Sheet
  keeps its skin theming; rail/topbar/void all dark; parchment contained.
- Known pre-existing quirk (unchanged): DICE drawer tab overlaps page
  headings at some widths — Phase 4 item.

## Rollback

Remove the `data-theme` attribute from `src/app/layout.tsx` (or revert the
AO-3 commit).
