import type { Flag } from '../data/db';
import { IDLE_MS } from '../data/sessions';
import type { FlowState } from './train/flow';
import type { TimerFlow } from './timer/flow';
import type { AttemptPick } from '../core/train/select';

// Drill state lives at module level so a tab switch (which unmounts the
// screen) doesn't lose the dealt case, the reveal or the session count. A solve
// that is being timed is the exception: leaving it discards it, see the screens.

export const train = $state({
  flow: null as FlowState | null,
  selectionKey: '',
  retry: false, // the dealt attempt reuses the previous scramble
  attemptId: null as number | null,
  flag: 'ok' as Flag,
  revealAlg: '',
  count: { n: 0, lastAt: 0 },
});

export const timer = $state({
  mode: 'full' as 'full' | 'cfop',
  flow: null as TimerFlow | null,
  scramble: null as string | null,
  upcoming: null as string | null,
  attemptId: null as number | null,
  flag: 'ok' as Flag,
  count: { n: 0, lastAt: 0 },
});

export const dry = $state({
  pick: null as AttemptPick | null,
  selectionKey: '',
  stage: 'show' as 'show' | 'reveal',
  shownAt: 0, // 0 until the case is on screen; recognition is timed from here
  elapsedMs: 0,
  revealAt: 0,
  revealAlg: '',
  flag: 'ok' as Flag,
  attemptId: null as number | null,
  lastCaseId: undefined as string | undefined,
  lastVariantByCase: {} as Record<string, string>,
  count: { n: 0, lastAt: 0 },
});

// "N this session": restarts when the session itself would (30 min idle).
// Retries don't count, matching stats.
export function bumpCount(c: { n: number; lastAt: number }, now: number): void {
  c.n = sessionCount(c, now) + 1;
  c.lastAt = now;
}

export function sessionCount(c: { n: number; lastAt: number }, now: number): number {
  return now - c.lastAt >= IDLE_MS ? 0 : c.n;
}

// After a history clear or import the rows behind these are gone: forget the
// session counts and the attempt ids the flag buttons would write to.
export function resetDrillHistory(): void {
  for (const s of [train, timer, dry]) {
    s.count = { n: 0, lastAt: 0 };
    s.attemptId = null;
  }
}

// While a solve is timed the tab bar hides, so a resting thumb can't leave mid-solve.
export function solveInProgress(): boolean {
  return train.flow?.stage === 'solving' || timer.flow?.stage === 'running';
}
