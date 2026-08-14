import { expect, test } from 'vitest';
import { diagramLayout } from './diagram';

const SOLVED = '111111111' + '000000000000';

test('solved: 9 on grid cells, no bars', () => {
  const d = diagramLayout(SOLVED);
  expect(d.grid).toHaveLength(9);
  expect(d.grid.every(c => c.on)).toBe(true);
  expect(d.bars).toHaveLength(0);
});

test('grid row 0 sits at the top and column order is left to right', () => {
  const d = diagramLayout(SOLVED);
  expect(d.grid[0]).toMatchObject({ x: 9, y: 9 });
  expect(d.grid[2]).toMatchObject({ x: 62, y: 9 });
  expect(d.grid[6]).toMatchObject({ x: 9, y: 62 });
});

test('ring bars land on the right edges', () => {
  const f = diagramLayout('000000000' + '100000000000').bars;   // F0 -> bottom-left
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ x: 9, y: 90, w: 25, h: 6 });
  const r = diagramLayout('000000000' + '000100000000').bars;   // R0 -> right edge, bottom
  expect(r[0]).toMatchObject({ x: 90, y: 62, w: 6, h: 25 });
  const b = diagramLayout('000000000' + '000000100000').bars;   // B0 -> top edge, right
  expect(b[0]).toMatchObject({ x: 62, y: 0, w: 25, h: 6 });
  const l = diagramLayout('000000000' + '000000000100').bars;   // L0 -> left edge, top
  expect(l[0]).toMatchObject({ x: 0, y: 9, w: 6, h: 25 });
});

test('bad input renders empty, not a crash', () => {
  expect(diagramLayout('101')).toEqual({ grid: [], bars: [] });
});
