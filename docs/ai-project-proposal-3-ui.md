# Forge & Fable — Round 3: UI Polish Pass

**Audience:** An AI coding assistant executing this work in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Reference character for all verification: a level 1 cleric** (create one via the wizard if none exists — all reported issues were observed there).

---

## 1. Context

Forge & Fable is a Next.js 16 / React 19 / TypeScript D&D character builder. The character sheet (`src/components/HeroSheet.tsx`) renders sections (vitals, abilities, saves, skills, features tabs, equipment, attacks…) into three drag-and-drop columns. All styling lives in one file: `src/app/globals.css` (~4,500 lines, plain CSS, classes prefixed `cs-` for the sheet). Sheet colors/fonts come from CSS variables set by a theming system — **never hardcode colors; use the existing `var(--…)` tokens.**

This round is visual polish only. No behavior changes, no new features, no data-model changes.

## 2. Ground Rules

1. **CSS-first.** Prefer fixing in `globals.css`. Touch component markup only when a fix genuinely needs it (e.g. changing a label string), and keep every existing `cs-*` class name — the layout system and drag-and-drop reference them.
2. **No redesign.** Same visual language, fonts, colors, spacing scale. You are tightening, not reimagining.
3. **No new dependencies.**
4. Another work round may have recently touched `src/components/HeroSheet.tsx` (hit-dice/pact-slot features). Build on whatever is there; do not revert anything.
5. After each task: `npm run lint` (0 errors) + `npm run build` (pass).
6. **Verify visually, not just by code.** Run the dev server (`npm run dev` — reuse the existing one if port 3000 is taken; Next refuses a second dev server for the same project) and confirm each fix on the level 1 cleric at a ~1280px viewport AND a ~375px mobile viewport.
7. **Deliverable:** `docs/CHANGES-3.md`, one entry per task: what changed + how you visually verified it. A task without an entry counts as not done.

## 3. Tasks

### Task 3.1 — Vitals bar: "INITIATIVE" wraps mid-word and misaligns its value

**Where:** `globals.css` — `.cs-vitals` (~line 3614), `.cs-vital-label` (~line 3703), `.cs-vital-cell` (~line 3692). Markup in `HeroSheet.tsx` `case "vitals"`.

**Root cause:** `.cs-vitals` uses `grid-template-columns: repeat(auto-fit, minmax(4.4em, 1fr))`. 4.4em is narrower than the word "INITIATIVE" at its font size + letter-spacing, so the label wraps mid-word ("INITIATIV / E") and the two-line label pushes the value down relative to sibling cells.

**Fix (all three parts):**
1. Shorten the label in the vitals markup from "Initiative" to **"Init"** (keep the `Activity` icon).
2. Add `white-space: nowrap;` to `.cs-vital-label` so no vital label can ever wrap mid-word.
3. Align values across cells regardless of label height: give `.cs-vital-cell` a consistent row structure (`grid-template-rows: auto 1fr; align-items: center;` or equivalent) so every big number sits on the same baseline. The AC cell has a third element (`.cs-ac-src` source line, e.g. "Chain mail + shield") — it must tuck under the number without pushing AC's number out of line with the others.

**Accept:** at 1280px and at narrower widths where cells reflow, no vital label wraps mid-word and all vital numbers (AC / Init / Speed / Prof / Hit Dice) are vertically aligned with each other. The AC source line still shows.

### Task 3.2 — Features & Traits tabs: every tab is as tall as the tallest tab

**Where:** `globals.css` ~lines 3962–3974:

```css
.cs-reftab-panel { overflow: auto; display: grid; }
.cs-reftab-panel > * { grid-area: 1 / 1; }   /* all 4 panels stacked in one cell */
.cs-reftab-hidden { visibility: hidden; pointer-events: none; }
```

