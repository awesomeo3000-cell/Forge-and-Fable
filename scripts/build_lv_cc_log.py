#!/usr/bin/env python3
"""
build_lv_cc_log.py
-------------------
Creates mythic Lightblinded Vanguard and Crown of the Cosmos combat logs
by converting heroic fight templates with the 20-player mythic roster.

Approach:
  1. Take heroic fight segment from 201032.txt
  2. Map 25 heroic players -> 20 mythic players (Murraydeek stays same GUID)
  3. Replace GUIDs/names, drop 5 excess players
  4. Use mythic COMBATANT_INFO from Chimaerus log
  5. Scale Murraydeek damage to target DPS
  6. Change difficulty flags (15,25 -> 16,20)
  7. Shift timestamps to 7/13/2026
"""

import re
import random
import os
from datetime import datetime, timedelta

# === CONFIGURATION ===
SOURCE_LOG = r"E:\World of Warcraft 11\_retail_\Logs\WoWCombatLog-070626_201032.txt"
CHIMAERUS_LOG = r"E:\World of Warcraft 11\_retail_\Logs\WoWCombatLog-070826_170232.txt"
OUTPUT_DIR = r"E:\World of Warcraft 11\_retail_\Logs"

MURRAY_GUID = "Player-3676-0EE763F5"
MURRAY_NAME = "Murraydeek-Area52-US"

NEW_LOG_BASE_HOUR = 21

# ===== Mythic Player Roster (from Chimaerus) =====
# 19 players from Chimaerus fight + Ürï as 20th
MYTHIC_PLAYERS = [
    ("Player-12-0EB886D6",   "Reparos-ThoriumBrotherhood-US"),
    ("Player-57-0E03F78C",   "Breathnildo-Illidan-US"),
    ("Player-3678-0E130F6A", "Frostbremem-Thrall-US"),
    ("Player-60-0FDA2953",   "Tokons-Stormrage-US"),
    ("Player-60-0FD87D58",   "Lehnore-Stormrage-US"),
    ("Player-57-0DF4B11B",   "Cudexotaa-Illidan-US"),
    ("Player-60-0FF45ED7",   "Spartadinami-Stormrage-US"),
    ("Player-57-0E1676B0",   "Cafépelé-Illidan-US"),
    ("Player-61-0FDBCF24",   "Aeowynia-Zul'jin-US"),
    ("Player-60-0FF68FC9",   "Urione-Stormrage-US"),
    ("Player-3683-0E1EDE47", "Depressivus-Dalaran-US"),
    ("Player-60-0FEB29EE",   "Labibu-Stormrage-US"),
    ("Player-3676-0EB2F523", "Kuecaa-Area52-US"),
    ("Player-3676-0EC46AD3", "Dreamsdot-Area52-US"),
    ("Player-11-0EB7A031",   "Psiquê-Tichondrius-US"),
    ("Player-57-0DF77DC3",   "Voidceta-Illidan-US"),
    # Murraydeek is separate (same GUID in both logs)
    ("Player-3678-0E1677D2", "Labrewbu-Thrall-US"),
    ("Player-3684-0ED2D35A", "Naojinguji-Mal'Ganis-US"),
    ("Player-60-0F917595",   "Ürï-Stormrage-US"),
]

# ===== Heroic Player GUIDs (25 players from LV/CC heroic fights) =====
# These are the 25 players in the heroic LV/CC fights (from COMBATANT_INFO order)
HEROIC_PLAYERS = [
    "Player-57-0E272303",
    "Player-57-0E286FAF",
    "Player-57-0E23350A",
    "Player-3725-0C0E9AC3",
    "Player-57-0E28B63D",
    "Player-57-0E2579A5",
    "Player-57-0E25823B",
    "Player-57-0E25A64C",
    "Player-57-0E286FB7",
    "Player-11-0EA1B511",
    "Player-57-0E258249",
    "Player-57-0DF0D2DF",
    "Player-162-0B887AD4",
    "Player-3725-0C484F7D",
    "Player-3676-0EE82CE1",
    "Player-57-0DAA87FA",
    "Player-57-0E286686",
    "Player-3676-0E442C20",
    "Player-11-0E9F8D65",
    "Player-76-0BF71F3A",
    "Player-3676-0EB0A8E6",
    "Player-57-0E2887CB",
    "Player-60-0FF22D79",
    # Player-3676-0EE763F5 = Murraydeek (same in both, handled separately)
    "Player-57-0E29757B",
]

# Murraydeek is at heroic index 23 (0-based), which is the 24th heroic player
# He maps to himself since same GUID

# Build the guid mapping: heroic GUID -> mythic GUID (19 players, excludes Murraydeek)
GUID_MAP = {}
for i in range(19):
    GUID_MAP[HEROIC_PLAYERS[i]] = MYTHIC_PLAYERS[i][0]

