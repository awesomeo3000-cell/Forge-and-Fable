# CHANGES-DM-9 — Rehearsal Party (ghost players the server plays)

Date: 2026-07-13
Round: DM rehearsal mode, implemented alongside Round Two (CHANGES-DM-8).
This entry was written during Fable's review — the implementing crew shipped
the feature without a changelog; the convention is "no entry = not done."

## What it is

"Test the table": a DM-only control seats four ghost players (premade
archetypes via `buildQuickDraft`) so a DM can rehearse every flow before a
real session. Ghosts are REAL rows: real users (unloggable — bcrypt can never
verify their `rehearsal-only` sentinel hash), real characters, real
`campaign_members` flagged `is_ghost=1` (schema revision 13).

## How the server plays them

`src/lib/dmTable/rehearsal.ts`:
- **Roll/rest requests** (`scheduleRehearsalRequest`, wired into
  `createCampaignRequest`): ~2.5s after a request targets a ghost, the server
  answers with the ghost's actual sheet — race/feat-adjusted abilities, save
  and skill proficiencies incl. background skills — honoring the DM's
  advantage/disadvantage combined with the ghost's own condition effects via
  `combineRollModes` + `effectiveAdvantageMode`. Initiative results are also
  seated into the tracker. Rests apply real recovery to the ghost sheet.
- **Targeted events** (`scheduleRehearsalEvent`, wired into
  `postCampaignEvent`): conditions apply/remove as DM-sourced effects,
  concentration ends, death saves update, offered loot is accepted into the
  ghost's inventory.
- Ghost work is best-effort by design: `setTimeout` + swallow — a rehearsal
  responder must never break the DM's request path. (Consequence: a server
  restart inside the 2.5s window drops that one response.)

## Privacy / safety

- Players never see ghosts: `listMembers` filters `is_ghost` for non-DM
  viewers; ghost rolls are excluded from player feeds in SQL;
  `CampaignMemberSummary.isGhost` is stamped only for the DM.
- Seat/clear are DM-only, enforced in the store (403), not just the UI.
- `clearRehearsalParty` is one transaction: prunes ghost ids from request
  targets (deleting requests that only targeted ghosts), deletes their
  responses, targeted events, rolls, presence, initiative combatants (with
  turnIndex clamp), members, characters, users.

## Tests

`tests/rehearsalParty.test.ts`: seating + player-invisibility, tracked roll
answered from the real sheet (advantage path) completing the request, and
full clear. Schema tests updated to revision 13.

## Review findings (Fable) — dispatched as follows

1. Ghost presence never written → rail showed "disconnected" ×4 and spawned
   permanent "needs attention" alerts. → fixed client-side in CHANGES-DM-10.
2. Ghost names leak into the player-side initiative tracker when rehearsing
   with real players enrolled. → crew follow-up (ai-project-proposal-25).
3. Duplicate reminder surfaces in Encounter mode. → fixed in CHANGES-DM-10.
4. Loot parcels keep a dangling `assignedUserId` after clear. → crew
   follow-up (ai-project-proposal-25).
5. Ship-time verification gap (tooling outage): resolved — `npm run build`
   clean and 252/252 tests green as of CHANGES-DM-10.
