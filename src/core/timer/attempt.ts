export interface Split { label: string; ms: number }

export interface TimerState {
  phases: readonly string[];
  status: 'idle' | 'running' | 'done';
  startedAt: number;
  boundaries: number[];
}

export function createTimer(phases: readonly string[]): TimerState {
  if (phases.length === 0) throw new Error('timer needs at least one phase');
  return { phases, status: 'idle', startedAt: 0, boundaries: [] };
}

export function tap(s: TimerState, t: number): TimerState {
  if (s.status === 'idle') return { ...s, status: 'running', startedAt: t };
  if (s.status === 'running') {
    const boundaries = [...s.boundaries, t];
    const status = boundaries.length === s.phases.length ? 'done' : 'running';
    return { ...s, boundaries, status };
  }
  return s;
}

export function phaseIndex(s: TimerState): number {
  return s.boundaries.length;
}

export function splits(s: TimerState): Split[] {
  return s.boundaries.map((t, i) => ({
    label: s.phases[i],
    ms: t - (i === 0 ? s.startedAt : s.boundaries[i - 1]),
  }));
}

export function totalMs(s: TimerState): number {
  return s.status === 'done' ? s.boundaries[s.boundaries.length - 1] - s.startedAt : 0;
}
