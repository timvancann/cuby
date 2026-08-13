import { expect, test } from 'vitest';
import { randomPllState } from './pll';
import { mulberry32 } from '../rng';
import { f2lSolved, ollPattern } from './pattern';
import { solvedCube } from './model';

test('every PLL state keeps F2L solved and all LL pieces oriented', () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const c = randomPllState(rand);
    expect(f2lSolved(c)).toBe(true);
    expect(ollPattern(c)).toBe(ollPattern(solvedCube()));
  }
});

test('states vary and generation is deterministic per seed', () => {
  const a = new Set<string>(), rand = mulberry32(7);
  for (let i = 0; i < 100; i++) a.add(randomPllState(rand).join(','));
  expect(a.size).toBeGreaterThan(20);
  const r1 = mulberry32(99), r2 = mulberry32(99);
  expect(randomPllState(r1)).toEqual(randomPllState(r2));
});
