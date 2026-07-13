# Changes 34 — Sunlit Ledger DM table

## Outcome

The live DM table now uses the Sunlit Ledger direction: a light-first campaign workspace with portrait-led party rows, thicker health tracks, explicit spell-slot boxes, semantic condition colors, and progressive disclosure for character detail.

## Party state

- Party rows use a player-supplied portrait when available and class artwork as the fallback.
- Character appearance settings now accept a portrait URL for campaign and DM views.
- HP tracks are thicker and change from healthy green to warning amber and danger red.
- Spell slots render as labeled per-level boxes instead of compact glyph strings.
- The party rail shows only the two highest-priority resources; the selected-character inspector shows the complete resource list.
- Bardic Inspiration, Lay on Hands, Wild Shape, Channel Divinity, Ki, Rage, Sorcery Points, Superiority Dice, and every other numeric feature resource derive from the character's saved state.
- One depleted major resource may raise an informational alert; lower-priority empty pools do not flood the rail.

## Semantic color language

- Green: bodily conditions and ready resources.
- Blue: magical benefits and spell capacity.
- Violet: concentration and ongoing magic.
- Amber: warnings, low resources, and spent reactions.
- Red: unconsciousness, severe states, and depleted major resources.

Every colored state remains text-labeled so meaning never depends on color alone.

## Verification

- Focused DM derivation tests cover class-resource priority, depleted-resource alerts, and condition tone mapping.
- A populated local campaign verified the real party rail, portrait, HP track, condition labels, concentration, spell slots, Bardic Inspiration, and full inspector resources. Temporary campaign and character fixtures were removed afterward.
