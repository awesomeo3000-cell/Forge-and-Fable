# CHANGES-27 — Pre-session DM tools

Implemented the first usable pre-session campaign-preparation workflow from
`ai-project-proposal-pre-session-dm-tools.md`. This round extends the existing
Campaigns v2 Table, initiative, event feed, and permissions model; it does not
create a parallel campaign runtime.

## Delivered

- **Creature library:** eight immutable built-in SRD starter creatures plus
  campaign or personal custom records; search/filter, create, edit, duplicate,
  and archive; DM notes are removed from player projections.
- **Saved encounters:** reusable draft/ready encounters with creature
  quantities, HP and initiative modes, visibility, notes, reminders, linked
  handouts, staged waves, duplicate/delete, and immutable start snapshots.
- **Encounter generator:** deterministic seed-based generation, 2014 DMG XP
  threshold budgets, environment/type filters, party-derived profile, and
  one-hit, action-economy, flight/range, area-damage, and control warnings.
  Generated results enter the normal encounter editor before use.
- **Campaign assets:** reusable text/image/document/link handouts with explicit
  sharing and re-sharing, plus private or player-visible journal entries.
- **Session lifecycle:** start/end session, pin record or scene-note items,
  deterministic summary draft, review/edit/save, and publish as a player-visible
  journal recap.
- **The Table integration:** Prepare opens the workshop; active sessions and
  encounters are visible in context; read-aloud state, reminders, handout
  reveal, reinforcement activation, encounter ending, and per-enemy visibility
  are available without leaving the Table.
- **Player campaign memory:** players see only shared handouts, published
  journal entries/recaps, active-session identity, and the allowed enemy
  projection. Hidden/private encounter material remains server-side.

## Persistence and API

Schema revision **5** adds `creature_library`, `saved_encounters`,
`campaign_handouts`, `campaign_journal_entries`, `campaign_sessions`,
`session_pins`, and `encounter_runs`, with campaign/owner/status indexes and a
migration-ledger entry. Existing databases adopt the tables through normal
startup schema application.

New route groups are `/api/creatures`, `/api/encounters`, and campaign-scoped
`handouts`, `journal`, `sessions`, `workspace`, `memory`, and `encounter-runs`.
All mutating campaign preparation routes enforce DM ownership in the store;
player reads use explicit projections rather than relying on UI hiding.

Starting an encounter copies the saved encounter into `encounter_runs`, then
initializes the existing versioned `campaign_initiative` state. Later edits to
the template therefore cannot rewrite the active encounter. Wave activation
appends its snapshotted combatants in a transaction and versions initiative.

## Main files

- `src/components/DMPrepPanel.tsx`
- `src/components/DMTablePanel.tsx`
- `src/components/CampaignMemoryPanel.tsx`
- `src/lib/dmToolsStore.ts`
- `src/lib/encounterGenerator.ts`
- `src/lib/builtInCreatures.ts`
- `src/lib/client/dmToolsApi.ts`
- `src/types/dmTools.ts`
- `src/app/api/creatures/**`
- `src/app/api/encounters/**`
- `src/app/api/campaigns/[id]/{handouts,journal,sessions,workspace,memory,encounter-runs}/**`

## Verification

- `npm test`: **129/129 passed** across 12 files.
- `npm run lint:ci`: passed with zero warnings.
- `npm run typecheck`: passed.
- `npm run build`: passed; Next.js discovered all new dynamic routes.
- Regression coverage includes seeded generation and budgets, warning output,
  DM/player authorization, encounter snapshot startup, wave activation,
  duplicate-wave rejection, player memory, session summary publishing, hidden
  enemies, approximate-health projection, and exact HP/AC/stat-block privacy.

## Limits and deferred proposal items

This is a **broad MVP, not full completion of every advanced proposal detail**.

- The custom creature editor is compact; full ability-score, action-builder,
  spellcasting, legendary-action, and complete bestiary-import tooling remain.
- The data model and live Table support staged waves, but the preparation UI
  does not yet provide a polished visual wave authoring/assignment flow.
- Reminders are context-matched to encounter/round/turn/initiative state and can
  be completed, snoozed, and recorded; push toasts and a persisted one-shot
  firing history are not yet implemented.
- Generator locking, partial regeneration, detailed composition-pattern
  controls, and richer party-capability inference remain future refinement.
- Handout edit/duplicate and journal cross-link/deep-link controls are limited;
  core create/share/archive and publish workflows are present.
- A two-profile browser smoke test and responsive screenshot pass remain
  required. This execution environment was blocked by policy from opening
  `localhost:3000`, so no visual or live multi-user claim is made here.
- SQLite still emits Node's experimental-module warning during tests/build;
  behavior is covered, but the runtime warning remains an operational caveat.

No checkpoint commit was created: the worktree already contained owner changes,
and combining them into an agent-authored commit would make provenance and
rollback less reliable.

## Follow-up: formatting normalization (reviewer, 2026-07-11)

The round shipped functional but written in an aggressively minified style
(one 600-char line in `dmToolsStore.ts`, ~400-char JSX lines in
`DMPrepPanel.tsx`) — a maintainability hazard for a project handed between
sessions. Reformatted mechanically with Prettier, tuned to the house style
observed in clean files (`printWidth 120`, `arrowParens always`,
`trailingComma all`, double quotes, semicolons):

- `src/lib/dmToolsStore.ts`: 177 → 1263 lines.
- `src/components/DMPrepPanel.tsx`: 61 → 1332 lines.
- Only remaining >160-char lines are inline SQL string literals, which
  Prettier correctly leaves whole.

**Zero logic change** — formatting only, proven by the unchanged suite:
`npm test` 129/129, `npm run typecheck`, `npm run lint:ci` (0 warnings), and
`npm run build` all green after. Prettier was NOT added as a project
dependency; it was invoked one-off via `npx`. Next: the UX design pass on
`DMPrepPanel` (ledger material + three-face type system).