# Map the 5 dropped players to existing mythic players (round-robin)
# This ensures ALL 25 heroic players map to the 20 mythic players
for i, drop_guid in enumerate(HEROIC_PLAYERS[19:]):
    target_mythic_idx = i % 19
    GUID_MAP[drop_guid] = MYTHIC_PLAYERS[target_mythic_idx][0]

# The dropped players - we still drop lines where they're the primary source
DROP_GUIDS = set(HEROIC_PLAYERS[19:])

# Mythic GUID -> name map for name replacement
MYTHIC_NAME_MAP = {g: n for g, n in MYTHIC_PLAYERS}
# Add Murraydeek
MYTHIC_NAME_MAP[MURRAY_GUID] = MURRAY_NAME

# Build a reverse map: heroic GUID -> heroic name (for name replacement)
# We need to know which heroic name corresponds to which heroic GUID
# Parse the COMBATANT_INFO lines to get name mapping
HEROIC_NAME_MAP = {}


def fmt_dt(dt):
    """Format datetime for WoW combat log."""
    return f"{dt.month}/{dt.day}/{dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}.{dt.microsecond // 1000:03d}-4"


def parse_timestamp(line):
    """Extract datetime from a combat log line."""
    match = re.match(r'(\d+)/(\d+)/(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)-(\d+)', line)
    if match:
        month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        hour, minute, second = int(match.group(4)), int(match.group(5)), int(match.group(6))
        ms = int(match.group(7))
        dt = datetime(year, month, day, hour, minute, second, ms * 1000)
        return dt, line[match.end():]
    return None, line


def get_event_type(line):
    """Extract event type from a combat log line."""
    parts = line.split(',')
    first = parts[0]
    words = first.strip().split()
    if len(words) >= 2:
        return words[-1]
    return ""


def get_damage_amount(line):
    """Extract damage amount from a combat log line."""
    parts = line.split(',')
    event_type = get_event_type(line)
    
    if 'SPELL_DAMAGE' in event_type or 'SPELL_PERIODIC_DAMAGE' in event_type:
        candidates = [31, 30, 29, 32, 33, 28]
        for idx in candidates:
            if idx < len(parts):
                try:
                    val = int(parts[idx])
                    if 20 < val < 5000000:
                        return val, idx
                except (ValueError, TypeError):
                    continue
    elif 'SWING_DAMAGE_LANDED' in event_type or 'SWING_DAMAGE' in event_type:
        candidates = [30, 29, 31, 28, 32]
        for idx in candidates:
            if idx < len(parts):
                try:
                    val = int(parts[idx])
                    if 20 < val < 5000000:
                        return val, idx
                except (ValueError, TypeError):
                    continue
    return None, -1


def set_damage_amount(line, new_amount, field_idx):
    """Replace the damage amount at the given field index."""
    parts = line.split(',')
    if field_idx < len(parts):
        parts[field_idx] = str(new_amount)
    return ','.join(parts)


def shift_timestamp(line, base_dt, fight_start_dt):
    """Shift a log line's timestamp from original to target date."""
    dt, rest = parse_timestamp(line)
    if dt is None:
        return line
    offset = dt - fight_start_dt
    new_dt = base_dt + offset
    return fmt_dt(new_dt) + rest


def replace_player_refs(line):
    """
    Replace heroic player GUIDs and names with mythic equivalents.
    Also checks if line contains a dropped player GUID.
    Returns (new_line, should_drop) where should_drop=True means skip this line.
    """
    # Check for dropped player GUIDs first
    for drop_guid in DROP_GUIDS:
        if drop_guid in line:
            parts = line.split(',')
            if len(parts) > 1:
                if parts[1].strip() == drop_guid:
                    return line, True  # Drop lines where dropped player is primary source
    
    # Replace GUIDs
    new_line = line
    for old_guid, new_guid in GUID_MAP.items():
        new_line = new_line.replace(old_guid, new_guid)
    
    # Replace names: find quoted heroic names and replace with mythic names
    for old_guid, new_guid in GUID_MAP.items():
        if old_guid in HEROIC_NAME_MAP:
            old_name = HEROIC_NAME_MAP[old_guid]
            new_name = MYTHIC_NAME_MAP.get(new_guid, '')
            if old_name and new_name and old_name != new_name:
                # Replace quoted name occurrences
                new_line = new_line.replace(f'"{old_name}"', f'"{new_name}"')
    
    return new_line, False


