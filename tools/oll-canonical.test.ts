import { expect, test } from 'vitest';
import { CANONICAL_OLL, canonicalPatternTable } from './oll-canonical';

test('57 entries producing 57 distinct patterns', () => {
  expect(Object.keys(CANONICAL_OLL)).toHaveLength(57);
  expect(canonicalPatternTable().size).toBe(57);
});

test('known invariants: dot cases have 0 oriented edges, OCLL has 4', () => {
  const byNumber = new Map([...canonicalPatternTable()].map(([p, n]) => [n, p]));
  const orientedEdges = (p: string) => [p[1], p[3], p[5], p[7]].filter(x => x === '1').length;
  for (const n of [1, 2, 3, 4, 17, 18, 19, 20]) expect(orientedEdges(byNumber.get(n)!), `OLL ${n}`).toBe(0);
  for (const n of [21, 22, 23, 24, 25, 26, 27]) expect(orientedEdges(byNumber.get(n)!), `OLL ${n}`).toBe(4);
});
