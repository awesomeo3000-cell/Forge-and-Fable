"use client";

import { memo, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AbilityKey, AbilityScores, ASIChoice, CasterType, CharacterSettings, SpellStatus } from "@/types/game";
import { abilityLabels, abilityModifier, proficiencyBonus, rollDie, signed } from "@/lib/utils";
import { subclassesForClass } from "@/lib/subclasses";
import { ALL_SPELLS, cantripsKnownAt, getSpell, learnsIndividualSpells, spellsForClass, spellsLearnedReachingLevel } from "@/lib/spells";
import { availableFeats, getFeat } from "@/lib/feats";
import { maxSlots } from "@/lib/spellSlots";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { BACKGROUND_SKILLS, SKILLS } from "@/lib/srd";
import { fixedHpGain, rolledHpGain } from "@/lib/hitPoints";
import { ordinalLevel } from "@/lib/ledgerCopy";
import { finalAbilityAfterChoices, levelUpHpGain } from "@/lib/derivedStats";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import "./LevelUpModal.css";

/** Checklist labels. Plain mechanical nouns — the flavor lives in descriptors,
    never in the words a player is scanning for (house voice, proposal 18 §2). */
const STEP_LABELS: Record<LevelUpStep, string> = {
  hp: "Hit points",
  subclass: "Subclass",
  expertise: "Expertise",
  asi: "Feat or ability",
  spells: "Spells",
  summary: "The seal",
};

type LevelUpStep = "hp" | "subclass" | "expertise" | "asi" | "spells" | "summary";
type HpRollRequest = {
  label: string;
  sides: number;
  modifier: number;
  onResult: (result: { roll: number; total: number }) => void;
};

