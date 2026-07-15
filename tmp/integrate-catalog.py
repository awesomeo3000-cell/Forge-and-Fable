#!/usr/bin/env python3
"""Integrate catalog from Agents 1-4 into final src/data/items.json."""

import json
import re
import sys
from collections import Counter

# ── Load inputs ──────────────────────────────────────────────────────────────

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

base_items     = load("tmp/restructured-items.json")   # Agent 4, 521 items
merged_items   = load("tmp/merged-items.json")          # Agent 1, 809 items
scroll_items   = load("tmp/spell-scrolls.json")          # Agent 2, 320 items
potion_items   = load("tmp/potions-elixirs.json")        # Agent 3, 48 items

print(f"Loaded: base={len(base_items)}, merged={len(merged_items)}, "
      f"scrolls={len(scroll_items)}, potions={len(potion_items)}")

# ── Helpers ──────────────────────────────────────────────────────────────────

def norm_key(item):
    """Normalized (name, category) key for deduplication."""
    name = item.get("name", "").strip().lower()
    cat  = item.get("category", "").strip().lower()
    # Normalize whitespace
    name = re.sub(r"\s+", " ", name)
    cat  = re.sub(r"\s+", " ", cat)
    return (name, cat)

CATEGORY_MAP = {
    "adventuring gear": "Adventuring Gear",
    "armor": "Armor",
    "food & drink": "Food & Drink",
    "food and drink": "Food & Drink",
    "mount": "Mount",
    "musical instrument": "Musical Instrument",
    "other": None,  # will be removed
    "poisons": "Poisons",
    "potions & oils": "Potions & Oils",
    "potions and oils": "Potions & Oils",
    "elixir": "Elixir",
    "ring": "Ring",
    "rod": "Rod",
    "scroll": "Scroll",
    "staff": "Staff",
    "tack": "Tack",
    "tools": "Tools",
    "wand": "Wand",
    "weapon": "Weapon",
    "wondrous items": "Wondrous Items",
    "wondrous item": "Wondrous Items",
}

RARITY_MAP = {
    "mundane": "Mundane",
    "common": "Common",
    "uncommon": "Uncommon",
    "rare": "Rare",
    "very rare": "Very Rare",
    "legendary": "Legendary",
    "artifact": "Artifact",
}

VALID_RARITIES = {"Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"}

def normalize_item(item):
    """In-place normalization of a single item."""
    # category
    cat = item.get("category", "")
    mapped = CATEGORY_MAP.get(cat.strip().lower())
    if mapped:
        item["category"] = mapped

    # rarity
    rar = item.get("rarity", "Common")
    mapped = RARITY_MAP.get(rar.strip())
    if mapped:
        item["rarity"] = mapped
    elif rar not in VALID_RARITIES:
        # fallback: try title case
        titled = rar.strip().title()
        if titled in VALID_RARITIES:
            item["rarity"] = titled
        else:
            item["rarity"] = "Common"

    # cost: ensure string of digits
    cost = item.get("cost")
    if cost is None:
        item["cost"] = "0"
    elif isinstance(cost, (int, float)):
        item["cost"] = str(int(cost))
    elif isinstance(cost, str):
        cost = cost.strip()
        # Remove commas
        cost = cost.replace(",", "")
        # Check if it looks like "50 gp" format
        m = re.match(r"^([\d.]+)\s*(gp|sp|cp)$", cost, re.IGNORECASE)
        if m:
            value = float(m.group(1))
            unit = m.group(2).lower()
            if unit == "gp":
                item["cost"] = str(int(value * 100))
            elif unit == "sp":
                item["cost"] = str(int(value * 10))
            else:  # cp
                item["cost"] = str(int(value))
        elif re.match(r"^\d+$", cost):
            item["cost"] = cost
        else:
            # Try to extract digits
            digits = re.sub(r"[^\d]", "", cost)
            item["cost"] = digits if digits else "0"
    else:
        item["cost"] = "0"

    # attunement: ensure boolean
    att = item.get("attunement")
    if isinstance(att, str):
        item["attunement"] = att.lower() in ("true", "yes", "1")
    elif not isinstance(att, bool):
        item["attunement"] = bool(att)

    # Ensure optional fields exist
    item.setdefault("image", "")
    item.setdefault("classification", "")
    item.setdefault("ac", "")
    item.setdefault("damage", "")
    item.setdefault("damageType", "")
    item.setdefault("properties", "")

    return item


def is_template(item):
    """Check if item name contains template placeholders like {modifier}."""
    return "{" in item.get("name", "") or "}" in item.get("name", "")


