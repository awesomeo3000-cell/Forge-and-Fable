#!/usr/bin/env python3
"""
Generate a comprehensive catalog of D&D 5e potions, elixirs, and oils.
Output: tmp/potions-elixirs.json
"""

import json
import os
import re

# ============================================================
# 1. Define all known potions, oils, and elixirs
# ============================================================

# Helper: convert gp to cp (copper pieces) as string
def gp_to_cp(gp):
    return str(int(gp * 100))

# Build the complete catalog
catalog = []

def add_item(id, name, category, classification, rarity, description, gp_cost, attunement=False):
    catalog.append({
        "id": id,
        "name": name,
        "description": description,
        "category": category,
        "rarity": rarity,
        "classification": classification,
        "cost": gp_to_cp(gp_cost),
        "attunement": attunement
    })

# --- HEALING POTIONS ---
add_item(
    "potion-of-healing",
    "Potion of Healing",
    "Potions & Oils", "Potion", "Common",
    "You regain 2d4 + 2 hit points when you drink this potion. The potion's red liquid glimmers when agitated.",
    50
)
add_item(
    "potion-of-greater-healing",
    "Potion of Greater Healing",
    "Potions & Oils", "Potion", "Uncommon",
    "You regain 4d4 + 4 hit points when you drink this potion. The potion's red liquid glimmers when agitated.",
    150
)
add_item(
    "potion-of-superior-healing",
    "Potion of Superior Healing",
    "Potions & Oils", "Potion", "Rare",
    "You regain 8d4 + 8 hit points when you drink this potion. The potion's red liquid glimmers when agitated.",
    500
)
add_item(
    "potion-of-supreme-healing",
    "Potion of Supreme Healing",
    "Potions & Oils", "Potion", "Very Rare",
    "You regain 10d4 + 20 hit points when you drink this potion. The potion's red liquid glimmers when agitated.",
    1500
)

# --- GIANT STRENGTH POTIONS ---
add_item(
    "potion-of-hill-giant-strength",
    "Potion of Hill Giant Strength",
    "Potions & Oils", "Potion", "Uncommon",
    "When you drink this potion, your Strength score changes to 21 for 1 hour. The potion has no effect on you if your Strength is equal to or greater than that score.",
    200
)
add_item(
    "potion-of-frost-giant-strength",
    "Potion of Frost Giant Strength",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, your Strength score changes to 23 for 1 hour. The potion has no effect on you if your Strength is equal to or greater than that score.",
    500
)
add_item(
    "potion-of-stone-giant-strength",
    "Potion of Stone Giant Strength",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, your Strength score changes to 23 for 1 hour. The potion has no effect on you if your Strength is equal to or greater than that score.",
    500
)
add_item(
    "potion-of-fire-giant-strength",
    "Potion of Fire Giant Strength",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, your Strength score changes to 25 for 1 hour. The potion has no effect on you if your Strength is equal to or greater than that score.",
    1000
)
add_item(
    "potion-of-cloud-giant-strength",
    "Potion of Cloud Giant Strength",
    "Potions & Oils", "Potion", "Very Rare",
    "When you drink this potion, your Strength score changes to 27 for 1 hour. The potion has no effect on you if your Strength is equal to or greater than that score.",
    5000
)
add_item(
    "potion-of-storm-giant-strength",
    "Potion of Storm Giant Strength",
    "Potions & Oils", "Potion", "Legendary",
    "When you drink this potion, your Strength score changes to 29 for 1 hour. The potion has no effect on you if your Strength is equal to or greater than that score.",
    10000
)

# --- RESISTANCE POTIONS (one per damage type) ---
resistance_types = [
    ("acid", "Acid"),
    ("cold", "Cold"),
    ("fire", "Fire"),
    ("force", "Force"),
    ("lightning", "Lightning"),
    ("necrotic", "Necrotic"),
    ("poison", "Poison"),
    ("psychic", "Psychic"),
    ("radiant", "Radiant"),
    ("thunder", "Thunder"),
]

