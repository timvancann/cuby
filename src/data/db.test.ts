import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { activeAlg, getCaseSelection, getSetting, setCaseSelection, setSetting } from './settings';
import { caseById, cases, groups, pools } from './caseSet';

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()));
});

test('case set loads: 57 cases, 14 groups, 57 pools of 50', () => {
  expect(cases).toHaveLength(57);
  expect(groups).toHaveLength(14);
  expect(Object.keys(pools)).toHaveLength(57);
  for (const c of cases) {
    expect(pools[c.id]).toHaveLength(50);
    expect(c.pattern).toMatch(/^[01]{21}$/);
  }
});

test('settings round-trip with fallback', async () => {
  expect(await getSetting('nope', 42)).toBe(42);
  await setSetting('nope', 7);
  expect(await getSetting('nope', 42)).toBe(7);
});

test('case selection persists', async () => {
  expect(await getCaseSelection()).toEqual([]);
  await setCaseSelection(['sune', 'key']);
  expect(await getCaseSelection()).toEqual(['sune', 'key']);
});

test('attempts store and retrieve by session', async () => {
  const sessionId = (await db.sessions.add({ mode: 'case', startedAt: 1, configSnapshot: ['sune'] })) as number;
  await db.attempts.add({
    sessionId, mode: 'case', caseId: 'sune', scramble: 'R U2 R', startedAt: 5,
    splits: [{ label: 'recognition', ms: 800 }, { label: 'solve', ms: 2000 }],
    totalMs: 2800, flag: 'ok',
  });
  const rows = await db.attempts.where('sessionId').equals(sessionId).toArray();
  expect(rows).toHaveLength(1);
  expect(rows[0].totalMs).toBe(2800);
});

test('activeAlg falls back to primary and honors overrides', async () => {
  const sune = caseById.get('sune')!;
  expect(await activeAlg('sune')).toBe(sune.primary);
  await db.algOverrides.put({ caseId: 'sune', moves: "L' U' L U' L' U2 L", updatedAt: 9 });
  expect(await activeAlg('sune')).toBe("L' U' L U' L' U2 L");
});
