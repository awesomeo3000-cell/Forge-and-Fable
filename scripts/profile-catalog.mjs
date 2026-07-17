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

// ============================================================================
// Build profile with RAW COUNTS alongside percentages
// ============================================================================
const profile = {
  generatedAt: new Date().toISOString(),
  totalRecords: items.length,
  byCategory: {},
  byRarity: {},
  byAttunement: { required: 0, notRequired: 0, total: items.length },
  byClassification: {},
  emptyFields: {
    image: { count: 0, total: items.length },
    damageType: { count: 0, total: items.length },
    damage: { count: 0, total: items.length },
    ac: { count: 0, total: items.length },
    properties: { count: 0, total: items.length },
    classification: { count: 0, total: items.length },
  },
  costStats: { min: Infinity, max: -Infinity, zeroCount: 0, nonNumericCount: 0, totalWithCost: 0, values: [] },
  descriptionStats: {},
  idPatterns: { withSuffix: 0, withoutSuffix: 0, total: items.length },
};

items.forEach(item => {
  profile.byCategory[item.category] = (profile.byCategory[item.category] || 0) + 1;
  profile.byRarity[item.rarity] = (profile.byRarity[item.rarity] || 0) + 1;
  if (item.attunement) profile.byAttunement.required++;
  else profile.byAttunement.notRequired++;
  if (item.classification) {
    profile.byClassification[item.classification] = (profile.byClassification[item.classification] || 0) + 1;
  }
  if (!item.image) profile.emptyFields.image.count++;
  if (!item.damageType) profile.emptyFields.damageType.count++;
  if (!item.damage) profile.emptyFields.damage.count++;
  if (!item.ac) profile.emptyFields.ac.count++;
  if (!item.properties) profile.emptyFields.properties.count++;
  if (!item.classification) profile.emptyFields.classification.count++;

  const cost = Number(item.cost);
  if (!isNaN(cost)) {
    profile.costStats.values.push(cost);
    if (cost < profile.costStats.min) profile.costStats.min = cost;
    if (cost > profile.costStats.max) profile.costStats.max = cost;
    if (cost === 0) profile.costStats.zeroCount++;
    profile.costStats.totalWithCost++;
  } else {
    profile.costStats.nonNumericCount++;
  }

  if (/-\d+$/.test(item.id)) profile.idPatterns.withSuffix++;
  else profile.idPatterns.withoutSuffix++;
});

// Compute percentages for empty fields
for (const val of Object.values(profile.emptyFields)) {
  val.percent = val.total > 0 ? parseFloat(((val.count / val.total) * 100).toFixed(2)) : 0;
}

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

// Weapon-specific stats
const weapons = items.filter(i => i.category === 'Weapon');
profile.weaponStats = {
  total: weapons.length,
  missingDamageType: { count: weapons.filter(w => !w.damageType).length, total: weapons.length },
  missingDamage: { count: weapons.filter(w => !w.damage).length, total: weapons.length },
  missingProperties: { count: weapons.filter(w => !w.properties).length, total: weapons.length },
};
profile.weaponStats.missingDamageType.percent = parseFloat(((profile.weaponStats.missingDamageType.count / profile.weaponStats.missingDamageType.total) * 100).toFixed(2));
profile.weaponStats.missingDamage.percent = parseFloat(((profile.weaponStats.missingDamage.count / profile.weaponStats.missingDamage.total) * 100).toFixed(2));
profile.weaponStats.missingProperties.percent = parseFloat(((profile.weaponStats.missingProperties.count / profile.weaponStats.missingProperties.total) * 100).toFixed(2));

// Armor-specific stats
const armors = items.filter(i => i.category === 'Armor');
profile.armorStats = {
  total: armors.length,
  missingAC: { count: armors.filter(a => !a.ac).length, total: armors.length },
};
profile.armorStats.missingAC.percent = parseFloat(((profile.armorStats.missingAC.count / profile.armorStats.missingAC.total) * 100).toFixed(2));

writeFileSync('rules-research/items/current-catalog-profile.json', JSON.stringify(profile, null, 2));
console.log('Profile written. Categories:', Object.keys(profile.byCategory).length, 'Total:', items.length);
console.log('Weapon damageType: missing', profile.weaponStats.missingDamageType.count, '/', profile.weaponStats.missingDamageType.total, '=', profile.weaponStats.missingDamageType.percent + '%');

// ============================================================================
// ANOMALIES WITH RAW COUNTS
// ============================================================================
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
        anomalyType: 'duplicate-name',
        anomaly: 'Duplicate name (case-insensitive)',
        rawCount: dups.length,
        totalEligible: items.length,
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
        anomalyType: 'structural-duplicate',
        anomaly: 'Structural duplicate: exists with both numeric-suffix ID and base-name ID',
        rawCount: ids.length,
        totalEligible: items.length,
        severity: 'high',
        recommendation: 'Deduplicate — keep one record, mark the other as deprecated',
      });
    }
  }
}

// Plate rarity — include full record details
const plateItem = items.find(i => i.id === 'plate-10');
if (plateItem && plateItem.rarity === 'Rare') {
  anomalies.push({
    itemId: 'plate-10',
    itemName: 'Plate',
    anomalyType: 'suspected-rarity-error',
    anomaly: 'Mundane plate armor marked as "Rare" while all other mundane armor (leather through half-plate) is "Common"',
    recordDetails: {
      id: plateItem.id,
      name: plateItem.name,
      category: plateItem.category,
      classification: plateItem.classification,
      rarity: plateItem.rarity,
      ac: plateItem.ac,
      cost: plateItem.cost,
    },
    severity: 'high',
    recommendation: 'Inspect the exact record. Determine if it is: (a) ordinary plate armor with wrong rarity, (b) a magic plate variant, (c) a merged record, or (d) a category-mapping error. Do not patch from summary alone.',
  });
}

