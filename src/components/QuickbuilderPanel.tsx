"use client";

import { ChevronRight, CircleGauge, Swords, Wand2, Eye, Heart } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { Ruleset, DraftCharacter, BuildMode } from "@/types/game";
import { FIGHT_STYLES, STYLE_TO_CLASSES, buildQuickDraft, PREMADE_ARCHETYPES, type FightStyle } from "@/lib/quickbuild";

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
      <div className="quickbuilder-panel">
        <div className="start-copy">
          <span><Swords size={18} /> Premade Archetypes</span>
          <h2>Pick a ready-made hero</h2>
          <p>Choose an archetype and jump straight to final review.</p>
        </div>
        <div className="choice-grid">
          {PREMADE_ARCHETYPES.map((a) => {
            const cls = ruleset.classes.find((c) => c.id === a.classId);
            const race = ruleset.races.find((r) => r.id === a.raceId);
            return (
              <button
                key={a.id}
                type="button"
                className={`choice-tile ${classId === a.classId && raceId === a.raceId ? "active" : ""}`}
                onClick={() => { setClassId(a.classId); setRaceId(a.raceId); }}
              >
                <strong>{a.label}</strong>
                <span>{a.summary}</span>
                <small>{cls?.name} &middot; {race?.name}</small>
              </button>
            );
          })}
        </div>
        <div className="qb-name-row">
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
        <div className="creator-footer">
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
    <div className="quickbuilder-panel">
      <div className="start-copy">
        <span><CircleGauge size={18} /> Quickbuilder</span>
        <h2>Forge a hero in three steps</h2>
        <p>Answer a few questions and we&apos;ll fill in the rest.</p>
      </div>

      {/* Step 0: Fight style */}
      {step === 0 ? (
        <div className="choice-grid">
          {FIGHT_STYLES.map((style) => {
            const Icon = STYLE_ICONS[style.id];
            return (
              <button
                key={style.id}
                type="button"
                className={`choice-tile ${fightStyle === style.id ? "active" : ""}`}
                onClick={() => setFightStyle(style.id)}
              >
                <Icon size={28} />
                <strong>{style.label}</strong>
                <span>{style.summary}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Step 1: Class (vibe) */}
      {step === 1 ? (
        <div className="choice-grid">
          {classOptions.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`choice-tile ${classId === c.id ? "active" : ""}`}
              onClick={() => setClassId(c.id)}
            >
              <strong>{c.name}</strong>
              <span>{c.summary}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Step 2: Species + name */}
      {step === 2 ? (
        <div>
          <div className="choice-grid">
            {ruleset.races.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`choice-tile ${raceId === r.id ? "active" : ""}`}
                onClick={() => setRaceId(r.id)}
              >
                <strong>{r.name}</strong>
                <span>{r.summary.slice(0, 80)}</span>
              </button>
            ))}
          </div>
          <div className="qb-name-row">
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

      <div className="creator-footer">
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
