import type { CreatureLibraryRecord, EncounterBudget, EncounterDifficulty, EncounterPartyProfile, EncounterReminder, EncounterWarning, SavedEncounter } from "@/types/dmTools";

const XP_THRESHOLDS: Record<number, Record<EncounterDifficulty, number>> = {
  1:{easy:25,medium:50,hard:75,deadly:100},2:{easy:50,medium:100,hard:150,deadly:200},3:{easy:75,medium:150,hard:225,deadly:400},4:{easy:125,medium:250,hard:375,deadly:500},5:{easy:250,medium:500,hard:750,deadly:1100},6:{easy:300,medium:600,hard:900,deadly:1400},7:{easy:350,medium:750,hard:1100,deadly:1700},8:{easy:450,medium:900,hard:1400,deadly:2100},9:{easy:550,medium:1100,hard:1600,deadly:2400},10:{easy:600,medium:1200,hard:1900,deadly:2800},11:{easy:800,medium:1600,hard:2400,deadly:3600},12:{easy:1000,medium:2000,hard:3000,deadly:4500},13:{easy:1100,medium:2200,hard:3400,deadly:5100},14:{easy:1250,medium:2500,hard:3800,deadly:5700},15:{easy:1400,medium:2800,hard:4300,deadly:6400},16:{easy:1600,medium:3200,hard:4800,deadly:7200},17:{easy:2000,medium:3900,hard:5900,deadly:8800},18:{easy:2100,medium:4200,hard:6300,deadly:9500},19:{easy:2400,medium:4900,hard:7300,deadly:10900},20:{easy:2800,medium:5700,hard:8500,deadly:12700},
};

export function calculateEncounterBudget(party: EncounterPartyProfile, difficulty: EncounterDifficulty): EncounterBudget {
  const target = party.levels.reduce((sum, level) => sum + (XP_THRESHOLDS[Math.max(1, Math.min(20, Math.trunc(level)))]?.[difficulty] ?? 0), 0);
  return { target, minimum: Math.floor(target * 0.8), maximum: Math.ceil(target * 1.2), method: "2014 DMG per-character XP thresholds, ±20% composition tolerance" };
}

