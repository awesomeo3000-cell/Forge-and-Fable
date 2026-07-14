#!/usr/bin/env python3
"""
rebuild_balanced.py
--------------------
Rebuilds LV and CC logs with realistic raid DPS distribution:
  - Murraydeek at Frost DK 95th percentile
  - Other DPS capped at reasonable levels (no 100 parses)
  - Healers/tanks left low  
  - Void Droplet damage redirected (CC only)
  - Clean (guildless) player identities
"""

import re, random, os
from datetime import datetime, timedelta
from collections import defaultdict

LOGS_DIR = r"E:\World of Warcraft 11\_retail_\Logs"
ARCHIVE_DIR = os.path.join(LOGS_DIR, "warcraftlogsarchive")
SOURCE_HEROIC = os.path.join(ARCHIVE_DIR, "Archive-WoWCombatLog-070626_201032.txt")

MURRAY_GUID = "Player-3676-0EE763F5"
MURRAY_NAME = "Murraydeek-Area52-US"

# 20 clean players
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

CLEAN_SET = set(g for g, _ in CLEAN_PLAYERS)
CLEAN_SET.add(MURRAY_GUID)

STRAY_MAP = {
    'Player-3676-0EB0A8E6': 'Player-57-0E272303',
    'Player-57-0E286686': 'Player-57-0E286FAF',
    'Player-57-0E2887CB': 'Player-57-0E23350A',
}


def fmt_dt(dt):
    return f"{dt.month}/{dt.day}/{dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}.{dt.microsecond // 1000:03d}-4"


def parse_ts(line):
    m = re.match(r'(\d+)/(\d+)/(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)-(\d+)', line)
    if m:
        return datetime(int(m.group(3)), int(m.group(1)), int(m.group(2)),
                       int(m.group(4)), int(m.group(5)), int(m.group(6)), int(m.group(7))*1000), line[m.end():]
    return None, line


def get_evt(line):
    w = line.split(',')[0].strip().split()
    return w[-1] if len(w) >= 2 else ""


def get_dmg(line):
    parts = line.split(',')
    evt = get_evt(line)
    candidates = [31,30,29,32,33,28] if 'SPELL' in evt else [30,29,31,28,32]
    for idx in candidates:
        if idx < len(parts):
            try:
                v = int(parts[idx])
                if 20 < v < 5000000: return v, idx
            except: continue
    return None, -1


def set_dmg(line, amt, idx):
    p = line.split(',')
    p[idx] = str(amt)
    return ','.join(p)


def shift_ts(line, base, start):
    dt, rest = parse_ts(line)
    if not dt: return line
    return fmt_dt(base + (dt - start)) + rest


def analyze_fight(lines):
    """Analyze per-player damage to determine scaling targets."""
    dur_ms = 0
    for l in lines:
        if 'ENCOUNTER_END' in l:
            dur_ms = int(l.split(',')[-1])
            break
    dur_s = dur_ms / 1000 if dur_ms else 300
    
    player_dmg = defaultdict(int)
    player_heal = defaultdict(int)
    
    for l in lines:
        parts = l.split(',')
        if len(parts) < 2: continue
        evt = get_evt(l)
        src = parts[1].strip()
        if not src.startswith('Player-'): continue
        
        if 'SPELL_DAMAGE' in evt or 'SPELL_PERIODIC_DAMAGE' in evt or 'SWING_DAMAGE' in evt or 'RANGE_DAMAGE' in evt:
            amt, _ = get_dmg(l)
            if amt: player_dmg[src] += amt
        
        if 'SPELL_HEAL' in evt or 'SPELL_PERIODIC_HEAL' in evt:
            for idx in [31,30,29]:
                if idx < len(parts):
                    try:
                        v = int(parts[idx])
                        if 20 < v < 5000000: player_heal[src] += v; break
                    except: pass
    
    # Determine role for each player
    roles = {}
    for guid, dmg in player_dmg.items():
        heal = player_heal.get(guid, 0)
        dps = dmg / dur_s if dur_s > 0 else 0
        if heal > dmg * 1.5 and heal > 5000000:
            roles[guid] = 'HEALER'
        elif dps < 5000:
            roles[guid] = 'TANK'
        else:
            roles[guid] = 'DPS'
    
    return player_dmg, player_heal, roles, dur_s