for dmg_id, dmg_name in resistance_types:
    add_item(
        f"potion-of-resistance-{dmg_id}",
        f"Potion of Resistance ({dmg_name})",
        "Potions & Oils", "Potion", "Uncommon",
        f"When you drink this potion, you gain resistance to {dmg_name.lower()} damage for 1 hour.",
        300
    )

# --- UTILITY POTIONS ---
add_item(
    "potion-of-animal-friendship",
    "Potion of Animal Friendship",
    "Potions & Oils", "Potion", "Uncommon",
    "When you drink this potion, you can cast the animal friendship spell (save DC 13) at will for 1 hour. Agitating this muddy liquid brings little bits into view: a fish scale, a hummingbird tongue, a cat claw, or a squirrel hair.",
    200
)
add_item(
    "potion-of-clairvoyance",
    "Potion of Clairvoyance",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, you gain the effect of the clairvoyance spell for 10 minutes. An eyeball bobs in this yellowish liquid but vanishes when the potion is opened.",
    500
)
add_item(
    "potion-of-climbing",
    "Potion of Climbing",
    "Potions & Oils", "Potion", "Common",
    "When you drink this potion, you gain a climbing speed equal to your walking speed for 1 hour. During this time, you have advantage on Strength (Athletics) checks you make to climb. The potion is separated into brown, silver, and gray layers resembling bands of stone.",
    50
)
add_item(
    "potion-of-diminution",
    "Potion of Diminution",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, you gain the 'reduce' effect of the enlarge/reduce spell for 1d4 hours (no concentration required). The red in the potion's liquid continuously contracts to a tiny bead and then expands to color the clear liquid around it.",
    300
)
add_item(
    "potion-of-flying",
    "Potion of Flying",
    "Potions & Oils", "Potion", "Very Rare",
    "When you drink this potion, you gain a flying speed equal to your walking speed for 1 hour and can hover. If you're in the air when the potion wears off, you fall unless you have some other means of staying aloft.",
    500
)
add_item(
    "potion-of-gaseous-form",
    "Potion of Gaseous Form",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, you gain the effect of the gaseous form spell for 1 hour (no concentration required) or until you end the effect as a bonus action. This potion's container seems to hold fog that moves and pours like water.",
    300
)
add_item(
    "potion-of-growth",
    "Potion of Growth",
    "Potions & Oils", "Potion", "Uncommon",
    "When you drink this potion, you gain the 'enlarge' effect of the enlarge/reduce spell for 1d4 hours (no concentration required). The red in the potion's liquid continuously expands from a tiny bead to color the clear liquid around it.",
    200
)
add_item(
    "potion-of-heroism",
    "Potion of Heroism",
    "Potions & Oils", "Potion", "Rare",
    "For 1 hour after drinking it, you gain 10 temporary hit points. For the same duration, you are under the effect of the bless spell (no concentration required). This blue potion bubbles and steams as if boiling.",
    500
)
add_item(
    "potion-of-invisibility",
    "Potion of Invisibility",
    "Potions & Oils", "Potion", "Very Rare",
    "This potion's container looks empty but feels as though it holds liquid. When you drink it, you become invisible for 1 hour. Anything you wear or carry is invisible with you. The effect ends early if you attack or cast a spell.",
    500
)
add_item(
    "potion-of-invulnerability",
    "Potion of Invulnerability",
    "Potions & Oils", "Potion", "Rare",
    "For 1 minute after you drink this potion, you have resistance to all damage.",
    500
)
add_item(
    "potion-of-longevity",
    "Potion of Longevity",
    "Potions & Oils", "Potion", "Very Rare",
    "When you drink this potion, your physical age is reduced by 1d6 + 6 years, to a minimum of 13 years. Each time you subsequently drink a potion of longevity, there is a 10 percent cumulative chance that it will instead age you by 1d6 + 6 years.",
    1000
)
add_item(
    "potion-of-mind-reading",
    "Potion of Mind Reading",
    "Potions & Oils", "Potion", "Rare",
    "When you drink this potion, you gain the effect of the detect thoughts spell (save DC 13) for 1 hour. The potion's dense, purple liquid has an ovoid cloud of pink floating in it.",
    300
)
add_item(
    "potion-of-poison",
    "Potion of Poison",
    "Potions & Oils", "Potion", "Uncommon",
    "This concoction looks, smells, and tastes like a potion of healing or other beneficial potion. However, it is actually poison masked by illusion magic. A creature that drinks it takes 3d6 poison damage and must succeed on a DC 13 Constitution saving throw or be poisoned for 1 hour. An identify spell reveals its true nature.",
    100
)
add_item(
    "potion-of-speed",
    "Potion of Speed",
    "Potions & Oils", "Potion", "Very Rare",
    "When you drink this potion, you gain the effect of the haste spell for 1 minute (no concentration required). The potion's yellow fluid is streaked with black and swirls on its own.",
    500
)
add_item(
    "potion-of-water-breathing",
    "Potion of Water Breathing",
    "Potions & Oils", "Potion", "Uncommon",
    "You can breathe underwater for 1 hour after drinking this potion. Its cloudy green fluid smells of the sea and has a jellyfish-like bubble floating in it.",
    200
)
add_item(
    "potion-of-vitality",
    "Potion of Vitality",
    "Potions & Oils", "Potion", "Very Rare",
    "When you drink this potion, it removes any exhaustion you are suffering and cures any disease or poison affecting you. For the next 24 hours, you regain the maximum number of hit points for any Hit Die you spend. The potion's crimson liquid regularly pulses with dull light, calling to mind a heartbeat.",
    500
)
add_item(
    "philter-of-love",
    "Philter of Love",
    "Potions & Oils", "Potion", "Uncommon",
    "The next time you see a creature within 10 minutes after drinking this philter, you become charmed by that creature for 1 hour. If the creature is of a species and gender you are normally attracted to, you regard it as your true love while you are charmed. This potion's rose-hued, effervescent liquid contains one easy-to-miss bubble shaped like a heart.",
    200
)

