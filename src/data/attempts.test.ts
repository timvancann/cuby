import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { recordAttempt, setAttemptFlag } from './attempts';
import { _resetSessionsForTests } from './sessions';
import { createTimer, tap } from '../core/timer/attempt';

beforeEach(async () => {
  _resetSessionsForTests();
  await Promise.all(db.tables.map(t => t.clear()));
});

function doneTimer() {
  let t = createTimer(['recognition', 'solve']);
  t = tap(t, 1000);
  t = tap(t, 1800);
  t = tap(t, 4300);
  return t;
}

test('recordAttempt creates session and row with splits, flag ok', async () => {
  const id = await recordAttempt({
    mode: 'case', config: ['sune', 'key'], now: 5000,
    timer: doneTimer(), caseId: 'sune', scramble: 'R U2 R',
  });
  const row = (await db.attempts.get(id))!;
  expect(row.totalMs).toBe(3300);
  expect(row.splits).toEqual([
    { label: 'recognition', ms: 800 },
    { label: 'solve', ms: 2500 },
  ]);
  expect(row.flag).toBe('ok');
  expect(row.startedAt).toBe(1000);
  expect(await db.sessions.count()).toBe(1);
});

test('recordAttempt survives Proxy-wrapped timer state (structured-clone safety)', async () => {
  const proxied = new Proxy(doneTimer(), {}) as ReturnType<typeof doneTimer>;
  const id = await recordAttempt({ mode: 'full', config: [], now: 1, timer: proxied, scramble: "R U R' D2" });
  expect((await db.attempts.get(id))!.totalMs).toBe(3300);
});

test('setAttemptFlag updates the row', async () => {
  const id = await recordAttempt({ mode: 'full', config: [], now: 1, timer: doneTimer() });
  await setAttemptFlag(id, 'dnf');
  expect((await db.attempts.get(id))!.flag).toBe('dnf');
});
