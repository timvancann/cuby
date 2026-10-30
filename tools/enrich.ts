import { solvedCube } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { f2lSolved, normalizedOllPattern, ollPattern, orientYellowUp } from '../src/core/cube/pattern';
import { canonicalPatternTable } from './oll-canonical';

export interface CaseEntry {
  id: string; name: string; group: string; primary: string;
  secondary?: string; triggers?: string; notes?: string; easy?: boolean;
  pattern?: string; oll?: number;
}
export interface CasesDb { version: number; set: string; groups: { id: string; name: string }[]; cases: CaseEntry[] }

export const FACE_TURN = /^[UDLRFB]['2]?$/;

// A U-layer turn at either end of a case scramble only rotates the (solved or
// finished) top layer, so it never changes which OLL pattern the scramble
// produces — it just obfuscates the scramble. Solver output never repeats a
// face, so at most one move per end needs stripping.
const U_TURN = /^U['2]?$/;
export function stripEndUTurns(moves: string[]): string[] {
  const out = [...moves];
  if (out.length && U_TURN.test(out[0])) out.shift();
  if (out.length && U_TURN.test(out[out.length - 1])) out.pop();
  return out;
}

// A scramble that is a face-turn-only alg from the set (forwards or inverted,
// in the same U-stripped form as pool scrambles), or that contains one of at
// least GIVEAWAY_MIN_RUN moves as a contiguous run, hands the case to anyone
// who knows the algs. Shorter runs (triggers like R U R' U') are everywhere
// in random face-turn sequences and give nothing away on their own.
export const GIVEAWAY_MIN_RUN = 7;
// Shortest accepted case scramble (HTM, after stripping end U turns).
export const MIN_HTM = 10;

export function knownAlgCheck(db: CasesDb): (scramble: string) => boolean {
  const exact = new Set<string>();
  const runs = new Set<string>();
  for (const c of db.cases) {
    for (const alg of [c.primary, c.secondary]) {
      if (!alg) continue;
      const moves = parseAlg(alg);
      for (const seq of [moves, invert(moves)]) {
        const s = toAlgString(seq).split(' ');
        if (!s.every(m => FACE_TURN.test(m))) continue;
        const core = stripEndUTurns(s);
        exact.add(core.join(' '));
        if (core.length >= GIVEAWAY_MIN_RUN) runs.add(` ${core.join(' ')} `);
      }
    }
  }
  return scramble => {
    if (exact.has(scramble)) return true;
    const padded = ` ${scramble} `;
    for (const run of runs) if (padded.includes(run)) return true;
    return false;
  };
}

export function caseState(alg: string) {
  const state = orientYellowUp(applyAlg(solvedCube(), toAlgString(invert(parseAlg(alg)))));
  if (!f2lSolved(state)) throw new Error('alg does not preserve F2L');
  return state;
}

export function enrichCases(db: CasesDb): CasesDb {
  const table = canonicalPatternTable();
  const seen = new Map<string, string>();
  const cases = db.cases.map(c => {
    try {
      const state = caseState(c.primary);
      const norm = normalizedOllPattern(state);
      if (c.secondary && normalizedOllPattern(caseState(c.secondary)) !== norm)
        throw new Error('secondary alg produces a different case');
      const prev = seen.get(norm);
      if (prev) throw new Error(`same pattern as case "${prev}"`);
      seen.set(norm, c.id);
      const oll = table.get(norm);
      if (!oll) throw new Error('pattern matches no canonical OLL number');
      return { ...c, pattern: ollPattern(state), oll };
    } catch (e) {
      throw new Error(`case "${c.id}": ${(e as Error).message}`);
    }
  });
  return { ...db, cases };
}
