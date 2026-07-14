# CHANGES-AO-0 — Arcane Observatory Phase 0: audit and baseline

Date: 2026-07-13 (overnight). Author: Fable.
Plan: docs/arcane-observatory-implementation-plan.md — Phase 0.
Adaptations: docs/ai-project-proposal-34-arcane-observatory.md.

## What changed

No product code changed in this phase.

- Branch `feature/arcane-observatory-redesign` created from `main@303e8a8`
  (DM-11/12 included and verified green: 264 tests, build, lint 0 errors).
- Audit written: `docs/arcane-observatory-audit.md` (Gate 1 deliverable).
- Baseline screenshots: `QA/screenshots/ao-baseline/` — auth, onboarding,
  commission picker, creator steps, premade picker, portrait modal, roster,
  character sheet + 5 tabs, campaigns, DM path, at 1440x900 / 1280x800 /
  768x1024 / 390x844.
- New rerunnable capture scripts: `QA/tests/ao-baseline.mjs` … `ao-baseline-5.mjs`
  (server on :3010 via `next start`; UI-form auth; seeded reviewer account).
- Migration ledger started: `docs/design/arcane-observatory-migration.md`.

## Found while auditing (not fixed here)

- `scripts/r18-seed.mjs` is stale: expects a token in the auth response body
  (auth is the httpOnly `ff_session` cookie now) and omits the required
  `ruleset: "2014"` field, so it registers the user then fails to create
  characters. Working replacement pattern lives in `QA/tests/ao-baseline-5.mjs`.
- Two live `backdrop-filter` blurs remain (globals.css ~12528, ~12848);
  earmarked for Phase 5, banned for all new work.
- `glass-*` class names still used 37 times in TSX (visuals already
  overridden); rename earmarked for Phase 5 under the dynamic-class guardrail.

## Verification

- `npm test` 264 passed; `npm run build` compiles; `npm run lint` 0 errors
  (3 pre-existing warnings) — all run at the branch point before any work.

## Rollback

Nothing to roll back (docs, QA scripts, and screenshots only).
