# Forge & Fable — Round 4: Custom Skin Improvements (safe scope)

**Audience:** An AI coding assistant executing this work in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Out of scope (handled separately — do NOT attempt):** sheet text-size slider, skin share codes, custom background images.

---

## 1. Context

Forge & Fable is a Next.js 16 / React 19 / TypeScript D&D character builder. Characters can be themed ("skins"): a `CharacterTheme` is `{ presetId?, paper, ink, accent, fontKey, backgroundKey, backgroundOpacity? }` (see `src/types/game.ts`). The pieces:

- `src/lib/skins.ts` — `SKIN_PRESETS` (5 presets), `FONT_STACKS`, `FONT_LABELS`, `BACKGROUND_LABELS`.
- `src/components/AppearancePanel.tsx` — the "Customize..." editor: preset grid, three `<input type="color">` fields (paper/ink/accent), font grid, background grid + opacity slider, a `contrastRatio()` helper that warns when ink-vs-paper < 4.5, and a debounced `save()` that calls `props.onUpdate(theme)` (which PUTs to the server).
- `src/components/HeroSheet.tsx` — the "Skin ▾" dropdown (`skinPresetMenu`, a portal) listing `SKIN_PRESETS`, "Customize...", and "Reset to default". Theme becomes CSS variables in `themeVars`; derived shades use `color-mix`.
- `src/app/globals.css` — classes `cs-skin-panel`, `cs-skin-section`, `cs-preset-grid`, `cs-preset-swatch`, `cs-color-row`, `cs-font-grid`, `cs-bg-swatch`, `cs-opacity-row`, `cs-skin-warn`, `cs-skin-dropdown`, `cs-skin-option`.

## 2. Ground Rules

1. Smallest change per task; no reformatting or renames; keep all existing `cs-*` class names.
2. No new npm dependencies. No server/API changes — Task 4.1 uses localStorage only.
3. Use existing CSS variables for any new styles (`var(--accent)`, `var(--paper)`, etc.); never hardcode colors except in preset data.
4. After each task: `npm run lint` (0 errors) + `npm run build` (pass).
5. **Verify each task in the actually running app** (`npm run dev`, reuse the existing server if port 3000 is taken — Next refuses a second dev server). "It compiles" is not verification. State in the changelog what you clicked and what you saw.
6. **Deliverable:** `docs/CHANGES-4.md` — one entry per task with what changed + how verified. No entry = not done.

## 3. Tasks

### Task 4.1 — Save custom skins as named user presets

**Files:** `src/components/AppearancePanel.tsx`, `src/components/HeroSheet.tsx` (dropdown), `src/lib/skins.ts` (helper), CSS as needed.

Custom skins currently live only on the character being edited; switching to any preset destroys the work. Add user-saved presets, stored in **localStorage only**:

