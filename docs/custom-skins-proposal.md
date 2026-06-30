# Project Proposal — Per-Character Custom Skins ("Character Themes")

**Project:** Forge & Fable
**Feature:** Let each player give their character its own visual skin — parchment color, text/ink color, accent color, font, and the background behind the sheet — with named presets (e.g. a pink, bubble-font "Elle Woods" look).
**Intended implementer:** an AI coding assistant (e.g. DeepSeek). This document is written to be handed to that assistant. Section 13 contains ready-to-paste prompts.

---

## 1. Goal in one sentence

A character named *Elle Woods, Elf Paralegal* should be able to open an "Appearance" panel, pick (or build) a pink parchment + rounded "bubble" font + sparkly background theme, and have that look saved to her character and re-applied every time her sheet is opened — without affecting any other character.

---

## 2. Why this is a small change (and where the work actually is)

The character sheet is already rendered entirely from **CSS custom properties** (design tokens). Look at `src/app/globals.css`:

```css
/* Document ("paper") palette — used only inside .cs-sheet */
--paper:        #ece1c9;
--paper-raised: #e4d7bb;
--ink:          #241c12;
--ink-2:        #6b5d44;
--ink-3:        #8a7c60;
--doc-rule:     #c9b896;
--doc-accent:   #a23f29;
--doc-select:   #9c7a2f;
```

Every part of the sheet reads these variables. So "theming" a character is mostly: **override these variables on a wrapper element for that one character.** No component markup has to change to recolor the sheet.

The two parts that need real (but small) engineering:

1. **Fonts** — fonts are currently loaded at *build time* via `next/font/google` in `src/app/layout.tsx` (Fraunces, Newsreader, Archivo). You cannot let users type in an arbitrary font name and have it appear. The fix is a **curated font allowlist** that we preload, each mapped to a key the theme can select.
2. **Background images** — characters are persisted to a **single JSON file** (`data/forge-vault.json`) through `src/lib/vaultStore.ts`. JSON can't hold image binaries, so custom *uploaded* backgrounds need a storage decision. For the MVP we ship a **curated set of background images** in `/public` and store only the chosen key. Uploads are a clearly-scoped Phase 4.

---

## 3. Current architecture (facts the implementer needs)

| Concern | Where it lives | Notes |
|---|---|---|
| Sheet UI | `src/components/HeroSheet.tsx` | Root element is `<div className="cs-sheet">`. All styling via `cs-` classes + CSS vars. |
| Global styles & tokens | `src/app/globals.css` | Dark "tome" palette + the `.cs-sheet` "paper" palette + the appended "Parchment skin" block. |
| Fonts | `src/app/layout.tsx` | `next/font/google` → CSS vars `--font-fraunces`, `--font-newsreader`, `--font-archivo` on `<html>`. |
| Data model | `src/types/game.ts` | `Character` type. Note existing `settings: CharacterSettings` sub-object pattern. |
| Persistence | `src/lib/vaultStore.ts` | `updateCharacter(userId, id, patch)` already does a shallow merge — perfect for saving a `theme` patch. JSON file store. |
| App state / save calls | `src/components/ForgeAndFableApp.tsx` | Holds character state, calls the API, passes `onUpdate` into `HeroSheet`. |
| API routes | `src/app/api/...` | Where the update endpoint lives. |

**Key insight:** `updateCharacter` already accepts a `Partial<Character>` patch and merges it. Saving a theme is just `onUpdate({ theme })`. No persistence layer rewrite required.

---

## 4. Scope — what a player can customize (MVP)

A character `theme` controls:

1. **Parchment color** (`paper`) — and an auto-derived "raised" shade.
2. **Ink / text color** (`ink`).
3. **Accent color** (`accent`) — used for highlights, the rolled-die face, headings rules.
4. **Font** (`fontKey`) — chosen from a curated allowlist (serif, sans, script, "bubble", blackletter, typewriter…).
5. **Background** (`backgroundKey`) — the texture/image behind the sheet, chosen from a curated set, plus a couple of plain options.
6. **Preset** — selecting a named preset fills in all of the above at once; the player can then tweak individual values.

**Out of MVP (later phases):** uploading your own image/font, per-section theming, sharing themes between players, animated backgrounds.

---

## 5. Data model changes

Add to `src/types/game.ts`:

