/**
 * Automated validator tests
 * Run: node tests/item-candidate-validator.test.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

const VALIDATOR = 'node scripts/validate-item-candidates.mjs';
const VALID_FIXTURE = 'rules-research/items/agents/mundane-2014/candidates.valid.json';
const INVALID_FIXTURE = 'rules-research/items/agents/mundane-2014/candidates.invalid.json';
const DIR = 'rules-research/items/agents/mundane-2014';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  PASS:', name);
    passed++;
  } catch (e) {
    console.log('  FAIL:', name);
    console.log('       ', e.message);
    failed++;
  }
}

function run(cmd) {
  try {
    const out = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    return { output: out, status: 0 };
  } catch (e) {
    // Combine stdout and stderr — validator writes errors to stderr
    return { output: (e.stdout || '') + '\n' + (e.stderr || ''), status: e.status || 1 };
  }
}

console.log('Validator Test Suite\n');

// 1. Valid fixture exits 0
test('valid fixture exits 0', () => {
  const r = run(`${VALIDATOR} ${VALID_FIXTURE}`);
  if (r.status !== 0) throw new Error(`Expected exit 0, got ${r.status}\n${r.output}`);
});

// 2. Invalid fixture exits 1
test('invalid fixture exits 1', () => {
  const r = run(`${VALIDATOR} ${INVALID_FIXTURE}`);
  if (r.status !== 1) throw new Error(`Expected exit 1, got ${r.status}`);
});

// 3. Invalid fixture reports expected errors
test('invalid fixture reports provenance error', () => {
  const r = run(`${VALIDATOR} ${INVALID_FIXTURE}`);
  if (!r.output.includes('At least one provenance entry required')) throw new Error('Missing provenance error');
});

test('invalid fixture reports unknown-field error', () => {
  const r = run(`${VALIDATOR} ${INVALID_FIXTURE}`);
  if (!r.output.includes('Unknown field')) throw new Error('Missing unknown-field error');
});

test('invalid fixture reports publisherLane error', () => {
  const r = run(`${VALIDATOR} ${INVALID_FIXTURE}`);
  if (!r.output.includes('Missing publisherLane')) throw new Error('Missing publisherLane error');
});

test('invalid fixture reports manifest version error', () => {
  const r = run(`${VALIDATOR} ${INVALID_FIXTURE}`);
  if (!r.output.includes('manifestVersion must be')) throw new Error('Missing manifest version error');
});

// 4. Directory mode works
test('directory mode validates recursively', () => {
  const r = run(`${VALIDATOR} ${DIR}`);
  // Should find both .json files; invalid one causes exit 1
  if (r.status !== 1) throw new Error(`Expected exit 1 from dir mode, got ${r.status}`);
  if (!r.output.includes('candidates.valid.json') || !r.output.includes('candidates.invalid.json')) {
    throw new Error('Did not find both fixtures in dir mode');
  }
});

// 5. JSON output mode
test('--json flag produces valid JSON', () => {
  const r = run(`${VALIDATOR} --json ${VALID_FIXTURE}`);
  // Try parsing the entire output, then try each line
  let j = null;
  try { j = JSON.parse(r.output.trim()); } catch {}
  if (!j) {
    for (const line of r.output.split('\n')) {
      const t = line.trim();
      if (t.startsWith('{')) { try { j = JSON.parse(t); break; } catch {} }
    }
  }
  if (!j) throw new Error('Could not find valid JSON in output:\n' + r.output);
  if (j.valid !== true) throw new Error('Expected valid: true, got: ' + JSON.stringify(j));
  if (j.filesChecked !== 1) throw new Error('Expected filesChecked: 1');
});

// 6. Cross-file duplicate detection
test('cross-file duplicate IDs caught', () => {
  const tmpPath = 'rules-research/items/agents/mundane-2014/_tmp-dupe.json';
  writeFileSync(tmpPath, JSON.stringify({
    schemaVersion: '1.0.0',
    manifestVersion: '1.0.0',
    sourceCode: 'phb-2014',
    researcherAgent: 'test',
    researchedAt: '2026-07-17T00:00:00Z',
    candidates: [{ candidateId: 'test-dagger-2014', name: 'Dagger', normalizedName: 'dagger', rulesVersion: '2014', sourceCode: 'phb-2014', sourceTitle: "Player's Handbook (2014)", publisherLane: 'wizards-first-party', category: 'Weapon', confidence: 0.95, sourceEvidence: { primarySource: 'test', accessedAt: '2026-07-17T00:00:00Z' }, structuredData: { magical: false, provenance: [{ sourceCode: 'phb-2014', sourceTitle: "Player's Handbook (2014)", rulesVersion: '2014', sourceType: 'core-book', publisherLane: 'wizards-first-party', researchedAt: '2026-07-17T00:00:00Z', researcherAgent: 'test', verificationStatus: 'single-source' }] } }]
  }, null, 2));
  const r = run(`${VALIDATOR} ${VALID_FIXTURE} ${tmpPath}`);
  unlinkSync(tmpPath);
  if (!r.output.includes('Duplicate candidateId')) throw new Error('Missing cross-file duplicate error');
});

console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
// This file is a self-running script (node tests/item-candidate-validator.test.mjs)
// whose checks have already executed by this point. Under vitest, register the
// summary as a real test so the suite reports pass/fail instead of erroring on
// process.exit / "no test suite found".
if (process.env.VITEST) {
  const { test: vitestTest, expect } = await import('vitest');
  vitestTest('item candidate validator script checks', () => {
    expect(failed, `${failed} validator check(s) failed — see stdout`).toBe(0);
  });
} else {
  process.exit(failed > 0 ? 1 : 0);
}
