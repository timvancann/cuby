export interface DiagramRect { x: number; y: number; w: number; h: number; on: boolean }

const POS = [9, 35.5, 62]; // cell x/y by column/row
const CELL = 25;
const BAR = 6;

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