function hashSeed(input: string) { let h = 2166136261; for (const char of input) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function randomFrom(seed: string) { let state = hashSeed(seed) || 1; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }

/* The SRD catalog (src/data/creatures.json) carries role tags (Brute,
   Skirmisher…), not capability tags — capabilities are derived from the
   stat block itself. Explicit capability tags on custom creatures still
   count via the tag checks. */
function creatureFlies(creature: CreatureLibraryRecord) {
  return creature.tags.includes("flying") || /\bfly\b/i.test(creature.speed ?? "");
}
function creatureHasAreaDamage(creature: CreatureLibraryRecord) {
  if (creature.tags.includes("area-damage")) return true;
  return [...(creature.actions ?? []), ...(creature.legendaryActions ?? [])].some((action) => /each creature (?:in|within)/i.test(action.description ?? ""));
}
function creatureHasHardControl(creature: CreatureLibraryRecord) {
  if (creature.tags.includes("paralysis") || creature.tags.includes("stun")) return true;
  return [...(creature.actions ?? []), ...(creature.traits ?? [])].some((action) => /\bparalyzed\b|\bstunned\b/i.test(action.description ?? ""));
}

export function encounterSafetyWarnings(party: EncounterPartyProfile, creatures: Array<{ creature: CreatureLibraryRecord; quantity: number }>): EncounterWarning[] {
  const warnings: EncounterWarning[] = [];
  const total = creatures.reduce((sum, entry) => sum + entry.quantity, 0);
  const highestHit = Math.max(0, ...creatures.flatMap((entry) => [...(entry.creature.actions ?? []), ...(entry.creature.traits ?? [])].map((action) => action.averageDamage ?? 0)));
  if (party.averageMaxHp && highestHit >= party.averageMaxHp * 0.5) warnings.push({ code: "one-hit", severity: "warning", message: "A creature may remove half of an average party member's hit points with one action." });
  if (total > Math.max(8, party.memberCount * 2.5)) warnings.push({ code: "action-economy", severity: "warning", message: "The enemy action economy is severe and may make the encounter slow or swingy." });
  if (creatures.some((entry) => creatureFlies(entry.creature)) && party.rangedCapacity === "low") warnings.push({ code: "flying", severity: "warning", message: "Flying enemies may be difficult for this party's limited ranged capacity." });
  if (creatures.filter((entry) => creatureHasAreaDamage(entry.creature)).reduce((sum, entry) => sum + entry.quantity, 0) > 1) warnings.push({ code: "area-damage", severity: "warning", message: "Multiple enemies have area damage; clustered characters may take heavy damage." });
  if (creatures.some((entry) => creatureHasHardControl(entry.creature))) warnings.push({ code: "hard-control", severity: "warning", message: "Hard-control effects may leave players unable to act." });
  return warnings;
}

export type GenerateEncounterInput = { seed: string; campaignId: string; difficulty: EncounterDifficulty; environment?: string; encounterType?: string; length?: "short" | "standard" | "long"; bossAllowed?: boolean; reinforcements?: boolean; source?: string };

export function generateEncounter(input: GenerateEncounterInput, party: EncounterPartyProfile, library: CreatureLibraryRecord[], ownerUserId: string): SavedEncounter {
  const rng = randomFrom(input.seed);
  const budget = calculateEncounterBudget(party, input.difficulty);
  // Environment matching is case-insensitive: the catalog capitalizes
  // ("Forest") while the generator UI accepts free text ("forest").
  const wantedEnvironment = input.environment?.trim().toLowerCase();
  const eligible = library.filter((creature) => !creature.archived && (creature.experienceValue ?? 0) > 0 && (!wantedEnvironment || creature.environments?.some((environment) => environment.toLowerCase() === wantedEnvironment)) && (!input.source || creature.source === input.source));
  if (eligible.length === 0) throw new Error("No creatures match the generator filters.");
  const sorted = [...eligible].sort((a, b) => (a.experienceValue ?? 0) - (b.experienceValue ?? 0));
  const withinBudget = sorted.filter((creature) => (creature.experienceValue ?? 0) <= budget.maximum);
  const candidates = withinBudget.length ? withinBudget : sorted;
  const picked: Array<{ creature: CreatureLibraryRecord; quantity: number }> = [];
  let remaining = budget.target;
  const desiredCount = input.length === "short" ? Math.max(1, party.memberCount - 1) : input.length === "long" ? Math.min(10, party.memberCount * 2) : party.memberCount + 1;
  for (let i = 0; i < desiredCount && remaining > 0; i++) {
    const fits = candidates.filter((creature) => (creature.experienceValue ?? 0) <= Math.max(remaining * 1.15, budget.target * 0.15));
    const pool = fits.length ? fits : candidates;
    const creature = pool[Math.floor(rng() * pool.length)] ?? pool[0];
    const existing = picked.find((entry) => entry.creature.id === creature.id);
    if (existing) existing.quantity += 1; else picked.push({ creature, quantity: 1 });
    remaining -= creature.experienceValue ?? 0;
  }
  const encounterTypes = ["straight-combat", "ambush", "hold-position", "rescue", "stop-ritual", "survive-rounds", "retrieve-item", "negotiation"];
  const encounterType = input.encounterType ?? encounterTypes[Math.floor(rng() * encounterTypes.length)];
  const objectiveByType: Record<string, string> = { "hold-position":"Hold the position until help arrives.", rescue:"Reach and extract the captive.", "stop-ritual":"Disrupt the ritual before it completes.", "survive-rounds":"Survive until the end of round 5.", "retrieve-item":"Secure the objective and escape.", negotiation:"Find a peaceful resolution or survive the breakdown.", ambush:"Break the ambush and reach defensible ground.", "straight-combat":"Defeat or drive off the opposition." };
  const reminders: EncounterReminder[] = input.reinforcements ? [{ id: crypto.randomUUID(), label: "Reinforcements arrive", details: "Add the reinforcement wave or adjust to the table's condition.", trigger: { type: "round-start", round: 3 }, repeat: false, completed: false }] : [];
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), campaignId: input.campaignId, ownerUserId, name: `${input.environment ? input.environment[0].toUpperCase() + input.environment.slice(1) + " " : ""}${encounterType.replaceAll("-", " ")}`,
    status: "draft", origin: "generated", environment: input.environment, encounterType, difficulty: input.difficulty, expectedRounds: input.length === "short" ? { min: 2, max: 3 } : input.length === "long" ? { min: 5, max: 8 } : { min: 3, max: 5 }, objective: objectiveByType[encounterType] ?? "Resolve the scene without losing sight of the objective.",
    readAloud: "The scene shifts as movement and intent reveal the danger ahead.", tactics: "Use terrain and morale; enemies retreat or bargain when their objective is lost.", environmentNotes: input.environment ? `Use the ${input.environment} as active terrain rather than decoration.` : "Choose one terrain feature that changes movement or cover.", developments: input.reinforcements ? "A second wave may arrive at round 3." : "The opposition may flee, surrender, or call for help.",
    combatants: picked.map(({ creature, quantity }) => ({ id: crypto.randomUUID(), creatureId: creature.id, name: creature.name, quantity, kind: "enemy", startingHpMode: "average", initiativeMode: quantity > 1 ? "group" : "roll", hidden: encounterType === "ambush", privateNote: creature.tacticsNotes })), waves: [], reminders, handoutIds: [], partySnapshot: party, generatedWarnings: encounterSafetyWarnings(party, picked), createdAt: now, updatedAt: now,
  };
}

export type ReminderContext = { type: "encounter-start" | "round-start" | "round-end" | "turn-start" | "turn-end" | "initiative-count"; round: number; combatantId?: string; initiative?: number };
export function reminderMatches(reminder: EncounterReminder, context: ReminderContext) {
  if (reminder.completed || (reminder.snoozedUntilRound && context.round < reminder.snoozedUntilRound)) return false;
  const trigger = reminder.trigger;
  if (trigger.type !== context.type) return false;
  if ((trigger.type === "round-start" || trigger.type === "round-end") && trigger.round !== undefined) return trigger.round === context.round;
  if (trigger.type === "turn-start" || trigger.type === "turn-end") return trigger.combatantId === context.combatantId;
  if (trigger.type === "initiative-count") return trigger.count === context.initiative;
  return true;
}

export function approximateHealth(current: number, max: number) {
  if (current <= 0) return "Defeated";
  const ratio = max > 0 ? current / max : 0;
  if (ratio <= 0.25) return "Near death";
  if (ratio <= 0.5) return "Bloodied";
  if (ratio < 1) return "Wounded";
  return "Unhurt";
}
