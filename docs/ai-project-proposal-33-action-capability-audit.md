# Proposal 33 — Action capability audit and data preparation

**Implementer:** DeepSeek or another low-cost model  
**Reviewer/integrator:** Codex  
**Ruleset:** Forge & Fable production rules only: 2014 5e plus the currently supported Artificer material  
**Scope:** Evidence gathering, classification, and repetitive catalog preparation. This proposal does **not** authorize runtime architecture, UI work, character-state changes, or mechanical automation.

## Why this split exists

The repository contains class, subclass, feat, spell, and resource information, but most class capabilities are descriptive-only. The missing feature is not one button: Forge & Fable needs a consistent model for actions, bonus actions, reactions, triggered features, passive features, and the resources they consume.

This work has two very different halves:

1. High-judgment architecture and rules integration. Codex owns this.
2. High-volume inventory and data classification across 13 classes, roughly 110 subclasses, feats, and spells. DeepSeek can prepare this material cheaply, provided it follows a strict evidence format and does not change runtime behavior.

## Read first

- `AGENTS.md`
- `docs/class-progression-audit.md`
- `src/lib/ruleset.ts`
- `src/data/subclasses.json`
- `src/data/feats.json`
- `src/data/spells.json`
- `src/lib/progression/types.ts`
- `src/lib/progression/state.ts`
- `src/components/HeroSheet.tsx`

Re-anchor every referenced symbol with repository search before reporting it. Line numbers in existing documents may have moved.

## Non-negotiable rules

1. **Do not edit runtime files.** In particular, do not change anything under `src/` during this proposal.
2. Do not invent an action schema, resource engine, execution handler, UI, or persistence field. Codex will define those after reviewing the audit.
3. Do not mix 2024 terminology or mechanics into the production 2014 catalog. Flag mixed-edition source data instead of normalizing it silently.
4. Do not infer activation from a feature name alone. Use existing rules text or a reliable cited rules reference. If evidence is insufficient, mark the row `needs-review`.
5. Do not convert every feature into a clickable action. Passive, triggered, replacement, rider, and choice-granting features must remain distinct.
6. Do not paste long copyrighted rules passages. Record concise mechanical summaries and a source pointer.
7. Do not claim a batch is complete without coverage counts, unresolved rows, and duplicate checks.
8. Work one batch at a time. Stop after each batch so Codex can review it before the next batch begins.

## Deliverable format

Create an audit folder only:

```text
docs/action-capability-audit/
  README.md
  universal-2014.json
  class-barbarian.json
  class-bard.json
  ...one file per class...
  feats.json
  spells.json
  unresolved.json
  coverage.md
```

These are audit artifacts, not production data. They must not be imported by the application.

Every JSON file must be valid JSON and contain an array of records using this worksheet shape:

```json
{
  "auditId": "paladin.lay-on-hands",
  "name": "Lay on Hands",
  "sourceKind": "class",
  "sourceId": "paladin",
  "subclassId": null,
  "minimumLevel": 1,
  "classification": "action",
  "trigger": null,
  "resource": "lay-on-hands-pool",
  "resourceCostSummary": "Player chooses how many points to spend",
  "rechargeSummary": "Long rest",
  "scalingSummary": "Pool scales with paladin level",
  "resolutionKind": "healing-or-condition-removal",
  "mechanicalSummary": "Spend points from the pool to heal a creature; the feature also supports its listed cleansing option.",
  "evidence": [
    {
      "kind": "repository",
      "location": "src/lib/ruleset.ts",
      "pointer": "Paladin level progression and featureDescriptions"
    }
  ],
  "confidence": "high",
  "reviewStatus": "unreviewed",
  "notes": []
}
```

Allowed `classification` values for the audit are:

- `action`
- `bonus-action`
- `reaction`
- `passive`
- `triggered`
- `rider`
- `replacement`
- `special`
- `long-activation`
- `needs-review`

`classification` describes the 2014 rule, not where the current UI happens to display the feature.

Allowed `resolutionKind` values are:

- `reference-only`
- `attack`
- `damage`
- `healing`
- `healing-or-condition-removal`
- `movement`
- `ability-check`
- `saving-throw`
- `resource-conversion`
- `state-toggle`
- `choice`
- `mixed`
- `needs-review`

Do not add new enum values. Put unusual details in `notes` and flag them for review.

## Batch 1 — Universal 2014 capabilities

Create `universal-2014.json` containing the universal combat actions and reactions appropriate to the production 2014 ruleset.

Explicitly investigate:

