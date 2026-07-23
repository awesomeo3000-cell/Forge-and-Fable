/**
 * Pure, dependency-free validators for the homebrew content contracts.
 *
 * Every validator accepts `unknown` and returns a flat list of
 * `{ path, message }` diagnostics (empty === valid). Paths use dotted/bracketed
 * field notation (e.g. `effects[0].value`) so the editor can jump to the field.
 *
 * These functions never throw on malformed input, never execute author strings,
 * and never mutate their arguments. They are the single source of truth for
 * "is this payload well-formed" across client editors and the server DAL.
 */
import type {
  ChoiceDefinition,
  ChoiceSource,
  EffectGate,
  HomebrewClassPayload,
  HomebrewFeatPayload,
  HomebrewItemPayload,
  HomebrewKind,
  HomebrewPayload,
  HomebrewProgressionLevel,
  HomebrewSpeciesPayload,
  HomebrewSpellcasting,
  HomebrewSubclassPayload,
  ItemStage,
  MechanicEffect,
  Prerequisite,
  PrerequisiteBlock,
  RulesContentRef,
} from "@/types/homebrew";

export type ValidationError = { path: string; message: string };

// ── Bounds and limits (proposal §6.3, §17) ────────────────────────────────
export const HOMEBREW_LIMITS = {
  titleChars: 120,
  descriptionChars: 20_000,
  creatorNotesChars: 10_000,
  payloadBytes: 256 * 1024,
  maxEffects: 100,
  maxToggles: 20,
  maxStages: 20,
  maxNestingDepth: 8,
  numericBonus: { min: -20, max: 20 },
  abilityFloor: { min: 1, max: 30 },
  spellLevel: { min: 1, max: 9 },
  spellSlotAmount: { min: 1, max: 20 },
  resourceMaximum: { min: 0, max: 999 },
  auraRadiusFeet: { min: 0, max: 1000 },
  freeUses: { min: 0, max: 99 },
  level: { min: 1, max: 20 },
} as const;

const ABILITY_KEYS = new Set([
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
]);

const RULESETS = new Set(["2014", "2024"]);
const HOMEBREW_KINDS = new Set<HomebrewKind>([
  "item",
  "class",
  "subclass",
  "species",
  "feat",
]);
const REF_KINDS = new Set([...HOMEBREW_KINDS, "spell"]);

const NUMERIC_BONUS_TARGETS = new Set([
  "ac",
  "saving-throws",
  "ability-checks",
  "initiative",
  "spell-attack",
  "spell-save-dc",
  "weapon-attack",
  "weapon-damage",
]);
const MECHANIC_SCOPES = new Set(["character", "source-item"]);
const STACKING_MODES = new Set(["stack", "same-source-nonstacking"]);
const RECHARGE_MODES = new Set(["short-rest", "long-rest", "dawn", "manual"]);
const SPELL_RECHARGE_MODES = new Set(["short-rest", "long-rest", "dawn"]);
const D20_APPLIES = new Set(["attack", "save", "check"]);
const AURA_RECIPIENTS = new Set(["self", "allies", "all-creatures"]);

/** e.g. `1d4`, `2d6`, `1d8+1`. Deliberately narrow: no arbitrary expressions. */
const DICE_PATTERN = /^\d{1,3}d\d{1,3}([+-]\d{1,3})?$/;

// ── Small type-guard helpers ───────────────────────────────────────────────
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isString(value: unknown): value is string {
  return typeof value === "string";
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}
function intInRange(value: unknown, min: number, max: number): value is number {
  return isInt(value) && value >= min && value <= max;
}

// ── Accumulator ─────────────────────────────────────────────────────────────
class Errors {
  readonly list: ValidationError[] = [];
  push(path: string, message: string): void {
    this.list.push({ path, message });
  }
  requireString(value: unknown, path: string, label = "must be a non-empty string"): boolean {
    if (!isNonEmptyString(value)) {
      this.push(path, label);
      return false;
    }
    return true;
  }
  requireBoolean(value: unknown, path: string): boolean {
    if (!isBoolean(value)) {
      this.push(path, "must be a boolean");
      return false;
    }
    return true;
  }
  requireArray(value: unknown, path: string): value is unknown[] {
    if (!Array.isArray(value)) {
      this.push(path, "must be an array");
      return false;
    }
    return true;
  }
  requireStringArray(value: unknown, path: string): void {
    if (!this.requireArray(value, path)) return;
    (value as unknown[]).forEach((entry, i) => {
      if (!isString(entry)) this.push(`${path}[${i}]`, "must be a string");
    });
  }
}

