#!/usr/bin/env python3
"""
Fetch all SRD monsters from the D&D 5e API and convert to CreatureLibraryRecord format.
Outputs tmp/srd-creatures-core.json
"""

import json
import urllib.request
import urllib.error
import time
import os
import sys

BASE_URL = "https://www.dnd5eapi.co"
MONSTERS_LIST_URL = f"{BASE_URL}/api/monsters"
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "srd-creatures-core.json")

XP_TABLE = {
    0: 0, 0.125: 25, 0.25: 50, 0.5: 100,
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
    6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
    11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
    16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
    21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
    26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
}

def fetch_json(url, retries=2):
    """Fetch JSON from a URL with retries."""
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ForgeAndFable/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            if attempt < retries:
                time.sleep(1 * (attempt + 1))
                continue
            print(f"  ERROR fetching {url}: {e}", file=sys.stderr)
            return None

def compute_xp(cr):
    """Compute XP from challenge rating."""
    return XP_TABLE.get(cr, 0)

def format_speed(speed_obj):
    """Format speed object into a string like '30 ft., fly 60 ft. (hover)'."""
    if not speed_obj:
        return ""
    
    parts = []
    hover = speed_obj.get("hover", False)
    
    movement_order = ["walk", "fly", "swim", "burrow", "climb"]
    for move_type in movement_order:
        if move_type in speed_obj:
            speed_str = speed_obj[move_type]
            # Add hover suffix for fly speeds when hover is true
            if move_type == "fly" and hover:
                # Ensure proper format: "fly 60 ft." -> "fly 60 ft. (hover)"
                if speed_str.endswith("."):
                    speed_str = speed_str[:-1] + ". (hover)"
                else:
                    speed_str = speed_str + " (hover)"
            # Walk speed: just the value. Other speeds: prefix with movement type.
            if move_type == "walk":
                parts.append(speed_str)
            else:
                parts.append(f"{move_type} {speed_str}")
    
    # Handle any other movement types not in the standard list
    for key, val in speed_obj.items():
        if key not in movement_order and key != "hover":
            parts.append(val)
    
    return ", ".join(parts) if parts else ""

def format_saving_throws(proficiencies):
    """Extract saving throws from proficiencies array. Format: 'Dex +5, Con +3'"""
    saves = []
    for prof in proficiencies:
        name = prof.get("proficiency", {}).get("name", "")
        if name.startswith("Saving Throw:"):
            abbr = name.split(":")[1].strip()  # e.g., "CON", "DEX"
            # Convert to title case: "CON" -> "Con", "DEX" -> "Dex"
            abbr_title = abbr[0] + abbr[1:].lower()
            value = prof.get("value", 0)
            sign = "+" if value >= 0 else ""
            saves.append(f"{abbr_title} {sign}{value}")
    return ", ".join(saves) if saves else ""

def format_skills(proficiencies):
    """Extract skills from proficiencies array. Format: 'Perception +4, Stealth +6'"""
    skills = []
    for prof in proficiencies:
        name = prof.get("proficiency", {}).get("name", "")
        if name.startswith("Skill:"):
            skill_name = name.split(":")[1].strip()  # e.g., "Perception", "Stealth"
            value = prof.get("value", 0)
            sign = "+" if value >= 0 else ""
            skills.append(f"{skill_name} {sign}{value}")
    return ", ".join(skills) if skills else ""

def format_senses(senses_obj):
    """Format senses object into string like 'darkvision 60 ft., passive Perception 14'"""
    if not senses_obj:
        return ""
    
    parts = []
    sense_keys = ["darkvision", "blindsight", "tremorsense", "truesight"]
    for key in sense_keys:
        if key in senses_obj:
            parts.append(f"{key} {senses_obj[key]}")
    
    # Add passive perception
    pp = senses_obj.get("passive_perception")
    if pp is not None:
        parts.append(f"passive Perception {pp}")
    
    return ", ".join(parts) if parts else ""

def format_damage_arrays(arr):
    """Join damage vulnerability/resistance/immunity arrays. These are strings or arrays of strings."""
    if not arr:
        return ""
    if isinstance(arr, list):
        return ", ".join(arr) if arr else ""
    return str(arr)

def format_condition_immunities(arr):
    """Join condition immunity arrays."""
    if not arr:
        return ""
    if isinstance(arr, list):
        # Each item might be an object with 'name' or just a string
        result = []
        for item in arr:
            if isinstance(item, dict):
                result.append(item.get("name", str(item)))
            else:
                result.append(str(item))
        return ", ".join(result) if result else ""
    return str(arr)

