import { parseAlg, toAlgString } from '../cube/parser';

export interface AttemptPick { caseId: string; variant: string; scramble: string }

const AUFS = ['', 'U', "U'", 'U2'];

export function pickAttempt(input: {
  selected: string[];
  pools: Record<string, string[]>;
  lastCaseId?: string;
  lastVariantByCase?: Record<string, string>;
  rand: () => number;
}): AttemptPick {
  const { selected, pools, lastCaseId, lastVariantByCase = {}, rand } = input;
  if (selected.length < 2) throw new Error('need at least 2 selected cases');

  let candidates = selected;
  if (selected.length >= 3 && lastCaseId) candidates = selected.filter(id => id !== lastCaseId);
  const caseId = candidates[Math.floor(rand() * candidates.length)];

  const pool = pools[caseId];
  if (!pool || pool.length === 0) throw new Error(`no scramble pool for case "${caseId}"`);
  let variants = pool;
  const lastVariant = lastVariantByCase[caseId];
  if (pool.length >= 2 && lastVariant) variants = pool.filter(v => v !== lastVariant);
  const variant = variants[Math.floor(rand() * variants.length)];

  const auf = AUFS[Math.floor(rand() * AUFS.length)];
  return { caseId, variant, scramble: appendAuf(variant, auf) };
}

export function appendAuf(scramble: string, auf: string): string {
  if (!auf) return scramble;
  const moves = parseAlg(scramble);
  const aufMove = parseAlg(auf)[0];
  const last = moves[moves.length - 1];
  if (!last || last.base !== 'U') return toAlgString([...moves, aufMove]);
  const net = (((last.q + aufMove.q) % 4) + 4) % 4; // 0..3 net clockwise quarter turns
  if (net === 0) return toAlgString(moves.slice(0, -1));
  const q = net === 3 ? -1 : net;
  return toAlgString([...moves.slice(0, -1), { label: '', base: 'U', q }]);
}
