# Stats & Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Stats tab shows WCA averages, sortable per-case stats, session history, and the two v1 charts; Settings gains export, import, and clear-history (the "erase" the user asked for).

**Architecture:** `core/stats` is pure functions over attempt-shaped data (structural types — core never imports from `data/`, preserving §6.3 direction). The screen queries Dexie via the existing indexes and renders tables plus two hand-drawn SVG charts (no chart library). Backup lives in `data/backup.ts`: versioned full-export JSON, full-replace import, and a clear that deletes history only (overrides + settings survive, §5.2).

**Tech Stack:** no new dependencies.

**Spec:** `cube-trainer-spec.md` §5.2 (backup & clearing), §5.3 (stats). Constraints inherited from earlier reviews: stats must tolerate sessions with `endedAt` undefined; global averages use `totalMs` only (phase-set drift across CFOP sessions is irrelevant to them); dry practice records nothing and needs no handling.

## Global Constraints

- All prior global constraints (TS strict, browser-clean src, plain objects at persistence boundaries, work directly on main, commit per green task).
- WCA trimming rules exactly (§5.3): aoN over the last N attempts drops the single best and single worst and means the rest; a DNF counts as the worst; two or more DNFs make the average DNF; fewer than N attempts → no average.
- `core/stats` imports nothing from `src/data` or `src/ui`; it defines its own structural types compatible with `AttemptRow`.
- Clear history deletes sessions + attempts ONLY — never algOverrides or settings (§5.2). Double confirmation with an export shortcut in the dialog. No single-attempt deletion anywhere.
- Import is full replace of all four tables after explicit confirmation; a malformed file must be rejected with a message before anything is touched (§5.2).
- Charts are inline SVG in app tokens; wide content scrolls in its own container.

---

### Task 1: `core/stats` — WCA averages and aggregations

**Files:**
- Create: `src/core/stats/wca.ts`, `src/core/stats/aggregate.ts`
- Test: `src/core/stats/wca.test.ts`, `src/core/stats/aggregate.test.ts`

**Interfaces:**
- Consumes: nothing (structural types only).
- Produces (`wca.ts`):
  - `interface TimedResult { totalMs: number; dnf: boolean }`
  - `aoN(results: TimedResult[], n: number): number | 'dnf' | null` — average of the LAST n entries (null when `results.length < n`). Trims one best + one worst; DNFs sort as worst; ≥2 DNFs in the window → `'dnf'`. With one DNF in the window, the DNF is the dropped worst.
  - `bestAoN(results: TimedResult[], n: number): number | 'dnf' | null` — best over every contiguous window of n; DNF windows are skipped unless every window is DNF (then `'dnf'`); null when fewer than n results.
  - `lifetimeMean(results: TimedResult[]): number | null` — mean of non-DNF results, null when none.
- Produces (`aggregate.ts`):
  - `interface StatAttempt { sessionId: number; caseId?: string; startedAt: number; splits: { label: string; ms: number }[]; totalMs: number; flag: 'ok' | 'misrecognized' | 'dnf' }` — structurally satisfied by `AttemptRow`.
  - `interface CaseStats { caseId: string; count: number; bestRecognition: number | null; meanRecognition: number | null; bestSolve: number | null; meanSolve: number | null; dnfRate: number; misrecRate: number; lastSeen: number }`
  - `perCaseStats(attempts: StatAttempt[]): CaseStats[]` — case-training attempts grouped by caseId. Time stats (best/mean recognition and solve, from the `recognition`/`solve` splits) use non-DNF attempts only; `dnfRate`/`misrecRate` are fractions of ALL that case's attempts; `lastSeen` = max startedAt.
  - `interface SessionSummary { sessionId: number; startedAt: number; count: number; meanTotalMs: number | null }`
  - `sessionSummaries(attempts: StatAttempt[]): SessionSummary[]` — grouped by sessionId, ordered by startedAt ascending; `meanTotalMs` over non-DNF attempts (null if all DNF); `startedAt` = the session's first attempt's startedAt (works for open sessions — no dependence on endedAt).

