# Dreamwright Homebrew Studio - Agentic Implementation Proposal

**Project:** Dreamwright.gg

**Scope:** Versioned homebrew Items, Classes, Subclasses, Species, and Feats, with structured prerequisites, declarative automation, character-sheet integration, level-up integration, multiclass support, campaign sharing, and safe version upgrades.

**Audience:** Coding agents implementing the work in sequential, reviewable rounds.

**Status:** Proposal only. No implementation in this document.

**Repository snapshot:** `E:\forge-and-fable`, Next.js 16.2.9, SQLite schema revision 25 at the time this proposal was written. Re-check both before implementation.

---

## 1. Executive decision

Build this as a **versioned rules-content platform**, not as five unrelated forms.

The first useful release should be Items because Dreamwright already has inventory, equipment, attunement labels, passive item bonuses, effects, carried weight, and an item catalog. Items can prove the full authoring-to-character pipeline before the progression engine is made runtime-extensible.

Automated Classes and Subclasses must wait until a multiclass-aware progression foundation exists. Dreamwright currently stores one `classId`, one `subclassId`, and one total `level`; its progression validators and packet registry assume a single static catalog class. Adding homebrew class forms before fixing that boundary would create content that can be authored but cannot be applied reliably.

The recommended order is:

1. Content contracts and versioned storage.
2. Runtime content resolver and declarative mechanics.
3. Item Studio vertical slice.
4. Item stages, toggles, and advancement.
5. Multiclass and generalized progression foundation.
6. Class and Subclass Studio.
7. Species and Feat Studio.
8. Campaign sharing, upgrade workflows, import/export, and hardening.

This is a large platform feature. Treat it as 8-10 gated agent rounds, with a review round after every high-risk progression or authorization round. Do not combine it into one autonomous implementation pass.

---

## 2. Product goals

### 2.1 Creator goals

A signed-in creator can:

- Create an Item, Class, Subclass, Species, or Feat from scratch.
- Clone a built-in or accessible homebrew entry as a starting point.
- Save named, immutable versions with change notes.
- Keep unfinished versions private and publish a selected version.
- Compare versions and deprecate old versions without deleting them.
- Preview exactly what the content will do to a sample character.
- Share published content with a campaign.
- Create a new version without changing characters pinned to an older version.

### 2.2 Player goals

A player can:

- Add campaign-approved or personally owned homebrew to a character.
- See the creator, version, source, and automation status.
- Equip, attune, toggle, and advance applicable items.
- Receive class, subclass, species, and feat benefits at the correct level.
- Take eligible homebrew options during character creation or level-up.
- Multiclass into homebrew or built-in classes when prerequisites are met.
- Preview and explicitly approve an upgrade from one content version to another.

### 2.3 DM goals

A DM can:

- Allow specific published homebrew versions in a campaign.
- See which version each character uses.
- Revoke new use of content without breaking characters that already use it.
- Manually approve stage changes or content upgrades when campaign policy requires it.
- Identify partially automated or manual-only rules before allowing the content.

### 2.4 Safety and integrity goals

- No user-authored JavaScript, SQL, regex, or executable formula strings.
- All mechanics use a validated discriminated-union schema.
- Every write is owner-authorized and concurrency-protected.
- Every character selection pins an immutable content version.
- Published and character-referenced versions are never hard-deleted.
- Existing built-in and manual-homebrew characters remain valid.
- The server repeats all prerequisite, ownership, visibility, and progression checks.

---

## 3. Current Dreamwright architecture and the important gaps

The implementation agents must re-check these observations before editing, but they are true in the current repository snapshot.

### 3.1 Useful existing seams

- `src/types/game.ts`
  - `InventoryItem`, `Equipment`, `CharacterEffect`, `Feat`, `HeroClass`, `Race`, and `Character`.
  - `Character.sourceIds` already distinguishes enabled content sources.
  - `Character.progressionState` records applied class/subclass progression.
- `src/lib/itemCatalog.ts`
  - Converts static catalog items into inventory entries.
  - Parses a limited set of passive bonuses from item prose.
- `src/lib/equipment.ts`
  - Resolves armor, shields, weapons, enhancement bonuses, and carried weight.
- `src/lib/effects.ts`
  - Applies active flat bonuses, d20 riders, senses, and advantage/disadvantage.
- `src/lib/progression/*`
  - Loads edition-scoped class/subclass packets.
  - Builds level-up plans and validates progression state.
- `src/lib/feats.ts`
  - Filters built-in feats using race, spellcasting, level, abilities, proficiency, background, and named-feat prerequisites.
- `src/components/CreatorPanel.tsx`, `LevelUpModal.tsx`, and `HeroSheet.tsx`
  - Already provide the primary creation, advancement, and play surfaces.
- `src/lib/db.ts`
  - Provides ordered SQLite migrations and transactional writes.
- Character writes already use optimistic revision checks.

### 3.2 Blocking gaps

- Homebrew classes and species are currently only manual identity sentinels. They do not have automated progression.
- `Character` is single-class. The existing `docs/ai-project-proposal-17.md` correctly identifies multiclassing as a cross-cutting refactor.
- The progression catalog is imported from static JSON. Runtime database content cannot safely enter it without an injected registry/resolver.
- Item automation is inferred from English prose. This is too ambiguous for creator-authored mechanics.
- Item notes, equipment state, attunement, and rule definition are mixed into a small `InventoryItem` object.
- `ASIChoice` identifies a feat by one ID and does not represent repeatable feat instances.
- `Race.traits` have no explicit unlock level.
- Existing effects are character-global. They cannot target one weapon, modify a specific spell-slot tier, or propagate an aura to eligible allies.
- There is no content ownership, publishing, sharing, immutable version, or upgrade model.

### 3.3 Compatibility invariants

Every implementation round must preserve these:

- A character without new homebrew references behaves exactly as before.
- Static built-in catalogs remain available while the runtime registry is introduced.
- Manual PDF-import homebrew identities continue to work as manual-only content.
- Old inventory rows without a content reference continue to render and calculate.
- Empty or legacy `sourceIds` retain their documented compatibility behavior.
- Published content updates never silently change a saved character.
- Existing character optimistic concurrency semantics remain intact.

---

## 4. Core domain model

Create a dedicated type module such as `src/types/homebrew.ts`. Do not add dozens of loosely related optional fields directly to `game.ts`.

