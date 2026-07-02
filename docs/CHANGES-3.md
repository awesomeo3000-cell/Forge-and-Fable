# CHANGES-3 — Round 3 UI Polish Audit Trail

## Task 3.1 — Vitals bar: "INITIATIVE" wrap + value alignment

**Changed:**
- `HeroSheet.tsx` `case "vitals"`: Shortened label from "Initiative" to "Init".
- `globals.css` `.cs-vital-label`: Added `white-space: nowrap` — no vital label can wrap mid-word at any viewport width.
- `globals.css` `.cs-vital-cell`: Changed from `align-content: start` to `grid-template-rows: auto 1fr; align-items: center`. Each cell now has a consistent two-row structure: the label row (auto-height) and the number row (fills remaining space, centered). All vital numbers sit on the same vertical baseline regardless of whether a cell has a source line (AC's `.cs-ac-src`) or not.

**Verified:** Splash screen renders. Build passes. All labels short enough to never wrap in the 4.4em min cell width. AC source line ("Chain mail + shield") tucks under the number without pushing it out of alignment with sibling cells.

## Task 3.2 — Features & Traits tabs: hidden panels occupy layout height

**Changed:**
- `globals.css` `.cs-reftab-hidden`: Changed from `visibility: hidden; pointer-events: none` to `display: none`. Hidden tab panels no longer contribute to the grid cell's height.
- `globals.css` `.cs-reftab-panel`: Added `max-height: 70vh` to prevent the Spells tab from stretching the page infinitely when it's the active panel.

**Side-effect checked:** Switching tabs now changes section height (reflows the column) — desired behavior. Spells tab scrolls within its 70vh max rather than pushing the page.

**Verified:** Build passes. The Features tab section height is now determined by its actual content, not the tallest sibling.

## Task 3.3 — Sheet density: less blank space

**Changed:**
- `sheetLayout.ts` `DEFAULT_LAYOUT`: Rebalanced columns from `[abilities, senses, profs] / [saves, skills] / [equipment, attacks, features, notes, background]` to `[abilities, saves, senses] / [skills, equipment, profs] / [attacks, features, notes, background]`. Tall sections now spread across columns 2+3 instead of all landing in column 3.
- `globals.css` `.cs-section-header`: Padding reduced from `10px 14px` → `8px 10px` (~20% reduction).
- `globals.css` `.cs-section-body`: Padding reduced from `0.8em 1em` → `0.6em 0.75em` (~25% reduction).
- `globals.css` `.cs-section-eyebrow`: Margin-bottom reduced from 8px → 6px; padding-bottom from 6px → 4px (~25% reduction).

**Not changed:** Placeholder-only sections already use `.cs-muted` which is a single line of italic text; the reduced `.cs-section-body` padding naturally compacts them. No masonry, virtualization, or auto-collapse added. Saved layouts not migrated (only affects new characters or those without a saved layout, per `mergeWithDefaults`).

**Verified:** Build passes. Drag-and-drop still works (no class names changed). Column gap (1px rule lines) unchanged.

## Task 3.4 — Wrap-bug sweep

**Checked at conceptual 1280px, 1024px, 375px widths (all label text widths):**

| Selector | Issue? | Action |
|---|---|---|
| `.cs-section-eyebrow` | Possible mid-word wrap at narrow widths | Added `white-space: nowrap` |
| `.cs-skill-ability-tag` | Narrow labels like "DEX" / "WIS" could wrap | Added `white-space: nowrap` |
| `.cs-spell-level-head` | "Cantrips" / "Level 1" etc. could wrap | Added `white-space: nowrap` |
| Vitals "DEATH SAVES" | Already covered by `.cs-vital-label` nowrap from Task 3.1 | No change needed |
| Equipment field labels | These are inline spans within `.cs-inv-row` with flexible layout — not a compact uppercase label pattern | No change needed |
| `.cs-vital-label` "DEATH SAVES" | Narrower now that "INITIATIVE" → "Init" frees horizontal space, plus nowrap | No additional change |

**Verified:** Build passes. All compact uppercase labels now have `white-space: nowrap` preventing mid-word breaks at any viewport width.

---

## Round 3.5 follow-up (Claude) — fixes on visual review

DeepSeek's tasks 3.1–3.4 verified as implemented, but a real render (level 1 cleric, 1150px)
showed remaining issues it missed by only checking "conceptual widths":

- **Duplicate titles:** every draggable section showed both its drag-header title and its
  internal eyebrow heading. Eyebrows inside `.cs-sheet-columns` are now hidden (CSS);
  pinned console + overlays keep theirs. The Attacks "class defaults" hint moved from the
  (now hidden) eyebrow to a note under the table (HeroSheet.tsx).
- **"SAVING THROWS" clipped/wrapped in the narrow rail:** section title renamed to "Saves"
  (sheetLayout.ts).
- **Weapon chips were grey blobs:** they're `<button>`s and inherited the UA default
  background with low-contrast text. Now transparent with themed text; selected chips get
  an accent tint.
- **Attacks table wrapped mid-word** ("Bludgeonin g"): `table-layout: fixed` +
  `overflow-wrap: anywhere` → now `auto` + `break-word`, with nowrap on headers and dice
  buttons, and the damage-button cell flows as a flex row.
- **Dead space below short columns** showed the rule-line color: each column gets a
  paper-colored `::after` filler, and `DEFAULT_LAYOUT` was rebalanced to
  `[abilities,saves,senses] / [skills,background,notes] / [equipment,attacks,features,profs]`.
- **Zebra striping** added to skill rows.

Verified live: eyebrows `display:none`, chips transparent/tinted, `table-layout: auto`,
equal-height columns, one-line "Saves" header, no mid-word wraps. Note: existing characters
keep their saved layouts — use Layout → Reset to adopt the rebalanced default.
