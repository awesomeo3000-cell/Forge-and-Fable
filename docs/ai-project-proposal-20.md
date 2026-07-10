# Proposal 20 - HP correctness, calculation test foundation, and CI runtime repair

**Implementer:** DeepSeek (follow this specification exactly; do not redesign adjacent systems).
**Reviewer:** Codex after implementation. Leave all changes local and unstaged for review.
**Repository:** `E:\forge-and-fable`
**Read first:** `AGENTS.md`, then `docs/ROADMAP-1.0.md` section 0, then this document from top to bottom.

The repository's `AGENTS.md` is binding. Before changing code, read the relevant current Next.js documentation under `node_modules/next/dist/docs/`. This round should not require changing a Next.js route or framework API. If you believe it does, stop and explain why in the changelog before proceeding.

---

## 0. Outcome

Deliver one narrow stabilization round that does all three of the following:

1. Correct fixed, rolled, and manual HP advancement behavior and make level-down safe.
2. Establish a real automated unit-test command for pure character calculations.
3. Make CI run on the Node version the application actually requires, including tests and typechecking.

This is not a general rules-engine refactor. It is a correctness foundation for later work.

### Definition of done

The round is complete only when:

- Fixed HP advancement never asks the player to roll.
- Every new level above 1 persists the final HP gain in the existing `hpRolls` array, regardless of fixed, rolled, or manual method.
- New characters created above level 1 persist enough per-level HP gain history to level down safely.
- Level-down removes exactly one recorded HP gain and never raises a character from 0 HP to 1 HP.
- Legacy fixed-HP characters without history use the documented deterministic fallback.
- Legacy rolled/manual characters without history are not modified by an invented guess.
- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` all run successfully.
- CI uses Node 22, not Node 20, and runs the same four gates.
- `docs/CHANGES-20.md` truthfully records files changed, commands run, and live observations.

---

## 1. Current confirmed defects

Do not re-diagnose these from memory. Re-open the named functions before editing.

### Defect A - fixed advancement still rolls

In `src/components/LevelUpModal.tsx`, the HP step distinguishes only `manual` versus everything else. A character whose `settings.hitPointType` is `fixed` receives the same `Roll the Die` workflow as a rolled character.

Required behavior for fixed advancement:

```text
gain = max(1, floor(hitDie / 2) + 1 + Constitution modifier)
```

The fixed result must be available immediately. There must be no roll button, roll animation, random call, or asynchronous callback.

### Defect B - level-down only unwinds recorded entries

In `src/components/HeroSheet.tsx`, `handleLevelDown()` changes HP only when `character.hpRolls` has an entry. Characters created at a higher level with fixed HP can have no entries, so their level drops while their maximum HP remains unchanged.

### Defect C - current HP can be incorrectly raised

The existing level-down code clamps current HP to at least 1 after subtracting the removed gain. A character at 0 HP can therefore be resurrected by leveling down.

Required policy:

```text
newMaxHp = max(1, oldMaxHp - removedGain)
newCurrentHp = min(oldCurrentHp, newMaxHp)
```

This preserves damage, caps a formerly full character at the new maximum, and keeps 0 HP at 0.

### Defect D - HP formulas are duplicated

Starting HP and per-level gain logic currently appears in `utils.ts`, `CreatorPanel.tsx`, `LevelUpModal.tsx`, and `HeroSheet.tsx`. That duplication caused the fixed-mode disagreement.

---

## 2. Hard constraints

1. Preserve all existing user and character data. Do not delete or rewrite `data/`.
2. Do not touch the user's pre-existing changes in `dev-server.err.log` or `docs/CHANGES-19.md`.
3. Do not commit, push, create a branch, or stage files. Codex will review the unstaged diff.
4. Do not change authentication, APIs, SQLite schema, migrations, campaigns, spells, feats, equipment behavior, sheet layout, skins, or global CSS.
5. Do not rename the persisted `Character.hpRolls` field in this round. Treat it as a legacy name whose values are final per-level HP gains, not necessarily raw die faces.
6. Do not add a second HP-history field or a schema migration.
7. Do not duplicate production formulas inside tests. Tests must import the real production functions.
8. Do not snapshot React markup as a substitute for calculation assertions.
9. Do not suppress lint/type errors with `any`, `@ts-ignore`, disabled rules, or broad casts.
10. Do not claim live verification unless you actually interacted with the running application and observed the stated result.
11. If a requested acceptance criterion conflicts with current data semantics, stop and document the conflict instead of inventing a silent migration.

### Explicit non-goals

- Multiclass HP or hit dice.
- Retroactive maximum-HP changes when Constitution changes through an ASI/feat.
- Renaming `hpRolls` to `hpGains` across persisted data.
- Rebuilding skill/save calculations into a new rules engine.
- Testing every feat, class feature, spell, or campaign flow.
- UI redesign or copy changes outside the HP step's accuracy.
- Repairing unrelated lint warnings unless your own changes introduce them.

Record the Constitution/ASI limitation in `CHANGES-20.md` so nobody later describes this as complete HP rules coverage.

---

## 3. Required implementation

### 3.1 Add a pure HP calculation module

Create `src/lib/hitPoints.ts`. It must contain pure functions only: no React, browser globals, random calls, fetches, database access, or mutable module state.

Export these concepts with clear TypeScript names and explicit input/output types:

1. First-level HP:

```text
max(1, hitDie + constitutionModifier)
```

2. Fixed gain after level 1:

```text
max(1, floor(hitDie / 2) + 1 + constitutionModifier)
```

3. Convert a raw rolled result to a final gain:

```text
max(1, rawRoll + constitutionModifier)
```

4. Build starting HP for levels 1-20. It must return both:

- `maxHp`
- `hpGains`, with exactly `level - 1` final gains when complete

For fixed mode, populate `hpGains` with one fixed gain per extra level. For rolled mode, convert supplied raw rolls to final gains. Do not pretend an incomplete rolled list is complete.

5. Revert one level of HP. Its result must include the next maximum/current HP, the shortened gain history, and whether the operation is safe.

Required reversion policy:

- If a recorded final gain exists for the removed level, use it.
- If no gain exists and the method is `fixed`, use the fixed-gain formula as a legacy fallback.
- If no gain exists and the method is `rolled` or `manual`, return an unsafe result with a human-readable reason. Do not guess.
- Preserve current HP using `min(oldCurrentHp, newMaxHp)`. Zero remains zero.

Names may differ slightly if they remain direct and unambiguous. Do not export one giant catch-all function with mode flags that obscure these rules.

### 3.2 Use the shared module during creation

Update `src/lib/utils.ts` so `characterPayload()` uses the shared HP functions instead of its private duplicated `startingHp()` implementation.

Required behavior:

- A level-1 character persists no unnecessary HP gain entries.
- A fixed level-5 character persists four identical final gains.
- A rolled level-5 character persists four final gains derived from the four raw creation rolls.
- `currentHp` begins equal to `maxHp`.
- Existing class gear, tools, spells, effects, and all unrelated payload fields remain unchanged.

Update `src/components/CreatorPanel.tsx` to use the same shared first-level/fixed/rolled helpers for its preview. Keep its current interaction design. Do not redesign the high-level manual-creation experience in this round; document that remaining ambiguity.

### 3.3 Correct `LevelUpModal`

Update `src/components/LevelUpModal.tsx`.

Fixed mode:

- Seed the HP step with the fixed gain.
- Mark the HP step complete immediately.
- Display that this is the fixed increase.
- Do not render `Roll the Die`.
- On confirmation, append the final fixed gain to `character.hpRolls`.

Rolled mode:

- Preserve the existing dice animation and in-flight guard.
- Convert the die face plus Constitution modifier to a minimum-1 final gain through the shared helper.
- Append the final gain exactly once.

Manual mode:

- Preserve the manual input.
- Clamp the final gain to a valid integer of at least 1.
- Ensure the input maximum can never become less than its minimum when Constitution is negative.
- Append the confirmed final gain exactly once.

All modes:

- A duplicate click/callback must not append twice.
- `maxHp` and `currentHp` each increase by the same final gain.
- Do not alter subclass, expertise, ASI, feat, cantrip, or spell selection behavior.

### 3.4 Correct level-down

Update `handleLevelDown()` in `src/components/HeroSheet.tsx` to call the shared pure reversion helper.

Order of behavior:

1. Keep the existing confirmation prompt.
2. Determine the HP reversion result before sending a patch.
3. If the result is unsafe because a rolled/manual legacy character has no gain history, do not change level, HP, ASIs, or subclass. Notify the user through the existing `onNotify` callback with the helper's reason.
4. If safe, send one combined patch containing level, HP/history changes, removed-level ASI/feat choices, and subclass clearing when applicable.
5. Preserve `tempHp`; do not silently reset it.

Do not perform multiple PUTs for one level-down.

### 3.5 Add the unit-test foundation

Install Vitest as a development dependency and update `package-lock.json` through npm. Do not hand-edit lockfile entries.

Add these package scripts:

```json
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