### 4.1 Content identity

```ts
export type HomebrewKind =
  | "item"
  | "class"
  | "subclass"
  | "species"
  | "feat";

export type RulesContentRef =
  | {
      source: "builtin";
      kind: HomebrewKind | "spell";
      id: string;
      ruleset: RulesetId;
    }
  | {
      source: "homebrew";
      kind: HomebrewKind;
      definitionId: string;
      versionId: string;
      ruleset: RulesetId;
    };
```

Rules:

- Built-in references use the existing catalog ID.
- Homebrew references always include an immutable `versionId`.
- A reference's kind and ruleset must match the resolved payload.
- Never encode authorization or version state into a display slug.

### 4.2 Definition and immutable version

```ts
export type HomebrewDefinition = {
  id: string;
  ownerUserId: string | null;
  kind: HomebrewKind;
  ruleset: RulesetId;
  slug: string;
  title: string;
  visibility: "private" | "campaign";
  currentVersionId?: string;
  latestPublishedVersionId?: string;
  archivedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type HomebrewVersion<TPayload = HomebrewPayload> = {
  id: string;
  definitionId: string;
  ordinal: number;
  label?: string;
  status: "draft" | "published" | "deprecated";
  schemaVersion: number;
  payload: TPayload;
  parentVersionId?: string;
  baseline?: ContentBaseline;
  changeSummary: string;
  contentHash: string;
  createdByUserId: string | null;
  createdAt: string;
  publishedAt?: string;
};
```

Version rules:

- Clicking **Save version** creates a new immutable row.
- A dirty editor state is local until explicitly saved; do not create a database version per keystroke.
- Editing a published version starts a new draft whose `parentVersionId` points to it.
- Publishing changes status and updates the definition pointer; it never rewrites payload JSON.
- `ordinal` is the authoritative sequence. `label` is optional human-facing text such as `1.2`.
- `contentHash` is computed server-side from canonical JSON.
- A definition is soft-archived. Referenced versions survive owner deletion or sharing changes.

### 4.3 Baseline provenance

```ts
export type ContentBaseline = {
  sourceRef: RulesContentRef;
  copiedAt: string;
  sourceTitle: string;
  sourceVersionLabel?: string;
};
```

Cloning deep-copies the resolved payload. The new definition does not inherit live behavior from its baseline. Provenance remains visible for attribution and diff context.

### 4.4 Suggested SQLite tables

Add the next available schema revision after re-checking `SCHEMA_REVISION`.

```sql
CREATE TABLE homebrew_definitions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  ruleset TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL,
  current_version_id TEXT,
  latest_published_version_id TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_homebrew_owner_slug
  ON homebrew_definitions(owner_user_id, kind, slug)
  WHERE owner_user_id IS NOT NULL AND archived_at IS NULL;

CREATE TABLE homebrew_versions (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL REFERENCES homebrew_definitions(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL,
  label TEXT,
  status TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  parent_version_id TEXT REFERENCES homebrew_versions(id) ON DELETE RESTRICT,
  baseline_json TEXT,
  change_summary TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE(definition_id, ordinal)
);

CREATE TABLE campaign_homebrew_access (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  definition_id TEXT NOT NULL REFERENCES homebrew_definitions(id) ON DELETE CASCADE,
  allowed_version_id TEXT NOT NULL REFERENCES homebrew_versions(id) ON DELETE RESTRICT,
  added_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY (campaign_id, definition_id, allowed_version_id)
);
```

Foreign-key pointers from `homebrew_definitions` to versions may need to be added after both tables exist. Use an idempotent migration pattern consistent with `src/lib/db.ts`.

Do not add a join row for every character reference. Character JSON remains the character aggregate. A small indexed reference table may be added later only if dependency queries prove too expensive.

---

## 5. Declarative prerequisite model

Free-text prerequisites are useful for display but cannot be the automation source.

```ts
export type Prerequisite =
  | { op: "all"; rules: Prerequisite[] }
  | { op: "any"; rules: Prerequisite[] }
  | { op: "not"; rule: Prerequisite }
  | { op: "ability"; ability: AbilityKey; minimum: number }
  | { op: "character-level"; minimum: number }
  | { op: "class-level"; classRef: RulesContentRef; minimum: number }
  | { op: "class"; classRef: RulesContentRef }
  | { op: "species"; speciesRef: RulesContentRef }
  | { op: "feat"; featRef: RulesContentRef }
  | { op: "spellcasting"; mode: "any" | "full" | "partial" | "pact" }
  | { op: "proficiency"; category: string; value: string }
  | { op: "feature"; featureId: string }
  | { op: "attunement"; required: boolean };
```

Each authorable payload may also contain:

```ts
type PrerequisiteBlock = {
  rules?: Prerequisite;
  displayText?: string;
  manualApprovalText?: string;
};
```

Rules:

- `displayText` explains structured prerequisites.
- `manualApprovalText` is explicitly non-automated and requires an acknowledgement.
- The server evaluates structured rules again when content is selected.
- Missing context should produce an `unknown` result in previews, not an automatic pass.
- Editors show a readable sentence and a structured tree preview.

---

## 6. Declarative mechanics model

### 6.1 Why this is required

Current item logic searches item names and descriptions for phrases such as `+2 bonus to attack and damage rolls`. Keep that parser for built-in legacy items, but never use prose parsing as the source of truth for newly authored content.

All new homebrew automation should resolve through validated `MechanicEffect` records.

### 6.2 Activation gates

```ts
export type EffectGate =
  | { type: "always" }
  | { type: "equipped" }
  | { type: "attuned" }
  | { type: "toggle"; toggleId: string }
  | { type: "stage"; stageIds: string[] }
  | { type: "minimum-level"; level: number }
  | { type: "all"; gates: EffectGate[] }
  | { type: "any"; gates: EffectGate[] };
```

### 6.3 Initial supported effects

