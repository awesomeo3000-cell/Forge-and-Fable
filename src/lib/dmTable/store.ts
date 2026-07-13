import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { CampaignCharacterNote, CampaignCharacterNoteCategory, CampaignPresence, CampaignPresenceState, CampaignRequest, CampaignRequestResponse } from "@/types/campaign";
import { scheduleRehearsalRequest } from "@/lib/dmTable/rehearsal";

export const PRESENCE_CONNECTED_MS = 20_000;
export const PRESENCE_DISCONNECTED_MS = 90_000;

type CampaignRow = { dm_user_id: string };
type MembershipRow = { character_id: string | null };

function campaign(campaignId: string) {
  const row = getDb().prepare("SELECT dm_user_id FROM campaigns WHERE id = ?").get(campaignId) as CampaignRow | undefined;
  if (!row) throw new Error("Campaign not found.");
  return row;
}

function membership(campaignId: string, userId: string) {
  const row = getDb().prepare("SELECT character_id FROM campaign_members WHERE campaign_id = ? AND user_id = ?").get(campaignId, userId) as MembershipRow | undefined;
  if (!row) throw new Error("Not a member of this campaign.");
  return row;
}

function requireDm(campaignId: string, userId: string) {
  if (campaign(campaignId).dm_user_id !== userId) throw new Error("Only the DM can do that.");
}

function presenceState(lastSeenAt: string | null, visibility: string | null, now: number): CampaignPresenceState {
  if (!lastSeenAt) return "disconnected";
  const elapsed = now - Date.parse(lastSeenAt);
  if (elapsed <= PRESENCE_CONNECTED_MS) return visibility === "hidden" ? "background" : "connected";
  if (elapsed <= PRESENCE_DISCONNECTED_MS) return "away";
  return "disconnected";
}

