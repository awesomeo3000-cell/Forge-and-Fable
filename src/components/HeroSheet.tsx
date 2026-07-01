"use client";

import {
  Activity,
  ArrowLeftRight,
  Backpack,
  BookOpen,
  ChevronDown,
  GripHorizontal,
  Minus,
  Moon,
  Paintbrush,
  PenLine,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Terminal,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, FormEvent, KeyboardEvent } from "react";
import type { AbilityKey, AbilityScores, Character, Ruleset, SheetLayout, SheetSectionId } from "@/types/game";
import {
  abilityKeys,
  abilityLabels,
  abilityModifier,
  proficiencyBonus,
  signed,
} from "@/lib/utils";
import { SAVE_PROFICIENCIES, SKILLS, type SkillDef } from "@/lib/srd";
import { FONT_STACKS, SKIN_PRESETS } from "@/lib/skins";
import { DEFAULT_LAYOUT, mergeWithDefaults, PINNED_BOTTOM, PINNED_TOP, SECTION_TITLES } from "@/lib/sheetLayout";
import { getSpell, parseDamageDice, PREPARED_CASTERS, spellsForClass } from "@/lib/spells";
import { maxSlots } from "@/lib/spellSlots";
import { getClassData, subclassFeaturesForLevel, subclassesForClass } from "@/lib/subclasses";
import LevelUpModal from "@/components/LevelUpModal";
import type { SpellData, SpellSlots } from "@/types/game";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import AppearancePanel from "@/components/AppearancePanel";
import SheetSection from "@/components/SheetSection";

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

type RefTab = "features" | "traits" | "spells" | "inventory";
type SkinMenuPosition = { top: number; left: number; minWidth: number; maxHeight: number };
type RollOutcome = { rolls: number[]; modifier: number; total: number };

const REF_TABS: { id: RefTab; label: string; Icon: typeof Sparkles }[] = [
  { id: "features", label: "Features", Icon: Sparkles },
  { id: "traits", label: "Traits", Icon: Shield },
  { id: "spells", label: "Spells", Icon: BookOpen },
  { id: "inventory", label: "Inventory", Icon: Backpack },
];

