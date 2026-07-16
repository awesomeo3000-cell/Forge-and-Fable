"use client";

import type { AbilityKey, AbilityScores, DraftCharacter, HeroClass, Race, StatMethod } from "@/types/game";
import { abilityKeys, abilityLabels, abilityModifier, abilityNames, signed, standardArray } from "@/lib/utils";
import RollAction from "@/components/commission/class/RollAction";

type AssignmentMap = Record<AbilityKey, number>;

const METHOD_CARDS: Array<{
  method: StatMethod;
  name: string;
  what: string;
  control: string;
  random: boolean;
}> = [
  { method: "point-buy", name: "Point Buy", what: "Spend a 27-point budget across the six abilities.", control: "Full control, balanced by budget", random: false },
  { method: "standard-array", name: "Standard Array", what: "Assign the classic 15, 14, 13, 12, 10, 8 values.", control: "Quick and even-handed", random: false },
  { method: "roll", name: "Rolled", what: "Roll 4d6, drop the lowest, and assign the results.", control: "Fortune decides the numbers", random: true },
  { method: "manual", name: "Manual", what: "Enter each score directly, 3 to 20.", control: "Total control — table rules apply", random: false },
];

const METHOD_LABELS: Record<StatMethod, string> = {
  "point-buy": "Point Buy",
  "standard-array": "Standard Array",
  roll: "Rolled",
  manual: "Manual",
};

/**
 * Chapter VI workspace (complete-commission handoff §8): the method is the
 * first decision — four explanatory cards; the relevant workspace only
 * appears once a method is chosen (statMethod stays null until then). The
 * per-method controls are the same ones the previous flat layout used, so
 * every existing handler and rule is unchanged. CreatorPanel owns all state.
 */
