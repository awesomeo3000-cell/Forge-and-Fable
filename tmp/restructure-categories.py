#!/usr/bin/env python3
"""
Agent 4: Category Restructure for items.json

Tasks:
1. Split Wondrous Items into Rings, Rods, Staves, Wands, and remaining Wondrous Items
2. Remove {modifier} junk/template items
3. Add classification tags based on category
4. Flag armor/weapon items missing weight data
"""

import json
import os
from collections import Counter

# Paths
SRC = "E:/forge-and-fable/src/data/items.json"
OUT_DIR = "E:/forge-and-fable/tmp"
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Load source data
# ---------------------------------------------------------------------------
with open(SRC, "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"Loaded {len(items)} items from {SRC}")

# ---------------------------------------------------------------------------
# Helper: weapon base names to classification mapping
# ---------------------------------------------------------------------------
WEAPON_CLASS_MAP = {
    # Simple Melee
    "Club": "Simple Melee Weapon",
    "Dagger": "Simple Melee Weapon",
    "Greatclub": "Simple Melee Weapon",
    "Handaxe": "Simple Melee Weapon",
    "Javelin": "Simple Melee Weapon",
    "Light Hammer": "Simple Melee Weapon",
    "Mace": "Simple Melee Weapon",
    "Quarterstaff": "Simple Melee Weapon",
    "Sickle": "Simple Melee Weapon",
    "Spear": "Simple Melee Weapon",
    # Simple Ranged
    "Light Crossbow": "Simple Ranged Weapons",
    "Dart": "Simple Ranged Weapons",
    "Shortbow": "Simple Ranged Weapons",
    "Sling": "Simple Ranged Weapons",
    # Martial Melee
    "Battleaxe": "Martial Melee Weapons",
    "Flail": "Martial Melee Weapons",
    "Glaive": "Martial Melee Weapons",
    "Greataxe": "Martial Melee Weapons",
    "Greatsword": "Martial Melee Weapons",
    "Halberd": "Martial Melee Weapons",
    "Lance": "Martial Melee Weapons",
    "Longsword": "Martial Melee Weapons",
    "Maul": "Martial Melee Weapons",
    "Morningstar": "Martial Melee Weapons",
    "Pike": "Martial Melee Weapons",
    "Rapier": "Martial Melee Weapons",
    "Scimitar": "Martial Melee Weapons",
    "Shortsword": "Martial Melee Weapons",
    "Trident": "Martial Melee Weapons",
    "War Pick": "Martial Melee Weapons",
    "War pick": "Martial Melee Weapons",
    "Warhammer": "Martial Melee Weapons",
    "Whip": "Martial Melee Weapons",
    # Martial Ranged
    "Blowgun": "Martial Ranged Weapons",
    "Hand Crossbow": "Martial Ranged Weapons",
    "Heavy Crossbow": "Martial Ranged Weapons",
    "Longbow": "Martial Ranged Weapons",
    "Net": "Martial Ranged Weapons",
    # Magical weapon base names
    "Vicious Club": "Simple Melee Weapon",
    "Vicious Dagger": "Simple Melee Weapon",
    "Vicious Javelin": "Simple Melee Weapon",
    "Vicious Sickle": "Simple Melee Weapon",
    "Vicious Shortbow": "Simple Ranged Weapons",
    "Vicious Battleaxe": "Martial Melee Weapons",
    "Vicious Greatsword": "Martial Melee Weapons",
    "Trident of Fish Command": "Martial Melee Weapons",
    "Greatsword of Life-Stealing": "Martial Melee Weapons",
    "Shortsword of Life-Stealing": "Martial Melee Weapons",
    "Javelin of Lightning": "Simple Melee Weapon",
    "Greatsword of Sharpness": "Martial Melee Weapons",
    "Dancing Scimitar": "Martial Melee Weapons",
    "Dancing Rapier": "Martial Melee Weapons",
    "Longsword of Wounding": "Martial Melee Weapons",
    "Dagger of Wounding": "Simple Melee Weapon",
    "Frost Brand Greatsword": "Martial Melee Weapons",
    "Dagger of Venom": "Simple Melee Weapon",
    "Oathbow": "Martial Ranged Weapons",
    "Flame Tongue Dagger": "Simple Melee Weapon",
    "Scimitar of Speed": "Martial Melee Weapons",
    "Giant Slayer Battleaxe": "Martial Melee Weapons",
    "Mace of Smiting": "Simple Melee Weapon",
    "Dragon Slayer Longsword": "Martial Melee Weapons",
    "Mace of Disruption": "Simple Melee Weapon",
    "Mace of Terror": "Simple Melee Weapon",
    "Nine Lives Stealer": "Martial Melee Weapons",
    "Sun Blade": "Martial Melee Weapons",
    "Hammer of Thunderbolts": "Martial Melee Weapons",
    "Dwarven Thrower": "Martial Melee Weapons",
    "Vorpal Scimitar": "Martial Melee Weapons",
    "Defender Greatsword": "Martial Melee Weapons",
    "Holy Avenger Greatsword": "Martial Melee Weapons",
}


def classify_weapon(item):
    """Derive weapon classification from name."""
    # Check if ammunition
    name_lower = item["name"].lower()
    if any(ammo in name_lower for ammo in ["arrows", "blowgun needles", "crossbow bolts", "sling bullets"]):
        return "Ammunition"
    # Check exact name match
    if item["name"] in WEAPON_CLASS_MAP:
        return WEAPON_CLASS_MAP[item["name"]]
    # Try partial match: strip magical prefixes/suffixes
    # Pattern: "X of Y" or "Adjective X" - find base weapon
    for base_name, cls in sorted(WEAPON_CLASS_MAP.items(), key=lambda x: -len(x[0])):
        if base_name in item["name"]:
            return cls
    return ""


# ---------------------------------------------------------------------------
# Helper: armor classification
# ---------------------------------------------------------------------------
ARMOR_TYPE_MAP = {
    "Leather": "Light Armor",
    "Padded": "Light Armor",
    "Studded Leather": "Light Armor",
    "Breastplate": "Medium Armor",
    "Chain Shirt": "Medium Armor",
    "Half Plate": "Medium Armor",
    "Hide": "Medium Armor",
    "Scale Mail": "Medium Armor",
    "Chain Mail": "Heavy Armor",
    "Plate": "Heavy Armor",
    "Ring Mail": "Heavy Armor",
    "Splint": "Heavy Armor",
}

SHIELD_NAMES = {"Shield", "Animated Shield", "Arrow-Catching Shield", "Shield of Missile Attraction", "Spellguard Shield"}


def classify_armor(item):
    """Derive armor classification."""
    name = item["name"]
    if name in SHIELD_NAMES or "Shield" in name:
        return "Shield"
    for base, cls in sorted(ARMOR_TYPE_MAP.items(), key=lambda x: -len(x[0])):
        if base.lower() in name.lower():
            return cls
    # Heuristic: if AC starts with +, it's a shield
    ac = item.get("ac", "")
    if ac and ac.startswith("+"):
        return "Shield"
    return ""


# ---------------------------------------------------------------------------
# Helper: adventuring gear classification
# ---------------------------------------------------------------------------
CONTAINER_KEYWORDS = [
    "backpack", "barrel", "basket", "bottle", "bucket", "case", "chest",
    "flask", "jug", "pitcher", "pot, iron", "pot", "pouch", "quiver",
    "sack", "tankard", "vial", "waterskin", "box", "bag"
]
LIGHT_SOURCE_KEYWORDS = ["candle", "lamp", "lantern", "torch", "tinderbox", "glow stone"]
CLOTHING_KEYWORDS = ["clothes", "robe", "cloak", "dress", "vestment", "hat", "hood", "scarf", "belt"]
KIT_KEYWORDS = ["kit", "mess kit", "healer"]
PACK_KEYWORDS = ["bedroll", "blanket", "tent", "soap"]
FOOD_KEYWORDS = ["rations", "cheese", "bacon", "honey", "jerky", "raisins", "tobacco"]
WRITING_KEYWORDS = ["ink", "paper", "parchment", "pen", "book", "spellbook", "sealing wax"]
CLIMBING_KEYWORDS = ["rope", "chain", "grappling hook", "block and tackle"]
TOOL_GEAR_KEYWORDS = ["hammer", "crowbar", "shovel", "saw", "whetstone", "pick, miner", "lock",
                      "manacles", "hourglass", "bell", "scale, merchant", "signal whistle",
                      "spyglass", "magnifying glass", "mirror", "pole"]
FOCUS_KEYWORDS = ["arcane focus", "druidic focus", "holy symbol", "component pouch"]
WEAPONLIKE_KEYWORDS = ["acid", "alchemist", "antitoxin", "holy water", "poison, basic",
                       "caltrops", "ball bearings", "hunting trap", "oil"]


def classify_adventuring_gear(item):
    """Derive adventuring gear sub-classification."""
    name = item["name"].lower()
    # Spellcasting Focus
    for kw in FOCUS_KEYWORDS:
        if kw in name:
            return "Spellcasting Focus"
    # Kit
    for kw in KIT_KEYWORDS:
        if kw in name:
            return "Kit"
    # Pack
    for kw in PACK_KEYWORDS:
        if kw in name:
            return "Bedroll & Camping"
    # Clothing
    for kw in CLOTHING_KEYWORDS:
        if kw in name:
            return "Clothing"
    # Food & Drink
    for kw in FOOD_KEYWORDS:
        if kw in name:
            return "Food & Drink"
    # Writing
    for kw in WRITING_KEYWORDS:
        if kw in name:
            return "Writing"
    # Light Source
    for kw in LIGHT_SOURCE_KEYWORDS:
        if kw in name:
            return "Light Source"
    # Container
    for kw in CONTAINER_KEYWORDS:
        if kw in name:
            return "Container"
    # Alchemical / Weapon-like
    for kw in WEAPONLIKE_KEYWORDS:
        if kw in name:
            return "Alchemical Item"
    # Climbing
    for kw in CLIMBING_KEYWORDS:
        if kw in name:
            return "Climbing Gear"
    # Tools/Hardware
    for kw in TOOL_GEAR_KEYWORDS:
        if kw in name:
            return "Tool"
    return "General Gear"


# ---------------------------------------------------------------------------
# Helper: tools classification
# ---------------------------------------------------------------------------
MUSICAL_INSTRUMENTS = {"bagpipes", "drum", "dulcimer", "flute", "lute", "lyre",
                       "horn", "pan flute", "shawm", "viola"}
GAMING_SETS = {"dice set", "playing card set"}


def classify_tool(item):
    """Derive tool sub-classification."""
    name = item["name"].lower()
    if name in MUSICAL_INSTRUMENTS:
        return "Musical Instrument"
    if name in GAMING_SETS or "dice" in name or "playing card" in name:
        return "Gaming Set"
    if "kit" in name:
        return "Kit"
    if any(kw in name for kw in ["supplies", "utensils", "tools"]):
        return "Artisan's Tools"
    return ""


# ---------------------------------------------------------------------------
# Task 1: Split Wondrous Items
# ---------------------------------------------------------------------------
print("\n=== Task 1: Splitting Wondrous Items ===")
rings_count = 0
rods_count = 0
staves_count = 0
wands_count = 0

for item in items:
    if item["category"] != "Wondrous Items":
        continue
    name = item["name"]

    # Ring detection
    if "Ring of" in name or name.startswith("Ring "):
        item["category"] = "Ring"
        item["classification"] = "Ring"
        rings_count += 1
    # Rod detection
    elif "Rod of" in name:
        item["category"] = "Rod"
        item["classification"] = "Rod"
        rods_count += 1
    # Staff/Stave detection
    elif "Staff of" in name or "Stave of" in name:
        item["category"] = "Staff"
        item["classification"] = "Staff"
        staves_count += 1
    # Wand detection
    elif "Wand of" in name:
        item["category"] = "Wand"
        item["classification"] = "Wand"
        wands_count += 1

print(f"  Rings: {rings_count}")
print(f"  Rods: {rods_count}")
print(f"  Staves: {staves_count}")
print(f"  Wands: {wands_count}")
print(f"  Remaining in Wondrous Items: {175 - rings_count - rods_count - staves_count - wands_count}")


# ---------------------------------------------------------------------------
# Task 2: Remove Junk Items
# ---------------------------------------------------------------------------
print("\n=== Task 2: Removing Junk Items ===")
removed_junk = []
kept_items = []
for item in items:
    if "{modifier}" in item["name"]:
        removed_junk.append({"id": item["id"], "name": item["name"]})
    else:
        kept_items.append(item)

print(f"  Removed {len(removed_junk)} junk items")
for j in removed_junk:
    print(f"    - {j['id']}: {j['name']}")

items = kept_items

# Save removed junk list
with open(os.path.join(OUT_DIR, "removed-junk.json"), "w", encoding="utf-8") as f:
    json.dump(removed_junk, f, indent=2, ensure_ascii=False)
print(f"  Saved removed junk to tmp/removed-junk.json")


# ---------------------------------------------------------------------------
# Task 3: Add Classification Tags
# ---------------------------------------------------------------------------
print("\n=== Task 3: Adding Classification Tags ===")

# Redistribute "Other" category items that remain
# Items that should be in specific categories
other_to_armor = {"old-round-shield-504", "flesh-shield-477"}
other_to_tools = {"bone-dice-455", "weighted-die-6-sided-516"}

classification_added = 0
for item in items:
    cat = item["category"]
    cls = item.get("classification", "")

    # Skip if already classified (unless it was an Other item being moved)
    if cls and cat != "Other":
        continue

    # --- Handle Other category items ---
    if cat == "Other":
        # Move shield-like items to Armor
        if item["id"] in other_to_armor:
            item["category"] = "Armor"
            item["classification"] = "Shield"
            classification_added += 1
            continue
        # Move dice to Tools
        if item["id"] in other_to_tools:
            item["category"] = "Tools"
            item["classification"] = "Gaming Set"
            classification_added += 1
            continue
        # Everything else in Other -> Adventuring Gear
        item["category"] = "Adventuring Gear"
        # Classify
        item["classification"] = classify_adventuring_gear(item)
        classification_added += 1
        continue

    # --- Armor ---
    if cat == "Armor":
        if not cls:
            item["classification"] = classify_armor(item)
            classification_added += 1

    # --- Weapon ---
    elif cat == "Weapon":
        if not cls:
            item["classification"] = classify_weapon(item)
            classification_added += 1

    # --- Adventuring Gear ---
    elif cat == "Adventuring Gear":
        if not cls:
            item["classification"] = classify_adventuring_gear(item)
            classification_added += 1

    # --- Tools ---
    elif cat == "Tools":
        if not cls:
            item["classification"] = classify_tool(item)
            classification_added += 1

    # --- Wondrous Items (remaining) ---
    elif cat == "Wondrous Items":
        if not cls:
            item["classification"] = "Wondrous Item"
            classification_added += 1

    # --- Poisons ---
    elif cat == "Poisons":
        if not cls:
            item["classification"] = "Poison"
            classification_added += 1

    # --- Potions & Oils ---
    elif cat == "Potions & Oils":
        if not cls:
            item["classification"] = "Potion"
            classification_added += 1

print(f"  Added/modified classification for {classification_added} items")


# ---------------------------------------------------------------------------
# Task 4: Flag Items Missing Weight
# ---------------------------------------------------------------------------
print("\n=== Task 4: Flagging Missing Weights ===")
missing_weight = []
for item in items:
    if item["category"] in ("Armor", "Weapon"):
        # Check if weight field exists and is non-empty
        if "weight" not in item or not item.get("weight"):
            missing_weight.append({
                "id": item["id"],
                "name": item["name"],
                "category": item["category"],
                "classification": item.get("classification", ""),
            })

# Save missing weights report
with open(os.path.join(OUT_DIR, "missing-weights.txt"), "w", encoding="utf-8") as f:
    f.write("=== Items Missing Weight Data ===\n")
    f.write("These armor and weapon items need weight data from Agent 1's merged catalog.\n\n")
    by_cat = {}
    for mw in missing_weight:
        cat = mw["category"]
        if cat not in by_cat:
            by_cat[cat] = []
        by_cat[cat].append(mw)

    for cat in ["Armor", "Weapon"]:
        items_in_cat = by_cat.get(cat, [])
        f.write(f"## {cat} ({len(items_in_cat)} items)\n\n")
        for mw in items_in_cat:
            f.write(f"  {mw['id']}: {mw['name']}  [{mw['classification']}]\n")
        f.write("\n")

print(f"  Flagged {len(missing_weight)} armor/weapon items missing weight")
print(f"  Saved report to tmp/missing-weights.txt")


# ---------------------------------------------------------------------------
# Save restructured items
# ---------------------------------------------------------------------------
with open(os.path.join(OUT_DIR, "restructured-items.json"), "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2, ensure_ascii=False)
print(f"\nSaved {len(items)} restructured items to tmp/restructured-items.json")


# ---------------------------------------------------------------------------
# Final Report
# ---------------------------------------------------------------------------
print("\n" + "=" * 60)
print("FINAL CATEGORY COUNTS")
print("=" * 60)
cat_counts = Counter(item["category"] for item in items)
for cat, count in cat_counts.most_common():
    print(f"  {cat:<25s}: {count:>4d}")
print(f"  {'TOTAL':<25s}: {len(items):>4d}")

print("\n" + "=" * 60)
print("CLASSIFICATION COVERAGE")
print("=" * 60)
with_cls = sum(1 for i in items if i.get("classification"))
without_cls = sum(1 for i in items if not i.get("classification"))
print(f"  With classification:    {with_cls}")
print(f"  Without classification: {without_cls}")

if without_cls > 0:
    print("\n  Items still missing classification:")
    for i in items:
        if not i.get("classification"):
            print(f"    - {i['id']}: {i['name']} (category: {i['category']})")

print("\nDone!")
