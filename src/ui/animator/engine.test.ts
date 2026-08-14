import { expect, test } from 'vitest';
import { VISUAL_BASE } from './engine';
import { BASE } from '../../core/cube/model';

// The visual move table must cover exactly the bases the shared parser can emit,
// with the same axis/direction conventions as cube-stepper's known-good table.
test('visual move table covers all 18 parser bases', () => {
  const bases = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'r', 'l', 'u', 'd', 'f', 'b'];
  expect(Object.keys(VISUAL_BASE).sort()).toEqual(bases.sort());
});

// The two tables are intentionally identical (same axes/layers/directions), just with
// a string axis label ('x'|'y'|'z') instead of core's numeric axis (0|1|2). This pins
// that identity entry-by-entry rather than spot-checking a handful of bases.
test('VISUAL_BASE matches core BASE table exactly for every base', () => {
  const AXIS_LETTERS = ['x', 'y', 'z'] as const;
  expect(Object.keys(VISUAL_BASE).sort()).toEqual(Object.keys(BASE).sort());
  for (const key of Object.keys(BASE)) {
    expect(VISUAL_BASE[key]).toEqual({
      axis: AXIS_LETTERS[BASE[key].axis],
      layers: BASE[key].layers,
      q: BASE[key].q,
    });
  }
});
