"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Music2, Pause, Play, Plus, Send, Trash2, Volume2, X } from "lucide-react";
import { addCampaignTrack, deleteCampaignTrack, listCampaignTracks, updateCampaignAudio } from "@/lib/client/campaignApi";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import DMPrepPanel from "@/components/DMPrepPanel";
import { D20_DICE_RE, EFFECT_NUMERIC_FIELDS, EFFECT_PRESETS } from "@/lib/effects";
import { summarizeRollRequest } from "@/lib/rollRequest";
import { abilityKeys, abilityNames } from "@/lib/utils";
import { SKILLS } from "@/lib/srd";
import { reminderMatches, type ReminderContext } from "@/lib/encounterGenerator";
import type { Character, CharacterTheme } from "@/types/game";
import type { CampaignCharacterNote, CampaignCombatant, CampaignEvent, CampaignSyncPayload, CampaignTrack, InitiativeState } from "@/types/campaign";
import type { CampaignHandout, CampaignNpc, CampaignScene, CampaignSession, EncounterRun, LootParcel } from "@/types/dmTools";
import PartyRail from "@/components/dmTable/PartyRail";
import CharacterInspector from "@/components/dmTable/CharacterInspector";
import { presetMode, type DmLayoutPreset, type DmWorkspaceMode } from "@/lib/dmTable/party";

