import { describe, expect, it } from "vitest";
import {
  relativeTime,
  resolveViewerRole,
  selectActivity,
  selectAnnouncements,
  selectAttentionItems,
  selectBriefing,
  selectMyCharacter,
  selectNextSession,
  selectParty,
  selectReadiness,
} from "@/lib/campaignWorkspaceModel";
import type { CampaignEvent, CampaignMemberSummary } from "@/types/campaign";
import type { CampaignSession } from "@/types/dmTools";

const event = (over: Partial<CampaignEvent> & Pick<CampaignEvent, "type">): CampaignEvent => ({
  id: Math.random().toString(36).slice(2),
  campaign_id: "c1",
  target_user_id: null,
  created_by: "dm",
  created_at: "2026-07-16T12:00:00.000Z",
  payload: "{}",
  ...over,
});

const member = (over: Partial<CampaignMemberSummary> = {}): CampaignMemberSummary => ({
  userId: "u1",
  userName: "Ada",
  characterId: "ch1",
  characterName: "Liora",
  characterClass: "Sorcerer",
  characterLevel: 4,
  currentHp: 22,
  maxHp: 30,
  tempHp: 0,
  ac: 14,
  speed: "30 ft",
  passivePerception: 12,
  passiveInsight: 11,
  passiveInvestigation: 10,
  spellSaveDc: 14,
  conditions: [],
  concentratingOn: null,
  deathSaves: null,
  heroicInspiration: false,
  hitDice: null,
  spellSlots: [],
  ...over,
});

const session = (over: Partial<CampaignSession> = {}): CampaignSession => ({
  id: "s1",
  campaignId: "c1",
  startedAt: "2026-07-20T19:00:00.000Z",
  scheduledAt: "2026-07-20T19:00:00.000Z",
  status: "scheduled",
  ...over,
});

describe("resolveViewerRole", () => {
  it("is dm for the campaign owner", () => expect(resolveViewerRole("dm", "dm")).toBe("dm"));
  it("is player for anyone else", () => expect(resolveViewerRole("dm", "u1")).toBe("player"));
  it("is player when the viewer is unknown", () => expect(resolveViewerRole("dm", undefined)).toBe("player"));
});

describe("selectBriefing", () => {
  it("uses the latest announcement", () => {
    const events = [
      event({ type: "announce", payload: JSON.stringify({ message: "First" }), created_at: "2026-07-16T10:00:00.000Z" }),
      event({ type: "rest-short" }),
      event({ type: "announce", payload: JSON.stringify({ message: "Latest" }), created_at: "2026-07-16T11:00:00.000Z" }),
    ];
    expect(selectBriefing(events)?.message).toBe("Latest");
  });
  it("returns null with no announcement (no invented recap)", () => {
    expect(selectBriefing([event({ type: "rest-long" })])).toBeNull();
  });
});

describe("selectNextSession", () => {
  it("picks the nearest future scheduled session", () => {
    const soon = session({ id: "soon", scheduledAt: "2026-07-18T19:00:00.000Z" });
    const later = session({ id: "later", scheduledAt: "2026-07-25T19:00:00.000Z" });
    const past = session({ id: "past", scheduledAt: "2026-07-01T19:00:00.000Z" });
    const now = Date.parse("2026-07-16T00:00:00.000Z");
    expect(selectNextSession([later, past, soon], now)?.id).toBe("soon");
  });
  it("ignores completed and past sessions", () => {
    const now = Date.parse("2026-07-16T00:00:00.000Z");
    expect(selectNextSession([session({ status: "completed" })], now)).toBeNull();
  });
});

describe("selectParty / readiness / myCharacter", () => {
  it("excludes ghost members", () => {
    const party = selectParty([member(), member({ userId: "g", isGhost: true })]);
    expect(party).toHaveLength(1);
    expect(party[0].userId).toBe("u1");
  });
  it("marks members with a character ready and surfaces the portrait", () => {
    const party = selectParty([member({ characterJson: { portraitUrl: "/p.webp" } as never })]);
    expect(party[0].ready).toBe(true);
    expect(party[0].portraitId).toBe("/p.webp");
  });
  it("marks an unassigned member not ready", () => {
    const party = selectParty([member({ characterId: null, characterName: null })]);
    expect(party[0].ready).toBe(false);
  });
  it("counts readiness over real members only", () => {
    const r = selectReadiness([member(), member({ userId: "u2", characterId: null }), member({ userId: "g", isGhost: true })]);
    expect(r).toEqual({ ready: 1, total: 2 });
  });
  it("finds the viewer's own seat", () => {
    expect(selectMyCharacter([member({ userId: "u1" }), member({ userId: "u2" })], "u1")?.userId).toBe("u1");
    expect(selectMyCharacter([member()], "nobody")).toBeNull();
  });
});

describe("selectActivity / announcements", () => {
  it("derives meaningful events, newest first, excluding low-value types", () => {
    const events = [
      event({ type: "announce", payload: JSON.stringify({ message: "Hi party" }), created_at: "2026-07-16T09:00:00.000Z" }),
      event({ type: "condition-apply", payload: JSON.stringify({ label: "Poisoned" }) }),
      event({ type: "rest-long", created_at: "2026-07-16T10:00:00.000Z" }),
    ];
    const activity = selectActivity(events);
    expect(activity.map((a) => a.kind)).toEqual(["rest", "announce"]);
  });
  it("lists announcements newest first", () => {
    const events = [
      event({ type: "announce", payload: JSON.stringify({ message: "A" }), created_at: "2026-07-16T09:00:00.000Z" }),
      event({ type: "announce", payload: JSON.stringify({ message: "B" }), created_at: "2026-07-16T10:00:00.000Z" }),
    ];
    expect(selectAnnouncements(events).map((a) => a.message)).toEqual(["B", "A"]);
  });
});

describe("selectAttentionItems", () => {
  const now = Date.parse("2026-07-16T00:00:00.000Z");
  it("collects unassigned players, missing session and missing briefing", () => {
    const items = selectAttentionItems({
      members: [member(), member({ userId: "u2", userName: "Jamie", characterId: null })],
      sessions: [],
      events: [],
      now,
    });
    expect(items.map((item) => item.kind)).toEqual(["unassigned-character", "no-session", "no-briefing"]);
    expect(items[0].summary).toContain("Jamie");
    expect(items[0].section).toBe("party");
  });
  it("ignores ghosts and resolves once state exists", () => {
    const items = selectAttentionItems({
      members: [member(), member({ userId: "g", characterId: null, isGhost: true })],
      sessions: [session({ scheduledAt: "2026-07-20T19:00:00.000Z" })],
      events: [event({ type: "announce", payload: JSON.stringify({ message: "Onward" }) })],
      now,
    });
    expect(items).toEqual([]);
  });
});

describe("relativeTime", () => {
  it("formats recent gaps", () => {
    const now = Date.parse("2026-07-16T12:00:00.000Z");
    expect(relativeTime("2026-07-16T11:59:40.000Z", now)).toBe("just now");
    expect(relativeTime("2026-07-16T11:30:00.000Z", now)).toBe("30m ago");
    expect(relativeTime("2026-07-16T09:00:00.000Z", now)).toBe("3h ago");
    expect(relativeTime("2026-07-14T12:00:00.000Z", now)).toBe("2d ago");
  });
});
