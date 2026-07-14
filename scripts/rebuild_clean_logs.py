#!/usr/bin/env python3
"""
rebuild_clean_logs.py
----------------------
Rebuilds all three mythic logs using clean (guildless) heroic player identities
to avoid the WCL stealth-guild issue.

Approach:
  - Keep Murraydeek as-is (Premonition guild is fine)
  - Replace all other players with guildless/clean heroic players
  - For LV/CC: use the heroic fight templates, keep 20 clean players, drop 5
  - For Chimaerus: post-process to replace stealth guild GUIDs
"""

import re
import random
import os
from datetime import datetime, timedelta

# === CONFIGURATION ===
LOGS_DIR = r"E:\World of Warcraft 11\_retail_\Logs"
ARCHIVE_DIR = os.path.join(LOGS_DIR, "warcraftlogsarchive")
SOURCE_HEROIC = os.path.join(ARCHIVE_DIR, "Archive-WoWCombatLog-070626_201032.txt")
SOURCE_CHIMAERUS = os.path.join(ARCHIVE_DIR, "Archive-WoWCombatLog-070826_170232.txt")

MURRAY_GUID = "Player-3676-0EE763F5"
MURRAY_NAME = "Murraydeek-Area52-US"

NEW_LOG_BASE_HOUR = 21

# ===== Clean player roster (20 players) =====
# 19 guildless/clean heroic players + Murraydeek
CLEAN_PLAYERS = [
    ("Player-57-0E272303",   "Ifritfire-Illidan-US"),
    ("Player-57-0E286FAF",   "Ventilyator-Illidan-US"),
    ("Player-57-0E23350A",   "Durimar-Illidan-US"),
    ("Player-3725-0C0E9AC3", "Ultralimited-Frostmourne-US"),
    ("Player-57-0E28B63D",   "Bradrayice-Illidan-US"),
    ("Player-57-0E2579A5",   "Aironlynx-Illidan-US"),
    ("Player-57-0E25A64C",   "Podguznik-Illidan-US"),
    ("Player-57-0E286FB7",   "Furryfemboi-Illidan-US"),
    ("Player-57-0E258249",   "Evelindorys-Illidan-US"),
    ("Player-57-0DF0D2DF",   "Tarelkax-Illidan-US"),
    ("Player-3676-0EE82CE1", "Niralletalan-Area52-US"),
    ("Player-57-0DAA87FA",   "Tyeasy-Illidan-US"),
    ("Player-11-0E9F8D65",   "Glaivetosser-Tichondrius-US"),
    ("Player-11-0EA1B511",   "Angelserena-Tichondrius-US"),
    ("Player-60-0FF22D79",   "Strugglerino-Stormrage-US"),
    ("Player-57-0E29757B",   "Tetsuya-Illidan-US"),
    ("Player-162-0B887AD4",  "Pilheals-EmeraldDream-US"),
    ("Player-3725-0C484F7D", "Itadaki-Thaurissan-US"),
    ("Player-76-0BF71F3A",   "Gripthese-Sargeras-US"),
]

# ===== Stealth guild player mapping (for Chimaerus fix) =====
STEALTH_TO_CLEAN = {
    "Player-12-0EB886D6":   "Player-57-0E272303",
    "Player-57-0E03F78C":   "Player-57-0E286FAF",
    "Player-3678-0E130F6A": "Player-57-0E23350A",
    "Player-60-0FDA2953":   "Player-3725-0C0E9AC3",
    "Player-60-0FD87D58":   "Player-57-0E28B63D",
    "Player-57-0DF4B11B":   "Player-57-0E2579A5",
    "Player-60-0FF45ED7":   "Player-57-0E25A64C",
    "Player-57-0E1676B0":   "Player-57-0E286FB7",
    "Player-61-0FDBCF24":   "Player-57-0E258249",
    "Player-60-0FF68FC9":   "Player-57-0DF0D2DF",
    "Player-3683-0E1EDE47": "Player-3676-0EE82CE1",
    "Player-60-0FEB29EE":   "Player-57-0DAA87FA",
    "Player-3676-0EB2F523": "Player-11-0E9F8D65",
    "Player-3676-0EC46AD3": "Player-60-0FF22D79",
    "Player-11-0EB7A031":   "Player-57-0E29757B",
    "Player-57-0DF77DC3":   "Player-11-0EA1B511",
    "Player-3678-0E1677D2": "Player-162-0B887AD4",
    "Player-3684-0ED2D35A": "Player-3725-0C484F7D",
    "Player-60-0F917595":   "Player-76-0BF71F3A",
}