- [ ] **Step 1: Write the failing tests**

`src/core/stats/wca.test.ts`:

```ts
import { expect, test } from 'vitest';
import { aoN, bestAoN, lifetimeMean } from './wca';

const t = (ms: number) => ({ totalMs: ms, dnf: false });
const DNF = { totalMs: 0, dnf: true };

test('ao5 trims best and worst', () => {
  expect(aoN([t(10), t(20), t(30), t(40), t(1000)], 5)).toBe(30); // drops 10 and 1000
});

test('ao5 uses the LAST five', () => {
  expect(aoN([t(999), t(10), t(20), t(30), t(40), t(50)], 5)).toBe(30);
});

test('one DNF is the dropped worst; two DNFs make the average DNF', () => {
  expect(aoN([t(10), t(20), t(30), t(40), DNF], 5)).toBe(30);
  expect(aoN([t(10), t(20), t(30), DNF, DNF], 5)).toBe('dnf');
});

test('fewer than n gives null', () => {
  expect(aoN([t(10), t(20)], 5)).toBeNull();
});

test('bestAoN finds the best window and skips DNF windows', () => {
  const seq = [t(100), t(100), t(100), t(100), t(100), t(10), t(10), t(10), t(10), t(10)];
  expect(bestAoN(seq, 5)).toBe(10);
  const dnfy = [DNF, DNF, t(10), t(10), t(10), t(20), t(20)];
  expect(bestAoN(dnfy, 5)).toBe(20); // first windows are DNF, last window [10,10,20,20 +10] -> trims -> mean of middle
});

test('bestAoN all-DNF windows -> dnf; short -> null', () => {
  expect(bestAoN([DNF, DNF, t(1), t(1), t(1)], 5)).toBe('dnf');
  expect(bestAoN([t(1)], 5)).toBeNull();
});

test('lifetimeMean ignores DNFs', () => {
  expect(lifetimeMean([t(10), t(20), DNF])).toBe(15);
  expect(lifetimeMean([DNF])).toBeNull();
});
```

(Note on the second `bestAoN` expectation: windows are `[DNF,DNF,10,10,10]` → dnf, `[DNF,10,10,10,20]` → one DNF dropped as worst → mean(10,10,10)=10 … work the arithmetic when implementing; the asserted values here are: `bestAoN(dnfy,5)` — windows: idx0 dnf, idx1 has one DNF → trims DNF and best(10) → mean(10,10,20)=13.33; idx2 `[10,10,10,20,20]` → mean(10,20,20)? No — trims one best (10) and one worst (20) → mean(10,10,20)=13.33. Correct the expected value to `40/3` in the test: `expect(bestAoN(dnfy, 5)).toBeCloseTo(40 / 3)`. Use `toBeCloseTo` for non-integer means throughout.)

`src/core/stats/aggregate.test.ts`:

```ts
import { expect, test } from 'vitest';
import { perCaseStats, sessionSummaries, type StatAttempt } from './aggregate';

const att = (over: Partial<StatAttempt>): StatAttempt => ({
  sessionId: 1, caseId: 'sune', startedAt: 100,
  splits: [{ label: 'recognition', ms: 800 }, { label: 'solve', ms: 2000 }],
  totalMs: 2800, flag: 'ok', ...over,
});

test('perCaseStats aggregates times, rates, lastSeen', () => {
  const rows = [
    att({}),
    att({ startedAt: 200, splits: [{ label: 'recognition', ms: 400 }, { label: 'solve', ms: 3000 }], totalMs: 3400, flag: 'misrecognized' }),
    att({ startedAt: 300, flag: 'dnf' }),
    att({ caseId: 'key', startedAt: 50, splits: [{ label: 'recognition', ms: 500 }, { label: 'solve', ms: 1500 }], totalMs: 2000 }),
  ];
  const stats = perCaseStats(rows);
  const sune = stats.find(s => s.caseId === 'sune')!;
  expect(sune.count).toBe(3);
  expect(sune.bestRecognition).toBe(400);
  expect(sune.meanRecognition).toBe(600); // (800+400)/2 — DNF excluded from time stats
  expect(sune.bestSolve).toBe(2000);
  expect(sune.dnfRate).toBeCloseTo(1 / 3);
  expect(sune.misrecRate).toBeCloseTo(1 / 3);
  expect(sune.lastSeen).toBe(300);
  expect(stats.find(s => s.caseId === 'key')!.count).toBe(1);
});

test('sessionSummaries groups and orders by first attempt', () => {
  const rows = [
    att({ sessionId: 2, startedAt: 500, totalMs: 4000 }),
    att({ sessionId: 1, startedAt: 100, totalMs: 2000 }),
    att({ sessionId: 1, startedAt: 200, totalMs: 3000 }),
    att({ sessionId: 2, startedAt: 600, flag: 'dnf' }),
  ];
  const s = sessionSummaries(rows);
  expect(s.map(x => x.sessionId)).toEqual([1, 2]);
  expect(s[0]).toMatchObject({ count: 2, meanTotalMs: 2500, startedAt: 100 });
  expect(s[1]).toMatchObject({ count: 2, meanTotalMs: 4000 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/stats` → FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/stats/wca.ts`:

```ts
export interface TimedResult { totalMs: number; dnf: boolean }

