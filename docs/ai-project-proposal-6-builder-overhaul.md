# Forge & Fable — Round 6: Character Builder "Dossier" Overhaul

**Audience:** Codex 5.5 (or comparable coding agent) in a fresh session.
**Repo root:** `E:\forge-and-fable`
**Nature of work:** presentation/layout refactor of the character creation flow. No server changes, no data-model changes, no behavior changes to validation or character creation.

---

## 1. Project context

Forge & Fable is a Next.js 16 / React 19 / TypeScript D&D character builder. Two visual worlds exist:

- **Dark chrome** — top bar, vault rail (left sidebar), auth screen, roll drawer. Stays dark. Do not touch.
- **Paper documents** — the character sheet (`.cs-sheet`, classes prefixed `cs-`) and, recently, the builder panels. Parchment `#ece1c9`, ink `#241c12`, hairline rules, small-caps labels.

The paper look is implemented by **token remapping**: `.cs-sheet` and `.paper-surface` (end of `src/app/globals.css`) remap the dark-chrome CSS variables (`--parchment`, `--rule`, `--accent`, `--ground`…) onto the paper palette (`--paper`, `--ink`, `--doc-rule`, `--doc-accent`…). The builder panels (`.creator-panel`, `.start-panel`, `.quickbuilder-panel`, `.class-modal`) carry `paper-surface` plus a long block of appended overrides neutralizing hardcoded dark styles.

**The problem:** the builder is a re-skin of a layout designed for a dark cinematic HUD — oversized rounded tiles (20–24px radii), a giant display heading, a mostly-empty preview column, numbered step tabs. On paper it reads as generic onboarding UI. The owner has approved a redesign ("dossier + index cards", spec below).

### Assets to reuse, not rebuild

- **Class color palette:** `[data-class="<id>"] { --class-a: <hex>; }` rules (globals.css ~line 1091+) for all 12 classes; species use the same var via `[data-species=...]`. Rule of thumb already established: **dark contexts use the raw hue; paper contexts use `color-mix(in srgb, var(--class-a) 75%, var(--ink))`; nothing glows on paper.**
- **Class icons:** `src/components/icons/ClassIcon.tsx` renders `/public/class-icons/<id>.svg` via CSS mask (`.class-symbol-mask`, paints with `currentColor`). Set `color` on a container with `data-class` and the icon takes the hue.
- **Existing heraldry CSS:** `.paper-surface .class-choice[data-class]` left accent bar + tinted `.choice-avatar` chip. The redesign moves this color to a **top tab** on cards (see spec) — you may retire the left-bar rule for the builder once replaced.
- **`paper-surface`** container treatment (paper bg, grain ::before, hairline border, sheet shadow). Keep using it as the panel base.

## 2. Design spec — "dossier + index cards"

Two approved mockups translate to this. All colors below already exist as tokens — use the vars, not hex (hex shown only to anchor intent).

### 2.1 Overall structure of the wizard (`CreatorPanel.tsx`)

Replace the current header + step-tabs + two-column stage with:

