import type { CharacterSettings, DraftCharacter, HeroClass } from "@/types/game";
import { proficiencyBonus, signed } from "@/lib/utils";
import { ordinalLevel } from "@/lib/ledgerCopy";
import { CLASS_SKILL_CHOICES, CLASS_TOOL_CHOICES, CLASS_TOOL_GRANTS, SKILLS } from "@/lib/srd";
import ClassDecisionCard from "./ClassDecisionCard";
import RollAction from "./RollAction";

const LEVEL_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);

/** Starting-HP display values computed once in CreatorPanel — the completion
    rule stays authoritative there and is only rendered here. */
export type ClassHpSummary = {
  firstLevelHP: number;
  extraHpLevels: number;
  rolls: number[];
  rolledGains: number[];
  usesRolled: boolean;
  complete: boolean;
  display: string;
  methodLabel: string;
  constitutionModifier: number;
};

export type ClassSkillSummary = {
  chosenCount: number;
  complete: boolean;
};

/**
 * Commission Details (Orrery Path §14): the actual required choices for the
 * confirmed class, as separated decision cards. All selection and validation
 * logic lives in CreatorPanel and arrives here as values and callbacks.
 */
export default function ClassCommissionDetails(props: {
  heroClass: HeroClass;
  draft: DraftCharacter;
  hp: ClassHpSummary;
  skills: ClassSkillSummary;
  onChangeLevel: (level: number) => void;
  onChangeHitPointType: (type: CharacterSettings["hitPointType"]) => void;
  onRollStartingHp: () => void;
  onToggleSkill: (skillId: string) => void;
  onToggleTool: (tool: string, options: string[], count: number) => void;
}) {
  const { heroClass, draft, hp, skills } = props;
  const skillChoice = CLASS_SKILL_CHOICES[heroClass.id];
  const toolGrants = CLASS_TOOL_GRANTS[heroClass.id] ?? [];
  const toolChoice = CLASS_TOOL_CHOICES[heroClass.id];
  const toolsChosen = toolChoice
    ? draft.toolProficiencies.filter((tool) => toolChoice.options.includes(tool)).length
    : 0;

  return (
    <section className="ao-class-decisions" aria-label="Commission details">
      <div className="ao-class-decisions-head">
        <h4 className="ao-class-section-title">Commission Details</h4>
        <p>Choose your {heroClass.name.toLowerCase()}’s starting options.</p>
      </div>
      <div className="ao-class-decisions-grid">
        <ClassDecisionCard title="Starting Level" state="complete" status={`Level ${draft.level}`}>
          <label className="ao-class-decision-field">
            <span>Level</span>
            <select value={draft.level} onChange={(event) => props.onChangeLevel(Number(event.target.value))}>
              {LEVEL_OPTIONS.map((level) => (
                <option value={level} key={level}>
                  Level {level}
                </option>
              ))}
            </select>
          </label>
          <small className="ao-class-decision-note">
            Proficiency bonus {signed(proficiencyBonus(draft.level))} · starting HP {hp.display}
          </small>
        </ClassDecisionCard>

        <ClassDecisionCard
          title="Hit Points"
          state={hp.complete ? "complete" : "incomplete"}
          status={
            hp.usesRolled
              ? `${hp.rolls.length} of ${hp.extraHpLevels} rolls complete`
              : `${hp.display} HP`
          }
          hint={`Level 1: ${hp.firstLevelHP} HP. Later levels use ${hp.methodLabel} d${heroClass.hitDie}${
            hp.constitutionModifier !== 0 ? ` ${signed(hp.constitutionModifier)}` : ""
          }.`}
        >
          <label className="ao-class-decision-field">
            <span>HP method</span>
            <select
              value={draft.settings.hitPointType}
              onChange={(event) => props.onChangeHitPointType(event.target.value as CharacterSettings["hitPointType"])}
            >
              <option value="fixed">Fixed</option>
              <option value="rolled">Rolled</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          {hp.usesRolled ? (
            <div className="ao-class-roll-row">
              <RollAction
                label={`Roll ${hp.extraHpLevels}d${heroClass.hitDie} HP`}
                onClick={props.onRollStartingHp}
              />
              <span className={`ao-roll-status${hp.complete ? " done" : ""}`}>
                {hp.complete
                  ? `${hp.rolls.join(", ")} → +${hp.rolledGains.reduce((sum, gain) => sum + gain, 0)} HP`
                  : `${hp.rolls.length}/${hp.extraHpLevels} rolled`}
              </span>
            </div>
          ) : null}
        </ClassDecisionCard>

        {skillChoice ? (
          <ClassDecisionCard
            title="Skill Proficiencies"
            state={skills.complete ? "complete" : "incomplete"}
            status={`${skills.chosenCount} of ${skillChoice.count} selected`}
            hint={
              skills.complete
                ? `Trained in ${draft.skillProficiencies
                    .map((id) => SKILLS.find((skill) => skill.id === id)?.name ?? id)
                    .join(", ")}.`
                : `Choose ${skillChoice.count} skills the ${heroClass.name.toLowerCase()} is trained in.`
            }
          >
            <div className="dj-skill-chips">
              {skillChoice.options.map((skillId) => {
                const skill = SKILLS.find((entry) => entry.id === skillId);
                if (!skill) return null;
                const picked = draft.skillProficiencies.includes(skillId);
                const full = !picked && skills.complete;
                return (
                  <button
                    key={skillId}
                    type="button"
                    className={`dj-skill-chip${picked ? " picked" : ""}`}
                    aria-pressed={picked}
                    disabled={full}
                    onClick={() => props.onToggleSkill(skillId)}
                  >
                    {skill.name}
                  </button>
                );
              })}
            </div>
          </ClassDecisionCard>
        ) : null}

        {toolGrants.length > 0 || toolChoice ? (
          <ClassDecisionCard
            title="Tool Proficiencies"
            state={!toolChoice || toolsChosen >= toolChoice.count ? "complete" : "incomplete"}
            status={toolChoice ? `${toolsChosen} of ${toolChoice.count} selected` : undefined}
            hint={toolGrants.length > 0 ? `Automatically trained in ${toolGrants.join(", ")}.` : undefined}
          >
            {toolChoice ? (
              <>
                <p className="ao-class-decision-hint">
                  Choose {toolChoice.count} tool{toolChoice.count > 1 ? "s" : ""} the {heroClass.name.toLowerCase()}{" "}
                  is trained in.
                </p>
                <div className="dj-skill-chips">
                  {toolChoice.options.map((tool) => {
                    const picked = draft.toolProficiencies.includes(tool);
                    const full = !picked && toolsChosen >= toolChoice.count;
                    return (
                      <button
                        key={tool}
                        type="button"
                        className={`dj-skill-chip${picked ? " picked" : ""}`}
                        aria-pressed={picked}
                        disabled={full}
                        onClick={() => props.onToggleTool(tool, toolChoice.options, toolChoice.count)}
                      >
                        {tool}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </ClassDecisionCard>
        ) : null}
      </div>
      {heroClass.subclassLevel ? (
        <p className="ledger-footnote">
          {`† Subclass is chosen at ${ordinalLevel(heroClass.subclassLevel)} level; the ledger will prompt you.`}
        </p>
      ) : null}
    </section>
  );
}
