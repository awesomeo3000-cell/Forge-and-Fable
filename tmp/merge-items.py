#!/usr/bin/env python3
"""
Merge items.json (active catalog, 541 items) with dnd-5e-complete-catalog.json
(reference catalog) into a single deduplicated flat JSON array.

Output: tmp/merged-items.json
"""

import json
import re
import os
from collections import Counter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS_PATH = os.path.join(BASE_DIR, "src", "data", "items.json")
CATALOG_PATH = os.path.join(BASE_DIR, "data", "dnd-5e-complete-catalog.json")
OUTPUT_PATH = os.path.join(BASE_DIR, "tmp", "merged-items.json")

# Map catalog category -> canonical items.json category (unify naming)
# New categories from catalog (Ring, Rod, Staff, Wand, Scroll) are preserved as-is.
CATEGORY_CANONICAL = {
    "Wondrous Item": "Wondrous Items",   # catalog singular -> items.json plural
    "Potion": "Potions & Oils",          # catalog "Potion" -> items.json "Potions & Oils"
}

# For matching: both "Wondrous Items" and "Wondrous Item" should match.
# Build a mapping: any alias -> canonical form used for match keys.
CATEGORY_MATCH_KEY = {}
for catalog_cat, canonical_cat in CATEGORY_CANONICAL.items():
    CATEGORY_MATCH_KEY[catalog_cat] = canonical_cat
    CATEGORY_MATCH_KEY[canonical_cat] = canonical_cat


def normalize_name(name: str) -> str:
    """Normalize name for deduplication: lowercase, trim, collapse whitespace."""
    return " ".join(name.lower().strip().split())


def normalize_category_for_match(cat: str) -> str:
    """Normalize category to canonical match key for deduplication."""
    return CATEGORY_MATCH_KEY.get(cat, cat)


def apply_canonical_category(cat: str) -> str:
    """Convert a catalog category to the canonical items.json convention."""
    return CATEGORY_CANONICAL.get(cat, cat)


def convert_cost_to_copper(cost_str) -> str:
    """Convert a D&D coin string to copper pieces as string. Returns empty string if null/invalid."""
    if cost_str is None:
        return ""
    if isinstance(cost_str, (int, float)):
        return str(int(cost_str))
    if not isinstance(cost_str, str) or not cost_str.strip():
        return ""

    s = cost_str.strip().lower()
    # Remove commas from numbers (e.g., "1,500 gp")
    s_clean = s.replace(",", "")

    # Match: number + optional space + coin abbreviation
    match = re.match(r"^([\d.]+)\s*(cp|sp|ep|gp|pp)$", s_clean)
    if match:
        amount = float(match.group(1))
        coin = match.group(2)
        multipliers = {"cp": 1, "sp": 10, "ep": 50, "gp": 100, "pp": 1000}
        copper = int(amount * multipliers[coin])
        return str(copper)

    # Fallback: if it's just a number, return as-is
    try:
        val = float(s_clean)
        return str(int(val))
    except ValueError:
        pass

    print(f"  WARNING: Could not parse cost: {cost_str!r}")
    return ""


def normalize_properties(props) -> str:
    """Convert properties to pipe-delimited string."""
    if props is None:
        return ""
    if isinstance(props, list):
        return " | ".join(props)
    if isinstance(props, str):
        return props
    return ""


def normalize_ac(ac_val) -> str:
    """Ensure AC is a string."""
    if ac_val is None:
        return ""
    return str(ac_val)


def catalog_item_to_catalog_item(item: dict) -> dict:
    """Convert a catalog item (from complete-catalog.json) to CatalogItem shape."""
    cost = convert_cost_to_copper(item.get("cost"))
    props = normalize_properties(item.get("properties"))
    ac = normalize_ac(item.get("ac"))
    category = apply_canonical_category(item.get("category", ""))

    result = {
        "id": item.get("id", ""),
        "name": item.get("name", ""),
        "image": item.get("image", ""),
        "description": item.get("description", ""),
        "category": category,
        "rarity": item.get("rarity", ""),
        "classification": item.get("classification") or "",
        "ac": ac,
        "damage": item.get("damage") or "",
        "damageType": item.get("damageType") or "",
        "properties": props,
        "cost": cost,
        "attunement": bool(item.get("attunement", False)),
    }
    return result


