"use client";

import {
  Activity,
  ArrowLeftRight,
  Minus,
  Moon,
  Plus,
  Shield,
  Skull,
  Sparkles,
  Terminal,
  Trash2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
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

type TabId = "actions" | "spells" | "inventory" | "features" | "background" | "notes" | "console";

const TABS: { id: TabId; label: string }[] = [
  { id: "actions", label: "Actions" },
  { id: "spells", label: "Spells" },
  { id: "inventory", label: "Items" },
  { id: "features", label: "Features" },
  { id: "background", label: "Background" },
  { id: "notes", label: "Notes" },
  { id: "console", label: "Console" },
];

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

  const [activeTab, setActiveTab] = useState<TabId>("actions");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
      else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = TABS.length - 1;
      else return;

      event.preventDefault();
      const nextTab = TABS[nextIndex];
      setActiveTab(nextTab.id);
      tabRefs.current[nextTab.id]?.focus();
    },
    [],
  );

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
      {/* ── Header Strip ── */}
      <header className="cs-header-strip">
        <div className="cs-header-left">
          <div className="cs-class-icon" data-class={heroClass.id}>
            <ClassIconPlaceholder classId={heroClass.id} size={42} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="cs-char-name">{props.character.name}</h1>
            <p className="cs-char-subtitle">{subtitleParts.join(" / ")}</p>
          </div>
          <span className="cs-level-badge">Lv {props.character.level}</span>
        </div>

        <div className="cs-header-right">
          <div className="cs-rest-group">
            <button className="cs-glass-btn" type="button" title="Short rest">
              <ArrowLeftRight size={15} />
              Short Rest
            </button>
            <button className="cs-glass-btn" type="button" title="Long rest">
              <Moon size={15} />
              Long Rest
            </button>
          </div>
          <button className="cs-inspire-btn" type="button" title="Heroic Inspiration">
            <Sparkles size={16} />
            Inspiration
          </button>
          <div className="cs-hp-box">
            <span className="cs-hp-label">Hit Points</span>
            <div className="cs-hp-value-row">
              <strong className="cs-hp-current">{props.character.currentHp}</strong>
              <span className="cs-hp-sep">/</span>
              <span className="cs-hp-max">{props.character.maxHp}</span>
            </div>
            {props.character.tempHp > 0 ? (
              <span className="cs-hp-temp">+{props.character.tempHp} temp</span>
            ) : null}
            <div className="cs-hp-bar">
              <span style={{ width: `${hpPercent}%` }} />
            </div>
            <div className="cs-hp-steppers">
              <button
                type="button"
                onClick={() =>
                  props.onUpdate({ currentHp: Math.max(0, props.character.currentHp - 1) })
                }
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                onClick={() =>
                  props.onUpdate({
                    currentHp: Math.min(props.character.maxHp, props.character.currentHp + 1),
                  })
                }
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          <div className="cs-death-box">
            <span className="cs-section-eyebrow"><Skull size={12} />Death Saves</span>
            <div className="cs-death-row">
              <span>Success</span>
              <div className="cs-death-dots">
                {[0, 1, 2].map((i) => (
                  <button
                    type="button"
                    key={`s-${i}`}
                    className={`cs-death-dot${i < (props.character.deathSaves?.successes ?? 0) ? " dot-success" : ""}`}
                    onClick={() => toggleDeathSave("successes")}
                    aria-label={`Death save success ${i + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="cs-death-row">
              <span>Failure</span>
              <div className="cs-death-dots">
                {[0, 1, 2].map((i) => (
                  <button
                    type="button"
                    key={`f-${i}`}
                    className={`cs-death-dot${i < (props.character.deathSaves?.failures ?? 0) ? " dot-fail" : ""}`}
                    onClick={() => toggleDeathSave("failures")}
                    aria-label={`Death save failure ${i + 1}`}
                  />
                ))}
              </div>
            </div>
            <button className="cs-glass-btn cs-reset-btn" type="button" onClick={resetDeathSaves}>
              Reset
            </button>
          </div>
          <button className="cs-retire-btn" type="button" onClick={props.onDelete}>
            <Trash2 size={14} />
            Retire
          </button>
        </div>
      </header>

      {/* ── Stats Row ── */}
      <section className="cs-stat-row">
        {abilityKeys.map((key) => {
          const score = props.finalAbilities[key];
          const mod = abilityModifier(score);
          return (
            <button
              type="button"
              className="cs-ability-cell"
              key={key}
              onClick={() => props.onRoll(`${abilityLabels[key]} check`, 20, 1, mod)}
              aria-label={`Roll ${abilityLabels[key]} check, ${signed(mod)}`}
            >
              <span className="cs-ability-mod">{signed(mod)}</span>
              <span className="cs-ability-label">{abilityLabels[key]}</span>
              <span className="cs-ability-score">{score}</span>
            </button>
          );
        })}
        <div className="cs-ability-cell cs-prof-cell">
          <span className="cs-ability-mod">{signed(pb)}</span>
          <span className="cs-ability-label">Prof</span>
          <span className="cs-ability-score">Bonus</span>
        </div>
        <div className="cs-ability-cell">
          <span className="cs-ability-mod">{race.speed}</span>
          <span className="cs-ability-label">Speed</span>
          <span className="cs-ability-score">walk</span>
        </div>
        <div className="cs-ability-cell">
          <span className="cs-ability-mod">{signed(initiative)}</span>
          <span className="cs-ability-label">Init</span>
          <span className="cs-ability-score">DEX</span>
        </div>
      </section>

      {/* ── Three-Column Body ── */}
      <div className="cs-body">
        {/* ── Left Column ── */}
        <div className="cs-col cs-col-left">
          <section className="cs-block">
            <h3 className="cs-section-eyebrow"><Shield size={12} />Saving Throws</h3>
            <div className="cs-save-grid">
              {abilityKeys.map((key) => {
                const prof = isSaveProficient(key);
                const bonus = saveBonus(key);
                return (
                  <button
                    type="button"
                    className={`cs-save-row${prof ? " cs-prof" : ""}`}
                    key={key}
                    onClick={() => props.onRoll(`${abilityLabels[key]} save`, 20, 1, bonus)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleSaveProficiency(key);
                    }}
                    aria-label={`${abilityLabels[key]} save ${signed(bonus)}${prof ? " proficient" : ""}`}
                    title="Right-click to toggle proficiency"
                  >
                    <span className="cs-prof-marker" aria-hidden="true">
                      {prof ? "\u25CF" : "\u25CB"}
                    </span>
                    <span className="cs-save-name">{abilityLabels[key]}</span>
                    <span className="cs-save-bonus">{signed(bonus)}</span>
                  </button>
                );
              })}
            </div>
            {ruleSaveAll !== 0 ? (
              <p className="cs-rule-note">All saves: {signed(ruleSaveAll)}</p>
            ) : null}
          </section>

          <section className="cs-block">
            <h3 className="cs-section-eyebrow">Senses</h3>
            <div className="cs-sense-list">
              <div className="cs-sense-row">
                <span>Passive Perception</span>
                <strong>{passivePerception}</strong>
              </div>
              <div className="cs-sense-row">
                <span>Passive Investigation</span>
                <strong>{passiveInvestigation}</strong>
              </div>
              <div className="cs-sense-row">
                <span>Passive Insight</span>
                <strong>{passiveInsight}</strong>
              </div>
            </div>
          </section>

          <section className="cs-block">
            <h3 className="cs-section-eyebrow">Proficiencies &amp; Training</h3>
            <div className="cs-prof-list">
              {heroClass.proficiencies.length > 0 ? (
                <div className="cs-prof-group">
                  <span className="cs-prof-cat">Armor &amp; Weapons</span>
                  <div className="cs-prof-tags">
                    {heroClass.proficiencies.map((p) => (
                      <span className="cs-prof-chip" key={p}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {/* Languages not yet in data model; omit */}
            </div>
          </section>
        </div>

        {/* ── Middle Column ── */}
        <div className="cs-col cs-col-middle">
          <section className="cs-block cs-skills-block">
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
                        <button
                          type="button"
                          className={`cs-prof-marker cs-prof-click${prof ? " cs-prof" : ""}`}
                          onClick={() => toggleSkillProficiency(skill.id)}
                          aria-label={`Toggle ${skill.name} proficiency${prof ? " (on)" : ""}`}
                        >
                          {prof ? "\u25CF" : "\u25CB"}
                        </button>
                        <button
                          type="button"
                          className="cs-skill-btn"
                          onClick={() =>
                            props.onRoll(skill.name, 20, 1, bonus)
                          }
                          aria-label={`Roll ${skill.name}, ${signed(bonus)}`}
                        >
                          {skill.name}
                        </button>
                        <span className="cs-skill-bonus">{signed(bonus)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Right Column ── */}
        <div className="cs-col cs-col-right">
          <div className="cs-badges">
            <div className="cs-badge">
              <Shield size={18} />
              <span>AC</span>
              <strong>{armorClass}</strong>
            </div>
            <div className="cs-badge">
              <Activity size={18} />
              <span>Initiative</span>
              <strong>{signed(initiative)}</strong>
            </div>
          </div>

          <section className="cs-block cs-tab-block">
            <div className="cs-tablist" role="tablist" aria-label="Character sheet sections">
              {TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  role="tab"
                  className={`cs-tab${activeTab === tab.id ? " cs-tab-active" : ""}`}
                  aria-selected={activeTab === tab.id}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, i)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Actions Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "actions" ? "" : " cs-hidden"}`}
              aria-label="Actions"
            >
              {heroClass.actions.length > 0 ? (
                <table className="cs-action-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Range</th>
                      <th>To-Hit</th>
                      <th>Damage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heroClass.actions.map((action) => {
                      const toHit = abilityModifier(props.finalAbilities[action.ability]) + pb + ruleAttack;
                      const dmgMod = abilityModifier(props.finalAbilities[action.ability]);
                      return (
                        <tr
                          key={action.name}
                          className="cs-action-row-click"
                          onClick={() =>
                            props.onRoll(action.name, 20, 1, toHit)
                          }
                          role="button"
                          tabIndex={0}
                          aria-label={`Roll ${action.name}, ${signed(toHit)} to hit`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              props.onRoll(action.name, 20, 1, toHit);
                            }
                          }}
                        >
                          <td>{action.name}</td>
                          <td>5 ft</td>
                          <td>{signed(toHit)}</td>
                          <td>
                            {action.formula}
                            {dmgMod !== 0 ? ` ${signed(dmgMod)}` : ""}
                            {action.damageType ? ` ${action.damageType}` : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="cs-muted">No actions</p>
              )}
            </div>

            {/* Spells Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "spells" ? "" : " cs-hidden"}`}
              aria-label="Spells"
            >
              {knownSpells.length > 0 ? (
                <div className="cs-spell-list">
                  {Object.entries(spellsByLevel)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([level, spells]) => (
                      <div key={level} className="cs-spell-group">
                        <span className="cs-spell-level-head">
                          {level === "0" ? "Cantrips" : `Level ${level}`}
                        </span>
                        {spells.map((spell) => (
                          <div className="cs-spell-card" key={spell.id}>
                            <strong>{spell.name}</strong>
                            <span>
                              {spell.school} &middot; {spell.action}
                            </span>
                            <p>{spell.summary}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="cs-muted">No spells known</p>
              )}
            </div>

            {/* Inventory Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "inventory" ? "" : " cs-hidden"}`}
              aria-label="Inventory"
            >
              {props.character.inventory.length > 0 ? (
                <div className="cs-inv-list">
                  {props.character.inventory.map((item) => (
                    <div className="cs-inv-row" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        {item.notes ? <span>{item.notes}</span> : null}
                      </div>
                      <div className="cs-inv-meta">
                        <span>{item.rarity}</span>
                        {item.attunement ? <span className="cs-attune">Attunement</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cs-muted">No equipment</p>
              )}
            </div>

            {/* Features Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "features" ? "" : " cs-hidden"}`}
              aria-label="Features and Traits"
            >
              <div className="cs-feature-list">
                <div className="cs-feature-group">
                  <span className="cs-spell-level-head">Class Features</span>
                  {featuresUpToLevel.length > 0 ? (
                    featuresUpToLevel.map((f, i) => (
                      <div className="cs-feature-card" key={`${f.name}-${i}`}>
                        <strong>{f.name}</strong>
                        <p>{f.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="cs-muted">No class features at this level</p>
                  )}
                </div>
                {race.traits.length > 0 ? (
                  <div className="cs-feature-group">
                    <span className="cs-spell-level-head">Racial Traits</span>
                    {race.traits.map((trait) => (
                      <div className="cs-feature-card" key={trait.name}>
                        <strong>{trait.name}</strong>
                        <p>{trait.description}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {heroClass.coreTraits.length > 0 ? (
                  <div className="cs-feature-group">
                    <span className="cs-spell-level-head">Core Traits</span>
                    {heroClass.coreTraits.map((trait) => (
                      <div className="cs-feature-card" key={trait}>
                        <p>{trait}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Background Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "background" ? "" : " cs-hidden"}`}
              aria-label="Background"
            >
              <div className="cs-bg-block">
                {props.character.background ? (
                  <div className="cs-bg-field">
                    <span className="cs-bg-label">Background</span>
                    <p>{props.character.background}</p>
                  </div>
                ) : null}
                {props.character.alignment ? (
                  <div className="cs-bg-field">
                    <span className="cs-bg-label">Alignment</span>
                    <p>{props.character.alignment}</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Notes Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "notes" ? "" : " cs-hidden"}`}
              aria-label="Notes"
            >
              <div className="cs-notes-block">
                {props.character.physicalCharacteristics ? (
                  <div className="cs-bg-field">
                    <span className="cs-bg-label">Physical Characteristics</span>
                    <p>{props.character.physicalCharacteristics}</p>
                  </div>
                ) : null}
                {props.character.personalCharacteristics ? (
                  <div className="cs-bg-field">
                    <span className="cs-bg-label">Personal Characteristics</span>
                    <p>{props.character.personalCharacteristics}</p>
                  </div>
                ) : null}
                {props.character.generalNotes ? (
                  <div className="cs-bg-field">
                    <span className="cs-bg-label">General Notes</span>
                    <p>{props.character.generalNotes}</p>
                  </div>
                ) : null}
                {!props.character.physicalCharacteristics &&
                  !props.character.personalCharacteristics &&
                  !props.character.generalNotes ? (
                  <p className="cs-muted">No notes recorded</p>
                ) : null}
              </div>
            </div>

            {/* Console Tab */}
            <div
              role="tabpanel"
              className={`cs-tabpanel${activeTab === "console" ? "" : " cs-hidden"}`}
              aria-label="Console"
            >
              <form className="cs-console-form" onSubmit={props.onConsoleSubmit}>
                <label className="cs-console-label">
                  <Terminal size={14} />
                  Command
                  <input
                    value={props.consoleInput}
                    onChange={(e) => props.onConsoleInput(e.target.value)}
                    className="cs-console-input"
                  />
                </label>
                <button className="cs-glass-btn" type="submit">
                  Execute
                </button>
                <div className="cs-console-log">
                  {props.consoleLog.map((entry, i) => (
                    <span key={`${entry}-${i}`}>{entry}</span>
                  ))}
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
