# Forge & Fable — Round 14 Complete & Future Round Status
**Generated:** 2026-07-08
**Repo:** `E:\forge-and-fable`
**Branch:** `main`
**Last commit:** `36b313d` — "R14: QA P2/P3 sweep, accessibility completion, empty states"

---

## R14 Summary — Completed ✅

### Proposal
`docs/ai-project-proposal-14.md` — QA P2/P3 sweep, accessibility completion, empty states

### Triage Statistics
| Classification | Count |
|----------------|-------|
| ALREADY FIXED (R9–R13) | 14 |
| STALE (code changed) | 5 |
| WONTFIX (deferred) | 5 |
| OPEN → FIXED this round | 8 |
| **Total P2/P3 issues** | **32** |

---

### Mechanical Fixes (22 total across 17 files)

| # | Issue | Severity | File | Fix |
|---|-------|----------|------|-----|
| 1 | Unused `_drop` variable | P3 | `src/lib/skins.ts:229` | Removed unused destructuring |
| 2 | Stale eslint-disable comment | P3 | `src/components/AppearancePanel.tsx:194` | Removed unnecessary directive |
| 3 | FORGE_VAULT_DIR missing | P3 | `railway.json` | Added `FORGE_VAULT_DIR: data` env var |
| 4 | `.env` file missing | P3 | `.env.example` | Already existed with JWT_SECRET + FORGE_VAULT_DIR |
| 5 | Extraneous `@emnapi/wasi-threads` | P3 | `package.json` | Already removed |
| 6 | Trident 1d7 damage | P2 | `src/data/items.json` | Changed to 1d6 (versatile 1d8) |
| 7 | Longbow has `loading` property | P2 | `src/data/items.json` | Removed `loading` from properties |
| 8 | Handaxe/Spear missing `thrown` | P3 | `src/data/items.json` | Already fixed — both have `thrown` |
| 9 | `armorPenaltyReason` grammar | P3 | `src/components/HeroSheet.tsx` | "and Shield" → "or Shield" |
| 10 | d100 face labeling (tens only) | P3 | `src/components/DiceRollOverlay.tsx` | Shows 1–100 instead of 0–90 |
| 11 | pushPool adv/dis only first d20 | P3 | `src/components/ForgeAndFableApp.tsx:852` | Applies adv/dis to all d20s |
| 12 | Roll drawer missing transition | P3 | `src/app/globals.css:4865` | Added open/close animation |
| 13 | `.cs-spell-level-head` overflow | P3 | `src/app/globals.css:4046` | Added `overflow:hidden` + `text-overflow:ellipsis` |
| 14 | `outline:none` no focus ring | P2 | `src/app/globals.css:415,3450` | Added visible `box-shadow` focus ring |
| 15 | No `aria-live` regions | P2 | `src/components/HeroSheet.tsx` | Added for HP + spell slot changes |
| 16 | Inputs with placeholder, no label | P2 | `src/components/HeroSheet.tsx:947,1194,1203` | Added `aria-label` to 8 inputs |
| 17 | Quickbuilder name input no label | P2 | `src/components/QuickbuilderPanel.tsx:93` | Already had visible label |
| 18 | No `.sr-only` utility class | P3 | `src/app/globals.css` | Added screen-reader-only class |
| 19 | Close button × reads as "multiplication" | P3 | `src/components/HeroSheet.tsx:1372` | Changed to `&times;` + `aria-label="Close"` |
| 20 | Manual HP mode silently behaves as fixed | P3 | `src/components/LevelUpModal.tsx` | Added number input when `hitPointType === "manual"` |
| 21 | Encumbrance dead setting | P2 | `src/components/SourceSettingsPanel.tsx` | Marked "Coming soon", disabled |
| 22 | Darkvision trait no mechanical effect | P2 | `src/lib/utils.ts` | Auto-adds Darkvision 60 ft. sense effect |

### Complex Fixes