# ── Step 1: Start with Agent 4 base ──────────────────────────────────────────

catalog = []
for item in base_items:
    catalog.append(normalize_item(dict(item)))  # dict() to copy

print(f"Step 1 (base from Agent 4): {len(catalog)} items")

# ── Step 2: Remove potion/oil/elixir items from base ─────────────────────────

potion_cats = {"potions & oils", "elixir"}
removed_potions = 0
filtered = []
for item in catalog:
    if item["category"].lower() in potion_cats:
        removed_potions += 1
    else:
        filtered.append(item)
catalog = filtered
print(f"Step 2 (removed old potions): removed {removed_potions}, remaining {len(catalog)}")

# ── Step 3: Add Agent 3's potions ────────────────────────────────────────────

for item in potion_items:
    catalog.append(normalize_item(dict(item)))
print(f"Step 3 (added Agent 3 potions): +{len(potion_items)}, total {len(catalog)}")

# ── Step 4: Add Agent 2's scrolls ────────────────────────────────────────────

for item in scroll_items:
    catalog.append(normalize_item(dict(item)))
print(f"Step 4 (added Agent 2 scrolls): +{len(scroll_items)}, total {len(catalog)}")

# ── Step 5: Add net-new items from Agent 1 ──────────────────────────────────

# Build set of existing keys from current catalog
existing_keys = set()
for item in catalog:
    existing_keys.add(norm_key(item))

stats = {
    "from_agent1": 0,
    "duplicates": 0,
    "cross_cat_dupes": 0,
    "templates": 0,
    "other_category": 0,
    "potion_skipped": 0,
    "scroll_skipped": 0,
}

# Also build a name-only set for cross-category dedup
existing_names = set()
for item in catalog:
    existing_names.add(item.get("name", "").strip().lower())

for item in merged_items:
    # Skip templates
    if is_template(item):
        stats["templates"] += 1
        continue

    cat = item.get("category", "").strip()

    # Skip Other category
    if cat == "Other":
        stats["other_category"] += 1
        continue

    # Skip potions/elixirs (replaced by Agent 3)
    if cat in ("Potions & Oils", "Elixir"):
        stats["potion_skipped"] += 1
        continue

    # Skip scrolls (replaced by Agent 2)
    if cat == "Scroll":
        stats["scroll_skipped"] += 1
        continue

    # Normalize
    normalized = normalize_item(dict(item))

    # Check for exact (name+category) duplicates
    key = norm_key(normalized)
    if key in existing_keys:
        stats["duplicates"] += 1
        continue

    # Check for cross-category duplicates (same name, different category)
    # Prefer Agent 4's categorization - skip if name already exists
    name_lower = normalized.get("name", "").strip().lower()
    if name_lower in existing_names:
        stats["cross_cat_dupes"] += 1
        continue

    # Add net-new item
    existing_keys.add(key)
    existing_names.add(name_lower)
    catalog.append(normalized)
    stats["from_agent1"] += 1

print(f"Step 5 (Agent 1 merge): +{stats['from_agent1']} new, "
      f"{stats['duplicates']} dupes, {stats['cross_cat_dupes']} cross-cat dupes, "
      f"{stats['templates']} templates skipped, "
      f"{stats['other_category']} Other category skipped, "
      f"{stats['potion_skipped']} potions skipped, "
      f"{stats['scroll_skipped']} scrolls skipped")
print(f"  Total after merge: {len(catalog)}")

# ── Step 6: Final cleanup ────────────────────────────────────────────────────

# 6a. Remove any items with empty/blank names
before = len(catalog)
catalog = [item for item in catalog if item.get("name", "").strip()]
removed_empty = before - len(catalog)
if removed_empty:
    print(f"Step 6a: removed {removed_empty} items with empty names")

# 6b. Ensure no "Other" category survived
other_items = [item for item in catalog if item.get("category") == "Other"]
if other_items:
    print(f"WARNING: {len(other_items)} 'Other' category items remain, reclassifying as Adventuring Gear")
    for item in other_items:
        item["category"] = "Adventuring Gear"

# 6c. Ensure unique IDs
ids_seen = {}
id_collisions = 0
for item in catalog:
    iid = item.get("id", "")
    if iid in ids_seen:
        # Add suffix
        suffix = 2
        while f"{iid}-{suffix}" in ids_seen:
            suffix += 1
        new_id = f"{iid}-{suffix}"
        print(f"  ID collision: {iid} -> {new_id}")
        item["id"] = new_id
        id_collisions += 1
    ids_seen[item["id"]] = True

