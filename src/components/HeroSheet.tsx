"use client";

import {
  Activity,
  ArrowLeftRight,
  Backpack,
  BookOpen,
  Minus,
  Moon,
  PenLine,
  Plus,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Terminal,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import type { FormEvent } from "react";
import type { AbilityKey, AbilityScores, Character, Ruleset } from "@/types/game";
import {
  abilityKeys,
  abilityLabels,
  abilityModifier,
  proficiencyBonus,
  signed,
} from "@/lib/utils";
import { SAVE_PROFICIENCIES, SKILLS, type SkillDef } from "@/lib/srd";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";

export default function HeroSheet(props: {
  character: Character;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  onRoll: (label: string, sides: number, count?: number, modifier?: number) => void;
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

  const ruleAc = props.character.customRules
    .filter((r) => r.type === "ac")
    .reduce((sum, r) => sum + r.value, 0);
  const armorClass = 10 + dexMod + ruleAc;

  const ruleInit = props.character.customRules
    .filter((r) => r.type === "initiative")
    .reduce((sum, r) => sum + r.value, 0);
  const initiative = dexMod + ruleInit;

  const ruleAttack = props.character.customRules
    .filter((r) => r.type === "attack")
    .reduce((sum, r) => sum + r.value, 0);

  const ruleSaveAll = props.character.customRules
    .filter((r) => r.type === "save")
    .reduce((sum, r) => sum + r.value, 0);

  const proficientSaves: AbilityKey[] =
    props.character.savingThrowProficiencies ??
    SAVE_PROFICIENCIES[heroClass.id]?.abilities ??
    [];

  const isSaveProficient = (key: AbilityKey) => proficientSaves.includes(key);
  const isSkillProficient = (skillId: string) =>
    (props.character.skillProficiencies ?? []).includes(skillId);

  const saveBonus = (key: AbilityKey) =>
    abilityModifier(props.finalAbilities[key]) + (isSaveProficient(key) ? pb : 0) + ruleSaveAll;

  const skillBonus = (skill: SkillDef) =>
    abilityModifier(props.finalAbilities[skill.ability]) +
    (isSkillProficient(skill.id) ? pb : 0);

  const passiveInsight = 10 + skillBonus(SKILLS.find((s) => s.id === "insight")!);
  const passiveInvestigation = 10 + skillBonus(SKILLS.find((s) => s.id === "investigation")!);
  const passivePerception = 10 + skillBonus(SKILLS.find((s) => s.id === "perception")!);

  const hpPercent = Math.max(
    0,
    Math.min(100, (props.character.currentHp / props.character.maxHp) * 100),
  );

  const knownSpells = props.ruleset.spells.filter((s) =>
    props.character.spellsKnown.includes(s.id),
  );

  const spellsByLevel = knownSpells.reduce(
    (acc, spell) => {
      const lv = spell.level;
      if (!acc[lv]) acc[lv] = [];
      acc[lv].push(spell);
      return acc;
    },
    {} as Record<number, typeof knownSpells>,
  );

  const featuresUpToLevel = heroClass.levelProgression
    .filter((entry) => entry.level <= props.character.level)
    .flatMap((entry) => entry.features);

  const toggleSkillProficiency = (skillId: string) => {
    const current = props.character.skillProficiencies ?? [];
    const exists = current.includes(skillId);
    const next = exists ? current.filter((s) => s !== skillId) : [...current, skillId];
    props.onUpdate({ skillProficiencies: next });
  };

  const toggleSaveProficiency = (key: AbilityKey) => {
    const current = props.character.savingThrowProficiencies ?? proficientSaves;
    const exists = current.includes(key);
    const next = exists ? current.filter((s) => s !== key) : [...current, key];
    props.onUpdate({ savingThrowProficiencies: next });
  };

  const toggleDeathSave = (type: "successes" | "failures") => {
    const ds = props.character.deathSaves ?? { successes: 0, failures: 0 };
    const current = ds[type];
    const next = current >= 3 ? 0 : current + 1;
    props.onUpdate({ deathSaves: { ...ds, [type]: next } });
  };

  const resetDeathSaves = () => {
    props.onUpdate({ deathSaves: { successes: 0, failures: 0 } });
  };

  const skillsByAbility = abilityKeys.map((key) => ({
    ability: key,
    skills: SKILLS.filter((s) => s.ability === key),
  }));

  const subtitleParts = [
    race.name,
    heroClass.name,
    props.character.level > 0 ? `Level ${props.character.level}` : null,
    props.character.background,
    props.character.alignment,
  ].filter(Boolean);

  return (
    <div className="cs-sheet">
      {/* ── cs-identity: name, subtitle, level, rest/inspire/retire ── */}
      <div className="cs-identity">
        <div className="cs-class-icon" data-class={heroClass.id}>
          <ClassIconPlaceholder classId={heroClass.id} size={42} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="cs-char-name">{props.character.name}</h1>
          <p className="cs-char-subtitle">{subtitleParts.join(" / ")}</p>
        </div>
        <span className="cs-level-badge">Lv {props.character.level}</span>
        <div className="cs-rest-group">
          <button className="cs-glass-btn" type="button" title="Short rest"><ArrowLeftRight size={13} />Short</button>
          <button className="cs-glass-btn" type="button" title="Long rest"><Moon size={13} />Long</button>
        </div>
        <button className="cs-glass-btn cs-inspire-btn" type="button" title="Heroic Inspiration"><Sparkles size={13} />Insp</button>
        <button className="cs-retire-btn" type="button" onClick={props.onDelete}><Trash2 size={12} /></button>
      </div>

      {/* ── cs-vitals: AC, Init, Speed, Prof, HP, HD, Death Saves ── */}
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
            <span>S</span>
            {[0, 1, 2].map((i) => (<button key={`s-${i}`} className={`cs-death-dot${i < (props.character.deathSaves?.successes ?? 0) ? " dot-success" : ""}`} onClick={() => toggleDeathSave("successes")} aria-label={`Death save success ${i + 1}`} />))}
            <span>F</span>
            {[0, 1, 2].map((i) => (<button key={`f-${i}`} className={`cs-death-dot${i < (props.character.deathSaves?.failures ?? 0) ? " dot-fail" : ""}`} onClick={() => toggleDeathSave("failures")} aria-label={`Death save failure ${i + 1}`} />))}
            <button className="cs-death-reset" type="button" onClick={resetDeathSaves}>R</button>
          </div>
        </div>
      </div>

      {/* ── cs-abilities: vertical ability cells ── */}
      <div className="cs-abilities">
        {abilityKeys.map((key) => {
          const score = props.finalAbilities[key];
          const mod = abilityModifier(score);
          return (
            <button type="button" className="cs-ability-cell" key={key} onClick={() => props.onRoll(`${abilityLabels[key]} check`, 20, 1, mod)} aria-label={`Roll ${abilityLabels[key]} check, ${signed(mod)}`}>
              <span className="cs-ability-mod">{signed(mod)}</span>
              <span className="cs-ability-label">{abilityLabels[key]}</span>
              <span className="cs-ability-score">{score}</span>
            </button>
          );
        })}
      </div>

      {/* ── cs-saves: Saving Throws ── */}
      <section className="cs-saves">
        <h3 className="cs-section-eyebrow"><Shield size={12} />Saving Throws</h3>
        <div className="cs-save-grid">
          {abilityKeys.map((key) => {
            const prof = isSaveProficient(key);
            const bonus = saveBonus(key);
            return (
              <button type="button" className={`cs-save-row${prof ? " cs-prof" : ""}`} key={key} onClick={() => props.onRoll(`${abilityLabels[key]} save`, 20, 1, bonus)} onContextMenu={(e) => { e.preventDefault(); toggleSaveProficiency(key); }} aria-label={`${abilityLabels[key]} save ${signed(bonus)}${prof ? " proficient" : ""}`} title="Right-click to toggle proficiency">
                <span className="cs-prof-marker" aria-hidden="true">{prof ? "\u25CF" : "\u25CB"}</span>
                <span className="cs-save-name">{abilityLabels[key]}</span>
                <span className="cs-save-bonus">{signed(bonus)}</span>
              </button>
            );
          })}
        </div>
        {ruleSaveAll !== 0 ? <p className="cs-rule-note">All saves: {signed(ruleSaveAll)}</p> : null}
      </section>

      {/* ── cs-skills: Skills ── */}
      <section className="cs-skills">
        <h3 className="cs-section-eyebrow">Skills</h3>
        <div className="cs-skills-grid">
          {skillsByAbility.map(({ ability: abv, skills }) => (
            <div className="cs-skill-group" key={abv}>
              <span className="cs-skill-ability-tag">{abilityLabels[abv]}</span>
              {skills.map((skill) => {
                const prof = isSkillProficient(skill.id);
                const bonus = skillBonus(skill);
                return (
                  <div className="cs-skill-row" key={skill.id}>
                    <button type="button" className={`cs-prof-marker cs-prof-click${prof ? " cs-prof" : ""}`} onClick={() => toggleSkillProficiency(skill.id)} aria-label={`Toggle ${skill.name} proficiency${prof ? " (on)" : ""}`}>{prof ? "\u25CF" : "\u25CB"}</button>
                    <button type="button" className="cs-skill-btn" onClick={() => props.onRoll(skill.name, 20, 1, bonus)} aria-label={`Roll ${skill.name}, ${signed(bonus)}`}>{skill.name}</button>
                    <span className="cs-skill-bonus">{signed(bonus)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* ── cs-senses: Senses / Passives ── */}
      <section className="cs-senses">
        <h3 className="cs-section-eyebrow">Senses</h3>
        <div className="cs-sense-list">
          <div className="cs-sense-row"><span>Passive Perception</span><strong>{passivePerception}</strong></div>
          <div className="cs-sense-row"><span>Passive Investigation</span><strong>{passiveInvestigation}</strong></div>
          <div className="cs-sense-row"><span>Passive Insight</span><strong>{passiveInsight}</strong></div>
        </div>
      </section>

      {/* ── cs-profs: Proficiencies & Training ── */}
      <section className="cs-profs">
        <h3 className="cs-section-eyebrow">Proficiencies &amp; Training</h3>
        <div className="cs-prof-list">
          {heroClass.proficiencies.length > 0 ? (
            <div className="cs-prof-group">
              <span className="cs-prof-cat">Armor &amp; Weapons</span>
              <div className="cs-prof-tags">{heroClass.proficiencies.map((p) => <span className="cs-prof-chip" key={p}>{p}</span>)}</div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── cs-attacks: Attacks table ── */}
      <section className="cs-attacks">
        <h3 className="cs-section-eyebrow"><Swords size={12} />Attacks</h3>
        {heroClass.actions.length > 0 ? (
          <table className="cs-action-table">
            <thead><tr><th>Name</th><th>To-Hit</th><th>Damage</th></tr></thead>
            <tbody>
              {heroClass.actions.map((action) => {
                const toHit = abilityModifier(props.finalAbilities[action.ability]) + pb + ruleAttack;
                const dmgMod = abilityModifier(props.finalAbilities[action.ability]);
                return (
                  <tr key={action.name} className="cs-action-row-click" onClick={() => props.onRoll(action.name, 20, 1, toHit)} role="button" tabIndex={0} aria-label={`Roll ${action.name}, ${signed(toHit)} to hit`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onRoll(action.name, 20, 1, toHit); } }}>
                    <td>{action.name}</td>
                    <td>{signed(toHit)}</td>
                    <td>{action.formula}{dmgMod !== 0 ? ` ${signed(dmgMod)}` : ""}{action.damageType ? ` ${action.damageType}` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="cs-muted">No actions</p>}
      </section>

      {/* ── cs-features: Features & Traits ── */}
      <section className="cs-features">
        <h3 className="cs-section-eyebrow"><Sparkles size={12} />Features &amp; Traits</h3>
        <div className="cs-feature-list">
          <div className="cs-feature-group">
            <span className="cs-spell-level-head">Class Features</span>
            {featuresUpToLevel.length > 0 ? featuresUpToLevel.map((f, i) => (<div className="cs-feature-card" key={`${f.name}-${i}`}><strong>{f.name}</strong><p>{f.description}</p></div>)) : <p className="cs-muted">No class features at this level</p>}
          </div>
          {race.traits.length > 0 ? (<div className="cs-feature-group"><span className="cs-spell-level-head">Racial Traits</span>{race.traits.map((trait) => (<div className="cs-feature-card" key={trait.name}><strong>{trait.name}</strong><p>{trait.description}</p></div>))}</div>) : null}
          {heroClass.coreTraits.length > 0 ? (<div className="cs-feature-group"><span className="cs-spell-level-head">Core Traits</span>{heroClass.coreTraits.map((trait) => (<div className="cs-feature-card" key={trait}><p>{trait}</p></div>))}</div>) : null}
        </div>
      </section>

      {/* ── cs-notes: Notes ── */}
      <section className="cs-notes">
        <h3 className="cs-section-eyebrow"><PenLine size={12} />Notes</h3>
        <div className="cs-notes-block">
          {props.character.physicalCharacteristics ? (<div className="cs-bg-field"><span className="cs-bg-label">Physical Characteristics</span><p>{props.character.physicalCharacteristics}</p></div>) : null}
          {props.character.personalCharacteristics ? (<div className="cs-bg-field"><span className="cs-bg-label">Personal Characteristics</span><p>{props.character.personalCharacteristics}</p></div>) : null}
          {props.character.generalNotes ? (<div className="cs-bg-field"><span className="cs-bg-label">General Notes</span><p>{props.character.generalNotes}</p></div>) : null}
          {!props.character.physicalCharacteristics && !props.character.personalCharacteristics && !props.character.generalNotes ? <p className="cs-muted">No notes recorded</p> : null}
        </div>
      </section>

      {/* ── cs-inventory: Inventory ── */}
      <section className="cs-inventory">
        <h3 className="cs-section-eyebrow"><Backpack size={12} />Inventory</h3>
        {props.character.inventory.length > 0 ? (
          <div className="cs-inv-list">{props.character.inventory.map((item) => (<div className="cs-inv-row" key={item.id}><div><strong>{item.name}</strong>{item.notes ? <span>{item.notes}</span> : null}</div><div className="cs-inv-meta"><span>{item.rarity}</span>{item.attunement ? <span className="cs-attune">Attunement</span> : null}</div></div>))}</div>
        ) : <p className="cs-muted">No equipment</p>}
      </section>

      {/* ── cs-spells: Spells (omitted when none known) ── */}
      {knownSpells.length > 0 ? (
        <section className="cs-spells">
          <h3 className="cs-section-eyebrow"><BookOpen size={12} />Spells</h3>
          <div className="cs-spell-list">
            {Object.entries(spellsByLevel).sort(([a], [b]) => Number(a) - Number(b)).map(([level, spells]) => (
              <div key={level} className="cs-spell-group">
                <span className="cs-spell-level-head">{level === "0" ? "Cantrips" : `Level ${level}`}</span>
                {spells.map((spell) => (<div className="cs-spell-card" key={spell.id}><strong>{spell.name}</strong><span>{spell.school} &middot; {spell.action}</span><p>{spell.summary}</p></div>))}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── cs-background: Background ── */}
      <section className="cs-background">
        <h3 className="cs-section-eyebrow"><UserRound size={12} />Background</h3>
        <div className="cs-bg-block">
          {props.character.background ? (<div className="cs-bg-field"><span className="cs-bg-label">Background</span><p>{props.character.background}</p></div>) : null}
          {props.character.alignment ? (<div className="cs-bg-field"><span className="cs-bg-label">Alignment</span><p>{props.character.alignment}</p></div>) : null}
        </div>
      </section>

      {/* ── cs-console: Console ── */}
      <section className="cs-console">
        <h3 className="cs-section-eyebrow"><Terminal size={12} />Console</h3>
        <form className="cs-console-form" onSubmit={props.onConsoleSubmit}>
          <label className="cs-console-label"><Terminal size={14} />Command<input value={props.consoleInput} onChange={(e) => props.onConsoleInput(e.target.value)} className="cs-console-input" /></label>
          <button className="cs-glass-btn" type="submit">Execute</button>
          <div className="cs-console-log">{props.consoleLog.map((entry, i) => (<span key={`${entry}-${i}`}>{entry}</span>))}</div>
        </form>
      </section>
    </div>
  );
}
