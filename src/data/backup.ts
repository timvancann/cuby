import { db, type AlgOverrideRow, type AttemptRow, type SessionRow, type SettingRow } from './db';

export interface BackupFile {
  version: 1;
  exportedAt: number;
  sessions: SessionRow[];
  attempts: AttemptRow[];
  algOverrides: AlgOverrideRow[];
  settings: SettingRow[];
}

export async function exportAll(now: number): Promise<BackupFile> {
  return {
    version: 1,
    exportedAt: now,
    sessions: await db.sessions.toArray(),
    attempts: await db.attempts.toArray(),
    algOverrides: await db.algOverrides.toArray(),
    settings: await db.settings.toArray(),
  };
}

export function validateBackup(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'not a backup file';
  const d = data as Record<string, unknown>;
  if (d.version !== 1) return 'unsupported backup version';
  for (const key of ['sessions', 'attempts', 'algOverrides', 'settings']) {
    if (!Array.isArray(d[key])) return `missing table "${key}"`;
  }
  return null;
}

export async function importAll(data: BackupFile): Promise<void> {
  await db.transaction('rw', db.sessions, db.attempts, db.algOverrides, db.settings, async () => {
    await Promise.all(db.tables.map(t => t.clear()));
    await db.sessions.bulkAdd(data.sessions);
    await db.attempts.bulkAdd(data.attempts);
    await db.algOverrides.bulkAdd(data.algOverrides);
    await db.settings.bulkAdd(data.settings);
  });
}

export async function clearHistory(): Promise<void> {
  await db.transaction('rw', db.sessions, db.attempts, async () => {
    await db.sessions.clear();
    await db.attempts.clear();
  });
}