```ts
export type ThemeFontKey =
  | "tome"        // current serif (Newsreader/Fraunces) — default
  | "storybook"   // friendly serif
  | "bubble"      // rounded display (e.g. Baloo 2 / Fredoka)
  | "script"      // handwriting (e.g. Dancing Script)
  | "blackletter" // gothic (e.g. UnifrakturCook) — use sparingly
  | "typewriter"; // monospace slab

export type ThemeBackgroundKey =
  | "parchment"   // default subtle paper grain
  | "plain"       // flat color, no image
  | "linen"
  | "stars"
  | "sparkle"     // pink/glам — pairs with the Elle Woods preset
  | "forest"
  | "dungeon";

export type CharacterTheme = {
  presetId?: string;        // which preset it started from (for the UI)
  paper: string;            // hex, e.g. "#f7d6e6"
  ink: string;              // hex
  accent: string;           // hex
  fontKey: ThemeFontKey;
  backgroundKey: ThemeBackgroundKey;
  backgroundOpacity?: number; // 0–1, default ~0.5
};

// Add to the Character type:
//   theme?: CharacterTheme;   // optional — undefined means "use the default tome theme"
```

Make `theme` **optional** so every existing saved character keeps working (undefined → the current default look). No migration script needed.

---

## 6. How a theme is applied (the CSS-variable contract)

Render the sheet inside a wrapper that maps the theme to the existing token names. In `HeroSheet.tsx` (or a thin wrapper component), build an inline style object:

```tsx
const themeVars = character.theme ? {
  ["--paper" as string]: character.theme.paper,
  ["--paper-raised" as string]: shade(character.theme.paper, -0.06), // darken ~6%
  ["--ink" as string]: character.theme.ink,
  ["--ink-2" as string]: mix(character.theme.ink, character.theme.paper, 0.35),
  ["--ink-3" as string]: mix(character.theme.ink, character.theme.paper, 0.55),
  ["--doc-accent" as string]: character.theme.accent,
  ["--doc-accent-deep" as string]: shade(character.theme.accent, -0.18),
  ["--doc-select" as string]: character.theme.accent,
  ["--doc-rule" as string]: mix(character.theme.ink, character.theme.paper, 0.6),
  ["--sheet-font" as string]: FONT_STACKS[character.theme.fontKey],
} : {};

return <div className="cs-sheet" style={themeVars} data-bg={character.theme?.backgroundKey}> … </div>;
```

Two supporting refactors:

- **Route the sheet's font through a variable.** Some `cs-` rules hardcode `Georgia, serif`. Add `--sheet-font` (default `var(--font-body)`) and replace those hardcoded font-families inside `.cs-sheet` with `var(--sheet-font)`. Now one variable swaps the whole sheet's typeface.
- **Background via `data-bg`.** Add CSS like:
  ```css
  .cs-sheet[data-bg="sparkle"]::before { background-image: url("/skins/sparkle.png"); opacity: var(--bg-opacity, .5); }
  .cs-sheet[data-bg="plain"]::before { background: none; }
  ```
  Ship the images in `public/skins/`.

`shade()` and `mix()` are tiny color helpers (add to `src/lib/utils.ts`), or use CSS `color-mix(in srgb, …)` directly to avoid JS math — the codebase already uses `color-mix` elsewhere, so prefer that where possible.

**MVP scope = theme the `.cs-sheet` only.** (Optional stretch: also remap the surrounding panels by setting the same variables on a higher wrapper — the existing "Parchment skin" block shows exactly which tokens the rest of the app reads.)

---

## 7. Fonts strategy (the one real gotcha)

`next/font` is build-time, so define a **fixed roster** in `layout.tsx` and expose each as a CSS variable:

```ts
import { Fraunces, Newsreader, Archivo, Baloo_2, Dancing_Script, UnifrakturCook, Space_Mono } from "next/font/google";
// …configure each with a `variable: "--font-xxx"` and add all variables to <html className>.
```

Then a lookup table maps `fontKey` → a font stack:

```ts
export const FONT_STACKS: Record<ThemeFontKey, string> = {
  tome:        "var(--font-newsreader), Georgia, serif",
  storybook:   "var(--font-fraunces), Georgia, serif",
  bubble:      "var(--font-baloo), system-ui, sans-serif",
  script:      "var(--font-dancing), cursive",
  blackletter: "var(--font-unifraktur), serif",
  typewriter:  "var(--font-space-mono), ui-monospace, monospace",
};
```

This keeps performance good (fonts are optimized/self-hosted by Next), avoids arbitrary-font security/perf issues, and still gives players a fun spread including a true "bubble" font for the Elle Woods case.

