import { aoN, type TimedResult } from './wca';

export interface StatAttempt {
  sessionId: number;
  caseId?: string;
  startedAt: number;
  splits: { label: string; ms: number }[];
  totalMs: number;
  flag: 'ok' | 'misrecognized' | 'dnf';
  retry?: boolean; // a re-run of the previous scramble: the case was already known
}

export interface CaseStats {
  caseId: string;
  count: number;
  bestSolve: number | null;
  meanSolve: number | null;
  recentSolve: number | null; // mean of the last RECENT_N clean solves
  dnfRate: number;
  misrecRate: number;
  lastSeen: number;
}

export const RECENT_N = 5;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
const splitMs = (a: StatAttempt, label: string) => a.splits.find(s => s.label === label)?.ms;
// Case attempts time the solve split; dry practice only has a recognition time.
const caseMs = (a: StatAttempt) => splitMs(a, 'solve') ?? a.totalMs;

// Retries never count: the scramble (and so the case) was already known.
const counted = (attempts: StatAttempt[]) => attempts.filter(a => !a.retry);

// For averages a misrecognized attempt timed a different alg, so it is a DNF.
export function timedResults(attempts: StatAttempt[]): TimedResult[] {
  return counted(attempts).map(a => ({ totalMs: a.totalMs, dnf: a.flag !== 'ok' }));
}

export function perCaseStats(attempts: StatAttempt[]): CaseStats[] {
  const byCase = new Map<string, StatAttempt[]>();
  for (const a of counted(attempts)) {
    if (!a.caseId) continue;
    const list = byCase.get(a.caseId) ?? [];
    list.push(a);
    byCase.set(a.caseId, list);
  }
  return [...byCase.entries()].map(([caseId, list]) => {
    const clean = list.filter(a => a.flag === 'ok').sort((a, b) => a.startedAt - b.startedAt);
    const solves = clean.map(caseMs);
    return {
      caseId,
      count: list.length,
      bestSolve: min(solves),
      meanSolve: mean(solves),
      recentSolve: mean(solves.slice(-RECENT_N)),
      dnfRate: list.filter(a => a.flag === 'dnf').length / list.length,
      misrecRate: list.filter(a => a.flag === 'misrecognized').length / list.length,
      lastSeen: Math.max(...list.map(a => a.startedAt)),
    };
  });
}

export interface PhaseStats {
  label: string;
  count: number;
  mean: number | null;
  best: number | null;
  ao5: number | 'dnf' | null;
  ao12: number | 'dnf' | null;
}

export function phaseStats(attempts: StatAttempt[], labels: readonly string[]): PhaseStats[] {
  const sorted = [...counted(attempts)].sort((a, b) => a.startedAt - b.startedAt);
  return labels.map(label => {
    // Every solve that reached this phase is in the window; a DNF solve is a DNF here
    // too, so phase averages cover the same solves as the overall aoN.
    const results = sorted
      .map(a => ({ ms: splitMs(a, label), dnf: a.flag === 'dnf' }))
      .filter((r): r is { ms: number; dnf: boolean } => r.ms !== undefined)
      .map(r => ({ totalMs: r.ms, dnf: r.dnf }));
    const times = results.filter(r => !r.dnf).map(r => r.totalMs);
    return {
      label,
      count: times.length,
      mean: mean(times),
      best: min(times),
      ao5: aoN(results, 5),
      ao12: aoN(results, 12),
    };
  });
}

export interface SessionSummary { sessionId: number; startedAt: number; count: number; meanTotalMs: number | null }

export function sessionSummaries(attempts: StatAttempt[]): SessionSummary[] {
  const bySession = new Map<number, StatAttempt[]>();
  for (const a of counted(attempts)) {
    const list = bySession.get(a.sessionId) ?? [];
    list.push(a);
    bySession.set(a.sessionId, list);
  }
  return [...bySession.entries()]
    .map(([sessionId, list]) => ({
      sessionId,
      startedAt: Math.min(...list.map(a => a.startedAt)),
      count: list.length,
      meanTotalMs: mean(list.filter(a => a.flag === 'ok').map(a => a.totalMs)),
    }))
    .sort((a, b) => a.startedAt - b.startedAt);
}
