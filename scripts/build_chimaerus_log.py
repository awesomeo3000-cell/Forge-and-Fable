#!/usr/bin/env python3
"""
build_chimaerus_log.py
-----------------------
Takes the existing mythic Chimaerus kill from WoWCombatLog-070826_170232.txt
and produces a new log with:
  - Murraydeek surviving the full fight at 95th percentile DPS (~185k)
  - Timestamps shifted to 7/13/2026

Source fight: lines 20388-227209 (313.5s mythic kill)
"""

import re
import random
import os
from datetime import datetime, timedelta

# === CONFIGURATION ===
SOURCE_LOG = r"E:\World of Warcraft 11\_retail_\Logs\WoWCombatLog-070826_170232.txt"
OUTPUT_DIR = r"E:\World of Warcraft 11\_retail_\Logs"

FIGHT_START_LINE = 20388
FIGHT_END_LINE = 227209

TARGET_MURRAY_DPS = 185000
MURRAY_GUID = "Player-3676-0EE763F5"
MURRAY_NAME = "Murraydeek-Area52-US"

NEW_LOG_BASE_HOUR = 21


def fmt_dt(dt):
    """Format datetime for WoW combat log (Windows-compatible)."""
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
    """Extract event type from a combat log line (e.g., SPELL_DAMAGE, SWING_DAMAGE)."""
    parts = line.split(',')
    # parts[0] contains "timestamp  EVENT_TYPE"
    first = parts[0]
    # Event type is the last word in parts[0]
    words = first.strip().split()
    if len(words) >= 2:
        return words[-1]
    return ""


def get_damage_amount(line):
    """
    Extract damage amount from a combat log damage line.
    Returns (amount, field_index) or (None, -1).
    
    WoW v22 SPELL_DAMAGE field mapping (0-indexed after split-by-comma):
      0: "timestamp  SPELL_DAMAGE"
      1: sourceGUID
      2: sourceName
      ...
      31: damageAmount (for SPELL_DAMAGE, SPELL_PERIODIC_DAMAGE)
      30: damageAmount (for SWING_DAMAGE, SWING_DAMAGE_LANDED)
    """
    parts = line.split(',')
    event_type = get_event_type(line)
    
    if 'SPELL_DAMAGE' in event_type or 'SPELL_PERIODIC_DAMAGE' in event_type:
        # Damage amount at index 31 for v22 advanced combat log
        candidates = [31, 30, 29, 32, 33, 28]
        for idx in candidates:
            if idx < len(parts):
                try:
                    val = int(parts[idx])
                    if 20 < val < 5000000:
                        return val, idx
                except (ValueError, TypeError):
                    continue
    
    elif 'SWING_DAMAGE_LANDED' in event_type:
        candidates = [30, 29, 31, 28, 32]
        for idx in candidates:
            if idx < len(parts):
                try:
                    val = int(parts[idx])
                    if 20 < val < 5000000:
                        return val, idx
                except (ValueError, TypeError):
                    continue
    
    elif 'SWING_DAMAGE' in event_type:
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


def is_murray_outgoing_damage(line):
    """Check if this line is Murraydeek dealing damage (not receiving)."""
    if MURRAY_GUID not in line:
        return False
    
    event_type = get_event_type(line)
    if event_type not in ('SPELL_DAMAGE', 'SPELL_PERIODIC_DAMAGE', 
                           'SWING_DAMAGE', 'SWING_DAMAGE_LANDED'):
        return False
    
    parts = line.split(',')
    # Source GUID is parts[1]
    if len(parts) > 1 and parts[1].strip() == MURRAY_GUID:
        return True
    
    return False


def is_murray_death(line):
    """Check if this line is Murraydeek's UNIT_DIED event."""
    event_type = get_event_type(line)
    if event_type != 'UNIT_DIED':
        return False
    parts = line.split(',')
    # Dest GUID is parts[6] for UNIT_DIED
    if len(parts) > 6 and MURRAY_GUID in parts[6]:
        return True
    return False


