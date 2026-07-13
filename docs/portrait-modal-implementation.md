# Portrait Selector Modal — Implementation Summary

## Overview

Replaced the inline portrait gallery with a modal-based selector. Portraits are now chosen from an image-only grid with a large preview, "Suggested" / "All Portraits" tabs, and explicit Save/Cancel actions. No ancestry, gender, or presentation labels are ever shown to players.

---

## New Files

### `src/data/portraits.ts`
Portrait catalog with opaque IDs (e.g., `portrait-tiefling-01`). Each entry maps to a static image in `public/portraits/` and carries internal-only `suggestedAncestries` metadata for sorting. Exports `resolvePortraitSrc()` and `isCatalogPortrait()` lookup helpers.

### `src/components/portraits/CharacterPortrait.tsx`
Shared portrait renderer — the single component used everywhere a character portrait appears. Resolves a catalog ID to its image source, falls back to styled initials on error or when no portrait is set. Props: `portraitId`, `characterName`, `size`, `shape`, `decorative`, `className`.

### `src/components/portraits/PortraitSelectorModal.tsx`
Modal dialog for choosing a portrait:
- **Desktop:** scrollable image-only grid (left) + large circular preview (right)
- **Mobile:** stacked layout — preview on top, grid below
- **Tabs:** "Suggested" (filtered by ancestry, if one is selected) and "All Portraits"
- **Tiles:** circular, image-only, with neutral accessible labels (`Portrait option 1`, etc.)
- **Selected state:** gold accent ring + checkmark badge
- **Behavior:** temporary `pendingId` state — Cancel discards, Save commits, Escape cancels
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, focus trap, return focus on close

### `src/components/PortraitField.tsx`
Compact inline trigger row: circular portrait preview + "Choose Portrait" / "Change Portrait" button. Opens the modal. Used in the creator wizard, quickbuilder, and appearance panel.

---

## Modified Files

### `src/components/CreatorPanel.tsx`
Added `PortraitField` to Step 0 (Setup), below the character name input. Wires `portraitUrl` into the draft via `onDraftChange`. Suggested ancestry is derived from `draft.raceId` using `suggestPortraitAncestry()`.

### `src/components/QuickbuilderPanel.tsx`
Added `portraitUrl` state and `PortraitField` in the name-entry step for both the premade archetype flow and the three-step quickbuilder flow. The portrait ID is included when `buildQuickDraft()` is called.

### `src/components/AppearancePanel.tsx`
Replaced the old inline `PortraitPicker` gallery and "Choose from gallery" toggle button with the shared `CharacterPortrait` preview + `PortraitField` + modal. Kept the text URL input for external/custom image URLs.

### `src/components/dmTable/CharacterStateVisuals.tsx`
Refactored the existing `CharacterPortrait` into a thin wrapper around the new shared component. Removed the old `classPortraitUrl()` class-art fallback in favor of the shared initials fallback.

### `tests/portraitCatalog.test.ts`
Updated all assertions for the new opaque ID convention. Added tests for `resolvePortraitSrc()` and `isCatalogPortrait()`.

### `src/app/globals.css`
- **Added** ~230 lines: `.cportrait` (shared portrait base), `.portrait-field` (inline trigger), `.portrait-modal-*` (overlay, dialog, head, body, library, tabs, grid, tile, preview, actions), mobile breakpoint
- **Removed** all `.portrait-picker-*` and `.portrait-signal` rules
- **Simplified** `.cs-portrait-preview` and `.dm-character-portrait` to avoid conflicts with the shared `.cportrait` base

---

## Deleted

### `src/components/PortraitPicker.tsx`
Old inline gallery with ancestry and presentation filters. Displayed labels under every portrait. Fully replaced by the modal system.

---

## Verification

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Clean |
| ESLint | 0 errors, 3 pre-existing `<img>` warnings (matches codebase pattern) |
| Tests (`vitest run`) | 250/250 pass across 34 test files |
| Build (`next build`) | Compiled successfully |

---

## Key Design Decisions

- **No visible labels** — Portrait tiles are image-only. Accessible names are neutral ("Portrait option 1").
- **No gender/presentation filters** — Removed entirely from the UI.
- **"Suggested" tab** — Convenience sort by ancestry; never hides other options or implies correctness.
- **Opaque catalog IDs** — `portrait-tiefling-01` is stored in `portraitUrl`; image paths are resolved server-side through the approved catalog.
- **Temporary selection state** — Changes are not committed until Save. Cancel fully restores the previous selection.
- **Backward compatible** — Old `portraitUrl` values (file paths, external URLs) still render correctly through the shared `CharacterPortrait`.
