"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Copy, Eye, Music2, Pause, Play, Plus, Send, Trash2, Volume2, X } from "lucide-react";
import { addCampaignTrack, deleteCampaignTrack, listCampaignTracks, updateCampaignAudio } from "@/lib/client/campaignApi";
import { EFFECT_PRESETS } from "@/lib/effects";
import { FONT_STACKS } from "@/lib/skins";
import { abilityKeys, abilityNames } from "@/lib/utils";
import { SKILLS } from "@/lib/srd";
import type { Character, CharacterTheme } from "@/types/game";
import type { CampaignCombatant, CampaignEvent, CampaignSyncPayload, CampaignTrack, InitiativeState } from "@/types/campaign";

/** Condition presets that a DM can apply. Matches the player-facing CampaignPanel dropdown. */
const CONDITION_PRESETS = EFFECT_PRESETS.filter((preset) => preset.source === "Condition");

type Props = {
  campaign: CampaignSyncPayload;
  events: CampaignEvent[];
  theme?: CharacterTheme | null;
  onClose: () => void;
  onOpenSheet: (character: Character) => void;
  onPostEvent: (type: CampaignEvent["type"], payload: Record<string, unknown>, targetUserId?: string | null) => Promise<boolean>;
  onInitiativeUpdate: (data: InitiativeState, version: number) => Promise<void> | void;
};