```
┌────────────────────────────────────────────────────────┐
│ paper-surface panel                                     │
│ ┌──────────┬─────────────────────────────────────────┐ │
│ │ margin   │  THE DOCUMENT                            │ │
│ │ rail     │  eyebrow: "Record of the adventurer"     │ │
│ │ (nav +   │  name in display serif (only serif use)  │ │
│ │ progress)│  subtitle line with filled + "unwritten" │ │
│ │          │  dotted slots                             │ │
│ │ ✓ Name   │  ── hairline ──                          │ │
│ │ ✓ Sources│  ACTIVE SECTION (eyebrow + content):     │ │
│ │ ◈ Class  │   - chosen item = "stamped row"          │ │
│ │ ○ Origin │   - options = index-card grid OR ruled   │ │
│ │ ○ Species│     rows (see 2.3)                        │ │
│ │ ○ Attrib.│                                           │ │
│ │ ○ Seal   │  footer: Continue / Back (gold-button)   │ │
│ └──────────┴─────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

- **Margin rail** (~150px, slightly darker paper `var(--paper-raised)`, hairline right border): replaces the numbered step tabs. One row per step: `✓` for complete (muted green-ish ink is fine: `color-mix(in srgb, #4f7d33 70%, var(--ink))`), `◈` + `--doc-accent` color + 2px left accent bar for the active step, `○` muted (`--ink-3`) for pending. Rows are buttons — clicking jumps to that step (same free navigation the numbered tabs allow today; reuse `props.onStepChange`). Completion per step derives from the same conditions as the existing `canContinue` chain (name+sources / classId / background / raceId; Attributes counts complete once any method is set, Finalize when all prior are complete).
- **Document header** (visible on every step): eyebrow label in small caps (`--font-label`, ~11px, letter-spacing 0.1em, `--doc-accent`, uppercase), the character name in the display serif (`--font-display`, ~30px, ink) or a dotted placeholder "unwritten" when empty, and a subtitle line `<species> · <class> · <origin> · <alignment>` where unchosen parts render as dotted-underline muted slots (`border-bottom: 1.5px dotted; color: var(--ink-3)`, lowercase word "species"/"origin") and chosen parts render in `--ink-2`. This header replaces the old hero-preview — **delete the hero-preview column entirely** (class-icon stage, species-signal, hero-summary, preview-stat-strip). The stat readout moves into the Attributes section only.
- **One column.** The document content area is a single column; no more preview/controls split. `creator-stage`'s two-column grid goes away.
- **Radii:** 0–6px max everywhere in the builder. Kill all 14–24px radii (cards, inputs, buttons within paper) via `.paper-surface` overrides or new classes.
- **Typography discipline:** display serif ONLY for the character name. Section headings are small-caps eyebrows exactly like the sheet's (`--font-label`, ~11px, uppercase, letter-spacing, `--doc-accent`). Body in `--font-body`. The current `clamp(2rem, 4vw, 4.8rem)` h2 is exactly what to remove.

### 2.2 The "stamped row" (chosen item)

When a step has a selection (class, species, background), the section shows it as a stamped row above the option grid:

- Row: `background: var(--paper-raised)`, `border: 1px solid <hue>`, `border-left: 4px solid <hue>`, padding ~9px 12px, **no radius**, where `<hue>` = `color-mix(in srgb, var(--class-a) 60%, var(--paper))` on class/species steps and `var(--doc-accent)` tones on the origin step.
- Contents: 30px icon chip (class/species icon in ink-mixed hue on a lighter tinted square), name 14.5px / 500 / ink, one-line summary in `--ink-3` (class: compose from `hitDie`, `casterType`, `spellcastingAbility`, `subclassLevel` — e.g. "d8 hit die · WIS caster · subclass at level 3"; species: `creatureType / size / speed`), and a small "chosen" pill (11px, hairline border in the hue, transparent bg, pill radius allowed here).

### 2.3 Index-card option grid (class + species steps)

Replaces the current oversized tiles:

- Grid: `repeat(auto-fill, minmax(190px, 1fr))`, gap 10px.
- Card: `background: var(--paper-raised)`, `border: 1px solid var(--doc-rule)`, **border-top: none**, no radius. First child is the **color tab**: a `height: 5px` div filled `color-mix(in srgb, var(--class-a) 60%, var(--paper))`.
- Card body: [icon 17px in ink-mixed hue] + [name 13.5px / 500 / ink] on one row, then a stat line 11.5px `--ink-3` (2–3 short hooks, e.g. "d12 · rage · front line"; compose from hitDie + casterType/primary; keep under ~30 chars).
- Selected card: `border: 2px solid var(--doc-accent)` (tab keeps the class color), `transform: translateY(-4px)`, plus the "chosen" pill. **Selection is always the app accent, never the class hue** — color encodes identity, accent encodes state; don't mix them.
- The whole card is the select control (keep the invisible `.class-card-select` overlay-button pattern or make the card a `<button>` — preserve `aria-pressed`/labels). "Preview class" becomes a small text link inside the card opening the existing learn modal (`setInspectedClassId`). Species cards keep the current modal-first flow if simpler (tile click opens modal, "Choose species" confirms) — either pattern is fine as long as the modal confirm path still selects.
- Origin/backgrounds step: same card pattern with `--doc-accent` tabs (no per-background palette exists), or a compact ruled-row list if the cards feel empty — implementer's call, keep it dense.

### 2.4 Other steps in dossier language

- **Setup:** name + source checkboxes keep their logic. The name input should feel like writing on the document: large text, no box — hairline bottom border only. Source/settings rows: tighten radii to ≤6px and padding ~25%.
- **Attributes:** keep the three-method flow (point buy / array / roll) and `mini-stepper` controls; restyle containers to hairline paper, no big radii. Add a compact live stat strip (six small cells, label + final score) at the top of the section — this replaces the deleted preview column's stat strip; reuse `props.finalAbilities`.
- **Finalize ("Seal the record"):** keep the centered layout and `onCreate`/`forgeError` flow; align typography to the document header style; chips become hairline pills; "Forge Hero" stays a gold-button.

### 2.5 Start panel + Quickbuilder

Same language: `CharacterStartPanel` mode cards become index cards (accent-colored tabs, compact, one-line summaries); `QuickbuilderPanel` uses the card grid for its style/class/species choices and the dossier header treatment for the name step. No logic/prop changes.

## 3. Hard constraints

1. **Zero behavior change.** All props, callbacks, validation (`canContinue` conditions), step indices (0–5), draft mutations, learn-modal flows, and the `createHero`/`characterPayload` path stay as-is. This is markup + CSS.
2. **Do not touch:** anything under `src/app/api/`, `src/lib/`, the sheet (`HeroSheet.tsx` and `cs-*` styles), dark chrome (top bar, vault rail, auth), `RollDrawer`, the skins/Appearance system.
3. **No new npm dependencies.**
4. Keep `paper-surface` on the panels. Put new builder CSS at the END of `globals.css` under new class names (suggested prefix `dj-`) rather than mutating old dark-chrome classes — several are shared with surfaces you aren't restyling. When a section fully migrates to `dj-` classes, delete its now-dead `.paper-surface` overrides from the end of the file and note which in the changelog.
5. Existing `[data-class]` palette rules and `ClassIconPlaceholder` are consumed, not modified.
6. Mobile: below ~700px the margin rail becomes a horizontal step strip above the document (wrap or overflow-x auto). Verify at ~380px.
7. Keep keyboard/AT affordances at least as good as today: rail rows are real buttons with labels; cards are buttons with `aria-pressed`.

## 4. Known landmines (learned the hard way in this repo)

- `globals.css` is ~5,600 lines of append-ordered layers; cascade order matters. New rules go at the end.
- Many legacy builder classes have **hardcoded dark-theme colors** (`#fff4da` creams, `rgba(5,6,7,…)` gradients, white-glass borders). If a reused class renders grey/washed on paper, that's why — prefer a fresh `dj-` class.
- Never define a CSS variable in terms of itself (`--x: var(--x), fallback` is a cycle that silently invalidates it document-wide; this exact bug shipped here once).
- `JSON.stringify` drops `undefined` — to clear a persisted field via PUT, send `null`. (Shouldn't come up this round; listed because it bit earlier rounds.)
- Positional selectors like `.cs-sheet-col:nth-child(n)` exist in sheet CSS — don't insert sibling elements into structures you don't own.
- A dev server may already be running on port 3000 and Next refuses a second instance for the same project — reuse it.

## 5. Verification (required, in the running app — "it compiles" is not verification)

1. `npm run lint` → 0 errors; `npm run build` → passes.
2. Walk the full Standard flow as a real user: start panel → Setup (name + sources) → Class (select via card AND via learn-modal) → Origin → Species (modal confirm path) → Attributes (exercise all three stat methods) → Finalize → Forge Hero succeeds and the finished sheet opens.
3. Margin rail: ✓/◈/○ states correct at every step; clicking rail rows jumps steps; header's "unwritten" slots fill in as choices land.
4. Quickbuilder and Premade flows still complete end-to-end.
5. Check ~1280px and ~380px widths. Hunt for grey-glass or cream-on-paper remnants on every step — that failure mode has recurred in this repo.
6. Screenshot each step at desktop width; reference the files in the changelog.

**Deliverable:** the code plus `docs/CHANGES-6.md` — per-area notes (rail, header, cards, each step, start panel, quickbuilder), which legacy classes/overrides were retired, what you clicked, and what you observed. Any skip or deviation from this spec must be called out explicitly with a reason. A section without a changelog entry counts as not done.
