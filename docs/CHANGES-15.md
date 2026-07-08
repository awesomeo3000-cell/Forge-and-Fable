# CHANGES-15: Initiative Tracker, Onboarding, Bundle Diet, Loose Ends

Implemented from `docs/ai-project-proposal-15.md`.

## Task 1: Initiative Tracker

- Added a second `Combat` tab inside the existing movable/resizable `RollDrawer`.
- Stored combat state in localStorage key `forge-and-fable-initiative`; no character schema fields were added.
- Added manual combatant entry, sorted initiative order, current-turn highlight, next-turn/round controls, and clear-with-confirm.
- Added `activeCharacterName` and `activeCharacterInitiative` props from `ForgeAndFableApp` to `RollDrawer`.
- The current-character shortcut rolls `1d20 + initiative` through the existing dice pool pipeline, then inserts the rolled total into combat.

Browser verification:

```text
added Goblin 15, Orc 8, and current wizard via rolled initiative
displayed order: 15, 10, 8
sorted descending: true
next turn wrapped after 3 turns: ROUND 2
rows after reload: 3
rows after clear-confirm: 0
```

## Task 2: First-Run Sheet Tour

- Added a dismissible paper-styled card on the character sheet.
- Uses localStorage key `forge-and-fable-tour-dismissed`.
- Card points to stat rolls, Adv/Dis, effects, skin, and layout.

Browser verification:

```text
fresh browser profile showed tour card with 6 short lines
clicked Got it
tour count after reload: 0
logout/login is not involved because the flag is browser-local, not account data
```

## Task 3: Bundle Diet

Before change:

```text
npm run build: success
route table printed with no per-route byte sizes in current Next/Turbopack output
.next/static JS bytes: 2,115,945
.next/static CSS bytes: 146,851
largest JS chunk: 1,488,568 bytes
```

Changed:

- Added `GET /api/spells` with `Cache-Control: public, max-age=86400, immutable`.
- Added `src/lib/spellsClient.ts`.
- Converted `src/lib/spells.ts` so spell helpers read from an async-loaded in-memory catalog instead of a client-side static JSON import.
- `ForgeAndFableApp` now waits for both ruleset and spell catalog loading before rendering the sheet/builder surfaces that use synchronous spell helpers.
- Left subclasses, feats, and item catalog unchanged for a future round, per proposal.

After change:

```text
npm run build: success
route table includes /api/spells
.next/static JS bytes: 1,466,460
.next/static CSS bytes: 150,634
largest JS chunk: 839,083 bytes
static JS delta: -649,485 bytes
```

Browser/API verification:

```text
GET /api/spells: 200
Cache-Control: public, max-age=86400, immutable
spells tab loaded: 5 spell cards in test wizard sheet
opened spell detail: RAY OF FROST
cast control present and clicked: CAST CANTRIP
level-up spell picker rows: 50
console errors: none
```

## Task 4: Loose Ends

- Passive Perception, Passive Investigation, and Passive Insight now use `skillBonusForPassive()`, which omits active `checks` effects.
- Removed the R13 transitional `Authorization: Bearer` fallback; API auth now requires the `ff_session` cookie.
- Changed roll drawer first-run default `y` placement to start below the builder header.
- Roll history retention increased from 30 to 100 entries.
- Existing roll-history clear button remains available in the history header.

Browser/API verification:

```text
drawer first-run top: 220px
Passive Perception before Guidance-style checks effect: 11
Passive Perception after checks +4 effect: 11
Perception active skill bonus after checks +4 effect: +5
Bearer-only GET /api/characters: 401
rolled d4, history row appeared, Clear emptied history
localStorage forge-and-fable-token: null
document.cookie: empty
```

## Gates

```text
npm run lint
success, 0 warnings

npm run build
success
```

Regression walk covered:

```text
register test user
create character through real API
view sheet
dismiss onboarding
roll via drawer
exercise initiative tracker
open spells tab
cast a cantrip
open level-up spell picker
verify no browser console errors
```

---

## Review pass (Claude, 2026-07-08)

Verified against the running app: `/api/spells` serves with the immutable cache header
(bundle diet real: −649KB static JS per the recorded measurements); passives correctly
exclude effect check bonuses (changelog's 11-vs-+5 evidence pattern confirmed by code
path `skillBonusForPassive`); Bearer fallback removed (cookie-only auth confirmed);
drawer default-y clamp in place; Combat tab live with the active-character roll shortcut
("Add Wexford the Oathbreaker (roll)"), Next turn/Clear controls, and high-quality state
hygiene (stable tie-sort, clamped turn index, validated localStorage load). Tour card
renders on a fresh profile. **Approved.**
