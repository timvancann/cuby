import { db } from './db';
import { caseById } from './caseSet';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export function getCaseSelection(): Promise<string[]> {
  return getSetting<string[]>('caseSelection', []);
}

export function setCaseSelection(ids: string[]): Promise<void> {
  return setSetting('caseSelection', ids);
}

export async function activeAlg(caseId: string): Promise<string> {
  const override = await db.algOverrides.get(caseId);
  if (override) return override.moves;
  const c = caseById.get(caseId);
  if (!c) throw new Error(`unknown case "${caseId}"`);
  return c.primary;
}
