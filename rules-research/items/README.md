# Forge & Fable
## DeepSeek Multi-Agent Research and Reconciliation Plan for an Exhaustive D&D 5e Item Catalog

### Purpose

Use a coordinated team of DeepSeek subagents to:

1. Audit the item data already present in Forge & Fable
2. Define a precise, defensible meaning of “all official D&D 5e items”
3. Build a source-by-source research manifest
4. Research all in-scope item records
5. Normalize them into one canonical schema
6. Compare the researched catalog against the existing Forge & Fable item catalog
7. Identify missing, duplicate, incomplete and conflicting records
8. Add confirmed missing items without breaking existing characters or inventories
9. Produce permanent coverage, provenance and validation tooling so the catalog can be audited again later

This plan is intentionally conservative. No subagent should directly dump scraped content into `src/data/items.json`.

---

# 1. Verified repository starting point

The current repository contains the primary static item catalog at:

```text
src/data/items.json
```

Runtime users, characters and campaigns use the local SQLite database at:

```text
data/forge.db
```

The coordinator must verify whether item definitions are exclusively loaded from `src/data/items.json` or whether any item seed, cache, database table, migration, API route or generated derivative also exists.

Do not assume “database” means SQLite in this task. The canonical item source may currently be the JSON file.

The current item record shape appears to include fields similar to:

```ts
type CurrentItemRecord = {
  id: string;
  name: string;
  image: string;
  description: string;
  category: string;
  rarity: string;
  classification: string;
  ac: string;
  damage: string;
  damageType: string;
  properties: string;
  cost: string;
  attunement: boolean;
};
```

This is only a starting observation. The repository audit agent must determine the actual TypeScript types, imports, consumers and assumptions before any schema change.

---

# 2. Definition of “exhaustive”

An exhaustive catalog is impossible to prove without a locked scope and source manifest.

For this project, “exhaustive” should mean:

> Every official first-party Dungeons & Dragons Fifth Edition item that falls within the approved inclusion rules, from every source listed in a versioned source manifest, researched as of a recorded cutoff date.

The final report must never claim “all D&D items” without also naming:

- Rules families included
- Sourcebooks included
- Adventures included
- Digital or promotional sources included
- Partnered content policy
- Playtest policy
- Third-party policy
- Research cutoff date
- Sources that could not be accessed
- Items requiring manual review

---

# 3. Required scope decision

The coordinator should use the following default scope unless the repository owner explicitly changes it.

## 3.1 Include

Include official first-party Fifth Edition items that can reasonably exist as a character, party or campaign inventory object, including:

### Mundane equipment

- Simple melee weapons
- Simple ranged weapons
- Martial melee weapons
- Martial ranged weapons
- Firearms and setting-specific weapons
- Ammunition
- Armor
- Shields
- Adventuring gear
- Containers
- Equipment packs and their components
- Tools
- Artisan’s tools
- Musical instruments
- Gaming sets
- Kits
- Spellcasting foci
- Holy symbols
- Druidic foci
- Mounts
- Tack and harness
- Land vehicles
- Water vehicles
- Air vehicles
- Spelljamming vehicles where the app intends to support them
- Siege equipment
- Poisons
- Explosives
- Consumable mundane items
- Food and drink with mechanical or inventory relevance
- Setting-specific mundane gear

### Magic items

- Magic weapons
- Magic armor
- Magic shields
- Wondrous items
- Potions
- Oils
- Scrolls
- Rings
- Rods
- Staves
- Wands
- Artifacts
- Sentient items
- Cursed items
- Magical tattoos
- Magical ammunition
- Magical vehicles
- Figurines and item families
- Items with multiple named variants
- Items with random tables
- Items granted by official adventures or settings
- Items with character-option prerequisites
- Items that require attunement
- Items that require attunement by a class, species, alignment or other condition

### Narrative and adventure items

Include a named adventure object when at least one of these is true:

- It has explicit mechanics
- It can be equipped
- It can be consumed
- It can be carried as inventory
- It has charges, uses or activation rules
- It has a defined rarity or item category
- It is intended to be awarded to or used by player characters
- It is necessary to reproduce a player-facing character or campaign state

Mark story-critical items with appropriate source and spoiler metadata.

## 3.2 Include only after an explicit schema decision

These may belong in the item catalog, a separate treasure catalog or another data model:

- Currency
- Gems
- Art objects
- Trade goods
- Services
- Lodging
- Lifestyle expenses
- Ships and structures
- Spell components with listed prices
- Trinkets
- Bundled starting equipment options
- Packs as a single convenience record
- Individual pack contents
- Treasure parcels
- NPC equipment
- Monster-carried weapons
- Vehicles with combat stat blocks
- Buildings and strongholds

The schema agent must recommend where these belong.

## 3.3 Exclude by default

- Homebrew
- Unearthed Arcana
- Playtest packets
- Unofficial wiki inventions
- Fan conversions
- Third-party products
- Partnered products not published as official first-party D&D material
- Items from earlier editions that lack an official Fifth Edition version
- Video-game-only objects
- Monster attacks presented as weapons but not defined as obtainable items
- Decorative story props with no inventory or mechanical relevance
- Services that cannot be possessed
- Rules concepts that are not items
- Feats
- Spells
- Class features
- Species traits
- Conditions

Every exclusion should be logged rather than silently discarded.

---

# 4. Rules-version policy

Forge & Fable should not overwrite 2014 mechanics with 2024 mechanics or vice versa.

Treat these as separate rules families:

```text
2014
2024
```

Use a specific field such as:

```ts
rulesVersion: "2014" | "2024" | "shared";
```

When the same item name exists in both rules families:

- Compare the full mechanics
- Preserve separate records if mechanics differ
- Use shared records only when the item is mechanically identical and the application can safely resolve it
- Do not label a 2014 item as obsolete solely because a 2024 version exists
- Do not silently update existing characters
- Preserve legacy IDs referenced by saved characters

Recommended identity:

```text
canonical item concept
  ├── 2014 rules record
  └── 2024 rules record
```

---

# 5. Source and licensing policy

## 5.1 Source priority

Use this order:

1. Official SRD documents
2. Official D&D Beyond rules pages
3. Official digital sourcebook or compendium content available to the researcher
4. Official errata
5. Official Sage Advice only for clarification, not item creation
6. Secondary indexes only to discover candidates
7. Community sources only as discrepancy signals

A community wiki must never be the sole authority for a final record.

## 5.2 Open-content lane

For content published under the applicable SRD or Creative Commons license:

- Preserve required attribution
- Record the exact SRD version
- Store source metadata
- Follow the license terms
- Full descriptions may be used only when the license permits it

## 5.3 Non-SRD official content lane

For copyrighted official sourcebooks outside the open rules:

- Record item name
- Source
- Page or compendium location
- Category
- Rarity
- Attunement
- Structured mechanics necessary for application behavior
- A concise original summary or paraphrase where needed
- Do not copy long copyrighted descriptions verbatim
- Do not reproduce boxed text, lore passages or full book sections
- Flag inaccessible entries rather than guessing

## 5.4 Provenance requirement

Every researched record must include:

```ts
type ItemProvenance = {
  sourceCode: string;
  sourceTitle: string;
  rulesVersion: "2014" | "2024" | "shared";
  sourceType:
    | "srd"
    | "core-book"
    | "supplement"
    | "setting"
    | "adventure"
    | "anthology"
    | "digital"
    | "promotional";
  page?: number;
  section?: string;
  officialUrlKey?: string;
  license?: string;
  researchedAt: string;
  researcherAgent: string;
  verificationStatus:
    | "single-source"
    | "cross-checked"
    | "manual-review";
};
```

If provenance is not available, the item is not ready for automatic insertion.

---

# 6. Multi-agent team

Use one coordinator and isolated subagents.

No research subagent may directly edit `src/data/items.json`.

Each subagent writes to its own directory under:

```text
rules-research/items/agents/
```

## 6.1 Agent 0: Coordinator

Responsibilities:

- Own the task plan
- Create the working branch
- Establish file conventions
- Assign source groups
- Prevent duplicate work
- Enforce schema
- Review subagent outputs
- Run reconciliation
- Approve integration batches
- Produce final report

The coordinator is the only agent allowed to merge candidate records into the canonical normalized catalog.

## 6.2 Agent 1: Repository and consumer audit

Research:

- All imports of `src/data/items.json`
- Item-related TypeScript types
- Inventory UI
- Character creation equipment selection
- Starting equipment
- Loot or campaign inventory
- API routes
- SQLite schema
- Migrations
- Tests
- Scripts
- Generated files
- ID references
- Saved-character compatibility

