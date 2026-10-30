import { readFileSync, writeFileSync } from 'node:fs';
import { knownAlgCheck, MIN_HTM, type CasesDb } from './enrich';

// Applies the generator's acceptance rules (minimum length, no known-alg
// giveaways) to the existing pools without re-running the solver, which takes
// about an hour. Pools shrink a little; the verifier still requires 25 per case.
const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));
const file = JSON.parse(readFileSync('data/scrambles.json', 'utf8')) as { pools: Record<string, string[]> };
const givesAway = knownAlgCheck(db);

let dropped = 0;
for (const [id, pool] of Object.entries(file.pools)) {
  const kept = pool.filter(s => s.split(' ').length >= MIN_HTM && !givesAway(s));
  dropped += pool.length - kept.length;
  if (kept.length !== pool.length) console.log(`${id}: ${pool.length} -> ${kept.length}`);
  file.pools[id] = kept;
}

writeFileSync('data/scrambles.json', JSON.stringify(file, null, 2) + '\n');
console.log(`dropped ${dropped} scrambles`);
