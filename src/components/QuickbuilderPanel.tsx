"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { Ruleset, DraftCharacter, BuildMode } from "@/types/game";
import { FIGHT_STYLES, STYLE_TO_CLASSES, buildQuickDraft, PREMADE_ARCHETYPES, type FightStyle } from "@/lib/quickbuild";
import { classDescriptor, firstSentence } from "@/lib/ledgerCopy";

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

  // Premade: show archetype ledger
  if (isPremade) {
    return (
      <div className="quickbuilder-panel dj-start dj-quickbuilder ledger-page">
        <header className="ledger-page-header">
          <span className="ledger-eyebrow">Premade archetypes</span>
          <h2>Pick a ready-made hero</h2>
          <p className="ledger-chapter-sub">Choose an archetype, write a name, and jump straight to final review.</p>
        </header>
        <div className="ledger-option-list">
          {PREMADE_ARCHETYPES.map((a) => {
            const cls = ruleset.classes.find((c) => c.id === a.classId);
            const race = ruleset.races.find((r) => r.id === a.raceId);
            const chosen = classId === a.classId && raceId === a.raceId;
            return (
              <button
                key={a.id}
                type="button"
                className={`ledger-option has-dot ${chosen ? "active" : ""}`}
                data-class={a.classId}
                onClick={() => { setClassId(a.classId); setRaceId(a.raceId); }}
                aria-pressed={chosen}
              >
                <span className="ledger-option-dot" aria-hidden="true" />
                <span className="ledger-option-name">{a.label}</span>
                <span className="ledger-option-desc">
                  {[cls?.name, race?.name].filter(Boolean).join(" · ")} — {a.summary}
                </span>
                {chosen ? <em className="ledger-option-state">Chosen ✦</em> : null}
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
              placeholder="Write a name"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
              maxLength={100}
            />
          </label>
        </div>
        <div className="creator-footer dj-footer">
          <button
            className="ledger-button ledger-button-primary"
            type="button"
            disabled={!canContinue}
            onClick={handleFinish}
          >
            Review the record
          </button>
        </div>
        <button className="ledger-button qb-cancel" type="button" onClick={onCancel}>
          Back to build modes
        </button>
      </div>
    );
  }

  return (
    <div className="quickbuilder-panel dj-start dj-quickbuilder ledger-page">
      <header className="ledger-page-header">
        <span className="ledger-eyebrow">Quickbuilder</span>
        <h2>Forge a hero in three steps</h2>
        <p className="ledger-chapter-sub">Answer a few questions and the draft record fills itself in.</p>
      </header>

      {/* Step 0: Fight style */}
      {step === 0 ? (
        <div className="ledger-option-list">
          {FIGHT_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`ledger-option has-dot ${fightStyle === style.id ? "active" : ""}`}
              onClick={() => setFightStyle(style.id)}
              aria-pressed={fightStyle === style.id}
            >
              <span className="ledger-option-dot neutral" aria-hidden="true" />
              <span className="ledger-option-name">{style.label}</span>
              <span className="ledger-option-desc">{style.summary}</span>
              {fightStyle === style.id ? <em className="ledger-option-state">Chosen ✦</em> : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Step 1: Class (vibe) */}
      {step === 1 ? (
        <div className="ledger-option-list">
          {classOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ledger-option has-dot ${classId === c.id ? "active" : ""}`}
              data-class={c.id}
              onClick={() => setClassId(c.id)}
              aria-pressed={classId === c.id}
            >
              <span className="ledger-option-dot" aria-hidden="true" />
              <span className="ledger-option-name">{c.name}</span>
              <span className="ledger-option-desc">{classDescriptor(c.id) || firstSentence(c.summary, 60)}</span>
              {classId === c.id ? <em className="ledger-option-state">Chosen ✦</em> : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Step 2: Species + name */}
      {step === 2 ? (
        <div>
          <div className="ledger-option-list species-list">
            {ruleset.races.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`ledger-option has-dot ${raceId === r.id ? "active" : ""}`}
                data-species={r.id}
                onClick={() => setRaceId(r.id)}
                aria-pressed={raceId === r.id}
              >
                <span className="ledger-option-dot neutral" aria-hidden="true" />
                <span className="ledger-option-name">{r.name}</span>
                <span className="ledger-option-desc">{firstSentence(r.summary, 60)}</span>
                {raceId === r.id ? <em className="ledger-option-state">Chosen ✦</em> : null}
              </button>
            ))}
          </div>
          <div className="qb-name-row dj-qb-name">
            <label>
              <span>Character name</span>
              <input
                type="text"
                className="qb-name-input"
                placeholder="Write a name"
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
          className="ledger-button"
          type="button"
          disabled={step === 0}
          onClick={() => setStep(Math.max(0, step - 1))}
        >
          Previous question
        </button>
        {step < 2 ? (
          <button
            className="ledger-button ledger-button-primary"
            type="button"
            disabled={!canContinue}
            onClick={() => setStep(step + 1)}
          >
            Record the answer
          </button>
        ) : (
          <button
            className="ledger-button ledger-button-primary"
            type="button"
            disabled={!canContinue}
            onClick={handleFinish}
          >
            Review the record
          </button>
        )}
      </div>

      <button className="ledger-button qb-cancel" type="button" onClick={onCancel}>
        Back to build modes
      </button>
    </div>
  );
});