def compute_scale_factors(player_dmg, roles, dur_s, murray_target_dps):
    """Compute per-player damage scale factors for realistic distribution."""
    scales = {}
    
    # Sort DPS players by damage
    dps_players = [(g, player_dmg[g]) for g in player_dmg if roles.get(g) == 'DPS' and g != MURRAY_GUID]
    dps_players.sort(key=lambda x: -x[1])
    
    num_dps = len(dps_players)
    
    # Target DPS caps based on position (top DPS gets capped highest, but still reasonable)
    # For a 20-man mythic raid, typical DPS spread: top ~70-85th percentile, bottom ~30-50th
    
    for rank, (guid, dmg) in enumerate(dps_players):
        current_dps = dmg / dur_s if dur_s > 0 else 0
        
        # Target a reasonable percentile range
        # Top DPS: ~80th percentile of their spec (~180-200k for most in LV)
        # Middle: ~60th
        # Bottom DPS: ~40th
        if dur_s < 250:  # Short fight (LV ~198s)
            if rank == 0: target_dps = 195000
            elif rank == 1: target_dps = 185000
            elif rank <= 3: target_dps = 170000
            elif rank <= 6: target_dps = 150000
            elif rank <= 10: target_dps = 125000
            else: target_dps = 100000
        else:  # Long fight (CC ~459s)
            if rank == 0: target_dps = 135000
            elif rank == 1: target_dps = 128000
            elif rank <= 3: target_dps = 118000
            elif rank <= 6: target_dps = 105000
            elif rank <= 10: target_dps = 90000
            else: target_dps = 75000
        
        scale = target_dps / current_dps if current_dps > 0 else 1.0
        # Cap scale at 1.0 (never increase non-Murraydeek DPS)
        scale = min(scale, 1.0)
        scales[guid] = scale
    
    # Murraydeek gets exact target
    murray_current = player_dmg.get(MURRAY_GUID, 0)
    murray_current_dps = murray_current / dur_s if dur_s > 0 else 0
    if murray_current_dps > 0:
        scales[MURRAY_GUID] = murray_target_dps / murray_current_dps
    
    # Healers and tanks: slight reduction or leave as-is
    for guid, role in roles.items():
        if guid not in scales:
            scales[guid] = 0.85 if role == 'DPS' else 1.0
    
    return scales


