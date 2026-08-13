import { expect, test } from 'vitest';
import { parseAlg, invert, applyAlg, toAlgString } from './parser';
import { solvedCube } from './model';

test('parses triggers with parentheses and wide notation', () => {
  const moves = parseAlg("F (R U R' U') F'");
  expect(moves.map(m => m.base)).toEqual(['F', 'R', 'U', 'R', 'U', 'F']);
  expect(parseAlg('Rw2')[0]).toMatchObject({ base: 'r', q: 2 });
  expect(parseAlg("M2'")[0].q).toBeTypeOf('number');
});

test('rejects garbage tokens', () => {
  expect(() => parseAlg('R T U')).toThrowError(/Can't read "T"/);
});

test('invert reverses and flips', () => {
  expect(toAlgString(invert(parseAlg("R U2 F'")))).toBe("F U2 R'");
});

test('alg then inverse returns to solved', () => {
  const alg = "r U R' U' M (U R U' R')";
  const c = applyAlg(solvedCube(), alg);
  expect(c).not.toEqual(solvedCube());
  expect(applyAlg(c, toAlgString(invert(parseAlg(alg))))).toEqual(solvedCube());
});
