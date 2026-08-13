import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAlg } from '../src/core/cube/parser';

const db = JSON.parse(readFileSync('data/cases.json', 'utf8'));

test('57 cases, unique ids, valid group refs', () => {
  expect(db.cases).toHaveLength(57);
  const ids = new Set(db.cases.map((c: { id: string }) => c.id));
  expect(ids.size).toBe(57);
  const groupIds = new Set(db.groups.map((g: { id: string }) => g.id));
  expect(groupIds.size).toBe(14);
  for (const c of db.cases) expect(groupIds.has(c.group), c.id).toBe(true);
});

test('exactly 8 easy cases', () => {
  expect(db.cases.filter((c: { easy?: boolean }) => c.easy)).toHaveLength(8);
});

test('all algorithms parse', () => {
  for (const c of db.cases) {
    expect(() => parseAlg(c.primary), `${c.id} primary`).not.toThrow();
    if (c.secondary) expect(() => parseAlg(c.secondary), `${c.id} secondary`).not.toThrow();
  }
});
