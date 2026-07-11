# CHANGES-16c — Table extras (retroactive record, 2026-07-10)

**Status:** Implemented and reviewed; this changelog was missing at review time
(see `CHANGES-16-review.md` §"Process findings"). This entry documents code that
was verified real during the R16 review and is still present in the tree.

Implemented from `docs/ai-project-proposal-16.md` §16c.

## What changed

### Roll requests (event type `roll-request`)
- `src/types/campaign.ts` — `CampaignEventType` gains `"roll-request"`; the
  `CampaignEventPayload` union includes the `{ prompt, kind, key, dc? }` shape.
- `src/lib/campaignStore.ts` — `postCampaignEvent` accepts the type (DM-only,
  server-validated through the existing event path).
- `src/components/CampaignPanel.tsx` — DM tooling: roll-prompt input, kind
  selector (initiative / save / check / skill), ability/skill key, optional DC,
  broadcast or single-target. Non-DM members see a notification card with a
  **Roll** button.
- `src/components/ForgeAndFableApp.tsx` — `handleCampaignRollRequest` resolves
  the request against the *active character's* real modifier (ability mod +
  proficiency, skill proficiency incl. background grants, initiative bonus incl.
  feat/effect riders, save proficiency), pushes a d20 through the normal
  `pushPool` pipeline (so adv/dis effects apply), and resolves the event. When a
  DC is present, status reports pass/fail.
- `src/components/DMTablePanel.tsx` — the Table's command row carries the same
  roll-request tooling in the compact one-form-at-a-time layout (24f).

### Rest prompts (event types `rest-short` / `rest-long`)
- `src/types/campaign.ts` — both types added to `CampaignEventType`; payloads
  are empty objects (broadcast).
- `src/components/CampaignPanel.tsx` — DM buttons call short/long rest; players
  receive a notification card with an **Apply** button (never auto-applied).
- `src/components/ForgeAndFableApp.tsx` — `applyCampaignRest` runs the owning
  client's real rest logic: short rest clears pact slots; long rest restores HP
  to max, clears temp HP / spell slots / pact slots / concentration, recovers
  hit dice, and resets per-spell free-use flags. The event resolves on accept.

### Party strip
- `src/lib/campaignStore.ts` — `CampaignMemberSummary` (in `src/types/campaign.ts`)
  carries `currentHp`, `maxHp`, `ac`, `passivePerception`, `conditions`, and
  `spellSlots`; `calculateMemberSummary` derives all of these server-side from
  the enrolled character (raced abilities, AC breakdown, passive perception with
  proficiency + PB scaling, active DM/effect conditions, slot recovery).
- `src/components/CampaignPanel.tsx` — `campaign-party-strip` renders one card
  per member with HP / AC / PP and a read-only sheet link.
- `src/components/DMTablePanel.tsx` — the Table's **The Party** region renders
  the same summary as ledger rows with live HP bars (24f adds the `is-low` state
  at ≤25%).

### Initiative autopopulate (turn-order autopopulate)
- `src/app/api/campaigns/[id]/initiative/roll/route.ts` — POST endpoint for a
  player to submit their rolled initiative; `rollCampaignInitiative` in the store
  upserts a `player:<userId>` combatant, re-sorts, and preserves the current
  turn index by id.
- `src/lib/client/campaignApi.ts` — `submitCampaignInitiativeRoll` client.
- `src/components/ForgeAndFableApp.tsx` — `submitCampaignInitiativeRoll` wired to
  the sheet's initiative roll action; a DM `roll-request` of kind `initiative`
  lets the whole party roll in in one action.
- Shared initiative is versioned (`campaign_initiative.version`, 409 on stale),
  DM-owned writes only.

## Verification (carried from the R16 review)
- Two-session adversarial test (DM + player cookie sessions): roll requests
  received and answered with the character's real modifier; rest prompts
  applied only on accept; party strip HP updated within one poll; condition
  push/remove roundtrip through the owning client's save path. Full record in
  `CHANGES-16-review.md`.
- `npm test` 122/122 (this session); `npm run lint` / `npm run build` clean per
  the R24f record.

## Note
This entry exists to satisfy the "no entry = not done" rule retroactively. The
code was real at review time and remains the foundation that R24 ("The Table")
built the full-screen DM surface on top of.
