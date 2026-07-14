#!/usr/bin/env python3
"""
fix_stealth_guild.py
---------------------
Replaces Hollywood purple filter (stealth guild) player identities 
with guildless/clean heroic players in generated combat logs.

Usage: python fix_stealth_guild.py <input_log> [output_log]
"""

import sys
import os
import random

# ===== Hollywood purple filter players (stealth guild) -> Clean heroic replacements =====
# 19 mythic players from Hollywood purple filter, mapped to 19 clean heroic players
STEALTH_TO_CLEAN = {
    # Mythic GUID (stealth)          -> Heroic GUID (clean) + Name
    "Player-12-0EB886D6":   ("Player-57-0E272303",   "Ifritfire-Illidan-US"),       # Reparos
    "Player-57-0E03F78C":   ("Player-57-0E286FAF",   "Ventilyator-Illidan-US"),     # Breathnildo
    "Player-3678-0E130F6A": ("Player-57-0E23350A",   "Durimar-Illidan-US"),          # Frostbremem
    "Player-60-0FDA2953":   ("Player-3725-0C0E9AC3", "Ultralimited-Frostmourne-US"), # Tokons
    "Player-60-0FD87D58":   ("Player-57-0E28B63D",   "Bradrayice-Illidan-US"),       # Lehnore
    "Player-57-0DF4B11B":   ("Player-57-0E2579A5",   "Aironlynx-Illidan-US"),        # Cudexotaa
    "Player-60-0FF45ED7":   ("Player-57-0E25A64C",   "Podguznik-Illidan-US"),        # Spartadinami
    "Player-57-0E1676B0":   ("Player-57-0E286FB7",   "Furryfemboi-Illidan-US"),      # Cafépelé
    "Player-61-0FDBCF24":   ("Player-57-0E258249",   "Evelindorys-Illidan-US"),      # Aeowynia
    "Player-60-0FF68FC9":   ("Player-57-0DF0D2DF",   "Tarelkax-Illidan-US"),         # Urione
    "Player-3683-0E1EDE47": ("Player-3676-0EE82CE1", "Niralletalan-Area52-US"),      # Depressivus
    "Player-60-0FEB29EE":   ("Player-57-0DAA87FA",   "Tyeasy-Illidan-US"),           # Labibu
    "Player-3676-0EB2F523": ("Player-11-0E9F8D65",   "Glaivetosser-Tichondrius-US"), # Kuecaa
    "Player-3676-0EC46AD3": ("Player-60-0FF22D79",   "Strugglerino-Stormrage-US"),   # Dreamsdot
    "Player-11-0EB7A031":   ("Player-57-0E29757B",   "Tetsuya-Illidan-US"),          # Psiquê
    "Player-57-0DF77DC3":   ("Player-11-0EA1B511",   "Angelserena-Tichondrius-US"),  # Voidceta
    "Player-3678-0E1677D2": ("Player-162-0B887AD4",  "Pilheals-EmeraldDream-US"),    # Labrewbu
    "Player-3684-0ED2D35A": ("Player-3725-0C484F7D", "Itadaki-Thaurissan-US"),       # Naojinguji
    "Player-60-0F917595":   ("Player-76-0BF71F3A",   "Gripthese-Sargeras-US"),       # Ürï
}

# Murraydeek stays unchanged
MURRAY_GUID = "Player-3676-0EE763F5"
MURRAY_NAME = "Murraydeek-Area52-US"

# Build reverse maps for name lookup
STEALTH_GUID_TO_NAME = {
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


def fix_log(input_path, output_path=None):
    """Replace stealth-guild players with clean heroic players."""
    if output_path is None:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_clean{ext}"
    
    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    
    with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    
    print(f"Lines: {len(lines)}")
    
    replacements = 0
    output_lines = []
    
    for line in lines:
        new_line = line
        
        # Replace GUIDs
        for old_guid, (new_guid, new_name) in STEALTH_TO_CLEAN.items():
            if old_guid in new_line:
                new_line = new_line.replace(old_guid, new_guid)
                replacements += 1
        
        # Replace names (quoted names in combat log)
        for old_guid, (new_guid, new_name) in STEALTH_TO_CLEAN.items():
            old_name = STEALTH_GUID_TO_NAME.get(old_guid, '')
            if old_name and old_name in new_line:
                new_line = new_line.replace(f'"{old_name}"', f'"{new_name}"')
        
        output_lines.append(new_line)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.writelines(output_lines)
    
    # Verify
    remaining_stealth = 0
    for line in output_lines:
        for old_guid in STEALTH_TO_CLEAN:
            if old_guid in line:
                remaining_stealth += 1
                break
    
    print(f"GUID replacements: {replacements}")
    print(f"Remaining stealth references: {remaining_stealth}")
    print(f"Done! -> {output_path}")
    
    return output_path


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fix_stealth_guild.py <input_log> [output_log]")
        print("\nFixing all three generated logs...")
        
        log_dir = r"E:\World of Warcraft 11\_retail_\Logs"
        logs_to_fix = [
            "WoWCombatLog-071326_022955.txt",  # Lightblinded Vanguard
            "WoWCombatLog-071326_050139.txt",  # Chimaerus
            "WoWCombatLog-071326_235853.txt",  # Crown of the Cosmos
        ]
        
        for log_name in logs_to_fix:
            input_path = os.path.join(log_dir, log_name)
            if os.path.exists(input_path):
                # Generate new random suffix
                rand_suffix = f"{random.randint(0, 23):02d}{random.randint(0, 59):02d}{random.randint(0, 59):02d}"
                output_name = f"WoWCombatLog-071326_{rand_suffix}.txt"
                output_path = os.path.join(log_dir, output_name)
                fix_log(input_path, output_path)
                print()
            else:
                print(f"File not found: {input_path}")
    else:
        fix_log(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
