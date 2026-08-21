import { expect, test } from 'vitest';
import { newAttempt, retryAttempt, tapZone, REVEAL_DEAD_MS } from './flow';
import { mulberry32 } from '../../core/rng';
import { splits, totalMs } from '../../core/timer/attempt';
import { pools } from '../../data/caseSet';

const selected = ['sune', 'anti-sune', 'h'];

test('full attempt: scrambled -> solving -> reveal with a single solve split', () => {
  const rand = mulberry32(1);
  let s = newAttempt(null, selected, rand);
  expect(s.stage).toBe('scrambled');
  expect(pools[s.pick.caseId]).toContain(s.pick.variant);
  s = tapZone(s, selected, rand, 1000);
  expect(s.stage).toBe('solving');
  s = tapZone(s, selected, rand, 4600);
  expect(s.stage).toBe('reveal');
  expect(splits(s.timer)).toEqual([{ label: 'solve', ms: 3600 }]);
  expect(totalMs(s.timer)).toBe(3600);
});

test('reveal ignores taps inside the dead-time, advances after it', () => {
  const rand = mulberry32(2);
  let s = newAttempt(null, selected, rand);
  s = tapZone(s, selected, rand, 0);
  s = tapZone(s, selected, rand, 1000); // reveal, revealAt=1000
  const inside = tapZone(s, selected, rand, 1000 + REVEAL_DEAD_MS - 1);
  expect(inside).toBe(s);
  const after = tapZone(s, selected, rand, 1000 + REVEAL_DEAD_MS);
  expect(after.stage).toBe('scrambled');
  expect(after.lastCaseId).not.toBe(s.pick.caseId);
});

test('retryAttempt re-arms the same scramble with a fresh timer', () => {
  const rand = mulberry32(9);
  let s = newAttempt(null, selected, rand);
  const pick = s.pick;
  s = tapZone(s, selected, rand, 0);
  s = tapZone(s, selected, rand, 1000); // reveal
  const retried = retryAttempt(s);
  expect(retried.stage).toBe('scrambled');
  expect(retried.pick).toBe(pick); // identical scramble and case
  expect(retried.timer.status).toBe('idle');
});

test('consecutive attempts never repeat the case (3 selected)', () => {
  const rand = mulberry32(3);
  let s = newAttempt(null, selected, rand);
  for (let i = 0; i < 30; i++) {
    const prevCase = s.pick.caseId;
    s = newAttempt(s, selected, rand);
    expect(s.pick.caseId).not.toBe(prevCase);
  }
});
