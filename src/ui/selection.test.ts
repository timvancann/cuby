import { expect, test } from 'vitest';
import { toggleCase, toggleGroup } from './selection';

test('toggleCase adds and removes', () => {
  expect(toggleCase([], 'sune')).toEqual(['sune']);
  expect(toggleCase(['sune', 'key'], 'sune')).toEqual(['key']);
});

test('toggleGroup selects missing members, deselects when complete', () => {
  const group = ['a', 'b', 'c'];
  expect(toggleGroup(['b', 'x'], group)).toEqual(['b', 'x', 'a', 'c']);
  expect(toggleGroup(['b', 'x', 'a', 'c'], group)).toEqual(['x']);
});

test('no duplicates ever', () => {
  const out = toggleGroup(['a'], ['a', 'b']);
  expect(new Set(out).size).toBe(out.length);
});
