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

/** The skin editor's baseline must match the current Observatory shell. */
export const DEFAULT_SKIN_THEME: CharacterTheme = {
  paper: "#152438",
  ink: "#e9eef4",
  accent: "#a84f49",
  fontKey: "tome",
  backgroundKey: "plain",
  backgroundOpacity: 0.5,
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
      accent: "#a0116d",
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
      accent: "#a78bfa",
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
      accent: "#345420",
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
      accent: "#6b4f1d",
      fontKey: "script",
      backgroundKey: "linen",
    },
  },
  {
    id: "infernal",
    name: "Infernal Pact",
    theme: { presetId: "infernal", paper: "#2a1517", ink: "#f0dcd2", accent: "#e2543a", fontKey: "blackletter", backgroundKey: "dungeon" },
  },
  {
    id: "feywild",
    name: "Feywild Court",
    theme: { presetId: "feywild", paper: "#f3e8fa", ink: "#3b2352", accent: "#b0219a", fontKey: "script", backgroundKey: "sparkle", backgroundOpacity: 0.35 },
  },
  {
    id: "oceanic",
    name: "Oceanic Depths",
    theme: { presetId: "oceanic", paper: "#e2eef0", ink: "#133344", accent: "#0e7490", fontKey: "storybook", backgroundKey: "linen" },
  },
  {
    id: "clockwork",
    name: "Clockwork Brass",
    theme: { presetId: "clockwork", paper: "#efe3cf", ink: "#3d2f1d", accent: "#935615", fontKey: "typewriter", backgroundKey: "plain" },
  },
  {
    id: "printer",
    name: "Printer Friendly",
    theme: { presetId: "printer", paper: "#ffffff", ink: "#111111",     accent: "#2d2d2d", fontKey: "tome", backgroundKey: "plain", backgroundOpacity: 0.1 },
  },
  {
    id: "divine",
    name: "Divine Oath",
    theme: { presetId: "divine", paper: "#faf8f2", ink: "#1a2536", accent: "#886b19", fontKey: "storybook", backgroundKey: "linen" },
  },
  {
    id: "cosmic",
    name: "Cosmic Void",
    theme: { presetId: "cosmic", paper: "#0d0f1a", ink: "#e2e8f0", accent: "#06b6d4", fontKey: "typewriter", backgroundKey: "stars" },
  },
  {
    id: "crypt",
    name: "Crimson Crypt",
    theme: { presetId: "crypt", paper: "#140c0e", ink: "#e4ded5", accent: "#e23f3f", fontKey: "blackletter", backgroundKey: "dungeon" },
  },
  {
    id: "tundra",
    name: "Frozen Tundra",
    theme: { presetId: "tundra", paper: "#eef6fa", ink: "#0f172a", accent: "#0674a6", fontKey: "typewriter", backgroundKey: "linen" },
  },
  {
    id: "monk",
    name: "Zen Monastery",
    theme: { presetId: "monk", paper: "#f4f5f0", ink: "#27272a", accent: "#0f766e", fontKey: "tome", backgroundKey: "plain" },
  },
  {
    id: "bard",
    name: "Bardic Stage",
    theme: { presetId: "bard", paper: "#fdf4ff", ink: "#581c87", accent: "#986803", fontKey: "script", backgroundKey: "sparkle", backgroundOpacity: 0.3 },
  },
  {
    id: "underdark",
    name: "Bioluminescent",
    theme: { presetId: "underdark", paper: "#18121e", ink: "#e9d5ff", accent: "#10b981", fontKey: "storybook", backgroundKey: "dungeon" },
  },
];

// ── User-saved presets (localStorage) ──

const USER_PRESETS_KEY = "forge-and-fable-skins";

export function loadUserPresets(userId: string): { id: string; name: string; theme: CharacterTheme }[] {
  try {
    const raw = localStorage.getItem(`${USER_PRESETS_KEY}-${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && typeof p.id === "string" && typeof p.name === "string" && p.theme && typeof p.theme === "object");
  } catch {
    return [];
  }
}

export function saveUserPreset(userId: string, name: string, theme: CharacterTheme): { id: string; name: string; theme: CharacterTheme }[] {
  const presets = loadUserPresets(userId);
  const entry = { id: crypto.randomUUID(), name: name.trim(), theme };
  if (presets.length >= 12) presets.shift(); // cap at 12, replace oldest
  presets.push(entry);
  localStorage.setItem(`${USER_PRESETS_KEY}-${userId}`, JSON.stringify(presets));
  return presets;
}

export function deleteUserPreset(userId: string, id: string): { id: string; name: string; theme: CharacterTheme }[] {
  const presets = loadUserPresets(userId).filter((p) => p.id !== id);
  localStorage.setItem(`${USER_PRESETS_KEY}-${userId}`, JSON.stringify(presets));
  return presets;
}

// ──── Skin share codes & untrusted-theme sanitizing ────

const SKIN_CODE_PREFIX = "FFSKIN1.";
const HEX_RE = /^#[0-9a-f]{6}$/;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Max stored URL length — the vault is a JSON file; keep themes small. */
export const MAX_BG_URL_LENGTH = 500;

export function isValidBackgroundImageUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url) && url.length <= MAX_BG_URL_LENGTH;
}

/**
 * Validate a theme from an UNTRUSTED source (share codes, storage).
 * Whitelists every field; returns null if the core fields are unusable.
 * presetId is intentionally dropped.
 */
export function sanitizeSkinTheme(raw: unknown): CharacterTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;

  const paper = typeof t.paper === "string" && HEX_RE.test(t.paper.toLowerCase()) ? t.paper.toLowerCase() : null;
  const ink = typeof t.ink === "string" && HEX_RE.test(t.ink.toLowerCase()) ? t.ink.toLowerCase() : null;
  const accent = typeof t.accent === "string" && HEX_RE.test(t.accent.toLowerCase()) ? t.accent.toLowerCase() : null;
  const fontKey = typeof t.fontKey === "string" && t.fontKey in FONT_STACKS ? (t.fontKey as ThemeFontKey) : null;
  const backgroundKey = typeof t.backgroundKey === "string" && t.backgroundKey in BACKGROUND_LABELS ? (t.backgroundKey as ThemeBackgroundKey) : null;
  if (!paper || !ink || !accent || !fontKey || !backgroundKey) return null;

  const theme: CharacterTheme = { paper, ink, accent, fontKey, backgroundKey };
  if (typeof t.backgroundOpacity === "number" && Number.isFinite(t.backgroundOpacity)) {
    theme.backgroundOpacity = clamp(t.backgroundOpacity, 0.1, 1);
  }
  if (typeof t.fontScale === "number" && Number.isFinite(t.fontScale)) {
    theme.fontScale = clamp(t.fontScale, 0.85, 1.25);
  }
  if (typeof t.backgroundImageUrl === "string" && isValidBackgroundImageUrl(t.backgroundImageUrl)) {
    theme.backgroundImageUrl = t.backgroundImageUrl;
  }
  return theme;
}

export function encodeSkinCode(theme: CharacterTheme): string {
  const { presetId, ...rest } = theme;
  void presetId;
  const json = JSON.stringify(rest);
  return SKIN_CODE_PREFIX + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}

/** Decode + sanitize a pasted skin code. Returns null on any problem. */
export function decodeSkinCode(code: string): CharacterTheme | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SKIN_CODE_PREFIX)) return null;
  try {
    const bytes = atob(trimmed.slice(SKIN_CODE_PREFIX.length));
    const json = new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
    return sanitizeSkinTheme(JSON.parse(json));
  } catch {
    return null;
  }
}