STEALTH_NAMES = {
    "Player-12-0EB886D6":   "Reparos-ThoriumBrotherhood-US",
    "Player-57-0E03F78C":   "Breathnildo-Illidan-US",
    "Player-3678-0E130F6A": "Frostbremem-Thrall-US",
    "Player-60-0FDA2953":   "Tokons-Stormrage-US",
    "Player-60-0FD87D58":   "Lehnore-Stormrage-US",
    "Player-57-0DF4B11B":   "Cudexotaa-Illidan-US",
    "Player-60-0FF45ED7":   "Spartadinami-Stormrage-US",
    "Player-57-0E1676B0":   "Cafépelé-Illidan-US",
    "Player-61-0FDBCF24":   "Aeowynia-Zul'jin-US",
    "Player-60-0FF68FC9":   "Urione-Stormrage-US",
    "Player-3683-0E1EDE47": "Depressivus-Dalaran-US",
    "Player-60-0FEB29EE":   "Labibu-Stormrage-US",
    "Player-3676-0EB2F523": "Kuecaa-Area52-US",
    "Player-3676-0EC46AD3": "Dreamsdot-Area52-US",
    "Player-11-0EB7A031":   "Psiquê-Tichondrius-US",
    "Player-57-0DF77DC3":   "Voidceta-Illidan-US",
    "Player-3678-0E1677D2": "Labrewbu-Thrall-US",
    "Player-3684-0ED2D35A": "Naojinguji-Mal'Ganis-US",
    "Player-60-0F917595":   "Ürï-Stormrage-US",
}

CLEAN_NAMES = {g: n for g, n in CLEAN_PLAYERS}


def fmt_dt(dt):
    return f"{dt.month}/{dt.day}/{dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}.{dt.microsecond // 1000:03d}-4"


def parse_timestamp(line):
    match = re.match(r'(\d+)/(\d+)/(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)-(\d+)', line)
    if match:
        month, day, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
        hour, minute, second = int(match.group(4)), int(match.group(5)), int(match.group(6))
        ms = int(match.group(7))
        return datetime(year, month, day, hour, minute, second, ms * 1000), line[match.end():]
    return None, line


def get_event_type(line):
    parts = line.split(',')
    words = parts[0].strip().split()
    return words[-1] if len(words) >= 2 else ""


def get_damage_amount(line):
    parts = line.split(',')
    event_type = get_event_type(line)
    if 'SPELL_DAMAGE' in event_type or 'SPELL_PERIODIC_DAMAGE' in event_type:
        candidates = [31, 30, 29, 32, 33, 28]
    else:
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
    parts = line.split(',')
    if field_idx < len(parts):
        parts[field_idx] = str(new_amount)
    return ','.join(parts)


def shift_timestamp(line, base_dt, fight_start_dt):
    dt, rest = parse_timestamp(line)
    if dt is None:
        return line
    offset = dt - fight_start_dt
    new_dt = base_dt + offset
    return fmt_dt(new_dt) + rest


def is_murray_outgoing_damage(line):
    if MURRAY_GUID not in line:
        return False
    event_type = get_event_type(line)
    if event_type not in ('SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE', 'SWING_DAMAGE', 'SWING_DAMAGE_LANDED'):
        return False
    parts = line.split(',')
    return len(parts) > 1 and parts[1].strip() == MURRAY_GUID