export default function AttributesChapter(props: {
  draft: DraftCharacter;
  finalAbilities: AbilityScores;
  race: Race | null;
  selectedClass: HeroClass | null;
  statMethod: StatMethod | null;
  pointRemaining: number;
  standardAssignments: AssignmentMap;
  rolledScores: number[];
  rolledAssignments: AssignmentMap;
  onMethodChange: (method: StatMethod) => void;
  onPointBuyChange: (ability: AbilityKey, delta: number) => void;
  onManualAbilityChange: (ability: AbilityKey, value: number) => void;
  onAssignmentChange: (type: "standard" | "rolled", ability: AbilityKey, nextIndex: number) => void;
  onRollStats: () => void;
  onDraftChange: (draft: DraftCharacter) => void;
}) {
  const method = props.statMethod;
  const race = props.race;

  const abilityControl = (key: AbilityKey) => {
    if (method === "point-buy") {
      return (
        <div className="mini-stepper">
          <button type="button" aria-label={`Decrease ${abilityNames[key]}`} onClick={() => props.onPointBuyChange(key, -1)}>
            −
          </button>
          <b>{props.draft.abilities[key]}</b>
          <button type="button" aria-label={`Increase ${abilityNames[key]}`} onClick={() => props.onPointBuyChange(key, 1)}>
            +
          </button>
        </div>
      );
    }
    if (method === "manual") {
      return (
        <input
          type="number"
          className="dj-manual-stat"
          min={3}
          max={20}
          value={props.draft.abilities[key]}
          onChange={(event) => {
            const value = parseInt(event.target.value, 10);
            if (!isNaN(value)) props.onManualAbilityChange(key, value);
          }}
          aria-label={`${abilityNames[key]} score`}
        />
      );
    }
    const assignments = method === "standard-array" ? props.standardAssignments : props.rolledAssignments;
    const values = method === "standard-array" ? standardArray : props.rolledScores;
    return (
      <select
        value={assignments[key]}
        aria-label={`Assign a value to ${abilityNames[key]}`}
        onChange={(event) =>
          props.onAssignmentChange(method === "standard-array" ? "standard" : "rolled", key, Number(event.target.value))
        }
      >
        {values.map((score, index) => (
          <option value={index} key={`${score}-${index}`}>
            {score}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div className="ao-attributes">
      <section className="ao-method-picker" aria-label="Attribute method">
        <h4 className="ao-card-title">Choose a method</h4>
        <div className="ao-method-grid">
          {METHOD_CARDS.map((card) => {
            const active = method === card.method;
            return (
              <button
                type="button"
                key={card.method}
                className={`ao-method-card${active ? " selected" : ""}`}
                aria-pressed={active}
                onClick={() => props.onMethodChange(card.method)}
              >
                <strong>{card.name}</strong>
                <span>{card.what}</span>
                <em>{card.control}</em>
                {card.random ? <small className="ao-method-random">Uses dice</small> : null}
                {active ? <span className="ao-catalog-card-state">Chosen ✦</span> : null}
              </button>
            );
          })}
        </div>
        {!method ? (
          <p className="ao-method-hint">The measuring chamber waits — choose how the six abilities are determined.</p>
        ) : null}
      </section>

      {method ? (
        <div className="ao-commission-workspace ao-attributes-workspace">
          <section className="ao-major-card ao-ability-workspace" aria-label="Ability scores">
            <div className="ao-ability-workspace-head">
              <h4 className="ao-card-title">{METHOD_LABELS[method]}</h4>
              {method === "point-buy" ? (
                <span className={`ao-decision-count${props.pointRemaining === 0 ? " done" : ""}`}>
                  {`${props.pointRemaining} points remaining`}
                </span>
              ) : null}
              {method === "roll" ? (
                <RollAction label="Roll Ability Scores · 4d6 drop lowest" onClick={props.onRollStats} />
              ) : null}
            </div>
            {method === "roll" ? (
              <p className="ao-ability-roll-note" aria-live="polite">
                {`Current results: ${props.rolledScores.join(", ")} — assign each value below.`}
              </p>
            ) : null}
            <div className="ao-ability-grid">
              {abilityKeys.map((key) => {
                const raceBonus = race?.bonuses[key] ?? 0;
                const chosenBonus = (props.draft.raceBonusChoices ?? {})[key] ?? 0;
                const final = props.finalAbilities[key];
                return (
                  <div className="ao-ability-card" key={key}>
                    <span className="ao-ability-card-name">
                      {abilityNames[key]}
                      <em>{abilityLabels[key]}</em>
                    </span>
                    <span className="ao-ability-card-score">
                      <b>{final}</b>
                      <i>{signed(abilityModifier(final))}</i>
                    </span>
                    <small className="ao-ability-card-base">
                      {`base ${props.draft.abilities[key]}`}
                      {raceBonus ? ` ${signed(raceBonus)} lineage` : ""}
                      {chosenBonus ? ` +${chosenBonus} chosen` : ""}
                    </small>
                    {abilityControl(key)}
                  </div>
                );
              })}
            </div>

            {race?.bonusChoices && race.bonusChoices > 0 ? (() => {
              const currentChoices = props.draft.raceBonusChoices ?? {};
              const chosenCount = abilityKeys.reduce((sum, k) => sum + (currentChoices[k] ?? 0), 0);
              const remaining = race.bonusChoices - chosenCount;
              return (
                <div className="ao-decision-card ao-lineage-bonus">
                  <div className="ao-decision-head">
                    <h5>{`${race.name}: choose ${race.bonusChoices} ability score${race.bonusChoices > 1 ? "s" : ""} to raise by 1`}</h5>
                    <span className={`ao-decision-count${remaining === 0 ? " done" : ""}`}>{`${remaining} remaining`}</span>
                  </div>
                  <div className="dj-skill-chips">
                    {abilityKeys.map((key) => {
                      const picked = (currentChoices[key] ?? 0) > 0;
                      return (
                        <button
                          key={`bc-${key}`}
                          type="button"
                          className={`dj-skill-chip${picked ? " picked" : ""}`}
                          aria-pressed={picked}
                          disabled={remaining <= 0 && !picked}
                          onClick={() => {
                            const updated = { ...currentChoices };
                            if (picked) updated[key] = 0;
                            else if (remaining > 0) updated[key] = 1;
                            props.onDraftChange({ ...props.draft, raceBonusChoices: updated });
                          }}
                        >
                          {abilityNames[key]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })() : null}
          </section>

          <aside className="ao-summary-card ao-attr-summary" aria-label="Attribute summary">
            <h4 className="ao-card-title">Attribute summary</h4>
            <dl className="ao-summary-rows">
              <div><dt>Method</dt><dd>{METHOD_LABELS[method]}</dd></div>
              {method === "point-buy" ? (
                <div><dt>Points</dt><dd className={props.pointRemaining > 0 ? "missing" : ""}>{`${props.pointRemaining} remaining`}</dd></div>
              ) : null}
              {props.selectedClass && props.selectedClass.primary.length > 0 ? (
                <div>
                  <dt>{`${props.selectedClass.name} favors`}</dt>
                  <dd>{props.selectedClass.primary.map((key) => abilityLabels[key]).join(" & ")}</dd>
                </div>
              ) : null}
            </dl>
            <div className="ao-attr-summary-grid">
              {abilityKeys.map((key) => (
                <span className="ao-attr-summary-cell" key={key}>
                  <span>{abilityLabels[key]}</span>
                  <b>{props.finalAbilities[key]}</b>
                  <i>{signed(abilityModifier(props.finalAbilities[key]))}</i>
                </span>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