An optional `test:watch` script is allowed, but not required.

Add `vitest.config.ts` only if needed to resolve the existing `@/` alias. Keep it minimal. Tests should import `describe`, `it`, and `expect` explicitly from Vitest rather than enabling globals across the project.

Create focused tests under `tests/`:

#### `tests/hitPoints.test.ts`

At minimum verify:

- First-level d10 with CON +2 = 12.
- First-level minimum cannot fall below 1.
- Fixed d10 gain with CON +2 = 8.
- Fixed d6 gain with CON -3 = 1.
- Rolled result 1 with CON -2 = 1.
- Fixed level-5 d10/CON +2 starts at 44 HP with gains `[8, 8, 8, 8]`.
- Rolled creation returns final gains, not raw die faces.
- Reverting with history removes exactly the last gain.
- Reverting a full-health character caps current HP to the new maximum.
- Reverting a damaged character whose current HP is below the new maximum preserves current HP.
- Reverting at 0 HP leaves current HP at 0.
- Missing-history fixed fallback is safe and deterministic.
- Missing-history rolled/manual reversion is unsafe and does not invent values.

#### `tests/utils.test.ts`

At minimum verify `abilityModifier()` boundaries and `proficiencyBonus()` transitions at levels 1, 4, 5, 8, 9, 12, 13, 16, 17, and 20.