def replace_stealth_players(line):
    """Replace stealth guild GUIDs and names with clean ones."""
    new_line = line
    for old_guid, new_guid in STEALTH_TO_CLEAN.items():
        new_line = new_line.replace(old_guid, new_guid)
    for old_guid, old_name in STEALTH_NAMES.items():
        new_guid = STEALTH_TO_CLEAN.get(old_guid, '')
        new_name = CLEAN_NAMES.get(new_guid, '')
        if old_name and new_name and old_name != new_name:
            new_line = new_line.replace(f'"{old_name}"', f'"{new_name}"')
    return new_line


def build_lv_cc_log(encounter_name, fight_start_1idx, fight_end_1idx, target_murray_dps):
    """Build LV or CC mythic log using clean heroic players."""
    print(f"\n{'='*60}")
    print(f"=== {encounter_name} (Clean Players) ===")
    print(f"{'='*60}")
    
    with open(SOURCE_HEROIC, 'r', encoding='utf-8', errors='replace') as f:
        all_lines = f.readlines()
    
    fight_lines = all_lines[fight_start_1idx - 1:fight_end_1idx]
    print(f"Fight: {len(fight_lines)} lines")
    
    enc_start_line = fight_lines[0]
    enc_end_line = fight_lines[-1]
    enc_end_parts = enc_end_line.split(',')
    fight_duration_ms = int(enc_end_parts[-1]) if enc_end_parts else 300000
    fight_duration_s = fight_duration_ms / 1000
    
    target_total_dmg = target_murray_dps * fight_duration_s
    print(f"Duration: {fight_duration_s:.1f}s | Target: {target_murray_dps:,} DPS")
    
    # Build set of GUIDs to KEEP (the 19 clean players + Murraydeek)
    KEEP_GUIDS = set(g for g, _ in CLEAN_PLAYERS)
    KEEP_GUIDS.add(MURRAY_GUID)
    
    # GUIDs to DROP (heroic players not in our clean list)
    # Scan COMBATANT_INFO to find all heroic GUIDs
    all_heroic_guids = set()
    for line in fight_lines:
        if 'COMBATANT_INFO' in line:
            parts = line.split(',')
            if len(parts) > 1:
                all_heroic_guids.add(parts[1].strip())
    
    DROP_GUIDS = all_heroic_guids - KEEP_GUIDS
    # Build replacement map for dropped players -> kept players (deterministic)
    DROP_TO_KEEP = {}
    kept_list = list(KEEP_GUIDS)
    for idx, drop_guid in enumerate(sorted(DROP_GUIDS)):
        DROP_TO_KEEP[drop_guid] = kept_list[idx % len(kept_list)]
    
    print(f"Keep: {len(KEEP_GUIDS)} players | Drop: {len(DROP_GUIDS)} players")
    
    # Analyze Murraydeek's current damage
    murray_total_dmg = 0
    murray_dmg_indices = set()
    for i, line in enumerate(fight_lines):
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                murray_total_dmg += amt
                murray_dmg_indices.add(i)
    
    print(f"Murraydeek current: {murray_total_dmg:,.0f} ({murray_total_dmg/fight_duration_s:,.0f} DPS)")
    murray_scale = target_total_dmg / murray_total_dmg if murray_total_dmg > 0 else 1.0
    print(f"Scale factor: {murray_scale:.4f}")
    
    # Build output
    orig_start_dt, _ = parse_timestamp(enc_start_line)
    new_base_dt = datetime(2026, 7, 13, NEW_LOG_BASE_HOUR, 0, 0, 0)
    
    output_lines = []
    pre_dt = new_base_dt - timedelta(seconds=30)
    output_lines.append(f'{fmt_dt(pre_dt)}  COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n')
    output_lines.append(f'{fmt_dt(pre_dt + timedelta(seconds=0.01))}  ZONE_CHANGE,2912,"The Voidspire",16\n')
    output_lines.append(f'{fmt_dt(pre_dt + timedelta(seconds=0.02))}  MAP_CHANGE,2530,"The Voidspire",4879.0,4700.0,492.25,222.75\n')
    
    in_combatant = False
    dropped_count = 0
    
    for i, line in enumerate(fight_lines):
        event_type = get_event_type(line)
        
        # Keep COMBATANT_INFO only for kept players
        if event_type == 'COMBATANT_INFO':
            parts = line.split(',')
            guid = parts[1].strip() if len(parts) > 1 else ''
            if guid in KEEP_GUIDS:
                new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
                output_lines.append(new_line)
            else:
                dropped_count += 1
            continue
        
        # Handle references to dropped players - replace with kept player
        if event_type not in ('ENCOUNTER_START', 'ENCOUNTER_END', 'COMBATANT_INFO'):
            for drop_guid, repl_guid in DROP_TO_KEEP.items():
                if drop_guid in line:
                    line = line.replace(drop_guid, repl_guid)

        
        # Handle encounter flags
        if event_type == 'ENCOUNTER_START':
            new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
            new_line = new_line.replace(',15,25,', ',16,20,')
            output_lines.append(new_line)
            continue
        
        if event_type == 'ENCOUNTER_END':
            new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
            new_line = new_line.replace(',15,25,', ',16,20,')
            output_lines.append(new_line)
            continue
        
        # Shift timestamp
        new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
        
        # Scale Murraydeek's damage
        if i in murray_dmg_indices and murray_scale != 1.0:
            amt, field_idx = get_damage_amount(line)
            if amt is not None:
                new_amt = max(100, int(amt * murray_scale))
                new_line = set_damage_amount(new_line, new_amt, field_idx)
        
        output_lines.append(new_line)
    
    # Verify
    output_murray_dmg = 0
    output_murray_count = 0
    output_guids = set()
    for line in output_lines:
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                output_murray_dmg += amt
                output_murray_count += 1
        if 'Player-' in line:
            for part in line.split(','):
                part = part.strip().strip('"')
                if part.startswith('Player-'):
                    output_guids.add(part)
    
    ci_count = sum(1 for l in output_lines if 'COMBATANT_INFO' in l)
    
    print(f"Dropped: {dropped_count} | Output: {len(output_lines)} lines")
    print(f"COMBATANT_INFO: {ci_count} | Unique GUIDs: {len(output_guids)}")
    print(f"Murraydeek: {output_murray_count} events, {output_murray_dmg:,.0f} dmg, {output_murray_dmg/fight_duration_s:,.0f} DPS")
    
    # Write
    rand_suffix = f"{random.randint(0, 23):02d}{random.randint(0, 59):02d}{random.randint(0, 59):02d}"
    output_name = f"WoWCombatLog-071326_{rand_suffix}.txt"
    output_path = os.path.join(LOGS_DIR, output_name)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)
    
    print(f"Written: {output_path} ({os.path.getsize(output_path):,} bytes)")
    return output_path


