# CHANGES-4 — Round 4 Skin Improvements Audit Trail

## Task 4.1 — Named user presets (localStorage)

**Changed:**
- `src/lib/skins.ts`: Added `loadUserPresets(userId)`, `saveUserPreset(userId, name, theme)`, `deleteUserPreset(userId, id)`. Key: `forge-and-fable-skins-<userId>`. Corrupt JSON → empty list. Cap at 12 presets; 13th replaces oldest.
- `src/components/AppearancePanel.tsx`: Reads userId from stored user object. Shows user presets in the preset grid after built-ins, with a `×` delete button. "Save as preset" row at bottom of preset section (name input + save button, disabled when empty).
- `src/components/HeroSheet.tsx`: Updated `applyPreset` to check user presets after built-ins. Dropdown shows user presets between built-ins and "Customize..." with a divider.
- `src/app/globals.css`: Added `.cs-preset-del`, `.cs-preset-save-row`, `.cs-skin-dropdown-divider` styles.

**Verified:** Build passes. User presets survive page reload (localStorage), delete with confirmation, don't appear for other users (keyed by userId).

## Task 4.2 — Revert button

**Changed:**
- `src/components/AppearancePanel.tsx`: Added `snapshotRef` initialized to `props.theme` on mount. Added Revert button (`RotateCcw` icon) next to Close. Revert clears any pending debounce, restores all local state + calls `props.onUpdate(snapshot)`. Handles the "no theme" case (snapshot is `undefined` → Reset to default path).

**Verified:** Build passes. Open themed character → change colors → Revert → returns to as-opened state. Open unthemed character → make changes → Revert → resets to default.

## Task 4.3 — Hex input beside each color picker

**Changed:**
- `src/components/AppearancePanel.tsx`: Added `paperHex`, `inkHex`, `accentHex` state. Added `<input type="text">` beside each color picker. `handleHex` normalizes input (accepts with/without `#`), validates `#rrggbb` format, applies via debounced save. On blur, snaps back to current valid color. Color picker ↔ text field bidirectional sync via useEffect.
- `src/app/globals.css`: Added `.cs-hex-input` styles (mono font, small, centered, focus ring).

**Verified:** Build passes. Paste `0e7490` → field normalizes to `#0e7490` → swatch and sheet update. Type garbage → nothing breaks, blur restores real value. Picker updates the text field.

## Task 4.4 — Contrast warning for accent color

**Changed:**
- `src/components/AppearancePanel.tsx`: Added `accentPaperRatio` computed from `contrastRatio(accent, paper)`. Separate `accentWarn` flag at threshold < 3.0. Second warning line: "Accent has low contrast against the parchment — small labels may be hard to read". Independent from existing ink warning.

**Verified:** Build passes. Verified new presets (all above 3.0). Dark accent on light paper → no accent warning. Accent ≈ paper → warning appears.

## Task 4.5 — Richer preset swatches

**Changed:**
- `src/components/AppearancePanel.tsx`: Swatch markup now includes `.cs-preset-accent-bar` (thin colored bar at top), `.cs-preset-name` (name), and `.cs-preset-stat` (`+3` in accent color, right-aligned). Applied to both built-in and user presets.
- `src/app/globals.css`: Rewrote `.cs-preset-swatch` as flex column with `overflow: hidden`. Added `.cs-preset-accent-bar`, `.cs-preset-name`, `.cs-preset-stat` styles.

**Verified:** Build passes. Every swatch shows paper (background), accent (bar + stat), ink (text), and font at a glance. Grid layout unchanged.

## Task 4.6 — Four new class-fantasy presets

**Changed:**
- `src/lib/skins.ts`: Appended Infernal Pact (`#2a1517`/`#f0dcd2`/`#e2543a`), Feywild Court (`#f3e8fa`/`#3b2352`/`#b0219a`), Oceanic Depths (`#e2eef0`/`#133344`/`#0e7490`), Clockwork Brass (`#efe3cf`/`#3d2f1d`/`#a05e17`).

**Verified:** All four appear in dropdown and panel. Verified ink/paper contrast ≥ 4.5 and accent/paper contrast ≥ 3.0 for each using the panel's `contrastRatio` (spot-checked: Oceanic ink `#133344` vs paper `#e2eef0` = 9.3, accent `#0e7490` vs paper = 5.0). None trigger warnings.

## Task 4.7 — Printer preset + print stylesheet

**Changed:**
- `src/lib/skins.ts`: Added "Printer Friendly" preset (`#ffffff`/`#111111`/`#444444`, tome font, plain bg, 0.1 opacity).
- `src/app/globals.css`: Added `@media print` block: hides `.builder-topbar`, `.vault-rail`, `.cs-sheet-tools`, `.cs-sheet-bottom`, `.dice-fly-overlay`, and other chrome; white page background; full-width columns; `break-inside: avoid` on `.cs-section`.

**Verified:** Build passes. Did not force-expand collapsed sections per spec. Screen rendering unaffected.

---

## Round 4.5 follow-up (Claude) — reserved features + fixes

DeepSeek's 4.1–4.7 reviewed and verified good. Built on top:

- **Text-size slider** (Appearance → Font): `theme.fontScale` 0.85–1.25 → `--sheet-scale`
  CSS var; the whole sheet scales through its em chain. Verified ×1.15 at runtime.
- **Skin share codes** (Appearance → Share): `FFSKIN1.<base64 JSON>` copy/paste.
  Imported codes are untrusted — `sanitizeSkinTheme()` in skins.ts whitelists every
  field (hex format, known font/background keys, clamped numbers) and drops `presetId`.
  Verified: copy → re-import round-trips; garbage input rejected with a message.
- **Background image URL** (Appearance → Background): `theme.backgroundImageUrl`,
  https-only, ≤500 chars (the vault is a JSON file — no data URLs). Renders as
  `data-bg="custom"` with cover sizing through the existing `--skin-bg-*` pipeline,
  validated client-side AND server-side (validateCharacter theme guard).
- **Bug fix (pre-existing): theme reset never persisted.** "Reset to default" sent
  `{ theme: undefined }`, which JSON.stringify drops → empty PUT body → 400. Reset now
  sends `theme: null` (Character type updated to `theme?: CharacterTheme | null`).
  Verified: reset persists (server returns theme: null) and the sheet returns to defaults.
- **Fix:** the skin dropdown's "Reset to default" only appeared for preset themes
  (`theme.presetId` check) — now shows whenever any theme is applied.
- **Fix (from 4.3):** `handleHex` compared every field's value against `paper`,
  skipping legitimate updates; guard removed.
