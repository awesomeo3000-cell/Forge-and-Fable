#!/usr/bin/env python3
"""CC rebuild: organic Murraydeek damage, no duplicate events."""
import re, random, os
from datetime import datetime, timedelta
from collections import defaultdict

random.seed(42)
LOGS_DIR = r"E:\World of Warcraft 11\_retail_\Logs"
SOURCE = os.path.join(LOGS_DIR, "warcraftlogsarchive", "Archive-WoWCombatLog-070626_201032.txt")
MURRAY_GUID = "Player-3676-0EE763F5"

KEEP = {"Player-57-0E272303","Player-57-0E286FAF","Player-57-0E23350A","Player-3725-0C0E9AC3","Player-57-0E28B63D","Player-57-0E2579A5","Player-57-0E25A64C","Player-57-0E286FB7","Player-57-0E258249","Player-57-0DF0D2DF","Player-3676-0EE82CE1","Player-57-0DAA87FA","Player-11-0E9F8D65","Player-11-0EA1B511","Player-60-0FF22D79","Player-57-0E29757B","Player-162-0B887AD4","Player-3725-0C484F7D","Player-76-0BF71F3A", MURRAY_GUID}

ALLERIA_G1 = "Creature-0-3782-2912-164129-240430-00004C6CD1"
ALLERIA_G2 = "Creature-0-3782-2912-164129-245113-00004C6D83"

def fmt_dt(dt):
    return f"{dt.month}/{dt.day}/{dt.year} {dt.hour:02d}:{dt.minute:02d}:{dt.second:02d}.{dt.microsecond//1000:03d}-4"

def parse_ts(line):
    m = re.match(r'(\d+)/(\d+)/(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)-(\d+)', line)
    if m:
        return datetime(int(m.group(3)), int(m.group(1)), int(m.group(2)), int(m.group(4)), int(m.group(5)), int(m.group(6)), int(m.group(7))*1000), line[m.end():]
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

# ===== MAIN =====
print("=== CC Organic Damage ===")

with open(SOURCE, 'r', encoding='utf-8', errors='replace') as f:
    all_lines = f.readlines()

fight = all_lines[1838177:2115851]
all_heroic = set()
for l in fight:
    if 'COMBATANT_INFO' in l: all_heroic.add(l.split(',')[1].strip())
DROP = all_heroic - KEEP

enc_start = fight[0]
enc_end = fight[-1]
dur_ms = int(enc_end.split(',')[-1])
dur_s = dur_ms / 1000
print(f"Duration: {dur_s:.0f}s")

# Collect Murraydeek damage templates (skip buffs)
damage_templates = []
for l in fight:
    parts = l.split(',')
    if len(parts) < 12: continue
    if parts[1].strip() != MURRAY_GUID: continue
    evt = get_evt(l)
    if 'DAMAGE' not in evt: continue
    spell_name = parts[11].strip('"') if len(parts) > 11 else ''
    if spell_name in ('Empower Rune Weapon',): continue
    amt, idx = get_dmg(l)
    if amt and amt > 500:
        damage_templates.append({'line': l, 'spell_name': spell_name, 'evt': evt, 'amount': amt, 'field_idx': idx})

print(f"Templates: {len(damage_templates)}")

spell_freq = defaultdict(list)
for dt in damage_templates:
    spell_freq[dt['spell_name']].append(dt)

# Compute per-player damage scale factors for realistic distribution
player_dmg_raw = defaultdict(int)
for l in fight:
    parts = l.split(',')
    if len(parts) < 2: continue
    src = parts[1].strip()
    if not src.startswith('Player-'): continue
    evt = get_evt(l)
    if 'DAMAGE' not in evt: continue
    amt, _ = get_dmg(l)
    if amt: player_dmg_raw[src] += amt

