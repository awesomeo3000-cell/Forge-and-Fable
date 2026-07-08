# Forge & Fable — Round 15: Initiative tracker, onboarding, bundle diet, loose ends

**Audience:** Codex-class agent, fresh session.
**Read first:** `docs/ROADMAP-1.0.md` §0. **Before starting:** `git commit -m "pre-R15 checkpoint"`.

## Task 1 — Initiative tracker (local-only, drawer tab)

A DM-less combat order tool living in the existing **RollDrawer** as a second tab ("Combat") beside the current dice view — the drawer is already movable/resizable/themed, so the tracker inherits all of that for free.

Design (pre-decided):
- State: local to the drawer, persisted in `localStorage` key `forge-and-fable-initiative` (combat is table-side, not character data — do NOT touch the Character schema).
- Data: `{ combatants: { id, name, initiative, isPlayer?: boolean }[], turnIndex: number, round: number }`.
- UI top: "Add combatant" row — name input + initiative number input + Add button; plus a "Add <current character> (roll)" shortcut button that rolls initiative via the existing `onRollPool`/roll pipeline for the selected character (pass the character name + initiative modifier into the drawer via new optional props from `ForgeAndFableApp`: `activeCharacterName`, `activeCharacterInitiative`) and inserts with the rolled total.
- List: sorted by initiative descending (ties: insertion order); current turn highlighted with the accent; each row has a remove ×.
- Controls: "Next turn" (advances `turnIndex`, wraps and increments `round`), "Round N" display, "Clear combat" (confirm).
- Styling: reuse the drawer's `--roll-*` token vars; no new visual language.

Accept: add 3 combatants incl. the roll-shortcut one; order sorts; Next advances/wraps and increments round; state survives reload; Clear empties after confirm.

## Task 2 — First-run onboarding tour card

A dismissible card that appears ON THE SHEET the first time a user views any character (localStorage flag `forge-and-fable-tour-dismissed`). One paper-styled card (dossier idiom, ≤6 short lines) pointing at: click stats to roll · Adv/Dis in the dice drawer · Effects section for Bless/+1 weapons · Skin ▾ to theme · Layout to rearrange/hide sections. A "Got it" button dismisses forever. No multi-step tour, no arrows, no library.

Accept: fresh browser profile shows the card once; dismiss persists across reloads; never shown again including after logout/login.

## Task 3 — Bundle diet (measure first, then one cut)

1. Measure: `npm run build` and record the client bundle sizes (Next prints route sizes; also check `.next` analyze output if trivially available). Paste the numbers in the changelog BEFORE changing anything.
2. The known problem: `spells.json` (~640KB), `subclasses.json`, `feats.json`, and the item catalog are statically imported by client components. The decided fix: move **spells** (the biggest) behind an API route: new `GET /api/spells` (route handler importing the JSON server-side, `Cache-Control: public, max-age=86400, immutable` — data only changes on deploy), and a client module `src/lib/spellsClient.ts` that fetches once, caches in a module promise, and exposes the same helper functions (`getSpell`, `spellsForClass`, `ALL_SPELLS` becomes async-initialized). Components already read spells through `src/lib/spells.ts` helpers — convert that module to the fetch-backed implementation while keeping synchronous call sites working via a load-gate: `ForgeAndFableApp` awaits the spell load in its initial `useEffect` (alongside the ruleset fetch) before rendering the sheet, so downstream code stays synchronous.
3. Re-measure and paste the delta. If the win is < 100KB gzipped, say so honestly.
4. Do NOT convert subclasses/feats this round — one data file proves the pattern; note the follow-up.

Accept: measured before/after in changelog; spells tab, casting, level-up spell picker, and quickbuild all still work (walk them); no hydration errors in console.

## Task 4 — Loose ends (each one small and pre-decided)

- **§2.6 passives:** `passivePerception/Investigation/Insight` currently include `effChecks` (Guidance inflates passives). Fix: compute passives from a `skillBonusForPassive()` that omits the effects `checks` contribution (riders never applied to passives anyway). One derived helper, three call sites. Verify: Guidance active → active-roll bonus up, passives unchanged.
- **Bearer fallback removal** (deferred from R13): delete the `Authorization: Bearer` fallback in `authenticateRequest` — cookie only now. Verify old curl-with-bearer now 401s and the app still works.
- **Dice drawer default position:** the collapsed tab can overlap the builder header on first run; change `defaultLayout()` to clamp the initial `y` below 180px. Verify on a cleared-localStorage profile.
- **Roll history bump:** cap 30 → 100 entries + a "Clear" button in the history header. (Still session-only; no persistence.)

## Constraints
No new dependencies. Character schema untouched (Task 1 explicitly stores nothing on characters). Landmines apply — especially: the spells refactor (Task 3) must not create a flash of spell-less sheet; gate rendering exactly like the existing ruleset load.

## Verification & deliverable
Per-task acceptance above, `npm run lint`/`build` clean, and a regression walk (build character → roll with adv → cast a spell → level up with spell picker → initiative tracker session). `docs/CHANGES-15.md`, per-task entries, deviations explicit. No entry = not done.
