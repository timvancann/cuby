import casesJson from '../../data/cases.json';
import scramblesJson from '../../data/scrambles.json';

export interface CaseInfo {
  id: string; name: string; group: string; primary: string;
  secondary?: string; triggers?: string; notes?: string; easy?: boolean;
  pattern: string; oll: number;
}
export interface GroupInfo { id: string; name: string }

export const groups: GroupInfo[] = casesJson.groups;
export const cases: CaseInfo[] = casesJson.cases as CaseInfo[];
export const caseById = new Map(cases.map(c => [c.id, c]));
export const pools: Record<string, string[]> = scramblesJson.pools;