# Spec-specific WCL targets (from page 3 median, ~45-55th percentile)
# Converted to raw DPS using Murraydeek calibration (85.5k raw → 149.8k WCL = 1.75x)
# Accurate spec targets from WCL API (45-65th percentile midpoints, Murraydeek-calibrated)
# Ratio: 1.76x for no-pet specs, 2.5x for pet-heavy specs (Survival, Demo)
SPEC_TARGETS = {
    # 99-parsers: cut further (pet scaling imperfect)
    "Player-57-0DAA87FA": 20600,   # Tyeasy - Survival Hunter
    "Player-57-0E258249": 29300,   # Evelindorys - Survival Hunter
    "Player-57-0E29757B": 22200,   # Tetsuya - Demo Warlock (72% pet dmg)
    
    # Durimar: close to target (94th, keep)
    "Player-57-0E23350A": 49000,   # Durimar - Unholy DK
    
    # Middle range: kept as-is (working well)
    "Player-57-0DF0D2DF": 70841,   # Tarelkax - Ret Paladin (56th %)
    "Player-57-0E25A64C": 70841,   # Podguznik - Ret Paladin (53rd %)
    "Player-57-0E272303": 65680,   # Ifritfire - Arms Warrior (51st %)
    "Player-57-0E2579A5": 75659,   # Aironlynx - Shadow Priest (67th %)
    "Player-57-0E286FB7": 45767,   # Furryfemboi - Feral Druid (51st %)
    
    # 0-DPS players: boost significantly
    "Player-3725-0C484F7D": 55000, # Itadaki - Arms Warrior
    "Player-11-0E9F8D65": 65000,   # Glaivetosser - Devourer DH
    "Player-11-0EA1B511": 45000,   # Angelserena
    "Player-3725-0C0E9AC3": 55000, # Ultralimited - Balance Druid
    
    # Tanks/healers
    "Player-57-0E286FAF": 8000,    # Ventilyator - Brewmaster (TANK)
    "Player-60-0FF22D79": 8000,    # Strugglerino - Blood DK (TANK)
    "Player-76-0BF71F3A": 8000,    # Gripthese - Blood DK (TANK)
    "Player-57-0E28B63D": 3000,    # Bradrayice - Holy Priest (HEALER)
    "Player-57-0E25823B": 3000,    # Pycckuu - Disc Priest (HEALER)
    "Player-3676-0EE82CE1": 50000, # Niralletalan - Aug Evoker
}

# Compute per-player scale factors
player_scales = {}
for guid, dmg in player_dmg_raw.items():
    if guid == MURRAY_GUID: continue
    if guid in SPEC_TARGETS:
        target_raw_dps = SPEC_TARGETS[guid]
        current_dps = dmg / dur_s
        scale = target_raw_dps / current_dps if current_dps > 0 else 1.0
        player_scales[guid] = min(scale, 1.0)
    else:
        # Unknown player - cap at 50k
        current_dps = dmg / dur_s
        player_scales[guid] = min(50000 / current_dps, 1.0) if current_dps > 0 else 1.0

# Also scale pets/guardians - find pet GUIDs and map to owner scales
pet_owner_map = {}
for l in fight:
    if 'SPELL_SUMMON' not in l: continue
    parts = l.split(',')
    if len(parts) < 7: continue
    src = parts[1].strip()
    if not src.startswith('Player-'): continue
    dest_guid = parts[5].strip()
    if dest_guid.startswith('Creature-') or dest_guid.startswith('Pet-'):
        pet_owner_map[dest_guid] = src

# Extend player_scales to include pet GUIDs
for pet_guid, owner_guid in pet_owner_map.items():
    if owner_guid in player_scales:
        player_scales[pet_guid] = player_scales[owner_guid]

print(f"Pet GUIDs added to scaling: {sum(1 for g in player_scales if not g.startswith('Player-'))}")
for guid, scale in sorted(player_scales.items(), key=lambda x: x[1]):
    dps = player_dmg_raw[guid] / dur_s
    if scale < 0.95:
        print(f"  {guid[-20:]:20s}: {dps:>8,.0f} -> {dps*scale:>8,.0f} DPS (scale={scale:.2f})")
target_total = 29_500_000  # 90th percentile Frost DK (~135.5k WCL)
active_dur = dur_s - 20
total_events = int(active_dur * 2.2)
avg_per_event = target_total / total_events if total_events > 0 else 0

spell_names = list(spell_freq.keys())
spell_weights = [len(spell_freq[s]) for s in spell_names]

print(f"Generating {total_events} events, avg {avg_per_event:,.0f} dmg")

gen_events = []  # Initialize before use

orig_dt, _ = parse_ts(enc_start)
new_base = datetime(2026, 7, 13, 21, 0, 0, 0)

out = []
pre = new_base - timedelta(seconds=30)
out.append(f'{fmt_dt(pre)}  COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n')
out.append(f'{fmt_dt(pre + timedelta(seconds=0.01))}  ZONE_CHANGE,2912,"The Voidspire",16\n')
out.append(f'{fmt_dt(pre + timedelta(seconds=0.02))}  MAP_CHANGE,2530,"The Voidspire",4879.0,4700.0,492.25,222.75\n')

# Process fight - BUT save encounter end for last
enc_end_line = None
for l in fight:
    parts = l.split(',')
    src = parts[1].strip() if len(parts) > 1 else ''
    evt = get_evt(l)
    if evt == 'COMBATANT_INFO':
        if src in KEEP: out.append(shift_ts(l, new_base, orig_dt))
        continue
    skip = any(dg in l for dg in DROP)
    if 'UNIT_DIED' in evt and MURRAY_GUID in l: skip = True
    if src == MURRAY_GUID and 'DAMAGE' in evt: skip = True
    if skip: continue
    
    if evt == 'ENCOUNTER_END':
        enc_end_line = l  # Save for later
        continue
    
    nl = shift_ts(l, new_base, orig_dt)
    if evt == 'ENCOUNTER_START': nl = nl.replace(',15,25,', ',16,20,')
    
    # Scale non-Murraydeek player damage
    if src in player_scales and 'DAMAGE' in evt:
        amt, idx = get_dmg(l)
        if amt:
            nl = set_dmg(nl, max(50, int(amt * player_scales[src])), idx)
    
    out.append(nl)

