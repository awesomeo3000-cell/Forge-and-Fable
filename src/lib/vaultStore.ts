import bcrypt from "bcryptjs";
import type { Character, FeedbackEntry, PublicUser } from "@/types/game";
import { BCRYPT_ROUNDS, MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { getDb } from "@/lib/db";
import { isAllowedPortraitReference, normalizeStoredAbilities, validateCharacterInput } from "@/lib/validateCharacter";
import { isAdminEmail } from "@/lib/adminEmail";
import { isSupportedRuleset, normalizeStoredRuleset } from "@/lib/characterRuleset";
import { validateCharacterProgression } from "@/lib/progression/validate";

type StoredUser = PublicUser & {
  passwordHash: string;
  createdAt: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type JsonRow = {
  id?: string;
  data: string;
  revision?: number;
};

const DUMMY_PASSWORD_HASH = "$2b$10$.655b7GH.p0t6b3Br.o4ru23EaHryLhUOy5yWDiq1wsWPPRiz7Bne";

export class CharacterConflictError extends Error {
  current: Character;

  constructor(current: Character) {
    super("Character changed in another save. Refresh and retry.");
    this.name = "CharacterConflictError";
    this.current = current;
  }
}

/**
 * Thrown by loginUser when the email/password pair does not match a vault.
 * A distinct type lets the login route return 401 only for genuine credential
 * failures, sending infrastructure faults to 500 instead (DW-004).
 */
export class InvalidCredentialsError extends Error {
  constructor(message = "The email or password does not match a vault.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

function publicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: isAdminEmail(user.email),
  };
}

/** Synchronous stored-user lookup by id (email needed for the admin guard). */
export function getUserById(userId: string): StoredUser | null {
  const row = getDb()
    .prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
  return row ? storedUserFromRow(row) : null;
}

function storedUserFromRow(row: UserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function displayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const readableName = localPart.replace(/[._-]+/g, " ").trim();

  if (!readableName) {
    return "Adventurer";
  }

  return readableName
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 80);
}

export async function updateUserName(userId: string, input: { name?: string }): Promise<PublicUser> {
  const db = getDb();
  const row = db.prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;
  if (!row) throw new Error("Vault session not found.");

  const name = input.name?.trim().slice(0, 80) || displayNameFromEmail(row.email);
  if (/[<>]/.test(name)) throw new Error("Display name cannot contain HTML markup.");
  db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, userId);
  return publicUser(storedUserFromRow({ ...row, name }));
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

function parseCharacter(row: JsonRow): Character {
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.data);
  } catch (error) {
    throw new Error(`Stored character ${row.id ?? "unknown"} contains invalid JSON: ${error instanceof Error ? error.message : "parse failed"}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Stored character ${row.id ?? "unknown"} is not a JSON object.`);
  }
  const character = {
    ...(parsed as Record<string, unknown>),
    ruleset: normalizeStoredRuleset((parsed as Record<string, unknown>).ruleset),
    abilities: normalizeStoredAbilities((parsed as Record<string, unknown>).abilities),
  } as Character;
  // Built-in portrait catalogs change over time. Older characters can still
  // reference a retired opaque portrait ID whose asset no longer exists. That
  // is recoverable display metadata, not a reason to make the owner's entire
  // character roster unreadable. Keep new writes strict, but clear retired
  // references while hydrating stored records so the user can choose a current
  // portrait the next time they edit the character.
  if (typeof character.portraitUrl === "string" && !isAllowedPortraitReference(character.portraitUrl)) {
    delete character.portraitUrl;
  }
  if (
    typeof character.id !== "string" ||
    typeof character.userId !== "string" ||
    typeof character.createdAt !== "string" ||
    (row.id && character.id !== row.id)
  ) {
    throw new Error(`Stored character ${row.id ?? "unknown"} has invalid identity metadata.`);
  }
  if (!isSupportedRuleset(character.ruleset)) {
    throw new Error(`Stored character ${row.id ?? "unknown"} uses an unsupported ruleset.`);
  }
  const mutable = { ...character } as Record<string, unknown>;
  delete mutable.id;
  delete mutable.userId;
  delete mutable.createdAt;
  delete mutable.revision;
  validateCharacterInput(mutable, false);
  return { ...character, revision: row.revision ?? character.revision ?? 0 };
}

function serializedCharacter(character: Character) {
  const stored = { ...character };
  delete stored.revision;
  return JSON.stringify(stored);
}

function parseFeedback(row: JsonRow): FeedbackEntry {
  return JSON.parse(row.data) as FeedbackEntry;
}

