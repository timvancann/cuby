import { expect, test } from 'vitest';
import { algGroups } from './algGroups';

test('bracket groups stay whole, separators are kept', () => {
  expect(algGroups("(R U R' U') F2")).toEqual(["(R U R' U')", ' ', 'F2']);
});

test('joining the pieces gives back the input exactly', () => {
  for (const alg of ["R U  R'", "(Su)(sledge)(ne)", "(R U R'", "R) U", "#1: R' U' (double Sledge) U R", '']) {
    expect(algGroups(alg).join('')).toBe(alg);
  }
});
