import { describe, expect, it } from "vitest";
import {
  dashboardActions,
  dashboardGreeting,
  deriveAttention,
  featuredCampaign,
  resolveDashboardContext,
  type DashboardCampaign,
  type DashboardCharacter,
  type DashboardSignals,
} from "@/lib/dashboardContext";

const char = (over: Partial<DashboardCharacter> = {}): DashboardCharacter => ({
  id: "c1",
  name: "Liora",
  portraitUrl: "/portraits/1.webp",
  classId: "sorcerer",
  raceId: "human",
  background: "Sage",
  ...over,
});

const campaign = (over: Partial<DashboardCampaign> = {}): DashboardCampaign => ({
  id: "camp1",
  name: "The Shattered Vale",
  myRole: "player",
  myCharacterName: "Liora",
  ...over,
});

const signals = (over: Partial<DashboardSignals> = {}): DashboardSignals => ({
  userName: "Ddd",
  characters: [],
  campaigns: [],
  activeCampaignId: null,
  hasUpcomingSession: false,
  hour: 14,
  ...over,
});

describe("resolveDashboardContext", () => {
  it("is 'new' for an empty account", () => {
    expect(resolveDashboardContext({ characters: [], campaigns: [] })).toBe("new");
  });
  it("is 'player' with characters but no campaigns", () => {
    expect(resolveDashboardContext({ characters: [char()], campaigns: [] })).toBe("player");
  });
  it("is 'player' when only a member of a table", () => {
    expect(resolveDashboardContext({ characters: [], campaigns: [campaign({ myRole: "player" })] })).toBe("player");
  });
  it("is 'dm' when only running tables", () => {
    expect(resolveDashboardContext({ characters: [], campaigns: [campaign({ myRole: "dm" })] })).toBe("dm");
  });
  it("is 'mixed' when running a table and holding a hero", () => {
    expect(resolveDashboardContext({ characters: [char()], campaigns: [campaign({ myRole: "dm" })] })).toBe("mixed");
  });
  it("is 'mixed' when both DM and player of tables", () => {
    expect(
      resolveDashboardContext({ characters: [], campaigns: [campaign({ id: "a", myRole: "dm" }), campaign({ id: "b", myRole: "player" })] }),
    ).toBe("mixed");
  });
});

describe("dashboardActions", () => {
  it("gives exactly one primary in every context", () => {
    for (const context of ["new", "player", "dm", "mixed"] as const) {
      const actions = dashboardActions(context, signals({ characters: [char()], campaigns: [campaign()] }));
      expect(actions).toHaveLength(4);
      expect(actions.filter((a) => a.primary)).toHaveLength(1);
      expect(actions[0].primary).toBe(true);
    }
  });
  it("leads a new account with Create a Character", () => {
    const actions = dashboardActions("new", signals());
    expect(actions[0].id).toBe("create-character");
    expect(actions.map((a) => a.id)).toEqual(["create-character", "start-campaign", "join-campaign", "import-character"]);
  });
  it("leads a returning player with Continue Last Character", () => {
    const actions = dashboardActions("player", signals({ characters: [char()], campaigns: [campaign()] }));
    expect(actions[0].id).toBe("continue-character");
  });
  it("leads a DM with Open Active Campaign", () => {
    const actions = dashboardActions("dm", signals({ campaigns: [campaign({ myRole: "dm" })] }));
    expect(actions[0].id).toBe("open-campaign");
  });
  it("surfaces Next Session for a player only when a session exists", () => {
    const withSession = dashboardActions("player", signals({ characters: [char()], campaigns: [campaign()], hasUpcomingSession: true }));
    expect(withSession.map((a) => a.id)).toContain("next-session");
    const without = dashboardActions("player", signals({ characters: [char()], campaigns: [campaign()] }));
    expect(without.map((a) => a.id)).not.toContain("next-session");
  });
  it("never repeats an action id", () => {
    const actions = dashboardActions("player", signals({ characters: [] }));
    const ids = actions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("dashboardGreeting", () => {
  it("welcomes a new user to the Hearth without their name in the title", () => {
    const greeting = dashboardGreeting("new", signals());
    expect(greeting.title).toBe("Welcome to the Hearth");
  });
  it("greets returning users by name and time of day", () => {
    expect(dashboardGreeting("player", signals({ hour: 9 })).title).toBe("Good morning, Ddd.");
    expect(dashboardGreeting("dm", signals({ hour: 20 })).title).toBe("Good evening, Ddd.");
  });
  it("falls back to Dreamwright when the name is blank", () => {
    expect(dashboardGreeting("player", signals({ userName: "  ", hour: 14 })).title).toBe("Good afternoon, Dreamwright.");
  });
});

describe("featuredCampaign", () => {
  it("prefers the active campaign", () => {
    const list = [campaign({ id: "a" }), campaign({ id: "b" })];
    expect(featuredCampaign(list, "b")?.id).toBe("b");
  });
  it("falls back to the first (most recent) campaign", () => {
    const list = [campaign({ id: "a" }), campaign({ id: "b" })];
    expect(featuredCampaign(list, null)?.id).toBe("a");
  });
  it("returns null with no campaigns", () => {
    expect(featuredCampaign([], "x")).toBeNull();
  });
});

describe("deriveAttention", () => {
  it("flags an incomplete core record over a missing portrait", () => {
    const items = deriveAttention([char({ classId: "", portraitUrl: undefined })]);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe("warning");
    expect(items[0].id).toMatch(/^incomplete-/);
  });
  it("flags a missing portrait on an otherwise complete hero", () => {
    const items = deriveAttention([char({ portraitUrl: undefined })]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toMatch(/^portrait-/);
    expect(items[0].severity).toBe("info");
  });
  it("says nothing about a complete hero", () => {
    expect(deriveAttention([char()])).toHaveLength(0);
  });
});