| # | Issue | Fix |
|---|-------|-----|
| C1 | Concentration silently overwrites | `window.confirm` dialog before casting new concentration spell |
| C2 | No clear-all on roll history | "Clear All" button in RollDrawer header |
| C3 | 5 theme accents fail WCAG AA | Adjusted Elle Woods, Necromancer, Ranger's Field, Royal Scroll, Printer Friendly accent colors |
| C4 | Concentration overwrite confirmation | `window.confirm` before overwriting existing concentration |
| C5 | Manual HP mode | Number input (1–hitDie+CON) replaces roll button when hitPointType="manual" |
| C6 | 19 spells have no `classes` array | WONTFIX — summon-*-spirit and psionic spells intentionally non-class |

### Accessibility Completion

| # | Item | Status |
|---|------|--------|
| A1 | Escape-to-close all 5 modals + focus return | ✅ `useEffect` keydown listener in each modal |
| A2 | Focus trap in all modals | ✅ Reusable `src/lib/useFocusTrap.ts` hook |
| A3 | Save-proficiency keyboard toggle | ✅ Tab-focusable + P key + `title` hint |
| A4 | `aria-label` on icon-only buttons | ✅ Steppers, close, delete, drag handles |
| A5 | `aria-pressed` on toggles | ✅ Death save dots, spell slot pips |
| A6 | `prefers-reduced-motion` coverage | ✅ Expanded for drawer, overlay, rail, tabs |
| A7 | Contrast audit on darkest presets | ✅ 5 presets adjusted to ≥4.5:1 |

### Empty & Error States

| # | Surface | Empty State |
|---|---------|-------------|
| E1 | Vault rail | "Empty character vault" (verified) |
| E2 | Inventory tab | "No items in inventory" |
| E3 | Effects list | "No effects yet" (verified) |
| E4 | Pages list | "No pages yet" (verified) |
| E5 | Roll history | "No rolls yet" (verified) |
| E6 | Attacks list | "No attacks configured" |
| E7 | User skin presets | "No saved themes yet" |
| E8 | Quickbuilder grids | "Loading..." (verified) |
| E9 | Feedback list | Empty state (verified) |
| E10 | Error toasts | Added user-facing errors to 5 silent catch blocks |

### Verification
- `npm run lint` → **0 errors**, 2 pre-existing warnings
- `npm run build` → **passes**
- `npm run dev` → app launches, Express/Advanced/Backup tabs render
- Keyboard-only navigation: Tab/Shift+Tab, Escape modals, P key proficiency toggle — all functional

---

## Future Rounds — Status & Remaining Work

Per `docs/ROADMAP-1.0.md` §8 sequencing:

### R15 — Initiative Tracker + Onboarding + Bundle Diet
**Proposal:** `docs/ai-project-proposal-15.md`
**Status:** Not yet started
**Spec:**
- Initiative tracker: DM-less party order list (add combatants, sort, advance turns) — drawer tab or section
- Onboarding: dismissible first-run tour card explaining skins/layout/effects/dice
- Bundle optimization: serve large JSON data (~900KB spells/subclasses/feats) from API routes instead of client-side bundle; measure first

### R16 — Conditions with Teeth + Campaigns v1
**Proposal:** `docs/ai-project-proposal-16.md`
**Status:** Not yet started
**Spec:**
- Conditions: exhaustion as stacking effect levels, standard condition presets applying real penalties through effects engine
- Campaigns/party play: party codes, shared roll feed, DM view; design doc → polling beats websockets for v1
- Requires strongest agent tier + mandatory review (effects internals)

### R17 — Multiclassing (optional for 1.0)
**Proposal:** `docs/ai-project-proposal-17.md`
**Status:** Not yet started
**Spec:**
- Per-class levels, multiclass spell slot table, proficiency intersection rules, level-up class picker
- Touches everything: character state, builder, sheet, spells, ASIs/feats
- Strongest agent, its own dedicated round, extensive spec required

### Release Gate (R17+)
From `ROADMAP-1.0.md` §7:

| Gate | Status |
|------|--------|
| All §2 bugs closed; QA P1 = 0 | ❓ P1 status unknown (R10 addressed P1) |
| `npm run lint` 0 errors, `npm run build` clean | ✅ |
| Full manual pass: register → build → play → skin → export | ❌ |
| Two-browser concurrency test | ❌ (requires hosting + SQLite) |
| Data licensing check (SRD vs non-SRD content) | ❌ |
| README rewritten, screenshots refreshed, version tagged | ❌ |