```ts
export type MechanicEffect =
  | {
      id: string;
      type: "numeric-bonus";
      target:
        | "ac"
        | "saving-throws"
        | "ability-checks"
        | "initiative"
        | "spell-attack"
        | "spell-save-dc"
        | "weapon-attack"
        | "weapon-damage";
      value: number;
      scope?: "character" | "source-item";
      gate: EffectGate;
      stacking?: "stack" | "same-source-nonstacking";
    }
  | {
      id: string;
      type: "ability-floor";
      ability: AbilityKey;
      minimum: number;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "condition";
      conditionId: string;
      label: string;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "d20-rider";
      dice: string;
      appliesTo: Array<"attack" | "save" | "check">;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "spell-slot-bonus";
      spellLevel: number;
      amount: number;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "resource-grant";
      resourceId: string;
      maximum: number;
      recharge: "short-rest" | "long-rest" | "dawn" | "manual";
      gate: EffectGate;
    }
  | {
      id: string;
      type: "spell-grant";
      spellRef: RulesContentRef;
      freeUses?: number;
      recharge?: "short-rest" | "long-rest" | "dawn";
      gate: EffectGate;
    }
  | {
      id: string;
      type: "sense";
      text: string;
      gate: EffectGate;
    }
  | {
      id: string;
      type: "aura";
      radiusFeet: number;
      recipient: "self" | "allies" | "all-creatures";
      effects: Exclude<MechanicEffect, { type: "aura" }>[];
      gate: EffectGate;
    };
```

Validation limits:

- Numeric bonuses: `-20..20`.
- Ability floors: `1..30`.
- Slot level: `1..9`.
- Resource maximum: bounded, for example `0..999`.
- Aura radius: bounded and finite.
- Nesting depth and total effect count are capped.
- Stable IDs are unique inside one payload.
- No arbitrary formula strings in v1.

If scaling is needed, add validated table values:

```ts
type LevelTableValue = {
  kind: "level-table";
  rows: Array<{ minimumLevel: number; value: number }>;
};
```

Do not introduce a string expression evaluator.

### 6.4 Deterministic resolution order

The derived-stat pipeline must be explicit:

1. Base character scores and native rules.
2. Replacement calculations such as armor.
3. Floors and ceilings; multiple floors use the strongest applicable value.
4. Additive numeric bonuses.
5. Roll riders, advantage modes, conditions, senses, actions, and resources.
6. Presentation breakdown grouped by source instance.

The resolver returns values **and provenance**, for example:

```ts
type ResolvedContribution = {
  sourceInstanceId: string;
  sourceRef: RulesContentRef;
  effectId: string;
  label: string;
  target: string;
  value?: number;
};
```

The sheet should never display an unexplained `+2`.

### 6.5 Required example behavior

- **+2 weapon:** its `weapon-attack` and `weapon-damage` bonuses use `scope: "source-item"`, so other weapons are unchanged.
- **Strength-setting armor:** `ability-floor(strength, 19)` applies only when equipped; Strength 18 becomes 19 and Strength 20 remains 20.
- **Ring of invisibility:** the condition applies only when equipped, attuned, and its explicit toggle is on. Unequipping or unattuning makes the toggle ineffective without deleting its saved preference.
- **Extra 3rd-level slot:** `spell-slot-bonus` increases maximum slots and never reduces used slots below zero when removed. If removal leaves used slots above maximum, show an overdrawn state until recovery; do not silently restore or erase casts.
- **Bless aura:** self-only works through the local effect resolver. Ally propagation requires campaign presence and is delivered in the later campaign-integration round.

---

## 7. Item model

### 7.1 Author payload

```ts
export type HomebrewItemPayload = {
  kind: "item";
  name: string;
  description: string;
  creatorNotes?: string;
  category: string;
  classification?: string;
  rarity: string;
  imageUrl?: string;
  baseWeight?: number;
  cost?: string;
  requiresAttunement: boolean;
  attunementPrerequisites?: PrerequisiteBlock;
  equipmentSlots: string[];
  effects: MechanicEffect[];
  toggles: Array<{ id: string; label: string; defaultOn: boolean }>;
  stages: ItemStage[];
};

export type ItemStage = {
  id: string;
  name: string;
  order: number;
  description: string;
  activation:
    | { type: "manual" }
    | { type: "counter"; counterId: string; minimum: number }
    | { type: "milestone"; label: string };
  effects: MechanicEffect[];
};
```

### 7.2 Character item instance

Extend `InventoryItem` compatibly:

```ts
type HomebrewItemInstanceState = {
  contentRef: RulesContentRef;
  instanceNotes?: string;
  weightOverride?: number;
  equipped: boolean;
  attuned: boolean;
  bodyLocation?: string;
  activeToggleIds: string[];
  currentStageId?: string;
  counters?: Record<string, number>;
  stageHistory?: Array<{
    stageId: string;
    changedAt: string;
    changedBy: string;
    reason?: string;
  }>;
};
```

Keep existing `Equipment` fields during migration. Add one adapter that derives legacy equipment state and new instance state into a common resolver input. Do not maintain two unrelated bonus engines.

### 7.3 Notes and weight

Separate:

- `creatorNotes`: author-only design notes on the content definition.
- `description`: rules text visible to users.
- `instanceNotes`: notes for this copy on this character.
- `baseWeight`: versioned content default.
- `weightOverride`: per-character override.

Effective weight is `weightOverride ?? baseWeight ?? legacyWeight ?? 0`.

### 7.4 Body location

- Authors provide one or more suggested equipment slots.
- Players choose one `bodyLocation` per item instance.
- Custom slot labels are permitted within length limits.
- Slot collisions produce warnings by default; they do not block equip unless the item explicitly declares exclusivity.

### 7.5 Growing and sentient items

The first item-stage release supports:

- Ordered stage definitions.
- Manual stage changes.
- Creator-defined numeric counters.
- Stage history.
- Effects gated by the current stage.
- A diff preview before changing stage.

Automatic combat advancement is a later sub-round because Dreamwright does not currently have a trustworthy, universal event for "this weapon hit" or "this creature was defeated by this weapon."

When that sub-round begins, add auditable events rather than inferring growth from dice rolls:

- `weapon-attack-hit`
- `weapon-critical-hit`
- `creature-defeated`
- `encounter-completed`

Each event identifies the character and source item instance. Manual DM/player correction remains available.

---

## 8. Generalized class and subclass model

### 8.1 Multiclass foundation is a hard dependency

Use the design direction in `docs/ai-project-proposal-17.md`, updated for `RulesContentRef`.

```ts
export type CharacterClassLevel = {
  classRef: RulesContentRef;
  level: number;
  subclassRef?: RulesContentRef;
  acquiredOrder: number;
};
```