def load_heroic_name_map():
    """Parse heroic COMBATANT_INFO lines to build GUID -> name mapping."""
    with open(SOURCE_LOG, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    name_map = {}
    # Find COMBATANT_INFO lines in the LV fight area
    for i in range(1379304, min(1379330, len(lines))):
        line = lines[i]
        if 'COMBATANT_INFO' in line:
            parts = line.split(',')
            if len(parts) > 2:
                guid = parts[1].strip()
                name = parts[2].strip().strip('"')
                name_map[guid] = name
    
    return name_map


def is_murray_outgoing_damage(line):
    """Check if this line is Murraydeek dealing damage."""
    if MURRAY_GUID not in line:
        return False
    event_type = get_event_type(line)
    if event_type not in ('SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE',
                           'SWING_DAMAGE', 'SWING_DAMAGE_LANDED'):
        return False
    parts = line.split(',')
    if len(parts) > 1 and parts[1].strip() == MURRAY_GUID:
        return True
    return False


def load_chimaerus_combatant_info():
    """Load COMBATANT_INFO lines for the 19+1 mythic players from Chimaerus log."""
    with open(CHIMAERUS_LOG, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    # Lines 20389-20407 are COMBATANT_INFO (19 players) in the Chimaerus fight
    combatant_lines = {}
    for i in range(20389 - 1, 20407):  # 0-indexed
        line = lines[i]
        parts = line.split(',')
        if len(parts) > 1:
            guid = parts[1].strip()
            combatant_lines[guid] = line
    
    return combatant_lines


def build_log(encounter_name, fight_start_1idx, fight_end_1idx, target_murray_dps):
    """
    Build a mythic log for the given encounter.
    fight_start_1idx, fight_end_1idx are 1-indexed line numbers.
    """
    print(f"\n{'='*60}")
    print(f"=== Building {encounter_name} Mythic Log ===")
    print(f"{'='*60}\n")
    
    with open(SOURCE_LOG, 'r', encoding='utf-8', errors='replace') as f:
        all_lines = f.readlines()
    
    fight_lines = all_lines[fight_start_1idx - 1:fight_end_1idx]
    print(f"Fight segment: {len(fight_lines)} lines")
    
    enc_start_line = fight_lines[0]
    enc_end_line = fight_lines[-1]
    
    # Parse duration
    enc_end_parts = enc_end_line.split(',')
    fight_duration_ms = int(enc_end_parts[-1]) if enc_end_parts else 300000
    fight_duration_s = fight_duration_ms / 1000
    print(f"Fight duration: {fight_duration_s:.1f}s")
    
    target_total_dmg = target_murray_dps * fight_duration_s
    print(f"Target Murraydeek: {target_total_dmg:,.0f} damage ({target_murray_dps:,} DPS)")
    
    # === Analyze current Murraydeek damage ===
    murray_total_dmg = 0
    murray_dmg_indices = set()
    
    for i, line in enumerate(fight_lines):
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                murray_total_dmg += amt
                murray_dmg_indices.add(i)
    
    print(f"Murraydeek current: {murray_total_dmg:,.0f} damage ({murray_total_dmg/fight_duration_s:,.0f} DPS)")
    
    if murray_total_dmg > 0:
        murray_scale = target_total_dmg / murray_total_dmg
    else:
        murray_scale = 1.0
    print(f"Murraydeek scale factor: {murray_scale:.4f}")
    
    # === Load mythic COMBATANT_INFO ===
    mythic_combatants = load_chimaerus_combatant_info()
    # Add Ürï's COMBATANT_INFO (use Murraydeek's as template, with GUID/name replaced)
    if MURRAY_GUID in mythic_combatants:
        uri_guid = "Player-60-0F917595"
        uri_name = "Ürï-Stormrage-US"
        uri_line = mythic_combatants[MURRAY_GUID].replace(MURRAY_GUID, uri_guid)
        uri_line = uri_line.replace(f'"{MURRAY_NAME}"', f'"{uri_name}"')
        mythic_combatants[uri_guid] = uri_line
    print(f"Loaded {len(mythic_combatants)} mythic COMBATANT_INFO lines")
    
    # === Build output ===
    orig_start_dt, _ = parse_timestamp(enc_start_line)
    new_base_dt = datetime(2026, 7, 13, NEW_LOG_BASE_HOUR, 0, 0, 0)
    
    # Load heroic name map for name replacement
    global HEROIC_NAME_MAP
    HEROIC_NAME_MAP = load_heroic_name_map()
    
    output_lines = []
    
    # Header
    pre_dt = new_base_dt - timedelta(seconds=30)
    output_lines.append(
        f'{fmt_dt(pre_dt)}  '
        f'COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n'
    )
    output_lines.append(
        f'{fmt_dt(pre_dt + timedelta(seconds=0.01))}  '
        f'ZONE_CHANGE,2912,"The Voidspire",16\n'
    )
    output_lines.append(
        f'{fmt_dt(pre_dt + timedelta(seconds=0.02))}  '
        f'MAP_CHANGE,2530,"The Voidspire",4879.0,4700.0,492.25,222.75\n'
    )
    
    # Process each line
    in_combatant_info = False
    combatant_count = 0
    dropped_count = 0
    
    for i, line in enumerate(fight_lines):
        event_type = get_event_type(line)
        
        # Handle COMBATANT_INFO block - replace with mythic versions
        if event_type == 'COMBATANT_INFO':
            if not in_combatant_info:
                in_combatant_info = True
                combatant_count = 0
                # Use a fixed timestamp just before encounter start
                ci_dt = new_base_dt - timedelta(milliseconds=100)
                # Add mythic COMBATANT_INFO lines
                for mythic_guid in [g for g, _ in MYTHIC_PLAYERS]:
                    if mythic_guid in mythic_combatants:
                        ci_line = mythic_combatants[mythic_guid]
                        # Set timestamp to just before fight
                        ts_end = ci_line.find('  ')
                        if ts_end > 0:
                            ci_line = fmt_dt(ci_dt) + ci_line[ts_end:]
                        output_lines.append(ci_line)
                        combatant_count += 1
                        ci_dt += timedelta(milliseconds=1)
                # Add Murraydeek's COMBATANT_INFO
                if MURRAY_GUID in mythic_combatants:
                    ci_line = mythic_combatants[MURRAY_GUID]
                    ts_end = ci_line.find('  ')
                    if ts_end > 0:
                        ci_line = fmt_dt(ci_dt) + ci_line[ts_end:]
                    output_lines.append(ci_line)
                    combatant_count += 1
            continue  # Skip original COMBATANT_INFO lines
        
        if event_type != 'COMBATANT_INFO':
            in_combatant_info = False
        
        # Handle ENCOUNTER_START/END - change difficulty
        if event_type == 'ENCOUNTER_START':
            new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
            # Change ,15,25, to ,16,20,
            new_line = new_line.replace(',15,25,', ',16,20,')
            output_lines.append(new_line)
            continue
        
        if event_type == 'ENCOUNTER_END':
            new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
            new_line = new_line.replace(',15,25,', ',16,20,')
            output_lines.append(new_line)
            continue
        
        # Replace GUIDs and names
        new_line, should_drop = replace_player_refs(line)
        
        if should_drop:
            dropped_count += 1
            continue
        
        # Shift timestamp
        new_line = shift_timestamp(new_line, new_base_dt, orig_start_dt)
        
        # Scale Murraydeek damage
        if i in murray_dmg_indices and murray_scale != 1.0:
            amt, field_idx = get_damage_amount(line)
            if amt is not None:
                new_amt = max(100, int(amt * murray_scale))
                new_line = set_damage_amount(new_line, new_amt, field_idx)
        
        output_lines.append(new_line)
    
    # === Verify ===
    output_murray_dmg = 0
    output_murray_count = 0
    for line in output_lines:
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                output_murray_dmg += amt
                output_murray_count += 1
    
    print(f"\nDropped {dropped_count} lines from dropped players")
    print(f"Output lines: {len(output_lines)}")
    print(f"COMBATANT_INFO added: {combatant_count}")
    print(f"Murraydeek events: {output_murray_count}")
    print(f"Murraydeek total: {output_murray_dmg:,.0f}")
    print(f"Murraydeek DPS: {output_murray_dmg / fight_duration_s:,.0f}")
    
    # === Write ===
    rand_suffix = f"{random.randint(0, 23):02d}{random.randint(0, 59):02d}{random.randint(0, 59):02d}"
    output_filename = f"WoWCombatLog-071326_{rand_suffix}.txt"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    
    print(f"\nWriting: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)
    
    print(f"File size: {os.path.getsize(output_path):,} bytes")
    print(f"=== {encounter_name} Done! ===\n")
    
    return output_path


# ===== MAIN =====
if __name__ == '__main__':
    # Lightblinded Vanguard
    build_log(
        encounter_name="Lightblinded Vanguard",
        fight_start_1idx=1379304,   # Heroic LV kill ENCOUNTER_START line
        fight_end_1idx=1574798,     # Heroic LV kill ENCOUNTER_END line
        target_murray_dps=235000,   # 95th percentile UH DK mythic
    )
    
    # Crown of the Cosmos
    build_log(
        encounter_name="Crown of the Cosmos",
        fight_start_1idx=1838178,   # Heroic CC kill ENCOUNTER_START line
        fight_end_1idx=2115851,     # Heroic CC kill ENCOUNTER_END line
        target_murray_dps=158000,   # 95th percentile UH DK mythic
    )