# --- OILS ---
add_item(
    "oil-of-etherealness",
    "Oil of Etherealness",
    "Potions & Oils", "Oil", "Rare",
    "Beads of this cloudy gray oil form on the outside of its container and quickly evaporate. The oil can cover a Medium or smaller creature, along with the equipment it's wearing and carrying. Applying the oil takes 10 minutes. The affected creature then gains the effect of the etherealness spell for 1 hour.",
    2000
)
add_item(
    "oil-of-sharpness",
    "Oil of Sharpness",
    "Potions & Oils", "Oil", "Very Rare",
    "This clear, gelatinous oil sparkles with tiny, ultrathin silver shards. The oil can coat one slashing or piercing weapon or up to 5 pieces of slashing or piercing ammunition. Applying the oil takes 1 minute. For 1 hour, the coated item is magical and has a +3 bonus to attack and damage rolls.",
    3000
)
add_item(
    "oil-of-slipperiness",
    "Oil of Slipperiness",
    "Potions & Oils", "Oil", "Uncommon",
    "This sticky black unguent is thick and heavy in the container, but it flows quickly when poured. The oil can cover a Medium or smaller creature, granting the effect of a freedom of movement spell for 8 hours. Alternatively, the oil can be poured on the ground as an action to cover a 10-foot square, duplicating the effect of the grease spell for 8 hours.",
    200
)
add_item(
    "oil-of-taggit",
    "Oil of Taggit",
    "Potions & Oils", "Oil", "Uncommon",
    "A creature subjected to this poison must succeed on a DC 13 Constitution saving throw or become poisoned for 24 hours. The poisoned creature is unconscious. It wakes up if it takes damage. This greasy white oil is made from the leaves of the taggit plant.",
    400
)

