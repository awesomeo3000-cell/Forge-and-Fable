import { SignJWT, jwtVerify } from "jose";

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
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
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

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim();
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
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

/** Extract and verify the user ID from the httpOnly session cookie, with bearer fallback for legacy clients. */
export async function authenticateRequest(request: Request): Promise<string> {
  const token = getCookieValue(request, SESSION_COOKIE_NAME) ?? getBearerToken(request);
  if (!token) {
    throw new AuthError("Missing session token.", 401);
  }

  try {
    const payload = await verifyToken(token);
    return payload.userId;
  } catch {
    throw new AuthError("Invalid or expired token.", 401);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
