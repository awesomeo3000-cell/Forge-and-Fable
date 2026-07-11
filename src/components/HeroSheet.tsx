"use client";

import {
  Activity,
  BookOpen,
  ChevronDown,
  GripHorizontal,
  Minus,
  Paintbrush,
  PenLine,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  Swords,
  Terminal,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import type { AbilityKey, AbilityScores, CatalogItem, Character, CharacterPage, Equipment, InventoryItem, PageBlock, RollMode, Ruleset, SheetLayout, SheetSectionId, SpellStatus } from "@/types/game";
import {
  abilityKeys,
  abilityLabels,
  abilityModifier,
  proficiencyBonus,
  signed,
} from "@/lib/utils";
import { SAVE_PROFICIENCIES, SKILLS, BACKGROUND_SKILLS, type SkillDef } from "@/lib/srd";
import { FONT_STACKS, SKIN_PRESETS, loadUserPresets } from "@/lib/skins";
import { DEFAULT_LAYOUT, mergeWithDefaults, PINNED_BOTTOM, PINNED_TOP, SECTION_TITLES } from "@/lib/sheetLayout";
import { getSpell, isWizardSpellbook, learnsIndividualSpells, parseDamageDice, PREPARED_CASTERS, SPELLS_LEARNED_PER_LEVEL, spellsForClass } from "@/lib/spells";
import { resolveSpellEffects, previewDiceForLevel, parseSimpleDice, getScalingNote } from "@/lib/spellEffects";
import { ARMORS, WEAPONS, carryCapacity, computeArmorClass, getArmorProficiencyIssue, getWeapon, inventoryArmorProficiencyInfo, inventoryWeaponToDef, isArmorCategoryProficient, isShieldProficient, preparedSpellLimit, totalCarriedWeight, weaponAbility, type WeaponDef } from "@/lib/equipment";
import { ITEM_CATALOG, ITEM_CATEGORIES, ITEM_RARITIES, catalogItemToInventory, getEquippedItemBonuses, isArmorItem, isShieldItem, isWeaponItem, itemHasPassiveBonus, itemMetaParts } from "@/lib/itemCatalog";
import { maxSlots } from "@/lib/spellSlots";
import { activeD20Riders, describeEffect, effectTotal, D20_DICE_RE, EFFECT_NUMERIC_FIELDS, EFFECT_PRESETS } from "@/lib/effects";
import { revertHpLevel } from "@/lib/hitPoints";
import { passiveSkillScore } from "@/lib/derivedStats";
import type { CharacterEffect } from "@/types/game";
import { getClassData, subclassFeaturesForLevel, subclassesForClass } from "@/lib/subclasses";
import type { SpellData, SpellSlots } from "@/types/game";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import AppearancePanel from "@/components/AppearancePanel";
import SheetSection from "@/components/SheetSection";

const LevelUpModal = dynamic(() => import("@/components/LevelUpModal"), { ssr: false });

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

type RefTab = "features" | "traits" | "spells" | "spellbook" | "inventory";
type SkinMenuPosition = { top: number; left: number; minWidth: number; maxHeight: number };
type RollOutcome = { rolls: number[]; modifier: number; total: number };
type RollD20Options = { forcedMode?: RollMode };

const REF_TABS: { id: RefTab; label: string }[] = [
  { id: "features", label: "Features" },
  { id: "traits", label: "Traits" },
  { id: "spells", label: "Spells" },
  { id: "spellbook", label: "Spellbook" },
  { id: "inventory", label: "Inventory" },
];
const TOUR_STORAGE_KEY = "forge-and-fable-tour-dismissed";

function armorProficienciesFromFeatures(features: { name: string; description: string }[]) {
  const proficiencies = new Set<string>();
  for (const feature of features) {
    const text = `${feature.name} ${feature.description}`.toLowerCase();
    if (!text.includes("proficien")) continue;
    if (/\ball armor\b/.test(text)) proficiencies.add("All armor");
    if (/\blight armor\b/.test(text)) proficiencies.add("Light armor");
    if (/\bmedium armor\b/.test(text)) proficiencies.add("Medium armor");
    if (/\bheavy armor\b/.test(text)) proficiencies.add("Heavy armor");
    if (/\bshields?\b/.test(text)) proficiencies.add("Shields");
  }
  return [...proficiencies];
}

export default memo(function HeroSheet(props: {
  character: Character;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  featInitiativeBonus?: number;
  featAcBonus?: number;
  onRoll: (label: string, sides: number, count?: number, modifier?: number, onResult?: (outcome: RollOutcome) => void) => void;
  onRollPool?: (groups: { sides: number; count: number }[], modifier: number, label: string) => void;
  onRollD20?: (label: string, modifier: number, riders: { sides: number; count: number }[], options?: RollD20Options) => void;
  onUpdate: (patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) => void;
  onDelete: () => void;
  onNotify?: (message: string) => void;
  consoleInput: string;
  consoleLog: string[];
  onConsoleInput: (value: string) => void;
  onConsoleSubmit: (event: FormEvent) => void;
  readOnly?: boolean;
}) {
  const isReadOnly = props.readOnly === true;

  const race =
    props.ruleset.races.find((r) => r.id === props.character.raceId) ?? props.ruleset.races[0];
  const heroClass =
    props.ruleset.classes.find((c) => c.id === props.character.classId) ?? props.ruleset.classes[0];
  const subclassFeatures = props.character.subclassId
    ? subclassFeaturesForLevel(heroClass.id, props.character.subclassId, props.character.level)
    : [];
  const effectiveProficiencies = Array.from(new Set([...heroClass.proficiencies, ...armorProficienciesFromFeatures(subclassFeatures)]));

  const pb = proficiencyBonus(props.character.level);
  const dexMod = abilityModifier(props.finalAbilities.dexterity);
  const equipment = props.character.equipment ?? {};
  const equipmentItemBonuses = getEquippedItemBonuses(props.character.inventory, equipment, { includeAc: false });

  const effectsList = props.character.effects ?? [];
  const activeEffects = effectsList.filter((e) => e.active);
  const effAc = effectTotal(effectsList, "ac");
  const effAttack = effectTotal(effectsList, "attack");
  const effDamage = effectTotal(effectsList, "damage");
  const effSaves = effectTotal(effectsList, "saves");
  const effChecks = effectTotal(effectsList, "checks");
  const effInit = effectTotal(effectsList, "initiative");
  const d20Riders = activeD20Riders(effectsList);
  // Rider dice (e.g. Bless's 1d4) fly with every d20 roll while active.
  const rollD20 = (label: string, modifier: number, options?: RollD20Options) => {
    if (props.onRollD20) {
      // Honors the armed advantage/disadvantage mode; rider dice (Bless, etc.) fly along.
      props.onRollD20(label, modifier, d20Riders, options);
    } else if (d20Riders.length > 0 && props.onRollPool) {
      props.onRollPool([{ sides: 20, count: 1 }, ...d20Riders], modifier, label);
    } else {
      props.onRoll(label, 20, 1, modifier);
    }
  };

  const ruleAc = props.character.customRules.filter((r) => r.type === "ac").reduce((s, r) => s + r.value, 0);
  const acInfo = computeArmorClass(props.finalAbilities, heroClass.id, equipment, props.character.inventory);
  const armorProficiencyIssue = getArmorProficiencyIssue(effectiveProficiencies, equipment, props.character.inventory);
  const armorPenaltyReason = armorProficiencyIssue.hasIssue ? `Not proficient with ${armorProficiencyIssue.labels.join(" or ")}` : "";
  const d20OptionsForAbility = (ability?: AbilityKey): RollD20Options | undefined =>
    armorProficiencyIssue.strengthDexterityDisadvantage && (ability === "strength" || ability === "dexterity")
      ? { forcedMode: "disadvantage" }
      : undefined;
  const rollD20ForAbility = (label: string, modifier: number, ability?: AbilityKey) => rollD20(label, modifier, d20OptionsForAbility(ability));
  const armorClass = acInfo.total + ruleAc + (props.featAcBonus ?? 0) + effAc;
  const currency = props.character.currency ?? { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const carriedWeight = totalCarriedWeight(props.character.inventory, equipment, currency, props.character.settings.ignoreCoinWeight);
  const capacity = carryCapacity(props.finalAbilities.strength, props.character.settings.encumbranceType);
  const ruleInit = props.character.customRules.filter((r) => r.type === "initiative").reduce((s, r) => s + r.value, 0);
  const initiative = dexMod + ruleInit + (props.featInitiativeBonus ?? 0) + effInit;
  const ruleAttack = props.character.customRules.filter((r) => r.type === "attack").reduce((s, r) => s + r.value, 0) + effAttack;
  const ruleSaveAll = props.character.customRules.filter((r) => r.type === "save").reduce((s, r) => s + r.value, 0);
  const saveAllBonus = ruleSaveAll + equipmentItemBonuses.saves + effSaves;

  const proficientSaves: AbilityKey[] =
    props.character.savingThrowProficiencies ?? SAVE_PROFICIENCIES[heroClass.id]?.abilities ?? [];

  const isSaveProficient = (key: AbilityKey) => proficientSaves.includes(key);

  const backgroundSkillIds: string[] = BACKGROUND_SKILLS[props.character.background] ?? [];
  const characterSkillIds = props.character.skillProficiencies ?? [];
  const expertiseIds: string[] = props.character.skillExpertise ?? [];
  const isBackgroundSkill = (id: string) => backgroundSkillIds.includes(id);
  const isCharacterSkill = (id: string) => characterSkillIds.includes(id);
  const isSkillProficient = (id: string) =>
    characterSkillIds.includes(id) || isBackgroundSkill(id);
  const isSkillExpert = (id: string) => isSkillProficient(id) && expertiseIds.includes(id);

  const skillProficiencySources = (id: string) => {
    const sources: string[] = [];
    if (isBackgroundSkill(id)) sources.push("BG");
    if (isCharacterSkill(id)) sources.push("PROF");
    if (isSkillExpert(id)) sources.push("EXP");
    return sources;
  };

  const featuresUpToLevel = heroClass.levelProgression.filter((e) => e.level <= props.character.level).flatMap((e) => e.features);
  const hasJackOfAllTrades = featuresUpToLevel.some((f) => f.name === "Jack of All Trades");
  const halfPb = hasJackOfAllTrades ? Math.max(1, Math.floor(pb / 2)) : 0;

  const saveBonus = (key: AbilityKey) => abilityModifier(props.finalAbilities[key]) + (isSaveProficient(key) ? pb : 0) + saveAllBonus;
  const skillBonus = (s: SkillDef) => {
    const mod = abilityModifier(props.finalAbilities[s.ability]);
    const prof = isSkillProficient(s.id);
    const expert = isSkillExpert(s.id);
    const joaT = hasJackOfAllTrades && !prof ? halfPb : 0;
    return mod + (expert ? pb * 2 : prof ? pb : 0) + joaT + effChecks;
  };
  const skillBonusForPassive = (s: SkillDef) => {
    const prof = isSkillProficient(s.id);
    const expert = isSkillExpert(s.id);
    return passiveSkillScore({
      abilityScore: props.finalAbilities[s.ability],
      proficiencyBonus: pb,
      proficient: prof,
      expertise: expert,
      jackOfAllTrades: hasJackOfAllTrades && !prof,
    });
  };

  const passiveInsight = skillBonusForPassive(SKILLS.find((s) => s.id === "insight")!);
  const passiveInvestigation = skillBonusForPassive(SKILLS.find((s) => s.id === "investigation")!);
  const passivePerception = skillBonusForPassive(SKILLS.find((s) => s.id === "perception")!);

  const hpPercent = Math.max(0, Math.min(100, (props.character.currentHp / props.character.maxHp) * 100));
  const casterType = heroClass.casterType ?? "none";
  const spellcastingBlockedByArmor = casterType !== "none" && armorProficiencyIssue.spellcastingBlocked;
  const spellBlockTitle = spellcastingBlockedByArmor ? `${armorPenaltyReason}: cannot cast spells.` : undefined;
  const spellAbility = heroClass.spellcastingAbility;
  const classSpellList = spellsForClass(heroClass.id);
  const canManageSpellbook = isWizardSpellbook(heroClass.id) && classSpellList.length > 0;
  // Prepared casters (cleric/druid/paladin/artificer) have their WHOLE class
  // list available up to their accessible spell level — not a learned subset.
  // Everyone else shows the spells they actually know. (Cantrips stay chosen.)
  const _isPrepared = PREPARED_CASTERS.has(heroClass.id) && casterType !== "none";
  const _maxSpellLvl = maxSlots(casterType, props.character.level, heroClass.id).reduce((m, c, i) => (c > 0 ? i + 1 : m), 0);
  const knownSpells: SpellData[] = _isPrepared
    ? heroClass.id === "wizard"
      ? (props.character.spellsKnown.map((id) => getSpell(id)).filter(Boolean) as SpellData[])
      : [
          ...(props.character.spellsKnown.map((id) => getSpell(id)).filter((s): s is SpellData => !!s && s.level === 0)),
          ...classSpellList.filter((s) => s.level >= 1 && s.level <= _maxSpellLvl),
        ]
    : (props.character.spellsKnown.map((id) => getSpell(id)).filter(Boolean) as SpellData[]);
  const spellbookChoices = canManageSpellbook
    ? classSpellList
        .filter((spell) => spell.level === 0 || spell.level <= _maxSpellLvl)
        .filter((spell) => !props.character.spellsKnown.includes(spell.id))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    : [];
  // Cumulative max of leveled (non-cantrip) spells a known caster can know at their current level.
  const knownSpellsCumulativeMax = useMemo(() => {
    const table = SPELLS_LEARNED_PER_LEVEL[heroClass.id];
    if (!table) return 0;
    let total = 0;
    for (let i = 1; i <= props.character.level && i < table.length; i++) {
      total += table[i];
    }
    return total;
  }, [heroClass.id, props.character.level]);
  // Non-wizard known casters (Bard, Ranger, Sorcerer, Warlock) who learn individual spells.
  const isKnownCasterNotWizard = !canManageSpellbook && learnsIndividualSpells(heroClass.id, casterType);
  const spellsByLevel = knownSpells.reduce((acc, spell) => { const lv = spell.level; if (!acc[lv]) acc[lv] = []; acc[lv].push(spell); return acc; }, {} as Record<number, SpellData[]>);
  const availableSubclasses = subclassesForClass(heroClass.id);
  const [levelUpTarget, setLevelUpTarget] = useState<number | null>(null);
  const [tourDismissed, setTourDismissed] = useState(true);

  const toggleSkillProficiency = (skillId: string) => {
    if (isBackgroundSkill(skillId)) return; // background-granted — cannot toggle
    const cur = props.character.skillProficiencies ?? [];
    props.onUpdate({ skillProficiencies: cur.includes(skillId) ? cur.filter((s) => s !== skillId) : [...cur, skillId] });
  };

  /** Right-click cycles: proficient → expert → remove proficiency. Background skills cannot be cycled off. */
  const cycleSkillExpertise = (skillId: string) => {
    if (isBackgroundSkill(skillId)) {
      // Background skill: toggle expertise only
      if (isSkillExpert(skillId)) {
        props.onUpdate({ skillExpertise: (props.character.skillExpertise ?? []).filter((s) => s !== skillId) });
      } else {
        props.onUpdate({ skillExpertise: [...(props.character.skillExpertise ?? []), skillId] });
      }
      return;
    }
    if (isSkillExpert(skillId)) {
      // Expert → remove proficiency entirely
      props.onUpdate({
        skillProficiencies: (props.character.skillProficiencies ?? []).filter((s) => s !== skillId),
        skillExpertise: (props.character.skillExpertise ?? []).filter((s) => s !== skillId),
      });
    } else if (isSkillProficient(skillId)) {
      // Proficient → add expertise
      props.onUpdate({ skillExpertise: [...(props.character.skillExpertise ?? []), skillId] });
    }
  };

  useEffect(() => {
    setTourDismissed(window.localStorage.getItem(TOUR_STORAGE_KEY) === "true");
  }, []);

  const dismissTour = () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setTourDismissed(true);
  };
  const toggleSaveProficiency = (key: AbilityKey) => {
    const cur = props.character.savingThrowProficiencies ?? proficientSaves;
    props.onUpdate({ savingThrowProficiencies: cur.includes(key) ? cur.filter((s) => s !== key) : [...cur, key] });
  };
  const toggleDeathSave = (type: "successes" | "failures") => {
    const ds = props.character.deathSaves ?? { successes: 0, failures: 0 };
    const v = ds[type] >= 3 ? 0 : ds[type] + 1;
    props.onUpdate({ deathSaves: { ...ds, [type]: v } });
  };
  const resetDeathSaves = () => props.onUpdate({ deathSaves: { successes: 0, failures: 0 } });

  /* ── Effects & conditions ── */
  const toggleEffect = (id: string) =>
    props.onUpdate({ effects: effectsList.map((e) => (e.id === id ? { ...e, active: !e.active } : e)) });
  const removeEffect = (id: string) =>
    props.onUpdate({ effects: effectsList.filter((e) => e.id !== id) });
  const setEffectStack = (id: string, stack: number) =>
    props.onUpdate({ effects: effectsList.map((e) => (e.id === id ? { ...e, stack: Math.max(1, Math.min(6, stack)) } : e)) });
  const addPresetEffect = (index: number) => {
    const preset = EFFECT_PRESETS[index];
    if (!preset) return;
    props.onUpdate({ effects: [...effectsList, { ...preset, id: crypto.randomUUID(), active: true }] });
  };
  const [showEffectForm, setShowEffectForm] = useState(false);
  const [effForm, setEffForm] = useState<Record<string, string>>({});
  const [effFormError, setEffFormError] = useState<string | null>(null);
  const [showAcBreakdown, setShowAcBreakdown] = useState(false);
  const addCustomEffect = () => {
    const label = (effForm.label ?? "").trim();
    if (!label) { setEffFormError("Name the effect."); return; }
    const dice = (effForm.d20Dice ?? "").trim();
    if (dice && !D20_DICE_RE.test(dice)) { setEffFormError('Dice must look like "1d4".'); return; }
    const entry: CharacterEffect = { id: crypto.randomUUID(), label, active: true };
    for (const field of EFFECT_NUMERIC_FIELDS) {
      const raw = (effForm[field.key] ?? "").trim();
      if (raw === "") continue;
      const n = Math.max(-20, Math.min(20, parseInt(raw, 10)));
      if (Number.isFinite(n) && n !== 0) entry[field.key] = n;
    }
    if (dice) entry.d20Dice = dice;
    const sense = (effForm.sense ?? "").trim();
    if (sense) entry.sense = sense.slice(0, 48);
    props.onUpdate({ effects: [...effectsList, entry] });
    setEffForm({});
    setShowEffectForm(false);
    setEffFormError(null);
  };
  const acBreakdown: { label: string; value: number }[] = [
    { label: acInfo.label, value: acInfo.total },
    ...props.character.customRules.filter((r) => r.type === "ac").map((r) => ({ label: r.label, value: r.value })),
    ...((props.featAcBonus ?? 0) !== 0 ? [{ label: "Feats", value: props.featAcBonus ?? 0 }] : []),
    ...activeEffects.filter((e) => e.ac).map((e) => ({ label: e.label, value: e.ac ?? 0 })),
  ];

  const updateEquipment = (patch: Partial<Equipment>) =>
    props.onUpdate({ equipment: { ...equipment, ...patch } });
  const toggleWeapon = (id: string) => {
    const cur = equipment.weaponIds ?? [];
    updateEquipment({ weaponIds: cur.includes(id) ? cur.filter((w) => w !== id) : [...cur, id] });
  };
  const toggleInventoryWeapon = (id: string) => {
    const cur = equipment.weaponItemIds ?? [];
    updateEquipment({ weaponItemIds: cur.includes(id) ? cur.filter((w) => w !== id) : [...cur, id] });
  };
  const toggleBonusItem = (id: string) => {
    const cur = equipment.bonusItemIds ?? [];
    updateEquipment({ bonusItemIds: cur.includes(id) ? cur.filter((w) => w !== id) : [...cur, id] });
  };
  const equipInventoryArmor = (item: InventoryItem) => {
    updateEquipment({
      armorItemId: equipment.armorItemId === item.id ? undefined : item.id,
      armorId: undefined,
    });
  };
  const equipInventoryShield = (item: InventoryItem) => {
    updateEquipment({
      shieldItemId: equipment.shieldItemId === item.id ? undefined : item.id,
      shield: false,
    });
  };
  const cleanEquipmentForRemovedItem = (id: string): Equipment => {
    const next: Equipment = { ...equipment };
    if (next.armorItemId === id) next.armorItemId = undefined;
    if (next.shieldItemId === id) next.shieldItemId = undefined;
    if (next.weaponItemIds?.includes(id)) next.weaponItemIds = next.weaponItemIds.filter((itemId) => itemId !== id);
    if (next.bonusItemIds?.includes(id)) next.bonusItemIds = next.bonusItemIds.filter((itemId) => itemId !== id);
    return next;
  };

  const addItem = () => {
    if (!invName.trim()) return;
    const parsedWeight = Number(invWeight);
    const item = {
      id: crypto.randomUUID(),
      name: invName.trim(),
      rarity: invRarity,
      attunement: false,
      notes: invNotes.trim(),
      weight: invWeight && Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : undefined,
    };
    props.onUpdate({ inventory: [...props.character.inventory, item] });
    setInvName("");
    setInvNotes("");
    setInvWeight("");
    setShowInvForm(false);
  };
  const addCatalogItem = (catalogItem: CatalogItem) => {
    props.onUpdate({ inventory: [...props.character.inventory, catalogItemToInventory(catalogItem)] });
  };
  const removeItem = (id: string) => {
    props.onUpdate({
      inventory: props.character.inventory.filter((item) => item.id !== id),
      equipment: cleanEquipmentForRemovedItem(id),
    });
  };

  const skillsByAbility = abilityKeys.map((k) => ({ ability: k, skills: SKILLS.filter((s) => s.ability === k) }));

  const subtitleParts = [race.name, heroClass.name, props.character.level > 0 ? `Level ${props.character.level}` : null, props.character.background, props.character.alignment].filter(Boolean);

  /* ── Reference tabs ── */
  const hasSpellTab = (casterType !== "none" && Boolean(spellAbility) && (knownSpells.length > 0 || spellbookChoices.length > 0))
    // Non-casters can still hold feat-granted spells (Fey/Shadow Touched) —
    // show the tab so those spells and their free-use casting are reachable.
    || (casterType === "none" && knownSpells.length > 0);
  const visibleTabs = useMemo(() => REF_TABS.filter((t) => {
    if (t.id === "spells") return hasSpellTab;
    if (t.id === "spellbook") return canManageSpellbook;
    return true;
  }), [canManageSpellbook, hasSpellTab]);
  const [refTab, setRefTab] = useState<RefTab>(visibleTabs[0]?.id ?? "features");
  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === refTab)) {
      setRefTab(visibleTabs[0]?.id ?? "features");
    }
  }, [refTab, visibleTabs]);
  const handleRefTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let nxt = i;
    if (e.key === "ArrowRight") nxt = (i + 1) % visibleTabs.length;
    else if (e.key === "ArrowLeft") nxt = (i - 1 + visibleTabs.length) % visibleTabs.length;
    else if (e.key === "Home") nxt = 0;
    else if (e.key === "End") nxt = visibleTabs.length - 1;
    else return;
    e.preventDefault();
    setRefTab(visibleTabs[nxt].id);
  };

  /* ── Theme ── */
  const [showPresets, setShowPresets] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const skinButtonRef = useRef<HTMLButtonElement | null>(null);
  const skinMenuRef = useRef<HTMLDivElement | null>(null);
  const [skinMenuPosition, setSkinMenuPosition] = useState<SkinMenuPosition | null>(null);
  const theme = props.character.theme;
  const themeVars = theme ? ({
    "--paper": theme.paper, "--paper-raised": `color-mix(in srgb, ${theme.paper} 94%, #000)`,
    "--ink": theme.ink, "--ink-2": `color-mix(in srgb, ${theme.ink} 65%, ${theme.paper})`,
    "--ink-3": `color-mix(in srgb, ${theme.ink} 45%, ${theme.paper})`,
    "--doc-accent": theme.accent, "--doc-accent-deep": `color-mix(in srgb, ${theme.accent} 82%, #000)`,
    "--doc-select": theme.accent, "--doc-rule": `color-mix(in srgb, ${theme.ink} 40%, ${theme.paper})`,
    // Theme the body + display faces only. Labels (small caps) and the console's
    // mono stay on their defaults — theming those flattened the sheet's type
    // system and made decorative fonts (blackletter, script) unreadable at 0.65em.
    "--sheet-font": FONT_STACKS[theme.fontKey],
    "--font-body": FONT_STACKS[theme.fontKey], "--font-display": FONT_STACKS[theme.fontKey],
    "--bg-opacity": `${theme.backgroundOpacity ?? 0.5}`,
    "--sheet-scale": `${theme.fontScale ?? 1}`,
    ...(theme.backgroundImageUrl
      ? { "--skin-bg-image": `url("${theme.backgroundImageUrl.replace(/["\\)]/g, "")}")` }
      : {}),
  } as Record<string, string>) : {};
  const applyPreset = (id: string) => {
    // Check built-ins first, then user presets
    const builtin = SKIN_PRESETS.find((x) => x.id === id);
    if (builtin) { props.onUpdate({ theme: { ...builtin.theme } }); setShowPresets(false); return; }
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("forge-and-fable-user");
        if (raw) {
          const u = JSON.parse(raw) as { id?: string };
          if (u.id) {
            const userPresets = loadUserPresets(u.id);
            const user = userPresets.find((x) => x.id === id);
            if (user) { props.onUpdate({ theme: { ...user.theme } }); setShowPresets(false); return; }
          }
        }
      } catch { /* ignore */ }
    }
    setShowPresets(false);
  };
  const updateSkinMenuPosition = useCallback(() => {
    const button = skinButtonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gutter = 12;
    const minWidth = Math.max(180, rect.width);
    const maxLeft = Math.max(gutter, window.innerWidth - minWidth - gutter);
    const top = Math.min(rect.bottom + 6, window.innerHeight - gutter);

    setSkinMenuPosition({
      top,
      left: Math.min(Math.max(gutter, rect.right - minWidth), maxLeft),
      minWidth,
      maxHeight: Math.max(140, window.innerHeight - top - gutter),
    });
  }, []);

  useEffect(() => {
    if (!showPresets) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (skinButtonRef.current?.contains(target) || skinMenuRef.current?.contains(target)) return;
      setShowPresets(false);
    };

    window.addEventListener("resize", updateSkinMenuPosition);
    window.addEventListener("scroll", updateSkinMenuPosition, true);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", updateSkinMenuPosition);
      window.removeEventListener("scroll", updateSkinMenuPosition, true);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showPresets, updateSkinMenuPosition]);
  const toggleSkinMenu = () => {
    if (!showPresets) updateSkinMenuPosition();
    setShowPresets((open) => !open);
  };

  /* ── Layout ── */
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Layout lives in local state so drag/collapse update the UI instantly.
  // It re-syncs from props whenever the saved value changes AND we're not
  // mid-drag — done during render (React's recommended pattern) rather than
  // in an effect, so there's no extra commit/flash.
  const propLayout = useMemo(
    () => mergeWithDefaults(props.character.sheetLayout),
    [props.character.sheetLayout],
  );
  const [layout, setLayout] = useState(propLayout);
  const [syncedFrom, setSyncedFrom] = useState(propLayout);
  if (propLayout !== syncedFrom && !activeId) {
    setSyncedFrom(propLayout);
    setLayout(propLayout);
  }

  const collapsed = layout.collapsed;

  /* ── Spell slots & detail ── */
  const [spellDetail, setSpellDetail] = useState<SpellData | null>(null);
  const [spellSearch, setSpellSearch] = useState("");
  const [spellbookSearch, setSpellbookSearch] = useState("");
  const [spellbookSort, setSpellbookSort] = useState<"level" | "name">("level");
  const [spellToLearn, setSpellToLearn] = useState("");
  // Search-filtered + alphabetized spell groups for display.
  const spellSearchLower = spellSearch.trim().toLowerCase();
  const filteredSpellsByLevel: Record<number, SpellData[]> = {};
  for (const [lv, spells] of Object.entries(spellsByLevel)) {
    const filtered = spellSearchLower
      ? spells.filter((s) => s.name.toLowerCase().includes(spellSearchLower))
      : spells;
    filteredSpellsByLevel[Number(lv)] = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }
  const spellbookSearchLower = spellbookSearch.trim().toLowerCase();
  const spellbookSpells = props.character.spellsKnown
    .map((id) => getSpell(id))
    .filter((spell): spell is SpellData => !!spell);
  const filteredSpellbookByLevel: Record<number, SpellData[]> = {};
  for (const spell of spellbookSpells) {
    if (spellbookSearchLower && !spell.name.toLowerCase().includes(spellbookSearchLower)) continue;
    (filteredSpellbookByLevel[spell.level] ??= []).push(spell);
  }
  for (const spells of Object.values(filteredSpellbookByLevel)) {
    spells.sort((a, b) => spellbookSort === "name"
      ? a.name.localeCompare(b.name) || a.level - b.level
      : a.level - b.level || a.name.localeCompare(b.name));
  }
  const [showInvForm, setShowInvForm] = useState(false);
  const [invName, setInvName] = useState("");
  const [invRarity, setInvRarity] = useState("Common");
  const [invNotes, setInvNotes] = useState("");
  const [invWeight, setInvWeight] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [itemCategory, setItemCategory] = useState("All");
  const [itemRarity, setItemRarity] = useState("All");
  const itemMatches = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return ITEM_CATALOG.filter((item) => {
      if (itemCategory !== "All" && item.category !== itemCategory) return false;
      if (itemRarity !== "All" && item.rarity !== itemRarity) return false;
      if (!q) return true;
      return [
        item.name,
        item.category,
        item.rarity,
        item.classification,
        item.ac,
        item.damage,
        item.damageType,
        item.properties,
        item.description,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [itemCategory, itemRarity, itemSearch]);
  const visibleItemMatches = itemMatches.slice(0, 24);
  const hitDiceRolling = useRef(false);
  const [showHitDiceRest, setShowHitDiceRest] = useState(false);
  const isPactCaster = casterType === "pact";
  const slotMax = maxSlots(casterType, props.character.level, heroClass.id);
  // Pact casters track spent slots as a simple count (0..max), others use the level-keyed map.
  // Pact slots live at the first non-zero entry of slotMax (index = slotLevel - 1), not always [0].
  const pactMax = isPactCaster ? (slotMax.find((c) => c > 0) ?? 0) : 0;
  const pactUsed = Math.min(props.character.pactSlotsUsed ?? 0, pactMax);
  const slotsUsed = props.character.spellSlotsUsed ?? {};
  const saveDC = spellAbility ? 8 + pb + abilityModifier(props.finalAbilities[spellAbility]) + equipmentItemBonuses.spellSaveDc : 0;
  const spellAttack = spellAbility ? pb + abilityModifier(props.finalAbilities[spellAbility]) + equipmentItemBonuses.spellAttack : 0;
  const spellStatuses = useMemo(() => props.character.spellStatuses ?? {}, [props.character.spellStatuses]);
  const spellStatusesRef = useRef(spellStatuses);
  useEffect(() => {
    spellStatusesRef.current = spellStatuses;
  }, [spellStatuses]);

  const updateSpellStatus = (spellId: string, patch: SpellStatus) => {
    const allStatuses = spellStatusesRef.current;
    const current = allStatuses[spellId] ?? {};
    const merged: SpellStatus = { ...current, ...patch };
    const source = merged.source?.trim() ?? "";
    const cleaned: SpellStatus = {};
    if (source) cleaned.source = source;
    if (merged.freeUse) {
      cleaned.freeUse = true;
      if (merged.freeUsed) cleaned.freeUsed = true;
    }

    const next = { ...allStatuses };
    if (Object.keys(cleaned).length > 0) next[spellId] = cleaned;
    else delete next[spellId];
    spellStatusesRef.current = next;
    props.onUpdate({ spellStatuses: next });
  };

  const spendSlot = (lvl: number) => {
    if (isPactCaster) {
      props.onUpdate({ pactSlotsUsed: Math.min(pactUsed + 1, pactMax) });
    } else {
      const next: SpellSlots = { ...slotsUsed };
      next[lvl] = Math.min((next[lvl] ?? 0) + 1, slotMax[lvl - 1] ?? 0);
      props.onUpdate({ spellSlotsUsed: next });
    }
  };
  const recoverSlot = (lvl: number) => {
    if (isPactCaster) {
      props.onUpdate({ pactSlotsUsed: Math.max(pactUsed - 1, 0) });
    } else {
      const next: SpellSlots = { ...slotsUsed };
      next[lvl] = Math.max((next[lvl] ?? 0) - 1, 0);
      props.onUpdate({ spellSlotsUsed: next });
    }
  };
  const doShortRest = () => {
    const available = props.character.level - (props.character.hitDiceSpent ?? 0);
    if (isPactCaster) {
      props.onUpdate({ pactSlotsUsed: 0 });
    }
    if (available > 0) {
      setShowHitDiceRest(true);
    } else if (isPactCaster) {
      props.onNotify?.("Short rest — pact slots recovered. No hit dice remaining.");
    } else {
      props.onNotify?.("Short rest — no hit dice remaining.");
    }
  };
  const rollHitDie = () => {
    const available = props.character.level - (props.character.hitDiceSpent ?? 0);
    if (available <= 0) return;
    const conMod = abilityModifier(props.finalAbilities.constitution);
    const spent = props.character.hitDiceSpent ?? 0;
    props.onRoll(`Hit Die d${heroClass.hitDie}`, heroClass.hitDie, 1, conMod, (outcome) => {
      const healed = Math.max(0, outcome.total);
      props.onUpdate({
        currentHp: Math.min(props.character.maxHp, props.character.currentHp + healed),
        hitDiceSpent: spent + 1,
      });
    });
  };
  const finishShortRest = () => {
    setShowHitDiceRest(false);
    const remaining = props.character.level - (props.character.hitDiceSpent ?? 0);
    const parts: string[] = ["Short rest complete."];
    if (isPactCaster) parts.push("Pact slots recovered.");
    if (remaining > 0) parts.push(`${remaining} hit dice remaining.`);
    else parts.push("No hit dice remaining.");
    props.onNotify?.(parts.join(" "));
  };
  const doLongRest = () => {
    if (!window.confirm("Take a long rest? HP and spell slots will be restored.")) return;
    const level = props.character.level;
    const spent = props.character.hitDiceSpent ?? 0;
    const recovered = Math.max(1, Math.floor(level / 2));
    const allStatuses = spellStatusesRef.current;
    const restedSpellStatuses = Object.fromEntries(
      Object.entries(allStatuses).map(([spellId, status]) => [
        spellId,
        status.freeUse ? { ...status, freeUsed: false } : status,
      ]),
    );
    spellStatusesRef.current = restedSpellStatuses;

    // Class-specific resets
    const classId = props.character.classId;
    const classResetNotes: string[] = [];
    const effectPatches: Partial<CharacterEffect>[] = [];

    if (classId === "fighter") {
      classResetNotes.push("Second Wind");
      // Reset any effect that looks like Second Wind usage tracking
      effectPatches.push({ id: "__fighter-second-wind", label: "Second Wind", active: true } as CharacterEffect);
    }
    if (classId === "monk") {
      classResetNotes.push("Ki points");
      // Reset Ki point tracking
      effectPatches.push({ id: "__monk-ki", label: "Ki", active: true } as CharacterEffect);
    }

    const recoveredParts: string[] = [];
    recoveredParts.push(`HP restored to ${props.character.maxHp}`);
    if (props.character.tempHp > 0) recoveredParts.push("temp HP cleared");
    recoveredParts.push("spell slots restored");
    if (props.character.concentratingOn) recoveredParts.push("concentration ended");
    if (spent > 0) recoveredParts.push(`${Math.min(recovered, spent)} hit dice recovered`);
    const hadFreeUsed = Object.values(allStatuses).some((s) => s.freeUse && s.freeUsed);
    if (hadFreeUsed) recoveredParts.push("per-rest spell uses restored");
    if (classResetNotes.length > 0) recoveredParts.push(`${classResetNotes.join(", ")} recovered`);

    const updatePatch: Partial<Omit<Character, "id" | "userId" | "createdAt">> = {
      currentHp: props.character.maxHp,
      tempHp: 0,
      spellSlotsUsed: {},
      pactSlotsUsed: 0,
      concentratingOn: null,
      hitDiceSpent: Math.max(0, spent - recovered),
      spellStatuses: restedSpellStatuses,
    };

    props.onUpdate(updatePatch);
    props.onNotify?.(`Long rest — ${recoveredParts.join(", ")}.`);
  };

  /* ── Spell preparation & casting ── */
  const preparedIds = props.character.preparedSpells ?? [];
  const prepLimit = _isPrepared && spellAbility
    ? preparedSpellLimit(casterType, props.character.level, abilityModifier(props.finalAbilities[spellAbility]))
    : 0;
  const togglePrepared = (spellId: string) => {
    if (preparedIds.includes(spellId)) {
      props.onUpdate({ preparedSpells: preparedIds.filter((s) => s !== spellId) });
    } else if (preparedIds.length < prepLimit) {
      props.onUpdate({ preparedSpells: [...preparedIds, spellId] });
    }
  };
  const learnSpell = (spellId: string) => {
    if (!spellId || props.character.spellsKnown.includes(spellId)) return;
    if (!spellbookChoices.some((spell) => spell.id === spellId)) return;
    props.onUpdate({ spellsKnown: [...props.character.spellsKnown, spellId] });
    setSpellToLearn("");
  };
  // ── Spell casting ─────────────────────────────────────────────────────
  // One combined patch: slot spend + concentration must not race as two PUTs.
  // Cast now resolves spell effects for the selected level, triggers the dice
  // animation overlay for each effect, and shows a result notification.
  // All scaling is driven by structured data, not description text.
  const castSpell = (spell: SpellData, atLevel: number) => {
    if (spellcastingBlockedByArmor) {
      props.onNotify?.(`${armorPenaltyReason}: spellcasting is blocked.`);
      return;
    }
    if (props.character.concentratingOn && spell.concentration) {
      if (!window.confirm(`You are already concentrating on ${props.character.concentratingOn}. Cast ${spell.name} instead?`)) return;
    }

    // Resolve spell effects at the selected cast level (from structured scaling data).
    const resolvedEffects = resolveSpellEffects(spell, atLevel);

    // Attack-roll spells: consume the slot but do NOT auto-roll damage.
    // The player must first confirm a hit via the separate attack roll button.
    // Only save-based spells (like Burning Hands) auto-roll damage on cast.
    const isAttackSpell = !!spell.attack;

    if (!isAttackSpell) {
      // Roll each resolved effect through the dice animation system.
      // Each effect gets its own animation so different damage types stay separate.
      for (const effect of resolvedEffects) {
        const parsed = parseSimpleDice(effect.dice);
        const typeLabel = effect.type === "damage" ? effect.damageType : "healing";
        const label = `${spell.name} ${typeLabel}` + (atLevel > 0 ? ` (Lv ${atLevel})` : "");

        if (parsed && parsed.count > 0) {
          props.onRoll(label, parsed.sides, parsed.count, parsed.modifier);
        } else {
          // Complex or unparseable expression — show as notification.
          props.onNotify?.(`${spell.name}: ${effect.dice} ${typeLabel}`);
        }
      }
    }

    // Show appropriate notification based on spell type.
    if (isAttackSpell) {
      props.onNotify?.(
        `${spell.name} cast at level ${atLevel > 0 ? atLevel : "cantrip"}. Make a spell attack roll.`,
      );
    } else if (resolvedEffects.length === 0 && spell.save) {
      props.onNotify?.(
        `${spell.name} cast at level ${atLevel > 0 ? atLevel : "cantrip"}. ${spell.save} vs DC ${saveDC}.`,
      );
    } else if (resolvedEffects.length === 0 && atLevel > 0) {
      props.onNotify?.(`${spell.name} cast at level ${atLevel}. No immediate roll.`);
    }

    // Consume the spell slot (only after successful resolution and roll dispatch).
    const patch: Partial<Omit<Character, "id" | "userId" | "createdAt">> = {};
    if (atLevel > 0) {
      if (isPactCaster) {
        patch.pactSlotsUsed = Math.min(pactUsed + 1, pactMax);
      } else {
        const next: SpellSlots = { ...slotsUsed };
        next[atLevel] = Math.min((next[atLevel] ?? 0) + 1, slotMax[atLevel - 1] ?? 0);
        patch.spellSlotsUsed = next;
      }
    }
    if (spell.concentration) patch.concentratingOn = spell.name;
    if (Object.keys(patch).length > 0) props.onUpdate(patch);
    setSpellDetail(null);
  };
  const castFreeSpell = (spell: SpellData) => {
    if (spellcastingBlockedByArmor) {
      props.onNotify?.(`${armorPenaltyReason}: spellcasting is blocked.`);
      return;
    }
    if (props.character.concentratingOn && spell.concentration) {
      if (!window.confirm(`You are already concentrating on ${props.character.concentratingOn}. Cast ${spell.name} instead?`)) return;
    }
    const allStatuses = spellStatusesRef.current;
    const current = allStatuses[spell.id];
    if (!current?.freeUse || current.freeUsed) return;
    const nextStatuses = {
      ...allStatuses,
      [spell.id]: { ...current, freeUse: true, freeUsed: true },
    };
    spellStatusesRef.current = nextStatuses;
    const patch: Partial<Omit<Character, "id" | "userId" | "createdAt">> = { spellStatuses: nextStatuses };
    if (spell.concentration) patch.concentratingOn = spell.name;
    props.onUpdate(patch);
    setSpellDetail(null);
  };

  const handleLevelDown = () => {
    const level = props.character.level;
    if (level <= 1) return;
    const newLevel = level - 1;
    if (!window.confirm(`Revert to level ${newLevel}? This undoes the HP, feat, and subclass gains from the removed level.`)) return;

    const conMod = abilityModifier(props.finalAbilities.constitution);
    const hpResult = revertHpLevel(
      props.character.maxHp,
      props.character.currentHp,
      props.character.hpRolls ?? [],
      props.character.settings.hitPointType,
      heroClass.hitDie,
      conMod,
    );

    if (!hpResult.safe) {
      props.onNotify?.(hpResult.reason);
      return;
    }

    const patch: Record<string, unknown> = {
      level: newLevel,
      maxHp: hpResult.newMaxHp,
      currentHp: hpResult.newCurrentHp,
      hpRolls: hpResult.newHpGains,
    };

    // Remove ASI/feat choices from the level being removed
    const asiChoices = props.character.asiChoices ?? [];
    const remainingAsi = asiChoices.filter((c) => c.level !== level);
    if (remainingAsi.length < asiChoices.length) {
      patch.asiChoices = remainingAsi;
    }

    // Clear subclass if gained at a level now above newLevel
    const subclassLevel = heroClass.subclassLevel ?? 3;
    if (props.character.subclassId && subclassLevel > newLevel) {
      patch.subclassId = "";
    }

    props.onUpdate(patch as Partial<Omit<Character, "id" | "userId" | "createdAt">>);
  };

  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply immediately for feedback; persist on a debounce.
  const saveLayout = useCallback(
    (l: SheetLayout) => {
      setLayout(l);
      if (layoutTimer.current) clearTimeout(layoutTimer.current);
      layoutTimer.current = setTimeout(() => props.onUpdate({ sheetLayout: l }), 300);
    },
    [props],
  );

  const [pages, setPages] = useState<CharacterPage[]>(props.character.pages ?? []);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [brokenPageImages, setBrokenPageImages] = useState<Set<string>>(new Set());
  const pagesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePages = useCallback(
    (next: CharacterPage[]) => {
      setPages(next);
      if (pagesTimer.current) clearTimeout(pagesTimer.current);
      pagesTimer.current = setTimeout(() => props.onUpdate({ pages: next }), 300);
    },
    [props],
  );

  const addPage = () => {
    const next = [...pages, { id: crypto.randomUUID(), title: "New page", blocks: [] as PageBlock[] }];
    savePages(next);
    setActivePageIndex(next.length - 1);
  };

  const deletePage = (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;
    const next = pages.filter((p) => p.id !== pageId);
    savePages(next);
    setActivePageIndex((i) => Math.max(0, Math.min(i, next.length - 1)));
  };

  const updatePageTitle = (pageId: string, title: string) => {
    savePages(pages.map((p) => (p.id === pageId ? { ...p, title: title.trim() || "Untitled" } : p)));
  };

  const addPageBlock = (pageId: string, type: "text" | "image") => {
    const block: PageBlock =
      type === "text"
        ? { id: crypto.randomUUID(), type: "text", content: "" }
        : { id: crypto.randomUUID(), type: "image", url: "" };
    savePages(pages.map((p) => (p.id === pageId ? { ...p, blocks: [...p.blocks, block] } : p)));
  };

  const updatePageBlock = (pageId: string, blockId: string, patch: Partial<PageBlock>) => {
    savePages(
      pages.map((p) =>
        p.id === pageId
          ? { ...p, blocks: p.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as PageBlock) : b)) }
          : p,
      ),
    );
  };

  const removePageBlock = (pageId: string, block: PageBlock) => {
    const hasContent = block.type === "text" ? block.content.trim().length > 0 : block.url.trim().length > 0;
    if (hasContent && !window.confirm("Remove this block?")) return;
    savePages(pages.map((p) => (p.id === pageId ? { ...p, blocks: p.blocks.filter((b) => b.id !== block.id) } : p)));
  };

  const toggleCollapse = (id: SheetSectionId) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    saveLayout({ ...layout, collapsed: next });
  };

  const resetLayout = () => {
    saveLayout({ ...DEFAULT_LAYOUT, columns: DEFAULT_LAYOUT.columns.map((c) => [...c]) });
  };

  const hiddenIds = layout.hidden ?? [];
  const toggleHidden = (id: SheetSectionId) => {
    const next = hiddenIds.includes(id) ? hiddenIds.filter((x) => x !== id) : [...hiddenIds, id];
    saveLayout({ ...layout, hidden: next });
  };

  /* Column resize: drag the divider between columns in edit mode. Widths are
     stored as percentages; unset means the stylesheet's default proportions. */
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const startColumnDrag = (dividerIndex: number, e: React.PointerEvent<HTMLDivElement>) => {
    const container = columnsRef.current;
    if (!container) return;
    e.preventDefault();
    const handle = e.currentTarget;
    try { handle.setPointerCapture(e.pointerId); } catch { /* synthetic events lack a real pointerId */ }
    const cols = [...container.querySelectorAll<HTMLElement>(":scope > .cs-sheet-col")];
    const containerWidth = container.getBoundingClientRect().width;
    // Below ~700px the columns stack vertically — width percentages measured
    // there are meaningless (and would persist as garbage), so don't resize.
    if (!containerWidth || containerWidth < 700 || cols.length < 2) return;
    const raw =
      layout.columnWidths && layout.columnWidths.length === cols.length
        ? [...layout.columnWidths]
        : cols.map((c) => (c.getBoundingClientRect().width / containerWidth) * 100);
    // Normalize so the widths always sum to 100 regardless of source.
    const rawSum = raw.reduce((s, w) => s + w, 0) || 1;
    const startWidths = raw.map((w) => (w / rawSum) * 100);
    const startX = e.clientX;
    const a = dividerIndex;
    const b = dividerIndex + 1;
    const onMove = (ev: PointerEvent) => {
      const deltaPct = ((ev.clientX - startX) / containerWidth) * 100;
      // Clamp so neither neighbor goes under 12% of the sheet.
      const moved = Math.max(-(startWidths[a] - 12), Math.min(deltaPct, startWidths[b] - 12));
      const next = [...startWidths];
      next[a] = Math.round((startWidths[a] + moved) * 10) / 10;
      next[b] = Math.round((startWidths[b] - moved) * 10) / 10;
      saveLayout({ ...layout, columnWidths: next });
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string): number => {
    for (let i = 0; i < layout.columns.length; i++) {
      if (layout.columns[i].includes(id as SheetSectionId)) return i;
    }
    return -1;
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeCol = findColumn(active.id as string);
    const overCol = findColumn(over.id as string);
    if (activeCol === -1 || overCol === -1) return;

    const current = mergeWithDefaults(props.character.sheetLayout);
    const next = current.columns.map((c) => [...c]);
    const activeIdStr = active.id as SheetSectionId;
    const overIdStr = over.id as SheetSectionId;

    if (activeCol === overCol) {
      const col = next[activeCol];
      const oldIdx = col.indexOf(activeIdStr);
      const newIdx = col.indexOf(overIdStr);
      if (oldIdx !== -1 && newIdx !== -1) {
        col.splice(oldIdx, 1);
        col.splice(newIdx, 0, activeIdStr);
      }
    } else {
      const oldIdx = next[activeCol].indexOf(activeIdStr);
      if (oldIdx !== -1) next[activeCol].splice(oldIdx, 1);
      const newIdx = next[overCol].indexOf(overIdStr);
      next[overCol].splice(newIdx >= 0 ? newIdx : next[overCol].length, 0, activeIdStr);
    }

    saveLayout({ ...current, columns: next });
  }

  /* ── Section content renderers (same as before) ── */

  const sectionContent = (id: SheetSectionId) => {
    switch (id) {
      case "identity": return (
        <div className="cs-identity">
          <div className="cs-class-icon" data-class={heroClass.id}><ClassIconPlaceholder classId={heroClass.id} size={42} strokeWidth={1.5} /></div>
          <div><h1 className="cs-char-name">{props.character.name}</h1><p className="cs-char-subtitle">{subtitleParts.join(" / ")}</p></div>
          <span className="cs-level-badge">
            <button className="cs-lvl-stepper" type="button" title="Level down" aria-label="Level down" onClick={handleLevelDown}><Minus size={10} /></button>
            Lv {props.character.level}
            <button className="cs-lvl-stepper" type="button" title="Level up" aria-label="Level up" onClick={() => { if (props.character.level < 20) setLevelUpTarget(props.character.level + 1); }}><Plus size={10} /></button>
          </span>
          <div className="cs-rest-group">
            <button className="cs-glass-btn" type="button" onClick={doShortRest} title="Short rest">Short Rest</button>
            <button className="cs-glass-btn" type="button" onClick={doLongRest} title="Long rest">Long Rest</button>
          </div>
          {showHitDiceRest ? (
            <div className="cs-hd-rest-panel">
              <span className="cs-hd-rest-info">
                Hit dice: {props.character.level - (props.character.hitDiceSpent ?? 0)}/{props.character.level} d{heroClass.hitDie} remaining
              </span>
              <div className="cs-hd-rest-actions">
                <button className="cs-glass-btn" type="button" disabled={(props.character.hitDiceSpent ?? 0) >= props.character.level} onClick={rollHitDie}>
                  Roll HD (1d{heroClass.hitDie}{signed(abilityModifier(props.finalAbilities.constitution))})
                </button>
                <button className="cs-glass-btn" type="button" onClick={finishShortRest}>Done</button>
              </div>
            </div>
          ) : null}
          <button className={`cs-glass-btn cs-inspire-btn${props.character.heroicInspiration ? " cs-inspire-on" : ""}`} type="button" aria-pressed={!!props.character.heroicInspiration} title="Heroic Inspiration" onClick={() => props.onUpdate({ heroicInspiration: !props.character.heroicInspiration })}>{props.character.heroicInspiration ? "✦ " : ""}Inspiration</button>
          <button className="cs-retire-btn" type="button" title="Retire character" aria-label="Retire character" onClick={props.onDelete}><Trash2 size={12} /></button>
        </div>
      );
      case "vitals": return (
        <div className="cs-vitals">
          <button type="button" className="cs-vital-cell cs-vital-rollable" onClick={() => setShowAcBreakdown(true)} title="See what makes up this AC" aria-label={`Armor class ${armorClass}, view breakdown`}><span className="cs-vital-label"><Shield size={12} />AC</span><strong>{armorClass}</strong><small className="cs-ac-src">{acInfo.label}</small></button>
          <button type="button" className="cs-vital-cell cs-vital-rollable" onClick={() => rollD20ForAbility("Initiative", initiative, "dexterity")} aria-label={`Roll initiative, ${signed(initiative)}`} title={d20OptionsForAbility("dexterity") ? "Armor proficiency penalty: rolls with disadvantage" : "Click to roll initiative"}><span className="cs-vital-label"><Activity size={12} />Init</span><strong>{signed(initiative)}</strong></button>
          <div className="cs-vital-cell"><span className="cs-vital-label"><Zap size={12} />Speed</span><strong style={acInfo.strengthWarning ? { color: "var(--accent, var(--gold))" } : undefined}>{(() => { const base = parseInt(race.speed, 10) || 30; return acInfo.strengthWarning ? `${Math.max(0, base - 10)} ft.` : race.speed; })()}</strong></div>
          <div className="cs-vital-cell"><span className="cs-vital-label">Prof</span><strong>{signed(pb)}</strong></div>
          <div className="cs-vital-cell cs-vital-hp">
            <span className="cs-vital-label">Hit Points</span>
            <div className="cs-vital-hp-row"><strong>{props.character.currentHp}</strong><span className="cs-vital-hp-max">/ {props.character.maxHp}</span></div>
            <span className="sr-only" aria-live="polite">{props.character.currentHp} of {props.character.maxHp} hit points{props.character.tempHp > 0 ? ` plus ${props.character.tempHp} temporary` : ""}</span>
            {props.character.tempHp > 0 ? <span className="cs-hp-temp">+{props.character.tempHp}</span> : null}
            <div className="cs-hp-bar"><span style={{ width: `${hpPercent}%` }} /></div>
            <div className="cs-hp-steppers">
              <button type="button" aria-label="Decrease HP" onClick={() => props.onUpdate({ currentHp: Math.max(0, props.character.currentHp - 1) })}><Minus size={10} /></button>
              <button type="button" aria-label="Increase HP" onClick={() => props.onUpdate({ currentHp: Math.min(props.character.maxHp, props.character.currentHp + 1) })}><Plus size={10} /></button>
            </div>
          </div>
          <div className="cs-vital-cell"><span className="cs-vital-label">Hit Dice</span><strong>{props.character.level - (props.character.hitDiceSpent ?? 0)}/{props.character.level} d{heroClass.hitDie}</strong>
            <button type="button" className="cs-glass-btn cs-hd-roll" disabled={(props.character.hitDiceSpent ?? 0) >= props.character.level || hitDiceRolling.current} title={`Spend 1 hit die: 1d${heroClass.hitDie}${signed(abilityModifier(props.finalAbilities.constitution))} HP`} onClick={(e) => { e.stopPropagation(); if (hitDiceRolling.current) return; hitDiceRolling.current = true; const conMod = abilityModifier(props.finalAbilities.constitution); const spent = props.character.hitDiceSpent ?? 0; props.onRoll(`Hit Die d${heroClass.hitDie}`, heroClass.hitDie, 1, conMod, (outcome) => { const healed = Math.max(0, outcome.total); props.onUpdate({ currentHp: Math.min(props.character.maxHp, props.character.currentHp + healed), hitDiceSpent: spent + 1 }); hitDiceRolling.current = false; }); }}>Roll</button>
          </div>
          <div className="cs-vital-cell cs-vital-death">
            <span className="cs-vital-label"><Skull size={12} />Death Saves</span>
            <div className="cs-vital-death-row">
              <span>S</span>{[0,1,2].map((i) => (<button key={`s-${i}`} className={`cs-death-dot${i < (props.character.deathSaves?.successes ?? 0) ? " dot-success" : ""}`} onClick={() => toggleDeathSave("successes")} aria-pressed={i < (props.character.deathSaves?.successes ?? 0)} aria-label={`Death save success ${i + 1}`} />))}
              <span>F</span>{[0,1,2].map((i) => (<button key={`f-${i}`} className={`cs-death-dot${i < (props.character.deathSaves?.failures ?? 0) ? " dot-fail" : ""}`} onClick={() => toggleDeathSave("failures")} aria-pressed={i < (props.character.deathSaves?.failures ?? 0)} aria-label={`Death save failure ${i + 1}`} />))}
              <button className="cs-death-reset" type="button" aria-label="Reset death saves" onClick={resetDeathSaves}>R</button>
            </div>
          </div>
        </div>
      );
      case "abilities": return (
        <div className="cs-abilities">{abilityKeys.map((key) => { const score = props.finalAbilities[key]; const mod = abilityModifier(score); const joaTBonus = hasJackOfAllTrades ? halfPb : 0; const totalMod = mod + effChecks + joaTBonus; return (<button type="button" className="cs-ability-cell" key={key} onClick={() => rollD20ForAbility(`${abilityLabels[key]} check`, totalMod, key)} aria-label={`Roll ${abilityLabels[key]} check, ${signed(totalMod)}`} title={d20OptionsForAbility(key) ? "Armor proficiency penalty: rolls with disadvantage" : undefined}><span className="cs-ability-mod">{signed(mod)}</span><span className="cs-ability-label">{abilityLabels[key]}</span><span className="cs-ability-score">{score}</span></button>); })}</div>
      );
      case "saves": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow"><Shield size={12} />Saving Throws</h3>
          <div className="cs-save-grid">{abilityKeys.map((key) => { const prof = isSaveProficient(key); const bonus = saveBonus(key); return (<button type="button" className={`cs-save-row${prof ? " cs-prof" : ""}`} key={key} tabIndex={0} onClick={() => rollD20ForAbility(`${abilityLabels[key]} save`, bonus, key)} onContextMenu={(e) => { e.preventDefault(); toggleSaveProficiency(key); }} onKeyDown={(e) => { if (e.key === "p" || e.key === "P") { e.preventDefault(); toggleSaveProficiency(key); } }} aria-label={`${abilityLabels[key]} save ${signed(bonus)}${prof ? " proficient" : ""}`} title={d20OptionsForAbility(key) ? "Right-click or press P to toggle proficiency. Armor penalty: rolls with disadvantage." : "Right-click or press P to toggle proficiency"}><span className="cs-prof-marker" aria-hidden="true">{prof ? "\u25CF" : "\u25CB"}</span><span className="cs-save-name">{abilityLabels[key]}</span><span className="cs-save-bonus">{signed(bonus)}</span></button>); })}</div>
          {saveAllBonus !== 0 ? <p className="cs-rule-note">All saves: {signed(saveAllBonus)}{equipmentItemBonuses.saves !== 0 ? ` (${signed(equipmentItemBonuses.saves)} items)` : ""}</p> : null}
        </section>
      );
      case "skills": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow">Skills</h3>
          {hasJackOfAllTrades ? <p className="cs-rule-note">Jack of All Trades: +{halfPb} to untrained checks</p> : null}
          <div className="cs-skills-grid">{skillsByAbility.map(({ ability: abv, skills }) => (<div className="cs-skill-group" key={abv}><span className="cs-skill-ability-tag">{abilityLabels[abv]}</span>{skills.map((skill) => { const prof = isSkillProficient(skill.id); const expert = isSkillExpert(skill.id); const bonus = skillBonus(skill); return (<div className="cs-skill-row" key={skill.id}><button type="button" className={`cs-prof-marker cs-prof-click${expert ? " cs-expert" : prof ? " cs-prof" : ""}`} onClick={() => toggleSkillProficiency(skill.id)} onContextMenu={(e) => { e.preventDefault(); cycleSkillExpertise(skill.id); }} onKeyDown={(e) => { if (e.key === "e" || e.key === "E") { e.preventDefault(); cycleSkillExpertise(skill.id); } }} aria-label={`Toggle ${skill.name} proficiency — right-click or E for expertise${prof ? ` (${skillProficiencySources(skill.id).join(", ") || "on"})` : ""}`}>{expert ? "\u2726" : prof ? "\u25CF" : "\u25CB"}</button><button type="button" className="cs-skill-btn" onClick={() => rollD20ForAbility(skill.name, bonus, skill.ability)} aria-label={`Roll ${skill.name}, ${signed(bonus)}`} title={d20OptionsForAbility(skill.ability) ? "Armor proficiency penalty: rolls with disadvantage" : undefined}>{skill.name}<span className="cs-skill-source-chips">{skillProficiencySources(skill.id).map((source) => (<span key={source} className={`cs-skill-source-chip ${source === "BG" ? "background" : source === "EXP" ? "expertise" : "trained"}`} title={source === "BG" ? `Granted by ${props.character.background}` : source === "EXP" ? "Expertise (2× proficiency)" : "Chosen skill proficiency"}>{source}</span>))}</span></button><span className="cs-skill-bonus">{signed(bonus)}</span></div>); })}</div>))}</div>
        </section>
      );
      case "senses": {
        // Collect senses from active effects and race traits, keeping highest per type
        const sensePatterns: { regex: RegExp; label: string }[] = [
          { regex: /darkvision\s+(\d+)/i, label: "Darkvision" },
          { regex: /truesight\s+(\d+)/i, label: "Truesight" },
          { regex: /blindsight\s+(\d+)/i, label: "Blindsight" },
          { regex: /tremorsense\s+(\d+)/i, label: "Tremorsense" },
        ];
        const senseMax: Record<string, number> = {};

        // Check race traits for senses (e.g., Darkvision from elf/dwarf)
        for (const trait of race.traits) {
          const text = `${trait.name} ${trait.description}`;
          for (const { regex, label } of sensePatterns) {
            const m = regex.exec(text);
            if (m) {
              const dist = parseInt(m[1], 10);
              if (!Number.isNaN(dist) && dist > (senseMax[label] ?? 0)) {
                senseMax[label] = dist;
              }
            }
          }
        }

        // Check active effects for senses
        for (const eff of activeEffects) {
          if (!eff.sense) continue;
          for (const { regex, label } of sensePatterns) {
            const m = regex.exec(eff.sense);
            if (m) {
              const dist = parseInt(m[1], 10);
              if (!Number.isNaN(dist) && dist > (senseMax[label] ?? 0)) {
                senseMax[label] = dist;
              }
            }
          }
          // Also check effect label for sense-like descriptions
          const effText = `${eff.label} ${eff.sense}`;
          for (const { regex, label } of sensePatterns) {
            regex.lastIndex = 0;
            const m = regex.exec(effText);
            if (m) {
              const dist = parseInt(m[1], 10);
              if (!Number.isNaN(dist) && dist > (senseMax[label] ?? 0)) {
                senseMax[label] = dist;
              }
            }
          }
        }

        // Also check any effect sense that doesn't match a pattern — show raw
        const rawSenses = activeEffects
          .filter((e) => e.sense)
          .map((e) => e.sense!.trim())
          .filter((s) => s && !sensePatterns.some((p) => p.regex.test(s)));

        return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow">Senses</h3>
          <div className="cs-sense-list">
            <div className="cs-sense-row"><span>Passive Perception</span><strong>{passivePerception}</strong></div>
            <div className="cs-sense-row"><span>Passive Investigation</span><strong>{passiveInvestigation}</strong></div>
            <div className="cs-sense-row"><span>Passive Insight</span><strong>{passiveInsight}</strong></div>
            {Object.entries(senseMax).map(([label, dist]) => (
              <div className="cs-sense-row" key={label}><span>{label}</span><strong>{dist} ft.</strong></div>
            ))}
            {rawSenses.map((s, i) => (
              <div className="cs-sense-row" key={`raw-${i}`}><span>{s}</span><strong>◈</strong></div>
            ))}
          </div>
        </section>
        );
      }
      case "profs": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow">Proficiencies &amp; Training</h3>
          <div className="cs-prof-list">
            {effectiveProficiencies.length > 0 ? (<div className="cs-prof-group"><span className="cs-prof-cat">Armor &amp; Weapons</span><div className="cs-prof-tags">{effectiveProficiencies.map((p) => (<span className="cs-prof-chip" key={p}>{p}</span>))}</div></div>) : null}
            {(props.character.toolProficiencies ?? []).length > 0 ? (<div className="cs-prof-group"><span className="cs-prof-cat">Tools</span><div className="cs-prof-tags">{(props.character.toolProficiencies ?? []).map((p) => (<span className="cs-prof-chip" key={p}>{p}</span>))}</div></div>) : null}
            {(props.character.languages ?? []).length > 0 ? (<div className="cs-prof-group"><span className="cs-prof-cat">Languages</span><div className="cs-prof-tags">{(props.character.languages ?? []).map((p) => (<span className="cs-prof-chip" key={p}>{p}</span>))}</div></div>) : null}
            {effectiveProficiencies.length === 0 && (props.character.toolProficiencies ?? []).length === 0 && (props.character.languages ?? []).length === 0 ? <p className="cs-muted">No proficiencies recorded</p> : null}
          </div>
        </section>
      );
      case "equipment": {
        const armor = equipment.armorId ? ARMORS.find((a) => a.id === equipment.armorId) : undefined;
        const equippedArmor = equipment.armorItemId ? props.character.inventory.find((item) => item.id === equipment.armorItemId) : undefined;
        const equippedShield = equipment.shieldItemId ? props.character.inventory.find((item) => item.id === equipment.shieldItemId) : undefined;
        const equippedWeapons = (equipment.weaponItemIds ?? [])
          .map((id) => props.character.inventory.find((item) => item.id === id))
          .filter((item): item is InventoryItem => !!item);
        const equippedBonuses = (equipment.bonusItemIds ?? [])
          .map((id) => props.character.inventory.find((item) => item.id === id))
          .filter((item): item is InventoryItem => !!item);
        const equippedArmorWarning = armorProficiencyIssue.lacksArmor && equippedArmor?.name === armorProficiencyIssue.armorName;
        const equippedShieldWarning = armorProficiencyIssue.lacksShield && equippedShield?.name === armorProficiencyIssue.shieldName;
        return (
          <section className="cs-block">
            <h3 className="cs-section-eyebrow"><Shield size={12} />Equipment</h3>
            <div className="cs-equip-row">
              <label className="cs-equip-field">
                <span>Armor</span>
                <select value={equipment.armorId ?? ""} onChange={(e) => updateEquipment({ armorId: e.target.value || undefined, armorItemId: undefined })}>
                  <option value="">None (unarmored)</option>
                  {ARMORS.map((a) => (<option key={a.id} value={a.id}>{a.name} - {a.category}{isArmorCategoryProficient(effectiveProficiencies, a.category) ? "" : " (not proficient)"}</option>))}
                </select>
              </label>
              <label className="cs-equip-check">
                <input type="checkbox" checked={!!equipment.shield && !equipment.shieldItemId} onChange={(e) => updateEquipment({ shield: e.target.checked, shieldItemId: undefined })} />
                Shield (+2){isShieldProficient(effectiveProficiencies) ? "" : " - not proficient"}
              </label>
            </div>
            {equippedArmor || equippedShield || equippedWeapons.length > 0 || equippedBonuses.length > 0 ? (
              <div className="cs-equipped-list" aria-label="Equipped inventory items">
                {equippedArmor ? <span className={`cs-equipped-chip${equippedArmorWarning ? " cs-equipped-warning" : ""}`} title={equippedArmorWarning ? "Not proficient with this armor" : undefined}><Shield size={11} />Armor: {equippedArmor.name}<button type="button" onClick={() => updateEquipment({ armorItemId: undefined })}>Unequip</button></span> : null}
                {equippedShield ? <span className={`cs-equipped-chip${equippedShieldWarning ? " cs-equipped-warning" : ""}`} title={equippedShieldWarning ? "Not proficient with this shield" : undefined}><Shield size={11} />Shield: {equippedShield.name}<button type="button" onClick={() => updateEquipment({ shieldItemId: undefined })}>Unequip</button></span> : null}
                {equippedWeapons.map((item) => <span className="cs-equipped-chip" key={item.id}><Swords size={11} />{item.name}<button type="button" onClick={() => toggleInventoryWeapon(item.id)}>Unequip</button></span>)}
                {equippedBonuses.map((item) => <span className="cs-equipped-chip" key={item.id}><Zap size={11} />{item.name}<button type="button" onClick={() => toggleBonusItem(item.id)}>Unequip</button></span>)}
              </div>
            ) : null}
            <p className="cs-rule-note">AC {armorClass} — {acInfo.label}{ruleAc !== 0 ? ` ${signed(ruleAc)} rules` : ""}{(props.featAcBonus ?? 0) > 0 ? ` +${props.featAcBonus} feat` : ""}</p>
            {armorProficiencyIssue.hasIssue ? <p className="cs-rule-note cs-rule-warning">{armorPenaltyReason}: STR/DEX checks, saves, and attacks roll with disadvantage; spellcasting is blocked.</p> : null}
            {acInfo.stealthDisadvantage ? <p className="cs-rule-note">Disadvantage on Stealth checks</p> : null}
            {acInfo.strengthWarning ? <p className="cs-rule-note">Needs Str {acInfo.strengthRequirement ?? armor?.strengthReq}: speed reduced by 10 ft.</p> : null}
            <span className="cs-spell-level-head">Weapons</span>
            <div className="cs-weapon-chips">
              {WEAPONS.map((w) => { const on = (equipment.weaponIds ?? []).includes(w.id); return (
                <button key={w.id} type="button" className={`cs-prof-chip cs-weapon-chip${on ? " cs-weapon-on" : ""}`} aria-pressed={on} onClick={() => toggleWeapon(w.id)} title={`${w.damage} ${w.damageType}`}>{w.name}</button>
              ); })}
            </div>
          </section>
        );
      }
      case "effects": {
        return (
          <section className="cs-block">
            <h3 className="cs-section-eyebrow">Effects &amp; Conditions</h3>
            {effectsList.length > 0 ? (
              <div className="cs-effect-list">
                {effectsList.map((e) => (
                  <div className={`cs-effect-row${e.active ? " cs-effect-on" : ""}`} key={e.id}>
                    <button type="button" className={`cs-prof-marker cs-prof-click${e.active ? " cs-prof" : ""}`} onClick={() => toggleEffect(e.id)} aria-pressed={e.active} aria-label={`Toggle ${e.label}`}>{e.active ? "●" : "○"}</button>
                    <div className="cs-effect-text">
                      <strong>{e.label}</strong>
                      {e.advantageMode ? <span className={`cs-effect-advmode ${e.advantageMode}`}>{e.advantageMode === "advantage" ? "ADV" : "DIS"}</span> : null}
                      <span>{describeEffect(e)}{e.source ? ` — ${e.source}` : ""}</span>
                    </div>
                    {e.active && typeof e.stack === "number" ? (
                      <div className="cs-effect-stack" aria-label={`${e.label} level`}>
                        <button type="button" onClick={() => setEffectStack(e.id, (e.stack ?? 1) - 1)} disabled={(e.stack ?? 1) <= 1} aria-label={`Decrease ${e.label} level`}>-</button>
                        <strong>{e.stack}</strong>
                        <button type="button" onClick={() => setEffectStack(e.id, (e.stack ?? 1) + 1)} disabled={(e.stack ?? 1) >= 6} aria-label={`Increase ${e.label} level`}>+</button>
                      </div>
                    ) : null}
                    <button type="button" className="cs-effect-del" onClick={() => removeEffect(e.id)} aria-label={`Remove ${e.label}`}>&times;</button>
                  </div>
                ))}
              </div>
            ) : <p className="cs-muted">No effects yet — add Bless, a +1 weapon, or borrowed darkvision below.</p>}
            <div className="cs-effect-add">
              <select value="" onChange={(ev) => { const v = ev.target.value; if (v === "custom") setShowEffectForm(true); else if (v !== "") addPresetEffect(Number(v)); }} aria-label="Add effect">
                <option value="">Add effect…</option>
                {EFFECT_PRESETS.map((preset, i) => (<option key={preset.label} value={i}>{preset.label}</option>))}
                <option value="custom">Custom…</option>
              </select>
            </div>
            {showEffectForm ? (
              <div className="cs-effect-form">
                <input className="qb-name-input" placeholder="Effect name" aria-label="Effect name" value={effForm.label ?? ""} onChange={(ev) => setEffForm({ ...effForm, label: ev.target.value })} maxLength={48} />
                <div className="cs-effect-nums">
                  {EFFECT_NUMERIC_FIELDS.map((field) => (
                    <label key={field.key}><span>{field.label}</span><input type="number" min={-20} max={20} value={effForm[field.key] ?? ""} onChange={(ev) => setEffForm({ ...effForm, [field.key]: ev.target.value })} /></label>
                  ))}
                </div>
                <div className="cs-effect-extra">
                  <label><span>d20 dice</span><input placeholder="1d4" value={effForm.d20Dice ?? ""} onChange={(ev) => setEffForm({ ...effForm, d20Dice: ev.target.value })} maxLength={6} /></label>
                  <label><span>Sense</span><input placeholder="Darkvision 60 ft." value={effForm.sense ?? ""} onChange={(ev) => setEffForm({ ...effForm, sense: ev.target.value })} maxLength={48} /></label>
                </div>
                {effFormError ? <p className="cs-rule-note">{effFormError}</p> : null}
                <div className="cs-effect-form-actions">
                  <button type="button" className="cs-glass-btn" onClick={addCustomEffect}>Add effect</button>
                  <button type="button" className="cs-glass-btn" onClick={() => { setShowEffectForm(false); setEffFormError(null); }}>Cancel</button>
                </div>
              </div>
            ) : null}
          </section>
        );
      }
      case "attacks": {
        const staticWeaponDefs = (equipment.weaponIds ?? []).map((wid) => getWeapon(wid)).filter((w): w is WeaponDef => !!w);
        const inventoryWeaponDefs = (equipment.weaponItemIds ?? [])
          .map((id) => props.character.inventory.find((item) => item.id === id))
          .filter((item): item is InventoryItem => !!item)
          .map((item) => inventoryWeaponToDef(item))
          .filter((weapon): weapon is WeaponDef => !!weapon);
        const weaponDefs = [...staticWeaponDefs, ...inventoryWeaponDefs];
        const rows = weaponDefs.length > 0
          ? weaponDefs.map((w) => {
              const ability = weaponAbility(w, props.finalAbilities);
              const mod = abilityModifier(props.finalAbilities[ability]);
              const itemBonus = w.bonus ?? 0;
              const damageMod = mod + itemBonus + effDamage;
              const dice = parseDamageDice(w.damage);
              const hasDice = dice.length > 0;
              const versatileDice = w.versatile ? parseDamageDice(w.versatile) : null;
              const damageType = w.damageType ? ` ${w.damageType}` : "";
              return { id: w.id, name: w.name, ability, toHit: mod + pb + ruleAttack + itemBonus, mod: damageMod, dice, hasDice, versatileDice, damageLabel: `${w.damage}${damageMod !== 0 ? ` ${signed(damageMod)}` : ""}${damageType}${w.versatile ? ` (${w.versatile} two-handed)` : ""}` };
            })
          : heroClass.actions.map((action) => {
              const mod = abilityModifier(props.finalAbilities[action.ability]);
              const damageMod = mod + effDamage;
              const dice = parseDamageDice(action.formula);
              const hasDice = dice.length > 0;
              return { id: action.name, name: action.name, ability: action.ability, toHit: mod + pb + ruleAttack, mod: damageMod, dice, hasDice, versatileDice: null, damageLabel: `${action.formula}${damageMod !== 0 ? ` ${signed(damageMod)}` : ""}${action.damageType ? ` ${action.damageType}` : ""}` };
            });
        return (
          <section className="cs-block">
            <h3 className="cs-section-eyebrow"><Swords size={12} />Attacks</h3>
            {rows.length > 0 ? (<table className="cs-action-table"><thead><tr><th>Name</th><th>To-Hit</th><th>Damage</th><th></th></tr></thead><tbody>{rows.map((row) => (<tr key={row.id} className="cs-action-row-click" onClick={() => rollD20ForAbility(row.name, row.toHit, row.ability)} role="button" tabIndex={0} aria-label={`Roll ${row.name}, ${signed(row.toHit)} to hit`} title={d20OptionsForAbility(row.ability) ? "Armor proficiency penalty: rolls with disadvantage" : undefined} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rollD20ForAbility(row.name, row.toHit, row.ability); } }}><td>{row.name}</td><td>{signed(row.toHit)}</td><td>{row.damageLabel}</td><td className="cs-dmg-btns">{row.hasDice ? row.dice.map((d, di) => (<button key={di} type="button" className="cs-glass-btn cs-dmg-roll" title={`Roll ${d.count}d${d.sides}${row.mod !== 0 ? ` ${signed(row.mod)}` : ""} damage`} onClick={(e) => { e.stopPropagation(); props.onRoll(`${row.name} damage`, d.sides, d.count, row.mod); }}>{d.count}d{d.sides}{row.mod !== 0 ? `${signed(row.mod)}` : ""}</button>)) : (<span className="cs-muted">{row.mod !== 0 ? signed(row.mod) : "—"}</span>)}{row.versatileDice ? row.versatileDice.map((d, di) => (<button key={`v-${di}`} type="button" className="cs-glass-btn cs-dmg-roll" title={`Roll ${d.count}d${d.sides}${row.mod !== 0 ? ` ${signed(row.mod)}` : ""} two-handed`} onClick={(e) => { e.stopPropagation(); props.onRoll(`${row.name} two-handed`, d.sides, d.count, row.mod); }}>{d.count}d{d.sides}{row.mod !== 0 ? `${signed(row.mod)}` : ""}</button>)) : null}</td></tr>))}</tbody></table>) : <p className="cs-muted">No attacks configured</p>}
            {weaponDefs.length === 0 && rows.length > 0 ? <p className="cs-rule-note">Class defaults — equip weapons in the Equipment section to customize.</p> : null}
          </section>
        );
      }
      case "features": return (
        <section className="cs-reftabs">
          <div className="cs-reftablist" role="tablist" aria-label="Character reference">{visibleTabs.map((t, i) => (<button key={t.id} role="tab" type="button" className={`cs-reftab${refTab === t.id ? " is-active" : ""}`} aria-selected={refTab === t.id} aria-controls={`reftab-${t.id}`} tabIndex={refTab === t.id ? 0 : -1} onClick={() => setRefTab(t.id)} onKeyDown={(e) => handleRefTabKey(e, i)}>{t.label}</button>))}</div>
          <div className="cs-reftab-panel" id={`reftab-${refTab}`} role="tabpanel" aria-label={visibleTabs.find((t) => t.id === refTab)?.label}>
            <div className={refTab === "features" ? "" : "cs-reftab-hidden"}>
              <div className="cs-feature-group">
                <span className="cs-spell-level-head">Class Features</span>
                {featuresUpToLevel.length > 0 ? featuresUpToLevel.map((f, i) => (<div className="cs-feature-card" key={`${f.name}-${i}`}><strong>{f.name}</strong><p>{f.description}</p></div>)) : <p className="cs-muted">No class features at this level</p>}
              </div>
              {subclassFeatures.length > 0 ? (
                <div className="cs-feature-group">
                  <span className="cs-spell-level-head">Subclass Features</span>
                  {subclassFeatures.map((f, i) => (<div className="cs-feature-card" key={`sub-${f.name}-${i}`}><strong>Lv {f.level}: {f.name}</strong><p>{f.description}</p></div>))}
                </div>
              ) : props.character.subclassId ? (
                <div className="cs-feature-group"><p className="cs-muted">Subclass features not yet available at this level</p></div>
              ) : availableSubclasses.length > 0 ? (
                <div className="cs-feature-group">
                  <span className="cs-spell-level-head">Choose Subclass</span>
                  <p className="cs-muted">Use the level-up button to select a subclass at level {heroClass.subclassLevel ?? 3}</p>
                </div>
              ) : null}
            </div>
            <div className={refTab === "traits" ? "" : "cs-reftab-hidden"}>{race.traits.length > 0 ? (<div className="cs-feature-group"><span className="cs-spell-level-head">Racial Traits</span>{race.traits.map((trait) => (<div className="cs-feature-card" key={trait.name}><strong>{trait.name}</strong><p>{trait.description}</p></div>))}</div>) : <p className="cs-muted">No racial traits</p>}{heroClass.coreTraits.length > 0 ? (<div className="cs-feature-group"><span className="cs-spell-level-head">Core Traits</span>{heroClass.coreTraits.map((trait) => { const ci = trait.indexOf(":"); return (<div className="cs-feature-card" key={trait}>{ci > 0 ? <p><strong>{trait.slice(0, ci + 1)}</strong>{trait.slice(ci + 1)}</p> : <p>{trait}</p>}</div>); })}</div>) : null}</div>
            <div className={refTab === "spells" ? "" : "cs-reftab-hidden"}>
              {casterType !== "none" && spellAbility ? (
                <div className="cs-spellcast-head">
                  Spell save DC {saveDC} &middot; Spell attack {signed(spellAttack)}
                  {_isPrepared ? <> &middot; Prepared {preparedIds.length}/{prepLimit}</> : null}
                </div>
              ) : null}
              {spellcastingBlockedByArmor ? <p className="cs-rule-note cs-rule-warning">{armorPenaltyReason}: you cannot cast spells while equipped this way.</p> : null}
              {props.character.concentratingOn ? (
                <div className="cs-conc-banner">Concentrating on <strong>{props.character.concentratingOn}</strong>
                  <button type="button" className="cs-glass-btn" onClick={() => props.onUpdate({ concentratingOn: null })}>End</button>
                </div>
              ) : null}
              {isKnownCasterNotWizard ? (
                <div className="cs-spellbook-manager">
                  <div className="cs-spellbook-head">
                    <span className="cs-spell-level-head">Spells Known</span>
                    <small>
                      {props.character.spellsKnown.length} known
                      {knownSpellsCumulativeMax > 0 ? ` (max ${knownSpellsCumulativeMax} at this level)` : ""}
                    </small>
                  </div>
                  {knownSpells.length > 0 ? (
                    <div className="cs-spellbook-known">
                      {knownSpells.map((spell) => (
                        <span key={spell.id} className="cs-known-spell-chip">
                          {spell.name}
                          <span>{spell.level === 0 ? "Cantrip" : `Lv ${spell.level}`}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="cs-muted">No spells known. Learn spells when you level up.</p>
                  )}
                </div>
              ) : null}
              {knownSpells.length > 3 ? (
                <input
                  type="text"
                  className="cs-spell-search"
                  placeholder="Search spells…"
                  value={spellSearch}
                  onChange={(e) => setSpellSearch(e.target.value)}
                  aria-label="Search spells"
                />
              ) : null}
              <div className="cs-spell-list">{Object.entries(filteredSpellsByLevel).sort(([a],[b]) => Number(a)-Number(b)).map(([level, spells]) => {
                const lvlNum = Number(level);
                const max = slotMax[lvlNum - 1] ?? 0;
                const used = isPactCaster ? (max > 0 ? pactUsed : 0) : (slotsUsed[lvlNum] ?? 0);
                const shown = canManageSpellbook && lvlNum > 0
                  ? spells.filter((s) => preparedIds.includes(s.id))
                  : spells;
                if (shown.length === 0 && max === 0) return null;
                return (<div key={level} className="cs-spell-group">
                  <span className="cs-spell-level-head">
                    {level === "0" ? "Cantrips" : `Level ${level}`}
                    {lvlNum > 0 && max > 0 ? (<span className="cs-slot-pips">{Array.from({length: max}, (_, i) => (<button key={i} type="button" className={`cs-slot-pip${i < used ? " cs-slot-used" : ""}`} aria-pressed={i < used} onClick={() => i < used ? recoverSlot(lvlNum) : spendSlot(lvlNum)} aria-label={i < used ? `Recover level ${lvlNum} slot` : `Spend level ${lvlNum} slot`} />))}</span>) : null}
                    <span className="sr-only" aria-live="polite">{lvlNum > 0 ? `Level ${lvlNum} spells: ${max - used} of ${max} slots remaining` : ""}</span>
                  </span>
                  {shown.map((spell) => {
                    const status = spellStatuses[spell.id];
                    const source = status?.source?.trim();
                    return (
                      <div className="cs-spell-card" key={spell.id} onClick={() => setSpellDetail(spell)}>
                        {!canManageSpellbook && _isPrepared && spell.level > 0 ? (<button type="button" className={`cs-prof-marker cs-prof-click cs-prep-marker${preparedIds.includes(spell.id) ? " cs-prof" : ""}`} onClick={(e) => { e.stopPropagation(); togglePrepared(spell.id); }} aria-label={`${preparedIds.includes(spell.id) ? "Unprepare" : "Prepare"} ${spell.name}`} title={preparedIds.includes(spell.id) ? "Prepared" : "Prepare"}>{preparedIds.includes(spell.id) ? "●" : "○"}</button>) : null}
                        <strong>{spell.name}</strong>
                        <span>{spell.school}{spell.ritual ? " (ritual)" : ""}{spell.concentration ? " \u2022 concentration" : ""} &middot; {spell.castingTime}</span>
                        {source || status?.freeUse ? (
                          <div className="cs-spell-status-badges">
                            {source ? <span>{source}</span> : null}
                            {status?.freeUse ? <span className={status.freeUsed ? "used" : "ready"}>{status.freeUsed ? "Free use spent" : "Free use ready"}</span> : null}
                          </div>
                        ) : null}
                        <p>{spell.description.slice(0, 120)}{spell.description.length > 120 ? "…" : ""}</p>
                      </div>
                    );
                  })}
                </div>);
              })}</div>
            </div>
            {/* ── Spellbook tab (wizard only) ── */}
            <div className={refTab === "spellbook" ? "" : "cs-reftab-hidden"}>
              <div className="cs-spellbook-panel cs-spellbook-library-only">
                <div className="cs-spellbook-library">
                  <div className="cs-spellbook-head">
                    <span className="cs-spell-level-head">Spellbook</span>
                    <small>{spellbookSpells.length} in spellbook{_maxSpellLvl > 0 ? ` / spells up to level ${_maxSpellLvl}` : ""}</small>
                  </div>
                  <div className="cs-spellbook-add">
                    <select
                      value={spellToLearn}
                      onChange={(event) => setSpellToLearn(event.target.value)}
                      aria-label="Choose a spell to learn"
                    >
                      <option value="">Choose a spell</option>
                      {spellbookChoices.map((spell) => (
                        <option key={spell.id} value={spell.id}>
                          {spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} - {spell.name}
                        </option>
                      ))}
                    </select>
                    <button className="cs-glass-btn" type="button" disabled={!spellToLearn} onClick={() => learnSpell(spellToLearn)}>
                      Add
                    </button>
                  </div>
                  <input
                    type="text"
                    className="cs-spell-search"
                    placeholder="Search spellbook…"
                    value={spellbookSearch}
                    onChange={(e) => setSpellbookSearch(e.target.value)}
                    aria-label="Search spellbook"
                  />
                  <label className="cs-spellbook-sort">
                    <span>Sort by</span>
                    <select value={spellbookSort} onChange={(e) => setSpellbookSort(e.target.value as "level" | "name")} aria-label="Sort spellbook">
                      <option value="level">Level</option>
                      <option value="name">Name</option>
                    </select>
                  </label>
                  <div className="cs-spell-list">
                    {Object.entries(filteredSpellbookByLevel).sort(([a],[b]) => Number(a)-Number(b)).map(([level, spells]) => {
                      if (spells.length === 0) return null;
                      return (
                        <div key={level} className="cs-spell-group">
                          <span className="cs-spell-level-head">{level === "0" ? "Cantrips" : `Level ${level}`}</span>
                          {spells.map((spell) => (
                            <div className="cs-spell-card cs-spellbook-entry" key={spell.id} onClick={() => setSpellDetail(spell)}>
                              <strong>{spell.name}</strong>
                              <span>{spell.school}{spell.ritual ? " (ritual)" : ""}{spell.concentration ? " \u2022 concentration" : ""} &middot; {spell.castingTime}</span>
                              {spell.level > 0 ? (
                                <button
                                  type="button"
                                  className={`cs-glass-btn cs-spellbook-prepare${preparedIds.includes(spell.id) ? " is-prepared" : ""}`}
                                  disabled={!preparedIds.includes(spell.id) && preparedIds.length >= prepLimit}
                                  onClick={(e) => { e.stopPropagation(); togglePrepared(spell.id); }}
                                  aria-pressed={preparedIds.includes(spell.id)}
                                  aria-label={`${preparedIds.includes(spell.id) ? "Unprepare" : "Prepare"} ${spell.name}`}
                                >
                                  {preparedIds.includes(spell.id) ? "Unprepare" : "Prepare"}
                                </button>
                              ) : <span className="cs-spellbook-cantrip">Cantrip</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  {spellbookChoices.length === 0 ? <p className="cs-muted">No additional spells available at this level.</p> : null}
                </div>
              </div>
            </div>
            <div className={refTab === "inventory" ? "" : "cs-reftab-hidden"}>
              <div className="cs-currency-panel">
                <div className="cs-currency-row">
                  {(["cp", "sp", "ep", "gp", "pp"] as const).map((denomination) => (
                    <label className="cs-currency-field" key={denomination}>
                      <span>{denomination.toUpperCase()}</span>
                      <input
                        type="number"
                        min={0}
                        value={currency[denomination]}
                        onChange={(e) =>
                          props.onUpdate({
                            currency: { ...currency, [denomination]: Math.max(0, Number(e.target.value) || 0) },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                {capacity ? (
                  <p className={`cs-rule-note${carriedWeight > capacity.max ? " cs-rule-warning" : ""}`}>
                    Carrying {carriedWeight.toFixed(1)} / {capacity.max} lb
                    {capacity.encumberedAt !== undefined && carriedWeight >= capacity.heavilyEncumberedAt!
                      ? " — heavily encumbered (speed −20 ft., disadvantage on attacks/STR/DEX saves)"
                      : capacity.encumberedAt !== undefined && carriedWeight >= capacity.encumberedAt
                        ? " — encumbered (speed −10 ft.)"
                        : carriedWeight > capacity.max
                          ? " — over capacity (speed 0)"
                          : ""}
                  </p>
                ) : null}
              </div>
              <div className="cs-item-catalog">
                <div className="cs-item-catalog-head">
                  <span>Item catalog</span>
                  <small>{ITEM_CATALOG.length} items</small>
                </div>
                <div className="cs-item-catalog-controls">
                  <input
                    type="search"
                    placeholder="Search items..."
                    aria-label="Search items"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                  <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}>
                    <option value="All">All categories</option>
                    {ITEM_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <select value={itemRarity} onChange={(e) => setItemRarity(e.target.value)}>
                    <option value="All">All rarities</option>
                    {ITEM_RARITIES.map((rarity) => <option key={rarity} value={rarity} data-rarity={rarity}>{rarity}</option>)}
                  </select>
                </div>
                <div className="cs-item-results">
                  {visibleItemMatches.map((item) => (
                    <div className="cs-item-result" key={item.id}>
                      <div>
                        <strong data-rarity={item.rarity}>{item.name}</strong>
                        <span>{[item.rarity, ...itemMetaParts(item)].filter(Boolean).join(" | ")}</span>
                        {item.description ? <p>{item.description.slice(0, 180)}{item.description.length > 180 ? "..." : ""}</p> : null}
                      </div>
                      <button type="button" className="cs-glass-btn" onClick={() => addCatalogItem(item)}>Add</button>
                    </div>
                  ))}
                  {visibleItemMatches.length === 0 ? <p className="cs-muted">No matching items</p> : null}
                </div>
                {itemMatches.length > visibleItemMatches.length ? (
                  <p className="cs-item-more">Showing {visibleItemMatches.length} of {itemMatches.length}. Narrow the search to find a specific item.</p>
                ) : null}
              </div>

              {props.character.inventory.length > 0 ? (
                <div className="cs-inv-list">{props.character.inventory.map((item) => {
                  const canEquipArmor = isArmorItem(item);
                  const canEquipShield = isShieldItem(item);
                  const canEquipWeapon = isWeaponItem(item);
                  const canEquipBonus = itemHasPassiveBonus(item) && !canEquipArmor && !canEquipShield;
                  const armorProfInfo = canEquipArmor ? inventoryArmorProficiencyInfo(item) : null;
                  const armorIsProficient = !armorProfInfo || isArmorCategoryProficient(effectiveProficiencies, armorProfInfo.category);
                  const shieldIsProficient = !canEquipShield || isShieldProficient(effectiveProficiencies);
                  const equippedAsArmor = equipment.armorItemId === item.id;
                  const equippedAsShield = equipment.shieldItemId === item.id;
                  const equippedAsWeapon = (equipment.weaponItemIds ?? []).includes(item.id);
                  const equippedAsBonus = (equipment.bonusItemIds ?? []).includes(item.id);
                  return (
                    <div className={`cs-inv-row${equippedAsArmor || equippedAsShield || equippedAsWeapon || equippedAsBonus ? " cs-inv-equipped" : ""}`} key={item.id}>
                      <div>
                        <strong data-rarity={item.rarity}>{item.name}</strong>
                        {item.notes ? <span>{item.notes}</span> : null}
                        {canEquipArmor || canEquipShield || canEquipWeapon || canEquipBonus ? (
                          <div className="cs-inv-actions">
                            {canEquipArmor ? <button type="button" className={`cs-glass-btn${equippedAsArmor ? " cs-edit-active" : ""}${armorIsProficient ? "" : " cs-equip-warning"}`} onClick={() => equipInventoryArmor(item)} title={armorIsProficient ? undefined : "Not proficient with this armor"}>{equippedAsArmor ? "Equipped armor" : "Equip armor"}{armorIsProficient ? "" : " (not proficient)"}</button> : null}
                            {canEquipShield ? <button type="button" className={`cs-glass-btn${equippedAsShield ? " cs-edit-active" : ""}${shieldIsProficient ? "" : " cs-equip-warning"}`} onClick={() => equipInventoryShield(item)} title={shieldIsProficient ? undefined : "Not proficient with shields"}>{equippedAsShield ? "Equipped shield" : "Equip shield"}{shieldIsProficient ? "" : " (not proficient)"}</button> : null}
                            {canEquipWeapon ? <button type="button" className={`cs-glass-btn${equippedAsWeapon ? " cs-edit-active" : ""}`} onClick={() => toggleInventoryWeapon(item.id)}>{equippedAsWeapon ? "Equipped weapon" : "Equip weapon"}</button> : null}
                            {canEquipBonus ? <button type="button" className={`cs-glass-btn${equippedAsBonus ? " cs-edit-active" : ""}`} onClick={() => toggleBonusItem(item.id)}>{equippedAsBonus ? "Bonus active" : "Equip bonus"}</button> : null}
                          </div>
                        ) : null}
                        {item.description ? (
                          <details className="cs-inv-details">
                            <summary>Details</summary>
                            <p>{item.description}</p>
                          </details>
                        ) : null}
                      </div>
                      <div className="cs-inv-meta"><span data-rarity={item.rarity}>{item.rarity}</span>{item.attunement ? <span className="cs-attune">Attunement</span> : null}<button type="button" className="cs-inv-del" onClick={() => removeItem(item.id)} title="Remove item" aria-label={`Remove ${item.name}`}>&times;</button></div>
                    </div>
                  );
                })}</div>
              ) : <p className="cs-muted">No items in inventory</p>}
              {showInvForm ? (
                <div className="cs-inv-form">
                  <input type="text" placeholder="Item name" aria-label="Item name" value={invName} onChange={(e) => setInvName(e.target.value)} maxLength={100} />
                  <select value={invRarity} onChange={(e) => setInvRarity(e.target.value)}>
                    <option value="Mundane">Mundane</option>
                    <option value="Common">Common</option>
                    <option value="Uncommon">Uncommon</option>
                    <option value="Rare">Rare</option>
                    <option value="Very Rare">Very Rare</option>
                    <option value="Legendary">Legendary</option>
                  </select>
                  <input type="text" placeholder="Notes (optional)" aria-label="Item notes" value={invNotes} onChange={(e) => setInvNotes(e.target.value)} maxLength={200} />
                  <input type="number" placeholder="Weight (lb, optional)" aria-label="Item weight in pounds" min={0} value={invWeight} onChange={(e) => setInvWeight(e.target.value)} />
                  <div className="cs-inv-form-actions">
                    <button type="button" className="cs-glass-btn" onClick={addItem}>Add</button>
                    <button type="button" className="cs-glass-btn" onClick={() => setShowInvForm(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="cs-glass-btn cs-inv-add" onClick={() => setShowInvForm(true)}>+ Add item</button>
              )}
            </div>
          </div>
        </section>
      );
      case "notes": return (
        <section className="cs-block"><h3 className="cs-section-eyebrow"><PenLine size={12} />Notes</h3><div className="cs-notes-block">{props.character.physicalCharacteristics ? (<div className="cs-bg-field"><span className="cs-bg-label">Physical Characteristics</span><p>{props.character.physicalCharacteristics}</p></div>) : null}{props.character.personalCharacteristics ? (<div className="cs-bg-field"><span className="cs-bg-label">Personal Characteristics</span><p>{props.character.personalCharacteristics}</p></div>) : null}{props.character.generalNotes ? (<div className="cs-bg-field"><span className="cs-bg-label">General Notes</span><p>{props.character.generalNotes}</p></div>) : null}{!props.character.physicalCharacteristics && !props.character.personalCharacteristics && !props.character.generalNotes ? <p className="cs-muted">No notes recorded</p> : null}</div></section>
      );
      case "background": return (
        <section className="cs-block"><h3 className="cs-section-eyebrow"><UserRound size={12} />Background</h3><div className="cs-bg-block">{props.character.background ? (<div className="cs-bg-field"><span className="cs-bg-label">Background</span><p>{props.character.background}</p></div>) : null}{props.character.alignment ? (<div className="cs-bg-field"><span className="cs-bg-label">Alignment</span><p>{props.character.alignment}</p></div>) : null}</div></section>
      );
      case "pages": {
        const activePage = pages[activePageIndex] ?? null;
        return (
          <section className="cs-block">
            <h3 className="cs-section-eyebrow"><BookOpen size={12} />Pages</h3>
            {pages.length > 0 ? (
              <>
                <div className="cs-page-tabs" role="tablist" aria-label="Character pages">
                  {pages.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={i === activePageIndex}
                      className={`cs-page-tab${i === activePageIndex ? " is-active" : ""}`}
                      onClick={() => setActivePageIndex(i)}
                    >
                      {p.title || "Untitled"}
                    </button>
                  ))}
                  <button type="button" className="cs-page-tab cs-page-add" onClick={addPage}>+ Page</button>
                </div>
                {activePage ? (
                  <div className="cs-page-body">
                    <div className="cs-page-header">
                      <input
                        key={activePage.id}
                        className="cs-page-title-input"
                        type="text"
                        defaultValue={activePage.title}
                        maxLength={60}
                        aria-label="Page title"
                        onBlur={(e) => updatePageTitle(activePage.id, e.target.value)}
                      />
                      <button type="button" className="cs-glass-btn cs-page-delete" onClick={() => deletePage(activePage.id)}>
                        Delete page
                      </button>
                    </div>
                    {activePage.blocks.length > 0 ? (
                      <div className="cs-page-blocks">
                        {activePage.blocks.map((block) => (
                          <div className="cs-page-block" key={block.id}>
                            {block.type === "text" ? (
                              <textarea
                                key={block.id}
                                className="cs-page-text-block"
                                defaultValue={block.content}
                                maxLength={5000}
                                placeholder="Write..."
                                aria-label="Page content"
                                onBlur={(e) => updatePageBlock(activePage.id, block.id, { content: e.target.value })}
                              />
                            ) : (
                              <div className="cs-page-image-block">
                                {block.url && !brokenPageImages.has(block.id) ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- user-provided external URLs cannot be optimized by next/image
                                  <img
                                    src={block.url}
                                    alt={block.caption || "Character page image"}
                                    onError={() => setBrokenPageImages((prev) => new Set(prev).add(block.id))}
                                    onLoad={() =>
                                      setBrokenPageImages((prev) => {
                                        if (!prev.has(block.id)) return prev;
                                        const next = new Set(prev);
                                        next.delete(block.id);
                                        return next;
                                      })
                                    }
                                  />
                                ) : block.url ? (
                                  <p className="cs-muted">Image unavailable</p>
                                ) : null}
                                {block.caption ? <small className="cs-page-caption">{block.caption}</small> : null}
                                <input
                                  key={`${block.id}-url`}
                                  type="text"
                                  placeholder="https://..."
                                  aria-label="Image URL"
                                  defaultValue={block.url}
                                  maxLength={500}
                                  onBlur={(e) => updatePageBlock(activePage.id, block.id, { url: e.target.value.trim() })}
                                />
                                <input
                                  key={`${block.id}-caption`}
                                  type="text"
                                  placeholder="Caption (optional)"
                                  aria-label="Image caption"
                                  defaultValue={block.caption ?? ""}
                                  maxLength={120}
                                  onBlur={(e) => updatePageBlock(activePage.id, block.id, { caption: e.target.value.trim() || undefined })}
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              className="cs-page-block-del"
                              aria-label="Remove block"
                              onClick={() => removePageBlock(activePage.id, block)}
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="cs-muted">No blocks yet</p>}
                    <div className="cs-page-add-controls">
                      <button type="button" className="cs-glass-btn" onClick={() => addPageBlock(activePage.id, "text")}>+ Text</button>
                      <button type="button" className="cs-glass-btn" onClick={() => addPageBlock(activePage.id, "image")}>+ Image</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p className="cs-muted">No pages yet — add a journal, backstory, or map.</p>
                <button type="button" className="cs-glass-btn" onClick={addPage}>+ Page</button>
              </>
            )}
          </section>
        );
      }
      case "console": return (
        <section className="cs-block"><h3 className="cs-section-eyebrow"><Terminal size={12} />Console</h3><form className="cs-console-form" onSubmit={props.onConsoleSubmit}><label className="cs-console-label"><Terminal size={14} />Command<input value={props.consoleInput} onChange={(e) => props.onConsoleInput(e.target.value)} className="cs-console-input" /></label><button className="cs-glass-btn" type="submit">Execute</button><div className="cs-console-log">{props.consoleLog.map((entry, i) => (<span key={`${entry}-${i}`}>{entry}</span>))}</div></form></section>
      );
      default: return null;
    }
  };

  /* ── Render ── */
  const allIds = layout.columns.flat().filter((id) => !hiddenIds.includes(id));
  const skinMenuThemeVars = theme ? {
    ...themeVars,
    "--ground": "var(--paper)",
    "--ground-2": "var(--paper)",
    "--ground-3": "var(--paper-raised)",
    "--parchment": "var(--ink)",
    "--parchment-2": "var(--ink-2)",
    "--ink-faint": "var(--ink-3)",
    "--rule": "var(--doc-rule)",
    "--rule-soft": "var(--doc-rule-soft)",
    "--accent": "var(--doc-accent)",
    "--accent-deep": "var(--doc-accent-deep)",
    "--select": "var(--doc-select)",
  } : {};
  const skinMenuStyle = skinMenuPosition ? ({
    ...skinMenuThemeVars,
    top: skinMenuPosition.top,
    left: skinMenuPosition.left,
    minWidth: skinMenuPosition.minWidth,
    maxHeight: skinMenuPosition.maxHeight,
  } as CSSProperties) : undefined;
  const skinPresetMenu = showPresets && skinMenuPosition ? createPortal(
    <div ref={skinMenuRef} className="cs-skin-dropdown" style={skinMenuStyle} role="menu" aria-label="Skin presets">
      {SKIN_PRESETS.map((p) => (
        <button key={p.id} type="button" className="cs-skin-option" role="menuitem" onClick={() => applyPreset(p.id)}>
          {p.name}
        </button>
      ))}
      {(() => {
        if (typeof window === "undefined") return null;
        try {
          const raw = localStorage.getItem("forge-and-fable-user");
          if (!raw) return null;
          const u = JSON.parse(raw) as { id?: string };
          if (!u.id) return null;
          const userPresets = loadUserPresets(u.id);
          if (userPresets.length === 0) return null;
          return (
            <>
              <div className="cs-skin-dropdown-divider" />
              {userPresets.map((p) => (
                <button key={p.id} type="button" className="cs-skin-option" role="menuitem" onClick={() => applyPreset(p.id)}>
                  {p.name}
                </button>
              ))}
            </>
          );
        } catch { return null; }
      })()}
      <div className="cs-skin-dropdown-divider" />
      <button key="custom" type="button" className="cs-skin-option" role="menuitem" onClick={() => { setShowAppearance(true); setShowPresets(false); }}>
        Customize...
      </button>
      {theme ? (
        <button key="reset" type="button" className="cs-skin-option" role="menuitem" onClick={() => { props.onUpdate({ theme: null }); setShowPresets(false); }}>
          Reset to default
        </button>
      ) : null}
    </div>,
    document.body,
  ) : null;
  const spellDetailStatus = spellDetail ? spellStatuses[spellDetail.id] ?? {} : {};
  const spellDetailSource = spellDetailStatus.source?.trim() ?? "";

  return (
    <div className={`cs-sheet${editMode ? " cs-editing" : ""}`} style={themeVars} data-bg={theme?.backgroundImageUrl ? "custom" : theme?.backgroundKey ?? "parchment"} {...(isReadOnly ? { "data-readonly": "" } : {})}>
      {isReadOnly ? (
        <div className="cs-readonly-banner">Viewing <strong>{props.character.name}</strong> (read-only)</div>
      ) : null}
      <div className="cs-sheet-tools" role="toolbar" aria-label="Sheet tools">
        {!isReadOnly && <button ref={skinButtonRef} className="cs-glass-btn cs-skin-btn" type="button" onClick={toggleSkinMenu} title="Appearance" aria-haspopup="menu" aria-expanded={showPresets}><Paintbrush size={13} /> Skin<ChevronDown size={10} /></button>}
        {!isReadOnly && <button className={`cs-glass-btn${editMode ? " cs-edit-active" : ""}`} type="button" onClick={() => setEditMode(!editMode)} title="Customize layout" aria-pressed={editMode}><GripHorizontal size={13} />Layout</button>}
        {!isReadOnly && editMode ? <button className="cs-glass-btn cs-reset-layout" type="button" onClick={resetLayout} title="Reset layout"><RotateCcw size={13} />Reset</button> : null}
      </div>
      {!tourDismissed ? (
        <div className="cs-tour-card">
          <div>
            <span className="cs-section-eyebrow">First look</span>
            <p>Click stats to roll.</p>
            <p>Adv/Dis lives in the dice drawer.</p>
            <p>Effects handles Bless and +1 weapons.</p>
            <p>Skin themes the sheet; Layout rearranges sections.</p>
          </div>
          <button type="button" className="cs-glass-btn" onClick={dismissTour}>Got it</button>
        </div>
      ) : null}
      {/* Full-width banner: identity + vitals (pinned, not draggable). */}
      <div className="cs-sheet-top">
        {PINNED_TOP.map((id) => (
          <div className="cs-section cs-pinned" data-section-id={id} key={id}>
            {sectionContent(id)}
          </div>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
          <div className="cs-sheet-columns" ref={columnsRef}>
            {layout.columns.map((col, ci) => (
              <Fragment key={ci}>
                <div
                  className="cs-sheet-col"
                  style={layout.columnWidths ? { flex: `0 0 ${layout.columnWidths[ci]}%`, maxWidth: "none", minWidth: 0 } : undefined}
                >
                  {/* Divider lives INSIDE the column (absolute, right edge): a
                      sibling element would shift the :nth-child width rules. */}
                  {editMode && ci < layout.columns.length - 1 ? (
                    <div className="cs-col-divider" role="separator" aria-orientation="vertical" title="Drag to resize columns" onPointerDown={(e) => startColumnDrag(ci, e)} />
                  ) : null}
                  {col.map((id) =>
                    hiddenIds.includes(id) ? (
                      editMode ? (
                        <div className="cs-section cs-hidden-ghost" key={id}>
                          <span className="cs-section-title">{SECTION_TITLES[id]}</span>
                          <button type="button" className="cs-glass-btn" onClick={() => toggleHidden(id)}>Show</button>
                        </div>
                      ) : null
                    ) : (
                      <SheetSection key={id} id={id} title={SECTION_TITLES[id]} collapsed={collapsed.includes(id)} onToggle={() => toggleCollapse(id)} editMode={editMode} onHide={() => toggleHidden(id)}>
                        {sectionContent(id)}
                      </SheetSection>
                    ),
                  )}
                </div>
              </Fragment>
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="cs-drag-overlay-card">
              <span className="cs-section-title">{SECTION_TITLES[activeId as SheetSectionId] ?? activeId}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {skinPresetMenu}

      {/* Full-width banner: console (pinned, not draggable). */}
      <div className="cs-sheet-bottom">
        {PINNED_BOTTOM.map((id) => (
          <div className="cs-section cs-pinned" data-section-id={id} key={id}>
            {sectionContent(id)}
          </div>
        ))}
      </div>

      {showAppearance ? (<AppearancePanel theme={theme ?? undefined} onUpdate={(t) => { props.onUpdate({ theme: t ?? null }); }} onClose={() => setShowAppearance(false)} />) : null}
      {spellDetail ? (
        <div className="cs-spell-detail-overlay" onClick={() => setSpellDetail(null)}>
          <div className="cs-spell-detail" onClick={(e) => e.stopPropagation()}>
            <button className="cs-spell-detail-close" type="button" onClick={() => setSpellDetail(null)} aria-label="Close">&times;</button>
            <h3 className="cs-section-eyebrow">{spellDetail.name}</h3>
            <p className="cs-spell-detail-meta">{spellDetail.level === 0 ? "Cantrip" : `Level ${spellDetail.level}`} {spellDetail.school}{spellDetail.ritual ? " (ritual)" : ""}{spellDetail.concentration ? " · Concentration" : ""}</p>
            {(spellDetail.damageEffect || spellDetail.save) ? (
              <p className="cs-spell-damage-type">
                {spellDetail.damageEffect ? <><strong>Damage:</strong> {spellDetail.damageEffect}</> : null}
                {spellDetail.damageEffect && spellDetail.save ? " · " : null}
                {spellDetail.save ? <><strong>Save:</strong> {spellDetail.save} vs DC {saveDC}</> : null}
                {spellDetail.save && !spellDetail.attack ? " · Half on success" : null}
              </p>
            ) : null}
            <div className="cs-spell-detail-grid">
              <span><strong>Casting Time</strong> {spellDetail.castingTime}</span>
              <span><strong>Range</strong> {spellDetail.range || "—"}</span>
              <span><strong>Duration</strong> {spellDetail.duration || "—"}</span>
              <span><strong>Area</strong> {spellDetail.area || "—"}</span>
              <span><strong>Components</strong> {[spellDetail.components.verbal ? "V" : "", spellDetail.components.somatic ? "S" : "", spellDetail.components.material ? `M (${spellDetail.material})` : ""].filter(Boolean).join(", ") || "—"}</span>
              <span><strong>Source</strong> {spellDetail.source}</span>
            </div>
            <div className="cs-spell-status-panel">
              <label>
                <span>Granted from</span>
                <input
                  type="text"
                  defaultValue={spellDetailSource}
                  placeholder="Fey Touched feat"
                  maxLength={80}
                  onBlur={(event) => updateSpellStatus(spellDetail.id, { source: event.currentTarget.value })}
                  onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                />
              </label>
              <label className="cs-spell-status-check">
                <input
                  type="checkbox"
                  checked={!!spellDetailStatus.freeUse}
                  onChange={(event) => updateSpellStatus(spellDetail.id, { freeUse: event.currentTarget.checked, freeUsed: false })}
                />
                Track one free use per long rest
              </label>
              {spellDetailStatus.freeUse ? (
                <label className="cs-spell-status-check">
                  <input
                    type="checkbox"
                    checked={!!spellDetailStatus.freeUsed}
                    onChange={(event) => updateSpellStatus(spellDetail.id, { freeUse: true, freeUsed: event.currentTarget.checked })}
                  />
                  Free use spent since last long rest
                </label>
              ) : null}
            </div>
            {spellcastingBlockedByArmor ? <p className="cs-rule-note cs-rule-warning">{armorPenaltyReason}: you cannot cast spells while equipped this way.</p> : null}
            {spellDetail.attack ? <p className="cs-spell-detail-roll"><strong>Attack:</strong> {spellDetail.attack} — <button className="cs-glass-btn" type="button" disabled={spellcastingBlockedByArmor} title={spellBlockTitle} onClick={() => rollD20(`${spellDetail.name} attack`, spellAttack)}>Roll {signed(spellAttack)}</button></p> : null}
            {spellDetail.save ? <p className="cs-spell-detail-roll"><strong>Save:</strong> {spellDetail.save} vs DC {saveDC}</p> : null}
            <p className="cs-spell-detail-desc">{spellDetail.description}</p>
            {casterType !== "none" || spellDetailStatus.freeUse ? (
              <div className="cs-spell-detail-cast">
                <div className="cs-cast-row">
                  <strong>Cast:</strong>
                  {casterType !== "none" && spellDetail.level === 0 ? (
                    <button className="cs-glass-btn" type="button" disabled={spellcastingBlockedByArmor} title={spellBlockTitle} onClick={() => castSpell(spellDetail, 0)}>Cast cantrip</button>
                  ) : (
                    <>
                      {spellDetailStatus.freeUse ? (
                        <button className="cs-glass-btn" type="button" disabled={!!spellDetailStatus.freeUsed || spellcastingBlockedByArmor} onClick={() => castFreeSpell(spellDetail)} title={spellcastingBlockedByArmor ? spellBlockTitle : spellDetailStatus.freeUsed ? "Free use already spent" : "Cast without spending a spell slot"}>
                          {spellDetailStatus.freeUsed ? "Free use spent" : "Cast free"}
                        </button>
                      ) : null}
                      {slotMax.map((max, i) => {
                        const lvl = i + 1;
                        if (lvl < spellDetail.level || max <= 0) return null;
                        // Pact casters track usage in pactSlotsUsed, not the
                        // per-level spellSlotsUsed map — mirror the level-list
                        // logic so "remaining" and the disabled state are right.
                        const used = isPactCaster ? pactUsed : (slotsUsed[lvl] ?? 0);
                        const remaining = max - used;
                        const dicePreview = previewDiceForLevel(spellDetail, lvl);
                        const btnLabel = dicePreview
                          ? `Cast ${spellDetail.name} at level ${lvl}, rolling ${dicePreview}`
                          : `Cast ${spellDetail.name} at level ${lvl}`;
                        return (
                          <button
                            key={lvl}
                            className="cs-glass-btn"
                            type="button"
                            disabled={remaining <= 0 || spellcastingBlockedByArmor}
                            onClick={() => castSpell(spellDetail, lvl)}
                            title={spellcastingBlockedByArmor ? spellBlockTitle : remaining <= 0 ? "No slots left" : `${remaining} slot${remaining === 1 ? "" : "s"} left`}
                            aria-label={btnLabel}
                          >
                            Lv {lvl}{dicePreview ? ` · ${dicePreview}` : ""}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
                {spellDetail.concentration ? <p className="cs-rule-note">Casting starts concentration{props.character.concentratingOn ? ` (ends ${props.character.concentratingOn})` : ""}</p> : null}
                {spellDetail.level > 0 ? (() => {
                  // Show non-interactive scaling reference instead of manual dice buttons.
                  // Upcasting is now handled automatically by the Cast buttons above.
                  const baseEffects = resolveSpellEffects(spellDetail, spellDetail.level);
                  if (baseEffects.length === 0) return null;
                  const first = baseEffects[0];
                  const scalingNote = getScalingNote(spellDetail);
                  return (
                    <div className="cs-spell-reference-dice">
                      {first.type === "damage" ? (
                        <span><strong>Base damage:</strong> {first.dice} {first.damageType}</span>
                      ) : first.type === "healing" ? (
                        <span><strong>Base healing:</strong> {first.dice}</span>
                      ) : null}
                      {scalingNote ? (
                        <span className="cs-spell-scaling-note"> · <strong>Higher levels:</strong> {scalingNote}</span>
                      ) : null}
                    </div>
                  );
                })() : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showAcBreakdown ? (
        <div className="cs-spell-detail-overlay" onClick={() => setShowAcBreakdown(false)}>
          <div className="cs-spell-detail cs-ac-breakdown" onClick={(e) => e.stopPropagation()}>
            <button className="cs-spell-detail-close" type="button" onClick={() => setShowAcBreakdown(false)} aria-label="Close">&times;</button>
            <h3 className="cs-section-eyebrow">Armor Class {armorClass}</h3>
            <div className="cs-ac-breakdown-list">
              {acBreakdown.map((part, i) => (
                <div className="cs-ac-breakdown-row" key={`${part.label}-${i}`}>
                  <span>{part.label}</span>
                  <strong>{i === 0 ? part.value : signed(part.value)}</strong>
                </div>
              ))}
            </div>
            <p className="cs-rule-note">Toggle contributions in Effects &amp; Conditions or the Equipment section.</p>
          </div>
        </div>
      ) : null}
      {levelUpTarget != null ? (
        <LevelUpModal
          character={props.character}
          characterName={props.character.name}
          gainedFeatures={heroClass.levelProgression.find((e) => e.level === levelUpTarget)?.features ?? []}
          newLevel={levelUpTarget}
          finalAbilities={props.finalAbilities}
          classId={heroClass.id}
          className={heroClass.name}
          hitDie={heroClass.hitDie}
          asiLevels={heroClass.asiLevels ?? [4, 8, 12, 16, 19]}
          subclassLevel={getClassData(heroClass.id)?.subclassLevel}
          casterType={heroClass.casterType}
          raceName={race.name}
          proficiencies={heroClass.proficiencies}
          useFeatPrerequisites={props.character.settings.useFeatPrerequisites}
          hitPointType={props.character.settings.hitPointType}
          onHpRoll={({ label, sides, modifier, onResult }) => {
            props.onRoll(label, sides, 1, modifier, ({ rolls, total }) => {
              onResult({ roll: rolls[0] ?? 1, total });
            });
          }}
          onConfirm={(data) => { props.onUpdate(data); setLevelUpTarget(null); }}
          onCancel={() => setLevelUpTarget(null)}
        />
      ) : null}
    </div>
  );
})