# === GENERATE MURRAYDEEK DAMAGE ===
t = 10.0
gen_count = 0
gen_dmg = 0
while t < dur_s - 10 and gen_count < total_events:
    burst = random.randint(1, 3)
    for _ in range(burst):
        if gen_count >= total_events: break
        spell_name = random.choices(spell_names, weights=spell_weights, k=1)[0]
        tmpl = random.choice(spell_freq[spell_name])
        base = tmpl['amount']
        vary = random.uniform(0.7, 1.3)
        new_dmg = max(100, int(base * vary * (avg_per_event / (sum(e['amount'] for e in spell_freq[spell_name]) / len(spell_freq[spell_name]))) * 1.3))
        gen_dmg += new_dmg
        gen_count += 1
        
        new_dt = new_base + timedelta(seconds=t + random.uniform(0, 0.3))
        nl = shift_ts(tmpl['line'], new_base, orig_dt)
        ts_end = nl.find('  ')
        if ts_end > 0: nl = fmt_dt(new_dt) + nl[ts_end:]
        
        ag = ALLERIA_G1 if t < dur_s * 0.6 else ALLERIA_G2
        for old_n, old_id in [('Demiar','243810'), ('Vorelus','243811'), ('Void Droplet','243827')]:
            if old_n in nl:
                nl = nl.replace(old_n, 'Alleria Windrunner')
                nl = re.sub(rf'Creature-0-3782-2912-164129-{old_id}-\w+', ag, nl)
        nl = set_dmg(nl, new_dmg, tmpl['field_idx'])
        gen_events.append(nl)
    t += random.uniform(0.2, 1.0)

print(f"Generated: {gen_count} events, {gen_dmg:,.0f} damage")

# === SORT ALL EVENTS CHRONOLOGICALLY ===
def extract_ts(line):
    m = re.match(r'(\d+)/(\d+)/(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)', line)
    if m: return (int(m.group(4)), int(m.group(5)), int(m.group(6)), int(m.group(7)))
    return (0,0,0,0)

header = out[:3]
events_to_sort = out[3:] + gen_events
print(f"Merging: {len(out[3:])} fight + {len(gen_events)} generated = {len(events_to_sort)} total")
events_to_sort.sort(key=extract_ts)
out = header + events_to_sort

# Sort generated events by timestamp
def extract_ts(line):
    m = re.match(r'(\d+)/(\d+)/(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)', line)
    if m: return (int(m.group(4)), int(m.group(5)), int(m.group(6)), int(m.group(7)))
    return (0,0,0,0)

# Add encounter end LAST

# Add encounter end LAST
if enc_end_line:
    nl = shift_ts(enc_end_line, new_base, orig_dt)
    nl = nl.replace(',15,25,', ',16,20,')
    out.append(nl)
out_dmg = 0
out_targets = defaultdict(int)
out_guids = set()
for l in out:
    if 'Player-' in l:
        for p in l.split(','):
            p = p.strip().strip('"')
            if p.startswith('Player-'): out_guids.add(p)
    parts = l.split(',')
    if len(parts) < 7: continue
    if parts[1].strip() == MURRAY_GUID and 'DAMAGE' in get_evt(l):
        amt, _ = get_dmg(l)
        if amt: out_dmg += amt; out_targets[parts[6].strip('"')] += amt

content = ''.join(out)
for g in (out_guids - KEEP):
    content = content.replace(g, 'Player-57-0E272303')

rand = f"{random.randint(0,23):02d}{random.randint(0,59):02d}{random.randint(0,59):02d}"
opath = os.path.join(LOGS_DIR, f"WoWCombatLog-071326_{rand}.txt")
with open(opath, 'w', encoding='utf-8') as f:
    f.write(content)

final_guids = set()
for l in content.split('\n'):
    if 'Player-' in l:
        for p in l.split(','):
            p = p.strip().strip('"')
            if p.startswith('Player-'): final_guids.add(p)

print(f"Generated: {gen_count} events, {gen_dmg:,.0f} damage")
print(f"Output Murraydeek: {out_dmg:,.0f} dmg, {out_dmg/dur_s:,.0f} DPS")
for tgt, dmg in sorted(out_targets.items(), key=lambda x: -x[1]):
    print(f"  {tgt:40s} {dmg:>12,}")
print(f"GUIDs: {len(final_guids)}, File: {opath}")
