# CHANGES-AO-1 — Arcane Observatory Phase 1: semantic token foundation

Date: 2026-07-14 (overnight). Author: Fable.
Plan: docs/arcane-observatory-implementation-plan.md — Phase 1.

## What changed

- **New theme layer:** `src/app/arcane-observatory.css`, imported in
  `src/app/layout.tsx` immediately after `globals.css`. One refinement over
  proposal 34 §3 (which said "append to globals.css"): the new system lives
  in its own file imported after the monolith — identical cascade effect,
  cleaner ownership. globals.css itself is untouched.
- **Semantic tokens** under `[data-theme="arcane-observatory"]`: surfaces
  (app/shell/panel/raised/recessed/document/document-muted/input/overlay),
  text roles (incl. `--text-document*`), borders + brass + engraved-rule
  pair (`--rule-engraved-dark`/`-light`), state colors with `-soft` washes
  (active seal red / selected arcane blue / success / warning / danger),
  depth (3 shadows + recessed inset), geometry (`--radius-xs/sm/md` =
  2/3/5px), spacing scale (`--space-1..9` = 4..48px), and typography roles
  mapping the EXISTING project fonts (Fraunces/Newsreader/Archivo/Space
  Mono) to display/section/label/body/numeric. No new fonts imported.
- **Token showcase route:** `/theme-observatory`
  (`src/app/theme-observatory/page.tsx` + `.ao-sc-*` styles in the theme
  file). Unlinked, no auth, `robots: noindex`, static. This is the Gate 2
  review surface; Phase 2 extends it with primitives.
- Starting values follow the plan's palette, leaned matte per the
  prototype's override layer. All values are candidates until Gate 2.

## What did NOT change

- No component reads a semantic token yet; nothing sets `data-theme` except
  the showcase's own wrapper. Every product screen renders exactly as
  before (legacy theme fully intact).
- No gameplay behavior, persistence, API, or schema changes.
- No `backdrop-filter`, translucency, glow, or decorative animation added.

## Verification

- `npm run build` compiles (`/theme-observatory` prerenders static).
- `npm test`: 264 passed. `npm run lint`: 0 errors (3 pre-existing warnings).
- Showcase screenshot: `QA/screenshots/ao-baseline/P1-showcase-full.png`
  (Playwright, 1440px; preview-pane verification blocked by tool outage).

## Rollback

Revert this commit; the app has zero runtime dependence on the new file
beyond the layout import line.
