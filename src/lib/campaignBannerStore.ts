import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export const MAX_CAMPAIGN_BANNER_SIZE = 8 * 1024 * 1024;

export const CAMPAIGN_BANNER_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function sniffCampaignBannerMime(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function saveCampaignBannerAsset(campaignId: string, mime: string, bytes: Buffer): string {
  const id = randomUUID();
  getDb().prepare("INSERT INTO campaign_banner_assets (id, campaign_id, mime, bytes, size, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, campaignId, mime, bytes, bytes.length, new Date().toISOString());
  return id;
}

export function getCampaignBannerAsset(id: string, campaignId: string, userId: string): { mime: string; bytes: Buffer } | null {
  const row = getDb().prepare(`
    SELECT a.mime, a.bytes
    FROM campaign_banner_assets a
    INNER JOIN campaign_members m ON m.campaign_id = a.campaign_id AND m.user_id = ?
    WHERE a.id = ? AND a.campaign_id = ?
  `).get(userId, id, campaignId) as { mime: string; bytes: Uint8Array } | undefined;
  return row ? { mime: row.mime, bytes: Buffer.from(row.bytes) } : null;
}

export function deleteCampaignBannerAsset(id: string, campaignId: string): void {
  getDb().prepare("DELETE FROM campaign_banner_assets WHERE id = ? AND campaign_id = ?").run(id, campaignId);
}
