import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { clearHistory, exportAll, importAll, validateBackup } from './backup';
import { _resetSessionsForTests } from './sessions';

beforeEach(async () => {
  _resetSessionsForTests();
  await Promise.all(db.tables.map(t => t.clear()));
  await db.sessions.add({ mode: 'case', startedAt: 1, configSnapshot: ['sune'] });
  await db.attempts.add({ sessionId: 1, mode: 'case', caseId: 'sune', startedAt: 2, splits: [], totalMs: 5, flag: 'ok' });
  await db.algOverrides.put({ caseId: 'sune', moves: 'R U R2', updatedAt: 3 });
  await db.settings.put({ key: 'vibration', value: false });
});

test('export contains all four tables', async () => {
  const f = await exportAll(99);
  expect(f.version).toBe(1);
  expect(f.exportedAt).toBe(99);
  expect(f.sessions).toHaveLength(1);
  expect(f.attempts).toHaveLength(1);
  expect(f.algOverrides).toHaveLength(1);
  expect(f.settings.length).toBeGreaterThan(0);
});

test('round trip: export -> clear everything -> import restores', async () => {
  const f = await exportAll(99);
  await Promise.all(db.tables.map(t => t.clear()));
  await importAll(f);
  expect(await db.attempts.count()).toBe(1);
  expect((await db.algOverrides.get('sune'))?.moves).toBe('R U R2');
});

test('import replaces, not merges', async () => {
  const f = await exportAll(99);
  await db.attempts.add({ sessionId: 1, mode: 'full', startedAt: 9, splits: [], totalMs: 9, flag: 'ok' });
  await importAll(f);
  expect(await db.attempts.count()).toBe(1);
});

test('validateBackup rejects garbage before any write', () => {
  expect(validateBackup(null)).toMatch(/./);
  expect(validateBackup({ version: 2 })).toMatch(/version/);
  expect(validateBackup({ version: 1, exportedAt: 1, sessions: [], attempts: [], algOverrides: [] })).toMatch(/settings/);
  expect(
    validateBackup({ version: 1, exportedAt: 1, sessions: [], attempts: [], algOverrides: [], settings: [] })
  ).toBeNull();
});

test('validateBackup rejects a missing or non-finite exportedAt', () => {
  expect(
    validateBackup({ version: 1, sessions: [], attempts: [], algOverrides: [], settings: [] })
  ).toMatch(/exportedAt/);
  expect(
    validateBackup({ version: 1, exportedAt: NaN, sessions: [], attempts: [], algOverrides: [], settings: [] })
  ).toMatch(/exportedAt/);
});

test('clearHistory removes sessions+attempts, keeps overrides+settings', async () => {
  await clearHistory();
  expect(await db.sessions.count()).toBe(0);
  expect(await db.attempts.count()).toBe(0);
  expect(await db.algOverrides.count()).toBe(1);
  expect(await db.settings.count()).toBeGreaterThan(0);
});
