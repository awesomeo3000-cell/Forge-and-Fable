"use client";

import { memo, useState } from "react";
import type {
  AbilityKey,
  AbilityScores,
  BuildMode,
  CharacterSettings,
  DraftCharacter,
  HeroClass,
  Race,
  Ruleset,
  StatMethod,
} from "@/types/game";
import {
  abilityKeys,
  abilityLabels,
  abilityModifier,
  abilityNames,
  proficiencyBonus,
  signed,
  sourceOptions,
  standardArray,
} from "@/lib/utils";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";
import SourceSettingsPanel from "@/components/SourceSettingsPanel";
import ClassLearnModal from "@/components/ClassLearnModal";
import SpeciesLearnModal from "@/components/SpeciesLearnModal";
import SpeciesFamilyModal from "@/components/SpeciesFamilyModal";
import { CHAPTERS, classDescriptor, firstSentence, ordinalLevel, originTone } from "@/lib/ledgerCopy";
import {
  CLASS_SKILL_CHOICES,
  SKILLS,
  BACKGROUND_SKILLS,
  CLASS_TOOL_GRANTS,
  CLASS_TOOL_CHOICES,
  BACKGROUND_TOOL_GRANTS,
  BACKGROUND_TOOL_CHOICES,
  BACKGROUND_LANGUAGE_CHOICES,
  LANGUAGES,
} from "@/lib/srd";

const ALL_CLASS_TOOL_OPTIONS = new Set(Object.values(CLASS_TOOL_CHOICES).flatMap((c) => c.options));
const ALL_BACKGROUND_TOOL_OPTIONS = new Set(Object.values(BACKGROUND_TOOL_CHOICES).flatMap((c) => c.options));

type AssignmentMap = Record<AbilityKey, number>;

const steps = ["Setup", "Class", "Origin", "Species", "Attributes", "Finalize"];
const levelOptions = Array.from({ length: 20 }, (_, index) => index + 1);

function casterLabel(heroClass: HeroClass) {
  if (!heroClass.casterType || heroClass.casterType === "none") return "martial";
  if (heroClass.casterType === "pact") return "pact magic";
  if (heroClass.spellcastingAbility) return `${abilityLabels[heroClass.spellcastingAbility]} caster`;
  return `${heroClass.casterType} caster`;
}

function classDetailLine(heroClass: HeroClass) {
  return [`d${heroClass.hitDie} hit die`, casterLabel(heroClass)].join(" / ");
}

const FAMILY_LABELS: Record<string, { name: string; summary: string }> = {
  "dwarf-legacy": { name: "Dwarf (Legacy)", summary: "Hill or Mountain dwarf traditions." },
  "elf-legacy": { name: "Elf (Legacy)", summary: "High, Wood, or Drow elf traditions." },
  "halfling-legacy": { name: "Halfling (Legacy)", summary: "Lightfoot or Stout halfling families." },
  "gnome-legacy": { name: "Gnome (Legacy)", summary: "Rock, Deep, or Forest gnome traditions." },
  "genasi-legacy": { name: "Genasi (Legacy)", summary: "Air, Earth, Fire, or Water elemental heritage." },
};

/** Groups races sharing a familyId into one family entry (first-seen order);
    races without a familyId pass through as their own single-race entry. */
function groupSpeciesByFamily(
  races: Race[],
): ({ kind: "single"; race: Race } | { kind: "family"; familyId: string; members: Race[] })[] {
  const items: ({ kind: "single"; race: Race } | { kind: "family"; familyId: string; members: Race[] })[] = [];
  const familyIndex = new Map<string, number>();

  for (const race of races) {
    if (!race.familyId) {
      items.push({ kind: "single", race });
      continue;
    }
    const existingIndex = familyIndex.get(race.familyId);
    if (existingIndex !== undefined) {
      const entry = items[existingIndex];
      if (entry.kind === "family") entry.members.push(race);
      continue;
    }
    familyIndex.set(race.familyId, items.length);
    items.push({ kind: "family", familyId: race.familyId, members: [race] });
  }

  return items;
}

function speciesDetailLine(race: Race) {
  return `${race.creatureType} / ${race.size} / ${race.speed}`;
}

function parseSpeciesName(name: string): { displayName: string; subspeciesLabel: string | null } {
  const match = name.match(/^(.+)\s+\((\d+)\)$/);
  if (match) {
    const count = parseInt(match[2], 10);
    return { displayName: match[1], subspeciesLabel: `${count} subspecies` };
  }
  return { displayName: name, subspeciesLabel: null };
}

function StepSlot(props: { value?: string | null; label: string }) {
  return props.value ? (
    <span className="dj-header-value">{props.value}</span>
  ) : (
    <span className="dj-header-slot">{props.label}</span>
  );
}

