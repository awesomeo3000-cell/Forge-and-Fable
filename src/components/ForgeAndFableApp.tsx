"use client";

import {
  LogOut,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type {
  AbilityKey,
  AbilityScores,
  AuthMode,
  BuildMode,
  Character,
  CustomRule,
  DraftCharacter,
  InventoryItem,
  PublicUser,
  RollOutcome,
  Ruleset,
  StatMethod,
} from "@/types/game";
import {
  abilityKeys,
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
import QuickbuilderPanel from "@/components/QuickbuilderPanel";
import HeroSheet from "@/components/HeroSheet";
import DiceRollOverlay, { type RollingDie } from "@/components/DiceRollOverlay";
import RollDrawer, { type RollHistoryEntry } from "@/components/RollDrawer";
import { FONT_STACKS } from "@/lib/skins";
import { POINT_BUY_BUDGET, SPLASH_DURATION_MS } from "@/lib/constants";
import { computeFeatBonuses } from "@/lib/featBonuses";

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("forge-and-fable-token") : "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token ?? ""}`,
  };
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
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLog, setConsoleLog] = useState<string[]>(["Console online"]);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [status, setStatus] = useState("");
  const [flyingDice, setFlyingDice] = useState<RollingDie[]>([]);
  const [rollHistory, setRollHistory] = useState<RollHistoryEntry[]>([]);

  const recordHistory = (label: string, detail: string, total: number) => {
    setRollHistory((prev) => [
      {
        id: crypto.randomUUID(),
        label,
        detail,
        total,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
      ...prev,
    ].slice(0, 30));
  };


  useEffect(() => {
    const timer = window.setTimeout(() => setIntroDone(true), SPLASH_DURATION_MS);
    fetch("/api/ruleset")
      .then((response) => response.json())
      .then((data: Ruleset) => {
        setRuleset(data);
        setDraft(createInitialDraft(data) as DraftCharacter);
      })
      .catch(() => setStatus("Ruleset failed to load."))
      .catch(() => {}); // already handled above

    const storedUser = window.localStorage.getItem("forge-and-fable-user");
    const storedToken = window.localStorage.getItem("forge-and-fable-token");
    if (storedUser && storedToken) {
      try {
        const parsed = JSON.parse(storedUser) as PublicUser;
        queueMicrotask(() => setUser(parsed));
      } catch {
        window.localStorage.removeItem("forge-and-fable-user");
        window.localStorage.removeItem("forge-and-fable-token");
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
      headers: {
        Authorization: `Bearer ${window.localStorage.getItem("forge-and-fable-token") ?? ""}`,
      },
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

  const draftFinalAbilities = useMemo(() => {
    if (!draft || !ruleset) {
      return null;
    }
    return applyRaceBonuses(draft.abilities, draft.raceId, ruleset);
  }, [draft, ruleset]);
  const pointSpent = draft
    ? abilityKeys.reduce((sum, key) => sum + (pointCosts[draft.abilities[key]] ?? 99), 0)
    : 0;
  const pointRemaining = POINT_BUY_BUDGET - pointSpent;

  async function authRequest(event: FormEvent) {
    event.preventDefault();
    setStatus("");

    const response = await fetch(authMode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: authEmail,
        password: authPassword,
      }),
    });

    const data = (await response.json()) as { user?: PublicUser; token?: string; error?: string };

    if (!response.ok || !data.user || !data.token) {
      setStatus(data.error ?? "Vault access failed.");
      return;
    }

    setUser(data.user);
    window.localStorage.setItem("forge-and-fable-user", JSON.stringify(data.user));
    window.localStorage.setItem("forge-and-fable-token", data.token);
    setStatus(authMode === "login" ? "Tome opened" : "Account inscribed");
  }

  function logOut() {
    setUser(null);
    setCharacters([]);
    setSelectedId("");
    setCreationPromptOpen(false);
    setCreatorOpen(false);
    window.localStorage.removeItem("forge-and-fable-user");
    window.localStorage.removeItem("forge-and-fable-token");
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

    const response = await fetch("/api/characters", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(characterPayload(draft, ruleset)),
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
    setStatus(`${data.character.name} forged`);
  }

  async function updateSelected(patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>) {
    if (!user || !selected) {
      return;
    }

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
  }

  async function deleteSelected() {
    if (!user || !selected) {
      return;
    }

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
  }

  function pushRoll(
    label: string,
    sides: number,
    count = 1,
    modifier = 0,
    onResult?: (outcome: RollOutcome) => void,
  ) {
    const rolls = Array<number>(count).fill(0);
    const finishedIndices = new Set<number>();
    let finished = 0;
    // Include modifier in the label so users see the full roll info (e.g. "1d20+5")
    const fullLabel = `${label}${modifier !== 0 ? ` ${signed(modifier)}` : ""}`;
    const diceNotation = count > 1 ? `${count}d${sides}` : `d${sides}`;

    const recordResult = (outcome: RollOutcome) => {
      const parts = outcome.rolls.join("+");
      const totalStr = modifier !== 0 ? `${parts}${signed(modifier)} = ${outcome.total}` : `${parts} = ${outcome.total}`;
      setConsoleLog((prev) => [`${diceNotation}${modifier !== 0 ? signed(modifier) : ""}  →  ${totalStr}  (${label})`, ...prev].slice(0, 20));
      recordHistory(label, `${diceNotation}${modifier !== 0 ? signed(modifier) : ""}: ${totalStr}`, outcome.total);
      onResult?.(outcome);
    };

    const newDice: RollingDie[] = Array.from({ length: count }, (_, i) => {
      const fromLeft = Math.random() > 0.5;
      const result = rollDie(sides);
      return {
        id: `${crypto.randomUUID()}-${i}`,
        sides,
        result,
        label: fullLabel,
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
  function pushPool(groups: { sides: number; count: number }[], modifier: number, label: string) {
    const cleaned = groups.filter((g) => g.count > 0);
    const totalCount = cleaned.reduce((s, g) => s + g.count, 0);
    if (totalCount === 0 || totalCount > 40) return;

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
    setConsoleLog((prev) => [`${label} -> ${total}`, ...prev].slice(0, 20));
    recordHistory(label, detail, total);
    setFlyingDice((prev) => [...prev, ...newDice]);
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

  if (!introDone || !ruleset || !draft) {
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
        status={status}
        onModeChange={setAuthMode}
        onEmailChange={setAuthEmail}
        onPasswordChange={setAuthPassword}
        onSubmit={authRequest}
      />
    );
  }

  return (
    <>
    <DiceRollOverlay dice={flyingDice} onExpire={expireDie} accentHex={diceAccent} fontStack={diceFont} />
    <RollDrawer history={rollHistory} theme={selected?.theme ?? null} onRollPool={pushPool} />
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
          {buildMode !== "standard" && !creatorOpen ? (
            <QuickbuilderPanel
              ruleset={ruleset}
              mode={buildMode}
              onComplete={handleQuickbuildComplete}
              onCancel={() => { setCreationPromptOpen(true); setBuildMode("standard"); }}
            />
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
