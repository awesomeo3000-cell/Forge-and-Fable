# Handoff: remaining UX-feedback work (2026-07-17)

Context: Clare's July feedback list was triaged into 12 tasks. Tasks 1–11 (bugs,
dice, spells-as-actions, typography floor, PDF flag, display name, email-verification
switch) are **shipped in code** — see `git log` and the memory note
`feedback-batch-2026-07-17`. This plan covers what's left: the **visual refresh
batch** (task #12), a few small follow-ups, and the verification pass.

## Ground rules (read before touching anything)

- **This is not stock Next.js.** Read the relevant guide in
  `node_modules/next/dist/docs/` before writing code (per AGENTS.md).
- **localhost:3000 is a `next start` production build.** No hot reload. Changes
  require: stop server → `npm run build` → `npm start`. NEVER build while the
  server is running. The env classifier blocks curl/fetch to localhost from
  agent shells — hand browser/network verification steps to Clare.
- **Design language:** everything new uses the Arcane Observatory (AO) token
  system in `src/app/arcane-observatory.css` (`--surface-*`, `--border-*`,
  `--text-*`, `--font-role-*`, `--radius-*`, `--state-*`). Never reintroduce the
  prototype palette. The shipped shell/home/creator are the reference standard —
  "visually outdated" surfaces below should converge on that language.
- **Type floor (established this batch):** body ≥ 14px (0.875rem), labels ≥ 12px
  (0.75rem). Extend the existing override region at the end of
  `src/app/globals.css` (search "readable body scale") for cs-* surfaces rather
  than scattering sizes.
- Checks: `npx tsc --noEmit`, `npx eslint src`, `npm run test`
  (vitest, 358 tests, all green as of handoff; `lint:ci` is zero-warning).

## Phase 0 — verification pass of shipped work (do first, with Clare in browser)

Rebuild + restart the local server, then walk:

1. Creator → class chapter → HP method "Rolled" at level > 1 → dice fly in the
   creator and rolls land in the draft (`CreatorPanel.tsx` `rollStartingHp`).
2. Creator → attributes → "Rolled" method → no pre-filled scores, roll button
   flies 24 d6 with dropped dice dimmed, scores appear on last die, Continue
   gated until landed.
3. Sheet → roll 8d6 (fireball) → total appears only when the last die lands.
4. Cleric spells tab + wizard spellbook → prepare pill aligned regardless of
   text length; "Prepared ✓" state.
5. Sheet Attacks table → prepared attack-roll spell (e.g. Fire Bolt / Guiding
   Bolt) appears with rollable to-hit and Cast button; Misty Step under Bonus
   Actions, not Attacks.
6. Class cards → no banding seams, no blur at selection size (test at Windows
   125/150 % display scaling).
7. Dashboard → next session shows "Friday, July 31 at 7:00 PM" style; module
   text visibly larger; First Look card on a fresh sheet is prominent.
8. Register a fresh account → display-name field; no verification email needed
   locally (`DISABLE_EMAIL_VERIFICATION=true` in `.env.local`).
9. PDF import of a scanned sheet → async progress UI, no timeout
   (`PDF_IMPORT_OCR_ENABLED=true`; **Render needs this env var deployed too**).

## Phase 1 — quick structural wins

### 1a. Equipment as a tab of the features module
- File: `src/lib/sheetLayout.ts`. Move `"equipment"` out of `DEFAULT_COLUMNS`
  column 3 and into `PREFERRED_TABS.features` (e.g. after `"features"`), and add
  it to `OPTIONAL_TABS`. Bump layout `version` and extend `mergeWithDefaults` /
  `migrateLegacy` so saved layouts don't duplicate or orphan the section
  (`tests/sheetLayout.test.ts` covers migration — extend it).
- Rename the merged module: `SECTION_TITLES.features` is "Features & Traits";
  since it will hold gear, retitle the module (e.g. "Compendium" or
  "Features & Gear") via `SECTION_TITLES` — Clare should pick the name.
- Constraint from feedback: equipment is consulted constantly in play — it must
  stay one click away and the tabs must read as peers.

### 1b. Announcement modal → banner
- Current: global announcement modal (find via `announce` toast kind and admin
  announcement plumbing in `ForgeAndFableApp.tsx` / `AdminPanel.tsx`).
- Agreed direction: dismissible banner across the top for normal announcements;
  reserve a modal only for genuinely blocking notices. Persist dismissal per
  announcement id (localStorage) so it doesn't reappear.

### 1c. Display-name rename for existing users (small)
- Backend: `PATCH` handler (new `src/app/api/auth/profile/route.ts`) →
  `vaultStore` update of `users.name` (trim, 80-char cap, fall back to
  `displayNameFromEmail`). Auth via `authenticateRequest`.
- UI: simplest honest surface — an "edit name" affordance next to the dashboard
  greeting (`HomeDashboard.tsx` header) rather than a whole settings page.
  Update the cached `forge-and-fable-user` localStorage blob after save.

### 1d. Typography sweep, part 2
- Audit both stylesheets for remaining sub-floor sizes:
  `grep -n "font-size: 0\.[0-6]" src/app/*.css` and `font: .* 0\.[0-6]\drem`.
  Raise to the floor (body 0.875rem+, uppercase labels 0.75rem+) unless the
  element is genuinely decorative. Done so far: dashboard (ao-hd-*), commission
  details (ao-class-decision*), spell detail overlay, First Look card.

## Phase 2 — visual refresh batch (browser-in-the-loop; do NOT do blind)

Work these with Clare reviewing renders; each is a contained pass in AO language.

### 2a. Top-of-page action cluster (one workstream, don't touch the header twice)
- Feedback: campaign / snapshot / feedback / import buttons are misplaced —
  should sit further top-right and be more noticeable.
- Find the header strip in `ForgeAndFableApp.tsx` (feedback button, import
  modal trigger, `CampaignTableStrip`, `SaveStatusBadge`). Consolidate into one
  right-aligned cluster with AO brass-accent treatment; primary-weight the
  campaign entry point.

### 2b. Sheet chrome: Skin + Layout buttons, dice tray
- `.cs-sheet-tools` buttons (`HeroSheet.tsx` ~line 2120) and `.cs-skin-btn`
  styles in `globals.css` — restyle to AO-consistent controls (they're
  prototype-era glass buttons).
- Dice tray = `RollDrawer.tsx` + `DiceRollOverlay.tsx` styles in `globals.css`
  (`.roll-drawer*`, `.dice-*`). The 3D dice themselves are fine; the drawer
  chrome (tabs, pool builder, history list) needs the AO pass. Keep the
  per-character theme variables (`--doc-accent` etc.) working.

### 2c. Dashboard icons + action-card art
- Files: `src/components/dashboard/dashboardIcons.tsx`,
  `DashboardActionGrid.tsx`, art registry `src/data/dashboardArtwork.ts`
  (art families per action in `dashboardContext.ts` `DashboardActionArt`).
- Ask: on-theme icons for open campaign / continue last character / prepare
  next session / create a character. Iconography should match the engraved
  AO line style (see `src/components/icons/ClassIcon.tsx` for the stroke
  conventions). Left-sidebar icon size: only enlarge if targets < 44px —
  whitespace is fine (agreed pushback).

### 2d. Creator chapter visuals (priority order: Seal → Origin → Species)
- **The Seal** (`CreatorPanel.tsx` step 6, `backdropMode`, artwork from
  `COMMISSION_CHAPTER_ARTWORK.seal`): it's the finale — make it a payoff
  moment. Ideas consistent with existing patterns: full-bleed chapter art,
  animated seal/stamp on forge, summary "certificate" using the ledger
  visual vocabulary (`ledger-*` classes exist).
- **Origin chapter** (`src/components/commission/origin/OriginChapter.tsx`) and
  **species/lineage** (`commission/lineage/LineageChapter.tsx`): both need
  visual interest. The class chapter (AO-12) is the reference: catalog cards
  with art + a feature panel. Species portraits exist in `src/data/portraits`
  (`suggestPortraitAncestry`); background/origin art would need new assets —
  flag asset needs to Clare early.
- **Commission Details sizing** (`ao-class-decisions`): Clare feels it's small
  overall — consider widening the decision cards / increasing padding while in
  there. Artwork slot: `commissionChapterArtwork.ts` maps chapter banners.
- **Backdrop panel behind standard/quickbuild/premade** (`CharacterStartPanel.tsx`
  / `CreatorStartPanel` styles): Clare suspects it should be smaller — judgment
  call, decide on a render together.

### 2e. Level-up modal (lowest priority — functional, just dated)
- `LevelUpModal.tsx` + `LevelUpModal.css` (only component with its own CSS file
  — fold into AO treatment while restyling). Don't change behavior; it works.

### 2f. Contextual onboarding (instead of a site tutorial — agreed direction)
- Extend the First Look pattern (now restyled) to other first-run moments:
  empty states already exist on the dashboard (`ao-hd-empty`,
  `OnboardingPanel.tsx`). Add inline hints where features live (e.g. first
  visit to campaigns, first spell prepare) rather than a click-through tour.
  Keep each dismissible + persisted (see `tourDismissed` in `HeroSheet.tsx`).

## Notes / gotchas discovered this batch

- `pushRoll`/`pushPool`/`pushD20` all stamp roll labels per-die; the "total on
  last kept die" rule is now invariant — preserve it in any dice-tray restyle.
- `capabilitiesForCharacter` returns class/universal capabilities **only for
  ruleset "2014"**; spells flow for all rulesets. If SRD 5.2.1 becomes primary,
  the capability catalog needs a 5.2.1 lane (bigger project, not scheduled).
- Wizard is in `PREPARED_CASTERS` — prepared-spell logic already treats wizards
  correctly; don't "fix" it again.
- `tests/item-candidate-validator.test.mjs` is a self-running script bridged
  into vitest via a `process.env.VITEST` guard — keep both run modes working.
- Render (`render.yaml`) is the live deploy (dreamwright.gg); `railway.json` is
  vestigial. Env vars added this batch: `PDF_IMPORT_OCR_ENABLED=true` (also
  needs setting in the Render dashboard), `DISABLE_EMAIL_VERIFICATION` (local
  only — must NOT be set in production).
