import type { RulesetId } from "@/types/game";

export const DEFAULT_RULESET_ID: RulesetId = "2014";

/** Only approved production rulesets belong here. Research records are not runtime content. */
export const SUPPORTED_RULESET_IDS: readonly RulesetId[] = ["2014"];

export function isSupportedRuleset(value: unknown): value is RulesetId {
  return typeof value === "string" && SUPPORTED_RULESET_IDS.includes(value as RulesetId);
}

export function normalizeStoredRuleset(value: unknown): RulesetId {
  // Existing characters predate edition storage and are known to use the 2014 data.
  return value === "2024" ? "2024" : DEFAULT_RULESET_ID;
}