**Root cause:** all four tab panels (Features / Traits / Spells / Inventory) render simultaneously, stacked into the same grid cell, with inactive ones merely `visibility: hidden`. A hidden panel still occupies layout space, so the section is always as tall as the tallest tab — on a cleric, the Spells list — leaving Features/Traits/Inventory mostly blank.

**Fix:** make hidden panels stop contributing to height: change `.cs-reftab-hidden` to `display: none;` (the `grid-area` stacking then has no effect on height and can stay or go). Keep the panels mounted in the DOM as they are — do NOT switch to conditional rendering in the component; tab state (e.g. scroll position of the spell list) resetting is acceptable, but don't restructure the JSX.

**Check the side-effect:** with `display: none`, switching tabs changes section height, which reflows the whole column. That's the desired behavior. Make sure `overflow: auto` on the panel doesn't now clip the active tab; if the panel had an implicit max-height from a parent, verify the Spells tab still scrolls properly rather than stretching the page infinitely (a `max-height` around `70vh` with `overflow: auto` on the panel is acceptable if needed).

**Accept:** on the level 1 cleric, the Features tab section ends just after its content (no blank void below); switching to Spells grows the section; Traits and Inventory are compact.

### Task 3.3 — Sheet density: too much blank space with all sections expanded

**Where:** `globals.css` sheet sections (`.cs-block`, `.cs-sheet-columns`, `.cs-sheet-col`, `.cs-section`, and per-section grids); `src/lib/sheetLayout.ts` `DEFAULT_LAYOUT` if rebalancing helps.

This is a judgment task — apply the following bounded set of changes and nothing more:

1. **Empty sections shrink to a single line.** Sections that render only a "No …" placeholder (`.cs-muted`: "No notes recorded", "No equipment", "No actions", empty senses never happens) should be visually compact — reduce their padding so a placeholder-only section is one tight row, not a tall empty card.
2. **Tighten vertical rhythm.** Reduce section-internal padding and inter-section gaps by ~25% (e.g. paddings of 14–16px → 10–12px; column gap similarly). One consistent adjustment across `.cs-block` / `.cs-section` / column gap — not per-section special cases.
3. **Rebalance the default columns** in `DEFAULT_LAYOUT` (`src/lib/sheetLayout.ts`) so tall and short sections mix: currently `[abilities, senses, profs] / [saves, skills] / [equipment, attacks, features, notes, background]` — column 3 is far taller than column 1. A better split (verify visually, adjust if needed): `[abilities, saves, senses] / [skills, equipment, profs] / [attacks, features, notes, background]`. Note `mergeWithDefaults` only applies the default to characters without a saved layout — that's fine; don't migrate saved layouts.
4. **Do not** implement masonry, virtualization, or auto-collapse logic.

**Accept:** side-by-side screenshots (before/after) of the level 1 cleric with all sections expanded show clearly less dead space; no text clipping anywhere; drag-and-drop reordering still works; mobile layout unaffected or improved.

### Task 3.4 — Sweep for the same wrap bug elsewhere

With 3.1 fixed, check the other compact labels that share the pattern (`.cs-section-eyebrow`, `.cs-skill-ability-tag`, `.cs-spell-level-head`, vitals "DEATH SAVES", the equipment field labels) at 1280px, 1024px, and 375px. Fix any mid-word wraps the same way (nowrap or a shorter label). List what you checked in CHANGES-3.md even if nothing needed fixing.

**Accept:** no mid-word label wrapping at the three test widths.

## 4. Verification & Deliverables

1. Level 1 cleric, all sections expanded, 1280px: screenshot before starting and after finishing — attach both paths in `docs/CHANGES-3.md`.
2. Confirm: labels intact, tab heights dynamic, numbers aligned, drag-and-drop still reorders sections, skins/themes still apply (switch to one preset skin and confirm nothing broke).
3. `npm run lint` 0 errors; `npm run build` passes.
4. `docs/CHANGES-3.md` per-task entries including anything you checked and deliberately did not change.