def items_json_to_catalog_item(item: dict) -> dict:
    """Normalize an items.json item to CatalogItem shape (mostly already matches)."""
    result = {
        "id": item.get("id", ""),
        "name": item.get("name", ""),
        "image": item.get("image", ""),
        "description": item.get("description", ""),
        "category": item.get("category", ""),
        "rarity": item.get("rarity", ""),
        "classification": item.get("classification") or "",
        "ac": normalize_ac(item.get("ac")),
        "damage": item.get("damage") or "",
        "damageType": item.get("damageType") or "",
        "properties": normalize_properties(item.get("properties")),
        "cost": item.get("cost") or "",
        "attunement": bool(item.get("attunement", False)),
    }
    return result


def field_is_present(val) -> bool:
    """Check if a field has meaningful content (not None, not empty string)."""
    if val is None:
        return False
    if isinstance(val, str) and not val.strip():
        return False
    if isinstance(val, bool):
        return True
    return True


def make_match_key(item: dict) -> tuple:
    """Create a deduplication key from an item: (normalized_name, match_category)."""
    return (normalize_name(item["name"]), normalize_category_for_match(item["category"]))


def merge_items(existing: dict, incoming: dict) -> dict:
    """
    Merge incoming into existing, preferring existing values.
    Only fill in missing fields from incoming.
    existing comes from items.json (preferred).
    incoming comes from the catalog.
    """
    merged = dict(existing)
    for key in incoming:
        if not field_is_present(merged.get(key)) and field_is_present(incoming.get(key)):
            merged[key] = incoming[key]
    return merged


