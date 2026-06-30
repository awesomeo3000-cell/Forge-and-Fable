# Project Outline — Customizable Sheet Layout (Reorder + Collapse/Expand Sections)

**Project:** Forge & Fable
**Feature:** Let each player rearrange and collapse/expand the sections of their character sheet, so a spell-slinger can pull **Spells** to the top and a hoarder can move/expand **Inventory** — and have that layout saved per character.
**Intended implementer:** an AI coding assistant (e.g. DeepSeek). Section 12 has copy-paste prompts.

---

## 1. Goal in one sentence

A player opens "Customize layout", drags the **Spells** card up to the top-left and collapses **Background** and **Senses** to one-line headers; their sheet remembers this arrangement every time they open it, and it doesn't affect anyone else's character.

---

## 2. The core challenge (read this first)

The sheet is **not** a flexible list today — it's a fixed CSS grid with hard-coded placement. In `src/app/globals.css`:

```css
.cs-sheet {
  display: grid;
  grid-template-columns: 8.5em minmax(10.5em, 0.9fr) minmax(0, 1.3fr) minmax(0, 1.3fr);
  grid-template-areas:
    "identity   identity  vitals     vitals"
    "abilities  saves     attacks    attacks"
    "abilities  skills    features   features"
    "abilities  skills    features   features"
    "senses     skills    notes      background"
    "profs      skills    notes      background"
    "console    console   console    console";
}
```

Each section (`.cs-identity`, `.cs-abilities`, …) is placed by a `grid-area` name. Some sections **span multiple rows/columns** (`abilities` spans 3 rows in column 1; `features` spans 2 rows; `skills` spans column 2). Because position is baked into CSS, you cannot reorder or cleanly collapse sections by changing data — collapsing a cell just leaves a hole, and there's nowhere for "move Spells up" to write to.

**Therefore the foundational work is to make the layout data-driven** (rendered from a per-character layout array) instead of from a static `grid-template-areas`. Everything else (collapse, drag-and-drop) builds on that. This is the single most important decision in the project.

There is good precedent in the codebase: the recently added **per-character theme** (`character.theme`) shows the exact pattern to follow — an optional field on `Character`, applied at render, saved through the existing `updateCharacter` patch-merge. We mirror that with `character.sheetLayout`.

---

## 3. Current architecture (facts the implementer needs)

| Concern | Where | Notes |
|---|---|---|
| Sheet markup | `src/components/HeroSheet.tsx` | Returns `<div className="cs-sheet">` with ~12 `<section>`/`<div>` children, one per area. |
| Layout | `src/app/globals.css` (`.cs-sheet`) | Fixed `grid-template-areas`; responsive single-column at `max-width: 760px`. |
| Sections (stable IDs) | — | `identity, vitals, abilities, saves, skills, senses, profs, attacks, features, notes, background, console`. (`features` is the tabbed Features/Traits/Spells/Inventory container.) |
| Data model | `src/types/game.ts` | `Character` type. `theme?` is the precedent for an optional per-character UI field. |
| Persistence | `src/lib/vaultStore.ts` | `updateCharacter(userId, id, patch)` shallow-merges — saving a layout is `onUpdate({ sheetLayout })`. |
| Save plumbing | `src/components/ForgeAndFableApp.tsx` | Owns character state, passes `onUpdate` into `HeroSheet`. |

> **Note on "Inventory":** Inventory isn't a top-level section today — it's a **tab inside the `features` card** (Features / Traits / Spells / Inventory). So "move Inventory to the front" has two possible meanings: (a) reorder the whole reference card, or (b) **promote tabs to standalone, reorderable sections**. See §6 for the recommendation.

---

## 4. What the player can do (scope)

