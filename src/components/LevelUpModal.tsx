"use client";

import { memo, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { AbilityKey, AbilityScores, ASIChoice, CasterType, CharacterSettings, SpellStatus } from "@/types/game";
import { abilityLabels, abilityModifier, rollDie, signed } from "@/lib/utils";
import { subclassesForClass } from "@/lib/subclasses";
import { ALL_SPELLS, getSpell, learnsIndividualSpells, spellsForClass, spellsLearnedReachingLevel } from "@/lib/spells";
import { availableFeats, getFeat } from "@/lib/feats";
import { maxSlots } from "@/lib/spellSlots";
import { useFocusTrap } from "@/lib/useFocusTrap";

type LevelUpStep = "hp" | "subclass" | "asi" | "spells" | "summary";
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
  useFeatPrerequisites = true,
  hitPointType,
}: {
  character: { level: number; maxHp: number; currentHp: number; subclassId?: string; spellsKnown: string[]; asiChoices?: ASIChoice[]; hpRolls?: number[]; raceId?: string; spellStatuses?: Record<string, SpellStatus> };
  newLevel: number;
  finalAbilities: AbilityScores;
  classId: string;
  className: string;
  hitDie: number;
  asiLevels: number[];
  subclassLevel?: number;
  casterType?: string;
  raceName?: string;
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
}) {
  const conMod = abilityModifier(finalAbilities.constitution);

  const hasHp = newLevel > 1 && !skipHp;
  const hasSubclass = subclassLevel != null && newLevel >= subclassLevel && !character.subclassId;
  const hasAsi = asiLevels.includes(newLevel);

  // Spell learning: known casters (bard, ranger, sorcerer, warlock) and the
  // wizard's spellbook learn a FIXED number of leveled spells per level, per
  // the SRD tables. Prepared casters (cleric, druid, paladin, artificer)
  // never learn a fixed set — they prepare freely each day — so they get no
  // "learn spells" step. Computed up here so stepComplete can enforce the cap.
  const slots = maxSlots((casterType ?? "none") as CasterType, newLevel);
  const maxCastableLevel = slots.reduce((max, count, i) => (count > 0 ? i + 1 : max), 0);
  const availableSpells = spellsForClass(className)
    .filter((s) => s.level <= maxCastableLevel && s.level > 0)
    .filter((s) => !character.spellsKnown.includes(s.id))
    .slice(0, 50);
  const newSpellsCount = spellsLearnedReachingLevel(classId, newLevel);
  // Can't learn more than remain unlearned on the class list (small-list edge).
  const spellTarget = Math.min(newSpellsCount, availableSpells.length);
  const hasSpells = learnsIndividualSpells(classId, casterType) && newSpellsCount > 0 && spellTarget > 0;

  const steps: LevelUpStep[] = [];
  if (hasHp) steps.push("hp");
  if (hasSubclass) steps.push("subclass");
  if (hasAsi) steps.push("asi");
  if (hasSpells) steps.push("spells");
  steps.push("summary");

  const [step, setStep] = useState(0);
  const current = steps[step];

  // For manual HP the default (the average roll) is a valid gain the user can
  // accept without touching the input, so seed both the gain and the
  // "confirmed" flag. Otherwise finish()'s `hasHp && hpRolled` guard would
  // silently skip the HP update when the default was accepted as-is.
  const manualDefault = Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
  const [hpRolled, setHpRolled] = useState(hitPointType === "manual");
  const [hpRolling, setHpRolling] = useState(false);
  const [hpDieRoll, setHpDieRoll] = useState<number | null>(null);
  const [hpGained, setHpGained] = useState(hitPointType === "manual" ? manualDefault : 0);
  const [manualHp, setManualHp] = useState(manualDefault);
  const [pickedSubclass, setPickedSubclass] = useState("");
  const [pickedFeat, setPickedFeat] = useState("");
  const [featAbilityChoice, setFeatAbilityChoice] = useState<AbilityKey | null>(null);
  const [featSpellChoices, setFeatSpellChoices] = useState<string[]>([]);
  const [asiIncreases, setAsiIncreases] = useState<Partial<AbilityScores>>({});
  const [pickedSpells, setPickedSpells] = useState<string[]>([]);
  const [spellToForget, setSpellToForget] = useState<string | null>(null);
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
      case "spells": return pickedSpells.length > 0;
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

    const applyResult = (roll: number, total: number) => {
      if (!mounted.current) return;
      const gained = Math.max(1, total);
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
        onResult: ({ roll, total }) => applyResult(roll, total),
      });
      return;
    }

    const roll = rollDie(hitDie);
    applyResult(roll, roll + conMod);
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

  // Spells the character already knows that are leveled (not cantrips) —
  // eligible for the optional "replace one known spell" swap at level-up.
  const forgettableSpells = (character.spellsKnown ?? [])
    .map((id) => getSpell(id))
    .filter((s): s is NonNullable<typeof s> => s != null && s.level > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const finish = () => {
    const data: Record<string, unknown> = { level: newLevel };
    if (hasHp && hpRolled) {
      data.maxHp = character.maxHp + hpGained;
      data.currentHp = character.currentHp + hpGained;
      data.hpRolls = [...(character.hpRolls ?? []), hpGained];
    }
    if (hasSubclass && pickedSubclass) {
      data.subclassId = pickedSubclass;
    }
    if (hasAsi) {
      const choices = [...(character.asiChoices ?? [])];
      if (pickedFeat === "asi") {
        if (Object.keys(asiIncreases).length > 0) {
          choices.push({ type: "asi" as const, level: newLevel, increases: asiIncreases });
        }
      } else if (pickedFeat) {
        const featChoice: ASIChoice = { type: "feat", level: newLevel, featId: pickedFeat };
        if (featAbilityChoice) featChoice.abilityChoice = featAbilityChoice;
        choices.push(featChoice);
      }
      if (choices.length > (character.asiChoices ?? []).length) data.asiChoices = choices;
    }
    if (hasSpells && pickedSpells.length > 0) {
      let updated = [...character.spellsKnown, ...pickedSpells];
      if (spellToForget) {
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

  return (
    <div className="cs-levelup-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="cs-levelup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-levelup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cs-levelup-head">
          <h2 id="cs-levelup-title">Level {newLevel}</h2>
          <button type="button" className="cs-glass-btn" onClick={onCancel} aria-label="Close level up" title="Close"><X size={14} /></button>
        </div>

        <div className="cs-levelup-steps">
          {steps.map((s, i) => (
            <button key={s} type="button" className={`cs-lvl-step${i === step ? " active" : ""}${i < step ? " done" : ""}`} onClick={() => setStep(i)}>
              {s === "hp" ? "HP" : s === "subclass" ? "Subclass" : s === "asi" ? "Feat" : s === "spells" ? "Spells" : "Done"}
            </button>
          ))}
        </div>

        {/* HP step */}
        {current === "hp" && (
          <div className="cs-levelup-body">
            {hitPointType === "manual" ? (
              <>
                <p>Enter the hit point increase for this level (1d{hitDie} {signed(conMod)}).</p>
                <label className="control-field" style={{ marginTop: 8 }}>
                  <span>HP Gained</span>
                  <input
                    type="number"
                    min={1}
                    max={hitDie + conMod}
                    value={manualHp}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(hitDie + conMod, parseInt(e.target.value) || 1));
                      setManualHp(v);
                      setHpGained(v);
                      setHpRolled(true);
                    }}
                    style={{ width: 80 }}
                  />
                </label>
              </>
            ) : (
              <>
                <p>Roll 1d{hitDie} {signed(conMod)} to determine your hit point increase.</p>
                {!hpRolled ? (
                  <button className="cs-glass-btn" type="button" onClick={rollHp} disabled={hpRolling}>
                    {hpRolling ? "Rolling..." : "Roll HP"}
                  </button>
                ) : (
                  <p>
                    <strong>+{hpGained} HP</strong>
                    {" "}
                    ({hpDieRoll ?? hpGained} {signed(conMod)}
                    {(hpDieRoll ?? hpGained) + conMod < 1 ? ", minimum 1" : ""}; max {character.maxHp} → {character.maxHp + hpGained})
                  </p>
                )}
              </>
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

        {/* Feat step — Ability Score Improvement is the first option in the list */}
        {current === "asi" && (
          <div className="cs-levelup-body">
            <p>Choose a feat, or take an Ability Score Improvement.</p>
            <div className="cs-lvl-subclass-grid">
              <button type="button" className={`cs-lvl-subcard${pickedFeat === "asi" ? " active" : ""}`} onClick={() => setPickedFeat("asi")}>
                <strong>Ability Score Improvement</strong>
                <p>Increase one ability score by 2, or two ability scores by 1 (max 20).</p>
              </button>
              {feats.map((f) => (
                <button key={f.id} type="button" className={`cs-lvl-subcard${pickedFeat === f.id ? " active" : ""}`} onClick={() => { setPickedFeat(f.id); setFeatAbilityChoice(null); setFeatSpellChoices([]); }}>
                  <strong>{f.name}</strong>
                  <p>{f.description.slice(0, 150)}</p>
                </button>
              ))}
            </div>
            {pickedFeat === "asi" ? (
              <div className="cs-asi-grid">
                {(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as AbilityKey[]).map((a) => (
                  <div key={a} className="cs-asi-row">
                    <span>{abilityLabels[a]} {finalAbilities[a] + (asiIncreases[a] ?? 0)}</span>
                    <button type="button" className="cs-lvl-stepper" onClick={() => removeAsi(a)}>−</button>
                    <button type="button" className="cs-lvl-stepper" onClick={() => applyAsi(a)}>+</button>
                  </div>
                ))}
              </div>
            ) : null}
            {pickedFeat && pickedFeat !== "asi" && (() => {
              const chosenFeat = getFeat(pickedFeat);
              if (!chosenFeat?.chooseAbility || chosenFeat.abilityBonuses.length <= 1) return null;
              return (
                <div className="cs-feat-ability-choice">
                  <span className="cs-section-eyebrow">+1 to…</span>
                  <div className="cs-feat-ability-options">
                    {chosenFeat.abilityBonuses.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`cs-lvl-subcard compact${featAbilityChoice === a ? " active" : ""}`}
                        onClick={() => setFeatAbilityChoice(a)}
                      >
                        {abilityLabels[a]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            {featSpellOptions.length > 0 ? (
              <div className="cs-feat-ability-choice">
                <span className="cs-section-eyebrow">
                  Choose {(() => { const f = getFeat(pickedFeat); return f?.grantsSpells?.choose?.count ?? 0; })()} spell{(() => { const f = getFeat(pickedFeat); return (f?.grantsSpells?.choose?.count ?? 0) > 1 ? "s" : ""; })()} (Level {(() => { const f = getFeat(pickedFeat); return f?.grantsSpells?.choose?.level ?? 1; })()})
                </span>
                <div className="cs-lvl-spell-grid">
                  {featSpellOptions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`cs-lvl-spell-row${featSpellChoices.includes(s.id) ? " active" : ""}`}
                      onClick={() => setFeatSpellChoices((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                      )}
                    >
                      <span>{s.name}</span>
                      <small>Lv {s.level} {s.school}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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

            {forgettableSpells.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p>Replace one known spell (optional):</p>
                <select
                  className="cs-glass-btn"
                  style={{ width: "100%", padding: "6px 10px", marginTop: 6 }}
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

        {/* Summary */}
        {current === "summary" && (
          <div className="cs-levelup-body cs-lvl-summary">
            {hasHp && hpRolled ? <p>HP: +{hpGained}</p> : hasHp ? <p style={{ color: "var(--accent)" }}>HP: not rolled</p> : null}
            {hasSubclass && pickedSubclass ? <p>Subclass: {pickedSubclass}</p> : hasSubclass ? <p style={{ color: "var(--accent)" }}>Subclass: not chosen</p> : null}
            {hasAsi && pickedFeat === "asi" && Object.keys(asiIncreases).length > 0 ? <p>Ability Score Improvement: {Object.entries(asiIncreases).map(([k,v]) => `${abilityLabels[k as AbilityKey]} +${v}`).join(", ")}</p> : null}
            {hasAsi && pickedFeat && pickedFeat !== "asi" ? (
              <p>Feat: {feats.find((f) => f.id === pickedFeat)?.name ?? pickedFeat}
                {featAbilityChoice ? ` (+1 ${abilityLabels[featAbilityChoice]})` : ""}
              </p>
            ) : hasAsi && !pickedFeat ? <p style={{ color: "var(--accent)" }}>ASI/Feat: not chosen</p> : null}
            {hasAsi && pickedFeat === "asi" && Object.keys(asiIncreases).length === 0 ? <p style={{ color: "var(--accent)" }}>ASI: no increases allocated</p> : null}
            {hasSpells && pickedSpells.length > 0 ? <p>Spells: {pickedSpells.length} learned{spellToForget ? <>, 1 replaced ({getSpell(spellToForget)?.name ?? spellToForget})</> : null}</p> : hasSpells ? <p style={{ color: "var(--accent)" }}>Spells: none chosen</p> : null}
            <button className="gold-button" type="button" onClick={finish} disabled={!allDone}>Confirm Level Up</button>
          </div>
        )}

        {step < steps.length - 1 ? (
          <div className="cs-levelup-foot">
            <button className="glass-button" type="button" onClick={() => setStep(Math.max(0, step - 1))}>Back</button>
            <button className="gold-button" type="button" onClick={() => setStep(step + 1)} disabled={!canContinue}>Continue</button>
          </div>
        ) : null}
      </div>
    </div>
  );
})