Compatibility:

- When `classLevels` is absent, derive one built-in reference from `classId`, `subclassId`, `ruleset`, and `level`.
- Keep `level` as the total-level mirror.
- Keep `classId`/`subclassId` as primary-class compatibility mirrors until all call sites are migrated.
- New homebrew or multiclass characters write `classLevels`.
- One helper module owns `getClassLevels`, `totalLevel`, `primaryClass`, per-class level lookup, hit-dice pools, and combined spell slots.

Every direct `character.level`, `character.classId`, and `character.subclassId` consumer must be classified as:

- Total character level.
- Primary class.
- A particular class's level.
- All class levels.

Record that decision table in the round changelog.

### 8.2 Author payload

```ts
export type HomebrewClassPayload = {
  kind: "class";
  name: string;
  summary: string;
  hitDie: number;
  primaryAbilities: AbilityKey[];
  savingThrowProficiencies: AbilityKey[];
  armorTraining: string[];
  weaponProficiencies: string[];
  toolChoices?: ChoiceDefinition[];
  skillChoices?: ChoiceDefinition[];
  startingEquipment?: ChoiceDefinition[];
  multiclassPrerequisites?: PrerequisiteBlock;
  multiclassProficiencyGrants: string[];
  spellcasting: HomebrewSpellcasting;
  levels: Record<number, HomebrewProgressionLevel>;
  subclassSelectionLevels: number[];
  allowedSubclassRefs?: RulesContentRef[];
};

export type HomebrewSubclassPayload = {
  kind: "subclass";
  name: string;
  summary: string;
  parentClassRef: RulesContentRef;
  prerequisites?: PrerequisiteBlock;
  levels: Record<number, HomebrewProgressionLevel>;
};
```

### 8.3 Caster controls

The simple editor presents:

- Non-caster.
- Partial caster.
- Full caster.

Advanced settings expose:

```ts
type HomebrewSpellcasting = {
  mode: "none" | "full" | "half" | "third" | "pact" | "custom";
  ability?: AbilityKey;
  preparation: "none" | "known" | "prepared" | "spellbook";
  spellList:
    | { type: "class-list"; classIds: string[] }
    | { type: "explicit"; spellIds: string[] };
  cantripsKnownByLevel?: number[];
  spellsKnownByLevel?: number[];
  preparedFormula?: "class-level-plus-modifier" | "half-level-plus-modifier";
  spellSlotsByLevel?: Record<number, number[]>;
  pactSlotsByLevel?: Record<number, { count: number; slotLevel: number }>;
};
```

Rules:

- Standard full/half/third/pact templates pre-fill reviewed tables.
- Custom tables require all 20 rows and strict validation.
- The UI label "partial caster" maps to half-caster by default.
- Source filtering still applies to spell choices; homebrew cannot silently expose every catalog spell.
- Combined multiclass slots are computed from per-class caster contributions. Pact slots remain separate.

### 8.4 Level guide

The Class editor's main surface is a 1-20 level grid:

| Level | Proficiency | Class features | Choices | Resources | Spell progression | Subclass milestone |
|---|---:|---|---|---|---|---|

The Subclass editor uses the parent class's level guide and highlights expected subclass benefit levels. Authors may add benefits at other levels, but receive a balance warning.

Each row can grant:

- Automatic features.
- Structured choices.
- Resource changes.
- Spell changes.
- Mechanics.
- Actions, bonus actions, reactions, and passives.

The payload is normalized into the same packet shape used by `src/lib/progression/*`; do not build a second homebrew-only level-up engine.

### 8.5 Runtime registry refactor

Replace hard dependency on the imported global `progressionCatalog` with an injected `RulesContentRegistry`.

```ts
export interface RulesContentRegistry {
  resolve(ref: RulesContentRef): ResolvedRulesContent;
  getClassPacket(ref: RulesContentRef): ClassProgressionPacket;
  getSubclassPacket(ref: RulesContentRef): SubclassProgressionPacket;
  getSpeciesPacket(ref: RulesContentRef): SpeciesProgressionPacket;
  getFeatPacket(ref: RulesContentRef): FeatProgressionPacket;
}
```

- Server registry resolves built-ins plus authorized database versions.
- Client registry receives minimal resolved DTOs for references used by the current character and eligible picker options.
- Do not use a process-global mutable map for user content.
- `validateCharacterProgression`, `buildLevelUpPlan`, and `progressionPatchForCharacter` accept a registry.
- Built-in callers may use a default static registry adapter.

---

## 9. Species model

```ts
export type HomebrewSpeciesPayload = {
  kind: "species";
  name: string;
  summary: string;
  creatureType: string;
  sizes: string[];
  speed: string;
  prerequisites?: PrerequisiteBlock;
  abilityScoreMode:
    | { type: "fixed"; bonuses: Partial<AbilityScores> }
    | { type: "choice"; pattern: "plus-two-plus-one" | "three-plus-one" };
  languages: ChoiceDefinition[];
  proficiencies: ChoiceDefinition[];
  levels: Record<number, HomebrewProgressionLevel>;
};
```

Requirements:

- Level 1 holds ordinary species traits.
- Levels 2-20 are optional and visible in the guide.
- Creation validates species prerequisites.
- Level-up aggregates species progression alongside class/subclass progression.
- A species version upgrade previews retroactive changes for every level already reached.
- Species mechanics use the same declarative effect and resource model.

Do not keep higher-level species features in an isolated UI-only list. They must enter the generalized progression plan and `progressionState`.

---

## 10. Feat model

```ts
export type HomebrewFeatPayload = {
  kind: "feat";
  name: string;
  description: string;
  category?: string;
  prerequisites?: PrerequisiteBlock;
  repeatability:
    | { mode: "once" }
    | { mode: "unlimited"; requiresDistinctChoices?: boolean }
    | { mode: "limited"; maximum: number; requiresDistinctChoices?: boolean };
  choices: ChoiceDefinition[];
  effects: MechanicEffect[];
  spellGrants?: SpellGrantDefinition[];
};
```

Add instance-based selections:

```ts
export type CharacterFeatSelection = {
  instanceId: string;
  contentRef: RulesContentRef;
  acquiredAtCharacterLevel: number;
  acquiredFrom: "asi" | "species" | "class" | "campaign" | "manual";
  choices: Record<string, FeatureChoiceValue>;
};
```

