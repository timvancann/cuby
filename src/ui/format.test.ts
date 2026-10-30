import { expect, test } from 'vitest';
import { fmtMs, fmtTime, plural } from './format';

test('fmtMs shows seconds below a minute and m:ss above, truncated to centiseconds', () => {
  expect(fmtMs(9849)).toBe('9.84');
  expect(fmtMs(75230)).toBe('1:15.23');
  expect(fmtMs(60000)).toBe('1:00.00');
  expect(fmtMs(0)).toBe('0.00');
});

test('fmtTime handles DNF and missing values', () => {
  expect(fmtTime('dnf')).toBe('DNF');
  expect(fmtTime(null)).toBe('-');
});

test('plural', () => {
  expect(plural(1, 'attempt')).toBe('1 attempt');
  expect(plural(3, 'attempt')).toBe('3 attempts');
});