Deliver:

```text
rules-research/items/repo-audit.md
rules-research/items/current-schema.json
rules-research/items/item-consumers.json
rules-research/items/id-compatibility-report.md
```

Must answer:

- What is the actual canonical item store?
- Are item IDs persisted in character JSON or SQLite?
- Which fields are required at runtime?
- Which fields are display-only?
- Can unknown fields be added safely?
- Which components parse `properties` as text?
- What does `cost` represent?
- Are costs stored in copper pieces?
- Is rarity used for mundane gear?
- Are quantities stored on item definitions or inventory entries?
- Are item mechanics executable or descriptive?

## 6.3 Agent 2: Existing catalog profiler

Analyze every current record.

Deliver:

```text
rules-research/items/current-catalog-profile.json
rules-research/items/current-catalog-profile.md
rules-research/items/current-catalog-normalized.json
rules-research/items/current-data-anomalies.json
```

Profile:

- Record count
- Category counts
- Classification counts
- Rarity counts
- Duplicate names
- Duplicate IDs
- Missing required fields
- Empty mechanic fields
- Invalid cost values
- Inconsistent capitalization
- Inconsistent punctuation
- Curly versus straight apostrophes
- Singular versus plural names
- Quantity suffixes
- Suspicious generated descriptions
- Items with incorrect or questionable rarity
- Weapons missing damage type
- Armor stored only as display text
- Unstructured properties
- Magic items lacking source data
- Records that appear to combine multiple variants

Do not modify source data in this phase.

## 6.4 Agent 3: Scope and source-manifest researcher

Create an exhaustive list of official Fifth Edition products and sources that may contain items.

For every source, record:

```ts
type ItemSourceManifestEntry = {
  sourceCode: string;
  title: string;
  publicationDate?: string;
  rulesFamily: "2014" | "2024" | "mixed";
  sourceType: string;
  official: boolean;
  potentiallyContainsItems: boolean;
  accessStatus:
    | "accessible"
    | "partially-accessible"
    | "unavailable";
  inclusionStatus:
    | "included"
    | "excluded"
    | "pending-review";
  exclusionReason?: string;
  assignedAgent?: string;
  researchStatus:
    | "not-started"
    | "in-progress"
    | "complete"
    | "blocked";
  expectedCategories?: string[];
  discoveredItemCount?: number;
  verifiedItemCount?: number;
};
```

Deliver:

```text
rules-research/items/source-manifest.json
rules-research/items/source-manifest.md
rules-research/items/source-access-blockers.md
```

The manifest must include:

- 2014 core books
- 2024 core books
- SRD 5.1
- Current SRD 5.2.x
- Rules supplements
- Setting books
- Bestiaries containing player-usable items
- Adventures
- Adventure anthologies
- Starter products
- Essentials products
- Boxed sets
- Digital-only official releases
- Promotional official releases
- Errata
- Reprints or revisions

The agent must distinguish a reprint from a genuinely new item source.

## 6.5 Agent 4: Schema architect

Design a canonical schema that can represent the full catalog without breaking the current application.

Deliver:

```text
rules-research/items/proposed-item-schema.ts
rules-research/items/schema-mapping.md
rules-research/items/schema-migration-options.md
rules-research/items/schema-decision-log.md
```

The proposed schema should consider:

```ts
type CanonicalItem = {
  id: string;
  legacyIds?: string[];

  name: string;
  normalizedName: string;
  aliases?: string[];

  rulesVersion: "2014" | "2024" | "shared";
  sourceCode: string;
  sourceTitle?: string;
  page?: number;
  license?: string;

  category: string;
  subcategory?: string;
  classification?: string;

  rarity?:
    | "common"
    | "uncommon"
    | "rare"
    | "very-rare"
    | "legendary"
    | "artifact"
    | "varies"
    | "none";

  mundane?: boolean;
  magical?: boolean;
  consumable?: boolean;
  stackable?: boolean;
  quantityUnit?: string;

  costCp?: number;
  weightLb?: number;

  description: string;
  shortDescription?: string;

  attunement?: {
    required: boolean;
    requirementText?: string;
    classes?: string[];
    species?: string[];
    alignments?: string[];
  };

  weapon?: {
    category?: string;
    rangeType?: "melee" | "ranged";
    damageDice?: string;
    damageType?: string;
    versatileDamageDice?: string;
    normalRangeFt?: number;
    longRangeFt?: number;
    properties?: string[];
    mastery?: string;
    ammunitionType?: string;
    magicBonus?: number;
    baseItemId?: string;
  };

  armor?: {
    category?: string;
    baseAc?: number;
    addDex?: boolean;
    maxDexBonus?: number;
    strengthRequirement?: number;
    stealthDisadvantage?: boolean;
    magicBonus?: number;
    baseItemId?: string;
  };

  tool?: {
    toolType?: string;
    abilitySuggestions?: string[];
  };

  container?: {
    capacityWeightLb?: number;
    capacityVolume?: string;
  };

  consumableRules?: {
    uses?: number;
    duration?: string;
  };

  charges?: {
    maximum?: number;
    recharge?: string;
    destroyOnEmpty?: boolean;
  };

  vehicle?: {
    vehicleType?: string;
    speed?: string;
    capacity?: string;
    armorClass?: number;
    hitPoints?: number;
    damageThreshold?: number;
  };

  tags?: string[];
  spoiler?: boolean;

  provenance: ItemProvenance[];
};
```