- Attack
- Cast a Spell or casting according to a spell's casting time
- Dash
- Disengage
- Dodge
- Help
- Hide
- Ready
- Search
- Use an Object
- Grapple
- Shove
- Improvised actions or other DM-adjudicated actions
- Opportunity Attack
- Two-weapon fighting bonus attack, including its prerequisites

Do not substitute the 2024 labels `Magic`, `Influence`, `Study`, or `Utilize`. If a useful 2014 analogue exists, record it under its 2014 identity and note the relationship only in `notes`.

Definition of done for Batch 1:

- Each entry has an activation classification and concise mechanical summary.
- Conditional or trigger-dependent entries state the trigger.
- Grapple and Shove are not incorrectly represented as independent ordinary actions if the 2014 rule treats them as Attack-action replacements.
- Opportunity Attack is classified as a reaction with its trigger, not as an always-available attack button.

## Batches 2–14 — One class per batch

Process classes in this order:

1. Paladin
2. Fighter
3. Rogue
4. Druid
5. Monk
6. Barbarian
7. Bard
8. Cleric
9. Ranger
10. Sorcerer
11. Warlock
12. Wizard
13. Artificer

For each class, inventory every base-class and subclass feature available in the repository. Record only capabilities relevant to activation, triggering, resource use, combat resolution, or passive modification. Pure progression notices such as “3rd-level spells” do not need capability rows.

The first four classes are calibration batches. They must include these representative cases:

- Paladin: Lay on Hands; Divine Sense; shared Channel Divinity resource and each oath option; Divine Smite as a triggered/rider case rather than a normal action; relevant aura passives.
- Fighter: Second Wind; Action Surge; Indomitable; reaction-based fighting styles or subclass features.
- Rogue: Cunning Action options; Sneak Attack; Uncanny Dodge; Evasion; subclass reactions and bonus actions.
- Druid: Wild Shape activation, remaining uses, recharge, duration, and transformation restrictions; subclass features that modify or spend Wild Shape.

For each class batch:

- Search both base-class and subclass data.
- Record shared resource relationships without designing their storage implementation.
- Record level-dependent scaling as a concise formula or table summary.
- Distinguish an action that spends a resource from a passive feature that merely improves it.
- Put contradictory, incomplete, empty, or mixed-edition data in `unresolved.json` as well as the class file.
- Add counts to `coverage.md`: features inspected, capability rows emitted, passives, actions, bonus actions, reactions, triggered/rider/replacement rows, and unresolved rows.

## Batch 15 — Feats

Audit every feat in `src/data/feats.json` for:

- granted actions or bonus actions
- granted or modified reactions
- replacement attacks
- attack or damage riders
- resource-backed capabilities
- modifications to universal actions or opportunity attacks

Feats that only change a number passively should be classified `passive`. Feats that change when or how a reaction can occur must record the trigger modification.

## Batch 16 — Spells

This is a mechanical classification pass over the existing spell catalog, not a rewrite of spell descriptions.

For every spell, record:

- spell ID and name
- normalized activation bucket derived from `castingTime`: action, bonus action, reaction, long activation, or needs review
- reaction trigger when the existing data supplies it
- concentration flag
- ritual flag
- whether the current spell-effects layer can execute damage/healing or whether it is reference-only
- malformed or ambiguous casting-time values

Do not put all damaging spells under Actions. A reaction spell remains a reaction; a bonus-action spell remains a bonus action. Do not change prepared/known spell behavior.

## Required quality checks

At the end of every batch:

1. Parse every created JSON file successfully.
2. Check for duplicate `auditId` values across the audit folder.
3. Check that every record has at least one evidence entry.
4. Check that every record uses only the allowed classifications and resolution kinds.
5. Report all `needs-review` and low-confidence entries honestly.
6. Confirm that no file under `src/` changed.

## Final handoff

When all approved batches are complete, update `README.md` and `coverage.md` with:

- totals by source kind and classification
- unresolved and mixed-edition counts
- shared-resource candidates
- features whose activation changes due to another feature
- features needing target selection or DM adjudication
- features that appear safe for automatic execution
- features that should remain reference cards

Do not integrate the audit into the app. Codex will review the evidence, define the production schema, implement representative vertical slices, and then issue a separate constrained data-migration proposal if further DeepSeek work is appropriate.

## DeepSeek definition of done

- Audit files are complete for the approved batch only.
- No runtime files changed.
- JSON validation and duplicate checks pass.
- Coverage counts reconcile with the inspected source data.
- Ambiguities are flagged, not guessed.
- The response lists created files, validation performed, unresolved items, and the exact next batch awaiting approval.
