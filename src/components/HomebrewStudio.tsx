"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookCopy, FlaskConical, Plus, Save, Search, Send, Trash2, X } from "lucide-react";
import { ITEM_CATALOG } from "@/lib/itemCatalog";
import {
  blankHomebrewItem,
  catalogItemBaseline,
  catalogItemToHomebrewPayload,
} from "@/lib/homebrew/itemIntegration";
import type { DefinitionDto, VersionDto, VersionSummaryDto } from "@/lib/homebrew/homebrewDtos";
import type {
  EffectGate,
  HomebrewItemPayload,
  ItemStage,
  ItemToggle,
  MechanicEffect,
  NumericBonusTarget,
  Prerequisite,
  RulesContentRef,
} from "@/types/homebrew";
import type { RulesetId } from "@/types/game";

type Detail = { definition: DefinitionDto; versions: VersionSummaryDto[] };
type ApiError = { error?: string; errors?: Array<{ path: string; message: string }> };

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & ApiError;
  if (!response.ok) {
    const detail = body.errors?.map((entry) => `${entry.path} ${entry.message}`).join("; ");
    throw new Error(detail || body.error || "The homebrew request failed.");
  }
  return body;
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function gateFromValue(value: string, toggleId?: string): EffectGate {
  if (value === "equipped-attuned-toggle" && toggleId) {
    return { type: "all", gates: [{ type: "equipped" }, { type: "attuned" }, { type: "toggle", toggleId }] };
  }
  if (value === "equipped-attuned") return { type: "all", gates: [{ type: "equipped" }, { type: "attuned" }] };
  if (value === "equipped") return { type: "equipped" };
  if (value === "attuned") return { type: "attuned" };
  if (value === "toggle" && toggleId) return { type: "toggle", toggleId };
  return { type: "always" };
}

function gateValue(gate: EffectGate) {
  if (gate.type === "all") {
    const types = new Set(gate.gates.map((entry) => entry.type));
    if (types.has("equipped") && types.has("attuned") && types.has("toggle")) return "equipped-attuned-toggle";
    if (types.has("equipped") && types.has("attuned")) return "equipped-attuned";
  }
  return ["always", "equipped", "attuned", "toggle"].includes(gate.type) ? gate.type : "always";
}

function gateToggleId(gate: EffectGate): string | undefined {
  if (gate.type === "toggle") return gate.toggleId;
  if (gate.type === "all") return gate.gates.find((entry): entry is Extract<EffectGate, { type: "toggle" }> => entry.type === "toggle")?.toggleId;
  return undefined;
}

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const;
const PREREQUISITE_OPS = [
  "ability", "character-level", "class", "class-level", "species", "feat",
  "spellcasting", "proficiency", "feature", "attunement", "all", "any", "not",
] as const;

function defaultContentRef(kind: "class" | "species" | "feat"): RulesContentRef {
  return { source: "builtin", kind, id: kind === "class" ? "fighter" : kind === "species" ? "human" : "alert", ruleset: "2014" };
}

function newPrerequisite(op: Prerequisite["op"]): Prerequisite {
  switch (op) {
    case "ability": return { op, ability: "strength", minimum: 13 };
    case "character-level": return { op, minimum: 1 };
    case "class": return { op, classRef: defaultContentRef("class") };
    case "class-level": return { op, classRef: defaultContentRef("class"), minimum: 1 };
    case "species": return { op, speciesRef: defaultContentRef("species") };
    case "feat": return { op, featRef: defaultContentRef("feat") };
    case "spellcasting": return { op, mode: "any" };
    case "proficiency": return { op, category: "armor", value: "medium armor" };
    case "feature": return { op, featureId: "feature-id" };
    case "attunement": return { op, required: true };
    case "all": return { op, rules: [newPrerequisite("ability")] };
    case "any": return { op, rules: [newPrerequisite("ability")] };
    case "not": return { op, rule: newPrerequisite("ability") };
  }
}

function builtinRefId(ref: RulesContentRef): string {
  return ref.source === "builtin" ? ref.id : "";
}

