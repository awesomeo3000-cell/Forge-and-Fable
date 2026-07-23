"use client";

import { memo, useState, type CSSProperties } from "react";
import type {
  AbilityKey,
  AbilityScores,
  BuildMode,
  CharacterSettings,
  DraftCharacter,
  Ruleset,
  StatMethod,
} from "@/types/game";
import {
  abilityKeys,
  abilityLabels,
  abilityModifier,
  signed,
  sourceOptions,
} from "@/lib/utils";
import { firstLevelHp, fixedHpGain, rolledHpGain } from "@/lib/hitPoints";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import ProvenanceChapter from "@/components/commission/provenance/ProvenanceChapter";
import ClassLearnModal from "@/components/ClassLearnModal";
import SpeciesLearnModal from "@/components/SpeciesLearnModal";
import CharacterPortrait from "@/components/portraits/CharacterPortrait";
import PortraitSelectorModal from "@/components/portraits/PortraitSelectorModal";
import ClassChapter from "@/components/commission/class/ClassChapter";
import OriginChapter from "@/components/commission/origin/OriginChapter";
import AttributesChapter from "@/components/commission/attributes/AttributesChapter";
import LineageChapter from "@/components/commission/lineage/LineageChapter";
import { parseSpeciesName, speciesDetailLine } from "@/components/commission/lineage/lineagePresentation";
import CommissionChapterBanner from "@/components/commission/CommissionChapterBanner";
import { COMMISSION_CHAPTER_ARTWORK } from "@/lib/commissionChapterArtwork";
import { PORTRAITS, PORTRAITS_BY_STYLE, isCatalogPortrait, portraitFrameCss, suggestPortraitAncestry } from "@/data/portraits";
import type { PortraitStyle } from "@/data/portraits";

import { CHAPTERS, ordinalLevel } from "@/lib/ledgerCopy";
import {
  CLASS_SKILL_CHOICES,
  SKILLS,
  CLASS_TOOL_CHOICES,
  BACKGROUND_TOOL_CHOICES,
  BACKGROUND_LANGUAGE_CHOICES,
} from "@/lib/srd";
import { HOMEBREW_CLASS_ID, resolveCharacterClass } from "@/lib/homebrewIdentity";

const ALL_CLASS_TOOL_OPTIONS = new Set(Object.values(CLASS_TOOL_CHOICES).flatMap((c) => c.options));
const ALL_BACKGROUND_TOOL_OPTIONS = new Set(Object.values(BACKGROUND_TOOL_CHOICES).flatMap((c) => c.options));

type AssignmentMap = Record<AbilityKey, number>;

const steps = ["Setup", "Portrait", "Class", "Origin", "Species", "Attributes", "Finalize"];

function StepSlot(props: { value?: string | null; label: string }) {
  return props.value ? (
    <span className="dj-header-value">{props.value}</span>
  ) : (
    <span className="dj-header-slot">{props.label}</span>
  );
}

