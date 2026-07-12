# CHANGES-31 — login screen as a ledger frontispiece (reviewer)

The auth screen was the last surface still in the pre-ledger glassmorphism
idiom — glass card, gold gradients, rounded 28px corners, teal accents,
weight-700+ type. Redesigned to the ledger world.

## What changed
- `AuthScreen.tsx`: the login card is now a parchment "title page." Seal-red
  crown glyph replaces the gold gradient box; hero headline/tagline stay light
  on the atmospheric world backdrop. Card gets an eyebrow ("Welcome back" /
  "A new hand at the table"), a display-serif title ("Open the ledger" /
  "Create your account"), Login/Register as ledger tabs, and an ink-fill
  `ledger-button` submit. Added `autoComplete` on the fields.
- `globals.css` (append, scoped to `.login-card.ledger-card` so shared
  `.control-field` / `.mode-switch` are untouched elsewhere): parchment page +
  grain, registry double-rule under the heading, seal-red active tab underline,
  hairline-bottom transparent inputs with seal focus, faded-ink small-caps
  labels, ink-fill primary button. Plus an override for the legacy
  `.login-heading span` rule (gold, weight 760) that was outranking
  `.ledger-eyebrow`.

## Follow-up: wax-seal ampersand brand mark
The crown glyph was replaced with a generated wax-seal-&-ampersand emblem
(`public/Start/brand-seal.png`). The supplied PNG had a baked-in gray/white
checkerboard "transparent" background (RGB, no real alpha) — keyed it out to
true transparency, trimmed to the seal, squared, and downscaled to 384px
(~157KB; original kept as `brand-seal.original.png`). Login `.brand-seal`
CSS drops the old red CSS circle and just sizes the image (48px, contain,
subtle drop shadow). Verified live: image loads (384² natural, 48² rendered)
and screenshot confirms the emblem beside the "FORGE & FABLE" wordmark.
Reusable for favicon + splash for full brand consistency (not yet wired).

## Verification
- `npm run build` clean; `npm run lint:ci` 0 warnings.
- The login page renders before the environment's login-wedge, so verified
  live (computed styles + screenshot): card `rgb(233,223,200)` parchment,
  3px radius, title dark ink weight 500, active tab seal-red text + seal-red
  underline, inputs `0px/1px` border transparent with dark-ink text, submit
  ink-fill `rgb(42,32,24)` on parchment text, crown seal seal-red 50% circle,
  and **zero elements at font-weight ≥700** (the pre-ledger flaw). Screenshot
  confirmed the frontispiece composition on the world backdrop.
