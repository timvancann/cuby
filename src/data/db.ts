import Dexie, { type EntityTable } from 'dexie';
import type { Split } from '../core/timer/attempt';

export type Mode = 'case' | 'full' | 'cfop';
export type Flag = 'ok' | 'misrecognized' | 'dnf';

export interface SessionRow { id?: number; mode: Mode; startedAt: number; endedAt?: number; configSnapshot: string[] }
export interface AttemptRow {
  id?: number; sessionId: number; mode: Mode; caseId?: string; scramble?: string;
  startedAt: number; splits: Split[]; totalMs: number; flag: Flag;
}
export interface AlgOverrideRow { caseId: string; moves: string; updatedAt: number }
export interface SettingRow { key: string; value: unknown }

export const db = new Dexie('cuby') as Dexie & {
  sessions: EntityTable<SessionRow, 'id'>;
  attempts: EntityTable<AttemptRow, 'id'>;
  algOverrides: EntityTable<AlgOverrideRow, 'caseId'>;
  settings: EntityTable<SettingRow, 'key'>;
};

db.version(1).stores({
  sessions: '++id, mode, startedAt',
  attempts: '++id, sessionId, mode, caseId, startedAt',
  algOverrides: 'caseId',
  settings: 'key',
});