function PrerequisiteEditor({
  rule,
  onChange,
  onRemove,
}: {
  rule: Prerequisite;
  onChange: (rule: Prerequisite) => void;
  onRemove?: () => void;
}) {
  const updateRef = (id: string) => {
    if ((rule.op === "class" || rule.op === "class-level") && rule.classRef.source === "builtin") onChange({ ...rule, classRef: { ...rule.classRef, id } });
    if (rule.op === "species" && rule.speciesRef.source === "builtin") onChange({ ...rule, speciesRef: { ...rule.speciesRef, id } });
    if (rule.op === "feat" && rule.featRef.source === "builtin") onChange({ ...rule, featRef: { ...rule.featRef, id } });
  };
  const updateOp = (op: Prerequisite["op"]) => onChange(newPrerequisite(op));
  return (
    <div className="hb-prerequisite-card">
      <div className="hb-prerequisite-head">
        <select aria-label="Prerequisite type" value={rule.op} onChange={(event) => updateOp(event.target.value as Prerequisite["op"])}>
          {PREREQUISITE_OPS.map((op) => <option key={op} value={op}>{op.replaceAll("-", " ")}</option>)}
        </select>
        {onRemove ? <button type="button" className="hb-icon" onClick={onRemove} aria-label="Remove prerequisite"><Trash2 size={14} /></button> : null}
      </div>
      {rule.op === "ability" ? <div className="hb-prerequisite-fields"><label>Ability<select value={rule.ability} onChange={(event) => onChange({ ...rule, ability: event.target.value as typeof rule.ability })}>{ABILITIES.map((ability) => <option key={ability}>{ability}</option>)}</select></label><label>Minimum<input type="number" min={1} max={30} value={rule.minimum} onChange={(event) => onChange({ ...rule, minimum: Number(event.target.value) })} /></label></div> : null}
      {rule.op === "character-level" ? <label>Minimum character level<input type="number" min={1} max={20} value={rule.minimum} onChange={(event) => onChange({ ...rule, minimum: Number(event.target.value) })} /></label> : null}
      {rule.op === "proficiency" ? <div className="hb-prerequisite-fields"><label>Category<input value={rule.category} onChange={(event) => onChange({ ...rule, category: event.target.value })} /></label><label>Proficiency<input value={rule.value} onChange={(event) => onChange({ ...rule, value: event.target.value })} /></label></div> : null}
      {rule.op === "feature" ? <label>Feature id<input value={rule.featureId} onChange={(event) => onChange({ ...rule, featureId: event.target.value })} /></label> : null}
      {rule.op === "spellcasting" ? <label>Spellcasting<select value={rule.mode} onChange={(event) => onChange({ ...rule, mode: event.target.value as typeof rule.mode })}><option value="any">any</option><option value="full">full</option><option value="partial">partial</option><option value="pact">pact</option></select></label> : null}
      {rule.op === "attunement" ? <label><input type="checkbox" checked={rule.required} onChange={(event) => onChange({ ...rule, required: event.target.checked })} /> Character must be attuned</label> : null}
      {rule.op === "class" || rule.op === "species" || rule.op === "feat" || rule.op === "class-level" ? <div className="hb-prerequisite-fields"><label>{rule.op === "class" || rule.op === "class-level" ? "Class id" : `${rule.op} id`}<input value={rule.op === "species" ? builtinRefId(rule.speciesRef) : rule.op === "feat" ? builtinRefId(rule.featRef) : builtinRefId(rule.classRef)} onChange={(event) => updateRef(event.target.value)} /></label>{rule.op === "class-level" ? <label>Minimum class level<input type="number" min={1} max={20} value={rule.minimum} onChange={(event) => onChange({ ...rule, minimum: Number(event.target.value) })} /></label> : null}</div> : null}
      {rule.op === "all" || rule.op === "any" ? <div className="hb-prerequisite-children">{rule.rules.map((child, index) => <PrerequisiteEditor key={index} rule={child} onChange={(next) => onChange({ ...rule, rules: rule.rules.map((entry, i) => i === index ? next : entry) })} onRemove={() => onChange({ ...rule, rules: rule.rules.filter((_, i) => i !== index) })} />)}<button type="button" className="hb-add-line" onClick={() => onChange({ ...rule, rules: [...rule.rules, newPrerequisite("ability")] })}><Plus size={14} /> Add rule</button></div> : null}
      {rule.op === "not" ? <PrerequisiteEditor rule={rule.rule} onChange={(next) => onChange({ ...rule, rule: next })} /> : null}
    </div>
  );
}

