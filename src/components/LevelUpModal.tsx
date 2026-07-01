"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { AbilityKey, AbilityScores, ASIChoice } from "@/types/game";
import { abilityLabels, abilityModifier, rollDie, signed } from "@/lib/utils";
import { subclassesForClass } from "@/lib/subclasses";
import { spellsForClass } from "@/lib/spells";
import { availableFeats } from "@/lib/feats";

type LevelUpStep = "hp" | "subclass" | "asi" | "spells" | "summary";

export default function LevelUpModal({
  character,
  finalAbilities,
  classId,
  className,
  hitDie,
  asiLevels,
  subclassLevel,
  casterType,
  onConfirm,
  onCancel,
}: {
  character: { level: number; maxHp: number; currentHp: number; subclassId?: string; spellsKnown: string[]; asiChoices?: ASIChoice[]; hpRolls?: number[] };
  finalAbilities: AbilityScores;
  classId: string;
  className: string;
  hitDie: number;
  asiLevels: number[];
  subclassLevel?: number;
  casterType?: string;
  onConfirm: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const newLevel = character.level;
  const conMod = abilityModifier(finalAbilities.constitution);

  const hasHp = newLevel > 1;
  const hasSubclass = subclassLevel != null && newLevel >= subclassLevel && !character.subclassId;
  const hasAsi = asiLevels.includes(newLevel);
  const hasSpells = casterType != null && casterType !== "none" && spellsForClass(className).length > 0;

  const steps: LevelUpStep[] = [];
  if (hasHp) steps.push("hp");
  if (hasSubclass) steps.push("subclass");
  if (hasAsi) steps.push("asi");
  if (hasSpells) steps.push("spells");
  steps.push("summary");

  const [step, setStep] = useState(0);
  const current = steps[step];

  const [hpRolled, setHpRolled] = useState(false);
  const [hpGained, setHpGained] = useState(0);
  const [pickedSubclass, setPickedSubclass] = useState("");
  const [pickedFeat, setPickedFeat] = useState("");
  const [asiIncreases, setAsiIncreases] = useState<Partial<AbilityScores>>({});
  const [pickedSpells, setPickedSpells] = useState<string[]>([]);

  const availableSpells = spellsForClass(className)
    .filter((s) => s.level <= Math.ceil(newLevel / 2) && s.level > 0)
    .filter((s) => !character.spellsKnown.includes(s.id))
    .slice(0, 50);

  const feats = availableFeats();

  const rollHp = () => {
    const gained = Math.max(1, rollDie(hitDie) + conMod);
    setHpGained(gained);
    setHpRolled(true);
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
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const finish = () => {
    const data: Record<string, unknown> = {};
    if (hasHp && hpRolled) {
      data.maxHp = character.maxHp + hpGained;
      data.currentHp = character.currentHp + hpGained;
      data.hpRolls = [...(character.hpRolls ?? []), hpGained];
    }
    if (hasSubclass && pickedSubclass) {
      data.subclassId = pickedSubclass;
    }
    if (hasAsi) {
      // Apply ASI increases, including any from a chosen feat
      const finalIncreases = { ...asiIncreases };
      if (pickedFeat) {
        const feat = feats.find((f) => f.id === pickedFeat);
        if (feat?.abilityBonuses) {
          for (const a of feat.abilityBonuses) {
            finalIncreases[a] = (finalIncreases[a] ?? 0) + 1;
          }
        }
      }
      if (pickedFeat) {
        data.asiChoices = [...(character.asiChoices ?? []), { type: "feat" as const, level: newLevel, featId: pickedFeat }];
      }
      if (Object.keys(finalIncreases).length > 0) {
        data.asiChoices = [...(character.asiChoices ?? []), { type: "asi" as const, level: newLevel, increases: finalIncreases }];
      }
    }
    if (hasSpells && pickedSpells.length > 0) {
      data.spellsKnown = [...character.spellsKnown, ...pickedSpells];
    }
    onConfirm(data);
  };

  return (
    <div className="cs-levelup-overlay" onClick={onCancel}>
      <div className="cs-levelup" onClick={(e) => e.stopPropagation()}>
        <div className="cs-levelup-head">
          <h2>Level {newLevel}</h2>
          <button type="button" className="cs-glass-btn" onClick={onCancel}><X size={14} /></button>
        </div>

        <div className="cs-levelup-steps">
          {steps.map((s, i) => (
            <button key={s} type="button" className={`cs-lvl-step${i === step ? " active" : ""}${i < step ? " done" : ""}`} onClick={() => setStep(i)}>
              {s === "hp" ? "HP" : s === "subclass" ? "Subclass" : s === "asi" ? "ASI" : s === "spells" ? "Spells" : "Done"}
            </button>
          ))}
        </div>

        {/* HP step */}
        {current === "hp" && (
          <div className="cs-levelup-body">
            <p>Roll {hitDie}d{hitDie} + {signed(conMod)} to determine your hit point increase.</p>
            {!hpRolled ? (
              <button className="cs-glass-btn" type="button" onClick={rollHp}>Roll HP</button>
            ) : (
              <p><strong>+{hpGained} HP</strong> (max {character.maxHp} → {character.maxHp + hpGained})</p>
            )}
          </div>
        )}

        {/* Subclass step */}
        {current === "subclass" && (
          <div className="cs-levelup-body cs-lvl-subclass-grid">
            {subclassesForClass(classId).map((sub) => (
              <button key={sub.id} type="button" className={`cs-lvl-subcard${pickedSubclass === sub.id ? " active" : ""}`} onClick={() => setPickedSubclass(sub.id)}>
                <strong>{sub.name}</strong>
                <p>{sub.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* ASI step */}
        {current === "asi" && (
          <div className="cs-levelup-body">
            {!pickedFeat ? (
              <>
                <p>Choose ASI (+2 to one, or +1 to two, max 20) or pick a feat.</p>
                <div className="cs-asi-grid">
                  {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as AbilityKey[]).map((a) => (
                    <div key={a} className="cs-asi-row">
                      <span>{abilityLabels[a]} {finalAbilities[a] + (asiIncreases[a] ?? 0)}</span>
                      <button type="button" className="cs-lvl-stepper" onClick={() => removeAsi(a)}>−</button>
                      <button type="button" className="cs-lvl-stepper" onClick={() => applyAsi(a)}>+</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="cs-glass-btn" onClick={() => setPickedFeat(feats[0]?.id ?? "")}>Pick a Feat Instead</button>
              </>
            ) : (
              <div className="cs-lvl-subclass-grid">
                <button type="button" className="cs-glass-btn" onClick={() => setPickedFeat("")}>Back to ASI</button>
                {feats.map((f) => (
                  <button key={f.id} type="button" className={`cs-lvl-subcard${pickedFeat === f.id ? " active" : ""}`} onClick={() => setPickedFeat(f.id)}>
                    <strong>{f.name}</strong>
                    <p>{f.description.slice(0, 150)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Spells step */}
        {current === "spells" && (
          <div className="cs-levelup-body">
            <p>Choose spells to learn:</p>
            <div className="cs-lvl-spell-grid">
              {availableSpells.map((s) => (
                <button key={s.id} type="button" className={`cs-lvl-spell-row${pickedSpells.includes(s.id) ? " active" : ""}`} onClick={() => toggleSpell(s.id)}>
                  <span>{s.name}</span>
                  <small>Lv {s.level} {s.school}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {current === "summary" && (
          <div className="cs-levelup-body cs-lvl-summary">
            {hasHp && hpRolled ? <p>HP: +{hpGained}</p> : null}
            {hasSubclass && pickedSubclass ? <p>Subclass: {pickedSubclass}</p> : null}
            {hasAsi && Object.keys(asiIncreases).length > 0 ? <p>ASI: {Object.entries(asiIncreases).map(([k,v]) => `${abilityLabels[k as AbilityKey]} +${v}`).join(", ")}</p> : null}
            {hasAsi && pickedFeat ? <p>Feat: {pickedFeat}</p> : null}
            {hasSpells && pickedSpells.length > 0 ? <p>Spells: {pickedSpells.length} learned</p> : null}
            <button className="gold-button" type="button" onClick={finish}>Confirm Level Up</button>
          </div>
        )}

        {step < steps.length - 1 ? (
          <div className="cs-levelup-foot">
            <button className="glass-button" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Back</button>
            <button className="gold-button" type="button" onClick={() => setStep(step + 1)}>Continue</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
