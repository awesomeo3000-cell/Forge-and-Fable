import { expect, test, type Page } from "@playwright/test";

type CharacterPayload = Record<string, unknown>;

function payload(name: string, patch: Partial<CharacterPayload> = {}): CharacterPayload {
  return {
    name,
    ruleset: "2014",
    level: 1,
    alignment: "Neutral",
    background: "Sage",
    raceId: "human",
    classId: "barbarian",
    sourceIds: ["5e-core"],
    abilities: {
      strength: 15,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 10,
      charisma: 8,
    },
    currentHp: 8,
    maxHp: 8,
    tempHp: 0,
    inventory: [],
    spellsKnown: [],
    customRules: [],
    skillProficiencies: [],
    toolProficiencies: [],
    languages: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    deathSaves: { successes: 0, failures: 0 },
    settings: {
      diceRollingEnabled: false,
      optionalClassFeatures: false,
      customizeOrigin: false,
      advancementType: "milestone",
      hitPointType: "fixed",
      usePrerequisites: false,
      useFeatPrerequisites: true,
      useMulticlassPrerequisites: false,
      showLevelScaledSpells: false,
      encumbranceType: "standard",
      ignoreCoinWeight: false,
      modifiersTop: false,
    },
    ...patch,
  };
}

async function registerAndEnter(page: Page, projectName: string) {
  const password = "character-save-release-test-password";
  const email = `character-save-${projectName}-${Date.now()}@example.com`;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dreamwright" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel("Display name").fill("Character Save Gate");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Enter" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByTitle("Workspace menu")).toBeVisible({ timeout: 15_000 });
  return password;
}

async function postAndReload(page: Page, characterPayload: CharacterPayload) {
  const postResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/characters") && response.request().method() === "POST",
  );
  const postResult = await page.evaluate(async (body) => {
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as { character?: { id?: string } } };
  }, characterPayload);
  const postResponse = await postResponsePromise;
  expect(postResponse.status()).toBe(201);
  expect(postResult.status).toBe(201);
  const characterId = postResult.body.character?.id;
  expect(characterId).toBeTruthy();

  const listResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/characters") && response.request().method() === "GET",
  );
  await page.reload();
  const listResponse = await listResponsePromise;
  expect(listResponse.status()).toBe(200);
  const listed = await listResponse.json() as { characters?: Array<{ id?: string }> };
  expect(listed.characters?.some((entry) => entry.id === characterId)).toBe(true);
  return characterId;
}

test("Seal persistence survives refresh for all creation save paths", async ({ page }, testInfo) => {
  const password = await registerAndEnter(page, testInfo.project.name);
  try {
    // Exercise the actual Seal button with a level-1 fighter. Fighter level 1
    // has deferred starting choices, so this is the regression case that used
    // to remain only in memory until the choice modal finished.
    await page.getByRole("button", { name: "Begin the commission" }).click();
    const quickbuilder = page.getByRole("button", { name: /Quickbuilder/ });
    await expect(quickbuilder).toBeVisible();
    await quickbuilder.click();
    await quickbuilder.click();
    await page.getByRole("button", { name: "Weapons & Armor" }).click();
    await page.getByRole("button", { name: "Record the answer" }).click();
    await page.getByRole("button", { name: "Fighter" }).click();
    await page.getByRole("button", { name: "Record the answer" }).click();
    await page.locator('button[data-species="human"]').click();
    await page.getByPlaceholder("Write a name").fill(`Seal Fighter ${Date.now()}`);
    await page.getByRole("button", { name: "Review the record" }).click();

    const sealPost = page.waitForResponse((response) =>
      response.url().endsWith("/api/characters") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Press the seal" }).click();
    const sealResponse = await sealPost;
    expect(sealResponse.status()).toBe(201);
    const sealBody = await sealResponse.json() as { character?: { id?: string } };
    const sealId = sealBody.character?.id;
    expect(sealId).toBeTruthy();

    const sealList = page.waitForResponse((response) =>
      response.url().endsWith("/api/characters") && response.request().method() === "GET",
    );
    await page.reload();
    const sealListResponse = await sealList;
    expect(sealListResponse.status()).toBe(200);
    const sealRoster = await sealListResponse.json() as { characters?: Array<{ id?: string }> };
    expect(sealRoster.characters?.some((entry) => entry.id === sealId)).toBe(true);

    // Level 1 with no deferred choices.
    await postAndReload(page, payload(`Level One Barbarian ${Date.now()}`));

    // Higher-level wizard: subclass and spell choices are intentionally
    // present in the provisional payload, while final progression remains a
    // later choice-screen operation.
    await postAndReload(page, payload(`Higher Wizard ${Date.now()}`, {
      level: 5,
      classId: "wizard",
      subclassId: "school-of-evocation",
      abilities: { strength: 8, dexterity: 12, constitution: 14, intelligence: 15, wisdom: 13, charisma: 10 },
      spellsKnown: ["fire-bolt", "mage-hand", "light", "magic-missile", "shield"],
    }));
  } finally {
    await page.evaluate(async (accountPassword) => {
      await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: accountPassword }),
      });
    }, password);
  }
});