1. **Collapse / expand** any non-essential section to a one-line header (chevron toggle). Collapsed state is remembered.
2. **Reorder** sections via drag-and-drop (with a keyboard-accessible fallback).
3. **Move sections between columns** (so "pull Spells to the top-left").
4. **Reset to default layout.**
5. A few sections may be **pinned** (always present, can't be removed) — e.g. `identity`. Players can't delete sections in the MVP, only rearrange/collapse.

Out of MVP: resizing sections by drag, multiple saved layout presets, sharing layouts, adding/removing sections entirely.

---

## 5. Recommended technical approach

### 5.1 Layout model — "column buckets"

Replace the fixed `grid-template-areas` with **N responsive columns, each an ordered list of section IDs**. This preserves the magazine feel, supports drag between columns, and degrades to one column on mobile.

```ts
// default desktop layout, derived from today's design
const DEFAULT_LAYOUT: SheetLayout = {
  columns: [
    ["identity", "abilities", "senses", "profs"],
    ["vitals", "saves", "skills"],
    ["attacks", "features", "notes", "background"],
  ],
  collapsed: [],         // section IDs currently collapsed
  version: 1,
};
```

Render: map each column to a vertical stack; render each section by ID via a `SECTION_REGISTRY` (id → component). On `max-width: 760px`, flatten all columns into one ordered list (keep the existing mobile behavior).

### 5.2 Drag-and-drop library

Use **`@dnd-kit/core` + `@dnd-kit/sortable`** (`npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`). Rationale: React-native, accessible (keyboard sensor for arrow-key reordering), touch support, and first-class multi-container sortable for moving between columns. Avoid the legacy `react-beautiful-dnd` (unmaintained) and raw HTML5 DnD (poor touch/a11y).

> **Next.js note:** dnd-kit is client-only. `HeroSheet.tsx` is already `"use client"`, so no extra setup; just ensure no drag state is computed during SSR.

### 5.3 Collapse/expand

Wrap every section in a small `<SheetSection id title>` component that renders a header (title + collapse chevron + drag handle) and the section body. Collapsed = render header only. Store collapsed IDs in `sheetLayout.collapsed`. This is independent of drag and can ship first.

### 5.4 Edit mode

Drag handles and the "Reset layout" button only appear in an **edit mode** toggled from the sheet header (a "Customize layout" button next to the existing Appearance button). Outside edit mode the sheet reads normally and sections still collapse/expand. This prevents accidental drags during play.

### 5.5 Persistence & forward-compatibility

- Save via a **debounced** `props.onUpdate({ sheetLayout })` → flows through existing `updateCharacter`.
- `sheetLayout` is **optional**; `undefined` → `DEFAULT_LAYOUT` (existing characters unaffected, no migration).
- **Merge-with-defaults on load:** if new sections are added to the app later, any section ID not present in the saved layout is appended to a default column so it never disappears. Unknown/removed IDs are ignored.

---

## 6. Decision: how to handle Inventory & Spells

Because Inventory/Spells live as **tabs inside the `features` card**, recommend a small **Phase 3 enhancement**: allow each reference tab (Features, Traits, Spells, Inventory) to be "popped out" into its own top-level, reorderable, collapsible section. Implementation: the `SECTION_REGISTRY` gains entries for `spells` and `inventory`; a tab's "pop out" control adds its ID to the layout and removes it from the tab strip. This is what truly delivers "move Spells to the front" and "expand Inventory." If out of budget, the MVP still lets players reorder/collapse the whole `features` card.

---

## 7. Data model changes (`src/types/game.ts`)

```ts
export type SheetSectionId =
  | "identity" | "vitals" | "abilities" | "saves" | "skills" | "senses"
  | "profs" | "attacks" | "features" | "notes" | "background" | "console"
  | "spells" | "inventory"; // last two = Phase 3 pop-outs

export type SheetLayout = {
  columns: SheetSectionId[][]; // ordered sections per column
  collapsed: SheetSectionId[];
  version: number;
};

// Add to Character:
//   sheetLayout?: SheetLayout;   // optional; undefined = DEFAULT_LAYOUT
```

---

## 8. File-by-file change list

| File | Change |
|---|---|
| `src/types/game.ts` | Add `SheetSectionId`, `SheetLayout`; add optional `sheetLayout?` to `Character`. |
| `src/lib/sheetLayout.ts` *(new)* | `DEFAULT_LAYOUT`, `SECTION_TITLES`, merge-with-defaults helper, mobile-flatten helper. |
| `src/components/HeroSheet.tsx` | Extract each section's JSX into a `SECTION_REGISTRY` (id → render fn); render columns from `sheetLayout` instead of relying on fixed grid areas; add edit-mode + collapse state; wire `onUpdate({ sheetLayout })`. |
| `src/components/SheetSection.tsx` *(new)* | Wrapper: header (title, collapse chevron, drag handle), collapsible body. |
| `src/app/globals.css` | Replace `.cs-sheet` `grid-template-areas` with a columns layout (`.cs-sheet-columns` / `.cs-sheet-col`); keep the `cs-*` inner styles; keep the 760px single-column rule; add collapsed/drag-handle/edit-mode styles. |
| `src/components/ForgeAndFableApp.tsx` | Ensure `sheetLayout` is included in update payloads (usually automatic via spread). |
| `package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. |

No change needed to `vaultStore.ts` — the generic patch merge already handles `sheetLayout`.

---

## 9. Phased plan & acceptance criteria

**Phase 1 — Data-driven layout (no visible change).** Move section JSX into a registry; render from `DEFAULT_LAYOUT` columns; replace `grid-template-areas` with column CSS. *Done when:* the sheet looks ~the same as before but is rendered from data; `tsc`/`eslint` green; mobile still single-column.

**Phase 2 — Collapse / expand.** Add `SheetSection` headers with a chevron; persist `collapsed`. *Done when:* collapsing Background hides its body, survives reload, and reflows cleanly (no empty hole).

**Phase 3 — Drag-and-drop reorder.** Add dnd-kit sortable within and across columns; add the "Customize layout" edit-mode toggle, drag handles, keyboard reordering, and "Reset layout". Optionally pop out Spells/Inventory. *Done when:* a player can drag Spells to the top-left and it persists per character.

**Phase 4 — Polish.** Touch/keyboard a11y pass, reduced-motion (no drag animation), mobile reorder, empty-column handling, merge-with-defaults for future sections.

**Global checks:**
- A character with no `sheetLayout` looks exactly like today (no regression).
- Two characters keep independent layouts.
- Reset returns to `DEFAULT_LAYOUT`.
- `npx tsc --noEmit` and `npx eslint` pass.

---

## 10. UX details worth specifying

- **Drag handle**, not whole-card drag — players click buttons inside cards (roll dice, toggle proficiency), so dragging must be limited to an explicit handle (or only active in edit mode).
- **Collapsed header** still shows a useful summary where cheap (e.g. Inventory → item count; Spells → "3 prepared").
- **Reduced motion:** disable drag transitions when `prefers-reduced-motion`.
- **Don't trap rolls:** keep all roll/interaction buttons working outside edit mode.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Refactoring the grid causes visual regressions. | Phase 1 reproduces the current look from `DEFAULT_LAYOUT` before any user-facing change; screenshot diff before/after. |
| dnd-kit + SSR hydration mismatch. | Component is client-only; compute drag state in effects, not during render. |
| Collapsing within the old fixed grid leaves holes. | That's exactly why Phase 1 (data-driven columns) precedes collapse. |
| Future sections vanish from saved layouts. | Merge-with-defaults appends unknown sections on load. |
| Buttons inside cards fire during drag. | Drag limited to a handle / edit mode; dnd-kit activation constraint (small drag distance). |
| Mobile drag is fiddly. | Use dnd-kit touch sensor + a long-press activation; keep simple up/down controls as a fallback. |

---

## 12. Ready-to-paste prompts for the AI implementer

> **Prompt 1 (Phase 1):** "In `src/components/HeroSheet.tsx`, refactor the character sheet so each section's JSX is registered by a stable id in a `SECTION_REGISTRY` (ids: identity, vitals, abilities, saves, skills, senses, profs, attacks, features, notes, background, console). Add `SheetSectionId` and `SheetLayout` types to `src/types/game.ts` and an optional `sheetLayout?` on `Character`. Add `src/lib/sheetLayout.ts` with `DEFAULT_LAYOUT` (3 columns reproducing the current design), `SECTION_TITLES`, and a merge-with-defaults helper. Render the sheet from `character.sheetLayout ?? DEFAULT_LAYOUT` as CSS columns, replacing the `grid-template-areas` in `.cs-sheet` with a `.cs-sheet-col` column layout. Keep the existing `cs-*` styles and the 760px single-column rule. The visible result must match the current sheet. Keep tsc/eslint green."

> **Prompt 2 (Phase 2):** "Add `src/components/SheetSection.tsx`: a wrapper with a header (title from SECTION_TITLES + a collapse chevron) and a collapsible body. Track collapsed section ids in `sheetLayout.collapsed`, persist via a debounced `onUpdate({ sheetLayout })`. Collapsed = header only; layout reflows with no gap. Respect `prefers-reduced-motion`."

> **Prompt 3 (Phase 3):** "Add drag-and-drop reordering with `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Sections are sortable within and across the layout columns via a drag handle that only appears in an 'edit mode' toggled from the sheet header. Support keyboard reordering and a 'Reset layout' button. Persist order via `onUpdate({ sheetLayout })`. Don't let card buttons fire while dragging (use an activation distance constraint)."

> **Prompt 4 (Phase 3b, optional):** "Allow the Spells and Inventory tabs inside the `features` card to be 'popped out' into their own top-level, reorderable, collapsible sections by adding `spells` and `inventory` to the SECTION_REGISTRY and a pop-out control on those tabs."

---

## 13. Estimated effort

Phase 1: ~4–6 hrs (the refactor is the bulk) · Phase 2: ~2–3 hrs · Phase 3: ~4–6 hrs · Phase 4: ~2–4 hrs. A capable model can do Phase 1–2 in a few guided iterations; Phase 3 benefits from screenshot feedback while wiring dnd-kit.
