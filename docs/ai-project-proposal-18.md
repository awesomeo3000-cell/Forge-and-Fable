# Proposal 18 — The Ledger: de-slopping the builder & vault

**Implementer:** Codex (capable tier — this is judgment-heavy visual work, not DeepSeek material).
**Reviewer:** Claude, after each sub-round.
**Read first:** `docs/ROADMAP-1.0.md` §0 (landmine list) — twice. Then this document top to bottom before touching a file.

---

## Why this round exists

The owner's verdict on the current builder/vault, verbatim: *"the website still screams AI vibe coded slop... SO overdone and generic."* The character **sheet** is loved and is NOT to be touched. The problem is everything around it: the glass top bar, the dark vault rail, the card-grid start panel, and the option tiles inside the builder. They read as template output because they are the template idiom: identical rounded tiles, icon-title-description cards, glassmorphism, a progress rail with ✓●○ markers, centered everything.

The fix is **not** new decoration. It is extending the paper-and-ink material the sheet already owns backward into creation, and replacing "grid of cards" with typography-driven ledger rows. The owner approved a specific visual concept (a roster ledger and a two-page "commission" spread); this document translates that concept onto the existing components.

**The one-sentence test for every change you make:** would this detail exist in a hand-set 19th-century registry book? If yes (hairline rules, small caps, marginalia, italic descriptors, numbered chapters, a single seal of color), keep it. If no (glass blur, glow, rounded tiles, icon soup, progress pills), it dies.

---

## §0 Hard rules (in addition to the ROADMAP landmine list)

1. **`globals.css` is append-only.** All new rules go at the END of the file under a banner comment `/* ── R18: The Ledger ── */`. Never edit existing blocks — other surfaces depend on them.
2. **Do not touch `HeroSheet.tsx`, any `cs-*` class, `RollDrawer.tsx`, or the campaign/toast CSS.** The sheet is the crown jewel and was just re-verified. If a change you want requires editing sheet CSS, stop and flag it in the changelog instead.
3. **Do not rename or remove existing classNames.** Add new classes alongside (`className="vault-rail ledger-rail"`) and override in the new CSS block. Old names are load-bearing for CSS you are not reading.
4. **Preserve every accessibility attribute.** `aria-pressed`, `aria-current="step"`, `aria-labelledby`, the focus-trap behavior, and keyboard reachability all survived R14 review; if any regress, the round fails review.
5. **No new dependencies, no new fonts.** The font stacks in `src/lib/skins.ts` (`FONT_STACKS`) are the entire typographic palette. The builder chrome uses `var(--font-newsreader)` (the "tome" stack). Letterspaced small caps are done with CSS (`text-transform: uppercase; letter-spacing: 0.14em; font-size: ~11-12px`), not a new font.
6. **Class accents come from the existing `[data-class]` system** (`globals.css` ~line 1065): setting `data-class="rogue"` on an element gives you `var(--class-a)`. Do not invent a second color mapping.
7. **Lucide icons are banned from the surfaces this round touches** except: the close ✕ on modals, and the top-bar action buttons (which become quiet ink buttons, icons allowed at 16px). The start panel's `ShieldCheck`/`CircleGauge`/`Swords` and the brand `Sparkles` are explicitly deleted.
8. **Ship a changelog per sub-round** (`docs/CHANGES-18a.md` etc.) — *no entry = not done*. R16 shipped working code with a changelog that claimed it wasn't started; that cost a full review cycle to untangle. Verification notes must describe what you actually saw in the running app. Fabricated verification narratives have been caught before (R14) and will be caught again.
9. **Verify against an existing character vault.** Log in as a user with 2+ characters. The redesign must not disturb: selecting characters, the sheet itself, PDF import, campaigns, or the read-only sheet modal.

---

## §1 The material system

Append these tokens inside the R18 banner in `globals.css`. They are the light-paper complement to the dark "Printed Tome" root tokens (`--ground`, `--parchment`, etc. at the top of the file) — same world, daylight side. All R18 surfaces use ONLY these plus `--class-a`.

```css
/* ── R18: The Ledger ── */
:root {
  --ledger-paper:   #e9dfc8;  /* page field */
  --ledger-tint:    #e2d5b8;  /* selected/hover row, left column of spreads */
  --ledger-ink:     #2a2018;  /* primary text */
  --ledger-faded:   #7a6a52;  /* descriptors, marginalia */
  --ledger-ghost:   #a08d6c;  /* empty-state text, timestamps, footnotes */
  --ledger-rule:    #cfc2a2;  /* row hairlines */
  --ledger-edge:    #c9bb98;  /* page borders */
  --ledger-seal:    #8c2f22;  /* THE accent. Selection, links, "sealed" marks */
}
```

