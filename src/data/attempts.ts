import { db, type Flag, type Mode } from './db';
import { sessionForAttempt } from './sessions';
import { splits, totalMs, type TimerState } from '../core/timer/attempt';

// Builds a plain object at the persistence boundary: splits() returns fresh
// objects and all other fields are primitives, so $state-proxied timer states
// never reach IndexedDB (Proxy objects fail structured clone).
export async function recordAttempt(opts: {
  mode: Mode;
  config: string[];
  now: number;
  timer: TimerState;
  caseId?: string;
  scramble?: string;
}): Promise<number> {
  const sessionId = await sessionForAttempt(opts.mode, opts.config, opts.now);
  return (await db.attempts.add({
    sessionId,
    mode: opts.mode,
    caseId: opts.caseId,
    scramble: opts.scramble,
    startedAt: opts.timer.startedAt,
    splits: splits(opts.timer),
    totalMs: totalMs(opts.timer),
    flag: 'ok',
  })) as number;
}

export function setAttemptFlag(id: number, flag: Flag): Promise<void> {
  return db.attempts.update(id, { flag }).then(() => undefined);
}
