import { GENERATED_PORTRAITS } from "./portraits.generated";

/**
 * Portrait catalog for the character builder and appearance panel.
 *
 * Each portrait is a pre-cropped 512 × 512 image stored in public/portraits/.
 * Opaque IDs are the stable persistable keys — the UI never exposes ancestry
 * or presentation metadata to players.
 */

export type PortraitFrame = {
  /** Center of the painted face circle in source-image pixels. */
  cx: number;
  cy: number;
  /** Radius of the painted face circle in source-image pixels. */
  r: number;
};

export type PortraitOption = {
  /** Opaque stable ID — the value persisted on character.portraitUrl. */
  id: string;
  /** Asset path relative to the public/ directory. */
  src: string;
  /** Ancestries this portrait is a reasonable visual match for (sorting hint only). */
  suggestedAncestries: string[];
  /**
   * Locates the painted face circle in the 512×512 source so rendering can
   * crop just inside it. Older assets are loose sheet crops with off-center
   * circles; the July 2026 replacements (aasimar, genasi, goliath, human,
   * tiefling) have centered circles of varying radius. Portraits without a
   * frame render as a plain center-crop.
   */
  frame?: PortraitFrame;
};

/* ── Full catalog ───────────────────────────────────────────────────────── */

const BUILT_IN_PORTRAITS: readonly PortraitOption[] = [
  { id: "portrait-aasimar-01",    src: "/portraits/aasimar-male.png",    suggestedAncestries: ["aasimar"],          frame: { cx: 256, cy: 249, r: 203 } },
  { id: "portrait-aasimar-02",    src: "/portraits/aasimar-female.png",   suggestedAncestries: ["aasimar"],          frame: { cx: 256, cy: 249, r: 203 } },
  { id: "portrait-dwarf-01",      src: "/portraits/dwarf-male.png",       suggestedAncestries: ["dwarf"],            frame: { cx: 300, cy: 272, r: 190 } },
  { id: "portrait-dwarf-02",      src: "/portraits/dwarf-female.png",     suggestedAncestries: ["dwarf"],            frame: { cx: 240, cy: 265, r: 200 } },
  { id: "portrait-elf-01",        src: "/portraits/elf-male.png",         suggestedAncestries: ["elf", "half-elf"],  frame: { cx: 290, cy: 255, r: 215 } },
  { id: "portrait-elf-02",        src: "/portraits/elf-female.png",       suggestedAncestries: ["elf", "half-elf"],  frame: { cx: 232, cy: 252, r: 205 } },
  { id: "portrait-genasi-01",     src: "/portraits/genasi-male.png",      suggestedAncestries: ["genasi"],           frame: { cx: 256, cy: 249, r: 203 } },
  { id: "portrait-genasi-02",     src: "/portraits/genasi-female.png",    suggestedAncestries: ["genasi"],           frame: { cx: 257, cy: 252, r: 232 } },
  { id: "portrait-gnome-01",      src: "/portraits/gnome-male.png",       suggestedAncestries: ["gnome"],            frame: { cx: 310, cy: 290, r: 195 } },
  { id: "portrait-gnome-02",      src: "/portraits/gnome-female.png",     suggestedAncestries: ["gnome"],            frame: { cx: 235, cy: 265, r: 200 } },
  { id: "portrait-goliath-01",    src: "/portraits/goliath-male.png",     suggestedAncestries: ["goliath"],          frame: { cx: 256, cy: 249, r: 203 } },
  { id: "portrait-goliath-02",    src: "/portraits/goliath-female.png",   suggestedAncestries: ["goliath"],          frame: { cx: 256, cy: 249, r: 203 } },
  { id: "portrait-half-elf-01",   src: "/portraits/half-elf-male.png",    suggestedAncestries: ["half-elf", "elf"],  frame: { cx: 300, cy: 235, r: 212 } },
  { id: "portrait-half-elf-02",   src: "/portraits/half-elf-female.png",  suggestedAncestries: ["half-elf", "elf"],  frame: { cx: 232, cy: 242, r: 210 } },
  { id: "portrait-halfling-01",   src: "/portraits/halfling-male.png",    suggestedAncestries: ["halfling"],         frame: { cx: 300, cy: 255, r: 205 } },
  { id: "portrait-halfling-02",   src: "/portraits/halfling-female.png",  suggestedAncestries: ["halfling"],         frame: { cx: 230, cy: 240, r: 210 } },
  { id: "portrait-human-01",      src: "/portraits/human-male.png",       suggestedAncestries: ["human"],            frame: { cx: 256, cy: 254, r: 243 } },
  { id: "portrait-human-02",      src: "/portraits/human-female.png",     suggestedAncestries: ["human"],            frame: { cx: 256, cy: 254, r: 243 } },
  { id: "portrait-tiefling-01",   src: "/portraits/tiefling-male.png",    suggestedAncestries: ["tiefling"],         frame: { cx: 256, cy: 250, r: 205 } },
  { id: "portrait-tiefling-02",   src: "/portraits/tiefling-female.png",  suggestedAncestries: ["tiefling"],         frame: { cx: 256, cy: 249, r: 205 } },
] as const;

