"use client";

import {
  LogOut,
  MessageSquare,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AbilityKey,
  AbilityScores,
  ASIChoice,
  AuthMode,
  BuildMode,
  Character,
  CustomRule,
  DraftCharacter,
  FeedbackEntry,
  HeroClass,
  InventoryItem,
  PublicUser,
  RollMode,
  RollOutcome,
  Ruleset,
  SpellStatus,
  StatMethod,
} from "@/types/game";
import {
  abilityKeys,
  abilityModifier,
  applyRaceBonuses,
  characterPayload,
  createInitialDraft,
  defaultAssignments,
  emptyAbilities,
  pointCosts,
  rollDie,
  scoreFrom4d6,
  signed,
  standardArray,
} from "@/lib/utils";
import ClassIconPlaceholder from "@/components/icons/ClassIcon";
import SplashScreen from "@/components/SplashScreen";
import AuthScreen from "@/components/AuthScreen";
import CharacterStartPanel from "@/components/CharacterStartPanel";
import CreatorPanel from "@/components/CreatorPanel";
import FeedbackModal, { type FeedbackInput } from "@/components/FeedbackModal";
import QuickbuilderPanel from "@/components/QuickbuilderPanel";
import HeroSheet from "@/components/HeroSheet";
import LevelUpModal from "@/components/LevelUpModal";
import { learnsIndividualSpells, loadSpells, spellsForClass } from "@/lib/spells";
import { getClassData } from "@/lib/subclasses";
import DiceRollOverlay, { type RollingDie } from "@/components/DiceRollOverlay";
import RollDrawer, { type RollHistoryEntry } from "@/components/RollDrawer";
import { FONT_STACKS } from "@/lib/skins";
import { POINT_BUY_BUDGET, SPLASH_DURATION_MS } from "@/lib/constants";
import { computeFeatBonuses } from "@/lib/featBonuses";
import { effectTotal } from "@/lib/effects";

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

/** The choices a character forged above level 1 accumulates through the
    creation level-up sequence, applied on top of the level-1 payload. */
type CreationChoices = {
  level: number;
  maxHp: number;
  currentHp: number;
  subclassId?: string;
  spellsKnown: string[];
  asiChoices: ASIChoice[];
  hpRolls?: number[];
  spellStatuses?: Record<string, SpellStatus>;
};

type CreationSeqState = { levels: number[]; index: number; soFar: CreationChoices };

/** Levels 1..target that require a player choice when starting above level 1:
    subclass, ASI/feat, or a spell pick for known casters. Level 1 is included
    only for level-1-subclass classes (sorcerer/warlock/cleric) so a high-level
    start still picks its origin. HP-only levels are skipped — the creator
    already computes starting HP for the chosen level. */
function creationChoiceLevels(heroClass: HeroClass, targetLevel: number): number[] {
  const asiLevels = heroClass.asiLevels ?? [4, 8, 12, 16, 19];
  const subclassLevel = getClassData(heroClass.id)?.subclassLevel;
  const knownCaster =
    learnsIndividualSpells(heroClass.id, heroClass.casterType) && spellsForClass(heroClass.name).length > 0;
  const out: number[] = [];
  for (let level = 1; level <= targetLevel; level++) {
    const isSubclass = subclassLevel != null && level === subclassLevel;
    if (level === 1) {
      if (isSubclass) out.push(1);
      continue;
    }
    if (isSubclass || asiLevels.includes(level) || knownCaster) out.push(level);
  }
  return out;
}

const NORMAL_ROLL_LINGER_MS = 1800;
const KEPT_D20_LINGER_MS = 4200;
const DROPPED_D20_LINGER_MS = 850;

function rollResultSummary(total: number) {
  return `${total} total`;
}

function rollDetailWithTotal(detail: string, total: number) {
  return detail.includes("=") ? detail : `${detail} = ${total}`;
}

type D20RollOptions = { forcedMode?: RollMode };

