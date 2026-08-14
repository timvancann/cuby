import { expect, test } from 'vitest';
import { createTimer, tap, phaseIndex, splits, totalMs } from './attempt';

test('case-training flow: three taps produce recognition and solve splits', () => {
  let s = createTimer(['recognition', 'solve']);
  expect(s.status).toBe('idle');
  s = tap(s, 1000);
  expect(s.status).toBe('running');
  expect(phaseIndex(s)).toBe(0);
  s = tap(s, 1800);
  expect(phaseIndex(s)).toBe(1);
  s = tap(s, 4300);
  expect(s.status).toBe('done');
  expect(splits(s)).toEqual([
    { label: 'recognition', ms: 800 },
    { label: 'solve', ms: 2500 },
  ]);
  expect(totalMs(s)).toBe(3300);
});

test('single-phase timer: two taps start and stop', () => {
  let s = createTimer(['solve']);
  s = tap(s, 10);
  s = tap(s, 9010);
  expect(s.status).toBe('done');
  expect(splits(s)).toEqual([{ label: 'solve', ms: 9000 }]);
});

test('taps on done are no-ops; totalMs is 0 before done', () => {
  let s = createTimer(['solve']);
  expect(totalMs(s)).toBe(0);
  s = tap(s, 1);
  expect(totalMs(s)).toBe(0);
  s = tap(s, 2);
  const done = s;
  expect(tap(done, 99)).toEqual(done);
});

test('tap does not mutate its input', () => {
  const s0 = createTimer(['a', 'b']);
  const s1 = tap(s0, 5);
  expect(s0.status).toBe('idle');
  expect(s1.status).toBe('running');
});

test('empty phase list throws', () => {
  expect(() => createTimer([])).toThrow();
});
