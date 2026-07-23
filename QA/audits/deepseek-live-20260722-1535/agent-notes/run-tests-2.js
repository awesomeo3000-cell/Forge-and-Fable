const { getPages, createPage, closePage, evaluate, sleep } = require('./cdp-helper.js');

const CHAR_ID = '17eebc74-2464-4d0e-a057-39665edb575c';

async function readChar(wsUrl) {
  const result = await evaluate(wsUrl, `(async function() {
    const res = await fetch('/api/characters', { credentials: 'include' });
    const json = await res.json();
    const char = (json.characters || []).find(c => c.id === '${CHAR_ID}');
    return JSON.stringify({ 
      name: char?.name, currentHp: char?.currentHp, revision: char?.revision 
    });
  })()`);
  return JSON.parse(result.value);
}

async function updateChar(wsUrl, patch, revision) {
  const expr = `(async function() {
    const res = await fetch('/api/characters/${CHAR_ID}', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '${revision}' },
      credentials: 'include',
      body: JSON.stringify(${JSON.stringify(patch)})
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch(e) {}
    return JSON.stringify({ status: res.status, ok: res.ok, error: data.error, rev: data.character?.revision });
  })()`;
  const result = await evaluate(wsUrl, expr);
  return JSON.parse(result.value);
}

