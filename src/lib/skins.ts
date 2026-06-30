import type { CharacterTheme, ThemeFontKey, ThemeBackgroundKey } from "@/types/game";

export const FONT_STACKS: Record<ThemeFontKey, string> = {
  tome:        "var(--font-newsreader), Georgia, serif",
  storybook:   "var(--font-fraunces), Georgia, serif",
  bubble:      "var(--font-baloo), system-ui, sans-serif",
  script:      "var(--font-dancing), cursive",
  blackletter: "var(--font-unifraktur), serif",
  typewriter:  "var(--font-space-mono), ui-monospace, monospace",
};

export const FONT_LABELS: Record<ThemeFontKey, string> = {
  tome: "Tome Serif",
  storybook: "Storybook",
  bubble: "Bubble Rounded",
  script: "Handwriting",
  blackletter: "Blackletter",
  typewriter: "Typewriter",
};

export const BACKGROUND_LABELS: Record<ThemeBackgroundKey, string> = {
  parchment: "Parchment",
  plain: "Plain",
  linen: "Linen",
  stars: "Starry",
  sparkle: "Sparkle",
  forest: "Forest",
  dungeon: "Dungeon",
};

export const SKIN_PRESETS: { id: string; name: string; theme: CharacterTheme }[] = [
  {
    id: "tome",
    name: "Classic Tome",
    theme: {
      presetId: "tome",
      paper: "#ece1c9",
      ink: "#241c12",
      accent: "#a23f29",
      fontKey: "tome",
      backgroundKey: "parchment",
    },
  },
  {
    id: "ellewoods",
    name: "Legally Blonde",
    theme: {
      presetId: "ellewoods",
      paper: "#fbdcec",
      ink: "#5a1f3d",
      accent: "#e0319d",
      fontKey: "bubble",
      backgroundKey: "sparkle",
      backgroundOpacity: 0.4,
    },
  },
  {
    id: "necro",
    name: "Necromancer",
    theme: {
      presetId: "necro",
      paper: "#1c2230",
      ink: "#d7e0ea",
      accent: "#7c5cff",
      fontKey: "blackletter",
      backgroundKey: "dungeon",
    },
  },
  {
    id: "ranger",
    name: "Ranger's Field",
    theme: {
      presetId: "ranger",
      paper: "#e9e6cf",
      ink: "#23301d",
      accent: "#4f7d33",
      fontKey: "storybook",
      backgroundKey: "forest",
    },
  },
  {
    id: "scroll",
    name: "Royal Scroll",
    theme: {
      presetId: "scroll",
      paper: "#f3e9cf",
      ink: "#2a2140",
      accent: "#9c7a2f",
      fontKey: "script",
      backgroundKey: "linen",
    },
  },
];
