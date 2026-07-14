# CHANGES-AO-2 — Arcane Observatory Phase 2: shared interface primitives

Date: 2026-07-14 (overnight). Author: Fable.
Plan: docs/arcane-observatory-implementation-plan.md — Phase 2.

## What changed

All in `src/app/arcane-observatory.css` (labeled Phase 2 block) and the
`/theme-observatory` showcase. **Class-based primitives** (`.ao-*`), scoped
under `[data-theme="arcane-observatory"]` so nothing leaks into the product,
which still renders entirely on the legacy theme.

Primitives are CSS classes rather than React components — matching how this
codebase styles everything (semantic classes + the stylesheet, no CSS
modules). Structural React wrappers can be extracted per-surface during
Phase 4 migrations where they earn their keep.

- **Surfaces:** `.ao-panel` / `-raised` / `-recessed`, `.ao-panel-header`
  (engraved bottom rule), `.ao-document` (parchment + faint ruled lines),
  `.ao-rule` (engraved: dark cut + light return), `.ao-rule-brass`,
  `.ao-eyebrow`.
- **Buttons:** `.ao-btn` + `-primary` (arcane blue), `-brass`, `-quiet`,
  `-danger`, `-icon`; hover / active / focus-visible / disabled for each.
- **Fields:** `.ao-field` (+ caps label), `.ao-input`, `.ao-select`,
  `.ao-textarea`, error via `[aria-invalid="true"]` + `.ao-field-error`,
  disabled states, `.ao-checkline` (checkbox/radio via accent-color).
- **Navigation:** `.ao-segmented` (`aria-pressed`), `.ao-tabs`/`.ao-tab`
  (`aria-selected`, brass underline for the active tab).
- **Data display:** `.ao-chip` (`data-tone`: active/selected/success/
  warning/danger; square dot glyph so tone is not color-only),
  `.ao-banner` (tones via 3px left rule), `.ao-log` (hairline ledger
  rhythm; `data-tone="critical"` seal tint, `"announce"` italic
  marginalia), `.ao-stat`, `.ao-meter` (`role="meter"`; hp-low/resource
  tones), `.ao-token-disc` (circles stay reserved for tokens/portraits),
  `.ao-index-badge` (styled numeric badge — the plan's replacement for
  Unicode circled numbers), `.ao-empty`.
- **State grammar** (plan Phase 2, DM-11 alignment): `.ao-row` +
  `.ao-marker` with `data-state="acting|selected"` —
  acting = 3px seal-red rule + filled diamond marker + warm wash +
  "ACTING NOW" text label; selected = 3px arcane rule + hollow ring, no
  wash; combined state renders acting (rules/markers never stack; selection
  stays evident via chip/inspector). Non-color cues everywhere: text
  label, marker shape, weight.
- **Overlay shells:** `.ao-modal` (opaque `--surface-overlay`, brass top
  rule, broad shadow), `.ao-modal-scrim` (plain dark scrim — **no blur**).
- Showcase route extended with a gallery of every primitive in every
  state, including the combined-state row and a mock dialog + handout.

## What did NOT change

- Zero product surfaces reference any `.ao-*` class yet; legacy theme
  untouched; no gameplay/persistence/API changes; no `backdrop-filter`,
  translucent panels, glow, or animation.

## Verification

- `npm run build` ✓ · `npm test` 264 ✓ · `npm run lint` 0 errors ✓.
- Showcase screenshot `QA/screenshots/ao-baseline/P1-showcase-full.png`
  (regenerated; covers tokens + primitives).
- Focus is `:focus-visible` (2px arcane outline) on every control.
- Not yet run (lands with Phase 3/4 migrations per the testing strategy):
  automated axe/contrast pass, screen-reader review, 200% zoom sweep.
  Flagged as Gate 2 checklist items.

## Rollback

Revert the AO-2 commit; additive CSS + showcase only.
