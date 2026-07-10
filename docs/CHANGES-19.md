# CHANGES-19 — level-up modal reshape: "The Rite" → "The Entry" (reviewer-applied)

The undocumented "Level-Up Rite" redesign had solid bones (semantic token
model, feat detail panel, scroll grids — all kept) but re-imported the banned
chrome in fantasy dress: gradient iron frame, ember-glow blurred backdrop,
conic "arcane watermark," numbered-bubble stepper, ceremony renames (Vigor/
Mastery/Arcana/Chronicle), and a duplicated summary (side rail + step).
Owner verdict: didn't love it. Reshaped to the approved ledger-entry concept.

## What changed

### `src/components/LevelUpModal.css` — rewritten
- Flat dark scrim (no radial glow, no blur), paper page with hairline border
  (no gradient frame, no glow shadows, no watermark). Grain kept.
- Kept and documented the semantic token model: surfaces = `--ground`,
  foreground = `--parchment`, accent = `var(--doc-accent, var(--accent))` —
  the modal wears the character's skin inside `.cs-sheet` and the desk
  palette in the creation flow. Class color via `data-class` → `--class-a`.
- All choice cards/options → ruled ledger rows: transparent, hairline bottom,
  3px accent left rule + tint + `Chosen ✦` (CSS `::after`) when selected.
- Buttons → small-caps ledger buttons (outline / ink-filled).
- `@media print` hide restored (the rewrite had dropped it when the class
  names changed from `cs-levelup-overlay`).
- Narrow screens: the rail folds into a horizontal step row.

### `src/components/LevelUpModal.tsx` — re-skin + one new section
- **Bubble stepper + "Rite Summary" side rail → one margin checklist.**
  Plain-English step labels (Hit points / Subclass / Expertise / Feat or
  ability / Spells / The seal); each completed step shows its decided value
  as italic marginalia (`+9 hp ✓`, `sentinel ✓`, `3 learned ✓`) via a new
  `railNote()`. Navigation and recap are now the same element.
- **Header:** rotated class-seal circle (class icon, class color), eyebrow
  `THE RECORD GROWS`, `Level {n} — {name}, {class}`. New `characterName`
  prop passed from both call sites.
- **NEW — "Gained at this level" strip** (first step only): class features
  from `levelProgression` (new `gainedFeatures` prop from both call sites),
  proficiency-bonus rises, and newly unlocked spell-slot tiers derived from
  `maxSlots(newLevel)` vs `newLevel − 1`.
- **Summary step → micro-certificate:** `THE ENTRY, READ BACK` / `Level {n}`
  large / ruled recap rows. Removed "read it back, then press the seal" and
  the sealed/unsealed status sentences.
- Ceremony copy removed: Vigor→Hit points, Discipline→Subclass,
  Mastery→Expertise, "Choose Your Advancement"→Feat or ability,
  Arcana→Spells; "Inscribe Level N" → **"Press the seal"**; "Back"→"Previous".
- Kept: the feat description panel, ASI steppers, scrollable spell grids,
  focus trap, Escape handling, `aria-current`, and ALL decision logic —
  `steps`/`stepComplete`/`finish()` and the 17c gates are untouched (grep-
  verified: strict targets, expertise target gating, wizard swap exclusion).

### Call sites
- `HeroSheet.tsx` / `ForgeAndFableApp.tsx` (creation seq): pass
  `characterName` and `gainedFeatures`.

## Follow-up: type-system normalization (owner note: "font size and types look inconsistent")
The reshape had put ALL text on `--font-body`/`--font-display`, ignoring the
app's third face: `--font-label` (Archivo sans), which the sheet deliberately
uses for every uppercase/letterspaced label and never skins. Serif (or
blackletter, when skinned) 11px caps next to the sheet's Archivo labels read
as inconsistent — because they were. Fixed:
- All chrome (eyebrow, rail heading, step labels, buttons, tags, summary
  labels, gained-label, hit-die label, "Chosen ✦") → `--font-label`.
- Names/values/descriptors/marginalia → `--font-body`; big numerals and
  titles only → `--font-display`.
- `font-variant: small-caps` removed from option/feat names (breaks under
  script/blackletter skins); names are now 14px/600 body face.
- Size scatter (10/10.5/11/12/12.5/13/13.5/14/18/22/24/26/34) collapsed to a
  documented scale: 10 · 11 · 12 · 12.5 · 14 · 18 · 24 · 26 · 34. The scale
  and face rules are documented at the top of `LevelUpModal.css`.

## Verification
- `npm run build` clean; `npm run lint` 0 errors (3 pre-existing warnings in
  ForgeAndFableApp/RollDrawer, untouched by this round).
- Gained-strip derivation unit-tested against the live source (extracted, not
  re-typed): bard L5 → feature + prof +3 + new 3rd-level tier; warlock L3 →
  Pact Boon + pact slots to level 2; rogue L9 → prof only; fighter L6 and
  artificer L2 → empty. ALL PASS.
- Browser walk-through remains blocked by the wedged preview harness (the
  session browser dies on the post-login view — third session running;
  environmental, the server itself serves 200s throughout). Manual checklist
  for the owner below.

## Owner's 60-second checklist (fixtures on player-two-review@example.com)
1. AuditBard (lvl 3) → Level up: margin checklist left, gained-strip absent
   at 4 for bard until you roll HP? (strip shows on the FIRST step: prof
   unchanged at 4, so bard 3→4 may show nothing — correct), feat step titled
   "Feat or ability", spell step asks 1 cantrip + 1 spell, summary says
   "Press the seal", rail notes fill in as you decide.
2. Pip (Necromancer skin) → Level up: modal is skinned (dark paper, violet
   accent), seal shows the rogue icon in rogue color.
3. AuditWizard (lvl 5→6): two spells, no swap dropdown.
4. Print preview with modal open: modal absent.