// ── Content refs (§4.1) ─────────────────────────────────────────────────────
function checkContentRef(e: Errors, ref: unknown, path: string): void {
  if (!isObject(ref)) {
    e.push(path, "must be a content reference object");
    return;
  }
  if (ref.source === "builtin") {
    if (!isString(ref.kind) || !REF_KINDS.has(ref.kind as string)) {
      e.push(`${path}.kind`, "must be a valid content kind or 'spell'");
    }
    e.requireString(ref.id, `${path}.id`);
    if (!RULESETS.has(ref.ruleset as string)) {
      e.push(`${path}.ruleset`, "must be '2014' or '2024'");
    }
    return;
  }
  if (ref.source === "homebrew") {
    if (!HOMEBREW_KINDS.has(ref.kind as HomebrewKind)) {
      e.push(`${path}.kind`, "must be a valid homebrew content kind");
    }
    e.requireString(ref.definitionId, `${path}.definitionId`);
    e.requireString(ref.versionId, `${path}.versionId`, "homebrew refs must pin an immutable versionId");
    if (!RULESETS.has(ref.ruleset as string)) {
      e.push(`${path}.ruleset`, "must be '2014' or '2024'");
    }
    return;
  }
  e.push(`${path}.source`, "must be 'builtin' or 'homebrew'");
}

export function validateContentRef(ref: unknown): ValidationError[] {
  const e = new Errors();
  checkContentRef(e, ref, "ref");
  return e.list;
}

// ── Prerequisites (§5) ──────────────────────────────────────────────────────
function checkPrerequisite(e: Errors, rule: unknown, path: string, depth: number): void {
  if (depth > HOMEBREW_LIMITS.maxNestingDepth) {
    e.push(path, `exceeds maximum nesting depth of ${HOMEBREW_LIMITS.maxNestingDepth}`);
    return;
  }
  if (!isObject(rule)) {
    e.push(path, "must be a prerequisite object");
    return;
  }
  switch (rule.op) {
    case "all":
    case "any":
      if (e.requireArray(rule.rules, `${path}.rules`)) {
        (rule.rules as unknown[]).forEach((sub, i) =>
          checkPrerequisite(e, sub, `${path}.rules[${i}]`, depth + 1),
        );
      }
      return;
    case "not":
      checkPrerequisite(e, rule.rule, `${path}.rule`, depth + 1);
      return;
    case "ability":
      if (!ABILITY_KEYS.has(rule.ability as string)) e.push(`${path}.ability`, "must be a valid ability");
      if (!isInt(rule.minimum)) e.push(`${path}.minimum`, "must be an integer");
      return;
    case "character-level":
      if (!intInRange(rule.minimum, 1, 20)) e.push(`${path}.minimum`, "must be an integer 1-20");
      return;
    case "class-level":
      checkContentRef(e, rule.classRef, `${path}.classRef`);
      if (!intInRange(rule.minimum, 1, 20)) e.push(`${path}.minimum`, "must be an integer 1-20");
      return;
    case "class":
      checkContentRef(e, rule.classRef, `${path}.classRef`);
      return;
    case "species":
      checkContentRef(e, rule.speciesRef, `${path}.speciesRef`);
      return;
    case "feat":
      checkContentRef(e, rule.featRef, `${path}.featRef`);
      return;
    case "spellcasting":
      if (!["any", "full", "partial", "pact"].includes(rule.mode as string)) {
        e.push(`${path}.mode`, "must be any|full|partial|pact");
      }
      return;
    case "proficiency":
      e.requireString(rule.category, `${path}.category`);
      e.requireString(rule.value, `${path}.value`);
      return;
    case "feature":
      e.requireString(rule.featureId, `${path}.featureId`);
      return;
    case "attunement":
      e.requireBoolean(rule.required, `${path}.required`);
      return;
    default:
      e.push(`${path}.op`, `unknown prerequisite op "${String(rule.op)}"`);
  }
}

export function validatePrerequisite(rule: unknown): ValidationError[] {
  const e = new Errors();
  checkPrerequisite(e, rule, "prerequisite", 0);
  return e.list;
}

function checkPrerequisiteBlock(e: Errors, block: unknown, path: string): void {
  if (block === undefined) return;
  if (!isObject(block)) {
    e.push(path, "must be a prerequisite block object");
    return;
  }
  if (block.rules !== undefined) checkPrerequisite(e, block.rules, `${path}.rules`, 0);
  if (block.displayText !== undefined && !isString(block.displayText)) {
    e.push(`${path}.displayText`, "must be a string");
  }
  if (block.manualApprovalText !== undefined && !isString(block.manualApprovalText)) {
    e.push(`${path}.manualApprovalText`, "must be a string");
  }
}

export function validatePrerequisiteBlock(block: unknown): ValidationError[] {
  const e = new Errors();
  checkPrerequisiteBlock(e, block, "prerequisites");
  return e.list;
}

// ── Effect gates (§6.2) ─────────────────────────────────────────────────────
type GateContext = { toggleIds: ReadonlySet<string>; stageIds: ReadonlySet<string> };
const EMPTY_GATE_CONTEXT: GateContext = { toggleIds: new Set(), stageIds: new Set() };