---

## 8. Background images

- **MVP:** ship 5–7 PNG/WEBP textures in `public/skins/` (`parchment`, `linen`, `stars`, `sparkle`, `forest`, `dungeon`). Store only `backgroundKey`. Render via the `data-bg` CSS above, with an adjustable `--bg-opacity` so text stays readable.
- **Phase 4 (custom upload):** the JSON vault can't hold binaries. Options, cheapest first:
  1. **Small data-URL** stored on the character (cap at ~150 KB, downscale client-side) — no infra, but bloats the JSON.
  2. **Local uploads dir** — write to `public/uploads/<characterId>.webp`, store the path. Works for a self-hosted single-server setup like the current file vault.
  3. **Object storage** (S3/R2/Supabase Storage) — the "real" answer if this ever goes multi-server.
  Recommend option 2 to match the existing local-file architecture.

---

## 9. Presets (ship these in `src/lib/skins.ts`)

Each preset is just a `CharacterTheme`. Include at least:

```ts
export const SKIN_PRESETS: { id: string; name: string; theme: CharacterTheme }[] = [
  { id: "tome",     name: "Classic Tome",   theme: { presetId:"tome",     paper:"#ece1c9", ink:"#241c12", accent:"#a23f29", fontKey:"tome",       backgroundKey:"parchment" } },
  { id: "ellewoods",name: "Legally Blonde", theme: { presetId:"ellewoods",paper:"#fbdcec", ink:"#5a1f3d", accent:"#e0319d", fontKey:"bubble",     backgroundKey:"sparkle", backgroundOpacity:0.4 } },
  { id: "necro",    name: "Necromancer",    theme: { presetId:"necro",    paper:"#1c2230", ink:"#d7e0ea", accent:"#7c5cff", fontKey:"blackletter",backgroundKey:"dungeon" } },
  { id: "ranger",   name: "Ranger's Field", theme: { presetId:"ranger",   paper:"#e9e6cf", ink:"#23301d", accent:"#4f7d33", fontKey:"storybook",  backgroundKey:"forest" } },
  { id: "scroll",   name: "Royal Scroll",   theme: { presetId:"scroll",   paper:"#f3e9cf", ink:"#2a2140", accent:"#9c7a2f", fontKey:"script",     backgroundKey:"linen" } },
];
```

The "Legally Blonde" preset is the requested pink-parchment + bubble-font look.

---

## 10. UI — the Appearance panel

- **Entry point:** add an "Appearance" / "Skin" control on the sheet header (near the rest/inspire buttons in `HeroSheet.tsx`) that opens a panel or modal. Reuse existing panel styling.
- **Controls:**
  - **Preset gallery** — clickable swatches; selecting one applies its whole theme.
  - **Color pickers** — Parchment, Ink, Accent (`<input type="color">` + hex field).
  - **Font dropdown** — each option rendered *in its own font* as a live preview.
  - **Background gallery** — thumbnails + an opacity slider.
  - **Live preview** — because everything is CSS variables, just set them on the actual sheet as the user edits; no separate preview renderer needed.
  - **Reset to default** button.
- **Save:** call `props.onUpdate({ theme })` (debounced) — this already flows to `updateCharacter` and persists. Same pattern as every other sheet edit.
- **Accessibility guardrail:** compute contrast ratio between `ink` and `paper`; if it fails WCAG AA (< 4.5:1), show a non-blocking warning ("This text may be hard to read"). Keep a minimum font size.

---

## 11. File-by-file change list

| File | Change |
|---|---|
| `src/types/game.ts` | Add `ThemeFontKey`, `ThemeBackgroundKey`, `CharacterTheme`; add optional `theme?` to `Character`. |
| `src/app/layout.tsx` | Import + configure the curated `next/font` roster; add their CSS variables to `<html>`. |
| `src/lib/skins.ts` *(new)* | `FONT_STACKS`, `BACKGROUNDS` metadata, `SKIN_PRESETS`, color helpers (or use `color-mix`). |
| `src/app/globals.css` | Add `--sheet-font` default; replace hardcoded `Georgia` inside `.cs-sheet` with `var(--sheet-font)`; add `.cs-sheet[data-bg="…"]::before` background rules + `--bg-opacity`. |
| `src/components/HeroSheet.tsx` | Build `themeVars` style + `data-bg`; render the Appearance button. |
| `src/components/AppearancePanel.tsx` *(new)* | The editor UI; calls `onUpdate({ theme })`. |
| `public/skins/*` *(new)* | Curated background images. |
| `src/components/ForgeAndFableApp.tsx` | Ensure `theme` is included in the character create/update payloads (usually automatic via spread). |

