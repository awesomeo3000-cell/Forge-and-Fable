import { writeFileSync } from 'fs';

const BASE = 'https://www.dnd5eapi.co/api';
const DELAY_MS = 50; // polite delay between requests

// --- helpers ---

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/** Compute average damage from a dice string like "1d6+3" or "2d6" or "4d10+5" */
function parseAverageDamage(damageDice) {
  if (!damageDice) return undefined;
  // Match pattern like "XdY+Z" or "XdY-Z" or "XdY"
  const m = damageDice.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
  if (!m) return undefined;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const sign = m[3] === '-' ? -1 : 1;
  const flat = m[4] ? parseInt(m[4], 10) * sign : 0;
  const diceAvg = count * (sides + 1) / 2;
  return Math.round(diceAvg + flat);
}

/** Build a damage string from a damage entry: { damage_dice, damage_type: { name } } */
function buildDamageString(dmg) {
  if (!dmg) return undefined;
  const dice = dmg.damage_dice || '';
  const type = dmg.damage_type?.name || '';
  if (!dice && !type) return undefined;
  if (!dice) return type;
  return `${dice} ${type}`.trim();
}

/** Extract features from an array of API entries (actions / special_abilities / etc.) */
function extractFeatures(entries) {
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map(e => {
    const feature = {
      name: e.name,
      description: cleanDescription(e.desc),
    };
    // attack bonus
    if (e.attack_bonus !== undefined && e.attack_bonus !== null) {
      feature.attackBonus = e.attack_bonus;
    }
    // damage
    if (e.damage && e.damage.length > 0) {
      const firstDamage = e.damage[0];
      feature.damage = buildDamageString(firstDamage);
      const avg = parseAverageDamage(firstDamage.damage_dice);
      if (avg !== undefined) {
        feature.averageDamage = avg;
      }
    }
    return feature;
  });
}

/** Clean up description text */
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// --- main ---

async function main() {
  // 1. Fetch monster list
  console.log('Fetching monster list...');
  const listData = await fetchJson(`${BASE}/monsters`);
  const allMonsters = listData.results;
  console.log(`Found ${allMonsters.length} monsters in API`);

  // 2. Fetch each monster detail
  const features = {};
  let completed = 0;
  const total = allMonsters.length;

  for (const mon of allMonsters) {
    const index = mon.index;
    try {
      const detail = await fetchJson(`${BASE}/monsters/${index}`);
      features[index] = {
        traits: extractFeatures(detail.special_abilities),
        actions: extractFeatures(detail.actions),
        bonusActions: [],
        reactions: extractFeatures(detail.reactions),
        legendaryActions: extractFeatures(detail.legendary_actions),
        lairActions: [],
      };
      completed++;
      if (completed % 50 === 0 || completed === total) {
        console.log(`Progress: ${completed}/${total} monsters processed`);
      }
    } catch (err) {
      console.error(`Failed to fetch ${index}: ${err.message}`);
      // still write a stub so we don't lose the entry
      features[index] = {
        traits: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        legendaryActions: [],
        lairActions: [],
      };
    }
    await sleep(DELAY_MS);
  }

  // 3. Write output
  const outPath = 'E:/forge-and-fable/tmp/srd-creature-features.json';
  writeFileSync(outPath, JSON.stringify(features, null, 2), 'utf-8');
  console.log(`\nWrote features for ${Object.keys(features).length} creatures to ${outPath}`);

  // 4. Summary
  let totalTraits = 0, totalActions = 0, totalReactions = 0, totalLegendary = 0;
  let creaturesWithAttackBonus = 0;
  let creaturesWithDamage = 0;

  for (const data of Object.values(features)) {
    totalTraits += data.traits.length;
    totalActions += data.actions.length;
    totalReactions += data.reactions.length;
    totalLegendary += data.legendaryActions.length;

    const allFeatures = [...data.traits, ...data.actions, ...data.reactions, ...data.legendaryActions];
    if (allFeatures.some(f => f.attackBonus !== undefined)) creaturesWithAttackBonus++;
    if (allFeatures.some(f => f.damage !== undefined)) creaturesWithDamage++;
  }

  console.log('\n--- Summary ---');
  console.log(`Total creatures: ${Object.keys(features).length}`);
  console.log(`Total traits: ${totalTraits}`);
  console.log(`Total actions: ${totalActions}`);
  console.log(`Total reactions: ${totalReactions}`);
  console.log(`Total legendary actions: ${totalLegendary}`);
  console.log(`Creatures with attackBonus: ${creaturesWithAttackBonus}`);
  console.log(`Creatures with damage: ${creaturesWithDamage}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
