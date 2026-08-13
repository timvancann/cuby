import { expect, test } from 'vitest';
import { ollPattern, normalizedOllPattern, f2lSolved, orientYellowUp } from './pattern';
import { solvedCube, U } from './model';
import { applyAlg, invert, parseAlg, toAlgString } from './parser';

const SUNE = "R U R' U R U2' R'";
const inverse = (alg: string) => toAlgString(invert(parseAlg(alg)));

test('solved cube pattern: all top yellow, empty ring', () => {
  expect(ollPattern(solvedCube())).toBe('111111111' + '000000000000');
});

test('inverse Sune creates the Sune case: 6 yellow on top, 3 in ring', () => {
  const c = applyAlg(solvedCube(), inverse(SUNE));
  const p = ollPattern(c);
  expect(f2lSolved(c)).toBe(true);
  expect([...p.slice(0, 9)].filter(x => x === '1').length).toBe(6); // center + 4 edges + 1 corner
  expect([...p.slice(9)].filter(x => x === '1').length).toBe(3);    // 3 misoriented corners point sideways
});

test('normalized pattern is AUF-invariant', () => {
  const c = applyAlg(solvedCube(), inverse(SUNE));
  expect(normalizedOllPattern(applyAlg(c, 'U2'))).toBe(normalizedOllPattern(c));
  expect(normalizedOllPattern(applyAlg(c, "U'"))).toBe(normalizedOllPattern(c));
});

test('f2lSolved is false after R, true after y rotation of solved', () => {
  expect(f2lSolved(applyAlg(solvedCube(), 'R'))).toBe(false);
  expect(f2lSolved(applyAlg(solvedCube(), 'y'))).toBe(true);
});

test('orientYellowUp undoes a net rotation', () => {
  const c = applyAlg(solvedCube(), 'x z2');
  expect(orientYellowUp(c)[4]).toBe(U); // U center is U-colored again
});
