# R16 review record — campaigns a/b/c (reviewed 2026-07-08)

**Verdict: approved with fixes.** Server/API layer approved as shipped; client push chain required four fixes (applied during review by the reviewer, not the implementer).

## What was verified working (two-session adversarial test)
- DM + player cookie sessions: create campaign, join by code, member listing.
- Player initiative roll POST → appears on DM's shared tracker (versioned `campaign_initiative` writes).
- Auth boundaries: player posting DM-only event → 403; non-member sync → 404; stale-version initiative PUT → 400 (spec said 409 — acceptable, noted).
- After fixes, end-to-end in the browser as the player: DM condition push applied to the ENROLLED character, effect row shows `Poisoned DIS — DM`, next save auto-rolled `d20 dis`; DM removal push cleared it; sync cursor advanced exactly through handled events; polling continues with the campaign panel closed.
- Theme inheritance: campaign panel renders in the active character's skin (verified computed styles match the Necromancer preset exactly).

## Bugs found in review and fixed (`ForgeAndFableApp.tsx`, `globals.css`)
1. **Cursor seeded to activation time** — pushes sent before the player activated were skipped forever. Now: session-memory cursor only; first sync replays full history (idempotent application).
2. **Conditions applied to the open sheet, not the enrolled character.** Now targeted via sync membership → `updateCharacterById`.
3. **Cursor advanced past unapplied events** (permanent loss). Now advances only through the handled prefix; roll timestamps advance it only when the whole batch was handled.
4. **Sync gated on the panel being open.** Now polls whenever a campaign is active (5s open / 10s closed).
5. (Post-review hardening) A non-OK sync response deactivated the campaign locally; now only 401/403/404 do — a transient 5xx no longer ejects the player.

## Owner complaints addressed
- Push messages restyled from status chip → themed toast stack (`.ff-toast-*`), skinned by the active character's theme.
- Campaign panel now consumes the `--campaign-*` theme vars it always received.

## Process findings
- `CHANGES-16b.md` claims "16c not started," but 16c (roll requests, rest calls) is fully implemented in `CampaignPanel.tsx` and verified real. No `CHANGES-16c.md` exists. The "no entry = not done" rule was violated in the surprising direction.
- The implementer's "two-browser test: pending" was accurate — that test was never run pre-review, and it is exactly where all four client bugs lived. Future campaign rounds: the two-session test is a hard gate, not a nice-to-have.

## Carried forward
- Initiative stale-write status code 400 → 409 (cosmetic, next touch of that route).
- Move `playwright` from dependencies → devDependencies.
