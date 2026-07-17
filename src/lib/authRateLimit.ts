import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function authRateLimitKeys(
  request: Request,
  scope: "login" | "register" | "password-reset" | "verification-resend",
  email: string,
) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded || request.headers.get("x-real-ip") || "").slice(0, 128);
  return [hashKey(`${scope}:email:${email}`), ...(ip ? [hashKey(`${scope}:ip:${ip}`)] : [])];
}

export function isAuthRateLimited(keys: string[], now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  const placeholders = keys.map(() => "?").join(",");
  const row = getDb().prepare(
    `SELECT 1 FROM auth_attempts WHERE attempt_key IN (${placeholders}) AND first_attempt_at >= ? AND count >= ? LIMIT 1`,
  ).get(...keys, cutoff, MAX_ATTEMPTS);
  return Boolean(row);
}

export function recordAuthFailure(keys: string[], now = Date.now()) {
  const db = getDb();
  const cutoff = now - WINDOW_MS;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM auth_attempts WHERE first_attempt_at < ?").run(cutoff);
    const upsert = db.prepare(`
      INSERT INTO auth_attempts(attempt_key, count, first_attempt_at) VALUES (?, 1, ?)
      ON CONFLICT(attempt_key) DO UPDATE SET
        count = CASE WHEN auth_attempts.first_attempt_at < ? THEN 1 ELSE auth_attempts.count + 1 END,
        first_attempt_at = CASE WHEN auth_attempts.first_attempt_at < ? THEN excluded.first_attempt_at ELSE auth_attempts.first_attempt_at END
    `);
    for (const key of keys) upsert.run(key, now, cutoff, cutoff);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function clearAuthFailures(keys: string[]) {
  const placeholders = keys.map(() => "?").join(",");
  getDb().prepare(`DELETE FROM auth_attempts WHERE attempt_key IN (${placeholders})`).run(...keys);
}
