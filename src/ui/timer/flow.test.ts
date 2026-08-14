import { expect, test } from 'vitest';
import { DONE_DEAD_MS, abortTimer, newTimerAttempt, tapTimer } from './flow';
import { splits, totalMs } from '../../core/timer/attempt';

test('full-solve: two taps, then done with one split', () => {
  let s = newTimerAttempt(['solve']);
  expect(s.stage).toBe('idle');
  s = tapTimer(s, 100) as typeof s;
  expect(s.stage).toBe('running');
  s = tapTimer(s, 9100) as typeof s;
  expect(s.stage).toBe('done');
  expect(totalMs(s.timer)).toBe(9000);
  expect(splits(s.timer)).toEqual([{ label: 'solve', ms: 9000 }]);
});

test('cfop: intermediate taps mark phase boundaries', () => {
  const phases = ['Cross', 'F2L', 'OLL', 'PLL'];
  let s = newTimerAttempt(phases);
  s = tapTimer(s, 0) as typeof s;
  s = tapTimer(s, 2000) as typeof s;
  s = tapTimer(s, 8000) as typeof s;
  expect(s.stage).toBe('running');
  s = tapTimer(s, 10000) as typeof s;
  s = tapTimer(s, 11500) as typeof s;
  expect(s.stage).toBe('done');
  expect(splits(s.timer).map(x => x.ms)).toEqual([2000, 6000, 2000, 1500]);
});

test('done ignores taps inside dead-time, returns next after it', () => {
  let s = newTimerAttempt(['solve']);
  s = tapTimer(s, 0) as typeof s;
  s = tapTimer(s, 5000) as typeof s;
  expect(tapTimer(s, 5000 + DONE_DEAD_MS - 1)).toBe(s);
  expect(tapTimer(s, 5000 + DONE_DEAD_MS)).toBe('next');
});

test('abort resets to idle with a fresh timer', () => {
  let s = newTimerAttempt(['solve']);
  s = tapTimer(s, 0) as typeof s;
  const aborted = abortTimer(s, ['solve']);
  expect(aborted.stage).toBe('idle');
  expect(aborted.timer.status).toBe('idle');
});
