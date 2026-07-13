import { writeFileSync } from 'fs';

const BASE = 'https://www.dnd5eapi.co';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function main() {
  console.log('Fetching spell list...');
  const listData = await fetchJson(`${BASE}/api/2014/spells`);
  const spells = listData.results;
  console.log(`Found ${spells.length} spells`);

  const results = [];

  for (let i = 0; i < spells.length; i++) {
    const s = spells[i];
    console.log(`[${i + 1}/${spells.length}] Fetching ${s.index}...`);
    const detail = await fetchJson(`${BASE}${s.url}`);

    // Map API fields to our schema
    const entry = {
      id: detail.index,
      name: detail.name,
      level: detail.level,
      school: detail.school?.name || null,
      castingTime: detail.casting_time,
      range: detail.range,
      components: detail.components?.join('') || '',
      material: detail.material || null,
      duration: detail.duration,
      ritual: detail.ritual || false,
      concentration: detail.concentration || false,
      description: detail.desc?.join(' ') || '',
      classes: detail.classes?.map(c => c.name) || [],
    };

    results.push(entry);

    // Small delay to be polite to the API
    await new Promise(r => setTimeout(r, 50));
  }

  const outPath = 'E:/forge-and-fable/data/spells.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Wrote ${results.length} spells to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
