import { db, type Mode } from './db';

const IDLE_MS = 30 * 60 * 1000;

let active: { id: number; mode: Mode; config: string; lastActivityAt: number } | null = null;

export async function sessionForAttempt(mode: Mode, config: string[], now: number): Promise<number> {
  const key = JSON.stringify(config);
  if (active && active.mode === mode && active.config === key && now - active.lastActivityAt < IDLE_MS) {
    active.lastActivityAt = now;
    return active.id;
  }
  if (active) await db.sessions.update(active.id, { endedAt: now });
  const id = (await db.sessions.add({ mode, startedAt: now, configSnapshot: [...config] })) as number;
  active = { id, mode, config: key, lastActivityAt: now };
  return id;
}

export async function endActiveSession(now: number): Promise<void> {
  if (!active) return;
  await db.sessions.update(active.id, { endedAt: now });
  active = null;
}

export function _resetSessionsForTests(): void {
  active = null;
}
