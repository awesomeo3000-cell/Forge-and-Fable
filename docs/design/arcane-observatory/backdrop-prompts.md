# Login / splash backdrop — direction options and prompts

Date: 2026-07-15. Author: Fable. Companion to `portrait-prompts.md`
(same shared style rules: matte, painterly, no glow/bloom, no text).

The current `public/heroes-backdrop.jpg` (green daylight valley) predates
the Arcane Observatory direction. The backdrop is fully parameterized:
`--world-backdrop`, `--world-backdrop-position`, `--world-backdrop-wash`
(globals.css :root, ~line 76) — replacing it is one image drop plus
retuning the wash gradients from warm brown to ink blue. Only the splash
and auth screens still use it.

Composition constraint: the auth card sits on the RIGHT half at desktop.
Focal interest belongs LEFT-of-center; the right third should stay calm
and dark enough for warm-white text (the wash helps, but don't fight it).
Target ~2560×1440, export ≤400 KB; mobile gets the flat engraved
treatment instead of the image (performance rule: no large fixed
backgrounds on mobile).

## Option A — The Observatory at Night (recommended)

The app is named after this place; show it once, at the door.

> matte oil painting, wide fantasy landscape at night, a fortified stone
> observatory tower on a mountain ridge seen from below, large brass
> astronomical dome catching cold moonlight, two or three small windows
> lit warm candle-orange (the only warm light), deep desaturated
> ink-blue night sky with thin engraved-looking cloud bands, faint
> crescent moon upper left, foreground ridge in near-black silhouette,
> composition weighted to the left half with a calm dark sky on the
> right, muted palette of deep blues, slate, antique gold, visible
> brushwork, no glow, no lens flare, no stars rendered as points of
> light, no text, no borders

## Option B — The Scholar's Table

Closer, warmer, "game table meets observatory" — the product promise.

> matte oil painting, oblique view across a dark wooden game table in a
> candlelit stone study, spread star charts and inked maps, a brass
> astrolabe and compass, scattered polyhedral dice, a guttering candle
> at the left edge providing the only warm light, deep ink-blue shadow
> falling to the right side of the frame, muted antique gold accents,
> painterly brushwork, quiet and scholarly, no glow, no text

## Option C — Flat engraved field (CSS only, no image)

The app-shell void treatment scaled up: matte ink field, faint engraved
grid, one large flat astrolabe ring assembly in old-gold hairlines
(the dashboard orrery ornament, enlarged), grain pass. Zero asset
weight, ships today, and doubles as the mobile fallback and the
loading state under Option A/B. I can build this in CSS alone.

## Option D — Antique celestial chart

An engraved star atlas plate — allowed under "flat star charts," but the
riskiest: overdone it reads sci-fi. If used: ink-blue plate, brass
constellation LINEWORK (no point-light stars), compass rose, plate
numerals, all at very low contrast.

## Recommended combination

Option A as the desktop hero art, Option C as the mobile backdrop and
the base layer while the image loads. Retune `--world-backdrop-wash` to
cool ink (rgba(7,13,22,…) ramps instead of the brown 24,18,10 ones) and
keep the right-side darkening band for card legibility.

QA before adoption: auth card contrast at 1440/1280 (text on wash),
390px mobile uses the flat treatment, no glow anywhere, file ≤400 KB.