if id_collisions:
    print(f"Step 6c: fixed {id_collisions} ID collisions")

# 6d. Remove any remaining template items (double-check)
before = len(catalog)
catalog = [item for item in catalog if not is_template(item)]
removed_templates = before - len(catalog)
if removed_templates:
    print(f"Step 6d: removed {removed_templates} template items")

# ── Step 6e: Generate basic descriptions for items with empty ones ──────────

def generate_description(item):
    """Generate a basic description for mundane items that lack one."""
    name = item.get("name", "")
    cat = item.get("category", "")
    classification = item.get("classification", "")
    
    # Descriptive fallbacks by category
    if cat == "Weapon":
        dmg = item.get("damage", "")
        dmg_type = item.get("damageType", "")
        props = item.get("properties", "")
        parts = [f"A {name.lower()}"]
        if dmg:
            parts.append(f"dealing {dmg}")
            if dmg_type:
                parts.append(f"{dmg_type} damage")
        if props:
            parts.append(f"({props})")
        parts.append(".")
        return " ".join(parts)
    
    if cat == "Armor":
        ac = item.get("ac", "")
        parts = [f"{name} armor"]
        if ac:
            parts.append(f"providing {ac} AC")
        parts.append(".")
        return " ".join(parts)
    
    if cat == "Adventuring Gear":
        return f"A {name.lower()}, commonly used by adventurers."
    
    if cat in ("Tools", "Musical Instrument"):
        return f"A {name.lower()}, standard equipment for the right profession."
    
    if cat == "Food & Drink":
        return f"{name}, a consumable food or drink item."
    
    if cat == "Tack":
        return f"{name}, used with mounts and riding animals."
    
    if cat == "Mount":
        return f"A {name.lower()}, used for transportation and travel."
    
    # Generic fallback
    return f"{name}."

desc_generated = 0
for item in catalog:
    if not item.get("description", "").strip():
        item["description"] = generate_description(item)
        desc_generated += 1

if desc_generated:
    print(f"Step 6e: generated descriptions for {desc_generated} items")

# ── Step 7: Validation ──────────────────────────────────────────────────────

errors = []
warnings = []

# Known valid categories after normalization
valid_categories = {
    "Adventuring Gear", "Armor", "Food & Drink", "Mount",
    "Musical Instrument", "Poisons", "Potions & Oils", "Elixir",
    "Ring", "Rod", "Scroll", "Staff", "Tack", "Tools", "Wand",
    "Weapon", "Wondrous Items"
}

for i, item in enumerate(catalog):
    iid = item.get("id", f"index-{i}")

    # Required fields present and non-null (description can be empty string)
    for field in ["id", "name", "category", "rarity"]:
        val = item.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            errors.append(f"[{iid}] Required field '{field}' is null/empty")
    # description must not be None (but can be empty string)
    if item.get("description") is None:
        errors.append(f"[{iid}] Required field 'description' is None")

    # attunement is defined and boolean
    if "attunement" not in item:
        errors.append(f"[{iid}] Missing 'attunement' field")
    elif not isinstance(item["attunement"], bool):
        errors.append(f"[{iid}] attunement is {type(item['attunement']).__name__}, expected bool")

    # Rarity check
    rar = item.get("rarity", "")
    if rar not in VALID_RARITIES:
        errors.append(f"[{iid}] Invalid rarity: '{rar}'")

    # Category check
    cat = item.get("category", "")
    if cat not in valid_categories:
        errors.append(f"[{iid}] Invalid category: '{cat}'")

    # ID format (kebab-case)
    if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", iid):
        errors.append(f"[{iid}] ID is not kebab-case")

    # cost is a digit string
    cost = item.get("cost", "")
    if not re.match(r"^\d+$", str(cost)):
        errors.append(f"[{iid}] cost is not a digit string: '{cost}'")

# Duplicate (name + category) check
name_cat_index = {}
for item in catalog:
    key = norm_key(item)
    if key in name_cat_index:
        errors.append(f"Duplicate name+category: '{key[0]}' / '{key[1]}' "
                       f"(ids: {name_cat_index[key]}, {item['id']})")
    name_cat_index[key] = item["id"]

# Duplicate ID check (should have been resolved)
id_counts = Counter(item["id"] for item in catalog)
for iid, count in id_counts.items():
    if count > 1:
        errors.append(f"Duplicate ID: '{iid}' appears {count} times")

