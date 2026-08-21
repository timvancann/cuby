import { expect, test } from 'vitest';
import { perCaseStats, sessionSummaries, type StatAttempt } from './aggregate';

const att = (over: Partial<StatAttempt>): StatAttempt => ({
  sessionId: 1, caseId: 'sune', startedAt: 100,
  splits: [{ label: 'recognition', ms: 800 }, { label: 'solve', ms: 2000 }],
  totalMs: 2800, flag: 'ok', ...over,
});

test('perCaseStats aggregates solve times and rates across old and new split shapes', () => {
  const rows = [
    att({}), // legacy two-split attempt: its solve split still counts
    att({ startedAt: 200, splits: [{ label: 'solve', ms: 3000 }], totalMs: 3000, flag: 'misrecognized' }),
    att({ startedAt: 300, flag: 'dnf' }),
    att({ caseId: 'key', startedAt: 50, splits: [{ label: 'solve', ms: 1500 }], totalMs: 1500 }),
  ];
  const stats = perCaseStats(rows);
  const sune = stats.find(s => s.caseId === 'sune')!;
  expect(sune.count).toBe(3);
  expect(sune.bestSolve).toBe(2000);
  expect(sune.meanSolve).toBe(2500); // (2000+3000)/2 — DNF excluded from time stats
  expect(sune.dnfRate).toBeCloseTo(1 / 3);
  expect(sune.misrecRate).toBeCloseTo(1 / 3);
  expect(sune.lastSeen).toBe(300);
  expect(stats.find(s => s.caseId === 'key')!.count).toBe(1);
  expect('meanRecognition' in sune).toBe(false);
});

test('sessionSummaries groups and orders by first attempt', () => {
  const rows = [
    att({ sessionId: 2, startedAt: 500, totalMs: 4000 }),
    att({ sessionId: 1, startedAt: 100, totalMs: 2000 }),
    att({ sessionId: 1, startedAt: 200, totalMs: 3000 }),
    att({ sessionId: 2, startedAt: 600, flag: 'dnf' }),
  ];
  const s = sessionSummaries(rows);
  expect(s.map(x => x.sessionId)).toEqual([1, 2]);
  expect(s[0]).toMatchObject({ count: 2, meanTotalMs: 2500, startedAt: 100 });
  expect(s[1]).toMatchObject({ count: 2, meanTotalMs: 4000 });
});
