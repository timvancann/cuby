export type Cube = Uint8Array;
export const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;

export interface Move { label: string; base: string; q: number }

type Vec = [number, number, number];

// Per-face frame: [normal, rowDir, colDir], chosen to match the Kociemba
// facelet layout so index order is directly the URFDLB solver string.
const FRAMES: [Vec, Vec, Vec][] = [
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]],   // U: rows back->front
  [[1, 0, 0], [0, -1, 0], [0, 0, -1]], // R: rows top->bottom, cols front->back
  [[0, 0, 1], [0, -1, 0], [1, 0, 0]],  // F: rows top->bottom, cols left->right
  [[0, -1, 0], [0, 0, -1], [1, 0, 0]], // D: rows front->back
  [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], // L: rows top->bottom, cols back->front
  [[0, 0, -1], [0, -1, 0], [-1, 0, 0]],// B: rows top->bottom, cols right->left
];

// Doubled-integer sticker positions: normal offset 3, tangent steps of 2.
const POS: Vec[] = [];
const NORM: Vec[] = [];
const AT = new Map<string, number>();
for (let face = 0; face < 6; face++) {
  const [n, dr, dc] = FRAMES[face];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const p: Vec = [
        3 * n[0] + 2 * (r - 1) * dr[0] + 2 * (c - 1) * dc[0],
        3 * n[1] + 2 * (r - 1) * dr[1] + 2 * (c - 1) * dc[1],
        3 * n[2] + 2 * (r - 1) * dr[2] + 2 * (c - 1) * dc[2],
      ];
      AT.set(`${p}|${n}`, POS.length);
      POS.push(p);
      NORM.push(n);
    }
  }
}

// axis: 0=x 1=y 2=z; layers: cubie coordinates along the axis that move;
// q sign: positive = clockwise seen from the positive axis. Same table as cube-stepper.
const BASE: Record<string, { axis: 0 | 1 | 2; layers: number[]; q: number }> = {
  R: { axis: 0, layers: [1], q: 1 },  L: { axis: 0, layers: [-1], q: -1 },
  U: { axis: 1, layers: [1], q: 1 },  D: { axis: 1, layers: [-1], q: -1 },
  F: { axis: 2, layers: [1], q: 1 },  B: { axis: 2, layers: [-1], q: -1 },
  M: { axis: 0, layers: [0], q: -1 }, E: { axis: 1, layers: [0], q: -1 },
  S: { axis: 2, layers: [0], q: 1 },
  x: { axis: 0, layers: [-1, 0, 1], q: 1 },
  y: { axis: 1, layers: [-1, 0, 1], q: 1 },
  z: { axis: 2, layers: [-1, 0, 1], q: 1 },
  r: { axis: 0, layers: [0, 1], q: 1 },  l: { axis: 0, layers: [-1, 0], q: -1 },
  u: { axis: 1, layers: [0, 1], q: 1 },  d: { axis: 1, layers: [-1, 0], q: -1 },
  f: { axis: 2, layers: [0, 1], q: 1 },  b: { axis: 2, layers: [-1, 0], q: -1 },
};

// One clockwise quarter turn (seen from the positive axis) = -90° right-handed.
function rotCW(v: Vec, axis: 0 | 1 | 2): Vec {
  const [x, y, z] = v;
  if (axis === 0) return [x, z, -y];
  if (axis === 1) return [-z, y, x];
  return [y, -x, z];
}

const permCache = new Map<string, Uint8Array>();

function permFor(base: string, q: number): Uint8Array {
  const def = BASE[base];
  if (!def) throw new Error(`Unknown move base "${base}"`);
  // net clockwise quarter turns, with q interpreted in the base move's own direction
  const netTurns = (((def.q < 0 ? -q : q) % 4) + 4) % 4;
  const key = `${base}:${netTurns}`;
  const hit = permCache.get(key);
  if (hit) return hit;
  const perm = new Uint8Array(54);
  for (let i = 0; i < 54; i++) {
    const cubieCoord = Math.sign(POS[i][def.axis]);
    if (!def.layers.includes(cubieCoord)) { perm[i] = i; continue; }
    let p = POS[i], n = NORM[i];
    for (let t = 0; t < netTurns; t++) { p = rotCW(p, def.axis); n = rotCW(n, def.axis); }
    const j = AT.get(`${p}|${n}`);
    if (j === undefined) throw new Error('geometry bug: rotated facelet not found');
    perm[i] = j;
  }
  permCache.set(key, perm);
  return perm;
}

export function solvedCube(): Cube {
  const c = new Uint8Array(54);
  for (let i = 0; i < 54; i++) c[i] = Math.floor(i / 9);
  return c;
}

export function applyMoves(c: Cube, moves: Move[]): Cube {
  let cur = c;
  for (const m of moves) {
    const perm = permFor(m.base, m.q);
    const next = new Uint8Array(54);
    for (let i = 0; i < 54; i++) next[perm[i]] = cur[i];
    cur = next;
  }
  return cur;
}

export function toKociemba(c: Cube): string {
  let s = '';
  for (const v of c) s += 'URFDLB'[v];
  return s;
}
