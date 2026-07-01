# Forge & Fable — Bug Fix & Hardening Proposal

**Audience:** An AI coding assistant executing this work.
**Repo root:** `E:\forge-and-fable`
**Do not start coding until you have read the "Ground Rules" and "Project Map" sections.**

---

## 1. Project Overview

Forge & Fable is a local-first D&D 5e character builder built with **Next.js 16 (App Router), React 19, and TypeScript**. It has:

- A login/register "vault" (bcryptjs password hashing, JWT via `jose`, users and characters persisted to a single JSON file at `data/forge-vault.json` — no database).
- A five-step character creation wizard (point-buy / standard array / rolled stats).
- An interactive character sheet (HP, AC, saves, skills, spell slots, dice rolling overlay, drag-and-drop layout via dnd-kit, per-character theming).
- A level-up wizard (HP roll, subclass choice, ASI/feat choice, spell learning).
- Static game data in `src/data/*.json` (spells, feats, subclasses) plus a hardcoded ruleset in `src/lib/ruleset.ts` served from `/api/ruleset`.

The app works today. This proposal fixes known bugs and hardens weak spots. **It is not a rewrite.**

## 2. Ground Rules

1. **Make the smallest change that fixes each item.** Do not reformat files, rename variables, reorder imports, or "clean up" code you are not asked to touch.
2. **Do not add any npm dependencies.** Everything here is doable with what is installed.
3. **Do not change the visual design, CSS, or copy/wording** unless a task explicitly says so.
4. **Preserve existing data compatibility.** Characters already saved in `data/forge-vault.json` must still load. Never remove or rename fields on the `Character` type; only add optional fields.
5. **Match the surrounding code style** (existing naming, error-handling patterns, comment density).
6. **After every task**, run:
   ```bash
   npm run lint
   npm run build
   ```
   Both must pass before moving to the next task.
7. Work through tasks **in order**. Phase 1 and 2 tasks are required. Phase 3 is optional — skip it entirely rather than doing it halfway.
8. If a task's description conflicts with what you find in the code, stop and flag the discrepancy in your summary instead of guessing.

## 3. Project Map

```
src/
  app/
    api/auth/login/route.ts       POST login → { user, token }
    api/auth/register/route.ts    POST register → { user, token }
    api/characters/route.ts       GET list, POST create
    api/characters/[id]/route.ts  GET/PUT/DELETE one character (PUT has a field allowlist)
    api/ruleset/route.ts          GET static ruleset
    page.tsx / layout.tsx / globals.css (~4,400 lines, single file)
  components/
    ForgeAndFableApp.tsx   Root client component: auth state, character CRUD, dice, console (~705 lines)
    HeroSheet.tsx          The character sheet (~649 lines, big sectionContent() switch)
    LevelUpModal.tsx       Level-up wizard (~298 lines)
    CreatorPanel.tsx       Character creation wizard
    AuthScreen.tsx, DiceRollOverlay.tsx, others
  lib/
    auth.ts          JWT sign/verify, authenticateRequest(), AuthError
    vaultStore.ts    JSON-file persistence (users + characters)
    utils.ts         Ability math, point-buy costs, characterPayload()
    featBonuses.ts   computeFeatBonuses(): turns asiChoices into stat/AC/initiative bonuses
    spellSlots.ts    maxSlots(casterType, level)
    feats.ts / spells.ts / subclasses.ts   Typed accessors over src/data/*.json
    ruleset.ts       Hardcoded classes/races/features (~1,359 lines)
  types/game.ts      All shared types (Character, ASIChoice, Feat, SpellData, ...)
  data/              spells.json, feats.json, subclasses.json, dnd-master-data.json
```

Key domain facts:

- `Character.asiChoices` is an array of `{ type: "asi", level, increases }` or `{ type: "feat", level, featId }` entries recorded at level-up.
- `computeFeatBonuses(asiChoices)` in `src/lib/featBonuses.ts` is the **single place** that converts those choices into ability increases (it already applies +1 per ability for feats with `fixedAbility`, and +1 to the first listed ability for `chooseAbility` feats).
- Feats in `src/data/feats.json` have `abilityBonuses: AbilityKey[]`, plus boolean `fixedAbility` and `chooseAbility` flags.
- Caster types are `"full" | "half" | "pact" | "none"` (`heroClass.casterType`).

---

## Phase 1 — Bug Fixes (required)

### Task 1.1 — Half-feats double-count ability score increases

**File:** `src/components/LevelUpModal.tsx`, inside the `finish()` function (~lines 152–182).

**Bug:** When the player picks a feat (not "asi"), the code pushes a `{ type: "feat", featId }` choice **and also** pushes a synthetic `{ type: "asi", increases }` choice containing +1 for every ability in `feat.abilityBonuses`. But `computeFeatBonuses()` in `src/lib/featBonuses.ts` **already** grants the feat's ability bonuses when it processes the `feat` entry. Result: the Actor feat gives +2 CHA instead of +1. For choose-one feats like Athlete (`abilityBonuses: ["strength","dexterity"]`, `chooseAbility: true`), the modal grants +1 to **both** abilities while `computeFeatBonuses` adds another +1 to the first — +2 STR / +1 DEX from a feat that should grant +1 to one ability.