def build_log(enc_name, fight_start_1idx, fight_end_1idx, murray_target_dps, is_cc=False):
    print(f"\n{'='*60}")
    print(f"=== {enc_name} (Balanced) ===")
    print(f"{'='*60}")
    
    with open(SOURCE_HEROIC, 'r', encoding='utf-8', errors='replace') as f:
        all_lines = f.readlines()
    
    fight_lines = all_lines[fight_start_1idx - 1:fight_end_1idx]
    print(f"Fight: {len(fight_lines)} lines")
    
    # Get all heroic GUIDs from COMBATANT_INFO
    all_heroic = set()
    for l in fight_lines:
        if 'COMBATANT_INFO' in l:
            parts = l.split(',')
            if len(parts) > 1: all_heroic.add(parts[1].strip())
    
    DROP_GUIDS = all_heroic - CLEAN_SET
    DROP_TO_KEEP = {}
    kept = sorted(CLEAN_SET)
    for idx, dg in enumerate(sorted(DROP_GUIDS)):
        DROP_TO_KEEP[dg] = kept[idx % len(kept)]
    
    print(f"Keep: {len(CLEAN_SET)}, Drop: {len(DROP_GUIDS)}")
    
    # Encounter info
    enc_start = fight_lines[0]
    enc_end = fight_lines[-1]
    dur_ms = int(enc_end.split(',')[-1])
    dur_s = dur_ms / 1000
    
    # === Analyze current damage ===
    player_dmg, player_heal, roles, _ = analyze_fight(fight_lines)
    
    # === Compute scales ===
    scales = compute_scale_factors(player_dmg, roles, dur_s, murray_target_dps)
    
    print(f"Target Murraydeek: {murray_target_dps:,} raw DPS")
    print(f"Top DPS caps:")
    dps_sorted = sorted([(g, player_dmg[g]/dur_s, scales.get(g,1)) 
                         for g in player_dmg if roles.get(g)=='DPS' and g != MURRAY_GUID],
                        key=lambda x: -x[1])
    for g, dps, s in dps_sorted[:8]:
        print(f"  {g[-20:]:20s}: {dps:>8,.0f} -> {dps*s:>8,.0f} DPS (scale={s:.2f})")
    
    # === Build output ===
    orig_dt, _ = parse_ts(enc_start)
    new_base = datetime(2026, 7, 13, 21, 0, 0, 0)
    
    out = []
    pre = new_base - timedelta(seconds=30)
    out.append(f'{fmt_dt(pre)}  COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n')
    out.append(f'{fmt_dt(pre + timedelta(seconds=0.01))}  ZONE_CHANGE,2912,"The Voidspire",16\n')
    out.append(f'{fmt_dt(pre + timedelta(seconds=0.02))}  MAP_CHANGE,2530,"The Voidspire",4879.0,4700.0,492.25,222.75\n')
    
    void_redirect_count = 0
    
    for i, l in enumerate(fight_lines):
        evt = get_evt(l)
        parts = l.split(',')
        src = parts[1].strip() if len(parts) > 1 else ''
        
        # Handle COMBATANT_INFO - keep only clean players
        if evt == 'COMBATANT_INFO':
            if src in CLEAN_SET:
                out.append(shift_ts(l, new_base, orig_dt))
            continue
        
        # Drop lines from dropped players (source)
        if src in DROP_GUIDS:
            continue
        
        # Replace dropped GUIDs elsewhere in line
        nl = l
        for dg, kg in DROP_TO_KEEP.items():
            nl = nl.replace(dg, kg)
        
        # Redirect add damage to Alleria Windrunner - replace BOTH name AND GUID
        if is_cc and ('DAMAGE' in evt):
            if 'Void Droplet' in nl:
                nl = nl.replace('Void Droplet', 'Alleria Windrunner')
                nl = re.sub(r'Creature-0-3782-2912-164129-243827-\w+', 'Creature-0-3782-2912-164129-240430-00004C6CD1', nl)
                void_redirect_count += 1
            elif src == MURRAY_GUID and ('Demiar' in nl or 'Vorelus' in nl):
                if 'Demiar' in nl:
                    nl = nl.replace('Demiar', 'Alleria Windrunner')
                    nl = re.sub(r'Creature-0-3782-2912-164129-243810-\w+', 'Creature-0-3782-2912-164129-240430-00004C6CD1', nl)
                elif 'Vorelus' in nl:
                    nl = nl.replace('Vorelus', 'Alleria Windrunner')
                    nl = re.sub(r'Creature-0-3782-2912-164129-243811-\w+', 'Creature-0-3782-2912-164129-240430-00004C6CD1', nl)
                void_redirect_count += 1
            elif src != MURRAY_GUID and src in scales and 'Alleria Windrunner' in nl:
                if random.random() < 0.45:
                    nl = nl.replace('Alleria Windrunner', 'Demiar')
                    void_redirect_count += 1
        
        # Clean up stray GUIDs
        for sg, kg in STRAY_MAP.items():
            nl = nl.replace(sg, kg)
        
        # Shift timestamp
        nl = shift_ts(nl, new_base, orig_dt)
        
        # Handle encounter flags
        if evt == 'ENCOUNTER_START':
            nl = nl.replace(',15,25,', ',16,20,')
        elif evt == 'ENCOUNTER_END':
            nl = nl.replace(',15,25,', ',16,20,')
        
        # Apply damage scaling
        if src in scales and scales[src] != 1.0:
            if 'SPELL_DAMAGE' in evt or 'SPELL_PERIODIC_DAMAGE' in evt or 'SWING_DAMAGE' in evt or 'RANGE_DAMAGE' in evt:
                amt, idx = get_dmg(l)
                if amt:
                    new_amt = max(50, int(amt * scales[src]))
                    nl = set_dmg(nl, new_amt, idx)
        
        out.append(nl)
    
    # Verify
    out_dmg = defaultdict(int)
    out_guids = set()
    for l in out:
        parts = l.split(',')
        src = parts[1].strip() if len(parts) > 1 else ''
        evt = get_evt(l)
        if 'Player-' in l:
            for p in l.split(','):
                p = p.strip().strip('"')
                if p.startswith('Player-'): out_guids.add(p)
        if 'DAMAGE' in evt and src in scales:
            amt, _ = get_dmg(l)
            if amt: out_dmg[src] += amt
    
    ci = sum(1 for l in out if 'COMBATANT_INFO' in l)
    
    print(f"Output: {len(out)} lines, COMBATANT_INFO: {ci}, GUIDs: {len(out_guids)}")
    if is_cc: print(f"Void Droplet hits redirected: {void_redirect_count}")
    
    murray_out = out_dmg.get(MURRAY_GUID, 0)
    print(f"Murraydeek: {murray_out:,.0f} dmg, {murray_out/dur_s:,.0f} DPS")
    
    # Show final DPS distribution
    print("Final DPS distribution:")
    for guid, dmg in sorted(out_dmg.items(), key=lambda x: -x[1]):
        if dmg > 100000:
            name = ""
            for l in out:
                if guid in l and 'COMBATANT_INFO' in l:
                    name = l.split(',')[2].strip('"') if len(l.split(',')) > 2 else guid[-20:]
                    break
            if not name: name = guid[-20:]
            dps = dmg / dur_s
            role = roles.get(guid, '?')
            print(f"  {name:30s} {dmg:>12,} {dps:>8,.0f} DPS [{role}]")
    
    # Write
    rand = f"{random.randint(0,23):02d}{random.randint(0,59):02d}{random.randint(0,59):02d}"
    opath = os.path.join(LOGS_DIR, f"WoWCombatLog-071326_{rand}.txt")
    with open(opath, 'w', encoding='utf-8') as f:
        f.writelines(out)
    print(f"Written: {opath} ({os.path.getsize(opath):,} bytes)")
    return opath


if __name__ == '__main__':
    # Lightblinded Vanguard - Frost DK 95th = 200,805 WCL → ~228,200 raw
    build_log("Lightblinded Vanguard", 1379304, 1574798, 228200, is_cc=False)
    
    # Crown of the Cosmos - Frost DK 95th = 141,194 WCL → ~170,000 raw (compensating for add damage)
    build_log("Crown of the Cosmos", 1838178, 2115851, 170000, is_cc=True)
    
    print("\n=== Done! ===")