function checkGate(e: Errors, gate: unknown, path: string, ctx: GateContext, depth: number): void {
  if (depth > HOMEBREW_LIMITS.maxNestingDepth) {
    e.push(path, `exceeds maximum nesting depth of ${HOMEBREW_LIMITS.maxNestingDepth}`);
    return;
  }
  if (!isObject(gate)) {
    e.push(path, "must be an effect gate object");
    return;
  }
  switch (gate.type) {
    case "always":
    case "equipped":
    case "attuned":
      return;
    case "minimum-level":
      if (!intInRange(gate.level, 1, 20)) e.push(`${path}.level`, "must be an integer 1-20");
      return;
    case "toggle":
      if (!e.requireString(gate.toggleId, `${path}.toggleId`)) return;
      if (!ctx.toggleIds.has(gate.toggleId as string)) {
        e.push(`${path}.toggleId`, `references unknown toggle "${gate.toggleId}"`);
      }
      return;
    case "stage":
      if (!e.requireArray(gate.stageIds, `${path}.stageIds`)) return;
      (gate.stageIds as unknown[]).forEach((id, i) => {
        if (!isString(id)) {
          e.push(`${path}.stageIds[${i}]`, "must be a string");
        } else if (!ctx.stageIds.has(id)) {
          e.push(`${path}.stageIds[${i}]`, `references unknown stage "${id}"`);
        }
      });
      return;
    case "all":
    case "any":
      if (e.requireArray(gate.gates, `${path}.gates`)) {
        (gate.gates as unknown[]).forEach((sub, i) =>
          checkGate(e, sub, `${path}.gates[${i}]`, ctx, depth + 1),
        );
      }
      return;
    default:
      e.push(`${path}.type`, `unknown gate type "${String(gate.type)}"`);
  }
}

export function validateEffectGate(gate: unknown, ctx?: GateContext): ValidationError[] {
  const e = new Errors();
  checkGate(e, gate, "gate", ctx ?? EMPTY_GATE_CONTEXT, 0);
  return e.list;
}

// ── Mechanic effects (§6.3) ─────────────────────────────────────────────────
function checkEffect(
  e: Errors,
  effect: unknown,
  path: string,
  ctx: GateContext,
  depth: number,
  allowAura: boolean,
): void {
  if (depth > HOMEBREW_LIMITS.maxNestingDepth) {
    e.push(path, `exceeds maximum nesting depth of ${HOMEBREW_LIMITS.maxNestingDepth}`);
    return;
  }
  if (!isObject(effect)) {
    e.push(path, "must be a mechanic effect object");
    return;
  }
  e.requireString(effect.id, `${path}.id`);
  // Every effect carries a gate; validate it regardless of type.
  if (effect.type !== "aura" || allowAura) {
    checkGate(e, effect.gate, `${path}.gate`, ctx, 0);
  }

  const { numericBonus, abilityFloor, spellLevel, spellSlotAmount, resourceMaximum, auraRadiusFeet, freeUses } =
    HOMEBREW_LIMITS;

  switch (effect.type) {
    case "numeric-bonus":
      if (!NUMERIC_BONUS_TARGETS.has(effect.target as string)) {
        e.push(`${path}.target`, "invalid numeric-bonus target");
      }
      if (!intInRange(effect.value, numericBonus.min, numericBonus.max)) {
        e.push(`${path}.value`, `must be an integer ${numericBonus.min}..${numericBonus.max}`);
      }
      if (effect.scope !== undefined && !MECHANIC_SCOPES.has(effect.scope as string)) {
        e.push(`${path}.scope`, "must be 'character' or 'source-item'");
      }
      if (effect.stacking !== undefined && !STACKING_MODES.has(effect.stacking as string)) {
        e.push(`${path}.stacking`, "must be 'stack' or 'same-source-nonstacking'");
      }
      return;
    case "ability-floor":
      if (!ABILITY_KEYS.has(effect.ability as string)) e.push(`${path}.ability`, "must be a valid ability");
      if (!intInRange(effect.minimum, abilityFloor.min, abilityFloor.max)) {
        e.push(`${path}.minimum`, `must be an integer ${abilityFloor.min}..${abilityFloor.max}`);
      }
      return;
    case "condition":
      e.requireString(effect.conditionId, `${path}.conditionId`);
      e.requireString(effect.label, `${path}.label`);
      return;
    case "d20-rider":
      if (!isString(effect.dice) || !DICE_PATTERN.test(effect.dice)) {
        e.push(`${path}.dice`, "must be a dice string like '1d4' (no expressions)");
      }
      if (!e.requireArray(effect.appliesTo, `${path}.appliesTo`)) return;
      if ((effect.appliesTo as unknown[]).length === 0) {
        e.push(`${path}.appliesTo`, "must list at least one of attack|save|check");
      }
      (effect.appliesTo as unknown[]).forEach((v, i) => {
        if (!D20_APPLIES.has(v as string)) e.push(`${path}.appliesTo[${i}]`, "must be attack|save|check");
      });
      return;
    case "spell-slot-bonus":
      if (!intInRange(effect.spellLevel, spellLevel.min, spellLevel.max)) {
        e.push(`${path}.spellLevel`, `must be an integer ${spellLevel.min}..${spellLevel.max}`);
      }
      if (!intInRange(effect.amount, spellSlotAmount.min, spellSlotAmount.max)) {
        e.push(`${path}.amount`, `must be an integer ${spellSlotAmount.min}..${spellSlotAmount.max}`);
      }
      return;
    case "resource-grant":
      e.requireString(effect.resourceId, `${path}.resourceId`);
      if (!intInRange(effect.maximum, resourceMaximum.min, resourceMaximum.max)) {
        e.push(`${path}.maximum`, `must be an integer ${resourceMaximum.min}..${resourceMaximum.max}`);
      }
      if (!RECHARGE_MODES.has(effect.recharge as string)) {
        e.push(`${path}.recharge`, "must be short-rest|long-rest|dawn|manual");
      }
      return;
    case "spell-grant":
      checkContentRef(e, effect.spellRef, `${path}.spellRef`);
      if (effect.freeUses !== undefined && !intInRange(effect.freeUses, freeUses.min, freeUses.max)) {
        e.push(`${path}.freeUses`, `must be an integer ${freeUses.min}..${freeUses.max}`);
      }
      if (effect.recharge !== undefined && !SPELL_RECHARGE_MODES.has(effect.recharge as string)) {
        e.push(`${path}.recharge`, "must be short-rest|long-rest|dawn");
      }
      return;
    case "sense":
      e.requireString(effect.text, `${path}.text`);
      return;
    case "aura":
      if (!allowAura) {
        e.push(`${path}.type`, "aura effects cannot be nested inside another aura");
        return;
      }
      if (!intInRange(effect.radiusFeet, auraRadiusFeet.min, auraRadiusFeet.max)) {
        e.push(`${path}.radiusFeet`, `must be an integer ${auraRadiusFeet.min}..${auraRadiusFeet.max}`);
      }
      if (!AURA_RECIPIENTS.has(effect.recipient as string)) {
        e.push(`${path}.recipient`, "must be self|allies|all-creatures");
      }
      if (e.requireArray(effect.effects, `${path}.effects`)) {
        (effect.effects as unknown[]).forEach((sub, i) =>
          checkEffect(e, sub, `${path}.effects[${i}]`, ctx, depth + 1, false),
        );
      }
      return;
    default:
      e.push(`${path}.type`, `unknown effect type "${String(effect.type)}"`);
  }
}

