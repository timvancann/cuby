import { solvedCube, type Cube } from './model';

// LL slots as facelet index groups, sticker order [U-facelet, then clockwise viewed from above]
const CORNERS = [
  [8, 9, 20],  // URF: U,R,F
  [6, 18, 38], // UFL: U,F,L
  [0, 36, 47], // ULB: U,L,B
  [2, 45, 11], // UBR: U,B,R
];
const EDGES = [
  [7, 19], // UF
  [5, 10], // UR
  [1, 46], // UB
  [3, 37], // UL
];

function shuffle(rand: () => number): number[] {
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function parity(p: number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) s ^= 1;
  return s;
}

export function randomPllState(rand: () => number): Cube {
  const cp = shuffle(rand);
  const ep = shuffle(rand);
  if (parity(cp) !== parity(ep)) [ep[0], ep[1]] = [ep[1], ep[0]]; // parity fix, bijective so uniformity holds
  const base = solvedCube();
  const out = base.slice();
  CORNERS.forEach((slot, i) => slot.forEach((f, k) => { out[f] = base[CORNERS[cp[i]][k]]; }));
  EDGES.forEach((slot, i) => slot.forEach((f, k) => { out[f] = base[EDGES[ep[i]][k]]; }));
  return out;
}
