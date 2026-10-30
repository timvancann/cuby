import { expect, test } from 'vitest';
import { perCaseStats, phaseStats, sessionSummaries, timedResults, type StatAttempt } from './aggregate';

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
  expect(sune.meanSolve).toBe(2000); // DNF and misrec excluded from time stats
  expect(sune.dnfRate).toBeCloseTo(1 / 3);
  expect(sune.misrecRate).toBeCloseTo(1 / 3);
  expect(sune.lastSeen).toBe(300);
  expect(stats.find(s => s.caseId === 'key')!.count).toBe(1);
  expect('meanRecognition' in sune).toBe(false);
});

test('retries are left out of per-case stats entirely', () => {
  const rows = [
    att({ splits: [{ label: 'solve', ms: 3000 }], totalMs: 3000 }),
    att({ startedAt: 200, splits: [{ label: 'solve', ms: 1000 }], totalMs: 1000, retry: true }),
  ];
  const sune = perCaseStats(rows)[0];
  expect(sune.count).toBe(1);
  expect(sune.bestSolve).toBe(3000);
});

test('recentSolve is the mean of the last 5 clean solves', () => {
  const times = [9000, 9000, 1000, 2000, 3000, 4000, 5000];
  const rows = times.map((ms, i) => att({ startedAt: i, splits: [{ label: 'solve', ms }], totalMs: ms }));
  rows.push(att({ startedAt: 99, flag: 'dnf' }));
  expect(perCaseStats(rows)[0].recentSolve).toBe(3000);
});

test('attempts without a solve split (dry practice) use totalMs', () => {
  const rows = [att({ splits: [{ label: 'recognition', ms: 700 }], totalMs: 700 })];
  expect(perCaseStats(rows)[0].meanSolve).toBe(700);
});

test('timedResults drops retries and counts misrecs as DNF', () => {
  const rows = [
    att({ totalMs: 1000 }),
    att({ totalMs: 2000, flag: 'misrecognized' }),
    att({ totalMs: 500, retry: true }),
  ];
  expect(timedResults(rows)).toEqual([{ totalMs: 1000, dnf: false }, { totalMs: 2000, dnf: true }]);
});

test('phaseStats counts a DNF solve as a DNF in the phase ao5, like the overall aoN', () => {
  const cfop = (ms: number, flag: StatAttempt['flag'] = 'ok') =>
    att({ caseId: undefined, flag, splits: [{ label: 'Cross', ms }], totalMs: ms });
  const rows = [cfop(1000), cfop(2000), cfop(3000), cfop(4000, 'dnf'), cfop(5000, 'dnf')];
  const [cross] = phaseStats(rows, ['Cross']);
  expect(cross.ao5).toBe('dnf'); // two DNFs exceed the one-each-side trim
  expect(cross.mean).toBe(2000);
});

test('phaseStats averages each split label over non-DNF attempts', () => {
  const cfop = (ms: number[], flag: StatAttempt['flag'] = 'ok') =>
    att({ caseId: undefined, flag, splits: ['Cross', 'F2L'].map((label, i) => ({ label, ms: ms[i] })), totalMs: ms[0] + ms[1] });
  const rows = [cfop([2000, 8000]), cfop([1000, 6000]), cfop([500, 500], 'dnf')];
  const p = phaseStats(rows, ['Cross', 'F2L']);
  expect(p).toEqual([
    { label: 'Cross', count: 2, mean: 1500, best: 1000, ao5: null, ao12: null },
    { label: 'F2L', count: 2, mean: 7000, best: 6000, ao5: null, ao12: null },
  ]);
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