/** Validate a list of effects: structure, ranges, unique ids, and count cap. */
function checkEffectList(e: Errors, effects: unknown, path: string, ctx: GateContext): void {
  if (!e.requireArray(effects, path)) return;
  const arr = effects as unknown[];
  if (arr.length > HOMEBREW_LIMITS.maxEffects) {
    e.push(path, `exceeds maximum of ${HOMEBREW_LIMITS.maxEffects} effects`);
  }
  const seen = new Set<string>();
  arr.forEach((effect, i) => {
    checkEffect(e, effect, `${path}[${i}]`, ctx, 0, true);
    const id = isObject(effect) ? effect.id : undefined;
    if (isString(id)) {
      if (seen.has(id)) e.push(`${path}[${i}].id`, `duplicate effect id "${id}"`);
      seen.add(id);
    }
  });
}

export function validateMechanicEffect(effect: unknown, ctx?: GateContext): ValidationError[] {
  const e = new Errors();
  checkEffect(e, effect, "effect", ctx ?? EMPTY_GATE_CONTEXT, 0, true);
  return e.list;
}

// ── Shared authoring building blocks ────────────────────────────────────────
function checkChoiceSource(e: Errors, source: unknown, path: string): void {
  if (!isObject(source)) {
    e.push(path, "must be a choice source object");
    return;
  }
  switch (source.type) {
    case "skills":
    case "tools":
    case "languages":
      if (source.options !== undefined) e.requireStringArray(source.options, `${path}.options`);
      return;
    case "list":
      e.requireStringArray(source.options, `${path}.options`);
      return;
    case "feat":
      return;
    case "spell":
      if (source.spellRefs !== undefined && e.requireArray(source.spellRefs, `${path}.spellRefs`)) {
        (source.spellRefs as unknown[]).forEach((ref, i) =>
          checkContentRef(e, ref, `${path}.spellRefs[${i}]`),
        );
      }
      return;
    default:
      e.push(`${path}.type`, `unknown choice source "${String((source as ChoiceSource).type)}"`);
  }
}

function checkChoice(e: Errors, choice: unknown, path: string): void {
  if (!isObject(choice)) {
    e.push(path, "must be a choice definition object");
    return;
  }
  e.requireString(choice.id, `${path}.id`);
  e.requireString(choice.label, `${path}.label`);
  if (!intInRange(choice.count, 1, 20)) e.push(`${path}.count`, "must be an integer 1-20");
  checkChoiceSource(e, choice.from, `${path}.from`);
  if (choice.distinct !== undefined && !isBoolean(choice.distinct)) {
    e.push(`${path}.distinct`, "must be a boolean");
  }
}