The schema architect must recommend one of these:

### Option A: Extend current records in place

Use when unknown fields are safely ignored and existing consumers remain compatible.

### Option B: Add a canonical catalog and generate legacy records

Example:

```text
src/data/items.canonical.json
scripts/build-items-legacy.mjs
src/data/items.json
```

Use when the current schema is too weak but existing consumers require it.

### Option C: Migrate consumers to the new schema

Use only if the migration can be completed and tested in controlled batches.

The coordinator should prefer Option B if it gives strong data without risking the app.

## 6.6 Agent 5: 2014 mundane-equipment researcher

Research all in-scope mundane equipment from the 2014 rules family.

Coverage:

- Weapons
- Armor
- Shields
- Ammunition
- Adventuring gear
- Packs
- Tools
- Foci
- Holy symbols
- Mounts
- Tack
- Vehicles
- Trade goods if included
- Poisons
- Explosives
- Siege equipment
- Setting-specific mundane equipment

Deliver:

```text
rules-research/items/agents/mundane-2014/candidates.json
rules-research/items/agents/mundane-2014/source-coverage.json
rules-research/items/agents/mundane-2014/issues.md
```

## 6.7 Agent 6: 2024 mundane-equipment researcher

Research the equivalent 2024 rules-family data.

Special attention:

- Weapon properties
- Weapon Mastery
- Tool changes
- Revised armor or weapon text
- Revised prices
- Revised pack contents
- Revised adventuring gear actions
- Revised crafting relevance
- Changes that look identical by name but differ mechanically

Deliver the same files under:

```text
rules-research/items/agents/mundane-2024/
```

## 6.8 Agent 7: Core magic-item researcher

Research:

- 2014 core magic items
- 2024 core magic items
- SRD magic items
- Core artifacts
- Cursed items
- Sentient items
- Generic magic-item templates
- Variant families

Do not flatten item families prematurely.

Examples of variant problems the agent must handle:

- One item name with color or type variants
- One enchantment applicable to many base weapons
- One armor enchantment applicable to multiple armor types
- Tables that determine one of several versions
- Scaling items
- Items with dormant, awakened or exalted states
- Items with legacy and revised versions

Deliver:

```text
rules-research/items/agents/core-magic/candidates.json
rules-research/items/agents/core-magic/variant-groups.json
rules-research/items/agents/core-magic/issues.md
```

## 6.9 Agent 8: Rules-supplement magic-item researcher

Create child agents by source group.

Suggested grouping:

- General rules supplements
- Dragon-focused content
- Giant-focused content
- Planar content
- Multiverse content
- Character-option supplements
- Bestiaries with player-facing items

Each child agent writes to a source-specific subfolder.

No child agent edits another agent’s output.

## 6.10 Agent 9: Setting-item researcher

Create child agents for official settings.

Examples of source groups:

- Eberron
- Forgotten Realms
- Ravenloft
- Ravnica
- Theros
- Strixhaven
- Spelljammer
- Planescape
- Dragonlance
- Exandria only if it passes the approved official-content policy
- Other official settings in the source manifest

Pay attention to:

- Setting-specific weapons
- Vehicles
- Magical technology
- Dragonmarks or gifts that are not actually items
- Guild equipment
- Background-granted equipment
- Faction items
- Firearms
- Spelljamming gear

