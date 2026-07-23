import { expect, test, type Page } from "@playwright/test";

type Json = Record<string, unknown>;

async function registerAndEnter(page: Page, projectName: string) {
  const password = "homebrew-lifecycle-test-password";
  const email = `homebrew-lifecycle-${projectName}-${Date.now()}@example.com`;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByLabel("Display name").fill("Homebrew Lifecycle Gate");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByTitle("Workspace menu")).toBeVisible({ timeout: 15_000 });
  return password;
}

async function api(page: Page, path: string, init: { method?: string; body?: Json; headers?: Record<string, string> } = {}) {
  return page.evaluate(async ({ path, init }) => {
    const response = await fetch(path, {
      method: init.method ?? "GET",
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      credentials: "include",
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    return { status: response.status, body: await response.json() as Json };
  }, { path, init });
}

function itemPayload(name: string, bonus: number): Json {
  return {
    kind: "item",
    name,
    description: `Lifecycle item version ${bonus}.`,
    category: "Weapon",
    classification: "Martial weapon",
    rarity: "Common",
    damage: "1d8",
    damageType: "slashing",
    properties: "versatile (1d10)",
    baseWeight: 3,
    requiresAttunement: false,
    equipmentSlots: ["hand"],
    toggles: [],
    stages: [],
    effects: [
      { id: `attack-${bonus}`, type: "numeric-bonus", target: "weapon-attack", value: bonus, scope: "source-item", gate: { type: "equipped" } },
      { id: `damage-${bonus}`, type: "numeric-bonus", target: "weapon-damage", value: bonus, scope: "source-item", gate: { type: "equipped" } },
    ],
  };
}

function characterPayload(name: string, definitionId: string, versionId: string): Json {
  const ref = { source: "homebrew", kind: "item", definitionId, versionId, ruleset: "2014" };
  const item = {
    id: "lifecycle-item-1",
    name: "Lifecycle Blade",
    rarity: "Common",
    attunement: false,
    notes: "",
    category: "Weapon",
    classification: "Martial weapon",
    description: "Lifecycle item version 1.",
    damage: "1d8",
    damageType: "slashing",
    properties: "versatile (1d10)",
    weight: 3,
    homebrew: { contentRef: ref, equipped: false, attuned: false, activeToggleIds: [] },
  };
  return {
    name,
    ruleset: "2014",
    level: 1,
    alignment: "Neutral",
    background: "Sage",
    raceId: "human",
    classId: "fighter",
    sourceIds: ["5e-core"],
    abilities: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
    currentHp: 10,
    maxHp: 10,
    tempHp: 0,
    inventory: [item, { ...item, id: "lifecycle-item-2" }],
    equipment: {},
    spellsKnown: [],
    customRules: [],
    skillProficiencies: [],
    toolProficiencies: [],
    languages: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    deathSaves: { successes: 0, failures: 0 },
    settings: { diceRollingEnabled: true, optionalClassFeatures: false, customizeOrigin: false, advancementType: "milestone", hitPointType: "fixed", usePrerequisites: false, useFeatPrerequisites: true, useMulticlassPrerequisites: false, showLevelScaledSpells: false, encumbranceType: "standard", ignoreCoinWeight: false, modifiersTop: false },
  };
}

test("authenticated Item Studio lifecycle preserves v1 and explicitly upgrades one copy", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const password = await registerAndEnter(page, testInfo.project.name);
  try {
    const created = await api(page, "/api/homebrew", { method: "POST", body: { kind: "item", ruleset: "2014", title: "Lifecycle Blade", payload: itemPayload("Lifecycle Blade", 1), changeSummary: "v1" } });
    expect(created.status).toBe(201);
    const definition = created.body.definition as Json;
    const v1 = created.body.version as Json;
    expect((await api(page, `/api/homebrew/${definition.id}/versions/${v1.id}/publish`, { method: "POST" })).status).toBe(200);

    const character = await api(page, "/api/characters", { method: "POST", body: characterPayload("Homebrew Lifecycle Hero", String(definition.id), String(v1.id)) });
    expect(character.status).toBe(201);
    const characterId = String((character.body.character as Json).id);

    const v2Save = await api(page, `/api/homebrew/${definition.id}/versions`, { method: "POST", headers: { "If-Match": "1" }, body: { payload: itemPayload("Lifecycle Blade", 2), parentVersionId: v1.id, changeSummary: "v2 bonus" } });
    expect(v2Save.status).toBe(201);
    const v2 = v2Save.body.version as Json;
    expect((await api(page, `/api/homebrew/${definition.id}/versions/${v2.id}/publish`, { method: "POST" })).status).toBe(200);

    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    const heroCard = page.locator("button.ao-hd-hero-card").filter({ hasText: "Homebrew Lifecycle Hero" });
    await expect(heroCard).toBeVisible({ timeout: 15_000 });
    await heroCard.click();
    await expect(page.getByRole("heading", { name: "Homebrew Lifecycle Hero" })).toBeVisible({ timeout: 15_000 });
    await page.locator('[aria-label^="Roll STR check"]').first().click({ timeout: 5_000 });

    const loaded = await api(page, `/api/characters/${characterId}`);
    expect(loaded.status).toBe(200);
    const loadedCharacter = loaded.body.character as Json;
    const inventory = loadedCharacter.inventory as Json[];
    const equippedInventory = inventory.map((item, index) => index === 0 ? { ...item, homebrew: { ...(item.homebrew as Json), equipped: true } } : item);
    const equipped = await api(page, `/api/characters/${characterId}`, { method: "PUT", headers: { "If-Match": String(loadedCharacter.revision) }, body: { inventory: equippedInventory, equipment: { weaponItemIds: ["lifecycle-item-1"] } } });
    expect(equipped.status).toBe(200);

    await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
    const afterReload = await api(page, `/api/characters/${characterId}`);
    expect(afterReload.status).toBe(200);
    const reloadedInventory = ((afterReload.body.character as Json).inventory as Json[]);
    expect(reloadedInventory.map((item) => ((item.homebrew as Json).contentRef as Json).versionId)).toEqual([v1.id, v1.id]);
    expect((reloadedInventory[0].homebrew as Json).equipped).toBe(true);

    const afterUpgrade = await api(page, `/api/characters/${characterId}`);
    const currentCharacter = afterUpgrade.body.character as Json;
    const upgradeInventory = (currentCharacter.inventory as Json[]).map((item, index) => index === 0 ? { ...item, name: "Lifecycle Blade v2", description: "Lifecycle item version 2.", homebrew: { ...(item.homebrew as Json), contentRef: { ...((item.homebrew as Json).contentRef as Json), versionId: v2.id } } } : item);
    const upgraded = await api(page, `/api/characters/${characterId}`, { method: "PUT", headers: { "If-Match": String(currentCharacter.revision) }, body: { inventory: upgradeInventory } });
    expect(upgraded.status).toBe(200);
    const upgradedItems = ((upgraded.body.character as Json).inventory as Json[]).map((item) => ((item.homebrew as Json).contentRef as Json).versionId);
    expect(upgradedItems).toEqual([v2.id, v1.id]);
  } finally {
    await page.evaluate(async (accountPassword) => {
      await fetch("/api/auth/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ password: accountPassword }) });
    }, password);
  }
});
