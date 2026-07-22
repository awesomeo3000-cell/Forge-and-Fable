"use client";

import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AbilityKey, AbilityScores, ASIChoice, CasterType, Character, SpellStatus } from "@/types/game";
import { abilityLabels } from "@/lib/utils";
import { ALL_SPELLS } from "@/lib/spells";
import { availableFeats, getFeat } from "@/lib/feats";

type CharacterPatch = Partial<Omit<Character, "id" | "userId" | "createdAt">>;

export default function ManageFeatsModal(props: {
  character: Character;
  finalAbilities: AbilityScores;
  raceName: string;
  casterType: CasterType;
  proficiencies: string[];
  usePrerequisites: boolean;
  onUpdate: (patch: CharacterPatch) => void;
  onClose: () => void;
  onNotify?: (message: string) => void;
}) {
  const [selectedFeatId, setSelectedFeatId] = useState("");
  const [abilityChoice, setAbilityChoice] = useState<AbilityKey | "">("");
  const [spellChoices, setSpellChoices] = useState<string[]>([]);
  const onClose = props.onClose;
  const existingChoices = props.character.asiChoices ?? [];
  const existingFeatChoices = existingChoices.filter((choice): choice is Extract<ASIChoice, { type: "feat" }> => choice.type === "feat");
  const existingFeatIds = existingFeatChoices.map((choice) => choice.featId);
  const selectedFeat = selectedFeatId ? getFeat(selectedFeatId) : undefined;

  const feats = [...availableFeats({
    raceName: props.raceName,
    casterType: props.casterType,
    existingFeatIds,
    level: props.character.level,
    abilities: props.finalAbilities,
    proficiencies: props.proficiencies,
    background: props.character.background,
    enforcePrereqs: props.usePrerequisites,
  })].sort((a, b) => a.name.localeCompare(b.name));

  const featSpellOptions = useMemo(() => {
    const choose = selectedFeat?.grantsSpells?.choose;
    if (!choose) return [];
    const known = new Set(props.character.spellsKnown ?? []);
    const fixed = new Set(selectedFeat.grantsSpells?.fixed ?? []);
    return ALL_SPELLS
      .filter((spell) => spell.level === choose.level && !known.has(spell.id) && !fixed.has(spell.id))
      .filter((spell) => !choose.schools?.length || choose.schools.includes(spell.school.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [props.character.spellsKnown, selectedFeat]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const requiresAbilityChoice = !!selectedFeat?.chooseAbility && selectedFeat.abilityBonuses.length > 1;
  const requiredSpellCount = selectedFeat?.grantsSpells?.choose?.count ?? 0;
  const addDisabled = !selectedFeat
    || (requiresAbilityChoice && !abilityChoice)
    || spellChoices.length < requiredSpellCount;

  const addFeat = () => {
    if (!selectedFeat || addDisabled) return;
    const nextChoices: ASIChoice[] = [
      ...existingChoices,
      {
        type: "feat",
        level: props.character.level,
        featId: selectedFeat.id,
        ...(abilityChoice ? { abilityChoice } : {}),
      },
    ];
    const grantSpells = [...(selectedFeat.grantsSpells?.fixed ?? []), ...spellChoices];
    const patch: CharacterPatch = { asiChoices: nextChoices };
    if (grantSpells.length > 0) {
      const spellsKnown = Array.from(new Set([...(props.character.spellsKnown ?? []), ...grantSpells]));
      const spellStatuses: Record<string, SpellStatus> = { ...(props.character.spellStatuses ?? {}) };
      for (const spellId of grantSpells) spellStatuses[spellId] = { source: `${selectedFeat.name} feat`, freeUse: true, freeUsed: false };
      patch.spellsKnown = spellsKnown;
      patch.spellStatuses = spellStatuses;
    }
    props.onUpdate(patch);
    props.onNotify?.(`${selectedFeat.name} added to ${props.character.name}.`);
    setSelectedFeatId("");
  };

  const removeFeat = (index: number) => {
    const removed = existingFeatChoices[index];
    if (!removed) return;
    const nextChoices = existingChoices.filter((choice) => choice !== removed);
    const removedFeat = getFeat(removed.featId);
    const remainingFeatNames = new Set(
      nextChoices.filter((choice): choice is Extract<ASIChoice, { type: "feat" }> => choice.type === "feat")
        .map((choice) => getFeat(choice.featId)?.name),
    );
    const spellStatuses = { ...(props.character.spellStatuses ?? {}) };
    const removableSpellIds = removedFeat
      ? Object.entries(spellStatuses)
        .filter(([, status]) => status.source === `${removedFeat.name} feat` && !remainingFeatNames.has(removedFeat.name))
        .map(([spellId]) => spellId)
      : [];
    const patch: CharacterPatch = { asiChoices: nextChoices };
    if (removableSpellIds.length > 0) {
      patch.spellsKnown = (props.character.spellsKnown ?? []).filter((spellId) => !removableSpellIds.includes(spellId));
      for (const spellId of removableSpellIds) delete spellStatuses[spellId];
      patch.spellStatuses = spellStatuses;
    }
    props.onUpdate(patch);
    props.onNotify?.(`${removedFeat?.name ?? "Feat"} removed from ${props.character.name}.`);
  };

  const toggleSpell = (spellId: string) => {
    setSpellChoices((current) => current.includes(spellId)
      ? current.filter((id) => id !== spellId)
      : current.length >= requiredSpellCount ? current : [...current, spellId]);
  };

  return (
    <div className="modal-scrim cs-feat-manager-scrim" role="presentation" onMouseDown={props.onClose}>
      <section className="cs-feat-manager" role="dialog" aria-modal="true" aria-labelledby="manage-feats-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="cs-feat-manager-head">
          <div>
            <span className="cs-section-eyebrow">Character options</span>
            <h2 id="manage-feats-title">Manage feats</h2>
            <p>Add a feat to the sheet or remove one that was added by mistake.</p>
          </div>
          <button type="button" className="cs-feat-manager-close" onClick={onClose} aria-label="Close manage feats"><X size={18} /></button>
        </header>

        <div className="cs-feat-manager-body">
          <div className="cs-feat-manager-section">
            <div className="cs-feat-manager-section-head"><span className="cs-spell-level-head">Current feats</span><span className="cs-feat-manager-count">{existingFeatChoices.length}</span></div>
            {existingFeatChoices.length > 0 ? existingFeatChoices.map((choice, index) => {
              const feat = getFeat(choice.featId);
              return (
                <div className="cs-feat-manager-row" key={`${choice.featId}-${choice.level}-${index}`}>
                  <div><strong>{feat?.name ?? choice.featId}</strong><small>Added at level {choice.level}{choice.abilityChoice ? ` · +1 ${abilityLabels[choice.abilityChoice]}` : ""}</small></div>
                  <button type="button" className="cs-glass-btn cs-feat-remove" onClick={() => removeFeat(index)}><Minus size={13} /> Remove</button>
                </div>
              );
            }) : <p className="cs-muted">No feats recorded yet.</p>}
          </div>

          <div className="cs-feat-manager-section">
            <span className="cs-spell-level-head">Add a feat</span>
            <label className="cs-feat-manager-field"><span>Feat</span>
              <select value={selectedFeatId} onChange={(event) => { setSelectedFeatId(event.target.value); setAbilityChoice(""); setSpellChoices([]); }}>
                <option value="">Choose a feat…</option>
                {feats.map((feat) => <option key={feat.id} value={feat.id}>{feat.name}</option>)}
              </select>
            </label>
            {selectedFeat ? <p className="cs-feat-manager-description">{selectedFeat.description}</p> : null}
            {requiresAbilityChoice ? (
              <label className="cs-feat-manager-field"><span>Ability increase</span>
                <select value={abilityChoice} onChange={(event) => setAbilityChoice(event.target.value as AbilityKey)}>
                  <option value="">Choose an ability…</option>
                  {selectedFeat.abilityBonuses.map((ability) => <option key={ability} value={ability}>{abilityLabels[ability]}</option>)}
                </select>
              </label>
            ) : null}
            {requiredSpellCount > 0 ? (
              <div className="cs-feat-manager-spells">
                <div className="cs-feat-manager-spell-head"><span>Choose {requiredSpellCount} spell{requiredSpellCount === 1 ? "" : "s"}</span><small>{spellChoices.length}/{requiredSpellCount} selected</small></div>
                {featSpellOptions.length > 0 ? featSpellOptions.map((spell) => (
                  <button type="button" key={spell.id} className={`cs-feat-manager-spell${spellChoices.includes(spell.id) ? " is-selected" : ""}`} onClick={() => toggleSpell(spell.id)}><span>{spell.name}</span><small>{spell.school} · level {spell.level}</small>{spellChoices.includes(spell.id) ? <Check size={14} /> : <Plus size={14} />}</button>
                )) : <p className="cs-muted">Spell catalog is unavailable or all matching spells are already known.</p>}
              </div>
            ) : null}
            <div className="cs-feat-manager-actions">
              <button type="button" className="cs-glass-btn" onClick={onClose}>Done</button>
              <button type="button" className="cs-glass-btn cs-feat-add" disabled={addDisabled} onClick={addFeat}><Plus size={14} /> Add feat</button>
            </div>
            <p className="cs-rule-note">{props.usePrerequisites ? "Only feats that match this character's prerequisites are shown." : "Prerequisite filtering is disabled in character settings."}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