def convert_monster(data):
    """Convert a single monster API response to CreatureLibraryRecord."""
    if not data:
        return None
    
    # Core identity
    creature_id = data.get("index", "")
    name = data.get("name", "")
    creature_type = data.get("type", "")
    size = data.get("size", "")
    alignment = data.get("alignment", "")
    
    # Challenge rating and XP
    cr = data.get("challenge_rating", 0)
    xp = compute_xp(cr)
    
    # Armor class (first entry only)
    ac_list = data.get("armor_class", [])
    ac = ac_list[0].get("value", 10) if ac_list else 10
    
    # Hit points
    hp = {
        "average": data.get("hit_points", 0),
        "formula": data.get("hit_points_roll", "")
    }
    
    # Speed
    speed = format_speed(data.get("speed", {}))
    
    # Abilities
    abilities = {
        "strength": data.get("strength", 10),
        "dexterity": data.get("dexterity", 10),
        "constitution": data.get("constitution", 10),
        "intelligence": data.get("intelligence", 10),
        "wisdom": data.get("wisdom", 10),
        "charisma": data.get("charisma", 10),
    }
    
    # Proficiencies -> saving throws and skills
    proficiencies = data.get("proficiencies", [])
    saving_throws = format_saving_throws(proficiencies)
    skills = format_skills(proficiencies)
    
    # Senses and passive perception
    senses_obj = data.get("senses", {})
    senses = format_senses(senses_obj)
    passive_perception = senses_obj.get("passive_perception", 10)
    
    # Languages
    languages = data.get("languages", "")
    
    # Vulnerabilities, resistances, immunities
    vulnerabilities = format_damage_arrays(data.get("damage_vulnerabilities", []))
    resistances = format_damage_arrays(data.get("damage_resistances", []))
    immunities = format_damage_arrays(data.get("damage_immunities", []))
    condition_immunities = format_condition_immunities(data.get("condition_immunities", []))
    
    # Build the record
    record = {
        "id": creature_id,
        "kind": "built-in",
        "name": name,
        "source": "SRD 5.1",
        "tags": [],
        "creatureType": creature_type,
        "size": size,
        "alignment": alignment,
        "challengeRating": cr,
        "experienceValue": xp,
        "armorClass": ac,
        "hitPoints": hp,
        "speed": speed,
        "abilities": abilities,
        "savingThrows": saving_throws,
        "skills": skills,
        "senses": senses,
        "languages": languages,
        "passivePerception": passive_perception,
        "vulnerabilities": vulnerabilities,
        "resistances": resistances,
        "immunities": immunities,
        "conditionImmunities": condition_immunities,
        "environments": [],
        "traits": [],
        "actions": [],
        "bonusActions": [],
        "reactions": [],
        "legendaryActions": [],
        "lairActions": [],
        "tacticsNotes": "",
        "privateNotes": "",
        "portraitUrl": "",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z",
        "archived": False,
    }
    
    return record

def main():
    print("Fetching monster list...")
    monster_list = fetch_json(MONSTERS_LIST_URL)
    
    if not monster_list:
        print("FATAL: Could not fetch monster list", file=sys.stderr)
        sys.exit(1)
    
    results = monster_list.get("results", [])
    total = len(results)
    print(f"Found {total} monsters to fetch.")
    
    creatures = []
    errors = []
    
    for i, monster_ref in enumerate(results):
        index = monster_ref.get("index", "unknown")
        name = monster_ref.get("name", "Unknown")
        url = monster_ref.get("url", "")
        
        if not url:
            print(f"  [{i+1}/{total}] SKIP {index}: no URL", file=sys.stderr)
            errors.append(index)
            continue
        
        full_url = BASE_URL + url
        print(f"  [{i+1}/{total}] Fetching {name} ({index})...", end=" ", flush=True)
        
        data = fetch_json(full_url)
        if data is None:
            print("FAILED")
            errors.append(index)
            continue
        
        record = convert_monster(data)
        if record:
            creatures.append(record)
            print("OK")
        else:
            print("CONVERT FAILED")
            errors.append(index)
        
        # Small delay to be polite to the API
        time.sleep(0.1)
    
    # Write output
    print(f"\nWriting {len(creatures)} creatures to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(creatures, f, indent=2, ensure_ascii=False)
    
    print(f"Done! {len(creatures)} creatures written.")
    if errors:
        print(f"Errors/Skips ({len(errors)}): {', '.join(errors)}", file=sys.stderr)
    
    print(f"\nCreature count: {len(creatures)}")

if __name__ == "__main__":
    main()
