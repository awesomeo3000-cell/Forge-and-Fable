import { abilityKeys, abilityNames } from "@/lib/utils";
import { SKILLS } from "@/lib/srd";

const isAbilityKey = (value: unknown): value is (typeof abilityKeys)[number] =>
  typeof value === "string" && (abilityKeys as readonly string[]).includes(value);

/** The advantage state a DM can attach to a roll request. */
export type RollRequestMode = "normal" | "advantage" | "disadvantage";

export type RollRequestPayload = {
  prompt?: unknown;
  kind?: unknown;
  keyType?: unknown;
  key?: unknown;
  dc?: unknown;
  advantage?: unknown;
};

/**
 * A plain-English name for what a requested roll actually is, derived from the
 * mechanical fields (kind + keyType + key) — independent of the DM's free-text
 * prompt. e.g. "Perception check", "Wisdom saving throw", "Initiative".
 */
export function rollRequestDescriptor(payload: RollRequestPayload): string {
  const kind = typeof payload.kind === "string" ? payload.kind : "check";
  const keyType = typeof payload.keyType === "string" ? payload.keyType : kind === "skill" ? "skill" : "ability";
  const key = typeof payload.key === "string" ? payload.key : "";

  if (kind === "initiative") return "Initiative";
  if (keyType === "skill" || kind === "skill") {
    const skill = SKILLS.find((item) => item.id === key);
    return skill ? `${skill.name} check` : "Skill check";
  }
  if (isAbilityKey(key)) {
    return kind === "save" ? `${abilityNames[key]} saving throw` : `${abilityNames[key]} check`;
  }
  return kind === "save" ? "Saving throw" : "Ability check";
}

/** Reads the (optional) advantage flag off a request payload. */
export function rollRequestMode(payload: RollRequestPayload): RollRequestMode {
  return payload.advantage === "advantage" || payload.advantage === "disadvantage" ? payload.advantage : "normal";
}

/**
 * A one-line summary for toasts and the record: descriptor, plus a DM prompt
 * (if any), plus advantage and a revealed DC. Kept compact.
 */
export function summarizeRollRequest(payload: RollRequestPayload): string {
  const descriptor = rollRequestDescriptor(payload);
  const prompt = typeof payload.prompt === "string" && payload.prompt.trim() ? payload.prompt.trim() : "";
  const mode = rollRequestMode(payload);
  const dc = typeof payload.dc === "number" && Number.isFinite(payload.dc) ? payload.dc : undefined;

  const parts = [prompt ? `${prompt} — ${descriptor}` : descriptor];
  if (mode !== "normal") parts.push(`with ${mode}`);
  if (dc !== undefined) parts.push(`DC ${dc}`);
  return parts.join(" · ");
}

/**
 * 5e RAW: advantage and disadvantage from any number of sources cancel to a
 * normal roll. Combine the DM's requested mode with the character's
 * effect-driven mode under that rule.
 */
export function combineRollModes(a: RollRequestMode, b: RollRequestMode): RollRequestMode {
  const hasAdv = a === "advantage" || b === "advantage";
  const hasDis = a === "disadvantage" || b === "disadvantage";
  if (hasAdv && hasDis) return "normal";
  if (hasAdv) return "advantage";
  if (hasDis) return "disadvantage";
  return "normal";
}
