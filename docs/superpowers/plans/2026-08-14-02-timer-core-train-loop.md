# Timer Core & Train Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app becomes usable for real OLL practice: case selection grid, the four-state training loop with recognition/solve splits, attempts persisted to IndexedDB.

**Architecture:** A pure timer state machine (`core/timer`) consumes timestamped tap events; pure selection logic (`core/train`) picks case + pool variant + AUF per spec §4.2; a Dexie layer (`src/data/`) owns sessions/attempts/settings; thin Svelte 5 screens wire them together behind a hash router with a bottom tab bar. Diagrams are SVG rendered from the 21-char pattern strings in `cases.json` — never drawn by hand.

**Tech Stack:** Svelte 5 (runes), Dexie 4, fake-indexeddb (tests), Vitest. No new runtime dependencies beyond dexie.

**Spec:** `cube-trainer-spec.md` — this plan implements §3.1 (selection UI), §3.2 (training loop), §4.2 (runtime selection), §5.1 (storage), §7.1/7.3/7.5 (shell, one-handed rules, session lifecycle), plus deferred findings from Plan 1's final review.

## Global Constraints

- TypeScript strict everywhere. All durations integer ms; timestamps epoch ms (spec §5.1).
- `src/` stays browser-clean: no `node:` imports, no `tools/` imports (guard test added in Task 1 enforces this).
- `src/core/**` imports nothing from `src/data` or `src/ui` (dependency direction §6.3). Pure logic takes timestamps and RNG as parameters — no `Date.now()` inside `core/`.
- Only new dependency: `dexie` (runtime), `fake-indexeddb` (dev).
- Pattern string format (from Plan 1): 21 chars — U face row-major (row 0 = back), then ring F row0, R row0, B row0, L row0, left→right within each face. `1` = yellow.
- Scramble pool contract: `data/scrambles.json` pools keyed by case id, 50 face-turn scrambles each. Runtime AUF (§4.2) is mandatory — six U-symmetric pools present fewer than 4 distinct orientations without it.
- One-handed rules (§7.3): tap zone = whole screen minus top strip; abort top corner, no confirm; reveal controls in bottom third; 300 ms dead-time after the solve-ending tap.
- Visual language: existing `app.css` tokens (dark, `--accent` sticker yellow), Space Grotesk / JetBrains Mono self-hosted later (Plan 6); use `font-family` stacks with system fallbacks for now.
- The dev server runs in a herdr pane at http://192.168.0.232:5173/ — UI tasks end with a phone-viewport check (browser devtools mobile viewport is acceptable evidence; the user checks the phone itself).
- Commit after every green task.

---

### Task 1: Housekeeping — fix `check`, guard `src/`, CI build, deps

**Files:**
- Modify: `package.json`, `tsconfig.json`, `.github/workflows/ci.yml`
- Create: `src/browser-clean.test.ts`

**Interfaces:**
- Consumes: Plan 1's scaffold.
- Produces: working `npm run check`; `dexie` + `fake-indexeddb` installed; `resolveJsonModule` enabled; CI runs build; guard test that later tasks must keep green.

- [ ] **Step 1: Fix the `check` script**

Plan 1's final review found `svelte-check` refuses TypeScript 7 (`requires both TypeScript 7 and TypeScript 6 ... --tsgo`). Pin TypeScript to the newest major svelte-check supports:

Run: `npm install -D typescript@^6`
Run: `npm run check` → expected: completes with 0 errors (if svelte-check still refuses, read its error and pin the exact major it names; do not delete the script).
Run: `npx tsc -p tsconfig.json` → expected: clean.

- [ ] **Step 2: Install data-layer deps and enable JSON imports**

Run: `npm install dexie && npm install -D fake-indexeddb`

In `tsconfig.json` `compilerOptions`, add:

```json
"resolveJsonModule": true
```

- [ ] **Step 3: Write the browser-clean guard test**

`src/browser-clean.test.ts`:

```ts
import { expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('src/ never imports node builtins or tools/', () => {
  const offenders: string[] = [];
  for (const file of walk('src')) {
    if (!/\.(ts|svelte)$/.test(file) || file.endsWith('.test.ts')) continue;
    const text = readFileSync(file, 'utf8');
    if (/from\s+['"](node:|.*\/tools\/)/.test(text) || /import\s+['"]node:/.test(text)) {
      offenders.push(file);
    }
  }
  expect(offenders).toEqual([]);
});
```

(The test file itself uses `node:fs` — that's why the walker skips `.test.ts` files; tests run in Node, shipped code doesn't.)

- [ ] **Step 4: Add build to CI**

In `.github/workflows/ci.yml`, after the `npm test` step and before `npm run verify`, add:

```yaml
      - run: npm run build
```

- [ ] **Step 5: Verify everything**

Run: `npm test` → all pass including the new guard. Run: `npm run build` → clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: fix svelte-check TS pin, browser-clean guard, CI build, dexie deps"
```

---

### Task 2: Timer state machine (`core/timer`)

**Files:**
- Create: `src/core/timer/attempt.ts`
- Test: `src/core/timer/attempt.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Split { label: string; ms: number }`
  - `interface TimerState { phases: readonly string[]; status: 'idle' | 'running' | 'done'; startedAt: number; boundaries: number[] }`
  - `createTimer(phases: readonly string[]): TimerState` — throws on empty phases.
  - `tap(s: TimerState, t: number): TimerState` — pure; idle→running, each running tap closes a phase, last phase → done, taps on done are no-ops.
  - `phaseIndex(s: TimerState): number` — count of completed phases = index of the running phase.
  - `splits(s: TimerState): Split[]`, `totalMs(s: TimerState): number` (0 unless done).
  
  This is the §3.3 shared core: case training uses phases `['recognition', 'solve']`; Plan 3 reuses it with `['solve']` and user phase sets. Events carry their own timestamps (smart-cube-ready per §2).

- [ ] **Step 1: Write the failing tests**

`src/core/timer/attempt.test.ts`:

```ts
import { expect, test } from 'vitest';
import { createTimer, tap, phaseIndex, splits, totalMs } from './attempt';

test('case-training flow: three taps produce recognition and solve splits', () => {
  let s = createTimer(['recognition', 'solve']);
  expect(s.status).toBe('idle');
  s = tap(s, 1000);
  expect(s.status).toBe('running');
  expect(phaseIndex(s)).toBe(0);
  s = tap(s, 1800);
  expect(phaseIndex(s)).toBe(1);
  s = tap(s, 4300);
  expect(s.status).toBe('done');
  expect(splits(s)).toEqual([
    { label: 'recognition', ms: 800 },
    { label: 'solve', ms: 2500 },
  ]);
  expect(totalMs(s)).toBe(3300);
});

test('single-phase timer: two taps start and stop', () => {
  let s = createTimer(['solve']);
  s = tap(s, 10);
  s = tap(s, 9010);
  expect(s.status).toBe('done');
  expect(splits(s)).toEqual([{ label: 'solve', ms: 9000 }]);
});