## 6.11 Agent 10: Adventure-item researcher

Fan out by adventure or anthology.

The source manifest agent should assign every included adventure.

Adventure agents must:

- Search appendices
- Search treasure sections
- Search NPC possessions
- Search named relics
- Search keys, books, maps and plot devices with mechanics
- Distinguish item records from narrative props
- Mark spoilers
- Record whether an item is reusable outside the adventure
- Avoid copying long adventure text

Deliver one candidate file per source.

## 6.12 Agent 11: Edge-category researcher

Research categories easily missed by ordinary magic-item lists:

- Poisons
- Diseases represented as items
- Explosives
- Firearms and ammunition
- Siege equipment
- Vehicles
- Mount gear
- Spellcasting foci
- Holy symbols
- Druidic foci
- Tools
- Kits
- Gaming sets
- Musical instruments
- Containers
- Food and drink
- Spell components with prices
- Trinkets
- Charms that may not be items
- Supernatural gifts that should be excluded
- Item-like blessings that should be excluded
- Spell scroll variants
- Tattoos
- Prosthetics
- Symbionts
- Dragonshards
- Spellbooks
- Manuals and tomes
- Figurines
- Decks
- Bags with color variants
- Randomized item families

This agent primarily detects omissions and category mistakes.

## 6.13 Agent 12: Comparator and deduplication engineer

Build deterministic comparison tooling.

Deliver:

```text
scripts/audit-items.mjs
scripts/compare-item-catalogs.mjs
scripts/build-item-report.mjs
rules-research/items/comparison-report.json
rules-research/items/comparison-report.md
rules-research/items/missing-items.json
rules-research/items/conflicting-items.json
rules-research/items/duplicate-groups.json
rules-research/items/manual-review.json
```

## 6.14 Agent 13: Mechanics and schema QA

Verify that records are not merely present by name.

Check:

- Damage
- Damage type
- Range
- Properties
- Mastery
- Armor Class
- Dexterity limits
- Strength requirements
- Stealth disadvantage
- Weight
- Cost
- Rarity
- Attunement
- Charges
- Recharge
- Activation
- Saving throws
- Duration
- Base item
- Consumable state
- Source
- Rules version

An item with the correct name but materially incomplete mechanics should be classified as `incomplete`, not `present`.

## 6.15 Agent 14: Provenance, licensing and final QA

Review:

- Official-source status
- Source codes
- Rules versions
- Attribution
- Description originality
- Verbatim-copy risk
- Missing citations
- Inaccessible sources
- Unsupported claims
- Spoiler markers

No item enters the automatic merge set without provenance approval.

---

# 7. Working-directory structure

Create:

```text
rules-research/
  items/
    README.md
    source-manifest.json
    source-manifest.md
    current-schema.json
    current-catalog-profile.json
    current-catalog-normalized.json
    proposed-item-schema.ts
    schema-mapping.md
    normalized-catalog.json
    comparison-report.json
    comparison-report.md
    missing-items.json
    conflicting-items.json
    duplicate-groups.json
    incomplete-items.json
    manual-review.json
    rejected-candidates.json
    provenance-report.csv
    integration-plan.md
    final-coverage-report.md
    agents/
      repo-audit/
      mundane-2014/
      mundane-2024/
      core-magic/
      supplements/
      settings/
      adventures/
      edge-categories/
```

Generated research artifacts should remain committed unless they include copyrighted source text that should not be retained.

---

# 8. Research record format

Every subagent must return candidates in a common envelope.

```ts
type ResearchCandidate = {
  candidateId: string;
  name: string;
  normalizedName: string;
  aliases?: string[];

  rulesVersion: "2014" | "2024" | "shared";
  sourceCode: string;
  sourceTitle: string;
  page?: number;
  section?: string;

  category: string;
  subcategory?: string;
  classification?: string;

  structuredData: Record<string, unknown>;

  shortDescription?: string;
  descriptionStatus:
    | "open-license"
    | "original-summary"
    | "metadata-only";

  sourceEvidence: {
    primarySource: string;
    secondaryChecks?: string[];
    accessedAt: string;
  };

  confidence: number;
  issues?: string[];
  spoiler?: boolean;
};
```

Confidence scale:

```text
1.00  Two authoritative sources agree
0.95  One authoritative source plus errata check
0.85  One authoritative source, fully accessible
0.70  Partial authoritative access
0.50  Reliable index but primary source unavailable
below 0.50  Discovery lead only, never auto-merge
```

