"use client";

import {
  ChevronDown,
  Hammer,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Swords,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import HomeDashboard from "@/components/HomeDashboard";
import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type {
  AbilityKey,
  AbilityScores,
  ASIChoice,
  AuthMode,
  BuildMode,
  Character,
  CharacterPatch,
  CharacterEffect,
  CharacterSnapshot,
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
  signed,
  standardArray,
} from "@/lib/utils";
import SplashScreen from "@/components/SplashScreen";
import AuthScreen from "@/components/AuthScreen";
import CharacterStartPanel from "@/components/CharacterStartPanel";
import AdminPanel from "@/components/AdminPanel";
import NotificationInbox from "@/components/NotificationInbox";
import type { FeedbackInput } from "@/components/FeedbackModal";
import CampaignTableStrip from "@/components/CampaignTableStrip";
import { cantripsKnownAt, loadSpells } from "@/lib/spells";
import { getClassData } from "@/lib/subclasses";
import { buildClassLevelUpPlan } from "@/lib/progression/engine";
import { progressionPatchForCharacter } from "@/lib/progression/state";
import type { RollingDie } from "@/components/DiceRollOverlay";
import type { RollHistoryEntry } from "@/components/RollDrawer";
import { SaveStatusBadge, type SaveStatus } from "@/components/SaveStatusBadge";
import { postCampaignEvent as postCampaignEventApi, updateCampaignInitiative as updateCampaignInitiativeApi, submitCampaignInitiativeRoll as submitCampaignInitiativeRollApi, postCampaignRoll } from "@/lib/client/campaignApi";
import { FONT_STACKS } from "@/lib/skins";
import { ordinalLevel } from "@/lib/ledgerCopy";
import { POINT_BUY_BUDGET, SPLASH_DURATION_MS } from "@/lib/constants";
import { computeFeatBonuses } from "@/lib/featBonuses";
import { applyCreationHpBonuses } from "@/lib/derivedStats";
import { activeD20Riders, effectTotal, effectiveAdvantageMode } from "@/lib/effects";
import { combineRollModes, rollRequestDescriptor, rollRequestMode, summarizeRollRequest } from "@/lib/rollRequest";
import { BACKGROUND_SKILLS, SAVE_PROFICIENCIES, SKILLS } from "@/lib/srd";
import type { CampaignEvent, CampaignSyncPayload, InitiativeState } from "@/types/campaign";
import { CharacterApiError, updateCharacter as updateCharacterApi } from "@/lib/client/charactersApi";
import { CharacterSaveCoordinator } from "@/lib/client/characterSaveCoordinator";
import { patchFromSnapshot } from "@/lib/characterSnapshots";
import { encodeCampaignCursor, type CampaignCursorState } from "@/lib/campaignCursor";
import { formatCampaignHash, parseCampaignHash, type CampaignSection } from "@/lib/campaignRoute";
import { dmToolsApi } from "@/lib/client/dmToolsApi";
import { longRestRecovery } from "@/lib/restRecovery";
import { deathSavePatch, type DeathSaveAction } from "@/lib/deathSaves";

const CreatorPanel = dynamic(() => import("@/components/CreatorPanel"), { ssr: false });
const FeedbackModal = dynamic(() => import("@/components/FeedbackModal"), { ssr: false });
const CampaignPanel = dynamic(() => import("@/components/CampaignPanel"), { ssr: false });
const CampaignWorkspacePage = dynamic(() => import("@/components/campaign/CampaignWorkspacePage"), { ssr: false });
const DMTablePanel = dynamic(() => import("@/components/DMTablePanel"), { ssr: false });
const PlayerDMTablePanel = dynamic(() => import("@/components/PlayerDMTablePanel"), { ssr: false });
const CharacterImportModal = dynamic(() => import("@/components/CharacterImportModal"), { ssr: false });
const QuickbuilderPanel = dynamic(() => import("@/components/QuickbuilderPanel"), { ssr: false });
const HeroSheet = dynamic(() => import("@/components/HeroSheet"), { ssr: false });
const LevelUpModal = dynamic(() => import("@/components/LevelUpModal"), { ssr: false });
const DiceRollOverlay = dynamic(() => import("@/components/DiceRollOverlay"), { ssr: false });
const RollDrawer = dynamic(() => import("@/components/RollDrawer"), { ssr: false });
const AccountDataModal = dynamic(() => import("@/components/AccountDataModal"), { ssr: false });

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
  skillExpertise?: string[];
  featureChoices?: Character["featureChoices"];
  featureResources?: Character["featureResources"];
  alwaysPreparedSpells?: string[];
  spellbookSpells?: string[];
  progressionState?: Character["progressionState"];
};

type CreationSeqState = { levels: number[]; index: number; soFar: CreationChoices };

/** Levels 1..target that require a player choice when starting above level 1:
    subclass, ASI/feat, a spell pick for known casters, or a cantrip gain (any
    caster with cantrips — prepared casters included, e.g. cleric at 4/10).
    Level 1 is included only for level-1-subclass classes (sorcerer/warlock/
    cleric) so a high-level start still picks its origin. HP-only levels are
    skipped — the creator already computes starting HP for the chosen level. */