No change needed to `vaultStore.ts` — the generic patch merge already handles `theme`.

---

## 12. Phased plan & acceptance criteria

**Phase 1 — Data + apply (no UI).** Add the types; hardcode `theme` on a test character; confirm the sheet recolors and the font swaps via CSS variables. *Done when:* setting `character.theme` in code visibly reskins only that sheet.

**Phase 2 — Presets + a preset picker.** Add `skins.ts`, the font roster, and a simple preset dropdown that saves via `onUpdate`. *Done when:* picking "Legally Blonde" gives pink parchment + bubble font and survives reload.

**Phase 3 — Full editor.** Color pickers, font preview list, background gallery + opacity, contrast warning, reset. *Done when:* a player can build a custom theme from scratch and it persists per-character.

**Phase 4 — Custom uploads (optional).** Background image upload via the local uploads dir; size/format validation. *Done when:* an uploaded image renders behind the sheet and is stored by path.

**Global acceptance checks:**
- Two characters open side by side keep *independent* themes.
- A character with no `theme` looks exactly like today (no regression).
- `npx tsc --noEmit` and `npx eslint` pass.
- Reduced-motion and WCAG-contrast guardrails respected.

---

## 13. Ready-to-paste prompts for the AI implementer

> **Prompt 1 (Phase 1):** "In this Next.js repo, add a `CharacterTheme` type to `src/types/game.ts` (fields: paper, ink, accent hex strings; fontKey; backgroundKey; optional backgroundOpacity) and an optional `theme?: CharacterTheme` on `Character`. Then in `src/components/HeroSheet.tsx`, when `character.theme` is set, apply it to the root `.cs-sheet` element as inline CSS variables (`--paper`, `--paper-raised`, `--ink`, `--ink-2`, `--ink-3`, `--doc-accent`, `--doc-accent-deep`, `--doc-select`, `--doc-rule`, `--sheet-font`) and a `data-bg` attribute. Add a `--sheet-font` default in globals.css and replace hardcoded `Georgia` font-families inside `.cs-sheet` with `var(--sheet-font)`. Don't change any persistence code. Keep `tsc` and `eslint` green."

> **Prompt 2 (Phase 2):** "Add `src/lib/skins.ts` exporting `FONT_STACKS`, `SKIN_PRESETS` (include a pink 'Legally Blonde' bubble-font preset and a default 'Classic Tome'), and `BACKGROUNDS`. Configure the curated font roster in `src/app/layout.tsx` via `next/font/google` (add Baloo 2, Dancing Script, UnifrakturCook, Space Mono) and expose each as a CSS variable on `<html>`. Add a preset dropdown to the sheet that calls `onUpdate({ theme })`."

> **Prompt 3 (Phase 3):** "Create `src/components/AppearancePanel.tsx`: a panel with parchment/ink/accent color inputs, a font dropdown that previews each option in its own font, a background-image gallery with an opacity slider, a WCAG contrast warning between ink and paper, and a reset button. Edits update the live sheet immediately (set the CSS variables) and persist via a debounced `onUpdate({ theme })`. Match existing panel styling."

> **Prompt 4 (Phase 4, optional):** "Add background-image upload: client-side downscale to ≤1600px WebP, POST to a new API route that writes `public/uploads/<characterId>.webp`, store the path in `theme`, and render it via the `.cs-sheet[data-bg]` background. Validate type/size."

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Unreadable color combos (e.g. pale ink on pale paper). | Live contrast check + warning; ship presets that are known-good. |
| Font roster bloats initial load. | `next/font` self-hosts + subsets; keep roster to ~6 fonts; `display: swap`. |
| Custom uploads on a multi-server deploy. | MVP avoids uploads; Phase 4 documents the object-storage path for scale. |
| Theme leaking to other characters / global UI. | Scope variables to the `.cs-sheet` wrapper only; never set them on `:root`. |
| Existing saved characters. | `theme` is optional; undefined = current look. No migration. |

---

## 15. Estimated effort

Phase 1: ~2–3 hrs · Phase 2: ~2–3 hrs · Phase 3: ~4–6 hrs · Phase 4 (optional): ~3–4 hrs. A capable coding model can do Phases 1–3 in a few guided iterations using the prompts above.