test('taps on done are no-ops; totalMs is 0 before done', () => {
  let s = createTimer(['solve']);
  expect(totalMs(s)).toBe(0);
  s = tap(s, 1);
  expect(totalMs(s)).toBe(0);
  s = tap(s, 2);
  const done = s;
  expect(tap(done, 99)).toEqual(done);
});

test('tap does not mutate its input', () => {
  const s0 = createTimer(['a', 'b']);
  const s1 = tap(s0, 5);
  expect(s0.status).toBe('idle');
  expect(s1.status).toBe('running');
});

test('empty phase list throws', () => {
  expect(() => createTimer([])).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/timer/attempt.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

`src/core/timer/attempt.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/timer/attempt.test.ts` → 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/timer
git commit -m "feat(core): attempt timer state machine"
```

---

### Task 3: Runtime attempt selection (`core/train`)

**Files:**
- Create: `src/core/train/select.ts`
- Test: `src/core/train/select.test.ts`

**Interfaces:**
- Consumes: `parseAlg`, `toAlgString` from `../cube/parser`; caller passes RNG (e.g. `mulberry32`) — no randomness inside.
- Produces:
  - `interface AttemptPick { caseId: string; variant: string; scramble: string }` — `variant` is the raw pool entry (for no-repeat tracking), `scramble` is variant + merged AUF (what the user executes).
  - `pickAttempt(input: { selected: string[]; pools: Record<string, string[]>; lastCaseId?: string; lastVariantByCase?: Record<string, string>; rand: () => number }): AttemptPick` — implements §4.2: case uniform over selected, never repeating `lastCaseId` when `selected.length >= 3`; variant uniform over the case's pool, never repeating that case's last variant; AUF uniform over {∅, U, U', U2}. Throws if `selected.length < 2` or a pool is missing/empty.
  - `appendAuf(scramble: string, auf: string): string` — merges a trailing U-face move with the AUF (`... U2` + `U'` → `... U`; full cancellation drops the move) so the displayed scramble never ends in a silly `U U'` pair.

- [ ] **Step 1: Write the failing tests**

`src/core/train/select.test.ts`:

```ts
import { expect, test } from 'vitest';
import { appendAuf, pickAttempt } from './select';
import { mulberry32 } from '../rng';

const pools = {
  a: ['R U R2', 'F U F2', 'L U L2'],
  b: ["B U' B2", 'D U D2'],
  c: ['R2 F2 R2'],
};

test('never the same case twice in a row when 3+ selected', () => {
  const rand = mulberry32(1);
  let last: string | undefined;
  for (let i = 0; i < 100; i++) {
    const p = pickAttempt({ selected: ['a', 'b', 'c'], pools, lastCaseId: last, rand });
    expect(p.caseId).not.toBe(last);
    last = p.caseId;
  }
});

test('with exactly 2 selected, repeats are allowed and both cases occur', () => {
  const rand = mulberry32(2);
  const seen = new Set<string>();
  let last: string | undefined;
  for (let i = 0; i < 50; i++) {
    const p = pickAttempt({ selected: ['a', 'b'], pools, lastCaseId: last, rand });
    seen.add(p.caseId);
    last = p.caseId;
  }
  expect(seen).toEqual(new Set(['a', 'b']));
});

test('never the same variant twice in a row for a case', () => {
  const rand = mulberry32(3);
  const lastVariantByCase: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    const p = pickAttempt({ selected: ['a', 'b'], pools, lastVariantByCase, rand });
    expect(p.variant).not.toBe(lastVariantByCase[p.caseId]);
    lastVariantByCase[p.caseId] = p.variant;
  }
});

test('scramble is variant plus merged AUF and stays parseable', () => {
  const rand = mulberry32(4);
  const p = pickAttempt({ selected: ['a', 'b'], pools, rand });
  expect(p.scramble.startsWith(p.variant.split(' ').slice(0, -1).join(' '))).toBe(true);
});

test('appendAuf merges trailing U moves', () => {
  expect(appendAuf('R U2 F2 U', "U'")).toBe('R U2 F2');
  expect(appendAuf('R U2 F2 U', 'U')).toBe('R U2 F2 U2');
  expect(appendAuf('R U2 F2 U2', "U'")).toBe('R U2 F2 U');
  expect(appendAuf('R U2 F2', 'U2')).toBe('R U2 F2 U2');
  expect(appendAuf('R U2 F2', '')).toBe('R U2 F2');
});

test('guards: fewer than 2 selected or missing pool throws', () => {
  expect(() => pickAttempt({ selected: ['a'], pools, rand: mulberry32(5) })).toThrow();
  expect(() => pickAttempt({ selected: ['a', 'zzz'], pools, rand: () => 0.9 })).toThrow(/zzz/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/train/select.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

`src/core/train/select.ts`:

```ts
import { parseAlg, toAlgString } from '../cube/parser';

export interface AttemptPick { caseId: string; variant: string; scramble: string }

const AUFS = ['', 'U', "U'", 'U2'];

export function pickAttempt(input: {
  selected: string[];
  pools: Record<string, string[]>;
  lastCaseId?: string;
  lastVariantByCase?: Record<string, string>;
  rand: () => number;
}): AttemptPick {
  const { selected, pools, lastCaseId, lastVariantByCase = {}, rand } = input;
  if (selected.length < 2) throw new Error('need at least 2 selected cases');

  let candidates = selected;
  if (selected.length >= 3 && lastCaseId) candidates = selected.filter(id => id !== lastCaseId);
  const caseId = candidates[Math.floor(rand() * candidates.length)];

  const pool = pools[caseId];
  if (!pool || pool.length === 0) throw new Error(`no scramble pool for case "${caseId}"`);
  let variants = pool;
  const lastVariant = lastVariantByCase[caseId];
  if (pool.length >= 2 && lastVariant) variants = pool.filter(v => v !== lastVariant);
  const variant = variants[Math.floor(rand() * variants.length)];

  const auf = AUFS[Math.floor(rand() * AUFS.length)];
  return { caseId, variant, scramble: appendAuf(variant, auf) };
}

export function appendAuf(scramble: string, auf: string): string {
  if (!auf) return scramble;
  const moves = parseAlg(scramble);
  const aufMove = parseAlg(auf)[0];
  const last = moves[moves.length - 1];
  if (!last || last.base !== 'U') return toAlgString([...moves, aufMove]);
  const net = (((last.q + aufMove.q) % 4) + 4) % 4; // 0..3 net clockwise quarter turns
  if (net === 0) return toAlgString(moves.slice(0, -1));
  const q = net === 3 ? -1 : net;
  return toAlgString([...moves.slice(0, -1), { label: '', base: 'U', q }]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/train/select.test.ts` → 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/train
git commit -m "feat(core): runtime attempt selection with AUF merging"
```

---

### Task 4: Data layer — typed case set, Dexie schema, settings & selection repos

**Files:**
- Create: `src/data/caseSet.ts`, `src/data/db.ts`, `src/data/settings.ts`
- Test: `src/data/db.test.ts`

**Interfaces:**
- Consumes: `data/cases.json`, `data/scrambles.json` (repo root — static imports, bundled by Vite), `dexie`.
- Produces:
  - `caseSet.ts`: `interface CaseInfo { id: string; name: string; group: string; primary: string; secondary?: string; triggers?: string; notes?: string; easy?: boolean; pattern: string; oll: number }`, `interface GroupInfo { id: string; name: string }`, `const groups: GroupInfo[]`, `const cases: CaseInfo[]`, `const caseById: Map<string, CaseInfo>`, `const pools: Record<string, string[]>`.
  - `db.ts`: `type Mode = 'case' | 'full' | 'cfop'`; `type Flag = 'ok' | 'misrecognized' | 'dnf'`; row interfaces `SessionRow { id?: number; mode: Mode; startedAt: number; endedAt?: number; configSnapshot: string[] }`, `AttemptRow { id?: number; sessionId: number; mode: Mode; caseId?: string; scramble?: string; startedAt: number; splits: Split[]; totalMs: number; flag: Flag }`, `AlgOverrideRow { caseId: string; moves: string; updatedAt: number }`, `SettingRow { key: string; value: unknown }`; `const db` (Dexie instance, tables `sessions`, `attempts`, `algOverrides`, `settings` per spec §5.1).
  - `settings.ts`: `getSetting<T>(key: string, fallback: T): Promise<T>`, `setSetting(key: string, value: unknown): Promise<void>`, `getCaseSelection(): Promise<string[]>` (fallback `[]`), `setCaseSelection(ids: string[]): Promise<void>`, `activeAlg(caseId: string): Promise<string>` (override moves if present, else the case's primary — reveal screen uses this per §3.4).

- [ ] **Step 1: Write the failing tests**

`src/data/db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { activeAlg, getCaseSelection, getSetting, setCaseSelection, setSetting } from './settings';
import { caseById, cases, groups, pools } from './caseSet';

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()));
});