**Fix:** In `finish()`, delete the block that builds and pushes the synthetic `asi` choice for a picked feat (the block commented `// a half-feat that also raises an ability applies that bump too`). Keep the `{ type: "feat", ... }` push. `computeFeatBonuses` remains the sole owner of feat ability bonuses.

**Explicitly out of scope:** adding a UI for choosing which ability a `chooseAbility` feat boosts. Defaulting to the first listed ability (current `computeFeatBonuses` behavior) stays as-is.

**Acceptance criteria:**
- Picking a fixed-ability feat (e.g. Actor) at an ASI level results in exactly **one** new entry in `asiChoices` (the feat entry) and the sheet shows +1 to that ability.
- Picking plain "Ability Score Improvement" still works unchanged (its `asi` entry is still pushed).
- Existing saved characters still load (you changed write behavior only, not read behavior).

### Task 1.2 — Half-caster spell slots use the wrong formula

**File:** `src/lib/spellSlots.ts`, `maxSlots()` (~line 19).

**Bug:** `const effectiveLevel = casterType === "half" ? Math.floor(level / 2) : level;` — `floor` is the *multiclass* rule. Single-class half-casters (paladin/ranger) follow their class table, which equals the full-caster table at `ceil(level / 2)`, **except** level 1, which has no slots. Today a level 3 paladin shows 2 first-level slots (PHB says 3), and level 5 shows 3/0 (PHB says 4/2).

**Fix:** For `casterType === "half"`: if `level < 2`, return no slots; otherwise use `Math.ceil(level / 2)` as the effective level. Leave `full` and `pact` logic untouched.

**Acceptance criteria (half-caster slots by level):**
| Level | Slots |
|---|---|
| 1 | none |
| 2 | 2× 1st |
| 3 | 3× 1st |
| 5 | 4× 1st, 2× 2nd |
| 9 | 4× 1st, 3× 2nd, 2× 3rd |

The existing cap keeping half-casters at spell level ≤ 5 must still hold at level 20.

### Task 1.3 — Level-down button is an infinite-HP exploit

**File:** `src/components/HeroSheet.tsx`, the identity section's minus stepper (~line 364).

**Bug:** The minus button only does `props.onUpdate({ level: level - 1 })`. HP gained at level-up, `hpRolls`, and `asiChoices` are not reverted. Cycle down/up repeatedly to farm max HP.

**Fix:** Make level-down actually unwind the last level, using data already on the character:
- New level = `level - 1` (floor at 1).
- If `hpRolls` has an entry for the level being removed (the array is appended to on each level-up), pop the **last** entry and subtract that amount from both `maxHp` and `currentHp` (clamp `currentHp` to ≥ 1 and `maxHp` to ≥ 1).
- Remove any `asiChoices` entries whose `level` equals the level being removed.
- If the character's `subclassId` was gained at a level now above the new level (compare against `heroClass.subclassLevel`, default 3), clear `subclassId`.
- Do all of this in **one** `props.onUpdate({...})` call.

Wrap the action in a `window.confirm("Revert to level N? This undoes the HP, feat, and subclass gains from the removed level.")` so it can't be fat-fingered.

**Acceptance criteria:** Level up from 3→4 (roll HP, pick a feat), then level down. Level, maxHp, currentHp, asiChoices, and hpRolls are all back to their level-3 values. Repeating up/down cycles does not drift HP upward.

### Task 1.4 — POST /api/characters accepts arbitrary unvalidated JSON

**Files:** `src/app/api/characters/route.ts` (POST handler), `src/app/api/characters/[id]/route.ts` (reference for the existing pattern).

**Bug:** POST casts `await request.json()` straight to the `Character` type with zero runtime checks. Anyone with a token can store arbitrary payloads (`level: 9999`, `maxHp: "cat"`, unknown fields, megabyte blobs).

