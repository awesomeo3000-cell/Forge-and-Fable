# Schema Decision Log

Records every design decision made during the canonical schema design, with rationale.

---

## Decision 1: Cost Encoding

**Decision**: Store cost as `costCp?: number | null` (copper pieces, number type) with `_legacyCost?: string` for backward compatibility.

**Alternatives considered**:
- Keep as string: loses type safety, harder to compute totals
- Store as object `{ cp, sp, gp }`: over-normalized, harder to sum

**Rationale**: Copper pieces is the standard D&D base unit. A number enables arithmetic (total value, compare prices). The legacy string field preserves exact original formatting for display backward compatibility.

**Impact**: `formatItemCost()` must be updated to accept a number. Low risk since it already converts from string to number internally.

---

## Decision 2: Attunement Modeling

**Decision**: Model as `attunement?: { required: boolean; requirementText?: string; classes?: string[]; species?: string[]; alignments?: string[] }` with `_legacyAttunement?: boolean`.

**Alternatives considered**:
- Keep as boolean: loses requirement details (e.g., "by a spellcaster")
- Store requirement as free text only: not machine-readable

**Rationale**: Attunement requirements matter for character validation (e.g., only spellcasters can attune to certain items). Structured data enables automated checks. The legacy boolean field preserves existing consumer behavior.

**Impact**: All code checking `item.attunement === true` must be updated to check `item.attunement?.required`, OR continue using `_legacyAttunement` until migration. With Option B, no immediate impact.

---

## Decision 3: Properties — String vs Array

**Decision**: Store as `weapon.properties?: string[]` in canonical schema, with `_legacyProperties?: string` for backward compatibility.

**Alternatives considered**:
- Keep as string: current consumers parse pipe-delimited strings with regex — fragile and error-prone
- Array only: breaks all consumers immediately

**Rationale**: Current parsing is fragile: `properties.includes("finesse")` matches "finesse" within "throw (range 20/60)" context. A structured array enables reliable property checks. But changing the type is a breaking change — hence Option B with `_legacyProperties` bridge.

**Impact**: With Option B, zero immediate impact. Future consumers can use `weapon.properties` while legacy consumers use `_legacyProperties`.

---

## Decision 4: AC Representation

**Decision**: Parse AC strings like "11 + Dex" into structured `armor: { baseAc: 11, addDex: true }` in canonical schema. Preserve original string in `_legacyAc`.

**Alternatives considered**:
- Keep as string: lossy, hard to compute
- Structure only: breaks existing display code

**Rationale**: The current system parses AC heuristically. Structured data enables reliable computation. The `_legacyAc` bridge preserves current display formatting.

**AC String Patterns Observed**:
- `"11 + Dex"` → baseAc: 11, addDex: true
- `"11 + Dex (max 2)"` → baseAc: 11, addDex: true, maxDexBonus: 2
- `"16"` → baseAc: 16, addDex: false
- `"+N"` → magicBonus: N (for shields and magic armor)

---

## Decision 5: Weight

**Decision**: Add `weightLb?: number | null` to canonical schema. Null = weightless/unknown. Omit = not yet researched.

**Alternatives considered**:
- Always require weight: many magic items are weightless or have unknown weight
- Omit entirely: carrying capacity is a core mechanic

**Rationale**: Current catalog has zero weight data. Carrying capacity is calculated from inventory items. Adding weight to the catalog enables automatic encumbrance tracking.

**Impact**: New field. No backward compatibility issue.

---

## Decision 6: Rarity Normalization

**Decision**: Canonical rarity values are lowercase (`"common"`, `"uncommon"`, etc.). Add `"mundane"` and `"none"` to the enum. Add `mundane: boolean` and `magical: boolean` flags.

**Alternatives considered**:
- Keep current mixed case: inconsistent ("Mundane", "Common", "Very Rare")
- Add "varies" tier for artifacts/sentient items: included

**Rationale**: Current rarity is confused — 185 mundane items marked "Common" alongside 314 "Common" items that include both mundane gear and a common magic item. Flags disambiguate. Lowercase normalization is consistent with REST API conventions.

**Impact**: `ITEM_RARITIES` derivation must handle new values. `formatItemCost` / rarity display must map to title case for UI.

---

## Decision 7: Rules Version

**Decision**: `rulesVersion: "2014" | "2024" | "shared"`. "shared" for items mechanically identical in both editions.

**Alternatives considered**:
- Omit: can't distinguish versions
- Use boolean `is2024`: doesn't handle "shared" items
- Per-source only: items in setting books may reference 2014 mechanics even if published later

**Rationale**: The plan requires separate records for 2014 and 2024 mechanics. "shared" avoids duplicating records for items unchanged between editions (e.g., most mundane equipment).

**Impact**: New field. `itemMatches` search should filter by rulesVersion. UI should display version badge.

---

## Decision 8: Multi-Source Provenance

**Decision**: `provenance: ItemProvenance[]` — an array, not a single object.

**Alternatives considered**:
- Single source: items often appear in multiple books (e.g., Bag of Holding in DMG + SRD)
- Two fields (primary/secondary): arbitrary distinction

**Rationale**: Many items appear in multiple official sources. The SRD version may differ from the core book version. An array captures the full verification trail. The first entry is the primary source.

**Impact**: New field. No backward compatibility issue.

---

## Decision 9: Deprecation Over Deletion

**Decision**: Add `deprecated?: boolean` and `replacedBy?: string` instead of deleting records.

**Alternatives considered**:
- Delete duplicate records: breaks `sourceItemId` references in saved characters
- Soft delete with migration: complex

**Rationale**: As established in the ID compatibility report, catalog IDs are referenced in persisted character data. Deletion breaks enrichment. Deprecation preserves backward compatibility while signaling to the UI not to show deprecated items in search results.

**Impact**: `itemMatches` filter must exclude deprecated items. `catalogBackedInventoryItem` must still resolve deprecated items (they exist in saved characters).

---

## Decision 10: File Naming

**Decision**: Canonical file named `items.canonical.json`, not `items-v2.json` or `items.json`.

**Alternatives considered**:
- Replace `items.json` directly: breaks everything
- `items-v2.json`: implies migration, confusing alongside v1
- `items-full.json`: doesn't convey the canonical source-of-truth role

**Rationale**: "Canonical" clearly signals this is the authoritative source. The build step reinforces this: canonical → legacy, never the reverse.