export default memo(function CreatorPanel(props: {
  draft: DraftCharacter;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  buildMode: BuildMode;
  step: number;
  statMethod: StatMethod | null;
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
  onBackToBuildModes?: () => void;
  saving?: boolean;
  editing?: boolean;
  onCustomClassNameChange: (name: string) => void;
  onCreate: () => void;
}) {
  const [inspectedClassId, setInspectedClassId] = useState<string | null>(null);
  const [inspectedSpeciesId, setInspectedSpeciesId] = useState<string | null>(null);
  // "Upload or link your own image" on the Likeness step (AO-7b) — opens the
  // selector modal, which owns upload, crop, and link validation.
  const [portraitLinkOpen, setPortraitLinkOpen] = useState(false);
  const [portraitStyleTab, setPortraitStyleTab] = useState<PortraitStyle | "all">("dreamwright");

  const customClass = resolveCharacterClass({
    classId: HOMEBREW_CLASS_ID,
    raceId: props.draft.raceId,
    customClassName: props.draft.customClassName,
  }, props.ruleset);
  const availableClasses = [...props.ruleset.classes, customClass];
  const selectedClass = props.draft.classId
    ? availableClasses.find((item) => item.id === props.draft.classId) ?? null
    : null;
  const race = props.ruleset.races.find((item) => item.id === props.draft.raceId) ?? null;
  const inspectedClass = availableClasses.find((item) => item.id === inspectedClassId) ?? null;
  const inspectedSpecies = props.ruleset.races.find((item) => item.id === inspectedSpeciesId) ?? null;

  const skillChoice = props.draft.classId ? CLASS_SKILL_CHOICES[props.draft.classId] : undefined;
  const chosenSkillCount = props.draft.skillProficiencies.length;
  const skillsComplete = !skillChoice || chosenSkillCount >= skillChoice.count;

  const backgroundLanguageCount = BACKGROUND_LANGUAGE_CHOICES[props.draft.background] ?? 0;
  const extraHpLevels = Math.max(0, props.draft.level - 1);
  const startingHpRolls = props.draft.startingHpRolls.slice(0, extraHpLevels);
  const constitutionModifier = abilityModifier(props.finalAbilities.constitution);
  const firstLevelHP = selectedClass ? firstLevelHp(selectedClass.hitDie, constitutionModifier) : 1;
  const fixedLevelHP = selectedClass ? fixedHpGain(selectedClass.hitDie, constitutionModifier) : 1;
  const rolledHpGains = startingHpRolls.map((roll) => rolledHpGain(roll, constitutionModifier));
  const usesRolledStartingHp =
    props.draft.settings.hitPointType === "rolled" && Boolean(selectedClass) && extraHpLevels > 0;
  const startingHpComplete = !usesRolledStartingHp || startingHpRolls.length === extraHpLevels;
  const startingHpPreview =
    firstLevelHP +
    (usesRolledStartingHp
      ? rolledHpGains.reduce((sum, gain) => sum + gain, 0)
      : extraHpLevels * fixedLevelHP);
  const startingHpDisplay =
    usesRolledStartingHp && !startingHpComplete ? `${firstLevelHP} + pending rolls` : `${startingHpPreview}`;
  const hpMethodLabel = props.draft.settings.hitPointType === "rolled" ? "rolled" : "fixed";
  const customClassNameComplete = props.draft.classId !== HOMEBREW_CLASS_ID || Boolean(props.draft.customClassName?.trim());
  const classStepComplete = Boolean(props.draft.classId) && customClassNameComplete && skillsComplete && startingHpComplete;

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

  /** Commit a class to the draft. Changing class clears exactly the
      class-dependent choices the previous implementation cleared: skill
      picks, class tool picks, and starting HP rolls. */
  const selectClass = (classId: string) => {
    if (classId === props.draft.classId) {
      return;
    }
    props.onDraftChange({
      ...props.draft,
      classId,
      customClassName: classId === HOMEBREW_CLASS_ID ? props.draft.customClassName : undefined,
      skillProficiencies: [],
      toolProficiencies: props.draft.toolProficiencies.filter((t) => !ALL_CLASS_TOOL_OPTIONS.has(t)),
      startingHpRolls: [],
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

  // The rolled method only completes once the dice have actually landed —
  // choosing "Rolled" no longer pre-fills scores silently.
  const rolledScoresComplete = props.statMethod !== "roll" || props.rolledScores.length === 6;

  const stepComplete = [
    Boolean(props.draft.name.trim()) && props.draft.sourceIds.length > 0,
    Boolean(props.draft.portraitUrl),
    classStepComplete,
    Boolean(props.draft.background),
    Boolean(props.draft.raceId),
    Boolean(props.statMethod) && rolledScoresComplete,
    Boolean(props.draft.name.trim()) &&
      props.draft.sourceIds.length > 0 &&
      classStepComplete &&
      Boolean(props.draft.background) &&
      Boolean(props.draft.raceId) &&
      rolledScoresComplete,
  ];

  // Live prerequisite check for the Finalize seal. Because it is derived from
  // the draft every render, the warning clears itself the moment a requirement
  // is satisfied — no stale message survives to the last page. Each entry
  // carries the builder step to jump back to.
  const missingRequirements: { label: string; step: number }[] = [
    ...(props.draft.name.trim() ? [] : [{ label: "Character name", step: 0 }]),
    ...(props.draft.sourceIds.length > 0 ? [] : [{ label: "At least one source", step: 0 }]),
    ...(props.draft.classId ? [] : [{ label: "A class", step: 2 }]),
    ...(customClassNameComplete ? [] : [{ label: "A custom class name", step: 2 }]),
    ...(props.draft.background ? [] : [{ label: "A background", step: 3 }]),
    ...(props.draft.raceId ? [] : [{ label: "A species", step: 4 }]),
    ...(rolledScoresComplete ? [] : [{ label: "Rolled ability scores", step: 5 }]),
  ];

  // TOC marginalia: the decided value each completed chapter shows (18c pass 1).
  const methodLabels: Record<StatMethod, string> = {
    "point-buy": "point buy",
    "standard-array": "standard array",
    roll: "rolled",
    manual: "manual",
  };
  const portraitIndex = props.draft.portraitUrl
    ? PORTRAITS.findIndex((item) => item.id === props.draft.portraitUrl)
    : -1;
  /* A draft may persist a retired catalog ID (the 2026-07-15 built-in purge).
     That is neither a catalog portrait nor a loadable URL — never render it
     as a "custom image" tile or preview. */
  const isCustomPortrait = Boolean(
    props.draft.portraitUrl &&
      !isCatalogPortrait(props.draft.portraitUrl) &&
      /^(https?:|data:|blob:|\/)/.test(props.draft.portraitUrl),
  );
  const portraitLabel = props.draft.portraitUrl
    ? portraitIndex >= 0
      ? `Portrait ${String(portraitIndex + 1).padStart(2, "0")}`
      : isCustomPortrait
        ? "custom image"
        : ""
        : "";
  const stylePortraits = portraitStyleTab === "all"
    ? PORTRAITS
    : (PORTRAITS_BY_STYLE.get(portraitStyleTab) ?? PORTRAITS);
  const dwCount = PORTRAITS_BY_STYLE.get("dreamwright")?.length ?? 0;
  const clCount = PORTRAITS_BY_STYLE.get("classic")?.length ?? 0;
  const decidedValues = [
    props.draft.name.trim(),
    portraitLabel,
    selectedClass?.name ?? "",
    props.draft.background,
    race ? parseSpeciesName(race.name).displayName : "",
    props.statMethod ? methodLabels[props.statMethod] : "",
    "",
  ];

  // Observatory preview column (AO-7): count of the six decisions made so
  // far — the seventh chapter is the seal, not a decision.
  const decidedCount = stepComplete.slice(0, 6).filter(Boolean).length;

  // Orrery Path §17: a disabled Continue must say why. Only the Class
  // chapter has multi-part completion, so only it gets a derived reason.
  const skillsRemaining = skillChoice ? Math.max(0, skillChoice.count - chosenSkillCount) : 0;
  const classContinueHint = !classStepComplete
    ? !props.draft.classId
      ? "Choose a class to continue."
      : !skillsComplete
        ? `Choose ${skillsRemaining} more skill${skillsRemaining === 1 ? "" : "s"} to continue.`
        : "Complete the starting HP rolls to continue."
    : null;

  const canContinue =
    props.step === 0
      ? stepComplete[0]
      : props.step === 1
        ? true // the likeness is optional — never blocks the commission
        : props.step === 2
          ? stepComplete[2]
          : props.step === 3
            ? stepComplete[3]
            : props.step === 4
              ? stepComplete[4]
              : props.step === 5
                ? rolledScoresComplete
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

  // The Seal presents the finished hero over the chapter's full illustration
  // (art handoff §7/§9.VII) — the only chapter using backdrop mode by default.
  const backdropMode = props.step === 6;
  const sealArtwork = COMMISSION_CHAPTER_ARTWORK.seal;

  return (
    <>
      <div
        className="creator-panel paper-surface dj-dossier ledger-spread ao-orrery"
        data-art-mode={backdropMode ? "backdrop" : "banner"}
        style={
          backdropMode
            ? ({
                "--chapter-backdrop": `url("${sealArtwork.backdropSrc}")`,
                "--chapter-backdrop-position": sealArtwork.backdropPosition,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="ao-orrery-brand">
          <span className="ao-orrery-brand-label">The Commission</span>
          <span
            className="ao-forge-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={6}
            aria-valuenow={decidedCount}
            aria-label="Commission progress"
          >
            <span style={{ width: `${(decidedCount / 6) * 100}%` }} />
          </span>
          <small className="ao-orrery-brand-count">{decidedCount} of 6 choices complete</small>
        </div>
        <nav className="ao-orrery-path" aria-label="Character builder steps">
          <ol className="ao-orrery-steps">
            {steps.map((step, index) => {
              const active = index === props.step;
              const complete = stepComplete[index];
              const chapter = CHAPTERS[index];
              const decided = complete ? decidedValues[index] : "";

              return (
                <li key={step}>
                  <button
                    type="button"
                    className={`ao-orrery-step${active ? " active" : ""}${complete ? " complete" : ""}`}
                    onClick={() => props.onStepChange(index)}
                    aria-current={active ? "step" : undefined}
                    aria-label={`${chapter.numeral}. ${chapter.name}${decided ? ` — decided: ${decided}` : ""}`}
                    title={decided || undefined}
                  >
                    <span className="ao-orrery-step-numeral" aria-hidden="true">
                      {chapter.numeral}
                    </span>
                    <span className="ao-orrery-step-name" aria-hidden="true">
                      {chapter.name}
                      {complete ? <span className="ao-orrery-step-check"> ✓</span> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="dj-document">
          {/* The oversized "Record of the Adventurer" identity block is gone
              from the decision chapters (refinement handoff §1) — identity
              lives in the compact preview. The Seal keeps it as the record. */}
          {props.step === 6 ? (
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
          ) : null}

          <section className="dj-section" aria-labelledby="dj-section-title">
            {props.step !== 6 ? (
              <CommissionChapterBanner
                step={props.step}
                eyebrow={`Chapter ${CHAPTERS[props.step].numeral}`}
                title={CHAPTERS[props.step].name}
                intro={CHAPTERS[props.step].intro}
              />
            ) : null}

            {props.step === 0 ? (
              <ProvenanceChapter
                draft={props.draft}
                onDraftChange={props.onDraftChange}
                onToggleSource={toggleSource}
                onSettingsChange={updateSettings}
                onChangeLevel={changeStartingLevel}
              />
            ) : null}

            {props.step === 1 ? (
              <div className="ao-portrait-step">
                <div className="ao-portrait-tabs" role="tablist" aria-label="Portrait styles">
                  <button type="button" role="tab" aria-selected={portraitStyleTab === "dreamwright"}
                    className={`ao-portrait-tab ao-portrait-tab-dw${portraitStyleTab === "dreamwright" ? " is-active" : ""}`}
                    onClick={() => setPortraitStyleTab("dreamwright")}>Dreamwright <span className="ao-portrait-tab-count">{dwCount}</span></button>
                  <button type="button" role="tab" aria-selected={portraitStyleTab === "classic"}
                    className={`ao-portrait-tab ao-portrait-tab-cl${portraitStyleTab === "classic" ? " is-active" : ""}`}
                    onClick={() => setPortraitStyleTab("classic")}>Classic <span className="ao-portrait-tab-count">{clCount}</span></button>
                  <button type="button" role="tab" aria-selected={portraitStyleTab === "all"}
                    className={`ao-portrait-tab${portraitStyleTab === "all" ? " is-active" : ""}`}
                    onClick={() => setPortraitStyleTab("all")}>All Portraits <span className="ao-portrait-tab-count">{PORTRAITS.length}</span></button>
                </div>
                <div className="ao-portrait-workspace">
                  <div className="ao-portrait-grid" role="radiogroup" aria-label="Portrait library">
                    {stylePortraits.map((portrait, index) => {
                      const chosen = props.draft.portraitUrl === portrait.id;
                      const label = `Portrait ${String(index + 1).padStart(2, "0")}`;
                      return (
                        <button
                          key={portrait.id}
                          type="button"
                          role="radio"
                          aria-checked={chosen}
                          aria-label={label}
                          className={`ao-portrait-choice${chosen ? " selected" : ""}`}
                          onClick={() => props.onDraftChange({ ...props.draft, portraitUrl: portrait.id })}
                        >
                          <span className="ao-portrait-art" style={portraitFrameCss(portrait.id)} aria-hidden="true">
                            <span className="ao-portrait-mark" aria-hidden="true">✓</span>
                          </span>
                        </button>
                      );
                    })}
                    {isCustomPortrait ? (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={true}
                        aria-label="Custom image"
                        className="ao-portrait-choice selected"
                        onClick={() => setPortraitLinkOpen(true)}
                      >
                        <span
                          className="ao-portrait-art"
                          style={{
                            backgroundImage: `url("${props.draft.portraitUrl}")`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                          aria-hidden="true"
                        >
                          <span className="ao-portrait-mark" aria-hidden="true">✓</span>
                        </span>
                      </button>
                    ) : null}
                  </div>
                  <aside className="ao-portrait-selected" aria-label="Selected portrait">
                    {props.draft.portraitUrl && (isCatalogPortrait(props.draft.portraitUrl) || isCustomPortrait) ? (
                      <span
                        className="ao-portrait-selected-art"
                        style={
                          isCatalogPortrait(props.draft.portraitUrl)
                            ? portraitFrameCss(props.draft.portraitUrl)
                            : {
                                backgroundImage: `url("${props.draft.portraitUrl}")`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                        }
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="ao-portrait-selected-empty" aria-hidden="true">
                        <span>?</span>
                      </span>
                    )}
                    <p className="ao-portrait-hint">
                      {portraitLabel
                        ? `${portraitLabel} · private until the character joins a campaign`
                        : "The likeness is optional — you can return to this chapter any time."}
                    </p>
                    <button
                      type="button"
                      className="ledger-button small"
                      onClick={() => setPortraitLinkOpen(true)}
                    >
                      Upload or link your own image
                    </button>
                  </aside>
                </div>
              </div>
            ) : null}

            {props.step === 2 ? (
              <ClassChapter
                classes={availableClasses}
                draft={props.draft}
                hp={{
                  firstLevelHP,
                  extraHpLevels,
                  rolls: startingHpRolls,
                  rolledGains: rolledHpGains,
                  usesRolled: usesRolledStartingHp,
                  complete: startingHpComplete,
                  display: startingHpDisplay,
                  methodLabel: hpMethodLabel,
                  constitutionModifier,
                }}
                skills={{ chosenCount: chosenSkillCount, complete: skillsComplete }}
                onSelectClass={selectClass}
                onInspectClass={setInspectedClassId}
                onChangeLevel={changeStartingLevel}
                onChangeHitPointType={changeHitPointType}
                onRollStartingHp={rollStartingHp}
                onToggleSkill={toggleSkillChoice}
                onToggleTool={toggleToolChoice}
                onCustomClassNameChange={props.onCustomClassNameChange}
              />
            ) : null}

            {props.step === 3 ? (
              <OriginChapter
                backgrounds={props.ruleset.backgrounds}
                alignments={props.ruleset.alignments}
                draft={props.draft}
                onDraftChange={props.onDraftChange}
                onSelectBackground={(background) =>
                  props.onDraftChange({
                    ...props.draft,
                    background,
                    toolProficiencies: props.draft.toolProficiencies.filter(
                      (t) => !ALL_BACKGROUND_TOOL_OPTIONS.has(t),
                    ),
                    languages: [],
                  })
                }
                onToggleTool={toggleToolChoice}
                onToggleLanguage={toggleLanguageChoice}
              />
            ) : null}

            {props.step === 4 ? (
              <LineageChapter
                races={props.ruleset.races}
                draft={props.draft}
                onSelectRace={(raceId) => props.onDraftChange({ ...props.draft, raceId })}
                onInspectRace={setInspectedSpeciesId}
              />
            ) : null}

            {props.step === 5 ? (
              <AttributesChapter
                draft={props.draft}
                finalAbilities={props.finalAbilities}
                race={race}
                selectedClass={selectedClass}
                statMethod={props.statMethod}
                pointRemaining={props.pointRemaining}
                standardAssignments={props.standardAssignments}
                rolledScores={props.rolledScores}
                rolledAssignments={props.rolledAssignments}
                onMethodChange={props.onMethodChange}
                onPointBuyChange={props.onPointBuyChange}
                onManualAbilityChange={props.onManualAbilityChange}
                onAssignmentChange={props.onAssignmentChange}
                onRollStats={props.onRollStats}
                onDraftChange={props.onDraftChange}
              />
            ) : null}
            {props.step === 6 ? (
              <div className="ledger-certificate">
                <div className="ledger-cert-mast">
                  <span className="ledger-cert-chapter" id="dj-section-title">
                    {`Chapter ${CHAPTERS[6].numeral} · ${CHAPTERS[6].name}`}
                  </span>
                  {/* The finished hero, not another settings page (complete-
                      commission handoff §9): the likeness leads the record. */}
                  <CharacterPortrait
                    portraitId={props.draft.portraitUrl || null}
                    characterName={props.draft.name || "Adventurer"}
                    size={96}
                    shape="circle"
                    decorative
                    className="ao-cert-portrait"
                  />
                  <h3 className="ledger-cert-name">{props.draft.name.trim() || "Unwritten"}</h3>
                  {selectedClass ? (
                    <span className="ledger-cert-seal" data-class={selectedClass.id} aria-hidden="true">
                      <ClassIconPlaceholder classId={selectedClass.id} size={30} strokeWidth={1.6} />
                    </span>
                  ) : null}
                  <p className="ledger-cert-line">
                    {ordinalLevel(props.draft.level)}-level
                    {race ? ` ${parseSpeciesName(race.name).displayName}` : ""}
                    {selectedClass ? ` ${selectedClass.name}` : ""}
                    {props.draft.background ? ` · ${props.draft.background}` : ""}
                    {props.draft.alignment ? ` · ${props.draft.alignment}` : ""}
                  </p>
                </div>
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
                      <span className="ledger-cert-value missing">undecided — return to Chapter III</span>
                    )}
                  </div>
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Origin</span>
                    {props.draft.background ? (
                      <span className="ledger-cert-value">{props.draft.background}</span>
                    ) : (
                      <span className="ledger-cert-value missing">undecided — return to Chapter IV</span>
                    )}
                  </div>
                  <div className="ledger-cert-row">
                    <span className="ledger-cert-label">Lineage</span>
                    {race ? (
                      <span className="ledger-cert-value">
                        {parseSpeciesName(race.name).displayName} — {speciesDetailLine(race)}
                      </span>
                    ) : (
                      <span className="ledger-cert-value missing">undecided — return to Chapter V</span>
                    )}
                  </div>
                  {selectedClass && selectedClass.startingGear.length > 0 ? (
                    <div className="ledger-cert-row">
                      <span className="ledger-cert-label">Provisions</span>
                      <span className="ledger-cert-value">{selectedClass.startingGear.join(", ")}</span>
                    </div>
                  ) : null}
                </div>
                <div className="ledger-cert-attrs">
                  {abilityKeys.map((key) => (
                    <span className="ledger-cert-attr" key={key}>
                      <span>{abilityLabels[key]}</span>
                      <b>{props.finalAbilities[key]}</b>
                      <i>{signed(abilityModifier(props.finalAbilities[key]))}</i>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <div className="creator-footer dj-footer ao-commission-actions">
            {props.onBackToBuildModes ? (
              <button
                className="ledger-button"
                type="button"
                onClick={props.onBackToBuildModes}
              >
                Back to build modes
              </button>
            ) : null}
            <button
              className="ledger-button"
              type="button"
              disabled={props.step === 0}
              onClick={() => props.onStepChange(Math.max(0, props.step - 1))}
            >
              Previous chapter
            </button>
            {props.step < steps.length - 1 ? (
              <>
                {props.step === 2 && !canContinue && classContinueHint ? (
                  <p className="ao-continue-hint" aria-live="polite">
                    {classContinueHint}
                  </p>
                ) : null}
                {props.step === 5 && !canContinue ? (
                  <p className="ao-continue-hint" aria-live="polite">
                    Roll your ability scores to continue.
                  </p>
                ) : null}
                <button
                  className="ledger-button ledger-button-primary"
                  type="button"
                  disabled={!canContinue}
                  onClick={() => props.onStepChange(Math.min(steps.length - 1, props.step + 1))}
                >
                  {CHAPTERS[props.step].action}
                </button>
              </>
            ) : (
              <>
                {missingRequirements.length > 0 ? (
                  <div className="forge-missing" aria-live="polite">
                    <p className="forge-error">Finish these chapters before the hero can be forged:</p>
                    <ul className="forge-missing-list">
                      {missingRequirements.map((req) => (
                        <li key={req.label}>
                          <button
                            type="button"
                            className="forge-missing-jump"
                            onClick={() => props.onStepChange(req.step)}
                          >
                            {req.label} — return to {steps[req.step]} ⟶
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <button
                  className="ledger-button ledger-button-primary"
                  type="button"
                  disabled={props.saving}
                  aria-busy={props.saving || undefined}
                  onClick={() => {
                    // Missing prerequisites send the builder back to the first
                    // unfinished chapter instead of only flashing a message.
                    if (missingRequirements.length > 0) {
                      props.onStepChange(missingRequirements[0].step);
                      return;
                    }
                    props.onCreate();
                  }}
                >
                  {props.saving ? "Saving…" : props.editing ? "Save changes" : CHAPTERS[6].action}
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="ao-forge-preview ao-orrery-preview" aria-label="Character preview">
          {/* NOT .ao-forge-portrait — AO-7's plate treatment forces that class
              to width/height 100% !important, which blew this compact card up
              and clipped it off-screen (refinement handoff §2 bug). */}
          <CharacterPortrait
            portraitId={props.draft.portraitUrl || null}
            characterName={props.draft.name || "Adventurer"}
            size={48}
            shape="circle"
            decorative
            className="ao-orrery-portrait"
          />
          <div className="ao-orrery-preview-copy">
            <strong>{props.draft.name.trim() || "Unwritten"}</strong>
            <span>
              {`Level ${props.draft.level}`}
              {selectedClass ? ` ${selectedClass.name}` : ""}
            </span>
            <small>
              {[race ? parseSpeciesName(race.name).displayName : null, props.draft.background || null]
                .filter(Boolean)
                .join(" · ") || "Choose a calling to shape the commission."}
            </small>
          </div>
        </aside>
      </div>

      <PortraitSelectorModal
        open={portraitLinkOpen}
        value={props.draft.portraitUrl || null}
        suggestedAncestry={props.draft.raceId ? suggestPortraitAncestry(props.draft.raceId) : undefined}
        characterName={props.draft.name || "Adventurer"}
        onSave={(portraitUrl) => props.onDraftChange({ ...props.draft, portraitUrl })}
        onClose={() => setPortraitLinkOpen(false)}
      />
      {inspectedClass ? (
        <ClassLearnModal
          heroClass={inspectedClass}
          selected={inspectedClass.id === props.draft.classId}
          onClose={() => setInspectedClassId(null)}
          onSelect={() => {
            selectClass(inspectedClass.id);
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
    </>
  );
});
