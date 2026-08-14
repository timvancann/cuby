import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { caseById } from './caseSet';
import { clearOverride, getOverride, setOverride, validateOverride } from './overrides';
import { activeAlg } from './settings';

const sune = caseById.get('sune')!;

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()));
});

test('a genuine alternative alg for the case validates', () => {
  expect(validateOverride(sune, sune.secondary!)).toBeNull();
});

test('wrong case, broken F2L, and garbage are rejected with messages', () => {
  const antiSune = caseById.get('anti-sune')!;
  expect(validateOverride(sune, antiSune.primary)).toMatch(/different case/);
  expect(validateOverride(sune, "R U R'")).toMatch(/breaks F2L|different case/);
  expect(validateOverride(sune, 'R T')).toMatch(/Can't read/);
});

test('setOverride persists valid, rejects invalid without writing', async () => {
  expect(await setOverride('sune', sune.secondary!, 5)).toBeNull();
  expect(await getOverride('sune')).toBe(sune.secondary);
  expect(await activeAlg('sune')).toBe(sune.secondary);
  expect(await setOverride('sune', "R U R'", 6)).not.toBeNull();
  expect(await getOverride('sune')).toBe(sune.secondary); // unchanged
});

test('clearOverride restores the primary', async () => {
  await setOverride('sune', sune.secondary!, 5);
  await clearOverride('sune');
  expect(await getOverride('sune')).toBeNull();
  expect(await activeAlg('sune')).toBe(sune.primary);
});
