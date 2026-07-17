# Schema Migration Options

## Context

The current `CatalogItem` type has 13 flat fields. The proposed `CanonicalItem` schema v1.0.0 adds ~45 new fields including nested objects for structured weapon/armor/tool data, provenance arrays, rules versioning, and price status.

The primary constraint: **existing saved characters must continue to load and function.**

---

## Option A: Extend Current Records In-Place

### Description
Add new fields directly to `src/data/items.json`. Keep the same file, same IDs, same import path.

### Pros
- Simplest implementation — one file changes
- No build step needed
- No consumer changes required for purely additive fields

### Cons
- `catalogItemToInventory()` must be updated for each new field
- Changing `properties` from string to array BREAKS all consumers
- Changing `attunement` from boolean to object BREAKS all consumers
- Changing `cost` from string to number BREAKS `formatItemCost()`
- File becomes very large and complex

### Risk Assessment: MEDIUM-HIGH
- Low risk for purely additive fields (rulesVersion, sourceCode, weightLb, tags)
- HIGH risk for any field type change

### Verdict: Viable only if we preserve ALL current field types alongside new ones.

---

## Option B: Canonical Catalog + Generated Legacy Records (RECOMMENDED)

### Description
1. Create `src/data/items.canonical.json` — the new full-schema catalog (hand-edited)
2. Create `scripts/build-items-legacy.mjs` — deterministic generator
3. `src/data/items.json` becomes a build artifact — NEVER hand-edited
4. Existing consumers see the exact same flat format

### Pros
- **Existing application runs unchanged** — current consumers see the same flat format
- Full structured data available for future features
- Progressive migration path: consumers can opt in one at a time
- Clean separation of concerns
- `items.canonical.json` is the single source of truth

### Cons
- Build step required
- Two files to maintain (but only one is hand-edited)
- Generator must be deterministic (same input → same output, no diff on re-run)

### Risks (not "zero risk")
- **ID loss**: Generator must preserve existing IDs byte-for-byte unchanged
- **Field flattening errors**: Incorrect mapping could drop data
- **Ordering changes**: Generator must produce stable output ordering
- **Null-handling mistakes**: Null vs. empty string vs. "0" ambiguity
- **Variant collapse**: Must handle template → concrete variant expansion correctly
- **2014/2024 collisions**: Distinct canonical records must not produce duplicate legacy records
- **Stale generated files**: CI must detect when canonical changes without regeneration
- **Non-deterministic output**: Generator must be deterministic

### Required Gates
1. **Preserve existing IDs** — byte-for-byte unchanged in initial migration
2. **Preserve existing names** — do not rename during initial migration; use aliases
3. **Deterministic generation** — running twice with no source changes produces no diff
4. **Legacy snapshot test** — canonical-to-legacy diff test in CI
5. **Saved-character compatibility test** — load representative characters against generated catalog
6. **Separate same-name rules versions** — 2014 and 2024 records with same name must have distinct IDs
7. **Mark generated files** — header comment: "GENERATED. Do not edit directly. See items.canonical.json."
8. **CI stale-file check** — fail CI when canonical changed but legacy not regenerated
9. **Research isolation** — no Phase B agent may edit either `items.json` or `items.canonical.json`
10. **Reconciliation before merge** — all candidates must pass provenance, schema, match, conflict, duplicate, and rules-version review

### Implementation Sketch
```javascript
// scripts/build-items-legacy.mjs
import canonical from '../src/data/items.canonical.json' assert { type: 'json' };

const legacy = canonical.map(item => ({
  id: item.id,
  name: item.name,
  image: item.image || '',
  description: item.description,
  category: item.category,
  rarity: item._legacyRarity || (item.magical ? (item.rarity || 'Common') : 'Mundane'),
  classification: item.classification || '',
  ac: item._legacyAc || '',
  damage: item._legacyDamage || '',
  damageType: item._legacyDamageType || '',
  properties: item._legacyProperties || item.weapon?.properties?.join(' | ') || '',
  cost: item._legacyCost ?? String(item.price?.costCp ?? 0),
  attunement: item._legacyAttunement ?? item.attunement?.required ?? false,
}));

// Stable sort by ID for deterministic output
legacy.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync('src/data/items.json', 
  '// GENERATED. Do not edit directly. See items.canonical.json.\n' +
  JSON.stringify(legacy, null, 2));
```

### Risk Assessment: LOW-MEDIUM
- Existing consumers untouched (LOW)
- Generator correctness must be verified (MEDIUM)
- Gates 1-10 above must be in place before production use

### Verdict: **RECOMMENDED** — safest path forward, provided all 10 gates are implemented.

---

## Option C: Migrate All Consumers to New Schema

### Description
Change all TypeScript types, component code, utility functions, and database to use the canonical schema directly.

### Pros
- Clean, single schema
- No build step
- Structured data directly available everywhere

### Cons
- **Massive code change** across 9+ source files
- **Breaking change to persisted character data** — migration needed
- Every string-parsing function must be rewritten
- High risk of subtle bugs in AC computation, weapon parsing, bonus detection
- Zero test coverage for most item logic

### Risk Assessment: HIGH
Not recommended for initial migration. Consider as a long-term goal.

---

## Recommendation

**Option B** with all 10 required gates. This is the safest path that enables full structured data while preserving existing application behavior.
