# Schema Migration Options

## Context

The current `CatalogItem` type has 13 flat fields. The proposed `CanonicalItem` type adds ~40 new fields including nested objects for structured weapon/armor/tool data, provenance arrays, and rules versioning.

The primary constraint: **existing saved characters must continue to load and function.**

## Option A: Extend Current Records In-Place

### Description
Add new fields directly to `src/data/items.json`. Keep the same file, same IDs, same import path. Update `CatalogItem` type to include new optional fields.

### Pros
- Simplest implementation — one file changes
- No build step needed
- No consumer changes required for backward compat (TypeScript structural typing)
- Existing code ignores unknown fields

### Cons
- `catalogItemToInventory()` must be updated to map new fields to `InventoryItem` (or they're lost)
- `InventoryItem` type must be extended to carry structured weapon/armor data
- Changing `properties` from string to array BREAKS all consumers that parse it as text
- Changing `attunement` from boolean to object BREAKS all consumers
- File becomes very large and complex to diff/review
- Risk: adding nested objects to a flat JSON file makes manual editing error-prone

### Risk Assessment: MEDIUM-HIGH
- Low risk for purely additive fields (rulesVersion, sourceCode, weightLb, tags)
- HIGH risk for field type changes (properties, attunement, cost)

### Verdict: Viable only if we preserve ALL current field types and add new fields alongside them.

---

## Option B: Canonical Catalog + Generated Legacy Records (RECOMMENDED)

### Description
1. Create `src/data/items.canonical.json` — the new full-schema catalog
2. Create `scripts/build-items-legacy.mjs` — generates `src/data/items.json` in the current flat format
3. `src/data/items.json` becomes a build artifact (gitignored? or committed for non-Node consumers)
4. Consumers that want structured data import from the canonical file
5. Existing consumers continue to import from `items.json` (unchanged)

### Pros
- **Zero risk to existing application** — current consumers see the exact same flat format
- Full structured data available for future features
- Progressive migration path: consumers can opt in one at a time
- Clean separation of concerns
- Canonical file is the source of truth; legacy file is derived
- Easy to validate: compare generated output against original

### Cons
- Build step required (`npm run build:items` or integrated into existing build)
- Two files to maintain conceptually (but only one is hand-edited)
- Need to ensure generated file stays in sync (solved by build script)
- Slightly more complex CI/CD

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
  rarity: item.rarity || 'Common',
  classification: item.classification || '',
  ac: item._legacyAc || '',
  damage: item._legacyDamage || '',
  damageType: item._legacyDamageType || '',
  properties: item._legacyProperties || item.weapon?.properties?.join(' | ') || '',
  cost: item._legacyCost ?? String(item.costCp ?? 0),
  attunement: item._legacyAttunement ?? item.attunement?.required ?? false,
}));

writeFileSync('src/data/items.json', JSON.stringify(legacy, null, 2));
```

### Risk Assessment: LOW
- Existing consumers are untouched
- The build step is simple and idempotent
- Fail-safe: if the build fails, `items.json` remains at its last successful state

### Verdict: **RECOMMENDED**. This is the safest approach.

---

## Option C: Migrate All Consumers to New Schema

### Description
Change all TypeScript types, all component code, all utility functions, and the database to use the new canonical schema directly. Remove the flat format entirely.

### Pros
- Clean, single schema
- No build step
- No dual-file maintenance
- Structured data directly available everywhere

### Cons
- **Massive code change** across at least 9 source files
- Every function that reads `item.properties` as a string must be rewritten
- Every function that checks `item.attunement` as boolean must be rewritten
- `catalogItemToInventory()` needs complete rewrite
- `InventoryItem` type change breaks all saved character JSON (migration needed)
- High risk of introducing subtle bugs in equipment calculation, AC computation, weapon parsing
- Requires extensive testing
- **Could break saved characters** if not handled perfectly

### Risk Assessment: HIGH
- 8+ code locations must be updated perfectly
- Zero test coverage for most item logic
- Breaking change to persisted character data

### Verdict: Not recommended for initial migration. Consider as a long-term goal after Option B is stable.

---

## Recommendation

**Implement Option B: Canonical catalog + generated legacy records.**

### Migration Roadmap

1. **Immediate (this research project)**:
   - Create `src/data/items.canonical.json` with the new schema
   - Populate with current items + researched additions
   - Create `scripts/build-items-legacy.mjs`
   - Verify generated `items.json` is byte-identical for unchanged records
   - Integrate into build pipeline (`npm run build:items`)

2. **Short-term (after catalog is complete)**:
   - Extend `CatalogItem` type to include `weightLb`, `tags`, `rulesVersion`, `sourceCode` (additive fields only)
   - Update `catalogItemToInventory()` to pass through these new fields
   - Add item weight to carrying capacity calculation

3. **Medium-term (feature work)**:
   - Add structured weapon parsing to `equipment.ts` (use `weapon.*` fields when available, fall back to string parsing)
   - Add structured armor parsing similarly
   - Add rules version display in UI

4. **Long-term (major version)**:
   - Migrate `InventoryItem` to include structured data
   - Write character data migration for saved characters
   - Drop `_legacy*` fields from canonical schema
   - Remove build step