export async function registerUser(input: {
  name?: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || displayNameFromEmail(email);

  if (!EMAIL_PATTERN.test(email) || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use an email address and a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (/[<>]/.test(name)) throw new Error("Display name cannot contain HTML markup.");

  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    createdAt: new Date().toISOString(),
  };

  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(user.id, user.name, user.email, user.passwordHash, user.createdAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    if (isUniqueConstraintError(error)) {
      throw new Error("That email already has a vault.");
    }
    throw error;
  }

  return publicUser(user);
}

/** Delete an account and its foreign-key-cascaded data in one transaction. */
export async function deleteUserById(userId: string): Promise<void> {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<PublicUser> {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const row = db.prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;

  const user = row ? storedUserFromRow(row) : null;
  const passwordMatches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    throw new InvalidCredentialsError();
  }

  return publicUser(user);
}

export async function listCharacters(userId: string): Promise<Character[]> {
  const rows = getDb()
    .prepare("SELECT id, data, revision FROM characters WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as JsonRow[];
  return rows.map(parseCharacter);
}

export async function createCharacter(
  userId: string,
  input: Omit<Character, "id" | "userId" | "createdAt">,
): Promise<Character> {
  const db = getDb();
  const createdAt = new Date().toISOString();
  const character: Character = {
    ...input,
    id: crypto.randomUUID(),
    userId,
    revision: 0,
    createdAt,
  };
  validateCharacterProgression(character, Boolean(character.progressionState));

  db.exec("BEGIN IMMEDIATE");
  try {
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) {
      throw new Error("Vault session not found.");
    }
    db.prepare("INSERT INTO characters (id, user_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(character.id, userId, serializedCharacter(character), createdAt, createdAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return character;
}

export async function getCharacter(userId: string, id: string): Promise<Character | null> {
  const row = getDb()
    .prepare("SELECT id, data, revision FROM characters WHERE user_id = ? AND id = ?")
    .get(userId, id) as JsonRow | undefined;
  return row ? parseCharacter(row) : null;
}

export async function updateCharacter(
  userId: string,
  id: string,
  patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>,
  expectedRevision: number,
): Promise<Character> {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT id, data, revision FROM characters WHERE user_id = ? AND id = ?")
      .get(userId, id) as JsonRow | undefined;

    if (!row) {
      throw new Error("Character not found.");
    }

    const current = parseCharacter(row);
    if ((current.revision ?? 0) !== expectedRevision) {
      throw new CharacterConflictError(current);
    }

    const nextRevision = expectedRevision + 1;
    const updated: Character = {
      ...current,
      ...patch,
      id: current.id,
      userId: current.userId,
      revision: nextRevision,
      createdAt: current.createdAt,
    };
    if (updated.classId !== current.classId) throw new Error(`Character ${current.id} classId cannot change through an ordinary patch.`);
    const progressionTouched = ["level", "classId", "subclassId", "featureChoices", "featureResources", "spellsKnown", "preparedSpells", "alwaysPreparedSpells", "expandedSpellLists", "spellbookSpells", "progressionState"]
      .some((field) => Object.prototype.hasOwnProperty.call(patch, field));
    if (progressionTouched) validateCharacterProgression(updated, updated.level !== current.level || Boolean(updated.progressionState), current.level);

    const result = db.prepare("UPDATE characters SET data = ?, revision = ?, updated_at = ? WHERE user_id = ? AND id = ? AND revision = ?")
      .run(serializedCharacter(updated), nextRevision, new Date().toISOString(), userId, id, expectedRevision);
    if (result.changes === 0) {
      const latest = db.prepare("SELECT id, data, revision FROM characters WHERE user_id = ? AND id = ?")
        .get(userId, id) as JsonRow | undefined;
      if (!latest) throw new Error("Character not found.");
      throw new CharacterConflictError(parseCharacter(latest));
    }
    db.exec("COMMIT");
    return updated;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function deleteCharacter(userId: string, id: string): Promise<void> {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db.prepare("DELETE FROM characters WHERE user_id = ? AND id = ?").run(userId, id);

    if (result.changes === 0) {
      throw new Error("Character not found.");
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function listFeedback(userId: string): Promise<FeedbackEntry[]> {
  const rows = getDb()
    .prepare("SELECT data FROM feedback WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as JsonRow[];
  return rows.map(parseFeedback);
}

/** Every submission across all users — admin only (gated at the route). */
export async function listAllFeedback(): Promise<FeedbackEntry[]> {
  const rows = getDb()
    .prepare("SELECT data FROM feedback ORDER BY created_at DESC")
    .all() as JsonRow[];
  return rows.map(parseFeedback);
}

export async function createFeedback(
  userId: string,
  input: Omit<FeedbackEntry, "id" | "userId" | "userName" | "userEmail" | "status" | "createdAt">,
): Promise<FeedbackEntry> {
  const db = getDb();
  const createdAt = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT id, name, email, password_hash, created_at FROM users WHERE id = ?")
      .get(userId) as UserRow | undefined;
    if (!row) {
      throw new Error("Vault session not found.");
    }

    const user = storedUserFromRow(row);
    const feedback: FeedbackEntry = {
      ...input,
      id: crypto.randomUUID(),
      userId,
      userName: user.name,
      userEmail: user.email,
      status: "new",
      createdAt,
    };

    db.prepare("INSERT INTO feedback (id, user_id, data, created_at) VALUES (?, ?, ?, ?)")
      .run(feedback.id, userId, JSON.stringify(feedback), createdAt);
    db.exec("COMMIT");
    return feedback;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
