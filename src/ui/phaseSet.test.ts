import { expect, test } from 'vitest';
import { parsePhaseLabels } from './phaseSet';

test('splits on comma, arrow, and gt with trimming', () => {
  expect(parsePhaseLabels('Cross, F2L → OLL > PLL')).toEqual({ labels: ['Cross', 'F2L', 'OLL', 'PLL'] });
  expect(parsePhaseLabels('Cross,,F2L1, F2L2 ,')).toEqual({ labels: ['Cross', 'F2L1', 'F2L2'] });
});

test('rejects empty, too many, too long', () => {
  expect(parsePhaseLabels('  ,, ')).toEqual({ error: 'need at least one phase' });
  expect(parsePhaseLabels(Array(13).fill('p').join(','))).toEqual({ error: 'at most 12 phases' });
  expect(parsePhaseLabels('a-very-long-phase-name')).toEqual({ error: 'phase names max 16 characters' });
});
