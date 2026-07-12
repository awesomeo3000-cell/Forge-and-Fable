import { getDb } from "@/lib/db";
import { isAdminEmail } from "@/lib/adminEmail";

export type InviteCode = {
  code: string;
  label: string;
  createdBy: string;
  createdAt: string;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
};

type InviteRow = {
  code: string;
  label: string;
  created_by: string;
  created_at: string;
  max_uses: number | null;
  uses: number;
  revoked: number;
};

function toInvite(row: InviteRow): InviteCode {
  return {
    code: row.code,
    label: row.label,
    createdBy: row.created_by,
    createdAt: row.created_at,
    maxUses: row.max_uses,
    uses: row.uses,
    revoked: row.revoked === 1,
  };
}

/** Unambiguous code alphabet — no 0/O/1/I. */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export function listInviteCodes(): InviteCode[] {
  const rows = getDb()
    .prepare("SELECT * FROM invite_codes ORDER BY created_at DESC")
    .all() as InviteRow[];
  return rows.map(toInvite);
}

export function createInviteCode(createdBy: string, input: { label?: unknown; maxUses?: unknown }): InviteCode {
  const label = typeof input.label === "string" ? input.label.trim().slice(0, 80) : "";
  const maxUsesRaw = Number(input.maxUses);
  const maxUses = Number.isFinite(maxUsesRaw) && maxUsesRaw >= 1 ? Math.min(9999, Math.trunc(maxUsesRaw)) : null;
  const db = getDb();
  let code = generateCode();
  // Vanishingly unlikely, but guarantee uniqueness against the PK.
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = db.prepare("SELECT 1 FROM invite_codes WHERE code = ?").get(code);
    if (!exists) break;
    code = generateCode();
  }
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO invite_codes (code, label, created_by, created_at, max_uses, uses, revoked) VALUES (?, ?, ?, ?, ?, 0, 0)",
  ).run(code, label, createdBy, createdAt, maxUses);
  return { code, label, createdBy, createdAt, maxUses, uses: 0, revoked: false };
}

export function revokeInviteCode(code: string): void {
  getDb().prepare("UPDATE invite_codes SET revoked = 1 WHERE code = ?").run(code);
}

/**
 * Validate a registration code and, if it's a DB invite, atomically consume one
 * use. Returns true if the code is acceptable. The legacy REGISTRATION_CODE env
 * value is still honored (unlimited uses). Called from the register route.
 */
export function consumeRegistrationCode(rawCode: string): boolean {
  const code = (rawCode ?? "").trim();
  const envCode = process.env.REGISTRATION_CODE?.trim();
  if (envCode && code === envCode) return true;
  if (!code) return false;

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT * FROM invite_codes WHERE code = ?").get(code) as InviteRow | undefined;
    if (!row || row.revoked === 1 || (row.max_uses !== null && row.uses >= row.max_uses)) {
      db.exec("COMMIT");
      return false;
    }
    db.prepare("UPDATE invite_codes SET uses = uses + 1 WHERE code = ?").run(code);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** True when registration is gated: an env code is set OR any live invite exists. */
export function registrationRequiresCode(): boolean {
  if (process.env.REGISTRATION_CODE?.trim()) return true;
  const live = getDb()
    .prepare("SELECT 1 FROM invite_codes WHERE revoked = 0 AND (max_uses IS NULL OR uses < max_uses) LIMIT 1")
    .get();
  return Boolean(live);
}

export type AdminOverview = {
  users: Array<{ id: string; name: string; email: string; createdAt: string; characterCount: number; isAdmin: boolean }>;
  campaigns: Array<{ id: string; name: string; code: string; dmName: string; memberCount: number; createdAt: string }>;
  totals: { users: number; characters: number; campaigns: number; feedback: number };
};

export function adminOverview(): AdminOverview {
  const db = getDb();
  const userRows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at,
              (SELECT COUNT(*) FROM characters c WHERE c.user_id = u.id) AS character_count
       FROM users u ORDER BY u.created_at DESC LIMIT 500`,
    )
    .all() as Array<{ id: string; name: string; email: string; created_at: string; character_count: number }>;

  const campaignRows = db
    .prepare(
      `SELECT c.id, c.name, c.code, c.created_at,
              (SELECT u.name FROM users u WHERE u.id = c.dm_user_id) AS dm_name,
              (SELECT COUNT(*) FROM campaign_members m WHERE m.campaign_id = c.id) AS member_count
       FROM campaigns c ORDER BY c.created_at DESC LIMIT 500`,
    )
    .all() as Array<{ id: string; name: string; code: string; created_at: string; dm_name: string | null; member_count: number }>;

  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

  return {
    users: userRows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      characterCount: row.character_count,
      isAdmin: isAdminEmail(row.email),
    })),
    campaigns: campaignRows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      dmName: row.dm_name ?? "—",
      memberCount: row.member_count,
      createdAt: row.created_at,
    })),
    totals: { users: count("users"), characters: count("characters"), campaigns: count("campaigns"), feedback: count("feedback") },
  };
}