#### `tests/equipment.test.ts`

At minimum verify:

- Unarmored DEX 14 = AC 12.
- Leather with DEX 14 = AC 13.
- Half plate with DEX 18 applies only +2 DEX.
- Chain mail ignores DEX and reports its Strength warning below STR 13.
- Shield adds 2.
- Barbarian and monk unarmored-defense formulas use the correct abilities; monk shield behavior falls back from monk unarmored defense.

#### `tests/spellSlots.test.ts`

At minimum verify representative full, half, Artificer, pact, and non-caster levels, including transition levels. Do not add a test for unused `third` casting in this round and do not silently implement it.

Tests must be deterministic and make direct value assertions. Do not use snapshots for these calculations.

### 3.6 Repair CI

Update `.github/workflows/ci.yml`:

- Use `node-version: 22`.
- Keep `npm ci`.
- Run, as separate named steps: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- Do not use `continue-on-error`.
- Do not suppress the `node:sqlite` requirement or downgrade the app runtime.

Do not claim GitHub Actions passed unless you have access to the remote run. Local success is not remote CI success.

---

## 4. Live verification

Code inspection and unit tests are necessary but do not prove the UI workflow.

Use the running local application with disposable local test data. Do not modify a friend's real character. `data/` is ignored and must not be added to git.

Verify these flows:

### Fixed HP

1. Create or open a level-1 Fighter with Constitution 14 and fixed HP advancement.
2. Open level-up to level 2.
3. Confirm the HP step shows a fixed +8 increase and no roll button.
4. Complete level-up and observe max/current HP increase by 8.
5. Refresh the page and confirm level, HP, and history-derived behavior persisted.
6. Level down to 1 and confirm maximum HP returns to its prior value, current HP does not exceed it, and no random roll occurs.

### Damage preservation

1. On a level-2 test character, reduce current HP below the post-level-down maximum.
2. Level down.
3. Confirm current HP is preserved rather than healed or reduced again.
4. If practical, verify 0 HP stays 0.

### Rolled HP

1. Use rolled advancement on a disposable character.
2. Confirm exactly one roll produces exactly one stored increase.
3. Refresh, then level down and confirm the same gain is removed.

### Manual HP

1. Use manual advancement and enter a known gain.
2. Refresh, then level down and confirm the same gain is removed.

### High-level fixed creation

1. Create a fixed-HP character above level 1.
2. Confirm creation succeeds.
3. Level down once and confirm one fixed gain is removed.

For every flow, record actual observed values in `docs/CHANGES-20.md`. If browser access is unavailable, state that limitation honestly and leave the live items marked unverified.

---

## 5. Required commands and evidence

Run from `E:\forge-and-fable` after implementation:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
git status --short
git diff -- package.json package-lock.json .github/workflows/ci.yml src/lib/hitPoints.ts src/lib/utils.ts src/components/CreatorPanel.tsx src/components/LevelUpModal.tsx src/components/HeroSheet.tsx tests docs/CHANGES-20.md
```

The final DeepSeek response must include:

- Files changed.
- Test counts and exact pass/fail status.
- Typecheck/lint/build status, including warnings.
- Live scenarios completed and exact observed HP values.
- Anything not verified.
- Remaining known limitations.
- Confirmation that nothing was committed, staged, or pushed.

---

## 6. Changelog contract

Create `docs/CHANGES-20.md` with these headings:

```markdown
# Changes 20 - HP correctness, tests, and CI

## Files changed
## Behavior corrected
## Automated tests added
## Commands run and results
## Live browser verification
## Known limitations and deferred work
## Repository state for Codex review
```

Do not edit `docs/ROADMAP-1.0.md` in this implementation round. Codex will decide whether and how to update roadmap status after review.

---

## 7. Codex review gate

DeepSeek's work is not accepted merely because it builds. Codex will independently review:

1. The diff is limited to this proposal.
2. Production HP formulas are centralized rather than copied.
3. Fixed level-up contains no random path.
4. Rolled/manual histories append once and unwind once.
5. Legacy missing-history handling refuses unsafe guesses.
6. Level-down is one combined update and preserves 0/damaged current HP correctly.
7. Tests would fail if the production formula regressed.
8. CI matches the declared runtime and has hard gates.
9. Existing source, campaign, spell, feat, and sheet behavior is untouched outside the named HP path.
10. Changelog observations are supported by commands or real browser evidence.

Codex may run additional adversarial tests and request corrections before approval.