// Common-vs-Mundane: reclassified as TAXONOMY CONFLICT (not confirmed error)
const mundaneCategories = ['Adventuring Gear', 'Tools', 'Food & Drink', 'Mount', 'Tack', 'Musical Instrument'];
const commonMundanes = items.filter(i => mundaneCategories.includes(i.category) && i.rarity === 'Common');
const actualMundanes = items.filter(i => i.rarity === 'Mundane');
anomalies.push({
  itemId: commonMundanes.length + ' items use Common, ' + actualMundanes.length + ' items use Mundane',
  itemName: 'Various mundane equipment',
  anomalyType: 'taxonomy-conflict',
  anomaly: 'Taxonomy conflict: ' + commonMundanes.length + ' non-magical equipment items use rarity "Common" while ' + actualMundanes.length + ' use "Mundane". The current field likely serves multiple incompatible purposes (magic-item rarity vs. general availability vs. UI grouping).',
  rawCount: commonMundanes.length + actualMundanes.length,
  totalEligible: items.length,
  severity: 'medium',
  recommendation: 'Resolve as a schema policy decision, not a data error. The canonical schema should separate magical rarity from mundane availability using distinct fields. Until the schema policy is approved, these are taxonomy conflicts, not confirmed source-rule errors.',
});

// Zero-cost magic items — now categorized by likely reason
const zeroCostMagic = items.filter(i => {
  const cost = Number(i.cost);
  return !isNaN(cost) && cost === 0 && !['Adventuring Gear', 'Tools'].includes(i.category);
});
anomalies.push({
  itemId: zeroCostMagic.length + ' items',
  itemName: 'Various magic items',
  anomalyType: 'zero-cost',
  anomaly: zeroCostMagic.length + ' magic items have zero cost. A zero may mean: no official price listed, not applicable, variable, template item, unknown, missing, or legacy placeholder. These meanings must not be collapsed into one numeric value.',
  rawCount: zeroCostMagic.length,
  totalEligible: items.length,
  severity: 'medium',
  recommendation: 'Add a price status field (listed | not-listed | varies | not-applicable | unknown). Assign costs to specific instantiations where available. Mark template items explicitly.',
});

// Missing damageType — with raw counts
const weaponsMissingType = items.filter(i => i.category === 'Weapon' && !i.damageType);
anomalies.push({
  itemId: weaponsMissingType.length + ' of ' + weapons.length + ' weapons',
  itemName: 'Various weapons',
  anomalyType: 'missing-mechanics',
  anomaly: weaponsMissingType.length + ' of ' + weapons.length + ' weapons (' + parseFloat(((weaponsMissingType.length / weapons.length) * 100).toFixed(2)) + '%) have empty damageType. Only Scimitar of Speed (scimitar-of-speed-342) has it populated.',
  rawCount: weaponsMissingType.length,
  totalEligible: weapons.length,
  severity: 'medium',
  recommendation: 'Populate damageType for all weapons (Bludgeoning, Piercing, Slashing, etc.)',
});

// Weapon classification singular/plural
const singularWeapons = items.filter(i => i.classification === 'Simple Melee Weapon');
if (singularWeapons.length > 0) {
  anomalies.push({
    itemId: singularWeapons.length + ' items',
    itemName: 'Simple melee weapons',
    anomalyType: 'naming-inconsistency',
    anomaly: singularWeapons.length + ' items use singular "Simple Melee Weapon" while "Martial Melee Weapons" uses plural',
    rawCount: singularWeapons.length,
    totalEligible: weapons.length,
    severity: 'low',
    recommendation: 'Standardize to plural "Simple Melee Weapons"',
  });
}

// Scroll classification
const spellScrolls = items.filter(i => i.category === 'Scroll' && /level/.test(i.classification || ''));
if (spellScrolls.length > 0) {
  anomalies.push({
    itemId: spellScrolls.length + ' items',
    itemName: 'Spell Scrolls',
    anomalyType: 'classification-misuse',
    anomaly: spellScrolls.length + ' scrolls use classification field for spell school/level metadata instead of item type',
    rawCount: spellScrolls.length,
    totalEligible: items.filter(i => i.category === 'Scroll').length,
    severity: 'medium',
    recommendation: 'Add subcategory field for spell metadata; use classification for item type ("Spell Scroll")',
  });
}

// Curly apostrophes
const curlyApos = items.filter(i => /[\u2018\u2019]/.test(i.name + i.description));
if (curlyApos.length > 0) {
  anomalies.push({
    itemId: curlyApos.length + ' items',
    itemName: 'Various items',
    anomalyType: 'formatting-inconsistency',
    anomaly: curlyApos.length + ' items use curly apostrophes; ' + items.filter(i => /'/.test(i.name + i.description)).length + ' use straight apostrophes',
    rawCount: curlyApos.length,
    totalEligible: items.length,
    severity: 'low',
    recommendation: 'Standardize to straight apostrophes',
  });
}

writeFileSync('rules-research/items/current-data-anomalies.json', JSON.stringify(anomalies, null, 2));
console.log('Anomalies written:', anomalies.length);
console.log('High:', anomalies.filter(a => a.severity === 'high').length);
console.log('Medium:', anomalies.filter(a => a.severity === 'medium').length);
console.log('Low:', anomalies.filter(a => a.severity === 'low').length);

// ============================================================================
// NORMALIZED CATALOG
// ============================================================================
const normalized = items.map(item => ({
  ...item,
  normalizedName: normalize(item.name),
}));
writeFileSync('rules-research/items/current-catalog-normalized.json', JSON.stringify(normalized, null, 2));
console.log('Normalized catalog written:', normalized.length, 'items');
