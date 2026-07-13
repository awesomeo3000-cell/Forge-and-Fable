# Portrait Module Implementation Plan

## Summary

Add a curated portrait selection system to Forge & Fable. Players choose from 20 pre-cropped ancestry portraits during character creation (or post-creation via AppearancePanel). Portraits persist as `portraitUrl` paths (e.g., `/portraits/tiefling-female.webp`), reusing the existing `portraitUrl` field — no schema changes needed. The DM Party module already displays portraits and is complete.

## Scope (Confirmed with User)

- ✅ Portrait assets: User has pre-cropped 20 portraits in `E:\downloads\forge-and-fable-cropped-portraits.zip`
- ✅ Data model: Reuse existing `portraitUrl` field with catalog paths
- ✅ Party module: Already redesigned — no changes needed to PartyRail/CharacterInspector/CharacterStateVisuals

---

## Phase 1: Extract Portrait Assets

1. Extract `forge-and-fable-cropped-portraits.zip` to `public/portraits/`
2. Verify all 20 files exist with expected naming convention:
   - `aasimar-female.webp`, `aasimar-male.webp`, `dwarf-female.webp`, `dwarf-male.webp`, `elf-female.webp`, `elf-male.webp`, `genasi-female.webp`, `genasi-male.webp`, `gnome-female.webp`, `gnome-male.webp`, `goliath-female.webp`, `goliath-male.webp`, `half-elf-female.webp`, `half-elf-male.webp`, `halfling-female.webp`, `halfling-male.webp`, `human-female.webp`, `human-male.webp`, `tiefling-female.webp`, `tiefling-male.webp`
3. Verify dimensions are ~512×512 and files are reasonable web size

## Phase 2: Create Portrait Catalog

**New file: `src/data/portraits.ts`**

```ts
export type PortraitPresentation = "masculine" | "feminine";
export type PortraitOption = {
  id: string;        // e.g., "tiefling-female"
  label: string;     // e.g., "Tiefling, Feminine"
  ancestry: string;  // e.g., "tiefling"
  presentation: PortraitPresentation;
  src: string;       // e.g., "/portraits/tiefling-female.webp"
};
```

- Array of all 20 `PortraitOption` entries
- `PORTRAIT_BY_ID` map for O(1) lookups
- `ANCESTRY_LIST` sorted alphabetically (with `half-elf` before `elf`)
- `suggestPortraitAncestry(raceId: string)` — maps race/species ID to portrait ancestry using the ruleset race list. Handle compound names (`half-elf`, `half-orc`) before broader matches (`elf`, `orc`)
- `ancestryLabel(ancestry: string)` — human-readable formatter (capitalize first letter)

## Phase 3: Wire PortraitUrl Into Character Creation Draft

### 3a. Update `DraftCharacter` type (`src/types/game.ts`)
- Add `portraitUrl?: string;` field to `DraftCharacter`

### 3b. Update draft initialization (`src/lib/utils.ts`)
- Add `portraitUrl: ""` to `createInitialDraft()` return value

### 3c. Verify `characterPayload()` flow
- `characterPayload()` already spreads `...characterDraft` from the draft, so `portraitUrl` will flow through automatically once it exists on `DraftCharacter` — no change needed here

### 3d. No validation changes
- `portraitUrl` is already in `ALLOWED_PATCH_FIELDS` and validated as http(s) or site-relative path — this covers `/portraits/tiefling-female.webp` paths

## Phase 4: Build PortraitPicker Component

**New file: `src/components/PortraitPicker.tsx`**

Props:
```ts
type PortraitPickerProps = {
  value?: string;              // current portraitUrl
  recommendedRaceId?: string;  // species/race for suggested ancestry filter
  onChange: (portraitUrl: string) => void;
};
```

Features:
- **Current portrait preview** — shows selected portrait larger at top
- **Ancestry filter** — dropdown/radio group, defaults to suggested ancestry from `recommendedRaceId`, includes "All" option
- **Presentation filter** — "All" / "Masculine" / "Feminine" buttons
- **Portrait grid** — responsive grid of portrait thumbnails (4-5 columns desktop, 2-3 mobile)
- **Selected state** — visible border/ring on selected portrait, `aria-pressed="true"`
- **Keyboard navigation** — each portrait is focusable, Enter/Space selects, arrow keys move between
- **Screen-reader labels** — each portrait button labeled e.g., "Select Tiefling, Feminine portrait"
- **Result count** — "Showing X of 20 portraits"
- **No auto-overwrite** — changing species filter does NOT clear selection

