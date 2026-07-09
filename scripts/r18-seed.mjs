// R18 verification seed: registers a throwaway reviewer account on the local
// dev server and inscribes two characters of different classes so the roster
// rail, start panel, and builder can be verified per proposal 18 §0.9.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "r18-review@test.local";
const PASSWORD = "ledger-review-18!";

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function main() {
  let token = null;
  let res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "R18 Reviewer", email: EMAIL, password: PASSWORD }),
  });
  let body = await json(res);
  if (res.ok) {
    token = body.token;
    console.log("registered", body.user?.id);
  } else {
    res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    body = await json(res);
    if (!res.ok) throw new Error(`login failed: ${JSON.stringify(body)}`);
    token = body.token;
    console.log("logged in existing reviewer");
  }

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const existing = await json(await fetch(`${BASE}/api/characters`, { headers }));
  if ((existing.characters ?? []).length >= 2) {
    console.log("already has", existing.characters.length, "characters");
    console.log("TOKEN", token);
    return;
  }

  const settings = {
    diceRollingEnabled: false, optionalClassFeatures: false, customizeOrigin: false,
    advancementType: "milestone", hitPointType: "fixed", usePrerequisites: false,
    useFeatPrerequisites: true, useMulticlassPrerequisites: false, showLevelScaledSpells: false,
    encumbranceType: "standard", ignoreCoinWeight: true, modifiersTop: true,
  };
  const abilities = { strength: 10, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 10, charisma: 13 };
  const base = {
    level: 3, alignment: "Neutral", physicalCharacteristics: "", personalCharacteristics: "",
    generalNotes: "", sourceIds: ["5-5e-core"], settings, abilities, currentHp: 21, maxHp: 21, tempHp: 0,
    inventory: [], spellsKnown: [], customRules: [], skillProficiencies: ["stealth", "perception"],
    toolProficiencies: [], languages: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    deathSaves: { successes: 0, failures: 0 },
  };
  const heroes = [
    { ...base, name: "Merric Underbough", raceId: "halfling", classId: "rogue", background: "Criminal" },
    { ...base, name: "Isolde Vance", raceId: "human", classId: "wizard", background: "Sage", level: 5 },
  ];
  for (const hero of heroes) {
    const r = await fetch(`${BASE}/api/characters`, { method: "POST", headers, body: JSON.stringify(hero) });
    const b = await json(r);
    if (!r.ok) throw new Error(`create failed for ${hero.name}: ${JSON.stringify(b)}`);
    console.log("created", b.character?.name, b.character?.id);
  }
  console.log("TOKEN", token);
}

main().catch((err) => { console.error(err); process.exit(1); });
