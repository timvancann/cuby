import { createTimer, tap, type TimerState } from '../../core/timer/attempt';

export interface TimerFlow { stage: 'idle' | 'running' | 'done'; timer: TimerState; doneAt: number }
export const DONE_DEAD_MS = 300;

export function newTimerAttempt(phases: readonly string[]): TimerFlow {
  return { stage: 'idle', timer: createTimer(phases), doneAt: 0 };
}

export function tapTimer(s: TimerFlow, now: number): TimerFlow | 'next' {
  if (s.stage === 'idle') return { ...s, stage: 'running', timer: tap(s.timer, now) };
  if (s.stage === 'running') {
    const timer = tap(s.timer, now);
    return timer.status === 'done' ? { stage: 'done', timer, doneAt: now } : { ...s, timer };
  }
  return now - s.doneAt >= DONE_DEAD_MS ? 'next' : s;
}

export function abortTimer(_s: TimerFlow, phases: readonly string[]): TimerFlow {
  return newTimerAttempt(phases);
}
