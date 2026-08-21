import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { enrichCases, stripEndUTurns, type CasesDb } from './enrich';

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

test('stripEndUTurns removes leading and trailing U-layer moves', () => {
  expect(stripEndUTurns(['U2', 'R', 'U', "R'", "U'"])).toEqual(['R', 'U', "R'"]);
  expect(stripEndUTurns(['U', 'F', 'R2', 'U2'])).toEqual(['F', 'R2']);
  expect(stripEndUTurns(["U'", 'B', 'D'])).toEqual(['B', 'D']);
  expect(stripEndUTurns(['R', 'U2', "F'"])).toEqual(['R', 'U2', "F'"]);
  expect(stripEndUTurns(['R', 'U', "R'"])).toEqual(['R', 'U', "R'"]);
});
