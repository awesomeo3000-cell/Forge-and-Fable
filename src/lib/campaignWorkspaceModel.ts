/**
 * Option C campaign workspace selectors (campaign workspace handoff §18).
 *
 * Pure adapters that shape the existing campaign data (sync payload members,
 * events, sessions) into the presentation view model the workspace renders.
 * No new persisted models — objectives, handouts, recaps, descriptions and
 * archived status do not exist yet and are surfaced as honest empty states by
 * the components, not fabricated here.
 */

import type { CampaignEvent, CampaignMemberSummary } from "@/types/campaign";
import type { CampaignHandout, CampaignJournalEntry, CampaignSession } from "@/types/dmTools";

export type CampaignViewerRole = "player" | "dm";

export function resolveViewerRole(dmUserId: string, viewerUserId: string | undefined): CampaignViewerRole {
  return viewerUserId && dmUserId === viewerUserId ? "dm" : "player";
}

function parsePayload(event: CampaignEvent): Record<string, unknown> {
  try {
    const parsed = JSON.parse(event.payload);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type CampaignBriefing = {
  title?: string;
  message: string;
  at: string;
  source: "announcement" | "recap";
};

/**
 * Campaign Briefing (§8.2) from the latest published announcement. Use
 * selectBriefingContent when player-visible journal data is available — it
 * also considers session recaps.
 */
export function selectBriefing(events: CampaignEvent[]): CampaignBriefing | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.type === "announce") {
      const message = parsePayload(event).message;
      if (typeof message === "string" && message.trim()) {
        return { message: message.trim(), at: event.created_at, source: "announcement" };
      }
    }
  }
  return null;
}

/**
 * Campaign Briefing with journal sources (§8.2): the freshest of the latest
 * session recap (player-visible journal entry of type "session") and the
 * latest DM announcement. No invented narrative — null means the empty state.
 */
export function selectBriefingContent(events: CampaignEvent[], journal: CampaignJournalEntry[]): CampaignBriefing | null {
  const announcement = selectBriefing(events);
  const recapEntry = journal
    .filter((entry) => entry.type === "session" && entry.body.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const recap: CampaignBriefing | null = recapEntry
    ? { title: recapEntry.title, message: recapEntry.body.trim(), at: recapEntry.updatedAt, source: "recap" }
    : null;
  if (recap && announcement) return Date.parse(recap.at) >= Date.parse(announcement.at) ? recap : announcement;
  return recap ?? announcement;
}

export type ObjectiveView = {
  id: string;
  title: string;
  body: string;
  status: "active" | "completed";
};

/**
 * Current Objectives (§9): player-visible journal entries of type "quest".
 * Server-side visibility filtering already removed DM-private entries.
 * Active first, then recently completed; archived quests are dropped.
 */
export function selectObjectives(journal: CampaignJournalEntry[], limit = 6): ObjectiveView[] {
  const quests = journal.filter((entry) => entry.type === "quest" && entry.status !== "archived");
  const rank = (entry: CampaignJournalEntry) => (entry.status === "active" ? 0 : 1);
  return quests
    .sort((a, b) => rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((entry) => ({ id: entry.id, title: entry.title, body: entry.body, status: entry.status === "active" ? "active" : "completed" }));
}

export type HandoutView = {
  id: string;
  title: string;
  category: string;
  folderId?: string | null;
  assetType: CampaignHandout["assetType"];
  assetUrl?: string;
  body?: string;
  description?: string;
  shared: boolean;
  sharedAt: string;
};

/** Player-visible handouts, most recently shared first (§11). */
export function selectHandouts(handouts: Array<Omit<CampaignHandout, "privateNotes">>, limit = Infinity): HandoutView[] {
  return handouts
    .filter((item) => !item.archived)
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      folderId: item.folderId ?? null,
      assetType: item.assetType,
      assetUrl: item.assetUrl,
      body: item.body,
      description: item.description,
      shared: item.shared,
      sharedAt: item.lastSharedAt ?? item.firstSharedAt ?? item.updatedAt,
    }))
    .sort((a, b) => b.sharedAt.localeCompare(a.sharedAt))
    .slice(0, limit === Infinity ? undefined : limit);
}

/** Count of unread-ish announcements (all announcements, most-recent first). */
export function selectAnnouncements(events: CampaignEvent[], limit = 5): Array<{ id: string; message: string; at: string }> {
  const out: Array<{ id: string; message: string; at: string }> = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const event = events[i];
    if (event.type === "announce") {
      const message = parsePayload(event).message;
      if (typeof message === "string" && message.trim()) out.push({ id: event.id, message: message.trim(), at: event.created_at });
    }
  }
  return out;
}

/** The session currently being played, or null. */
export function selectActiveSession(sessions: CampaignSession[]): CampaignSession | null {
  return sessions.find((session) => session.status === "active") ?? null;
}

