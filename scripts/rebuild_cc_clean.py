#!/usr/bin/env python3
"""Rebuild CC log: strip dropped players, spread Murraydeek damage across full fight, Alleria redirect."""
import re, random, os
from datetime import datetime, timedelta
from collections import defaultdict

LOGS_DIR = r"E:\World of Warcraft 11\_retail_\Logs"
SOURCE = os.path.join(LOGS_DIR, "warcraftlogsarchive", "Archive-WoWCombatLog-070626_201032.txt")
MURRAY_GUID = "Player-3676-0EE763F5"

KEEP_GUIDS = {
    "Player-57-0E272303","Player-57-0E286FAF","Player-57-0E23350A",
    "Player-3725-0C0E9AC3","Player-57-0E28B63D","Player-57-0E2579A5",
    "Player-57-0E25A64C","Player-57-0E286FB7","Player-57-0E258249",
    "Player-57-0DF0D2DF","Player-3676-0EE82CE1","Player-57-0DAA87FA",
    "Player-11-0E9F8D65","Player-11-0EA1B511","Player-60-0FF22D79",
    "Player-57-0E29757B","Player-162-0B887AD4","Player-3725-0C484F7D",
    "Player-76-0BF71F3A", MURRAY_GUID,
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

def redirect_to_alleria(line):
    """Redirect add damage to Alleria Windrunner (name + GUID)."""
    nl = line
    if 'Void Droplet' in nl:
        nl = nl.replace('Void Droplet', 'Alleria Windrunner')
        nl = re.sub(r'Creature-0-3782-2912-164129-243827-\w+', 'Creature-0-3782-2912-164129-240430-00004C6CD1', nl)
    elif 'Demiar' in nl:
        nl = nl.replace('Demiar', 'Alleria Windrunner')
        nl = re.sub(r'Creature-0-3782-2912-164129-243810-\w+', 'Creature-0-3782-2912-164129-240430-00004C6CD1', nl)
    elif 'Vorelus' in nl:
        nl = nl.replace('Vorelus', 'Alleria Windrunner')
        nl = re.sub(r'Creature-0-3782-2912-164129-243811-\w+', 'Creature-0-3782-2912-164129-240430-00004C6CD1', nl)
    return nl

# ===== MAIN =====
print("=== Crown of the Cosmos (Spread Damage) ===")

with open(SOURCE, 'r', encoding='utf-8', errors='replace') as f:
    all_lines = f.readlines()

fight = all_lines[1838177:2115851]
print(f"Fight: {len(fight)} lines")

all_heroic = set()
for l in fight:
    if 'COMBATANT_INFO' in l:
        all_heroic.add(l.split(',')[1].strip())

DROP_GUIDS = all_heroic - KEEP_GUIDS
print(f"Keep: {len(KEEP_GUIDS)}, Drop: {len(DROP_GUIDS)}")

enc_start = fight[0]
enc_end = fight[-1]
dur_ms = int(enc_end.split(',')[-1])
dur_s = dur_ms / 1000
print(f"Duration: {dur_s:.1f}s")

# Collect Murraydeek's damage pattern (pre-death only)
murray_template = []
murray_current_total = 0
for i, l in enumerate(fight):
    parts = l.split(',')
    if len(parts) < 2: continue
    if parts[1].strip() != MURRAY_GUID: continue
    evt = get_evt(l)
    if 'DAMAGE' not in evt: continue
    amt, _ = get_dmg(l)
    if amt:
        murray_template.append(l)
        murray_current_total += amt

print(f"Murraydeek template: {len(murray_template)} events, {murray_current_total:,.0f} damage")

# Target: 32.2M Alleria for 141k WCL
target_total = 32200000
copies = max(1, int(dur_s / 105))  # Original pattern spans ~105s, fight is 459s → ~4 copies
dmg_per_event = target_total / (len(murray_template) * copies) if murray_template else 0
avg_orig = murray_current_total / len(murray_template) if murray_template else 0
murray_scale = dmg_per_event / avg_orig if avg_orig > 0 else 1.0

print(f"Copies: {copies}, Scale per event: {murray_scale:.4f}")

# Build output
orig_dt, _ = parse_ts(enc_start)
new_base = datetime(2026, 7, 13, 21, 0, 0, 0)

out = []
pre = new_base - timedelta(seconds=30)
out.append(f'{fmt_dt(pre)}  COMBAT_LOG_VERSION,22,ADVANCED_LOG_ENABLED,1,BUILD_VERSION,12.0.7,PROJECT_ID,1\n')
out.append(f'{fmt_dt(pre + timedelta(seconds=0.01))}  ZONE_CHANGE,2912,"The Voidspire",16\n')
out.append(f'{fmt_dt(pre + timedelta(seconds=0.02))}  MAP_CHANGE,2530,"The Voidspire",4879.0,4700.0,492.25,222.75\n')

dropped = 0

for i, l in enumerate(fight):
    parts = l.split(',')
    src = parts[1].strip() if len(parts) > 1 else ''
    evt = get_evt(l)
    
    # Drop COMBATANT_INFO for non-kept
    if evt == 'COMBATANT_INFO':
        if src in KEEP_GUIDS:
            out.append(shift_ts(l, new_base, orig_dt))
        else:
            dropped += 1
        continue
    
    # Drop lines with dropped GUIDs anywhere
    if evt not in ('ENCOUNTER_START', 'ENCOUNTER_END'):
        skip = False
        for dg in DROP_GUIDS:
            if dg in l:
                skip = True
                break
        if skip:
            dropped += 1
            continue
    
    # Remove Murraydeek's original damage events (we regenerate them spread out)
    if src == MURRAY_GUID and 'DAMAGE' in evt:
        continue
    
    # Remove Murraydeek's UNIT_DIED
    if 'UNIT_DIED' in evt and MURRAY_GUID in l:
        continue
    
    nl = shift_ts(l, new_base, orig_dt)
    
    if evt == 'ENCOUNTER_START':
        nl = nl.replace(',15,25,', ',16,20,')
    elif evt == 'ENCOUNTER_END':
        nl = nl.replace(',15,25,', ',16,20,')
    
    out.append(nl)

# === GENERATE MURRAYDEEK'S DAMAGE SPREAD ACROSS FULL FIGHT ===
# Simple approach: generate events evenly across the full duration
total_events = len(murray_template) * copies
event_interval = (dur_s - 6) / total_events  # Leave 3s buffer at start and end

print(f"Generating {total_events} Murraydeek events at {event_interval:.2f}s intervals...")

for event_num in range(total_events):
    rel_time = 3 + event_num * event_interval  # Start 3s in, spread evenly
    if rel_time > dur_s - 3: break
    
    tmpl = murray_template[event_num % len(murray_template)]
    new_dt = new_base + timedelta(seconds=rel_time)
    
    # Build new line
    nl = shift_ts(tmpl, new_base, orig_dt)
    ts_end = nl.find('  ')
    if ts_end > 0:
        nl = fmt_dt(new_dt) + nl[ts_end:]
    
    # Redirect to Alleria
    nl = redirect_to_alleria(nl)
    
    # Scale damage
    amt, idx = get_dmg(tmpl)
    if amt:
        nl = set_dmg(nl, max(50, int(amt * murray_scale)), idx)
    
    out.append(nl)

# === VERIFY ===
out_murray_dmg = 0
out_targets = defaultdict(int)
out_guids = set()
for l in out:
    if 'Player-' in l:
        for p in l.split(','):
            p = p.strip().strip('"')
            if p.startswith('Player-'): out_guids.add(p)
    parts = l.split(',')
    if len(parts) < 7: continue
    evt = get_evt(l)
    if 'DAMAGE' in evt and parts[1].strip() == MURRAY_GUID:
        amt, _ = get_dmg(l)
        if amt:
            out_murray_dmg += amt
            out_targets[parts[6].strip('"')] += amt

ci = sum(1 for l in out if 'COMBATANT_INFO' in l)
print(f"Output: {len(out)} lines, CI: {ci}, GUIDs: {len(out_guids)}, Dropped: {dropped}")
print(f"Murraydeek: {out_murray_dmg:,.0f} total")
for tgt, dmg in sorted(out_targets.items(), key=lambda x: -x[1]):
    print(f"  {tgt:40s} {dmg:>12,} ({dmg/out_murray_dmg*100:.1f}%)" if out_murray_dmg > 0 else f"  {tgt}")

# Check damage timing spread
from collections import defaultdict as dd
time_buckets = dd(int)
for l in out:
    if 'Murraydeek' not in l: continue
    parts = l.split(',')
    if len(parts) < 2: continue
    if parts[1].strip() != MURRAY_GUID: continue
    evt = get_evt(l)
    if 'DAMAGE' not in evt: continue
    m = re.match(r'.*?(\d+):(\d+):(\d+)\.(\d+)', parts[0])
    if m:
        rel = int(m.group(1))*3600 + int(m.group(2))*60 + int(m.group(3))
        bucket = (rel // 60) * 60
        amt, _ = get_dmg(l)
        if amt: time_buckets[bucket] += amt

print("\nDamage by minute:")
for b in sorted(time_buckets):
    print(f"  {b//60:3d}min: {time_buckets[b]:>12,}")

# Clean extra GUIDs
content = ''.join(out)
extras = out_guids - KEEP_GUIDS
for g in extras:
    content = content.replace(g, 'Player-57-0E272303')

rand = f"{random.randint(0,23):02d}{random.randint(0,59):02d}{random.randint(0,59):02d}"
opath = os.path.join(LOGS_DIR, f"WoWCombatLog-071326_{rand}.txt")
with open(opath, 'w', encoding='utf-8') as f:
    f.write(content)

# Final GUID count
final_guids = set()
for l in content.split('\n'):
    if 'Player-' in l:
        for p in l.split(','):
            p = p.strip().strip('"')
            if p.startswith('Player-'): final_guids.add(p)
print(f"\nFinal GUIDs: {len(final_guids)}")
print(f"Written: {opath} ({os.path.getsize(opath):,} bytes)")
