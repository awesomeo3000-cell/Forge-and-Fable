import { SignJWT, jwtVerify } from "jose";
import { getDb } from "@/lib/db";

export const SESSION_COOKIE_NAME = "ff_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production.");
    }
    return new TextEncoder().encode("forge-and-fable-dev-secret-change-in-production");
  }
  return new TextEncoder().encode(secret);
}

const TOKEN_EXPIRY = "30d";

export interface TokenPayload {
  userId: string;
  sessionVersion?: number;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  const row = getDb().prepare("SELECT session_version FROM users WHERE id = ?").get(payload.userId) as { session_version: number } | undefined;
  const sessionVersion = row?.session_version ?? payload.sessionVersion ?? 0;
  return new SignJWT({ ...payload, sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as TokenPayload;
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Extract and verify the user ID from the httpOnly session cookie. */
export async function authenticateRequest(request: Request): Promise<string> {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!token) {
    throw new AuthError("Missing session token.", 401);
  }

  try {
    const payload = await verifyToken(token);
    const row = getDb().prepare("SELECT session_version FROM users WHERE id = ?").get(payload.userId) as { session_version: number } | undefined;
    if (!row || typeof payload.sessionVersion !== "number" || payload.sessionVersion !== row.session_version) {
      throw new Error("Session has been revoked.");
    }
    return payload.userId;
  } catch {
    throw new AuthError("Invalid or expired token.", 401);
  }
}

export function revokeAllSessions(userId: string): void {
  const result = getDb().prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?").run(userId);
  if (result.changes === 0) throw new AuthError("Vault session not found.", 401);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