def main():
    print("=== Agent 1: Merge & Normalize ===\n")

    # ---- 1. Load both files ----
    print("1. Loading source files...")
    with open(ITEMS_PATH, "r", encoding="utf-8") as f:
        items_json = json.load(f)
    print(f"   items.json: {len(items_json)} items (flat array)")

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    print(f"   complete-catalog.json: dict with keys {list(catalog.keys())}")

    # ---- 2. Extract catalog items, skipping Spells ----
    print("\n2. Extracting catalog items (skipping Spells)...")
    catalog_items_raw = []
    for key in catalog:
        if key == "Spells":
            print(f"   SKIPPED: {key} ({len(catalog[key])} items)")
            continue
        catalog_items_raw.extend(catalog[key])
        print(f"   Added: {key} ({len(catalog[key])} items)")
    print(f"   Total catalog items (non-spell): {len(catalog_items_raw)}")

    # ---- 3. Normalize all items ----
    print("\n3. Normalizing items to CatalogItem shape...")

    # items.json items (preferred)
    items_json_normalized = [items_json_to_catalog_item(item) for item in items_json]
    print(f"   Normalized items.json: {len(items_json_normalized)} items")

    # Catalog items (with canonical categories applied)
    catalog_normalized = [catalog_item_to_catalog_item(item) for item in catalog_items_raw]
    print(f"   Normalized catalog: {len(catalog_normalized)} items")

    # ---- 4. Build lookup by match_key from items.json ----
    print("\n4. Building lookup for deduplication...")

    items_json_lookup = {}  # match_key -> item
    for item in items_json_normalized:
        key = make_match_key(item)
        if key in items_json_lookup:
            print(f"   WARNING: Duplicate in items.json: name={item['name']!r}, cat={item['category']!r}")
        items_json_lookup[key] = item

    print(f"   items.json unique match keys: {len(items_json_lookup)}")

    # ---- 5. Merge catalog items into the result ----
    print("\n5. Merging catalog items...")
    merged_lookup = dict(items_json_lookup)  # match_key -> merged item
    catalog_only_count = 0
    enrich_count = 0

    for item in catalog_normalized:
        key = make_match_key(item)

        if key in merged_lookup:
            # Item exists in items.json - enrich with catalog data if missing
            existing = merged_lookup[key]
            enriched = merge_items(existing, item)
            # Log if we enriched anything
            enriched_fields = []
            for f in ["description", "cost", "damage", "damageType", "properties", "ac", "classification"]:
                if not field_is_present(existing.get(f)) and field_is_present(item.get(f)):
                    enriched_fields.append(f)
            if enriched_fields:
                enrich_count += 1
                print(f"   Enriched: {item['name']!r} ({item['category']!r}) - added: {', '.join(enriched_fields)}")
            merged_lookup[key] = enriched
        else:
            # New item from catalog only
            merged_lookup[key] = item
            catalog_only_count += 1

    print(f"   New items from catalog: {catalog_only_count}")
    print(f"   Items enriched from catalog: {enrich_count}")

    # ---- 6. Build result list ----
    result = list(merged_lookup.values())

    # ---- 7. Deduplicate IDs ----
    print("\n6. Checking for duplicate IDs...")
    id_counts = {}
    for item in result:
        item_id = item["id"]
        if item_id not in id_counts:
            id_counts[item_id] = []
        id_counts[item_id].append(item)

    id_conflicts = {k: v for k, v in id_counts.items() if len(v) > 1}
    if id_conflicts:
        print(f"   Found {len(id_conflicts)} conflicting IDs. Resolving...")
        for dup_id, items_list in id_conflicts.items():
            for i, item in enumerate(items_list):
                if i == 0:
                    continue
                new_id = f"{dup_id}-{i + 1}"
                print(f"   Renamed: {item['name']!r} {dup_id} -> {new_id}")
                item["id"] = new_id
    else:
        print("   All IDs are unique.")

    # ---- 8. Sort by category then name for consistency ----
    result.sort(key=lambda x: (x["category"], x["name"].lower()))

    # ---- 9. Write output ----
    print(f"\n7. Writing output to {OUTPUT_PATH}...")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    # ---- 10. Summary ----
    print(f"\n=== Summary ===")
    print(f"   Total merged items: {len(result)}")
    print(f"   Items from items.json preserved: {len(items_json_normalized)}")
    print(f"   New items from catalog: {catalog_only_count}")
    print(f"   Items enriched: {enrich_count}")

    # File size
    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"   Output file: {OUTPUT_PATH}")
    print(f"   File size: {file_size:,} bytes ({file_size / 1024:.1f} KB)")

    # Category breakdown
    cats = Counter(item["category"] for item in result)
    print(f"\n   Category breakdown:")
    for cat, count in cats.most_common():
        print(f"     {cat}: {count}")

    # Rarity breakdown
    rars = Counter(item["rarity"] for item in result)
    print(f"\n   Rarity breakdown:")
    for rar, count in rars.most_common():
        print(f"     {rar}: {count}")

    # Verify data integrity
    print(f"\n   Integrity checks:")
    # All items have required fields
    required_fields = ["id", "name", "description", "category", "rarity", "attunement"]
    missing = []
    for item in result:
        for f in required_fields:
            if not field_is_present(item.get(f)) and f not in ("description",):
                missing.append((item["id"], f))
    if missing:
        print(f"     WARNING: {len(missing)} items missing required fields")
    else:
        print(f"     All items have required fields: OK")

    # All IDs are unique
    all_ids = [item["id"] for item in result]
    if len(all_ids) == len(set(all_ids)):
        print(f"     All {len(all_ids)} IDs are unique: OK")
    else:
        dupes = [id for id, count in Counter(all_ids).items() if count > 1]
        print(f"     WARNING: {len(dupes)} duplicate IDs found!")

    # Check all fields match CatalogItem type
    valid_fields = {"id", "name", "image", "description", "category", "rarity",
                    "classification", "ac", "damage", "damageType", "properties",
                    "cost", "attunement"}
    extra_fields_in_file = set()
    for item in result:
        extra = set(item.keys()) - valid_fields
        extra_fields_in_file.update(extra)
    if extra_fields_in_file:
        print(f"     WARNING: Extra fields found: {extra_fields_in_file}")
    else:
        print(f"     All fields match CatalogItem type: OK")

    print("\nDone.")


if __name__ == "__main__":
    main()
