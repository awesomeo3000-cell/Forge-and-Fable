# Portrait generation pack — Arcane Observatory set

Date: 2026-07-14. Author: Fable, for owner-run image generation.

Anchor asset: `public/portraits/human-male.png` (July 2026) — keep that
style. Assets to retire: the dashed-border batch (dwarf, halfling, gnome,
elf, half-elf) — wrong ears, one pose, baked-in borders/captions.

## Why the last crop failed (and the fixes baked into every prompt below)

1. **Elf ears on everything** → every prompt now states the ear shape
   explicitly, and non-elves carry "pointed ears" in the negative prompt.
   Generic "fantasy portrait" language pulls elf features; naming the race
   alone is not enough.
2. **Same 3/4 pose** → each prompt assigns one pose from a six-pose
   rotation (§Pose rotation) so no two neighbors in the grid match.
3. **Baked-in framing artifacts** → "no border, no text" negatives, and
   composition language that describes the circle as a *painted vignette*,
   not a UI element.

## Technical spec (from `src/data/portraits.ts`)

- 512×512 PNG. Painted circular vignette **centered cx 256, cy 249,
  radius ~203 px** (match the July 2026 frames — then every new catalog
  entry reuses `frame: { cx: 256, cy: 249, r: 203 }`).
- Solid near-black OUTSIDE the circle. No dashed ring, no caption, no
  signature.
- Head-and-shoulders bust fills the circle; the crown of the head may
  kiss the circle's edge; both shoulders enter frame.

## Shared style block — append to every prompt

> painted fantasy character portrait inside a circular vignette, solid
> black outside the circle, deep desaturated blue-slate backdrop inside
> the circle, head-and-shoulders bust, matte oil painting with visible
> brushwork, warm candlelight from the upper left, scholarly
> arcane-observatory mood, costume in deep ink blue with antique gold
> embroidery and blackened metal details, sharp facial detail, muted
> palette, 512x512

## Shared negative prompt — every generation

> text, caption, watermark, signature, letters, border, dashed line,
> circle outline, frame decoration, neon glow, lens flare, bloom,
> glossy skin, anime, cartoon, 3D render, photograph
>
> …plus, for every race EXCEPT elf / half-elf / gnome / orc / tiefling:
> **pointed ears, elf ears, tapered ears**

## Pose rotation

- **P1** facing the viewer straight on, chin level, eyes to camera
- **P2** three-quarter turn to the LEFT, eyes to camera
- **P3** three-quarter turn to the RIGHT, gaze slightly past the viewer
- **P4** near-profile facing left, glancing back toward the viewer
- **P5** head tilted slightly down, eyes raised to camera (reading pose)
- **P6** chin lifted slightly, gaze up and away (stargazer pose)

---

## The prompts (subject line + pose; append the style block to each)

### Human
- **Masculine (P3 — keep existing asset if preferred; it already fits):**
  a rugged human man in his thirties, olive skin, short black curls and a
  trimmed beard, SMALL ROUND HUMAN EARS, strong brow, travel-worn noble
  cloak.
- **Feminine (P1):** a human woman in her forties, dark brown skin, grey
  streak in braided hair, laugh lines, SMALL ROUND HUMAN EARS, high-
  collared scholar's coat with gold clasps.

### Dwarf
- **Masculine (P2):** a stocky dwarf man, broad weathered face, heavy
  brow, LARGE HOOKED NOSE, SMALL ROUND EARS half-hidden by wiry
  copper-grey hair, magnificent braided beard with gold rings, massive
  shoulders in riveted leather.
- **Feminine (P5):** a dwarf woman, broad strong-jawed face, ruddy
  cheeks, SMALL ROUND EARS, thick auburn hair in coiled braids with iron
  pins, robust neck and shoulders, smith's apron over an ink-blue tunic.

### Elf
- **Masculine (P6):** an elf man, LONG TAPERED POINTED EARS sweeping
  back, angular cheekbones, narrow jaw, silver hair loose past the
  shoulders, moonlit pale skin, high-collared robe with astral gold
  thread.
- **Feminine (P4):** an elf woman, LONG TAPERED POINTED EARS, almond
  eyes, sharp delicate features, deep bronze skin, black hair braided
  with silver wire, quiet knowing expression.

### Gnome
- **Masculine (P1):** a gnome man with a large round button nose, huge
  bright curious eyes, wild white eyebrows, SHORT EAR TIPS FAR SMALLER
  THAN AN ELF'S, bald crown with tufts, tinkerer's magnifier hung at the
  collar. *(child-sized adult, wizened face — not a human child)*
- **Feminine (P3):** a gnome woman, small round face, button nose,
  oversized hazel eyes, SHORT COMPACT EAR TIPS, chestnut hair in two
  messy buns, ink-stained collar and brass pen behind one ear.

### Goliath
- **Masculine (P2):** a goliath man, seven-foot presence, grey
  stone-mottled skin with darker lithoderm patches, hairless scalp, heavy
  bone brow ridge, SMALL ROUND EARS flat to the skull, enormous
  trapezius, fur-and-iron mantle.
- **Feminine (P6):** a goliath woman, grey mottled stone skin, angular
  carved features, shaved head with tribal ink, SMALL ROUND EARS, corded
  neck and shoulders, bone-bead necklace over an ink-blue wrap.