def build_chimaerus_log():
    print("=== Building Chimaerus Mythic Log ===\n")
    
    with open(SOURCE_LOG, 'r', encoding='utf-8', errors='replace') as f:
        all_lines = f.readlines()
    print(f"Source: {len(all_lines)} lines")
    
    fight_lines = all_lines[FIGHT_START_LINE - 1:FIGHT_END_LINE]
    print(f"Fight segment: {len(fight_lines)} lines")
    
    enc_start_line = fight_lines[0]
    enc_end_line = fight_lines[-1]
    
    # Parse fight duration from ENCOUNTER_END
    enc_end_parts = enc_end_line.split(',')
    fight_duration_ms = int(enc_end_parts[-1]) if enc_end_parts else 313494
    fight_duration_s = fight_duration_ms / 1000
    print(f"Fight duration: {fight_duration_s:.1f}s")
    
    target_total_dmg = TARGET_MURRAY_DPS * fight_duration_s
    print(f"Target Murraydeek: {target_total_dmg:,.0f} damage ({TARGET_MURRAY_DPS:,} DPS)")
    
    # === ANALYZE CURRENT STATE ===
    murray_outgoing = []  # (line_index, damage_amount)
    murray_death_idx = None
    
    for i, line in enumerate(fight_lines):
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                murray_outgoing.append((i, amt))
        if is_murray_death(line):
            murray_death_idx = i
    
    murray_total_dmg = sum(amt for _, amt in murray_outgoing)
    print(f"Murraydeek outgoing damage events: {len(murray_outgoing)}")
    print(f"Murraydeek current total damage: {murray_total_dmg:,.0f}")
    print(f"Murraydeek current DPS: {murray_total_dmg / fight_duration_s:,.0f}")
    print(f"Murraydeek death at line index: {murray_death_idx}")
    
    # Calculate when Murraydeek died
    if murray_death_idx is not None:
        death_line = fight_lines[murray_death_idx]
        death_dt, _ = parse_timestamp(death_line)
        orig_start_dt, _ = parse_timestamp(enc_start_line)
        alive_s = (death_dt - orig_start_dt).total_seconds()
        dead_s = fight_duration_s - alive_s
        print(f"Alive: {alive_s:.0f}s, Dead: {dead_s:.0f}s")
    else:
        alive_s = fight_duration_s
        dead_s = 0
    
    # Scale factor
    if murray_total_dmg > 0:
        murray_scale = target_total_dmg / murray_total_dmg
    else:
        murray_scale = 1.0
    print(f"Damage scale factor: {murray_scale:.4f}")
    
    # === BUILD OUTPUT ===
    orig_start_dt, _ = parse_timestamp(enc_start_line)
    new_base_dt = datetime(2026, 7, 13, NEW_LOG_BASE_HOUR, 0, 0, 0)
    print(f"New base time: {fmt_dt(new_base_dt)}")
    
    output_lines = []
    
    # Header
    pre_dt = new_base_dt - timedelta(seconds=30)
    output_lines.append(
        f'{fmt_dt(pre_dt)}  '
        f'COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n'
    )
    output_lines.append(
        f'{fmt_dt(pre_dt + timedelta(seconds=0.01))}  '
        f'ZONE_CHANGE,2939,"The Dreamrift",16\n'
    )
    output_lines.append(
        f'{fmt_dt(pre_dt + timedelta(seconds=0.02))}  '
        f'MAP_CHANGE,2532,"The Dreamrift",-1300.0,-1500.0,-1037.5,-1337.5\n'
    )
    
    # Process fight lines
    murray_set = set(idx for idx, _ in murray_outgoing)
    
    for i, line in enumerate(fight_lines):
        # Skip Murraydeek's death
        if i == murray_death_idx:
            continue
        
        new_line = shift_timestamp(line, new_base_dt, orig_start_dt)
        
        # Scale Murraydeek's outgoing damage
        if i in murray_set and murray_scale != 1.0:
            amt, field_idx = get_damage_amount(line)
            if amt is not None:
                new_amt = max(100, int(amt * murray_scale))
                new_line = set_damage_amount(new_line, new_amt, field_idx)
        
        output_lines.append(new_line)
    
    # === HANDLE POST-DEATH DAMAGE ===
    if murray_death_idx is not None and len(murray_outgoing) > 0 and dead_s > 2:
        print(f"\nMurraydeek died with {dead_s:.0f}s remaining. Adding continuing damage...")
        
        # Calculate how much more damage needed
        current_scaled = murray_total_dmg * murray_scale
        remaining_needed = target_total_dmg - current_scaled
        
        if remaining_needed > 0:
            # Use Murraydeek's damage pattern from his alive period
            # Extract the damage events in order with their timestamps
            death_dt, _ = parse_timestamp(fight_lines[murray_death_idx])
            
            # Build template from alive period
            template_events = []
            for idx, amt in murray_outgoing:
                line = fight_lines[idx]
                evt_dt, _ = parse_timestamp(line)
                rel_time = (evt_dt - orig_start_dt).total_seconds()
                template_events.append((rel_time, amt, line))
            
            if template_events:
                # Calculate the damage rate per second during alive period
                dmg_rate = murray_total_dmg / alive_s if alive_s > 0 else 0
                
                # We need to add enough events to cover remaining_needed
                # while maintaining realistic event density
                event_density = len(template_events) / alive_s if alive_s > 0 else 0
                num_new_events = int(event_density * dead_s * 0.9)  # Slightly less dense post-"death"
                
                if num_new_events > 0:
                    # Average damage per new event (target)
                    avg_dmg_per_event = remaining_needed / num_new_events
                    
                    # Average damage per template event
                    template_avg_dmg = sum(a for _, a, _ in template_events) / len(template_events)
                    new_event_scale = avg_dmg_per_event / template_avg_dmg if template_avg_dmg > 0 else 1.0
                    
                    print(f"  Adding {num_new_events} damage events (scale={new_event_scale:.2f})")
                    
                    for j in range(num_new_events):
                        template_idx = j % len(template_events)
                        rel_time, _, template_line = template_events[template_idx]
                        
                        # Calculate timestamp: spread events across dead period
                        post_death_offset = alive_s + 0.5 + (j / num_new_events) * (dead_s - 1.0)
                        new_evt_dt = new_base_dt + timedelta(seconds=post_death_offset)
                        
                        # Create new line with updated timestamp
                        new_line = shift_timestamp(template_line, new_base_dt, orig_start_dt)
                        
                        # Override timestamp
                        ts_end = new_line.find('  ')
                        if ts_end > 0:
                            new_line = fmt_dt(new_evt_dt) + new_line[ts_end:]
                        
                        # Scale damage
                        amt, field_idx = get_damage_amount(template_line)
                        if amt is not None:
                            new_amt = max(50, int(amt * new_event_scale))
                            new_line = set_damage_amount(new_line, new_amt, field_idx)
                        
                        output_lines.append(new_line)
    
    # === VERIFY AND OUTPUT ===
    rand_suffix = f"{random.randint(0, 23):02d}{random.randint(0, 59):02d}{random.randint(0, 59):02d}"
    output_filename = f"WoWCombatLog-071326_{rand_suffix}.txt"
    output_path = os.path.join(OUTPUT_DIR, output_filename)
    
    # Count Murraydeek's total in output
    output_murray_dmg = 0
    output_murray_count = 0
    for line in output_lines:
        if is_murray_outgoing_damage(line):
            amt, _ = get_damage_amount(line)
            if amt is not None:
                output_murray_dmg += amt
                output_murray_count += 1
    
    print(f"\n=== Output Stats ===")
    print(f"Output lines: {len(output_lines)}")
    print(f"Murraydeek damage events: {output_murray_count}")
    print(f"Murraydeek total damage: {output_murray_dmg:,.0f}")
    print(f"Murraydeek DPS: {output_murray_dmg / fight_duration_s:,.0f}")
    print(f"Target DPS: {TARGET_MURRAY_DPS:,}")
    
    print(f"\nWriting: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)
    
    print(f"File size: {os.path.getsize(output_path):,} bytes")
    print("\n=== Done! ===")
    return output_path


if __name__ == '__main__':
    build_chimaerus_log()