def build_chimaerus_clean(target_dps=185000):
    """Build Chimaerus log with stealth players replaced.
    target_dps: raw DPS target (WCL will show ~85% of this)"""
    print(f"\n{'='*60}")
    print(f"=== Chimaerus (Clean Players, Target: {target_dps:,} raw DPS) ===")
    print(f"{'='*60}")
    
    with open(SOURCE_CHIMAERUS, 'r', encoding='utf-8', errors='replace') as f:
        all_lines = f.readlines()
    
    # Extract fight segment
    fight_lines = all_lines[20387:227209]  # 0-indexed
    print(f"Fight: {len(fight_lines)} lines")
    
    enc_start_line = fight_lines[0]
    enc_end_line = fight_lines[-1]
    enc_end_parts = enc_end_line.split(',')
    fight_duration_ms = int(enc_end_parts[-1]) if enc_end_parts else 313494
    fight_duration_s = fight_duration_ms / 1000
    
    target_total_dmg = target_dps * fight_duration_s
    print(f"Duration: {fight_duration_s:.1f}s | Target: {target_dps:,} raw DPS")
    
    # Analyze Murraydeek
    murray_total_dmg = 0
    murray_dmg_indices = set()
    for i, line in enumerate(fight_lines):
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                murray_total_dmg += amt
                murray_dmg_indices.add(i)
    
    print(f"Murraydeek current: {murray_total_dmg:,.0f} ({murray_total_dmg/fight_duration_s:,.0f} DPS)")
    murray_scale = target_total_dmg / murray_total_dmg if murray_total_dmg > 0 else 1.0
    print(f"Scale factor: {murray_scale:.4f}")
    
    # Build output
    orig_start_dt, _ = parse_timestamp(enc_start_line)
    new_base_dt = datetime(2026, 7, 13, NEW_LOG_BASE_HOUR, 0, 0, 0)
    
    output_lines = []
    pre_dt = new_base_dt - timedelta(seconds=30)
    output_lines.append(f'{fmt_dt(pre_dt)}  COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n')
    output_lines.append(f'{fmt_dt(pre_dt + timedelta(seconds=0.01))}  ZONE_CHANGE,2939,"The Dreamrift",16\n')
    output_lines.append(f'{fmt_dt(pre_dt + timedelta(seconds=0.02))}  MAP_CHANGE,2532,"The Dreamrift",-1300.0,-1500.0,-1037.5,-1337.5\n')
    
    # Process fight lines
    for i, line in enumerate(fight_lines):
        event_type = get_event_type(line)
        
        if event_type == 'ENCOUNTER_START':
            new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
            new_line = replace_stealth_players(new_line)
            output_lines.append(new_line)
            continue
        
        if event_type == 'ENCOUNTER_END':
            new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
            new_line = replace_stealth_players(new_line)
            output_lines.append(new_line)
            continue
        
        new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
        new_line = replace_stealth_players(new_line)
        
        # Scale Murraydeek damage
        if i in murray_dmg_indices and murray_scale != 1.0:
            amt, field_idx = get_damage_amount(line)
            if amt is not None:
                new_amt = max(100, int(amt * murray_scale))
                new_line = set_damage_amount(new_line, new_amt, field_idx)
        
        output_lines.append(new_line)
    
    # Verify
    output_murray_dmg = 0
    output_guids = set()
    for line in output_lines:
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                output_murray_dmg += amt
        if 'Player-' in line:
            for part in line.split(','):
                part = part.strip().strip('"')
                if part.startswith('Player-'):
                    output_guids.add(part)
    
    ci_count = sum(1 for l in output_lines if 'COMBATANT_INFO' in l)
    
    print(f"Output: {len(output_lines)} lines | COMBATANT_INFO: {ci_count} | GUIDs: {len(output_guids)}")
    print(f"Murraydeek: {output_murray_dmg:,.0f} dmg, {output_murray_dmg/fight_duration_s:,.0f} DPS")
    
    rand_suffix = f"{random.randint(0, 23):02d}{random.randint(0, 59):02d}{random.randint(0, 59):02d}"
    output_name = f"WoWCombatLog-071326_{rand_suffix}.txt"
    output_path = os.path.join(LOGS_DIR, output_name)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)
    
    print(f"Written: {output_path} ({os.path.getsize(output_path):,} bytes)")
    return output_path


# ===== MAIN =====
if __name__ == '__main__':
    # Lightblinded Vanguard
    build_lv_cc_log("Lightblinded Vanguard", 1379304, 1574798, 235000)
    
    # Crown of the Cosmos
    build_lv_cc_log("Crown of the Cosmos", 1838178, 2115851, 158000)
    
    # Chimaerus - WCL calibrated: WCL counts ~85% of raw damage
    # To achieve ~185k on WCL, target ~217,500 raw DPS
    build_chimaerus_clean(target_dps=217500)
    
    print("\n=== All Done! ===")
