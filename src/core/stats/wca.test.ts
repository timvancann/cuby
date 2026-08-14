import { expect, test } from 'vitest';
import { aoN, bestAoN, lifetimeMean } from './wca';

const t = (ms: number) => ({ totalMs: ms, dnf: false });
const DNF = { totalMs: 0, dnf: true };

test('ao5 trims best and worst', () => {
  expect(aoN([t(10), t(20), t(30), t(40), t(1000)], 5)).toBe(30); // drops 10 and 1000
});

test('ao5 uses the LAST five', () => {
  expect(aoN([t(999), t(10), t(20), t(30), t(40), t(50)], 5)).toBe(30);
});

test('one DNF is the dropped worst; two DNFs make the average DNF', () => {
  expect(aoN([t(10), t(20), t(30), t(40), DNF], 5)).toBe(30);
  expect(aoN([t(10), t(20), t(30), DNF, DNF], 5)).toBe('dnf');
});

test('fewer than n gives null', () => {
  expect(aoN([t(10), t(20)], 5)).toBeNull();
});

test('bestAoN finds the best window and skips DNF windows', () => {
  const seq = [t(100), t(100), t(100), t(100), t(100), t(10), t(10), t(10), t(10), t(10)];
  expect(bestAoN(seq, 5)).toBe(10);
  const dnfy = [DNF, DNF, t(10), t(10), t(10), t(20), t(20)];
  // windows: [DNF,DNF,10,10,10] -> 2 DNFs -> dnf, skipped
  // [DNF,10,10,10,20] -> 1 DNF dropped as worst, also drop best(10) -> mean(10,10,20) = 40/3
  // [10,10,10,20,20] -> drop best(10) and worst(20) -> mean(10,10,20) = 40/3
  expect(bestAoN(dnfy, 5)).toBeCloseTo(40 / 3);
});

test('bestAoN all-DNF windows -> dnf; short -> null', () => {
  expect(bestAoN([DNF, DNF, t(1), t(1), t(1)], 5)).toBe('dnf');
  expect(bestAoN([t(1)], 5)).toBeNull();
});

test('lifetimeMean ignores DNFs', () => {
  expect(lifetimeMean([t(10), t(20), DNF])).toBe(15);
  expect(lifetimeMean([DNF])).toBeNull();
});

// ao50: trim = max(1, ceil(50 * 0.05)) = max(1, ceil(2.5)) = 3 from each side.
test('ao50 trims proportionally: 2 DNFs stay numeric, 4 DNFs go dnf', () => {
  // 48 real times (10..480 in steps of 10) + 2 DNFs = 50 results.
  // trim=3, dnfCount=2 <= trim(3), so it's not a DNF average: the 2 DNFs plus the
  // single highest real time (480) fill the 3 worst slots, and the 3 lowest reals
  // (10,20,30) fill the 3 best slots. Kept = reals from 40..470 (44 values).
  const reals = Array.from({ length: 48 }, (_, i) => t((i + 1) * 10));
  const twoDnf = [...reals, DNF, DNF];
  const avgTwo = aoN(twoDnf, 50);
  expect(avgTwo).not.toBe('dnf');
  expect(avgTwo).not.toBeNull();
  const keptTwo = Array.from({ length: 44 }, (_, i) => (i + 4) * 10); // 40..470
  expect(avgTwo).toBeCloseTo(keptTwo.reduce((a, b) => a + b, 0) / keptTwo.length);

  // Same 48 reals but 4 DNFs (50 total, 46 reals). trim is still 3 (ceil(50*0.05)=3).
  // dnfCount=4 > trim(3) -> 'dnf'.
  const fourDnf = [...reals.slice(0, 46), DNF, DNF, DNF, DNF];
  expect(aoN(fourDnf, 50)).toBe('dnf');
});

test('degenerate tiny window (2*trim >= n) is dnf, not NaN', () => {
  expect(aoN([t(10)], 1)).toBe('dnf');
});