function checkChoiceList(e: Errors, value: unknown, path: string): void {
  if (value === undefined) return;
  if (!e.requireArray(value, path)) return;
  const seen = new Set<string>();
  (value as unknown[]).forEach((choice, i) => {
    checkChoice(e, choice, `${path}[${i}]`);
    const id = isObject(choice) ? choice.id : undefined;
    if (isString(id)) {
      if (seen.has(id)) e.push(`${path}[${i}].id`, `duplicate choice id "${id}"`);
      seen.add(id);
    }
  });
}

function checkProgressionLevel(e: Errors, level: unknown, path: string, expectedLevel: number): void {
  if (!isObject(level)) {
    e.push(path, "must be a progression level object");
    return;
  }
  if (level.level !== expectedLevel) {
    e.push(`${path}.level`, `level field (${String(level.level)}) must equal its key (${expectedLevel})`);
  }
  if (level.proficiencyBonus !== undefined && !intInRange(level.proficiencyBonus, 2, 9)) {
    e.push(`${path}.proficiencyBonus`, "must be an integer 2-9");
  }
  if (level.features !== undefined) {
    if (e.requireArray(level.features, `${path}.features`)) {
      (level.features as unknown[]).forEach((f, i) => {
        const fp = `${path}.features[${i}]`;
        if (!isObject(f)) {
          e.push(fp, "must be a feature grant object");
          return;
        }
        e.requireString(f.id, `${fp}.id`);
        e.requireString(f.name, `${fp}.name`);
        if (!isString(f.description)) e.push(`${fp}.description`, "must be a string");
      });
    }
  }
  checkChoiceList(e, level.choices, `${path}.choices`);
  if (level.effects !== undefined) checkEffectList(e, level.effects, `${path}.effects`, EMPTY_GATE_CONTEXT);
  if (level.resources !== undefined && e.requireArray(level.resources, `${path}.resources`)) {
    (level.resources as unknown[]).forEach((r, i) => {
      const rp = `${path}.resources[${i}]`;
      if (!isObject(r)) {
        e.push(rp, "must be a resource grant object");
        return;
      }
      e.requireString(r.resourceId, `${rp}.resourceId`);
      if (!intInRange(r.maximum, HOMEBREW_LIMITS.resourceMaximum.min, HOMEBREW_LIMITS.resourceMaximum.max)) {
        e.push(`${rp}.maximum`, "resource maximum out of range");
      }
      if (!RECHARGE_MODES.has(r.recharge as string)) e.push(`${rp}.recharge`, "invalid recharge");
    });
  }
}

function checkLevelMap(e: Errors, levels: unknown, path: string, requireAll20: boolean): void {
  if (!isObject(levels)) {
    e.push(path, "must be a level map keyed by 1-20");
    return;
  }
  const present = new Set<number>();
  for (const key of Object.keys(levels)) {
    const n = Number(key);
    if (!Number.isInteger(n) || n < HOMEBREW_LIMITS.level.min || n > HOMEBREW_LIMITS.level.max) {
      e.push(`${path}.${key}`, "level keys must be integers 1-20");
      continue;
    }
    present.add(n);
    checkProgressionLevel(e, (levels as Record<string, unknown>)[key], `${path}.${key}`, n);
  }
  if (requireAll20) {
    for (let lvl = 1; lvl <= 20; lvl++) {
      if (!present.has(lvl)) e.push(`${path}.${lvl}`, "class progression must define all levels 1-20");
    }
  }
}

// ── Spellcasting (§8.3) ─────────────────────────────────────────────────────
const CASTER_MODES = new Set(["none", "full", "half", "third", "pact", "custom"]);
const PREPARATIONS = new Set(["none", "known", "prepared", "spellbook"]);

function checkSpellcasting(e: Errors, sc: unknown, path: string): void {
  if (!isObject(sc)) {
    e.push(path, "must be a spellcasting object");
    return;
  }
  if (!CASTER_MODES.has(sc.mode as string)) e.push(`${path}.mode`, "invalid caster mode");
  if (sc.ability !== undefined && !ABILITY_KEYS.has(sc.ability as string)) {
    e.push(`${path}.ability`, "must be a valid ability");
  }
  if (!PREPARATIONS.has(sc.preparation as string)) e.push(`${path}.preparation`, "invalid preparation");
  if (!isObject(sc.spellList)) {
    e.push(`${path}.spellList`, "must be a spell list object");
  } else if (sc.spellList.type === "class-list") {
    e.requireStringArray(sc.spellList.classIds, `${path}.spellList.classIds`);
  } else if (sc.spellList.type === "explicit") {
    e.requireStringArray(sc.spellList.spellIds, `${path}.spellList.spellIds`);
  } else {
    e.push(`${path}.spellList.type`, "must be 'class-list' or 'explicit'");
  }
  // Custom slot tables require all 20 rows (proposal §8.3).
  if (sc.mode === "custom") {
    if (!isObject(sc.spellSlotsByLevel) && !isObject(sc.pactSlotsByLevel)) {
      e.push(`${path}.spellSlotsByLevel`, "custom casters must define slot tables for all 20 levels");
    } else if (isObject(sc.spellSlotsByLevel)) {
      for (let lvl = 1; lvl <= 20; lvl++) {
        if (!Array.isArray((sc.spellSlotsByLevel as Record<string, unknown>)[String(lvl)])) {
          e.push(`${path}.spellSlotsByLevel.${lvl}`, "custom slot table requires all 20 level rows");
        }
      }
    }
  }
}