Rules of use:

- **`--ledger-seal` is the only free accent.** Class/species color appears exclusively as (a) a 10px seal dot on option rows and (b) the initial-circle in the roster, both via `--class-a`. Two colored elements per row, maximum, ever.
- **Hairlines everywhere borders used to be boxes:** `border-bottom: 1px solid var(--ledger-rule)`. Row lists never have per-row background boxes, rounded corners, or gaps — they are ruled lines on one continuous page.
- **Radius:** paper pages get `var(--r-sm)` (3px). Nothing inside a page gets a radius except circular seals. If you type `border-radius: 8px` or more on this surface, you've re-created the slop.
- **Selection is never a blue/gold border.** Selected = row tinted `--ledger-tint`, a 3px `--ledger-seal` left rule, and a small-caps `CHOSEN ✦` (or context word) in `--ledger-seal` (originally `SEALED ✦`; the owner found "sealed" unclear — fixed in the notes round). Unselected hover = `--ledger-tint` at reduced strength (use `color-mix(in srgb, var(--ledger-tint) 55%, var(--ledger-paper))`).
- **Type scale on ledger surfaces:** eyebrow/marginalia 11px letterspaced caps; descriptors 12-13px italic `--ledger-faded`; row names 15-17px regular (small-caps for option names, normal case for proper names); page titles 20-24px. Font: `var(--font-newsreader), Georgia, serif` throughout. No font-weight above 600.
- **Shadows:** none inside pages. A page itself may sit on the dark ground with the existing `--shadow-soft`.
- **The paper grain:** reuse the existing `--grain` overlay exactly as `.paper-surface::before` does (see globals.css ~5896) — copy the pattern for new page containers, do not reinvent it.

---

## §2 Copy deck

Copy is half of "curated." Use these strings verbatim; where you must write new ones, match the register: concrete, slightly wry, in-world, no exclamation marks, no "awesome/epic/legendary."

**Class descriptors** (italic line beside each class name in Chapter II — also reuse in the roster and anywhere a class needs a one-liner):

| Class | Descriptor |
|---|---|
| Artificer | *invention, tinkering, and impossible machines* |
| Barbarian | *fury as a way of life* |
| Bard | *wit, song, and a dangerous charm* |
| Cleric | *a god's will, made manifest* |
| Druid | *the wild, wearing a human face* |
| Fighter | *steel, discipline, and the front line* |
| Monk | *the body, perfected into a weapon* |
| Paladin | *an oath heavier than the armor* |
| Ranger | *the hunt, the trail, the far horizon* |
| Rogue | *shadows, locks, and a knife you never saw* |
| Sorcerer | *magic in the blood, straining to get out* |
| Warlock | *power borrowed at a price* |
| Wizard | *ink-stained hands and borrowed fire* |

Put this table in a new module `src/lib/ledgerCopy.ts` as `CLASS_DESCRIPTORS: Record<string, string>` keyed by class id, with a fallback `""` lookup helper — do NOT scatter the strings across components.

**Other fixed strings:**
- Roster header eyebrow: `FORGE & FABLE` · title: `Roster of Characters` · count marginalia: `one soul recorded` / `{n} souls recorded` (spell out one–nine: *four souls recorded*; numerals from 10).
- Empty roster line: `✦  Inscribe a new name in the roster…`
- Start panel title: `Commission a character` · eyebrow: `THE LEDGER OPENS`.
- Build-mode descriptors — Standard: *the full commission, chapter by chapter* · Quickbuilder: *guided choices for a faster start* · Premade: *archetypes awaiting a name*.
- Builder chapter names (mapping the existing `steps` array in `CreatorPanel.tsx` — keep array order and length, only relabel): `I. Provenance` (Setup) · `II. Vocation` (Class) · `III. Origin` · `IV. Lineage` (Species) · `V. Attributes` · `VI. The Seal` (Finalize).
- Chapter subtitle lines (italic, under the chapter title): I: *a name, and where the record may draw from* · II: *what craft has shaped this life?* · III: *who were they, before the road?* · IV: *blood, and what it carries* · V: *the measure of body and mind* · VI: *read it back, then press the seal*.
- Primary button labels by chapter: `Record the name` → `Seal the vocation` → `Record the origin` → `Seal the lineage` → `Fix the attributes` → `Press the seal` (final creation). Back button: `Previous chapter`. Never "Next", never "Continue", never an arrow glyph in a label (the ⟶ affordance lives in row hovers, not buttons).
- Footnote idiom for hints: prefix `† ` in `--ledger-ghost`, e.g. `† Subclass is chosen at 3rd level; the ledger will prompt you.` Convert existing helper text on these surfaces to footnotes; do not add new hint text beyond what exists.