function creationChoiceLevels(heroClass: HeroClass, targetLevel: number, raceId?: string): number[] {
  const plan = buildClassLevelUpPlan({ ruleset: "2014", classId: heroClass.id, fromLevel: 0, toLevel: targetLevel });
  const levels = plan.choices.map((choice) => choice.level);
  for (let level = 1; level <= targetLevel; level += 1) {
    if (cantripsKnownAt(heroClass.id, level) > cantripsKnownAt(heroClass.id, level - 1)) levels.push(level);
  }
  if (raceId === "high-elf-legacy" && targetLevel >= 1) levels.push(1);
  return Array.from(new Set(levels)).sort((a, b) => a - b);
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
  const [impersonationActor, setImpersonationActor] = useState<PublicUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [creationPromptOpen, setCreationPromptOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorStep, setCreatorStep] = useState(0);
  const [buildMode, setBuildMode] = useState<BuildMode>("standard");
  const [draft, setDraft] = useState<DraftCharacter | null>(null);
  // null = the player has not chosen an attribute method yet (Chapter VI
  // starts at the method decision; an untouched chapter is not "decided").
  const [statMethod, setStatMethod] = useState<StatMethod | null>(null);
  const [standardAssignments, setStandardAssignments] = useState(defaultAssignments);
  const [rolledScores, setRolledScores] = useState([15, 14, 13, 12, 10, 8]);
  const [rolledAssignments, setRolledAssignments] = useState(defaultAssignments);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLog, setConsoleLog] = useState<string[]>(["Console online"]);
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (typeof window === "undefined") return "register";
    return new URLSearchParams(window.location.search).has("resetToken") ? "reset" : "register";
  });
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authInviteCode, setAuthInviteCode] = useState("");
  const [authResetToken, setAuthResetToken] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("resetToken") ?? "" : "",
  );
  const [status, setStatus] = useState("");
  const [toasts, setToasts] = useState<{ id: string; kind: "announce" | "condition" | "turn"; title: string; body?: string; sourceId?: string }[]>([]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const value = JSON.parse(window.localStorage.getItem("forge-and-fable-dismissed-announcements") ?? "[]");
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(-100) : [];
    } catch { return []; }
  });

  function pushToast(kind: "announce" | "condition" | "turn", title: string, body?: string, sourceId?: string) {
    if (kind === "announce" && sourceId && dismissedAnnouncementIds.includes(sourceId)) return;
    const id = crypto.randomUUID();
    setToasts((current) => {
      // A campaign can replay the same event while the sync cursor catches up.
      // Keep the toast stack readable instead of showing identical notices side by side.
      if (current.some((toast) => toast.kind === kind && toast.title === title && toast.body === body)) return current;
      return [...current.slice(-3), { id, kind, title, body, sourceId }];
    });
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, kind === "announce" ? 9000 : 6000);
  }
  function dismissToast(toast: { id: string; kind: "announce" | "condition" | "turn"; sourceId?: string }) {
    setToasts((current) => current.filter((item) => item.id !== toast.id));
    if (toast.kind !== "announce" || !toast.sourceId) return;
    setDismissedAnnouncementIds((current) => {
      const next = [...new Set([...current, toast.sourceId!])].slice(-100);
      window.localStorage.setItem("forge-and-fable-dismissed-announcements", JSON.stringify(next));
      return next;
    });
  }
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // A #/campaigns/<id>[/<section>] deep link (handoff §1, §20) opens the
  // campaign workspace directly — the hash beats the remembered campaign.
  const [campaignOpen, setCampaignOpen] = useState(
    () => typeof window !== "undefined" && parseCampaignHash(window.location.hash) !== null,
  );
  // The DM's live table (DMTablePanel) is an overlay above the campaign
  // workspace, launched by "Prepare Session" / "Open DM Screen" (handoff §2.3:
  // live controls belong at the Table, not on the campaign page).
  const [dmTableOpen, setDmTableOpen] = useState(false);
  const [dmTablePreparationTab, setDmTablePreparationTab] = useState<"encounters" | "sessions" | "handouts">("encounters");
  const [campaignSection, setCampaignSection] = useState<CampaignSection>(
    () => (typeof window !== "undefined" ? parseCampaignHash(window.location.hash)?.section : undefined) ?? "overview",
  );
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountDataOpen, setAccountDataOpen] = useState(false);
  const [charactersLoadedForUser, setCharactersLoadedForUser] = useState<string | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(
    () => typeof window !== "undefined"
      ? parseCampaignHash(window.location.hash)?.campaignId ?? localStorage.getItem("forge-and-fable-active-campaign")
      : null,
  );
  const [campaignSync, setCampaignSync] = useState<CampaignSyncPayload | null>(null);
  const [campaignEvents, setCampaignEvents] = useState<CampaignEvent[]>([]);
  const [resolvedCampaignEvents, setResolvedCampaignEvents] = useState<Set<string>>(() => new Set());
  const [readOnlyViewChar, setReadOnlyViewChar] = useState<Character | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  useEffect(() => {
    if (!headerMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".ao-header-menu-wrap")) setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [headerMenuOpen]);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([]);
  const [flyingDice, setFlyingDice] = useState<RollingDie[]>([]);
  const [rollHistory, setRollHistory] = useState<RollHistoryEntry[]>([]);
  // Manual drawer selection (null = no override, use the effect-driven mode).
  // An explicit pick wins for exactly one roll, then reverts to null.
  const [manualRollMode, setManualRollMode] = useState<RollMode | null>(null);
  const [creationSeq, setCreationSeq] = useState<CreationSeqState | null>(null);
  const [spellsReady, setSpellsReady] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveCoordinatorRef = useRef<CharacterSaveCoordinator | null>(null);
  if (!saveCoordinatorRef.current) {
    saveCoordinatorRef.current = new CharacterSaveCoordinator({
      send: updateCharacterApi,
      onSaved: (characterId, serverCharacter) => {
        setCharacters((current) => current.map((character) =>
          character.id === characterId
            ? { ...character, revision: serverCharacter.revision }
            : character,
        ));
        setSaveStatus("saved");
        window.setTimeout(() => {
          setSaveStatus((current) => current === "saved" ? "idle" : current);
        }, 1800);
      },
      onRebase: (characterId, serverCharacter, optimisticPatch) => {
        setCharacters((current) => current.map((character) =>
          character.id === characterId
            ? { ...serverCharacter, ...optimisticPatch, revision: serverCharacter.revision }
            : character,
        ));
      },
      onError: (_characterId, error) => {
        if (error instanceof CharacterApiError && error.status === 401) {
          logOut();
          setStatus("Session expired — please log in again.");
        } else {
          setStatus(error instanceof Error ? error.message : "Connection lost — changes not saved.");
        }
        setSaveStatus("error");
        window.setTimeout(() => {
          setSaveStatus((current) => current === "error" ? "idle" : current);
        }, 3200);
      },
    });
  }
  const sessionSnapshotCreated = useRef(false);
  const campaignCursorRef = useRef<Record<string, CampaignCursorState>>({});
  const campaignSyncFailRef = useRef<number>(0);
  const processedCampaignEventsRef = useRef<Set<string>>(new Set());
  const lastTurnCombatantRef = useRef<string | null>(null);

  const recordHistory = (
    label: string,
    detail: string,
    total: number,
    adv?: RollHistoryEntry["adv"],
    nat?: RollHistoryEntry["nat"],
    pool?: RollHistoryEntry["pool"],
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
        ...(pool ? { pool } : {}),
      },
      ...prev,
    ].slice(0, 100));

    // Share roll to campaign feed and merge immediately so it appears
    // in the Record/feed without waiting for the next sync poll.
    const campaignId = activeCampaignId;
    if (campaignId && selected?.name) {
      postCampaignRoll(campaignId, label, detail, total, selected.name)
        .then((roll) => {
          setCampaignSync((current) => {
            if (!current || current.campaign.id !== campaignId) return current;
            const rollById = new Map(current.rolls.map((r) => [r.id, r]));
            rollById.set(roll.id, roll);
            const merged = Array.from(rollById.values())
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .slice(-200);
            return { ...current, rolls: merged };
          });
        })
        .catch(() => {
          setStatus("Roll completed locally but could not be shared.");
        });
    }
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

  // Handle verification redirects — check URL params on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    if (verified === "1") {
      queueMicrotask(() => {
        setStatus("Email verified! You may now log in.");
        setAuthMode("login");
      });
      // Clean up the URL so the param doesn't linger on refresh.
      window.history.replaceState(null, "", "/");
    } else if (verified === "error") {
      queueMicrotask(() => setStatus("Verification link is invalid or expired."));
      window.history.replaceState(null, "", "/");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    void fetch("/api/auth/profile", { headers: authHeaders() }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { user?: PublicUser; impersonating?: PublicUser | null };
      if (data.user) {
        setUser(data.user);
        window.localStorage.setItem("forge-and-fable-user", JSON.stringify(data.user));
      }
      setImpersonationActor(data.impersonating ?? null);
    }).catch(() => {});

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
        setCharactersLoadedForUser(user.id);
      })
      .catch((error: Error) => {
        if (mounted) {
          setStatus(error.message);
          setCharactersLoadedForUser(user.id);
        }
      })

    return () => {
      mounted = false;
    };
  }, [user]);

  const charactersLoading = Boolean(user && charactersLoadedForUser !== user.id);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? characters[0] ?? null,
    [characters, selectedId],
  );

  function setActiveCampaign(id: string | null) {
    setActiveCampaignId(id);
    setCampaignSync(null);
    setCampaignEvents([]);
    lastTurnCombatantRef.current = null;
    if (id) {
      localStorage.setItem("forge-and-fable-active-campaign", id);
      // Cursor is session-memory only. Event application is idempotent, so a
      // full-history fetch on the first sync of a session is safe — and it is
      // the only way pushes sent while this client was away are ever applied.
      delete campaignCursorRef.current[id];
    } else {
      localStorage.removeItem("forge-and-fable-active-campaign");
    }
  }

  function parseCampaignPayload(event: CampaignEvent): Record<string, unknown> {
    try {
      const parsed = JSON.parse(event.payload);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  function rememberCampaignEvents(events: CampaignEvent[]) {
    if (events.length === 0) return;
    setCampaignEvents((current) => {
      const byId = new Map(current.map((event) => [event.id, event]));
      for (const event of events) byId.set(event.id, event);
      return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-80);
    });
  }

  /**
   * Apply campaign events. Conditions target the character ENROLLED in the
   * campaign (from the sync membership), never whichever sheet happens to be
   * open. Returns the created_at of the last event fully handled — the sync
   * loop must not advance its cursor past an unhandled condition event.
   */
  const processCampaignEvents = useEffectEvent((events: CampaignEvent[], members: CampaignSyncPayload["members"], options?: { notifyTransient?: boolean }): CampaignEvent | null => {
    if (events.length === 0) return null;
    const notifyTransient = options?.notifyTransient ?? true;
    const myMembership = members?.find((member) => member.userId === user?.id);
    const myCharacter = myMembership?.characterId
      ? characters.find((character) => character.id === myMembership.characterId) ?? null
      : null;
    let nextEffects = myCharacter?.effects ?? [];
    let changedEffects = false;
    let lastHandled: CampaignEvent | null = null;

    for (const event of events) {
      const payload = parseCampaignPayload(event);

      if (event.type === "condition-apply" || event.type === "condition-remove") {
        // Enrolled character not loaded yet — hold the cursor here and retry
        // on a later tick rather than consuming the event unapplied.
        if (!myCharacter) break;
        const label = typeof payload.label === "string" ? payload.label.trim() : "";
        if (label && event.type === "condition-apply") {
          const exists = nextEffects.some((effect) => effect.source === "DM" && effect.label.toLowerCase() === label.toLowerCase());
          if (!exists) {
            nextEffects = [
              ...nextEffects,
              {
                ...(payload as Partial<CharacterEffect>),
                id: `dm-${event.id}`,
                label,
                source: "DM",
                active: true,
              } as CharacterEffect,
            ];
            changedEffects = true;
            if (notifyTransient && !processedCampaignEventsRef.current.has(event.id)) {
              pushToast("condition", `DM applied ${label}`, myCharacter.name);
            }
          }
        } else if (label && event.type === "condition-remove") {
          const filtered = nextEffects.filter((effect) => !(effect.source === "DM" && effect.label.toLowerCase() === label.toLowerCase()));
          if (filtered.length !== nextEffects.length) {
            nextEffects = filtered;
            changedEffects = true;
            if (notifyTransient && !processedCampaignEventsRef.current.has(event.id)) {
              pushToast("condition", `DM removed ${label}`, myCharacter.name);
            }
          }
        }
      } else if (event.type === "announce") {
        const message = typeof payload.message === "string" ? payload.message.trim() : "";
        if (notifyTransient && message && !processedCampaignEventsRef.current.has(event.id)) {
          pushToast("announce", message, undefined, event.id);
        }
      } else if (event.type === "roll-request") {
        // The Roll button lives in the campaign panel; surface the ask so a
        // player on their sheet knows to open it — with the full description
        // (what, advantage, revealed DC).
        if (notifyTransient && !processedCampaignEventsRef.current.has(event.id)) {
          pushToast("turn", "The DM asks for a roll", summarizeRollRequest(payload));
        }
      } else if (event.type === "concentration-end" || event.type === "death-save-update") {
        if (!myCharacter) break;
        if (event.type === "concentration-end") {
          void updateCharacterById(myCharacter.id, { concentratingOn: null });
          if (notifyTransient && !processedCampaignEventsRef.current.has(event.id)) pushToast("condition", "Concentration ended", myCharacter.name);
        } else {
          const action = typeof payload.action === "string" ? payload.action as DeathSaveAction : "reset";
          const amount = typeof payload.amount === "number" ? payload.amount : 0;
          void updateCharacterById(myCharacter.id, deathSavePatch(myCharacter, action, amount));
          if (notifyTransient && !processedCampaignEventsRef.current.has(event.id)) pushToast("condition", `Death saves: ${action.replaceAll("-", " ")}`, myCharacter.name);
        }
      } else if (event.type === "handout") {
        // Handouts are durable inbox items now. Do not replay them as a
        // centered login modal or transient toast; the global bell is the
        // single notification surface.
      }

      processedCampaignEventsRef.current.add(event.id);
      lastHandled = event;
    }

    if (changedEffects && myCharacter) {
      void updateCharacterById(myCharacter.id, { effects: nextEffects });
    }
    return lastHandled;
  });

  const effectDrivenMode = effectiveAdvantageMode(selected?.effects);
  const rollMode = manualRollMode ?? effectDrivenMode;
  const rollModeIsFromEffect = manualRollMode === null && effectDrivenMode !== "normal";
  // Clicking the mode that's already driven by an active effect just clears
  // the (nonexistent) override; clicking anything else arms a one-roll
  // override, including "normal" to cancel out an effect's disadvantage.
  const setRollMode = (mode: RollMode) => setManualRollMode(mode === effectDrivenMode ? null : mode);

  const diceAccent = selected?.theme?.accent ?? "#b3924a";
  const diceFont = selected?.theme ? FONT_STACKS[selected.theme.fontKey] : "var(--font-role-body, Georgia, serif)";

  const vaultThemeVars = useMemo(() => {
    const theme = selected?.theme;
    if (!theme) return undefined;
    return {
      "--paper": theme.paper,
      "--ink": theme.ink,
      "--ink-2": `color-mix(in srgb, ${theme.ink} 65%, ${theme.paper})`,
      "--ink-3": `color-mix(in srgb, ${theme.ink} 45%, ${theme.paper})`,
      "--doc-accent": theme.accent,
    } as CSSProperties;
  }, [selected?.theme]);

  // Observatory landing (AO-6): Home is the default screen; the roster/sheet
  // cascade is the "Hero" screen. Pure view state — no flow logic moved here.
  const [homeOpen, setHomeOpen] = useState(true);
  // Campaign list access while enrolled: forces CampaignPanel's list view so
  // a DM (or player) can create/join/delete/leave without detaching first.
  const [campaignListOpen, setCampaignListOpen] = useState(false);
  const [scheduleSessionOpen, setScheduleSessionOpen] = useState(false);

  // Back/forward navigation (handoff §20): the campaign workspace mirrors
  // itself into the URL hash as #/campaigns/<id>[/<section>], so popstate
  // re-applies whatever route the history entry holds. Initial deep links are
  // adopted in the state initialisers where campaignOpen / campaignSection /
  // activeCampaignId are declared.
  const applyCampaignRoute = useEffectEvent((hash: string) => {
    const route = parseCampaignHash(hash);
    if (route) {
      if (route.campaignId !== activeCampaignId) setActiveCampaign(route.campaignId);
      setCampaignSection(route.section);
      setCampaignOpen(true);
      setCampaignListOpen(false);
    } else {
      setCampaignOpen(false);
      setDmTableOpen(false);
    }
  });
  useEffect(() => {
    const onPop = () => applyCampaignRoute(window.location.hash);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const current = window.location.hash;
    if (campaignOpen && activeCampaignId) {
      const next = formatCampaignHash(activeCampaignId, campaignSection);
      if (current !== next) window.history.pushState(null, "", next);
    } else if (parseCampaignHash(current)) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
  }, [campaignOpen, activeCampaignId, campaignSection]);
  // Derived from the campaign/workshop panel's open state: when it closes the
  // value flips, so the home dashboard refetches sessions and a session
  // scheduled in the workshop appears on the front page without a full reload.
  // (Derivation avoids a set-state-in-effect; the panel renders behind Home.)
  const homeRefreshKey = campaignOpen ? 1 : 0;

  const showCreationPrompt = creationPromptOpen || (!creatorOpen && characters.length === 0);
  // The context-aware home dashboard (AO-16) is the login destination for
  // every account, including empty ones — the old "What brings you to the
  // table?" role-choice gate was retired so returning users are never asked
  // to pick a role again. The dashboard's new-user state covers first use.
  const showCreator = creatorOpen;
  const selectedFinalAbilities = useMemo(() => {
    if (!selected || !ruleset) {
      return null;
    }
    const raced = applyRaceBonuses(selected.abilities, selected.raceId, ruleset);
    // Apply player-chosen racial ability bonuses (e.g. Half-Elf's +1 to two abilities)
    const raceChoices = selected.raceBonusChoices;
    if (raceChoices) {
      for (const key of abilityKeys) {
        const bonus = raceChoices[key] ?? 0;
        if (bonus > 0) raced[key] += bonus;
      }
    }
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
    const ruleInit = (selected.customRules ?? [])
      .filter((rule) => rule.type === "initiative")
      .reduce((sum, rule) => sum + rule.value, 0);
    return (
      abilityModifier(selectedFinalAbilities.dexterity) +
      ruleInit +
      (selectedFeatBonuses?.initiativeBonus ?? 0) +
      effectTotal(selected.effects, "initiative")
    );
  }, [selected, selectedFinalAbilities, selectedFeatBonuses]);

  const filteredVaultChars = characters;

  useEffect(() => {
    if (!user || !activeCampaignId) return;
    // Poll whenever a campaign is active — pushes must reach a player on
    // their sheet, not only while the campaign panel is open. Cadence is
    // faster with the panel open; hidden tabs pause below.
    let cancelled = false;
    let inFlight = false;

    const sync = async () => {
      if (inFlight) return;
      inFlight = true;
      const cursors = campaignCursorRef.current[activeCampaignId];
      const search = new URLSearchParams();
      if (cursors?.events) search.set("eventCursor", cursors.events);
      if (cursors?.rolls) search.set("rollCursor", cursors.rolls);
      search.set("visibility", document.visibilityState === "hidden" ? "hidden" : "visible");
      const query = search.toString();
      const url = `/api/campaigns/${activeCampaignId}/sync${query ? `?${query}` : ""}`;
      try {
        const res = await fetch(url, {
          headers: authHeaders(),
        });
        if (!res.ok) {
          // Only a definitive "you're not in this campaign" answer should
          // deactivate; a transient 5xx must not eject the player.
          if (!cancelled && (res.status === 404 || res.status === 403 || res.status === 401)) {
            setActiveCampaign(null);
            setCampaignOpen(false);
            setDmTableOpen(false);
          }
          return;
        }
        const data = await res.json() as CampaignSyncPayload;
        if (cancelled) return;
        campaignSyncFailRef.current = 0;
        // Accumulate rolls by id across syncs — the server returns a delta
        // (created_at > since), but the Record and Roll Feed need the full
        // list so rolls don't vanish as the cursor advances.
        setCampaignSync((current) => {
          if (!current || current.campaign.id !== data.campaign.id) return data;
          const rollById = new Map(current.rolls.map((r) => [r.id, r]));
          for (const roll of data.rolls) rollById.set(roll.id, roll);
          const merged = Array.from(rollById.values())
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .slice(-200);
          return { ...data, rolls: merged };
        });
        rememberCampaignEvents(data.events);
        const hasEventCursor = Boolean(cursors?.events);
        const lastHandled = processCampaignEvents(data.events, data.members, { notifyTransient: hasEventCursor });

        const myTurnId = user.id ? `player:${user.id}` : null;
        const sorted = [...data.initiative.data.combatants].sort((a, b) => b.initiative - a.initiative);
        const currentCombatant = sorted[data.initiative.data.turnIndex]?.id ?? null;
        if (hasEventCursor && myTurnId && currentCombatant === myTurnId && lastTurnCombatantRef.current !== currentCombatant) {
          pushToast("turn", "Your turn!", `Round ${data.initiative.data.round}`);
        }
        lastTurnCombatantRef.current = currentCombatant;

        // Advance the cursor only through what was actually handled. If a
        // condition event could not be applied yet, everything from it onward
        // is refetched next tick (application is idempotent, so replays are
        // harmless). Roll timestamps may only advance the cursor when every
        // event in this batch was handled.
        const nextCursors = { ...(campaignCursorRef.current[activeCampaignId] ?? {}) };
        if (lastHandled) nextCursors.events = encodeCampaignCursor(lastHandled);
        const lastRoll = data.rolls.at(-1);
        if (lastRoll) nextCursors.rolls = encodeCampaignCursor(lastRoll);
        campaignCursorRef.current[activeCampaignId] = nextCursors;
      } catch {
        // Track consecutive sync failures to surface sustained outages.
        campaignSyncFailRef.current = (campaignSyncFailRef.current ?? 0) + 1;
        if (campaignSyncFailRef.current >= 3) {
          setStatus("Campaign sync interrupted — check your connection.");
        }
      } finally {
        inFlight = false;
      }
    };

    sync();
    const interval = window.setInterval(sync, campaignOpen ? 5000 : 10000);
    const onVisibility = () => { void sync(); };
    const onPageHide = () => {
      navigator.sendBeacon(
        `/api/campaigns/${activeCampaignId}/presence`,
        new Blob([JSON.stringify({ visibility: "hidden" })], { type: "application/json" }),
      );
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  // pushToast is intentionally scoped to this component; the sync loop only
  // needs the current campaign/user inputs and should not restart on each
  // announcement-state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaignId, user, campaignOpen]);

  // Auto-snapshot on session load (once per session)
  useEffect(() => {
    if (!selected || sessionSnapshotCreated.current || !user) return;
    sessionSnapshotCreated.current = true;
    const label = `Session start — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    createSnapshot(label);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, user]);

  const draftFinalAbilities = useMemo(() => {
    if (!draft || !ruleset) {
      return null;
    }
    const raced = applyRaceBonuses(draft.abilities, draft.raceId, ruleset);
    // Apply player-chosen racial bonuses (e.g. Half-Elf's +1 to two abilities)
    const raceChoices = draft.raceBonusChoices;
    if (raceChoices) {
      for (const key of abilityKeys) {
        const bonus = raceChoices[key] ?? 0;
        if (bonus > 0) raced[key] += bonus;
      }
    }
    return raced;
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
      const endpoint = authMode === "login"
        ? "/api/auth/login"
        : authMode === "register"
          ? "/api/auth/register"
          : authMode === "forgot"
            ? "/api/auth/forgot-password"
            : "/api/auth/reset-password";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(authMode === "reset"
            ? { token: authResetToken, password: authPassword }
            : { email: authEmail, ...(authMode === "login" || authMode === "register" ? { password: authPassword } : {}) }),
          ...(authMode === "register" ? { inviteCode: authInviteCode, name: authDisplayName } : {}),
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned ${response.status} instead of JSON. Reopen the app from its active address.`);
      }
      const data = (await response.json()) as { user?: PublicUser; message?: string; error?: string };

      if (!response.ok) {
        setStatus(data.error ?? "Vault access failed.");
        return;
      }

      // Registration now returns a message (check your email) instead of a user.
      // The user must verify their email before logging in.
      if (data.message && !data.user) {
        setStatus(data.message);
        if (authMode === "register") setAuthDisplayName("");
        if (authMode === "register" || authMode === "reset") setAuthMode("login");
        if (authMode === "reset") {
          setAuthResetToken("");
          window.history.replaceState({}, "", window.location.pathname);
        }
        return;
      }

      // Login returns a user object as before.
      if (data.user) {
        setUser(data.user);
        setCharactersLoadedForUser(null);
        window.localStorage.setItem("forge-and-fable-user", JSON.stringify(data.user));
        setAuthInviteCode("");
        setStatus(authMode === "login" ? "Tome opened" : "Account inscribed");
        return;
      }

      setStatus("Unexpected response from server.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Network error — please try again.");
    }
  }

  async function resendVerification() {
    const email = authEmail.trim();
    if (!email) {
      setStatus("Enter your email address first.");
      return;
    }

    setStatus("");
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json() as { message?: string };
      setStatus(data.message ?? "If the account is unverified, a new link has been sent.");
    } catch {
      setStatus("Network error — please try again.");
    }
  }

  function logOut() {
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    saveCoordinatorRef.current?.reset();
    setUser(null);
    setImpersonationActor(null);
    setCharactersLoadedForUser(null);
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
      setStatMethod(null);
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
    setCreatorStep(6); // Finalize step (The Seal — after the Likeness chapter was added)
    setCreatorOpen(true);
    setBuildMode("standard");
  }

  function changeStatMethod(method: StatMethod) {
    setStatMethod(method);

    if (method === "point-buy") {
      setDraft((current) => (current ? { ...current, abilities: { ...emptyAbilities } } : current));
      return;
    }

    if (method === "manual") {
      // Keep current scores — user will edit them manually
      return;
    }

    if (method === "roll") {
      // No silent pre-roll: the chapter's Roll action casts real dice
      // (rollStatBlock) and the step stays incomplete until they land.
      setRolledScores([]);
      setRolledAssignments(defaultAssignments());
      setDraft((current) => (current ? { ...current, abilities: { ...emptyAbilities } } : current));
      return;
    }

    const nextAssignments = defaultAssignments();
    setStandardAssignments(nextAssignments);
    setDraft((current) =>
      current
        ? {
            ...current,
            abilities: abilityKeys.reduce((scores, key) => {
              scores[key] = standardArray[nextAssignments[key]];
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

  function changeManualAbility(ability: AbilityKey, value: number) {
    if (!draft || statMethod !== "manual") return;
    const clamped = Math.max(3, Math.min(20, Math.trunc(value)));
    setDraft({
      ...draft,
      abilities: { ...draft.abilities, [ability]: clamped },
    });
  }

  function rollStatBlock() {
    // Six ability scores as one physical flight of 4d6-drop-lowest groups —
    // the same 3D dice the sheet rolls, with each group's lowest die dimmed
    // like an adv/dis discard. Scores apply once every die has settled (or
    // the flight is click-dismissed, which flushes every onFinish).
    const groups = Array.from({ length: 6 }, () => Array.from({ length: 4 }, () => rollDie(6)));
    const scoreOf = (dice: number[]) => dice.reduce((sum, value) => sum + value, 0) - Math.min(...dice);
    const scores = groups.map(scoreOf).sort((a, b) => b - a);

    const summary = scores.join(" · ");
    const detail = groups
      .map((dice) => {
        const dropIndex = dice.indexOf(Math.min(...dice));
        const parts = dice.map((value, i) => (i === dropIndex ? `~~${value}~~` : String(value)));
        return `[${parts.join(", ")}] = ${scoreOf(dice)}`;
      })
      .join("  ");

    const applyScores = () => {
      const nextAssignments = defaultAssignments();
      setRolledScores(scores);
      setRolledAssignments(nextAssignments);
      setDraft((current) =>
        current
          ? {
              ...current,
              abilities: abilityKeys.reduce((abilities, key) => {
                abilities[key] = scores[nextAssignments[key]];
                return abilities;
              }, {} as AbilityScores),
            }
          : current,
      );
    };

    const totalDice = groups.length * 4;
    let settled = 0;
    const newDice: RollingDie[] = [];
    groups.forEach((dice, groupIndex) => {
      const dropIndex = dice.indexOf(Math.min(...dice));
      dice.forEach((value, dieIndex) => {
        const flightIndex = groupIndex * 4 + dieIndex;
        const fromLeft = Math.random() > 0.5;
        const dropped = dieIndex === dropIndex;
        newDice.push({
          id: `${crypto.randomUUID()}-${flightIndex}`,
          sides: 6,
          result: value,
          label: "Ability Scores",
          lingerMs: NORMAL_ROLL_LINGER_MS,
          fromLeft,
          startYPct: 0.15 + Math.random() * 0.35,
          landXPct: 0.22 + Math.random() * 0.56,
          landYPct: 0.25 + Math.random() * 0.38,
          rotations: (fromLeft ? 1 : -1) * (2 + Math.floor(Math.random() * 3)) * 360,
          delayMs: flightIndex * 90,
          dropped,
          onFinish: () => {
            settled += 1;
            if (settled === totalDice) {
              applyScores();
            }
          },
        });
      });
    });
    // The score readout rides the last kept die so it appears as the flight ends.
    const lastKeptIndex = newDice.reduce((last, die, i) => (die.dropped ? last : i), -1);
    newDice.forEach((die, i) => {
      die.resultSummary = die.dropped ? "Dropped" : i === lastKeptIndex ? summary : undefined;
      die.resultDetail = die.dropped ? String(die.result) : i === lastKeptIndex ? detail : undefined;
    });

    setConsoleLog((prev) => [`Ability Scores -> ${detail}`, ...prev].slice(0, 20));
    recordHistory("Ability Scores", detail, scores.reduce((sum, value) => sum + value, 0));
    setFlyingDice((prev) => [...prev, ...newDice]);
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

    // The roll's flat modifier is the Constitution bonus applied once per level
    // (con mod × levels). Spell it out in the label so a negative Con doesn't
    // read as "starting HP is -2" — it's the per-level Con adjustment.
    const conMod = request.constitutionModifier;
    const conNote = conMod === 0 ? "" : ` (Con ${conMod > 0 ? "+" : ""}${conMod}/level)`;
    pushRoll(
      `${request.className} rolled HP${conNote}`,
      request.hitDie,
      request.count,
      conMod * request.count,
      (outcome) => request.onResult(outcome.rolls),
    );
  }

  /** Chapter changes reopen the commission scrolled to the top — the wizard's
      scroll container is an ancestor of the panel (.builder-layout on desktop),
      not the window, so without this the next chapter lands mid-grid where the
      previous chapter's footer sat. */
  function changeCreatorStep(step: number) {
    setCreatorStep(step);
    requestAnimationFrame(() => {
      let el: Element | null = document.querySelector(".creator-panel");
      while (el) {
        if (el.scrollHeight > el.clientHeight + 4) {
          el.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        }
        el = el.parentElement;
      }
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    });
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
    if (heroClass && draft.level >= 1) {
      const levels = creationChoiceLevels(heroClass, draft.level, draft.raceId);
      if (levels.length > 0) {
        const base = characterPayload(draft, ruleset);
        setCreationSeq({
          levels,
          index: 0,
          soFar: {
            level: 0,
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
      const basePayload = characterPayload(draft, ruleset);
      const racedAbilities = applyRaceBonuses(draft.abilities, draft.raceId, ruleset);
      const creationHp = applyCreationHpBonuses({
        maxHp: basePayload.maxHp,
        currentHp: basePayload.currentHp,
        hpGains: basePayload.hpRolls ?? [],
        level: draft.level,
        baseConstitution: racedAbilities.constitution,
        choices: choices?.asiChoices,
      });
      const payload = {
        ...basePayload,
        maxHp: creationHp.maxHp,
        currentHp: creationHp.currentHp,
        hpRolls: creationHp.hpGains,
        ...(choices
          ? {
              asiChoices: choices.asiChoices.length > 0 ? choices.asiChoices : undefined,
              subclassId: choices.subclassId,
              spellsKnown: choices.spellsKnown,
              spellStatuses: choices.spellStatuses,
              skillExpertise: choices.skillExpertise,
              featureChoices: choices.featureChoices,
              featureResources: choices.featureResources,
              alwaysPreparedSpells: choices.alwaysPreparedSpells,
              spellbookSpells: choices.spellbookSpells,
              progressionState: choices.progressionState,
            }
          : {}),
      };
      Object.assign(payload, progressionPatchForCharacter({
        ruleset: payload.ruleset,
        classId: payload.classId,
        subclassId: payload.subclassId,
        level: draft.level,
        abilities: payload.abilities,
        featureChoices: payload.featureChoices,
      }));

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
      setStatMethod(null);
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
      skillExpertise: (patch.skillExpertise as string[] | undefined) ?? creationSeq.soFar.skillExpertise,
      featureChoices: (patch.featureChoices as Character["featureChoices"]) ?? creationSeq.soFar.featureChoices,
      featureResources: (patch.featureResources as Character["featureResources"]) ?? creationSeq.soFar.featureResources,
      alwaysPreparedSpells: (patch.alwaysPreparedSpells as string[] | undefined) ?? creationSeq.soFar.alwaysPreparedSpells,
      spellbookSpells: (patch.spellbookSpells as string[] | undefined) ?? creationSeq.soFar.spellbookSpells,
      progressionState: (patch.progressionState as Character["progressionState"]) ?? creationSeq.soFar.progressionState,
    };
    if (creationSeq.index + 1 < creationSeq.levels.length) {
      setCreationSeq({ ...creationSeq, index: creationSeq.index + 1, soFar });
    } else {
      void forgeCharacter(soFar);
    }
  }

  async function updateSelected(patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) {
    if (!selected) return;

    const mergedPatch = { ...patch };

    // Auto-snapshot on long rest: HP restored to max AND spell slots reset
    if (
      patch.currentHp !== undefined &&
      patch.currentHp === selected.maxHp &&
      (patch.spellSlotsUsed !== undefined || patch.pactSlotsUsed !== undefined)
    ) {
      const snapshots = buildSnapshot(`Long rest — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
      if (snapshots) mergedPatch.snapshots = snapshots as unknown as CharacterSnapshot[];
    }

    // Auto-snapshot on level-up
    if (patch.level !== undefined && patch.level > selected.level) {
      const snapshots = buildSnapshot(`Level ${patch.level} — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
      if (snapshots) mergedPatch.snapshots = snapshots as unknown as CharacterSnapshot[];
    }

    await updateCharacterById(selected.id, mergedPatch);
  }

  function updateCharacterById(characterId: string, patch: CharacterPatch) {
    if (!user) {
      return;
    }

    setSaveStatus("saving");

    const revision = characters.find((character) => character.id === characterId)?.revision ?? 0;
    setCharacters((current) => {
      return current.map((c) =>
        c.id === characterId ? { ...c, ...patch } as Character : c,
      );
    });
    saveCoordinatorRef.current!.enqueue(characterId, patch, revision);
  }

  async function deleteSelected() {
    if (!user || !selected) {
      return;
    }
    if (!window.confirm(`Delete ${selected.name || "this character"}? This permanently removes the character and cannot be undone.`)) {
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

  function buildSnapshot(label: string): CharacterSnapshot[] | null {
    if (!selected) return null;
    const now = new Date().toISOString();
    const snapshot: CharacterSnapshot = {
      id: crypto.randomUUID(),
      label: label || `Snapshot ${now.slice(0, 16).replace("T", " ")}`,
      character: JSON.parse(JSON.stringify(selected)) as Character,
      createdAt: now,
    };
    const existing = selected.snapshots ?? [];
    const capped = [snapshot, ...existing].slice(0, 10);
    for (const s of capped) {
      if ((s.character as Record<string, unknown>).snapshots) delete (s.character as Record<string, unknown>).snapshots;
    }
    return capped;
  }

  function formatSnapshotTime(value: string | number | Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function createSnapshot(label: string) {
    const snapshots = buildSnapshot(label);
    if (!snapshots || !selected) return;
    updateCharacterById(selected.id, { snapshots: snapshots as unknown as CharacterSnapshot[] });
  }

  function restoreSnapshot(snapshot: CharacterSnapshot) {
    if (!selected) return;
    if (!window.confirm(`Restore snapshot "${snapshot.label}"? Current unsaved changes will be lost.`)) return;
    const patch = patchFromSnapshot(snapshot, selected.snapshots ?? [], selected.ruleset);
    updateCharacterById(selected.id, patch);
    setSnapshotsOpen(false);
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

  function isAbilityKey(value: unknown): value is AbilityKey {
    return typeof value === "string" && abilityKeys.includes(value as AbilityKey);
  }

  function proficiencyBonusFor(level: number) {
    return 2 + Math.floor((Math.max(1, level) - 1) / 4);
  }

  function resolveCampaignEvent(id: string) {
    setResolvedCampaignEvents((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }

  async function postCampaignEvent(type: CampaignEvent["type"], payload: Record<string, unknown>, targetUserId?: string | null) {
    if (!activeCampaignId) return false;
    try {
      const event = await postCampaignEventApi(activeCampaignId, type, payload, targetUserId);
      rememberCampaignEvents([event]);
      setStatus("Campaign event sent");
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Campaign event could not be sent.");
      return false;
    }
  }

  async function updateCampaignInitiative(data: InitiativeState, version: number) {
    if (!activeCampaignId) return;
    try {
      const result = await updateCampaignInitiativeApi(activeCampaignId, data, version);
      if (result.conflict) {
        setStatus("Initiative changed. Refreshed from the campaign.");
        return;
      }
      setCampaignSync((current) => current ? { ...current, initiative: result.initiative } : current);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Initiative could not be updated.");
    }
  }

  async function submitCampaignInitiativeRoll(initiative: number) {
    if (!activeCampaignId || !selected) return;
    try {
      const result = await submitCampaignInitiativeRollApi(activeCampaignId, initiative, selected.name);
      setCampaignSync((current) => current ? { ...current, initiative: result } : current);
      setStatus("Initiative shared with campaign");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Initiative roll could not be shared.");
    }
  }

  function getEnrolledCharacter(): { character: Character; abilities: Record<AbilityKey, number>; initiative: number } | null {
    if (!campaignSync || !user || !ruleset) return null;
    const membership = campaignSync.members.find((m) => m.userId === user.id);
    if (!membership?.characterId) return null;
    const character = characters.find((c) => c.id === membership.characterId);
    if (!character) return null;
    const raced = applyRaceBonuses(character.abilities, character.raceId, ruleset);
    const featInfo = computeFeatBonuses(character.asiChoices);
    const abilities: Record<string, number> = {};
    for (const key of Object.keys(raced) as AbilityKey[]) {
      abilities[key] = raced[key] + (featInfo.abilityIncreases?.[key] ?? 0);
    }
    const featInitiative = featInfo.initiativeBonus ?? 0;
    const effectInitiative = effectTotal(character.effects ?? [], "initiative");
    const customInitiative = (character.customRules ?? [])
      .filter((rule) => rule.type === "initiative")
      .reduce((sum, rule) => sum + rule.value, 0);
    const initiative = abilityModifier(abilities.dexterity) + featInitiative + effectInitiative + customInitiative;
    return { character, abilities: abilities as Record<AbilityKey, number>, initiative };
  }

  function handleCampaignRollRequest(event: CampaignEvent) {
    const enrolled = getEnrolledCharacter();
    if (!enrolled) {
      setStatus(enrolled === null && !campaignSync?.members.find((m) => m.userId === user?.id)?.characterId
        ? "No character enrolled in this campaign." : "Campaign character unavailable.");
      return;
    }
    const { character: campaignChar, abilities, initiative: enrolledInitiative } = enrolled;
    const payload = parseCampaignPayload(event);
    const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
    // The roll always names itself from its mechanics ("Perception check"),
    // with the DM's optional prompt as a lead-in.
    const descriptor = rollRequestDescriptor(payload);
    const promptText = typeof payload.prompt === "string" && payload.prompt.trim() ? payload.prompt.trim() : "";
    const prompt = promptText ? `${promptText} — ${descriptor}` : descriptor;
    const kind = typeof payload.kind === "string" ? payload.kind : "check";
    // keyType arrives from the DM form's check → ability|skill fork; legacy
    // events expressed skills as kind "skill" directly.
    const keyType = typeof payload.keyType === "string" ? payload.keyType : kind === "skill" ? "skill" : "ability";
    const isSkillRequest = keyType === "skill" || kind === "skill";
    const key = payload.key;
    // DC is only present when the DM chose to reveal it; a hidden DC never
    // reaches this client.
    const dc = typeof payload.dc === "number" && Number.isFinite(payload.dc) ? payload.dc : undefined;
    // The DM's requested advantage combines with the character's own effect
    // mode under the 5e cancel rule.
    const requestedMode = rollRequestMode(payload);
    const forcedMode = combineRollModes(requestedMode, effectiveAdvantageMode(campaignChar.effects));
    const pb = proficiencyBonusFor(campaignChar.level);
    let modifier = 0;
    let label = prompt;

    if (kind === "initiative") {
      modifier = enrolledInitiative;
      label = dc ? `${prompt} (DC ${dc})` : prompt;
    } else if (isSkillRequest && typeof key === "string") {
      const skill = SKILLS.find((item) => item.id === key);
      if (skill) {
        const proficiencies = new Set([
          ...(campaignChar.skillProficiencies ?? []),
          ...(BACKGROUND_SKILLS[campaignChar.background] ?? []),
        ]);
        const expertise = campaignChar.skillExpertise?.includes(skill.id) ?? false;
        const jackOfAllTrades = campaignChar.classId === "bard" && campaignChar.level >= 2 && !proficiencies.has(skill.id);
        modifier =
          abilityModifier(abilities[skill.ability]) +
          (expertise ? pb * 2 : proficiencies.has(skill.id) ? pb : jackOfAllTrades ? Math.floor(pb / 2) : 0);
        label = dc ? `${prompt} (DC ${dc})` : prompt;
      }
    } else if ((kind === "check" || kind === "save") && isAbilityKey(key)) {
      modifier = abilityModifier(abilities[key]);
      if (kind === "save") {
        const hasSave =
          campaignChar.savingThrowProficiencies?.includes(key) ||
          SAVE_PROFICIENCIES[campaignChar.classId]?.abilities.includes(key);
        if (hasSave) modifier += pb;
      }
      label = dc ? `${prompt} (DC ${dc})` : prompt;
    }

    const modeNote = forcedMode !== "normal" ? ` (${forcedMode})` : "";
    pushPool([{ sides: 20, count: 1 }, ...activeD20Riders(campaignChar.effects)], modifier, `${label}${modeNote}`, (outcome) => {
      if (dc) {
        setStatus(`${prompt}: ${outcome.total} ${outcome.total >= dc ? "passes" : "fails"} DC ${dc}`);
      } else {
        setStatus(`${prompt}: rolled ${outcome.total}`);
      }
      if (requestId && campaignSync) void dmToolsApi.respondToRequest(campaignSync.campaign.id, requestId, {
        status: "completed", total: outcome.total, ...(dc !== undefined ? { passed: outcome.total >= dc } : {}),
        summary: `${descriptor}: ${outcome.total}${dc !== undefined ? outcome.total >= dc ? " pass" : " fail" : ""}`,
      }).catch(() => setStatus("Roll completed, but the DM response tracker could not be updated."));
      resolveCampaignEvent(event.id);
    }, forcedMode);
  }

  function applyCampaignRest(type: CampaignEvent["type"], eventId?: string) {
    const enrolled = getEnrolledCharacter();
    if (!enrolled) return;
    const campaignChar = enrolled.character;
    const event = eventId ? campaignEvents.find((item) => item.id === eventId) : undefined;
    const payload = event ? parseCampaignPayload(event) : {};
    const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
    let summary = "Rest completed";
    if (type === "rest-short") {
      const heroClass = ruleset?.classes.find((item) => item.id === campaignChar.classId);
      if (heroClass?.casterType === "pact") {
        void updateCharacterById(campaignChar.id, { pactSlotsUsed: 0 });
        summary = "Pact slots recovered; hit-die spending remains player controlled";
      } else {
        summary = "Short rest acknowledged; hit-die spending remains player controlled";
      }
      setStatus("Short rest acknowledged");
    } else if (type === "rest-long") {
      const recovery = longRestRecovery(campaignChar);
      void updateCharacterById(campaignChar.id, recovery.patch);
      summary = recovery.summary;
      setStatus("Long rest complete");
    }
    if (requestId && campaignSync) void dmToolsApi.respondToRequest(campaignSync.campaign.id, requestId, { status: "completed", summary }).catch(() => setStatus("Rest completed, but the DM response tracker could not be updated."));
    if (eventId) resolveCampaignEvent(eventId);
  }

  function respondToLoot(event: CampaignEvent, accept: boolean) {
    const enrolled = getEnrolledCharacter();
    if (!enrolled || !campaignSync) return;
    const payload = parseCampaignPayload(event);
    const parcelId = typeof payload.parcelId === "string" ? payload.parcelId : "";
    const itemId = typeof payload.itemId === "string" ? payload.itemId : "";
    if (!parcelId || !itemId) return;
    if (accept) {
      const name = typeof payload.name === "string" ? payload.name : "Campaign loot";
      const quantity = typeof payload.quantity === "number" ? Math.max(1, Math.min(99, Math.trunc(payload.quantity))) : 1;
      const description = typeof payload.description === "string" ? payload.description : "";
      const additions = Array.from({ length: quantity }, () => ({ id: crypto.randomUUID(), name, rarity: "Mundane", attunement: false, notes: "Assigned by the DM", ...(description ? { description } : {}) }));
      updateCharacterById(enrolled.character.id, { inventory: [...enrolled.character.inventory, ...additions] });
    }
    void dmToolsApi.respondLoot(campaignSync.campaign.id, parcelId, { itemId, accept }).then(() => { setStatus(accept ? "Loot added to your inventory" : "Loot declined"); resolveCampaignEvent(event.id); }).catch(() => setStatus("Could not record the loot response."));
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
        // The total rides only the last die of the flight — earlier dice
        // landing must not spoil the sum before the roll finishes.
        resultSummary: i === count - 1 ? resultSummary : undefined,
        resultDetail: i === count - 1 ? resultDetail : undefined,
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
    groups: { sides: number; count: number; keepHighest?: number }[],
    modifier: number,
    label: string,
    onResult?: (outcome: RollOutcome) => void,
    forcedMode?: RollMode,
  ) {
    // A forced mode (e.g. a DM roll request) overrides the drawer/effect mode.
    const activeMode = forcedMode ?? rollMode;
    const cleaned = groups.filter((g) => g.count > 0);
    const totalCount = cleaned.reduce((s, g) => s + g.count, 0);
    const useD20Mode = activeMode !== "normal" && cleaned.some((g) => g.sides === 20) && !cleaned.some((g) => g.keepHighest);
    const d20Total = cleaned.reduce((s, g) => s + (g.sides === 20 ? g.count : 0), 0);
    const extraDice = useD20Mode ? d20Total : 0; // one extra die per d20 for adv/dis pair
    if (totalCount === 0 || totalCount + extraDice > 40) return;

    if (useD20Mode) {
      const mode = activeMode === "advantage" ? "advantage" : "disadvantage";
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
      // Total on the last kept die only — earlier landings must not spoil it.
      const lastKeptIndex = newDice.reduce((last, die, i) => (die.dropped ? last : i), -1);
      newDice.forEach((die, i) => {
        die.resultSummary = die.dropped ? "Dropped" : i === lastKeptIndex ? resultSummary : undefined;
        die.resultDetail = die.dropped ? `${die.result}` : i === lastKeptIndex ? detail : undefined;
        die.lingerMs = die.dropped ? DROPPED_D20_LINGER_MS : d20Pairs.length > 0 ? KEPT_D20_LINGER_MS : NORMAL_ROLL_LINGER_MS;
      });

      const histModeData: RollHistoryEntry["adv"] = d20Pairs.length === 1
        ? { mode, dice: d20Pairs[0].pair, keptIndex: d20Pairs[0].keptIndex }
        : undefined;
      setConsoleLog((prev) => [`${label} -> ${detail}`, ...prev].slice(0, 20));
      recordHistory(label, detail, total, histModeData, nat, { groups: cleaned, modifier, mode });
      onResult?.({
        rolls: [
          ...d20Pairs.map((pair) => pair.keptValue),
          ...rolledDice.map((die) => die.value),
        ],
        modifier,
        total,
      });
      setFlyingDice((prev) => [...prev, ...newDice]);
      setManualRollMode(null);
      return;
    }

    const rolledDice: { sides: number; value: number; groupIndex: number; dropped: boolean }[] = [];
    const newDice: RollingDie[] = [];
    let index = 0;

    for (const [groupIndex, group] of cleaned.entries()) {
      const groupStart = rolledDice.length;
      for (let i = 0; i < group.count; i++) {
        const dieIndex = index++;
        const fromLeft = Math.random() > 0.5;
        const result = rollDie(group.sides);
        rolledDice[dieIndex] = { sides: group.sides, value: result, groupIndex, dropped: false };
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
      if (group.keepHighest && group.keepHighest < group.count) {
        const ranked = rolledDice
          .slice(groupStart)
          .map((die, offset) => ({ die, offset }))
          .sort((a, b) => b.die.value - a.die.value);
        const keptOffsets = new Set(ranked.slice(0, group.keepHighest).map((entry) => entry.offset));
        rolledDice.slice(groupStart).forEach((die, offset) => {
          if (!keptOffsets.has(offset)) {
            die.dropped = true;
            newDice[groupStart + offset].dropped = true;
          }
        });
      }
    }
    const total = rolledDice.reduce((sum, die) => sum + (die.dropped ? 0 : die.value), modifier);
    const detail = cleaned
      .map((g, groupIndex) => {
        const values = rolledDice
          .filter((die) => die.groupIndex === groupIndex)
          .map((die) => die.dropped ? `~~${die.value}~~` : String(die.value));
        return `${g.count}d${g.sides}${g.keepHighest ? `kh${g.keepHighest}` : ""} [${values.join(", ")}]`;
      })
      .join(" + ") + (modifier !== 0 ? ` ${signed(modifier)}` : "");
    const detailWithTotal = rollDetailWithTotal(detail, total);
    // Total on the last kept die only — earlier landings must not spoil it.
    const lastKeptIndex = newDice.reduce((last, die, i) => (die.dropped ? last : i), -1);
    newDice.forEach((die, i) => {
      die.resultSummary = die.dropped ? "Dropped" : i === lastKeptIndex ? rollResultSummary(total) : undefined;
      die.resultDetail = die.dropped ? String(die.result) : i === lastKeptIndex ? detailWithTotal : undefined;
      die.lingerMs = die.dropped ? DROPPED_D20_LINGER_MS : NORMAL_ROLL_LINGER_MS;
    });
    setConsoleLog((prev) => [`${label} -> ${total}`, ...prev].slice(0, 20));
    // "normal" is recorded explicitly so a reroll can never inherit a mode
    // armed after the fact.
    recordHistory(label, detail, total, undefined, undefined, { groups: cleaned, modifier, mode: "normal" });
    onResult?.({
      rolls: rolledDice.map((die) => die.value),
      modifier,
      total,
    });
    setFlyingDice((prev) => [...prev, ...newDice]);
    setManualRollMode(null);
  }

  /** Roll a single d20 check/attack/save, honoring the armed advantage /
      disadvantage mode: advantage rolls 2d20 and keeps the higher, disadvantage
      the lower. Rider dice (e.g. Bless's 1d4) fly and add to the total as usual.
      The kept d20 alone takes the modifier. A manual drawer override is
      one-shot — it reverts after the roll to whatever mode active effects
      (e.g. Poisoned) are driving, not necessarily "normal". */
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
    // Total on the last kept die only — with riders in flight, the kept d20
    // landing first must not spoil the sum.
    const lastKeptIndex = newDice.reduce((last, die, i) => (die.dropped ? last : i), -1);
    newDice.forEach((die, dieIndex) => {
      const isD20ChoiceDie = dieIndex < d20s.length && die.sides === 20;
      const isKeptD20 = isD20ChoiceDie && dieIndex === keptIndex;

      die.resultSummary = die.dropped ? "Dropped" : dieIndex === lastKeptIndex ? resultSummary : undefined;
      die.resultDetail = die.dropped ? `${die.result}` : dieIndex === lastKeptIndex ? detail : undefined;
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
    setManualRollMode(null);
  }

  function expireDie(id: string) {
    setFlyingDice((prev) => prev.filter((d) => d.id !== id));
  }

  // Click-to-dismiss: clears the whole fly layer at once. Safe because the
  // overlay only arms this once every die has settled (onFinish already fired).
  const clearFlyingDice = () => setFlyingDice([]);

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

  const characterSheetOpen = Boolean(!homeOpen && !campaignOpen && !creationPromptOpen && !creatorOpen && selected);
  const dmScreenOpen = Boolean(
    dmTableOpen &&
    campaignSync &&
    campaignSync.viewerIsDm,
  );
  const diceTrayVisible = characterSheetOpen || dmScreenOpen;

  if (!introDone || !ruleset || !draft || !spellsReady) {
    return (
      <>
        <SplashScreen />
      </>
    );
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        email={authEmail}
        password={authPassword}
        displayName={authDisplayName}
        inviteCode={authInviteCode}
        status={status}
        onModeChange={setAuthMode}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onDisplayNameChange={setAuthDisplayName}
        onInviteCodeChange={setAuthInviteCode}
        resetToken={authResetToken}
        onResetTokenChange={setAuthResetToken}
        onResendVerification={() => void resendVerification()}
        onSubmit={authRequest}
      />
    );
  }

  return (
    <>
    {/* The overlay must mount wherever dice are in flight, not just where the
        tray lives — creator rolls (starting HP, ability scores) otherwise queue
        in flyingDice unseen and their onFinish callbacks never fire. */}
    {diceTrayVisible || flyingDice.length > 0 ? <DiceRollOverlay dice={flyingDice} onExpire={expireDie} onDismissAll={clearFlyingDice} accentHex={diceAccent} fontStack={diceFont} /> : null}
    {diceTrayVisible ? <RollDrawer
      history={rollHistory}
      rollMode={rollMode}
      rollModeIsFromEffect={rollModeIsFromEffect}
      activeCharacterName={selected?.name}
      activeCharacterInitiative={selectedInitiative}
      currentUserId={user.id}
      campaignInitiative={campaignSync?.initiative}
      campaignIsDm={campaignSync?.viewerIsDm ?? false}
      onRollPool={pushPool}
      onCampaignInitiativeUpdate={updateCampaignInitiative}
      onCampaignInitiativeRoll={submitCampaignInitiativeRoll}
      onClearHistory={clearHistory}
    /> : null}
    {dmTableOpen && campaignSync && !campaignSync.viewerIsDm && campaignSync.campaign.playerDmViewEnabled ? <PlayerDMTablePanel
      campaign={campaignSync}
      events={campaignEvents}
      onClose={() => setDmTableOpen(false)}
    /> : null}
    {toasts.length > 0 ? (
      <div
        className={`ff-toast-stack${toasts.some((toast) => toast.kind === "announce") ? " has-announcement" : ""}`}
        aria-live="polite"
        style={selected?.theme ? ({
          "--toast-paper": selected.theme.paper,
          "--toast-ink": selected.theme.ink,
          "--toast-accent": selected.theme.accent,
          "--toast-font": FONT_STACKS[selected.theme.fontKey],
        } as CSSProperties) : undefined}
      >
        {toasts.map((toast) => (
          <button key={toast.id} type="button" className={`ff-toast ff-toast-${toast.kind}`} onClick={() => dismissToast(toast)} aria-label={`Dismiss notification: ${toast.title}`}>
            <span className="ff-toast-copy"><strong>{toast.title}</strong>{toast.body ? <span>{toast.body}</span> : null}</span>
            <X size={14} aria-hidden="true" className="ff-toast-dismiss" />
          </button>
        ))}
      </div>
    ) : null}
    {creationSeq && draft && creationSeqFinalAbilities ? (() => {
      const heroClass = ruleset.classes.find((item) => item.id === draft.classId);
      if (!heroClass) return null;
      const targetLevel = creationSeq.levels[creationSeq.index];
      const raceName = ruleset.races.find((item) => item.id === draft.raceId)?.name;
      return (
        <LevelUpModal
          key={`create-${creationSeq.index}`}
          character={{
            ...creationSeq.soFar,
            ruleset: draft.ruleset,
            sourceIds: draft.sourceIds,
            raceId: draft.raceId,
            // The modal derives expertise eligibility from proficiencies and
            // background; soFar doesn't carry them — the draft does.
            skillProficiencies: draft.skillProficiencies,
            background: draft.background,
          }}
          characterName={draft.name.trim() || undefined}
          gainedFeatures={heroClass.levelProgression.find((e) => e.level === targetLevel)?.features ?? []}
          newLevel={targetLevel}
          finalAbilities={creationSeqFinalAbilities}
          classId={heroClass.id}
          className={heroClass.name}
          hitDie={heroClass.hitDie}
          asiLevels={heroClass.asiLevels ?? [4, 8, 12, 16, 19]}
          subclassLevel={getClassData(heroClass.id)?.subclassLevel}
          casterType={heroClass.casterType}
          raceName={raceName}
          proficiencies={heroClass.proficiencies}
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
    {importOpen ? (
      <CharacterImportModal
        onCreated={() => {
          setImportOpen(false);
          // Refetch characters to include the imported one
          fetch("/api/characters", { headers: authHeaders() })
            .then((r) => r.ok ? r.json() as Promise<{ characters: Character[] }> : null)
            .then((data) => {
              if (data) {
                setCharacters(data.characters);
                setSelectedId(data.characters[0]?.id ?? "");
              }
            })
            .catch(() => {});
        }}
        onClose={() => setImportOpen(false)}
      />
    ) : null}
    {campaignListOpen ? <CampaignPanel
        presentation="page"
      characters={characters}
      activeCampaignId={activeCampaignId}
      onActiveCampaignChange={(id) => {
        if (id) {
          if (id !== activeCampaignId) setActiveCampaign(id);
          setCampaignSection("overview");
          setCampaignListOpen(false);
          setCampaignOpen(true);
        } else {
          setActiveCampaign(null);
        }
      }}
      onCreateCharacter={() => { setCampaignListOpen(false); setCampaignOpen(false); beginBuild("standard"); }}
      onClose={() => setCampaignListOpen(false)}
      theme={selected?.theme ?? null}
    /> : null}
    {dmTableOpen && campaignSync && campaignSync.viewerIsDm ? <DMTablePanel
      campaign={campaignSync}
      events={campaignEvents}
      theme={selected?.theme ?? null}
      onClose={() => setDmTableOpen(false)}
      onOpenSheet={(character) => setReadOnlyViewChar(character)}
      onPostEvent={postCampaignEvent}
      onInitiativeUpdate={updateCampaignInitiative}
      onOpenCampaigns={() => setCampaignListOpen(true)}
      openScheduleSession={scheduleSessionOpen}
      onScheduleSessionOpened={() => setScheduleSessionOpen(false)}
      initialPreparationTab={dmTablePreparationTab}
    /> : null}
    {campaignSync && !campaignOpen && !campaignSync.viewerIsDm ? <CampaignTableStrip
      campaign={campaignSync}
      events={campaignEvents}
      currentUserId={user.id}
      onOpen={() => setCampaignOpen(true)}
      onToast={(title, body) => pushToast("announce", title, body)}
    /> : null}
    {adminOpen && user.isAdmin ? <AdminPanel onClose={() => setAdminOpen(false)} /> : null}
    {accountDataOpen ? (
      <AccountDataModal
        onClose={() => setAccountDataOpen(false)}
        onDeleted={() => {
          setAccountDataOpen(false);
          logOut();
        }}
      />
    ) : null}
    {readOnlyViewChar ? (
      <div className="modal-scrim dm-sheet-overlay" role="presentation" onMouseDown={() => setReadOnlyViewChar(null)}>
        <div onMouseDown={(e) => e.stopPropagation()} style={{ width: "min(1100px, 100%)", maxHeight: "90vh", overflow: "auto", position: "relative" }}>
          <button className="glass-icon modal-close" type="button" onClick={() => setReadOnlyViewChar(null)} aria-label="Close" style={{ position: "absolute", top: 12, right: 12, zIndex: 10 }}>
            <X size={18} />
          </button>
          <HeroSheet
            character={readOnlyViewChar}
            finalAbilities={readOnlyViewChar.abilities}
            ruleset={ruleset!}
            onUpdate={() => {}}
            onRoll={() => {}}
            onDelete={() => {}}
            consoleInput=""
            consoleLog={[]}
            onConsoleInput={() => {}}
            onConsoleSubmit={() => {}}
            readOnly={true}
          />
        </div>
      </div>
    ) : null}
    <main className="builder-shell">
      <nav className="ao-nav-rail" aria-label="Primary">
        <div className="ao-nav-brand" aria-hidden="true">D</div>
        <div className="ao-nav-stack">
          <button
            type="button"
            className={`ao-nav-item${homeOpen && !campaignOpen ? " active" : ""}`}
            aria-current={homeOpen && !campaignOpen ? "page" : undefined}
            onClick={() => { setHomeOpen(true); setCampaignOpen(false); }}
          >
            <Home size={19} /><span>Home</span>
          </button>
          <button
            type="button"
            className={`ao-nav-item${!homeOpen && !campaignOpen && (creationPromptOpen || creatorOpen) ? " active" : ""}`}
            aria-current={!homeOpen && !campaignOpen && (creationPromptOpen || creatorOpen) ? "page" : undefined}
            onClick={() => { setHomeOpen(false); setCampaignOpen(false); setCreationPromptOpen(true); setCreatorOpen(false); }}
          >
            <Hammer size={19} /><span>Forge</span>
          </button>
          {characters.length > 0 ? (
          <button
            type="button"
            className={`ao-nav-item${!homeOpen && !campaignOpen && !creationPromptOpen && !creatorOpen ? " active" : ""}`}
            aria-current={!homeOpen && !campaignOpen && !creationPromptOpen && !creatorOpen ? "page" : undefined}
            onClick={() => { setHomeOpen(false); setCampaignOpen(false); setCreationPromptOpen(false); setCreatorOpen(false); if (!selected) setSelectedId(characters[0].id); }}
          >
            <UserIcon size={19} /><span>Hero</span>
          </button>
          ) : null}
          <button
            type="button"
            className={`ao-nav-item${campaignOpen ? " active" : ""}`}
            aria-current={campaignOpen ? "page" : undefined}
            onClick={() => {
              if (activeCampaignId) {
                setCampaignOpen(true);
              } else {
                setCampaignListOpen(true);
              }
            }}
          >
            <Swords size={19} /><span>Campaign</span>
          </button>
        </div>
        <div className="ao-nav-spacer" />
        <div className="ao-nav-user" title={user.name} aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "?"}</div>
      </nav>
      {impersonationActor ? <div className="impersonation-banner" role="status">Viewing as <strong>{user.name}</strong> · admin {impersonationActor.name}<button type="button" onClick={async () => { await fetch("/api/admin/impersonation", { method: "DELETE" }); window.location.reload(); }}>Stop impersonating</button></div> : null}
      <header className="builder-topbar ledger-topbar">
        <div className="builder-brand ledger-masthead">
          <div>
            <span>Dreamwright</span>
            <strong>
              {campaignOpen ? campaignSync?.campaign.name ?? "Campaign"
                : campaignListOpen ? "Your Tables"
                : homeOpen ? "The Hearth"
                : creationPromptOpen || creatorOpen ? "The Forge"
                : selected ? selected.name
                : "Character Ledger"}
            </strong>
          </div>
        </div>
        <div className="builder-actions">
          {status ? <span className="system-status">{status}</span> : null}
          <SaveStatusBadge status={saveStatus} />
          <span className="account-chip ledger-account">{user.name}</span>
          <div className="ao-header-action-cluster" aria-label="Workspace actions">
            <button className="glass-icon ink-action ao-header-action ao-header-action-primary" type="button" onClick={() => setCampaignListOpen(true)} title="Campaigns">
              <Swords size={17} /><span>Campaigns</span>
            </button>
            <div className="ao-header-menu-wrap">
              <button
                className="glass-icon ink-action ao-header-action"
                type="button"
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
                onClick={() => setHeaderMenuOpen((open) => !open)}
                title="Workspace menu"
              >
                <Menu size={16} /><span>Menu</span><ChevronDown size={10} />
              </button>
              {headerMenuOpen ? (
                <div className="ao-header-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setHeaderMenuOpen(false); setAccountDataOpen(true); }}>
                    <UserIcon size={14} /><span>My data</span>
                  </button>
                  {selected ? (
                    <button type="button" role="menuitem" onClick={() => { setHeaderMenuOpen(false); setSnapshotsOpen(true); }}>
                      <RotateCcw size={14} /><span>Snapshots</span>
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" onClick={() => { setHeaderMenuOpen(false); setImportOpen(true); }}>
                    <Upload size={14} /><span>Import character</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setHeaderMenuOpen(false); openFeedback(); }}>
                    <MessageSquare size={14} /><span>Submit feedback</span>
                  </button>
                </div>
              ) : null}
            </div>
            <NotificationInbox />
          </div>
          {user.isAdmin ? (
            <button className="glass-icon ink-action" type="button" onClick={() => setAdminOpen(true)} title="Admin console">
              <ShieldCheck size={18} />
            </button>
          ) : null}
          <button className="glass-icon ink-action" type="button" onClick={logOut} title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {campaignOpen && activeCampaignId ? (
      <section className="ao-campaign-main">
        {campaignSync && campaignSync.campaign.id === activeCampaignId ? (
          <CampaignWorkspacePage
            detail={campaignSync}
            characters={characters}
            currentUserId={user.id}
            campaignEvents={campaignEvents}
            resolvedEventIds={resolvedCampaignEvents}
            section={campaignSection}
            onSectionChange={setCampaignSection}
            onBackToList={() => setCampaignListOpen(true)}
            onCampaignClosed={() => { setActiveCampaign(null); setCampaignOpen(false); setDmTableOpen(false); setCampaignListOpen(true); }}
            onActiveCampaignChange={setActiveCampaign}
            onOpenSheet={(character) => {
              // The viewer's own character opens the live, editable sheet —
              // that is the player's seat at the table. Other members stay
              // read-only.
              const mine = characters.find((c) => c.id === character.id);
              if (mine) {
                setSelectedId(mine.id);
                setCampaignOpen(false);
                setHomeOpen(false);
                setCreationPromptOpen(false);
                setCreatorOpen(false);
              } else {
                setReadOnlyViewChar(character);
              }
            }}
            onCreateCharacter={() => { setCampaignOpen(false); beginBuild("standard"); }}
            onRespondRollRequest={handleCampaignRollRequest}
            onAcceptRest={applyCampaignRest}
            onRespondLoot={respondToLoot}
            onResolveEvent={resolveCampaignEvent}
            onPostEvent={postCampaignEvent}
            onOpenTable={() => setDmTableOpen(true)}
            onOpenHandouts={() => { setDmTablePreparationTab("handouts"); setDmTableOpen(true); }}
            onScheduleSession={() => { setScheduleSessionOpen(true); setDmTableOpen(true); }}
          />
        ) : (
          /* Campaign-page skeleton (handoff §20.1): header, status row and a
             content block hold their shape — no full-page spinner. */
          <div className="ao-cw ao-cw-skeleton" aria-busy="true" aria-label="Opening campaign">
            <div className="ao-cw-skeleton-hero" />
            <div className="ao-cw-status-grid" aria-hidden="true">
              <div className="ao-cw-skeleton-card" />
              <div className="ao-cw-skeleton-card" />
              <div className="ao-cw-skeleton-card" />
              <div className="ao-cw-skeleton-card" />
            </div>
            <div className="ao-cw-skeleton-panel" aria-hidden="true" />
            <button className="ao-cw-btn ao-cw-skeleton-escape" type="button" onClick={() => { setCampaignOpen(false); setCampaignListOpen(true); }}>
              Back to Campaigns
            </button>
          </div>
        )}
      </section>
      ) : homeOpen ? (
      <section className="ao-home-main">
        <HomeDashboard
          userName={user.name}
          characters={characters}
          ruleset={ruleset}
          activeCampaignId={activeCampaignId}
          campaignSync={campaignSync}
          campaignEvents={campaignEvents}
          refreshKey={homeRefreshKey}
          onResumeCampaign={(campaignId) => { if (campaignId !== activeCampaignId) setActiveCampaign(campaignId); setCampaignSection("overview"); setCampaignListOpen(false); setCampaignOpen(true); }}
          onScheduleSession={(campaignId) => { if (campaignId !== activeCampaignId) setActiveCampaign(campaignId); setCampaignSection("sessions"); setCampaignListOpen(false); setCampaignOpen(true); setScheduleSessionOpen(true); setDmTableOpen(true); }}
          onOpenCampaigns={() => setCampaignListOpen(true)}
          onOpenCharacter={(characterId) => {
            setSelectedId(characterId);
            setHomeOpen(false);
            setCreationPromptOpen(false);
            setCreatorOpen(false);
          }}
          onCreateCharacter={() => {
            setHomeOpen(false);
            setCreationPromptOpen(true);
            setCreatorOpen(false);
          }}
          onImportCharacter={() => { setHomeOpen(false); setImportOpen(true); }}
          onNameChange={async (name) => {
            try {
              const response = await fetch("/api/auth/profile", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ name }) });
              const data = await response.json() as { user?: PublicUser; error?: string };
              if (!response.ok || !data.user) { setStatus(data.error ?? "Name could not be updated."); return false; }
              setUser(data.user);
              window.localStorage.setItem("forge-and-fable-user", JSON.stringify(data.user));
              setStatus("Name updated");
              return true;
            } catch { setStatus("Name could not be updated."); return false; }
          }}
        />
      </section>
      ) : (
      <section className="builder-layout builder-layout-sheet-only">
        <aside className="vault-rail ledger-rail" style={vaultThemeVars}>
          <div className="rail-heading">
            <button type="button" className="rail-action" title="Import PDF" onClick={() => setImportOpen(true)}>Import</button>
            <button type="button" className="rail-action" title="New character" onClick={() => { setCreationPromptOpen(true); setCreatorOpen(false); }}>New</button>
          </div>
          <div className="vault-list">
            {characters.length === 0 && !ruleset ? (
              <>
                <div className="skeleton-row"><div className="skeleton skeleton-avatar" /><div className="skeleton skeleton-text" /><div className="skeleton skeleton-text short" /></div>
                <div className="skeleton-row"><div className="skeleton skeleton-avatar" /><div className="skeleton skeleton-text" /><div className="skeleton skeleton-text short" /></div>
                <div className="skeleton-row"><div className="skeleton skeleton-avatar" /><div className="skeleton skeleton-text" /><div className="skeleton skeleton-text short" /></div>
              </>
            ) : (
              filteredVaultChars.map((character) => {
              const race = ruleset.races.find((item) => item.id === character.raceId);
              const heroClass = ruleset.classes.find((item) => item.id === character.classId);
              const recordLine = [race?.name, heroClass?.name, `${ordinalLevel(character.level)} level`]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  type="button"
                  className={`vault-avatar ledger-row ${character.id === selected?.id ? "active" : ""}`}
                  key={character.id}
                  aria-pressed={character.id === selected?.id}
                  onClick={() => {
                    setSelectedId(character.id);
                    setCreationPromptOpen(false);
                    setCreatorOpen(false);
                  }}
                >
                  <span className="ledger-initial" data-class={heroClass?.id ?? ""} aria-hidden="true">
                    {character.name.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <strong>{character.name}</strong>
                  <small>{recordLine}</small>
                </button>
              );
            }))}
            <button
              type="button"
              className="ledger-ghost-row"
              onClick={() => {
                setCreationPromptOpen(true);
                setCreatorOpen(false);
              }}
            >
              {characters.length === 0 ? "✦  Inscribe a new name in the roster…" : "✦  Inscribe a new name…"}
            </button>
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
          ) : charactersLoading && !creatorOpen && !creationPromptOpen ? (
            <div className="paper-surface dj-start" style={{ display: "grid", placeItems: "center", padding: 48 }}>
              <p className="cs-muted">Loading your ledger...</p>
            </div>
          ) : showCreationPrompt ? (
            <CharacterStartPanel
              onSelectBuild={beginBuild}
              onBack={() => {
                setCreationPromptOpen(false);
                setHomeOpen(true);
              }}
              rosterEmpty={characters.length === 0}
            />
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
              onStepChange={changeCreatorStep}
              onMethodChange={changeStatMethod}
              onPointBuyChange={changePointBuy}
              onManualAbilityChange={changeManualAbility}
              onAssignmentChange={setAssignment}
              onRollStats={rollStatBlock}
              onRollStartingHp={rollStartingHp}
              onBackToBuildModes={() => {
                setCreatorOpen(false);
                setCreationPromptOpen(true);
                setBuildMode("standard");
              }}
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
              rollMode={rollMode}
              rollModeIsFromEffect={rollModeIsFromEffect}
              onRollModeChange={setRollMode}
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
      )}

      {/* Snapshots Panel */}
      {snapshotsOpen && selected ? (
        <div className="modal-scrim" role="presentation" onMouseDown={() => setSnapshotsOpen(false)}>
          <section
            className="campaign-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snapshots-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: 480 }}
          >
            <div className="campaign-header">
              <h2 id="snapshots-title"><RotateCcw size={18} /> Snapshots — {selected.name}</h2>
              <button className="glass-icon modal-close" type="button" onClick={() => setSnapshotsOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="campaign-body">
              <button
                className="dj-btn dj-btn-primary"
                type="button"
                onClick={() => {
                  const label = window.prompt("Snapshot label (optional):")?.trim() || "";
                  if (label !== null) createSnapshot(label);
                }}
                style={{ marginBottom: 12 }}
              >
                Save Snapshot
              </button>
              {(selected.snapshots ?? []).length === 0 ? (
                <p className="cs-muted">No snapshots yet. Snapshots are auto-created on session load, level-up, and long rest.</p>
              ) : (
                <>
                  <div className="campaign-card" style={{ borderColor: "var(--gold)", marginBottom: 12 }}>
                    <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--gold)", marginBottom: 4 }}>
                      Last safe point
                    </div>
                    <strong>{selected.snapshots![0].label}</strong>
                    <small style={{ display: "block", color: "var(--ink-faint)" }}>
                      {formatSnapshotTime(selected.snapshots![0].createdAt)} · Lv {selected.snapshots![0].character.level} · HP {selected.snapshots![0].character.currentHp}/{selected.snapshots![0].character.maxHp}
                    </small>
                    <button
                      className="glass-button"
                      type="button"
                      onClick={() => restoreSnapshot(selected.snapshots![0])}
                      title="Restore last safe point"
                      style={{ marginTop: 6 }}
                    >
                      Restore
                    </button>
                  </div>
                  <div className="campaign-list">
                    {selected.snapshots!.slice(1).map((snap) => (
                      <div key={snap.id} className="campaign-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{snap.label}</strong>
                          <small style={{ display: "block", color: "var(--ink-faint)" }}>
                            {new Date(snap.createdAt).toLocaleString()} · Lv {snap.character.level} · HP {snap.character.currentHp}/{snap.character.maxHp}
                          </small>
                        </div>
                        <button
                          className="glass-button"
                          type="button"
                          onClick={() => restoreSnapshot(snap)}
                          title="Restore this snapshot"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
    </>
  );
}