export default memo(function HeroSheet(props: {
  character: Character;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  featInitiativeBonus?: number;
  featAcBonus?: number;
  onRoll: (label: string, sides: number, count?: number, modifier?: number, onResult?: (outcome: RollOutcome) => void) => void;
  onUpdate: (patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) => void;
  onDelete: () => void;
  consoleInput: string;
  consoleLog: string[];
  onConsoleInput: (value: string) => void;
  onConsoleSubmit: (event: FormEvent) => void;
}) {
  const race =
    props.ruleset.races.find((r) => r.id === props.character.raceId) ?? props.ruleset.races[0];
  const heroClass =
    props.ruleset.classes.find((c) => c.id === props.character.classId) ?? props.ruleset.classes[0];

  const pb = proficiencyBonus(props.character.level);
  const dexMod = abilityModifier(props.finalAbilities.dexterity);

  const ruleAc = props.character.customRules.filter((r) => r.type === "ac").reduce((s, r) => s + r.value, 0);
  const armorClass = 10 + dexMod + ruleAc + (props.featAcBonus ?? 0);
  const ruleInit = props.character.customRules.filter((r) => r.type === "initiative").reduce((s, r) => s + r.value, 0);
  const initiative = dexMod + ruleInit + (props.featInitiativeBonus ?? 0);
  const ruleAttack = props.character.customRules.filter((r) => r.type === "attack").reduce((s, r) => s + r.value, 0);
  const ruleSaveAll = props.character.customRules.filter((r) => r.type === "save").reduce((s, r) => s + r.value, 0);

  const proficientSaves: AbilityKey[] =
    props.character.savingThrowProficiencies ?? SAVE_PROFICIENCIES[heroClass.id]?.abilities ?? [];

  const isSaveProficient = (key: AbilityKey) => proficientSaves.includes(key);
  const isSkillProficient = (id: string) => (props.character.skillProficiencies ?? []).includes(id);

  const saveBonus = (key: AbilityKey) => abilityModifier(props.finalAbilities[key]) + (isSaveProficient(key) ? pb : 0) + ruleSaveAll;
  const skillBonus = (s: SkillDef) => abilityModifier(props.finalAbilities[s.ability]) + (isSkillProficient(s.id) ? pb : 0);

  const passiveInsight = 10 + skillBonus(SKILLS.find((s) => s.id === "insight")!);
  const passiveInvestigation = 10 + skillBonus(SKILLS.find((s) => s.id === "investigation")!);
  const passivePerception = 10 + skillBonus(SKILLS.find((s) => s.id === "perception")!);

  const hpPercent = Math.max(0, Math.min(100, (props.character.currentHp / props.character.maxHp) * 100));
  // Prepared casters (cleric/druid/paladin/artificer) have their WHOLE class
  // list available up to their accessible spell level — not a learned subset.
  // Everyone else shows the spells they actually know. (Cantrips stay chosen.)
  const _ct = heroClass.casterType ?? "none";
  const _isPrepared = PREPARED_CASTERS.has(heroClass.id) && _ct !== "none";
  const _maxSpellLvl = maxSlots(_ct, props.character.level).reduce((m, c, i) => (c > 0 ? i + 1 : m), 0);
  const knownSpells: SpellData[] = _isPrepared
    ? [
        ...(props.character.spellsKnown.map((id) => getSpell(id)).filter((s): s is SpellData => !!s && s.level === 0)),
        ...spellsForClass(heroClass.name).filter((s) => s.level >= 1 && s.level <= _maxSpellLvl),
      ]
    : (props.character.spellsKnown.map((id) => getSpell(id)).filter(Boolean) as SpellData[]);
  const spellsByLevel = knownSpells.reduce((acc, spell) => { const lv = spell.level; if (!acc[lv]) acc[lv] = []; acc[lv].push(spell); return acc; }, {} as Record<number, SpellData[]>);
  const featuresUpToLevel = heroClass.levelProgression.filter((e) => e.level <= props.character.level).flatMap((e) => e.features);
  const subclassFeatures = props.character.subclassId
    ? subclassFeaturesForLevel(heroClass.id, props.character.subclassId, props.character.level)
    : [];
  const availableSubclasses = subclassesForClass(heroClass.id);
  const [levelUpTarget, setLevelUpTarget] = useState<number | null>(null);

  const toggleSkillProficiency = (skillId: string) => {
    const cur = props.character.skillProficiencies ?? [];
    props.onUpdate({ skillProficiencies: cur.includes(skillId) ? cur.filter((s) => s !== skillId) : [...cur, skillId] });
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

  const skillsByAbility = abilityKeys.map((k) => ({ ability: k, skills: SKILLS.filter((s) => s.ability === k) }));

  const subtitleParts = [race.name, heroClass.name, props.character.level > 0 ? `Level ${props.character.level}` : null, props.character.background, props.character.alignment].filter(Boolean);

  /* ── Reference tabs ── */
  const visibleTabs = REF_TABS.filter((t) => t.id !== "spells" || knownSpells.length > 0);
  const [refTab, setRefTab] = useState<RefTab>(visibleTabs[0]?.id ?? "features");
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
    "--sheet-font": FONT_STACKS[theme.fontKey],
    "--font-body": FONT_STACKS[theme.fontKey], "--font-display": FONT_STACKS[theme.fontKey],
    "--font-label": FONT_STACKS[theme.fontKey], "--font-mono": FONT_STACKS[theme.fontKey],
    "--bg-opacity": `${theme.backgroundOpacity ?? 0.5}`,
  } as Record<string, string>) : {};
  const applyPreset = (id: string) => {
    const p = SKIN_PRESETS.find((x) => x.id === id);
    if (p) props.onUpdate({ theme: { ...p.theme } });
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
  const casterType = heroClass.casterType ?? "none";
  const spellAbility = heroClass.spellcastingAbility;
  const slotMax = maxSlots(casterType, props.character.level);
  const slotsUsed = props.character.spellSlotsUsed ?? {};
  const saveDC = spellAbility ? 8 + pb + abilityModifier(props.finalAbilities[spellAbility]) : 0;
  const spellAttack = spellAbility ? pb + abilityModifier(props.finalAbilities[spellAbility]) : 0;

  const spendSlot = (lvl: number) => {
    const next: SpellSlots = { ...slotsUsed };
    next[lvl] = Math.min((next[lvl] ?? 0) + 1, slotMax[lvl - 1] ?? 0);
    props.onUpdate({ spellSlotsUsed: next });
  };
  const recoverSlot = (lvl: number) => {
    const next: SpellSlots = { ...slotsUsed };
    next[lvl] = Math.max((next[lvl] ?? 0) - 1, 0);
    props.onUpdate({ spellSlotsUsed: next });
  };
  const doShortRest = () => {
    if (casterType === "pact") props.onUpdate({ pactSlotsUsed: 0 });
  };
  const doLongRest = () => {
    props.onUpdate({ spellSlotsUsed: {}, pactSlotsUsed: 0 });
  };

  const handleLevelDown = () => {
    const level = props.character.level;
    if (level <= 1) return;
    const newLevel = level - 1;
    if (!window.confirm(`Revert to level ${newLevel}? This undoes the HP, feat, and subclass gains from the removed level.`)) return;

    const patch: Record<string, unknown> = { level: newLevel };

    // Remove last HP roll
    const hpRolls = props.character.hpRolls ?? [];
    if (hpRolls.length > 0) {
      const lastHp = hpRolls[hpRolls.length - 1];
      patch.hpRolls = hpRolls.slice(0, -1);
      patch.maxHp = Math.max(1, props.character.maxHp - lastHp);
      patch.currentHp = Math.max(1, props.character.currentHp - lastHp);
    }

    // Remove ASI/feat choices from the level being removed
    const asiChoices = props.character.asiChoices ?? [];
    const remainingAsi = asiChoices.filter((c) => c.level !== level);
    if (remainingAsi.length < asiChoices.length) {
      patch.asiChoices = remainingAsi;
    }

    // Clear subclass if gained at a level now above newLevel
    // Use "" not undefined — JSON.stringify drops undefined keys, so the
    // server would never see the field and keep the old value.
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

  const toggleCollapse = (id: SheetSectionId) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    saveLayout({ ...layout, collapsed: next });
  };

  const resetLayout = () => {
    saveLayout({ ...DEFAULT_LAYOUT, columns: DEFAULT_LAYOUT.columns.map((c) => [...c]) });
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
            <button className="cs-lvl-stepper" type="button" onClick={handleLevelDown}><Minus size={10} /></button>
            Lv {props.character.level}
            <button className="cs-lvl-stepper" type="button" title="Level up" onClick={() => { if (props.character.level < 20) setLevelUpTarget(props.character.level + 1); }}><Plus size={10} /></button>
          </span>
          <div className="cs-rest-group">
            <button className="cs-glass-btn" type="button" onClick={doShortRest} title="Short rest"><ArrowLeftRight size={13} />Short</button>
            <button className="cs-glass-btn" type="button" onClick={doLongRest} title="Long rest"><Moon size={13} />Long</button>
          </div>
          <button className="cs-glass-btn cs-inspire-btn" type="button" title="Heroic Inspiration"><Sparkles size={13} />Insp</button>
          <button className="cs-retire-btn" type="button" onClick={props.onDelete}><Trash2 size={12} /></button>
        </div>
      );
      case "vitals": return (
        <div className="cs-vitals">
          <div className="cs-vital-cell"><span className="cs-vital-label"><Shield size={12} />AC</span><strong>{armorClass}</strong></div>
          <div className="cs-vital-cell"><span className="cs-vital-label"><Activity size={12} />Initiative</span><strong>{signed(initiative)}</strong></div>
          <div className="cs-vital-cell"><span className="cs-vital-label"><Zap size={12} />Speed</span><strong>{race.speed}</strong></div>
          <div className="cs-vital-cell"><span className="cs-vital-label">Prof</span><strong>{signed(pb)}</strong></div>
          <div className="cs-vital-cell cs-vital-hp">
            <span className="cs-vital-label">Hit Points</span>
            <div className="cs-vital-hp-row"><strong>{props.character.currentHp}</strong><span className="cs-vital-hp-max">/ {props.character.maxHp}</span></div>
            {props.character.tempHp > 0 ? <span className="cs-hp-temp">+{props.character.tempHp}</span> : null}
            <div className="cs-hp-bar"><span style={{ width: `${hpPercent}%` }} /></div>
            <div className="cs-hp-steppers">
              <button type="button" onClick={() => props.onUpdate({ currentHp: Math.max(0, props.character.currentHp - 1) })}><Minus size={10} /></button>
              <button type="button" onClick={() => props.onUpdate({ currentHp: Math.min(props.character.maxHp, props.character.currentHp + 1) })}><Plus size={10} /></button>
            </div>
          </div>
          <div className="cs-vital-cell"><span className="cs-vital-label">Hit Dice</span><strong>{props.character.level}d{heroClass.hitDie}</strong></div>
          <div className="cs-vital-cell cs-vital-death">
            <span className="cs-vital-label"><Skull size={12} />Death Saves</span>
            <div className="cs-vital-death-row">
              <span>S</span>{[0,1,2].map((i) => (<button key={`s-${i}`} className={`cs-death-dot${i < (props.character.deathSaves?.successes ?? 0) ? " dot-success" : ""}`} onClick={() => toggleDeathSave("successes")} aria-label={`Death save success ${i + 1}`} />))}
              <span>F</span>{[0,1,2].map((i) => (<button key={`f-${i}`} className={`cs-death-dot${i < (props.character.deathSaves?.failures ?? 0) ? " dot-fail" : ""}`} onClick={() => toggleDeathSave("failures")} aria-label={`Death save failure ${i + 1}`} />))}
              <button className="cs-death-reset" type="button" onClick={resetDeathSaves}>R</button>
            </div>
          </div>
        </div>
      );
      case "abilities": return (
        <div className="cs-abilities">{abilityKeys.map((key) => { const score = props.finalAbilities[key]; const mod = abilityModifier(score); return (<button type="button" className="cs-ability-cell" key={key} onClick={() => props.onRoll(`${abilityLabels[key]} check`, 20, 1, mod)} aria-label={`Roll ${abilityLabels[key]} check, ${signed(mod)}`}><span className="cs-ability-mod">{signed(mod)}</span><span className="cs-ability-label">{abilityLabels[key]}</span><span className="cs-ability-score">{score}</span></button>); })}</div>
      );
      case "saves": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow"><Shield size={12} />Saving Throws</h3>
          <div className="cs-save-grid">{abilityKeys.map((key) => { const prof = isSaveProficient(key); const bonus = saveBonus(key); return (<button type="button" className={`cs-save-row${prof ? " cs-prof" : ""}`} key={key} onClick={() => props.onRoll(`${abilityLabels[key]} save`, 20, 1, bonus)} onContextMenu={(e) => { e.preventDefault(); toggleSaveProficiency(key); }} aria-label={`${abilityLabels[key]} save ${signed(bonus)}${prof ? " proficient" : ""}`} title="Right-click to toggle proficiency"><span className="cs-prof-marker" aria-hidden="true">{prof ? "\u25CF" : "\u25CB"}</span><span className="cs-save-name">{abilityLabels[key]}</span><span className="cs-save-bonus">{signed(bonus)}</span></button>); })}</div>
          {ruleSaveAll !== 0 ? <p className="cs-rule-note">All saves: {signed(ruleSaveAll)}</p> : null}
        </section>
      );
      case "skills": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow">Skills</h3>
          <div className="cs-skills-grid">{skillsByAbility.map(({ ability: abv, skills }) => (<div className="cs-skill-group" key={abv}><span className="cs-skill-ability-tag">{abilityLabels[abv]}</span>{skills.map((skill) => { const prof = isSkillProficient(skill.id); const bonus = skillBonus(skill); return (<div className="cs-skill-row" key={skill.id}><button type="button" className={`cs-prof-marker cs-prof-click${prof ? " cs-prof" : ""}`} onClick={() => toggleSkillProficiency(skill.id)} aria-label={`Toggle ${skill.name} proficiency${prof ? " (on)" : ""}`}>{prof ? "\u25CF" : "\u25CB"}</button><button type="button" className="cs-skill-btn" onClick={() => props.onRoll(skill.name, 20, 1, bonus)} aria-label={`Roll ${skill.name}, ${signed(bonus)}`}>{skill.name}</button><span className="cs-skill-bonus">{signed(bonus)}</span></div>); })}</div>))}</div>
        </section>
      );
      case "senses": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow">Senses</h3>
          <div className="cs-sense-list"><div className="cs-sense-row"><span>Passive Perception</span><strong>{passivePerception}</strong></div><div className="cs-sense-row"><span>Passive Investigation</span><strong>{passiveInvestigation}</strong></div><div className="cs-sense-row"><span>Passive Insight</span><strong>{passiveInsight}</strong></div></div>
        </section>
      );
      case "profs": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow">Proficiencies &amp; Training</h3>
          <div className="cs-prof-list">{heroClass.proficiencies.length > 0 ? (<div className="cs-prof-group"><span className="cs-prof-cat">Armor &amp; Weapons</span><div className="cs-prof-tags">{heroClass.proficiencies.map((p) => (<span className="cs-prof-chip" key={p}>{p}</span>))}</div></div>) : null}</div>
        </section>
      );
      case "attacks": return (
        <section className="cs-block">
          <h3 className="cs-section-eyebrow"><Swords size={12} />Attacks</h3>
          {heroClass.actions.length > 0 ? (<table className="cs-action-table"><thead><tr><th>Name</th><th>To-Hit</th><th>Damage</th></tr></thead><tbody>{heroClass.actions.map((action) => { const toHit = abilityModifier(props.finalAbilities[action.ability]) + pb + ruleAttack; const dmgMod = abilityModifier(props.finalAbilities[action.ability]); return (<tr key={action.name} className="cs-action-row-click" onClick={() => props.onRoll(action.name, 20, 1, toHit)} role="button" tabIndex={0} aria-label={`Roll ${action.name}, ${signed(toHit)} to hit`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onRoll(action.name, 20, 1, toHit); } }}><td>{action.name}</td><td>{signed(toHit)}</td><td>{action.formula}{dmgMod !== 0 ? ` ${signed(dmgMod)}` : ""}{action.damageType ? ` ${action.damageType}` : ""}</td></tr>); })}</tbody></table>) : <p className="cs-muted">No actions</p>}
        </section>
      );
      case "features": return (
        <section className="cs-reftabs">
          <div className="cs-reftablist" role="tablist" aria-label="Character reference">{visibleTabs.map((t, i) => (<button key={t.id} role="tab" type="button" className={`cs-reftab${refTab === t.id ? " is-active" : ""}`} aria-selected={refTab === t.id} aria-controls={`reftab-${t.id}`} tabIndex={refTab === t.id ? 0 : -1} onClick={() => setRefTab(t.id)} onKeyDown={(e) => handleRefTabKey(e, i)}><t.Icon size={13} /> {t.label}</button>))}</div>
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
              {casterType !== "none" && spellAbility ? (<div className="cs-spellcast-head">Spell save DC {saveDC} &middot; Spell attack {signed(spellAttack)}</div>) : null}
              <div className="cs-spell-list">{Object.entries(spellsByLevel).sort(([a],[b]) => Number(a)-Number(b)).map(([level, spells]) => {
                const lvlNum = Number(level);
                const max = slotMax[lvlNum - 1] ?? 0;
                const used = slotsUsed[lvlNum] ?? 0;
                return (<div key={level} className="cs-spell-group">
                  <span className="cs-spell-level-head">
                    {level === "0" ? "Cantrips" : `Level ${level}`}
                    {lvlNum > 0 && max > 0 ? (<span className="cs-slot-pips">{Array.from({length: max}, (_, i) => (<button key={i} type="button" className={`cs-slot-pip${i < used ? " cs-slot-used" : ""}`} onClick={() => i < used ? recoverSlot(lvlNum) : spendSlot(lvlNum)} aria-label={i < used ? `Recover level ${lvlNum} slot` : `Spend level ${lvlNum} slot`} />))}</span>) : null}
                  </span>
                  {spells.map((spell) => (<div className="cs-spell-card" key={spell.id} onClick={() => setSpellDetail(spell)}><strong>{spell.name}</strong><span>{spell.school}{spell.ritual ? " (ritual)" : ""}{spell.concentration ? " \u2022 concentration" : ""} &middot; {spell.castingTime}</span><p>{spell.description.slice(0, 120)}{spell.description.length > 120 ? "…" : ""}</p></div>))}
                </div>);
              })}</div>
            </div>
            <div className={refTab === "inventory" ? "" : "cs-reftab-hidden"}>{props.character.inventory.length > 0 ? (<div className="cs-inv-list">{props.character.inventory.map((item) => (<div className="cs-inv-row" key={item.id}><div><strong>{item.name}</strong>{item.notes ? <span>{item.notes}</span> : null}</div><div className="cs-inv-meta"><span>{item.rarity}</span>{item.attunement ? <span className="cs-attune">Attunement</span> : null}</div></div>))}</div>) : <p className="cs-muted">No equipment</p>}</div>
          </div>
        </section>
      );
      case "notes": return (
        <section className="cs-block"><h3 className="cs-section-eyebrow"><PenLine size={12} />Notes</h3><div className="cs-notes-block">{props.character.physicalCharacteristics ? (<div className="cs-bg-field"><span className="cs-bg-label">Physical Characteristics</span><p>{props.character.physicalCharacteristics}</p></div>) : null}{props.character.personalCharacteristics ? (<div className="cs-bg-field"><span className="cs-bg-label">Personal Characteristics</span><p>{props.character.personalCharacteristics}</p></div>) : null}{props.character.generalNotes ? (<div className="cs-bg-field"><span className="cs-bg-label">General Notes</span><p>{props.character.generalNotes}</p></div>) : null}{!props.character.physicalCharacteristics && !props.character.personalCharacteristics && !props.character.generalNotes ? <p className="cs-muted">No notes recorded</p> : null}</div></section>
      );
      case "background": return (
        <section className="cs-block"><h3 className="cs-section-eyebrow"><UserRound size={12} />Background</h3><div className="cs-bg-block">{props.character.background ? (<div className="cs-bg-field"><span className="cs-bg-label">Background</span><p>{props.character.background}</p></div>) : null}{props.character.alignment ? (<div className="cs-bg-field"><span className="cs-bg-label">Alignment</span><p>{props.character.alignment}</p></div>) : null}</div></section>
      );
      case "console": return (
        <section className="cs-block"><h3 className="cs-section-eyebrow"><Terminal size={12} />Console</h3><form className="cs-console-form" onSubmit={props.onConsoleSubmit}><label className="cs-console-label"><Terminal size={14} />Command<input value={props.consoleInput} onChange={(e) => props.onConsoleInput(e.target.value)} className="cs-console-input" /></label><button className="cs-glass-btn" type="submit">Execute</button><div className="cs-console-log">{props.consoleLog.map((entry, i) => (<span key={`${entry}-${i}`}>{entry}</span>))}</div></form></section>
      );
      default: return null;
    }
  };

  /* ── Render ── */
  const allIds = layout.columns.flat();
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
      <button key="custom" type="button" className="cs-skin-option" role="menuitem" onClick={() => { setShowAppearance(true); setShowPresets(false); }}>
        Customize...
      </button>
      {theme?.presetId ? (
        <button key="reset" type="button" className="cs-skin-option" role="menuitem" onClick={() => { props.onUpdate({ theme: undefined }); setShowPresets(false); }}>
          Reset to default
        </button>
      ) : null}
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`cs-sheet${editMode ? " cs-editing" : ""}`} style={themeVars} data-bg={theme?.backgroundKey ?? "parchment"}>
      <div className="cs-sheet-tools" role="toolbar" aria-label="Sheet tools">
        <button ref={skinButtonRef} className="cs-glass-btn cs-skin-btn" type="button" onClick={toggleSkinMenu} title="Appearance" aria-haspopup="menu" aria-expanded={showPresets}><Paintbrush size={13} /> Skin<ChevronDown size={10} /></button>
        <button className={`cs-glass-btn${editMode ? " cs-edit-active" : ""}`} type="button" onClick={() => setEditMode(!editMode)} title="Customize layout" aria-pressed={editMode}><GripHorizontal size={13} />Layout</button>
        {editMode ? <button className="cs-glass-btn cs-reset-layout" type="button" onClick={resetLayout} title="Reset layout"><RotateCcw size={13} />Reset</button> : null}
      </div>
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
          <div className="cs-sheet-columns">
            {layout.columns.map((col, ci) => (
              <div className="cs-sheet-col" key={ci}>
                {col.map((id) => (
                  <SheetSection key={id} id={id} title={SECTION_TITLES[id]} collapsed={collapsed.includes(id)} onToggle={() => toggleCollapse(id)} editMode={editMode}>
                    {sectionContent(id)}
                  </SheetSection>
                ))}
              </div>
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

      {showAppearance ? (<AppearancePanel theme={theme} onUpdate={(t) => { props.onUpdate({ theme: t }); }} onClose={() => setShowAppearance(false)} />) : null}
      {spellDetail ? (
        <div className="cs-spell-detail-overlay" onClick={() => setSpellDetail(null)}>
          <div className="cs-spell-detail" onClick={(e) => e.stopPropagation()}>
            <button className="cs-spell-detail-close" type="button" onClick={() => setSpellDetail(null)}>×</button>
            <h3 className="cs-section-eyebrow">{spellDetail.name}</h3>
            <p className="cs-spell-detail-meta">{spellDetail.level === 0 ? "Cantrip" : `Level ${spellDetail.level}`} {spellDetail.school}{spellDetail.ritual ? " (ritual)" : ""}{spellDetail.concentration ? " · Concentration" : ""}</p>
            <div className="cs-spell-detail-grid">
              <span><strong>Casting Time</strong> {spellDetail.castingTime}</span>
              <span><strong>Range</strong> {spellDetail.range || "—"}</span>
              <span><strong>Duration</strong> {spellDetail.duration || "—"}</span>
              <span><strong>Area</strong> {spellDetail.area || "—"}</span>
              <span><strong>Components</strong> {[spellDetail.components.verbal ? "V" : "", spellDetail.components.somatic ? "S" : "", spellDetail.components.material ? `M (${spellDetail.material})` : ""].filter(Boolean).join(", ") || "—"}</span>
              <span><strong>Source</strong> {spellDetail.source}</span>
            </div>
            {spellDetail.attack ? <p className="cs-spell-detail-roll"><strong>Attack:</strong> {spellDetail.attack} — <button className="cs-glass-btn" type="button" onClick={() => props.onRoll(`${spellDetail.name} attack`, 20, 1, spellAttack)}>Roll {signed(spellAttack)}</button></p> : null}
            {spellDetail.save ? <p className="cs-spell-detail-roll"><strong>Save:</strong> {spellDetail.save} vs DC {saveDC}</p> : null}
            <p className="cs-spell-detail-desc">{spellDetail.description}</p>
            {spellDetail.level > 0 && casterType !== "none" ? (
              <div className="cs-spell-detail-cast">
                {(() => {
                  const dice = parseDamageDice(spellDetail.description);
                  if (dice.length === 0) return null;
                  return (
                    <div className="cs-spell-damage-dice">
                      <strong>Damage:</strong> {spellDetail.damageEffect ? `${spellDetail.damageEffect} — ` : ""}
                      {dice.map((d, i) => (
                        <button key={i} className="cs-glass-btn" type="button" onClick={() => props.onRoll(`${spellDetail.name} damage`, d.sides, d.count, 0)}>{d.count}d{d.sides}</button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {levelUpTarget != null ? (
        <LevelUpModal
          character={props.character}
          newLevel={levelUpTarget}
          finalAbilities={props.finalAbilities}
          classId={heroClass.id}
          className={heroClass.name}
          hitDie={heroClass.hitDie}
          asiLevels={heroClass.asiLevels ?? [4, 8, 12, 16, 19]}
          subclassLevel={getClassData(heroClass.id)?.subclassLevel}
          casterType={heroClass.casterType}
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