export default memo(function LevelUpModal({
  character,
  newLevel,
  finalAbilities,
  classId,
  className,
  hitDie,
  asiLevels,
  subclassLevel,
  casterType,
  skipHp = false,
  onHpRoll,
  onConfirm,
  onCancel,
  raceName,
  proficiencies = [],
  useFeatPrerequisites = true,
  hitPointType,
  characterName,
  gainedFeatures = [],
}: {
  character: { level: number; maxHp: number; currentHp: number; subclassId?: string; spellsKnown: string[]; asiChoices?: ASIChoice[]; hpRolls?: number[]; raceId?: string; spellStatuses?: Record<string, SpellStatus>; skillProficiencies?: string[]; skillExpertise?: string[]; background?: string };
  newLevel: number;
  finalAbilities: AbilityScores;
  classId: string;
  className: string;
  hitDie: number;
  asiLevels: number[];
  subclassLevel?: number;
  casterType?: string;
  raceName?: string;
  proficiencies?: string[];
  /** From CharacterSettings.useFeatPrerequisites — when false, every feat is offered regardless of prereqs. */
  useFeatPrerequisites?: boolean;
  /** When true, omit the HP step — used at character creation, where the
      creator already computes starting HP for the chosen level. */
  skipHp?: boolean;
  onHpRoll?: (request: HpRollRequest) => void;
  onConfirm: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  /** Character's hit point advancement type (fixed / rolled / manual). */
  hitPointType?: CharacterSettings["hitPointType"];
  /** For the header line: "Level 5 — Wexford, Paladin". */
  characterName?: string;
  /** Class features granted automatically at newLevel (from levelProgression). */
  gainedFeatures?: { name: string; description: string }[];
}) {
  const conMod = abilityModifier(finalAbilities.constitution);

  const hasHp = newLevel > 1 && !skipHp;
  const hasSubclass = subclassLevel != null && newLevel >= subclassLevel && !character.subclassId;
  const hasAsi = asiLevels.includes(newLevel);

  // Expertise: Rogue gains at 1 (2 picks) and 6 (1 pick); Bard at 3 (2 picks) and 10 (1 pick).
  const EXPERTISE_COUNTS: Record<string, Record<number, number>> = { rogue: { 1: 2, 6: 1 }, bard: { 3: 2, 10: 1 } };
  const expertisePickCount = EXPERTISE_COUNTS[classId]?.[newLevel] ?? 0;
  const bgSkillIds = BACKGROUND_SKILLS[character.background ?? ""] ?? [];
  const proficientSkillIds = [...(character.skillProficiencies ?? []), ...bgSkillIds];
  const existingExpertise = new Set(character.skillExpertise ?? []);
  // Eligible = proficient but NOT yet expert
  const expertiseEligible = SKILLS.filter((s) => proficientSkillIds.includes(s.id) && !existingExpertise.has(s.id));
  const expertiseTarget = Math.min(expertisePickCount, expertiseEligible.length);
  // Gate on the TARGET, not the raw pick count — if no proficient skill is
  // eligible (or the caller didn't provide proficiencies), skip the step
  // instead of rendering an unfillable "Choose 0 skills".
  const hasExpertise = expertiseTarget > 0;

  // Spell learning: known casters (bard, ranger, sorcerer, warlock) and the
  // wizard's spellbook learn a FIXED number of leveled spells per level, per
  // the SRD tables. Prepared casters (cleric, druid, paladin, artificer)
  // never learn a fixed set — they prepare freely each day — so they get no
  // "learn spells" step. Computed up here so stepComplete can enforce the cap.
  const slots = maxSlots((casterType ?? "none") as CasterType, newLevel, classId);
  const maxCastableLevel = slots.reduce((max, count, i) => (count > 0 ? i + 1 : max), 0);
  const availableSpells = spellsForClass(classId)
    .filter((s) => s.level <= maxCastableLevel && s.level > 0)
    .filter((s) => !character.spellsKnown.includes(s.id))
    .slice(0, 50);
  const newSpellsCount = spellsLearnedReachingLevel(classId, newLevel);
  // Can't learn more than remain unlearned on the class list (small-list edge).
  const spellTarget = Math.min(newSpellsCount, availableSpells.length);
  const hasSpells = learnsIndividualSpells(classId, casterType) && newSpellsCount > 0 && spellTarget > 0;

  // Cantrips are chosen individually by EVERY caster that has them — prepared
  // casters included — at the levels where the class total increases
  // (e.g. bard 4/10, artificer 10/14). Per the SRD cantrip-known columns.
  const newCantripsCount = Math.max(0, cantripsKnownAt(classId, newLevel) - cantripsKnownAt(classId, newLevel - 1));
  const availableCantrips = spellsForClass(classId)
    .filter((s) => s.level === 0)
    .filter((s) => !character.spellsKnown.includes(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 50);
  const cantripTarget = Math.min(newCantripsCount, availableCantrips.length);
  const hasCantrips = cantripTarget > 0;

  const steps: LevelUpStep[] = [];
  if (hasHp) steps.push("hp");
  if (hasSubclass) steps.push("subclass");
  if (hasExpertise) steps.push("expertise");
  if (hasAsi) steps.push("asi");
  if (hasSpells || hasCantrips) steps.push("spells");
  steps.push("summary");

  const [step, setStep] = useState(0);
  const current = steps[step];

  // For manual HP the default (the average roll) is a valid gain the user can
  // accept without touching the input, so seed both the gain and the
  // "confirmed" flag. Otherwise finish()'s `hasHp && hpRolled` guard would
  // silently skip the HP update when the default was accepted as-is.
  // Fixed mode: seed immediately — no roll, no manual input needed.
  const fixedGain = fixedHpGain(hitDie, conMod);
  const manualDefault = fixedGain;
  const [hpRolled, setHpRolled] = useState(hitPointType === "manual" || hitPointType === "fixed");
  const [hpRolling, setHpRolling] = useState(false);
  const [hpDieRoll, setHpDieRoll] = useState<number | null>(null);
  const [hpGained, setHpGained] = useState(
    hitPointType === "manual" ? manualDefault : hitPointType === "fixed" ? fixedGain : 0,
  );
  const [manualHp, setManualHp] = useState(manualDefault);
  const [pickedSubclass, setPickedSubclass] = useState("");
  const [pickedFeat, setPickedFeat] = useState("");
  const [featAbilityChoice, setFeatAbilityChoice] = useState<AbilityKey | null>(null);
  const [featSpellChoices, setFeatSpellChoices] = useState<string[]>([]);
  const [asiIncreases, setAsiIncreases] = useState<Partial<AbilityScores>>({});
  const [pickedSpells, setPickedSpells] = useState<string[]>([]);
  const [pickedCantrips, setPickedCantrips] = useState<string[]>([]);
  const [spellToForget, setSpellToForget] = useState<string | null>(null);
  const [pickedExpertise, setPickedExpertise] = useState<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    // Set true on mount AND back-to-true on StrictMode's remount; only false
    // on real unmount. (The old version only ever set it false in cleanup, so
    // StrictMode's mount→cleanup→mount left it false and the HP roll callback
    // bailed out — leaving the button stuck on "Rolling…".)
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        queueMicrotask(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      queueMicrotask(() => triggerRef.current?.focus());
    };
  }, [onCancel]);

  const stepComplete = (s: LevelUpStep): boolean => {
    switch (s) {
      case "hp": return hitPointType === "manual" ? manualHp > 0 : hpRolled;
      case "subclass": return pickedSubclass !== "";
      case "expertise": return pickedExpertise.length >= expertiseTarget;
      case "asi": {
        if (pickedFeat === "") return false;
        if (pickedFeat === "asi") return Object.values(asiIncreases).reduce((s, v) => s + (v ?? 0), 0) === 2;
        const feat = getFeat(pickedFeat);
        if (feat?.chooseAbility && feat.abilityBonuses.length > 1) {
          if (featAbilityChoice === null) return false;
        }
        // Feat grants spells — must have chosen the required count
        if (feat?.grantsSpells?.choose) {
          if (featSpellChoices.length < feat.grantsSpells.choose.count) return false;
        }
        return true;
      }
      case "spells":
        return (
          (!hasSpells || pickedSpells.length >= spellTarget) &&
          (!hasCantrips || pickedCantrips.length >= cantripTarget)
        );
      case "summary": return true;
    }
  };

  const canContinue = stepComplete(current);
  const allDone = steps.slice(0, -1).every(stepComplete);

  const feats = availableFeats({
    raceName,
    casterType,
    existingFeatIds: (character.asiChoices ?? [])
      .filter((c) => c.type === "feat")
      .map((c) => (c as { featId: string }).featId),
    level: newLevel,
    abilities: finalAbilities,
    proficiencies,
    background: character.background,
    enforcePrereqs: useFeatPrerequisites,
  });

  // Compute available spells for the chosen feat's grantsSpells.choose
  const featSpellOptions = (() => {
    if (!pickedFeat || pickedFeat === "asi") return [];
    const feat = getFeat(pickedFeat);
    if (!feat?.grantsSpells?.choose) return [];
    const { schools, level: spellLevel } = feat.grantsSpells.choose;
    // Feat spells are drawn from ALL spells of the given level and school — a
    // feat's spell grant is independent of the class list, so this works for
    // non-casters (Fighter/Rogue/etc.) too, not just spellcasters.
    let candidates = ALL_SPELLS.filter((s) => s.level === spellLevel && !character.spellsKnown.includes(s.id));
    if (schools && schools.length > 0) {
      candidates = candidates.filter((s) => schools.includes(s.school.toLowerCase()));
    }
    return candidates.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
  })();

  const rollHp = () => {
    if (hpRolling || hpRolled) return;

    const applyResult = (roll: number) => {
      if (!mounted.current) return;
      const gained = rolledHpGain(roll, conMod);
      setHpDieRoll(roll);
      setHpGained(gained);
      setHpRolled(true);
      setHpRolling(false);
    };

    if (onHpRoll) {
      setHpRolling(true);
      onHpRoll({
        label: `${className} Hit Points`,
        sides: hitDie,
        modifier: conMod,
        onResult: ({ roll }) => applyResult(roll),
      });
      return;
    }

    const roll = rollDie(hitDie);
    applyResult(roll);
  };

  const applyAsi = (ability: AbilityKey) => {
    const cur = asiIncreases[ability] ?? 0;
    if (cur >= 2) return;
    const total = Object.values(asiIncreases).reduce((s, v) => s + (v ?? 0), 0);
    if (total >= 2 && cur === 0) return;
    setAsiIncreases({ ...asiIncreases, [ability]: cur + 1 });
  };

  const removeAsi = (ability: AbilityKey) => {
    const cur = asiIncreases[ability] ?? 0;
    if (cur > 0) setAsiIncreases({ ...asiIncreases, [ability]: cur - 1 });
  };

  const toggleSpell = (id: string) => {
    setPickedSpells((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < spellTarget
          ? [...prev, id]
          : prev,
    );
  };

  const toggleCantrip = (id: string) => {
    setPickedCantrips((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < cantripTarget
          ? [...prev, id]
          : prev,
    );
  };

  // Spells the character already knows that are leveled (not cantrips) —
  // eligible for the optional "replace one known spell" swap at level-up.
  const forgettableSpells = (character.spellsKnown ?? [])
    .map((id) => getSpell(id))
    .filter((s): s is NonNullable<typeof s> => s != null && s.level > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const choicesWithSelection = () => {
    const choices = [...(character.asiChoices ?? [])];
    if (!hasAsi) return choices;
    if (pickedFeat === "asi" && Object.keys(asiIncreases).length > 0) {
      choices.push({ type: "asi", level: newLevel, increases: asiIncreases });
    } else if (pickedFeat) {
      const featChoice: ASIChoice = { type: "feat", level: newLevel, featId: pickedFeat };
      if (featAbilityChoice) featChoice.abilityChoice = featAbilityChoice;
      choices.push(featChoice);
    }
    return choices;
  };

  const nextAsiChoices = choicesWithSelection();
  const nextConstitution = finalAbilityAfterChoices(
    finalAbilities.constitution,
    "constitution",
    character.asiChoices,
    nextAsiChoices,
  );
  const finalHpGained = levelUpHpGain({
    baseGain: hpGained,
    newLevel,
    currentConstitution: finalAbilities.constitution,
    nextConstitution,
    currentChoices: character.asiChoices,
    nextChoices: nextAsiChoices,
  });

  const finish = () => {
    const data: Record<string, unknown> = { level: newLevel };
    if (hasHp && hpRolled) {
      data.maxHp = character.maxHp + finalHpGained;
      data.currentHp = character.currentHp + finalHpGained;
      data.hpRolls = [...(character.hpRolls ?? []), finalHpGained];
    }
    if (hasSubclass && pickedSubclass) {
      data.subclassId = pickedSubclass;
    }
    if (hasExpertise && pickedExpertise.length > 0) {
      data.skillExpertise = [...(character.skillExpertise ?? []), ...pickedExpertise];
    }
    if (hasAsi) {
      if (nextAsiChoices.length > (character.asiChoices ?? []).length) data.asiChoices = nextAsiChoices;
    }
    if ((hasSpells && pickedSpells.length > 0) || (hasCantrips && pickedCantrips.length > 0)) {
      let updated = [...character.spellsKnown, ...pickedCantrips, ...pickedSpells];
      // The swap is a known-caster feature; wizard spellbooks never forget.
      if (spellToForget && classId !== "wizard") {
        updated = updated.filter((id) => id !== spellToForget);
      }
      data.spellsKnown = updated;
    }
    // Feat-granted spells: add both fixed and chosen spells, and register them
    // as free-use (once per long rest, no slot) with the feat as their source.
    if (pickedFeat && pickedFeat !== "asi") {
      const feat = getFeat(pickedFeat);
      if (feat?.grantsSpells) {
        const grantSpells: string[] = [
          ...(feat.grantsSpells.fixed ?? []),
          ...featSpellChoices,
        ];
        if (grantSpells.length > 0) {
          data.spellsKnown = [...(data.spellsKnown as string[] ?? character.spellsKnown), ...grantSpells];
          const statuses: Record<string, SpellStatus> = { ...(character.spellStatuses ?? {}) };
          for (const id of grantSpells) {
            statuses[id] = { source: `${feat.name} feat`, freeUse: true, freeUsed: false };
          }
          data.spellStatuses = statuses;
        }
      }
    }
    onConfirm(data);
  };

  // Readable names for the Rite Summary and (final step) Chronicle recap.
  const chosenSubclassName = subclassesForClass(classId).find((s) => s.id === pickedSubclass)?.name ?? "";
  const chosenFeatName = pickedFeat && pickedFeat !== "asi" ? (feats.find((f) => f.id === pickedFeat)?.name ?? "") : "";
  const expertiseNames = pickedExpertise.map((id) => SKILLS.find((s) => s.id === id)?.name ?? id);
  const chosenCantripNames = pickedCantrips.map((id) => getSpell(id)?.name ?? id);
  const chosenSpellNames = pickedSpells.map((id) => getSpell(id)?.name ?? id);

  // ── "Gained at this level" strip: what the level grants with no decision.
  // Features come from the caller (levelProgression); prof bonus and new
  // slot tiers are derived here. Rendered on the first step only.
  const prevProf = proficiencyBonus(newLevel - 1);
  const nextProf = proficiencyBonus(newLevel);
  const prevSlots = maxSlots((casterType ?? "none") as CasterType, newLevel - 1, classId);
  const newSlotTiers = slots
    .map((count, i) => (count > 0 && (prevSlots[i] ?? 0) === 0 ? { level: i + 1, count } : null))
    .filter((t): t is { level: number; count: number } => t !== null);
  const gainedLines: string[] = [
    ...gainedFeatures.map((f) => (f.description ? `${f.name} — ${f.description}` : f.name)),
    ...(nextProf !== prevProf ? [`Proficiency bonus rises to ${signed(nextProf)}.`] : []),
    ...newSlotTiers.map((t) => `New: ${t.count} level-${t.level} spell slot${t.count > 1 ? "s" : ""}.`),
  ];

  // Rail marginalia: the decided value each completed step shows, in miniature.
  const railNote = (s: LevelUpStep): string => {
    if (!stepComplete(s)) return "";
    switch (s) {
      case "hp": return `+${finalHpGained} hp`;
      case "subclass": return chosenSubclassName.toLowerCase();
      case "expertise": return pickedExpertise.length === 1
        ? (expertiseNames[0] ?? "").toLowerCase()
        : `${pickedExpertise.length} skills`;
      case "asi": return pickedFeat === "asi" ? "ability points" : chosenFeatName.toLowerCase();
      case "spells": return `${pickedCantrips.length + pickedSpells.length} learned`;
      case "summary": return "";
    }
  };

  return (
    <div className="level-rite-backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="level-rite-modal"
        data-class={classId}
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-rite-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="level-rite-close" onClick={onCancel} aria-label="Close level up" title="Close"><X size={14} /></button>

        <div className="level-rite-inner">
          {/* ── Header: class seal + entry line ── */}
          <header className="level-rite-header">
            <span className="level-rite-seal" aria-hidden="true">
              <ClassIconPlaceholder classId={classId} size={22} strokeWidth={1.6} />
            </span>
            <div className="level-rite-header-text">
              <span className="level-rite-eyebrow">The record grows</span>
              <h2 id="level-rite-title" className="level-rite-title">
                Level {newLevel}
                <span className="level-rite-title-sub"> — {characterName ? `${characterName}, ` : ""}{className}</span>
              </h2>
            </div>
          </header>

          {/* ── Body: margin checklist + step content ── */}
          <div className="level-rite-body">
            {/* The checklist is both navigation and running recap: completed
                steps show their decided value as marginalia. */}
            <nav className="level-rite-rail" aria-label="Level up steps">
              <span className="level-rite-rail-label">This entry</span>
              {steps.map((s, i) => {
                const state = stepComplete(s) && s !== "summary" ? "is-done" : i === step ? "is-current" : "";
                const note = railNote(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`level-rite-step ${i === step ? "is-current" : state}`}
                    onClick={() => setStep(i)}
                    aria-current={i === step ? "step" : undefined}
                  >
                    <span className="level-rite-step-label">{STEP_LABELS[s]}</span>
                    {note ? <em className="level-rite-step-note">{note} ✓</em> : null}
                  </button>
                );
              })}
            </nav>
            <div className="level-rite-main">
              {/* Gained automatically — shown once, on the first step. */}
              {step === 0 && gainedLines.length > 0 ? (
                <div className="level-rite-gained">
                  <span className="level-rite-gained-label">Gained at {ordinalLevel(newLevel)} level</span>
                  {gainedLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : null}
              {/* HP step */}
              {current === "hp" && (
                <div className="level-rite-hp">
                  <div className="level-rite-hp-copy">
                    <h3 className="level-rite-panel-title">Hit points</h3>
                    <p className="level-rite-panel-sub">
                      {hitPointType === "fixed"
                        ? `Your hit point maximum increases by +${finalHpGained}.`
                        : hitPointType === "manual"
                          ? `Enter your hit point increase (1d${hitDie} ${signed(conMod)}).`
                          : `Roll 1d${hitDie} ${signed(conMod)} to determine your hit point increase.`}
                    </p>
                  </div>

                  <div className="level-rite-hp-card">
                    <div className="level-rite-hp-die">
                      <span>Hit Die</span>
                      <strong>
                        1d{hitDie} {signed(conMod)}
                      </strong>
                    </div>

                    {hitPointType === "fixed" ? (
                      <span className="level-rite-hp-fixed-label">
                        +{finalHpGained} HP (fixed)
                      </span>
                    ) : hitPointType === "manual" ? (
                      <label className="control-field">
                        <span>HP Gained</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, hitDie + conMod)}
                          value={manualHp}
                          onChange={(e) => {
                            const maxVal = Math.max(1, hitDie + conMod);
                            const v = Math.max(1, Math.min(maxVal, parseInt(e.target.value) || 1));
                            setManualHp(v);
                            setHpGained(v);
                            setHpRolled(true);
                          }}
                          style={{ width: 90 }}
                        />
                      </label>
                    ) : !hpRolled ? (
                      <button className="level-rite-button" type="button" onClick={rollHp} disabled={hpRolling}>
                        {hpRolling ? "Rolling…" : "Roll the Die"}
                      </button>
                    ) : null}
                  </div>

                  {finalHpGained > 0 ? (
                    <div className="level-rite-hp-result" aria-live="polite">
                      <strong>+{finalHpGained} HP</strong>
                      <span>
                        Max HP {character.maxHp} → {character.maxHp + finalHpGained}
                        {(hpDieRoll ?? hpGained) + conMod < 1 ? " (minimum 1)" : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Subclass step */}
              {current === "subclass" && (
                <div className="level-rite-panel">
                  <h3 className="level-rite-panel-title">Subclass</h3>
                  <p className="level-rite-panel-sub">the path within the vocation</p>
                  <div className="level-rite-choice-grid">
                    {subclassesForClass(classId).map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className={`level-rite-card${pickedSubclass === sub.id ? " is-selected" : ""}`}
                        onClick={() => setPickedSubclass(sub.id)}
                      >
                        <strong>{sub.name}</strong>
                        <p>{sub.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Expertise step */}
              {current === "expertise" && (
                <div className="level-rite-panel">
                  <h3 className="level-rite-panel-title">Expertise</h3>
                  <p className="level-rite-panel-sub">
                    Choose {expertiseTarget} skill{expertiseTarget > 1 ? "s" : ""} — twice the proficiency bonus.
                  </p>
                  <div className="level-rite-choice-grid compact">
                    {expertiseEligible.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`level-rite-option${pickedExpertise.includes(s.id) ? " is-selected" : ""}`}
                        onClick={() => setPickedExpertise((prev) =>
                          prev.includes(s.id) ? prev.filter((id) => id !== s.id) : prev.length < expertiseTarget ? [...prev, s.id] : prev,
                        )}
                      >
                        <span className="level-rite-option-name">{s.name}</span>
                        <span className="level-rite-option-detail">{abilityLabels[s.ability]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feat / ASI step — top-level fork */}
              {current === "asi" && (
                <div className="level-rite-panel">
                  <h3 className="level-rite-panel-title">Feat or ability</h3>
                  <p className="level-rite-panel-sub">a talent refined, or a new knack</p>

                  {/* Fork: ASI vs Feat */}
                  <div className="level-rite-fork">
                    <button
                      type="button"
                      className={`level-rite-card${pickedFeat === "asi" ? " is-selected" : ""}`}
                      onClick={() => setPickedFeat("asi")}
                    >
                      <strong>Raise Ability Scores</strong>
                      <p>Increase your ability scores.</p>
                    </button>
                    <button
                      type="button"
                      className={`level-rite-card${pickedFeat && pickedFeat !== "asi" ? " is-selected" : ""}`}
                      onClick={() => { if (!pickedFeat || pickedFeat === "asi") { setPickedFeat(feats[0]?.id ?? ""); } setFeatAbilityChoice(null); setFeatSpellChoices([]); }}
                    >
                      <strong>Claim a Feat</strong>
                      <p>Choose a feat to gain new power.</p>
                    </button>
                  </div>

                  {/* ASI steppers */}
                  {pickedFeat === "asi" ? (
                    <div className="level-rite-asi-grid">
                      {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as AbilityKey[]).map((a) => (
                        <div key={a} className="level-rite-asi-row">
                          <span>{abilityLabels[a]} {finalAbilities[a] + (asiIncreases[a] ?? 0)}</span>
                          <span className="level-rite-steppers">
                            <button type="button" className="level-rite-stepper-btn" onClick={() => removeAsi(a)} aria-label={`Decrease ${abilityLabels[a]}`}>−</button>
                            <span className="level-rite-stepper-count">{asiIncreases[a] ?? 0}</span>
                            <button type="button" className="level-rite-stepper-btn" onClick={() => applyAsi(a)} aria-label={`Increase ${abilityLabels[a]}`}>+</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Feat list (only when Claim a Feat is the active fork) */}
                  {pickedFeat && pickedFeat !== "asi" ? (
                    <>
                      <div className="level-rite-choice-grid">
                        {feats.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className={`level-rite-card${pickedFeat === f.id ? " is-selected" : ""}`}
                            onClick={() => { setPickedFeat(f.id); setFeatAbilityChoice(null); setFeatSpellChoices([]); }}
                          >
                            <strong>{f.name}</strong>
                            <p>{f.description.slice(0, 150)}</p>
                          </button>
                        ))}
                      </div>

                      {/* Selected feat description panel */}
                      {(() => {
                        const chosenFeat = getFeat(pickedFeat);
                        if (!chosenFeat) return null;
                        return (
                          <div className="level-rite-description">
                            <div className="level-rite-description-head">
                              <span className="level-rite-tag is-chosen">Chosen Feat</span>
                              <span className="level-rite-description-name">{chosenFeat.name}</span>
                            </div>
                            <p className="level-rite-description-body">{chosenFeat.description}</p>
                          </div>
                        );
                      })()}

                      {/* Feat ability choice (+1 to…) */}
                      {(() => {
                        const chosenFeat = getFeat(pickedFeat);
                        if (!chosenFeat?.chooseAbility || chosenFeat.abilityBonuses.length <= 1) return null;
                        return (
                          <div>
                            <span className="level-rite-eyebrow">+1 to…</span>
                            <div className="level-rite-choice-grid compact">
                              {chosenFeat.abilityBonuses.map((a) => (
                                <button
                                  key={a}
                                  type="button"
                                  className={`level-rite-option${featAbilityChoice === a ? " is-selected" : ""}`}
                                  onClick={() => setFeatAbilityChoice(a)}
                                >
                                  <span className="level-rite-option-name">{abilityLabels[a]}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Feat-granted spell choices */}
                      {featSpellOptions.length > 0 ? (
                        <div>
                          <span className="level-rite-eyebrow">
                            Choose {(() => { const f = getFeat(pickedFeat); return f?.grantsSpells?.choose?.count ?? 0; })()} spell{(() => { const f = getFeat(pickedFeat); return (f?.grantsSpells?.choose?.count ?? 0) > 1 ? "s" : ""; })()} (Level {(() => { const f = getFeat(pickedFeat); return f?.grantsSpells?.choose?.level ?? 1; })()})
                          </span>
                          <div className="level-rite-choice-grid compact">
                            {featSpellOptions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                className={`level-rite-option${featSpellChoices.includes(s.id) ? " is-selected" : ""}`}
                                onClick={() => setFeatSpellChoices((prev) =>
                                  prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                                )}
                              >
                                <span className="level-rite-option-name">{s.name}</span>
                                <span className="level-rite-option-detail">Lv {s.level} {s.school}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}

              {/* Spells step */}
              {current === "spells" && (
                <div className="level-rite-panel">
                  <h3 className="level-rite-panel-title">Spells</h3>
                  <p className="level-rite-panel-sub">new spells committed to memory</p>

                  {hasCantrips ? (
                    <>
                      <span className="level-rite-eyebrow">New Cantrips · {pickedCantrips.length}/{cantripTarget}</span>
                      <div className="level-rite-choice-grid compact scroll">
                        {availableCantrips.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`level-rite-option${pickedCantrips.includes(s.id) ? " is-selected" : ""}`}
                            onClick={() => toggleCantrip(s.id)}
                          >
                            <span className="level-rite-option-name">{s.name}</span>
                            <span className="level-rite-option-detail">Cantrip {s.school}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {hasSpells ? (
                    <>
                      <span className="level-rite-eyebrow">Learn Spells · {pickedSpells.length}/{spellTarget}</span>
                      <div className="level-rite-choice-grid compact scroll">
                        {availableSpells.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`level-rite-option${pickedSpells.includes(s.id) ? " is-selected" : ""}`}
                            onClick={() => toggleSpell(s.id)}
                          >
                            <span className="level-rite-option-name">{s.name}</span>
                            <span className="level-rite-option-detail">Lv {s.level} {s.school}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {hasSpells && classId !== "wizard" && forgettableSpells.length > 0 && (
                    <div>
                      <span className="level-rite-eyebrow">Replace one known spell (optional)</span>
                      <select
                        className="level-rite-hp-select"
                        style={{ width: "100%" }}
                        value={spellToForget ?? ""}
                        onChange={(e) => setSpellToForget(e.target.value || null)}
                      >
                        <option value="">— Don&apos;t replace any —</option>
                        {forgettableSpells.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Lv {s.level})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Summary / Chronicle step */}
              {current === "summary" && (
                <div className="level-rite-panel level-rite-cert">
                  <span className="level-rite-eyebrow">The entry, read back</span>
                  <h3 className="level-rite-cert-level">Level {newLevel}</h3>
                  <ul className="level-rite-summary-list">
                    {hasHp ? (
                      <li className="level-rite-summary-item">
                        <span className="level-rite-summary-label">Health</span>
                        <span className={`level-rite-summary-value${hpRolled ? "" : " pending"}`}>
                          {hpRolled ? `${character.maxHp} → ${character.maxHp + finalHpGained} Max HP (+${finalHpGained})` : "not yet rolled"}
                        </span>
                      </li>
                    ) : null}
                    {hasSubclass ? (
                      <li className="level-rite-summary-item">
                        <span className="level-rite-summary-label">Subclass</span>
                        <span className={`level-rite-summary-value${chosenSubclassName ? "" : " pending"}`}>
                          {chosenSubclassName || "not yet chosen"}
                        </span>
                      </li>
                    ) : null}
                    {hasExpertise ? (
                      <li className="level-rite-summary-item">
                        <span className="level-rite-summary-label">Mastery</span>
                        <span className={`level-rite-summary-value${expertiseNames.length > 0 ? "" : " pending"}`}>
                          {expertiseNames.length > 0 ? expertiseNames.join(", ") : `${pickedExpertise.length} of ${expertiseTarget} chosen`}
                        </span>
                      </li>
                    ) : null}
                    {hasAsi ? (
                      <li className="level-rite-summary-item">
                        <span className="level-rite-summary-label">Advancement</span>
                        <span className={`level-rite-summary-value${pickedFeat ? "" : " pending"}`}>
                          {pickedFeat === "asi"
                            ? (Object.keys(asiIncreases).length > 0
                                ? `Ability Score Improvement (${Object.entries(asiIncreases).map(([k, v]) => `${abilityLabels[k as AbilityKey]} +${v}`).join(", ")})`
                                : "ASI · no increases allocated")
                            : pickedFeat
                              ? `${chosenFeatName}${featAbilityChoice ? ` (+1 ${abilityLabels[featAbilityChoice]})` : ""}`
                              : "not yet chosen"}
                        </span>
                      </li>
                    ) : null}
                    {hasCantrips ? (
                      <li className="level-rite-summary-item">
                        <span className="level-rite-summary-label">New Cantrips</span>
                        <span className={`level-rite-summary-value${chosenCantripNames.length >= cantripTarget ? "" : " pending"}`}>
                          {chosenCantripNames.length > 0 ? chosenCantripNames.join(", ") : `${pickedCantrips.length} of ${cantripTarget} chosen`}
                        </span>
                      </li>
                    ) : null}
                    {hasSpells ? (
                      <li className="level-rite-summary-item">
                        <span className="level-rite-summary-label">New Spells</span>
                        <span className={`level-rite-summary-value${chosenSpellNames.length > 0 ? "" : " pending"}`}>
                          {chosenSpellNames.length > 0
                            ? `${chosenSpellNames.length} of ${spellTarget} learned${spellToForget && classId !== "wizard" ? `, 1 replaced` : ""}`
                            : `0 of ${spellTarget} chosen`}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="level-rite-footer">
            <button className="level-rite-button" type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Previous</button>
            {step < steps.length - 1 ? (
              <button className="level-rite-button-primary" type="button" onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue</button>
            ) : (
              <button className="level-rite-button-primary" type="button" onClick={finish} disabled={!allDone}>Press the seal</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
})