/** Built-in portraits plus assets created by `npm run portraits:sync`. */
export const PORTRAITS: readonly PortraitOption[] = [
  ...BUILT_IN_PORTRAITS,
  ...GENERATED_PORTRAITS,
];

/* ── Lookup helpers ────────────────────────────────────────────────────── */

export const PORTRAIT_BY_ID: ReadonlyMap<string, PortraitOption> = new Map(
  PORTRAITS.map((p) => [p.id, p]),
);

/** Ancestries present in the catalog, sorted alphabetically (internal use only). */
export const ANCESTRY_LIST: readonly string[] = [...new Set(PORTRAITS.flatMap((p) => p.suggestedAncestries))].sort();

/* ── Race-ID → ancestry mapping ────────────────────────────────────────── */

/**
 * Maps a ruleset raceId to the best-matching portrait ancestry.
 *
 * Handles:
 *  - 2024-style plain IDs   ("elf", "dwarf", "tiefling", …)
 *  - Legacy subrace IDs     ("high-elf-legacy", "hill-dwarf-legacy", …)
 *  - Special entries        ("variant-aasimar" → "aasimar")
 *
 * Returns `undefined` when no portrait ancestry matches (e.g. "dragonborn", "orc").
 */
const RACE_TO_ANCESTRY: ReadonlyMap<string, string> = new Map([
  // Direct matches (2024 species)
  ["aasimar",   "aasimar"],
  ["dwarf",     "dwarf"],
  ["elf",       "elf"],
  ["genasi",    "genasi"],
  ["gnome",     "gnome"],
  ["goliath",   "goliath"],
  ["halfling",  "halfling"],
  ["half-elf",  "half-elf"],
  ["human",     "human"],
  ["tiefling",  "tiefling"],

  // Legacy subraces — match compound names first
  ["hill-dwarf-legacy",       "dwarf"],
  ["mountain-dwarf-legacy",   "dwarf"],
  ["dwarf-legacy",           "dwarf"],

  ["high-elf-legacy",        "half-elf"],
  ["wood-elf-legacy",        "half-elf"],
  ["drow-legacy",            "half-elf"],
  ["half-elf-legacy",        "half-elf"],
  ["elf-legacy",             "half-elf"],

  ["lightfoot-halfling-legacy", "halfling"],
  ["stout-halfling-legacy",    "halfling"],
  ["halfling-legacy",          "halfling"],

  ["rock-gnome-legacy",       "gnome"],
  ["deep-gnome-legacy",       "gnome"],
  ["forest-gnome-legacy",      "gnome"],
  ["gnome-legacy",            "gnome"],

  ["air-genasi-legacy",       "genasi"],
  ["earth-genasi-legacy",     "genasi"],
  ["fire-genasi-legacy",      "genasi"],
  ["water-genasi-legacy",     "genasi"],
  ["genasi-legacy",          "genasi"],

  ["goliath-legacy",          "goliath"],

  // Special entries
  ["variant-aasimar",          "aasimar"],
  ["half-orc-legacy",         "human"],
  ["orc",                     "human"],
  ["human-legacy",            "human"],
  ["dragonborn",              "human"],
  ["dragonborn-legacy",       "human"],
  ["tiefling-legacy",         "tiefling"],
]);

