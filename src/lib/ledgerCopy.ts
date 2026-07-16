/**
 * R18 "The Ledger" copy deck — the single home for the ledger register.
 * Strings here are used verbatim per docs/ai-project-proposal-18.md §2;
 * do not scatter copies across components.
 */

/** Italic one-liners beside each class name (Chapter II, roster, anywhere a class needs a descriptor). */
export const CLASS_DESCRIPTORS: Record<string, string> = {
  artificer: "invention, tinkering, and impossible machines",
  barbarian: "fury as a way of life",
  bard: "wit, song, and a dangerous charm",
  cleric: "a god's will, made manifest",
  druid: "the wild, wearing a human face",
  fighter: "steel, discipline, and the front line",
  monk: "the body, perfected into a weapon",
  paladin: "an oath heavier than the armor",
  ranger: "the hunt, the trail, the far horizon",
  rogue: "shadows, locks, and a knife you never saw",
  sorcerer: "magic in the blood, straining to get out",
  warlock: "power borrowed at a price",
  wizard: "ink-stained hands and borrowed fire",
};

export function classDescriptor(classId: string | null | undefined): string {
  if (!classId) return "";
  return CLASS_DESCRIPTORS[classId] ?? "";
}

/** Build-mode descriptors for the start panel (§2). */
export const BUILD_MODE_DESCRIPTORS: Record<string, string> = {
  standard: "the full commission, chapter by chapter",
  quickbuilder: "guided choices for a faster start",
  premade: "archetypes awaiting a name",
};

/** Builder chapters — same order and length as the existing `steps` array in CreatorPanel.
    `intro` is the chapter-banner sentence from the Arcane Storybook art handoff mockup;
    `subtitle` remains the short ledger fragment used elsewhere. */
export const CHAPTERS: Array<{
  numeral: string;
  name: string;
  subtitle: string;
  intro: string;
  action: string;
}> = [
  { numeral: "I", name: "Provenance", subtitle: "a name, and where the record may draw from", intro: "Begin the commission by naming the hero and setting the rules that shape their story.", action: "Record the name" },
  { numeral: "II", name: "The Likeness", subtitle: "no labels, no filters — pick the face that feels right", intro: "Choose the face that feels right, or bring your own portrait into the story.", action: "Fix the likeness" },
  { numeral: "III", name: "Vocation", subtitle: "every legend begins with a calling — choose the class that shapes this hero's path", intro: "Every legend begins with a calling. Choose the class that shapes this hero's path.", action: "Seal the vocation" },
  { numeral: "IV", name: "Origin", subtitle: "who were they, before the road?", intro: "Piece together the history, skills and experiences that brought this hero here.", action: "Record the origin" },
  { numeral: "V", name: "Lineage", subtitle: "blood, and what it carries", intro: "Choose the ancestry, heritage and traits that shape the hero's place in the world.", action: "Seal the lineage" },
  { numeral: "VI", name: "Attributes", subtitle: "the measure of body and mind", intro: "Measure the hero's strengths and refine the numbers behind the legend.", action: "Fix the attributes" },
  { numeral: "VII", name: "The Seal", subtitle: "read it back, then press the seal", intro: "Review the completed commission and send this hero into the world.", action: "Press the seal" },
];

/**
 * Origin tone families — backgrounds are color-coded like classes, but into a
 * small set of muted ink tones (one per walk of life) rather than one hue per
 * background. The tone id maps to a --class-a override in globals.css
 * ([data-origin-tone="…"]), so the ledger dot machinery works unchanged.
 */
export const ORIGIN_TONES: Record<string, string> = {
  Acolyte: "lore",
  Sage: "lore",
  Hermit: "lore",
  "Custom Background": "lore",
  Charlatan: "shadow",
  Criminal: "shadow",
  Urchin: "shadow",
  Spy: "shadow",
  "Folk Hero": "wilds",
  Outlander: "wilds",
  Farmer: "wilds",
  Guide: "wilds",
  Soldier: "war",
  Gladiator: "war",
  Mercenary: "war",
  "Guild Artisan": "trade",
  Merchant: "trade",
  Artisan: "trade",
  Sailor: "sea",
  Fisher: "sea",
  Pirate: "sea",
  Noble: "court",
  Entertainer: "court",
  Courtier: "court",
};

const TONE_IDS = ["lore", "shadow", "wilds", "war", "trade", "sea", "court"];

/** Tone for any background — explicit mapping first, stable hash fallback for homebrew. */
export function originTone(background: string | null | undefined): string {
  if (!background) return "lore";
  const explicit = ORIGIN_TONES[background];
  if (explicit) return explicit;
  let hash = 0;
  for (let i = 0; i < background.length; i++) hash = (hash * 31 + background.charCodeAt(i)) | 0;
  return TONE_IDS[Math.abs(hash) % TONE_IDS.length];
}

const SPELLED_COUNTS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Roster count marginalia: "one soul recorded" / "four souls recorded" / "12 souls recorded". */
export function soulsRecorded(n: number): string {
  if (n <= 0) return "no souls recorded";
  const count = n < 10 ? SPELLED_COUNTS[n] : String(n);
  return n === 1 ? `${count} soul recorded` : `${count} souls recorded`;
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 21 → "21st"… */
export function ordinalLevel(n: number): string {
  const v = Math.trunc(n);
  const mod100 = Math.abs(v) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (Math.abs(v) % 10) {
    case 1: return `${v}st`;
    case 2: return `${v}nd`;
    case 3: return `${v}rd`;
    default: return `${v}th`;
  }
}

/** First sentence of a blurb, truncated for ledger rows (~60 chars, ellipsized on a word boundary). */
export function firstSentence(text: string, max = 60): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  const period = trimmed.search(/[.!?](\s|$)/);
  let sentence = period >= 0 ? trimmed.slice(0, period) : trimmed;
  if (sentence.length > max) {
    sentence = sentence.slice(0, max + 1);
    const lastSpace = sentence.lastIndexOf(" ");
    sentence = (lastSpace > 20 ? sentence.slice(0, lastSpace) : sentence.slice(0, max)).replace(/[,;:\s]+$/, "") + "…";
  }
  return sentence;
}
