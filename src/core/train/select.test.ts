import { expect, test } from 'vitest';
import { appendAuf, pickAttempt } from './select';
import { mulberry32 } from '../rng';

const pools = {
  a: ['R U R2', 'F U F2', 'L U L2'],
  b: ["B U' B2", 'D U D2'],
  c: ['R2 F2 R2'],
};

test('never the same case twice in a row when 3+ selected', () => {
  const rand = mulberry32(1);
  let last: string | undefined;
  for (let i = 0; i < 100; i++) {
    const p = pickAttempt({ selected: ['a', 'b', 'c'], pools, lastCaseId: last, rand });
    expect(p.caseId).not.toBe(last);
    last = p.caseId;
  }
});

test('with exactly 2 selected, repeats are allowed and both cases occur', () => {
  const rand = mulberry32(2);
  const seen = new Set<string>();
  let last: string | undefined;
  for (let i = 0; i < 50; i++) {
    const p = pickAttempt({ selected: ['a', 'b'], pools, lastCaseId: last, rand });
    seen.add(p.caseId);
    last = p.caseId;
  }
  expect(seen).toEqual(new Set(['a', 'b']));
});

test('never the same variant twice in a row for a case', () => {
  const rand = mulberry32(3);
  const lastVariantByCase: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    const p = pickAttempt({ selected: ['a', 'b'], pools, lastVariantByCase, rand });
    expect(p.variant).not.toBe(lastVariantByCase[p.caseId]);
    lastVariantByCase[p.caseId] = p.variant;
  }
});

test('scramble is variant plus merged AUF and stays parseable', () => {
  const rand = mulberry32(4);
  const p = pickAttempt({ selected: ['a', 'b'], pools, rand });
  expect(p.scramble.startsWith(p.variant.split(' ').slice(0, -1).join(' '))).toBe(true);
});

test('appendAuf merges trailing U moves', () => {
  expect(appendAuf('R U2 F2 U', "U'")).toBe('R U2 F2');
  expect(appendAuf('R U2 F2 U', 'U')).toBe('R U2 F2 U2');
  expect(appendAuf('R U2 F2 U2', "U'")).toBe('R U2 F2 U');
  expect(appendAuf('R U2 F2', 'U2')).toBe('R U2 F2 U2');
  expect(appendAuf('R U2 F2', '')).toBe('R U2 F2');
});

test('guards: fewer than 2 selected or missing pool throws', () => {
  expect(() => pickAttempt({ selected: ['a'], pools, rand: mulberry32(5) })).toThrow();
  expect(() => pickAttempt({ selected: ['a', 'zzz'], pools, rand: () => 0.9 })).toThrow(/zzz/);
});