// ── Payload validators ──────────────────────────────────────────────────────
function checkTextLimits(e: Errors, payload: Record<string, unknown>): void {
  if (isString(payload.name) && payload.name.length > HOMEBREW_LIMITS.titleChars) {
    e.push("name", `must be at most ${HOMEBREW_LIMITS.titleChars} characters`);
  }
  if (isString(payload.description) && payload.description.length > HOMEBREW_LIMITS.descriptionChars) {
    e.push("description", `must be at most ${HOMEBREW_LIMITS.descriptionChars} characters`);
  }
  if (isString(payload.creatorNotes) && payload.creatorNotes.length > HOMEBREW_LIMITS.creatorNotesChars) {
    e.push("creatorNotes", `must be at most ${HOMEBREW_LIMITS.creatorNotesChars} characters`);
  }
}

function checkItemPayload(e: Errors, p: Record<string, unknown>): void {
  e.requireString(p.name, "name");
  if (!isString(p.description)) e.push("description", "must be a string");
  e.requireString(p.category, "category");
  e.requireString(p.rarity, "rarity");
  e.requireBoolean(p.requiresAttunement, "requiresAttunement");
  if (p.baseWeight !== undefined && (typeof p.baseWeight !== "number" || p.baseWeight < 0)) {
    e.push("baseWeight", "must be a non-negative number");
  }
  e.requireStringArray(p.equipmentSlots, "equipmentSlots");
  checkPrerequisiteBlock(e, p.attunementPrerequisites, "attunementPrerequisites");

  // Toggles and stages first — their ids form the gate context for effects.
  const toggleIds = new Set<string>();
  if (e.requireArray(p.toggles, "toggles")) {
    const toggles = p.toggles as unknown[];
    if (toggles.length > HOMEBREW_LIMITS.maxToggles) e.push("toggles", `exceeds ${HOMEBREW_LIMITS.maxToggles} toggles`);
    toggles.forEach((t, i) => {
      const tp = `toggles[${i}]`;
      if (!isObject(t)) {
        e.push(tp, "must be a toggle object");
        return;
      }
      if (e.requireString(t.id, `${tp}.id`) && isString(t.id)) {
        if (toggleIds.has(t.id)) e.push(`${tp}.id`, `duplicate toggle id "${t.id}"`);
        toggleIds.add(t.id);
      }
      e.requireString(t.label, `${tp}.label`);
      e.requireBoolean(t.defaultOn, `${tp}.defaultOn`);
    });
  }

  const stageIds = new Set<string>();
  if (e.requireArray(p.stages, "stages")) {
    const stages = p.stages as unknown[];
    if (stages.length > HOMEBREW_LIMITS.maxStages) e.push("stages", `exceeds ${HOMEBREW_LIMITS.maxStages} stages`);
    stages.forEach((s) => {
      const id = isObject(s) ? (s as ItemStage).id : undefined;
      if (isString(id)) stageIds.add(id);
    });
  }

  const ctx: GateContext = { toggleIds, stageIds };
  checkEffectList(e, p.effects, "effects", ctx);

  if (Array.isArray(p.stages)) {
    const seenStage = new Set<string>();
    (p.stages as unknown[]).forEach((s, i) => {
      const sp = `stages[${i}]`;
      if (!isObject(s)) {
        e.push(sp, "must be a stage object");
        return;
      }
      if (e.requireString(s.id, `${sp}.id`) && isString(s.id)) {
        if (seenStage.has(s.id)) e.push(`${sp}.id`, `duplicate stage id "${s.id}"`);
        seenStage.add(s.id);
      }
      e.requireString(s.name, `${sp}.name`);
      if (!isInt(s.order)) e.push(`${sp}.order`, "must be an integer");
      if (!isString(s.description)) e.push(`${sp}.description`, "must be a string");
      if (!isObject(s.activation)) {
        e.push(`${sp}.activation`, "must be an activation object");
      } else if (s.activation.type === "counter") {
        e.requireString(s.activation.counterId, `${sp}.activation.counterId`);
        if (!isInt(s.activation.minimum)) e.push(`${sp}.activation.minimum`, "must be an integer");
      } else if (s.activation.type === "milestone") {
        e.requireString(s.activation.label, `${sp}.activation.label`);
      } else if (s.activation.type !== "manual") {
        e.push(`${sp}.activation.type`, "must be manual|counter|milestone");
      }
      checkEffectList(e, s.effects, `${sp}.effects`, ctx);
    });
  }
}