if errors:
    print(f"\nVALIDATION FAILED with {len(errors)} error(s):")
    for e in errors[:60]:
        print(f"  ERROR: {e}")
    if len(errors) > 60:
        print(f"  ... and {len(errors) - 60} more")
    sys.exit(1)
else:
    print(f"\nALL VALIDATIONS PASSED ({len(catalog)} items)")

# ── Step 8: Write items.json ─────────────────────────────────────────────────

# Ensure field order
FIELD_ORDER = ["id", "name", "image", "description", "category", "rarity",
               "classification", "ac", "damage", "damageType", "properties",
               "cost", "attunement"]

def reorder_fields(item):
    """Return item dict with standard field order."""
    ordered = {}
    for key in FIELD_ORDER:
        if key in item:
            ordered[key] = item[key]
    # Add any extra fields
    for key in item:
        if key not in ordered:
            ordered[key] = item[key]
    return ordered

ordered_catalog = [reorder_fields(item) for item in catalog]

with open("src/data/items.json", "w", encoding="utf-8") as f:
    json.dump(ordered_catalog, f, indent=2, ensure_ascii=False)
    f.write("\n")  # trailing newline

print(f"\nWrote src/data/items.json ({len(ordered_catalog)} items)")

# ── Step 9: Generate summary ─────────────────────────────────────────────────

# Category counts
cat_counts = Counter(item["category"] for item in catalog)
# Rarity counts
rar_counts = Counter(item["rarity"] for item in catalog)
# Image counts
img_count = sum(1 for item in catalog if item.get("image"))
# Cost counts
cost_count = sum(1 for item in catalog if item.get("cost") and item["cost"] != "0")
# Classification counts
class_count = sum(1 for item in catalog if item.get("classification"))

# Categories before vs after
original_cats = set()
for item in base_items:
    original_cats.add(item.get("category", ""))
new_cats = set(cat_counts.keys())
added_cats = new_cats - original_cats
removed_cats = original_cats - new_cats

summary_lines = []
summary_lines.append("=" * 60)
summary_lines.append("FINAL CATALOG SUMMARY")
summary_lines.append("=" * 60)
summary_lines.append(f"Total items: {len(catalog)}")
summary_lines.append("")
summary_lines.append("--- By Category ---")
for cat, count in cat_counts.most_common():
    summary_lines.append(f"  {count:>5}  {cat}")
summary_lines.append("")
summary_lines.append("--- By Rarity ---")
rarity_order = ["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"]
for rar in rarity_order:
    if rar in rar_counts:
        summary_lines.append(f"  {rar_counts[rar]:>5}  {rar}")
summary_lines.append("")
summary_lines.append("--- Statistics ---")
summary_lines.append(f"  Items with images:         {img_count}")
summary_lines.append(f"  Items with cost data:      {cost_count}")
summary_lines.append(f"  Items with classification: {class_count}")
summary_lines.append("")
summary_lines.append("--- Merge Details ---")
summary_lines.append(f"  Base items (Agent 4):              {len(base_items)}")
summary_lines.append(f"  Removed old potions:               {removed_potions}")
summary_lines.append(f"  Added Agent 3 potions:             {len(potion_items)}")
summary_lines.append(f"  Added Agent 2 scrolls:             {len(scroll_items)}")
summary_lines.append(f"  Net-new from Agent 1:              {stats['from_agent1']}")
summary_lines.append(f"  Agent 1 duplicates skipped:        {stats['duplicates']}")
summary_lines.append(f"  Agent 1 cross-category dupes:      {stats['cross_cat_dupes']}")
summary_lines.append(f"  Agent 1 templates skipped:         {stats['templates']}")
summary_lines.append(f"  Agent 1 Other category skipped:    {stats['other_category']}")
summary_lines.append(f"  Agent 1 potions skipped (replaced): {stats['potion_skipped']}")
summary_lines.append(f"  Agent 1 scrolls skipped (replaced): {stats['scroll_skipped']}")
summary_lines.append("")
summary_lines.append("--- Category Changes ---")
if added_cats:
    summary_lines.append(f"  New categories: {', '.join(sorted(added_cats))}")
if removed_cats:
    summary_lines.append(f"  Removed categories: {', '.join(sorted(removed_cats))}")
summary_lines.append("")

summary_text = "\n".join(summary_lines)

with open("tmp/final-catalog-summary.txt", "w", encoding="utf-8") as f:
    f.write(summary_text)

print(summary_text)
print("Wrote tmp/final-catalog-summary.txt")
