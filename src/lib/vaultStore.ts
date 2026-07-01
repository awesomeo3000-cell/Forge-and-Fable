import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { Character, PublicUser } from "@/types/game";
import { BCRYPT_ROUNDS, MIN_PASSWORD_LENGTH } from "@/lib/constants";

type StoredUser = PublicUser & {
  passwordHash: string;
  createdAt: string;
};

type VaultData = {
  users: StoredUser[];
  characters: Character[];
};

const dataDir = path.join(process.cwd(), "data");
const vaultFile = path.join(dataDir, "forge-vault.json");

function emptyVault(): VaultData {
  return {
    users: [],
    characters: [],
  };
}

function validateVaultStructure(data: unknown): data is VaultData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Record<string, unknown>;
  return Array.isArray(candidate.users) && Array.isArray(candidate.characters);
}

async function readVault(): Promise<VaultData> {
  try {
    const raw = await readFile(vaultFile, "utf8");
    const parsed = JSON.parse(raw);

    if (!validateVaultStructure(parsed)) {
      throw new Error("Vault data has an unexpected structure.");
    }

    return parsed;
  } catch (error) {
    // File not found is expected on first run — return a fresh vault.
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyVault();
    }

    // Corrupted file: back it up so it's never silently overwritten.
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = vaultFile.replace(".json", `-backup-${timestamp}.json`);
      await copyFile(vaultFile, backupFile);
      console.error(`⚠️ Corrupted vault backed up to ${backupFile}`);
    } catch {
      // If backup itself fails (e.g. file truly gone), at least don't destroy data.
    }

    throw new Error(
      `The vault file is corrupted and could not be read. A backup has been saved. Original error: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

async function writeVault(data: VaultData) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(vaultFile, JSON.stringify(data, null, 2), "utf8");
}

function publicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const name = input.name.trim() || "Adventurer";
  const email = normalizeEmail(input.email);

  if (!email.includes("@") || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use an email address and a password with at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const vault = await readVault();
  const existing = vault.users.some((user) => user.email === email);

  if (existing) {
    throw new Error("That email already has a vault.");
  }

  const user: StoredUser = {
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    createdAt: new Date().toISOString(),
  };

  vault.users.push(user);
  await writeVault(vault);

  return publicUser(user);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<PublicUser> {
  const vault = await readVault();
  const email = normalizeEmail(input.email);
  const user = vault.users.find((candidate) => candidate.email === email);

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new Error("The email or password does not match a vault.");
  }

  return publicUser(user);
}

export async function listCharacters(userId: string): Promise<Character[]> {
  const vault = await readVault();
  return vault.characters
    .filter((character) => character.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCharacter(
  userId: string,
  input: Omit<Character, "id" | "userId" | "createdAt">,
): Promise<Character> {
  const vault = await readVault();
  const hasUser = vault.users.some((candidate) => candidate.id === userId);

  if (!hasUser) {
    throw new Error("Vault session not found.");
  }

  const character: Character = {
    ...input,
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
  };

  vault.characters.push(character);
  await writeVault(vault);

  return character;
}

export async function getCharacter(userId: string, id: string): Promise<Character | null> {
  const vault = await readVault();
  return vault.characters.find((character) => character.userId === userId && character.id === id) ?? null;
}

export async function updateCharacter(
  userId: string,
  id: string,
  patch: Partial<Omit<Character, "id" | "userId" | "createdAt">>,
): Promise<Character> {
  const vault = await readVault();
  const index = vault.characters.findIndex(
    (character) => character.userId === userId && character.id === id,
  );

  if (index === -1) {
    throw new Error("Character not found.");
  }

  const current = vault.characters[index];
  const updated: Character = {
    ...current,
    ...patch,
    id: current.id,
    userId: current.userId,
    createdAt: current.createdAt,
  };

  vault.characters[index] = updated;
  await writeVault(vault);

  return updated;
}

export async function deleteCharacter(userId: string, id: string): Promise<void> {
  const vault = await readVault();
  const nextCharacters = vault.characters.filter(
    (character) => !(character.userId === userId && character.id === id),
  );

  if (nextCharacters.length === vault.characters.length) {
    throw new Error("Character not found.");
  }

  vault.characters = nextCharacters;
  await writeVault(vault);
}