function newEffect(type: MechanicEffect["type"], toggles: ItemToggle[]): MechanicEffect {
  const gate: EffectGate = { type: "equipped" };
  switch (type) {
    case "numeric-bonus":
      return { id: uid("bonus"), type, target: "ac", value: 1, gate };
    case "ability-floor":
      return { id: uid("floor"), type, ability: "strength", minimum: 19, gate };
    case "condition":
      return {
        id: uid("condition"),
        type,
        conditionId: "invisible",
        label: "Invisible",
        gate: toggles[0]
          ? { type: "all", gates: [{ type: "equipped" }, { type: "attuned" }, { type: "toggle", toggleId: toggles[0].id }] }
          : gate,
      };
    case "d20-rider":
      return { id: uid("rider"), type, dice: "1d4", appliesTo: ["attack", "save", "check"], gate };
    case "spell-slot-bonus":
      return { id: uid("slot"), type, spellLevel: 3, amount: 1, gate };
    case "resource-grant":
      return { id: uid("resource"), type, resourceId: "item-resource", maximum: 1, recharge: "long-rest", gate };
    case "sense":
      return { id: uid("sense"), type, text: "Darkvision 60 ft.", gate };
    case "aura":
      return { id: uid("aura"), type, radiusFeet: 10, recipient: "allies", effects: [{ id: uid("aura-rider"), type: "d20-rider", dice: "1d4", appliesTo: ["attack", "save"], gate: { type: "always" } }], gate };
    case "spell-grant":
      return { id: uid("spell"), type, spellRef: { source: "builtin", kind: "spell", id: "bless", ruleset: "2014" }, freeUses: 1, recharge: "long-rest", gate };
  }
}

const NUMERIC_TARGETS: NumericBonusTarget[] = [
  "ac", "saving-throws", "ability-checks", "initiative", "spell-attack",
  "spell-save-dc", "weapon-attack", "weapon-damage",
];