function DossierStamp(props: {
  type: "class" | "species" | "origin";
  label: string;
  detail: string;
  classId?: string;
  speciesId?: string;
}) {
  return (
    <div className="dj-stamp-row ledger-stamp" data-class={props.classId} data-species={props.speciesId} data-kind={props.type}>
      {props.type === "class" && props.classId ? (
        <span className="dj-stamp-icon" data-class={props.classId}>
          <ClassIconPlaceholder classId={props.classId} size={26} strokeWidth={1.5} />
        </span>
      ) : null}
      {props.type === "species" && props.speciesId ? (
        <span className="dj-stamp-icon" data-species={props.speciesId}>
          <SpeciesIconPlaceholder speciesId={props.speciesId} size={26} strokeWidth={1.5} />
        </span>
      ) : null}
      {props.type === "origin" ? <span className="dj-stamp-seal">OR</span> : null}
      <span>
        <strong>{props.label}</strong>
        <small>{props.detail}</small>
      </span>
      <em>chosen ✦</em>
    </div>
  );
}

export default memo(function CreatorPanel(props: {
  draft: DraftCharacter;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  buildMode: BuildMode;
  step: number;
  statMethod: StatMethod;
  pointRemaining: number;
  standardAssignments: AssignmentMap;
  rolledScores: number[];
  rolledAssignments: AssignmentMap;
  onDraftChange: (draft: DraftCharacter) => void;
  onStepChange: (step: number) => void;
  onMethodChange: (method: StatMethod) => void;
  onPointBuyChange: (ability: AbilityKey, delta: number) => void;
  onManualAbilityChange: (ability: AbilityKey, value: number) => void;
  onAssignmentChange: (type: "standard" | "rolled", ability: AbilityKey, nextIndex: number) => void;
  onRollStats: () => void;
  onRollStartingHp: (request: {
    className: string;
    hitDie: number;
    count: number;
    constitutionModifier: number;
    onResult: (rolls: number[]) => void;
  }) => void;
  onCreate: () => void;
}) {
  const [inspectedClassId, setInspectedClassId] = useState<string | null>(null);
  const [inspectedSpeciesId, setInspectedSpeciesId] = useState<string | null>(null);
  const [forgeError, setForgeError] = useState<string | null>(null);

  const selectedClass = props.draft.classId
    ? props.ruleset.classes.find((item) => item.id === props.draft.classId) ?? null
    : null;
  const race = props.ruleset.races.find((item) => item.id === props.draft.raceId) ?? null;
  const [familyPickerId, setFamilyPickerId] = useState<string | null>(null);
  const speciesGroups = groupSpeciesByFamily(props.ruleset.races);
  const pickedFamily = familyPickerId
    ? speciesGroups.find((item) => item.kind === "family" && item.familyId === familyPickerId)
    : null;
  const inspectedClass = props.ruleset.classes.find((item) => item.id === inspectedClassId) ?? null;
  const inspectedSpecies = props.ruleset.races.find((item) => item.id === inspectedSpeciesId) ?? null;

  const skillChoice = props.draft.classId ? CLASS_SKILL_CHOICES[props.draft.classId] : undefined;
  const chosenSkillCount = props.draft.skillProficiencies.length;
  const skillsComplete = !skillChoice || chosenSkillCount >= skillChoice.count;

  const classToolGrants = props.draft.classId ? CLASS_TOOL_GRANTS[props.draft.classId] ?? [] : [];
  const classToolChoice = props.draft.classId ? CLASS_TOOL_CHOICES[props.draft.classId] : undefined;
  const backgroundToolGrants = BACKGROUND_TOOL_GRANTS[props.draft.background] ?? [];
  const backgroundToolChoice = BACKGROUND_TOOL_CHOICES[props.draft.background];
  const backgroundLanguageCount = BACKGROUND_LANGUAGE_CHOICES[props.draft.background] ?? 0;
  const extraHpLevels = Math.max(0, props.draft.level - 1);
  const startingHpRolls = props.draft.startingHpRolls.slice(0, extraHpLevels);
  const constitutionModifier = abilityModifier(props.finalAbilities.constitution);
  const firstLevelHp = selectedClass ? Math.max(1, selectedClass.hitDie + constitutionModifier) : 1;
  const fixedLevelHp = selectedClass ? Math.max(1, Math.floor(selectedClass.hitDie / 2) + 1 + constitutionModifier) : 1;
  const rolledHpGains = startingHpRolls.map((roll) => Math.max(1, Math.trunc(roll) + constitutionModifier));
  const usesRolledStartingHp =
    props.draft.settings.hitPointType === "rolled" && Boolean(selectedClass) && extraHpLevels > 0;
  const startingHpComplete = !usesRolledStartingHp || startingHpRolls.length === extraHpLevels;
  const startingHpPreview =
    firstLevelHp +
    (usesRolledStartingHp
      ? rolledHpGains.reduce((sum, gain) => sum + gain, 0)
      : extraHpLevels * fixedLevelHp);
  const startingHpDisplay =
    usesRolledStartingHp && !startingHpComplete ? `${firstLevelHp} + pending rolls` : `${startingHpPreview}`;
  const hpMethodLabel = props.draft.settings.hitPointType === "rolled" ? "rolled" : "fixed";
  const classStepComplete = Boolean(props.draft.classId) && skillsComplete && startingHpComplete;

  const changeStartingLevel = (level: number) => {
    const nextLevel = Math.max(1, Math.min(20, Math.trunc(level)));
    const nextExtraLevels = Math.max(0, nextLevel - 1);
    props.onDraftChange({
      ...props.draft,
      level: nextLevel,
      startingHpRolls: props.draft.startingHpRolls.slice(0, nextExtraLevels),
    });
  };

  const changeHitPointType = (hitPointType: CharacterSettings["hitPointType"]) => {
    props.onDraftChange({
      ...props.draft,
      settings: {
        ...props.draft.settings,
        hitPointType,
      },
      startingHpRolls:
        hitPointType === "rolled" ? props.draft.startingHpRolls.slice(0, extraHpLevels) : [],
    });
  };

  const rollStartingHp = () => {
    if (!selectedClass || extraHpLevels <= 0) {
      return;
    }

    props.onRollStartingHp({
      className: selectedClass.name,
      hitDie: selectedClass.hitDie,
      count: extraHpLevels,
      constitutionModifier,
      onResult: (rolls) => {
        props.onDraftChange({
          ...props.draft,
          settings: {
            ...props.draft.settings,
            hitPointType: "rolled",
          },
          startingHpRolls: rolls.slice(0, extraHpLevels),
        });
      },
    });
  };

  const toggleSkillChoice = (skillId: string) => {
    const current = props.draft.skillProficiencies;
    if (current.includes(skillId)) {
      props.onDraftChange({ ...props.draft, skillProficiencies: current.filter((id) => id !== skillId) });
    } else if (!skillChoice || current.length < skillChoice.count) {
      props.onDraftChange({ ...props.draft, skillProficiencies: [...current, skillId] });
    }
  };

  /** Tool choices from class and background share one flat array; count each
      pick against only its own choice's option pool so two independent
      choices (e.g. a class instrument pick + a background gaming-set pick)
      don't compete for the same slot count. */
  const toggleToolChoice = (tool: string, options: string[], count: number) => {
    const current = props.draft.toolProficiencies;
    if (current.includes(tool)) {
      props.onDraftChange({ ...props.draft, toolProficiencies: current.filter((t) => t !== tool) });
      return;
    }
    const chosenInPool = current.filter((t) => options.includes(t)).length;
    if (chosenInPool < count) {
      props.onDraftChange({ ...props.draft, toolProficiencies: [...current, tool] });
    }
  };

  const toggleLanguageChoice = (language: string) => {
    const current = props.draft.languages;
    if (current.includes(language)) {
      props.onDraftChange({ ...props.draft, languages: current.filter((l) => l !== language) });
    } else if (current.length < backgroundLanguageCount) {
      props.onDraftChange({ ...props.draft, languages: [...current, language] });
    }
  };

  const stepComplete = [
    Boolean(props.draft.name.trim()) && props.draft.sourceIds.length > 0,
    classStepComplete,
    Boolean(props.draft.background),
    Boolean(props.draft.raceId),
    Boolean(props.statMethod),
    Boolean(props.draft.name.trim()) &&
      props.draft.sourceIds.length > 0 &&
      classStepComplete &&
      Boolean(props.draft.background) &&
      Boolean(props.draft.raceId),
  ];

  // TOC marginalia: the decided value each completed chapter shows (18c pass 1).
  const methodLabels: Record<StatMethod, string> = {
    "point-buy": "point buy",
    "standard-array": "standard array",
    roll: "rolled",
    manual: "manual",
  };
  const decidedValues = [
    props.draft.name.trim(),
    selectedClass?.name ?? "",
    props.draft.background,
    race ? parseSpeciesName(race.name).displayName : "",
    methodLabels[props.statMethod] ?? "",
    "",
  ];

  const canContinue =
    props.step === 0
      ? stepComplete[0]
      : props.step === 1
        ? stepComplete[1]
        : props.step === 2
          ? stepComplete[2]
          : props.step === 3
            ? stepComplete[3]
            : true;

  const toggleSource = (sourceId: string) => {
    const exists = props.draft.sourceIds.includes(sourceId);
    props.onDraftChange({
      ...props.draft,
      sourceIds: exists
        ? props.draft.sourceIds.filter((id) => id !== sourceId)
        : [...props.draft.sourceIds, sourceId],
    });
  };

  const updateSettings = (settings: Partial<CharacterSettings>) => {
    props.onDraftChange({
      ...props.draft,
      settings: {
        ...props.draft.settings,
        ...settings,
      },
    });
  };

  return (
    <>
      <div className="creator-panel paper-surface dj-dossier ledger-spread">
        <nav className="dj-rail ledger-toc" aria-label="Character builder steps">
          <span className="dj-rail-label">The Commission</span>
          {steps.map((step, index) => {
            const active = index === props.step;
            const complete = stepComplete[index];
            const chapter = CHAPTERS[index];
            const decided = complete ? decidedValues[index] : "";

            return (
              <button
                type="button"
                key={step}
                className={`dj-rail-step ${active ? "active" : ""} ${complete ? "complete" : ""}`}
                onClick={() => props.onStepChange(index)}
                aria-current={active ? "step" : undefined}
              >
                <span className="ledger-toc-chapter">{`${chapter.numeral}. ${chapter.name}`}</span>
                {decided ? <em className="ledger-toc-decided">{decided} ✓</em> : null}
              </button>
            );
          })}
          <p className="ledger-footnote ledger-toc-footnote">Each chapter inks the record as it is decided.</p>
        </nav>

        <section className="dj-document">
          <header className="dj-document-header">
            <span className="dj-eyebrow">Record of the adventurer</span>
            <h2>{props.draft.name.trim() || <span>unwritten</span>}</h2>
            <p>
              <StepSlot value={race?.name} label="species" />
              <span aria-hidden="true"> / </span>
              <StepSlot value={selectedClass?.name} label="class" />
              <span aria-hidden="true"> / </span>
              <StepSlot value={props.draft.background} label="origin" />
              <span aria-hidden="true"> / </span>
              <StepSlot value={props.draft.alignment} label="alignment" />
            </p>
          </header>

          <section className="dj-section" aria-labelledby="dj-section-title">
            <div className="ledger-chapter-head">
              <h3 className="ledger-chapter-title" id="dj-section-title">
                {`Chapter ${CHAPTERS[props.step].numeral} · ${CHAPTERS[props.step].name}`}
              </h3>
              <p className="ledger-chapter-sub">{CHAPTERS[props.step].subtitle}</p>
            </div>

            {props.step === 0 ? (
              <div className="dj-setup">
                <label className="dj-name-field">
                  <span>Character name</span>
                  <input
                    value={props.draft.name}
                    placeholder="Write a name"
                    onChange={(event) => props.onDraftChange({ ...props.draft, name: event.target.value })}
                  />
                </label>
                <div className="dj-settings-panel">
                  <SourceSettingsPanel
                    selectedSourceIds={props.draft.sourceIds}
                    settings={props.draft.settings}
                    onToggleSource={toggleSource}
                    onSettingsChange={updateSettings}
                  />
                </div>
              </div>
            ) : null}

            {props.step === 1 ? (
              <div className="dj-option-stack">
                {selectedClass ? (
                  <DossierStamp
                    type="class"
                    classId={selectedClass.id}
                    label={selectedClass.name}
                    detail={classDetailLine(selectedClass)}
                  />
                ) : null}
                {selectedClass?.subclassLevel ? (
                  <p className="ledger-footnote">
                    {`† Subclass is chosen at ${ordinalLevel(selectedClass.subclassLevel)} level; the ledger will prompt you.`}
                  </p>
                ) : null}
                {selectedClass && skillChoice ? (
                  <div className="dj-class-training" data-class={selectedClass.id}>
                    <div className="dj-level-pick">
                      <span className="dj-eyebrow">Starting level</span>
                      <label>
                        <span>Level</span>
                        <select
                          value={props.draft.level}
                          onChange={(event) => changeStartingLevel(Number(event.target.value))}
                        >
                          {levelOptions.map((level) => (
                            <option value={level} key={level}>
                              Level {level}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>HP method</span>
                        <select
                          value={props.draft.settings.hitPointType}
                          onChange={(event) => changeHitPointType(event.target.value as CharacterSettings["hitPointType"])}
                        >
                          <option value="fixed">Fixed</option>
                          <option value="rolled">Rolled</option>
                          <option value="manual">Manual</option>
                        </select>
                      </label>
                      <small>
                        Proficiency bonus {signed(proficiencyBonus(props.draft.level))} / starting HP{" "}
                        {startingHpDisplay}
                      </small>
                      <small>
                        Level 1: {firstLevelHp} HP. Later levels use {hpMethodLabel} d{selectedClass.hitDie}
                        {constitutionModifier !== 0 ? ` ${signed(constitutionModifier)}` : ""}.
                      </small>
                      {usesRolledStartingHp ? (
                        <div className="dj-hp-roll-panel">
                          <button type="button" className="ledger-button small" onClick={rollStartingHp}>
                            Roll {extraHpLevels}d{selectedClass.hitDie} HP
                          </button>
                          <span className={`dj-hp-roll-status${startingHpComplete ? " done" : ""}`}>
                            {startingHpComplete
                              ? `${startingHpRolls.join(", ")} -> +${rolledHpGains.reduce((sum, gain) => sum + gain, 0)} HP`
                              : `${startingHpRolls.length}/${extraHpLevels} rolled`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="dj-skill-pick">
                      <div className="dj-skill-pick-head">
                        <span className="dj-eyebrow">Skill proficiencies</span>
                        <span className={`dj-skill-count${skillsComplete ? " done" : ""}`}>
                          {chosenSkillCount}/{skillChoice.count} chosen
                        </span>
                      </div>
                      <p className="dj-skill-hint">
                        {skillsComplete
                          ? `Trained in ${props.draft.skillProficiencies.map((id) => SKILLS.find((sk) => sk.id === id)?.name ?? id).join(", ")}.`
                          : `Choose ${skillChoice.count} skills the ${selectedClass.name.toLowerCase()} is trained in.`}
                      </p>
                      <div className="dj-skill-chips">
                        {skillChoice.options.map((skillId) => {
                          const skill = SKILLS.find((sk) => sk.id === skillId);
                          if (!skill) return null;
                          const picked = props.draft.skillProficiencies.includes(skillId);
                          const full = !picked && skillsComplete;
                          return (
                            <button
                              key={skillId}
                              type="button"
                              className={`dj-skill-chip${picked ? " picked" : ""}`}
                              aria-pressed={picked}
                              disabled={full}
                              onClick={() => toggleSkillChoice(skillId)}
                            >
                              {skill.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {classToolGrants.length > 0 || classToolChoice ? (
                      <div className="dj-skill-pick">
                        <div className="dj-skill-pick-head">
                          <span className="dj-eyebrow">Tool proficiencies</span>
                        </div>
                        {classToolGrants.length > 0 ? (
                          <p className="dj-skill-hint">Automatically trained in {classToolGrants.join(", ")}.</p>
                        ) : null}
                        {classToolChoice ? (
                          <>
                            <p className="dj-skill-hint">
                              Choose {classToolChoice.count} tool{classToolChoice.count > 1 ? "s" : ""} the{" "}
                              {selectedClass.name.toLowerCase()} is trained in.
                            </p>
                            <div className="dj-skill-chips">
                              {classToolChoice.options.map((tool) => {
                                const picked = props.draft.toolProficiencies.includes(tool);
                                const chosenInPool = props.draft.toolProficiencies.filter((t) =>
                                  classToolChoice.options.includes(t),
                                ).length;
                                const full = !picked && chosenInPool >= classToolChoice.count;
                                return (
                                  <button
                                    key={tool}
                                    type="button"
                                    className={`dj-skill-chip${picked ? " picked" : ""}`}
                                    aria-pressed={picked}
                                    disabled={full}
                                    onClick={() => toggleToolChoice(tool, classToolChoice.options, classToolChoice.count)}
                                  >
                                    {tool}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="ledger-option-list">
                  {props.ruleset.classes.map((candidate) => {
                    const selected = candidate.id === props.draft.classId;

                    return (
                      <div
                        key={candidate.id}
                        className={`ledger-option has-dot ${selected ? "active" : ""}`}
                        data-class={candidate.id}
                      >
                        <button
                          className="dj-card-select"
                          type="button"
                          aria-label={`Select ${candidate.name}`}
                          aria-pressed={selected}
                          onClick={() => {
                            if (candidate.id !== props.draft.classId) {
                              props.onDraftChange({
                                ...props.draft,
                                classId: candidate.id,
                                skillProficiencies: [],
                                toolProficiencies: props.draft.toolProficiencies.filter(
                                  (t) => !ALL_CLASS_TOOL_OPTIONS.has(t),
                                ),
                                startingHpRolls: [],
                              });
                            }
                          }}
                        />
                        <span className="ledger-option-dot" aria-hidden="true" />
                        <span className="ledger-option-name">{candidate.name}</span>
                        <span className="ledger-option-desc">{classDescriptor(candidate.id)}</span>
                        <button
                          className="dj-card-link ledger-option-link"
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => setInspectedClassId(candidate.id)}
                        >
                          Preview class
                        </button>
                        {selected ? <em className="ledger-option-state">Chosen ✦</em> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {props.step === 2 ? (
              <div className="dj-option-stack">
                {props.draft.background ? (
                  <>
                    <DossierStamp
                      type="origin"
                      label={props.draft.background}
                      detail={
                        props.draft.background === "Custom Background"
                          ? "Personal origin and campaign notes"
                          : `A ${props.draft.background.toLowerCase()} starting story`
                      }
                    />
                    {(() => {
                      const granted = BACKGROUND_SKILLS[props.draft.background];
                      if (granted && granted.length > 0) {
                        return (
                          <div className="dj-background-skills">
                            <span className="dj-eyebrow">Background skill proficiencies</span>
                            <div className="dj-skill-chips" style={{ pointerEvents: "none" }}>
                              {granted.map((skillId) => {
                                const skill = SKILLS.find((sk) => sk.id === skillId);
                                return skill ? (
                                  <span key={skillId} className="dj-skill-chip picked">{skill.name}</span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {backgroundToolGrants.length > 0 ? (
                      <div className="dj-background-skills">
                        <span className="dj-eyebrow">Background tool proficiencies</span>
                        <div className="dj-skill-chips" style={{ pointerEvents: "none" }}>
                          {backgroundToolGrants.map((tool) => (
                            <span key={tool} className="dj-skill-chip picked">{tool}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {backgroundToolChoice ? (
                      <div className="dj-skill-pick">
                        <div className="dj-skill-pick-head">
                          <span className="dj-eyebrow">Choose a tool</span>
                        </div>
                        <div className="dj-skill-chips">
                          {backgroundToolChoice.options.map((tool) => {
                            const picked = props.draft.toolProficiencies.includes(tool);
                            const chosenInPool = props.draft.toolProficiencies.filter((t) =>
                              backgroundToolChoice.options.includes(t),
                            ).length;
                            const full = !picked && chosenInPool >= backgroundToolChoice.count;
                            return (
                              <button
                                key={tool}
                                type="button"
                                className={`dj-skill-chip${picked ? " picked" : ""}`}
                                aria-pressed={picked}
                                disabled={full}
                                onClick={() => toggleToolChoice(tool, backgroundToolChoice.options, backgroundToolChoice.count)}
                              >
                                {tool}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {backgroundLanguageCount > 0 ? (
                      <div className="dj-skill-pick">
                        <div className="dj-skill-pick-head">
                          <span className="dj-eyebrow">Languages</span>
                          <span className={`dj-skill-count${props.draft.languages.length >= backgroundLanguageCount ? " done" : ""}`}>
                            {props.draft.languages.length}/{backgroundLanguageCount} chosen
                          </span>
                        </div>
                        <div className="dj-skill-chips">
                          {LANGUAGES.map((language) => {
                            const picked = props.draft.languages.includes(language);
                            const full = !picked && props.draft.languages.length >= backgroundLanguageCount;
                            return (
                              <button
                                key={language}
                                type="button"
                                className={`dj-skill-chip${picked ? " picked" : ""}`}
                                aria-pressed={picked}
                                disabled={full}
                                onClick={() => toggleLanguageChoice(language)}
                              >
                                {language}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="ledger-option-list">
                  {props.ruleset.backgrounds.map((background) => (
                    <button
                      type="button"
                      key={background}
                      className={`ledger-option has-dot ${
                        background === props.draft.background ? "active" : ""
                      }`}
                      data-origin-tone={originTone(background)}
                      onClick={() =>
                        props.onDraftChange({
                          ...props.draft,
                          background,
                          toolProficiencies: props.draft.toolProficiencies.filter(
                            (t) => !ALL_BACKGROUND_TOOL_OPTIONS.has(t),
                          ),
                          languages: [],
                        })
                      }
                      aria-pressed={background === props.draft.background}
                    >
                      <span className="ledger-option-dot" aria-hidden="true" />
                      <span className="ledger-option-name">{background}</span>
                      <span className="ledger-option-desc">
                        {background === "Custom Background"
                          ? "a personal story, written at the table"
                          : `a ${background.toLowerCase()} starting story`}
                      </span>
                      {background === props.draft.background ? (
                        <em className="ledger-option-state">Chosen ✦</em>
                      ) : null}
                    </button>
                  ))}
                </div>
                <label className="control-field">
                  <span>Alignment</span>
                  <select
                    value={props.draft.alignment}
                    onChange={(event) =>
                      props.onDraftChange({ ...props.draft, alignment: event.target.value })
                    }
                  >
                    {props.ruleset.alignments.map((alignment) => (
                      <option key={alignment} value={alignment}>
                        {alignment}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dj-notes-grid">
                  <label className="control-field narrative-field">
                    <span>Physical characteristics</span>
                    <textarea
                      value={props.draft.physicalCharacteristics}
                      placeholder="Appearance, age, clothing, scars, posture, voice..."
                      onChange={(event) =>
                        props.onDraftChange({
                          ...props.draft,
                          physicalCharacteristics: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="control-field narrative-field">
                    <span>Personal characteristics</span>
                    <textarea
                      value={props.draft.personalCharacteristics}
                      placeholder="Ideals, bonds, flaws, habits, fears, mannerisms..."
                      onChange={(event) =>
                        props.onDraftChange({
                          ...props.draft,
                          personalCharacteristics: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="control-field narrative-field wide">
                    <span>General notes</span>
                    <textarea
                      value={props.draft.generalNotes}
                      placeholder="Backstory hooks, goals, campaign notes, table reminders..."
                      onChange={(event) =>
                        props.onDraftChange({
                          ...props.draft,
                          generalNotes: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {props.step === 3 ? (
              <div className="dj-option-stack">
                {race ? (
                  <DossierStamp
                    type="species"
                    speciesId={race.id}
                    label={parseSpeciesName(race.name).displayName}
                    detail={speciesDetailLine(race)}
                  />
                ) : null}
                <div className="ledger-option-list species-list">
                  {speciesGroups.map((item) => {
                    if (item.kind === "single") {
                      const candidate = item.race;
                      return (
                        <button
                          type="button"
                          key={candidate.id}
                          className={`ledger-option has-dot ${
                            candidate.id === props.draft.raceId ? "active" : ""
                          }`}
                          data-species={candidate.id}
                          aria-haspopup="dialog"
                          aria-pressed={candidate.id === props.draft.raceId}
                          onClick={() => setInspectedSpeciesId(candidate.id)}
                        >
                          <span className="ledger-option-dot neutral" aria-hidden="true" />
                          <span className="ledger-option-name">{candidate.name}</span>
                          <span className="ledger-option-desc">{firstSentence(candidate.summary, 60)}</span>
                          {candidate.id === props.draft.raceId ? (
                            <em className="ledger-option-state">Chosen ✦</em>
                          ) : null}
                        </button>
                      );
                    }

                    const family = FAMILY_LABELS[item.familyId] ?? { name: item.familyId, summary: "" };
                    const familyHasSelection = item.members.some((m) => m.id === props.draft.raceId);

                    return (
                      <button
                        type="button"
                        key={item.familyId}
                        className={`ledger-option has-dot ${familyHasSelection ? "active" : ""}`}
                        aria-haspopup="dialog"
                        onClick={() => setFamilyPickerId(item.familyId)}
                      >
                        <span className="ledger-option-dot neutral" aria-hidden="true" />
                        <span className="ledger-option-name">{family.name}</span>
                        <span className="ledger-option-desc">{firstSentence(family.summary, 60)}</span>
                        {familyHasSelection ? (
                          <em className="ledger-option-state">Chosen ✦</em>
                        ) : (
                          <em className="ledger-option-state quiet">{`${item.members.length} subspecies`}</em>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {props.step === 4 ? (
              <div className="attribute-builder dj-attribute-builder">
                <div className="dj-stat-strip">
                  {abilityKeys.map((key) => (
                    <span key={key}>
                      {abilityLabels[key]}
                      <strong>{props.finalAbilities[key]}</strong>
                    </span>
                  ))}
                </div>
                <div className="method-row">
                  <button
                    type="button"
                    className={props.statMethod === "point-buy" ? "active" : ""}
                    onClick={() => props.onMethodChange("point-buy")}
                  >
                    Point Buy
                  </button>
                  <button
                    type="button"
                    className={props.statMethod === "standard-array" ? "active" : ""}
                    onClick={() => props.onMethodChange("standard-array")}
                  >
                    Array
                  </button>
                  <button
                    type="button"
                    className={props.statMethod === "roll" ? "active" : ""}
                    onClick={() => props.onMethodChange("roll")}
                  >
                    Roll
                  </button>
                  <button
                    type="button"
                    className={props.statMethod === "manual" ? "active" : ""}
                    onClick={() => props.onMethodChange("manual")}
                  >
                    Manual
                  </button>
                  <span className="points-pill">{props.statMethod === "manual" ? "Manual" : `${props.pointRemaining} pts`}</span>
                </div>
                {props.statMethod === "roll" ? (
                  <button className="ledger-button small" type="button" onClick={props.onRollStats}>
                    Roll 4d6
                  </button>
                ) : null}
                <div className="attribute-grid">
                  {abilityKeys.map((key) => {
                    const raceBonus = race?.bonuses[key] ?? 0;
                    return (
                      <div className="attribute-card" key={key}>
                        <span>{abilityNames[key]}</span>
                        <strong>{props.finalAbilities[key]}</strong>
                        <small>
                          {props.draft.abilities[key]}
                          {raceBonus ? ` ${signed(raceBonus)}` : ""}
                        </small>
                        {props.statMethod === "point-buy" ? (
                          <div className="mini-stepper">
                            <button type="button" aria-label={`Decrease ${abilityNames[key]}`} onClick={() => props.onPointBuyChange(key, -1)}>
                              −
                            </button>
                            <b>{props.draft.abilities[key]}</b>
                            <button type="button" aria-label={`Increase ${abilityNames[key]}`} onClick={() => props.onPointBuyChange(key, 1)}>
                              +
                            </button>
                          </div>
                        ) : props.statMethod === "manual" ? (
                          <input
                            type="number"
                            className="dj-manual-stat"
                            min={3}
                            max={20}
                            value={props.draft.abilities[key]}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v)) props.onManualAbilityChange(key, v);
                            }}
                            aria-label={`${abilityNames[key]} score`}
                          />
                        ) : (
                          <select
                            value={
                              props.statMethod === "standard-array"
                                ? props.standardAssignments[key]
                                : props.rolledAssignments[key]
                            }
                            onChange={(event) =>
                              props.onAssignmentChange(
                                props.statMethod === "standard-array" ? "standard" : "rolled",
                                key,
                                Number(event.target.value),
                              )
                            }
                          >
                            {(props.statMethod === "standard-array" ? standardArray : props.rolledScores).map(
                              (score, index) => (
                                <option value={index} key={`${score}-${index}`}>
                                  {score}
                                </option>
                              ),
                            )}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {props.step === 5 ? (
              <div className="ledger-certificate">
                <span className="ledger-eyebrow">The record, read back</span>
                <h3 className="ledger-cert-name">{props.draft.name.trim() || "Unwritten"}</h3>
                <p className="ledger-cert-line">
                  {ordinalLevel(props.draft.level)}-level
                  {race ? ` ${parseSpeciesName(race.name).displayName}` : ""}
                  {selectedClass ? ` ${selectedClass.name}` : ""}
                  {props.draft.background ? ` · ${props.draft.background}` : ""}
                  {props.draft.alignment ? ` · ${props.draft.alignment}` : ""}
                </p>
                <div className="ledger-cert-rows">
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Provenance</span>
                    {props.draft.name.trim() ? (
                      <span className="ledger-cert-value">
                        {props.draft.name.trim()}, drawn from{" "}
                        {props.draft.sourceIds
                          .map((id) => sourceOptions.find((s) => s.id === id)?.name ?? id)
                          .join(", ") || "no sources"}
                      </span>
                    ) : (
                      <span className="ledger-cert-value missing">unwritten — return to Chapter I</span>
                    )}
                  </div>
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Vocation</span>
                    {selectedClass ? (
                      <span className="ledger-cert-value">
                        {selectedClass.name}
                        {props.draft.skillProficiencies.length > 0
                          ? `; trained in ${props.draft.skillProficiencies
                              .map((id) => SKILLS.find((sk) => sk.id === id)?.name ?? id)
                              .join(", ")}`
                          : ""}
                      </span>
                    ) : (
                      <span className="ledger-cert-value missing">undecided — return to Chapter II</span>
                    )}
                  </div>
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Origin</span>
                    {props.draft.background ? (
                      <span className="ledger-cert-value">{props.draft.background}</span>
                    ) : (
                      <span className="ledger-cert-value missing">undecided — return to Chapter III</span>
                    )}
                  </div>
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Lineage</span>
                    {race ? (
                      <span className="ledger-cert-value">
                        {parseSpeciesName(race.name).displayName} — {speciesDetailLine(race)}
                      </span>
                    ) : (
                      <span className="ledger-cert-value missing">undecided — return to Chapter IV</span>
                    )}
                  </div>
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Attributes</span>
                    <span className="ledger-cert-stats">
                      {abilityKeys.map((key) => (
                        <span className="ledger-cert-stat" key={key}>
                          {abilityLabels[key]}
                          <b>{props.finalAbilities[key]}</b>
                          <i>{signed(abilityModifier(props.finalAbilities[key]))}</i>
                        </span>
                      ))}
                    </span>
                  </div>
                  {selectedClass && selectedClass.startingGear.length > 0 ? (
                    <div className="ledger-cert-row">
                      <span className="ledger-cert-label">Provisions</span>
                      <span className="ledger-cert-value">{selectedClass.startingGear.join(", ")}</span>
                    </div>
                  ) : null}
                </div>
                <div className="ledger-cert-seal-row">
                  {selectedClass ? (
                    <span className="ledger-cert-seal" data-class={selectedClass.id} aria-hidden="true">
                      <ClassIconPlaceholder classId={selectedClass.id} size={30} strokeWidth={1.6} />
                    </span>
                  ) : null}
                  <p className="ledger-footnote">
                    † Scores set by {methodLabels[props.statMethod] ?? "hand"}. Pressing the seal binds this
                    record to the roster; every entry can still be revised from the sheet.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <div className="creator-footer dj-footer">
            <button
              className="ledger-button"
              type="button"
              disabled={props.step === 0}
              onClick={() => props.onStepChange(Math.max(0, props.step - 1))}
            >
              Previous chapter
            </button>
            {props.step < steps.length - 1 ? (
              <button
                className="ledger-button ledger-button-primary"
                type="button"
                disabled={!canContinue}
                onClick={() => props.onStepChange(Math.min(steps.length - 1, props.step + 1))}
              >
                {CHAPTERS[props.step].action}
              </button>
            ) : (
              <>
                <button
                  className="ledger-button ledger-button-primary"
                  type="button"
                  onClick={() => {
                    const missing: string[] = [];
                    if (!props.draft.name.trim()) missing.push("Character name");
                    if (props.draft.sourceIds.length === 0) missing.push("at least one source");
                    if (!props.draft.classId) missing.push("a class");
                    if (!props.draft.background) missing.push("a background");
                    if (!props.draft.raceId) missing.push("a species");
                    if (missing.length > 0) {
                      setForgeError(`Missing: ${missing.join(", ")}`);
                      return;
                    }
                    setForgeError(null);
                    props.onCreate();
                  }}
                >
                  {CHAPTERS[5].action}
                </button>
                {forgeError ? <p className="forge-error">{forgeError}</p> : null}
              </>
            )}
          </div>
        </section>
      </div>

      {inspectedClass ? (
        <ClassLearnModal
          heroClass={inspectedClass}
          selected={inspectedClass.id === props.draft.classId}
          onClose={() => setInspectedClassId(null)}
          onSelect={() => {
            props.onDraftChange({
              ...props.draft,
              classId: inspectedClass.id,
              skillProficiencies: inspectedClass.id === props.draft.classId ? props.draft.skillProficiencies : [],
              startingHpRolls: inspectedClass.id === props.draft.classId ? props.draft.startingHpRolls : [],
            });
            setInspectedClassId(null);
          }}
        />
      ) : null}
      {inspectedSpecies ? (
        <SpeciesLearnModal
          species={inspectedSpecies}
          selected={inspectedSpecies.id === props.draft.raceId}
          onClose={() => setInspectedSpeciesId(null)}
          onSelect={() => {
            props.onDraftChange({ ...props.draft, raceId: inspectedSpecies.id });
            setInspectedSpeciesId(null);
          }}
        />
      ) : null}
      {pickedFamily && pickedFamily.kind === "family" ? (
        <SpeciesFamilyModal
          familyName={FAMILY_LABELS[pickedFamily.familyId]?.name ?? pickedFamily.familyId}
          familySummary={FAMILY_LABELS[pickedFamily.familyId]?.summary ?? ""}
          members={pickedFamily.members}
          selectedId={props.draft.raceId}
          onClose={() => setFamilyPickerId(null)}
          onPick={(raceId) => {
            setFamilyPickerId(null);
            setInspectedSpeciesId(raceId);
          }}
        />
      ) : null}
    </>
  );
});
