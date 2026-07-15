#!/usr/bin/env python3
"""Generate spell scroll CatalogItem entries from spells.json."""

import json
import os

# --- Config ---
SPELLS_PATH = "E:/forge-and-fable/data/spells.json"
OUTPUT_PATH = "E:/forge-and-fable/tmp/spell-scrolls.json"

# Level to rarity/cost mapping
LEVEL_MAP = {
    0: {"rarity": "Common", "cost_gp": 30, "cost_cp": "3000"},
    1: {"rarity": "Common", "cost_gp": 60, "cost_cp": "6000"},
    2: {"rarity": "Uncommon", "cost_gp": 120, "cost_cp": "12000"},
    3: {"rarity": "Uncommon", "cost_gp": 200, "cost_cp": "20000"},
    4: {"rarity": "Rare", "cost_gp": 500, "cost_cp": "50000"},
    5: {"rarity": "Rare", "cost_gp": 1000, "cost_cp": "100000"},
    6: {"rarity": "Very Rare", "cost_gp": 5000, "cost_cp": "500000"},
    7: {"rarity": "Very Rare", "cost_gp": 10000, "cost_cp": "1000000"},
    8: {"rarity": "Very Rare", "cost_gp": 20000, "cost_cp": "2000000"},
    9: {"rarity": "Legendary", "cost_gp": 50000, "cost_cp": "5000000"},
}


def level_label(level: int) -> str:
    """Return human-readable level label."""
    if level == 0:
        return "Cantrip"
    if level == 1:
        return "1st Level"
    if level == 2:
        return "2nd Level"
    if level == 3:
        return "3rd Level"
    return f"{level}th Level"


def level_classification(level: int) -> str:
    """Return the level word for classification."""
    if level == 0:
        return "Cantrip"
    if level == 1:
        return "1st-level"
    if level == 2:
        return "2nd-level"
    if level == 3:
        return "3rd-level"
    return f"{level}th-level"


def format_description(spell: dict) -> str:
    """Build a nicely formatted description string."""
    lines = []

    # The spell effect description
    lines.append(spell["description"])

    lines.append("")
    lines.append(f"Casting Time: {spell['castingTime']}")
    lines.append(f"Range: {spell['range']}")
    
    # Components
    comps = spell["components"]
    comp_str = f"Components: {comps}"
    if spell.get("material"):
        comp_str += f" ({spell['material']})"
    lines.append(comp_str)
    
    lines.append(f"Duration: {spell['duration']}")

    # Ritual note
    if spell.get("ritual"):
        lines.append("Ritual: Yes")

    # Concentration note
    if spell.get("concentration"):
        lines.append("Concentration: Yes")

    # Classes
    if spell.get("classes"):
        lines.append(f"Available to: {', '.join(spell['classes'])}")

    return "\n".join(lines)


def build_classification(spell: dict) -> str:
    """Build classification string like '3rd-level evocation'."""
    level_word = level_classification(spell["level"])
    school = spell["school"].lower()

    parts = [f"{level_word} {school}"]

    if spell.get("ritual"):
        parts.append("(ritual)")
    if spell.get("concentration"):
        parts.append("(concentration)")

    return " ".join(parts)


def generate_scroll(spell: dict) -> dict:
    """Generate a single CatalogItem from a spell."""
    level = spell["level"]
    info = LEVEL_MAP[level]
    level_lbl = level_label(level)

    return {
        "id": f"spell-scroll-{spell['id']}",
        "name": f"Spell Scroll: {spell['name']} ({level_lbl})",
        "image": "",
        "description": format_description(spell),
        "category": "Scroll",
        "rarity": info["rarity"],
        "classification": build_classification(spell),
        "ac": "",
        "damage": "",
        "damageType": "",
        "properties": "",
        "cost": info["cost_cp"],
        "attunement": False,
    }


def generate_protection_scroll() -> dict:
    """Generate a Scroll of Protection (vanilla, not spell-specific)."""
    return {
        "id": "scroll-of-protection",
        "name": "Scroll of Protection",
        "image": "",
        "description": (
            "Each scroll of protection works against a specific creature type "
            "chosen by the DM or determined randomly. Using an action to read the "
            "scroll encloses you in an invisible barrier that protects you from "
            "creatures of that type. The barrier extends in a 5-foot radius, moves "
            "with you, and lasts for 5 minutes. Creatures of the chosen type cannot "
            "enter or pass through the barrier. If you move such that a protected "
            "creature would be inside the barrier, the effect ends. A protected "
            "creature's attacks and spells cannot cross the barrier either."
        ),
        "category": "Scroll",
        "rarity": "Rare",
        "classification": "Scroll of Protection",
        "ac": "",
        "damage": "",
        "damageType": "",
        "properties": "",
        "cost": "50000",
        "attunement": False,
    }


def main():
    # Load spells
    with open(SPELLS_PATH, "r", encoding="utf-8") as f:
        spells = json.load(f)

    print(f"Loaded {len(spells)} spells from {SPELLS_PATH}")

    # Generate scrolls (skip spells with null/missing level)
    scrolls = []
    skipped = 0

    for spell in spells:
        level = spell.get("level")
        if level is None:
            print(f"  SKIPPED (no level): {spell.get('name', 'UNKNOWN')}")
            skipped += 1
            continue
        scrolls.append(generate_scroll(spell))

    # Add vanilla protection scroll
    scrolls.append(generate_protection_scroll())

    # Validate uniqueness
    ids = [s["id"] for s in scrolls]
    duplicates = [i for i in ids if ids.count(i) > 1]
    if duplicates:
        print(f"WARNING: Duplicate IDs found: {set(duplicates)}")
    else:
        print("All IDs are unique.")

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(scrolls, f, indent=2, ensure_ascii=False)

    # Summary
    print(f"\n=== Summary ===")
    print(f"Spells processed: {len(spells)}")
    print(f"Spells skipped: {skipped}")
    print(f"Total scroll entries: {len(scrolls)} (includes 1 vanilla protection scroll)")
    print(f"Output written to: {OUTPUT_PATH}")

    # Rarity breakdown
    rarity_counts = {}
    for s in scrolls:
        r = s["rarity"]
        rarity_counts[r] = rarity_counts.get(r, 0) + 1
    print(f"\nRarity breakdown:")
    for rarity, count in sorted(rarity_counts.items()):
        print(f"  {rarity}: {count}")


if __name__ == "__main__":
    main()