---

# 9. Name normalization

The comparator must normalize only for matching.

Never replace display names solely because normalization changed them.

Normalize:

- Unicode form
- Curly and straight apostrophes
- Em dash and hyphen differences
- Repeated spaces
- Case
- Trailing punctuation
- Parenthetical quantities
- Singular and plural where a verified alias exists
- “+1 Weapon” versus “Weapon, +1”
- “Potion of X” versus “X Potion” only through an alias table
- “Armor of X” variant formatting
- Color variants
- Roman numerals
- Edition suffixes
- Legacy labels

Example:

```ts
function normalizeItemName(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
```

Do not use fuzzy matching alone to merge records.

---

# 10. Match classification

Every candidate must receive one result.

```ts
type MatchStatus =
  | "exact"
  | "exact-name-different-version"
  | "alias-match"
  | "probable-match"
  | "variant-match"
  | "present-but-incomplete"
  | "mechanics-conflict"
  | "duplicate-existing"
  | "missing"
  | "out-of-scope"
  | "manual-review";
```

## 10.1 Exact

Same canonical name, source or rules version and compatible mechanics.

## 10.2 Exact name, different version

Same display name but 2014 and 2024 mechanics differ.

Do not merge.

## 10.3 Alias match

Verified alias maps to the existing record.

## 10.4 Variant match

The researched item is represented by an existing generic family.

The report must say whether the app can actually instantiate the variant.

## 10.5 Present but incomplete

Name exists but required mechanics or provenance are missing.

## 10.6 Mechanics conflict

Existing and researched mechanics disagree.

Do not auto-correct without a source review.

## 10.7 Missing

No acceptable match exists.

---

# 11. Comparison algorithm

Use staged matching:

1. Stable external or source ID, if available
2. Exact canonical ID
3. Exact normalized name plus rules version
4. Exact normalized name plus source
5. Verified alias
6. Base item plus enchantment
7. Variant-family logic
8. Token similarity for review suggestions
9. Manual review

Auto-merge thresholds:

```text
Automatic present match: confidence >= 0.95
Automatic missing classification: confidence >= 0.90 and no probable match
Manual review: anything ambiguous
```

Fuzzy matching may suggest pairs but may never automatically merge them.

---

# 12. ID policy

Existing IDs may be referenced by saved characters.

Therefore:

- Never regenerate all existing IDs
- Never renumber IDs
- Never replace an existing ID without a migration
- Preserve legacy IDs
- New IDs must be deterministic
- New IDs must include rules version or source when collisions are possible

Recommended new ID pattern:

```text
item:<rulesVersion>:<sourceCode>:<normalized-slug>
```

Example:

```text
item:2024:dmg:flame-tongue
```

If the application requires simpler IDs, keep an external canonical ID in a new field.

---

# 13. Variant policy

The team must decide whether variants are:

- Separate item records
- One item with variant data
- A template plus base item
- A generated runtime combination

Examples requiring explicit handling:

- Weapon, +1
- Armor, +1
- Ammunition, +1
- Dragon scale variants
- Figurines
- Bags of tricks
- Ioun stones
- Spell scroll levels
- Instrument families
- Giant belts
- Manuals and tomes
- Dragon-touched focus variants
- Scaling or awakening states

Do not create hundreds of duplicated prose records when a template model is more accurate.

Do not use a template model if the current inventory system cannot represent the resulting item.

Document the tradeoff.

---

# 14. Integration gates

## Gate 1: Repository audit approved

No schema or data edits before the consumer audit is complete.

## Gate 2: Scope manifest approved

No “exhaustive” claim before every source has a status.

## Gate 3: Schema approved

No candidate merge before the canonical schema and compatibility strategy are selected.

## Gate 4: Research coverage complete

Every included source must be complete, blocked or explicitly pending.

## Gate 5: Comparison report approved

The owner should be able to review:

- Missing
- Incomplete
- Conflicting
- Duplicate
- Excluded
- Blocked

## Gate 6: Batch integration

Add records in safe batches.

Suggested order:

1. 2014 mundane equipment corrections
2. 2024 mundane equipment
3. SRD magic items
4. Core magic items
5. Supplements
6. Settings
7. Adventures
8. Edge categories
9. Conflict corrections
10. Optional narrative items

---

# 15. Merge rules