export function touchCampaignPresence(campaignId: string, userId: string, visibility: "visible" | "hidden") {
  const member = membership(campaignId, userId);
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO campaign_presence(campaign_id,user_id,character_id,visibility,last_seen_at) VALUES(?,?,?,?,?)
    ON CONFLICT(campaign_id,user_id) DO UPDATE SET character_id=excluded.character_id,visibility=excluded.visibility,last_seen_at=excluded.last_seen_at
  `).run(campaignId, userId, member.character_id, visibility, now);
}

export function listCampaignPresence(campaignId: string, userId: string, now = Date.now()): CampaignPresence[] {
  membership(campaignId, userId);
  const owner = campaign(campaignId).dm_user_id;
  const rows = getDb().prepare(`
    SELECT cm.user_id,cm.character_id,cp.visibility,cp.last_seen_at
    FROM campaign_members cm
    LEFT JOIN campaign_presence cp ON cp.campaign_id=cm.campaign_id AND cp.user_id=cm.user_id
    WHERE cm.campaign_id=? AND (? = cm.user_id OR ? = ? OR cm.is_ghost=0)
    ORDER BY cm.joined_at
  `).all(campaignId, userId, owner, userId) as Array<{ user_id: string; character_id: string | null; visibility: string | null; last_seen_at: string | null }>;
  return rows.map((row) => ({
    userId: row.user_id,
    characterId: row.character_id,
    state: presenceState(row.last_seen_at, row.visibility, now),
    lastSeenAt: row.last_seen_at,
  }));
}

const NOTE_CATEGORIES = new Set<CampaignCharacterNoteCategory>(["secret", "personal-hook", "relationship", "curse", "unidentified-item", "planned-beat", "reward", "general"]);

function noteFromRow(row: Record<string, unknown>): CampaignCharacterNote {
  return {
    id: String(row.id), campaignId: String(row.campaign_id), characterId: String(row.character_id),
    category: row.category as CampaignCharacterNoteCategory, title: String(row.title), body: String(row.body),
    ...(row.reminder_id ? { reminderId: String(row.reminder_id) } : {}),
    ...(row.resolved_at ? { resolvedAt: String(row.resolved_at) } : {}),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

function cleanNote(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Note must be an object.");
  const raw = input as Record<string, unknown>;
  const characterId = typeof raw.characterId === "string" ? raw.characterId.trim().slice(0, 64) : "";
  const category = typeof raw.category === "string" && NOTE_CATEGORIES.has(raw.category as CampaignCharacterNoteCategory) ? raw.category as CampaignCharacterNoteCategory : "general";
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 120) : "";
  const body = typeof raw.body === "string" ? raw.body.trim().slice(0, 4000) : "";
  if (!characterId || !title || !body) throw new Error("Character, title, and note text are required.");
  return { characterId, category, title, body };
}

function requireCampaignCharacter(campaignId: string, characterId: string) {
  const row = getDb().prepare("SELECT 1 FROM campaign_members WHERE campaign_id=? AND character_id=?").get(campaignId, characterId);
  if (!row) throw new Error("Character is not enrolled in this campaign.");
}

export function listCharacterNotes(campaignId: string, userId: string, characterId?: string) {
  requireDm(campaignId, userId);
  const rows = characterId
    ? getDb().prepare("SELECT * FROM campaign_character_notes WHERE campaign_id=? AND character_id=? ORDER BY updated_at DESC").all(campaignId, characterId)
    : getDb().prepare("SELECT * FROM campaign_character_notes WHERE campaign_id=? ORDER BY updated_at DESC").all(campaignId);
  return (rows as Array<Record<string, unknown>>).map(noteFromRow);
}

export function createCharacterNote(campaignId: string, userId: string, input: unknown) {
  requireDm(campaignId, userId);
  const clean = cleanNote(input);
  requireCampaignCharacter(campaignId, clean.characterId);
  const id = randomUUID(), now = new Date().toISOString();
  getDb().prepare("INSERT INTO campaign_character_notes(id,campaign_id,character_id,category,title,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, campaignId, clean.characterId, clean.category, clean.title, clean.body, now, now);
  return { id, campaignId, ...clean, createdAt: now, updatedAt: now } satisfies CampaignCharacterNote;
}

export function updateCharacterNote(campaignId: string, userId: string, noteId: string, input: unknown) {
  requireDm(campaignId, userId);
  const existing = getDb().prepare("SELECT * FROM campaign_character_notes WHERE id=? AND campaign_id=?").get(noteId, campaignId) as Record<string, unknown> | undefined;
  if (!existing) throw new Error("Character note not found.");
  const clean = cleanNote({ ...noteFromRow(existing), ...(input as Record<string, unknown>) });
  requireCampaignCharacter(campaignId, clean.characterId);
  const updatedAt = new Date().toISOString();
  getDb().prepare("UPDATE campaign_character_notes SET character_id=?,category=?,title=?,body=?,updated_at=? WHERE id=? AND campaign_id=?")
    .run(clean.characterId, clean.category, clean.title, clean.body, updatedAt, noteId, campaignId);
  return { ...noteFromRow(existing), ...clean, updatedAt };
}

export function deleteCharacterNote(campaignId: string, userId: string, noteId: string) {
  requireDm(campaignId, userId);
  const result = getDb().prepare("DELETE FROM campaign_character_notes WHERE id=? AND campaign_id=?").run(noteId, campaignId);
  if (!result.changes) throw new Error("Character note not found.");
}

function requestFromRow(row: Record<string, unknown>, responses: CampaignRequestResponse[]): CampaignRequest {
  return {
    id: String(row.id), campaignId: String(row.campaign_id), kind: row.kind as CampaignRequest["kind"],
    status: row.status as CampaignRequest["status"], resolution: row.resolution as CampaignRequest["resolution"],
    targetUserIds: JSON.parse(String(row.target_user_ids)) as string[],
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>, responses,
    createdAt: String(row.created_at), ...(row.resolved_at ? { resolvedAt: String(row.resolved_at) } : {}),
  };
}

export function createCampaignRequest(campaignId: string, userId: string, input: {
  kind: CampaignRequest["kind"];
  resolution: CampaignRequest["resolution"];
  targetUserIds: string[];
  payload: Record<string, unknown>;
}) {
  requireDm(campaignId, userId);
  const validTargets = new Set((getDb().prepare("SELECT user_id FROM campaign_members WHERE campaign_id=? AND user_id<>?").all(campaignId, userId) as Array<{ user_id: string }>).map((row) => row.user_id));
  const targetUserIds = [...new Set(input.targetUserIds)].filter((id) => validTargets.has(id)).slice(0, 50);
  if (!targetUserIds.length) throw new Error("Choose at least one campaign player.");
  const id = randomUUID(), createdAt = new Date().toISOString();
  getDb().prepare("INSERT INTO campaign_requests(id,campaign_id,kind,status,resolution,target_user_ids,payload,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(id, campaignId, input.kind, "open", input.resolution, JSON.stringify(targetUserIds), JSON.stringify(input.payload), createdAt);
  scheduleRehearsalRequest(campaignId, id);
  return { id, campaignId, ...input, targetUserIds, status: "open" as const, responses: [], createdAt } satisfies CampaignRequest;
}

export function respondToCampaignRequest(campaignId: string, userId: string, requestId: string, input: {
  status: CampaignRequestResponse["status"];
  total?: number;
  passed?: boolean;
  summary: string;
}) {
  membership(campaignId, userId);
  const row = getDb().prepare("SELECT * FROM campaign_requests WHERE id=? AND campaign_id=?").get(requestId, campaignId) as Record<string, unknown> | undefined;
  if (!row) throw new Error("Campaign request not found.");
  const targets = JSON.parse(String(row.target_user_ids)) as string[];
  if (!targets.includes(userId)) throw new Error("This request was not sent to you.");
  if (row.status !== "open") throw new Error("This request is no longer open.");
  const total = typeof input.total === "number" && Number.isInteger(input.total) ? Math.max(-999, Math.min(999, input.total)) : null;
  const passed = typeof input.passed === "boolean" ? Number(input.passed) : null;
  const summary = input.summary.trim().slice(0, 240);
  const respondedAt = new Date().toISOString();
  const db = getDb();
  db.prepare(`INSERT INTO campaign_request_responses(request_id,user_id,status,total,passed,summary,responded_at) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(request_id,user_id) DO UPDATE SET status=excluded.status,total=excluded.total,passed=excluded.passed,summary=excluded.summary,responded_at=excluded.responded_at`)
    .run(requestId, userId, input.status, total, passed, summary, respondedAt);
  const count = (db.prepare("SELECT COUNT(*) AS count FROM campaign_request_responses WHERE request_id=?").get(requestId) as { count: number }).count;
  if (count >= targets.length) db.prepare("UPDATE campaign_requests SET status='completed',resolved_at=? WHERE id=?").run(respondedAt, requestId);
  return { userId, status: input.status, ...(total !== null ? { total } : {}), ...(passed !== null ? { passed: Boolean(passed) } : {}), summary, respondedAt } satisfies CampaignRequestResponse;
}

export function listCampaignRequests(campaignId: string, userId: string): CampaignRequest[] {
  const owner = campaign(campaignId).dm_user_id;
  membership(campaignId, userId);
  const rows = getDb().prepare("SELECT * FROM campaign_requests WHERE campaign_id=? ORDER BY created_at DESC LIMIT 20").all(campaignId) as Array<Record<string, unknown>>;
  return rows.filter((row) => owner === userId || (JSON.parse(String(row.target_user_ids)) as string[]).includes(userId)).map((row) => {
    const responses = (getDb().prepare("SELECT * FROM campaign_request_responses WHERE request_id=? ORDER BY responded_at").all(String(row.id)) as Array<Record<string, unknown>>).map((response) => ({
      userId: String(response.user_id), status: response.status as CampaignRequestResponse["status"],
      ...(response.total !== null ? { total: Number(response.total) } : {}), ...(response.passed !== null ? { passed: Boolean(response.passed) } : {}),
      summary: String(response.summary), respondedAt: String(response.responded_at),
    }));
    return requestFromRow(row, responses);
  });
}
