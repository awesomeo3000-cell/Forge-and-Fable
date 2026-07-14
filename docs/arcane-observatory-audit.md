# Arcane Observatory — Phase 0 Audit (Gate 1 deliverable)

Author: Fable, 2026-07-13 (overnight run). Branch: `feature/arcane-observatory-redesign`,
cut from `main` at `303e8a8` with DM-11/DM-12 landed and verified
(264 vitest tests, `next build`, lint: 0 errors — all green at branch point).

Companion docs: `arcane-observatory-implementation-plan.md` (the plan),
`ai-project-proposal-34-arcane-observatory.md` (repo adaptations, sequencing).

---

## 1. Current architecture

- **Framework:** Next.js 16.2.9 (App Router) + React 19.2.4 + TypeScript.
  Production launch configs run `next start` (build + restart to see changes).
- **Routing: there are no page routes to migrate.** The entire product is one
  route (`src/app/page.tsx`) rendering `ForgeAndFableApp.tsx` (2,369 lines) —
  a client-side state machine, not URL-routed. Screens are derived from a
  state cascade: no ruleset → Splash; no user → AuthScreen; user with no
  characters/campaign → onboarding fork ("Create a character" / "Run a
  campaign"); then CharacterStartPanel → Creator/Quickbuilder → HeroSheet,
  and campaign area → `campaignSync ? (DM ? DMTablePanel : CampaignPanel)`.
  - Consequence: the plan's "route inventory" is a **screen-state inventory**
    (§3), "deep links remain valid" is vacuous (single URL), and the Phase 3
    "route transitions" scope is really screen-state transitions inside
    ForgeAndFableApp.
- **State:** ~40 `useState` hooks in ForgeAndFableApp (user, characters,
  draft, campaignSync, rolls, toasts…) passed down as props. No context
  providers for app state; adding a theme provider/attribute is greenfield.
- **Styling:** one monolith — `src/app/globals.css`, **13,402 lines**, plus
  `LevelUpModal.css` (670). Components are nearly style-free in TSX
  (15 hex literals, ~44 inline `style={{}}` across 9 files, concentrated in
  ForgeAndFableApp and CharacterImportModal). All theming leverage is in the
  monolith — good for us.
- **Fonts:** next/font variables (`--font-fraunces`, `--font-newsreader`,
  `--font-archivo`, + skin fonts). Landmine (documented in globals.css):
  never redefine a font variable in terms of itself.
- **Icons:** lucide-react + a small inline SVG symbol set. **Tests:** vitest,
  264 passing; Playwright present and working headless (see §5).

## 2. Design-debt map

- **Token eras stacked by cascade** (all in globals.css):
  1. `:root` "Direction A: Printed Tome" (`--ground`, `--parchment`,
     `--accent`) + back-compat alias block (`--ink`, `--gold`, `--glass`,
     `--ember`, `--teal`…) marked DO-NOT-REMOVE;
  2. document/"paper" palette scoped to the sheet (`--paper`, `--doc-*`);
  3. `--ledger-*` (proposal 18) and DM `--dm-*` + `.dm-table` legacy remap
     (~line 12630);
  4. era-labeled append blocks: Round 3.5 (~5755), Campaigns v2 (~10883),
     DM workshop (~10911), Sunlit Ledger (~12630), DM-10 (~13278),
     DM-11 (~13318), DM-12 (~13377).
- **Counts:** 295 `border-radius`, 82 `box-shadow`, 801 parchment/paper
  token references. `backdrop-filter`: 13 occurrences are already `none`
  (a previous de-glassing pass); **2 live blurs** — `.dm-command-palette`
  (blur 5px, ~12528) and the portrait-modal region (blur 4px, ~12848).
- **Class-family census** (uses in TSX): `cs-*` 409 (character sheet),
  `dm-*` 227, `ledger-*` 124 (buttons/chrome — `ledger-button` is the de
  facto shared button), `level-*` 108 (LevelUpModal), `dj-*` 68 (creator
  journey), `campaign-*` 62, **`glass-*` 37 — glass-era class names still
  live in markup** (visuals overridden, names remain; rename in Phase 5,
  respecting the dynamic-class guardrail).
- **World backdrop:** `--world-backdrop` (heroes-backdrop.jpg photo) behind
  splash, auth, and the app shell, with parchment panels floating over it.
  This is the single loudest "parchment everywhere" contributor and is
  replaced by the matte field in Phase 3.
- **The skins system is product, not debt:** `src/lib/skins.ts`, 17 presets,
  share codes, sanitizer. Per proposal 34 §4 it is protected behavior and
  already implements "parchment only for documents."

## 3. Screen-state inventory ↔ baseline screenshots

Baseline captured at 1440x900 / 1280x800 / 768x1024 / 390x844 into
`QA/screenshots/ao-baseline/` (62+ PNGs) by `QA/tests/ao-baseline*.mjs`
(new, rerunnable; server on :3010, throwaway accounts, seeded reviewer
`r18-review@test.local` with rogue L3 + wizard L5).

| Screen state | Files | Notes |
| --- | --- | --- |
| Splash → Auth (register + login tabs) | `01-auth-*`, `16-roster` (login state) | plan 4-breakpoint set |
| Onboarding fork | `02-start-*` | "What brings you to the table?" |
| Commission mode picker | `06-start-modes-*`, `09-quickbuilder-*` (selected state) | |
| Standard creator | `07-creator-step1-*`, `08-creator-step2-*` | |
| Premade picker | `12-premade-picker` | |
| Portrait selector modal | `14-sheet-*` (misnamed — it is the modal, open state) | |
| Roster rail + HeroSheet (wizard L5) | `17-sheet-*` + full-page variants | |
| Sheet tabs: Inventory/Spells/Features/Notes/Actions | `18-sheet-tab-*` | 1440 only |
| Campaigns / DM path | `05-campaigns-*`, `10-dm-path-*` | |

**Not captured (gaps for later phases):** DM Table with a live encounter
(needs seeded campaign + combatants; DM-11/12 verification covers current
state; must be scripted before Phase 4D), LevelUpModal, dice roll overlay,
import modal, feedback modal, admin panel, validation-error and
loading/disabled states. These are needed before their respective phases,
not before Phase 1.

**Layout quirks observed during capture** (pre-existing, for the record):
the fixed DICE drawer tab overlaps page headings at some widths; the roster
rail overlaps the world backdrop oddly at tablet widths.

## 4. Risk ranking

- **HIGH** — `HeroSheet.tsx` (2,437 lines; gameplay + presentation + skins
  interplay); `ForgeAndFableApp.tsx` (shell chrome mixed into the state
  machine; most inline styles); `DMTablePanel.tsx` + dmTable components
  (freshest work, DM-11/12, append-only CSS eras, `>button:first-child`
  landmine); globals.css cascade order itself (append-only discipline).
- **MEDIUM** — CreatorPanel/QuickbuilderPanel (validation + draft
  persistence under guided flow), CampaignPanel, LevelUpModal (own CSS
  file), portrait modals (already dark-surfaced — closest to target look).
- **LOW** — SplashScreen, AuthScreen (self-contained), SaveStatusBadge,
  icons, admin panel (owner-only).

## 5. Tooling findings

- Playwright works headless against a local server; auth via UI form is
  reliable; API-seeded cookies do NOT reach the page context (register/login
  through the form instead). `scripts/r18-seed.mjs` is stale twice over:
  expects a body token (auth is now the httpOnly `ff_session` cookie) and
  omits the now-required `ruleset: "2014"` field. `QA/tests/ao-baseline-5.mjs`
  contains the working pattern.
- No visual-regression tooling exists; the ao-baseline scripts are the
  starting point for per-phase capture.
- A second `next dev` instance is refused while `next start` runs from the
  same `.next`; use `next start -p 3010` from a fresh build for capture runs.

## 6. Recommended migration order (Phase 4)

Unchanged from the plan, with repo names attached:

1. **4A Campaign dashboard** = CampaignPanel + onboarding fork + start panel.
2. **4B Character creation** = CharacterStartPanel, CreatorPanel,
   QuickbuilderPanel, portrait selector.
3. **4C Character sheet** = HeroSheet + skins containment (highest care).
4. **4D DM encounter screen** = DMTablePanel + dmTable/* (after Round Four B
   is specced in Observatory language).
5. **4E Chronicle/notes/handouts** = campaign memory/notes surfaces.
6. **4F Mobile** = drawer/bottom-nav treatment of all of the above.

## 7. Unknowns / open questions for Gate 1

1. DM Table live-encounter baseline still needs a scripted capture path
   (campaign create → invite/ghosts → encounter) before Phase 4D.
2. `dj-*` prefix ("dungeon journey"?) naming origin — cosmetic, Phase 5.
3. Whether the owner wants the splash/auth photo backdrop retained in some
   form (plan says matte field; splash is the app's current signature shot).
4. LevelUpModal.css: fold into the token system during 4B/4C or leave for
   Phase 5.

## 8. Stop condition

Phase 0 complete: project builds from the current tree, tests green,
baseline captured, this audit written. Phase 1 may begin per proposal 34
sequencing (DM-11/12 landed) — Gates 1+2 are reviewed together in the
morning before any Phase 3 work.
