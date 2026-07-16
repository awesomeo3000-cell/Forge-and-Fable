/**
 * Context-aware home dashboard logic (dashboard handoff §14–§15).
 *
 * Pure, JSX-free and testable: given the account data the dashboard already
 * has (characters, campaigns, session presence), it resolves the dashboard
 * context, ranks the four action cards with exactly one primary, and selects
 * greeting/heading copy. The dashboard component maps each action id to an
 * existing app handler — no business logic or dashboard-only state lives here.
 */

export type DashboardContext = "new" | "player" | "dm" | "mixed";

/** Every action the grid can surface. The component owns the click handler;
    this module only decides which appear, their order, and the primary one. */
export type DashboardActionId =
  | "create-character"
  | "continue-character"
  | "start-campaign"
  | "open-campaign"
  | "join-campaign"
  | "next-session"
  | "prepare-session"
  | "review-party"
  | "import-character"
  | "manage-campaigns";

export type DashboardActionArt = "character" | "campaign" | "join" | "import";

export type DashboardAction = {
  id: DashboardActionId;
  title: string;
  description: string;
  cta: string;
  primary: boolean;
  art: DashboardActionArt;
};

/** Minimal campaign shape the dashboard reasons about (subset of CampaignSummary). */
export type DashboardCampaign = {
  id: string;
  name: string;
  myRole: "dm" | "player";
  myCharacterName: string | null;
};

/** Minimal character shape for attention/continuation reasoning. */
export type DashboardCharacter = {
  id: string;
  name: string;
  portraitUrl?: string;
  classId: string;
  raceId: string;
  background: string;
};

export type DashboardSignals = {
  userName: string;
  characters: DashboardCharacter[];
  campaigns: DashboardCampaign[];
  activeCampaignId: string | null;
  hasUpcomingSession: boolean;
  /** Hours 0–23; injectable for deterministic tests. Defaults to now. */
  hour?: number;
};

/** Resolve which of the four archetypes the account is in right now. */
export function resolveDashboardContext(signals: {
  characters: unknown[];
  campaigns: DashboardCampaign[];
}): DashboardContext {
  const hasCharacters = signals.characters.length > 0;
  const dmCampaigns = signals.campaigns.filter((c) => c.myRole === "dm").length;
  const playerCampaigns = signals.campaigns.filter((c) => c.myRole === "player").length;

  if (!hasCharacters && dmCampaigns === 0 && playerCampaigns === 0) return "new";
  if (dmCampaigns > 0 && (playerCampaigns > 0 || hasCharacters)) return "mixed";
  if (dmCampaigns > 0) return "dm";
  return "player";
}

/** The campaign to feature: the active one if set, else the first (most recent).
    Generic so callers keep their full campaign type (e.g. CampaignSummary). */
export function featuredCampaign<T extends { id: string }>(
  campaigns: T[],
  activeCampaignId: string | null,
): T | null {
  if (campaigns.length === 0) return null;
  return campaigns.find((c) => c.id === activeCampaignId) ?? campaigns[0];
}

function timeGreeting(hour: number): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export type DashboardGreeting = {
  kicker: string;
  title: string;
  text: string;
  heading: string;
  subhead: string;
};

export function dashboardGreeting(context: DashboardContext, signals: DashboardSignals): DashboardGreeting {
  const hour = signals.hour ?? new Date().getHours();
  const name = signals.userName.trim() || "Dreamwright";

  if (context === "new") {
    return {
      kicker: "Welcome, Dreamwright",
      title: "Welcome to the Hearth",
      text: "Your stories begin here. Build heroes, gather allies and bring legends to life.",
      heading: "Begin your journey",
      subhead: "The clearest first steps for an empty roster.",
    };
  }
  if (context === "dm") {
    return {
      kicker: "Your table",
      title: `${timeGreeting(hour)}, ${name}.`,
      text: "Your campaigns, session preparation and party activity are ready when you are.",
      heading: "Prepare the table",
      subhead: "Campaign work comes first, with player tools still close at hand.",
    };
  }
  if (context === "mixed") {
    return {
      kicker: "Your table",
      title: `${timeGreeting(hour)}, ${name}.`,
      text: "Your heroes, your campaigns and what needs your attention, gathered in one place.",
      heading: "Your next move",
      subhead: "Player and Dungeon Master work, ranked by what is happening now.",
    };
  }
  return {
    kicker: "Your table",
    title: `${timeGreeting(hour)}, ${name}.`,
    text: "Your heroes, your campaigns and what needs your attention, gathered in one place.",
    heading: "Your next move",
    subhead: "Resume what matters instead of choosing a role again.",
  };
}