Compatibility:

- Existing `ASIChoice` feat records resolve to one implicit built-in feat instance.
- New characters write `featSelections`.
- Repeatability checks count instances of the same definition, not display names.
- `requiresDistinctChoices` compares normalized choice selections.
- Server validation rejects selection above the maximum or without prerequisites.

---

## 11. Content resolution, pinning, and upgrades

### 11.1 Selection

When a character selects homebrew:

1. Resolve the requested version.
2. Confirm it is published, owned by the user, or campaign-accessible.
3. Confirm kind, ruleset, and schema.
4. Evaluate prerequisites.
5. Pin the exact `versionId`.
6. Store character-specific choices and instance state separately.
7. Rebuild progression/mechanics and validate the entire resulting character.
8. Save through the existing character revision protocol.

### 11.2 Continued use after access changes

- Revoking campaign access blocks new selections.
- A character already pinned to that version can continue resolving it.
- Archived/deprecated content remains playable.
- The sheet displays `Deprecated` or `No longer shared` without disabling the character.

### 11.3 Upgrade flow

No automatic upgrades.

The upgrade preview shows:

- Rules text changes.
- Added and removed effects.
- Changed prerequisites.
- Changed level grants.
- Changed spell progression.
- Changed choices that need reselection.
- Resource maximum changes.
- Item stage mapping changes.

Before applying an upgrade:

- Create a named character snapshot.
- Validate the target version against the character.
- Ask for any new choices.
- Apply in one character revision.
- Preserve a rollback reference to the prior content version and snapshot.

Class, Subclass, and Species upgrades are high-risk. They must use the generalized progression diff, not shallow object replacement.

---

## 12. API and data-access design

Use a server-only data-access layer for ownership and DTO shaping. Route handlers authenticate every request and return minimal DTOs.

Suggested modules:

- `src/lib/homebrew/homebrewStore.ts` - SQLite transactions only.
- `src/lib/homebrew/homebrewAccess.ts` - ownership and campaign authorization.
- `src/lib/homebrew/homebrewSchema.ts` - payload validators and normalization.
- `src/lib/homebrew/homebrewResolver.ts` - built-in/database reference resolution.
- `src/lib/homebrew/homebrewDiff.ts` - version and character-impact diffs.
- `src/lib/homebrew/homebrewDtos.ts` - safe client response shapes.

