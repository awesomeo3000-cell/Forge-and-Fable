import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { getUserById } from "@/lib/vaultStore";
import { sendNotificationEmail } from "@/lib/email";

export type NotificationPreferences = {
  dmInboxEnabled: boolean;
  dmEmailEnabled: boolean;
};

export type UserNotification = {
  id: string;
  campaignId: string | null;
  kind: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

type PreferenceRow = {
  dm_inbox_enabled: number;
  dm_email_enabled: number;
};

type NotificationRow = {
  id: string;
  campaign_id: string | null;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  dmInboxEnabled: false,
  dmEmailEnabled: false,
};

function preferenceRow(userId: string): PreferenceRow | undefined {
  return getDb().prepare(
    "SELECT dm_inbox_enabled, dm_email_enabled FROM user_notification_preferences WHERE user_id = ?",
  ).get(userId) as PreferenceRow | undefined;
}

export function getNotificationPreferences(userId: string): NotificationPreferences {
  const row = preferenceRow(userId);
  return row
    ? { dmInboxEnabled: row.dm_inbox_enabled === 1, dmEmailEnabled: row.dm_email_enabled === 1 }
    : { ...DEFAULT_PREFERENCES };
}

export function updateNotificationPreferences(
  userId: string,
  input: Partial<NotificationPreferences>,
): NotificationPreferences {
  const current = getNotificationPreferences(userId);
  const next = {
    dmInboxEnabled: typeof input.dmInboxEnabled === "boolean" ? input.dmInboxEnabled : current.dmInboxEnabled,
    dmEmailEnabled: typeof input.dmEmailEnabled === "boolean" ? input.dmEmailEnabled : current.dmEmailEnabled,
  };
  getDb().prepare(`
    INSERT INTO user_notification_preferences (user_id, dm_inbox_enabled, dm_email_enabled, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      dm_inbox_enabled = excluded.dm_inbox_enabled,
      dm_email_enabled = excluded.dm_email_enabled,
      updated_at = excluded.updated_at
  `).run(userId, next.dmInboxEnabled ? 1 : 0, next.dmEmailEnabled ? 1 : 0, new Date().toISOString());
  return next;
}

function toNotification(row: NotificationRow): UserNotification {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function listNotifications(userId: string, limit = 100): UserNotification[] {
  return (getDb().prepare(`
    SELECT id, campaign_id, kind, title, body, read_at, created_at
    FROM user_notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT ?
  `).all(userId, Math.max(1, Math.min(200, Math.trunc(limit)))) as NotificationRow[]).map(toNotification);
}

export function unreadNotificationCount(userId: string): number {
  return Number((getDb().prepare(
    "SELECT COUNT(*) AS count FROM user_notifications WHERE user_id = ? AND read_at IS NULL",
  ).get(userId) as { count: number }).count);
}

export function markNotificationRead(userId: string, notificationId: string): boolean {
  return getDb().prepare(
    "UPDATE user_notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?",
  ).run(new Date().toISOString(), notificationId, userId).changes > 0;
}

/**
 * Deliver a DM notification according to the DM's explicit preferences.
 * Inbox delivery is durable; email failure is deliberately non-fatal because
 * the campaign action must not be rolled back because a mail provider is down.
 */
export async function notifyCampaignDm(input: {
  campaignId: string;
  kind: string;
  title: string;
  body: string;
  dedupeKey: string;
}): Promise<void> {
  const db = getDb();
  const campaign = db.prepare("SELECT dm_user_id, name FROM campaigns WHERE id = ?")
    .get(input.campaignId) as { dm_user_id: string; name: string } | undefined;
  if (!campaign) return;

  const preferences = getNotificationPreferences(campaign.dm_user_id);
  if (!preferences.dmInboxEnabled && !preferences.dmEmailEnabled) return;

  if (preferences.dmInboxEnabled) {
    db.prepare(`
      INSERT OR IGNORE INTO user_notifications
        (id, user_id, campaign_id, dedupe_key, kind, title, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(), campaign.dm_user_id, input.campaignId, input.dedupeKey,
      input.kind, input.title, input.body, new Date().toISOString(),
    );
  }

  if (preferences.dmEmailEnabled && process.env.RESEND_API_KEY) {
    const dm = getUserById(campaign.dm_user_id);
    if (dm) {
      try {
        await sendNotificationEmail({ email: dm.email, name: dm.name, title: input.title, body: input.body });
      } catch (error) {
        console.error("Failed to send DM notification email:", error instanceof Error ? error.message : error);
      }
    }
  }
}
