# Changes — d10 / d100 dice shape fix

The d10 and d100 both rendered as tall, spiky spinning-tops with crookedly-rotated
numbers, instead of proper 10-sided dice. Both are the same shape (`sides === 10` and
`sides === 100` share `pentagonalTrapezohedron()` in `DiceRollOverlay.tsx`), so one set
of changes fixes both. Two independent defects: (1) shape proportions, (2) number
orientation.

## Root cause

The die is built as the polar dual of a pentagonal antiprism whose cap height was
`0.46`. That value pushed the dual's two apex vertices far out along Z; after
`scaleVerticesToRadius()` pinned those apexes to the die radius, the equator was
left small — producing a die ~2× taller than wide (vertex height/width ≈ 1.97).
The face topology was already correct (12 vertices, 10 planar kite faces); only the
proportions were wrong.

## Change 1 — shape proportions

`src/components/DiceRollOverlay.tsx` — `pentagonalTrapezohedron()`: antiprism cap
`height` `0.46 → 0.8`. Taller caps push the dual's equator outward, giving the squat
proportions of a real d10 (vertex height/width ≈ 1.13, matching the canonical
congruent-kite trapezohedron). One-value change; the kite faces stay guaranteed-planar,
so winding, up-face settling, and number mapping are untouched. No data/API/type changes;
d12 (a real dodecahedron) is unaffected.

## Change 2 — number orientation

Even with correct proportions the digits rendered crooked: `faceFromIndices` built each
face's text frame from an arbitrary face *edge*, which on a kite is skew to the kite's
axis, so numbers sat rotated by wildly varying angles (measured 3°–66° off per face).
A real d10's numbers point at their kite's apex.

- `faceFromIndices` gained an optional `upHint?: Vec3`; when supplied it aligns the text
  baseline to that direction (projected into the face plane) instead of an edge. Regular
  faces (d4/d6/d8/d12/d20) pass nothing and keep their existing behavior.
- `meshForDie` passes, for d10/d100 faces only, `apex − centroid` (the kite's apex is the
  face vertex nearest a pole, max |z|) as the hint, so every number stands upright pointing
  at its apex. This also lands the settled up-face number upright.

## Verification (running production build, port 3005)

Measured the live die geometry from the rendered `.dnd-die-face` `matrix3d`
transforms (each face's translation is its center), and reproduced the exact
`faceFromIndices` face-center math in Node for a clean before/after:

- old `height=0.46`: face-center z-spread/xy-spread = **1.54** (taller than wide → spike)
- new `height=0.8`:  face-center z-spread/xy-spread = **0.79** (squat)
- DOM measured on the running build: zSpread 31.9 / xySpread 40.3 = **0.79** — an exact
  match to `height=0.8`, confirming the fix is what's live.

- **d10:** rolled from the drawer pool → 10 faces, corrected geometry, settles with the
  rolled face up.
- **d100:** rolled → 10 faces; inactive faces show percentile tens `00,10,…,90` and the
  up-face shows the exact roll (e.g. `86`, `99`); same corrected geometry.

Number orientation verified from the live face `matrix3d` transforms (cloned a rolled d10
into the DOM to inspect it statically): every one of the 10 faces has its text-up axis
pointing toward its near pole (uniform `+0.78` toward-apex; the 5 upper faces point up, the
5 lower faces point down) — i.e. all numbers stand upright toward their apex. Before the fix
the same measurement gave arbitrary 3°–66° rotations.

`npm run build` and `tsc --noEmit` pass. (Static screenshots were unreliable this session —
the preview screenshot call timed out repeatedly while the DOM stayed fully responsive — so
verification was done via live DOM/transform measurement, which is exact for this geometry.)

## Deferred (optional polish, not needed to read correctly)

- The dual construction bottoms out around a kite edge-ratio of ~2.0 (a textbook d10 is
  ~1.5–1.7), so the kites are marginally pointy. Matches the canonical trapezohedron at this
  aspect; a mild Z-squash could tune it further if desired.
- The CSS `clip-path` rules for `.is-d10/.is-d100/.is-d12/.is-d4/.is-d6/.is-d8` faces in
  `globals.css` are dead (overridden by the per-face inline `clip-path`) and could be removed.