## Phase 5: Integrate PortraitPicker Into Character Creator

**Modified file: `src/components/CreatorPanel.tsx`**

- Add portrait selection UI to the **"Setup" step** (Step 0) — alongside name, since it's identity information
- Show a small portrait preview + "Choose Portrait" button that expands the `PortraitPicker`
- Wire `draft.portraitUrl` to the picker's `value` prop
- Wire `onDraftChange` to the picker's `onChange` (converting portraitUrl updates to draft updates)
- Pass `draft.raceId` as `recommendedRaceId` (which updates as species is selected in Step 3)
- When no portrait is selected, show initials placeholder (matches existing fallback behavior)

## Phase 6: Integrate PortraitPicker Into AppearancePanel

**Modified file: `src/components/AppearancePanel.tsx`**

- Add "Choose from Gallery" button below the existing portrait URL text input
- Opens the `PortraitPicker` inline (same component, same catalog)
- Selecting a gallery portrait populates the URL text field and calls `onPortraitUpdate`
- Players can still paste a custom URL — gallery and URL input are complementary

## Phase 7: Update CharacterPortrait Fallback Chain

**Modified file: `src/components/dmTable/CharacterStateVisuals.tsx`**

- Currently falls back: `portraitUrl` → `classPortraitUrl()` → initials
- The catalog portraits are full URLs so they'll work via the existing `portraitUrl` path — **no change needed** to the fallback chain itself
- But we should ensure the component handles `/portraits/*.webp` paths correctly (it already does since it accepts any URL)

## Phase 8: Tests

**New/modified file: `tests/portraitCatalog.test.ts`**

Test the portrait catalog:
- All 20 portraits exist in catalog
- `PORTRAIT_BY_ID` lookup returns correct option
- `ANCESTRY_LIST` is sorted correctly (half-elf before elf)
- `suggestPortraitAncestry()` maps known race IDs correctly
- `suggestPortraitAncestry()` returns undefined for unknown races

**Modified file: `tests/dmTableParty.test.ts`**

- Test `CharacterPortrait` with a catalog portrait URL
- Test `CharacterPortrait` with no portrait (initials fallback)
- Test with an invalid/broken portrait URL

## Phase 9: Validation & Build

1. Run `npx tsc --noEmit` — zero TypeScript errors
2. Run lint (project's configured linter)
3. Run `npm run build` — production build succeeds
4. Verify no console errors in normal use

---

## Files Summary

### New files (3)
- `public/portraits/*.webp` — 20 portrait assets (from zip extraction)
- `src/data/portraits.ts` — portrait catalog
- `src/components/PortraitPicker.tsx` — visual portrait selection component

### Modified files (3)
- `src/types/game.ts` — add `portraitUrl?` to `DraftCharacter`
- `src/lib/utils.ts` — add `portraitUrl: ""` to `createInitialDraft()`
- `src/components/CreatorPanel.tsx` — add portrait picker to Setup step
- `src/components/AppearancePanel.tsx` — add "Choose from Gallery" option
- `tests/dmTableParty.test.ts` — add portrait-related tests

### Files NOT modified (confirmed no changes needed)
- `src/lib/validateCharacter.ts` — portraitUrl already validated
- `src/components/dmTable/PartyRail.tsx` — already displays portraits
- `src/components/dmTable/CharacterInspector.tsx` — already displays portraits
- `src/components/dmTable/CharacterStateVisuals.tsx` — already renders portraitUrl
- `src/app/globals.css` — portrait CSS already exists
- `src/lib/dmTable/party.ts` — party utilities unchanged
- `src/lib/dmTable/alerts.ts` — alert system unchanged

## Key Design Decisions
1. **Reuse `portraitUrl`** — no new `portraitId` field, stores `/portraits/tiefling-female.webp`
2. **PortraitPicker in Setup step** — visible early, near name/species
3. **AppearancePanel gets gallery option** — post-creation access too
4. **No party module changes** — already complete with portrait support
5. **Backward compatible** — existing characters without portraits still show initials/class-art fallback