---

## §3 Sub-rounds

Do them in order. Each is independently shippable and reviewed before the next begins.

### 18a — The masthead and the roster rail

**Files:** `ForgeAndFableApp.tsx` (JSX tweaks only, in `builder-topbar` and `vault-rail` regions, ~lines 1722–1801), `globals.css` (append).

1. **Masthead.** Delete the `Sparkles` brand-glyph block and the `Character Studio` strong line. New brand block: two stacked lines — `FORGE & FABLE` (11px, letterspacing 0.22em, `--parchment-2`) over `Character Ledger` (18px Newsreader, `--parchment`). Add class `ledger-masthead` beside `builder-brand`. The top bar keeps its dark ground (it frames the paper, like the sheet's surroundings) but loses all `backdrop-filter`/glass treatment for this bar: flat `--ground-2`, `border-bottom: 1px solid var(--rule-soft)`. Action buttons (`glass-icon` in the top bar only): add class `ink-action`; restyle as borderless, `--parchment-2` at rest, `--parchment` on hover, no background, no border, no pill. Keep the 18px lucide icons here (rule §0.7 exception). The `account-chip` becomes plain small-caps text, no chip background.
2. **Roster rail.** The `vault-rail` becomes a paper ledger column. Add class `ledger-rail`. Background `--ledger-paper` + grain, right edge `1px solid var(--ledger-edge)`. The `rail-heading` becomes: `ROSTER` in 11px letterspaced caps `--ledger-faded`, with the Import/New buttons as `ink-action-dark` (same quiet treatment, ink colors). Below the heading, a hairline, then the count marginalia (*four souls recorded*, italic, `--ledger-ghost`).
3. **Roster rows.** Restyle `vault-avatar` (add class `ledger-row`): full-width ruled row, NOT a card. Layout: 26px initial-circle (character's first letter, background `var(--class-a)` via the existing `data-class` attr, text `--ledger-paper`) — name in 15px `--ledger-ink` — under it one 12px italic line `--ledger-faded`: `{Species} · {Class} · {ordinal} level` (write an `ordinalLevel(n)` helper: 1st/2nd/3rd/4th…). Keep the existing `ClassIconPlaceholder` OUT of the row — the initial-circle replaces it (the class SVG icons remain in use inside the builder's Chapter II and the sheet; they are not deleted from the project).
4. **Active row:** `--ledger-tint` background, 3px `--ledger-seal` left rule, no other change. Hover on inactive rows: the color-mix tint. No transform, no shadow, no scale.
5. **New-character affordance:** after the last row, a ghost row: `✦  Inscribe a new name…` (13px italic `--ledger-ghost`), same click handler as the current `Plus` button. Keep the Plus button too (toolbar redundancy is fine).

**Verify (put observations in CHANGES-18a):** two characters of different classes show distinct seal colors pulled from `--class-a`; selecting swaps sheets exactly as before; the sheet itself renders pixel-identical (compare screenshots); keyboard: rows reachable by Tab, active row announced (`aria-pressed` or `aria-current` retained); PDF import button still opens the modal.

### 18b — The threshold (start panel)

**Files:** `CharacterStartPanel.tsx` (rewrite — it's 79 lines, smallest possible blast radius), `globals.css` (append).

Replace the `dj-card-grid`/`dj-mode-card` grid with a single ledger page (`ledger-page` container: `--ledger-paper`, grain, `--ledger-edge` border, 28-34px padding):

1. Header: eyebrow `THE LEDGER OPENS` / title `Commission a character` / a hairline with double rule below (`border-bottom: 2px solid var(--ledger-ink)`), matching the roster mockup's masthead.
2. The three build modes as ruled rows (structure identical to 18c option rows — build the shared CSS once as `.ledger-option`): small-caps mode name, italic descriptor from §2, seal dot omitted (no class here), selected = tint + left rule + small-caps `CHOSEN ✦` right-aligned in `--ledger-seal`. Delete the lucide icons and the `dj-card-tab` element entirely.
3. Footer: single `ledger-button` (new class): rectangular, `1px solid var(--ledger-ink)`, transparent fill, `--ledger-ink` small-caps label `Open the commission`, hover = ink fill/paper text. Replace `gold-button` here (leave `gold-button` CSS untouched for other surfaces). Keep the disabled-until-chosen logic and `aria-pressed`.
4. The `Empty character vault` eyebrow case: keep the conditional but reword to `THE ROSTER IS EMPTY` — same component prop-driven text, no logic change.

**Verify:** all three modes selectable by mouse and keyboard; `Continue`-equivalent stays disabled until a choice; Quickbuilder and Premade still route to `QuickbuilderPanel`; screenshot in changelog.

### 18c — The commission (builder proper)

**Files:** `CreatorPanel.tsx`, `src/lib/ledgerCopy.ts` (new), `globals.css` (append). This is the big one; take it in the three passes below and commit between passes.

**Pass 1 — chrome.** The `creator-panel paper-surface dj-dossier` container gains `ledger-spread`: a 2-column grid (`210px 1fr` desktop, stacked below 720px). Left column = the existing `dj-rail` restyled as the table of contents (`ledger-toc`): background `--ledger-tint`, right hairline `--ledger-edge`; heading `THE COMMISSION` (11px caps); each step button shows its Roman numeral + chapter name from §2 (13px, line-height 2.1). Completed chapters show their *decided value* as right-aligned italic marginalia (e.g. `halfling ✓`) — source it from the same data the `stepComplete` array and `StepSlot`s already read; incomplete chapters show nothing. Active chapter: `--ledger-seal` text + 2px seal left rule. DELETE the ✓●○ marker glyphs. Keep `aria-current="step"` and the click-to-jump behavior exactly. Under the TOC, the italic footnote: *Each chapter inks the record as it is decided.*

**Pass 2 — the document page.** Right column keeps `dj-document` structure. The `dj-document-header` ("Record of the adventurer" + name + StepSlot line) is already in-world — restyle only: title 20px, the StepSlot slash-line becomes 12px italic `--ledger-faded`. Each step section header becomes `Chapter {numeral} · {name}` (20px) with the §2 subtitle line under it. Footer nav buttons become `ledger-button` (primary = ink-filled variant: `--ledger-ink` bg, `--ledger-paper` text) with the §2 chapter-specific labels; back button is the outline variant.

**Pass 3 — option rows.** Wherever the step content renders a grid/stack of selectable tiles (class list, species/lineage list, origin/background list — the `dj-option-stack` and any `choice-tile`/`dj-card` usage inside steps 1–3), convert to `.ledger-option` rows: small-caps option name; italic descriptor — classes from `CLASS_DESCRIPTORS`, species/origins from the first sentence of ruleset data already displayed today (truncate at ~60 chars on the row; full text still available in the existing Learn modals); 10px seal dot in `--class-a` (classes) or a neutral `--ledger-faded` dot (species/origins); selected = tint + left rule + `CHOSEN ✦`. The existing `DossierStamp` for the confirmed choice stays but restyles as a circular wax-seal chip: 44px circle in `--class-a` containing the existing class SVG icon in paper color, beside the small-caps name — this is where `ClassIconPlaceholder`/the class icons continue to live. **Do not change any selection logic, draft state, validation, or the ability-score UI mechanics in Chapter V** — Chapter V and VI keep their current controls, only re-skinned to ledger type/rules (inputs: transparent, `border-bottom: 1px solid var(--ledger-rule)`, focus = seal-colored bottom border; no boxed inputs).

**Verify:** create a full character start-to-finish (rogue, halfling, any origin, point-buy) and confirm the created character matches choices; jump between chapters via TOC; keyboard-only run of chapters I–II; subclass footnote shows; `npm run lint` + `npm run build` clean; screenshots of chapters I, II, V in the changelog.

### 18d — Sweep and kill list

**Files:** `QuickbuilderPanel.tsx`, `SpeciesFamilyModal.tsx`, `ClassLearnModal.tsx`, `SpeciesLearnModal.tsx`, `globals.css` (append).

1. QuickbuilderPanel: apply `ledger-page` container + `.ledger-option` rows + `ledger-button`. No logic changes.
2. The three modals: keep dark scrim; the modal body becomes a `ledger-page` (paper, grain, hairline header with small-caps eyebrow). Close button may keep lucide ✕.
3. **Kill sweep** across ONLY the surfaces this proposal touched: no remaining `backdrop-filter`, no `border-radius` > 3px (except circles), no lucide icons outside the allowed spots, no gradient backgrounds, no `dj-card-tab`. Grep yourself honest and list the hits you removed in the changelog.
4. Regression pass: sheet, campaigns panel, toasts, roll drawer, level-up modal, PDF import — open each and confirm untouched.

---

## §4 Review gate

Claude reviews each sub-round against: the §1 material rules (spot-check computed styles in the browser), the §2 copy verbatim, accessibility retention, zero sheet regressions, and changelog honesty. Anything failing the one-sentence test from the top of this document gets sent back with the line item named.