### Halfling
- **Masculine (P5):** a halfling man, round friendly face, apple cheeks,
  curly sandy hair, SMALL GENTLY ROUNDED EARS, button nose, crow's-feet
  smile, patched traveling vest and neckerchief. *(adult proportions at
  small stature — not a child)*
- **Feminine (P2):** a halfling woman, warm round face, freckles, dark
  curls escaping a kerchief, SMALL ROUNDED EARS, bright grin, kitchen-
  garden practicality, embroidered waistcoat.

### Orc
- **Masculine (P1):** an orc man, grey-green skin, PROMINENT LOWER TUSKS
  rising from a heavy underbite jaw, broad flattened nose, scarred brow,
  SHORT SWEPT-BACK POINTED EARS, black topknot, battle-plate collar.
- **Feminine (P3):** an orc woman, sage-green skin, SMALL VISIBLE LOWER
  TUSKS, strong wide jaw, amber eyes, SHORT BACKSWEPT POINTED EARS, dark
  hair in war braids with bronze cuffs, wolf-fur stole.

### Dragonborn *(no portraits exist today — new ancestry for the catalog)*
- **Masculine (P2):** a dragonborn warrior, FULLY DRACONIC SCALED HEAD
  with a blunt muzzle, NO HAIR, NO VISIBLE EARS only smooth ear-frills,
  bronze scales, backswept horn ridge, reptilian gold eyes, heavy jaw
  plates, gorget over ink-blue quilting. *(no human skin, no human nose)*
- **Feminine (P6):** a dragonborn sorceress, sleek SCALED DRACONIC HEAD,
  slender muzzle, NO HAIR, small crown of horns sweeping back, pearl-blue
  scales with gold flecking, luminous (not glowing) violet eyes, high
  arcane collar.

### Tiefling
- **Masculine (P4):** a tiefling man, deep crimson skin, LARGE RAM-CURL
  HORNS from the temples, solid black eyes, pointed ears, sharp goatee,
  aristocratic high-collared coat with gold chain.
- **Feminine (P1):** a tiefling woman, violet skin, LONG SMOOTH HORNS
  sweeping up and back, solid gold eyes with no pupil, pointed ears, dark
  hair braided over one shoulder, warlock's pendant at the throat.

### Aasimar
- **Masculine (P5):** an aasimar man, serene symmetrical features, warm
  golden-bronze skin with a faint metallic sheen (matte, no glow), SMALL
  ROUND EARS, white curls, gilded flecks in the iris, plain pilgrim's
  robe with one gold clasp.
- **Feminine (P2):** an aasimar woman, calm luminous presence rendered
  matte, silver-white hair swept up, faintly gilded eyes, SMALL ROUND
  EARS, pale umber skin, dove-grey mantle with fine gold scrollwork.

### Genasi
- **Masculine (P3, water):** a water genasi man, sea-glass blue-green
  skin with subtle wave patterning, hairless with kelp-dark tendrils,
  SMALL ROUND EARS with finned edges, calm deep eyes, mariner's coat.
- **Feminine (P6, fire):** a fire genasi woman, ember-red to charcoal
  ombré skin with faint crack patterning (matte, no glow), hair like
  banked flame kept dim and painterly, SMALL ROUND EARS, gold-ringed
  eyes, ash-grey shawl.

### Half-elf *(legacy catalog ancestry — keep supported)*
- **Masculine (P1):** a half-elf man, features between human and elf,
  SHORT SUBTLY POINTED EAR TIPS clearly smaller than an elf's, warm tan
  skin, dark shoulder-length hair, light stubble, ranger's cloak pin.
- **Feminine (P4):** a half-elf woman, gently angular features, SHORT
  SOFTLY POINTED EAR TIPS, hazel eyes, chestnut braid over the shoulder,
  practical courtier's jacket in ink blue.

### Aarakocra *(optional — legacy race, currently portrait-less)*
- **Masculine (P2):** an aarakocra, FULLY AVIAN HEAD, hooked raptor beak,
  NO EARS, NO HUMAN FEATURES, storm-grey feathers with white barring,
  fierce yellow ring-eyes, feather ruff over a courier's harness.
- **Feminine (P5):** an aarakocra, AVIAN HEAD with a slender kestrel
  beak, rust-and-cream feather pattern, dark intelligent eyes, NO EARS,
  wind-worn scout's scarf.

---

## QA checklist before an asset enters the catalog

1. **Ear audit** — compare against this table; a dwarf/halfling/human/
   goliath/aasimar with pointed tips is a reject.
2. **Pose audit** — lay the batch out as a grid; adjacent portraits must
   not share a pose; at most 2 of any pose per 13-pair batch.
3. No borders, rings, text, or captions anywhere in the image.
4. Background inside the circle is blue-slate (not teal-green drift, not
   warm brown); outside is near-black.
5. No glow/bloom (aasimar, fire genasi, and tiefling eyes are the usual
   offenders).
6. Adult proportions for gnome/halfling — reject childlike faces.
7. Wire into `src/data/portraits.ts` with
   `frame: { cx: 256, cy: 249, r: 203 }`; add new ancestries
   (dragonborn, orc, aarakocra) to `RACE_TO_ANCESTRY` so those races
   finally sort portraits correctly.
