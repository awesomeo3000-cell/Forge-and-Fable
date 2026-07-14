# Proposal 25 — DM Table server follow-ups (crew round)

Author: Fable, 2026-07-13. Scope: server + thin wiring only — no UI redesign.
Context: CHANGES-DM-8/9/10. Conventions apply: changelog entry required
("no entry = not done"), tests required, schema changes via `recordMigration`.

## 1. Withdraw an unanswered request (owner-reported)

A DM request targeting real players who never respond currently stays open
forever; the client can only hide it locally (CHANGES-DM-10).

- `PATCH /api/campaigns/[id]/requests/[requestId]` body `{ "action": "withdraw" }`.
- DM-only (campaign `dm_user_id`, 403 otherwise); only `status='open'`
  requests; sets `status='withdrawn'`, stamps `resolved_at`.
- Players must never see withdrawn requests: exclude them from the
  player-facing branch of `listCampaignRequests` (DM still sees them).
- Responding to a withdrawn request returns the existing
  "no longer open" error — verify with a test.
- UI wiring (small): a Withdraw button on open request cards in
  DMTablePanel's request center, next to the existing dismiss.

## 2. Ghost combatants must not reach player initiative projections (DM-9 #2)

Ghost members are hidden from players, but ghost COMBATANTS (kind "player",
default name-only visibility) pass the projection at
`src/lib/campaignStore.ts` (~line 325) — real players would see
"Rehearsal Fighter" rows while a DM rehearses in a live campaign.

- In the non-DM initiative projection, drop combatants whose `memberUserId`
  belongs to a member with `is_ghost=1`.
- Test: seat ghosts + roll ghost initiative in a campaign that also has a
  real player; assert the player's `syncCampaign` initiative contains no
  ghost entries while the DM's does.

## 3. Loot parcels: unassign ghosts on clear (DM-9 #4)

`clearRehearsalParty` deletes ghost users but leaves parcel items with
`assignedUserId` pointing at deleted ids (status "offered"/"accepted").

- Inside the clear transaction, rewrite affected parcels: ghost-assigned
  items revert to `status:'unclaimed'` with `assignedUserId` removed;
  recompute parcel status.
- Test: offer loot to a ghost, clear, assert the item is unclaimed.

## 4. Optional (low priority): server-truth ghost presence

CHANGES-DM-10 treats ghosts as present client-side. If a second surface
ever consumes presence, stamp `campaign_presence` rows (state "connected")
for ghosts at seat time and refresh them on the presence-read path instead.
Skip if you cannot do it without touching the presence polling contract.

## Acceptance

- `npm run build` clean, `npm test` green, new tests for 1–3.
- Changelog: CHANGES-DM-11.
- Do not touch: token remaps in `.dm-table` (see the comment block at
  globals.css ~12630), rehearsal auto-responder timing, projection shapes
  beyond the ghost filter.
