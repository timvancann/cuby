import { expect, test } from 'vitest';
import { normalizeRoute } from './router.svelte';

test('normalizeRoute maps hashes to known routes with /train fallback', () => {
  expect(normalizeRoute('#/cases')).toBe('/cases');
  expect(normalizeRoute('#/settings')).toBe('/settings');
  expect(normalizeRoute('')).toBe('/train');
  expect(normalizeRoute('#/bogus')).toBe('/train');
  expect(normalizeRoute('#/train')).toBe('/train');
});