## 15.1 New items

New records may be added when:

- In scope
- Provenance complete
- Confidence acceptable
- Schema valid
- No unresolved probable match
- Description policy satisfied
- Tests pass

## 15.2 Existing incomplete records

Do not replace the entire record blindly.

Patch only verified fields.

Preserve:

- Existing ID
- Working image mapping
- User-facing aliases
- Compatibility fields

Add:

- Provenance
- Rules version
- Structured mechanics
- Corrected values

## 15.3 Conflicts

For each conflict, produce:

```text
Existing value
Researched value
Source
Rules version
Recommended action
Compatibility risk
```

No bulk overwrite of conflicts.

## 15.4 Deletions

Do not delete existing records during the first integration pass.

Mark suspected duplicates or invalid records as deprecated.

Use:

```ts
deprecated?: boolean;
replacedBy?: string;
```

Remove only after saved-data compatibility is proven.

---

# 16. Validation tooling

Create a validator that fails on:

- Duplicate IDs
- Invalid rules version
- Invalid category
- Invalid rarity
- Negative cost
- Negative weight
- Invalid damage dice
- Invalid damage type
- Invalid property
- Missing source
- Missing provenance
- Missing attunement requirement text when required
- Magic item with no magical flag
- Mundane item with unexplained magic rarity
- Weapon with no damage data unless intentionally non-damaging
- Armor with no AC data
- Duplicate source-name-version tuple
- Broken base-item reference
- Broken replacement reference
- Unknown image key
- Description policy violation marker

Suggested command:

```text
npm run validate:items
```

---

# 17. Required tests

Add tests for:

## Catalog integrity

- Unique IDs
- Stable legacy IDs
- Valid references
- Valid categories
- Valid rules versions
- Valid sources

## Existing behavior

- Character inventory loads
- Existing saved characters load
- Starting equipment works
- Equipment search works
- Item filtering works
- Weapon attacks work
- Armor Class calculations work
- Attunement works
- Consumables work where supported
- Custom items remain unaffected

## Version behavior

- 2014 and 2024 records can coexist
- Same-name versions do not overwrite each other
- Source filters can distinguish them
- Existing characters remain on their existing record

## UI behavior

- Long names do not break cards
- Missing images use fallback
- Item descriptions remain readable
- Variant labels display correctly
- Source and rules-version labels are accessible

---

# 18. Reporting

The final coverage report must include:

```text
Research cutoff date
Rules families
Total included sources
Completed sources
Blocked sources
Excluded sources
Current records audited
Research candidates found
Exact matches
Alias matches
Variant matches
Missing records
Incomplete records
Mechanics conflicts
Duplicate groups
Manual-review records
Records added
Records patched
Records deprecated
Tests run
Known remaining gaps
```

Do not report a single total without explaining the scope.

---

# 19. Commit strategy

Use small, reviewable commits.

Examples:

```text
research(items): add source manifest and scope
research(items): profile current catalog
data(items): add canonical schema and validator
data(items): reconcile 2014 mundane equipment
data(items): add 2024 mundane equipment
data(items): add SRD magic items
data(items): add core magic-item gaps
data(items): add supplement item gaps
data(items): add setting item gaps
data(items): add adventure item gaps
test(items): add catalog integrity coverage
docs(items): publish final coverage report
```

Do not combine the entire catalog into one unreviewable commit.

---

# 20. Initial PowerShell workflow

Run from the repository root:

```powershell
Set-Location E:\forge-and-fable

git status --short
git switch -c research/exhaustive-item-catalog

New-Item -ItemType Directory -Force `
  rules-research\items\agents | Out-Null

Copy-Item `
  src\data\items.json `
  rules-research\items\baseline-items.json
