# CHANGES-25 — Encounter combatant model expansion

Expands the shared-initiative combatant model from the minimal `InitiativeCombatant`
(type-kind-name-init) to a richer `CampaignCombatant` that supports the full Table
encounter needs: combatant kinds, HP/AC/temp HP, conditions, stat blocks,
concentration, defeat state, and DM-private notes.

## What changed

### Types (`src/types/campaign.ts`)
- **`CampaignCombatant`** — new type replacing `InitiativeCombatant`. Adds `kind`
  (`"player" | "ally" | "enemy" | "neutral"`), flat `currentHp`/`maxHp`/`tempHp`
  (replacing the old nested `hp: { current, max }`), `memberUserId`/`characterId`
  player references, `defeated`, `concentratingOn`, `conditions`,
  `privateNote` (replaces `note`), and `statBlock` (speed/saves/senses/
  resistances/immunities/vulnerabilities).
- **`CampaignCombatantCondition`** — lightweight per-combatant condition marker
  (`{ id, label, advantageMode?, stack? }`). Display/tracking aid for the DM,
  not a full effects engine (player conditions still flow through the DM-event
  → owning-client pipeline).
- `InitiativeCombatant` is now a deprecated type alias for `CampaignCombatant`.
- `InitiativeState.combatants` updated to `CampaignCombatant[]`.

### Server-side validation (`src/lib/campaignStore.ts`)
- **`clampCombatant`** (new) — validates and clamps every field of the new type
  with the same bounds used throughout the store (init -99..99, HP 0-9999,
  AC 0-99, labels sliced to 48, private notes to 200, conditions capped at 20).
- **Backward-compat migration**: old-format combatants with `isPlayer: true` are
  normalized to `kind: "player"`; old `hp: { current, max }` is mapped to
  `currentHp`/`maxHp`; old `note` is mapped to `privateNote`. Existing campaigns
  upgrade transparently on first read — no manual DB migration needed.
- **`rollCampaignInitiative`** — now stores `kind: "player"`, `memberUserId`,
  and `characterId` (from the membership row) instead of the old `isPlayer` flag.
- **`visibleInitiative`** — strips `privateNote` and `conditions` from the
  player-facing sync payload (DM-only data never shipped to non-DM members).

### Client components
- **`DMTablePanel.tsx`** — `addCombatant` now includes a `kind` selector
  (Enemy / Ally / Neutral) in the add form. HP editing uses flat `currentHp`.
  Player combatant rows show HP/AC from the member summary (read-only); NPC
  rows are editable. Kind is shown as a color-coded chip (⚔ enemy, ✦ ally,
  ○ neutral, ● player). `Defeated` and `concentratingOn` are displayed when
  present. Conditions render as inline chips.
- **`RollDrawer.tsx`** — local initiative tracker updated from `isPlayer` to
  `kind`. Backward-compat for localStorage reads (old `isPlayer` data).
- **`ForgeAndFableApp.tsx`** — no functional changes; `player:<userId>` ID
  convention and "your turn" detection unchanged.

### Tests (`tests/campaignV2.test.ts`)
- Combatant objects updated from old `hp: { current, max }` / no `kind` to
  new `currentHp`/`maxHp`/`kind: "enemy"`.
- New assertions: `privateNote` and `conditions` survive the DM sync roundtrip
  but are **undefined** in the player sync payload (privacy gate).

## Design decisions
- **Single source of truth** — combatants live only in `InitiativeState.combatants`
  (no separate encounter array that can drift).
- **Player HP/AC are derived**, not stored in the encounter — the encounter
  stores `memberUserId`/`characterId` references; the DM panel looks up live
  HP/AC from `campaign.members` (computed from the character sheet). The DM
  cannot edit player HP from the tracker.
- **NPC state persists** — NPC HP/AC/conditions live in the versioned encounter
  JSON and are written through `updateCampaignInitiative`, so they survive
  browser refresh.
- **Lightweight conditions** — `CampaignCombatantCondition` carries label +
  optional advantage mode and stack level. It is a DM display/tracking aid, not
  a full effects engine re-implementation.

## Verification
- `npm test` — 122/122 passed (campaign v2 test extended with privacy assertions)
- `npm run lint` — 0 errors, 0 warnings
- `npm run build` — clean
- API test: backward-compat normalization verified (old `isPlayer`/nested `hp`
  combatants upgrade correctly on PUT; new fields roundtrip through
  `clampInitiativeState`)
- Source inspection: every `isPlayer` reference updated to `kind`; every
  `item.hp.current` updated to `item.currentHp`