/** Nearest scheduled future session, or null. */
export function selectNextSession(sessions: CampaignSession[], now = Date.now()): CampaignSession | null {
  return (
    sessions
      .filter((session) => session.status === "scheduled" && Date.parse(session.scheduledAt ?? session.startedAt) >= now)
      .sort((a, b) => Date.parse(a.scheduledAt ?? a.startedAt) - Date.parse(b.scheduledAt ?? b.startedAt))[0] ?? null
  );
}

export type PartyMemberView = {
  userId: string;
  userName: string;
  characterId: string | null;
  characterName: string | null;
  characterClass: string | null;
  characterLevel: number | null;
  currentHp: number | null;
  maxHp: number | null;
  conditions: string[];
  portraitId: string | null;
  ready: boolean;
};

/** Real party members (ghosts excluded — DM-only rehearsal seats, §10.2). */
export function selectParty(members: CampaignMemberSummary[]): PartyMemberView[] {
  return members
    .filter((member) => !member.isGhost)
    .map((member) => ({
      userId: member.userId,
      userName: member.userName,
      characterId: member.characterId,
      characterName: member.characterName,
      characterClass: member.characterClass,
      characterLevel: member.characterLevel,
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      conditions: member.conditions ?? [],
      portraitId: member.characterJson?.portraitUrl ?? null,
      ready: Boolean(member.characterId),
    }));
}

export function selectReadiness(members: CampaignMemberSummary[]): { ready: number; total: number } {
  const party = members.filter((member) => !member.isGhost);
  return { ready: party.filter((member) => member.characterId).length, total: party.length };
}

/** The viewer's own party seat (their assigned character), or null. */
export function selectMyCharacter(members: CampaignMemberSummary[], viewerUserId: string | undefined): PartyMemberView | null {
  if (!viewerUserId) return null;
  return selectParty(members).find((member) => member.userId === viewerUserId) ?? null;
}

export type ActivityKind = "announce" | "session" | "handout" | "rest" | "roll" | "loot" | "event";

export type ActivityItemView = {
  id: string;
  kind: ActivityKind;
  summary: string;
  at: string;
};

const ACTIVITY_TYPES = new Set<CampaignEvent["type"]>([
  "announce",
  "handout",
  "rest-short",
  "rest-long",
  "roll-request",
  "loot-offer",
]);

/**
 * Meaningful activity from existing events (§13.3): announcements, handouts,
 * rests, roll requests and loot. Field saves, presence and silent autosaves
 * are never events here, so nothing low-value leaks in.
 */
export function selectActivity(events: CampaignEvent[], limit = 5): ActivityItemView[] {
  const out: ActivityItemView[] = [];
  for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
    const event = events[i];
    if (!ACTIVITY_TYPES.has(event.type)) continue;
    const payload = parsePayload(event);
    if (event.type === "announce") {
      const message = typeof payload.message === "string" ? payload.message : "An announcement";
      out.push({ id: event.id, kind: "announce", summary: message, at: event.created_at });
    } else if (event.type === "handout") {
      const title = typeof payload.title === "string" ? payload.title : "a handout";
      out.push({ id: event.id, kind: "handout", summary: `A handout was shared: ${title}`, at: event.created_at });
    } else if (event.type === "rest-short" || event.type === "rest-long") {
      out.push({ id: event.id, kind: "rest", summary: event.type === "rest-short" ? "A short rest was called" : "A long rest was called", at: event.created_at });
    } else if (event.type === "roll-request") {
      out.push({ id: event.id, kind: "roll", summary: "The DM requested a roll", at: event.created_at });
    } else if (event.type === "loot-offer") {
      const name = typeof payload.name === "string" ? payload.name : "an item";
      out.push({ id: event.id, kind: "loot", summary: `Loot offered: ${name}`, at: event.created_at });
    }
  }
  return out;
}

export type AttentionItem = {
  id: string;
  kind: "unassigned-character" | "no-session" | "no-briefing";
  summary: string;
  /** Workspace section the item resolves in. */
  section: "party" | "sessions" | "overview";
};

/**
 * DM "Needs Attention" items (§15.2) computed from real campaign state only:
 * players without an assigned character, no scheduled next session, and no
 * published briefing. No invented preparation tasks — those systems do not
 * exist yet.
 */
export function selectAttentionItems(input: {
  members: CampaignMemberSummary[];
  sessions: CampaignSession[];
  events: CampaignEvent[];
  journal?: CampaignJournalEntry[];
  now?: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const member of input.members) {
    if (member.isGhost || member.characterId) continue;
    items.push({
      id: `unassigned-${member.userId}`,
      kind: "unassigned-character",
      summary: `${member.userName} has no assigned character`,
      section: "party",
    });
  }
  if (!selectNextSession(input.sessions, input.now)) {
    items.push({ id: "no-session", kind: "no-session", summary: "The next session has not been scheduled", section: "sessions" });
  }
  if (!selectBriefingContent(input.events, input.journal ?? [])) {
    items.push({ id: "no-briefing", kind: "no-briefing", summary: "No briefing has been published for the party", section: "overview" });
  }
  return items;
}

/** Compact relative-time label for activity/announcement timestamps. */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString([], { month: "short", day: "numeric" });
}
