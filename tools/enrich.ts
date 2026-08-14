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
