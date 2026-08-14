import { solvedCube } from '../core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../core/cube/parser';
import { f2lSolved, normalizedOllPattern, orientYellowUp } from '../core/cube/pattern';
import { db } from './db';
import { caseById, type CaseInfo } from './caseSet';

function caseStateOf(alg: string) {
  return orientYellowUp(applyAlg(solvedCube(), toAlgString(invert(parseAlg(alg)))));
}

export function validateOverride(c: CaseInfo, moves: string): string | null {
  let state;
  try {
    state = caseStateOf(moves);
  } catch (e) {
    return (e as Error).message;
  }
  if (!f2lSolved(state)) return 'algorithm breaks F2L';
  if (normalizedOllPattern(state) !== normalizedOllPattern(caseStateOf(c.primary)))
    return 'algorithm solves a different case';
  return null;
}

export async function setOverride(caseId: string, moves: string, now: number): Promise<string | null> {
  const c = caseById.get(caseId);
  if (!c) return `unknown case "${caseId}"`;
  const trimmed = moves.trim();
  const error = validateOverride(c, trimmed);
  if (error) return error;
  await db.algOverrides.put({ caseId, moves: trimmed, updatedAt: now });
  return null;
}

export async function clearOverride(caseId: string): Promise<void> {
  await db.algOverrides.delete(caseId);
}

export async function getOverride(caseId: string): Promise<string | null> {
  return (await db.algOverrides.get(caseId))?.moves ?? null;
}