- Key: `forge-and-fable-skins-<userId>`. The logged-in user's id is available from the stored user object (`JSON.parse(localStorage.getItem("forge-and-fable-user")).id`) — write a small helper in `skins.ts`: `loadUserPresets(userId)`, `saveUserPreset(userId, name, theme)`, `deleteUserPreset(userId, id)`. Value: JSON array of `{ id: string; name: string; theme: CharacterTheme }`. Wrap `JSON.parse` in try/catch (corrupt value → empty list). Cap at 12 presets; saving a 13th replaces the oldest.
- **AppearancePanel:** add a "Save as preset" row (text input for the name + save button) at the bottom of the Preset section. Saving with an empty name is disabled. Saved presets appear in the preset grid after the built-ins, rendered with the same `cs-preset-swatch` styling plus a small "×" delete button (confirm via `window.confirm`).
- **HeroSheet dropdown:** list user presets after the built-in presets (before "Customize..."), applying on click exactly like built-ins.
- The panel needs the userId — read it in the component (it's a client component; guard `typeof window`).

**Accept:** craft a custom skin → Save as "My Skin" → switch character → "My Skin" appears in both the dropdown and the panel grid and applies correctly → delete works → survives a page reload → a second registered user does NOT see it.

### Task 4.2 — Revert button on the Appearance panel

**File:** `src/components/AppearancePanel.tsx`.

Edits auto-save on a 300ms debounce, so experimenting is destructive — closing the panel keeps mistakes. Snapshot `props.theme` once when the panel mounts (a `useRef` initialized on first render; `undefined` is a valid snapshot meaning "no theme"). Add a "Revert" button next to Close that restores the snapshot: reset all local state fields from it AND call `props.onUpdate(snapshot)` immediately (cancel any pending debounce first). Keep "Reset to default" as-is — they do different things (Revert = as-opened; Reset = no theme).

**Accept:** open panel on a themed character → change colors/font → Revert → sheet and panel controls return to the exact as-opened state, including the case where the character had no theme when opened.

### Task 4.3 — Hex input beside each color picker

**File:** `src/components/AppearancePanel.tsx`, CSS for the small input.

Beside each of the three color swatches, add a small text input showing the current hex (e.g. `#a23f29`). Typing a valid `#rrggbb` (accept with or without leading `#`; normalize to lowercase with `#`) updates the color state + saves via the existing debounced `save()`. Invalid text: keep the field editable but don't apply until it parses; on blur, snap the field back to the current valid value. The color picker and text field must stay in sync both directions.

**Accept:** paste `#0e7490` into the accent field → swatch and sheet update; type garbage → nothing breaks, blur restores the real value; picking via the swatch updates the text.

### Task 4.4 — Contrast warning for the accent color

**File:** `src/components/AppearancePanel.tsx`.

The existing warning only checks ink-vs-paper. The accent paints the small uppercase labels where low contrast hurts most. Reuse `contrastRatio()`: if accent-vs-paper < 3.0, show a second warning line ("Accent has low contrast against the parchment — small labels may be hard to read"). Keep both warnings independently visible. Do **not** implement any auto-fix.

**Accept:** set accent ≈ paper color → warning appears; set a dark accent on light paper → it disappears; the ink warning still works.

### Task 4.5 — Richer preset swatches

**Files:** `src/components/AppearancePanel.tsx`, `src/components/HeroSheet.tsx` (optional, dropdown can stay text-only), `globals.css`.

Preset buttons currently show name in paper/ink/font. Make each swatch a mini preview: keep the name, add (a) a thin accent-colored bar across the top of the swatch and (b) a small sample stat rendered in the accent color, e.g. `+3`, right-aligned. Pure markup+CSS inside the existing `cs-preset-swatch` button — same size grid, no layout change. Apply to both built-in and user presets (Task 4.1).

**Accept:** every swatch visibly shows paper, ink, accent, and font at a glance; grid layout unchanged.

### Task 4.6 — Four new class-fantasy presets

**File:** `src/lib/skins.ts`.

Append exactly these presets (values chosen for ≥4.5 ink/paper contrast — verify each with the panel's `contrastRatio` in a quick script or by opening the panel; if any fails 4.5, darken the ink / lighten the paper minimally and note it in the changelog):

```ts
{ id: "infernal", name: "Infernal Pact", theme: { presetId: "infernal", paper: "#2a1517", ink: "#f0dcd2", accent: "#e2543a", fontKey: "blackletter", backgroundKey: "dungeon" } },
{ id: "feywild", name: "Feywild Court", theme: { presetId: "feywild", paper: "#f3e8fa", ink: "#3b2352", accent: "#b0219a", fontKey: "script", backgroundKey: "sparkle", backgroundOpacity: 0.35 } },
{ id: "oceanic", name: "Oceanic Depths", theme: { presetId: "oceanic", paper: "#e2eef0", ink: "#133344", accent: "#0e7490", fontKey: "storybook", backgroundKey: "linen" } },
{ id: "clockwork", name: "Clockwork Brass", theme: { presetId: "clockwork", paper: "#efe3cf", ink: "#3d2f1d", accent: "#a05e17", fontKey: "typewriter", backgroundKey: "plain" } },
```

**Accept:** all four appear in the dropdown and panel, apply cleanly, and none triggers the contrast warnings.

### Task 4.7 — Printer preset + print stylesheet

**Files:** `src/lib/skins.ts`, `src/app/globals.css`.

- Add preset: `{ id: "printer", name: "Printer Friendly", theme: { presetId: "printer", paper: "#ffffff", ink: "#111111", accent: "#444444", fontKey: "tome", backgroundKey: "plain", backgroundOpacity: 0.1 } }`.
- Add an `@media print` block at the end of `globals.css`: hide the app chrome (`.builder-topbar`, `.vault-rail`, `.cs-sheet-tools`, the console section via `.cs-sheet-bottom`, and the dice overlay root class — find it in `DiceRollOverlay.tsx`), remove the page background, let the sheet columns flow at full width, and set `break-inside: avoid` on `.cs-section`. Do not try to force-expand collapsed sections.

**Accept:** with the Printer preset applied, browser print preview (Ctrl+P on the dev server) shows a clean white sheet: no sidebar, no top bar, no console, sections not split mid-card. Normal screen rendering unaffected.

## 4. Verification & Deliverables

Smoke test: log in, open a character → Skin ▾ → try each new preset → Customize: hex-paste a color, trigger both contrast warnings, Revert, save a named preset, delete it → Ctrl+P with Printer preset. Then `npm run lint` (0 errors) + `npm run build`.

**Deliverable:** `docs/CHANGES-4.md`, one entry per task: what changed, what you clicked, what you observed. Note anything skipped or adjusted, explicitly.
