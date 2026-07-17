#!/usr/bin/env node
/**
 * Candidate Item Validator — Schema v1.0.0
 * 
 * Validates Phase B research candidate files against the canonical schema
 * and the frozen source manifest. Enforces all requirements declared in the
 * Phase B contract including unknown-field rejection, provenance requirements,
 * rules-family consistency, publisher lane validation, ISO timestamp checks,
 * cross-file duplicate detection, and directory scanning.
 * 
 * Usage:
 *   node scripts/validate-item-candidates.mjs <file-or-dir> [...]
 *   node scripts/validate-item-candidates.mjs --json <file-or-dir>
 *   node scripts/validate-item-candidates.mjs --quiet --warnings-as-errors <dir>
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';

// ── Configuration ──────────────────────────────────────────────────────────

const SCHEMA_VERSION = '1.0.0';
const MANIFEST_PATH = resolve(process.cwd(), 'rules-research/items/source-manifest.json');

const VALID_RULES_VERSIONS = new Set(['2014', '2024', 'shared']);
const VALID_RARITIES = new Set(['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact', 'varies', 'none', null]);
const VALID_PRICE_STATUSES = new Set(['listed', 'not-listed', 'varies', 'not-applicable', 'unknown']);
const VALID_VERIFICATION_STATUSES = new Set(['single-source', 'cross-checked', 'manual-review']);
const VALID_PUBLISHER_LANES = new Set(['wizards-first-party', 'official-licensed', 'partnered', 'charity', 'third-party']);
const VALID_DAMAGE_TYPES = new Set([
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
]);
const VALID_WEAPON_PROPERTIES = new Set([
  'ammunition', 'finesse', 'heavy', 'light', 'loading', 'range',
  'reach', 'special', 'thrown', 'two-handed', 'versatile', 'monk', 'nick', 'vex', 'topple', 'graze', 'cleave', 'push', 'slow', 'sap',
]);
const VALID_ARMOR_CATEGORIES = new Set(['light', 'medium', 'heavy', 'shield']);
const VALID_WEAPON_CATEGORIES = new Set(['simple', 'martial']);
const VALID_WEAPON_RANGE_TYPES = new Set(['melee', 'ranged']);
const VALID_DESCRIPTION_STATUSES = new Set(['open-license', 'original-summary', 'metadata-only']);

// ── Allowed-key sets for unknown-field detection ───────────────────────────

const ENVELOPE_KEYS = new Set(['schemaVersion','manifestVersion','sourceCode','researcherAgent','researchedAt','candidates']);
const CANDIDATE_KEYS = new Set(['candidateId','name','normalizedName','aliases','rulesVersion','sourceCode','sourceTitle','publisherLane','page','section','category','subcategory','classification','structuredData','shortDescription','descriptionStatus','sourceEvidence','confidence','issues','spoiler']);
const SD_KEYS = new Set(['magical','rarity','price','weightLb','weapon','armor','tool','container','consumableRules','charges','vehicle','attunement','provenance','tags','description','shortDescription']);
const PRICE_KEYS = new Set(['costCp','status','sourceCode']);
const WEAPON_KEYS = new Set(['category','rangeType','damageDice','damageType','versatileDamageDice','normalRangeFt','longRangeFt','properties','mastery','ammunitionType','magicBonus','baseItemId']);
const ARMOR_KEYS = new Set(['category','baseAc','addDex','maxDexBonus','strengthRequirement','stealthDisadvantage','magicBonus','baseItemId']);
const ATTUNEMENT_KEYS = new Set(['required','requirementText','classes','species','alignments']);
const CHARGES_KEYS = new Set(['maximum','recharge','destroyOnEmpty']);
const PROVENANCE_KEYS = new Set(['sourceCode','sourceTitle','rulesVersion','sourceType','publisherLane','page','section','officialUrlKey','license','researchedAt','researcherAgent','verificationStatus']);
const EVIDENCE_KEYS = new Set(['primarySource','secondaryChecks','accessedAt']);

// ── State ──────────────────────────────────────────────────────────────────

let errors = 0, warnings = 0, checked = 0;
let jsonMode = false, quietMode = false, warningsAsErrors = false;
const allCandidateIds = new Map();

function fail(p, id, msg) {
  if (!jsonMode && !quietMode) console.error(`  FAIL [${p}]${id?' '+id:''}: ${msg}`);
  errors++;
}
function warn(p, id, msg) {
  if (!jsonMode && !quietMode) console.warn(`  WARN [${p}]${id?' '+id:''}: ${msg}`);
  warnings++;
}
function chk(cond, p, id, msg) { if (!cond) fail(p, id, msg); return cond; }
function isStr(v) { return typeof v === 'string' && v.trim().length > 0; }
function isISO(v) { return typeof v === 'string' && !isNaN(new Date(v).getTime()) && v.includes('T'); }
function chkUnknown(obj, allowed, p, id, label) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) fail(p, id, `Unknown field in ${label}: "${k}". Allowed: ${[...allowed].sort().join(', ')}`);
  }
}

// ── Manifest ───────────────────────────────────────────────────────────────

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) { console.error('ERROR: Manifest not found.'); process.exit(1); }
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  if (raw.schemaVersion !== SCHEMA_VERSION) { console.error(`ERROR: Manifest schema "${raw.schemaVersion}" != validator "${SCHEMA_VERSION}"`); process.exit(1); }
  if (raw.status !== 'frozen') { console.error('ERROR: Manifest not frozen (status:', raw.status + ')'); process.exit(1); }
  const sources = raw.sources || raw;
  const codes = new Set(sources.map(s => s.sourceCode));
  const lanes = {}, titles = {}, families = {};
  sources.forEach(s => { lanes[s.sourceCode] = s.publisherLane; titles[s.sourceCode] = s.title; families[s.sourceCode] = s.rulesFamily; });
  return { codes, version: raw.manifestVersion, lanes, titles, families };
}

// ── Validate ───────────────────────────────────────────────────────────────

function validateEnvelope(data, fp, mf) {
  chkUnknown(data, ENVELOPE_KEYS, fp, 'envelope', 'envelope');
  if (!chk(data.schemaVersion === SCHEMA_VERSION, fp, 'envelope', `Schema must be "${SCHEMA_VERSION}", got "${data.schemaVersion}"`)) { console.error('  HALT.'); return false; }
  chk(data.manifestVersion === mf.version, fp, 'envelope', `manifestVersion must be "${mf.version}", got "${data.manifestVersion}"`);
  chk(isStr(data.sourceCode), fp, 'envelope', 'Missing sourceCode');
  if (data.sourceCode && !mf.codes.has(data.sourceCode)) fail(fp, 'envelope', `Envelope sourceCode "${data.sourceCode}" not in manifest`);
  chk(isStr(data.researcherAgent), fp, 'envelope', 'Missing researcherAgent');
  chk(isStr(data.researchedAt), fp, 'envelope', 'Missing researchedAt');
  if (data.researchedAt) chk(isISO(data.researchedAt), fp, 'envelope', `researchedAt must be ISO-8601, got "${data.researchedAt}"`);
  chk(Array.isArray(data.candidates), fp, 'envelope', 'candidates must be an array');
  return true;
}

function validateCandidate(c, fp, idx, mf) {
  const p = `${fp}[${idx}]`;
  const id = c.candidateId || `unnamed-${idx}`;
  chkUnknown(c, CANDIDATE_KEYS, p, id, 'candidate');
  chk(isStr(c.candidateId), p, id, 'Missing candidateId');
  chk(isStr(c.name), p, id, 'Missing name');
  chk(isStr(c.normalizedName), p, id, 'Missing normalizedName');
  chk(VALID_RULES_VERSIONS.has(c.rulesVersion), p, id, `Invalid rulesVersion: "${c.rulesVersion}"`);
  chk(isStr(c.sourceCode), p, id, 'Missing sourceCode');
  if (c.sourceCode && !mf.codes.has(c.sourceCode)) fail(p, id, `sourceCode "${c.sourceCode}" not in manifest`);
  chk(isStr(c.sourceTitle), p, id, 'Missing sourceTitle');
  // Cross-check title
  if (c.sourceCode && c.sourceTitle && mf.titles[c.sourceCode]) {
    const a = c.sourceTitle.toLowerCase().replace(/[^a-z0-9]/g,'');
    const b = mf.titles[c.sourceCode].toLowerCase().replace(/[^a-z0-9]/g,'');
    if (a !== b) warn(p, id, `sourceTitle "${c.sourceTitle}" vs manifest "${mf.titles[c.sourceCode]}"`);
  }
  // Publisher lane REQUIRED
  chk(isStr(c.publisherLane), p, id, 'Missing publisherLane');
  if (c.publisherLane && !VALID_PUBLISHER_LANES.has(c.publisherLane)) fail(p, id, `Invalid publisherLane: "${c.publisherLane}"`);
  if (c.sourceCode && c.publisherLane && mf.lanes[c.sourceCode] && c.publisherLane !== mf.lanes[c.sourceCode]) {
    fail(p, id, `publisherLane "${c.publisherLane}" != manifest "${mf.lanes[c.sourceCode]}"`);
  }
  // Rules-family consistency
  if (c.sourceCode && c.rulesVersion && mf.families[c.sourceCode]) {
    const fam = mf.families[c.sourceCode];
    if (fam === '2014' && c.rulesVersion === '2024') fail(p, id, `rulesVersion "2024" on 2014 source "${c.sourceCode}"`);
    if (fam === '2024' && c.rulesVersion === '2014') fail(p, id, `rulesVersion "2014" on 2024 source "${c.sourceCode}"`);
  }
  // Category
  chk(isStr(c.category), p, id, 'Missing category');
  // Confidence
  chk(typeof c.confidence === 'number' && c.confidence >= 0 && c.confidence <= 1, p, id, `Invalid confidence: ${c.confidence}`);
  // Description status
  if (c.descriptionStatus) chk(VALID_DESCRIPTION_STATUSES.has(c.descriptionStatus), p, id, `Invalid descriptionStatus: "${c.descriptionStatus}"`);
  // Source evidence REQUIRED
  if (!chk(c.sourceEvidence && typeof c.sourceEvidence === 'object', p, id, 'Missing sourceEvidence')) { checked++; return; }
  chkUnknown(c.sourceEvidence, EVIDENCE_KEYS, p, id, 'sourceEvidence');
  chk(isStr(c.sourceEvidence.primarySource), p, id, 'Missing sourceEvidence.primarySource');
  chk(isStr(c.sourceEvidence.accessedAt), p, id, 'Missing sourceEvidence.accessedAt');
  if (c.sourceEvidence.accessedAt) chk(isISO(c.sourceEvidence.accessedAt), p, id, `sourceEvidence.accessedAt must be ISO-8601`);
  // Structured data REQUIRED
  const sd = c.structuredData;
  if (!chk(sd && typeof sd === 'object' && !Array.isArray(sd), p, id, 'Missing structuredData')) { checked++; return; }
  chkUnknown(sd, SD_KEYS, p, id, 'structuredData');
  validateSD(sd, p, id, mf);
  if (c.issues !== undefined) chk(Array.isArray(c.issues), p, id, 'issues must be an array');
  checked++;
}

function validateSD(sd, p, id, mf) {
  if (sd.price) {
    chkUnknown(sd.price, PRICE_KEYS, p, id, 'price');
    if (sd.price.costCp !== undefined && sd.price.costCp !== null) chk(typeof sd.price.costCp === 'number' && sd.price.costCp >= 0, p, id, `Negative costCp: ${sd.price.costCp}`);
    if (sd.price.status) chk(VALID_PRICE_STATUSES.has(sd.price.status), p, id, `Invalid price status: "${sd.price.status}"`);
  }
  if (sd.magical === true && sd.rarity !== undefined && sd.rarity !== null) chk(VALID_RARITIES.has(sd.rarity), p, id, `Invalid rarity: "${sd.rarity}"`);
  if (sd.weightLb !== undefined && sd.weightLb !== null) chk(typeof sd.weightLb === 'number' && sd.weightLb >= 0, p, id, `Negative weightLb`);
  if (sd.weapon) {
    chkUnknown(sd.weapon, WEAPON_KEYS, p, id, 'weapon');
    const w = sd.weapon;
    if (w.category) chk(VALID_WEAPON_CATEGORIES.has(w.category), p, id, `Invalid weapon category: "${w.category}"`);
    if (w.rangeType) chk(VALID_WEAPON_RANGE_TYPES.has(w.rangeType), p, id, `Invalid rangeType: "${w.rangeType}"`);
    if (w.damageType) chk(VALID_DAMAGE_TYPES.has(w.damageType.toLowerCase()), p, id, `Invalid damageType: "${w.damageType}"`);
    if (w.damageDice) chk(/^\d+d\d+$/.test(w.damageDice)||/^\d+$/.test(w.damageDice), p, id, `Invalid damageDice: "${w.damageDice}"`);
    if (w.properties) w.properties.forEach(pr => { const cl = pr.replace(/\s*\(.*\)\s*/,'').toLowerCase().trim(); if (!VALID_WEAPON_PROPERTIES.has(cl)) warn(p, id, `Unknown weapon property: "${pr}"`); });
    if (w.magicBonus !== undefined) chk(w.magicBonus >= -3 && w.magicBonus <= 3, p, id, `Suspicious magicBonus: ${w.magicBonus}`);
  }
  if (sd.armor) {
    chkUnknown(sd.armor, ARMOR_KEYS, p, id, 'armor');
    const a = sd.armor;
    if (a.category) chk(VALID_ARMOR_CATEGORIES.has(a.category), p, id, `Invalid armor category: "${a.category}"`);
    if (a.baseAc !== undefined) chk(a.baseAc >= 1, p, id, `Invalid baseAc: ${a.baseAc}`);
    if (a.magicBonus !== undefined) chk(a.magicBonus >= -3 && a.magicBonus <= 3, p, id, `Suspicious magicBonus: ${a.magicBonus}`);
  }
  if (sd.attunement) {
    chkUnknown(sd.attunement, ATTUNEMENT_KEYS, p, id, 'attunement');
    chk(typeof sd.attunement.required === 'boolean', p, id, 'attunement.required must be boolean');
  }
  if (sd.charges) { chkUnknown(sd.charges, CHARGES_KEYS, p, id, 'charges'); if (sd.charges.maximum !== undefined) chk(sd.charges.maximum >= 1, p, id, `Invalid charges.maximum`); }
  // Provenance REQUIRED
  if (!chk(Array.isArray(sd.provenance) && sd.provenance.length > 0, p, id, 'At least one provenance entry required')) return;
  sd.provenance.forEach((pr, pi) => {
    chkUnknown(pr, PROVENANCE_KEYS, p, id, `provenance[${pi}]`);
    chk(isStr(pr.sourceCode), p, id, `provenance[${pi}]: missing sourceCode`);
    chk(isStr(pr.sourceTitle), p, id, `provenance[${pi}]: missing sourceTitle`);
    chk(VALID_RULES_VERSIONS.has(pr.rulesVersion), p, id, `provenance[${pi}]: invalid rulesVersion`);
    chk(VALID_VERIFICATION_STATUSES.has(pr.verificationStatus), p, id, `provenance[${pi}]: invalid verificationStatus`);
    chk(isStr(pr.researchedAt), p, id, `provenance[${pi}]: missing researchedAt`);
    chk(isStr(pr.researcherAgent), p, id, `provenance[${pi}]: missing researcherAgent`);
    if (pr.researchedAt) chk(isISO(pr.researchedAt), p, id, `provenance[${pi}]: researchedAt must be ISO-8601`);
    if (pr.sourceCode && pr.rulesVersion && mf.families[pr.sourceCode]) {
      const fam = mf.families[pr.sourceCode];
      if ((fam==='2014'&&pr.rulesVersion==='2024')||(fam==='2024'&&pr.rulesVersion==='2014')) fail(p, id, `provenance[${pi}]: rulesVersion conflict with ${fam} source "${pr.sourceCode}"`);
    }
  });
}

