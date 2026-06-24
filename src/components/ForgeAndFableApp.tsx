"use client";

import Image from "next/image";
import {
  Activity,
  ArrowRight,
  Backpack,
  BookOpen,
  ChevronRight,
  CircleGauge,
  Crown,
  Dices,
  Gem,
  HeartPulse,
  LockKeyhole,
  LogOut,
  Minus,
  Plus,
  Save,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Terminal,
  Trash2,
  UserPlus,
  UserRound,
  Vault,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import type {
  AbilityKey,
  AbilityScores,
  Character,
  CharacterSettings,
  CustomRule,
  HeroClass,
  InventoryItem,
  PublicUser,
  Race,
  Ruleset,
} from "@/types/game";

const abilityKeys: AbilityKey[] = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

const abilityLabels: Record<AbilityKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

const abilityNames: Record<AbilityKey, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  charisma: "Charisma",
};

const classArtById: Record<string, string> = {
  barbarian: "/class-art/barbarian.jfif",
  bard: "/class-art/bard.jfif",
  cleric: "/class-art/cleric.jfif",
  druid: "/class-art/druid.jfif",
  fighter: "/class-art/fighter.jfif",
  monk: "/class-art/monk.jfif",
  paladin: "/class-art/paladin.jfif",
  ranger: "/class-art/ranger.jfif",
  rogue: "/class-art/rogue.jfif",
  sorcerer: "/class-art/sorcerer.jfif",
  warlock: "/class-art/warlock.jfif",
  wizard: "/class-art/wizard.jfif",
};

const pointCosts: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

const standardArray = [15, 14, 13, 12, 10, 8];
const emptyAbilities: AbilityScores = {
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
};

const sourceOptions = [
  {
    id: "homebrew",
    name: "Homebrew",
    summary:
      "Character options designed by other players and uploaded to Forge & Fable. Talk to your DM before including Homebrew content.",
  },
  {
    id: "5-5e-core",
    name: "5.5e Core Rules",
    summary:
      "Character options from the 5.5e Player's Handbook, Dungeon Master’s Guide, Monster Manual, and Forge & Fable Basic Rules.",
  },
  {
    id: "5-5e-expanded",
    name: "5.5e Expanded Rules",
    summary: "Character options from supplementary sourcebooks beyond the 5.5e Core Rules.",
  },
  {
    id: "5e-core",
    name: "5e Core Rules",
    summary:
      "Character options from the 5e Player's Handbook, Dungeon Master's Guide, Monster Manual, and Basic Rules.",
  },
  {
    id: "5e-expanded",
    name: "5e Expanded Rules",
    summary:
      "Character options from supplementary sourcebooks such as Tasha’s Cauldron of Everything and Xanathar’s Guide to Everything, that are beyond the 5e Core Rules.",
  },
];

type DraftCharacter = Omit<Character, "id" | "userId" | "createdAt">;
type StatMethod = "point-buy" | "standard-array" | "roll";
type AuthMode = "login" | "register";
type BuildMode = "standard" | "quickbuilder" | "premade";
type AssignmentMap = Record<AbilityKey, number>;

type RollEntry = {
  id: string;
  label: string;
  total: number;
  rolls: number[];
  modifier: number;
  createdAt: string;
};

function defaultCharacterSettings(): CharacterSettings {
  return {
    diceRollingEnabled: false,
    optionalClassFeatures: false,
    customizeOrigin: false,
    advancementType: "milestone",
    hitPointType: "fixed",
    usePrerequisites: false,
    useFeatPrerequisites: false,
    useMulticlassPrerequisites: false,
    showLevelScaledSpells: false,
    encumbranceType: "standard",
    ignoreCoinWeight: false,
    modifiersTop: false,
  };
}

