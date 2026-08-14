import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { _resetSessionsForTests, endActiveSession, sessionForAttempt } from './sessions';

const MIN = 60_000;

beforeEach(async () => {
  _resetSessionsForTests();
  await Promise.all(db.tables.map(t => t.clear()));
});

test('consecutive attempts share a session', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  const b = await sessionForAttempt('case', ['sune', 'key'], 5 * MIN);
  expect(b).toBe(a);
  expect(await db.sessions.count()).toBe(1);
});

test('config change starts a new session and ends the old one', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  const b = await sessionForAttempt('case', ['sune', 'key', 't'], MIN);
  expect(b).not.toBe(a);
  expect((await db.sessions.get(a))!.endedAt).toBe(MIN);
});

test('30 minutes idle starts a new session', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  const b = await sessionForAttempt('case', ['sune', 'key'], 31 * MIN);
  expect(b).not.toBe(a);
});

test('endActiveSession stamps endedAt and forgets the session', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  await endActiveSession(2 * MIN);
  expect((await db.sessions.get(a))!.endedAt).toBe(2 * MIN);
  const b = await sessionForAttempt('case', ['sune', 'key'], 3 * MIN);
  expect(b).not.toBe(a);
});