function checkClassPayload(e: Errors, p: Record<string, unknown>): void {
  e.requireString(p.name, "name");
  if (!isString(p.summary)) e.push("summary", "must be a string");
  if (!isInt(p.hitDie) || ![4, 6, 8, 10, 12].includes(p.hitDie as number)) {
    e.push("hitDie", "must be a die size: 4, 6, 8, 10, or 12");
  }
  e.requireArray(p.primaryAbilities, "primaryAbilities");
  if (Array.isArray(p.primaryAbilities)) {
    (p.primaryAbilities as unknown[]).forEach((a, i) => {
      if (!ABILITY_KEYS.has(a as string)) e.push(`primaryAbilities[${i}]`, "must be a valid ability");
    });
  }
  if (Array.isArray(p.savingThrowProficiencies)) {
    (p.savingThrowProficiencies as unknown[]).forEach((a, i) => {
      if (!ABILITY_KEYS.has(a as string)) e.push(`savingThrowProficiencies[${i}]`, "must be a valid ability");
    });
  } else {
    e.push("savingThrowProficiencies", "must be an array of abilities");
  }
  e.requireStringArray(p.armorTraining, "armorTraining");
  e.requireStringArray(p.weaponProficiencies, "weaponProficiencies");
  e.requireStringArray(p.multiclassProficiencyGrants, "multiclassProficiencyGrants");
  checkChoiceList(e, p.toolChoices, "toolChoices");
  checkChoiceList(e, p.skillChoices, "skillChoices");
  checkChoiceList(e, p.startingEquipment, "startingEquipment");
  checkPrerequisiteBlock(e, p.multiclassPrerequisites, "multiclassPrerequisites");
  checkSpellcasting(e, p.spellcasting, "spellcasting");
  checkLevelMap(e, p.levels, "levels", true);
  if (!Array.isArray(p.subclassSelectionLevels)) {
    e.push("subclassSelectionLevels", "must be an array of levels");
  } else {
    (p.subclassSelectionLevels as unknown[]).forEach((lvl, i) => {
      if (!intInRange(lvl, 1, 20)) e.push(`subclassSelectionLevels[${i}]`, "must be an integer 1-20");
    });
  }
  if (p.allowedSubclassRefs !== undefined && e.requireArray(p.allowedSubclassRefs, "allowedSubclassRefs")) {
    (p.allowedSubclassRefs as unknown[]).forEach((ref, i) =>
      checkContentRef(e, ref, `allowedSubclassRefs[${i}]`),
    );
  }
}

function checkSubclassPayload(e: Errors, p: Record<string, unknown>): void {
  e.requireString(p.name, "name");
  if (!isString(p.summary)) e.push("summary", "must be a string");
  checkContentRef(e, p.parentClassRef, "parentClassRef");
  checkPrerequisiteBlock(e, p.prerequisites, "prerequisites");
  checkLevelMap(e, p.levels, "levels", false);
}

function checkSpeciesPayload(e: Errors, p: Record<string, unknown>): void {
  e.requireString(p.name, "name");
  if (!isString(p.summary)) e.push("summary", "must be a string");
  e.requireString(p.creatureType, "creatureType");
  e.requireStringArray(p.sizes, "sizes");
  e.requireString(p.speed, "speed");
  checkPrerequisiteBlock(e, p.prerequisites, "prerequisites");
  if (!isObject(p.abilityScoreMode)) {
    e.push("abilityScoreMode", "must be an ability-score-mode object");
  } else if (p.abilityScoreMode.type === "fixed") {
    if (!isObject(p.abilityScoreMode.bonuses)) {
      e.push("abilityScoreMode.bonuses", "must be an object of ability bonuses");
    } else {
      for (const [k, v] of Object.entries(p.abilityScoreMode.bonuses)) {
        if (!ABILITY_KEYS.has(k)) e.push(`abilityScoreMode.bonuses.${k}`, "unknown ability");
        if (!isInt(v)) e.push(`abilityScoreMode.bonuses.${k}`, "must be an integer");
      }
    }
  } else if (p.abilityScoreMode.type === "choice") {
    if (!["plus-two-plus-one", "three-plus-one"].includes(p.abilityScoreMode.pattern as string)) {
      e.push("abilityScoreMode.pattern", "must be plus-two-plus-one|three-plus-one");
    }
  } else {
    e.push("abilityScoreMode.type", "must be 'fixed' or 'choice'");
  }
  checkChoiceList(e, p.languages, "languages");
  checkChoiceList(e, p.proficiencies, "proficiencies");
  checkLevelMap(e, p.levels, "levels", false);
}