test('case set loads: 57 cases, 14 groups, 57 pools of 50', () => {
  expect(cases).toHaveLength(57);
  expect(groups).toHaveLength(14);
  expect(Object.keys(pools)).toHaveLength(57);
  for (const c of cases) {
    expect(pools[c.id]).toHaveLength(50);
    expect(c.pattern).toMatch(/^[01]{21}$/);
  }
});

test('settings round-trip with fallback', async () => {
  expect(await getSetting('nope', 42)).toBe(42);
  await setSetting('nope', 7);
  expect(await getSetting('nope', 42)).toBe(7);
});

test('case selection persists', async () => {
  expect(await getCaseSelection()).toEqual([]);
  await setCaseSelection(['sune', 'key']);
  expect(await getCaseSelection()).toEqual(['sune', 'key']);
});

test('attempts store and retrieve by session', async () => {
  const sessionId = (await db.sessions.add({ mode: 'case', startedAt: 1, configSnapshot: ['sune'] })) as number;
  await db.attempts.add({
    sessionId, mode: 'case', caseId: 'sune', scramble: 'R U2 R', startedAt: 5,
    splits: [{ label: 'recognition', ms: 800 }, { label: 'solve', ms: 2000 }],
    totalMs: 2800, flag: 'ok',
  });
  const rows = await db.attempts.where('sessionId').equals(sessionId).toArray();
  expect(rows).toHaveLength(1);
  expect(rows[0].totalMs).toBe(2800);
});