// ── File collection ────────────────────────────────────────────────────────

function collectFiles(inputs) {
  const files = [];
  const skip = /manifest|readme|report|profile|baseline|normalized|anomali|schema|consumer|inventory|assignment/i;
  for (const inp of inputs) {
    const r = resolve(process.cwd(), inp);
    if (!existsSync(r)) { console.error('Not found:', r); errors++; continue; }
    const st = statSync(r);
    if (st.isDirectory()) {
      (function scan(d) {
        for (const e of readdirSync(d)) {
          const f = join(d, e);
          const s = statSync(f);
          if (s.isDirectory()) scan(f);
          else if (s.isFile() && extname(f) === '.json' && !skip.test(e)) files.push(f);
        }
      })(r);
    } else if (st.isFile() && extname(r) === '.json') {
      files.push(r);
    }
  }
  return files;
}

function checkCrossFileDupes(candidates, fp) {
  candidates.forEach((c, i) => {
    const cid = c.candidateId;
    if (!cid) return;
    const key = fp + '[' + i + ']';
    if (allCandidateIds.has(cid)) fail(fp, cid, `Duplicate candidateId across files: also at ${allCandidateIds.get(cid)}`);
    else allCandidateIds.set(cid, key);
  });
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const inputs = [];
  for (const a of args) {
    if (a === '--json') jsonMode = true;
    else if (a === '--quiet') quietMode = true;
    else if (a === '--warnings-as-errors') warningsAsErrors = true;
    else if (a === '--help' || a === '-h') {
      console.log('Candidate Validator — Schema v' + SCHEMA_VERSION);
      console.log('Usage: node scripts/validate-item-candidates.mjs [flags] <file-or-dir> [...]');
      console.log('Flags: --json  --quiet  --warnings-as-errors');
      process.exit(0);
    } else inputs.push(a);
  }
  if (inputs.length === 0) { console.error('No inputs. Use --help.'); process.exit(1); }

  if (!jsonMode) console.log('Candidate Validator — Schema v' + SCHEMA_VERSION + '\n');

  let mf;
  try { mf = loadManifest(); if (!jsonMode) console.log('Manifest: v' + mf.version + ' (' + mf.codes.size + ' sources, frozen)\n'); }
  catch (e) { console.error('Manifest error:', e.message); process.exit(1); }

  const files = collectFiles(inputs);
  if (files.length === 0) { console.error('No candidate files found.'); process.exit(1); }

  for (const fp of files) {
    if (!jsonMode) console.log('Validating:', fp);
    let data;
    try { data = JSON.parse(readFileSync(fp, 'utf-8')); }
    catch (e) { fail(fp, '', 'Invalid JSON: ' + e.message); continue; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { fail(fp, '', 'Root must be object envelope'); continue; }
    if (!validateEnvelope(data, fp, mf)) continue;
    const cs = data.candidates;
    if (!Array.isArray(cs)) { fail(fp, '', 'candidates must be array'); continue; }
    if (!jsonMode) console.log('  Candidates:', cs.length);
    checkCrossFileDupes(cs, fp);
    cs.forEach((c, i) => validateCandidate(c, fp, i, mf));
    if (!jsonMode) console.log('');
  }

  const exit = errors > 0 ? 1 : (warningsAsErrors && warnings > 0 ? 1 : 0);
  if (jsonMode) {
    console.log(JSON.stringify({ valid: exit === 0, filesChecked: files.length, candidatesChecked: checked, errors, warnings }, null, 2));
  } else {
    console.log('═══════════════════════════════════════');
    console.log('  Files:', files.length, ' Candidates:', checked, ' Errors:', errors, ' Warnings:', warnings);
    console.log(exit ? '\nVALIDATION FAILED' : warnings ? '\nVALIDATION PASSED with warnings' : '\nVALIDATION PASSED');
  }
  process.exit(exit);
}

main();