const ACTION_COPY: Record<DashboardActionId, Omit<DashboardAction, "primary">> = {
  "create-character": { id: "create-character", title: "Create a Character", description: "Build a hero from the ground up and choose how detailed the commission should be.", cta: "Begin the commission", art: "character" },
  "continue-character": { id: "continue-character", title: "Continue Last Character", description: "Reopen your most recent hero and return to the character sheet.", cta: "Continue", art: "character" },
  "start-campaign": { id: "start-campaign", title: "Start a Campaign", description: "Open a table, invite players and prepare the world as Dungeon Master.", cta: "Open the table", art: "campaign" },
  "open-campaign": { id: "open-campaign", title: "Open Active Campaign", description: "Return to your table and pick up where the party left off.", cta: "Open campaign", art: "campaign" },
  "join-campaign": { id: "join-campaign", title: "Join a Campaign", description: "Enter a code from your Dungeon Master and connect to the party.", cta: "Join with a code", art: "join" },
  "next-session": { id: "next-session", title: "Next Session", description: "Review the upcoming session and party readiness.", cta: "View session", art: "campaign" },
  "prepare-session": { id: "prepare-session", title: "Prepare Next Session", description: "Review notes, encounters and unresolved session work.", cta: "Prepare", art: "campaign" },
  "review-party": { id: "review-party", title: "Review Party", description: "Check character readiness, assignments and player status.", cta: "View party", art: "campaign" },
  "import-character": { id: "import-character", title: "Import a Character", description: "Bring an existing character into Dreamwright.", cta: "Import now", art: "import" },
  "manage-campaigns": { id: "manage-campaigns", title: "Create or Join Another", description: "Start another campaign or connect to a table as a player.", cta: "Manage campaigns", art: "campaign" },
};

/** Rank the four action cards for the resolved context. The first entry is
    always the single primary card (handoff §6: one primary, not four). */
export function dashboardActions(context: DashboardContext, signals: DashboardSignals): DashboardAction[] {
  let order: DashboardActionId[];

  if (context === "new") {
    order = ["create-character", "start-campaign", "join-campaign", "import-character"];
  } else if (context === "dm") {
    order = ["open-campaign", "prepare-session", "review-party", "manage-campaigns"];
  } else if (context === "mixed") {
    // §14 ranking: current active work first, then the upcoming session, then
    // general creation. A mixed user is both DM and player, so lead with the
    // active table but keep the last hero one tap away.
    order = ["open-campaign", "continue-character", signals.hasUpcomingSession ? "next-session" : "prepare-session", "create-character"];
  } else {
    // player
    order = [
      signals.characters.length > 0 ? "continue-character" : "create-character",
      "open-campaign",
      signals.hasUpcomingSession ? "next-session" : "join-campaign",
      "create-character",
    ];
    // Avoid duplicate create-character when there are no characters.
    order = order.filter((id, index) => order.indexOf(id) === index);
    if (order.length < 4) order.push("import-character");
  }

  return order.slice(0, 4).map((id, index) => ({ ...ACTION_COPY[id], primary: index === 0 }));
}

export type AttentionSeverity = "info" | "warning";

export type AttentionItem = {
  id: string;
  characterId: string | null;
  label: string;
  detail: string;
  severity: AttentionSeverity;
};

/**
 * Honest, data-backed attention items only (handoff §9: "only actionable
 * items", "only render fields current data supports"). Derived from character
 * completeness — a missing portrait or an incomplete core record. Session and
 * readiness signals are surfaced separately where that data is loaded.
 */
export function deriveAttention(characters: DashboardCharacter[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const character of characters) {
    const incompleteCore = !character.classId || !character.raceId || !character.background;
    if (incompleteCore) {
      items.push({
        id: `incomplete-${character.id}`,
        characterId: character.id,
        label: `Finish ${character.name || "an unnamed hero"}`,
        detail: "This commission is missing a class, lineage or origin.",
        severity: "warning",
      });
    } else if (!character.portraitUrl) {
      items.push({
        id: `portrait-${character.id}`,
        characterId: character.id,
        label: `Add a likeness for ${character.name}`,
        detail: "No portrait has been chosen yet.",
        severity: "info",
      });
    }
  }
  return items;
}