test('activeAlg falls back to primary and honors overrides', async () => {
  const sune = caseById.get('sune')!;
  expect(await activeAlg('sune')).toBe(sune.primary);
  await db.algOverrides.put({ caseId: 'sune', moves: "L' U' L U' L' U2 L", updatedAt: 9 });
  expect(await activeAlg('sune')).toBe("L' U' L U' L' U2 L");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/db.test.ts` → FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/data/caseSet.ts`:

```ts
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
```

`src/data/db.ts`:

```ts
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
```

`src/data/settings.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/db.test.ts` → 5 PASS. Run the full suite too (`npm test`) — the browser-clean guard must stay green (fake-indexeddb is test-only via the `/auto` import inside the `.test.ts` file).

- [ ] **Step 5: Commit**

```bash
git add src/data package.json package-lock.json tsconfig.json
git commit -m "feat(data): dexie schema, settings repo, typed case set"
```

---

### Task 5: Session lifecycle

**Files:**
- Create: `src/data/sessions.ts`
- Test: `src/data/sessions.test.ts`

**Interfaces:**
- Consumes: `db` from `./db`.
- Produces:
  - `sessionForAttempt(mode: Mode, config: string[], now: number): Promise<number>` — returns the active session's id, reusing it only when mode matches, config is deep-equal, and less than 30 minutes have passed since the last call (spec §7.5 idle rule + §2 config-snapshot rule); otherwise ends the previous session (`endedAt = now`) and creates a new row.
  - `endActiveSession(now: number): Promise<void>` — called on leaving a mode screen; no-op when none active.
  - `_resetSessionsForTests(): void` — clears the in-memory active-session state.

- [ ] **Step 1: Write the failing tests**

`src/data/sessions.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { _resetSessionsForTests, endActiveSession, sessionForAttempt } from './sessions';

const MIN = 60_000;

beforeEach(async () => {
  _resetSessionsForTests();
  await Promise.all(db.tables.map(t => t.clear()));
});

test('consecutive attempts share a session', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  const b = await sessionForAttempt('case', ['sune', 'key'], 5 * MIN);
  expect(b).toBe(a);
  expect(await db.sessions.count()).toBe(1);
});

test('config change starts a new session and ends the old one', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  const b = await sessionForAttempt('case', ['sune', 'key', 't'], MIN);
  expect(b).not.toBe(a);
  expect((await db.sessions.get(a))!.endedAt).toBe(MIN);
});

test('30 minutes idle starts a new session', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  const b = await sessionForAttempt('case', ['sune', 'key'], 31 * MIN);
  expect(b).not.toBe(a);
});

test('endActiveSession stamps endedAt and forgets the session', async () => {
  const a = await sessionForAttempt('case', ['sune', 'key'], 0);
  await endActiveSession(2 * MIN);
  expect((await db.sessions.get(a))!.endedAt).toBe(2 * MIN);
  const b = await sessionForAttempt('case', ['sune', 'key'], 3 * MIN);
  expect(b).not.toBe(a);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/sessions.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement**

`src/data/sessions.ts`:

```ts
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
  const id = (await db.sessions.add({ mode, startedAt: now, configSnapshot: config })) as number;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/sessions.test.ts` → 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/sessions.ts src/data/sessions.test.ts
git commit -m "feat(data): implicit session lifecycle with idle timeout"
```

---

### Task 6: App shell — hash router, tab bar, stub screens

**Files:**
- Create: `src/ui/router.svelte.ts`, `src/ui/TabBar.svelte`, `src/ui/screens/TrainScreen.svelte` (placeholder body, replaced in Task 9), `src/ui/screens/TimerScreen.svelte` (stub), `src/ui/screens/CasesScreen.svelte` (placeholder, replaced in Task 8), `src/ui/screens/StatsScreen.svelte` (stub), `src/ui/screens/SettingsScreen.svelte` (placeholder, replaced in Task 10)
- Modify: `src/App.svelte`, `src/app.css`
- Test: `src/ui/router.test.ts`

**Interfaces:**
- Consumes: `src/app.css` tokens.
- Produces:
  - `router.svelte.ts`: `currentRoute(): string` (reactive — reads a module-level `$state`), `navigate(path: string): void`, `normalizeRoute(hash: string): string` (exported for tests: strips `#`, returns `/train` for anything not in the route set).
  - Route set: `/train`, `/timer`, `/cases`, `/stats`, `/settings`; default `/train`.
  - Layout contract every screen inherits: `.screen` fills the viewport minus the 56px bottom tab bar; the tab bar respects `env(safe-area-inset-bottom)`.

- [ ] **Step 1: Write the failing router test**

`src/ui/router.test.ts`:

```ts
import { expect, test } from 'vitest';
import { normalizeRoute } from './router.svelte';

test('normalizeRoute maps hashes to known routes with /train fallback', () => {
  expect(normalizeRoute('#/cases')).toBe('/cases');
  expect(normalizeRoute('#/settings')).toBe('/settings');
  expect(normalizeRoute('')).toBe('/train');
  expect(normalizeRoute('#/bogus')).toBe('/train');
  expect(normalizeRoute('#/train')).toBe('/train');
});
```

Run: `npx vitest run src/ui/router.test.ts` → FAIL.

- [ ] **Step 2: Implement router**

`src/ui/router.svelte.ts`:

```ts
export const ROUTES = ['/train', '/timer', '/cases', '/stats', '/settings'] as const;
export type Route = (typeof ROUTES)[number];

export function normalizeRoute(hash: string): Route {
  const path = hash.replace(/^#/, '');
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : '/train';
}

const state = $state({ route: '/train' as Route });

if (typeof window !== 'undefined') {
  state.route = normalizeRoute(window.location.hash);
  window.addEventListener('hashchange', () => {
    state.route = normalizeRoute(window.location.hash);
  });
}

export function currentRoute(): Route {
  return state.route;
}

export function navigate(path: Route): void {
  window.location.hash = path;
}
```

Run: `npx vitest run src/ui/router.test.ts` → PASS.

- [ ] **Step 3: Tab bar, stub screens, App wiring**

`src/ui/TabBar.svelte`:

```svelte
<script lang="ts">
  import { currentRoute, navigate, type Route } from './router.svelte';
  const tabs: { path: Route; label: string }[] = [
    { path: '/train', label: 'Train' },
    { path: '/timer', label: 'Timer' },
    { path: '/cases', label: 'Cases' },
    { path: '/stats', label: 'Stats' },
    { path: '/settings', label: 'Settings' },
  ];
</script>

<nav>
  {#each tabs as tab}
    <button class:on={currentRoute() === tab.path} onclick={() => navigate(tab.path)}>
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed; inset: auto 0 0 0; height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    display: flex; background: var(--panel); border-top: 1px solid var(--line);
  }
  button {
    flex: 1; background: none; border: 0; color: var(--dim);
    font: 500 12px var(--font-ui); cursor: pointer;
  }
  button.on { color: var(--accent); }
</style>
```

Stub screens — `src/ui/screens/TimerScreen.svelte` and `StatsScreen.svelte` get this shape (adjust the title):

```svelte
<div class="screen center">
  <p class="dim">Timer modes arrive in a later plan.</p>
</div>
```

`TrainScreen.svelte`, `CasesScreen.svelte`, `SettingsScreen.svelte` start as the same kind of placeholder (their real bodies land in Tasks 9, 8, 10).

`src/App.svelte`:

```svelte
<script lang="ts">
  import TabBar from './ui/TabBar.svelte';
  import { currentRoute } from './ui/router.svelte';
  import TrainScreen from './ui/screens/TrainScreen.svelte';
  import TimerScreen from './ui/screens/TimerScreen.svelte';
  import CasesScreen from './ui/screens/CasesScreen.svelte';
  import StatsScreen from './ui/screens/StatsScreen.svelte';
  import SettingsScreen from './ui/screens/SettingsScreen.svelte';
</script>

{#if currentRoute() === '/train'}<TrainScreen />
{:else if currentRoute() === '/timer'}<TimerScreen />
{:else if currentRoute() === '/cases'}<CasesScreen />
{:else if currentRoute() === '/stats'}<StatsScreen />
{:else}<SettingsScreen />{/if}
<TabBar />
```

Append to `src/app.css`:

```css
:root {
  --font-ui: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
html, body { height: 100%; }
body { font-family: var(--font-ui); overscroll-behavior: none; }
.screen {
  min-height: 100dvh;
  padding: 16px 16px calc(72px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.screen.center { display: flex; align-items: center; justify-content: center; }
.dim { color: var(--dim); }
```

- [ ] **Step 4: Verify**

Run: `npm test` (router test + all prior green), `npm run build`, `npm run check`. Then view http://localhost:5173 in a mobile viewport: five tabs switch screens, active tab highlighted, no horizontal scroll. The user can check http://192.168.0.232:5173/ on their phone.

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/app.css src/ui
git commit -m "feat(ui): hash router, tab bar, screen shell"
```

---

### Task 7: Case diagram — pure layout model + SVG component

**Files:**
- Create: `src/ui/diagram.ts`, `src/ui/CaseDiagram.svelte`
- Test: `src/ui/diagram.test.ts`

**Interfaces:**
- Consumes: pattern strings (21-char format, Global Constraints).
- Produces:
  - `interface DiagramRect { x: number; y: number; w: number; h: number; on: boolean }`
  - `diagramLayout(pattern: string): { grid: DiagramRect[]; bars: DiagramRect[] }` — viewBox is 0 0 96 96. Grid cells 25×25 at positions 9/35.5/62 (x by column, y by row; row 0 at top = B side). Bars are 25×6 (or 6×25 on vertical edges), only emitted where the ring bit is `1`. Ring mapping (pattern[9..20], diagram oriented F at bottom):
    - F row0 (pattern 9,10,11) → bottom edge `y=90`, x follows column 0,1,2
    - R row0 (pattern 12,13,14) → right edge `x=90`, y follows row 2,1,0 (R's cols run front→back)
    - B row0 (pattern 15,16,17) → top edge `y=0`, x follows column 2,1,0 (B's cols run right→left)
    - L row0 (pattern 18,19,20) → left edge `x=0`, y follows row 0,1,2 (L's cols run back→front)
  - `CaseDiagram.svelte`: props `{ pattern: string; size?: number }` (default 72) — renders the layout; on-cells/bars `var(--accent)`, off grid cells `var(--panel-2)`, throws nothing on bad input (renders empty for wrong-length strings).

- [ ] **Step 1: Write the failing tests**

`src/ui/diagram.test.ts`:

```ts
import { expect, test } from 'vitest';
import { diagramLayout } from './diagram';

const SOLVED = '111111111' + '000000000000';

test('solved: 9 on grid cells, no bars', () => {
  const d = diagramLayout(SOLVED);
  expect(d.grid).toHaveLength(9);
  expect(d.grid.every(c => c.on)).toBe(true);
  expect(d.bars).toHaveLength(0);
});

test('grid row 0 sits at the top and column order is left to right', () => {
  const d = diagramLayout(SOLVED);
  expect(d.grid[0]).toMatchObject({ x: 9, y: 9 });
  expect(d.grid[2]).toMatchObject({ x: 62, y: 9 });
  expect(d.grid[6]).toMatchObject({ x: 9, y: 62 });
});

test('ring bars land on the right edges', () => {
  const f = diagramLayout('000000000' + '100000000000').bars;   // F0 -> bottom-left
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ x: 9, y: 90, w: 25, h: 6 });
  const r = diagramLayout('000000000' + '000100000000').bars;   // R0 -> right edge, bottom
  expect(r[0]).toMatchObject({ x: 90, y: 62, w: 6, h: 25 });
  const b = diagramLayout('000000000' + '000000100000').bars;   // B0 -> top edge, right
  expect(b[0]).toMatchObject({ x: 62, y: 0, w: 25, h: 6 });
  const l = diagramLayout('000000000' + '000000000100').bars;   // L0 -> left edge, top
  expect(l[0]).toMatchObject({ x: 0, y: 9, w: 6, h: 25 });
});

