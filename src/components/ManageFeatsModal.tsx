"use client";

import { Check, Minus, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AbilityKey, AbilityScores, ASIChoice, CasterType, Character, SpellStatus } from "@/types/game";
import { abilityLabels } from "@/lib/utils";
import { ALL_SPELLS } from "@/lib/spells";
import { availableFeats, getFeat } from "@/lib/feats";
import { ELDRITCH_INVOCATIONS, INVOCATION_SPELLS, spellsGrantedByInvocations } from "@/lib/featChoices";
import { BACKGROUND_SKILLS, SKILLS } from "@/lib/srd";

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
  const [cantripChoices, setCantripChoices] = useState<string[]>([]);
  const [skillProficiency, setSkillProficiency] = useState("");
  const [skillExpertise, setSkillExpertise] = useState("");
  const [invocationChoices, setInvocationChoices] = useState<string[]>([]);
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
      .filter((spell) => !choose.classes?.length || spell.classes?.some((entry) => choose.classes?.includes(entry)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [props.character.spellsKnown, selectedFeat]);
  const featCantripOptions = useMemo(() => {
    const choose = selectedFeat?.grantsSpells?.chooseCantrips;
    if (!choose) return [];
    return ALL_SPELLS
      .filter((spell) => spell.level === 0 && !(props.character.spellsKnown ?? []).includes(spell.id))
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
  const requiredCantripCount = selectedFeat?.grantsSpells?.chooseCantrips?.count ?? 0;
  const skillOptions = selectedFeat?.skillChoices ? SKILLS : [];
  const existingSkillIds = new Set([...(props.character.skillProficiencies ?? []), ...(BACKGROUND_SKILLS[props.character.background] ?? [])]);
  const expertiseOptions = skillOptions.filter((skill) => existingSkillIds.has(skill.id) || skill.id === skillProficiency);
  const invocationOptions = selectedFeat?.invocationChoices
    ? (selectedFeat.invocationChoices.options ?? [...ELDRITCH_INVOCATIONS])
    : [];
  const addDisabled = !selectedFeat
    || (requiresAbilityChoice && !abilityChoice)
    || spellChoices.length < requiredSpellCount
    || cantripChoices.length < requiredCantripCount
    || (selectedFeat.skillChoices?.proficiency && !skillProficiency)
    || (selectedFeat.skillChoices?.expertise && !skillExpertise)
    || (selectedFeat.invocationChoices && invocationChoices.length < selectedFeat.invocationChoices.count);

  const addFeat = () => {
    if (!selectedFeat || addDisabled) return;
    const nextChoices: ASIChoice[] = [
      ...existingChoices,
      {
        type: "feat",
        level: props.character.level,
        featId: selectedFeat.id,
        ...(abilityChoice ? { abilityChoice } : {}),
        ...(skillProficiency ? { skillProficiency } : {}),
        ...(skillExpertise ? { skillExpertise } : {}),
        ...(invocationChoices.length > 0 ? { invocationChoices } : {}),
        ...(spellChoices.length > 0 ? { spellChoices } : {}),
        ...(cantripChoices.length > 0 ? { cantripChoices } : {}),
      },
    ];
    const grantSpells = [...(selectedFeat.grantsSpells?.fixed ?? []), ...spellChoices, ...cantripChoices, ...spellsGrantedByInvocations(invocationChoices)];
    const patch: CharacterPatch = { asiChoices: nextChoices };
    if (skillProficiency) patch.skillProficiencies = Array.from(new Set([...(props.character.skillProficiencies ?? []), skillProficiency]));
    if (skillExpertise) patch.skillExpertise = Array.from(new Set([...(props.character.skillExpertise ?? []), skillExpertise]));
    if (invocationChoices.length > 0) patch.featureChoices = { ...(props.character.featureChoices ?? {}), "eldritch-invocations": Array.from(new Set([...(Array.isArray(props.character.featureChoices?.["eldritch-invocations"]) ? props.character.featureChoices["eldritch-invocations"].map(String) : []), ...invocationChoices])) };
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
    setAbilityChoice("");
    setSpellChoices([]);
    setCantripChoices([]);
    setSkillProficiency("");
    setSkillExpertise("");
    setInvocationChoices([]);
  };

  const removeFeat = (index: number) => {
    const removed = existingFeatChoices[index];
    if (!removed) return;
    const nextChoices = existingChoices.filter((choice) => choice !== removed);
    const removedFeat = getFeat(removed.featId);
    const remainingFeatChoices = nextChoices.filter((choice): choice is Extract<ASIChoice, { type: "feat" }> => choice.type === "feat");
    const remainingFeatNames = new Set(remainingFeatChoices.map((choice) => getFeat(choice.featId)?.name));
    const spellStatuses = { ...(props.character.spellStatuses ?? {}) };
    const removableSpellIds = removedFeat
      ? Object.entries(spellStatuses)
        .filter(([, status]) => status.source === `${removedFeat.name} feat` && !remainingFeatNames.has(removedFeat.name))
        .map(([spellId]) => spellId)
      : [];
    const patch: CharacterPatch = { asiChoices: nextChoices };
    if (removed.skillProficiency && !remainingFeatChoices.some((choice) => choice.skillProficiency === removed.skillProficiency)) {
      patch.skillProficiencies = (props.character.skillProficiencies ?? []).filter((id) => id !== removed.skillProficiency);
    }
    if (removed.skillExpertise && !remainingFeatChoices.some((choice) => choice.skillExpertise === removed.skillExpertise)) {
      patch.skillExpertise = (props.character.skillExpertise ?? []).filter((id) => id !== removed.skillExpertise);
    }
    if (removed.invocationChoices?.length) {
      const stillChosen = new Set(remainingFeatChoices.flatMap((choice) => choice.invocationChoices ?? []));
      const currentInvocations = Array.isArray(props.character.featureChoices?.["eldritch-invocations"])
        ? props.character.featureChoices["eldritch-invocations"].map(String)
        : [];
      patch.featureChoices = {
        ...(props.character.featureChoices ?? {}),
        "eldritch-invocations": currentInvocations.filter((id) => !removed.invocationChoices?.includes(id) || stillChosen.has(id)),
      };
    }
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
              <select value={selectedFeatId} onChange={(event) => { setSelectedFeatId(event.target.value); setAbilityChoice(""); setSpellChoices([]); setCantripChoices([]); setSkillProficiency(""); setSkillExpertise(""); setInvocationChoices([]); }}>
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
            {requiredCantripCount > 0 ? (
              <div className="cs-feat-manager-spells">
                <div className="cs-feat-manager-spell-head"><span>Choose {requiredCantripCount} cantrip{requiredCantripCount === 1 ? "" : "s"}</span><small>{cantripChoices.length}/{requiredCantripCount} selected</small></div>
                {featCantripOptions.map((spell) => <button type="button" key={spell.id} className={`cs-feat-manager-spell${cantripChoices.includes(spell.id) ? " is-selected" : ""}`} onClick={() => setCantripChoices((current) => current.includes(spell.id) ? current.filter((id) => id !== spell.id) : current.length >= requiredCantripCount ? current : [...current, spell.id])}><span>{spell.name}</span><small>{spell.school} · cantrip</small>{cantripChoices.includes(spell.id) ? <Check size={14} /> : <Plus size={14} />}</button>)}
              </div>
            ) : null}
            {selectedFeat?.skillChoices ? (
              <div className="cs-feat-manager-spells">
                {selectedFeat.skillChoices.proficiency ? <label className="cs-feat-manager-field"><span>Gain proficiency in</span><select value={skillProficiency} onChange={(event) => { setSkillProficiency(event.target.value); if (event.target.value === skillExpertise) setSkillExpertise(""); }}><option value="">Choose a skill…</option>{skillOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label> : null}
                {selectedFeat.skillChoices.expertise ? <label className="cs-feat-manager-field"><span>Gain expertise in</span><select value={skillExpertise} onChange={(event) => setSkillExpertise(event.target.value)}><option value="">Choose a proficient skill…</option>{expertiseOptions.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label> : null}
              </div>
            ) : null}
            {selectedFeat?.invocationChoices ? <div className="cs-feat-manager-spells"><div className="cs-feat-manager-spell-head"><span>Choose {selectedFeat.invocationChoices.count} Eldritch Invocation</span><small>{invocationChoices.length}/{selectedFeat.invocationChoices.count} selected</small></div>{invocationOptions.map((id) => <button type="button" key={id} className={`cs-feat-manager-spell${invocationChoices.includes(id) ? " is-selected" : ""}`} onClick={() => setInvocationChoices((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= (selectedFeat.invocationChoices?.count ?? 0) ? current : [...current, id])}><span>{id.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ")}</span>{INVOCATION_SPELLS[id] ? <small>Cast {INVOCATION_SPELLS[id].split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ")}</small> : null}{invocationChoices.includes(id) ? <Check size={14} /> : <Plus size={14} />}</button>)}</div> : null}
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
