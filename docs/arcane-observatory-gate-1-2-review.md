# Arcane Observatory — morning review packet (Gates 1 + 2)

Overnight run, 2026-07-13 → 07-14. Author: Fable.
Branch: `feature/arcane-observatory-redesign` (main untouched after `303e8a8`).

## How to review

1. **Showcase (Gate 2):** http://localhost:3010/theme-observatory — the
   :3010 server was left running on the branch build. If it is down:
   `npx next start -p 3010` from the repo. Tokens on top, primitives below.
   View in incognito (the color-transforming extension will lie to you).
2. **Audit (Gate 1):** `docs/arcane-observatory-audit.md`.
3. **Baselines:** `QA/screenshots/ao-baseline/` (62+ PNGs, 4 breakpoints).
4. Changelogs: CHANGES-AO-0 / AO-1 / AO-2.

## What happened, in order

- **DM-11/DM-12 landed** (crew ran proposal 26 before this run; both
  changelogs + 12 new tests were in the working tree). Verified green —
  264 tests, build, lint — which **unblocked Phase 1+** per proposal 34 §2.
  Note: an auto-commit ("updates", `303e8a8`) folded that work and my AO
  docs into one commit on main before I could split them.
- **Phase 0 (Gate 1):** audit + baseline. Headline finding: the app is ONE
  Next.js route — a state-machine SPA in `ForgeAndFableApp.tsx` — and ~all
  styling lives in globals.css (13.4k lines), so the migration is about CSS
  eras and screen-states, not routes. Two live `backdrop-filter` blurs
  remain (rest were already neutralized). `glass-*` class names survive in
  37 places (visuals overridden). Baseline capture is scripted and
  rerunnable (`QA/tests/ao-baseline*.mjs`); found `scripts/r18-seed.mjs` is
  stale (cookie auth + required `ruleset` field) — documented, not fixed.
- **Phase 1:** semantic tokens under `[data-theme="arcane-observatory"]` in
  a NEW file `src/app/arcane-observatory.css` imported after globals.css
  (same cascade effect as appending, cleaner ownership). Values = plan
  palette leaned matte. Typography roles map the existing fonts; nothing
  new imported. `/theme-observatory` showcase route added (unlinked,
  noindex, no auth).
- **Phase 2:** `.ao-*` primitives, class-based to match the codebase idiom:
  panels/document/rules, five button variants, fields with error+disabled,
  segmented/tabs, chips/banners/log, stats/meters/token discs/index
  badges, the acting/selected/combined state grammar (DM-11-compatible
  `data-state` pattern), empty state, opaque modal shell. All states
  rendered in the showcase gallery.

**The product is pixel-identical to before** — nothing sets the theme
attribute except the showcase page. Each phase is its own commit
(`66e8a01` audit, `4ea0196` tokens, `a82fa5c` primitives); rollback is a
revert.

## Gate questions for you

1. **Palette:** panels sit at `#142235`→`#1a2b40` (bluer than the
   prototype's override layer, per the plan values). Warm enough, or push
   toward the prototype's slate `#17232e`?
2. **Primary action color:** plan says arcane blue for selection AND the
   showcase uses it for `.ao-btn-primary`. Alternative: brass for primary
   CTAs (as the prototype's active nav does) and keep blue strictly for
   selection. Both variants are in the showcase (blue "Next turn" vs brass
   "Open the table").
3. **Splash/auth backdrop:** plan calls for a matte field; the current
   painted-landscape splash is the app's signature shot. Keep a (darkened,
   framed) version of the art on splash/auth only, or go full matte?
4. **Engraved rule subtlety:** the light return is faint by design — check
   it on your monitor at the showcase's section headings.
5. **Showcase route in production:** `/theme-observatory` is unlinked but
   public. Fine to leave, or gate it before the next deploy?

## If gates pass → Phase 3 (global shell)

Scope: flip the theme attribute on, migrate the app frame (top bar, rail,
page scaffolding, toasts, modal shells) to semantic tokens, replace the
world-backdrop treatment, leave every panel's interior for Phase 4. That is
the first change users would see, so it waits for your explicit go.

Known debt going in: DM Table live-encounter baseline still needs a
scripted capture (before 4D); axe/contrast/zoom sweep starts with Phase 3.