export function suggestPortraitAncestry(raceId: string): string | undefined {
  // A drop-in portrait can add a species that previously used a fallback.
  // Prefer that exact species once it exists in the generated catalog.
  if (ANCESTRY_LIST.includes(raceId)) return raceId;
  return RACE_TO_ANCESTRY.get(raceId);
}

/** Resolve a portrait ID to its image src. Returns undefined for unknown IDs. */
export function resolvePortraitSrc(portraitId: string): string | undefined {
  return PORTRAIT_BY_ID.get(portraitId)?.src;
}

/* ── Framing ───────────────────────────────────────────────────────────── */

/** Source image dimensions (all catalog assets are square). */
export const PORTRAIT_IMG_SIZE = 512;
/** Crop slightly inside the painted circle so the sheet's dashed border never shows. */
export const PORTRAIT_FRAME_ZOOM = 1.05;

export type PortraitFrameCss = {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
};

/**
 * Background-image CSS that recenters a catalog portrait's face circle inside
 * a square element. Returns undefined for unknown IDs; unframed portraits get
 * a plain center-crop (equivalent to object-fit: cover).
 */
export function portraitFrameCss(portraitId: string): PortraitFrameCss | undefined {
  const portrait = PORTRAIT_BY_ID.get(portraitId);
  if (!portrait) return undefined;
  const base = { backgroundImage: `url("${portrait.src}")` };
  if (!portrait.frame) {
    return { ...base, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const { cx, cy, r } = portrait.frame;
  const cropR = r * PORTRAIT_FRAME_ZOOM;
  const size = (PORTRAIT_IMG_SIZE / (2 * cropR)) * 100;
  const px = ((cx - cropR) / (PORTRAIT_IMG_SIZE - 2 * cropR)) * 100;
  const py = ((cy - cropR) / (PORTRAIT_IMG_SIZE - 2 * cropR)) * 100;
  return {
    ...base,
    backgroundSize: `${size.toFixed(2)}%`,
    backgroundPosition: `${px.toFixed(2)}% ${py.toFixed(2)}%`,
  };
}

/**
 * Background-image CSS that fills a rectangular panel edge-to-edge with paint
 * from INSIDE the portrait's painted circle — the largest inscribed rectangle
 * of the given aspect ratio (panel width / height). Unlike portraitFrameCss
 * (a square crop of the whole circle), this never exposes the sheet around
 * the circle, at the cost of a deeper zoom into the face.
 *
 * Width-based background-size keeps the image undistorted; the position
 * mapping is exact when the element matches `aspect` and degrades gently
 * as the real aspect drifts (responsive layouts).
 */
export function portraitPanelCss(portraitId: string, aspect = 0.8): PortraitFrameCss | undefined {
  const portrait = PORTRAIT_BY_ID.get(portraitId);
  if (!portrait) return undefined;
  const base = { backgroundImage: `url("${portrait.src}")` };
  if (!portrait.frame) {
    return { ...base, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const { cx, cy, r } = portrait.frame;
  // The header is a wide rectangular crop. Give the face a little breathing
  // room so ears, hair, horns, and shoulders do not disappear at the panel
  // edges on the smaller responsive layouts.
  const cropH = Math.min(PORTRAIT_IMG_SIZE, (2 * r * 1.12) / Math.sqrt(aspect * aspect + 1));
  const cropW = aspect * cropH;
  const sizeX = (PORTRAIT_IMG_SIZE / cropW) * 100;
  const px = ((cx - cropW / 2) / (PORTRAIT_IMG_SIZE - cropW)) * 100;
  const py = ((cy - cropH / 2) / (PORTRAIT_IMG_SIZE - cropH)) * 100;
  return {
    ...base,
    backgroundSize: `${sizeX.toFixed(2)}%`,
    backgroundPosition: `${px.toFixed(2)}% ${py.toFixed(2)}%`,
  };
}

/** Check whether a portrait ID exists in the approved catalog. */
export function isCatalogPortrait(portraitId: string): boolean {
  return PORTRAIT_BY_ID.has(portraitId);
}