# --- ADDITIONAL POTIONS FROM SUPPLEMENTS ---
add_item(
    "potion-of-watchful-rest",
    "Potion of Watchful Rest",
    "Potions & Oils", "Potion", "Common",
    "When you drink this potion, you gain the full benefits of a long rest even if you spend the duration keeping watch or performing other light activity. The potion's pale blue liquid has tiny motes of light swirling within it.",
    75
)
add_item(
    "potion-of-fire-breath",
    "Potion of Fire Breath",
    "Potions & Oils", "Potion", "Uncommon",
    "After drinking this potion, you can use a bonus action to exhale fire at a target within 30 feet of you. The target must make a DC 13 Dexterity saving throw, taking 4d6 fire damage on a failed save, or half as much on a successful one. The effect ends after you have exhaled the fire three times, or after 1 hour. This potion's orange liquid flickers, and smoke fills the top of the container.",
    150
)
add_item(
    "potion-of-possibility",
    "Potion of Possibility",
    "Potions & Oils", "Potion", "Very Rare",
    "When you drink this iridescent potion, you gain two Fragments of Possibility. When you make an attack roll, an ability check, or a saving throw, you can expend one fragment to roll an additional d20 and choose which of the d20s to use. Alternatively, when an attack roll is made against you, you can expend one fragment to force the attacker to roll an additional d20 and use the lower result. The fragments last for 8 hours or until expended.",
    800
)
add_item(
    "potion-of-maximum-power",
    "Potion of Maximum Power",
    "Potions & Oils", "Potion", "Very Rare",
    "For 1 minute after drinking this potion, whenever you deal damage with a spell of 5th level or lower, you deal the maximum possible damage instead of rolling. The potion's purple liquid crackles with arcane energy and smells of ozone.",
    800
)
add_item(
    "potion-of-giant-size",
    "Potion of Giant Size",
    "Potions & Oils", "Potion", "Legendary",
    "When you drink this potion, you become Huge for 24 hours. While Huge, your Strength becomes 25, your speed increases by 10 feet, your reach increases by 5 feet, your weapon attacks deal double damage dice, and you gain temporary hit points equal to your level at the start of each of your turns. The potion's opaque gray liquid has flecks of iron and diamond suspended in it.",
    50000
)
add_item(
    "potion-of-dragons-majesty",
    "Potion of Dragon's Majesty",
    "Potions & Oils", "Potion", "Legendary",
    "When you drink this potion, you transform into an adult dragon of a type chosen when the potion was created for 1 hour. The transformation works like the shapechange spell, but you are limited to the dragon form. This potion looks like liquid gold, with a single scale from the relevant dragon type suspended within.",
    25000
)

# --- ELIXIRS ---
add_item(
    "elixir-of-health",
    "Elixir of Health",
    "Elixir", "Elixir", "Rare",
    "When you drink this elixir, it cures any disease affecting you, and it removes the blinded, deafened, paralyzed, and poisoned conditions. The clear, sparkling liquid has a sweet taste and leaves a faint glow on the drinker's tongue.",
    500
)

# ============================================================
# 2. Validate and write output
# ============================================================

# Ensure all IDs are unique
ids = [item["id"] for item in catalog]
seen = set()
dupes = []
for id_ in ids:
    if id_ in seen:
        dupes.append(id_)
    seen.add(id_)

if dupes:
    print(f"WARNING: Duplicate IDs found: {dupes}")
else:
    print("All IDs are unique.")

# Validate kebab-case
kebab_pattern = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
bad_ids = [id_ for id_ in ids if not kebab_pattern.match(id_)]
if bad_ids:
    print(f"WARNING: Non-kebab-case IDs: {bad_ids}")
else:
    print("All IDs are valid kebab-case.")

# Ensure costs are strings
for item in catalog:
    assert isinstance(item["cost"], str), f"Cost for {item['id']} is not a string: {type(item['cost'])}"

# Categories
categories = set(item["category"] for item in catalog)
print(f"Categories present: {categories}")

# Write output
output_path = os.path.join(os.path.dirname(__file__), "potions-elixirs.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"\nTotal items: {len(catalog)}")
print(f"Written to: {output_path}")

# Stats
potion_count = sum(1 for i in catalog if i["classification"] == "Potion")
oil_count = sum(1 for i in catalog if i["classification"] == "Oil")
elixir_count = sum(1 for i in catalog if i["classification"] == "Elixir")
print(f"  Potions: {potion_count}")
print(f"  Oils: {oil_count}")
print(f"  Elixirs: {elixir_count}")

# Rarity breakdown
from collections import Counter
rarities = Counter(i["rarity"] for i in catalog)
for rarity, count in sorted(rarities.items(), key=lambda x: ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"].index(x[0])):
    print(f"  {rarity}: {count}")