function checkFeatPayload(e: Errors, p: Record<string, unknown>): void {
  e.requireString(p.name, "name");
  if (!isString(p.description)) e.push("description", "must be a string");
  if (p.category !== undefined && !isString(p.category)) e.push("category", "must be a string");
  checkPrerequisiteBlock(e, p.prerequisites, "prerequisites");
  if (!isObject(p.repeatability)) {
    e.push("repeatability", "must be a repeatability object");
  } else {
    const r = p.repeatability;
    if (r.mode === "once") {
      // no extra fields
    } else if (r.mode === "unlimited") {
      if (r.requiresDistinctChoices !== undefined && !isBoolean(r.requiresDistinctChoices)) {
        e.push("repeatability.requiresDistinctChoices", "must be a boolean");
      }
    } else if (r.mode === "limited") {
      if (!intInRange(r.maximum, 1, 99)) e.push("repeatability.maximum", "must be an integer 1-99");
      if (r.requiresDistinctChoices !== undefined && !isBoolean(r.requiresDistinctChoices)) {
        e.push("repeatability.requiresDistinctChoices", "must be a boolean");
      }
    } else {
      e.push("repeatability.mode", "must be once|unlimited|limited");
    }
  }
  checkChoiceList(e, p.choices, "choices");
  checkEffectList(e, p.effects, "effects", EMPTY_GATE_CONTEXT);
  if (p.spellGrants !== undefined && e.requireArray(p.spellGrants, "spellGrants")) {
    (p.spellGrants as unknown[]).forEach((g, i) => {
      const gp = `spellGrants[${i}]`;
      if (!isObject(g)) {
        e.push(gp, "must be a spell grant object");
        return;
      }
      e.requireString(g.id, `${gp}.id`);
      checkContentRef(e, g.spellRef, `${gp}.spellRef`);
      if (g.freeUses !== undefined && !intInRange(g.freeUses, 0, 99)) {
        e.push(`${gp}.freeUses`, "must be an integer 0-99");
      }
      if (g.recharge !== undefined && !SPELL_RECHARGE_MODES.has(g.recharge as string)) {
        e.push(`${gp}.recharge`, "must be short-rest|long-rest|dawn");
      }
    });
  }
}

const PAYLOAD_CHECKERS: Record<HomebrewKind, (e: Errors, p: Record<string, unknown>) => void> = {
  item: checkItemPayload,
  class: checkClassPayload,
  subclass: checkSubclassPayload,
  species: checkSpeciesPayload,
  feat: checkFeatPayload,
};

/** Validate any homebrew payload. Dispatches on `kind` and enforces the shared
 *  text-length and total-JSON-size budgets. */
export function validateHomebrewPayload(payload: unknown): ValidationError[] {
  const e = new Errors();
  if (!isObject(payload)) {
    e.push("payload", "must be an object");
    return e.list;
  }
  const kind = payload.kind;
  if (!HOMEBREW_KINDS.has(kind as HomebrewKind)) {
    e.push("kind", `must be one of item|class|subclass|species|feat`);
    return e.list;
  }
  checkTextLimits(e, payload);
  // Total payload size budget (proposal §17).
  try {
    const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
    if (bytes > HOMEBREW_LIMITS.payloadBytes) {
      e.push("payload", `exceeds ${HOMEBREW_LIMITS.payloadBytes}-byte size budget`);
    }
  } catch {
    e.push("payload", "must be JSON-serializable");
  }
  PAYLOAD_CHECKERS[kind as HomebrewKind](e, payload);
  return e.list;
}

// Kind-specific convenience wrappers (typed inputs for call sites that already
// know the kind). Each still validates defensively.
export const validateItemPayload = (p: unknown): ValidationError[] =>
  validateKind(p, "item") as ValidationError[];
export const validateClassPayload = (p: unknown): ValidationError[] =>
  validateKind(p, "class") as ValidationError[];
export const validateSubclassPayload = (p: unknown): ValidationError[] =>
  validateKind(p, "subclass") as ValidationError[];
export const validateSpeciesPayload = (p: unknown): ValidationError[] =>
  validateKind(p, "species") as ValidationError[];
export const validateFeatPayload = (p: unknown): ValidationError[] =>
  validateKind(p, "feat") as ValidationError[];

function validateKind(payload: unknown, expected: HomebrewKind): ValidationError[] {
  const e = new Errors();
  if (!isObject(payload)) {
    e.push("payload", "must be an object");
    return e.list;
  }
  if (payload.kind !== expected) {
    e.push("kind", `must be "${expected}"`);
    return e.list;
  }
  return validateHomebrewPayload(payload);
}

export function isValidHomebrewPayload(payload: unknown): payload is HomebrewPayload {
  return validateHomebrewPayload(payload).length === 0;
}

// Re-export the payload types most call sites need alongside the validators.
export type {
  ChoiceDefinition,
  EffectGate,
  HomebrewClassPayload,
  HomebrewFeatPayload,
  HomebrewItemPayload,
  HomebrewProgressionLevel,
  HomebrewSpeciesPayload,
  HomebrewSpellcasting,
  HomebrewSubclassPayload,
  ItemStage,
  MechanicEffect,
  Prerequisite,
  PrerequisiteBlock,
  RulesContentRef,
};
