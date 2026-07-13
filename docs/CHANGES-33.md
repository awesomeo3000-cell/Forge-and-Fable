# Changes 33 — Character action economy

## Outcome

Character sheets now expose a complete action-economy surface instead of treating the Attacks table as the only actionable area.

- Added movable `Actions`, `Bonus Actions`, `Reactions`, and `Passive & Triggered` tabs.
- Grouped the new combat tabs with `Attacks` by default while preserving drag-out, merge, reorder, rename, hide, and saved-layout behavior.
- Migrated existing version-3 layouts to version 4 without discarding existing module or tab order.
- Added the 2014 universal action catalog, including grapple/shove as Attack-action replacements and Opportunity Attack as a reaction.
- Added class, subclass, and feat capabilities from the reviewed audit catalog, with explicit corrections and multi-activation variants where the audit's one-row-per-feature format was insufficient.
- Routed known/prepared spells by casting time: action, bonus action, reaction, or long activation.
- Removed prepared damaging spells from the physical Attacks derivation; they now live in the correct action-economy lane.
- Added a ready/used/reset reaction tracker.
- Added resource controls to capability cards when the character owns a numeric resource pool.
- Added a player-selected Lay on Hands spend amount.
- Made Wild Shape, Channel Divinity, Rage, Second Wind, Ki techniques, Bardic Inspiration, and other numeric pools available to the generic resource-spending path.

## Resource corrections

- Resolved level and ability-modifier resource formulas into numeric maximum/current values.
- Lay on Hands now resolves to `5 × paladin level` and recharges on a long rest.
- Divine Sense now resolves `1 + Charisma modifier` and recharges on a long rest.
- Paladins now receive the shared Channel Divinity pool at level 3.
- Cleric Channel Divinity resources now carry their short-or-long-rest recharge.
- Bardic Inspiration now has a separate uses pool based on Charisma, with Font of Inspiration changing its recharge.
- Existing characters missing derived resources receive a safe current-level fallback when the sheet renders; spending persists the derived resource state.

## Audit handling

DeepSeek produced 945 audit records. Structural validation passed, but semantic review found overconfidence and several incorrect single classifications. The runtime therefore does not import audit documents directly. `scripts/build-action-capability-data.mjs` produces a compact production catalog, while `src/lib/capabilities.ts` owns reviewed routing, corrections, spell derivation, and multi-activation variants.

## Compatibility repairs found during browser verification

Older review characters lacked fields that newer characters always initialize. The sheet now safely defaults missing `customRules`, `inventory`, `spellsKnown`, and `settings` values so those characters can render and migrate.

The detailed research packet set covers fewer subclasses than the selectable production catalog. Production progression now fills missing 2014 subclass packets from the descriptive subclass catalog, preserving the detailed reviewed packet whenever one exists. College of Spirits and every other selectable subclass can therefore pass through level-up and progression validation without a missing-packet error.

## Verification

- Research packet validation: passed — 25 class packets and 44 detailed subclass packets.
- Tests: 33 files, 228 tests passed.
- TypeScript: passed.
- Lint with zero warnings: passed.
- Production build: passed.
- Browser: existing Wizard and Rogue fixtures rendered; layout migration exposed all new tabs; Cunning Action appeared under Bonus Actions; Opportunity Attack appeared under Reactions; reaction ready/used/reset behavior worked; no browser console errors were recorded.
