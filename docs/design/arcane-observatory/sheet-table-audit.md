# Deep audits required by plan §3.4 / §3.5 — modular sheet & Table

Date: 2026-07-14. Author: Fable. Supplements `docs/arcane-observatory-audit.md`
(Gate 1). Read `plan-reconciliation.md` first.

## §3.4 Modular character sheet

- **Canvas library: none — custom column system.** No react-grid-layout /
  dnd-kit grid on the sheet. `SheetLayout` (src/types/game.ts) is:
  `columns: string[][]` (module-container ids per column), `modules:
  SheetModule[]` (tabbed containers: `{id, tabs: SheetSectionId[], title?,
  tabTitles?}`), `collapsed`, `hidden`, `columnWidths` (percentages),
  `customTitles`, `version`, legacy `mergedSections` (v2 migration only).
- **Serialization:** stored per character as `character.sheetLayout`;
  loaded through `mergeWithDefaults()` (src/lib/sheetLayout.ts) which
  tolerates missing/unknown fields — old layouts already load through a
  forgiving merge. Saves are debounced from HeroSheet local state
  (`saveLayout`, ~line 1034) via the normal character PATCH; no dedicated
  layout API.
- **Drag implementation:** HTML5-drag of section tabs/containers between
  columns and into tab groups (`moveSheetTab`); column widths adjusted via
  percentage `columnWidths`. "Resize" = column percentages, not per-module
  pixels.
- **Edit vs play:** `cs-editing` class on the sheet root toggles edit
  affordances; layout menu behind the LAYOUT button (`showLayoutMenu`).
- **THE key fact for the masthead phase:** `identity` and `vitals` are
  `PINNED_TOP` and `console` is `PINNED_BOTTOM` (src/lib/sheetLayout.ts) —
  pinned sections render OUTSIDE the draggable columns and are excluded
  from `columns`. **The identity masthead can therefore be rebuilt freely
  without touching saved grid data** — plan §9.2's requirement is already
  the architecture. HP/vitals callbacks flow through existing section
  components; the masthead must reuse them (plan §9.3).
- **Risks:** module chrome is per-section markup inside SheetSection.tsx +
  `cs-*` CSS (409 class uses); minified JSX regions exist; skins apply
  inline vars on `.cs-sheet` (AO-4: skins win over theme defaults —
  preserve). `data-bg` texture patterns are var-driven and safe.

## §3.5 Table

- **State owner:** server. `CampaignSyncPayload` (src/types/campaign.ts)
  carries campaign, members, combatants (`CampaignCombatant`), initiative
  (`InitiativeState`), events (`CampaignEvent[]`); DM-only fields are
  projected out for players server-side (src/lib/campaignStore.ts) — the
  ghost-combatant filter is proposal 25 §2 (still unclaimed).
- **Panel-local UI state** (DMTablePanel.tsx): `workspaceMode:
  "encounter" | "party" | "tools"` (`DmWorkspaceMode` from
  src/lib/dmTable/party.ts), add-combatant form, roll-request form
  (`rollKind: initiative|save|check`), track CRUD fields.
- **Feed:** `records` = merged campaign rolls + events (~line 271);
  `encounterLog` (DM-12, src/lib/dmTable/encounterLog.ts) derives the
  capped, grouped, encounter-scoped ledger from it. Live Ledger phase 5B
  is largely BUILT — remaining work is AO re-skin + any grouping polish.
- **Initiative:** DM-11 (src/lib/dmTable/initiative.ts) already
  implements adaptive density + state grammar via
  `dm-state-marker[data-state]` — the AO state grammar must map onto it,
  not replace it.
- **Sound:** `CampaignTrack` CRUD (campaignApi: list/add/delete,
  `updateCampaignAudio`) — audio state is campaign-level (continuity
  preserved across mode changes server-side). Sound dock (5C) = new
  presentation over these calls; track management already lives toward
  Tools.
- **Portraits:** combatants have member links (`memberUserId`) →
  CharacterPortrait; enemies have kind glyphs (DM-11), no portraits.
- **Landmines:** `.dm-table` legacy token remap (~globals 12630);
  `--dm-*` tokens only for new DM CSS; `>button:first-child` gray-slab
  trap; append-only eras; view-preset system deleted in DM-8 — do not
  reintroduce.