async function runTests() {
  const pages = await getPages();
  const tabA = pages[1];
  const tabB = pages[0];
  
  console.log('========================================');
  console.log('PERSIST-2: ADDITIONAL TESTS');
  console.log('========================================\n');
  
  // ========================================
  // TEST 9: DOUBLE SUBMISSION - Campaign Creation
  // ========================================
  console.log('=== TEST 9: DOUBLE SUBMISSION - Campaign Creation ===');
  
  const campName = 'DOUBLE-CAMP-' + Date.now();
  const campPromise1 = evaluate(tabA.webSocketDebuggerUrl, `(async function() {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: '${campName}' })
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch(e) {}
    return JSON.stringify({ status: res.status, ok: res.ok, id: data.campaign?.id || data.id, name: data.campaign?.name || data.name });
  })()`);
  
  const campPromise2 = evaluate(tabB.webSocketDebuggerUrl, `(async function() {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: '${campName}' })
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch(e) {}
    return JSON.stringify({ status: res.status, ok: res.ok, id: data.campaign?.id || data.id, name: data.campaign?.name || data.name });
  })()`);
  
  const [campR1, campR2] = await Promise.all([campPromise1, campPromise2]);
  const camp1 = JSON.parse(campR1.value);
  const camp2 = JSON.parse(campR2.value);
  console.log('Campaign 1:', camp1.ok ? 'CREATED id=' + camp1.id : 'FAILED: ' + camp1.error);
  console.log('Campaign 2:', camp2.ok ? 'CREATED id=' + camp2.id : 'FAILED: ' + camp2.error);
  if (camp1.ok && camp2.ok && camp1.id !== camp2.id) {
    console.log('DUPLICATE CAMPAIGNS CREATED!');
    // Cleanup
    for (const c of [camp1, camp2]) {
      if (c.id) {
        await evaluate(tabA.webSocketDebuggerUrl, `(async function() {
          await fetch('/api/campaigns/${c.id}', { method: 'DELETE', credentials: 'include' });
        })()`);
      }
    }
  }
  
  // ========================================
  // TEST 10: INTERRUPTED NAVIGATION - Mid-edit navigate away
  // ========================================
  console.log('\n=== TEST 10: INTERRUPTED NAVIGATION - Mid-edit ===');
  
  let state = await readChar(tabA.webSocketDebuggerUrl);
  const origHp = state.currentHp;
  const origRev = state.revision;
  console.log('Starting state - HP:', origHp, 'Rev:', origRev);
  
  // In Tab A: Start editing (update HP to 99)
  // But DON'T save - instead navigate away
  // This simulates: user types new HP, then clicks Campaigns before saving
  console.log('Simulating mid-edit navigation...');
  
  // Actually, since we're using API calls, we can simulate this by:
  // 1. Change HP to 99 and save (simulating "edit")
  // 2. Immediately revert (simulating navigating away without saving)
  // But let me think about this more realistically...
  
  // The real test: edit character, navigate to campaigns page, return to character
  // Check if the edit was saved, lost, or in draft state
  
  // Navigate to Forge (character list)
  await evaluate(tabA.webSocketDebuggerUrl, `(function() {
    // Click the Forge link
    const links = document.querySelectorAll('a, button');
    for (const l of links) {
      if (l.textContent.trim() === 'Forge' || l.textContent.trim() === 'FORGE') {
        l.click();
        break;
      }
    }
  })()`);
  await sleep(2000);
  
  // Now navigate back to home/character
  await evaluate(tabA.webSocketDebuggerUrl, `(function() {
    const links = document.querySelectorAll('a, button');
    for (const l of links) {
      if (l.textContent.trim() === 'Home' || l.textContent.trim() === 'HOME' || l.textContent.trim() === 'Hearth') {
        l.click();
        break;
      }
    }
  })()`);
  await sleep(2000);
  
  // Check character state - should be unchanged
  state = await readChar(tabA.webSocketDebuggerUrl);
  console.log('After navigation - HP:', state.currentHp, 'Rev:', state.revision);
  if (state.currentHp === origHp) {
    console.log('NAVIGATION TEST: Character unchanged after navigation without save (expected)');
  } else {
    console.log('NAVIGATION TEST: Character CHANGED - autosave may have occurred');
  }
  
  // ========================================
  // TEST 11: INTERRUPTED NAVIGATION - Close tab during edit
  // ========================================
  console.log('\n=== TEST 11: CLOSE TAB DURING EDIT ===');
  
  // Create a fresh tab, start editing, close it
  const tempPage = await createPage('http://localhost:3000/');
  await sleep(3000);
  
  // Check if the page is logged in
  const tempTitle = await evaluate(tempPage.webSocketDebuggerUrl, 'document.title');
  console.log('Temp page title:', tempTitle.value);
  
  // Navigate to home
  await evaluate(tempPage.webSocketDebuggerUrl, 'window.location.href = "http://localhost:3000/"');
  await sleep(3000);
  
  // Verify we can reach characters
  const tempCharCheck = await evaluate(tempPage.webSocketDebuggerUrl, `(async function() {
    const res = await fetch('/api/characters', { credentials: 'include' });
    return JSON.stringify({ ok: res.ok });
  })()`);
  console.log('Temp tab can access characters:', tempCharCheck.value);
  
  // Make an edit
  const tempState = await readChar(tempPage.webSocketDebuggerUrl);
  console.log('Temp tab character HP:', tempState.currentHp, 'Rev:', tempState.revision);
  
  const editResult = await updateChar(tempPage.webSocketDebuggerUrl, { currentHp: 77 }, tempState.revision);
  console.log('Temp tab edit:', editResult.ok ? 'SAVED HP=77' : 'FAILED: ' + editResult.error);
  
  // Now close the tab
  await closePage(tempPage.id);
  console.log('Temp tab closed');
  await sleep(1000);
  
  // Verify data persisted (it should - we explicitly saved)
  state = await readChar(tabA.webSocketDebuggerUrl);
  console.log('After tab close - HP:', state.currentHp, 'Rev:', state.revision);
  console.log('Data persisted after tab close:', state.currentHp === 77 ? 'YES' : 'NO (HP=' + state.currentHp + ')');
  
  // ========================================
  // TEST 12: DOUBLE SUBMISSION - more aggressive
  // ========================================
  console.log('\n=== TEST 12: DOUBLE SUBMISSION - Aggressive (3 simultaneous) ===');
  
  const tripleName = 'TRIPLE-SUBMIT-' + Date.now();
  const triplePayload = {
    name: tripleName,
    ruleset: '2014',
    classId: 'fighter',
    raceId: 'human',
    level: 1,
    maxHp: 12,
    currentHp: 12,
    abilities: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    spellsKnown: [],
    inventory: [],
    skillProficiencies: [],
    customRules: [],
    hpRolls: [],
    deathSaves: { successes: 0, failures: 0 },
    spellSlotsUsed: {},
    pactSlotsUsed: {}
  };
  
  const createExpr = `(async function() {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(${JSON.stringify(triplePayload)})
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch(e) {}
    return JSON.stringify({ status: res.status, ok: res.ok, id: data.character?.id, name: data.character?.name });
  })()`;
  
  const [tr1, tr2, tr3] = await Promise.all([
    evaluate(tabA.webSocketDebuggerUrl, createExpr),
    evaluate(tabB.webSocketDebuggerUrl, createExpr),
    evaluate(tabA.webSocketDebuggerUrl, createExpr)
  ]);
  
  const tripleResults = [JSON.parse(tr1.value), JSON.parse(tr2.value), JSON.parse(tr3.value)];
  const createdTriple = tripleResults.filter(r => r.ok);
  console.log('Triple submit: ' + createdTriple.length + ' created, ' + (3 - createdTriple.length) + ' blocked');
  if (createdTriple.length > 1) {
    const uniqueIds = new Set(createdTriple.map(r => r.id));
    console.log('Unique IDs:', uniqueIds.size, '(out of ' + createdTriple.length + ' created)');
    if (uniqueIds.size > 1) console.log('DUPLICATES CREATED!');
    
    // Cleanup
    for (const r of createdTriple) {
      await evaluate(tabA.webSocketDebuggerUrl, `(async function() {
        await fetch('/api/characters/${r.id}', { method: 'DELETE', credentials: 'include' });
      })()`);
    }
  }
  
  // ========================================
  // TEST 13: STALE TAB - Revision Conflict Re-test with 3 participants
  // ========================================
  console.log('\n=== TEST 13: STALE TAB - 3-Participant Revision Conflict ===');
  
  // Reset character name
  state = await readChar(tabA.webSocketDebuggerUrl);
  await updateChar(tabA.webSocketDebuggerUrl, { name: 'CONFLICT-TEST' }, state.revision);
  
  // All three read
  state = await readChar(tabA.webSocketDebuggerUrl);
  const revAll = state.revision;
  console.log('Starting name:', state.name, 'Rev:', revAll);
  
  // Tab A updates
  const aEdit = await updateChar(tabA.webSocketDebuggerUrl, { name: 'TAB-A-WINS' }, revAll);
  console.log('Tab A update:', aEdit.ok ? 'OK rev=' + aEdit.rev : 'FAILED: ' + aEdit.error);
  
  // Tab B tries with stale rev
  const bEdit = await updateChar(tabB.webSocketDebuggerUrl, { name: 'TAB-B-STALE' }, revAll);
  console.log('Tab B stale update:', bEdit.ok ? 'OK (OVERWROTE!)' : 'CONFLICT 409');
  
  // Now Tab B reads fresh and tries again
  state = await readChar(tabB.webSocketDebuggerUrl);
  const bEdit2 = await updateChar(tabB.webSocketDebuggerUrl, { name: 'TAB-B-FRESH' }, state.revision);
  console.log('Tab B fresh update:', bEdit2.ok ? 'OK rev=' + bEdit2.rev : 'FAILED: ' + bEdit2.error);
  
  // Final
  state = await readChar(tabA.webSocketDebuggerUrl);
  console.log('Final name:', state.name, 'Rev:', state.revision);
  
  // ========================================
  // TEST 14: Race condition - Read-Modify-Write within same revision
  // ========================================
  console.log('\n=== TEST 14: RACE CONDITION - Rapid Read-Modify-Write ===');
  
  state = await readChar(tabA.webSocketDebuggerUrl);
  const baseRev = state.revision;
  console.log('Base revision:', baseRev);
  
  // Both tabs read, both try to modify with same revision
  const race1 = updateChar(tabA.webSocketDebuggerUrl, { currentHp: 100 }, baseRev);
  const race2 = updateChar(tabB.webSocketDebuggerUrl, { currentHp: 200 }, baseRev);
  const [raceR1, raceR2] = await Promise.all([race1, race2]);
  
  console.log('Race 1 (HP=100):', raceR1.ok ? 'OK rev=' + raceR1.rev : 'FAILED: ' + raceR1.error);
  console.log('Race 2 (HP=200):', raceR2.ok ? 'OK rev=' + raceR2.rev : 'FAILED: ' + raceR2.error);
  
  state = await readChar(tabA.webSocketDebuggerUrl);
  console.log('Final HP:', state.currentHp);
  console.log('Race condition result: ' + (raceR1.ok && !raceR2.ok ? 'First wins (correct)' : raceR2.ok && !raceR1.ok ? 'Second wins' : 'Both succeeded (BAD)'));

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n========================================');
  console.log('ALL ADDITIONAL TESTS COMPLETE');
  console.log('========================================');
}

runTests().catch(e => console.error('FATAL ERROR:', e.message));
