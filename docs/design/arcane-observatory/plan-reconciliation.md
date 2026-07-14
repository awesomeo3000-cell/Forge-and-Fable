# Production UI plan — reconciliation with work already landed

Date: 2026-07-14. Author: Fable.

The owner-supplied production plan (`implementation-plan.md`, this folder)
is now the **master spec for the structural redesign**. This document maps
its phases onto the work already merged on
`feature/arcane-observatory-redesign` and records where owner decisions
supersede the plan's text. Read this BEFORE the plan.

## Owner decisions that supersede the plan

1. **Parchment is retired entirely** (owner, 2026-07-14, CHANGES-AO-4) —
   newer than the plan's text. Wherever the plan allows "warm paper" for
   handouts/journals/notes (§1.1, §4.2, §5.3, §11.3, §19), read: a
   DISTINCT INK DOCUMENT surface (`--surface-document` #152438, ruled
   lines, gold spine). `DocumentSurface` stays as a concept; its material
   is ink, not paper.
2. **Typography stays on the repo fonts** (Gate 2, approved): Fraunces =
   display, Newsreader = body, Archivo = labels, Space Mono = numeric.
   The plan's §4.7 Zilla Slab/Roboto/Montserrat mapping is the MOCKUP's
   stack — do not import it.
3. **Palette**: locked at Gate 2 — ink-blue surfaces, arcane blue
   `#5c94c8` selection, seal red `#a84f49` active, **old gold `#b3924a` /
   `#d9b967`** structural accent (the plan's "confirm which token replaced
   brass" answer: `--border-brass`, value old gold, name retained). The
   palette reference route is `/theme-observatory/palettes`; the separate
   palette mockup file named in §Visual references does not exist locally.

## Phase mapping (plan → repo state)

| Plan phase | Repo state |
| --- | --- |
| 0 Audit + baselines | **DONE** (CHANGES-AO-0, `docs/arcane-observatory-audit.md`, `QA/screenshots/ao-baseline/`, approved at Gate 1) — EXCEPT the two deep audits §3.4 (modular sheet) and §3.5 (Table), delivered as `sheet-table-audit.md` in this folder. |
| 1 Tokens, primitives, flag | **DONE** (CHANGES-AO-1/2, approved at Gate 2). Feature flag = the `data-theme="arcane-observatory"` attribute on `<body>` (`src/app/layout.tsx`) — remove attribute → legacy presentation, wholesale. All AO CSS is scoped to it. |
| 2 Shell + dashboard | Shell **DONE** (CHANGES-AO-3). Dashboard = **NEXT** (CHANGES-AO-5). |
| 3 Forge | Pending (maps to old plan's 4B). |
| 4 Sheet frame/masthead | Pending; §3.4 audit first. |
| 5A/B/C Table | 5A/5B structure largely **DONE pre-redesign** (proposal 26 → CHANGES-DM-11/12: state grammar, adaptive density, encounter log w/ caps+grouping). Remaining: re-skin under AO tokens, folio inspector + active-stage composition (Round Four B), 5C sound dock. |
| 6 Chronicle/settings | Pending. |
| 7 A11y/perf/cleanup | Pending (maps to old plan Phase 5). |

## Repo-reality notes on the plan

- **There are no routes.** The app is a single-route state machine
  (`ForgeAndFableApp.tsx`); the plan's "route inventory" is the
  screen-state inventory in the AO-0 audit. "Dashboard" today is the
  logged-in landing area (roster rail + onboarding/start) plus
  `CampaignPanel`; a campaign-centric dashboard is a NEW composition of
  existing data, not a restyle of an existing page.
- Navigation labels (§6.2 Dashboard/Forge/Hero/Table/Chronicle): the app
  has no persistent nav rail today — mode is implied by state. Introducing
  the rail is part of the dashboard phase and must not invent new
  navigation targets that have no screen behind them.
- Landmines (unchanged): globals.css eras are append-only; `.dm-table`
  token remap; `.dm-command-member > button:first-child`; never redefine
  next/font vars self-referentially; changes invisible on :3005/:3006
  until build+restart.
- Conventions: changelogs `CHANGES-AO-N` continue as the per-phase
  deliverable format required by plan §17.