function defaultAssignments(): AssignmentMap {
  return {
    strength: 0,
    dexterity: 1,
    constitution: 2,
    intelligence: 3,
    wisdom: 4,
    charisma: 5,
  };
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

function proficiencyBonus(level: number) {
  return 2 + Math.floor((level - 1) / 4);
}

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

function scoreFrom4d6() {
  const rolls = Array.from({ length: 4 }, () => rollDie(6)).sort((a, b) => b - a);
  return rolls.slice(0, 3).reduce((sum, value) => sum + value, 0);
}

function inventoryEntry(name: string, index: number): InventoryItem {
  return {
    id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    name,
    rarity: "Common",
    attunement: false,
    notes: "Starting kit item.",
  };
}

function createInitialDraft(ruleset: Ruleset): DraftCharacter {
  return {
    name: "",
    level: 1,
    alignment: ruleset.alignments[4],
    background: "",
    physicalCharacteristics: "",
    personalCharacteristics: "",
    generalNotes: "",
    raceId: "",
    classId: "",
    sourceIds: [],
    settings: defaultCharacterSettings(),
    abilities: { ...emptyAbilities },
    currentHp: 8,
    maxHp: 8,
    tempHp: 0,
    inventory: [],
    spellsKnown: [],
    customRules: [],
  };
}

function characterPayload(
  draft: DraftCharacter,
  ruleset: Ruleset,
): Omit<Character, "id" | "userId" | "createdAt"> {
  const heroClass = ruleset.classes.find((item) => item.id === draft.classId) ?? ruleset.classes[0];
  const race = ruleset.races.find((item) => item.id === draft.raceId) ?? ruleset.races[0];
  const conScore = draft.abilities.constitution + (race.bonuses.constitution ?? 0);
  const maxHp = Math.max(1, heroClass.hitDie + abilityModifier(conScore));
  const classGear = heroClass.startingGear.map((name, index) => inventoryEntry(name, index));

  return {
    ...draft,
    currentHp: maxHp,
    maxHp,
    tempHp: 0,
    inventory: [...classGear, ...ruleset.items.slice(0, 1)],
    spellsKnown: heroClass.spellSuggestions.slice(0, 3),
    customRules: [],
  };
}

function applyRaceBonuses(abilities: AbilityScores, raceId: string, ruleset: Ruleset) {
  const race = ruleset.races.find((item) => item.id === raceId) ?? ruleset.races[0];
  return abilityKeys.reduce((scores, key) => {
    scores[key] = abilities[key] + (race.bonuses[key] ?? 0);
    return scores;
  }, {} as AbilityScores);
}

function ClassIconPlaceholder(props: {
  classId: string;
  size: number;
  strokeWidth?: number;
}) {
  const strokeWidth = Math.max(4.25, (props.strokeWidth ?? 1.5) * 2.9);
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };
  const fill = { fill: "currentColor" };

  return (
    <svg
      aria-hidden="true"
      className="class-symbol"
      focusable="false"
      height={props.size}
      viewBox="0 0 64 64"
      width={props.size}
    >
      {props.classId === "barbarian" ? (
        <>
          <path {...fill} d="M29 25h6v27h-6z" />
          <path {...fill} d="M26 51h12l-6 8z" />
          <path {...fill} d="M31.5 8c-5.6 8.8-13.2 12.6-24 11.7 2.8 9.4 9.8 16.5 20.5 17.8v-9.8c-3.8-1.3-6.8-3.6-9-7.1 5.7-.6 10.1-3.3 12.5-7.6z" />
          <path {...fill} d="M32.5 8c5.6 8.8 13.2 12.6 24 11.7-2.8 9.4-9.8 16.5-20.5 17.8v-9.8c3.8-1.3 6.8-3.6 9-7.1-5.7-.6-10.1-3.3-12.5-7.6z" />
        </>
      ) : null}
      {props.classId === "bard" ? (
        <>
          <circle {...fill} cx="22" cy="46" r="7" />
          <circle {...fill} cx="43" cy="38" r="6" />
          <path {...stroke} d="M28 46V18l22-5v24" />
          <path {...stroke} d="M28 25 50 20" />
          <path {...stroke} d="M14 21c4-4 9-4 13 0" />
        </>
      ) : null}
      {props.classId === "cleric" ? (
        <>
          <circle {...stroke} cx="32" cy="23" r="8" />
          <path {...fill} d="M29 29h6v24h-6z" />
          <path {...fill} d="M26 51h12l-6 8z" />
          <path {...stroke} d="M32 5v8M32 33v8M14 23h8M42 23h8M19.5 10.5l5.6 5.6M38.9 29.9l5.6 5.6M44.5 10.5l-5.6 5.6M25.1 29.9l-5.6 5.6" />
        </>
      ) : null}
      {props.classId === "druid" ? (
        <>
          <path {...fill} d="M33 5c14 11 21 23 18 35-3 11-12 17-19 19-7-2-16-8-19-19C10 28 19 15 33 5Z" />
          <path d="M32 18v30M22 29l10 8 10-8M24 42l8 6 8-6" stroke="#050607" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
        </>
      ) : null}
      {props.classId === "fighter" ? (
        <>
          <path {...fill} d="M14 12h36v20c0 12-7 20-18 27-11-7-18-15-18-27z" />
          <path d="M32 12v42M22 21h20" stroke="#050607" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" />
          <path d="M32 19v29" stroke="#050607" strokeLinecap="round" strokeWidth="7" />
        </>
      ) : null}
      {props.classId === "monk" ? (
        <>
          <path {...fill} d="M18 28c0-4 3-7 7-7h18c4 0 7 3 7 7v11c0 11-7 18-18 18S14 50 14 39v-6c0-3 2-5 4-5z" />
          <rect {...fill} x="17" y="11" width="8" height="21" rx="4" />
          <rect {...fill} x="27" y="8" width="8" height="24" rx="4" />
          <rect {...fill} x="37" y="11" width="8" height="21" rx="4" />
          <path d="M19 44h27M20 52h23" stroke="#050607" strokeLinecap="round" strokeWidth="4" />
        </>
      ) : null}
      {props.classId === "paladin" ? (
        <>
          <path {...fill} d="M32 6 52 15v17c0 12-7 21-20 27-13-6-20-15-20-27V15z" />
          <path d="M32 19v27M23 30h18" stroke="#050607" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        </>
      ) : null}
      {props.classId === "ranger" ? (
        <>
          <path {...stroke} d="M13 51c17-6 30-19 38-38" />
          <path {...stroke} d="M18 16c14 2 25 13 29 29" />
          <path {...stroke} d="M50 13v14M50 13H36" />
          <path {...fill} d="M48 8 59 5 56 16z" />
          <path {...fill} d="M10 54 5 59l2-12z" />
        </>
      ) : null}
      {props.classId === "rogue" ? (
        <>
          <path {...fill} d="M29 9h6v38h-6z" />
          <path {...fill} d="M20 21h24v8H20z" />
          <path {...fill} d="M32 58 22 45h20z" />
          <circle {...fill} cx="32" cy="9" r="5" />
        </>
      ) : null}
      {props.classId === "sorcerer" ? (
        <>
          <path {...fill} d="M34 5c7 8 8 15 3 22 6-3 11-1 14 5 5 10-2 25-19 25S8 42 14 31c3-5 7-8 13-8-3-7-1-13 7-18z" />
          <path d="M24 39c1 7 5 11 10 11s9-4 9-10c-4 4-8 3-11-2-2 5-5 6-8 1z" fill="#050607" />
        </>
      ) : null}
      {props.classId === "warlock" ? (
        <>
          <path {...stroke} d="M8 32c7-10 15-15 24-15s17 5 24 15c-7 10-15 15-24 15S15 42 8 32z" />
          <circle {...fill} cx="32" cy="32" r="8" />
          <path {...fill} d="M32 5 37 16H27zM13 48l10-5-3 11zM51 48l-10-5 3 11z" />
        </>
      ) : null}
      {props.classId === "wizard" ? (
        <>
          <path {...stroke} d="M11 18c9-5 17-5 25 0 6-4 12-5 17-3v37c-6-2-12-1-17 3-8-5-16-5-25 0z" />
          <path {...stroke} d="M36 18v37" />
          <path {...fill} d="M48 6 51 14l8 3-8 3-3 8-3-8-8-3 8-3z" />
        </>
      ) : null}
      {!props.classId ? (
        <>
          <path {...stroke} d="M32 12 38 26l14 6-14 6-6 14-6-14-14-6 14-6z" />
          <circle {...stroke} cx="32" cy="32" r="22" />
        </>
      ) : null}
    </svg>
  );
}

