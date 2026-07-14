# CHANGES-AO-5 — Campaign dashboard composition (production plan Phase 2)

Date: 2026-07-14. Author: Fable.
Spec: `docs/design/arcane-observatory/implementation-plan.md` §7 as amended
by `plan-reconciliation.md` (no parchment; repo fonts; single-route app —
the "dashboard" is CampaignPanel's list view, which is the campaign home).

## Summary

The campaign list is now a small dashboard answering the plan's four
questions: the current campaign (fallback: first listed) renders as the
dominant feature — gold top rule, display-type name, DM/Player role chip,
member count, join code — with the screen's ONE primary action ("Open the
Table" for DMs, "Resume campaign" for players). Other campaigns remain
supporting cards (structured rows, hover + arcane-blue affordance,
keyboard focus). New Campaign / Join demoted to secondary. Intentional
empty state added. `dj-btn` (shared workflow button: campaigns + creator
footers) aligned app-wide to the AO control recipe; `.campaign-card`,
code badges, group headings restyled.

## Files changed

- `src/components/CampaignPanel.tsx` — list view restructured (feature
  section + filtered groups); New/Join buttons `dj-btn-primary` → `dj-btn`.
- `src/app/arcane-observatory.css` — dashboard block (`ao-dash-*`,
  `.campaign-card`/badge/group, `dj-btn` recipe).
- `QA/screenshots/ao-baseline/P5-dashboard-*.png`, `tmp/shot-dash.mjs`.

## Behavior preserved

Same `handleSelect` for featured and cards (sync + open unchanged);
create/join flows untouched (only button class); active-campaign view,
events, roll responses, rest/loot handling untouched. No API changes.
Per plan §7.4: no next-session panel or per-campaign activity was
invented — that data does not exist in `CampaignSummary`.

## Tests / verification

`npm run build` ✓ · `npm test` 264 ✓ · `npm run lint` 0 errors ✓.
Screenshots at 1440x900 + 390x844 with 3 campaigns (featured + 2 cards)
and the empty state (fresh-user path). Note: the review DB now contains
owner-created data ("test" bard, "ddd" campaign) plus my seeds
("The Sunken Vault", "The Hollow Orrery" under r18-review@test.local).

## Risks / open items

- Featured selection uses `activeCampaignId` (client-side last-active);
  with none stored it falls back to list order (creation order) — "MOST
  RECENT CAMPAIGN" eyebrow covers both cases honestly.
- The dashboard still lives inside the Campaigns modal; promoting it to a
  logged-in landing surface (plan §6 nav rail: Dashboard/Forge/Hero/
  Table) is a bigger IA change — flagged for the Gate 3 conversation.

## Rollback

Revert the AO-5 commit.
