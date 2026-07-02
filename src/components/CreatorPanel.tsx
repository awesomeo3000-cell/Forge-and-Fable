"use client";

import {
  ChevronRight,
  CircleGauge,
  Dices,
  Gem,
  Minus,
  Plus,
  Save,
  ScrollText,
} from "lucide-react";
import { memo, useState } from "react";
import type { AbilityKey, AbilityScores, BuildMode, CharacterSettings, DraftCharacter, Ruleset, StatMethod } from "@/types/game";
import { abilityKeys, abilityLabels, abilityNames, standardArray, sourceOptions } from "@/lib/utils";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";
import SourceSettingsPanel from "@/components/SourceSettingsPanel";
import ClassLearnModal from "@/components/ClassLearnModal";
import SpeciesLearnModal from "@/components/SpeciesLearnModal";
import { signed } from "@/lib/utils";

type AssignmentMap = Record<AbilityKey, number>;

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
  onAssignmentChange: (type: "standard" | "rolled", ability: AbilityKey, nextIndex: number) => void;
  onRollStats: () => void;
  onCreate: () => void;
}) {
  const [inspectedClassId, setInspectedClassId] = useState<string | null>(null);
  const [inspectedSpeciesId, setInspectedSpeciesId] = useState<string | null>(null);
  const [forgeError, setForgeError] = useState<string | null>(null);
  const steps = ["Setup", "Class", "Origin", "Species", "Attributes", "Finalize"];
  const race = props.ruleset.races.find((item) => item.id === props.draft.raceId) ?? null;
  const heroClass =
    props.ruleset.classes.find((item) => item.id === props.draft.classId) ?? props.ruleset.classes[0];
  const inspectedClass = props.ruleset.classes.find((item) => item.id === inspectedClassId) ?? null;
  const inspectedSpecies = props.ruleset.races.find((item) => item.id === inspectedSpeciesId) ?? null;
  const showCharacterPreview = Boolean(props.draft.classId);
  const buildModeLabel =
    props.buildMode === "quickbuilder"
      ? "Quickbuilder"
      : props.buildMode === "premade"
        ? "Premade"
        : "Standard";
  const toggleSource = (sourceId: string) => {
    const exists = props.draft.sourceIds.includes(sourceId);
    props.onDraftChange({
      ...props.draft,
      sourceIds: exists
        ? props.draft.sourceIds.filter((id) => id !== sourceId)
        : [...props.draft.sourceIds, sourceId],
    });
  };
  const canContinue =
    props.step === 0
      ? Boolean(props.draft.name.trim()) && props.draft.sourceIds.length > 0
      : props.step === 1
        ? Boolean(props.draft.classId)
        : props.step === 2
          ? Boolean(props.draft.background)
          : props.step === 3
            ? Boolean(props.draft.raceId)
            : true;
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
      <div className="creator-panel paper-surface">
      <div className="creator-header">
        <div className="creator-title">
          <span>{buildModeLabel} Build</span>
          <h2>{props.draft.name || "New character"}</h2>
        </div>
        <div className="step-tabs">
          {steps.map((step, index) => (
            <button
              type="button"
              key={step}
              className={index === props.step ? "active" : ""}
              onClick={() => props.onStepChange(index)}
            >
              {index + 1}
              <span>{step}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="creator-stage">
        <section className="hero-preview" data-class={showCharacterPreview ? heroClass.id : undefined}>
          <div className="class-icon-stage" data-class={showCharacterPreview ? heroClass.id : ""}>
            <ClassIconPlaceholder
              classId={showCharacterPreview ? heroClass.id : ""}
              size={92}
              strokeWidth={1.35}
            />
          </div>
          {showCharacterPreview ? (
            <div className="preview-identity-row">
              <div className="species-signal" data-species={race?.id ?? ""}>
                <span>
                  <SpeciesIconPlaceholder speciesId={race?.id ?? ""} size={30} strokeWidth={1.7} />
                </span>
                <div>
                  <strong>{race?.name ?? "Species"}</strong>
                  <small>{race ? `${race.creatureType} / ${race.size} / ${race.speed}` : "Unchosen"}</small>
                </div>
              </div>
            </div>
          ) : null}
          <div className="hero-summary">
            {showCharacterPreview ? (
              <>
                <strong>
                  {race ? `${race.name} ${heroClass.name}` : heroClass.name}
                </strong>
                <span>
                  {props.draft.background || "Choose a background"} / {props.draft.alignment}
                </span>
                <div className="summary-token-row">
                  <em>{heroClass.name}</em>
                  {race ? <em data-species={race.id}>{race.name}</em> : null}
                  {props.draft.background ? <em>{props.draft.background}</em> : null}
                </div>
              </>
            ) : (
              <>
                <strong>No class selected</strong>
                <span>
                  {props.step === 0
                    ? "Name your character and choose sources."
                    : "Choose a class to continue."}
                </span>
              </>
            )}
          </div>
          {showCharacterPreview ? (
            <div className="preview-stat-strip">
              {abilityKeys.map((key) => (
                <span key={key}>
                  {abilityLabels[key]}
                  <strong>{props.finalAbilities[key]}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="creator-controls">
          {props.step === 0 ? (
            <div className="setup-combo">
              <label className="control-field">
                <span>Character name</span>
                <input
                  value={props.draft.name}
                  placeholder="Enter a character name"
                  onChange={(event) => props.onDraftChange({ ...props.draft, name: event.target.value })}
                />
              </label>
              <SourceSettingsPanel
                selectedSourceIds={props.draft.sourceIds}
                settings={props.draft.settings}
                onToggleSource={toggleSource}
                onSettingsChange={updateSettings}
              />
            </div>
          ) : null}

          {props.step === 1 ? (
            <div className="choice-grid">
              {props.ruleset.classes.map((candidate) => {
                const selected = candidate.id === props.draft.classId;

                return (
                  <div
                    key={candidate.id}
                    className={`choice-tile class-choice ${selected ? "active" : ""}`}
                    data-class={candidate.id}
                  >
                    <button
                      className="class-card-select"
                      type="button"
                      aria-label={`Select ${candidate.name}`}
                      aria-pressed={selected}
                      onClick={() => props.onDraftChange({ ...props.draft, classId: candidate.id })}
                    />
                    <span className="choice-avatar" data-class={candidate.id}>
                      <ClassIconPlaceholder classId={candidate.id} size={34} strokeWidth={1.65} />
                    </span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.sourceBook}</small>
                    <button
                      className="class-preview-button"
                      type="button"
                      aria-haspopup="dialog"
                      disabled={!selected}
                      onClick={() => setInspectedClassId(candidate.id)}
                    >
                      Preview class
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {props.step === 2 ? (
            <div className="origin-panel">
              <div className="choice-grid compact-choices">
                {props.ruleset.backgrounds.map((background) => (
                  <button
                    type="button"
                    key={background}
                    className={`choice-tile background-choice ${background === props.draft.background ? "active" : ""}`}
                    onClick={() => props.onDraftChange({ ...props.draft, background })}
                  >
                    <strong>{background}</strong>
                    <span>
                      {background === "Custom Background"
                        ? "Build a personal origin from your own story and campaign details."
                        : `Use the ${background.toLowerCase()} background as this character's starting story.`}
                    </span>
                  </button>
                ))}
              </div>
              <div className="notes-grid">
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
            <div className="choice-grid species-grid">
              {props.ruleset.races.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={`choice-tile species-choice ${candidate.id === props.draft.raceId ? "active" : ""}`}
                  aria-haspopup="dialog"
                  onClick={() => setInspectedSpeciesId(candidate.id)}
                >
                  <span className="choice-avatar" data-species={candidate.id}>
                    <SpeciesIconPlaceholder speciesId={candidate.id} size={34} strokeWidth={1.65} />
                  </span>
                  <strong>{candidate.name}</strong>
                  <small>
                    {candidate.sourceLabel ? `${candidate.sourceLabel} / ` : ""}
                    {candidate.sourceBook}
                  </small>
                  <em>{candidate.id === props.draft.raceId ? "Selected" : "Preview species"}</em>
                </button>
              ))}
            </div>
          ) : null}

          {props.step === 4 ? (
            <div className="attribute-builder">
              <div className="method-row">
                <button
                  type="button"
                  className={props.statMethod === "point-buy" ? "active" : ""}
                  onClick={() => props.onMethodChange("point-buy")}
                >
                  <CircleGauge size={16} />
                  Point Buy
                </button>
                <button
                  type="button"
                  className={props.statMethod === "standard-array" ? "active" : ""}
                  onClick={() => props.onMethodChange("standard-array")}
                >
                  <ScrollText size={16} />
                  Array
                </button>
                <button
                  type="button"
                  className={props.statMethod === "roll" ? "active" : ""}
                  onClick={() => props.onMethodChange("roll")}
                >
                  <Dices size={16} />
                  Roll
                </button>
                <span className="points-pill">{props.pointRemaining} pts</span>
              </div>
              {props.statMethod === "roll" ? (
                <button className="glass-button small" type="button" onClick={props.onRollStats}>
                  <Dices size={16} />
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
                          <button type="button" onClick={() => props.onPointBuyChange(key, -1)}>
                            <Minus size={14} />
                          </button>
                          <b>{props.draft.abilities[key]}</b>
                          <button type="button" onClick={() => props.onPointBuyChange(key, 1)}>
                            <Plus size={14} />
                          </button>
                        </div>
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
            <div className="finalize-panel">
              <Gem size={34} />
              <h3>{props.draft.name}</h3>
              <p>
                Level 1 {race?.name ?? "Unchosen species"} {heroClass.name}
              </p>
              <div className="final-loadout">
                <span>{props.draft.background}</span>
                {race ? <span>{race.name}</span> : null}
                {props.draft.sourceIds.map((sourceId) => {
                  const source = sourceOptions.find((item) => item.id === sourceId);
                  return source ? <span key={source.id}>{source.name}</span> : null;
                })}
              </div>
              <div className="final-loadout">
                {heroClass.startingGear.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="creator-footer">
        <button
          className="glass-button"
          type="button"
          disabled={props.step === 0}
          onClick={() => props.onStepChange(Math.max(0, props.step - 1))}
        >
          Previous
        </button>
        {props.step < steps.length - 1 ? (
          <button
            className="gold-button"
            type="button"
            disabled={!canContinue}
            onClick={() => props.onStepChange(Math.min(steps.length - 1, props.step + 1))}
          >
            Continue
            <ChevronRight size={18} />
          </button>
        ) : (
          <>
            <button
              className="gold-button"
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
              <Save size={18} />
              Forge Hero
            </button>
            {forgeError ? <p className="forge-error">{forgeError}</p> : null}
          </>
        )}
      </div>
      </div>
      {inspectedClass ? (
        <ClassLearnModal
          heroClass={inspectedClass}
          selected={inspectedClass.id === props.draft.classId}
          onClose={() => setInspectedClassId(null)}
          onSelect={() => {
            props.onDraftChange({ ...props.draft, classId: inspectedClass.id });
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
})
