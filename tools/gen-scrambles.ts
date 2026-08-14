import { readFileSync, writeFileSync } from 'node:fs';
import { solvedCube, toKociemba } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { f2lSolved, normalizedOllPattern } from '../src/core/cube/pattern';
import { randomPllState } from '../src/core/cube/pll';
import { mulberry32 } from '../src/core/rng';
import { SolverPool } from './solve-pool';
import { caseState, FACE_TURN, type CasesDb } from './enrich';

// --- Why this isn't the brief's straight-line loop ---
// The brief assumed cubejs's solve(maxDepth) behaves like a normal bounded
// solver: fast, and roughly optimal up to maxDepth. In practice (verified
// against node_modules/cubejs/README.md and the actual solve.js source):
//  - solve() with no maxDepth (default 22) is NOT close to optimal for these
//    states: it accepts the first depth-1..22 decomposition it finds, so it
//    routinely returns 18-22 move solutions for states that have a 7-14 move
//    solution (confirmed directly: cubejs returns 16 moves by default for a
//    state whose sune-inverse solves it in 7).
//  - Forcing maxDepth=14 makes it search properly and it DOES find the near
//    -optimal solution quickly when one exists. But when no <=14 solution
//    exists for a given state, proving that requires exhausting the search
//    tree, which can take from seconds to minutes (observed hangs >90s), and
//    that is unpredictable up front.
// Adaptation (per task instructions): always call solve(14) (never the
// default), but run it in a small pool of subprocesses (solve-pool.ts) with a
// wall-clock timeout. A request that doesn't answer in time is treated as a
// rejection (same as "no solution") and its worker is killed and respawned.
// This bounds the generator's wall-clock time without weakening the accepted
// scrambles' correctness: every accepted scramble is still independently
// self-verified below (F2L solved, pattern matches, <=14 HTM, face turns only)
// exactly as the brief specified, so the timeout can never cause a wrong
// scramble to be accepted -- only cause a valid-but-slow one to be skipped in
// favor of resampling a new random state.
//
// One more thing the self-verification step catches: cubejs's solve() can
// return an algorithm that does not actually solve the input state at all
// (confirmed directly -- applying a returned "solution" via cubejs's own
// move()/isSolved() sometimes fails to reach solved). This is a correctness
// bug in the library, not just a suboptimality quirk. A verification failure
// is therefore treated as a rejected candidate (log + resample), exactly like
// a >14-move or non-face-turn result -- never as a fatal error, since the
// verification step's whole job is to catch exactly this.
//
// Known limitation -- near-determinism, not exact: the seeded RNG and batch
// reassembly (see below) make the *order* of random draws and the resulting
// pool contents independent of subprocess completion order. But the TIMEOUT_MS
// race is a real wall-clock race against OS scheduling, and over a ~2500-
// request run its outcome for a small number of borderline requests can flip
// between runs on the same machine (observed: 1-2 cases out of 57 landing on
// a different, but still valid, 50-scramble pool across repeated runs).
// Every accepted scramble is independently verified regardless, so this never
// produces an incorrect scramble -- only an occasional non-byte-identical
// data/scrambles.json. A fully reproducible fix would require bounding cubejs's
// search by CPU-instruction/node count rather than wall-clock time, which
// means forking solve.js; out of scope here.

const SEED = 20260813;
const PER_CASE = 50;
const MAX_HTM = 14;
const WORKERS = 12;
const TIMEOUT_MS = 6000;
const MAX_ATTEMPTS_PER_CASE = PER_CASE * 4000;

const AUFS = ['', 'U', "U'", 'U2'];

async function main() {
  const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));
  const pool = new SolverPool(WORKERS);
  const rand = mulberry32(SEED);
  const pools: Record<string, string[]> = {};

  for (const c of db.cases) {
    const targetPattern = normalizedOllPattern(caseState(c.primary));
    const poolSet = new Set<string>();
    let attempts = 0;
    let rejectedVerifications = 0;
    const t0 = Date.now();

    while (poolSet.size < PER_CASE) {
      if (attempts >= MAX_ATTEMPTS_PER_CASE) {
        throw new Error(
          `case "${c.id}": only found ${poolSet.size}/${PER_CASE} scrambles after ${attempts} attempts`,
        );
      }

      // Build a deterministic batch: draw all random states up front (in a
      // fixed order from the single seeded RNG stream) before any async
      // dispatch, so the final pool contents never depend on subprocess
      // completion timing.
      const batchSize = Math.min(WORKERS, MAX_ATTEMPTS_PER_CASE - attempts);
      const facelets: string[] = [];
      for (let i = 0; i < batchSize; i++) {
        let state = randomPllState(rand);
        state = applyAlg(state, toAlgString(invert(parseAlg(c.primary))));
        const auf = AUFS[Math.floor(rand() * 4)];
        if (auf) state = applyAlg(state, auf);
        facelets.push(toKociemba(state));
      }
      attempts += batchSize;

      const results = await pool.solveBatch(facelets, TIMEOUT_MS);
      for (const result of results) {
        if (result.type !== 'OK') continue;
        const solution = result.alg;
        if (!solution) continue; // already solved (shouldn't happen for LL-scrambled states)
        const moves = solution.split(' ');
        if (moves.length > MAX_HTM || !moves.every((m) => FACE_TURN.test(m))) continue;
        const scramble = toAlgString(invert(parseAlg(solution)));
        // Self-verify before accepting (this, not the solver, carries the
        // correctness guarantee -- spec section 6.4). cubejs occasionally
        // returns a "solution" that doesn't actually solve the input state
        // (see the note above); reject and resample rather than trust it.
        const check = applyAlg(solvedCube(), scramble);
        if (!f2lSolved(check) || normalizedOllPattern(check) !== targetPattern) {
          rejectedVerifications++;
          continue;
        }
        poolSet.add(scramble);
        if (poolSet.size >= PER_CASE) break;
      }
    }

    pools[c.id] = [...poolSet];
    console.log(
      `${c.id}: ${poolSet.size} scrambles (${attempts} attempts, ` +
        `${rejectedVerifications} failed verification, ${Date.now() - t0}ms)`,
    );
  }

  writeFileSync('data/scrambles.json', JSON.stringify({ version: 1, seed: SEED, pools }, null, 2) + '\n');
  console.log('wrote data/scrambles.json');
  pool.shutdown();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
