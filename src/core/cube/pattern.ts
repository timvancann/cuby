import { U, type Cube } from './model';
import { applyAlg } from './parser';

// Top-ring side facelets: F row0, R row0, B row0, L row0 (left→right within each face)
const RING = [18, 19, 20, 9, 10, 11, 45, 46, 47, 36, 37, 38];

export function ollPattern(c: Cube): string {
  const top = c[U * 9 + 4];
  let s = '';
  for (let i = 0; i < 9; i++) s += c[i] === top ? '1' : '0';
  for (const i of RING) s += c[i] === top ? '1' : '0';
  return s;
}

export function normalizedOllPattern(c: Cube): string {
  let cur = c, best = ollPattern(c);
  for (let k = 0; k < 3; k++) {
    cur = applyAlg(cur, 'U');
    const p = ollPattern(cur);
    if (p < best) best = p;
  }
  return best;
}

export function f2lSolved(c: Cube): boolean {
  for (const face of [2, 1, 5, 4]) {          // F R B L
    const center = c[face * 9 + 4];
    for (let i = 3; i < 9; i++) if (c[face * 9 + i] !== center) return false;
  }
  const dc = c[3 * 9 + 4];
  for (let i = 0; i < 9; i++) if (c[3 * 9 + i] !== dc) return false;
  return true;
}

const CENTERS = [4, 13, 22, 31, 40, 49]; // U R F D L B center indices

export function orientYellowUp(c: Cube): Cube {
  const target = U; // yellow = original U color
  for (let face = 0; face < 6; face++) {
    if (c[CENTERS[face]] === target) {
      // face currently holding the yellow center -> rotation that moves it to U
      const fix = ['', "z'", 'x', 'x2', 'z', "x'"][face];
      return fix ? applyAlg(c, fix) : c;
    }
  }
  throw new Error('no yellow center found');
}
