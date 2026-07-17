# Schema Decision Log

Records every design decision made during the canonical schema design, with rationale.  
Updated 2026-07-17 based on Phase A verification review.

---

## Decision 1: Cost Encoding → Price Status Model

**Decision (revised)**: Instead of a single `costCp: number | null`, use a structured `ItemPrice` type:

```typescript
type PriceStatus = "listed" | "not-listed" | "varies" | "not-applicable" | "unknown";
type ItemPrice = {
  costCp: number | null;
  status: PriceStatus;
  sourceCode?: string;
};
```

**Why revised**: A single numeric `costCp` value collapses several distinct meanings: items with official listed prices, items with no official price (most magic items), items with variable prices (templates), items where price doesn't apply (artifacts), and unresearched items. The `status` field disambiguates these cases.

**Impact**: The legacy `_legacyCost` string field preserves the current flat format for backward compatibility.

---

## Decision 2: Attunement Modeling

**Decision**: Model as structured object with legacy boolean bridge. Unchanged from initial design.

---

## Decision 3: Properties — String vs Array

**Decision**: Array in canonical, string in legacy. Unchanged.

---

## Decision 4: AC Representation

**Decision**: Parsed into structured armor data, original string preserved. Unchanged.

---

## Decision 5: Weight

**Decision**: `weightLb?: number | null` (null = weightless/unknown). Unchanged.

---

## Decision 6: Rarity — Separated from Magical Classification (REVISED)

**Decision (revised)**: Do not create a synthetic `"mundane"` magic rarity. Instead, separate the concerns:

```typescript
type CanonicalRarity = "common" | "uncommon" | "rare" | "very-rare" | "legendary" | "artifact" | "varies" | null;

type ItemMagicClassification = {
  magical: boolean;
  rarity: CanonicalRarity;
};
```

**Why revised**: The original proposal included `"mundane"` in the rarity enum. This conflates "rarity" (a magic-item concept) with "mundane availability" (a non-magical concept). Typical mundane equipment should use `{ magical: false, rarity: null }`. The legacy rarity string ("Mundane" or "Common") is preserved in `_legacyRarity` for backward compatibility.

**The current catalog's "Common" vs "Mundane" inconsistency is a taxonomy conflict, not a confirmed source-rule error.** The field is serving multiple incompatible purposes (magic rarity vs. availability vs. UI grouping).

---

## Decision 7: Rules Version

**Decision**: `rulesVersion: "2014" | "2024" | "shared"`. Unchanged.

---

## Decision 8: Multi-Source Provenance

**Decision**: `provenance: ItemProvenance[]` — array, not single object. Added `publisherLane` to provenance entries. Unchanged core decision.

---

## Decision 9: Deprecation Over Deletion

**Decision**: `deprecated?: boolean` + `replacedBy?: string`. Unchanged.

---

## Decision 10: File Naming

**Decision**: `items.canonical.json` → generator → `items.json`. Added requirement that `items.json` contain a header comment marking it as generated. Unchanged core decision.

---

## Decision 11: SRD Version Tracking (NEW)

**Decision**: Track exact SRD version in license and provenance fields. Use `"srd-5.2.1"` for the current 2024 SRD (not the superseded 5.2).

**Why**: SRD 5.2.1 restored 15 magic items accidentally omitted from 5.2. Using the wrong version would miss these items in the research scope.

---

## Decision 12: Publisher Lanes (NEW)

**Decision**: Add `publisherLane` field to source manifest entries and provenance records:

```typescript
type PublisherLane =
  | "wizards-first-party"
  | "official-licensed"
  | "partnered"
  | "charity"
  | "third-party";
```

**Why**: Not all "official" D&D content has the same inclusion status. Partnered marketplace content (e.g., DMsGuild Extra Life products) should be reviewed separately from first-party Wizards publications. The default inclusion policy is: include Wizards first-party; review licensed, partnered, and charity separately; exclude third-party by default.

---

## Decision 13: Research Cutoff (NEW)

**Decision**: Record an explicit research cutoff date on the source manifest and every provenance record.

**Why**: An "exhaustive" claim is only meaningful against a locked scope and a recorded cutoff. Sources published after the cutoff are explicitly out of scope until the manifest is refreshed.

**Current cutoff**: 2026-07-16

---

## Decision 14: Canonical Schema Versioning (NEW)

**Decision**: Version the canonical schema as `1.0.0`. Every research candidate file must declare the schema version it was produced against.

**Why**: Schema evolution during research is likely. Versioning ensures candidates can be validated against the correct schema version.
