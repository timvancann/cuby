export interface StatAttempt {
  sessionId: number;
  caseId?: string;
  startedAt: number;
  splits: { label: string; ms: number }[];
  totalMs: number;
  flag: 'ok' | 'misrecognized' | 'dnf';
}

export interface CaseStats {
  caseId: string;
  count: number;
  bestRecognition: number | null;
  meanRecognition: number | null;
  bestSolve: number | null;
  meanSolve: number | null;
  dnfRate: number;
  misrecRate: number;
  lastSeen: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const min = (xs: number[]) => (xs.length ? Math.min(...xs) : null);
const splitMs = (a: StatAttempt, label: string) => a.splits.find(s => s.label === label)?.ms;

export function perCaseStats(attempts: StatAttempt[]): CaseStats[] {
  const byCase = new Map<string, StatAttempt[]>();
  for (const a of attempts) {
    if (!a.caseId) continue;
    const list = byCase.get(a.caseId) ?? [];
    list.push(a);
    byCase.set(a.caseId, list);
  }
  return [...byCase.entries()].map(([caseId, list]) => {
    const timed = list.filter(a => a.flag !== 'dnf');
    const recogs = timed.map(a => splitMs(a, 'recognition')).filter((x): x is number => x !== undefined);
    const solves = timed.map(a => splitMs(a, 'solve')).filter((x): x is number => x !== undefined);
    return {
      caseId,
      count: list.length,
      bestRecognition: min(recogs),
      meanRecognition: mean(recogs),
      bestSolve: min(solves),
      meanSolve: mean(solves),
      dnfRate: list.filter(a => a.flag === 'dnf').length / list.length,
      misrecRate: list.filter(a => a.flag === 'misrecognized').length / list.length,
      lastSeen: Math.max(...list.map(a => a.startedAt)),
    };
  });
}

export interface SessionSummary { sessionId: number; startedAt: number; count: number; meanTotalMs: number | null }

export function sessionSummaries(attempts: StatAttempt[]): SessionSummary[] {
  const bySession = new Map<number, StatAttempt[]>();
  for (const a of attempts) {
    const list = bySession.get(a.sessionId) ?? [];
    list.push(a);
    bySession.set(a.sessionId, list);
  }
  return [...bySession.entries()]
    .map(([sessionId, list]) => ({
      sessionId,
      startedAt: Math.min(...list.map(a => a.startedAt)),
      count: list.length,
      meanTotalMs: mean(list.filter(a => a.flag !== 'dnf').map(a => a.totalMs)),
    }))
    .sort((a, b) => a.startedAt - b.startedAt);
}