```

Do not continue if the working tree contains unrelated uncommitted changes that could be overwritten.

---

# 21. Coordinator execution order

## Phase A: Audit only

1. Spawn repository audit agent
2. Spawn existing catalog profiler
3. Spawn source-manifest agent
4. Spawn schema architect
5. Wait for all four
6. Reconcile disagreements
7. Write `phase-a-findings.md`
8. Do not edit production data

## Phase B: Parallel research

1. Lock schema version
2. Lock source manifest
3. Assign source groups
4. Spawn mundane 2014 and 2024 agents
5. Spawn core magic agent
6. Spawn supplement child agents
7. Spawn setting child agents
8. Spawn adventure child agents
9. Spawn edge-category agent
10. Validate every candidate file

## Phase C: Comparison

1. Normalize current records
2. Normalize researched candidates
3. Run deterministic matcher
4. Produce comparison report
5. Run mechanics QA
6. Run provenance QA
7. Resolve duplicate assignments
8. Separate automatic and manual queues

## Phase D: Integration

1. Create backup
2. Add schema compatibility layer
3. Integrate one category batch
4. Run tests
5. Open app and manually inspect
6. Commit
7. Repeat

## Phase E: Final verification

1. Re-run source coverage
2. Re-run comparison
3. Confirm no approved missing records remain
4. Confirm all blockers are documented
5. Run lint
6. Run build
7. Run tests
8. Produce final report

---

# 22. Stop conditions

A subagent must stop and report rather than guess when:

- A source is inaccessible
- Two official sources conflict
- The rules version is unclear
- An item may be a feature rather than an item
- A name collision cannot be resolved
- The record requires a schema the app cannot represent
- The description would require copying copyrighted text
- A proposed ID could break saved characters
- A generic template and concrete variants cannot both be represented safely
- A source appears unofficial
- A source is partnered and its inclusion policy is unresolved

---

# 23. Acceptance criteria

The task is complete only when:

1. The current catalog has been fully profiled.
2. Every official source in the approved scope has a manifest entry.
3. Every included source is complete or explicitly blocked.
4. 2014 and 2024 mechanics are versioned separately.
5. Every candidate has provenance.
6. Missing, incomplete, duplicate and conflicting records are separated.
7. Fuzzy matching has not performed automatic merges.
8. Existing IDs are preserved.
9. Existing saved characters still load.
10. Every inserted item passes schema validation.
11. Every inserted item has source metadata.
12. Non-SRD descriptions comply with the description policy.
13. Missing items are integrated in reviewable batches.
14. Lint passes.
15. Build passes.
16. Tests pass.
17. The final comparison shows no unresolved confirmed missing items in accessible included sources.
18. Remaining inaccessible or ambiguous records are documented.
19. A repeatable audit command exists.
20. The final report states the exact scope and cutoff date.

---

# 24. Copy-paste master prompt for DeepSeek

```text
You are the lead coordinator for an exhaustive D&D Fifth Edition item-catalog audit and reconciliation in the Forge & Fable repository at E:\forge-and-fable.

Read the complete plan in:

rules-research/items/README.md

If that file does not yet exist, use the supplied “DeepSeek Multi-Agent Research and Reconciliation Plan for an Exhaustive D&D 5e Item Catalog” as the source of truth and save it there before proceeding.

Your objective is to audit the existing item catalog, build a versioned official-source manifest, research every in-scope official item, compare the researched catalog with the existing data and safely add confirmed missing items.

Use a team of isolated subagents. At minimum, assign:

1. Repository and consumer audit
2. Existing catalog profiler
3. Source-manifest researcher
4. Schema architect
5. 2014 mundane-equipment researcher
6. 2024 mundane-equipment researcher
7. Core magic-item researcher
8. Supplement source researchers
9. Setting source researchers
10. Adventure source researchers
11. Edge-category researcher
12. Comparator and deduplication engineer
13. Mechanics QA
14. Provenance and licensing QA

Critical rules:

- Do not let research agents edit src/data/items.json.
- Do not change production data during Phase A.
- Do not claim exhaustiveness without a complete source manifest.
- Do not overwrite 2014 records with 2024 mechanics.
- Do not regenerate or renumber existing IDs.
- Do not copy long copyrighted descriptions from non-SRD books.
- Do not use community wikis as the sole authority.
- Do not silently discard candidates.
- Do not auto-merge fuzzy matches.
- Do not invent mechanics when a source is inaccessible.
- Do not remove current records during the first pass.
- Preserve all saved-character compatibility.
- Use small reviewable commits.
- Run lint, build and tests after every integration batch.

Start by:

1. Checking git status
2. Creating a research branch
3. Copying src/data/items.json to a baseline research artifact
4. Creating the rules-research/items directory structure
5. Running Phase A with four parallel subagents
6. Producing phase-a-findings.md
7. Selecting a schema strategy before item research begins

Proceed autonomously through research and comparison. Pause only at a genuine schema, licensing, source-access or backward-compatibility decision that cannot be resolved from the repository and this plan.
```