function windowAverage(win: TimedResult[]): number | 'dnf' {
  const dnfs = win.filter(r => r.dnf).length;
  if (dnfs >= 2) return 'dnf';
  const sorted = [...win].sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1; // DNF sorts as worst
    return a.totalMs - b.totalMs;
  });
  const kept = sorted.slice(1, -1);
  return kept.reduce((sum, r) => sum + r.totalMs, 0) / kept.length;
}

export function aoN(results: TimedResult[], n: number): number | 'dnf' | null {
  if (results.length < n) return null;
  return windowAverage(results.slice(-n));
}

export function bestAoN(results: TimedResult[], n: number): number | 'dnf' | null {
  if (results.length < n) return null;
  let best: number | 'dnf' = 'dnf';
  for (let i = 0; i + n <= results.length; i++) {
    const avg = windowAverage(results.slice(i, i + n));
    if (avg === 'dnf') continue;
    if (best === 'dnf' || avg < best) best = avg;
  }
  return best;
}

export function lifetimeMean(results: TimedResult[]): number | null {
  const ok = results.filter(r => !r.dnf);
  if (ok.length === 0) return null;
  return ok.reduce((sum, r) => sum + r.totalMs, 0) / ok.length;
}
```

`src/core/stats/aggregate.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/stats` → all PASS (fix the `bestAoN` expected value per the note in Step 1 — verify the arithmetic by hand, not by copying the implementation's output).

- [ ] **Step 5: Commit**

```bash
git add src/core/stats
git commit -m "feat(core): WCA averages and per-case/session aggregation"
```

---

### Task 2: `data/backup.ts` — export, import, clear history

**Files:**
- Create: `src/data/backup.ts`
- Test: `src/data/backup.test.ts`

**Interfaces:**
- Consumes: `db`.
- Produces:
  - `interface BackupFile { version: 1; exportedAt: number; sessions: SessionRow[]; attempts: AttemptRow[]; algOverrides: AlgOverrideRow[]; settings: SettingRow[] }`
  - `exportAll(now: number): Promise<BackupFile>`
  - `validateBackup(data: unknown): string | null` — null when the object has `version === 1` and all four arrays; otherwise a human message. Runs BEFORE any write.
  - `importAll(data: BackupFile): Promise<void>` — full replace: clears all four tables, bulk-inserts the file's rows, in one Dexie transaction.
  - `clearHistory(): Promise<void>` — clears sessions + attempts only, one transaction.

- [ ] **Step 1: Write the failing tests**

`src/data/backup.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { clearHistory, exportAll, importAll, validateBackup } from './backup';
import { _resetSessionsForTests } from './sessions';