function SpeciesIconPlaceholder(props: {
  speciesId: string;
  size: number;
  strokeWidth?: number;
}) {
  const strokeWidth = props.strokeWidth ?? 2;
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
  };
  const id = props.speciesId;

  return (
    <svg
      aria-hidden="true"
      className="class-svg"
      focusable="false"
      height={props.size}
      viewBox="0 0 64 64"
      width={props.size}
    >
      {id.includes("dragonborn") ? (
        <>
          <path {...common} d="M18 48V28l14-16 14 16v20" />
          <path {...common} d="M24 24 16 14m24 10 8-10" />
          <path {...common} d="M24 48c4-8 12-8 16 0" />
          <path {...common} d="M32 28c6 7 6 13 0 18-6-5-6-11 0-18Z" />
        </>
      ) : null}
      {id.includes("dwarf") ? (
        <>
          <path {...common} d="M18 48h28" />
          <path {...common} d="M24 48V28h16v20" />
          <path {...common} d="M22 28 32 14l10 14" />
          <path {...common} d="M18 36h28" />
        </>
      ) : null}
      {id.includes("elf") ? (
        <>
          <path {...common} d="M32 10c12 10 15 24 9 42-13-4-20-17-9-42Z" />
          <path {...common} d="M32 10c-12 10-15 24-9 42 13-4 20-17 9-42Z" />
          <path {...common} d="M32 22v28" />
        </>
      ) : null}
      {id.includes("gnome") ? (
        <>
          <path {...common} d="M18 42 32 14l14 28Z" />
          <path {...common} d="M24 42v10h16V42" />
          <path {...common} d="M22 48h20" />
          <circle {...common} cx="32" cy="31" r="5" />
        </>
      ) : null}
      {id.includes("goliath") ? (
        <>
          <path {...common} d="M12 50 26 22l8 16 6-10 12 22Z" />
          <path {...common} d="M26 22 32 36l8-8" />
          <path {...common} d="M19 50h26" />
        </>
      ) : null}
      {id.includes("halfling") ? (
        <>
          <path {...common} d="M32 48c-10-8-16-15-16-24 0-7 8-10 16-2 8-8 16-5 16 2 0 9-6 16-16 24Z" />
          <path {...common} d="M32 48v8" />
          <path {...common} d="M24 56h16" />
        </>
      ) : null}
      {id.includes("human") ? (
        <>
          <circle {...common} cx="32" cy="18" r="8" />
          <path {...common} d="M18 54c2-13 8-20 14-20s12 7 14 20" />
          <path {...common} d="M18 32h28" />
        </>
      ) : null}
      {id.includes("orc") ? (
        <>
          <path {...common} d="M18 34c2-13 10-20 14-20s12 7 14 20c0 12-7 20-14 20s-14-8-14-20Z" />
          <path {...common} d="M24 38c2 6 14 6 16 0" />
          <path {...common} d="M25 39v9m14-9v9" />
          <path {...common} d="M24 28h.1M40 28h.1" />
        </>
      ) : null}
      {id.includes("tiefling") ? (
        <>
          <path {...common} d="M22 18c-7 5-8 12-2 19" />
          <path {...common} d="M42 18c7 5 8 12 2 19" />
          <path {...common} d="M22 28c0-10 20-10 20 0v14c0 8-20 8-20 0Z" />
          <path {...common} d="M28 48c2 4 6 4 8 0" />
        </>
      ) : null}
      {id.includes("aasimar") ? (
        <>
          <path {...common} d="M32 10 38 26l16 6-16 6-6 16-6-16-16-6 16-6Z" />
          <path {...common} d="M18 50c7-8 21-8 28 0" />
        </>
      ) : null}
      {id.includes("aarakocra") ? (
        <>
          <path {...common} d="M8 42c12-18 24-18 24-2 0-16 12-16 24 2" />
          <path {...common} d="M24 32 32 12l8 20" />
          <path {...common} d="M26 48h12" />
        </>
      ) : null}
      {id.includes("genasi") ? (
        <>
          <path {...common} d="M32 8c10 10 14 18 14 28a14 14 0 0 1-28 0c0-10 4-18 14-28Z" />
          <path {...common} d="M22 38c6-5 14-5 20 0" />
          <path {...common} d="M24 48c6 4 10 4 16 0" />
        </>
      ) : null}
      {!id ? (
        <>
          <path {...common} d="M32 12 44 20v24L32 52 20 44V20z" />
          <path {...common} d="M20 20 32 28l12-8" />
          <path {...common} d="M32 28v24" />
        </>
      ) : null}
    </svg>
  );
}

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
  const [rolls, setRolls] = useState<RollEntry[]>([]);
  const [consoleInput, setConsoleInput] = useState("add-ac 2");
  const [consoleLog, setConsoleLog] = useState<string[]>(["Console online"]);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authName, setAuthName] = useState("Clare");
  const [authEmail, setAuthEmail] = useState("clare@example.com");
  const [authPassword, setAuthPassword] = useState("adventure");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), 1650);
    fetch("/api/ruleset")
      .then((response) => response.json())
      .then((data: Ruleset) => {
        setRuleset(data);
        setDraft(createInitialDraft(data));
      })
      .catch(() => setStatus("Ruleset failed to load."));

    const stored = window.localStorage.getItem("forge-and-fable-user");
    if (stored) {
      queueMicrotask(() => setUser(JSON.parse(stored) as PublicUser));
    }

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    let mounted = true;

    fetch("/api/characters", {
      headers: {
        "x-user-id": user.id,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Vault session could not load.");
        }
        return response.json() as Promise<{ characters: Character[] }>;
      })
      .then((data) => {
        if (!mounted) {
          return;
        }
        setCharacters(data.characters);
        setSelectedId((current) => current || data.characters[0]?.id || "");
      })
      .catch((error: Error) => {
        if (mounted) {
          setStatus(error.message);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const selected = useMemo(
    () => characters.find((character) => character.id === selectedId) ?? characters[0] ?? null,
    [characters, selectedId],
  );

  const showCreationPrompt = creationPromptOpen || (!creatorOpen && characters.length === 0);
  const showCreator = creatorOpen;
  const selectedFinalAbilities = useMemo(() => {
    if (!selected || !ruleset) {
      return null;
    }
    return applyRaceBonuses(selected.abilities, selected.raceId, ruleset);
  }, [selected, ruleset]);
  const draftFinalAbilities = useMemo(() => {
    if (!draft || !ruleset) {
      return null;
    }
    return applyRaceBonuses(draft.abilities, draft.raceId, ruleset);
  }, [draft, ruleset]);
  const pointSpent = draft
    ? abilityKeys.reduce((sum, key) => sum + (pointCosts[draft.abilities[key]] ?? 99), 0)
    : 0;
  const pointRemaining = 27 - pointSpent;

  async function authRequest(event: FormEvent) {
    event.preventDefault();
    setStatus("");

    const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: authName,
        email: authEmail,
        password: authPassword,
      }),
    });

    const data = (await response.json()) as { user?: PublicUser; error?: string };

    if (!response.ok || !data.user) {
      setStatus(data.error ?? "Vault access failed.");
      return;
    }

    setUser(data.user);
    window.localStorage.setItem("forge-and-fable-user", JSON.stringify(data.user));
    setStatus(authMode === "login" ? "Account opened" : "Account created");
  }

  function logOut() {
    setUser(null);
    setCharacters([]);
    setSelectedId("");
    setCreationPromptOpen(false);
    setCreatorOpen(false);
    window.localStorage.removeItem("forge-and-fable-user");
    setStatus("Vault sealed");
  }

  function beginBuild(mode: BuildMode) {
    if (!ruleset) {
      return;
    }

    setBuildMode(mode);
    setDraft(createInitialDraft(ruleset));
    setStatMethod("point-buy");
    setCreatorStep(0);
    setCreatorOpen(true);
    setCreationPromptOpen(false);
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

    if (nextSpent > 27) {
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

  async function createHero() {
    if (!user || !ruleset || !draft) {
      return;
    }

    if (!draft.name.trim()) {
      setStatus("Name your character first");
      return;
    }

    if (draft.sourceIds.length === 0) {
      setStatus("Choose at least one source");
      return;
    }

    if (!draft.classId) {
      setStatus("Choose a class");
      return;
    }

    if (!draft.background) {
      setStatus("Choose a background");
      return;
    }

    if (!draft.raceId) {
      setStatus("Choose a species");
      return;
    }

    const response = await fetch("/api/characters", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": user.id,
      },
      body: JSON.stringify(characterPayload(draft, ruleset)),
    });

    const data = (await response.json()) as { character?: Character; error?: string };

    if (!response.ok || !data.character) {
      setStatus(data.error ?? "Hero could not be forged.");
      return;
    }

    setCharacters((current) => [data.character!, ...current]);
    setSelectedId(data.character.id);
    setCreationPromptOpen(false);
    setCreatorOpen(false);
    setCreatorStep(0);
    setDraft(createInitialDraft(ruleset));
    setStatMethod("point-buy");
    setStatus(`${data.character.name} forged`);
  }

  async function updateSelected(patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) {
    if (!user || !selected) {
      return;
    }

    const response = await fetch(`/api/characters/${selected.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": user.id,
      },
      body: JSON.stringify(patch),
    });
    const data = (await response.json()) as { character?: Character; error?: string };

    if (!response.ok || !data.character) {
      setStatus(data.error ?? "Update failed.");
      return;
    }

    setCharacters((current) =>
      current.map((character) =>
        character.id === data.character!.id ? data.character! : character,
      ),
    );
  }

  async function deleteSelected() {
    if (!user || !selected) {
      return;
    }

    const response = await fetch(`/api/characters/${selected.id}`, {
      method: "DELETE",
      headers: {
        "x-user-id": user.id,
      },
    });

    if (!response.ok) {
      setStatus("Hero could not be retired.");
      return;
    }

    setCharacters((current) => current.filter((character) => character.id !== selected.id));
    setSelectedId("");
    setStatus(`${selected.name} retired`);
  }

  function pushRoll(label: string, sides: number, count = 1, modifier = 0) {
    const dice = Array.from({ length: count }, () => rollDie(sides));
    const total = dice.reduce((sum, value) => sum + value, 0) + modifier;
    setRolls((current) =>
      [
        {
          id: crypto.randomUUID(),
          label,
          total,
          rolls: dice,
          modifier,
          createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...current,
      ].slice(0, 10),
    );
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

  if (!introDone || !ruleset || !draft) {
    return <SplashScreen />;
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        name={authName}
        email={authEmail}
        password={authPassword}
        status={status}
        onModeChange={setAuthMode}
        onNameChange={setAuthName}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSubmit={authRequest}
      />
    );
  }

  return (
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
          {showCreationPrompt ? (
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
              onCreate={createHero}
            />
          ) : selected && selectedFinalAbilities ? (
            <HeroSheet
              character={selected}
              finalAbilities={selectedFinalAbilities}
              ruleset={ruleset}
              onRoll={pushRoll}
              onUpdate={updateSelected}
              onDelete={deleteSelected}
              consoleInput={consoleInput}
              consoleLog={consoleLog}
              onConsoleInput={setConsoleInput}
              onConsoleSubmit={executeConsole}
            />
          ) : null}
        </section>

        <DiceTray rolls={rolls} onRoll={pushRoll} />
      </section>
    </main>
  );
}

function SplashScreen() {
  return (
    <main className="splash-screen">
      <div className="splash-mark">
        <Crown size={44} />
      </div>
      <div className="splash-copy">
        <span>Forge & Fable</span>
        <h1>Preparing the character vault</h1>
      </div>
      <div className="splash-progress">
        <span />
      </div>
    </main>
  );
}

function AuthScreen(props: {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
  status: string;
  onModeChange: (mode: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <main className="entry-screen">
      <section className="entry-copy">
        <div className="brand-line">
          <span className="brand-glyph">
            <Sparkles size={21} />
          </span>
          <span>Forge & Fable</span>
        </div>
        <h1>A Clarebear D&D character builder</h1>
        <p>Forge your fabled hero, roll your die, and seamlessly join campaigns at the touch of a button.</p>
      </section>

      <form className="login-card" onSubmit={props.onSubmit}>
        <div className="login-heading">
          <span>{props.mode === "login" ? "Welcome back" : "Create your account"}</span>
          <h2>{props.mode === "login" ? "Open Forge" : "Create account"}</h2>
        </div>
        <div className="mode-switch">
          <button
            type="button"
            className={props.mode === "login" ? "active" : ""}
            onClick={() => props.onModeChange("login")}
          >
            <LockKeyhole size={16} />
            Login
          </button>
          <button
            type="button"
            className={props.mode === "register" ? "active" : ""}
            onClick={() => props.onModeChange("register")}
          >
            <UserPlus size={16} />
            Register
          </button>
        </div>
        <label className="control-field">
          <span>Name</span>
          <input value={props.name} onChange={(event) => props.onNameChange(event.target.value)} />
        </label>
        <label className="control-field">
          <span>Email</span>
          <input
            type="email"
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
          />
        </label>
        <label className="control-field">
          <span>Password</span>
          <input
            type="password"
            value={props.password}
            onChange={(event) => props.onPasswordChange(event.target.value)}
          />
        </label>
        {props.status ? <span className="auth-status">{props.status}</span> : null}
        <button className="gold-button" type="submit">
          <Vault size={18} />
          {props.mode === "login" ? "Enter Studio" : "Create account"}
          <ArrowRight size={18} />
        </button>
      </form>
    </main>
  );
}

function CharacterStartPanel(props: {
  onSelectBuild: (mode: BuildMode) => void;
}) {
  const [selectedMode, setSelectedMode] = useState<BuildMode | null>(null);
  const buildModes: Array<{
    mode: BuildMode;
    icon: "standard" | "quickbuilder" | "premade";
    label: string;
    summary: string;
  }> = [
    {
      mode: "standard",
      icon: "standard",
      label: "Standard",
      summary: "Build step by step with full control over identity, sources, class, and attributes.",
    },
    {
      mode: "quickbuilder",
      icon: "quickbuilder",
      label: "Quickbuilder",
      summary: "Start from guided choices now, with faster recommendations planned next.",
    },
    {
      mode: "premade",
      icon: "premade",
      label: "Premade",
      summary: "Reserve a slot for future archetypes like tank, healer, face, and spellcaster.",
    },
  ];

  return (
    <div className="start-panel">
      <div className="start-copy">
        <span>Empty Character Vault</span>
        <h2>Create a new character</h2>
        <p>Choose how you want to begin. You can name the character and pick rule sources on the next screen.</p>
      </div>
      <div className="build-mode-grid">
        {buildModes.map((item) => (
          <button
            type="button"
            className={`build-mode-card ${selectedMode === item.mode ? "active" : ""}`}
            aria-pressed={selectedMode === item.mode}
            key={item.mode}
            onClick={() => setSelectedMode(item.mode)}
          >
            {item.icon === "standard" ? <ShieldCheck size={28} /> : null}
            {item.icon === "quickbuilder" ? <CircleGauge size={28} /> : null}
            {item.icon === "premade" ? <Swords size={28} /> : null}
            <strong>{item.label}</strong>
            <span>{item.summary}</span>
          </button>
        ))}
      </div>
      <div className="start-actions">
        <button
          type="button"
          className="gold-button"
          disabled={!selectedMode}
          onClick={() => selectedMode && props.onSelectBuild(selectedMode)}
        >
          Continue
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function CreatorPanel(props: {
  draft: DraftCharacter;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  buildMode: BuildMode;
  step: number;
  statMethod: StatMethod;
  pointRemaining: number;
  standardAssignments: AssignmentMap;
  rolledScores: number[];
  rolledAssignments: AssignmentMap;
  onDraftChange: (draft: DraftCharacter) => void;
  onStepChange: (step: number) => void;
  onMethodChange: (method: StatMethod) => void;
  onPointBuyChange: (ability: AbilityKey, delta: number) => void;
  onAssignmentChange: (type: "standard" | "rolled", ability: AbilityKey, nextIndex: number) => void;
  onRollStats: () => void;
  onCreate: () => void;
}) {
  const [inspectedClassId, setInspectedClassId] = useState<string | null>(null);
  const [inspectedSpeciesId, setInspectedSpeciesId] = useState<string | null>(null);
  const steps = ["Setup", "Class", "Origin", "Species", "Attributes", "Finalize"];
  const race = props.ruleset.races.find((item) => item.id === props.draft.raceId) ?? null;
  const heroClass =
    props.ruleset.classes.find((item) => item.id === props.draft.classId) ?? props.ruleset.classes[0];
  const inspectedClass = props.ruleset.classes.find((item) => item.id === inspectedClassId) ?? null;
  const inspectedSpecies = props.ruleset.races.find((item) => item.id === inspectedSpeciesId) ?? null;
  const showCharacterPreview = Boolean(props.draft.classId);
  const heroClassArt = showCharacterPreview ? classArtById[heroClass.id] : undefined;
  const buildModeLabel =
    props.buildMode === "quickbuilder"
      ? "Quickbuilder"
      : props.buildMode === "premade"
        ? "Premade"
        : "Standard";
  const toggleSource = (sourceId: string) => {
    const exists = props.draft.sourceIds.includes(sourceId);
    props.onDraftChange({
      ...props.draft,
      sourceIds: exists
        ? props.draft.sourceIds.filter((id) => id !== sourceId)
        : [...props.draft.sourceIds, sourceId],
    });
  };
  const canContinue =
    props.step === 0
      ? Boolean(props.draft.name.trim()) && props.draft.sourceIds.length > 0
      : props.step === 1
        ? Boolean(props.draft.classId)
        : props.step === 2
          ? Boolean(props.draft.background)
          : props.step === 3
            ? Boolean(props.draft.raceId)
            : true;
  const updateSettings = (settings: Partial<CharacterSettings>) => {
    props.onDraftChange({
      ...props.draft,
      settings: {
        ...props.draft.settings,
        ...settings,
      },
    });
  };

  return (
    <>
      <div className="creator-panel">
      <div className="creator-header">
        <div className="creator-title">
          <span>{buildModeLabel} Build</span>
          <h2>{props.draft.name || "New character"}</h2>
        </div>
        <div className="step-tabs">
          {steps.map((step, index) => (
            <button
              type="button"
              key={step}
              className={index === props.step ? "active" : ""}
              onClick={() => props.onStepChange(index)}
            >
              {index + 1}
              <span>{step}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="creator-stage">
        <section className="hero-preview" data-class={showCharacterPreview ? heroClass.id : undefined}>
          {heroClassArt ? (
            <div className="class-art-frame" data-class={heroClass.id}>
              <Image
                alt={`${heroClass.name} class art`}
                className="class-art-image"
                fill
                priority
                sizes="(max-width: 900px) 82vw, 36vw"
                src={heroClassArt}
              />
              <span className="class-art-badge" aria-hidden="true">
                <ClassIconPlaceholder classId={heroClass.id} size={34} strokeWidth={1.6} />
              </span>
            </div>
          ) : (
            <div className="class-icon-stage" data-class={showCharacterPreview ? heroClass.id : ""}>
              <ClassIconPlaceholder
                classId={showCharacterPreview ? heroClass.id : ""}
                size={92}
                strokeWidth={1.35}
              />
            </div>
          )}
          {showCharacterPreview ? (
            <div className="preview-identity-row">
              <div className="species-signal" data-species={race?.id ?? ""}>
                <span>
                  <SpeciesIconPlaceholder speciesId={race?.id ?? ""} size={30} strokeWidth={1.7} />
                </span>
                <div>
                  <strong>{race?.name ?? "Species"}</strong>
                  <small>{race ? `${race.creatureType} / ${race.size} / ${race.speed}` : "Unchosen"}</small>
                </div>
              </div>
              <div className="portrait-signal">
                <UserRound size={22} />
                <span>Custom portrait</span>
              </div>
            </div>
          ) : null}
          <div className="hero-summary">
            {showCharacterPreview ? (
              <>
                <strong>
                  {race ? `${race.name} ${heroClass.name}` : heroClass.name}
                </strong>
                <span>
                  {props.draft.background || "Choose a background"} / {props.draft.alignment}
                </span>
                <div className="summary-token-row">
                  <em>{heroClass.name}</em>
                  {race ? <em data-species={race.id}>{race.name}</em> : null}
                  {props.draft.background ? <em>{props.draft.background}</em> : null}
                </div>
              </>
            ) : (
              <>
                <strong>No class selected</strong>
                <span>
                  {props.step === 0
                    ? "Name your character and choose sources."
                    : "Choose a class to continue."}
                </span>
              </>
            )}
          </div>
          {showCharacterPreview ? (
            <div className="preview-stat-strip">
              {abilityKeys.map((key) => (
                <span key={key}>
                  {abilityLabels[key]}
                  <strong>{props.finalAbilities[key]}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="creator-controls">
          {props.step === 0 ? (
            <div className="setup-combo">
              <label className="control-field">
                <span>Character name</span>
                <input
                  value={props.draft.name}
                  placeholder="Enter a character name"
                  onChange={(event) => props.onDraftChange({ ...props.draft, name: event.target.value })}
                />
              </label>
              <SourceSettingsPanel
                selectedSourceIds={props.draft.sourceIds}
                settings={props.draft.settings}
                onToggleSource={toggleSource}
                onSettingsChange={updateSettings}
              />
            </div>
          ) : null}

          {props.step === 1 ? (
            <div className="choice-grid">
              {props.ruleset.classes.map((candidate) => {
                const selected = candidate.id === props.draft.classId;

                return (
                  <div
                    key={candidate.id}
                    className={`choice-tile class-choice ${selected ? "active" : ""}`}
                  >
                    <button
                      className="class-card-select"
                      type="button"
                      aria-label={`Select ${candidate.name}`}
                      aria-pressed={selected}
                      onClick={() => props.onDraftChange({ ...props.draft, classId: candidate.id })}
                    />
                    <span className="choice-avatar" data-class={candidate.id}>
                      <ClassIconPlaceholder classId={candidate.id} size={34} strokeWidth={1.65} />
                    </span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.sourceBook}</small>
                    <button
                      className="class-preview-button"
                      type="button"
                      aria-haspopup="dialog"
                      disabled={!selected}
                      onClick={() => setInspectedClassId(candidate.id)}
                    >
                      Preview class
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {props.step === 2 ? (
            <div className="origin-panel">
              <div className="choice-grid compact-choices">
                {props.ruleset.backgrounds.map((background) => (
                  <button
                    type="button"
                    key={background}
                    className={`choice-tile background-choice ${background === props.draft.background ? "active" : ""}`}
                    onClick={() => props.onDraftChange({ ...props.draft, background })}
                  >
                    <strong>{background}</strong>
                    <span>
                      {background === "Custom Background"
                        ? "Build a personal origin from your own story and campaign details."
                        : `Use the ${background.toLowerCase()} background as this character's starting story.`}
                    </span>
                  </button>
                ))}
              </div>
              <div className="notes-grid">
                <label className="control-field narrative-field">
                  <span>Physical characteristics</span>
                  <textarea
                    value={props.draft.physicalCharacteristics}
                    placeholder="Appearance, age, clothing, scars, posture, voice..."
                    onChange={(event) =>
                      props.onDraftChange({
                        ...props.draft,
                        physicalCharacteristics: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="control-field narrative-field">
                  <span>Personal characteristics</span>
                  <textarea
                    value={props.draft.personalCharacteristics}
                    placeholder="Ideals, bonds, flaws, habits, fears, mannerisms..."
                    onChange={(event) =>
                      props.onDraftChange({
                        ...props.draft,
                        personalCharacteristics: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="control-field narrative-field wide">
                  <span>General notes</span>
                  <textarea
                    value={props.draft.generalNotes}
                    placeholder="Backstory hooks, goals, campaign notes, table reminders..."
                    onChange={(event) =>
                      props.onDraftChange({
                        ...props.draft,
                        generalNotes: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}

          {props.step === 3 ? (
            <div className="choice-grid species-grid">
              {props.ruleset.races.map((candidate) => (
                <button
                  type="button"
                  key={candidate.id}
                  className={`choice-tile species-choice ${candidate.id === props.draft.raceId ? "active" : ""}`}
                  aria-haspopup="dialog"
                  onClick={() => setInspectedSpeciesId(candidate.id)}
                >
                  <span className="choice-avatar" data-species={candidate.id}>
                    <SpeciesIconPlaceholder speciesId={candidate.id} size={34} strokeWidth={1.65} />
                  </span>
                  <strong>{candidate.name}</strong>
                  <small>
                    {candidate.sourceLabel ? `${candidate.sourceLabel} / ` : ""}
                    {candidate.sourceBook}
                  </small>
                  <em>{candidate.id === props.draft.raceId ? "Selected" : "Preview species"}</em>
                </button>
              ))}
            </div>
          ) : null}

          {props.step === 4 ? (
            <div className="attribute-builder">
              <div className="method-row">
                <button
                  type="button"
                  className={props.statMethod === "point-buy" ? "active" : ""}
                  onClick={() => props.onMethodChange("point-buy")}
                >
                  <CircleGauge size={16} />
                  Point Buy
                </button>
                <button
                  type="button"
                  className={props.statMethod === "standard-array" ? "active" : ""}
                  onClick={() => props.onMethodChange("standard-array")}
                >
                  <ScrollText size={16} />
                  Array
                </button>
                <button
                  type="button"
                  className={props.statMethod === "roll" ? "active" : ""}
                  onClick={() => props.onMethodChange("roll")}
                >
                  <Dices size={16} />
                  Roll
                </button>
                <span className="points-pill">{props.pointRemaining} pts</span>
              </div>
              {props.statMethod === "roll" ? (
                <button className="glass-button small" type="button" onClick={props.onRollStats}>
                  <Dices size={16} />
                  Roll 4d6
                </button>
              ) : null}
              <div className="attribute-grid">
                {abilityKeys.map((key) => {
                  const raceBonus = race?.bonuses[key] ?? 0;
                  return (
                    <div className="attribute-card" key={key}>
                      <span>{abilityNames[key]}</span>
                      <strong>{props.finalAbilities[key]}</strong>
                      <small>
                        {props.draft.abilities[key]}
                        {raceBonus ? ` ${signed(raceBonus)}` : ""}
                      </small>
                      {props.statMethod === "point-buy" ? (
                        <div className="mini-stepper">
                          <button type="button" onClick={() => props.onPointBuyChange(key, -1)}>
                            <Minus size={14} />
                          </button>
                          <b>{props.draft.abilities[key]}</b>
                          <button type="button" onClick={() => props.onPointBuyChange(key, 1)}>
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <select
                          value={
                            props.statMethod === "standard-array"
                              ? props.standardAssignments[key]
                              : props.rolledAssignments[key]
                          }
                          onChange={(event) =>
                            props.onAssignmentChange(
                              props.statMethod === "standard-array" ? "standard" : "rolled",
                              key,
                              Number(event.target.value),
                            )
                          }
                        >
                          {(props.statMethod === "standard-array" ? standardArray : props.rolledScores).map(
                            (score, index) => (
                              <option value={index} key={`${score}-${index}`}>
                                {score}
                              </option>
                            ),
                          )}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {props.step === 5 ? (
            <div className="finalize-panel">
              <Gem size={34} />
              <h3>{props.draft.name}</h3>
              <p>
                Level 1 {race?.name ?? "Unchosen species"} {heroClass.name}
              </p>
              <div className="final-loadout">
                <span>{props.draft.background}</span>
                {race ? <span>{race.name}</span> : null}
                {props.draft.sourceIds.map((sourceId) => {
                  const source = sourceOptions.find((item) => item.id === sourceId);
                  return source ? <span key={source.id}>{source.name}</span> : null;
                })}
              </div>
              <div className="final-loadout">
                {heroClass.startingGear.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="creator-footer">
        <button
          className="glass-button"
          type="button"
          disabled={props.step === 0}
          onClick={() => props.onStepChange(Math.max(0, props.step - 1))}
        >
          Previous
        </button>
        {props.step < steps.length - 1 ? (
          <button
            className="gold-button"
            type="button"
            disabled={!canContinue}
            onClick={() => props.onStepChange(Math.min(steps.length - 1, props.step + 1))}
          >
            Continue
            <ChevronRight size={18} />
          </button>
        ) : (
          <button className="gold-button" type="button" onClick={props.onCreate}>
            <Save size={18} />
            Forge Hero
          </button>
        )}
      </div>
      </div>
      {inspectedClass ? (
        <ClassLearnModal
          heroClass={inspectedClass}
          selected={inspectedClass.id === props.draft.classId}
          onClose={() => setInspectedClassId(null)}
          onSelect={() => {
            props.onDraftChange({ ...props.draft, classId: inspectedClass.id });
            setInspectedClassId(null);
          }}
        />
      ) : null}
      {inspectedSpecies ? (
        <SpeciesLearnModal
          species={inspectedSpecies}
          selected={inspectedSpecies.id === props.draft.raceId}
          onClose={() => setInspectedSpeciesId(null)}
          onSelect={() => {
            props.onDraftChange({ ...props.draft, raceId: inspectedSpecies.id });
            setInspectedSpeciesId(null);
          }}
        />
      ) : null}
    </>
  );
}

function ClassLearnModal(props: {
  heroClass: HeroClass;
  selected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={props.onClose}>
      <section
        aria-labelledby="class-learn-title"
        aria-modal="true"
        className="class-modal"
        data-class={props.heroClass.id}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close">
          <X size={18} />
        </button>

        <div className="class-modal-hero">
          <div className="class-icon-stage compact" data-class={props.heroClass.id}>
            <ClassIconPlaceholder classId={props.heroClass.id} size={54} strokeWidth={1.45} />
          </div>
          <div>
            <span>{props.heroClass.sourceBook}</span>
            <h3 id="class-learn-title">{props.heroClass.name}</h3>
            <p>{props.heroClass.summary}</p>
          </div>
        </div>

        <div className="class-detail-stack">
          <details className="class-detail-card">
            <summary>
              <span>Core Traits</span>
              <ChevronRight size={18} />
            </summary>
            <div className="trait-grid">
              {props.heroClass.coreTraits.map((trait) => (
                <span key={trait}>{trait}</span>
              ))}
            </div>
          </details>

          <details className="class-detail-card" open>
            <summary>
              <span>Level Progression</span>
              <ChevronRight size={18} />
            </summary>
            <div className="level-list">
              {props.heroClass.levelProgression.map((entry) => (
                <div className="level-row" key={entry.level}>
                  <strong>Level {entry.level}</strong>
                  <div className="feature-stack">
                    {entry.features.map((feature) => (
                      <span className="feature-unlock" key={feature.name}>
                        <b>{feature.name}</b>
                        <small>{feature.description}</small>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="class-modal-actions">
          <button className="glass-button" type="button" onClick={props.onClose}>
            Back
          </button>
          <button className="gold-button" type="button" onClick={props.onSelect}>
            {props.selected ? "Keep class" : "Choose class"}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SpeciesLearnModal(props: {
  species: Race;
  selected: boolean;
  onClose: () => void;
  onSelect: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  return createPortal(
    <div className="modal-scrim" role="presentation" onMouseDown={props.onClose}>
      <section
        aria-labelledby="species-learn-title"
        aria-modal="true"
        className="class-modal species-modal"
        data-species={props.species.id}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="glass-icon modal-close" type="button" onClick={props.onClose} title="Close">
          <X size={18} />
        </button>

        <div className="class-modal-hero">
          <div className="class-icon-stage compact" data-species={props.species.id}>
            <SpeciesIconPlaceholder speciesId={props.species.id} size={54} strokeWidth={1.45} />
          </div>
          <div>
            <span>
              {props.species.sourceLabel ? `${props.species.sourceLabel} / ` : ""}
              {props.species.sourceBook}
            </span>
            <h3 id="species-learn-title">{props.species.name}</h3>
            <p>{props.species.summary}</p>
          </div>
        </div>

        <div className="class-detail-stack">
          <div className="species-facts">
            <span>
              Creature Type
              <strong>{props.species.creatureType}</strong>
            </span>
            <span>
              Size
              <strong>{props.species.size}</strong>
            </span>
            <span>
              Speed
              <strong>{props.species.speed}</strong>
            </span>
          </div>

          <details className="class-detail-card" open>
            <summary>
              <span>Unique Features & Traits</span>
              <ChevronRight size={18} />
            </summary>
            <div className="level-list species-trait-list">
              {props.species.traits.map((trait) => (
                <div className="level-row species-trait-row" key={trait.name}>
                  <strong>{trait.name}</strong>
                  <span className="feature-unlock">
                    <small>{trait.description}</small>
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="class-modal-actions">
          <button className="glass-button" type="button" onClick={props.onClose}>
            Back
          </button>
          <button className="gold-button" type="button" onClick={props.onSelect}>
            {props.selected ? "Keep species" : "Choose species"}
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SourceSettingsPanel(props: {
  selectedSourceIds: string[];
  settings: CharacterSettings;
  onToggleSource: (sourceId: string) => void;
  onSettingsChange: (settings: Partial<CharacterSettings>) => void;
}) {
  return (
    <div className="settings-panel">
      <section className="settings-section">
        <div className="settings-heading">
          <h3>Sources</h3>
          <p>
            You will only see character options from content you own and have enabled here in both the
            builder and your character sheet. Removing all sources will prevent you from being able to
            create a complete character.
          </p>
        </div>
        <div className="settings-list">
          {sourceOptions.map((source) => (
            <label className="checkbox-row source-row" key={source.id}>
              <input
                type="checkbox"
                checked={props.selectedSourceIds.includes(source.id)}
                onChange={() => props.onToggleSource(source.id)}
              />
              <span>
                <strong>{source.name}</strong>
                <small>{source.summary}</small>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h3>Dice Rolling</h3>
          <p>Enables digital dice rolling for all characters on this browser</p>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={props.settings.diceRollingEnabled}
            onChange={(event) =>
              props.onSettingsChange({ diceRollingEnabled: event.target.checked })
            }
          />
          <span>
            <strong>Enable Dice Rolling</strong>
          </span>
        </label>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h3>Optional Features</h3>
          <p>Allow or restrict optional features for this character</p>
        </div>
        <div className="settings-list compact">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.optionalClassFeatures}
              onChange={(event) =>
                props.onSettingsChange({ optionalClassFeatures: event.target.checked })
              }
            />
            <span>
              <strong>Optional Class Features</strong>
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.customizeOrigin}
              onChange={(event) => props.onSettingsChange({ customizeOrigin: event.target.checked })}
            />
            <span>
              <strong>Customize Your Origin</strong>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="select-grid">
          <label className="control-field">
            <span>Advancement Type</span>
            <small>Story-based character progression / XP-based character progression</small>
            <select
              value={props.settings.advancementType}
              onChange={(event) =>
                props.onSettingsChange({
                  advancementType: event.target.value as CharacterSettings["advancementType"],
                })
              }
            >
              <option value="milestone">Milestone</option>
              <option value="xp">XP-based</option>
            </select>
          </label>
          <label className="control-field">
            <span>Hit Point Type</span>
            <small>
              When leveling up, increase hit points by the fixed value for your chosen class or
              manually enter a rolled value
            </small>
            <select
              value={props.settings.hitPointType}
              onChange={(event) =>
                props.onSettingsChange({
                  hitPointType: event.target.value as CharacterSettings["hitPointType"],
                })
              }
            >
              <option value="fixed">Fixed</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-heading">
          <h3>Use Prerequisites</h3>
          <p>
            Allow or restrict choices based on rule prerequisites for the following for this
            character
          </p>
        </div>
        <div className="settings-list compact">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.usePrerequisites}
              onChange={(event) =>
                props.onSettingsChange({ usePrerequisites: event.target.checked })
              }
            />
            <span>
              <strong>Use Prerequisites</strong>
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.useFeatPrerequisites}
              onChange={(event) =>
                props.onSettingsChange({ useFeatPrerequisites: event.target.checked })
              }
            />
            <span>
              <strong>Feats</strong>
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.useMulticlassPrerequisites}
              onChange={(event) =>
                props.onSettingsChange({ useMulticlassPrerequisites: event.target.checked })
              }
            />
            <span>
              <strong>Multiclass Requirements</strong>
            </span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={props.settings.showLevelScaledSpells}
            onChange={(event) =>
              props.onSettingsChange({ showLevelScaledSpells: event.target.checked })
            }
          />
          <span>
            <strong>Show Level-Scaled Spells</strong>
            <small>
              Display and highlight available spells to cast with higher level spell slots
            </small>
          </span>
        </label>
      </section>

      <section className="settings-section">
        <div className="select-grid">
          <label className="control-field">
            <span>Encumbrance Type</span>
            <small>
              Use the standard encumbrance rules / Disable the encumbrance display / Use the more
              detailed rules for encumbrance
            </small>
            <select
              value={props.settings.encumbranceType}
              onChange={(event) =>
                props.onSettingsChange({
                  encumbranceType: event.target.value as CharacterSettings["encumbranceType"],
                })
              }
            >
              <option value="standard">Use Encumbrance</option>
              <option value="none">Disable Encumbrance</option>
              <option value="variant">Variant Encumbrance</option>
            </select>
          </label>
        </div>
        <div className="settings-list compact">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.ignoreCoinWeight}
              onChange={(event) => props.onSettingsChange({ ignoreCoinWeight: event.target.checked })}
            />
            <span>
              <strong>Ignore Coin Weight</strong>
              <small>Coins do not count against your total weight carried (50 coins weigh 1 lb.)</small>
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={props.settings.modifiersTop}
              onChange={(event) => props.onSettingsChange({ modifiersTop: event.target.checked })}
            />
            <span>
              <strong>Modifiers Top</strong>
              <small>Reverse the arrangement of ability modifiers and scores</small>
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}

function HeroSheet(props: {
  character: Character;
  finalAbilities: AbilityScores;
  ruleset: Ruleset;
  onRoll: (label: string, sides: number, count?: number, modifier?: number) => void;
  onUpdate: (patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) => void;
  onDelete: () => void;
  consoleInput: string;
  consoleLog: string[];
  onConsoleInput: (value: string) => void;
  onConsoleSubmit: (event: FormEvent) => void;
}) {
  const race = props.ruleset.races.find((item) => item.id === props.character.raceId) ?? props.ruleset.races[0];
  const heroClass =
    props.ruleset.classes.find((item) => item.id === props.character.classId) ?? props.ruleset.classes[0];
  const dexMod = abilityModifier(props.finalAbilities.dexterity);
  const ruleAc = props.character.customRules
    .filter((rule) => rule.type === "ac")
    .reduce((sum, rule) => sum + rule.value, 0);
  const armorClass = 10 + dexMod + ruleAc;
  const proficiency = proficiencyBonus(props.character.level);
  const hpPercent = Math.max(0, Math.min(100, (props.character.currentHp / props.character.maxHp) * 100));
  const knownSpells = props.ruleset.spells.filter((spell) => props.character.spellsKnown.includes(spell.id));

  return (
    <div className="sheet-panel">
      <section className="sheet-hero">
        <div className="class-icon-stage compact" data-class={heroClass.id}>
          <ClassIconPlaceholder classId={heroClass.id} size={54} strokeWidth={1.45} />
        </div>
        <div>
          <span>Active Character</span>
          <h2>{props.character.name}</h2>
          <p>
            Level {props.character.level} {race.name} {heroClass.name}
          </p>
        </div>
        <button className="danger-button" type="button" onClick={props.onDelete}>
          <Trash2 size={16} />
          Retire
        </button>
      </section>

      <section className="sheet-metrics">
        <span>
          <Shield size={18} />
          AC
          <strong>{armorClass}</strong>
        </span>
        <span>
          <Activity size={18} />
          Initiative
          <strong>{signed(dexMod)}</strong>
        </span>
        <span>
          <ShieldCheck size={18} />
          Proficiency
          <strong>{signed(proficiency)}</strong>
        </span>
        <span>
          <HeartPulse size={18} />
          HP
          <strong>
            {props.character.currentHp}/{props.character.maxHp}
          </strong>
        </span>
      </section>

      <section className="hp-module">
        <div className="hp-track">
          <span style={{ width: `${hpPercent}%` }} />
        </div>
        <div className="hp-controls">
          <button
            type="button"
            onClick={() => props.onUpdate({ currentHp: Math.max(0, props.character.currentHp - 1) })}
          >
            <Minus size={16} />
          </button>
          <strong>{props.character.currentHp}</strong>
          <button
            type="button"
            onClick={() =>
              props.onUpdate({ currentHp: Math.min(props.character.maxHp, props.character.currentHp + 1) })
            }
          >
            <Plus size={16} />
          </button>
        </div>
      </section>

      <section className="sheet-grid">
        {abilityKeys.map((key) => {
          const modifier = abilityModifier(props.finalAbilities[key]);
          return (
            <button
              type="button"
              className="sheet-stat"
              key={key}
              onClick={() => props.onRoll(`${abilityNames[key]} check`, 20, 1, modifier)}
            >
              <span>{abilityLabels[key]}</span>
              <strong>{props.finalAbilities[key]}</strong>
              <small>{signed(modifier)}</small>
            </button>
          );
        })}
      </section>

      <section className="play-columns">
        <div className="loadout-block">
          <h3>
            <Swords size={18} />
            Combat
          </h3>
          {heroClass.actions.map((action) => (
            <button
              type="button"
              className="action-row"
              key={action.name}
              onClick={() =>
                props.onRoll(
                  action.name,
                  20,
                  1,
                  abilityModifier(props.finalAbilities[action.ability]) + proficiency,
                )
              }
            >
              <span>{action.name}</span>
              <small>{action.formula}</small>
            </button>
          ))}
        </div>

        <div className="loadout-block">
          <h3>
            <Backpack size={18} />
            Inventory
          </h3>
          {props.character.inventory.map((item) => (
            <span className="item-row" key={item.id}>
              <strong>{item.name}</strong>
              <small>{item.rarity}</small>
            </span>
          ))}
        </div>

        <div className="loadout-block">
          <h3>
            <BookOpen size={18} />
            Spells
          </h3>
          {knownSpells.length > 0 ? (
            knownSpells.map((spell) => (
              <span className="item-row" key={spell.id}>
                <strong>{spell.name}</strong>
                <small>{spell.action}</small>
              </span>
            ))
          ) : (
            <span className="muted-line">No prepared spells</span>
          )}
        </div>
      </section>

      <form className="console-strip" onSubmit={props.onConsoleSubmit}>
        <label className="control-field">
          <span>Console</span>
          <input value={props.consoleInput} onChange={(event) => props.onConsoleInput(event.target.value)} />
        </label>
        <button className="glass-button" type="submit">
          <Terminal size={16} />
          Execute
        </button>
        <div className="console-output">
          {props.consoleLog.map((entry, index) => (
            <span key={`${entry}-${index}`}>{entry}</span>
          ))}
        </div>
      </form>
    </div>
  );
}

function DiceTray(props: {
  rolls: RollEntry[];
  onRoll: (label: string, sides: number, count?: number, modifier?: number) => void;
}) {
  const dice = [20, 12, 10, 8, 6, 4];

  return (
    <aside className="dice-panel">
      <div className="dice-heading">
        <span>Dice Tray</span>
        <Dices size={22} />
      </div>
      <div className="dice-buttons">
        {dice.map((sides) => (
          <button type="button" key={sides} onClick={() => props.onRoll(`d${sides}`, sides)}>
            d{sides}
          </button>
        ))}
      </div>
      <div className="roll-list">
        {props.rolls.length > 0 ? (
          props.rolls.map((roll) => (
            <div className="roll-card" key={roll.id}>
              <span>{roll.label}</span>
              <strong>{roll.total}</strong>
              <small>
                [{roll.rolls.join(", ")}] {roll.modifier ? signed(roll.modifier) : ""}
              </small>
            </div>
          ))
        ) : (
          <span className="muted-line">No rolls yet</span>
        )}
      </div>
    </aside>
  );
}