export default function ForgeAndFableApp() {
  const [introDone, setIntroDone] = useState(false);
  const [ruleset, setRuleset] = useState<Ruleset | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [creationPromptOpen, setCreationPromptOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorStep, setCreatorStep] = useState(0);
  const [buildMode, setBuildMode] = useState<BuildMode>("standard");
  const [draft, setDraft] = useState<DraftCharacter | null>(null);
  const [statMethod, setStatMethod] = useState<StatMethod>("point-buy");
  const [standardAssignments, setStandardAssignments] = useState(defaultAssignments);
  const [rolledScores, setRolledScores] = useState([15, 14, 13, 12, 10, 8]);
  const [rolledAssignments, setRolledAssignments] = useState(defaultAssignments);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLog, setConsoleLog] = useState<string[]>(["Console online"]);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authInviteCode, setAuthInviteCode] = useState("");
  const [status, setStatus] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const [flyingDice, setFlyingDice] = useState<RollingDie[]>([]);
  const [rollHistory, setRollHistory] = useState<RollHistoryEntry[]>([]);
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [creationSeq, setCreationSeq] = useState<CreationSeqState | null>(null);
  const [spellsReady, setSpellsReady] = useState(false);

  const recordHistory = (
    label: string,
    detail: string,
    total: number,
    adv?: RollHistoryEntry["adv"],
    nat?: RollHistoryEntry["nat"],
  ) => {
    setRollHistory((prev) => [
      {
        id: crypto.randomUUID(),
        label,
        detail,
        total,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        ...(adv ? { adv } : {}),
        ...(nat ? { nat } : {}),
      },
      ...prev,
    ].slice(0, 100));
  };

  const clearHistory = () => setRollHistory([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), SPLASH_DURATION_MS);
    Promise.all([
      fetch("/api/ruleset").then((response) => {
        if (!response.ok) throw new Error("Ruleset failed to load.");
        return response.json() as Promise<Ruleset>;
      }),
      loadSpells(),
    ])
      .then(([data]) => {
        setRuleset(data);
        setDraft(createInitialDraft(data) as DraftCharacter);
        setSpellsReady(true);
      })
      .catch(() => setStatus("Ruleset or spell catalog failed to load."));

    const storedUser = window.localStorage.getItem("forge-and-fable-user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as PublicUser;
        queueMicrotask(() => setUser(parsed));
      } catch {
        window.localStorage.removeItem("forge-and-fable-user");
      }
    }

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let mounted = true;

    fetch("/api/characters", {
      headers: authHeaders(),
    })
      .then((response) => {
        if (response.status === 401) {
          if (mounted) {
            logOut();
            setStatus("Session expired — please log in again.");
          }
          return;
        }
        if (!response.ok) {
          throw new Error("Vault session could not load.");
        }
        return response.json() as Promise<{ characters: Character[] }>;
      })
      .then((data) => {
        if (!data || !mounted) return;
        setCharacters(data.characters);
        setSelectedId((current) => current || data.characters[0]?.id || "");
      })
      .catch((error: Error) => {
        if (mounted) setStatus(error.message);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? characters[0] ?? null,
    [characters, selectedId],
  );

  const diceAccent = selected?.theme?.accent ?? "#a23f29";
  const diceFont = selected?.theme ? FONT_STACKS[selected.theme.fontKey] : undefined;

  const showCreationPrompt = creationPromptOpen || (!creatorOpen && characters.length === 0);
  const showCreator = creatorOpen;
  const selectedFinalAbilities = useMemo(() => {
    if (!selected || !ruleset) {
      return null;
    }
    const raced = applyRaceBonuses(selected.abilities, selected.raceId, ruleset);
    // Apply ASI and feat ability score increases
    const featInfo = computeFeatBonuses(selected.asiChoices);
    for (const key of abilityKeys) {
      const bonus = featInfo.abilityIncreases[key] ?? 0;
      if (bonus > 0) raced[key] += bonus;
    }
    return raced;
  }, [selected, ruleset]);

  const selectedFeatBonuses = useMemo(() => {
    if (!selected) return null;
    return computeFeatBonuses(selected.asiChoices);
  }, [selected]);
  const selectedInitiative = useMemo(() => {
    if (!selected || !selectedFinalAbilities) return undefined;
    const ruleInit = selected.customRules
      .filter((rule) => rule.type === "initiative")
      .reduce((sum, rule) => sum + rule.value, 0);
    return (
      abilityModifier(selectedFinalAbilities.dexterity) +
      ruleInit +
      (selectedFeatBonuses?.initiativeBonus ?? 0) +
      effectTotal(selected.effects, "initiative")
    );
  }, [selected, selectedFinalAbilities, selectedFeatBonuses]);

  const draftFinalAbilities = useMemo(() => {
    if (!draft || !ruleset) {
      return null;
    }
    return applyRaceBonuses(draft.abilities, draft.raceId, ruleset);
  }, [draft, ruleset]);

  // Abilities for the in-progress creation level-up (race bonuses + the ASIs
  // chosen so far), so each step's ASI cap and HP modifier stay accurate.
  const creationSeqFinalAbilities = useMemo(() => {
    if (!creationSeq || !draft || !ruleset) {
      return null;
    }
    const raced = applyRaceBonuses(draft.abilities, draft.raceId, ruleset);
    const featInfo = computeFeatBonuses(creationSeq.soFar.asiChoices);
    for (const key of abilityKeys) {
      raced[key] += featInfo.abilityIncreases[key] ?? 0;
    }
    return raced;
  }, [creationSeq, draft, ruleset]);
  const pointSpent = draft
    ? abilityKeys.reduce((sum, key) => sum + (pointCosts[draft.abilities[key]] ?? 99), 0)
    : 0;
  const pointRemaining = POINT_BUY_BUDGET - pointSpent;

  async function authRequest(event: FormEvent) {
    event.preventDefault();
    setStatus("");

    try {
      const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          ...(authMode === "register" ? { inviteCode: authInviteCode } : {}),
        }),
      });

      const data = (await response.json()) as { user?: PublicUser; error?: string };

      if (!response.ok || !data.user) {
        setStatus(data.error ?? "Vault access failed.");
        return;
      }

      setUser(data.user);
      window.localStorage.setItem("forge-and-fable-user", JSON.stringify(data.user));
      setAuthInviteCode("");
      setStatus(authMode === "login" ? "Tome opened" : "Account inscribed");
    } catch {
      setStatus("Network error — please try again.");
    }
  }

  function logOut() {
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setCharacters([]);
    setSelectedId("");
    setCreationPromptOpen(false);
    setCreatorOpen(false);
    window.localStorage.removeItem("forge-and-fable-user");
    setStatus("Tome sealed");
  }

  function beginBuild(mode: BuildMode) {
    if (!ruleset) {
      return;
    }

    setBuildMode(mode);
    if (mode === "standard") {
      setDraft(createInitialDraft(ruleset) as DraftCharacter);
      setStatMethod("point-buy");
      setCreatorStep(0);
      setCreatorOpen(true);
    } else {
      // Quickbuilder & Premade: start with guided panel, then drop into CreatorPanel at Finalize
      setCreatorOpen(false);
    }
    setCreationPromptOpen(false);
  }

  function handleQuickbuildComplete(draft: DraftCharacter) {
    setDraft(draft);
    setCreatorStep(5); // Finalize step
    setCreatorOpen(true);
    setBuildMode("standard");
  }

  function changeStatMethod(method: StatMethod) {
    setStatMethod(method);

    if (method === "point-buy") {
      setDraft((current) => (current ? { ...current, abilities: { ...emptyAbilities } } : current));
      return;
    }

    const nextAssignments = defaultAssignments();
    const values =
      method === "standard-array"
        ? standardArray
        : Array.from({ length: 6 }, () => scoreFrom4d6()).sort((a, b) => b - a);

    if (method === "standard-array") {
      setStandardAssignments(nextAssignments);
    } else {
      setRolledScores(values);
      setRolledAssignments(nextAssignments);
    }

    setDraft((current) =>
      current
        ? {
            ...current,
            abilities: abilityKeys.reduce((scores, key) => {
              scores[key] = values[nextAssignments[key]];
              return scores;
            }, {} as AbilityScores),
          }
        : current,
    );
  }

  function setAssignment(type: "standard" | "rolled", ability: AbilityKey, nextIndex: number) {
    const values = type === "standard" ? standardArray : rolledScores;
    const setter = type === "standard" ? setStandardAssignments : setRolledAssignments;

    setter((previous) => {
      const currentIndex = previous[ability];
      const otherAbility = abilityKeys.find(
        (key) => key !== ability && previous[key] === nextIndex,
      );
      const next = {
        ...previous,
        [ability]: nextIndex,
      };

      if (otherAbility) {
        next[otherAbility] = currentIndex;
      }

      setDraft((current) =>
        current
          ? {
              ...current,
              abilities: abilityKeys.reduce((scores, key) => {
                scores[key] = values[next[key]];
                return scores;
              }, {} as AbilityScores),
            }
          : current,
      );

      return next;
    });
  }

  function changePointBuy(ability: AbilityKey, delta: number) {
    if (!draft || statMethod !== "point-buy") {
      return;
    }

    const nextScore = draft.abilities[ability] + delta;
    if (nextScore < 8 || nextScore > 15) {
      return;
    }

    const nextAbilities = {
      ...draft.abilities,
      [ability]: nextScore,
    };
    const nextSpent = abilityKeys.reduce((sum, key) => sum + (pointCosts[nextAbilities[key]] ?? 99), 0);

    if (nextSpent > POINT_BUY_BUDGET) {
      return;
    }

    setDraft({
      ...draft,
      abilities: nextAbilities,
    });
  }

  function rollStatBlock() {
    const nextRolls = Array.from({ length: 6 }, () => scoreFrom4d6()).sort((a, b) => b - a);
    const nextAssignments = defaultAssignments();

    setRolledScores(nextRolls);
    setRolledAssignments(nextAssignments);
    setDraft((current) =>
      current
        ? {
            ...current,
            abilities: abilityKeys.reduce((scores, key) => {
              scores[key] = nextRolls[nextAssignments[key]];
              return scores;
            }, {} as AbilityScores),
          }
        : current,
    );
  }

  function rollStartingHp(request: {
    className: string;
    hitDie: number;
    count: number;
    constitutionModifier: number;
    onResult: (rolls: number[]) => void;
  }) {
    if (request.count <= 0) {
      return;
    }

    pushRoll(
      `${request.className} starting HP`,
      request.hitDie,
      request.count,
      request.constitutionModifier * request.count,
      (outcome) => request.onResult(outcome.rolls),
    );
  }

  async function createHero() {
    if (!user || !ruleset || !draft) {
      return;
    }

    if (!draft.name.trim()) {
      setStatus("Unable to forge: no character name");
      return;
    }

    if (draft.sourceIds.length === 0) {
      setStatus("Unable to forge: no rule sources selected");
      return;
    }

    if (!draft.classId) {
      setStatus("Unable to forge: no class chosen");
      return;
    }

    if (!draft.background) {
      setStatus("Unable to forge: no background chosen");
      return;
    }

    if (!draft.raceId) {
      setStatus("Unable to forge: no species chosen");
      return;
    }

    // Starting above level 1: collect the feat/ASI/subclass/spell choices for the
    // levels gained, then forge with them. Level-1 starts forge immediately.
    const heroClass = ruleset.classes.find((item) => item.id === draft.classId);
    if (heroClass && draft.level > 1) {
      const levels = creationChoiceLevels(heroClass, draft.level);
      if (levels.length > 0) {
        const base = characterPayload(draft, ruleset);
        setCreationSeq({
          levels,
          index: 0,
          soFar: {
            level: 1,
            maxHp: base.maxHp,
            currentHp: base.currentHp,
            subclassId: undefined,
            spellsKnown: [...base.spellsKnown],
            asiChoices: [],
            hpRolls: base.hpRolls,
          },
        });
        return;
      }
    }

    await forgeCharacter(null);
  }

  /** POST the drafted character, applying any level-up choices collected during
      the creation sequence. */
  async function forgeCharacter(choices: CreationChoices | null) {
    if (!user || !ruleset || !draft) {
      return;
    }

    try {
      const payload = {
        ...characterPayload(draft, ruleset),
        ...(choices
          ? {
              asiChoices: choices.asiChoices.length > 0 ? choices.asiChoices : undefined,
              subclassId: choices.subclassId,
              spellsKnown: choices.spellsKnown,
              spellStatuses: choices.spellStatuses,
            }
          : {}),
      };

      const response = await fetch("/api/characters", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { character?: Character; error?: string };

      if (response.status === 401) {
        logOut();
        setStatus("Session expired — please log in again.");
        return;
      }

      if (!response.ok || !data.character) {
        setStatus(data.error ?? "Hero could not be forged.");
        return;
      }

      setCharacters((current) => [data.character!, ...current]);
      setSelectedId(data.character.id);
      setCreationPromptOpen(false);
      setCreatorOpen(false);
      setCreatorStep(0);
      setDraft(createInitialDraft(ruleset) as DraftCharacter);
      setStatMethod("point-buy");
      setCreationSeq(null);
      setStatus(`${data.character.name} forged`);
    } catch {
      setStatus("Connection lost — please try again.");
    }
  }

  /** Apply one level's level-up choices during creation, then advance to the
      next choice-level or forge once every level has been chosen. */
  function advanceCreationSeq(patch: Record<string, unknown>) {
    if (!creationSeq) {
      return;
    }
    const soFar: CreationChoices = {
      ...creationSeq.soFar,
      level: creationSeq.levels[creationSeq.index],
      asiChoices: (patch.asiChoices as ASIChoice[] | undefined) ?? creationSeq.soFar.asiChoices,
      subclassId: (patch.subclassId as string | undefined) ?? creationSeq.soFar.subclassId,
      spellsKnown: (patch.spellsKnown as string[] | undefined) ?? creationSeq.soFar.spellsKnown,
      spellStatuses: (patch.spellStatuses as Record<string, SpellStatus> | undefined) ?? creationSeq.soFar.spellStatuses,
    };
    if (creationSeq.index + 1 < creationSeq.levels.length) {
      setCreationSeq({ ...creationSeq, index: creationSeq.index + 1, soFar });
    } else {
      void forgeCharacter(soFar);
    }
  }

  async function updateSelected(patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) {
    if (!user || !selected) {
      return;
    }

    try {
      const response = await fetch(`/api/characters/${selected.id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as { character?: Character; error?: string };

      if (response.status === 401) {
        logOut();
        setStatus("Session expired — please log in again.");
        return;
      }

      if (!response.ok || !data.character) {
        setStatus(data.error ?? "Update failed.");
        return;
      }

      setCharacters((current) =>
        current.map((character) =>
          character.id === data.character!.id ? data.character! : character,
        ),
      );
    } catch {
      setStatus("Connection lost — changes not saved.");
    }
  }

  async function deleteSelected() {
    if (!user || !selected) {
      return;
    }

    try {
      const response = await fetch(`/api/characters/${selected.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (response.status === 401) {
        logOut();
        setStatus("Session expired — please log in again.");
        return;
      }

      if (!response.ok) {
        setStatus("Hero could not be retired.");
        return;
      }

      setCharacters((current) => current.filter((character) => character.id !== selected.id));
      setSelectedId("");
      setStatus(`${selected.name} retired`);
    } catch {
      setStatus("Connection lost — hero not retired.");
    }
  }

  async function loadFeedback() {
    if (!user) {
      return;
    }

    try {
      const response = await fetch("/api/feedback", {
        headers: authHeaders(),
      });

      const data = (await response.json()) as { feedback?: FeedbackEntry[]; error?: string };

      if (response.status === 401) {
        logOut();
        return;
      }

      if (!response.ok || !data.feedback) {
        setFeedbackStatus(data.error ?? "Feedback could not be loaded.");
        return;
      }

      setFeedbackEntries(data.feedback);
    } catch {
      setFeedbackStatus("Feedback could not be loaded.");
    }
  }

  async function submitFeedback(input: FeedbackInput) {
    if (!user) {
      return false;
    }

    setFeedbackBusy(true);
    setFeedbackStatus("Sending feedback...");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
      });

      const data = (await response.json()) as { feedback?: FeedbackEntry; error?: string };

      if (response.status === 401) {
        logOut();
        setStatus("Session expired â€” please log in again.");
        return false;
      }

      if (!response.ok || !data.feedback) {
        setFeedbackStatus(data.error ?? "Feedback could not be submitted.");
        return false;
      }

      setFeedbackEntries((current) => [data.feedback!, ...current]);
      setFeedbackStatus("Feedback saved. Thank you.");
      setStatus("Feedback saved");
      return true;
    } catch {
      setFeedbackStatus("Feedback could not be submitted.");
      return false;
    } finally {
      setFeedbackBusy(false);
    }
  }

  function openFeedback() {
    setFeedbackOpen(true);
    setFeedbackStatus("");
    void loadFeedback();
  }

  function pushRoll(
    label: string,
    sides: number,
    count = 1,
    modifier = 0,
    onResult?: (outcome: RollOutcome) => void,
  ) {
    const generatedRolls = Array.from({ length: count }, () => rollDie(sides));
    const rolls = Array<number>(count).fill(0);
    const finishedIndices = new Set<number>();
    let finished = 0;
    // Include modifier in the label so users see the full roll info (e.g. "1d20+5")
    const fullLabel = `${label}${modifier !== 0 ? ` ${signed(modifier)}` : ""}`;
    const diceNotation = count > 1 ? `${count}d${sides}` : `d${sides}`;
    const total = generatedRolls.reduce((sum, value) => sum + value, modifier);
    const detailRolls = count > 1 ? `[${generatedRolls.join(", ")}]` : `[${generatedRolls[0]}]`;
    const resultDetail = `${diceNotation} ${detailRolls}${modifier !== 0 ? ` ${signed(modifier)}` : ""} = ${total}`;
    const resultSummary = rollResultSummary(total);

    const recordResult = (outcome: RollOutcome) => {
      const parts = outcome.rolls.join("+");
      const totalStr = modifier !== 0 ? `${parts}${signed(modifier)} = ${outcome.total}` : `${parts} = ${outcome.total}`;
      setConsoleLog((prev) => [`${diceNotation}${modifier !== 0 ? signed(modifier) : ""}  →  ${totalStr}  (${label})`, ...prev].slice(0, 20));
      const nat: RollHistoryEntry["nat"] =
        sides === 20 && count === 1
          ? outcome.rolls[0] === 20
            ? "crit"
            : outcome.rolls[0] === 1
              ? "fumble"
              : undefined
          : undefined;
      recordHistory(label, `${diceNotation}${modifier !== 0 ? signed(modifier) : ""}: ${totalStr}`, outcome.total, undefined, nat);
      onResult?.(outcome);
    };

    const newDice: RollingDie[] = Array.from({ length: count }, (_, i) => {
      const fromLeft = Math.random() > 0.5;
      const result = generatedRolls[i];
      return {
        id: `${crypto.randomUUID()}-${i}`,
        sides,
        result,
        label: fullLabel,
        resultSummary,
        resultDetail,
        lingerMs: NORMAL_ROLL_LINGER_MS,
        fromLeft,
        startYPct: 0.15 + Math.random() * 0.35,
        landXPct: 0.22 + Math.random() * 0.56,
        landYPct: 0.25 + Math.random() * 0.38,
        rotations: (fromLeft ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * 360,
        delayMs: i * 220,
        onFinish: (settledResult) => {
          if (finishedIndices.has(i)) return;
          finishedIndices.add(i);
          rolls[i] = settledResult;
          finished += 1;

          if (finished === count) {
            recordResult({
              rolls: [...rolls],
              modifier,
              total: rolls.reduce((sum, value) => sum + value, modifier),
            });
          }
        },
      };
    });
    setFlyingDice((prev) => [...prev, ...newDice]);
  }

  /** Roll a mixed pool (e.g. 2d6 + 1d20 + mod) as one flight of dice and one
      history entry. Used by the roll drawer's ad-hoc pool builder. */
  function pushPool(
    groups: { sides: number; count: number }[],
    modifier: number,
    label: string,
    onResult?: (outcome: RollOutcome) => void,
  ) {
    const cleaned = groups.filter((g) => g.count > 0);
    const totalCount = cleaned.reduce((s, g) => s + g.count, 0);
    const useD20Mode = rollMode !== "normal" && cleaned.some((g) => g.sides === 20);
    const d20Total = cleaned.reduce((s, g) => s + (g.sides === 20 ? g.count : 0), 0);
    const extraDice = useD20Mode ? d20Total : 0; // one extra die per d20 for adv/dis pair
    if (totalCount === 0 || totalCount + extraDice > 40) return;

    if (useD20Mode) {
      const mode = rollMode === "advantage" ? "advantage" : "disadvantage";
      const rolledDice: { sides: number; value: number }[] = [];
      const newDice: RollingDie[] = [];
      let index = 0;

      // Track all d20 pairs: { pair: [d20a, d20b], keptIndex, keptValue }
      const d20Pairs: { pair: [number, number]; keptIndex: number; keptValue: number }[] = [];

      const makeDie = (sides: number, result: number, dropped = false) => {
        const dieIndex = index++;
        const fromLeft = Math.random() > 0.5;
        newDice.push({
          id: `${crypto.randomUUID()}-${dieIndex}`,
          sides,
          result,
          label,
          fromLeft,
          startYPct: 0.15 + Math.random() * 0.35,
          landXPct: 0.22 + Math.random() * 0.56,
          landYPct: 0.25 + Math.random() * 0.38,
          rotations: (fromLeft ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * 360,
          delayMs: dieIndex * 180,
          dropped,
        });
      };

      // Roll adv/dis pairs for every d20
      for (const group of cleaned) {
        if (group.sides === 20) {
          for (let i = 0; i < group.count; i++) {
            const pair: [number, number] = [rollDie(20), rollDie(20)];
            const keptIndex =
              mode === "advantage"
                ? pair[0] >= pair[1] ? 0 : 1
                : pair[0] <= pair[1] ? 0 : 1;
            d20Pairs.push({ pair, keptIndex, keptValue: pair[keptIndex] });
            pair.forEach((value, pi) => makeDie(20, value, pi !== keptIndex));
          }
        } else {
          for (let i = 0; i < group.count; i++) {
            const value = rollDie(group.sides);
            rolledDice.push({ sides: group.sides, value });
            makeDie(group.sides, value);
          }
        }
      }

      const keptD20Sum = d20Pairs.reduce((s, p) => s + p.keptValue, 0);
      const extraSum = rolledDice.reduce((sum, die) => sum + die.value, 0);
      const total = keptD20Sum + extraSum + modifier;

      const d20Parts = d20Pairs.map((p) =>
        `d20 ${mode === "advantage" ? "adv" : "dis"} [${p.pair.join(", ")}] keep ${p.keptValue}`,
      ).join(" + ");
      const extraPart = cleaned
        .filter((group) => group.sides !== 20)
        .map((group) => {
          const values = rolledDice.filter((die) => die.sides === group.sides).map((die) => die.value);
          return ` + ${group.count}d${group.sides} [${values.join(", ")}]`;
        })
        .join("");
      const detail = `${d20Parts}${extraPart}${modifier !== 0 ? ` ${signed(modifier)}` : ""} = ${total}`;

      const over20 = d20Pairs.some((p) => p.keptValue === 20);
      const anyOne = d20Pairs.some((p) => p.keptValue === 1);
      const nat: RollHistoryEntry["nat"] =
        (d20Pairs.length === 1 && d20Pairs[0].keptValue === 20) || over20 ? "crit"
        : (d20Pairs.length === 1 && d20Pairs[0].keptValue === 1) || anyOne ? "fumble"
        : undefined;
      const resultSummary = rollResultSummary(total);
      newDice.forEach((die) => {
        die.resultSummary = die.dropped ? "Dropped" : resultSummary;
        die.resultDetail = die.dropped ? `${die.result}` : detail;
        die.lingerMs = die.dropped ? DROPPED_D20_LINGER_MS : d20Pairs.length > 0 ? KEPT_D20_LINGER_MS : NORMAL_ROLL_LINGER_MS;
      });

      const histModeData: RollHistoryEntry["adv"] = d20Pairs.length === 1
        ? { mode, dice: d20Pairs[0].pair, keptIndex: d20Pairs[0].keptIndex }
        : undefined;
      setConsoleLog((prev) => [`${label} -> ${detail}`, ...prev].slice(0, 20));
      recordHistory(label, detail, total, histModeData, nat);
      onResult?.({
        rolls: [
          ...d20Pairs.map((pair) => pair.keptValue),
          ...rolledDice.map((die) => die.value),
        ],
        modifier,
        total,
      });
      setFlyingDice((prev) => [...prev, ...newDice]);
      setRollMode("normal");
      return;
    }

    const rolledDice: { sides: number; value: number }[] = [];
    const newDice: RollingDie[] = [];
    let index = 0;

    for (const group of cleaned) {
      for (let i = 0; i < group.count; i++) {
        const dieIndex = index++;
        const fromLeft = Math.random() > 0.5;
        const result = rollDie(group.sides);
        rolledDice[dieIndex] = { sides: group.sides, value: result };
        newDice.push({
          id: `${crypto.randomUUID()}-${dieIndex}`,
          sides: group.sides,
          result,
          label,
          fromLeft,
          startYPct: 0.15 + Math.random() * 0.35,
          landXPct: 0.22 + Math.random() * 0.56,
          landYPct: 0.25 + Math.random() * 0.38,
          rotations: (fromLeft ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * 360,
          delayMs: dieIndex * 180,
        });
      }
    }
    const total = rolledDice.reduce((sum, die) => sum + die.value, modifier);
    const detail = cleaned
      .map((g) => `${g.count}d${g.sides} [${rolledDice.filter((die) => die.sides === g.sides).map((die) => die.value).join(", ")}]`)
      .join(" + ") + (modifier !== 0 ? ` ${signed(modifier)}` : "");
    const detailWithTotal = rollDetailWithTotal(detail, total);
    newDice.forEach((die) => {
      die.resultSummary = rollResultSummary(total);
      die.resultDetail = detailWithTotal;
      die.lingerMs = NORMAL_ROLL_LINGER_MS;
    });
    setConsoleLog((prev) => [`${label} -> ${total}`, ...prev].slice(0, 20));
    recordHistory(label, detail, total);
    onResult?.({
      rolls: rolledDice.map((die) => die.value),
      modifier,
      total,
    });
    setFlyingDice((prev) => [...prev, ...newDice]);
  }

  /** Roll a single d20 check/attack/save, honoring the armed advantage /
      disadvantage mode: advantage rolls 2d20 and keeps the higher, disadvantage
      the lower. Rider dice (e.g. Bless's 1d4) fly and add to the total as usual.
      The kept d20 alone takes the modifier. The mode is one-shot — it resets to
      normal after the roll so it can't silently affect the next one. */
  function pushD20(label: string, modifier = 0, riders: { sides: number; count: number }[] = [], options?: D20RollOptions) {
    const armedMode = rollMode;
    const forcedMode = options?.forcedMode;
    const mode = forcedMode && armedMode !== "normal" && armedMode !== forcedMode ? "normal" : forcedMode ?? armedMode;
    const d20Count = mode === "normal" ? 1 : 2;
    const d20s = Array.from({ length: d20Count }, () => rollDie(20));
    let keptIndex = 0;
    if (mode === "advantage") keptIndex = d20s[0] >= d20s[1] ? 0 : 1;
    else if (mode === "disadvantage") keptIndex = d20s[0] <= d20s[1] ? 0 : 1;
    const keptD20 = d20s[keptIndex];

    const riderGroups = riders.filter((r) => r.count > 0);
    const riderValues: { sides: number; value: number }[] = [];
    const newDice: RollingDie[] = [];
    let index = 0;

    const makeDie = (sides: number, result: number, dropped: boolean) => {
      const fromLeft = Math.random() > 0.5;
      newDice.push({
        id: `${crypto.randomUUID()}-${index}`,
        sides,
        result,
        label,
        fromLeft,
        startYPct: 0.15 + Math.random() * 0.35,
        landXPct: 0.22 + Math.random() * 0.56,
        landYPct: 0.25 + Math.random() * 0.38,
        rotations: (fromLeft ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * 360,
        delayMs: index * 180,
        dropped,
      });
      index += 1;
    };

    d20s.forEach((value, i) => makeDie(20, value, mode !== "normal" && i !== keptIndex));
    for (const group of riderGroups) {
      for (let i = 0; i < group.count; i++) {
        const value = rollDie(group.sides);
        riderValues.push({ sides: group.sides, value });
        makeDie(group.sides, value, false);
      }
    }

    const riderSum = riderValues.reduce((sum, r) => sum + r.value, 0);
    const total = keptD20 + riderSum + modifier;

    const d20Part =
      mode === "normal"
        ? `d20 [${keptD20}]`
        : `d20 ${mode === "advantage" ? "adv" : "dis"} [${d20s.join(", ")}] keep ${keptD20}`;
    const riderPart = riderGroups
      .map((g) => ` + ${g.count}d${g.sides} [${riderValues.filter((r) => r.sides === g.sides).map((r) => r.value).join(", ")}]`)
      .join("");
    const detail = `${d20Part}${riderPart}${modifier !== 0 ? ` ${signed(modifier)}` : ""} = ${total}`;
    const resultSummary = rollResultSummary(total);
    newDice.forEach((die, dieIndex) => {
      const isD20ChoiceDie = dieIndex < d20s.length && die.sides === 20;
      const isKeptD20 = isD20ChoiceDie && dieIndex === keptIndex;

      die.resultSummary = isD20ChoiceDie && die.dropped ? "Dropped" : resultSummary;
      die.resultDetail = isD20ChoiceDie && die.dropped ? `${die.result}` : detail;
      die.lingerMs = isKeptD20 && mode !== "normal"
        ? KEPT_D20_LINGER_MS
        : die.dropped
          ? DROPPED_D20_LINGER_MS
          : NORMAL_ROLL_LINGER_MS;
    });

    setConsoleLog((prev) => [`${label}  →  ${detail}`, ...prev].slice(0, 20));
    const nat: RollHistoryEntry["nat"] =
      keptD20 === 20 ? "crit" : keptD20 === 1 ? "fumble" : undefined;
    recordHistory(
      label,
      detail,
      total,
      mode !== "normal" ? { mode, dice: d20s, keptIndex } : undefined,
      nat,
    );
    setFlyingDice((prev) => [...prev, ...newDice]);
    if (armedMode !== "normal") setRollMode("normal");
  }

  function expireDie(id: string) {
    setFlyingDice((prev) => prev.filter((d) => d.id !== id));
  }

  function executeConsole(event: FormEvent) {
    event.preventDefault();

    if (!selected) {
      return;
    }

    const raw = consoleInput.trim();
    const [command, value, ...rest] = raw.split(/\s+/);
    const amount = Number(value);
    const textValue = [value, ...rest].filter(Boolean).join(" ").trim();
    const nextLog = (message: string) =>
      setConsoleLog((current) => [`> ${raw}`, message, ...current].slice(0, 8));

    if (command === "add-ac" && Number.isFinite(amount)) {
      const rule: CustomRule = {
        id: crypto.randomUUID(),
        label: `Protection ${signed(amount)} AC`,
        type: "ac",
        value: amount,
        source: "Console",
      };
      updateSelected({ customRules: [...selected.customRules, rule] });
      nextLog(`Registered ${rule.label}`);
      return;
    }

    if (command === "heal" && Number.isFinite(amount)) {
      updateSelected({ currentHp: Math.min(selected.maxHp, selected.currentHp + amount) });
      nextLog(`Restored ${amount} HP`);
      return;
    }

    if (command === "damage" && Number.isFinite(amount)) {
      updateSelected({ currentHp: Math.max(0, selected.currentHp - amount) });
      nextLog(`Applied ${amount} damage`);
      return;
    }

    if (command === "temp-hp" && Number.isFinite(amount)) {
      updateSelected({ tempHp: Math.max(0, amount) });
      nextLog(`Temporary HP set to ${Math.max(0, amount)}`);
      return;
    }

    if (command === "add-item" && textValue) {
      const item: InventoryItem = {
        id: crypto.randomUUID(),
        name: textValue,
        rarity: "Common",
        attunement: false,
        notes: "Console-added inventory.",
      };
      updateSelected({ inventory: [...selected.inventory, item] });
      nextLog(`${item.name} added`);
      return;
    }

    if (command === "clear-rules") {
      updateSelected({ customRules: [] });
      nextLog("Custom rules cleared");
      return;
    }

    nextLog("Command not recognized");
  }

    if (!introDone || !ruleset || !draft || !spellsReady) {
    return (
      <>
        <SplashScreen />
    <DiceRollOverlay dice={flyingDice} onExpire={expireDie} accentHex={diceAccent} fontStack={diceFont} />
      </>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        email={authEmail}
        password={authPassword}
        inviteCode={authInviteCode}
        status={status}
        onModeChange={setAuthMode}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onInviteCodeChange={setAuthInviteCode}
        onSubmit={authRequest}
      />
    );
  }

  return (
    <>
    <DiceRollOverlay dice={flyingDice} onExpire={expireDie} accentHex={diceAccent} fontStack={diceFont} />
    <RollDrawer
      history={rollHistory}
      theme={selected?.theme ?? null}
      rollMode={rollMode}
      activeCharacterName={selected?.name}
      activeCharacterInitiative={selectedInitiative}
      onRollModeChange={setRollMode}
      onRollPool={pushPool}
      onClearHistory={clearHistory}
    />
    {creationSeq && draft && creationSeqFinalAbilities ? (() => {
      const heroClass = ruleset.classes.find((item) => item.id === draft.classId);
      if (!heroClass) return null;
      const targetLevel = creationSeq.levels[creationSeq.index];
      const raceName = ruleset.races.find((item) => item.id === draft.raceId)?.name;
      return (
        <LevelUpModal
          key={`create-${creationSeq.index}`}
          character={creationSeq.soFar}
          newLevel={targetLevel}
          finalAbilities={creationSeqFinalAbilities}
          classId={heroClass.id}
          className={heroClass.name}
          hitDie={heroClass.hitDie}
          asiLevels={heroClass.asiLevels ?? [4, 8, 12, 16, 19]}
          subclassLevel={getClassData(heroClass.id)?.subclassLevel}
          casterType={heroClass.casterType}
          raceName={raceName}
          useFeatPrerequisites={draft.settings.useFeatPrerequisites}
          hitPointType={draft.settings.hitPointType}
          skipHp
          onConfirm={advanceCreationSeq}
          onCancel={() => setCreationSeq(null)}
        />
      );
    })() : null}
    {feedbackOpen ? (
      <FeedbackModal
        entries={feedbackEntries}
        theme={selected?.theme ?? null}
        currentPage={typeof window !== "undefined" ? window.location.pathname : "/"}
        characterName={selected?.name}
        status={feedbackStatus}
        busy={feedbackBusy}
        onClose={() => setFeedbackOpen(false)}
        onSubmit={submitFeedback}
      />
    ) : null}
    <main className="builder-shell">
      <header className="builder-topbar">
        <div className="builder-brand">
          <div className="brand-glyph">
            <Sparkles size={21} />
          </div>
          <div>
            <span>Forge & Fable</span>
            <strong>Character Studio</strong>
          </div>
        </div>
        <div className="builder-actions">
          {status ? <span className="system-status">{status}</span> : null}
          <span className="account-chip">
            <UserRound size={16} />
            {user.name}
          </span>
          <button className="glass-icon" type="button" onClick={openFeedback} title="Submit feedback">
            <MessageSquare size={18} />
          </button>
          <button className="glass-icon" type="button" onClick={logOut} title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="builder-layout">
        <aside className="vault-rail">
          <div className="rail-heading">
            <span>Vault</span>
            <button
              type="button"
              className="glass-icon"
              title="New character"
              onClick={() => {
                setCreationPromptOpen(true);
                setCreatorOpen(false);
              }}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="vault-list">
            {characters.map((character) => {
              const race = ruleset.races.find((item) => item.id === character.raceId);
              const heroClass = ruleset.classes.find((item) => item.id === character.classId);
              return (
                <button
                  type="button"
                  className={`vault-avatar ${character.id === selected?.id ? "active" : ""}`}
                  key={character.id}
                  onClick={() => {
                    setSelectedId(character.id);
                    setCreationPromptOpen(false);
                    setCreatorOpen(false);
                  }}
                >
                  <span data-class={heroClass?.id ?? ""}>
                    <ClassIconPlaceholder classId={heroClass?.id ?? ""} size={24} strokeWidth={1.7} />
                  </span>
                  <strong>{character.name}</strong>
                  <small>
                    {race?.name} {heroClass?.name}
                  </small>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="studio-surface">
          {buildMode !== "standard" && !creatorOpen ? (
            ruleset ? (
              <QuickbuilderPanel
                ruleset={ruleset}
                mode={buildMode}
                onComplete={handleQuickbuildComplete}
                onCancel={() => { setCreationPromptOpen(true); setBuildMode("standard"); }}
              />
            ) : (
              <div className="paper-surface dj-start" style={{ display: "grid", placeItems: "center", padding: 48 }}>
                <p className="cs-muted">Loading...</p>
              </div>
            )
          ) : showCreationPrompt ? (
            <CharacterStartPanel onSelectBuild={beginBuild} />
          ) : showCreator && draftFinalAbilities ? (
            <CreatorPanel
              draft={draft}
              finalAbilities={draftFinalAbilities}
              ruleset={ruleset}
              buildMode={buildMode}
              step={creatorStep}
              statMethod={statMethod}
              pointRemaining={pointRemaining}
              standardAssignments={standardAssignments}
              rolledScores={rolledScores}
              rolledAssignments={rolledAssignments}
              onDraftChange={setDraft}
              onStepChange={setCreatorStep}
              onMethodChange={changeStatMethod}
              onPointBuyChange={changePointBuy}
              onAssignmentChange={setAssignment}
              onRollStats={rollStatBlock}
              onRollStartingHp={rollStartingHp}
              onCreate={createHero}
            />
          ) : selected && selectedFinalAbilities ? (
            <HeroSheet
              character={selected}
              finalAbilities={selectedFinalAbilities}
              ruleset={ruleset}
              featInitiativeBonus={selectedFeatBonuses?.initiativeBonus}
              featAcBonus={selectedFeatBonuses?.acBonus}
              onRoll={pushRoll}
              onRollPool={pushPool}
              onRollD20={pushD20}
              onUpdate={updateSelected}
              onDelete={deleteSelected}
              onNotify={setStatus}
              consoleInput={consoleInput}
              consoleLog={consoleLog}
              onConsoleInput={setConsoleInput}
              onConsoleSubmit={executeConsole}
            />
          ) : null}
        </section>
      </section>
    </main>
    </>
  );
}