function parsePayload(event: CampaignEvent) {
  try {
    const value = JSON.parse(event.payload);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch { return {}; }
}

function eventLine(event: CampaignEvent) {
  const payload = parsePayload(event);
  if (event.type === "announce") return typeof payload.message === "string" ? payload.message : "The DM made an announcement.";
  if (event.type === "rest-short") return "The DM called a short rest.";
  if (event.type === "rest-long") return "The DM called a long rest.";
  if (event.type === "condition-apply") return `Condition applied: ${payload.label ?? "Effect"}.`;
  if (event.type === "condition-remove") return `Condition removed: ${payload.label ?? "Effect"}.`;
  if (event.type === "handout") return `Handout shared: ${payload.title ?? "Untitled"}.`;
  if (event.type === "audio-cue") return `Cue played: ${payload.title ?? "Untitled"}.`;
  if (event.type === "roll-request") return `Roll requested: ${payload.prompt ?? "Check"}.`;
  return "Table event.";
}

export default memo(function DMTablePanel({ campaign, events, theme, onClose, onOpenSheet, onPostEvent, onInitiativeUpdate }: Props) {
  const [tracks, setTracks] = useState<CampaignTrack[]>([]);
  const [trackTitle, setTrackTitle] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [trackKind, setTrackKind] = useState<"music" | "cue">("music");
  const [announcement, setAnnouncement] = useState("");
  const [rollRequest, setRollRequest] = useState("");
  // Roll requests: Check forks into ability vs skill (each with its own
  // list); Save is always an ability saving throw; Initiative needs no key.
  const [rollKind, setRollKind] = useState<"initiative" | "save" | "check">("check");
  const [checkScope, setCheckScope] = useState<"ability" | "skill">("ability");
  const [rollKey, setRollKey] = useState("dexterity");
  const [rollDc, setRollDc] = useState("");
  const [rollTarget, setRollTarget] = useState("all");
  const [conditionTarget, setConditionTarget] = useState("");
  const [conditionLabel, setConditionLabel] = useState(CONDITION_PRESETS[0]?.label ?? "Poisoned");
  const [conditionIsCustom, setConditionIsCustom] = useState(false);
  const [customCondition, setCustomCondition] = useState({ label: "", advantageMode: "none" as "none" | "advantage" | "disadvantage", stack: "" });
  const [handoutTitle, setHandoutTitle] = useState("");
  const [handoutUrl, setHandoutUrl] = useState("");
  const [combatant, setCombatant] = useState({ name: "", initiative: "", hp: "", ac: "", note: "", hidden: false, kind: "enemy" as CampaignCombatant["kind"] });
  const [recordFilter, setRecordFilter] = useState<"all" | "rolls" | "table">("all");
  // One command form open at a time — the row is the toolkit, not a wall of
  // stacked forms (proposal 24c).
  const [activeCommand, setActiveCommand] = useState<null | "announce" | "roll" | "condition" | "handout" | "combatant">(null);
  const [error, setError] = useState("");
  const isPlaying = campaign.audio.trackId;
  const players = campaign.members.filter((member) => member.userId !== campaign.campaign.dmUserId);

  // Display order is initiative-descending; turnIndex indexes the SORTED
  // list (same convention as the player-side "your turn" detection).
  const sortedCombatants = useMemo(
    () => [...campaign.initiative.data.combatants].sort((a, b) => b.initiative - a.initiative),
    [campaign.initiative.data.combatants],
  );
  const currentTurnId = sortedCombatants[campaign.initiative.data.turnIndex]?.id ?? null;

  const nextTurn = () => {
    if (sortedCombatants.length === 0) return;
    const { turnIndex, round } = campaign.initiative.data;
    const wrapped = turnIndex + 1 >= sortedCombatants.length;
    void onInitiativeUpdate(
      { ...campaign.initiative.data, turnIndex: wrapped ? 0 : turnIndex + 1, round: wrapped ? round + 1 : round },
      campaign.initiative.version,
    );
  };

  useEffect(() => { void listCampaignTracks(campaign.campaign.id).then(setTracks).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load tracks.")); }, [campaign.campaign.id]);

  const records = useMemo(() => [
    ...campaign.rolls.map((roll) => ({ id: `roll-${roll.id}`, kind: "rolls" as const, at: roll.created_at, text: `${roll.character_name} — ${roll.label} ${roll.total}` })),
    ...events.map((event) => ({ id: event.id, kind: "table" as const, at: event.created_at, text: eventLine(event) })),
  ].filter((entry) => recordFilter === "all" || entry.kind === recordFilter).sort((a, b) => b.at.localeCompare(a.at)), [campaign.rolls, events, recordFilter]);

  const replaceInitiative = (combatants: CampaignCombatant[], turnIndex = campaign.initiative.data.turnIndex) => onInitiativeUpdate({
    ...campaign.initiative.data,
    combatants,
    turnIndex: Math.max(0, Math.min(Math.max(0, combatants.length - 1), turnIndex)),
  }, campaign.initiative.version);

  const addCombatant = () => {
    const name = combatant.name.trim();
    const initiative = Number(combatant.initiative);
    if (!name || !Number.isFinite(initiative)) return;
    const hpMax = Number(combatant.hp);
    const ac = Number(combatant.ac);
    const next: CampaignCombatant = {
      id: crypto.randomUUID(),
      name,
      initiative: Math.trunc(initiative),
      kind: combatant.kind as CampaignCombatant["kind"] || "enemy",
      hidden: combatant.hidden,
    };
    if (Number.isFinite(hpMax) && hpMax > 0) {
      next.currentHp = hpMax;
      next.maxHp = hpMax;
    }
    if (Number.isFinite(ac) && ac >= 0) next.ac = Math.trunc(ac);
    if (combatant.note.trim()) next.privateNote = combatant.note.trim();
    void replaceInitiative([...campaign.initiative.data.combatants, next]);
    setCombatant({ name: "", initiative: "", hp: "", ac: "", note: "", hidden: false, kind: "enemy" });
  };

  const updateCombatant = (id: string, patch: Partial<CampaignCombatant>) => {
    void replaceInitiative(campaign.initiative.data.combatants.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addTrack = async () => {
    try {
      const track = await addCampaignTrack(campaign.campaign.id, { title: trackTitle.trim(), url: trackUrl.trim(), kind: trackKind });
      setTracks((current) => [...current, track]); setTrackTitle(""); setTrackUrl(""); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add track."); }
  };

  const toggleMusic = async (trackId: string | null) => {
    try {
      const result = await updateCampaignAudio(campaign.campaign.id, trackId, campaign.audio.version);
      if (result.conflict) setError("Audio changed elsewhere. The table will refresh shortly.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update table audio."); }
  };

  const requestRoll = async () => {
    const prompt = rollRequest.trim();
    if (!prompt) return;
    const keyType = rollKind === "check" && checkScope === "skill" ? "skill" : "ability";
    const payload: Record<string, unknown> = { prompt, kind: rollKind, keyType, key: rollKind === "initiative" ? "dexterity" : rollKey };
    if (rollKind !== "initiative") {
      const dc = Number(rollDc);
      if (rollDc.trim() && Number.isFinite(dc)) payload.dc = dc;
    }
    if (await onPostEvent("roll-request", payload, rollTarget === "all" ? null : rollTarget)) setRollRequest("");
  };

  const applyCondition = async (type: "condition-apply" | "condition-remove") => {
    const label = conditionIsCustom ? customCondition.label.trim() : conditionLabel.trim();
    if (!conditionTarget || !label) return;

    const payload: Record<string, unknown> = { label };

    if (type === "condition-apply") {
      if (conditionIsCustom) {
        // Custom condition — send the fields the DM filled in.
        if (customCondition.advantageMode !== "none") {
          payload.advantageMode = customCondition.advantageMode;
        }
        const stack = Number(customCondition.stack);
        if (Number.isFinite(stack) && stack >= 1 && stack <= 6) {
          payload.stack = stack;
        }
      } else {
        // Preset condition — include the preset's mechanical fields.
        const preset = CONDITION_PRESETS.find((p) => p.label === label);
        if (preset) {
          if (preset.advantageMode) payload.advantageMode = preset.advantageMode;
          if (preset.stack) payload.stack = preset.stack;
          if (preset.d20Dice) payload.d20Dice = preset.d20Dice;
          for (const key of ["ac", "attack", "damage", "saves", "checks", "initiative"] as const) {
            if (preset[key] !== undefined) payload[key] = preset[key];
          }
          if (preset.sense) payload.sense = preset.sense;
        }
      }
    }

    if (await onPostEvent(type, payload, conditionTarget)) {
      setConditionLabel(CONDITION_PRESETS[0]?.label ?? "Poisoned");
      setConditionIsCustom(false);
      setCustomCondition({ label: "", advantageMode: "none", stack: "" });
      setActiveCommand(null);
    }
  };

  const tableThemeVars = theme ? ({
    "--paper": theme.paper,
    "--paper-raised": `color-mix(in srgb, ${theme.paper} 94%, #000)`,
    "--ink": theme.ink,
    "--ink-2": `color-mix(in srgb, ${theme.ink} 65%, ${theme.paper})`,
    "--ink-3": `color-mix(in srgb, ${theme.ink} 45%, ${theme.paper})`,
    "--doc-accent": theme.accent,
    "--doc-accent-deep": `color-mix(in srgb, ${theme.accent} 82%, #000)`,
    "--doc-rule": `color-mix(in srgb, ${theme.ink} 40%, ${theme.paper})`,
    "--doc-rule-soft": `color-mix(in srgb, ${theme.ink} 16%, ${theme.paper})`,
    "--font-body": FONT_STACKS[theme.fontKey],
    "--font-display": FONT_STACKS[theme.fontKey],
    "--sheet-scale": `${theme.fontScale ?? 1}`,
    "--bg-opacity": `${theme.backgroundOpacity ?? 0.5}`,
    ...(theme.backgroundImageUrl ? { "--skin-bg-image": `url("${theme.backgroundImageUrl.replace(/["\\)]/g, "")}")` } : {}),
    // The Table stays a dark desk, but its desk, rules, and type are all
    // derived from the currently open character's skin rather than globals.
    "--ground": `color-mix(in srgb, ${theme.ink} 94%, #000)`,
    "--ground-2": `color-mix(in srgb, ${theme.ink} 88%, ${theme.paper})`,
    "--ground-3": `color-mix(in srgb, ${theme.ink} 97%, #000)`,
    "--parchment": theme.paper,
    "--parchment-2": `color-mix(in srgb, ${theme.paper} 70%, ${theme.ink})`,
    "--ink-faint": `color-mix(in srgb, ${theme.paper} 48%, ${theme.ink})`,
    "--rule": `color-mix(in srgb, ${theme.paper} 28%, ${theme.ink})`,
    "--rule-soft": `color-mix(in srgb, ${theme.paper} 15%, ${theme.ink})`,
  } as React.CSSProperties) : undefined;

  return (
    <section className="dm-table" style={tableThemeVars} data-bg={theme?.backgroundImageUrl ? "custom" : theme?.backgroundKey ?? "parchment"}>
      <header className="dm-table-head"><div><span>THE TABLE</span><h2>{campaign.campaign.name}</h2></div><div><button type="button" className="dm-table-code" onClick={() => navigator.clipboard.writeText(campaign.campaign.code).catch(() => {})}>Code {campaign.campaign.code} <Copy size={13} /></button><button type="button" className="glass-icon" onClick={onClose} aria-label="Close table"><X size={18} /></button></div></header>
      {error ? <p className="dm-table-error">{error}</p> : null}
      <div className="dm-table-grid">
        <aside className="dm-table-region dm-party"><h3>The Party</h3>{campaign.members.length ? campaign.members.map((member) => <button key={member.userId} type="button" className="dm-party-row" onClick={() => member.characterJson && onOpenSheet(member.characterJson)} disabled={!member.characterJson}><span className="dm-party-seal">{(member.characterName ?? member.userName).slice(0, 1)}</span><span><strong>{member.characterName ?? member.userName}</strong><small>HP {member.currentHp ?? "—"}/{member.maxHp ?? "—"} · AC {member.ac ?? "—"} · PP {member.passivePerception ?? "—"}</small><span className={`dm-hp-track${member.maxHp && (member.currentHp ?? 0) / member.maxHp <= 0.25 ? " is-low" : ""}`}><i style={{ width: `${member.maxHp ? Math.max(0, Math.min(100, (member.currentHp ?? 0) / member.maxHp * 100)) : 0}%` }} /></span>{member.spellSlots.length ? <em>Slots {member.spellSlots.map((slot) => `${slot.level}:${slot.remaining}/${slot.max}`).join(" · ")}</em> : null}{member.conditions.length ? <em className="dm-party-conditions">{member.conditions.slice(0, 4).join(" · ")}</em> : null}</span><Eye size={14} /></button>) : <p className="dm-empty">No souls at the table yet — share the code.</p>}</aside>
        <section className="dm-table-region dm-encounter">
          <div className="dm-region-head">
            <h3>Encounter</h3>
            <span className="dm-round">Round {campaign.initiative.data.round}</span>
            <button type="button" className="dm-btn dm-btn-primary" onClick={nextTurn} disabled={sortedCombatants.length === 0}>Next turn</button>
          </div>
          <div className="dm-initiative">
            {sortedCombatants.map((item) => {
              const isPlayer = item.kind === "player";
              const playerMember = isPlayer && item.memberUserId
                ? campaign.members.find((m) => m.userId === item.memberUserId)
                : null;
              // Player HP/AC come from member summary (live character data); NPCs use encounter state.
              const displayHp = isPlayer && playerMember
                ? { current: playerMember.currentHp ?? 0, max: playerMember.maxHp ?? 0 }
                : item.currentHp !== undefined ? { current: item.currentHp, max: item.maxHp ?? item.currentHp } : null;
              const displayAc = isPlayer && playerMember ? playerMember.ac : item.ac;
              return (
              <div key={item.id} className={`dm-combatant${item.hidden ? " is-hidden" : ""}${item.id === currentTurnId ? " is-current" : ""}${item.defeated ? " is-defeated" : ""}`} data-kind={item.kind}>
                <button
                  type="button"
                  className="dm-init-chip"
                  title={item.hidden ? "Hidden from the players — click to reveal" : "Click to hide from the players"}
                  onClick={() => updateCombatant(item.id, { hidden: !item.hidden })}
                >
                  {item.hidden ? "??" : item.initiative}
                </button>
                <span className="dm-combatant-name">
                  <strong className="dm-kind-chip" data-kind={item.kind}>{item.kind === "enemy" ? "⚔" : item.kind === "ally" ? "✦" : item.kind === "player" ? "●" : "○"}</strong>
                  <strong>{item.name}</strong>
                  {item.hidden ? <em className="dm-hidden-label">HIDDEN</em> : null}
                  {item.defeated ? <em className="dm-defeated-label">DEFEATED</em> : null}
                  {item.privateNote ? <small>{item.privateNote}</small> : null}
                  {item.concentratingOn ? <small className="dm-concentrating">{item.concentratingOn}</small> : null}
                  {item.conditions && item.conditions.length ? <span className="dm-condition-chips">{item.conditions.map((c) => <em key={c.id}>{c.label}{c.stack ? ` ${c.stack}` : ""}</em>)}</span> : null}
                </span>
                {displayHp ? <span className="dm-combatant-hp">HP <input aria-label={`${item.name} HP`} type="number" value={displayHp.current} onChange={(event) => {
                  if (!isPlayer) updateCombatant(item.id, { currentHp: Math.max(0, Number(event.target.value) || 0) });
                }} disabled={isPlayer} />/{displayHp.max}</span> : null}
                {displayAc !== undefined ? <small className="dm-combatant-ac">AC {displayAc}</small> : null}
                <button type="button" className="dm-icon-btn" aria-label={`Remove ${item.name}`} onClick={() => void replaceInitiative(campaign.initiative.data.combatants.filter((row) => row.id !== item.id))}><Trash2 size={13} /></button>
              </div>
            )})}
            {sortedCombatants.length === 0 ? <p className="dm-empty">No combatants yet — add one below, or let the party roll in.</p> : null}
          </div>

          {/* The toolkit: one row of commands, one open form at a time. */}
          <div className="dm-command-row">
            {([["announce", "Announce"], ["roll", "Request a roll"], ["condition", "Condition"], ["handout", "Handout"], ["combatant", "Add combatant"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`dm-btn${activeCommand === id ? " is-active" : ""}`}
                aria-expanded={activeCommand === id}
                onClick={() => setActiveCommand(activeCommand === id ? null : id)}
              >
                {label}
              </button>
            ))}
            <span className="dm-command-gap" aria-hidden="true" />
            <button type="button" className="dm-btn" onClick={() => void onPostEvent("rest-short", {})}>Short rest</button>
            <button type="button" className="dm-btn" onClick={() => void onPostEvent("rest-long", {})}>Long rest</button>
          </div>

          {activeCommand === "announce" ? (
            <div className="dm-inline-form">
              <input placeholder="Write an announcement" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} />
              <button type="button" className="dm-btn dm-btn-primary" disabled={!announcement.trim()} onClick={() => { if (announcement.trim()) void onPostEvent("announce", { message: announcement.trim() }).then(() => { setAnnouncement(""); setActiveCommand(null); }); }}><Send size={14} /> Announce</button>
            </div>
          ) : null}
          {activeCommand === "roll" ? (
            <div className="dm-inline-form">
              <input placeholder="Ask for a roll" value={rollRequest} onChange={(event) => setRollRequest(event.target.value)} />
              <select aria-label="Roll type" value={rollKind} onChange={(event) => { const kind = event.target.value as typeof rollKind; setRollKind(kind); setCheckScope("ability"); setRollKey("dexterity"); }}><option value="check">Check</option><option value="save">Save</option><option value="initiative">Initiative</option></select>
              <select aria-label="Roll target" value={rollTarget} onChange={(event) => setRollTarget(event.target.value)}><option value="all">All players</option>{players.map((member) => <option key={member.userId} value={member.userId}>{member.characterName ?? member.userName}</option>)}</select>
              {rollKind === "check" ? (
                <select aria-label="Check type" value={checkScope} onChange={(event) => { const scope = event.target.value as typeof checkScope; setCheckScope(scope); setRollKey(scope === "skill" ? "perception" : "dexterity"); }}>
                  <option value="ability">Ability</option>
                  <option value="skill">Skill</option>
                </select>
              ) : null}
              {rollKind === "check" && checkScope === "skill" ? (
                <select aria-label="Skill" value={rollKey} onChange={(event) => setRollKey(event.target.value)}>
                  {SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                </select>
              ) : rollKind !== "initiative" ? (
                <select aria-label={rollKind === "save" ? "Saving throw ability" : "Ability"} value={rollKey} onChange={(event) => setRollKey(event.target.value)}>
                  {abilityKeys.map((key) => <option key={key} value={key}>{abilityNames[key]}{rollKind === "save" ? " save" : ""}</option>)}
                </select>
              ) : null}
              {rollKind !== "initiative" ? <input placeholder="DC" type="number" value={rollDc} onChange={(event) => setRollDc(event.target.value)} /> : null}
              <button type="button" className="dm-btn dm-btn-primary" onClick={() => void requestRoll().then(() => setActiveCommand(null))} disabled={!rollRequest.trim()}>Request roll</button>
            </div>
          ) : null}
          {activeCommand === "condition" ? (
            <div className="dm-inline-form">
              <select value={conditionTarget} onChange={(event) => setConditionTarget(event.target.value)}><option value="">Target player</option>{players.map((member) => <option key={member.userId} value={member.userId}>{member.characterName ?? member.userName}</option>)}</select>
              {conditionIsCustom ? (
                <input placeholder="Condition name" value={customCondition.label} onChange={(event) => setCustomCondition({ ...customCondition, label: event.target.value })} />
              ) : (
                <select aria-label="Condition" value={conditionLabel} onChange={(event) => {
                  const value = event.target.value;
                  if (value === "__custom__") { setConditionIsCustom(true); setCustomCondition({ label: "", advantageMode: "none", stack: "" }); }
                  else setConditionLabel(value);
                }}>
                  {CONDITION_PRESETS.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
              )}
              <button type="button" className="dm-btn dm-btn-primary" onClick={() => void applyCondition("condition-apply")} disabled={!conditionTarget || (conditionIsCustom ? !customCondition.label.trim() : !conditionLabel.trim())}>Apply</button>
              <button type="button" className="dm-btn" onClick={() => void applyCondition("condition-remove")} disabled={!conditionTarget || (conditionIsCustom ? !customCondition.label.trim() : !conditionLabel.trim())}>Remove</button>
              {conditionIsCustom && (
                <span className="dm-custom-condition-opts">
                  <select aria-label="Advantage mode" value={customCondition.advantageMode} onChange={(event) => setCustomCondition({ ...customCondition, advantageMode: event.target.value as typeof customCondition.advantageMode })}>
                    <option value="none">Normal</option>
                    <option value="advantage">Advantage</option>
                    <option value="disadvantage">Disadvantage</option>
                  </select>
                  <input aria-label="Exhaustion level" type="number" min="1" max="6" placeholder="Stack 1-6" value={customCondition.stack} onChange={(event) => setCustomCondition({ ...customCondition, stack: event.target.value })} />
                  <button type="button" className="dm-btn" onClick={() => { setConditionIsCustom(false); setCustomCondition({ label: "", advantageMode: "none", stack: "" }); }}>↩ Presets</button>
                </span>
              )}
            </div>
          ) : null}
          {activeCommand === "handout" ? (
            <div className="dm-inline-form">
              <input placeholder="Handout title" value={handoutTitle} onChange={(event) => setHandoutTitle(event.target.value)} />
              <input placeholder="Image URL" value={handoutUrl} onChange={(event) => setHandoutUrl(event.target.value)} />
              <button type="button" className="dm-btn dm-btn-primary" disabled={!handoutTitle.trim() || !handoutUrl.trim()} onClick={() => { if (handoutTitle.trim() && handoutUrl.trim()) void onPostEvent("handout", { title: handoutTitle.trim(), url: handoutUrl.trim() }).then(() => { setHandoutTitle(""); setHandoutUrl(""); setActiveCommand(null); }); }}><Send size={14} /> Share a handout</button>
            </div>
          ) : null}
          {activeCommand === "combatant" ? (
            <div className="dm-inline-form">
              <input placeholder="Combatant" value={combatant.name} onChange={(event) => setCombatant({ ...combatant, name: event.target.value })} />
              <input placeholder="Init" type="number" value={combatant.initiative} onChange={(event) => setCombatant({ ...combatant, initiative: event.target.value })} />
              <select aria-label="Kind" value={combatant.kind} onChange={(event) => setCombatant({ ...combatant, kind: event.target.value as CampaignCombatant["kind"] })}>
                <option value="enemy">Enemy</option><option value="ally">Ally</option><option value="neutral">Neutral</option>
              </select>
              <input placeholder="HP" type="number" value={combatant.hp} onChange={(event) => setCombatant({ ...combatant, hp: event.target.value })} />
              <input placeholder="AC" type="number" value={combatant.ac} onChange={(event) => setCombatant({ ...combatant, ac: event.target.value })} />
              <input placeholder="Private note" value={combatant.note} onChange={(event) => setCombatant({ ...combatant, note: event.target.value })} />
              <label><input type="checkbox" checked={combatant.hidden} onChange={(event) => setCombatant({ ...combatant, hidden: event.target.checked })} /> Hidden</label>
              <button type="button" className="dm-btn dm-btn-primary" onClick={addCombatant} disabled={!combatant.name.trim() || !combatant.initiative.trim()}><Plus size={14} /> Add</button>
            </div>
          ) : null}
        </section>
        <aside className="dm-table-region dm-record"><h3>The Record</h3><div className="dm-filter">{(["all", "rolls", "table"] as const).map((filter) => <button key={filter} type="button" className={recordFilter === filter ? "is-active" : ""} aria-pressed={recordFilter === filter} onClick={() => setRecordFilter(filter)}>{filter === "all" ? "All" : filter === "rolls" ? "Rolls" : "Table"}</button>)}</div>{records.length ? records.map((record) => <p key={record.id}><time>{new Date(record.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{record.text}</p>) : <p>Nothing written yet.</p>}</aside>
      </div>
      <section className="dm-table-region dm-soundboard"><div><h3>The Soundboard</h3><small>{isPlaying ? `Now playing: ${campaign.audio.title}` : "The table is quiet. Add a track…"}</small></div><div className="dm-track-list">{tracks.map((track) => <div key={track.id} className={isPlaying === track.id ? "is-playing" : ""}><span>{track.kind === "music" ? <Music2 size={15}/> : <Volume2 size={15}/>}<strong>{track.title}</strong>{isPlaying === track.id ? <em className="dm-nowplaying">Now playing</em> : <small>{track.kind}</small>}</span>{track.kind === "music" ? <button type="button" className={`dm-btn${isPlaying === track.id ? " is-active" : ""}`} onClick={() => void toggleMusic(isPlaying === track.id ? null : track.id)}>{isPlaying === track.id ? <><Pause size={14}/> Stop</> : <><Play size={14}/> Play</>}</button> : <button type="button" className="dm-btn" onClick={() => void onPostEvent("audio-cue", { url: track.url, title: track.title })}><Play size={14}/> Cue</button>}<button type="button" className="dm-icon-btn" aria-label={`Delete ${track.title}`} onClick={() => void deleteCampaignTrack(campaign.campaign.id, track.id).then(() => setTracks((current) => current.filter((item) => item.id !== track.id)))}><Trash2 size={13}/></button></div>)}</div><div className="dm-inline-form"><input placeholder="Track title" value={trackTitle} onChange={(event) => setTrackTitle(event.target.value)}/><input placeholder="Direct audio URL" value={trackUrl} onChange={(event) => setTrackUrl(event.target.value)}/><select value={trackKind} onChange={(event) => setTrackKind(event.target.value as "music" | "cue")}><option value="music">Music</option><option value="cue">Cue</option></select><button type="button" className="dm-btn dm-btn-primary" onClick={addTrack} disabled={!trackTitle.trim() || !trackUrl.trim()}><Plus size={14}/> Add track</button></div></section>
    </section>
  );
});