beforeEach(async () => {
  _resetSessionsForTests();
  await Promise.all(db.tables.map(t => t.clear()));
  await db.sessions.add({ mode: 'case', startedAt: 1, configSnapshot: ['sune'] });
  await db.attempts.add({ sessionId: 1, mode: 'case', caseId: 'sune', startedAt: 2, splits: [], totalMs: 5, flag: 'ok' });
  await db.algOverrides.put({ caseId: 'sune', moves: 'R U R2', updatedAt: 3 });
  await db.settings.put({ key: 'vibration', value: false });
});

test('export contains all four tables', async () => {
  const f = await exportAll(99);
  expect(f.version).toBe(1);
  expect(f.exportedAt).toBe(99);
  expect(f.sessions).toHaveLength(1);
  expect(f.attempts).toHaveLength(1);
  expect(f.algOverrides).toHaveLength(1);
  expect(f.settings.length).toBeGreaterThan(0);
});

test('round trip: export -> clear everything -> import restores', async () => {
  const f = await exportAll(99);
  await Promise.all(db.tables.map(t => t.clear()));
  await importAll(f);
  expect(await db.attempts.count()).toBe(1);
  expect((await db.algOverrides.get('sune'))?.moves).toBe('R U R2');
});

test('import replaces, not merges', async () => {
  const f = await exportAll(99);
  await db.attempts.add({ sessionId: 1, mode: 'full', startedAt: 9, splits: [], totalMs: 9, flag: 'ok' });
  await importAll(f);
  expect(await db.attempts.count()).toBe(1);
});

test('validateBackup rejects garbage before any write', () => {
  expect(validateBackup(null)).toMatch(/./);
  expect(validateBackup({ version: 2 })).toMatch(/version/);
  expect(validateBackup({ version: 1, sessions: [], attempts: [], algOverrides: [] })).toMatch(/settings/);
  expect(validateBackup({ version: 1, sessions: [], attempts: [], algOverrides: [], settings: [] })).toBeNull();
});