/** Condition presets that a DM can apply. Matches the player-facing CampaignPanel dropdown. */
const CONDITION_PRESETS = EFFECT_PRESETS.filter((preset) => preset.source === "Condition");
const ROLL_PRESETS = [
  ["Perception", "check", "skill", "perception"], ["Insight", "check", "skill", "insight"],
  ["Investigation", "check", "skill", "investigation"], ["Stealth", "check", "skill", "stealth"],
  ["Dex save", "save", "ability", "dexterity"], ["Con save", "save", "ability", "constitution"],
  ["Wis save", "save", "ability", "wisdom"], ["Initiative", "initiative", "ability", "dexterity"],
] as const;
const RULE_REFERENCES = [
  ["Concentration", "A concentrating creature makes a Constitution save after each damage instance: DC 10 or half the damage, whichever is higher."],
  ["Cover", "Half cover grants +2 AC and Dexterity saves; three-quarters cover grants +5; total cover prevents direct targeting."],
  ["Typical DCs", "Very easy 5 · Easy 10 · Moderate 15 · Hard 20 · Very hard 25 · Nearly impossible 30."],
  ["Falling", "A fall deals 1d6 bludgeoning damage per 10 feet, to the supported ruleset maximum."],
  ["Grappling", "Use the supported ruleset's Unarmed Strike and escape rules; check the creature's current condition text for exact effects."],
  ["Exhaustion", "Use the exhaustion track shown by the current campaign rules source; do not mix editions."],
  ["Rests", "Short rests allow supported recovery features and hit-die spending; long rests use the shared recovery adapter."],
] as const;
const fuzzyMatch=(value:string,query:string)=>{let index=0;for(const char of value.toLowerCase())if(char===query.toLowerCase()[index])index++;return index===query.length;};

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
  if (event.type === "roll-request") return `Roll requested: ${summarizeRollRequest(payload)}.`;
  if (event.type === "campaign-audit") return `${String(payload.action ?? "Campaign update").replaceAll("-", " ")}: ${payload.name ?? payload.title ?? ""}`.trim();
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
  const [rollAdvantage, setRollAdvantage] = useState<"normal" | "advantage" | "disadvantage">("normal");
  const [rollRevealDc, setRollRevealDc] = useState(false);
  const [rollTarget, setRollTarget] = useState("all");
  const [rollSelectedTargets, setRollSelectedTargets] = useState<string[]>([]);
  const [rollResolution, setRollResolution] = useState<"individual" | "group" | "best">("individual");
  const [codeCopied, setCodeCopied] = useState(false);
  const [conditionTarget, setConditionTarget] = useState("");
  const [conditionLabel, setConditionLabel] = useState(CONDITION_PRESETS[0]?.label ?? "Poisoned");
  const [conditionIsCustom, setConditionIsCustom] = useState(false);
  const [customCondition, setCustomCondition] = useState<Record<string, string>>({});
  const [handoutTitle, setHandoutTitle] = useState("");
  const [handoutUrl, setHandoutUrl] = useState("");
  const [combatant, setCombatant] = useState({ name: "", initiative: "", hp: "", ac: "", note: "", hidden: false, kind: "enemy" as CampaignCombatant["kind"] });
  const [recordFilter, setRecordFilter] = useState<"all" | "rolls" | "table">("all");
  // One command form open at a time — the row is the toolkit, not a wall of
  // stacked forms (proposal 24c).
  const [activeCommand, setActiveCommand] = useState<null | "announce" | "roll" | "condition" | "handout" | "loot" | "combatant">(null);
  const [error, setError] = useState("");
  const [prepOpen, setPrepOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<CampaignSession | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<EncounterRun | null>(null);
  const [savedHandouts, setSavedHandouts] = useState<CampaignHandout[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<DmLayoutPreset>(() => {
    if (typeof window === "undefined") return "combat";
    const saved = window.localStorage.getItem("forge-and-fable-dm-layout");
    return saved === "roleplay" || saved === "preparation" || saved === "compact" ? saved : "combat";
  });
  const [workspaceMode, setWorkspaceMode] = useState<DmWorkspaceMode>(() => presetMode(layoutPreset));
  const [characterNotes, setCharacterNotes] = useState<CampaignCharacterNote[]>([]);
  const [scenes, setScenes] = useState<CampaignScene[]>([]);
  const [npcs, setNpcs] = useState<CampaignNpc[]>([]);
  const [lootParcels, setLootParcels] = useState<LootParcel[]>([]);
  const [lootDraft, setLootDraft] = useState({ label: "", item: "", quantity: "1", targetUserId: "" });
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionOnBreak, setSessionOnBreak] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [tourOpen, setTourOpen] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("forge-dm-table-tour") !== "done");
  const [sceneTitle, setSceneTitle] = useState("");
  const [npcDraft, setNpcDraft] = useState({ name: "", attitude: "Neutral", goal: "", armorClass: "", hitPoints: "" });
  const [clockNow, setClockNow] = useState(() => Date.now());
  const isPlaying = campaign.audio.trackId;
  const players = useMemo(
    () => campaign.members.filter((member) => member.userId !== campaign.campaign.dmUserId),
    [campaign.members, campaign.campaign.dmUserId],
  );
  const selectedMember = campaign.members.find((member) => member.userId === selectedUserId) ?? null;
  const activeScene = scenes.find((scene) => scene.active) ?? scenes[0] ?? null;

  // Display order is initiative-descending; turnIndex indexes the SORTED
  // list (same convention as the player-side "your turn" detection).
  const sortedCombatants = useMemo(
    () => [...campaign.initiative.data.combatants].sort((a, b) => b.initiative - a.initiative),
    [campaign.initiative.data.combatants],
  );
  const currentTurnId = sortedCombatants[campaign.initiative.data.turnIndex]?.id ?? null;
  const dueReminders = useMemo(() => {
    if (!activeEncounter) return [];
    const current = sortedCombatants[campaign.initiative.data.turnIndex];
    const round = campaign.initiative.data.round;
    const contexts: ReminderContext[] = [];
    if (campaign.initiative.data.turnIndex === 0) contexts.push({ type: "round-start", round });
    if (current) {
      contexts.push(
        { type: "turn-start", round, combatantId: current.id },
        { type: "initiative-count", round, initiative: current.initiative },
      );
    }
    return activeEncounter.reminders.filter((reminder) => contexts.some((context) => reminderMatches(reminder, context)));
  }, [activeEncounter, campaign.initiative.data.round, campaign.initiative.data.turnIndex, sortedCombatants]);
  const endTurnReminders = useMemo(() => {
    if (!activeEncounter) return [];
    const current = sortedCombatants[campaign.initiative.data.turnIndex];
    if (!current) return [];
    const round = campaign.initiative.data.round;
    const contexts: ReminderContext[] = [{ type: "turn-end", round, combatantId: current.id }];
    if (campaign.initiative.data.turnIndex === sortedCombatants.length - 1) contexts.push({ type: "round-end", round });
    return activeEncounter.reminders.filter((reminder) => contexts.some((context) => reminderMatches(reminder, context)));
  }, [activeEncounter, campaign.initiative.data.round, campaign.initiative.data.turnIndex, sortedCombatants]);

  const nextTurn = () => {
    if (sortedCombatants.length === 0) return;
    const { turnIndex, round } = campaign.initiative.data;
    const wrapped = turnIndex + 1 >= sortedCombatants.length;
    const combatants = wrapped ? campaign.initiative.data.combatants.map((item) => ({ ...item, reactionUsed: false })) : campaign.initiative.data.combatants;
    void onInitiativeUpdate(
      { ...campaign.initiative.data, combatants, turnIndex: wrapped ? 0 : turnIndex + 1, round: wrapped ? round + 1 : round },
      campaign.initiative.version,
    );
  };
  const previousTurn = () => {
    if (!sortedCombatants.length) return;
    const { turnIndex, round } = campaign.initiative.data;
    const wrapped = turnIndex === 0;
    void onInitiativeUpdate({ ...campaign.initiative.data, turnIndex: wrapped ? sortedCombatants.length - 1 : turnIndex - 1, round: wrapped ? Math.max(1, round - 1) : round }, campaign.initiative.version);
  };

  useEffect(() => { void listCampaignTracks(campaign.campaign.id).then(setTracks).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load tracks.")); }, [campaign.campaign.id]);
  const refreshWorkspace = useCallback(async () => {
    try {
      const [workspace, handoutData, sceneData, npcData, lootData] = await Promise.all([dmToolsApi.workspace(campaign.campaign.id), dmToolsApi.listHandouts(campaign.campaign.id), dmToolsApi.listScenes(campaign.campaign.id), dmToolsApi.listNpcs(campaign.campaign.id), dmToolsApi.listLoot(campaign.campaign.id)]);
      setActiveSession(workspace.activeSession);
      setActiveEncounter(workspace.activeEncounter);
      setSavedHandouts(handoutData.handouts);
      setScenes(sceneData.scenes); setNpcs(npcData.npcs);
      setLootParcels(lootData.parcels);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load session workspace."); }
  }, [campaign.campaign.id]);
  useEffect(() => {
    void refreshWorkspace();
    const interval = window.setInterval(() => void refreshWorkspace(), 10000);
    return () => window.clearInterval(interval);
  }, [refreshWorkspace]);
  useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!selectedUserId) {
      const first = players.find((member) => member.characterId);
      if (first) queueMicrotask(() => setSelectedUserId(first.userId));
    }
  }, [players, selectedUserId]);
  useEffect(() => {
    if (!selectedMember?.characterId) { queueMicrotask(() => setCharacterNotes([])); return; }
    let active = true;
    void dmToolsApi.listCharacterNotes(campaign.campaign.id, selectedMember.characterId)
      .then((result) => { if (active) setCharacterNotes(result.notes); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load character notes."); });
    return () => { active = false; };
  }, [campaign.campaign.id, selectedMember?.characterId]);

  const choosePreset = (preset: DmLayoutPreset) => {
    setLayoutPreset(preset);
    setWorkspaceMode(presetMode(preset));
    window.localStorage.setItem("forge-and-fable-dm-layout", preset);
  };

  const records = useMemo(() => [
    ...campaign.rolls.map((roll) => ({ id: `roll-${roll.id}`, kind: "rolls" as const, at: roll.created_at, text: `${roll.character_name} — ${roll.label} ${roll.total}` })),
    ...events.map((event) => ({ id: event.id, kind: "table" as const, at: event.created_at, text: eventLine(event) })),
  ].filter((entry) => recordFilter === "all" || entry.kind === recordFilter).sort((a, b) => b.at.localeCompare(a.at)), [campaign.rolls, events, recordFilter]);
  const encounterFacts = useMemo(() => {
    const enemies = sortedCombatants.filter((item) => item.kind === "enemy");
    const critical = players.filter((member) => member.maxHp && (member.currentHp ?? 0) / member.maxHp <= .25).length;
    return {
      elapsedMinutes: activeEncounter ? Math.max(0, Math.floor((clockNow - Date.parse(activeEncounter.startedAt)) / 60_000)) : 0,
      activeEnemies: enemies.filter((item) => !item.defeated && (item.currentHp ?? 1) > 0).length,
      defeatedEnemies: enemies.filter((item) => item.defeated || item.currentHp === 0).length,
      critical, concentrating: players.filter((member) => member.concentratingOn).length,
      pendingRequests: campaign.requests.filter((request) => request.status === "open").length,
    };
  }, [activeEncounter, campaign.requests, clockNow, players, sortedCombatants]);

  const waveIsReady = (wave: EncounterRun["snapshot"]["waves"][number]) => {
    const trigger = wave.trigger;
    if (trigger.type === "round-start") return campaign.initiative.data.round >= trigger.round;
    if (trigger.type === "combatant-hp") {
      const combatant = campaign.initiative.data.combatants.find((item) => item.id === trigger.combatantId);
      return Boolean(combatant?.maxHp && ((combatant.currentHp ?? combatant.maxHp) / combatant.maxHp) * 100 <= trigger.belowPercent);
    }
    if (trigger.type === "combatant-defeated") {
      const combatant = campaign.initiative.data.combatants.find((item) => item.id === trigger.combatantId);
      return Boolean(combatant?.defeated || combatant?.currentHp === 0);
    }
    return false;
  };

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
    // The prompt is optional — the roll auto-describes from kind + key.
    const prompt = rollRequest.trim();
    const keyType = rollKind === "check" && checkScope === "skill" ? "skill" : "ability";
    const payload: Record<string, unknown> = { kind: rollKind, keyType, key: rollKind === "initiative" ? "dexterity" : rollKey };
    if (prompt) payload.prompt = prompt;
    if (rollAdvantage !== "normal") payload.advantage = rollAdvantage;
    // A hidden DC is never sent to the player — omitting it keeps the number
    // off the player's client entirely; the DM eyeballs the result.
    const dc = Number(rollDc);
    if (rollKind !== "initiative" && rollRevealDc && rollDc.trim() && Number.isFinite(dc)) payload.dc = dc;
    const targetUserIds = rollTarget === "all" ? players.map((member) => member.userId)
      : rollTarget === "selected" ? rollSelectedTargets
      : rollTarget === "except" ? players.filter((member) => !rollSelectedTargets.includes(member.userId)).map((member) => member.userId)
      : [rollTarget];
    try {
      await dmToolsApi.createRequest(campaign.campaign.id, { kind: "roll", resolution: rollResolution, targetUserIds, payload });
      setRollRequest("");
      setRollAdvantage("normal");
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create roll request."); }
  };

  const createQuickScene = async () => {
    if (!sceneTitle.trim()) return;
    try { await dmToolsApi.createScene(campaign.campaign.id, { title: sceneTitle.trim(), active: true, presentUserIds: players.map((member) => member.userId), objectives: [], clues: [], npcIds: [], handoutIds: [], likelyChecks: [] }); setSceneTitle(""); await refreshWorkspace(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create scene."); }
  };
  const createQuickNpc = async () => {
    if (!npcDraft.name.trim()) return;
    const hp = Number(npcDraft.hitPoints), ac = Number(npcDraft.armorClass);
    try { const result = await dmToolsApi.createNpc(campaign.campaign.id, { name: npcDraft.name, attitude: npcDraft.attitude, goal: npcDraft.goal, ...(Number.isFinite(hp) && hp > 0 ? { currentHp: hp, maxHp: hp } : {}), ...(npcDraft.armorClass.trim() && Number.isFinite(ac) ? { armorClass: ac } : {}), status: "alive", disposition: "neutral", ...(activeScene ? { currentSceneId: activeScene.id } : {}) }); if (activeScene) await dmToolsApi.updateScene(campaign.campaign.id, activeScene.id, { npcIds: [...new Set([...activeScene.npcIds, result.npc.id])] }); setNpcDraft({ name: "", attitude: "Neutral", goal: "", armorClass: "", hitPoints: "" }); await refreshWorkspace(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create NPC."); }
  };
  const createAndOfferLoot = async () => {
    if (!lootDraft.label.trim() || !lootDraft.item.trim()) return;
    try { const result=await dmToolsApi.createLoot(campaign.campaign.id,{label:lootDraft.label,sessionId:activeSession?.id,encounterId:activeEncounter?.id,items:[{name:lootDraft.item,quantity:Math.max(1,Number(lootDraft.quantity)||1)}]}); if(lootDraft.targetUserId)await dmToolsApi.offerLoot(campaign.campaign.id,result.parcel.id,{itemId:result.parcel.items[0].id,targetUserId:lootDraft.targetUserId});setLootDraft({label:"",item:"",quantity:"1",targetUserId:""});await refreshWorkspace(); }
    catch(reason){setError(reason instanceof Error?reason.message:"Could not create loot parcel.");}
  };

  const callRest = async (kind: "rest-short" | "rest-long") => {
    const preview = players.map((member) => kind === "rest-short"
      ? `${member.characterName ?? member.userName}: HP ${member.currentHp ?? "—"}/${member.maxHp ?? "—"} · ${member.hitDice?.remaining ?? "—"}/${member.hitDice?.maximum ?? "—"} hit dice`
      : `${member.characterName ?? member.userName}: restore HP, slots, eligible hit dice; end concentration`).join("\n");
    if (!window.confirm(`${kind === "rest-long" ? "LONG" : "SHORT"} REST\n\n${preview}\n\nCall this rest?`)) return;
    try {
      await dmToolsApi.createRequest(campaign.campaign.id, { kind, resolution: "individual", targetUserIds: players.map((member) => member.userId), payload: {} });
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not call rest."); }
  };

  const applyCondition = async (type: "condition-apply" | "condition-remove") => {
    const label = conditionIsCustom ? (customCondition.label ?? "").trim() : conditionLabel.trim();
    if (!conditionTarget || !label) return;

    const payload: Record<string, unknown> = { label };

    if (type === "condition-apply") {
      if (conditionIsCustom) {
        // Custom condition — send every field the DM filled in (mirrors HeroSheet's addCustomEffect).
        const advMode = (customCondition.advantageMode ?? "none").trim();
        if (advMode === "advantage" || advMode === "disadvantage") {
          payload.advantageMode = advMode;
        }
        const stack = Number(customCondition.stack);
        if (Number.isFinite(stack) && stack >= 1 && stack <= 6) payload.stack = stack;
        for (const field of EFFECT_NUMERIC_FIELDS) {
          const raw = (customCondition[field.key] ?? "").trim();
          if (raw === "") continue;
          const n = Math.max(-20, Math.min(20, parseInt(raw, 10)));
          if (Number.isFinite(n) && n !== 0) payload[field.key] = n;
        }
        const dice = (customCondition.d20Dice ?? "").trim();
        if (dice && D20_DICE_RE.test(dice)) payload.d20Dice = dice;
        const sense = (customCondition.sense ?? "").trim();
        if (sense) payload.sense = sense.slice(0, 48);
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
      setCustomCondition({});
      setActiveCommand(null);
    }
  };

  useEffect(() => { const handler=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setCommandOpen((value)=>!value);}else if(event.key==="Escape")setCommandOpen(false);};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
  const commands = [
    {label:"Request Perception from everyone",run:()=>{setRollKind("check");setCheckScope("skill");setRollKey("perception");setRollTarget("all");setWorkspaceMode("encounter");setActiveCommand("roll");}},
    {label:"Advance turn",run:nextTurn,disabled:!sortedCombatants.length},
    {label:"Call short rest",run:()=>void callRest("rest-short"),disabled:!players.length},
    {label:"Call long rest",run:()=>void callRest("rest-long"),disabled:!players.length},
    {label:"Open selected character sheet",run:()=>{if(selectedMember?.characterJson)onOpenSheet(selectedMember.characterJson);},disabled:!selectedMember?.characterJson},
    {label:"Apply condition to selected character",run:()=>{if(selectedMember)setConditionTarget(selectedMember.userId);setWorkspaceMode("encounter");setActiveCommand("condition");},disabled:!selectedMember},
    {label:"Add NPC to scene",run:()=>setWorkspaceMode("scene")},
    {label:"Add combatant",run:()=>{setWorkspaceMode("encounter");setActiveCommand("combatant");}},
    {label:"Share handout",run:()=>{setWorkspaceMode("encounter");setActiveCommand("handout");}},
    {label:"Open party capabilities",run:()=>setWorkspaceMode("scene")},
    ...(["scene","encounter","preparation","review"] as DmWorkspaceMode[]).map((mode)=>({label:`Switch to ${mode} mode`,run:()=>setWorkspaceMode(mode)})),
  ];
  const paletteItems: Array<{kind:string;label:string;detail?:string;disabled:boolean;run:()=>void}>=[...commands.map((command)=>({kind:"Command",...command,disabled:command.disabled??false})),...RULE_REFERENCES.map(([label,detail])=>({kind:"Rule",label,detail,disabled:false,run:()=>setCommandQuery(label)}))].filter((item)=>!commandQuery.trim()||fuzzyMatch(`${item.label} ${String("detail" in item?item.detail:"")}`,commandQuery.trim()));

  return (
    <section className="dm-table" style={theme ? ({ "--paper": theme.paper, "--ink": theme.ink, "--doc-accent": theme.accent } as React.CSSProperties) : undefined}>
      <header className="dm-table-head">
        <div><span>THE TABLE{activeSession?.title ? ` · ${activeSession.title}` : ""}</span><h2>{campaign.campaign.name}</h2></div>
        <nav className="dm-workspace-modes" aria-label="Table mode">
          {(["scene", "encounter", "preparation", "review"] as DmWorkspaceMode[]).map((mode) => (
            <button key={mode} type="button" className={workspaceMode === mode ? "is-active" : ""} aria-pressed={workspaceMode === mode} onClick={() => setWorkspaceMode(mode)}>{mode === "review" ? "Session review" : mode}</button>
          ))}
        </nav>
        <div>
          <label className="dm-layout-picker"><span>View</span><select value={layoutPreset} onChange={(event) => choosePreset(event.target.value as DmLayoutPreset)}><option value="combat">Combat</option><option value="roleplay">Roleplay</option><option value="preparation">Preparation</option><option value="compact">Compact</option></select></label>
          <button type="button" className="dm-btn" onClick={() => setPrepOpen(true)}>Tools</button>
          <button type="button" className="dm-btn" onClick={() => setCommandOpen(true)}>Command <kbd>Ctrl K</kbd></button>
          <button type="button" className={`dm-table-code${codeCopied ? " is-copied" : ""}`} onClick={() => { navigator.clipboard.writeText(campaign.campaign.code).then(() => { setCodeCopied(true); window.setTimeout(() => setCodeCopied(false), 1600); }).catch(() => setError("Could not copy the code — copy it by hand.")); }}>{codeCopied ? <>Copied <Check size={13} /></> : <>Code {campaign.campaign.code} <Copy size={13} /></>}</button>
          <button type="button" className="glass-icon" onClick={onClose} aria-label="Close table"><X size={18} /></button>
        </div>
      </header>
      {commandOpen ? <div className="dm-command-palette" role="dialog" aria-label="DM command palette"><div><input autoFocus aria-label="Search commands and rules" placeholder="Type a command or rule…" value={commandQuery} onChange={(event)=>{setCommandQuery(event.target.value);setCommandIndex(0);}} onKeyDown={(event)=>{if(event.key==="ArrowDown"){event.preventDefault();setCommandIndex((index)=>Math.min(paletteItems.length-1,index+1));}if(event.key==="ArrowUp"){event.preventDefault();setCommandIndex((index)=>Math.max(0,index-1));}if(event.key==="Enter"){const item=paletteItems[commandIndex];if(item&&!item.disabled){item.run();setCommandOpen(false);setCommandQuery("");}}}}/><small>Commands and rules · ↑↓ navigate · Enter run · Esc close</small><ul>{paletteItems.slice(0,12).map((item,index)=><li key={`${item.kind}-${item.label}`}><button type="button" className={index===commandIndex?"is-active":""} disabled={item.disabled} onMouseEnter={()=>setCommandIndex(index)} onClick={()=>{item.run();setCommandOpen(false);setCommandQuery("");}}><span>{item.kind}</span><strong>{item.label}</strong>{"detail" in item?<small>{item.detail}</small>:item.disabled?<small>Unavailable in the current context</small>:null}</button></li>)}</ul></div></div> : null}
      {error ? <p className="dm-table-error">{error}</p> : null}
      {tourOpen ? <aside className="dm-first-tour" aria-label="DM Table quick tour"><strong>Your Table workspace</strong><ol><li>Party state stays in the left command rail.</li><li>The center changes between Scene, Encounter, Preparation, and Review.</li><li>Select a character to open the right inspector.</li><li>Tools and Ctrl/Cmd+K expose the full command set.</li></ol><button type="button" className="dm-btn dm-btn-primary" onClick={()=>{window.localStorage.setItem("forge-dm-table-tour","done");setTourOpen(false);}}>Got it</button></aside> : null}
      {activeSession ? <section className="dm-session-strip"><strong>{activeSession.title??"Active session"}</strong><span>{Math.max(0,Math.floor((clockNow-Date.parse(activeSession.startedAt))/60000))}m{sessionOnBreak?" · On break":""}</span><button type="button" className="dm-btn" onClick={()=>{const note=window.prompt("Session note");if(note)void dmToolsApi.pin(campaign.campaign.id,activeSession.id,{note});}}>Add note</button><button type="button" className="dm-btn" disabled={!records[0]} onClick={()=>records[0]&&void dmToolsApi.pin(campaign.campaign.id,activeSession.id,{note:records[0].text,eventId:records[0].id})}>Pin latest</button><button type="button" className="dm-btn" onClick={()=>setSessionOnBreak((value)=>!value)}>{sessionOnBreak?"Resume":"Take break"}</button><button type="button" className="dm-btn" onClick={()=>{if(window.confirm("End this session and prepare its summary draft?"))void dmToolsApi.endSession(campaign.campaign.id,activeSession.id).then(()=>{setPrepOpen(true);return refreshWorkspace();});}}>End session</button></section> : <section className="dm-session-strip"><strong>Start session</strong><input placeholder="Session title" value={sessionTitle} onChange={(event)=>setSessionTitle(event.target.value)}/><span>{activeScene?`Starting at ${activeScene.title}`:"No starting scene selected"}</span><button type="button" className="dm-btn dm-btn-primary" onClick={()=>void dmToolsApi.startSession(campaign.campaign.id,{title:sessionTitle||undefined}).then(()=>{setSessionTitle("");return refreshWorkspace();})}>Start session</button></section>}
      {activeEncounter ? <section className="dm-live-encounter">
        <div><span>ACTIVE ENCOUNTER</span><strong>{activeEncounter.snapshot.name}</strong><small>{activeEncounter.snapshot.objective}</small></div>
        <div className="dm-pacing-facts" aria-label="Encounter status"><span>Round <strong>{campaign.initiative.data.round}</strong></span><span>Elapsed <strong>{encounterFacts.elapsedMinutes}m</strong></span><span>Enemies <strong>{encounterFacts.activeEnemies} active · {encounterFacts.defeatedEnemies} defeated</strong></span><span>Party <strong>{encounterFacts.critical} critical · {encounterFacts.concentrating} concentrating</strong></span><span>Pending <strong>{encounterFacts.pendingRequests}</strong></span></div>
        <details><summary>Scene notes</summary>{activeEncounter.snapshot.readAloud ? <><p><b>Read aloud:</b> {activeEncounter.snapshot.readAloud}</p><button type="button" className="dm-btn" onClick={() => navigator.clipboard.writeText(activeEncounter.snapshot.readAloud ?? "").catch(() => {})}>Copy</button><button type="button" className="dm-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { readAloudRead: !activeEncounter.readAloudRead }).then(() => refreshWorkspace())}>{activeEncounter.readAloudRead ? "Reset read status" : "Mark as read"}</button></> : null}{activeEncounter.snapshot.tactics ? <p><b>Tactics:</b> {activeEncounter.snapshot.tactics}</p> : null}{activeEncounter.snapshot.environmentNotes ? <p><b>Environment:</b> {activeEncounter.snapshot.environmentNotes}</p> : null}{activeEncounter.snapshot.developments ? <p><b>Developments:</b> {activeEncounter.snapshot.developments}</p> : null}{activeSession ? <button type="button" className="dm-btn" onClick={() => void dmToolsApi.pin(campaign.campaign.id, activeSession.id, { note: `${activeEncounter.snapshot.name}: ${activeEncounter.snapshot.developments ?? activeEncounter.snapshot.objective ?? "Scene note"}` })}>Pin scene note</button> : null}</details>
        <div className="dm-upcoming"><span>{dueReminders.length ? "REMINDERS DUE" : "NO REMINDERS DUE"}</span>{dueReminders.slice(0, 3).map((item) => <div key={item.id}><label><input type="checkbox" checked={item.completed} onChange={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { reminders: activeEncounter.reminders.map((row) => row.id === item.id ? { ...row, completed: true } : row) }).then(() => refreshWorkspace())}/>{item.label}</label><button type="button" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { reminders: activeEncounter.reminders.map((row) => row.id === item.id ? { ...row, snoozedUntilRound: campaign.initiative.data.round + 1 } : row) }).then(() => refreshWorkspace())}>Snooze</button>{activeSession ? <button type="button" onClick={() => void dmToolsApi.pin(campaign.campaign.id, activeSession.id, { note: item.label })}>Record</button> : null}</div>)}</div>
        <div className="dm-wave-list">{activeEncounter.snapshot.waves.filter((wave) => !activeEncounter.activatedWaveIds?.includes(wave.id) && !activeEncounter.cancelledWaveIds?.includes(wave.id)).map((wave) => { const ready = waveIsReady(wave); const postponed = activeEncounter.postponedWaveIds?.includes(wave.id); return <article key={wave.id} data-ready={ready}><span>{ready ? "READY" : postponed ? "POSTPONED" : "UPCOMING"}</span><strong>{wave.name}</strong><small>{wave.combatantIds.length} combatant templates</small><button type="button" className="dm-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { action: "activate-wave", waveId: wave.id }).then(() => refreshWorkspace())}>Deploy now</button><button type="button" className="dm-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { action: "postpone-wave", waveId: wave.id }).then(() => refreshWorkspace())}>Postpone</button><button type="button" className="dm-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { action: "cancel-wave", waveId: wave.id }).then(() => refreshWorkspace())}>Cancel</button></article>; })}</div>
        <div>{activeEncounter.snapshot.handoutIds.map((id) => savedHandouts.find((item) => item.id === id)).filter((item): item is CampaignHandout => Boolean(item)).map((handout) => <button key={handout.id} type="button" className="dm-btn" onClick={() => void dmToolsApi.shareHandout(campaign.campaign.id, handout.id)}>Reveal {handout.title}</button>)}<button type="button" className="dm-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { action: activeEncounter.status === "paused" ? "resume" : "pause" }).then(() => refreshWorkspace())}>{activeEncounter.status === "paused" ? "Resume" : "Pause"}</button><button type="button" className="dm-btn" onClick={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { action: "end" }).then(() => refreshWorkspace())}>End encounter</button></div>
      </section> : null}
      <div className="dm-table-grid">
        <PartyRail
          members={campaign.members}
          dmUserId={campaign.campaign.dmUserId}
          selectedUserId={selectedUserId}
          currentTurnUserId={sortedCombatants[campaign.initiative.data.turnIndex]?.memberUserId ?? null}
          presence={campaign.presence}
          compact={layoutPreset === "compact"}
          onSelect={(member) => setSelectedUserId(member.userId)}
          onOpenSheet={(member) => { if (member.characterJson) onOpenSheet(member.characterJson); }}
        />
        <section className="dm-table-region dm-encounter">
          {workspaceMode === "preparation" ? (
            <div className="dm-workspace-empty"><span>Preparation</span><h3>Prepare the next beat</h3><p>Choose saved encounters, creatures, handouts, reminders, and session notes in the campaign workshop.</p><button type="button" className="dm-btn dm-btn-primary" onClick={() => setPrepOpen(true)}>Open campaign workshop</button></div>
          ) : workspaceMode === "review" ? (
            <div className="dm-workspace-review"><div className="dm-region-head"><h3>Session record</h3><span>{activeSession?.title ?? "No active session"}</span></div><div className="dm-filter">{(["all", "rolls", "table"] as const).map((filter) => <button key={filter} type="button" className={recordFilter === filter ? "is-active" : ""} aria-pressed={recordFilter === filter} onClick={() => setRecordFilter(filter)}>{filter === "all" ? "All" : filter === "rolls" ? "Rolls" : "Table"}</button>)}</div><div className="dm-record-list">{records.length ? records.map((record) => <p key={record.id}><time>{new Date(record.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{record.text}{activeSession ? <button type="button" className="dm-pin" onClick={() => void dmToolsApi.pin(campaign.campaign.id, activeSession.id, { note: record.text, eventId: record.id })}>Pin for summary</button> : null}</p>) : <p className="dm-empty">Nothing has been recorded yet.</p>}</div></div>
          ) : workspaceMode === "scene" ? (
            <div className="dm-scene-workspace"><div className="dm-region-head"><div><span>Current scene</span><h3>{activeScene?.title ?? activeEncounter?.snapshot.name ?? "The table is ready"}</h3></div>{scenes.length ? <select aria-label="Current scene" value={activeScene?.id ?? ""} onChange={(event) => { const scene=scenes.find((item)=>item.id===event.target.value); if(scene) void dmToolsApi.updateScene(campaign.campaign.id,scene.id,{active:true}).then(()=>refreshWorkspace()); }}>{scenes.map((scene)=><option key={scene.id} value={scene.id}>{scene.title}</option>)}</select> : null}</div>{activeScene ? <><p>{activeScene.description ?? "Set the scene, reveal a clue, request a check, or launch the linked encounter."}</p>{activeScene.readAloud ? <blockquote>{activeScene.readAloud}</blockquote> : null}<div className="dm-scene-columns"><section><h4>Present</h4>{players.map((member)=><label key={member.userId}><input type="checkbox" checked={activeScene.presentUserIds.includes(member.userId)} onChange={(event)=>void dmToolsApi.updateScene(campaign.campaign.id,activeScene.id,{presentUserIds:event.target.checked?[...new Set([...activeScene.presentUserIds,member.userId])]:activeScene.presentUserIds.filter((id)=>id!==member.userId)}).then(()=>refreshWorkspace())}/>{member.characterName??member.userName}</label>)}</section><section><h4>Objectives</h4>{activeScene.objectives.map((objective)=><label key={objective}><input type="checkbox" checked={activeScene.completedObjectives.includes(objective)} onChange={(event)=>void dmToolsApi.updateScene(campaign.campaign.id,activeScene.id,{completedObjectives:event.target.checked?[...new Set([...activeScene.completedObjectives,objective])]:activeScene.completedObjectives.filter((item)=>item!==objective)}).then(()=>refreshWorkspace())}/>{objective}</label>)}</section><section><h4>Clues</h4>{activeScene.clues.map((clue)=><label key={clue}><input type="checkbox" checked={activeScene.revealedClues.includes(clue)} onChange={(event)=>void dmToolsApi.updateScene(campaign.campaign.id,activeScene.id,{revealedClues:event.target.checked?[...new Set([...activeScene.revealedClues,clue])]:activeScene.revealedClues.filter((item)=>item!==clue)}).then(()=>refreshWorkspace())}/>{clue}</label>)}</section></div><section className="dm-capability-matrix"><h4>Party references</h4><table><thead><tr><th>Character</th><th>Perception</th><th>Insight</th><th>Investigation</th><th>Languages</th><th>Tools & skills</th></tr></thead><tbody>{players.map((member)=><tr key={member.userId}><th>{member.characterName??member.userName}</th><td>{member.passivePerception??"—"}</td><td>{member.passiveInsight??"—"}</td><td>{member.passiveInvestigation??"—"}</td><td>{member.characterJson?.languages?.join(", ")||"—"}</td><td>{[...(member.characterJson?.toolProficiencies??[]),...(member.characterJson?.skillProficiencies??[])].join(", ")||"—"}</td></tr>)}</tbody></table></section><section className="dm-npc-drawer"><h4>Scene NPCs</h4>{npcs.filter((npc)=>activeScene.npcIds.includes(npc.id)||npc.currentSceneId===activeScene.id).map((npc)=><article key={npc.id}><header><strong>{npc.name}</strong><span>{npc.attitude} · {npc.status}</span></header><p>{npc.goal??npc.knows??"No public-facing goal recorded."}</p><small>AC {npc.armorClass??"—"} · HP {npc.currentHp??"—"}/{npc.maxHp??"—"} · Insight DC {npc.insightDc??"—"}</small><div><select aria-label={`${npc.name} disposition`} value={npc.disposition} onChange={(event)=>void dmToolsApi.updateNpc(campaign.campaign.id,npc.id,{disposition:event.target.value}).then(()=>refreshWorkspace())}><option value="neutral">Neutral</option><option value="allied">Allied</option><option value="hostile">Hostile</option></select><select aria-label={`${npc.name} status`} value={npc.status} onChange={(event)=>void dmToolsApi.updateNpc(campaign.campaign.id,npc.id,{status:event.target.value}).then(()=>refreshWorkspace())}><option value="alive">Alive</option><option value="dead">Dead</option><option value="missing">Missing</option></select><button type="button" className="dm-btn" onClick={()=>void replaceInitiative([...campaign.initiative.data.combatants,{id:crypto.randomUUID(),name:npc.name,initiative:Math.floor(Math.random()*20)+1,kind:npc.disposition==="allied"?"ally":"enemy",currentHp:npc.currentHp,maxHp:npc.maxHp,ac:npc.armorClass,privateNote:npc.goal}])}>Add to initiative</button>{npc.portraitUrl?<button type="button" className="dm-btn" onClick={()=>void onPostEvent("handout",{title:npc.name,url:npc.portraitUrl!})}>Share portrait</button>:null}</div></article>)}<div className="dm-inline-form"><input placeholder="NPC name" value={npcDraft.name} onChange={(event)=>setNpcDraft({...npcDraft,name:event.target.value})}/><input placeholder="Attitude" value={npcDraft.attitude} onChange={(event)=>setNpcDraft({...npcDraft,attitude:event.target.value})}/><input placeholder="Goal" value={npcDraft.goal} onChange={(event)=>setNpcDraft({...npcDraft,goal:event.target.value})}/><input placeholder="AC" type="number" value={npcDraft.armorClass} onChange={(event)=>setNpcDraft({...npcDraft,armorClass:event.target.value})}/><input placeholder="HP" type="number" value={npcDraft.hitPoints} onChange={(event)=>setNpcDraft({...npcDraft,hitPoints:event.target.value})}/><button type="button" className="dm-btn" onClick={createQuickNpc}>Add NPC</button></div></section><div><button type="button" className="dm-btn" onClick={()=>{setWorkspaceMode("encounter");setActiveCommand("roll");}}>Request likely check</button>{activeScene.linkedEncounterId?<button type="button" className="dm-btn dm-btn-primary" onClick={()=>void dmToolsApi.startEncounter(activeScene.linkedEncounterId!).then(()=>{setWorkspaceMode("encounter");return refreshWorkspace();})}>Launch linked encounter</button>:null}<button type="button" className="dm-btn" onClick={()=>setPrepOpen(true)}>Full scene tools</button></div></> : <div className="dm-workspace-empty"><strong>No scene yet</strong><span>Create a lightweight current scene, then add details in Preparation.</span><div className="dm-inline-form"><input placeholder="Scene title" value={sceneTitle} onChange={(event)=>setSceneTitle(event.target.value)}/><button type="button" className="dm-btn dm-btn-primary" onClick={createQuickScene}>Create scene</button></div></div>}</div>
          ) : (
          <>
          <div className="dm-region-head">
            <h3>{sortedCombatants[campaign.initiative.data.turnIndex]?.name ?? "Encounter"}</h3>
            <span className="dm-round">Round {campaign.initiative.data.round}</span>
            <button type="button" className="dm-btn" onClick={previousTurn} disabled={sortedCombatants.length === 0}>Previous</button>
            <button type="button" className="dm-btn dm-btn-primary" onClick={nextTurn} disabled={sortedCombatants.length === 0}>Next turn</button>
          </div>
          {activeEncounter && (dueReminders.length || endTurnReminders.length) ? <section className="dm-turn-checklist"><strong>{sortedCombatants[campaign.initiative.data.turnIndex]?.name}&apos;s turn</strong>{[...dueReminders.map((item) => ({ item, phase: "Start" })), ...endTurnReminders.map((item) => ({ item, phase: "End" }))].map(({ item, phase }) => <label key={`${phase}-${item.id}`}><input type="checkbox" checked={item.completed} onChange={() => void dmToolsApi.updateRun(campaign.campaign.id, activeEncounter.id, { reminders: activeEncounter.reminders.map((row) => row.id === item.id ? { ...row, completed: true } : row) }).then(() => refreshWorkspace())}/><span><small>{phase}</small>{item.label}</span></label>)}</section> : null}
          {campaign.requests.length ? <section className="dm-request-center" aria-label="Recent player requests">
            {campaign.requests.slice(0, 4).map((request) => {
              const dc = typeof request.payload.dc === "number" ? request.payload.dc : undefined;
              const responses = request.responses;
              const passes = responses.filter((response) => response.passed).length;
              const totals = responses.flatMap((response) => typeof response.total === "number" ? [response.total] : []);
              const groupPassed = request.resolution === "group" && dc !== undefined ? passes >= Math.ceil(request.targetUserIds.length / 2) : undefined;
              const bestPassed = request.resolution === "best" && dc !== undefined && totals.length ? Math.max(...totals) >= dc : undefined;
              const title = request.kind === "roll" ? summarizeRollRequest(request.payload) : request.kind === "rest-long" ? "Long rest" : "Short rest";
              return <article key={request.id} className="dm-request-card" data-status={request.status}>
                <header><strong>{title}</strong><span>{responses.length}/{request.targetUserIds.length} responded</span></header>
                <div>{request.targetUserIds.map((userId) => {
                  const member = campaign.members.find((item) => item.userId === userId);
                  const response = responses.find((item) => item.userId === userId);
                  return <p key={userId}><span>{member?.characterName ?? member?.userName ?? "Player"}</span><em>{response ? `${response.total ?? "✓"}${response.passed === true ? " Pass" : response.passed === false ? " Fail" : ""}` : "Waiting"}</em></p>;
                })}</div>
                {groupPassed !== undefined ? <footer>Group result: {groupPassed ? "Success" : responses.length === request.targetUserIds.length ? "Failure" : "Pending"}</footer> : null}
                {bestPassed !== undefined ? <footer>Best result: {bestPassed ? "Success" : responses.length === request.targetUserIds.length ? "Failure" : "Pending"}</footer> : null}
                {request.status !== "open" ? <button type="button" className="dm-btn" onClick={() => void dmToolsApi.createRequest(campaign.campaign.id, { kind: request.kind, resolution: request.resolution, targetUserIds: request.targetUserIds, payload: request.payload }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not repeat request."))}>Request again</button> : null}
              </article>;
            })}
          </section> : null}
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
                  {item.reactionUsed ? <small>Reaction used</small> : null}{item.turnStatus ? <small>{item.turnStatus}</small> : null}
                  {item.conditions && item.conditions.length ? <span className="dm-condition-chips">{item.conditions.map((c) => <em key={c.id}>{c.label}{c.stack ? ` ${c.stack}` : ""}</em>)}</span> : null}
                </span>
                {displayHp ? <span className="dm-combatant-hp">HP <input aria-label={`${item.name} HP`} type="number" value={displayHp.current} onChange={(event) => {
                  if (!isPlayer) updateCombatant(item.id, { currentHp: Math.max(0, Number(event.target.value) || 0) });
                }} disabled={isPlayer} />/{displayHp.max}</span> : null}
                {displayAc !== undefined ? <small className="dm-combatant-ac">AC {displayAc}</small> : null}
                {!isPlayer ? <select className="dm-visibility" aria-label={`${item.name} player visibility`} value={item.visibility ?? (item.hidden ? "hidden" : "name-only")} onChange={(event) => updateCombatant(item.id, { visibility: event.target.value as CampaignCombatant["visibility"], hidden: event.target.value === "hidden" })}><option value="hidden">Hidden</option><option value="name-only">Name only</option><option value="name-and-conditions">Name + conditions</option><option value="approximate-health">Approximate health</option><option value="exact-hp">Exact HP</option><option value="full-public">Full public</option></select> : null}
                <div className="dm-turn-actions"><button type="button" className="dm-icon-btn" aria-label={`Jump to ${item.name}`} onClick={() => void onInitiativeUpdate({ ...campaign.initiative.data, turnIndex: sortedCombatants.findIndex((row) => row.id === item.id) }, campaign.initiative.version)}>Turn</button><button type="button" className={`dm-icon-btn${item.reactionUsed ? " is-active" : ""}`} aria-label={`Toggle ${item.name} reaction`} onClick={() => updateCombatant(item.id, { reactionUsed: !item.reactionUsed })}>R</button><button type="button" className="dm-icon-btn" aria-label={`Delay ${item.name}`} onClick={() => updateCombatant(item.id, { turnStatus: item.turnStatus === "delayed" ? undefined : "delayed" })}>Delay</button><button type="button" className="dm-icon-btn" aria-label={`Ready ${item.name}`} onClick={() => updateCombatant(item.id, { turnStatus: item.turnStatus === "readied" ? undefined : "readied" })}>Ready</button><button type="button" className="dm-icon-btn" aria-label={`Move ${item.name} earlier`} onClick={() => updateCombatant(item.id, { initiative: item.initiative + 1 })}>↑</button><button type="button" className="dm-icon-btn" aria-label={`Move ${item.name} later`} onClick={() => updateCombatant(item.id, { initiative: item.initiative - 1 })}>↓</button>{!isPlayer ? <><button type="button" className="dm-icon-btn" aria-label={`Reroll ${item.name} initiative`} onClick={() => updateCombatant(item.id, { initiative: Math.floor(Math.random() * 20) + 1 })}>↻</button><button type="button" className="dm-icon-btn" aria-label={`Duplicate ${item.name}`} onClick={() => void replaceInitiative([...campaign.initiative.data.combatants, { ...item, id: crypto.randomUUID(), name: `${item.name} copy` }])}>Copy</button></> : null}</div>
                <button type="button" className="dm-icon-btn" aria-label={`Remove ${item.name}`} onClick={() => void replaceInitiative(campaign.initiative.data.combatants.filter((row) => row.id !== item.id))}><Trash2 size={13} /></button>
              </div>
            )})}
            {sortedCombatants.length === 0 ? <p className="dm-empty">No combatants yet — add one below, or let the party roll in.</p> : null}
          </div>

          {/* The toolkit: one row of commands, one open form at a time. */}
          <div className="dm-command-row">
            {([["announce", "Announce"], ["roll", "Request a roll"], ["condition", "Condition"], ["handout", "Handout"], ["loot", "Loot"], ["combatant", "Add combatant"]] as const).map(([id, label]) => (
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
            <button type="button" className="dm-btn" onClick={() => void callRest("rest-short")}>Short rest</button>
            <button type="button" className="dm-btn" onClick={() => void callRest("rest-long")}>Long rest</button>
          </div>

          {activeCommand === "announce" ? (
            <div className="dm-inline-form">
              <input placeholder="Write an announcement" value={announcement} onChange={(event) => setAnnouncement(event.target.value)} />
              <button type="button" className="dm-btn dm-btn-primary" disabled={!announcement.trim()} onClick={() => { if (announcement.trim()) void onPostEvent("announce", { message: announcement.trim() }).then(() => { setAnnouncement(""); setActiveCommand(null); }); }}><Send size={14} /> Announce</button>
            </div>
          ) : null}
          {activeCommand === "roll" ? (
            <div className="dm-inline-form">
              <div className="dm-roll-presets" aria-label="Roll presets">{ROLL_PRESETS.map(([label, kind, scope, key]) => <button key={label} type="button" className="dm-btn" onClick={() => { setRollKind(kind); setCheckScope(scope); setRollKey(key); }}>{label}</button>)}</div>
              <input placeholder="Ask for a roll" value={rollRequest} onChange={(event) => setRollRequest(event.target.value)} />
              <select aria-label="Roll type" value={rollKind} onChange={(event) => { const kind = event.target.value as typeof rollKind; setRollKind(kind); setCheckScope("ability"); setRollKey("dexterity"); }}><option value="check">Check</option><option value="save">Save</option><option value="initiative">Initiative</option></select>
              <select aria-label="Roll target" value={rollTarget} onChange={(event) => setRollTarget(event.target.value)}><option value="all">All players</option><option value="selected">Selected players</option><option value="except">Everyone except selected</option>{players.map((member) => <option key={member.userId} value={member.userId}>{member.characterName ?? member.userName}</option>)}</select>
              <select aria-label="Resolution mode" value={rollResolution} onChange={(event) => setRollResolution(event.target.value as typeof rollResolution)}><option value="individual">Individual</option><option value="group">Group check</option><option value="best">Best result</option></select>
              {rollTarget === "selected" || rollTarget === "except" ? <fieldset className="dm-target-picker"><legend>Choose players</legend>{players.map((member) => <label key={member.userId}><input type="checkbox" checked={rollSelectedTargets.includes(member.userId)} onChange={(event) => setRollSelectedTargets((current) => event.target.checked ? [...new Set([...current, member.userId])] : current.filter((id) => id !== member.userId))} />{member.characterName ?? member.userName}</label>)}</fieldset> : null}
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
              <select aria-label="Advantage" value={rollAdvantage} onChange={(event) => setRollAdvantage(event.target.value as typeof rollAdvantage)}>
                <option value="normal">Straight roll</option>
                <option value="advantage">Advantage</option>
                <option value="disadvantage">Disadvantage</option>
              </select>
              {rollKind !== "initiative" ? <input placeholder="DC" type="number" value={rollDc} onChange={(event) => setRollDc(event.target.value)} /> : null}
              {rollKind !== "initiative" && rollDc.trim() ? (
                <label className="dm-inline-check"><input type="checkbox" checked={rollRevealDc} onChange={(event) => setRollRevealDc(event.target.checked)} /> Show DC to players</label>
              ) : null}
              <button type="button" className="dm-btn dm-btn-primary" onClick={() => void requestRoll().then(() => setActiveCommand(null))}>Request roll</button>
            </div>
          ) : null}
          {activeCommand === "condition" ? (
            <div className="dm-inline-form">
              <select value={conditionTarget} onChange={(event) => setConditionTarget(event.target.value)}><option value="">Target player</option>{players.map((member) => <option key={member.userId} value={member.userId}>{member.characterName ?? member.userName}</option>)}</select>
              {conditionIsCustom ? (
                <input placeholder="Condition name" aria-label="Condition name" value={customCondition.label ?? ""} onChange={(event) => setCustomCondition({ ...customCondition, label: event.target.value })} maxLength={48} />
              ) : (
                <select aria-label="Condition" value={conditionLabel} onChange={(event) => {
                  const value = event.target.value;
                  if (value === "__custom__") { setConditionIsCustom(true); setCustomCondition({}); }
                  else setConditionLabel(value);
                }}>
                  {CONDITION_PRESETS.map((preset) => <option key={preset.label} value={preset.label}>{preset.label}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
              )}
              <button type="button" className="dm-btn dm-btn-primary" onClick={() => void applyCondition("condition-apply")} disabled={!conditionTarget || (conditionIsCustom ? !(customCondition.label ?? "").trim() : !conditionLabel.trim())}>Apply</button>
              <button type="button" className="dm-btn" onClick={() => void applyCondition("condition-remove")} disabled={!conditionTarget || (conditionIsCustom ? !(customCondition.label ?? "").trim() : !conditionLabel.trim())}>Remove</button>
              {conditionIsCustom ? (
                <div className="dm-custom-condition-form">
                  <div className="dm-custom-condition-row">
                    <select aria-label="Advantage mode" value={customCondition.advantageMode ?? "none"} onChange={(event) => setCustomCondition({ ...customCondition, advantageMode: event.target.value })}>
                      <option value="none">Normal</option>
                      <option value="advantage">Advantage</option>
                      <option value="disadvantage">Disadvantage</option>
                    </select>
                    <input aria-label="Exhaustion level" type="number" min="1" max="6" placeholder="Stack 1-6" value={customCondition.stack ?? ""} onChange={(event) => setCustomCondition({ ...customCondition, stack: event.target.value })} />
                    <button type="button" className="dm-btn" onClick={() => { setConditionIsCustom(false); setCustomCondition({}); }}>↩ Presets</button>
                  </div>
                  <div className="dm-custom-condition-nums">
                    {EFFECT_NUMERIC_FIELDS.map((field) => (
                      <label key={field.key}><span>{field.label}</span><input type="number" min={-20} max={20} value={customCondition[field.key] ?? ""} onChange={(event) => setCustomCondition({ ...customCondition, [field.key]: event.target.value })} /></label>
                    ))}
                  </div>
                  <div className="dm-custom-condition-extra">
                    <label><span>d20 dice</span><input placeholder="1d4" value={customCondition.d20Dice ?? ""} onChange={(event) => setCustomCondition({ ...customCondition, d20Dice: event.target.value })} maxLength={6} /></label>
                    <label><span>Sense</span><input placeholder="Darkvision 60 ft." value={customCondition.sense ?? ""} onChange={(event) => setCustomCondition({ ...customCondition, sense: event.target.value })} maxLength={48} /></label>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {activeCommand === "handout" ? (
            <div className="dm-inline-form">
              <input placeholder="Handout title" value={handoutTitle} onChange={(event) => setHandoutTitle(event.target.value)} />
              <input placeholder="Image URL" value={handoutUrl} onChange={(event) => setHandoutUrl(event.target.value)} />
              <button type="button" className="dm-btn dm-btn-primary" disabled={!handoutTitle.trim() || !handoutUrl.trim()} onClick={() => { if (handoutTitle.trim() && handoutUrl.trim()) void onPostEvent("handout", { title: handoutTitle.trim(), url: handoutUrl.trim() }).then(() => { setHandoutTitle(""); setHandoutUrl(""); setActiveCommand(null); }); }}><Send size={14} /> Share a handout</button>
            </div>
          ) : null}
          {activeCommand === "loot" ? <div className="dm-loot-manager"><div className="dm-inline-form"><input placeholder="Parcel label" value={lootDraft.label} onChange={(event)=>setLootDraft({...lootDraft,label:event.target.value})}/><input placeholder="Item name" value={lootDraft.item} onChange={(event)=>setLootDraft({...lootDraft,item:event.target.value})}/><input aria-label="Quantity" type="number" min="1" max="99" value={lootDraft.quantity} onChange={(event)=>setLootDraft({...lootDraft,quantity:event.target.value})}/><select aria-label="Offer loot to" value={lootDraft.targetUserId} onChange={(event)=>setLootDraft({...lootDraft,targetUserId:event.target.value})}><option value="">Leave unclaimed</option>{players.map((member)=><option key={member.userId} value={member.userId}>{member.characterName??member.userName}</option>)}</select><button type="button" className="dm-btn dm-btn-primary" onClick={createAndOfferLoot}>Create parcel</button></div>{lootParcels.filter((parcel)=>parcel.status!=="resolved").map((parcel)=><article key={parcel.id}><strong>{parcel.label}</strong>{parcel.items.map((item)=><p key={item.id}>{item.name} ×{item.quantity} <em>{item.status}{item.assignedUserId?` → ${campaign.members.find((member)=>member.userId===item.assignedUserId)?.characterName??"player"}`:""}</em></p>)}</article>)}</div> : null}
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
          </>
          )}
        </section>
        <CharacterInspector
          member={selectedMember}
          notes={characterNotes}
          history={records.filter((record) => !selectedMember?.characterName || record.text.toLowerCase().includes(selectedMember.characterName.toLowerCase())).slice(0, 12).map((record) => ({ id: record.id, summary: record.text, createdAt: record.at }))}
          onOpenSheet={(member) => { if (member.characterJson) onOpenSheet(member.characterJson); }}
          onRequestRoll={(member) => { setRollTarget(member.userId); setWorkspaceMode("encounter"); setActiveCommand("roll"); }}
          onCreateNote={async (member, input) => {
            if (!member.characterId) return false;
            try {
              const result = await dmToolsApi.createCharacterNote(campaign.campaign.id, { ...input, characterId: member.characterId });
              setCharacterNotes((current) => [result.note, ...current]);
              return true;
            } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create character note."); return false; }
          }}
          onCharacterAction={(member, action, amount) => {
            if (action === "concentration-check") {
              const damage = Math.max(0, Math.floor(amount ?? 0));
              const dc = Math.max(10, Math.floor(damage / 2));
              void dmToolsApi.createRequest(campaign.campaign.id, { kind: "roll", resolution: "individual", targetUserIds: [member.userId], payload: { prompt: `${member.characterName ?? member.userName} took ${damage} damage while concentrating on ${member.concentratingOn}`, kind: "save", keyType: "ability", key: "constitution", dc } }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not request concentration check."));
              return;
            }
            if (action === "concentration-end") { void onPostEvent("concentration-end", {}, member.userId); return; }
            const deathAction = action === "heal" ? "heal" : action.replace("death-", "");
            void onPostEvent("death-save-update", { action: deathAction, ...(action === "heal" ? { amount: Math.max(1, Math.floor(amount ?? 1)) } : {}) }, member.userId);
          }}
        />
      </div>
      <section className="dm-table-region dm-soundboard"><div><h3>The Soundboard</h3><small>{isPlaying ? `Now playing: ${campaign.audio.title}` : "The table is quiet. Add a track…"}</small></div><div className="dm-track-list">{tracks.map((track) => <div key={track.id} className={isPlaying === track.id ? "is-playing" : ""}><span>{track.kind === "music" ? <Music2 size={15}/> : <Volume2 size={15}/>}<strong>{track.title}</strong>{isPlaying === track.id ? <em className="dm-nowplaying">Now playing</em> : <small>{track.kind}</small>}</span>{track.kind === "music" ? <button type="button" className={`dm-btn${isPlaying === track.id ? " is-active" : ""}`} onClick={() => void toggleMusic(isPlaying === track.id ? null : track.id)}>{isPlaying === track.id ? <><Pause size={14}/> Stop</> : <><Play size={14}/> Play</>}</button> : <button type="button" className="dm-btn" onClick={() => void onPostEvent("audio-cue", { url: track.url, title: track.title })}><Play size={14}/> Cue</button>}<button type="button" className="dm-icon-btn" aria-label={`Delete ${track.title}`} onClick={() => void deleteCampaignTrack(campaign.campaign.id, track.id).then(() => setTracks((current) => current.filter((item) => item.id !== track.id)))}><Trash2 size={13}/></button></div>)}</div><div className="dm-inline-form"><input placeholder="Track title" value={trackTitle} onChange={(event) => setTrackTitle(event.target.value)}/><input placeholder="Direct audio URL" value={trackUrl} onChange={(event) => setTrackUrl(event.target.value)}/><select value={trackKind} onChange={(event) => setTrackKind(event.target.value as "music" | "cue")}><option value="music">Music</option><option value="cue">Cue</option></select><button type="button" className="dm-btn dm-btn-primary" onClick={addTrack} disabled={!trackTitle.trim() || !trackUrl.trim()}><Plus size={14}/> Add track</button></div></section>
      {prepOpen ? <DMPrepPanel campaignId={campaign.campaign.id} onClose={() => { setPrepOpen(false); void refreshWorkspace(); }} onEncounterStarted={() => void refreshWorkspace()}/> : null}
    </section>
  );
});
