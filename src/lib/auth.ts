import { SignJWT, jwtVerify } from "jose";

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

/** Extract and verify the user ID from a request's Authorization header. */
export async function authenticateRequest(request: Request): Promise<string> {
  const header = request.headers.get("authorization")?.trim();

  if (!header || !header.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed authorization header.", 401);
  }

  const token = header.slice(7);

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
