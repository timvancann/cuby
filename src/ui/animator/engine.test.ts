import { expect, test } from 'vitest';
import { VISUAL_BASE } from './engine';

// The visual move table must cover exactly the bases the shared parser can emit,
// with the same axis/direction conventions as cube-stepper's known-good table.
test('visual move table covers all 18 parser bases', () => {
  const bases = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'r', 'l', 'u', 'd', 'f', 'b'];
  expect(Object.keys(VISUAL_BASE).sort()).toEqual(bases.sort());
  expect(VISUAL_BASE.R).toEqual({ axis: 'x', layers: [1], q: 1 });
  expect(VISUAL_BASE.M).toEqual({ axis: 'x', layers: [0], q: -1 });
  expect(VISUAL_BASE.y).toEqual({ axis: 'y', layers: [-1, 0, 1], q: 1 });
  expect(VISUAL_BASE.f).toEqual({ axis: 'z', layers: [0, 1], q: 1 });
});
