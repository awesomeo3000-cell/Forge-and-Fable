# Forge & Fable Level-Up Implementation Remaining Work

Updated: 2026-07-13

## Current state

The research layer is complete for the current scope:

- 25 edition-scoped class progression packets are present.
- 44 subclass inventory records are present.
- 44 detailed subclass packets are present: 32 for 2014 and 12 for 2024 Basic Rules.
- 2014 Artificer and its four licensed Tasha’s specialists are source-separated.
- 2024 Artificer remains intentionally policy-blocked and is not part of the production catalog.
- Structural research validation, typecheck, lint, and the full test suite are passing.
- Production currently remains strict 2014. The research packets are not yet the production level-up source of truth.

The remaining work is implementation, integration, and end-to-end verification.

## 1. Make the research packets consumable by production code

- Define shared TypeScript types for class packets, subclass packets, feature levels, choices, spell changes, resources, scaling, and parent-feature interactions.
- Add a typed loader for the reviewed packet set.
- Normalize packet IDs to the existing production IDs without losing edition scope.
- Reject missing, duplicate, mismatched, or unsupported packet references at load time.
- Keep the current 2014 production catalog working while 2024 remains research-only.
- Add a single production-facing API such as `getProgressionPacket(ruleset, classId, subclassId)`.

Acceptance criteria:

- Production code no longer needs to duplicate subclass timing or resource rules in multiple places.
- A packet cannot be loaded for the wrong class or ruleset.
- Missing research data fails clearly during validation/build rather than producing a blank level-up step.

## 2. Build the ruleset-aware progression engine

The engine must calculate the exact difference between a character’s current level and target level.

- Resolve class features granted at each level.
- Resolve subclass features granted at each level after subclass selection.
- Handle subclass levels correctly for every class in both editions.
- Handle one-level and multi-level advancement equally.
- Return automatic features separately from player choices.
- Return resource maximums, recharge rules, costs, and scaling separately from display text.
- Resolve parent-feature interactions such as Rage, Wild Shape, Focus/Ki, Channel Divinity, Bardic Inspiration, Pact Magic, and spell slots.
- Preserve mutually exclusive branches instead of granting every option in a feature group.
- Calculate proficiency bonus and new spell-slot tiers from the selected edition packet.
- Make progression deterministic and idempotent when a level-up is resumed or retried.

The engine should return a normalized result similar to:

```ts
type LevelUpPlan = {
  fromLevel: number;
  toLevel: number;
  automaticFeatures: FeatureGrant[];
  choices: LevelUpChoice[];
  resourceChanges: ResourceChange[];
  spellChanges: SpellChange[];
  warnings: string[];
};
```

## 3. Expand the character data model and persistence

The current character model stores a subclass ID but does not yet persist every choice needed by the reviewed packets.

Add edition-safe persistence for:

- Subclass feature choices.
- Fighting Style choices.
- Battle Master maneuvers and superiority-die state.
- Four Elements disciplines.
- Ranger Hunter selections at levels 3, 7, 11, and 15.
- Beast Master companion choice and companion configuration.
- Cleric domain, Paladin oath, Warlock patron, and Wizard tradition choices.
- Draconic ancestor and damage type choices.
- Artificer specialist choices, tools, models, cannons, elixirs, or defenders where applicable.
- Always-prepared, expanded-list, known-spell, and spellbook changes.
- Feature resources that are needed by the character sheet or combat systems.

Persistence requirements:

- Validate all new fields server-side.
- Do not allow a character’s ruleset to change through an ordinary patch.
- Migrate legacy characters without an edition to 2014.
- Reject unsupported 2024 production records until 2024 is explicitly enabled.
- Preserve old snapshots and restore them without changing edition identity.
- Make repeated level-up requests safe and revision-checked.

## 4. Replace hardcoded level-up steps with engine-driven steps

Update `src/components/LevelUpModal.tsx` and its callers so the UI renders the engine’s plan rather than class-specific conditionals.

Required step types:

- Hit points.
- Subclass selection.
- Feature choice.
- Resource choice.
- Expertise.
- Ability Score Improvement or feat.
- Known spell selection.
- Cantrip selection.
- Spell replacement.
- Always-prepared or expanded spell updates.
- Summary and confirmation.

The UI must:

- Never display an unfillable choice step.
- Never silently skip a required choice.
- Show only options valid for the character’s class, level, edition, prerequisites, and prior choices.
- Preserve selections when moving backward and forward.
- Show exact feature names and concise rules summaries.
- Show the difference between automatic gains and player decisions.
- Work for starting characters above level 1 as well as normal level-ups.
- Prevent confirmation until every required choice is valid.
- Produce a final summary that matches the saved character.

