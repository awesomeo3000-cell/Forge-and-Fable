/** Choices that are shared by the level-up and sheet feat managers. */
export const ELDRITCH_INVOCATIONS = [
  "agonizing-blast", "armor-of-shadows", "beast-speech", "beguiling-influence",
  "devils-sight", "eldritch-sight", "eyes-of-the-rune-keeper", "fiendish-vigor",
  "mask-of-many-faces", "misty-visions", "repelling-blast", "thief-of-five-fates",
] as const;

/** At-will or once-per-rest spells granted by the common 2014 invocations. */
export const INVOCATION_SPELLS: Record<string, string> = {
  "armor-of-shadows": "mage-armor",
  "beast-speech": "speak-with-animals",
  "eldritch-sight": "detect-magic",
  "fiendish-vigor": "false-life",
  "mask-of-many-faces": "disguise-self",
  "misty-visions": "silent-image",
  "thief-of-five-fates": "bane",
};

export function spellsGrantedByInvocations(invocations: string[]): string[] {
  return Array.from(new Set(invocations.flatMap((id) => INVOCATION_SPELLS[id] ? [INVOCATION_SPELLS[id]] : [])));
}
