export interface DiagramRect { x: number; y: number; w: number; h: number; on: boolean }

const POS = [9, 35.5, 62]; // cell x/y by column/row
const CELL = 25;
const BAR = 6;

export interface RingRect { x: number; y: number; w: number; h: number; face: number }

// Ring index -> rect, same order as core's RING (F row, R row, B row, L row).
function ringRect(i: number): { x: number; y: number; w: number; h: number } {
  const k = i % 3;
  switch (Math.floor(i / 3)) {
    case 0: return { x: POS[k], y: 90, w: CELL, h: BAR };        // F
    case 1: return { x: 90, y: POS[2 - k], w: BAR, h: CELL };    // R
    case 2: return { x: POS[2 - k], y: 0, w: CELL, h: BAR };     // B
    default: return { x: 0, y: POS[k], w: BAR, h: CELL };        // L
  }
}

/** Top-down PLL diagram: all nine top cells solved, twelve side stickers coloured by face. */
export function pllDiagramLayout(ring: number[]): RingRect[] {
  if (ring.length !== 12) return [];
  return ring.map((face, i) => ({ ...ringRect(i), face }));
}

export function diagramLayout(pattern: string): { grid: DiagramRect[]; bars: DiagramRect[] } {
  if (!/^[01]{21}$/.test(pattern)) return { grid: [], bars: [] };
  const grid: DiagramRect[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      grid.push({ x: POS[c], y: POS[r], w: CELL, h: CELL, on: pattern[r * 3 + c] === '1' });

  const bars: DiagramRect[] = [];
  const ring = pattern.slice(9);
  for (let i = 0; i < 3; i++) {
    if (ring[i] === '1') bars.push({ x: POS[i], y: 90, w: CELL, h: BAR, on: true });        // F
    if (ring[3 + i] === '1') bars.push({ x: 90, y: POS[2 - i], w: BAR, h: CELL, on: true }); // R
    if (ring[6 + i] === '1') bars.push({ x: POS[2 - i], y: 0, w: CELL, h: BAR, on: true });  // B
    if (ring[9 + i] === '1') bars.push({ x: 0, y: POS[i], w: BAR, h: CELL, on: true });      // L
  }
  return { grid, bars };
}