## 5. Update the character sheet and derived systems

- Display all gained class and subclass features at the correct level.
- Display selected subclass options rather than every mutually exclusive option.
- Display always-prepared and expanded spell sources distinctly from known spells.
- Display resources with correct maximums and recharge text.
- Apply resource and feature effects to derived statistics where the app supports them.
- Ensure combat actions use the correct edition-specific scaling.
- Ensure spell preparation, spellbook, Pact Magic, and known-spell behavior remain distinct.
- Make level-down/snapshot restore remove gains from the reverted level without deleting earlier valid choices.
- Add clear warnings for effects that are tracked as rules text but not yet automated in combat.

## 6. Add server-side progression validation

Create a shared validation path used by both normal level-up and above-level character creation.

It must reject:

- Invalid class or subclass IDs.
- Subclasses from the wrong edition or parent class.
- Choices made before their required level.
- Choices outside the allowed option set.
- Duplicate mutually exclusive selections.
- Invalid spell sources or spell levels.
- Impossible resource maximums.
- A missing required choice.
- A level jump that grants the wrong feature set.
- A patch that changes edition without an explicit conversion workflow.

All rejection messages should identify the character, level, field, and rule that failed without exposing sensitive data.

## 7. Test the progression engine with table-driven coverage

Add unit tests for:

- Every class at levels 1 through 20 in 2014.
- Every class at levels 1 through 20 in 2024 research mode.
- Every subclass feature level in all 44 detailed packets.
- Every subclass choice group and mutually exclusive branch.
- Every spellcasting model: prepared, known, spellbook, Pact Magic, and Artificer preparation.
- Every resource breakpoint and scaling formula.
- One-level and multi-level advancement.
- Starting characters created above level 1.
- Level-up retry and stale revision behavior.
- Snapshot restore and level-down behavior.
- Legacy characters without an edition.
- Rejection of unsupported 2024 production records.

Add integration tests for:

- Create character → advance → reload → verify persisted progression.
- Select subclass → select subclass options → reload → verify selected options.
- Save a character with prepared/known/always-prepared spells → reload → verify spell state.
- Attempt invalid subclass, spell, edition, and feature-choice patches.
- Restore a snapshot after a subclass choice and verify no orphaned choices remain.

## 8. Browser-level verification

After the engine is integrated, manually verify in the local server:

- 2014 Barbarian level-up, including subclass timing and subclass feature display.
- 2014 Cleric, Druid, Fighter, Paladin, Ranger, Monk, Rogue, Sorcerer, Warlock, Wizard, and Artificer.
- At least one known-spell caster, prepared caster, spellbook caster, Pact Magic caster, and Artificer.
- At least one subclass with mutually exclusive choices: Battle Master, Hunter, Four Elements, or Beast Master.
- Starting a character above level 1.
- Reopening the level-up flow after a failed or cancelled choice.
- Saving, refreshing, and restoring from a snapshot.
- Confirming that 2024 remains unavailable in production until its release gate is approved.
- Confirming `/api/health` reports a writable database after the full flow.
- Checking the browser console and server output for runtime errors.

## 9. Production release gates

Do not call the implementation complete until all of the following are true:

- Research validator passes with complete packet coverage.
- Full unit and integration suite passes.
- Typecheck passes.
- Lint passes with zero warnings.
- Production build passes.
- Local browser smoke tests pass for every class family listed above.
- No level-up path produces an empty or generic substitute step where a real choice is required.
- Saved characters reload with identical edition, subclass, choices, spells, resources, and level.
- Snapshot restore is verified for both pre-subclass and post-subclass states.
- 2014 production behavior is unchanged except where an audited defect was intentionally corrected.
- 2024 behavior is either fully enabled and tested or remains clearly research-only.
- Changes are reviewed before commit and push.

## Recommended implementation order

1. Add typed packet loaders and the normalized progression result.
2. Implement class-only automatic progression and compare it against the existing 2014 catalog.
3. Implement subclass selection and automatic subclass feature grants.
4. Implement subclass choice groups and persistence.
5. Implement spell changes and resource changes.
6. Replace hardcoded LevelUpModal branching with engine-driven steps.
7. Add server-side validation and migration coverage.
8. Add table-driven, integration, and browser-level tests.
9. Run the full release gates.
10. Commit and push only after explicit approval.

## Explicit non-goals until separately approved

- Enabling 2024 in the production character creator before the full 2024 content and UI review is complete.
- Adding 2024 Artificer from Unearthed Arcana or other later sources.
- Treating a generic display description as an implementation of a mechanical rule.
- Combining 2014 and 2024 feature records under one unscoped ID.
- Calling research validation equivalent to browser-level implementation verification.
