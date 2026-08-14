import { readFileSync } from 'node:fs';
import { solvedCube } from '../src/core/cube/model';
import { applyAlg } from '../src/core/cube/parser';
import { f2lSolved, normalizedOllPattern } from '../src/core/cube/pattern';
import { caseState, enrichCases, FACE_TURN, type CasesDb } from './enrich';

let failures = 0;
const fail = (msg: string) => { failures++; console.error('FAIL:', msg); };

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));

// 1. cases.json is exactly what enrichment produces (committed file is up to date)
try {
  const reEnriched = JSON.stringify(enrichCases(db), null, 2) + '\n';
  if (reEnriched !== readFileSync('data/cases.json', 'utf8')) {
    fail('data/cases.json is stale — run `npm run gen:cases` and commit the result');
  }
} catch (e) {
  fail(`enrichment failed: ${(e as Error).message}`);
}

// 2. pools: every scramble face-turn-only, <=14 HTM, F2L-preserving, right case, unique
const { pools } = JSON.parse(readFileSync('data/scrambles.json', 'utf8')) as { pools: Record<string, string[]> };
for (const c of db.cases) {
  const pool = pools[c.id] ?? [];
  const target = normalizedOllPattern(caseState(c.primary));
  if (pool.length < 50) fail(`${c.id}: pool has ${pool.length} < 50 scrambles`);
  if (new Set(pool).size !== pool.length) fail(`${c.id}: duplicate scrambles in pool`);
  for (const s of pool) {
    const moves = s.split(' ');
    if (moves.length > 14) fail(`${c.id}: scramble longer than 14 HTM: ${s}`);
    if (!moves.every(m => FACE_TURN.test(m))) fail(`${c.id}: non-face-turn move in: ${s}`);
    const state = applyAlg(solvedCube(), s);
    if (!f2lSolved(state)) fail(`${c.id}: scramble breaks F2L: ${s}`);
    if (normalizedOllPattern(state) !== target) fail(`${c.id}: scramble produces wrong case: ${s}`);
  }
}
const orphans = Object.keys(pools).filter(id => !db.cases.some(c => c.id === id));
for (const id of orphans) fail(`pool for unknown case id "${id}"`);

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('verify: all checks passed');
