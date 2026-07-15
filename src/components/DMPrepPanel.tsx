"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, CalendarDays, Clock3, Copy, Dices, Library, MapPin, Play, Plus, Save, Send, Swords, X } from "lucide-react";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import type {
  CampaignHandout,
  CampaignJournalEntry,
  CampaignSession,
  CreatureLibraryRecord,
  EncounterCombatantTemplate,
  EncounterReminder,
  SavedEncounter,
  SessionSummary,
} from "@/types/dmTools";

type Tab = "creatures" | "encounters" | "generator" | "handouts" | "journal" | "sessions";
type ScheduleMode = "single" | "series";
type Props = { campaignId: string; onClose: () => void; onEncounterStarted: () => void; initialTab?: Tab };
const uid = () => crypto.randomUUID();
const emptyEncounter = (campaignId: string): SavedEncounter => ({
  id: "",
  campaignId,
  ownerUserId: "",
  name: "",
  status: "draft",
  origin: "manual",
  difficulty: "medium",
  combatants: [],
  waves: [],
  reminders: [],
  handoutIds: [],
  createdAt: "",
  updatedAt: "",
});
const blankCreature = {
  name: "",
  kind: "custom",
  source: "Custom",
  creatureType: "humanoid",
  size: "Medium",
  challengeRating: "0",
  experienceValue: "0",
  armorClass: "10",
  averageHp: "1",
  hpFormula: "",
  speed: "30 ft.",
  environments: "",
  tags: "",
  traits: "",
  actions: "",
  reactions: "",
  tacticsNotes: "",
  privateNotes: "",
  portraitUrl: "",
};
type CreatureDraft = typeof blankCreature;
const lines = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
const features = (value: string) =>
  lines(value).map((line) => {
    const [name, description, damage] = line.split("|").map((item) => item?.trim());
    return { name: name || "Feature", description: description || "", ...(damage ? { damage } : {}) };
  });
const featureText = (value?: CreatureLibraryRecord["actions"]) =>
  value?.map((item) => [item.name, item.description, item.damage].filter(Boolean).join(" | ")).join("\n") ?? "";

