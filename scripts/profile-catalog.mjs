import { readFileSync, writeFileSync } from 'node:fs';

const items = JSON.parse(readFileSync('src/data/items.json', 'utf-8'));

// Normalize function
function normalize(str) {
  return (str || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// Build profile
const profile = {
  generatedAt: new Date().toISOString(),
  totalRecords: items.length,
  byCategory: {},
  byRarity: {},
  byAttunement: { true: 0, false: 0 },
  byClassification: {},
  emptyFields: { image: 0, damageType: 0, damage: 0, ac: 0, properties: 0, classification: 0 },
  costStats: { min: Infinity, max: -Infinity, zeroCount: 0, values: [] },
  descriptionStats: {},
  idPatterns: { withSuffix: 0, withoutSuffix: 0 },
};

items.forEach(item => {
  profile.byCategory[item.category] = (profile.byCategory[item.category] || 0) + 1;
  profile.byRarity[item.rarity] = (profile.byRarity[item.rarity] || 0) + 1;
  profile.byAttunement[item.attunement ? 'true' : 'false']++;
  if (item.classification) {
    profile.byClassification[item.classification] = (profile.byClassification[item.classification] || 0) + 1;
  }
  if (!item.image) profile.emptyFields.image++;
  if (!item.damageType) profile.emptyFields.damageType++;
  if (!item.damage) profile.emptyFields.damage++;
  if (!item.ac) profile.emptyFields.ac++;
  if (!item.properties) profile.emptyFields.properties++;
  if (!item.classification) profile.emptyFields.classification++;

  const cost = Number(item.cost);
  if (!isNaN(cost)) {
    profile.costStats.values.push(cost);
    if (cost < profile.costStats.min) profile.costStats.min = cost;
    if (cost > profile.costStats.max) profile.costStats.max = cost;
    if (cost === 0) profile.costStats.zeroCount++;
  }

  if (/-\d+$/.test(item.id)) profile.idPatterns.withSuffix++;
  else profile.idPatterns.withoutSuffix++;
});

// Cost percentiles
const sorted = [...profile.costStats.values].sort((a, b) => a - b);
profile.costStats.p10 = sorted[Math.floor(sorted.length * 0.1)] || 0;
profile.costStats.p25 = sorted[Math.floor(sorted.length * 0.25)] || 0;
profile.costStats.p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
profile.costStats.p75 = sorted[Math.floor(sorted.length * 0.75)] || 0;
profile.costStats.p90 = sorted[Math.floor(sorted.length * 0.9)] || 0;
delete profile.costStats.values;

// Description stats
const descLengths = items.map(i => i.description.length).sort((a, b) => a - b);
profile.descriptionStats = {
  min: descLengths[0],
  max: descLengths[descLengths.length - 1],
  avg: Math.round(descLengths.reduce((a, b) => a + b, 0) / descLengths.length),
  median: descLengths[Math.floor(descLengths.length / 2)],
};

writeFileSync('rules-research/items/current-catalog-profile.json', JSON.stringify(profile, null, 2));
console.log('Profile written. Categories:', Object.keys(profile.byCategory).length, 'Total:', items.length);

// --- Anomalies ---
const anomalies = [];
const nameMap = new Map();
items.forEach(item => {
  const norm = normalize(item.name);
  if (!nameMap.has(norm)) nameMap.set(norm, []);
  nameMap.get(norm).push(item);
});

for (const [, dups] of nameMap) {
  if (dups.length > 1) {
    dups.forEach(item => {
      anomalies.push({
        itemId: item.id,
        itemName: item.name,
        anomaly: 'Duplicate name (case-insensitive)',
        severity: 'high',
        recommendation: 'Review both entries; likely one should be removed or differentiated',
      });
    });
  }
}

const baseIds = new Map();
items.forEach(item => {
  const base = item.id.replace(/-\d+$/, '');
  if (!baseIds.has(base)) baseIds.set(base, []);
  baseIds.get(base).push(item.id);
});
for (const [base, ids] of baseIds) {
  if (ids.length > 1) {
    const hasSuffix = ids.some(id => /-\d+$/.test(id));
    const hasNoSuffix = ids.some(id => !/-\d+$/.test(id));
    if (hasSuffix && hasNoSuffix) {
      const sampleName = items.find(i => ids.includes(i.id))?.name || base;
      anomalies.push({
        itemId: ids.join(', '),
        itemName: sampleName,
        anomaly: 'Structural duplicate: exists with both numeric-suffix ID and base-name ID',
        severity: 'high',
        recommendation: 'Deduplicate — keep one record, mark the other as deprecated',
      });
    }
  }
}

// Plate rarity
const plateItem = items.find(i => i.id === 'plate-10');
if (plateItem && plateItem.rarity === 'Rare') {
  anomalies.push({
    itemId: 'plate-10',
    itemName: 'Plate',
    anomaly: 'Mundane plate armor marked as "Rare" — inconsistent with all other mundane armor marked "Common"',
    severity: 'high',
    recommendation: 'Change rarity to "Common" or "Mundane"',
  });
}

// Rarity inconsistency: mundane items marked Common
const mundaneCategories = ['Adventuring Gear', 'Tools', 'Food & Drink', 'Mount', 'Tack', 'Musical Instrument'];
const commonMundanes = items.filter(i => mundaneCategories.includes(i.category) && i.rarity === 'Common');
if (commonMundanes.length > 50) {
  anomalies.push({
    itemId: commonMundanes.length + ' items',
    itemName: 'Various mundane equipment',
    anomaly: commonMundanes.length + ' mundane equipment items marked "Common" instead of "Mundane"',
    severity: 'medium',
    recommendation: 'Standardize: non-magical gear should use "Mundane" rarity consistently',
  });
}

// Zero-cost magic items
const zeroCostMagic = items.filter(i => {
  const cost = Number(i.cost);
  return !isNaN(cost) && cost === 0 && !['Adventuring Gear', 'Tools'].includes(i.category);
});
if (zeroCostMagic.length > 50) {
  anomalies.push({
    itemId: zeroCostMagic.length + ' items',
    itemName: 'Various magic items',
    anomaly: zeroCostMagic.length + ' magic items have zero cost (likely templates)',
    severity: 'medium',
    recommendation: 'Assign costs to specific instantiations or add a template flag',
  });
}

// Missing damageType
if (profile.emptyFields.damageType > 1000) {
  anomalies.push({
    itemId: profile.emptyFields.damageType + ' items',
    itemName: 'Various weapons',
    anomaly: 'Only 1 item has damageType populated; ' + profile.emptyFields.damageType + ' weapons missing it',
    severity: 'medium',
    recommendation: 'Populate damageType for all weapons',
  });
}

// Weapon classification singular/plural
const singularWeapons = items.filter(i => i.classification === 'Simple Melee Weapon');
if (singularWeapons.length > 0) {
  anomalies.push({
    itemId: singularWeapons.length + ' items',
    itemName: 'Simple melee weapons',
    anomaly: singularWeapons.length + ' items use singular "Simple Melee Weapon" instead of plural',
    severity: 'low',
    recommendation: 'Standardize to plural "Simple Melee Weapons"',
  });
}

// Scroll classification
const spellScrolls = items.filter(i => i.category === 'Scroll' && /level/.test(i.classification || ''));
if (spellScrolls.length > 100) {
  anomalies.push({
    itemId: spellScrolls.length + ' items',
    itemName: 'Spell Scrolls',
    anomaly: 'Scrolls use classification for spell school/level metadata instead of "Spell Scroll"',
    severity: 'medium',
    recommendation: 'Add subcategory field for spell metadata; use classification for item type',
  });
}

// Curly apostrophes
const curlyApos = items.filter(i => /[\u2018\u2019]/.test(i.name + i.description));
if (curlyApos.length > 0) {
  anomalies.push({
    itemId: curlyApos.length + ' items',
    itemName: 'Various items',
    anomaly: curlyApos.length + ' items use curly apostrophes; others use straight',
    severity: 'low',
    recommendation: 'Standardize to straight apostrophes',
  });
}

writeFileSync('rules-research/items/current-data-anomalies.json', JSON.stringify(anomalies, null, 2));
console.log('Anomalies written:', anomalies.length);
console.log('High:', anomalies.filter(a => a.severity === 'high').length);
console.log('Medium:', anomalies.filter(a => a.severity === 'medium').length);
console.log('Low:', anomalies.filter(a => a.severity === 'low').length);

// --- Generate normalized catalog ---
const normalized = items.map(item => ({
  ...item,
  normalizedName: normalize(item.name),
}));
writeFileSync('rules-research/items/current-catalog-normalized.json', JSON.stringify(normalized, null, 2));
console.log('Normalized catalog written:', normalized.length, 'items');
