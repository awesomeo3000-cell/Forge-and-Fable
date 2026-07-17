#!/usr/bin/env node
/**
 * Candidate Item Validator — Schema v1.0.0
 * 
 * Validates Phase B research candidate files against the canonical schema
 * and the frozen source manifest.
 * 
 * Usage:
 *   node scripts/validate-item-candidates.mjs <path-to-candidates.json>
 *   node scripts/validate-item-candidates.mjs rules-research/items/agents/mundane-2014/candidates.json
 *   npm run validate:item-candidates
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Configuration ──────────────────────────────────────────────────────────

const SCHEMA_VERSION = '1.0.0';
const MANIFEST_PATH = resolve(process.cwd(), 'rules-research/items/source-manifest.json');
const VALID_RULES_VERSIONS = new Set(['2014', '2024', 'shared']);
const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'varies', null]);
const VALID_PRICE_STATUSES = new Set(['listed', 'not-listed', 'varies', 'not-applicable', 'unknown']);
const VALID_VERIFICATION_STATUSES = new Set(['single-source', 'cross-checked', 'manual-review']);
const VALID_PUBLISHER_LANES = new Set(['wizards-first-party', 'official-licensed', 'partnered', 'charity', 'third-party']);
const VALID_DAMAGE_TYPES = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]);
const VALID_WEAPON_PROPERTIES = new Set([
  'ammunition', 'finesse', 'heavy', 'light', 'loading', 'reach',
  'special', 'thrown', 'two-handed', 'versatile', 'light', 'monk',
]);
const VALID_ARMOR_CATEGORIES = new Set(['light', 'medium', 'heavy', 'shield']);
const VALID_WEAPON_CATEGORIES = new Set(['simple', 'martial']);
const VALID_WEAPON_RANGE_TYPES = new Set(['melee', 'ranged']);

// ── Helpers ────────────────────────────────────────────────────────────────

let errors = 0;
let warnings = 0;
let checked = 0;

function fail(path, id, message) {
  console.error(`  FAIL [${path}]${id ? ' ' + id : ''}: ${message}`);
  errors++;
}

function warn(path, id, message) {
  console.warn(`  WARN [${path}]${id ? ' ' + id : ''}: ${message}`);
  warnings++;
}

function check(condition, path, id, message) {
  if (!condition) fail(path, id, message);
  return condition;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// ── Load Manifest ──────────────────────────────────────────────────────────

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error('ERROR: Source manifest not found at', MANIFEST_PATH);
    console.error('The manifest must be frozen before validating candidates.');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  const sources = raw.sources || raw;
  const sourceCodes = new Set(sources.map(s => s.sourceCode));
  const manifestVersion = raw.manifestVersion || 'unknown';
  const manifestStatus = raw.status || 'unknown';
  
  if (manifestStatus !== 'frozen') {
    console.error('ERROR: Source manifest is not frozen (status:', manifestStatus + ')');
    console.error('Freeze the manifest before validating candidates.');
    process.exit(1);
  }
  
  // Build publisher lane lookup
  const publisherLanes = {};
  sources.forEach(s => { publisherLanes[s.sourceCode] = s.publisherLane; });
  
  return { sourceCodes, manifestVersion, publisherLanes };
}

// ── Validate Candidate Envelope ────────────────────────────────────────────

function validateEnvelope(data, filePath) {
  // Schema version
  if (!check(data.schemaVersion === SCHEMA_VERSION, filePath, 'envelope',
    `Schema version must be "${SCHEMA_VERSION}", got "${data.schemaVersion}"`)) {
    if (data.schemaVersion && data.schemaVersion !== SCHEMA_VERSION) {
      console.error(`  HALT: Unsupported schema version. Refusing to validate further.`);
      return false;
    }
  }
  
  check(isNonEmptyString(data.manifestVersion), filePath, 'envelope', 'Missing manifestVersion');
  check(isNonEmptyString(data.sourceCode), filePath, 'envelope', 'Missing sourceCode');
  check(isNonEmptyString(data.researcherAgent), filePath, 'envelope', 'Missing researcherAgent');
  check(isNonEmptyString(data.researchedAt), filePath, 'envelope', 'Missing researchedAt (ISO timestamp)');
  check(Array.isArray(data.candidates), filePath, 'envelope', 'candidates must be an array');
  
  return true;
}

// ── Validate Single Candidate ──────────────────────────────────────────────

function validateCandidate(candidate, filePath, index, manifest) {
  const path = `${filePath}[${index}]`;
  const id = candidate.candidateId || `unnamed-${index}`;
  
  // ── Identity ──
  check(isNonEmptyString(candidate.candidateId), path, id, 'Missing candidateId');
  check(isNonEmptyString(candidate.name), path, id, 'Missing name');
  check(isNonEmptyString(candidate.normalizedName), path, id, 'Missing normalizedName');
  
  // ── Rules version ──
  check(VALID_RULES_VERSIONS.has(candidate.rulesVersion),
    path, id, `Invalid rulesVersion: "${candidate.rulesVersion}". Must be 2014, 2024, or shared.`);
  
  // ── Source ──
  check(isNonEmptyString(candidate.sourceCode), path, id, 'Missing sourceCode');
  if (candidate.sourceCode && !manifest.sourceCodes.has(candidate.sourceCode)) {
    fail(path, id, `sourceCode "${candidate.sourceCode}" not found in frozen manifest`);
  }
  
  check(isNonEmptyString(candidate.sourceTitle), path, id, 'Missing sourceTitle');
  
  // ── Publisher lane ──
  if (candidate.sourceCode && manifest.publisherLanes[candidate.sourceCode]) {
    const expectedLane = manifest.publisherLanes[candidate.sourceCode];
    if (candidate.publisherLane && candidate.publisherLane !== expectedLane) {
      fail(path, id, `publisherLane "${candidate.publisherLane}" inconsistent with manifest ("${expectedLane}")`);
    }
  }
  if (candidate.publisherLane && !VALID_PUBLISHER_LANES.has(candidate.publisherLane)) {
    fail(path, id, `Invalid publisherLane: "${candidate.publisherLane}"`);
  }
  
  // ── Category ──
  check(isNonEmptyString(candidate.category), path, id, 'Missing category');
  
  // ── Confidence ──
  check(typeof candidate.confidence === 'number' && candidate.confidence >= 0 && candidate.confidence <= 1,
    path, id, `Invalid confidence: ${candidate.confidence}. Must be 0-1.`);
  
  // ── Description status ──
  if (candidate.descriptionStatus) {
    check(['open-license', 'original-summary', 'metadata-only'].includes(candidate.descriptionStatus),
      path, id, `Invalid descriptionStatus: "${candidate.descriptionStatus}"`);
  }
  
  // ── Source evidence ──
  if (candidate.sourceEvidence) {
    check(isNonEmptyString(candidate.sourceEvidence.primarySource),
      path, id, 'Missing sourceEvidence.primarySource');
    check(isNonEmptyString(candidate.sourceEvidence.accessedAt),
      path, id, 'Missing sourceEvidence.accessedAt');
  }
  
  // ── Structured data validation ──
  const sd = candidate.structuredData;
  if (sd) {
    validateStructuredData(sd, path, id);
  }
  
  // ── Issues ──
  if (candidate.issues && !Array.isArray(candidate.issues)) {
    fail(path, id, 'issues must be an array');
  }
  
  checked++;
  return true;
}

function validateStructuredData(sd, path, id) {
  // Price
  if (sd.price) {
    if (sd.price.costCp !== undefined && sd.price.costCp !== null) {
      check(typeof sd.price.costCp === 'number' && sd.price.costCp >= 0,
        path, id, `Negative costCp: ${sd.price.costCp}`);
    }
    if (sd.price.status) {
      check(VALID_PRICE_STATUSES.has(sd.price.status),
        path, id, `Invalid price status: "${sd.price.status}"`);
    }
  }
  
  // Weight
  if (sd.weightLb !== undefined && sd.weightLb !== null) {
    check(typeof sd.weightLb === 'number' && sd.weightLb >= 0,
      path, id, `Negative weightLb: ${sd.weightLb}`);
  }
  
  // Magical + rarity
  if (sd.magical === true && sd.rarity) {
    check(VALID_RARITIES.has(sd.rarity),
      path, id, `Invalid rarity: "${sd.rarity}"`);
  }
  
  // Weapon
  if (sd.weapon) {
    const w = sd.weapon;
    if (w.category) check(VALID_WEAPON_CATEGORIES.has(w.category), path, id, `Invalid weapon category: "${w.category}"`);
    if (w.rangeType) check(VALID_WEAPON_RANGE_TYPES.has(w.rangeType), path, id, `Invalid weapon rangeType: "${w.rangeType}"`);
    if (w.damageType) check(VALID_DAMAGE_TYPES.has(w.damageType.toLowerCase()), path, id, `Invalid weapon damageType: "${w.damageType}"`);
    if (w.damageDice) check(/^\d+d\d+$/.test(w.damageDice) || /^\d+$/.test(w.damageDice), path, id, `Invalid damageDice: "${w.damageDice}"`);
    if (w.versatileDamageDice) check(/^\d+d\d+$/.test(w.versatileDamageDice), path, id, `Invalid versatileDamageDice: "${w.versatileDamageDice}"`);
    if (w.properties && Array.isArray(w.properties)) {
      w.properties.forEach((prop) => {
        const clean = prop.replace(/\s*\(.*\)\s*/, '').toLowerCase().trim();
        if (!VALID_WEAPON_PROPERTIES.has(clean) && clean !== 'monk') {
          warn(path, id, `Unknown weapon property: "${prop}"`);
        }
      });
    }
    if (w.normalRangeFt !== undefined) check(w.normalRangeFt >= 0, path, id, `Negative normalRangeFt: ${w.normalRangeFt}`);
    if (w.longRangeFt !== undefined) check(w.longRangeFt >= 0, path, id, `Negative longRangeFt: ${w.longRangeFt}`);
    if (w.magicBonus !== undefined) check(w.magicBonus >= -3 && w.magicBonus <= 3, path, id, `Suspicious magicBonus: ${w.magicBonus}`);
  }
  
  // Armor
  if (sd.armor) {
    const a = sd.armor;
    if (a.category) check(VALID_ARMOR_CATEGORIES.has(a.category), path, id, `Invalid armor category: "${a.category}"`);
    if (a.baseAc !== undefined) check(a.baseAc >= 1, path, id, `Invalid baseAc: ${a.baseAc}`);
    if (a.maxDexBonus !== undefined) check(a.maxDexBonus >= 0 && a.maxDexBonus <= 10, path, id, `Suspicious maxDexBonus: ${a.maxDexBonus}`);
    if (a.strengthRequirement !== undefined) check(a.strengthRequirement >= 0, path, id, `Negative strengthRequirement: ${a.strengthRequirement}`);
    if (a.magicBonus !== undefined) check(a.magicBonus >= -3 && a.magicBonus <= 3, path, id, `Suspicious magicBonus: ${a.magicBonus}`);
  }
  
  // Attunement
  if (sd.attunement) {
    check(typeof sd.attunement.required === 'boolean', path, id, 'attunement.required must be boolean');
  }
  
  // Charges
  if (sd.charges) {
    if (sd.charges.maximum !== undefined) check(sd.charges.maximum >= 1, path, id, `Invalid charges.maximum: ${sd.charges.maximum}`);
  }
  
  // Provenance
  if (sd.provenance && Array.isArray(sd.provenance)) {
    sd.provenance.forEach((prov, pi) => {
      check(isNonEmptyString(prov.sourceCode), path, id, `provenance[${pi}]: missing sourceCode`);
      check(isNonEmptyString(prov.sourceTitle), path, id, `provenance[${pi}]: missing sourceTitle`);
      check(VALID_RULES_VERSIONS.has(prov.rulesVersion), path, id, `provenance[${pi}]: invalid rulesVersion "${prov.rulesVersion}"`);
      check(VALID_VERIFICATION_STATUSES.has(prov.verificationStatus), path, id, `provenance[${pi}]: invalid verificationStatus "${prov.verificationStatus}"`);
      check(isNonEmptyString(prov.researchedAt), path, id, `provenance[${pi}]: missing researchedAt`);
      check(isNonEmptyString(prov.researcherAgent), path, id, `provenance[${pi}]: missing researcherAgent`);
      if (prov.publisherLane && !VALID_PUBLISHER_LANES.has(prov.publisherLane)) {
        fail(path, id, `provenance[${pi}]: invalid publisherLane "${prov.publisherLane}"`);
      }
    });
  }
}