export default function DMPrepPanel({ campaignId, onClose, onEncounterStarted, initialTab = "encounters" }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [creatures, setCreatures] = useState<CreatureLibraryRecord[]>([]),
    [encounters, setEncounters] = useState<SavedEncounter[]>([]),
    [handouts, setHandouts] = useState<CampaignHandout[]>([]),
    [journal, setJournal] = useState<CampaignJournalEntry[]>([]),
    [sessions, setSessions] = useState<CampaignSession[]>([]);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [creatureDraft, setCreatureDraft] = useState<CreatureDraft>(blankCreature),
    [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);
  const [encounterDraft, setEncounterDraft] = useState<SavedEncounter | null>(null),
    [reminderLabel, setReminderLabel] = useState(""),
    [reminderRound, setReminderRound] = useState("2");
  const [generator, setGenerator] = useState({
    seed: "forge-session",
    difficulty: "medium",
    environment: "forest",
    encounterType: "",
    length: "standard",
    reinforcements: false,
  });
  const [handoutDraft, setHandoutDraft] = useState({
    title: "",
    category: "other",
    assetType: "image",
    assetUrl: "",
    body: "",
    description: "",
    privateNotes: "",
    tags: "",
  });
  const [journalDraft, setJournalDraft] = useState({
    title: "",
    type: "freeform",
    body: "",
    tags: "",
    visibility: "dm-private",
    status: "active",
  });
  const [sessionTitle, setSessionTitle] = useState(""),
    [scheduledAt, setScheduledAt] = useState(""),
    [scheduledDuration, setScheduledDuration] = useState("180"),
    [scheduledLocation, setScheduledLocation] = useState("The Table · online"),
    [scheduleMode, setScheduleMode] = useState<ScheduleMode>("single"),
    [repeatEveryWeeks, setRepeatEveryWeeks] = useState("1"),
    [seriesCount, setSeriesCount] = useState("6"),
    [summarySession, setSummarySession] = useState<CampaignSession | null>(null),
    [summary, setSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      dmToolsApi.listCreatures(campaignId),
      dmToolsApi.listEncounters(campaignId),
      dmToolsApi.listHandouts(campaignId),
      dmToolsApi.listJournal(campaignId),
      dmToolsApi.listSessions(campaignId),
    ])
      .then(([c, e, h, j, s]) => {
        if (cancelled) return;
        setCreatures(c.creatures);
        setEncounters(e.encounters);
        setHandouts(h.handouts);
        setJournal(j.entries);
        setSessions(s.sessions);
        setStatus("");
      })
      .catch((error) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Preparation tools could not load.");
      });
    const saved = localStorage.getItem(`forge-dm-creature-draft:${campaignId}`);
    if (saved)
      queueMicrotask(() => {
        if (cancelled) return;
        try {
          setCreatureDraft({ ...blankCreature, ...JSON.parse(saved) });
        } catch {}
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);
  useEffect(() => {
    localStorage.setItem(`forge-dm-creature-draft:${campaignId}`, JSON.stringify(creatureDraft));
  }, [campaignId, creatureDraft]);

  const filteredCreatures = useMemo(
    () =>
      creatures.filter((item) =>
        `${item.name} ${item.creatureType ?? ""} ${item.tags.join(" ")}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [creatures, search],
  );
  const filteredEncounters = useMemo(
    () =>
      encounters.filter((item) =>
        `${item.name} ${item.environment ?? ""} ${item.difficulty ?? ""}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [encounters, search],
  );
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus("");
    try {
      await work();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };
  const creaturePayload = () => ({
    name: creatureDraft.name,
    kind: creatureDraft.kind,
    source: creatureDraft.source,
    creatureType: creatureDraft.creatureType,
    size: creatureDraft.size,
    challengeRating: Number(creatureDraft.challengeRating),
    experienceValue: Number(creatureDraft.experienceValue),
    armorClass: Number(creatureDraft.armorClass),
    hitPoints: { average: Number(creatureDraft.averageHp), formula: creatureDraft.hpFormula || undefined },
    speed: creatureDraft.speed,
    environments: lines(creatureDraft.environments.replaceAll(",", "\n")),
    tags: lines(creatureDraft.tags.replaceAll(",", "\n")),
    traits: features(creatureDraft.traits),
    actions: features(creatureDraft.actions),
    reactions: features(creatureDraft.reactions),
    tacticsNotes: creatureDraft.tacticsNotes,
    privateNotes: creatureDraft.privateNotes,
    portraitUrl: creatureDraft.portraitUrl,
  });
  const saveCreature = () =>
    run(async () => {
      const result = editingCreatureId
        ? await dmToolsApi.updateCreature(editingCreatureId, creaturePayload())
        : await dmToolsApi.createCreature(campaignId, creaturePayload());
      setCreatures((current) => [result.creature, ...current.filter((item) => item.id !== result.creature.id)]);
      setCreatureDraft(blankCreature);
      setEditingCreatureId(null);
      localStorage.removeItem(`forge-dm-creature-draft:${campaignId}`);
    });
  const editCreature = (creature: CreatureLibraryRecord) => {
    if (creature.kind === "built-in") return;
    setEditingCreatureId(creature.id);
    setCreatureDraft({
      name: creature.name,
      kind: creature.kind,
      source: creature.source ?? "",
      creatureType: creature.creatureType ?? "",
      size: creature.size ?? "",
      challengeRating: String(creature.challengeRating ?? 0),
      experienceValue: String(creature.experienceValue ?? 0),
      armorClass: String(creature.armorClass),
      averageHp: String(creature.hitPoints.average),
      hpFormula: creature.hitPoints.formula ?? "",
      speed: creature.speed ?? "",
      environments: creature.environments?.join(", ") ?? "",
      tags: creature.tags.join(", "),
      traits: featureText(creature.traits),
      actions: featureText(creature.actions),
      reactions: featureText(creature.reactions),
      tacticsNotes: creature.tacticsNotes ?? "",
      privateNotes: creature.privateNotes ?? "",
      portraitUrl: creature.portraitUrl ?? "",
    });
  };
  const addCreature = (creature: CreatureLibraryRecord) =>
    setEncounterDraft((current) => {
      const draft = current ?? emptyEncounter(campaignId);
      const existing = draft.combatants.find((item) => item.creatureId === creature.id);
      return {
        ...draft,
        combatants: existing
          ? draft.combatants.map((item) => (item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item))
          : [
              ...draft.combatants,
              {
                id: uid(),
                creatureId: creature.id,
                name: creature.name,
                quantity: 1,
                kind: "enemy",
                startingHpMode: "average",
                initiativeMode: "roll",
                hidden: false,
              },
            ],
      };
    });
  const saveEncounter = () =>
    encounterDraft &&
    run(async () => {
      const result = encounterDraft.id
        ? await dmToolsApi.updateEncounter(encounterDraft.id, encounterDraft)
        : await dmToolsApi.createEncounter(campaignId, encounterDraft);
      setEncounterDraft(result.encounter);
      setEncounters((current) => [result.encounter, ...current.filter((item) => item.id !== result.encounter.id)]);
      setStatus("Encounter saved.");
    });
  const startEncounter = (id: string) =>
    run(async () => {
      await dmToolsApi.startEncounter(id);
      onEncounterStarted();
      onClose();
    });
  const generate = () =>
    run(async () => {
      const result = await dmToolsApi.generateEncounter({
        campaignId,
        seed: generator.seed,
        difficulty: generator.difficulty,
        environment: generator.environment || undefined,
        encounterType: generator.encounterType || undefined,
        length: generator.length,
        reinforcements: generator.reinforcements,
      });
      setEncounterDraft(result.encounter);
      setTab("encounters");
      setStatus("Generated result is editable. Save it when ready.");
    });
  const createHandout = () =>
    run(async () => {
      const result = await dmToolsApi.createHandout(campaignId, {
        ...handoutDraft,
        tags: lines(handoutDraft.tags.replaceAll(",", "\n")),
      });
      setHandouts((current) => [result.handout, ...current]);
      setHandoutDraft({
        title: "",
        category: "other",
        assetType: "image",
        assetUrl: "",
        body: "",
        description: "",
        privateNotes: "",
        tags: "",
      });
    });
  const createJournal = () =>
    run(async () => {
      const result = await dmToolsApi.createJournal(campaignId, {
        ...journalDraft,
        tags: lines(journalDraft.tags.replaceAll(",", "\n")),
      });
      setJournal((current) => [result.entry, ...current]);
      setJournalDraft({ title: "", type: "freeform", body: "", tags: "", visibility: "dm-private", status: "active" });
    });
  const activeSession = sessions.find((item) => item.status === "active");
  const scheduledDates = () => {
    if (!scheduledAt) throw new Error("Choose a date and time for the session.");
    const first = new Date(scheduledAt);
    if (Number.isNaN(first.getTime())) throw new Error("Choose a valid date and time for the session.");
    const count = scheduleMode === "series" ? Number(seriesCount) : 1;
    const interval = scheduleMode === "series" ? Number(repeatEveryWeeks) : 1;
    if (scheduleMode === "series" && (!Number.isInteger(count) || count < 2 || count > 24)) throw new Error("Choose between 2 and 24 sessions.");
    if (scheduleMode === "series" && (!Number.isInteger(interval) || interval < 1 || interval > 12)) throw new Error("Repeat interval must be between 1 and 12 weeks.");
    return Array.from({ length: count }, (_, index) => {
      const occurrence = new Date(first);
      occurrence.setDate(occurrence.getDate() + index * interval * 7);
      return occurrence.toISOString();
    });
  };
  const scheduleNextSession = () =>
    void run(async () => {
      const input = { title: sessionTitle, durationMinutes: Number(scheduledDuration), location: scheduledLocation };
      const dates = scheduledDates();
      if (scheduleMode === "series") {
        const result = await dmToolsApi.scheduleSessions(campaignId, { ...input, scheduledAts: dates });
        setSessions((current) => [...result.sessions, ...current]);
        setStatus(`${result.sessions.length} sessions scheduled.`);
      } else {
        const result = await dmToolsApi.scheduleSession(campaignId, { ...input, scheduledAt: dates[0] });
        setSessions((current) => [result.session, ...current]);
        setStatus("Next session scheduled.");
      }
      setSessionTitle("");
      setScheduledAt("");
    });
  const endActiveSession = () =>
    activeSession &&
    run(async () => {
      if (!window.confirm("End this session and prepare its summary draft?")) return;
      const result = await dmToolsApi.endSession(campaignId, activeSession.id);
      setSessions((current) => current.map((item) => (item.id === result.session.id ? result.session : item)));
      setSummarySession(result.session);
      setSummary(result.session.summaryDraft ?? null);
      setStatus("Session ended. Review the summary draft below.");
    });
  const updateSummaryList = (key: keyof SessionSummary, value: string) =>
    summary && setSummary({ ...summary, [key]: lines(value) } as SessionSummary);

  return (
    <div className="dm-prep-scrim" role="presentation">
      <section className="dm-prep" role="dialog" aria-modal="true" aria-label="DM preparation tools">
        <header>
          <div>
            <span>Campaign workshop</span>
            <h2>Prepare the session</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close preparation tools">
            <X />
          </button>
        </header>
        <div className="dm-prep-body">
          <nav className="dm-prep-rail" aria-label="Preparation sections">
            <span className="dm-prep-rail-label">Sections</span>
            {(
              [
                ["creatures", "Creatures", Library],
                ["encounters", "Encounters", Swords],
                ["generator", "Generator", Dices],
                ["handouts", "Handouts", Send],
                ["journal", "Journal", BookOpen],
                ["sessions", "Sessions", Play],
              ] as const
            ).map(([id, label, Icon]) => (
              <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
          <div className="dm-prep-content">
            {status ? (
              <p className="dm-prep-status" role="status">
                {status}
              </p>
            ) : null}
            <main>
              {tab === "creatures" ? (
            <div className="dm-prep-split">
              <section>
                <div className="dm-prep-toolbar">
                  <input
                    aria-label="Search creatures"
                    placeholder="Search creatures"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span>{filteredCreatures.length} records</span>
                </div>
                <div className="dm-library-list">
                  {filteredCreatures.map((creature) => (
                    <article key={creature.id}>
                      <div>
                        <strong>{creature.name}</strong>
                        <small>
                          CR {creature.challengeRating ?? "—"} · {creature.creatureType ?? "creature"} · AC{" "}
                          {creature.armorClass} · HP {creature.hitPoints.average}
                        </small>
                        <em>{creature.kind === "built-in" ? "Built-in" : creature.kind}</em>
                      </div>
                      <button onClick={() => addCreature(creature)}>Add</button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await dmToolsApi.duplicateCreature(creature.id, campaignId);
                            setCreatures((current) => [result.creature, ...current]);
                            editCreature(result.creature);
                          })
                        }
                      >
                        <Copy size={13} />
                      </button>
                      {creature.kind !== "built-in" ? (
                        <>
                          <button onClick={() => editCreature(creature)}>Edit</button>
                          <button
                            onClick={() => {
                              if (confirm(`Archive ${creature.name}?`))
                                void run(async () => {
                                  await dmToolsApi.archiveCreature(creature.id);
                                  setCreatures((current) => current.filter((item) => item.id !== creature.id));
                                });
                            }}
                          >
                            <Archive size={13} />
                          </button>
                        </>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
              <section className="dm-editor">
                <h3>{editingCreatureId ? "Edit custom creature" : "New custom creature"}</h3>
                <details open>
                  <summary>Identity</summary>
                  <label>
                    Name
                    <input
                      value={creatureDraft.name}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, name: e.target.value })}
                    />
                  </label>
                  <div className="dm-form-row">
                    <label>
                      Kind
                      <select
                        value={creatureDraft.kind}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, kind: e.target.value })}
                      >
                        <option value="custom">Custom creature</option>
                        <option value="named-npc">Named NPC</option>
                        <option value="template">NPC template</option>
                        <option value="hazard">Hazard</option>
                        <option value="summon">Summon</option>
                      </select>
                    </label>
                    <label>
                      Type
                      <input
                        value={creatureDraft.creatureType}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, creatureType: e.target.value })}
                      />
                    </label>
                    <label>
                      Size
                      <input
                        value={creatureDraft.size}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, size: e.target.value })}
                      />
                    </label>
                  </div>
                </details>
                <details open>
                  <summary>Defense</summary>
                  <div className="dm-form-row">
                    <label>
                      CR
                      <input
                        type="number"
                        step="0.125"
                        value={creatureDraft.challengeRating}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, challengeRating: e.target.value })}
                      />
                    </label>
                    <label>
                      XP
                      <input
                        type="number"
                        value={creatureDraft.experienceValue}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, experienceValue: e.target.value })}
                      />
                    </label>
                    <label>
                      AC
                      <input
                        type="number"
                        value={creatureDraft.armorClass}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, armorClass: e.target.value })}
                      />
                    </label>
                    <label>
                      Average HP
                      <input
                        type="number"
                        value={creatureDraft.averageHp}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, averageHp: e.target.value })}
                      />
                    </label>
                    <label>
                      HP formula
                      <input
                        value={creatureDraft.hpFormula}
                        onChange={(e) => setCreatureDraft({ ...creatureDraft, hpFormula: e.target.value })}
                      />
                    </label>
                  </div>
                </details>
                <details>
                  <summary>Movement and senses</summary>
                  <label>
                    Speed
                    <input
                      value={creatureDraft.speed}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, speed: e.target.value })}
                    />
                  </label>
                </details>
                <details>
                  <summary>Traits and actions</summary>
                  <p>One per line: Name | Description | Damage</p>
                  <label>
                    Traits
                    <textarea
                      value={creatureDraft.traits}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, traits: e.target.value })}
                    />
                  </label>
                  <label>
                    Actions
                    <textarea
                      value={creatureDraft.actions}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, actions: e.target.value })}
                    />
                  </label>
                  <label>
                    Reactions
                    <textarea
                      value={creatureDraft.reactions}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, reactions: e.target.value })}
                    />
                  </label>
                </details>
                <details>
                  <summary>DM notes, tags and source</summary>
                  <label>
                    Tactics
                    <textarea
                      value={creatureDraft.tacticsNotes}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, tacticsNotes: e.target.value })}
                    />
                  </label>
                  <label>
                    Private notes
                    <textarea
                      value={creatureDraft.privateNotes}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, privateNotes: e.target.value })}
                    />
                  </label>
                  <label>
                    Environments
                    <input
                      value={creatureDraft.environments}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, environments: e.target.value })}
                    />
                  </label>
                  <label>
                    Tags
                    <input
                      value={creatureDraft.tags}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, tags: e.target.value })}
                    />
                  </label>
                  <label>
                    Source
                    <input
                      value={creatureDraft.source}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, source: e.target.value })}
                    />
                  </label>
                  <label>
                    Portrait URL
                    <input
                      value={creatureDraft.portraitUrl}
                      onChange={(e) => setCreatureDraft({ ...creatureDraft, portraitUrl: e.target.value })}
                    />
                  </label>
                </details>
                <button className="primary" disabled={busy || !creatureDraft.name} onClick={saveCreature}>
                  <Save size={14} />
                  Save creature
                </button>
              </section>
            </div>
          ) : null}
          {tab === "encounters" ? (
            <div className="dm-prep-split">
              <section>
                <div className="dm-prep-toolbar">
                  <input
                    aria-label="Search encounters"
                    placeholder="Search encounters"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button className="primary" onClick={() => setEncounterDraft(emptyEncounter(campaignId))}>
                    <Plus size={14} />
                    New
                  </button>
                </div>
                <div className="dm-library-list">
                  {filteredEncounters.map((encounter) => (
                    <article key={encounter.id}>
                      <div>
                        <strong>{encounter.name}</strong>
                        <small>
                          {encounter.difficulty ?? "custom"} · {encounter.environment ?? "anywhere"} ·{" "}
                          {encounter.combatants.reduce((sum, item) => sum + item.quantity, 0)} combatants
                        </small>
                        <em>
                          {encounter.origin} · {encounter.status}
                        </em>
                      </div>
                      <button onClick={() => setEncounterDraft(encounter)}>Edit</button>
                      <button onClick={() => void startEncounter(encounter.id)}>
                        <Play size={13} />
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await dmToolsApi.duplicateEncounter(encounter.id);
                            setEncounters((current) => [result.encounter, ...current]);
                            setEncounterDraft(result.encounter);
                          })
                        }
                      >
                        <Copy size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="dm-editor">
                {encounterDraft ? (
                  <>
                    <h3>{encounterDraft.id ? "Edit encounter" : "Build encounter"}</h3>
                    <details open>
                      <summary>Overview</summary>
                      <label>
                        Name
                        <input
                          value={encounterDraft.name}
                          onChange={(e) => setEncounterDraft({ ...encounterDraft, name: e.target.value })}
                        />
                      </label>
                      <div className="dm-form-row">
                        <label>
                          Environment
                          <input
                            value={encounterDraft.environment ?? ""}
                            onChange={(e) => setEncounterDraft({ ...encounterDraft, environment: e.target.value })}
                          />
                        </label>
                        <label>
                          Type
                          <input
                            value={encounterDraft.encounterType ?? ""}
                            onChange={(e) => setEncounterDraft({ ...encounterDraft, encounterType: e.target.value })}
                          />
                        </label>
                        <label>
                          Difficulty
                          <select
                            value={encounterDraft.difficulty}
                            onChange={(e) =>
                              setEncounterDraft({
                                ...encounterDraft,
                                difficulty: e.target.value as SavedEncounter["difficulty"],
                              })
                            }
                          >
                            {["easy", "medium", "hard", "deadly", "custom"].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        Objective
                        <textarea
                          value={encounterDraft.objective ?? ""}
                          onChange={(e) => setEncounterDraft({ ...encounterDraft, objective: e.target.value })}
                        />
                      </label>
                    </details>
                    <details open>
                      <summary>Combatants</summary>
                      <div className="dm-combatant-templates">
                        {encounterDraft.combatants.map((item) => (
                          <div key={item.id}>
                            <input
                              aria-label="Combatant name"
                              value={item.name}
                              onChange={(e) =>
                                setEncounterDraft({
                                  ...encounterDraft,
                                  combatants: encounterDraft.combatants.map((row) =>
                                    row.id === item.id ? { ...row, name: e.target.value } : row,
                                  ),
                                })
                              }
                            />
                            <input
                              aria-label="Quantity"
                              type="number"
                              min="1"
                              max="50"
                              value={item.quantity}
                              onChange={(e) =>
                                setEncounterDraft({
                                  ...encounterDraft,
                                  combatants: encounterDraft.combatants.map((row) =>
                                    row.id === item.id ? { ...row, quantity: Number(e.target.value) } : row,
                                  ),
                                })
                              }
                            />
                            <select
                              aria-label="Starting HP"
                              value={item.startingHpMode}
                              onChange={(e) =>
                                setEncounterDraft({
                                  ...encounterDraft,
                                  combatants: encounterDraft.combatants.map((row) =>
                                    row.id === item.id
                                      ? {
                                          ...row,
                                          startingHpMode: e.target
                                            .value as EncounterCombatantTemplate["startingHpMode"],
                                        }
                                      : row,
                                  ),
                                })
                              }
                            >
                              <option value="average">Average HP</option>
                              <option value="roll">Roll HP</option>
                              <option value="custom">Custom HP</option>
                            </select>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.hidden}
                                onChange={(e) =>
                                  setEncounterDraft({
                                    ...encounterDraft,
                                    combatants: encounterDraft.combatants.map((row) =>
                                      row.id === item.id ? { ...row, hidden: e.target.checked } : row,
                                    ),
                                  })
                                }
                              />
                              Hidden
                            </label>
                            <button
                              aria-label={`Remove ${item.name}`}
                              onClick={() =>
                                setEncounterDraft({
                                  ...encounterDraft,
                                  combatants: encounterDraft.combatants.filter((row) => row.id !== item.id),
                                })
                              }
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() =>
                          setEncounterDraft({
                            ...encounterDraft,
                            combatants: [
                              ...encounterDraft.combatants,
                              {
                                id: uid(),
                                name: "One-off NPC",
                                quantity: 1,
                                kind: "enemy",
                                startingHpMode: "custom",
                                customStartingHp: 10,
                                initiativeMode: "roll",
                                hidden: false,
                              },
                            ],
                          })
                        }
                      >
                        Add one-off NPC
                      </button>
                      <button onClick={() => setTab("creatures")}>Add from library</button>
                    </details>
                    <details>
                      <summary>Scene notes</summary>
                      {(
                        [
                          ["readAloud", "Read aloud"],
                          ["tactics", "Tactics"],
                          ["environmentNotes", "Environment"],
                          ["developments", "Developments"],
                          ["loot", "Loot"],
                          ["privateNotes", "Private notes"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <textarea
                            value={encounterDraft[key] ?? ""}
                            onChange={(e) => setEncounterDraft({ ...encounterDraft, [key]: e.target.value })}
                          />
                        </label>
                      ))}
                    </details>
                    <details>
                      <summary>Reminders</summary>
                      <div className="dm-form-row">
                        <label>
                          Reminder
                          <input value={reminderLabel} onChange={(e) => setReminderLabel(e.target.value)} />
                        </label>
                        <label>
                          Round
                          <input
                            type="number"
                            min="1"
                            value={reminderRound}
                            onChange={(e) => setReminderRound(e.target.value)}
                          />
                        </label>
                        <button
                          disabled={!reminderLabel}
                          onClick={() => {
                            const reminder: EncounterReminder = {
                              id: uid(),
                              label: reminderLabel,
                              trigger: { type: "round-start", round: Number(reminderRound) },
                              repeat: false,
                              completed: false,
                            };
                            setEncounterDraft({
                              ...encounterDraft,
                              reminders: [...encounterDraft.reminders, reminder],
                            });
                            setReminderLabel("");
                          }}
                        >
                          Add
                        </button>
                      </div>
                      {encounterDraft.reminders.map((item) => (
                        <p key={item.id}>
                          {item.label} · {item.trigger.type}
                        </p>
                      ))}
                    </details>
                    <details>
                      <summary>Handouts</summary>
                      {handouts.map((handout) => (
                        <label key={handout.id}>
                          <input
                            type="checkbox"
                            checked={encounterDraft.handoutIds.includes(handout.id)}
                            onChange={(e) =>
                              setEncounterDraft({
                                ...encounterDraft,
                                handoutIds: e.target.checked
                                  ? [...encounterDraft.handoutIds, handout.id]
                                  : encounterDraft.handoutIds.filter((id) => id !== handout.id),
                              })
                            }
                          />
                          {handout.title}
                        </label>
                      ))}
                    </details>
                    {encounterDraft.generatedWarnings?.length ? (
                      <div className="dm-warnings">
                        <h4>Safety review</h4>
                        {encounterDraft.generatedWarnings.map((warning) => (
                          <p key={warning.code}>{warning.message}</p>
                        ))}
                      </div>
                    ) : null}
                    <div className="dm-editor-actions">
                      <button className="primary" disabled={busy || !encounterDraft.name} onClick={saveEncounter}>
                        <Save size={14} />
                        Save
                      </button>
                      {encounterDraft.id ? (
                        <button onClick={() => void startEncounter(encounterDraft.id)}>
                          <Play size={14} />
                          Start now
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="dm-empty">Choose an encounter or begin a new one.</p>
                )}
              </section>
            </div>
          ) : null}
          {tab === "generator" ? (
            <section className="dm-generator">
              <h3>Encounter generator</h3>
              <p>
                Builds a deterministic, editable encounter from the current campaign party and available creature
                library.
              </p>
              <div className="dm-form-grid">
                <label>
                  Seed
                  <input
                    value={generator.seed}
                    onChange={(e) => setGenerator({ ...generator, seed: e.target.value })}
                  />
                </label>
                <label>
                  Difficulty
                  <select
                    value={generator.difficulty}
                    onChange={(e) => setGenerator({ ...generator, difficulty: e.target.value })}
                  >
                    {["easy", "medium", "hard", "deadly"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Environment
                  <input
                    value={generator.environment}
                    onChange={(e) => setGenerator({ ...generator, environment: e.target.value })}
                  />
                </label>
                <label>
                  Encounter type
                  <select
                    value={generator.encounterType}
                    onChange={(e) => setGenerator({ ...generator, encounterType: e.target.value })}
                  >
                    <option value="">Choose for me</option>
                    {[
                      "straight-combat",
                      "ambush",
                      "hold-position",
                      "escape",
                      "rescue",
                      "stop-ritual",
                      "survive-rounds",
                      "retrieve-item",
                      "negotiation",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {v.replaceAll("-", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Length
                  <select
                    value={generator.length}
                    onChange={(e) => setGenerator({ ...generator, length: e.target.value })}
                  >
                    <option value="short">Short</option>
                    <option value="standard">Standard</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={generator.reinforcements}
                    onChange={(e) => setGenerator({ ...generator, reinforcements: e.target.checked })}
                  />
                  Reinforcement wave
                </label>
              </div>
              <button className="primary" disabled={busy || !generator.seed} onClick={generate}>
                <Dices size={15} />
                Generate editable encounter
              </button>
            </section>
          ) : null}
          {tab === "handouts" ? (
            <div className="dm-prep-split">
              <section>
                <h3>Reusable handouts</h3>
                <div className="dm-library-list">
                  {handouts.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.category} · {item.assetType}
                        </small>
                        <em>{item.shared ? `Shared ${item.shareCount}×` : "Not shared"}</em>
                      </div>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await dmToolsApi.shareHandout(campaignId, item.id);
                            setHandouts((current) => current.map((row) => (row.id === item.id ? result.handout : row)));
                          })
                        }
                      >
                        {item.shared ? "Re-share" : "Share"}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Archive ${item.title}?`))
                            void run(async () => {
                              await dmToolsApi.archiveHandout(campaignId, item.id);
                              setHandouts((current) => current.filter((row) => row.id !== item.id));
                            });
                        }}
                      >
                        <Archive size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="dm-editor">
                <h3>New handout</h3>
                <label>
                  Title
                  <input
                    value={handoutDraft.title}
                    onChange={(e) => setHandoutDraft({ ...handoutDraft, title: e.target.value })}
                  />
                </label>
                <div className="dm-form-row">
                  <label>
                    Category
                    <select
                      value={handoutDraft.category}
                      onChange={(e) => setHandoutDraft({ ...handoutDraft, category: e.target.value })}
                    >
                      {["location", "npc", "item", "letter", "clue", "map", "lore", "other"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Asset type
                    <select
                      value={handoutDraft.assetType}
                      onChange={(e) => setHandoutDraft({ ...handoutDraft, assetType: e.target.value })}
                    >
                      {["image", "document", "url", "text"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {handoutDraft.assetType === "text" ? (
                  <label>
                    Body
                    <textarea
                      value={handoutDraft.body}
                      onChange={(e) => setHandoutDraft({ ...handoutDraft, body: e.target.value })}
                    />
                  </label>
                ) : (
                  <label>
                    HTTPS asset URL
                    <input
                      value={handoutDraft.assetUrl}
                      onChange={(e) => setHandoutDraft({ ...handoutDraft, assetUrl: e.target.value })}
                    />
                  </label>
                )}
                <label>
                  Description
                  <textarea
                    value={handoutDraft.description}
                    onChange={(e) => setHandoutDraft({ ...handoutDraft, description: e.target.value })}
                  />
                </label>
                <label>
                  Private notes
                  <textarea
                    value={handoutDraft.privateNotes}
                    onChange={(e) => setHandoutDraft({ ...handoutDraft, privateNotes: e.target.value })}
                  />
                </label>
                <label>
                  Tags
                  <input
                    value={handoutDraft.tags}
                    onChange={(e) => setHandoutDraft({ ...handoutDraft, tags: e.target.value })}
                  />
                </label>
                <button className="primary" disabled={busy || !handoutDraft.title} onClick={createHandout}>
                  <Save size={14} />
                  Save handout
                </button>
              </section>
            </div>
          ) : null}
          {tab === "journal" ? (
            <div className="dm-prep-split">
              <section>
                <h3>Campaign journal</h3>
                <div className="dm-library-list">
                  {journal.map((item) => (
                    <article key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <small>
                          {item.type} · {item.visibility}
                        </small>
                        <p>{item.body.slice(0, 150)}</p>
                      </div>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await dmToolsApi.updateJournal(campaignId, item.id, {
                              visibility: item.visibility === "players" ? "dm-private" : "players",
                            });
                            setJournal((current) => current.map((row) => (row.id === item.id ? result.entry : row)));
                          })
                        }
                      >
                        {item.visibility === "players" ? "Make private" : "Publish"}
                      </button>
                      <button
                        onClick={() =>
                          void run(async () => {
                            const result = await dmToolsApi.updateJournal(campaignId, item.id, { status: "archived" });
                            setJournal((current) => current.map((row) => (row.id === item.id ? result.entry : row)));
                          })
                        }
                      >
                        <Archive size={13} />
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="dm-editor">
                <h3>New journal entry</h3>
                <label>
                  Title
                  <input
                    value={journalDraft.title}
                    onChange={(e) => setJournalDraft({ ...journalDraft, title: e.target.value })}
                  />
                </label>
                <div className="dm-form-row">
                  <label>
                    Type
                    <select
                      value={journalDraft.type}
                      onChange={(e) => setJournalDraft({ ...journalDraft, type: e.target.value })}
                    >
                      {["session", "location", "npc", "faction", "quest", "lore", "item", "freeform"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Visibility
                    <select
                      value={journalDraft.visibility}
                      onChange={(e) => setJournalDraft({ ...journalDraft, visibility: e.target.value })}
                    >
                      <option value="dm-private">DM private</option>
                      <option value="players">Players</option>
                    </select>
                  </label>
                </div>
                <label>
                  Body
                  <textarea
                    rows={12}
                    value={journalDraft.body}
                    onChange={(e) => setJournalDraft({ ...journalDraft, body: e.target.value })}
                  />
                </label>
                <label>
                  Tags
                  <input
                    value={journalDraft.tags}
                    onChange={(e) => setJournalDraft({ ...journalDraft, tags: e.target.value })}
                  />
                </label>
                <button className="primary" disabled={busy || !journalDraft.title} onClick={createJournal}>
                  <Save size={14} />
                  Save entry
                </button>
              </section>
            </div>
          ) : null}
          {tab === "sessions" ? (
            <section className="dm-sessions">
              <div className="dm-session-action">
                <div>
                  <h3>{activeSession ? activeSession.title : "No active session"}</h3>
                  <p>
                    {activeSession
                      ? `Started ${new Date(activeSession.startedAt).toLocaleString()}`
                      : "Start a session to group encounters, pins, and shared handouts."}
                  </p>
                </div>
                {activeSession ? (
                  <button className="primary dm-btn-danger" onClick={endActiveSession}>
                    End session
                  </button>
                ) : (
                  <>
                    <input
                      aria-label="Session title"
                      placeholder="Session title"
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                    />
                    <button
                      className="primary"
                      onClick={() =>
                        void run(async () => {
                          const result = await dmToolsApi.startSession(campaignId, { title: sessionTitle });
                          setSessions((current) => [result.session, ...current]);
                          setSessionTitle("");
                        })
                      }
                    >
                      Start session
                    </button>
                  </>
                )}
              </div>
              <section className="dm-session-scheduler" aria-labelledby="dm-session-scheduler-title">
                <header>
                  <div>
                    <span className="dm-prep-kicker"><CalendarDays size={13} /> Plan ahead</span>
                    <h3 id="dm-session-scheduler-title">Schedule the next session</h3>
                  </div>
                  <small>{Intl.DateTimeFormat().resolvedOptions().timeZone}</small>
                </header>
                <div className="dm-form-grid">
                  <label><span>Schedule type</span><select value={scheduleMode} onChange={(event) => setScheduleMode(event.target.value as ScheduleMode)}><option value="single">One session</option><option value="series">Recurring series</option></select></label>
                  <label><span>Title</span><input value={sessionTitle} onChange={(event) => setSessionTitle(event.target.value)} placeholder="Chapter IV" /></label>
                  <label><span>Date and time</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
                  <label><span>Duration</span><select value={scheduledDuration} onChange={(event) => setScheduledDuration(event.target.value)}><option value="60">1 hour</option><option value="120">2 hours</option><option value="180">3 hours</option><option value="240">4 hours</option></select></label>
                  <label><span>Location</span><input value={scheduledLocation} onChange={(event) => setScheduledLocation(event.target.value)} placeholder="The Table · online" /></label>
                  {scheduleMode === "series" ? <>
                    <label><span>Repeat every</span><select value={repeatEveryWeeks} onChange={(event) => setRepeatEveryWeeks(event.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "week" : "weeks"}</option>)}</select></label>
                    <label><span>Number of sessions</span><input type="number" min="2" max="24" value={seriesCount} onChange={(event) => setSeriesCount(event.target.value)} /></label>
                  </> : null}
                </div>
                {scheduleMode === "series" ? <p className="dm-session-series-note">Creates {seriesCount || "0"} sessions at the same local time, starting from the date above.</p> : null}
                <button className="primary" type="button" onClick={scheduleNextSession} disabled={busy || !scheduledAt}><CalendarDays size={14} /> {scheduleMode === "series" ? `Schedule ${seriesCount || "0"} sessions` : "Schedule session"}</button>
              </section>
              <div className="dm-library-list">
                {sessions.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.title ?? `Session ${item.number}`}</strong>
                      <small>
                        {item.status} · {new Date(item.scheduledAt ?? item.startedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                      </small>
                    </div>
                    {item.location ? <small><MapPin size={12} /> {item.location}</small> : null}
                    {item.durationMinutes ? <small><Clock3 size={12} /> {Math.round(item.durationMinutes / 60)}h</small> : null}
                    {item.status === "scheduled" ? <button className="primary" type="button" onClick={() => void run(async () => { const result = await dmToolsApi.activateSession(campaignId, item.id); setSessions((current) => current.map((session) => session.id === item.id ? result.session : session)); })}>Start now</button> : null}
                    {item.summaryDraft ? (
                      <button
                        onClick={() => {
                          setSummarySession(item);
                          setSummary(item.summaryDraft ?? null);
                        }}
                      >
                        Review summary
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
              {summary && summarySession ? (
                <div className="dm-summary">
                  <h3>Session summary review</h3>
                  <label>
                    Title
                    <input value={summary.title} onChange={(e) => setSummary({ ...summary, title: e.target.value })} />
                  </label>
                  <label>
                    Recap
                    <textarea
                      rows={8}
                      value={summary.recap}
                      onChange={(e) => setSummary({ ...summary, recap: e.target.value })}
                    />
                  </label>
                  {(
                    [
                      ["majorEvents", "Major events"],
                      ["discoveries", "Discoveries"],
                      ["npcsEncountered", "NPCs encountered"],
                      ["combatResults", "Combat results"],
                      ["lootAndRewards", "Loot and rewards"],
                      ["openQuestions", "Open questions"],
                      ["nextSessionHooks", "Next-session hooks"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        value={summary[key].join("\n")}
                        onChange={(e) => updateSummaryList(key, e.target.value)}
                      />
                    </label>
                  ))}
                  <div className="dm-editor-actions">
                    <button
                      onClick={() =>
                        void run(async () => {
                          await dmToolsApi.saveSummary(campaignId, summarySession.id, summary);
                          setSessions((current) =>
                            current.map((item) =>
                              item.id === summarySession.id ? { ...item, summaryDraft: summary } : item,
                            ),
                          );
                        })
                      }
                    >
                      <Save size={14} />
                      Save draft
                    </button>
                    <button
                      className="primary"
                      onClick={() =>
                        void run(async () => {
                          await dmToolsApi.saveSummary(campaignId, summarySession.id, summary);
                          const result = await dmToolsApi.publishSummary(campaignId, summarySession.id);
                          setJournal((current) => [result.entry, ...current]);
                          setStatus("Summary published to the player journal.");
                        })
                      }
                    >
                      <Send size={14} />
                      Publish
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}