function EffectEditor({
  effect,
  toggles,
  onChange,
  onRemove,
}: {
  effect: MechanicEffect;
  toggles: ItemToggle[];
  onChange: (effect: MechanicEffect) => void;
  onRemove: () => void;
}) {
  const gate = gateValue(effect.gate);
  const updateGate = (value: string) => onChange({
    ...effect,
    gate: gateFromValue(value, value.includes("toggle") ? toggles[0]?.id : undefined),
  } as MechanicEffect);

  return (
    <article className="hb-effect-card">
      <div className="hb-effect-head">
        <strong>{effect.type.replaceAll("-", " ")}</strong>
        <button type="button" className="hb-icon" onClick={onRemove} aria-label="Remove effect"><Trash2 size={14} /></button>
      </div>
      <div className="hb-effect-grid">
        {effect.type === "numeric-bonus" ? <>
          <label>Target<select value={effect.target} onChange={(event) => onChange({ ...effect, target: event.target.value as NumericBonusTarget })}>{NUMERIC_TARGETS.map((target) => <option key={target}>{target}</option>)}</select></label>
          <label>Bonus<input type="number" value={effect.value} onChange={(event) => onChange({ ...effect, value: Number(event.target.value) })} /></label>
          <label>Scope<select value={effect.scope ?? "character"} onChange={(event) => onChange({ ...effect, scope: event.target.value as "character" | "source-item" })}><option value="character">whole character</option><option value="source-item">this item only</option></select></label>
        </> : null}
        {effect.type === "ability-floor" ? <>
          <label>Ability<select value={effect.ability} onChange={(event) => onChange({ ...effect, ability: event.target.value as typeof effect.ability })}>{["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].map((ability) => <option key={ability}>{ability}</option>)}</select></label>
          <label>Minimum<input type="number" value={effect.minimum} onChange={(event) => onChange({ ...effect, minimum: Number(event.target.value) })} /></label>
        </> : null}
        {effect.type === "condition" ? <>
          <label>Condition id<input value={effect.conditionId} onChange={(event) => onChange({ ...effect, conditionId: event.target.value })} /></label>
          <label>Sheet label<input value={effect.label} onChange={(event) => onChange({ ...effect, label: event.target.value })} /></label>
        </> : null}
        {effect.type === "d20-rider" ? <label>Dice<input value={effect.dice} onChange={(event) => onChange({ ...effect, dice: event.target.value })} /></label> : null}
        {effect.type === "spell-slot-bonus" ? <>
          <label>Spell level<input type="number" min={1} max={9} value={effect.spellLevel} onChange={(event) => onChange({ ...effect, spellLevel: Number(event.target.value) })} /></label>
          <label>Extra slots<input type="number" min={1} value={effect.amount} onChange={(event) => onChange({ ...effect, amount: Number(event.target.value) })} /></label>
        </> : null}
        {effect.type === "sense" ? <label className="hb-wide">Sense<input value={effect.text} onChange={(event) => onChange({ ...effect, text: event.target.value })} /></label> : null}
        {effect.type === "resource-grant" ? <>
          <label>Resource id<input value={effect.resourceId} onChange={(event) => onChange({ ...effect, resourceId: event.target.value })} /></label>
          <label>Maximum<input type="number" value={effect.maximum} onChange={(event) => onChange({ ...effect, maximum: Number(event.target.value) })} /></label>
        </> : null}
        {effect.type === "aura" ? <>
          <label>Radius (ft.)<input type="number" value={effect.radiusFeet} onChange={(event) => onChange({ ...effect, radiusFeet: Number(event.target.value) })} /></label>
          <label>Recipients<select value={effect.recipient} onChange={(event) => onChange({ ...effect, recipient: event.target.value as typeof effect.recipient })}><option value="self">self</option><option value="allies">allies</option><option value="all-creatures">all creatures</option></select></label>
        </> : null}
        {effect.type === "spell-grant" ? <label className="hb-wide">Built-in spell id<input value={effect.spellRef.source === "builtin" ? effect.spellRef.id : ""} onChange={(event) => onChange({ ...effect, spellRef: { source: "builtin", kind: "spell", id: event.target.value, ruleset: effect.spellRef.ruleset } })} /></label> : null}
        <label>Active when
          <select value={gate} onChange={(event) => updateGate(event.target.value)}>
            <option value="always">always</option><option value="equipped">equipped</option><option value="attuned">attuned</option>
            <option value="equipped-attuned">equipped + attuned</option>
            {toggles.length ? <><option value="toggle">toggle is on</option><option value="equipped-attuned-toggle">equipped + attuned + toggle</option></> : null}
          </select>
        </label>
        {gate.includes("toggle") ? <label>Toggle<select value={gateToggleId(effect.gate) ?? toggles[0]?.id} onChange={(event) => onChange({ ...effect, gate: gateFromValue(gate, event.target.value) } as MechanicEffect)}>{toggles.map((toggle) => <option key={toggle.id} value={toggle.id}>{toggle.label}</option>)}</select></label> : null}
      </div>
    </article>
  );
}

const STAGE_EFFECT_TYPES: MechanicEffect["type"][] = [
  "numeric-bonus", "ability-floor", "condition", "d20-rider",
  "spell-slot-bonus", "resource-grant", "sense", "aura", "spell-grant",
];

function StageEditor({
  stage,
  index,
  count,
  toggles,
  onChange,
  onRemove,
  onMove,
}: {
  stage: ItemStage;
  index: number;
  count: number;
  toggles: ItemToggle[];
  onChange: (stage: ItemStage) => void;
  onRemove: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const activation = stage.activation;
  const changeActivation = (type: "manual" | "counter" | "milestone") => {
    if (type === "counter") onChange({ ...stage, activation: { type, counterId: activation.type === "counter" ? activation.counterId : "progress", minimum: activation.type === "counter" ? activation.minimum : 1 } });
    else if (type === "milestone") onChange({ ...stage, activation: { type, label: activation.type === "milestone" ? activation.label : "" } });
    else onChange({ ...stage, activation: { type: "manual" } });
  };
  return (
    <article className="hb-stage-card">
      <div className="hb-stage-head">
        <span className="hb-stage-order" aria-hidden="true">{index + 1}</span>
        <input value={stage.name} aria-label={`Stage ${index + 1} name`} onChange={(event) => onChange({ ...stage, name: event.target.value })} />
        <div className="hb-stage-tools">
          <button type="button" className="hb-icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move stage earlier"><ArrowUp size={14} /></button>
          <button type="button" className="hb-icon" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move stage later"><ArrowDown size={14} /></button>
          <button type="button" className="hb-icon" onClick={onRemove} aria-label="Remove stage"><Trash2 size={14} /></button>
        </div>
      </div>
      <label className="hb-wide">Description<textarea rows={2} value={stage.description} onChange={(event) => onChange({ ...stage, description: event.target.value })} /></label>
      <div className="hb-stage-activation">
        <label>Reached by
          <select value={activation.type} onChange={(event) => changeActivation(event.target.value as "manual" | "counter" | "milestone")}>
            <option value="manual">manual choice</option>
            <option value="counter">counter threshold</option>
            <option value="milestone">story milestone</option>
          </select>
        </label>
        {activation.type === "counter" ? <>
          <label>Counter id<input value={activation.counterId} maxLength={64} placeholder="souls-claimed" onChange={(event) => onChange({ ...stage, activation: { ...activation, counterId: event.target.value } })} /></label>
          <label>Threshold<input type="number" min={1} max={9999} value={activation.minimum} onChange={(event) => onChange({ ...stage, activation: { ...activation, minimum: Number(event.target.value) } })} /></label>
        </> : null}
        {activation.type === "milestone" ? <label className="hb-wide">Milestone<input value={activation.label} placeholder="Defeat the usurper of Hollowmere" onChange={(event) => onChange({ ...stage, activation: { ...activation, label: event.target.value } })} /></label> : null}
      </div>
      <div className="hb-stage-effects">
        <div className="hb-subsection-title"><strong>Stage effects</strong><span>Active only while this stage is current, on top of the item&apos;s base effects.</span></div>
        <div className="hb-presets">
          {STAGE_EFFECT_TYPES.map((type) => <button type="button" key={type} onClick={() => onChange({ ...stage, effects: [...stage.effects, newEffect(type, toggles)] })}>+ {type.replaceAll("-", " ")}</button>)}
        </div>
        {stage.effects.map((effect, effectIndex) => <EffectEditor key={effect.id} effect={effect} toggles={toggles} onChange={(next) => onChange({ ...stage, effects: stage.effects.map((entry, i) => i === effectIndex ? next : entry) })} onRemove={() => onChange({ ...stage, effects: stage.effects.filter((_, i) => i !== effectIndex) })} />)}
        {!stage.effects.length ? <p className="hb-empty">No stage effects yet — this stage only changes the story text.</p> : null}
      </div>
    </article>
  );
}

export default function HomebrewStudio({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(false);
  const [definitions, setDefinitions] = useState<DefinitionDto[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [version, setVersion] = useState<VersionDto | null>(null);
  const [payload, setPayload] = useState<HomebrewItemPayload>(() => blankHomebrewItem());
  const [ruleset, setRuleset] = useState<RulesetId>("2014");
  const [baseline, setBaseline] = useState<ReturnType<typeof catalogItemBaseline>>();
  const [catalogQuery, setCatalogQuery] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);
  const [changeSummary, setChangeSummary] = useState("Updated item mechanics.");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onCloseRef.current = onClose;
    dirtyRef.current = dirty;
  }, [dirty, onClose]);

  function closeStudio() {
    if (!dirtyRef.current || window.confirm("Discard unsaved Item Studio changes?")) onCloseRef.current();
  }

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeStudio();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  const filteredCatalog = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return ITEM_CATALOG.filter((item) => !query || `${item.name} ${item.category} ${item.classification ?? ""}`.toLowerCase().includes(query)).slice(0, 40);
  }, [catalogQuery]);

  async function refreshDefinitions() {
    const data = await readJson<{ definitions: DefinitionDto[] }>(await fetch("/api/homebrew?kind=item"));
    setDefinitions(data.definitions);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/homebrew?kind=item")
      .then((response) => readJson<{ definitions: DefinitionDto[] }>(response))
      .then((data) => { if (!cancelled) setDefinitions(data.definitions); })
      .catch((error: Error) => { if (!cancelled) setStatus(error.message); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const block = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", block);
    return () => window.removeEventListener("beforeunload", block);
  }, [dirty]);

  function edit(next: HomebrewItemPayload) {
    setPayload(next);
    setDirty(true);
  }

  async function openDefinition(definition: DefinitionDto, requestedVersionId = definition.currentVersionId) {
    if (dirty && !window.confirm("Discard unsaved Item Studio changes?")) return;
    setBusy(true);
    setStatus("");
    try {
      const nextDetail = await readJson<Detail>(await fetch(`/api/homebrew/${definition.id}`));
      const versionId = requestedVersionId ?? nextDetail.versions.at(-1)?.id;
      if (!versionId) throw new Error("This item has no versions.");
      const loaded = await readJson<{ version: VersionDto }>(await fetch(`/api/homebrew/${definition.id}/versions/${versionId}`));
      if (loaded.version.payload.kind !== "item") throw new Error("The selected content is not an item.");
      setDetail(nextDetail);
      setVersion(loaded.version);
      setPayload(loaded.version.payload);
      setRuleset(definition.ruleset);
      setBaseline(loaded.version.baseline);
      setDirty(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not open item.");
    } finally {
      setBusy(false);
    }
  }

  function startBlank() {
    if (dirty && !window.confirm("Discard unsaved Item Studio changes?")) return;
    setDetail(null); setVersion(null); setPayload(blankHomebrewItem()); setBaseline(undefined); setDirty(true); setShowCatalog(false);
  }

  function cloneCatalog(id: string) {
    const item = ITEM_CATALOG.find((entry) => entry.id === id);
    if (!item) return;
    setDetail(null); setVersion(null); setPayload(catalogItemToHomebrewPayload(item));
    setBaseline(catalogItemBaseline(item, ruleset)); setDirty(true); setShowCatalog(false);
  }

  async function save() {
    setBusy(true); setStatus("");
    try {
      if (!detail) {
        const created = await readJson<{ definition: DefinitionDto; version: VersionDto }>(await fetch("/api/homebrew", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "item", ruleset, title: payload.name, payload, baseline, changeSummary: "Initial Item Studio draft." }),
        }));
        setDetail({ definition: created.definition, versions: [created.version] });
        setVersion(created.version);
        setDirty(false);
        setStatus("Draft v1 saved.");
        await refreshDefinitions();
      } else {
        const saved = await readJson<{ version: VersionDto }>(await fetch(`/api/homebrew/${detail.definition.id}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "If-Match": String(detail.definition.revision) },
          body: JSON.stringify({ payload, changeSummary, parentVersionId: version?.id }),
        }));
        await refreshDefinitions();
        const updatedDefinition = (await readJson<Detail>(await fetch(`/api/homebrew/${detail.definition.id}`)));
        setDetail(updatedDefinition);
        setVersion(saved.version);
        setDirty(false);
        setStatus(`Draft v${saved.version.ordinal} saved.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save item.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!detail || !version || dirty) {
      setStatus("Save this draft before publishing.");
      return;
    }
    setBusy(true); setStatus("");
    try {
      const result = await readJson<{ version: VersionDto }>(await fetch(`/api/homebrew/${detail.definition.id}/versions/${version.id}/publish`, { method: "POST" }));
      setVersion(result.version);
      const updated = await readJson<Detail>(await fetch(`/api/homebrew/${detail.definition.id}`));
      setDetail(updated);
      await refreshDefinitions();
      setStatus(`v${result.version.ordinal} is published and available to characters.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not publish item.");
    } finally {
      setBusy(false);
    }
  }

  /** Stage list edits keep the array sorted and re-derive `order` as 1..n so
      the payload can never hold duplicate or gapped stage orders. */
  const updateStages = (stages: ItemStage[]) => edit({
    ...payload,
    stages: stages.map((stage, index) => ({ ...stage, order: index + 1 })),
  });

  const addStage = () => updateStages([
    ...payload.stages,
    { id: uid("stage"), name: `Stage ${payload.stages.length + 1}`, order: payload.stages.length + 1, description: "", activation: { type: "manual" }, effects: [] },
  ]);

  const moveStage = (index: number, delta: -1 | 1) => {
    const next = [...payload.stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateStages(next);
  };

  const addWeaponBonus = (value: number) => edit({
    ...payload,
    effects: [...payload.effects,
      { id: uid("weapon-attack"), type: "numeric-bonus", target: "weapon-attack", value, scope: "source-item", gate: { type: "equipped" } },
      { id: uid("weapon-damage"), type: "numeric-bonus", target: "weapon-damage", value, scope: "source-item", gate: { type: "equipped" } },
    ],
  });

  return (
    <div ref={dialogRef} className="hb-studio" role="dialog" aria-modal="true" aria-labelledby="hb-title" tabIndex={-1}>
      <header className="hb-topbar">
        <div><span className="hb-kicker">Creator workspace</span><h1 id="hb-title"><FlaskConical size={24} /> Item Studio</h1></div>
        <div className="hb-actions">
          <button type="button" className="ao-btn ao-btn-ghost" onClick={save} disabled={busy || !payload.name.trim()}><Save size={15} /> Save version</button>
          <button type="button" className="ao-btn ao-btn-brass" onClick={publish} disabled={busy || !version || version.status !== "draft" || dirty}><Send size={15} /> Publish</button>
          <button type="button" className="hb-close" onClick={closeStudio} aria-label="Close Item Studio"><X /></button>
        </div>
      </header>

      <div className="hb-layout">
        <aside className="hb-library">
          <div className="hb-library-head"><h2>Your items</h2><button type="button" className="hb-icon" onClick={startBlank} title="New blank item"><Plus /></button></div>
          <button type="button" className="hb-clone" onClick={() => setShowCatalog((open) => !open)}><BookCopy size={16} /> Clone a built-in item</button>
          {showCatalog ? <div className="hb-catalog">
            <label className="hb-search"><Search size={14} /><input autoFocus value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Longsword, armor…" /></label>
            <div className="hb-catalog-results">{filteredCatalog.map((item) => <button type="button" key={item.id} onClick={() => cloneCatalog(item.id)}><strong>{item.name}</strong><span>{item.category} · {item.rarity}</span></button>)}</div>
          </div> : null}
          <div className="hb-definition-list">
            {definitions.map((definition) => <button type="button" className={detail?.definition.id === definition.id ? "active" : ""} key={definition.id} onClick={() => void openDefinition(definition)}>
              <span>{definition.title}</span><small>{definition.latestPublishedVersionId ? "Published" : "Draft"} · {definition.ruleset}</small>
            </button>)}
            {!definitions.length ? <p>No items yet. Begin blank or clone a catalog item.</p> : null}
          </div>
        </aside>

        <main className="hb-editor">
          <section className="hb-identity">
            <label className="hb-title-field">Item name<input value={payload.name} maxLength={120} onChange={(event) => edit({ ...payload, name: event.target.value })} /></label>
            <div className="hb-version-strip">
              <span>{version ? `Version ${version.ordinal}` : "Unsaved draft"}</span>
              {version ? <span className={`hb-status hb-${version.status}`}>{version.status}</span> : null}
              {baseline ? <span>Based on {baseline.sourceTitle}</span> : <span>Created from scratch</span>}
            </div>
          </section>

          {status ? <div className="hb-notice" role="status">{status}</div> : null}

          <section className="hb-panel">
            <div className="hb-section-title"><div><span>01</span><h2>Identity & equipment</h2></div><p>The inventory-facing facts for every pinned copy.</p></div>
            <div className="hb-form-grid">
              <label>Ruleset<select value={ruleset} disabled={Boolean(detail)} onChange={(event) => setRuleset(event.target.value as RulesetId)}><option value="2014">2014</option><option value="2024">2024</option></select></label>
              <label>Category<input value={payload.category} onChange={(event) => edit({ ...payload, category: event.target.value })} /></label>
              <label>Classification<input value={payload.classification ?? ""} onChange={(event) => edit({ ...payload, classification: event.target.value || undefined })} /></label>
              <label>Rarity<select value={payload.rarity} onChange={(event) => edit({ ...payload, rarity: event.target.value })}>{["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"].map((rarity) => <option key={rarity}>{rarity}</option>)}</select></label>
              <label>Base weight (lb.)<input type="number" min={0} value={payload.baseWeight ?? ""} onChange={(event) => edit({ ...payload, baseWeight: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
              <label>Cost<input value={payload.cost ?? ""} onChange={(event) => edit({ ...payload, cost: event.target.value || undefined })} /></label>
              <label>Damage<input value={payload.damage ?? ""} placeholder="1d8" onChange={(event) => edit({ ...payload, damage: event.target.value || undefined })} /></label>
              <label>Damage type<input value={payload.damageType ?? ""} onChange={(event) => edit({ ...payload, damageType: event.target.value || undefined })} /></label>
              <label>Armor Class<input value={payload.ac ?? ""} placeholder="11 + Dex modifier" onChange={(event) => edit({ ...payload, ac: event.target.value || undefined })} /></label>
              <label>Slots<input value={payload.equipmentSlots.join(", ")} placeholder="hand, body, ring" onChange={(event) => edit({ ...payload, equipmentSlots: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) })} /></label>
              <label className="hb-wide">Properties<input value={payload.properties ?? ""} onChange={(event) => edit({ ...payload, properties: event.target.value || undefined })} /></label>
              <label className="hb-check"><input type="checkbox" checked={payload.requiresAttunement} onChange={(event) => edit({ ...payload, requiresAttunement: event.target.checked })} /> Requires attunement</label>
              {payload.requiresAttunement ? <>
                <label className="hb-wide">Attunement prerequisites (display)<input value={payload.attunementPrerequisites?.displayText ?? ""} placeholder="Optional player-facing wording" onChange={(event) => edit({ ...payload, attunementPrerequisites: event.target.value ? { ...payload.attunementPrerequisites, displayText: event.target.value } : payload.attunementPrerequisites })} /></label>
                <div className="hb-wide hb-prerequisite-editor"><div className="hb-subsection-title"><strong>Structured prerequisite rules</strong><span>These rules are validated and evaluated; display text alone never gates attunement.</span></div>{payload.attunementPrerequisites?.rules ? <PrerequisiteEditor rule={payload.attunementPrerequisites.rules} onChange={(rules) => edit({ ...payload, attunementPrerequisites: { ...payload.attunementPrerequisites, rules } })} onRemove={() => edit({ ...payload, attunementPrerequisites: payload.attunementPrerequisites?.displayText ? { displayText: payload.attunementPrerequisites.displayText } : undefined })} /> : <button type="button" className="hb-add-line" onClick={() => edit({ ...payload, attunementPrerequisites: { ...payload.attunementPrerequisites, rules: newPrerequisite("all") } })}><Plus size={14} /> Add structured rule</button>}</div>
              </> : null}
              <label className="hb-wide">Description<textarea rows={5} value={payload.description} onChange={(event) => edit({ ...payload, description: event.target.value })} /></label>
              <label className="hb-wide">Creator notes <small>Never shown in the character library</small><textarea rows={3} value={payload.creatorNotes ?? ""} onChange={(event) => edit({ ...payload, creatorNotes: event.target.value || undefined })} /></label>
            </div>
          </section>

          <section className="hb-panel">
            <div className="hb-section-title"><div><span>02</span><h2>Toggles</h2></div><p>Player-controlled states such as invisibility.</p></div>
            <div className="hb-toggle-list">
              {payload.toggles.map((toggle, index) => <div key={toggle.id}>
                <input value={toggle.label} onChange={(event) => edit({ ...payload, toggles: payload.toggles.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry) })} />
                <label><input type="checkbox" checked={toggle.defaultOn} onChange={(event) => edit({ ...payload, toggles: payload.toggles.map((entry, i) => i === index ? { ...entry, defaultOn: event.target.checked } : entry) })} /> Default on</label>
                <button type="button" className="hb-icon" onClick={() => edit({ ...payload, toggles: payload.toggles.filter((_, i) => i !== index) })}><Trash2 size={14} /></button>
              </div>)}
              <button type="button" className="hb-add-line" onClick={() => edit({ ...payload, toggles: [...payload.toggles, { id: uid("toggle"), label: "Active", defaultOn: false }] })}><Plus size={14} /> Add toggle</button>
            </div>
          </section>

          <section className="hb-panel">
            <div className="hb-section-title"><div><span>03</span><h2>Mechanical effects</h2></div><p>Structured rules consumed by the character sheet.</p></div>
            <div className="hb-presets">
              {[1, 2, 3].map((value) => <button type="button" key={value} onClick={() => addWeaponBonus(value)}>+{value} weapon</button>)}
              {(["numeric-bonus", "ability-floor", "condition", "d20-rider", "spell-slot-bonus", "resource-grant", "sense", "aura", "spell-grant"] as MechanicEffect["type"][]).map((type) => <button type="button" key={type} onClick={() => edit({ ...payload, effects: [...payload.effects, newEffect(type, payload.toggles)] })}>+ {type.replaceAll("-", " ")}</button>)}
            </div>
            <div className="hb-effects">{payload.effects.map((effect, index) => <EffectEditor key={effect.id} effect={effect} toggles={payload.toggles} onChange={(next) => edit({ ...payload, effects: payload.effects.map((entry, i) => i === index ? next : entry) })} onRemove={() => edit({ ...payload, effects: payload.effects.filter((_, i) => i !== index) })} />)}</div>
            {!payload.effects.length ? <p className="hb-empty">No structured effects yet. Descriptive text never grants a hidden bonus.</p> : null}
          </section>

          <section className="hb-panel">
            <div className="hb-section-title"><div><span>04</span><h2>Stages</h2></div><p>Growing and sentient items: ordered forms the item moves through. A fresh copy starts in stage 1; advancement is always an explicit player or DM action.</p></div>
            <div className="hb-stage-list">
              {payload.stages
                .map((stage, index) => ({ stage, index }))
                .sort((a, b) => a.stage.order - b.stage.order)
                .map(({ stage, index }, position, all) => (
                  <StageEditor
                    key={stage.id}
                    stage={stage}
                    index={position}
                    count={all.length}
                    toggles={payload.toggles}
                    onChange={(next) => updateStages(payload.stages.map((entry, i) => i === index ? next : entry))}
                    onRemove={() => updateStages(payload.stages.filter((_, i) => i !== index))}
                    onMove={(delta) => moveStage(index, delta)}
                  />
                ))}
              <button type="button" className="hb-add-line" onClick={addStage} disabled={payload.stages.length >= 20}><Plus size={14} /> Add stage</button>
              {!payload.stages.length ? <p className="hb-empty">No stages — this item keeps one fixed form.</p> : null}
            </div>
          </section>

          <section className="hb-save-panel">
            <label>Version change summary<input value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} /></label>
            {detail ? <div className="hb-history"><strong>History</strong>{detail.versions.map((entry) => <button type="button" key={entry.id} onClick={() => void openDefinition(detail.definition, entry.id)}>v{entry.ordinal} · {entry.status}{entry.changeSummary ? ` — ${entry.changeSummary}` : ""}</button>)}</div> : null}
          </section>
        </main>
      </div>
    </div>
  );
}
