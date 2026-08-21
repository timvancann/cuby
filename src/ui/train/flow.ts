import { createTimer, tap, type TimerState } from '../../core/timer/attempt';
import { pickAttempt, type AttemptPick } from '../../core/train/select';
import { pools } from '../../data/caseSet';

export type Stage = 'scrambled' | 'solving' | 'reveal';
export const REVEAL_DEAD_MS = 300;
export const PHASES = ['solve'] as const;

export interface FlowState {
  stage: Stage;
  pick: AttemptPick;
  timer: TimerState;
  revealAt: number;
  lastCaseId?: string;
  lastVariantByCase: Record<string, string>;
}

export function newAttempt(
  prev: Pick<FlowState, 'lastCaseId' | 'lastVariantByCase'> | null,
  selected: string[],
  rand: () => number,
): FlowState {
  const lastVariantByCase = prev?.lastVariantByCase ?? {};
  const pick = pickAttempt({ selected, pools, lastCaseId: prev?.lastCaseId, lastVariantByCase, rand });
  return {
    stage: 'scrambled',
    pick,
    timer: createTimer(PHASES),
    revealAt: 0,
    lastCaseId: pick.caseId,
    lastVariantByCase: { ...lastVariantByCase, [pick.caseId]: pick.variant },
  };
}

// Re-arm the same pick as a fresh attempt (scramble unchanged, timer reset) —
// for retrying a misrecognized or DNF'd case with the identical setup.
export function retryAttempt(s: FlowState): FlowState {
  return { ...s, stage: 'scrambled', timer: createTimer(PHASES), revealAt: 0 };
}

export function tapZone(s: FlowState, selected: string[], rand: () => number, now: number): FlowState {
  if (s.stage === 'scrambled') return { ...s, stage: 'solving', timer: tap(s.timer, now) };
  if (s.stage === 'solving') return { ...s, stage: 'reveal', timer: tap(s.timer, now), revealAt: now };
  if (now - s.revealAt < REVEAL_DEAD_MS) return s;
  return newAttempt(s, selected, rand);
}