// ── Duplicate Candidate ID Check ───────────────────────────────────────────

function checkDuplicateIds(candidates, filePath) {
  const seen = new Map();
  candidates.forEach((c, i) => {
    const cid = c.candidateId;
    if (!cid) return;
    if (seen.has(cid)) {
      fail(filePath, cid, `Duplicate candidateId: also at index ${seen.get(cid)}`);
    } else {
      seen.set(cid, i);
    }
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Candidate Item Validator — Schema v' + SCHEMA_VERSION);
    console.log('');
    console.log('Usage: node scripts/validate-item-candidates.mjs <file-or-dir> [...]');
    console.log('');
    console.log('Validates Phase B research candidate files against the canonical');
    console.log('schema and frozen source manifest.');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/validate-item-candidates.mjs rules-research/items/agents/mundane-2014/candidates.json');
    console.log('  npm run validate:item-candidates');
    process.exit(0);
  }
  
  console.log('Candidate Validator — Schema v' + SCHEMA_VERSION);
  console.log('');
  
  // Load manifest
  let manifest;
  try {
    manifest = loadManifest();
    console.log('Manifest: v' + manifest.manifestVersion + ' (' + manifest.sourceCodes.size + ' sources, frozen)');
  } catch (e) {
    console.error('Failed to load manifest:', e.message);
    process.exit(1);
  }
  
  // Collect all candidate files
  const files = [];
  for (const arg of args) {
    const resolved = resolve(process.cwd(), arg);
    if (!existsSync(resolved)) {
      console.error('File not found:', resolved);
      errors++;
      continue;
    }
    files.push(resolved);
  }
  
  if (files.length === 0) {
    console.error('No candidate files to validate.');
    process.exit(1);
  }
  
  // Validate each file
  for (const filePath of files) {
    console.log('Validating:', filePath);
    
    let data;
    try {
      data = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch (e) {
      fail(filePath, '', 'Invalid JSON: ' + e.message);
      continue;
    }
    
    // Check it's a valid envelope (object with candidates array)
    if (!data || typeof data !== 'object') {
      fail(filePath, '', 'Root must be an object (candidate envelope)');
      continue;
    }
    
    // Validate envelope
    if (!validateEnvelope(data, filePath)) continue;
    
    const candidates = data.candidates;
    if (!Array.isArray(candidates)) {
      fail(filePath, '', 'candidates must be an array');
      continue;
    }
    
    console.log('  Candidates:', candidates.length);
    
    // Check duplicate IDs
    checkDuplicateIds(candidates, filePath);
    
    // Validate each candidate
    candidates.forEach((candidate, index) => {
      validateCandidate(candidate, filePath, index, manifest);
    });
    
    console.log('');
  }
  
  // Report
  console.log('═══════════════════════════════════════');
  console.log('Validation complete.');
  console.log('  Candidates checked:', checked);
  console.log('  Errors:  ', errors);
  console.log('  Warnings:', warnings);
  
  if (errors > 0) {
    console.log('');
    console.log('VALIDATION FAILED —', errors, 'error(s)');
    process.exit(1);
  }
  
  if (warnings > 0) {
    console.log('');
    console.log('VALIDATION PASSED with', warnings, 'warning(s)');
    process.exit(0);
  }
  
  console.log('');
  console.log('VALIDATION PASSED — all checks successful');
  process.exit(0);
}

main();
