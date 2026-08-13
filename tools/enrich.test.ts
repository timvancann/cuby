import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { enrichCases, type CasesDb } from './enrich';

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));

test('enrichment assigns a distinct number and pattern to all 57 cases', () => {
  const out = enrichCases(db);
  const numbers = new Set(out.cases.map(c => c.oll));
  expect(numbers.size).toBe(57);
  for (const c of out.cases) {
    expect(c.oll, c.id).toBeGreaterThanOrEqual(1);
    expect(c.oll, c.id).toBeLessThanOrEqual(57);
    expect(c.pattern, c.id).toMatch(/^[01]{21}$/);
  }
});

test('sune is OLL 27', () => {
  const out = enrichCases(db);
  expect(out.cases.find(c => c.id === 'sune')?.oll).toBe(27);
});
