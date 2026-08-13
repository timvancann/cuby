import { applyMoves, type Cube, type Move } from './model';

const TOKEN = /^([RLUDFBMES]|[rludfbxyz]|[RLUDFB]w|[XYZ])(2)?(')?(2)?$/;

export function parseAlg(text: string): Move[] {
  const cleaned = text.replace(/[(),[\]]/g, ' ').trim();
  if (!cleaned) return [];
  const moves: Move[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    const m = raw.match(TOKEN);
    if (!m) throw new Error(`Can't read "${raw}"`);
    let base = m[1];
    if (base.length === 2 && base[1] === 'w') base = base[0].toLowerCase(); // Rw -> r
    if ('XYZ'.includes(base)) base = base.toLowerCase();
    let q = m[2] || m[4] ? 2 : 1;
    if (m[3]) q = -q;
    moves.push({ label: raw, base, q });
  }
  return moves;
}

export function invert(moves: Move[]): Move[] {
  return moves.slice().reverse().map(m => ({ ...m, q: -m.q, label: labelFor(m.base, -m.q) }));
}

function labelFor(base: string, q: number): string {
  const abs = Math.abs(q) === 2 ? '2' : '';
  const prime = Math.abs(q) === 2 ? '' : q < 0 ? "'" : '';
  return base + abs + prime;
}

export function toAlgString(moves: Move[]): string {
  return moves.map(m => labelFor(m.base, m.q)).join(' ');
}

export function applyAlg(c: Cube, alg: string): Cube {
  return applyMoves(c, parseAlg(alg));
}
