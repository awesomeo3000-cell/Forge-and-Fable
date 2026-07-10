# CHANGES-22 — the threshold: pictorial build-mode cards (owner sketch, reviewer-applied)

The builder's first page ("Commission a character") replaced its three ruled
text rows with three vertical image cards, per the owner's annotated sketch:
static background art, dark scrim toward the bottom for the caption, continue
button unchanged.

## What changed
- `src/components/CharacterStartPanel.tsx` — the three modes render as
  `threshold-card` buttons: full-bleed art from `public/Start/` (swap the
  files to change art — no code edits), bottom scrim, uppercase serif label +
  italic descriptor + `Chosen ✦`. Premade is a 2×2 grid of four portraits
  with hairline dividers. Double-click a card to select-and-open.
  `aria-pressed`, the roster-empty eyebrow, and the "Open the commission"
  footer are kept.
- `src/app/globals.css` (append) — card grid (3-up capped at 900px, stacks
  1-up ≤760px with a 16:9 crop and head-safe `object-position`), the
  **ink-wash filter** (`sepia/saturate/contrast/brightness`) on every card
  image so mixed-source art reads as plates from one book, and the caption
  scrim. Gradient rule documented in the block: a scrim over an image is
  function (text legibility) — gradients on flat surfaces remain banned.
- Fallback: a broken/missing image hides itself (`onError`), leaving the
  parchment tint + a ghost ✦ ornament — the layout ships fine without art.
- `public/Start/` — the owner's six generated images were PNGs mislabeled as
  .jpg (~2.9MB each, ~17MB for the screen). Originals preserved in
  `public/Start/originals/`; served copies re-encoded to real progressive
  JPEGs at 900px (~140–190KB each, ~940KB total).

## Verification
- `npm run build` clean; `npm test` 74/74 passing (the CHANGES-20 suite).
- All six image URLs return 200 `image/jpeg` at compressed sizes
  (case-sensitive `/Start/…` path confirmed against the running server).
- Browser pass blocked again by the preview harness (wedges at the login →
  app transition; recurring, environmental). Owner verifies live: restart the
  server, click "+ New character" — expect three art cards with a unified
  sepia wash, captions on the scrim, seal-red border + `CHOSEN ✦` on click,
  double-click opens directly, and the footer button enables on selection.