Suggested routes:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/homebrew` | List owned or accessible definitions with filters. |
| `POST` | `/api/homebrew` | Create from scratch or clone a baseline. |
| `GET` | `/api/homebrew/[definitionId]` | Definition metadata and authorized version list. |
| `PATCH` | `/api/homebrew/[definitionId]` | Rename, archive, or change definition metadata with `If-Match`. |
| `POST` | `/api/homebrew/[definitionId]/versions` | Validate and save an immutable draft version. |
| `GET` | `/api/homebrew/[definitionId]/versions/[versionId]` | Read one authorized version. |
| `POST` | `/api/homebrew/[definitionId]/versions/[versionId]/publish` | Publish after strict validation. |
| `POST` | `/api/homebrew/[definitionId]/versions/[versionId]/deprecate` | Deprecate without deleting. |
| `POST` | `/api/homebrew/validate` | Validate unsaved editor payload and return structured diagnostics. |
| `POST` | `/api/homebrew/resolve` | Resolve a bounded list of content refs for an authorized character/editor. |
| `POST` | `/api/campaigns/[id]/homebrew` | DM allows a definition/version. |
| `DELETE` | `/api/campaigns/[id]/homebrew/[definitionId]` | DM revokes new use. |

API rules:

- Node runtime and dynamic responses for database-backed routes.
- GET route handlers are not assumed cached.
- Request bodies and resolved-ref lists have strict byte/count limits.
- Owner checks happen inside the DAL, not only in route handlers.
- Publishing and sharing are transactions.
- Campaign access is version-specific; publishing a new version does not make it campaign-legal until the DM allows that version.
- Use 400 for schema/prerequisite errors, 403 for authorization, 404 for non-visible resources, 409 for revisions/version conflicts, and 413 for size limits.
- Never return `owner_user_id`, unpublished payloads, or creator-only notes to unauthorized users.

---

## 13. UI proposal

### 13.1 Entry point

Add **Homebrew Studio** to the Workspace menu. The landing surface contains:

- Create new.
- My drafts.
- Published.
- Shared with my campaigns.
- Deprecated/archived.
- Filters by content kind, ruleset, status, and campaign.

### 13.2 Editor shell

All editors share:

- Name, ruleset, description, and baseline provenance.
- Dirty-state protection.
- Validation summary with clickable field paths.
- Character preview selector.
- Rules/mechanics preview.
- Version history.
- Save version.
- Publish/deprecate.
- Compare against parent version.

Type-specific tabs:

- **Item:** Identity, Equipment, Attunement, Effects, Toggles, Stages, Preview.
- **Class:** Foundation, Proficiencies, Spellcasting, Levels 1-20, Subclasses, Prerequisites, Preview.
- **Subclass:** Parent Class, Prerequisites, Levels, Preview.
- **Species:** Foundation, Abilities, Languages/Proficiencies, Levels, Preview.
- **Feat:** Prerequisites, Repeatability, Choices, Effects, Preview.

### 13.3 Character integration

- Creator source step displays accessible homebrew separately from built-in sources.
- Character option cards show a `Homebrew` chip, creator, and version.
- Level-up pickers show only accessible, ruleset-compatible, prerequisite-valid content.
- The sheet displays a source/version link from items, classes, species, feats, features, and effects.
- Manual-only mechanics receive a clear `Manual` badge.
- Item controls for equip, attune, toggle, location, stage, counters, notes, and version upgrade live in the inventory/equipment detail surface.

### 13.4 Preview

The editor preview accepts:

- A saved character owned by the creator.
- A generated test character with editable level and abilities.

It displays:

- Eligible/ineligible/unknown prerequisite results.
- Before/after derived stats.
- Feature and resource grants by level.
- Spell slots and spell-list behavior.
- Effect gates and whether each gate is currently satisfied.
- Warnings for unsupported or manual-only behavior.

---

## 14. Multi-phase implementation plan

Each phase is a separate branch/checkpoint and changelog. A phase is not complete until its gate passes.

### Phase 0 - Contract freeze and regression harness

**Risk:** Medium

**Goal:** Lock the data contracts, compatibility behavior, and acceptance fixtures before database or UI work.

Deliverables:

- `src/types/homebrew.ts`.
- Validators for refs, prerequisite AST, mechanics AST, and the five payload kinds.
- Fixture payloads for all acceptance examples.
- A static built-in `RulesContentRegistry` adapter.
- Compatibility tests for legacy characters and inventory.
- `docs/CHANGES-HB-0.md` with the final contract and deviations.

Required fixtures:

- +2 weapon.
- Strength-floor armor.
- Ring of invisibility.
- Four-stage sentient weapon with a 3rd-level slot and Bless aura.
- Full caster class.
- Partial caster class.
- Subclass template.
- Species with level 5 benefit.
- Repeatable feat with distinct choices.

Gate:

- Payload validation accepts every required fixture.
- Malformed nesting, duplicate IDs, invalid refs, and out-of-range values fail with field paths.
- Existing unit suite remains green.

Suggested tests:

- `tests/homebrewSchema.test.ts`
- `tests/homebrewMechanicsSchema.test.ts`
- `tests/contentRef.test.ts`

### Phase 1 - Versioned registry, storage, and API

**Risk:** High

**Goal:** Owners can create, clone, save, publish, list, compare metadata, archive, and read versioned content without character integration.

Deliverables:

- SQLite migration and migration test update.
- Store, access, DTO, and route modules.
- Explicit immutable save-version flow.
- Definition revision/`If-Match` conflict protection.
- Built-in baseline cloning.
- Owner-only unpublished access.
- Soft archive and immutable published versions.
- Homebrew Studio library shell with a JSON-backed temporary editor only if type-specific forms are not ready.
- `docs/CHANGES-HB-1.md`.

Gate:

- Alice cannot read or mutate Bob's private draft.
- A built-in item clone is a deep copy.
- Saving twice yields ordinals 1 and 2.
- Publishing v1 and then saving v2 does not mutate v1.
- A stale definition revision receives 409.
- Account deletion handling preserves referenced published versions or explicitly prevents unsafe deletion.

Suggested tests:

- `tests/homebrewStore.integration.test.ts`
- `tests/homebrewApi.integration.test.ts`
- `tests/homebrewAuthorization.integration.test.ts`

### Phase 2 - Runtime resolver and mechanics engine

**Risk:** High

**Goal:** Built-in and homebrew references resolve through one interface; declarative effects produce explainable character contributions.

Deliverables:

- Server and client registry adapters.
- Effect gate evaluator.
- Derived mechanic resolver with provenance.
- Legacy `CharacterEffect` and prose-parsed item adapters.
- Targeted weapon bonus support.
- Ability-floor support.
- Spell-slot bonus support.
- Local condition/d20 rider/aura support.
- `docs/CHANGES-HB-2.md`.

Gate:

- +2 weapon affects only attacks/damage made with that item.
- Strength-floor armor passes 18 -> 19 and 20 -> 20.
- Invisibility activates only with equip + attune + toggle.
- Removing a bonus slot produces a valid overdrawn presentation.
- Duplicate evaluation of the same effect instance is idempotent.
- Every applied contribution has source provenance.

Suggested tests:

- `tests/homebrewMechanics.test.ts`
- `tests/itemEffectResolution.test.ts`
- `tests/spellSlotContributions.test.ts`

### Phase 3 - Item Studio vertical slice

**Risk:** Medium-high

**Goal:** A creator can author a practical item and a player can use a pinned version on a character.

Deliverables:

- Item-specific editor.
- Clone-from-item search.
- Definition description, creator notes, base weight, slots, attunement, prerequisites, effects, and toggles.
- Character item instance state.
- Inventory/equipment detail controls.
- Version/source display.
- Explicit upgrade preview for items.
- Server validation on character save.
- `docs/CHANGES-HB-3.md`.

Gate scenario:

1. Clone a longsword.
2. Save/publish `Moonsteel Blade v1`.
3. Add `+2 weapon` effects.
4. Add it to a character.
5. Set instance notes, weight override, and `right hand`.
6. Equip it and confirm only its attack/damage rows gain +2.
7. Publish v2 with +3.
8. Confirm the existing character stays on v1.
9. Upgrade explicitly and confirm the preview and result.

Playwright:

- `QA/tests/homebrew-item-authoring.spec.ts`
- `QA/tests/homebrew-item-character.spec.ts`

### Phase 4 - Item stages, counters, and campaign-aware aura groundwork

**Risk:** High

**Goal:** Growing/sentient items are functional and auditable.

Deliverables:

- Stage editor and ordered stage validation.
- Manual advancement, counters, milestone labels, and stage history.
- Stage diff preview.
- DM approval setting for campaign-owned characters if required by product policy.
- Auditable item combat-event contract.
- Optional first automatic counters only where an authoritative event already exists.
- Aura resolution DTO that can later include nearby campaign allies.
- `docs/CHANGES-HB-4.md`.

Gate scenario:

- A four-stage weapon begins with +1.
- Counter progress is preserved across saves.
- Advancing to stage 2 changes it to +2.
- Stage 3 adds one 3rd-level spell slot.
- Stage 4 exposes a Bless aura.
- Reverting a stage restores the prior effects without corrupting used slots/resources.
- History records actor, time, old/new stage, and reason.

Do not claim "grows automatically as you fight" unless the weapon-hit/defeat event path is actually exercised in a live encounter.

### Phase 5 - Multiclass and generalized progression foundation

**Risk:** Critical

**Goal:** Make progression registry-driven and per-class before enabling automated homebrew classes.

Deliverables:

- `Character.classLevels` using `RulesContentRef`.
- Compatibility mirrors and one multiclass helper module.
- Total-level vs class-level call-site audit.
- Combined spell-slot logic, separate pact slots, per-class hit dice.
- Structured multiclass prerequisite evaluator.
- Level-up class picker.
- Registry injection into progression engine/state/validation.
- Generalized progression aggregation for class, subclass, species, and feats.
- Old manual-homebrew class behavior preserved.
- `docs/CHANGES-HB-5.md`.

Mandatory gates:

- A character with no `classLevels` is behaviorally unchanged.
- Fighter 3 / Wizard 1 gets Wizard level-1 features and correct combined slots.
- Paladin/Warlock keeps pact slots separate.
- Prerequisite toggle changes eligible multiclass options.
- Level-down unwinds the correct class level.
- Server progression validation rejects mismatched class refs, totals, rulesets, or inaccessible new content.
- Existing progression fixtures all remain green.

This phase should have an independent review agent before Phase 6 begins.

### Phase 6 - Class and Subclass Studio

**Risk:** Critical

**Goal:** Authors can create automated classes/subclasses and use them in creation and multiclass level-up.

Deliverables:

- Class and Subclass editors.
- Built-in template cloning.
- 1-20 level guide.
- Non/partial/full caster simple controls plus advanced tables.
- Starting and multiclass proficiencies.
- Structured prerequisites.
- Runtime packet normalization.
- Creation and level-up selection.
- Character-sheet features, resources, actions, spells, and class labels.
- Class/subclass version upgrade preview and snapshot rollback.
- `docs/CHANGES-HB-6.md`.

Gate scenarios:

- Clone Fighter, rename it, change level 3, publish, and build a level-5 character whose sheet contains the expected grants.
- Create a full caster from scratch and verify slots/known/prepared behavior at levels 1, 5, 11, and 20.
- Create a partial caster and verify standard or custom slot tables.
- Create a subclass whose parent is built-in, then one whose parent is homebrew.
- Reject a subclass paired with the wrong parent version.
- Multiclass into a homebrew class only when prerequisites pass.
- Publish a new class version and prove an existing character does not change.

This phase also requires an independent review agent.

### Phase 7 - Species and Feat Studio

**Risk:** High

**Goal:** Species and feats use the same registry, prerequisites, effects, choices, and progression.

Deliverables:

- Species editor with level guide.
- Species creation and level-up integration.
- Feat editor with repeatability rules.
- Instance-based feat selections and compatibility adapter for `ASIChoice`.
- Version upgrades and choice migration previews.
- `docs/CHANGES-HB-7.md`.

Gate scenarios:

- A species grants level-1 traits and a level-5 feature exactly once.
- Species prerequisites block creation server-side.
- A once-only feat cannot be taken twice.
- An unlimited feat can be repeated.
- A limited feat stops at its maximum.
- A distinct-choice feat rejects the same choice combination twice.
- Feat effects and granted spells appear with source provenance.

### Phase 8 - Campaign sharing, dependency management, and portability

**Risk:** High

**Goal:** Homebrew is usable at real tables without content disappearing or leaking.

Deliverables:

- DM campaign allowlist.
- Campaign library UI.
- New-use revocation with grandfathered pinned characters.
- Dependency graph for subclass parent, granted spell, required feat/class/species, and baseline provenance.
- Publish-time dependency validation.
- Bundle export/import with hashes and conflict handling.
- Campaign ally aura propagation if presence/range requirements are product-ready.
- `docs/CHANGES-HB-8.md`.

Gate:

- Private drafts never leak to campaign members.
- DM can allow a published version.
- Players can select only allowed/owned versions.
- Revocation blocks new use but existing characters still render.
- Export/import round-trips IDs, payloads, dependencies, and hashes without overwriting unrelated definitions.
- Cyclic dependencies fail validation.
- Aura recipients are removed promptly when source state, campaign presence, or eligibility changes.

### Phase 9 - Hardening, migration, accessibility, and release

**Risk:** High

**Goal:** Make the system supportable and safe to release.

Deliverables:

- Legacy adapters and migration tests.
- Character export/account export coverage for homebrew refs.
- Backup/restore drill including homebrew tables.
- Rate/size limits.
- Markdown/URL sanitization.
- Accessible modal/editor keyboard flows.
- Mobile editor and sheet pass.
- Performance profile for large libraries and level grids.
- Empty/error/offline states.
- Feature flag and staged rollout.
- Updated README, deployment docs, and release checklist.
- `docs/CHANGES-HB-9.md`.

Release gate:

- Full `npm run release:check`.
- Homebrew unit/integration suites.
- New Playwright authoring and character-lifecycle suites.
- Desktop and mobile manual pass.
- Two-browser version conflict test.
- Backup and restore drill.
- Authenticated hosted smoke test.
- No public launch claim without hosted manual confirmation.

---

## 15. Agent execution protocol

### 15.1 Orchestration rules

- Use one orchestrator for each phase.
- Assign separate implementation and review agents for Phases 2, 5, 6, and 8.
- Parallelize only non-overlapping work such as schema tests, editor components, and documentation.
- Do not let two agents edit `game.ts`, `db.ts`, `HeroSheet.tsx`, `LevelUpModal.tsx`, or progression files concurrently.
- Start each phase from a checkpoint commit and a clean understanding of `git status`.
- Read `AGENTS.md` and the relevant bundled Next.js 16.2.9 docs before route, data-access, caching, or security work.
- Re-anchor every file/symbol reference with `rg`; this proposal is a map, not proof that paths have not drifted.

### 15.2 Phase handoff packet

Every implementing agent receives:

- This proposal.
- The preceding phase changelog.
- Exact phase scope.
- Explicit non-goals.
- Required acceptance fixtures.
- Files it owns.
- Tests it must add.
- Commands it must run.
- The compatibility invariants in section 3.3.

### 15.3 Required changelog format

Each `docs/CHANGES-HB-N.md` includes:

1. Scope completed.
2. Files changed.
3. Data/schema decisions.
4. Compatibility decisions.
5. Test evidence with exact commands and counts.
6. Browser/runtime evidence.
7. Deviations from this proposal.
8. Known manual-only behavior.
9. Rollback notes.
10. Next-phase blockers.

No changelog entry means the phase is not accepted.

### 15.4 Stop conditions

An agent stops and reports instead of improvising when:

- A migration would delete or rewrite existing character data.
- A published version would need mutation.
- A progression change alters single-class built-in behavior.
- Authorization cannot be proved at the DAL.
- A requested mechanic would require arbitrary code execution.
- A content upgrade cannot be made reversible.
- The full test/build gate fails for a non-obvious cross-cutting reason.

---

## 16. Test strategy

### 16.1 Unit tests

- Payload schema and limits.
- Prerequisite three-state evaluation.
- Effect gates.
- Deterministic modifier ordering.
- Source-item targeting.
- Stacking/idempotency.
- Stage transitions.
- Version diffs.
- Combined spell slots.
- Per-class progression.
- Species level grants.
- Feat repeatability.

### 16.2 Integration tests

- SQLite migration from current revision.
- Definition/version transactions.
- Authorization and campaign sharing.
- Publish/deprecate/archive.
- Character save with pinned refs.
- Revoked access and grandfathered refs.
- Account deletion behavior.
- Export/import and backup/restore.

### 16.3 Component tests

- Editor validation navigation.
- Level grid editing.
- Prerequisite builder.
- Effect builder.
- Version history and diff.
- Item instance controls.
- Upgrade choice resolution.
- Keyboard and focus behavior.

### 16.4 End-to-end tests

1. Author -> publish -> share -> select -> play.
2. Built-in baseline clone.
3. Version pinning and upgrade.
4. Item equip/attune/toggle.
5. Sentient item stages.
6. Homebrew class creation and multiclass level-up.
7. Species delayed feature.
8. Repeatable feat.
9. Access revocation.
10. Two-browser edit conflict.

### 16.5 Property/fuzz tests

Use generated bounded payloads for:

- Prerequisite trees.
- Effect gate trees.
- Level tables.
- Stage graphs.
- Version-diff normalization.

Assertions:

- Validation terminates.
- Resolver output is deterministic.
- No duplicate contribution is applied.
- Round-trip serialization preserves normalized payloads.
- Invalid cycles/depth/size are rejected.

---

## 17. Performance and storage budgets

Initial limits should be conservative and configurable in server code:

- Definition title: 120 characters.
- Description/rules text: 20,000 characters per version.
- Creator notes: 10,000 characters and owner-only.
- Total payload JSON: 256 KB per version.
- Effects: 100 per payload.
- Prerequisite/effect nesting: depth 8.
- Stages: 20.
- Level rows: exactly 1-20 for classes; sparse but bounded 1-20 for species/subclasses.
- Versions returned in list views: metadata only, paginated.
- Resolver request: bounded number of refs.

Profile:

- Homebrew library at 1,000 definitions.
- One character with 100 inventory rows and 50 active contributions.
- A class editor with all 20 levels expanded.
- Campaign library with 100 allowed definitions.

Do not put all version payloads into the initial ruleset response or client bundle.

---

## 18. Security checklist

- Server-only DAL imports.
- Authentication on every route.
- Owner/campaign checks inside store operations.
- Minimal DTOs.
- No unpublished payloads in search results.
- No creator notes outside owner responses.
- Parameterized SQLite statements.
- Body and collection limits.
- URL allowlist/normalization for images.
- Plain text or sanitized Markdown only.
- No HTML persistence without sanitization.
- No executable expressions.
- No client-authoritative prerequisite or progression checks.
- `If-Match`/revision checks for definition metadata.
- Transactional publish/share operations.
- Audit records for publish, deprecate, share, revoke, upgrade, and stage change.

---

## 19. Explicit non-goals for the first release

- Public global marketplace or ratings.
- Paid content/licensing storefront.
- Collaborative multi-author editing.
- Arbitrary scripting or plugins inside homebrew.
- AI-generated balance certification.
- Full spatial aura measurement on a battle map that Dreamwright does not own.
- Automatic weapon kill attribution without authoritative combat events.
- Silent bulk upgrade of characters.
- Deleting published or character-referenced versions.
- Converting every legacy built-in record into database homebrew rows.

These can be future projects after the content registry proves stable.

---

## 20. Final acceptance matrix

| Requirement | Acceptance evidence |
|---|---|
| Create from scratch | All five editors publish a valid new definition. |
| Use existing baseline | Clone preserves provenance and deep-copies payload. |
| Save versions | Named immutable versions and diffs are visible. |
| Item notes | Creator and per-instance notes are separate and persist. |
| Item weight | Base and per-instance override affect carry weight. |
| Body location | Suggested/custom location persists and conflict warning appears. |
| +2 weapon | Only source weapon attacks and damage receive +2. |
| Strength 19 armor | Equipped floor applies only below 19. |
| Ring invisibility | Equip + attune + toggle gates the condition. |
| Growing weapon | Stage/counter/history changes mechanics deterministically. |
| Extra level-3 slot | Slot maximum and overdraw behavior are correct. |
| Bless aura | Self/local works; campaign ally behavior is tested before claimed. |
| Class from template | Cloned class can change and publish independent progression. |
| Level guide | Levels 1-20 show features, choices, resources, and spells. |
| Character sheet updates | Features/resources/actions/spells resolve from pinned version. |
| Multiclass integration | Per-class level-up, prerequisites, HP, and slots pass gates. |
| Caster mode | None/full/partial plus advanced half/third/pact/custom work. |
| Species delayed benefit | Benefit applies exactly once at configured level. |
| Species prerequisites | Creation and server save reject ineligible selection. |
| Feat prerequisites | Picker and server agree. |
| Repeatable feat | Once/limited/unlimited/distinct-choice semantics pass. |
| Version pinning | Publishing v2 leaves v1 characters unchanged. |
| Upgrade | Diff, new choices, snapshot, apply, and rollback work. |
| Campaign access | DM allow/revoke controls new use without breaking existing sheets. |
| Existing data | Built-in and legacy manual-homebrew characters remain valid. |

---

## 21. Recommended first implementation prompt

Use this only for Phase 0:

> Read `AGENTS.md`, `docs/ai-project-proposal-homebrew-studio.md`, the installed Next.js docs relevant to any Next.js file you touch, `src/types/game.ts`, `src/lib/itemCatalog.ts`, `src/lib/effects.ts`, and `src/lib/progression/types.ts`. Implement Phase 0 only: add the versioned homebrew content types and pure validators for content refs, prerequisite trees, effect gates/effects, and the five payload kinds. Add fixtures for the +2 weapon, Strength-floor armor, Ring of Invisibility, four-stage sentient weapon, full/partial caster classes, delayed species feature, and repeatable feat. Add focused Vitest coverage for valid fixtures and hostile malformed payloads. Do not add database tables, API routes, UI, or character persistence yet. Preserve all current types and behavior. Write `docs/CHANGES-HB-0.md` with exact verification evidence and deviations.

That prompt deliberately stops before persistence. The contracts deserve their own review because every later phase depends on them.