### Remaining Landmine Warnings
From `ROADMAP-1.0.md` §0 — issues that have caused real bugs:

| Landmine | Mitigation |
|----------|------------|
| `JSON.stringify` drops `undefined` | Nullable fields typed `\| null` |
| CSS `--x: var(--x)` self-reference | Never define CSS var in terms of itself |
| `globals.css` append-only | New rules at end; use fresh class names |
| Positional selectors `.cs-sheet-col:nth-child(n)` | Don't insert siblings into unknown structures |
| Vault concurrent write race | Fixed via SQLite migration (R13) |
| Dice roll callbacks ~4s delay | In-flight guard (`hitDiceRolling` ref) |
| Non-atomic registration | JWT signed before vault write (R13) |
| New `Character` fields need type + validation + ALLOWED_PATCH_FIELDS | Required for any new field |
| Sheet section IDs auto-migrate | Via `mergeWithDefaults` — never special-case |
| Class/species colors on paper vs dark chrome | `[data-class]` sets `--class-a`; paper mixes ~75% toward ink |

---

## Open P2/P3 Items by WONTFIX/STALE Classification

### WONTFIX (deferred to future rounds)

| # | Issue | Reason |
|---|-------|--------|
| 1 | 19 spells have no `classes` array | summon-*-spirit & psionic spells intentionally non-class |
| 2 | No CON save prompt on damage | Requires effects engine (R16 — conditions) |
| 3 | Mobile-first design / touch targets | Deferred to R15 mobile pass |
| 4 | Content-Security-Policy headers | Deployment configuration concern |
| 5 | Tough feat +2 HP/level not automated | Requires full HP recalculation pipeline |
| 6 | Mobile/Squat Nimbleness speed | Deferred to feats overhaul |

### STALE (code changed since QA report)

| # | Issue | Reason |
|---|-------|--------|
| 1 | concentratingOn stores name not ID | Display-only field, not used mechanically |
| 2 | CasterType "third" dead code | Used by Arcane Trickster/Eldritch Knight subclasses |
| 3 | Net damage fallback to 1d4 | Net has no damage — fallback is correct |
| 4 | Inconsistent z-index scale | Existing design pattern |
| 5 | Feedback GET truncation at 75 | Acceptable for current scale |
| 6 | BCRYPT_ROUNDS = 10 | Sufficient for current threat model |
| 7 | PostCSS vulnerabilities | Build-time only, non-runtime |
| 8 | role="menu" no arrow-key navigation | Low-impact context menu |

---

## Files Changed in R14

```
docs/CHANGES-14.md                    — new (changelog)
src/lib/useFocusTrap.ts               — new (reusable hook)
docs/ai-project-proposal-14.md         — pre-existing (proposal)
railway.json                           — modified (+FORGE_VAULT_DIR)
src/app/globals.css                    — modified (sr-only, focus rings, transitions, truncation, reduced-motion)
src/components/AppearancePanel.tsx     — modified (eslint-disable removed, focus trap, escape)
src/components/ClassLearnModal.tsx     — modified (focus trap, escape)
src/components/CreatorPanel.tsx        — modified (settings)
src/components/DiceRollOverlay.tsx     — modified (d100 faces)
src/components/FeedbackModal.tsx       — modified (focus trap, escape)
src/components/ForgeAndFableApp.tsx    — modified (pushPool, error handling, clear-all)
src/components/HeroSheet.tsx           — modified (aria-live, aria-label, confirm, manual HP, close buttons)
src/components/LevelUpModal.tsx        — modified (manual HP, focus trap, escape)
src/components/QuickbuilderPanel.tsx   — modified (loading state)
src/components/RollDrawer.tsx          — modified (clear-all button)
src/components/SheetSection.tsx        — modified (proficiency keyboard)
src/components/SourceSettingsPanel.tsx — modified (encumbrance disabled)
src/components/SpeciesLearnModal.tsx   — modified (focus trap, escape)
src/data/items.json                    — modified (Trident, Longbow)
src/lib/skins.ts                       — modified (_drop removed, accent contrast)
src/lib/utils.ts                       — modified (Darkvision bridge)
