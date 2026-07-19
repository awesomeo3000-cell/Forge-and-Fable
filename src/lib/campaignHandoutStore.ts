import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { MAX_TOTAL_MEDIA_STORAGE, totalMediaStorageBytes } from "@/lib/mediaStorage";

export const MAX_CAMPAIGN_HANDOUT_SIZE = 20 * 1024 * 1024;
export const MAX_CAMPAIGN_HANDOUT_STORAGE = 200 * 1024 * 1024;

export const CAMPAIGN_HANDOUT_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf",
  "text/plain", "text/markdown", "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function sniffHandoutMime(bytes: Buffer, declaredMime: string): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).toString("ascii") === "\xff\xd8\xff") return "image/jpeg";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "PK\x03\x04") return declaredMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? declaredMime : "application/zip";
  if (CAMPAIGN_HANDOUT_MIME_TYPES.has(declaredMime) && (declaredMime === "text/plain" || declaredMime === "text/markdown")) return declaredMime;
  return null;
}

export function saveCampaignHandoutAsset(campaignId: string, handoutId: string, userId: string, mime: string, bytes: Buffer): string {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const campaign = db.prepare("SELECT dm_user_id FROM campaigns WHERE id = ?").get(campaignId) as { dm_user_id: string } | undefined;
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.dm_user_id !== userId) throw new Error("Only the DM can upload handouts.");
    const current = db.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM campaign_handout_assets WHERE campaign_id = ?").get(campaignId) as { total: number };
    if (current.total + bytes.length > MAX_CAMPAIGN_HANDOUT_STORAGE) throw new Error(`This campaign has reached its ${MAX_CAMPAIGN_HANDOUT_STORAGE / 1024 / 1024} MB handout storage limit.`);
    if (totalMediaStorageBytes() + bytes.length > MAX_TOTAL_MEDIA_STORAGE) throw new Error("The server media storage limit has been reached.");
    const id = randomUUID();
    db.prepare("INSERT INTO campaign_handout_assets (id, handout_id, campaign_id, mime, bytes, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, handoutId, campaignId, mime, bytes, bytes.length, new Date().toISOString());
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getCampaignHandoutAsset(assetId: string, campaignId: string, handoutId: string, userId: string): { mime: string; bytes: Buffer } | null {
  const row = getDb().prepare(`
    SELECT a.mime, a.bytes, h.data, h.shared, c.dm_user_id
    FROM campaign_handout_assets a
    INNER JOIN campaign_handouts h ON h.id = a.handout_id AND h.campaign_id = a.campaign_id AND h.archived = 0
    INNER JOIN campaigns c ON c.id = a.campaign_id
    INNER JOIN campaign_members m ON m.campaign_id = a.campaign_id AND m.user_id = ?
    WHERE a.id = ? AND a.campaign_id = ? AND a.handout_id = ?
  `).get(userId, assetId, campaignId, handoutId) as { mime: string; bytes: Uint8Array; data: string; shared: number; dm_user_id: string } | undefined;
  if (!row) return null;
  if (row.dm_user_id !== userId) {
    if (row.shared !== 1) return null;
    const handout = JSON.parse(row.data) as { recipientUserId?: string | null };
    if (handout.recipientUserId && handout.recipientUserId !== userId) return null;
  }
  return { mime: row.mime, bytes: Buffer.from(row.bytes) };
}