test('clearHistory removes sessions+attempts, keeps overrides+settings', async () => {
  await clearHistory();
  expect(await db.sessions.count()).toBe(0);
  expect(await db.attempts.count()).toBe(0);
  expect(await db.algOverrides.count()).toBe(1);
  expect(await db.settings.count()).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/backup.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/data/backup.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/backup.test.ts` → 5 PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/data/backup.ts src/data/backup.test.ts
git commit -m "feat(data): versioned export, full-replace import, clear history"
```

---

### Task 3: Stats screen

**Files:**
- Create: `src/ui/stats/CaseBarChart.svelte`, `src/ui/stats/SessionTrend.svelte`
- Modify: `src/ui/screens/StatsScreen.svelte` (replace stub)

**Interfaces:**
- Consumes: `core/stats`, `db` (queries via existing indexes), `caseById` (names/numbers), `fmt`-style time formatting (local helper).
- Produces the §5.3 Stats tab:
  - **Mode pill** (case / full / cfop) at top, same pill style as Timer. Attempts for the mode loaded once per mode switch via `db.attempts.where('mode').equals(mode).sortBy('startedAt')`.
  - **"Last avg" table** (all modes): rows ao5/ao12/ao50/ao100 + mean; columns current | best. Current from `aoN`, best from `bestAoN`, mean row shows `lifetimeMean` in both columns. `'dnf'` renders as `DNF`, null as `—`. Times as `s.SS` (seconds with 2 decimals; ≥60s as `m:ss.SS`).
  - **Per-case table** (case mode only): one row per practiced case — name, #oll, count, mean recognition, mean solve, DNF%, misrec% — sortable by tapping column headers (toggles asc/desc; default: worst mean recognition first, matching §5.3's adaptive-scheduling precursor intent). Unpracticed cases are omitted.
  - **Charts**:
    - `CaseBarChart` (case mode): horizontal stacked bars per practiced case — recognition segment (accent) + solve segment (dim grey), sorted by total descending, case name + #oll as the row label, scrolls vertically with the page. Props: `{ rows: { label: string; recognition: number; solve: number }[] }`. Pure SVG: bar height 18, gap 8, width scaled to the max total, viewBox computed from row count, `width: 100%`.
    - `SessionTrend` (all modes): polyline of `sessionSummaries().meanTotalMs` (skipping null sessions) over session index; dots on points; y-axis auto-scaled with min/max labels; renders "not enough sessions yet" under 2 points. Props: `{ points: number[] }`.
  - **Sessions list** (all modes): most recent 20 sessions, newest first — date (from startedAt), attempt count, session mean. Tapping a session expands an inline list of its attempts: time + splits (`recognition/solve` or phase labels) + flag markers (DNF / misrec.), loaded on expand via `db.attempts.where('sessionId')`.
  - Empty state per mode: "no attempts yet — go train" with a link to the right tab.

- [ ] **Step 1: Implement** (components first, then the screen; keep all number-crunching in `core/stats`, the screen only formats)

- [ ] **Step 2: Verify**

`npm test`, `npm run check`, `npm run build` green. Browser (127.0.0.1:5173, mobile viewport — NOT plain localhost): with existing dev-server history, case mode shows the avg table, per-case table sorts on header taps (both directions), bar chart bars align with table means, trend line renders, sessions expand with correct splits; full/cfop modes show their attempts; empty mode shows the empty state; no horizontal page scroll.

- [ ] **Step 3: Commit**

```bash
git add src/ui/stats src/ui/screens/StatsScreen.svelte
git commit -m "feat(ui): stats tab with WCA averages, per-case table, charts, sessions"
```

---

### Task 4: Settings — backup & erase

**Files:**
- Modify: `src/ui/screens/SettingsScreen.svelte`

**Interfaces:**
- Consumes: `data/backup.ts`.
- Produces a "Data" section at the bottom of Settings:
  - **Export**: serializes `exportAll(Date.now())` to pretty JSON, downloads as `cuby-export-YYYY-MM-DD.json` via a Blob + temporary anchor (`URL.revokeObjectURL` after). Shows a one-line "exported N attempts" confirmation.
  - **Import**: hidden `<input type="file" accept="application/json">`; on pick, parse + `validateBackup` — error shown inline without touching data; on valid, a confirmation row appears: "Replace ALL data with this file? (N attempts, exported <date>)" with Confirm/Cancel; Confirm runs `importAll` and reports success. JSON.parse failures are caught and shown.
  - **Clear history** (the erase): first tap turns the row into a confirmation strip: "Delete ALL sessions and attempts? Algorithms and settings survive." with three actions — `Export first` (runs the export, stays in confirmation), `Delete` (styled `--bad`; runs `clearHistory`, reports "history cleared"), `Cancel`. This is §5.2's double confirmation: tap + explicit Delete.
  - All rows match the existing Settings row style; destructive button uses `--bad` color.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Verify**

`npm test`, `npm run check`, `npm run build` green. Browser: export downloads a JSON with the four tables; import of that file replaces data (verify a flag edit made after export is reverted by import); import of a garbage file shows an error and changes nothing; clear-history flow: first tap shows the strip, Export-first downloads, Delete empties Stats (empty state appears) while Cases selection and any alg override survive; Cancel backs out.

- [ ] **Step 3: Commit**

```bash
git add src/ui/screens/SettingsScreen.svelte
git commit -m "feat(ui): export, import, and clear-history in settings"
```

---

## Self-review notes (resolved during writing)

- **Spec coverage:** §5.3 per-case stats incl. sortable orderings, per-session lists with splits, per-mode aoN table with WCA trimming, both v1 charts (Tasks 1, 3). §5.2 export/import/clear semantics exactly, incl. overrides/settings surviving a clear and the export-first shortcut (Tasks 2, 4).
- **Core direction held:** `StatAttempt`/`TimedResult` are structural; the screen adapts `AttemptRow` → `TimedResult` with `{ totalMs, dnf: flag === 'dnf' }`.
- **The Step-1 `bestAoN` test note is deliberate** — the plan's first expected value was wrong and the note walks the implementer through hand-verifying the arithmetic rather than trusting either the plan or the implementation.
- **Type consistency:** `BackupFile` reuses row types from `data/db.ts`; chart props are plain arrays of numbers/labels, no core types leak into components.