test('bad input renders empty, not a crash', () => {
  expect(diagramLayout('101')).toEqual({ grid: [], bars: [] });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/diagram.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/ui/diagram.ts`:

```ts
export interface DiagramRect { x: number; y: number; w: number; h: number; on: boolean }

const POS = [9, 35.5, 62]; // cell x/y by column/row
const CELL = 25;
const BAR = 6;

export function diagramLayout(pattern: string): { grid: DiagramRect[]; bars: DiagramRect[] } {
  if (!/^[01]{21}$/.test(pattern)) return { grid: [], bars: [] };
  const grid: DiagramRect[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      grid.push({ x: POS[c], y: POS[r], w: CELL, h: CELL, on: pattern[r * 3 + c] === '1' });

  const bars: DiagramRect[] = [];
  const ring = pattern.slice(9);
  for (let i = 0; i < 3; i++) {
    if (ring[i] === '1') bars.push({ x: POS[i], y: 90, w: CELL, h: BAR, on: true });        // F
    if (ring[3 + i] === '1') bars.push({ x: 90, y: POS[2 - i], w: BAR, h: CELL, on: true }); // R
    if (ring[6 + i] === '1') bars.push({ x: POS[2 - i], y: 0, w: CELL, h: BAR, on: true });  // B
    if (ring[9 + i] === '1') bars.push({ x: 0, y: POS[i], w: BAR, h: CELL, on: true });      // L
  }
  return { grid, bars };
}
```

`src/ui/CaseDiagram.svelte`:

```svelte
<script lang="ts">
  import { diagramLayout } from './diagram';
  let { pattern, size = 72 }: { pattern: string; size?: number } = $props();
  const layout = $derived(diagramLayout(pattern));
</script>

<svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="case diagram">
  {#each layout.grid as cell}
    <rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} rx="2"
      fill={cell.on ? 'var(--accent)' : 'var(--panel-2)'} />
  {/each}
  {#each layout.bars as bar}
    <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="2" fill="var(--accent)" />
  {/each}
</svg>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/ui/diagram.test.ts` → 4 PASS. `npm run check` clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/diagram.ts src/ui/diagram.test.ts src/ui/CaseDiagram.svelte
git commit -m "feat(ui): case diagram layout model and SVG component"
```

---

### Task 8: Cases screen — selection grid

**Files:**
- Create: `src/ui/selection.ts`
- Modify: `src/ui/screens/CasesScreen.svelte` (replace placeholder)
- Test: `src/ui/selection.test.ts`

**Interfaces:**
- Consumes: `caseSet.ts`, `settings.ts` (`getCaseSelection`/`setCaseSelection`), `CaseDiagram.svelte`.
- Produces:
  - `selection.ts` pure helpers: `toggleCase(selected: string[], id: string): string[]`; `toggleGroup(selected: string[], groupCaseIds: string[]): string[]` — if every group case is selected, deselect them all; otherwise select the missing ones (spec §3.1 header-toggle semantics). Both preserve order of unrelated ids and never duplicate.
  - Screen behavior later tasks rely on: selection persists via `setCaseSelection` on every change; Train reads it with `getCaseSelection`.

- [ ] **Step 1: Write the failing tests**

`src/ui/selection.test.ts`:

```ts
import { expect, test } from 'vitest';
import { toggleCase, toggleGroup } from './selection';

test('toggleCase adds and removes', () => {
  expect(toggleCase([], 'sune')).toEqual(['sune']);
  expect(toggleCase(['sune', 'key'], 'sune')).toEqual(['key']);
});

test('toggleGroup selects missing members, deselects when complete', () => {
  const group = ['a', 'b', 'c'];
  expect(toggleGroup(['b', 'x'], group)).toEqual(['b', 'x', 'a', 'c']);
  expect(toggleGroup(['b', 'x', 'a', 'c'], group)).toEqual(['x']);
});

test('no duplicates ever', () => {
  const out = toggleGroup(['a'], ['a', 'b']);
  expect(new Set(out).size).toBe(out.length);
});
```

Run: `npx vitest run src/ui/selection.test.ts` → FAIL.

- [ ] **Step 2: Implement helpers**

`src/ui/selection.ts`:

```ts
export function toggleCase(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
}

export function toggleGroup(selected: string[], groupCaseIds: string[]): string[] {
  const allIn = groupCaseIds.every(id => selected.includes(id));
  if (allIn) return selected.filter(id => !groupCaseIds.includes(id));
  return [...selected, ...groupCaseIds.filter(id => !selected.includes(id))];
}
```

Run: `npx vitest run src/ui/selection.test.ts` → 3 PASS.

- [ ] **Step 3: Build the screen**

`src/ui/screens/CasesScreen.svelte`:

```svelte
<script lang="ts">
  import CaseDiagram from '../CaseDiagram.svelte';
  import { cases, groups } from '../../data/caseSet';
  import { getCaseSelection, setCaseSelection } from '../../data/settings';
  import { toggleCase, toggleGroup } from '../selection';

  let selected = $state<string[]>([]);
  let loaded = $state(false);

  $effect(() => {
    getCaseSelection().then(ids => { selected = ids; loaded = true; });
  });

  function update(next: string[]) {
    selected = next;
    void setCaseSelection(next);
  }

  const byGroup = $derived(groups.map(g => ({ ...g, cases: cases.filter(c => c.group === g.id) })));
</script>

<div class="screen">
  <h1>Cases <span class="dim">{selected.length}/57 selected</span></h1>
  {#if loaded}
    {#each byGroup as group}
      <section>
        <button class="group-header" onclick={() => update(toggleGroup(selected, group.cases.map(c => c.id)))}>
          {group.name}
          <span class="dim">{group.cases.filter(c => selected.includes(c.id)).length}/{group.cases.length}</span>
        </button>
        <div class="grid">
          {#each group.cases as c}
            <button class="tile" class:on={selected.includes(c.id)} onclick={() => update(toggleCase(selected, c.id))}>
              <CaseDiagram pattern={c.pattern} size={64} />
              <span class="name">{c.name}</span>
              <span class="dim">#{c.oll}</span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  h1 { font-size: 20px; margin-bottom: 12px; }
  h1 .dim { font-size: 13px; font-weight: 400; margin-left: 8px; }
  section { margin-bottom: 20px; }
  .group-header {
    width: 100%; display: flex; justify-content: space-between; align-items: baseline;
    background: none; border: 0; border-bottom: 1px solid var(--line);
    color: var(--text); font: 600 15px var(--font-ui); padding: 8px 2px; cursor: pointer;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 10px; }
  .tile {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: var(--panel); border: 2px solid transparent; border-radius: var(--radius);
    color: var(--text); padding: 10px 4px 8px; cursor: pointer; font: 500 12px var(--font-ui);
  }
  .tile.on { border-color: var(--accent); }
  .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
```

- [ ] **Step 4: Verify**

Run: `npm test`, `npm run check`, `npm run build` — all green. In a mobile viewport: tiles toggle with a yellow border, group headers toggle whole groups, counts update, reload preserves the selection. Phone check at http://192.168.0.232:5173/#/cases.

- [ ] **Step 5: Commit**

```bash
git add src/ui/selection.ts src/ui/selection.test.ts src/ui/screens/CasesScreen.svelte
git commit -m "feat(ui): case selection grid with per-group toggles"
```

---

### Task 9: Train screen — the four-state loop

**Files:**
- Create: `src/ui/train/flow.ts`
- Modify: `src/ui/screens/TrainScreen.svelte` (replace placeholder)
- Test: `src/ui/train/flow.test.ts`

**Interfaces:**
- Consumes: `pickAttempt` (Task 3), timer core (Task 2), `mulberry32`, `pools`/`caseById` (Task 4), `activeAlg`, `sessionForAttempt` (Task 5), `db`.
- Produces:
  - `flow.ts` — a pure reducer over the training flow so every transition is testable without a DOM:
    - `type Stage = 'scrambled' | 'recognizing' | 'solving' | 'reveal'`
    - `interface FlowState { stage: Stage; pick: AttemptPick; timer: TimerState; revealAt: number; lastCaseId?: string; lastVariantByCase: Record<string, string> }`
    - `newAttempt(prev: Pick<FlowState, 'lastCaseId' | 'lastVariantByCase'> | null, selected: string[], rand: () => number): FlowState` — picks per §4.2 with the no-repeat memory threaded through.
    - `tapZone(s: FlowState, selected: string[], rand: () => number, now: number): FlowState` — scrambled→recognizing (timer starts), recognizing→solving, solving→reveal (stamps `revealAt = now`), reveal→next attempt only when `now - s.revealAt >= REVEAL_DEAD_MS` (else returns `s` unchanged).
    - `const REVEAL_DEAD_MS = 300`
  - Screen persistence contract: entering reveal saves the attempt (`flag: 'ok'`) via `sessionForAttempt('case', selected, now)` + `db.attempts.add`, keeping the row id; flag buttons update that row. Abort discards without saving and deals a new attempt. Attempt rows carry `scramble` = the executed scramble (with AUF).

- [ ] **Step 1: Write the failing tests**

`src/ui/train/flow.test.ts`:

```ts
import { expect, test } from 'vitest';
import { newAttempt, tapZone, REVEAL_DEAD_MS } from './flow';
import { mulberry32 } from '../../core/rng';
import { splits, totalMs } from '../../core/timer/attempt';
import { pools } from '../../data/caseSet';

const selected = ['sune', 'anti-sune', 'h'];

test('full attempt: scrambled -> recognizing -> solving -> reveal with correct splits', () => {
  const rand = mulberry32(1);
  let s = newAttempt(null, selected, rand);
  expect(s.stage).toBe('scrambled');
  expect(pools[s.pick.caseId]).toContain(s.pick.variant);
  s = tapZone(s, selected, rand, 1000);
  expect(s.stage).toBe('recognizing');
  s = tapZone(s, selected, rand, 2100);
  expect(s.stage).toBe('solving');
  s = tapZone(s, selected, rand, 4600);
  expect(s.stage).toBe('reveal');
  expect(splits(s.timer)).toEqual([
    { label: 'recognition', ms: 1100 },
    { label: 'solve', ms: 2500 },
  ]);
  expect(totalMs(s.timer)).toBe(3600);
});

test('reveal ignores taps inside the dead-time, advances after it', () => {
  const rand = mulberry32(2);
  let s = newAttempt(null, selected, rand);
  s = tapZone(s, selected, rand, 0);
  s = tapZone(s, selected, rand, 500);
  s = tapZone(s, selected, rand, 1000); // reveal, revealAt=1000
  const inside = tapZone(s, selected, rand, 1000 + REVEAL_DEAD_MS - 1);
  expect(inside).toBe(s);
  const after = tapZone(s, selected, rand, 1000 + REVEAL_DEAD_MS);
  expect(after.stage).toBe('scrambled');
  expect(after.lastCaseId).toBe(s.pick.caseId);
});

test('consecutive attempts never repeat the case (3 selected)', () => {
  const rand = mulberry32(3);
  let s = newAttempt(null, selected, rand);
  for (let i = 0; i < 30; i++) {
    const prevCase = s.pick.caseId;
    s = newAttempt(s, selected, rand);
    expect(s.pick.caseId).not.toBe(prevCase);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/ui/train/flow.test.ts` → FAIL.

- [ ] **Step 3: Implement the reducer**

`src/ui/train/flow.ts`:

```ts
import { createTimer, tap, type TimerState } from '../../core/timer/attempt';
import { pickAttempt, type AttemptPick } from '../../core/train/select';
import { pools } from '../../data/caseSet';

export type Stage = 'scrambled' | 'recognizing' | 'solving' | 'reveal';
export const REVEAL_DEAD_MS = 300;
export const PHASES = ['recognition', 'solve'] as const;

export interface FlowState {
  stage: Stage;
  pick: AttemptPick;
  timer: TimerState;
  revealAt: number;
  lastCaseId?: string;
  lastVariantByCase: Record<string, string>;
}

export function newAttempt(
  prev: Pick<FlowState, 'lastCaseId' | 'lastVariantByCase'> | null,
  selected: string[],
  rand: () => number,
): FlowState {
  const lastVariantByCase = prev?.lastVariantByCase ?? {};
  const pick = pickAttempt({ selected, pools, lastCaseId: prev?.lastCaseId, lastVariantByCase, rand });
  return {
    stage: 'scrambled',
    pick,
    timer: createTimer(PHASES),
    revealAt: 0,
    lastCaseId: pick.caseId,
    lastVariantByCase: { ...lastVariantByCase, [pick.caseId]: pick.variant },
  };
}

export function tapZone(s: FlowState, selected: string[], rand: () => number, now: number): FlowState {
  if (s.stage === 'scrambled') return { ...s, stage: 'recognizing', timer: tap(s.timer, now) };
  if (s.stage === 'recognizing') return { ...s, stage: 'solving', timer: tap(s.timer, now) };
  if (s.stage === 'solving') return { ...s, stage: 'reveal', timer: tap(s.timer, now), revealAt: now };
  if (now - s.revealAt < REVEAL_DEAD_MS) return s;
  return newAttempt(s, selected, rand);
}
```

Run: `npx vitest run src/ui/train/flow.test.ts` → 3 PASS.

- [ ] **Step 4: Build the screen**

`src/ui/screens/TrainScreen.svelte`:

```svelte
<script lang="ts">
  import CaseDiagram from '../CaseDiagram.svelte';
  import { caseById } from '../../data/caseSet';
  import { activeAlg, getCaseSelection } from '../../data/settings';
  import { db, type Flag } from '../../data/db';
  import { sessionForAttempt } from '../../data/sessions';
  import { splits, totalMs } from '../../core/timer/attempt';
  import { mulberry32 } from '../../core/rng';
  import { navigate } from '../router.svelte';
  import { newAttempt, tapZone, type FlowState } from '../train/flow';

  const rand = mulberry32(Date.now() >>> 0);

  let selected = $state<string[]>([]);
  let flow = $state<FlowState | null>(null);
  let attemptId = $state<number | null>(null);
  let flag = $state<Flag>('ok');
  let revealAlg = $state('');
  let now = $state(0);
  let sessionCount = $state(0);

  $effect(() => {
    getCaseSelection().then(ids => {
      selected = ids;
      if (ids.length >= 2) flow = newAttempt(null, ids, rand);
    });
  });

  $effect(() => {
    if (flow?.stage !== 'recognizing' && flow?.stage !== 'solving') return;
    let raf = 0;
    const tick = () => { now = Date.now(); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  function fmt(ms: number): string {
    return (ms / 1000).toFixed(2);
  }

  async function onTap() {
    if (!flow) return;
    const t = Date.now();
    const before = flow;
    const next = tapZone(before, selected, rand, t);
    if (next === before) return;
    flow = next;
    if (next.stage === 'reveal') {
      flag = 'ok';
      revealAlg = await activeAlg(next.pick.caseId);
      const sessionId = await sessionForAttempt('case', selected, t);
      attemptId = (await db.attempts.add({
        sessionId, mode: 'case', caseId: next.pick.caseId, scramble: next.pick.scramble,
        startedAt: next.timer.startedAt, splits: splits(next.timer),
        totalMs: totalMs(next.timer), flag: 'ok',
      })) as number;
      sessionCount += 1;
    }
  }

  function abort() {
    if (!flow) return;
    flow = newAttempt(flow, selected, rand);
  }

  async function setFlag(f: Flag) {
    flag = f;
    if (attemptId !== null) await db.attempts.update(attemptId, { flag: f });
  }

  const c = $derived(flow ? caseById.get(flow.pick.caseId) : undefined);
</script>

<div class="screen train">
  {#if selected.length < 2}
    <div class="empty">
      <p>Select at least 2 cases to train.</p>
      <button class="primary" onclick={() => navigate('/cases')}>Choose cases</button>
    </div>
  {:else if flow}
    <header>
      <span class="dim">{sessionCount} this session</span>
      <button class="abort" onclick={abort}>abort</button>
    </header>
    <button class="zone" onpointerdown={onTap}>
      {#if flow.stage === 'scrambled'}
        <p class="hint">execute, then tap to start recognition</p>
        <p class="scramble">{flow.pick.scramble}</p>
      {:else if flow.stage === 'recognizing'}
        <p class="clock">{fmt(now - flow.timer.startedAt)}</p>
        <p class="hint">recognizing — tap when you start turning</p>
      {:else if flow.stage === 'solving'}
        <p class="clock">{fmt(now - flow.timer.boundaries[0])}</p>
        <p class="hint">solving — tap when done</p>
      {:else if c}
        <div class="reveal">
          <CaseDiagram pattern={c.pattern} size={96} />
          <h2>{c.name} <span class="dim">#{c.oll}</span></h2>
          <p class="alg">{revealAlg}</p>
          {#if c.triggers}<p class="dim">{c.triggers}</p>{/if}
          <div class="splits">
            {#each splits(flow.timer) as sp}
              <span>{sp.label} <b>{fmt(sp.ms)}</b></span>
            {/each}
            <span>total <b>{fmt(totalMs(flow.timer))}</b></span>
          </div>
        </div>
      {/if}
    </button>
    {#if flow.stage === 'reveal'}
      <footer>
        <div class="flags">
          <button class:on={flag === 'ok'} onclick={() => setFlag('ok')}>OK</button>
          <button class:on={flag === 'misrecognized'} onclick={() => setFlag('misrecognized')}>misrec.</button>
          <button class:on={flag === 'dnf'} onclick={() => setFlag('dnf')}>DNF</button>
        </div>
        <button class="primary next" onpointerdown={onTap}>Next</button>
      </footer>
    {/if}
  {/if}
</div>

<style>
  .train { display: flex; flex-direction: column; }
  .empty { margin: auto; text-align: center; display: grid; gap: 12px; }
  header { display: flex; justify-content: space-between; align-items: center; }
  .abort {
    background: none; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 12px var(--font-ui); padding: 4px 10px; cursor: pointer;
  }
  .zone {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; background: none; border: 0; color: var(--text); cursor: pointer;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;
  }
  .hint { color: var(--dim); font-size: 13px; }
  .scramble { font: 600 26px/1.6 var(--font-mono); max-width: 22ch; }
  .clock { font: 600 64px var(--font-mono); font-variant-numeric: tabular-nums; }
  .reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .reveal h2 { font-size: 20px; }
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 26ch; }
  .splits { display: flex; gap: 14px; color: var(--dim); font-size: 13px; margin-top: 4px; }
  .splits b { color: var(--text); font-family: var(--font-mono); }
  footer { display: grid; gap: 10px; padding-bottom: 8px; }
  .flags { display: flex; gap: 8px; }
  .flags button {
    flex: 1; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 13px var(--font-ui); padding: 10px 0; cursor: pointer;
  }
  .flags button.on { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
  .primary {
    background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 15px var(--font-ui); padding: 14px 0; cursor: pointer;
  }
</style>
```

- [ ] **Step 5: Verify**

Run: `npm test` (flow tests + all prior), `npm run check`, `npm run build` — green. Manual pass in a mobile viewport, full loop: scramble shown in mono → tap → running clock → tap → running clock → tap → reveal with diagram/name/number/alg/splits → flag buttons work → Next (or tap anywhere after 300 ms) deals a new scramble → abort deals a new scramble without recording. Confirm in devtools → Application → IndexedDB that attempts rows appear with splits and flags. Phone check: the loop is comfortably one-thumb operable.

- [ ] **Step 6: Commit**

```bash
git add src/ui/train src/ui/screens/TrainScreen.svelte
git commit -m "feat(ui): four-state training loop with persistence and flags"
```

---

### Task 10: Wake lock, vibration, Settings screen

**Files:**
- Create: `src/ui/wakeLock.ts`
- Modify: `src/ui/screens/TrainScreen.svelte` (wake lock + vibration hooks), `src/ui/screens/SettingsScreen.svelte` (replace placeholder), `src/main.ts` (first-run storage persist)
- Test: none new (browser APIs; logic is trivial glue — the guard + existing suites still run)

**Interfaces:**
- Consumes: Wake Lock API, Vibration API, `navigator.storage`, `getSetting`/`setSetting`.
- Produces:
  - `wakeLock.ts`: `acquireWakeLock(): Promise<void>`, `releaseWakeLock(): Promise<void>` — no-ops when unsupported; re-acquires on `visibilitychange` while held.
  - Setting keys later plans rely on: `vibration` (boolean, default true), `storagePersisted` (boolean — result of the one-time `navigator.storage.persist()` request).

- [ ] **Step 1: Implement wake lock util**

`src/ui/wakeLock.ts`:

```ts
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function request(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
  } catch {
    sentinel = null; // denied (e.g. battery saver) — non-fatal
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wanted && document.visibilityState === 'visible') void request();
  });
}

export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  await request();
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  await sentinel?.release();
  sentinel = null;
}
```

- [ ] **Step 2: Hook into TrainScreen**

In `TrainScreen.svelte`'s script, add:

```ts
import { acquireWakeLock, releaseWakeLock } from '../wakeLock';
import { getSetting } from '../../data/settings';
import { endActiveSession } from '../../data/sessions';

let vibration = $state(true);

$effect(() => {
  void acquireWakeLock();
  getSetting('vibration', true).then(v => { vibration = v; });
  return () => {
    void releaseWakeLock();
    void endActiveSession(Date.now());
  };
});
```

And at the top of `onTap`, after the `flow` null check:

```ts
if (vibration && 'vibrate' in navigator) navigator.vibrate(10);
```

- [ ] **Step 3: Settings screen + first-run persist**

`src/ui/screens/SettingsScreen.svelte`:

```svelte
<script lang="ts">
  import { getSetting, setSetting } from '../../data/settings';
  import { navigate } from '../router.svelte';

  let vibration = $state(true);
  let persisted = $state<boolean | null>(null);
  let usage = $state('');

  $effect(() => {
    getSetting('vibration', true).then(v => { vibration = v; });
    getSetting<boolean | null>('storagePersisted', null).then(p => { persisted = p; });
    navigator.storage?.estimate?.().then(e => {
      if (e.usage != null) usage = `${(e.usage / 1024 / 1024).toFixed(1)} MB used`;
    });
  });

  function toggleVibration() {
    vibration = !vibration;
    void setSetting('vibration', vibration);
  }
</script>

<div class="screen">
  <h1>Settings</h1>
  <section>
    <button class="row" onclick={() => navigate('/cases')}>
      <span>Case selection</span><span class="dim">choose on Cases tab</span>
    </button>
    <button class="row" onclick={toggleVibration}>
      <span>Vibration on tap</span><span class="dim">{vibration ? 'on' : 'off'}</span>
    </button>
    <div class="row">
      <span>Persistent storage</span>
      <span class="dim">
        {persisted === null ? 'not requested' : persisted ? 'granted' : 'denied'}{usage ? `, ${usage}` : ''}
      </span>
    </div>
  </section>
</div>

<style>
  h1 { font-size: 20px; margin-bottom: 12px; }
  section { display: grid; gap: 1px; background: var(--line); border-radius: var(--radius); overflow: hidden; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    background: var(--panel); color: var(--text); border: 0; text-align: left;
    font: 500 14px var(--font-ui); padding: 14px 14px; cursor: pointer;
  }
</style>
```

In `src/main.ts`, before `mount`:

```ts
import { getSetting, setSetting } from './data/settings';

void (async () => {
  if (await getSetting<boolean | null>('storagePersisted', null) === null && navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    await setSetting('storagePersisted', granted);
  }
})();
```

- [ ] **Step 4: Verify**

Run: `npm test`, `npm run check`, `npm run build` — green (guard test confirms no node imports snuck in). Mobile viewport: Settings shows vibration toggle + storage status; Train keeps the screen awake (verify the sentinel exists via devtools console: remains subjective on desktop — the user confirms on the phone). Full end-to-end pass of the loop on the phone at http://192.168.0.232:5173/.

- [ ] **Step 5: Commit**

```bash
git add src/ui/wakeLock.ts src/ui/screens/SettingsScreen.svelte src/ui/screens/TrainScreen.svelte src/main.ts
git commit -m "feat(ui): wake lock, vibration, settings screen, storage persist"
```

---

## Self-review notes (resolved during writing)

- **Spec coverage:** §3.1 selection UI (Task 8), §3.2 loop incl. flags/abort/wake-lock/vibration (Tasks 9–10), §4.2 runtime selection (Task 3), §5.1 schema exactly as specced (Task 4), §7.1 shell (Task 6), §7.3 one-handed rules incl. 300 ms dead-time (Task 9), §7.5 lifecycle (Task 5 + Task 10's `endActiveSession` on screen exit). Deferred Plan-1 findings closed: `check` script, browser-clean guard, CI build (Task 1). Not in this plan by design: Timer modes (Plan 3), case detail/overrides UI (Plan 4), stats (Plan 5), PWA (Plan 6).
- **Session summary** is v1-minimal here (attempt count); per-session means arrive with Plan 5's stats functions rather than duplicating aggregation logic now (YAGNI).
- **Type consistency:** `Split` lives in `core/timer/attempt.ts` and is imported by `data/db.ts`; `AttemptPick {caseId, variant, scramble}` defined once in `core/train/select.ts`; `Mode`/`Flag` in `data/db.ts`; route strings typed via `Route` union.
- **`db.test.ts` and `sessions.test.ts` share the same Dexie database name** across test files — Vitest runs files in separate workers by default, so no cross-file state bleed; the `beforeEach` clears handle within-file state.