**Fix:** Add a `validateCharacterInput(raw: unknown)` function (put it in `src/lib/vaultStore.ts` or a new `src/lib/validateCharacter.ts`) and call it in the POST handler before `createCharacter`. It must:
- Reject non-object bodies and any field not in the PUT handler's `ALLOWED_PATCH_FIELDS` set (reuse/export that set — do not duplicate the list).
- Enforce basic types and ranges: `name` is a non-empty string ≤ 100 chars; `level` is an integer 1–20; `currentHp`/`maxHp`/`tempHp` are integers 0–999 (`maxHp` ≥ 1); each of the six `abilities` values is an integer 1–30; `inventory`, `spellsKnown`, `customRules`, `skillProficiencies` are arrays if present.
- On failure, throw an `Error` with a human-readable message (the route's existing catch already turns thrown errors into a 400 JSON response).

Also apply the same value checks to PUT: after the existing `sanitizePatch`, validate any of the above fields that are present in the patch.

**Acceptance criteria:** Creating a character through the normal UI still works. `POST /api/characters` with `{"level": 9999}` or `{"maxHp": "cat", "name": "x"}` returns 400 with an error message. Unknown fields are rejected on both POST and PUT.

### Task 1.5 — Expired/corrupt sessions dead-end the app

**File:** `src/components/ForgeAndFableApp.tsx`.

**Bug A:** `JSON.parse(storedUser)` (~line 99) has no try/catch — a corrupt localStorage value crashes the app on every load.
**Bug B:** JWTs expire after 30 days but the stored user never does. On expiry, the app restores the logged-in state, the characters fetch returns 401, and the user is stuck on an error message with no path back to login.

**Fix:**
- Wrap the `JSON.parse` in try/catch; on failure, remove both `forge-and-fable-user` and `forge-and-fable-token` keys and stay logged out.
- In the characters-fetch effect (~lines 106–143), when the response status is **401**, call the existing `logOut()` function (and set a status like "Session expired — please log in again") instead of just surfacing the error text. Keep current behavior for other errors.
- Apply the same 401 → `logOut()` handling in `createHero`, `updateSelected`, and `deleteSelected` (check `response.status === 401` before the generic error paths).

**Acceptance criteria:** Manually set `forge-and-fable-user` to `"{garbage"` in devtools → app loads to the auth screen, no crash. Manually set the token to an invalid string while "logged in" → next action returns you to the auth screen with a status message.

### Task 1.6 — Fix the ESLint error (setState directly in effect)

**File:** `src/components/ForgeAndFableApp.tsx` (~line 112).

`npm run lint` currently reports one error: `react-hooks/set-state-in-effect` for the synchronous `setIsCharactersLoading(true)` at the top of the characters-fetch effect. Restructure so lint passes without disabling the rule — the simplest compliant approach is to derive the initial loading state instead of setting it in the effect body (e.g. track `isCharactersLoading` as state that starts `false`, and set it inside the fetch promise chain's start via a microtask, or compute "loading" as `user !== null && characters === null` by making `characters` nullable). Pick whichever change is smallest while keeping the loading UX identical. While you're in the file, also remove the unused `AbilityKey` import warning in `src/lib/featBonuses.ts`.

**Acceptance criteria:** `npm run lint` exits with **0 errors**. Warning count is not higher than before.

---

## Phase 2 — Hardening (required)

### Task 2.1 — Fail fast on missing JWT secret in production

**File:** `src/lib/auth.ts` (~line 4).

The hardcoded fallback secret means anyone can forge tokens if this app is ever deployed. Keep the fallback for development, but when `process.env.NODE_ENV === "production"` and `process.env.JWT_SECRET` is unset, throw at module load with a clear message ("JWT_SECRET must be set in production."). Add one sentence to `README.md`'s Local Data section noting the env var.

### Task 2.2 — Basic login throttling

**File:** `src/app/api/auth/login/route.ts`.

Add a minimal in-memory limiter (module-level `Map<string, { count, firstAttemptAt }>` keyed by normalized email): after 10 failed attempts within 15 minutes for the same email, return 429 with a "Too many attempts, try again later" error until the window expires. Successful login clears the entry. No new dependencies; note in a comment that this is per-process and resets on restart (fine for a local app).

### Task 2.3 — Remove the accidental free item on character creation

**File:** `src/lib/utils.ts`, `characterPayload()` (~line 220).

Every new character silently receives `ruleset.items.slice(0, 1)` (a Healer's kit) in addition to class starting gear. Remove that concatenation so inventory is exactly the class's `startingGear`. (If the extra item was intentional flavor, this is the one task where you should flag rather than change — but the surrounding code suggests it's leftover.)

---

## Phase 3 — Optional refactors (only if Phases 1–2 are complete and green)

These are larger and riskier. **Do them as separate, self-contained changes, one at a time, re-running lint + build after each. If any step balloons, revert that step and stop.**

- **3.1 Split `HeroSheet.tsx`'s `sectionContent()` switch** into per-section components in a new `src/components/sheet/` folder (`VitalsSection.tsx`, `SkillsSection.tsx`, etc.), one case at a time, preserving markup and class names exactly (CSS depends on them). Pure mechanical extraction — props in, JSX out. No behavior changes.
- **3.2 Make `/api/ruleset` cacheable:** the data is static; remove `force-dynamic` and add appropriate cache headers or static generation.

Explicitly **not** in scope even for Phase 3: splitting `globals.css`, moving `ruleset.ts` data into JSON, bundle-size work, adding an armor system, renaming race→species. Those need human design decisions first.

---

## 4. Verification & Deliverables

Manual smoke test after all phases (dev server: `npm run dev`, app at http://127.0.0.1:3001 or whatever port Next picks):

1. Register a new account → create a paladin at level 1 → level up to 5 via the sheet's + button, rolling HP each time. Confirm spell slots show 4× 1st / 2× 2nd at level 5.
2. At level 4 take the Actor feat → confirm CHA rose by exactly 1.
3. Level down once → confirm HP and the feat revert; level back up → no HP drift.
4. Corrupt the localStorage user value → reload → auth screen, no crash.

**Deliverable:** the code changes plus a short `docs/CHANGES.md` summarizing, per task ID, what was changed and how it was verified. If any task was skipped or a discrepancy was found (per Ground Rule 8), say so explicitly there — do not silently omit work.
