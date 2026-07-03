"use client";

import { ChevronRight, Swords, Wand2, Eye, Heart } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { Ruleset, DraftCharacter, BuildMode } from "@/types/game";
import { FIGHT_STYLES, STYLE_TO_CLASSES, buildQuickDraft, PREMADE_ARCHETYPES, type FightStyle } from "@/lib/quickbuild";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import SpeciesIconPlaceholder from "@/components/icons/SpeciesIcon";

const STYLE_ICONS: Record<FightStyle, typeof Swords> = {
  weapons: Swords,
  magic: Wand2,
  sneaky: Eye,
  faith: Heart,
};

export default memo(function QuickbuilderPanel(props: {
  ruleset: Ruleset;
  mode: BuildMode;
  onComplete: (draft: DraftCharacter) => void;
  onCancel: () => void;
}) {
  const { ruleset, mode, onComplete, onCancel } = props;
  const isPremade = mode === "premade";
  const [step, setStep] = useState(0);
  const [fightStyle, setFightStyle] = useState<FightStyle | null>(null);
  const [classId, setClassId] = useState("");
  const [raceId, setRaceId] = useState("");
  const [charName, setCharName] = useState("");

  const classOptions = useMemo(() => {
    if (!fightStyle) return [];
    const ids = STYLE_TO_CLASSES[fightStyle];
    return ids.map((id) => ruleset.classes.find((c) => c.id === id)).filter(Boolean) as typeof ruleset.classes;
  }, [fightStyle, ruleset]);

  const canContinue = useMemo(() => {
    if (isPremade) return !!classId && !!raceId;
    if (step === 0) return !!fightStyle;
    if (step === 1) return !!classId;
    if (step === 2) return !!raceId && charName.trim().length > 0;
    return false;
  }, [isPremade, step, fightStyle, classId, raceId, charName]);

  const handleFinish = useCallback(() => {
    const draft = buildQuickDraft(ruleset, classId, raceId, charName.trim());
    onComplete(draft);
  }, [ruleset, classId, raceId, charName, onComplete]);

  // Premade: show archetype grid
  if (isPremade) {
    return (
      <div className="quickbuilder-panel paper-surface dj-start dj-quickbuilder">
        <div className="dj-document-header">
          <span className="dj-eyebrow">Premade archetypes</span>
          <h2>Pick a ready-made hero</h2>
          <p>Choose an archetype, write a name, and jump straight to final review.</p>
        </div>
        <div className="dj-card-grid">
          {PREMADE_ARCHETYPES.map((a) => {
            const cls = ruleset.classes.find((c) => c.id === a.classId);
            const race = ruleset.races.find((r) => r.id === a.raceId);
            return (
              <button
                key={a.id}
                type="button"
                className={`dj-card dj-option-card ${classId === a.classId && raceId === a.raceId ? "active" : ""}`}
                data-class={a.classId}
                onClick={() => { setClassId(a.classId); setRaceId(a.raceId); }}
                aria-pressed={classId === a.classId && raceId === a.raceId}
              >
                <div className="dj-card-tab" />
                <div className="dj-card-main">
                  {cls ? (
                    <span className="dj-card-icon" data-class={cls.id}>
                      <ClassIconPlaceholder classId={cls.id} size={18} strokeWidth={1.5} />
                    </span>
                  ) : null}
                  <strong>{a.label}</strong>
                </div>
                <small>{cls?.name} / {race?.name}</small>
                <span>{a.summary}</span>
                {classId === a.classId && raceId === a.raceId ? <em>chosen</em> : null}
              </button>
            );
          })}
        </div>
        <div className="qb-name-row dj-qb-name">
          <label>
            <span>Character name</span>
            <input
              type="text"
              className="qb-name-input"
              placeholder="Enter a name..."
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              maxLength={100}
            />
          </label>
        </div>
        <div className="creator-footer dj-footer">
          <button
            className="gold-button"
            type="button"
            disabled={!canContinue}
            onClick={handleFinish}
          >
            Review & Finalize
            <ChevronRight size={18} />
          </button>
        </div>
        <button className="glass-button qb-cancel" type="button" onClick={onCancel}>
          Back to build modes
        </button>
      </div>
    );
  }

  return (
    <div className="quickbuilder-panel paper-surface dj-start dj-quickbuilder">
      <div className="dj-document-header">
        <span className="dj-eyebrow">Quickbuilder</span>
        <h2>Forge a hero in three steps</h2>
        <p>Answer a few questions and the draft record fills itself in.</p>
      </div>

      {/* Step 0: Fight style */}
      {step === 0 ? (
        <div className="dj-card-grid">
          {FIGHT_STYLES.map((style) => {
            const Icon = STYLE_ICONS[style.id];
            return (
              <button
                key={style.id}
                type="button"
                className={`dj-card dj-option-card ${fightStyle === style.id ? "active" : ""}`}
                onClick={() => setFightStyle(style.id)}
                aria-pressed={fightStyle === style.id}
              >
                <div className="dj-card-tab" />
                <div className="dj-card-main">
                  <span className="dj-card-icon">
                    <Icon size={18} />
                  </span>
                  <strong>{style.label}</strong>
                  {fightStyle === style.id ? <em>chosen</em> : null}
                </div>
                <small>{style.summary}</small>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Step 1: Class (vibe) */}
      {step === 1 ? (
        <div className="dj-card-grid">
          {classOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`dj-card dj-option-card ${classId === c.id ? "active" : ""}`}
              data-class={c.id}
              onClick={() => setClassId(c.id)}
              aria-pressed={classId === c.id}
            >
              <div className="dj-card-tab" />
              <div className="dj-card-main">
                <span className="dj-card-icon" data-class={c.id}>
                  <ClassIconPlaceholder classId={c.id} size={18} strokeWidth={1.5} />
                </span>
                <strong>{c.name}</strong>
                {classId === c.id ? <em>chosen</em> : null}
              </div>
              <small>{c.summary}</small>
            </button>
          ))}
        </div>
      ) : null}

      {/* Step 2: Species + name */}
      {step === 2 ? (
        <div>
          <div className="dj-card-grid species-grid">
            {ruleset.races.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`dj-card dj-option-card ${raceId === r.id ? "active" : ""}`}
                data-species={r.id}
                onClick={() => setRaceId(r.id)}
                aria-pressed={raceId === r.id}
              >
                <div className="dj-card-tab" />
                <div className="dj-card-main">
                  <span className="dj-card-icon" data-species={r.id}>
                    <SpeciesIconPlaceholder speciesId={r.id} size={18} strokeWidth={1.5} />
                  </span>
                  <strong>{r.name}</strong>
                  {raceId === r.id ? <em>chosen</em> : null}
                </div>
                <small>{r.summary.slice(0, 90)}</small>
              </button>
            ))}
          </div>
          <div className="qb-name-row dj-qb-name">
            <label>
              <span>Character name</span>
              <input
                type="text"
                className="qb-name-input"
                placeholder="Enter a name..."
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                maxLength={100}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="creator-footer dj-footer">
        <button
          className="glass-button"
          type="button"
          disabled={step === 0}
          onClick={() => setStep(Math.max(0, step - 1))}
        >
          Previous
        </button>
        {step < 2 ? (
          <button
            className="gold-button"
            type="button"
            disabled={!canContinue}
            onClick={() => setStep(step + 1)}
          >
            Continue
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            className="gold-button"
            type="button"
            disabled={!canContinue}
            onClick={handleFinish}
          >
            Review & Finalize
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      <button className="glass-button qb-cancel" type="button" onClick={onCancel}>
        Back to build modes
      </button>
    </div>
  );
});
