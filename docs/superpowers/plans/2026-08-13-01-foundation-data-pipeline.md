# Foundation & Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project scaffold, the pure logical cube core, and the build-time data pipeline that produces verified `cases.json` and `scrambles.json` for all 57 OLL cases.

**Architecture:** A facelet-permutation cube model whose move tables are generated geometrically (same math as the cube-stepper prototype), shared by the app and by repo tooling. Data flows one way: PDF text → hand-transcribed `cases.json` → pipeline derives each case's pattern and OLL number from its algorithm → pool generator solves random case states with a two-phase solver → CI verifier simulates everything against the cube model and fails the build on any mismatch.

**Tech Stack:** Vite + Svelte 5 + TypeScript (strict) + Vitest. Tools run via `tsx`. `cubejs` (pure-JS Kociemba two-phase) and `pdf-parse` are tooling-only dependencies, never shipped to the app.

**Spec:** `cube-trainer-spec.md` (repo root). This plan implements §3.1 data, §3.4 pipeline, §4.1 pools, and the §6.3 modules `core/cube` and `tools/`.

## Global Constraints

- TypeScript `strict: true` everywhere, including tools.
- `core/cube` has zero runtime dependencies (spec §6.3).
- No runtime CDN dependencies in the app; app deps and tool deps stay separate (tool-only deps are `devDependencies`).
- Scrambles: face turns only (`U D L R F B` with `'`/`2`), ≤ 14 HTM, ≥ 50 unique per case (spec §4.1).
- Case set: exactly 57 cases, each with a distinct normalized pattern (spec §2, §3.1).
- All generated JSON is checked into the repo; CI re-verifies it, never regenerates it (spec §3.4, §4.1).
- Node 22, npm. Commit after every green task.

## Plan sequence (this is Plan 1 of 6)

1. **Foundation & data pipeline** (this plan)
2. Timer core + Train loop UI
3. Full-solve + CFOP timer modes (cubing.js worker)
4. Cases reference UI + Three.js animator port + alg overrides
5. Stats
6. PWA, GitHub Pages deploy, polish

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/app.css`, `src/smoke.test.ts`, `.gitignore`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (vitest), `npm run dev`, npm scripts `gen:cases`, `gen:scrambles`, `verify` (wired to files created in later tasks).

- [ ] **Step 1: Write the config files**

`package.json`:

```json
{
  "name": "cuby",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "gen:cases": "tsx tools/gen-cases.ts",
    "gen:scrambles": "tsx tools/gen-scrambles.ts",
    "verify": "tsx tools/verify.ts"
  }
}
```

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { host: true }, // expose on the local network for phone review
  test: { include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
});
```

`svelte.config.js`:

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tools"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OLL Trainer</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts`:

```ts
import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

export default mount(App, { target: document.getElementById('app')! });
```

`src/App.svelte`:

```svelte
<h1>OLL Trainer</h1>
```

`src/app.css` (tokens lifted from cube-stepper.html so later UI plans inherit them):

```css
:root {
  --bg: #101114;
  --panel: #1a1c21;
  --panel-2: #22252c;
  --line: #2d3038;
  --text: #e8e6df;
  --dim: #7c818d;
  --accent: #ffd500;
  --accent-ink: #171102;
  --bad: #ff5a5a;
  --radius: 8px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }
```

`.gitignore`:

```
node_modules/
dist/
tools/pdf-text.txt
```

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
```

`src/smoke.test.ts`:

```ts
import { expect, test } from 'vitest';

test('vitest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 2: Install dependencies**

Run: `npm install -D svelte @sveltejs/vite-plugin-svelte vite vitest typescript svelte-check tsx`

- [ ] **Step 3: Verify test runner and dev build**

Run: `npm test` → expected: 1 passed.
Run: `npm run build` → expected: builds without error.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + Svelte 5 + TypeScript + Vitest"
```

---

### Task 2: Logical cube model with geometric move tables

**Files:**
- Create: `src/core/cube/model.ts`
- Test: `src/core/cube/model.test.ts`

**Interfaces:**
- Consumes: nothing (zero-dependency module).
- Produces:
  - `type Cube = Uint8Array` — 54 facelets, values 0–5 = origin face color. Index = `face * 9 + row * 3 + col`, faces ordered `U=0, R=1, F=2, D=3, L=4, B=5`. Layout matches the Kociemba facelet convention (U rows run back→front; F/R/B/L rows run top→bottom; D rows run front→back) so `toKociemba` is a direct map.
  - `const U, R, F, D, L, B: number` — face constants.
  - `solvedCube(): Cube`
  - `interface Move { label: string; base: string; q: number }` — q = signed net quarter turns, positive = clockwise seen from the positive axis (cube-stepper convention).
  - `applyMoves(c: Cube, moves: Move[]): Cube` — pure, returns a new cube.
  - `toKociemba(c: Cube): string` — 54-char `URFDLB` string for the two-phase solver.

**Implementation notes:** This ports cube-stepper's `BASE` move table (axis / layers / q) to a facelet permutation model. Each facelet gets a doubled-integer position (normal offset ±3, tangent offsets 0/±2) and normal vector from a per-face frame; a move's permutation is generated by rotating selected facelets' (position, normal) pairs and looking up the destination index. Doubled coordinates keep everything integer — no floats, no epsilon.

- [ ] **Step 1: Write the failing tests**

`src/core/cube/model.test.ts`:

```ts
import { expect, test } from 'vitest';
import { solvedCube, applyMoves, type Move, type Cube } from './model';

const mv = (base: string, q: number): Move => ({ label: base, base, q });

function applied(...moves: Move[]): Cube {
  return applyMoves(solvedCube(), moves);
}

test('solved cube has 9 stickers of each color', () => {
  const counts = new Array(6).fill(0);
  for (const v of solvedCube()) counts[v]++;
  expect(counts).toEqual([9, 9, 9, 9, 9, 9]);
});

test('each base move applied 4x is identity, 1x is not', () => {
  for (const base of ['U', 'D', 'L', 'R', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'r', 'l', 'u', 'd', 'f', 'b']) {
    const once = applied(mv(base, 1));
    expect(once, base).not.toEqual(solvedCube());
    const four = applyMoves(once, [mv(base, 1), mv(base, 1), mv(base, 1)]);
    expect(four, base).toEqual(solvedCube());
  }
});

test('sexy move has order 6', () => {
  let c = solvedCube();
  const sexy = [mv('R', 1), mv('U', 1), mv('R', -1), mv('U', -1)];
  for (let i = 0; i < 6; i++) c = applyMoves(c, sexy);
  expect(c).toEqual(solvedCube());
});

test('wide move equals face + inverse slice, and rotation + opposite face', () => {
  expect(applied(mv('r', 1))).toEqual(applied(mv('R', 1), mv('M', -1)));
  expect(applied(mv('r', 1))).toEqual(applied(mv('x', 1), mv('L', 1)));
});

test('q=2 equals two quarter turns', () => {
  expect(applied(mv('U', 2))).toEqual(applied(mv('U', 1), mv('U', 1)));
  expect(applied(mv('U', -2))).toEqual(applied(mv('U', 2)));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/cube/model.test.ts`
Expected: FAIL — module `./model` not found.

- [ ] **Step 3: Implement the model**

`src/core/cube/model.ts`:

```ts
export type Cube = Uint8Array;
export const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;

export interface Move { label: string; base: string; q: number }

type Vec = [number, number, number];

// Per-face frame: [normal, rowDir, colDir], chosen to match the Kociemba
// facelet layout so index order is directly the URFDLB solver string.
const FRAMES: [Vec, Vec, Vec][] = [
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]],   // U: rows back->front
  [[1, 0, 0], [0, -1, 0], [0, 0, -1]], // R: rows top->bottom, cols front->back
  [[0, 0, 1], [0, -1, 0], [1, 0, 0]],  // F: rows top->bottom, cols left->right
  [[0, -1, 0], [0, 0, -1], [1, 0, 0]], // D: rows front->back
  [[-1, 0, 0], [0, -1, 0], [0, 0, 1]], // L: rows top->bottom, cols back->front
  [[0, 0, -1], [0, -1, 0], [-1, 0, 0]],// B: rows top->bottom, cols right->left
];

// Doubled-integer sticker positions: normal offset 3, tangent steps of 2.
const POS: Vec[] = [];
const NORM: Vec[] = [];
const AT = new Map<string, number>();
for (let face = 0; face < 6; face++) {
  const [n, dr, dc] = FRAMES[face];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const p: Vec = [
        3 * n[0] + 2 * (r - 1) * dr[0] + 2 * (c - 1) * dc[0],
        3 * n[1] + 2 * (r - 1) * dr[1] + 2 * (c - 1) * dc[1],
        3 * n[2] + 2 * (r - 1) * dr[2] + 2 * (c - 1) * dc[2],
      ];
      AT.set(`${p}|${n}`, POS.length);
      POS.push(p);
      NORM.push(n);
    }
  }
}

// axis: 0=x 1=y 2=z; layers: cubie coordinates along the axis that move;
// q sign: positive = clockwise seen from the positive axis. Same table as cube-stepper.
const BASE: Record<string, { axis: 0 | 1 | 2; layers: number[]; q: number }> = {
  R: { axis: 0, layers: [1], q: 1 },  L: { axis: 0, layers: [-1], q: -1 },
  U: { axis: 1, layers: [1], q: 1 },  D: { axis: 1, layers: [-1], q: -1 },
  F: { axis: 2, layers: [1], q: 1 },  B: { axis: 2, layers: [-1], q: -1 },
  M: { axis: 0, layers: [0], q: -1 }, E: { axis: 1, layers: [0], q: -1 },
  S: { axis: 2, layers: [0], q: 1 },
  x: { axis: 0, layers: [-1, 0, 1], q: 1 },
  y: { axis: 1, layers: [-1, 0, 1], q: 1 },
  z: { axis: 2, layers: [-1, 0, 1], q: 1 },
  r: { axis: 0, layers: [0, 1], q: 1 },  l: { axis: 0, layers: [-1, 0], q: -1 },
  u: { axis: 1, layers: [0, 1], q: 1 },  d: { axis: 1, layers: [-1, 0], q: -1 },
  f: { axis: 2, layers: [0, 1], q: 1 },  b: { axis: 2, layers: [-1, 0], q: -1 },
};

// One clockwise quarter turn (seen from the positive axis) = -90° right-handed.
function rotCW(v: Vec, axis: 0 | 1 | 2): Vec {
  const [x, y, z] = v;
  if (axis === 0) return [x, z, -y];
  if (axis === 1) return [-z, y, x];
  return [y, -x, z];
}

const permCache = new Map<string, Uint8Array>();

function permFor(base: string, q: number): Uint8Array {
  const def = BASE[base];
  if (!def) throw new Error(`Unknown move base "${base}"`);
  // net clockwise quarter turns, with q interpreted in the base move's own direction
  const netTurns = (((def.q < 0 ? -q : q) % 4) + 4) % 4;
  const key = `${base}:${netTurns}`;
  const hit = permCache.get(key);
  if (hit) return hit;
  const perm = new Uint8Array(54);
  for (let i = 0; i < 54; i++) {
    const cubieCoord = Math.sign(POS[i][def.axis]);
    if (!def.layers.includes(cubieCoord)) { perm[i] = i; continue; }
    let p = POS[i], n = NORM[i];
    for (let t = 0; t < netTurns; t++) { p = rotCW(p, def.axis); n = rotCW(n, def.axis); }
    const j = AT.get(`${p}|${n}`);
    if (j === undefined) throw new Error('geometry bug: rotated facelet not found');
    perm[i] = j;
  }
  permCache.set(key, perm);
  return perm;
}

export function solvedCube(): Cube {
  const c = new Uint8Array(54);
  for (let i = 0; i < 54; i++) c[i] = Math.floor(i / 9);
  return c;
}

export function applyMoves(c: Cube, moves: Move[]): Cube {
  let cur = c;
  for (const m of moves) {
    const perm = permFor(m.base, m.q);
    const next = new Uint8Array(54);
    for (let i = 0; i < 54; i++) next[perm[i]] = cur[i];
    cur = next;
  }
  return cur;
}

export function toKociemba(c: Cube): string {
  let s = '';
  for (const v of c) s += 'URFDLB'[v];
  return s;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/cube/model.test.ts`
Expected: all 5 tests PASS. If `wide move equals...` fails, the FRAMES orientation or rotCW sign is off — debug with a single `U` on a solved cube: facelets of F row0 must land on L row0.

- [ ] **Step 5: Commit**

```bash
git add src/core/cube/model.ts src/core/cube/model.test.ts
git commit -m "feat(core): facelet cube model with geometric move tables"
```

---

### Task 3: Notation parser

**Files:**
- Create: `src/core/cube/parser.ts`
- Test: `src/core/cube/parser.test.ts`

**Interfaces:**
- Consumes: `Move` type from `./model`.
- Produces:
  - `parseAlg(text: string): Move[]` — throws `Error` with a `Can't read "<token>"` message on bad input. Accepts face/wide/slice/rotation moves, `Rw` wide style, primes, doubles, parentheses/brackets/commas as ignorable grouping.
  - `invert(moves: Move[]): Move[]`
  - `applyAlg(c: Cube, alg: string): Cube` — convenience: parse + applyMoves.
  - `toAlgString(moves: Move[]): string` — labels joined by spaces, regenerated from base/q (not original labels), e.g. q=-2 renders as `U2`.

- [ ] **Step 1: Write the failing tests**

`src/core/cube/parser.test.ts`:

```ts
import { expect, test } from 'vitest';
import { parseAlg, invert, applyAlg, toAlgString } from './parser';
import { solvedCube } from './model';

test('parses triggers with parentheses and wide notation', () => {
  const moves = parseAlg("F (R U R' U') F'");
  expect(moves.map(m => m.base)).toEqual(['F', 'R', 'U', 'R', 'U', 'F']);
  expect(parseAlg('Rw2')[0]).toMatchObject({ base: 'r', q: 2 });
  expect(parseAlg("M2'")[0].q).toBeTypeOf('number');
});

test('rejects garbage tokens', () => {
  expect(() => parseAlg('R T U')).toThrowError(/Can't read "T"/);
});

test('invert reverses and flips', () => {
  expect(toAlgString(invert(parseAlg("R U2 F'")))).toBe("F U2 R'");
});

test('alg then inverse returns to solved', () => {
  const alg = "r U R' U' M (U R U' R')";
  const c = applyAlg(solvedCube(), alg);
  expect(c).not.toEqual(solvedCube());
  expect(applyAlg(c, toAlgString(invert(parseAlg(alg))))).toEqual(solvedCube());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/cube/parser.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/core/cube/parser.ts` (regex and semantics ported from cube-stepper.html `parseAlg`):

```ts
import { applyMoves, type Cube, type Move } from './model';

const TOKEN = /^([RLUDFBMES]|[rludfbxyz]|[RLUDFB]w|[XYZ])(2)?(')?(2)?$/;

export function parseAlg(text: string): Move[] {
  const cleaned = text.replace(/[(),[\]]/g, ' ').trim();
  if (!cleaned) return [];
  const moves: Move[] = [];
  for (const raw of cleaned.split(/\s+/)) {
    const m = raw.match(TOKEN);
    if (!m) throw new Error(`Can't read "${raw}"`);
    let base = m[1];
    if (base.length === 2 && base[1] === 'w') base = base[0].toLowerCase(); // Rw -> r
    if ('XYZ'.includes(base)) base = base.toLowerCase();
    let q = m[2] || m[4] ? 2 : 1;
    if (m[3]) q = -q;
    moves.push({ label: raw, base, q });
  }
  return moves;
}

export function invert(moves: Move[]): Move[] {
  return moves.slice().reverse().map(m => ({ ...m, q: -m.q, label: labelFor(m.base, -m.q) }));
}

function labelFor(base: string, q: number): string {
  const abs = Math.abs(q) === 2 ? '2' : '';
  const prime = Math.abs(q) === 2 ? '' : q < 0 ? "'" : '';
  return base + abs + prime;
}

export function toAlgString(moves: Move[]): string {
  return moves.map(m => labelFor(m.base, m.q)).join(' ');
}

export function applyAlg(c: Cube, alg: string): Cube {
  return applyMoves(c, parseAlg(alg));
}
```

Note `labelFor` collapses `q = -2` to `2` (a half turn has no direction); `toAlgString` therefore normalizes `U2'` → `U2`, which is intended.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/cube/parser.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/cube/parser.ts src/core/cube/parser.test.ts
git commit -m "feat(core): notation parser, invert, applyAlg"
```

---

### Task 4: OLL pattern extraction, orientation helpers, F2L check

**Files:**
- Create: `src/core/cube/pattern.ts`
- Test: `src/core/cube/pattern.test.ts`

**Interfaces:**
- Consumes: `model.ts`, `parser.ts`.
- Produces:
  - `ollPattern(c: Cube): string` — 21 chars of `1`/`0`: the 9 U facelets row-major, then the 12 top-ring side facelets in order F row0 (left→right), R row0, B row0, L row0. `1` = facelet color equals the U-center color. This string is also the diagram data (spec §6.3).
  - `normalizedOllPattern(c: Cube): string` — lexicographic minimum of the pattern over the 4 AUF rotations. Case identity (spec §2).
  - `f2lSolved(c: Cube): boolean` — D face and rows 1–2 of F/R/B/L each match their own center (center-relative, so it works after `y` rotations).
  - `orientYellowUp(c: Cube): Cube` — applies the whole-cube rotation that brings the facelet-color of the original U center back to the U face (needed after algs containing unbalanced rotations, e.g. Wario's `x`).

- [ ] **Step 1: Write the failing tests**

`src/core/cube/pattern.test.ts`:

```ts
import { expect, test } from 'vitest';
import { ollPattern, normalizedOllPattern, f2lSolved, orientYellowUp } from './pattern';
import { solvedCube, U } from './model';
import { applyAlg, invert, parseAlg, toAlgString } from './parser';

const SUNE = "R U R' U R U2' R'";
const inverse = (alg: string) => toAlgString(invert(parseAlg(alg)));

test('solved cube pattern: all top yellow, empty ring', () => {
  expect(ollPattern(solvedCube())).toBe('111111111' + '000000000000');
});

test('inverse Sune creates the Sune case: 6 yellow on top, 3 in ring', () => {
  const c = applyAlg(solvedCube(), inverse(SUNE));
  const p = ollPattern(c);
  expect(f2lSolved(c)).toBe(true);
  expect([...p.slice(0, 9)].filter(x => x === '1').length).toBe(6); // center + 4 edges + 1 corner
  expect([...p.slice(9)].filter(x => x === '1').length).toBe(3);    // 3 misoriented corners point sideways
});

test('normalized pattern is AUF-invariant', () => {
  const c = applyAlg(solvedCube(), inverse(SUNE));
  expect(normalizedOllPattern(applyAlg(c, 'U2'))).toBe(normalizedOllPattern(c));
  expect(normalizedOllPattern(applyAlg(c, "U'"))).toBe(normalizedOllPattern(c));
});

test('f2lSolved is false after R, true after y rotation of solved', () => {
  expect(f2lSolved(applyAlg(solvedCube(), 'R'))).toBe(false);
  expect(f2lSolved(applyAlg(solvedCube(), 'y'))).toBe(true);
});

test('orientYellowUp undoes a net rotation', () => {
  const c = applyAlg(solvedCube(), 'x z2');
  expect(orientYellowUp(c)[4]).toBe(U); // U center is U-colored again
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/cube/pattern.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/core/cube/pattern.ts`:

```ts
import { U, type Cube } from './model';
import { applyAlg } from './parser';

// Top-ring side facelets: F row0, R row0, B row0, L row0 (left→right within each face)
const RING = [18, 19, 20, 9, 10, 11, 45, 46, 47, 36, 37, 38];

export function ollPattern(c: Cube): string {
  const top = c[U * 9 + 4];
  let s = '';
  for (let i = 0; i < 9; i++) s += c[i] === top ? '1' : '0';
  for (const i of RING) s += c[i] === top ? '1' : '0';
  return s;
}

export function normalizedOllPattern(c: Cube): string {
  let cur = c, best = ollPattern(c);
  for (let k = 0; k < 3; k++) {
    cur = applyAlg(cur, 'U');
    const p = ollPattern(cur);
    if (p < best) best = p;
  }
  return best;
}

export function f2lSolved(c: Cube): boolean {
  for (const face of [2, 1, 5, 4]) {          // F R B L
    const center = c[face * 9 + 4];
    for (let i = 3; i < 9; i++) if (c[face * 9 + i] !== center) return false;
  }
  const dc = c[3 * 9 + 4];
  for (let i = 0; i < 9; i++) if (c[3 * 9 + i] !== dc) return false;
  return true;
}

const CENTERS = [4, 13, 22, 31, 40, 49]; // U R F D L B center indices

export function orientYellowUp(c: Cube): Cube {
  const target = U; // yellow = original U color
  for (let face = 0; face < 6; face++) {
    if (c[CENTERS[face]] === target) {
      // face currently holding the yellow center -> rotation that moves it to U
      const fix = ['', "z'", 'x', 'x2', 'z', "x'"][face];
      return fix ? applyAlg(c, fix) : c;
    }
  }
  throw new Error('no yellow center found');
}
```

**Careful with the rotation lookup table** — derive each entry of `fix` by asking "yellow center sits on face X; which single rotation moves face X's center to U?": R→`z'`, F→`x`, D→`x2`, L→`z`, B→`x'`. The test in Step 1 plus the Task 8 verifier (which round-trips all 57 secondary algs, several containing rotations) will catch any wrong entry.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/cube/pattern.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/cube/pattern.ts src/core/cube/pattern.test.ts
git commit -m "feat(core): OLL pattern extraction, AUF normalization, F2L check"
```

---

### Task 5: Random PLL-state builder + seeded RNG

**Files:**
- Create: `src/core/cube/pll.ts`, `src/core/rng.ts`
- Test: `src/core/cube/pll.test.ts`

**Interfaces:**
- Consumes: `model.ts`, `pattern.ts`.
- Produces:
  - `mulberry32(seed: number): () => number` in `src/core/rng.ts` — deterministic PRNG returning floats in [0, 1).
  - `randomPllState(rand: () => number): Cube` — F2L solved, all LL pieces oriented (yellow up), LL permutation uniform over the 288 parity-valid permutations. This is the "randomized LL permutation" input of spec §4.1.

- [ ] **Step 1: Write the failing tests**

`src/core/cube/pll.test.ts`:

```ts
import { expect, test } from 'vitest';
import { randomPllState } from './pll';
import { mulberry32 } from '../rng';
import { f2lSolved, ollPattern } from './pattern';
import { solvedCube } from './model';

test('every PLL state keeps F2L solved and all LL pieces oriented', () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 200; i++) {
    const c = randomPllState(rand);
    expect(f2lSolved(c)).toBe(true);
    expect(ollPattern(c)).toBe(ollPattern(solvedCube()));
  }
});

test('states vary and generation is deterministic per seed', () => {
  const a = new Set<string>(), rand = mulberry32(7);
  for (let i = 0; i < 100; i++) a.add(randomPllState(rand).join(','));
  expect(a.size).toBeGreaterThan(20);
  const r1 = mulberry32(99), r2 = mulberry32(99);
  expect(randomPllState(r1)).toEqual(randomPllState(r2));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/cube/pll.test.ts` — expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/core/rng.ts`:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/core/cube/pll.ts`:

```ts
import { solvedCube, type Cube } from './model';

// LL slots as facelet index groups, sticker order [U-facelet, then clockwise viewed from above]
const CORNERS = [
  [8, 9, 20],  // URF: U,R,F
  [6, 18, 38], // UFL: U,F,L
  [0, 36, 47], // ULB: U,L,B
  [2, 45, 11], // UBR: U,B,R
];
const EDGES = [
  [7, 19], // UF
  [5, 10], // UR
  [1, 46], // UB
  [3, 37], // UL
];

function shuffle(rand: () => number): number[] {
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function parity(p: number[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) s ^= 1;
  return s;
}

export function randomPllState(rand: () => number): Cube {
  const cp = shuffle(rand);
  const ep = shuffle(rand);
  if (parity(cp) !== parity(ep)) [ep[0], ep[1]] = [ep[1], ep[0]]; // parity fix, bijective so uniformity holds
  const base = solvedCube();
  const out = base.slice();
  CORNERS.forEach((slot, i) => slot.forEach((f, k) => { out[f] = base[CORNERS[cp[i]][k]]; }));
  EDGES.forEach((slot, i) => slot.forEach((f, k) => { out[f] = base[EDGES[ep[i]][k]]; }));
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/cube/pll.test.ts` — expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/rng.ts src/core/cube/pll.ts src/core/cube/pll.test.ts
git commit -m "feat(core): seeded RNG and uniform random PLL-state builder"
```

---

### Task 6: PDF text extraction + hand-transcribed cases.json

**Files:**
- Create: `tools/extract-pdf-text.ts`, `data/cases.json`
- Test: `tools/cases-schema.test.ts`

**Interfaces:**
- Consumes: `OLL in one month.pdf` (repo root).
- Produces: `data/cases.json` with this exact shape (later tasks and the app depend on these field names):

```jsonc
{
  "version": 1,
  "set": "oll",
  "groups": [ { "id": "oriented-edges", "name": "Oriented Edges (OCLL)" } /* ordered, 14 groups */ ],
  "cases": [
    {
      "id": "sune",                       // kebab-case of name, unique
      "name": "Sune",
      "group": "oriented-edges",          // references groups[].id
      "primary": "R U R' U R U2' R'",
      "secondary": "y' R' U2' R U R' U R", // optional
      "triggers": "Dopest alg of them all",// optional: the PDF's shorthand/trigger line
      "notes": "",                         // optional: the PDF's notes line
      "easy": false                        // true for the 8 "Easy Algs" preview cases
      // "pattern" and "oll" are ADDED BY Task 8's generator — absent in this task
    }
  ]
}
```

**Group decision (documented deviation from spec §3.1):** the PDF's "Easy Algs" page previews 8 cases that all also appear in their shape groups. Since a case belongs to exactly one group (spec §2), ownership groups are the 14 shape groups (Oriented Edges → Dot cases, in PDF order) and the preview is captured as `easy: true` on those 8 cases (T, Key, Breakneck, Seein' Headlights, Ant, P, Mounted Fish, Big Lightning).

- [ ] **Step 1: Write the extraction script**

Run `npm install -D pdf-parse` first. `tools/extract-pdf-text.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import pdf from 'pdf-parse';

const buf = readFileSync('OLL in one month.pdf');
const { text } = await pdf(buf);
writeFileSync('tools/pdf-text.txt', text);
console.log('wrote tools/pdf-text.txt,', text.length, 'chars');
```

Run: `npx tsx tools/extract-pdf-text.ts` — expected: file written. (If `pdf-parse`'s default export shape differs, check its README in `node_modules/pdf-parse`; the call is one function taking a Buffer.)

- [ ] **Step 2: Write the failing schema test**

`tools/cases-schema.test.ts`:

```ts
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseAlg } from '../src/core/cube/parser';

const db = JSON.parse(readFileSync('data/cases.json', 'utf8'));

test('57 cases, unique ids, valid group refs', () => {
  expect(db.cases).toHaveLength(57);
  const ids = new Set(db.cases.map((c: { id: string }) => c.id));
  expect(ids.size).toBe(57);
  const groupIds = new Set(db.groups.map((g: { id: string }) => g.id));
  expect(groupIds.size).toBe(14);
  for (const c of db.cases) expect(groupIds.has(c.group), c.id).toBe(true);
});

test('exactly 8 easy cases', () => {
  expect(db.cases.filter((c: { easy?: boolean }) => c.easy)).toHaveLength(8);
});

test('all algorithms parse', () => {
  for (const c of db.cases) {
    expect(() => parseAlg(c.primary), `${c.id} primary`).not.toThrow();
    if (c.secondary) expect(() => parseAlg(c.secondary), `${c.id} secondary`).not.toThrow();
  }
});
```

Run: `npx vitest run tools/cases-schema.test.ts` — expected: FAIL, `data/cases.json` missing.

- [ ] **Step 3: Transcribe data/cases.json from tools/pdf-text.txt**

Read `tools/pdf-text.txt` and transcribe every case in PDF order into the schema above. This is data entry from the source document, gated by the pipeline: typos in algorithms are caught by Task 8 (patterns won't match between primary and secondary, or won't be 57 distinct patterns). Rules:

- One entry per *distinct* case; skip the Easy Algs page duplicates but set `easy: true` on those 8.
- Where the extracted text is garbled (e.g. the "X, aka Super lip" secondary is missing a closing paren in extraction), fix it to valid notation by reading the PDF visually.
- `secondary` / `triggers` / `notes` empty-string or omitted when the PDF has none.
- Group ids (ordered): `oriented-edges`, `t-shapes`, `squares`, `solved-corners`, `lightning-bolts`, `p-shapes`, `c-shapes`, `fishes`, `l-shapes`, `w-shapes`, `lines`, `knight-moves`, `awkward-shapes`, `dot-cases` — names as in spec §3.1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tools/cases-schema.test.ts` — expected: 3 PASS. If the case count isn't 57, re-check the PDF group pages for missed entries (page-boundary cases are easy to drop).

- [ ] **Step 5: Commit**

```bash
git add tools/extract-pdf-text.ts tools/cases-schema.test.ts data/cases.json package.json package-lock.json
git commit -m "feat(data): transcribe OLL cases from PDF into cases.json"
```

---

### Task 7: Canonical OLL 1–57 number table

**Files:**
- Create: `tools/oll-canonical.ts`
- Test: `tools/oll-canonical.test.ts`

**Interfaces:**
- Consumes: `core/cube` (parser, pattern).
- Produces:
  - `CANONICAL_OLL: Record<number, string>` — one well-known reference algorithm per OLL number 1–57.
  - `canonicalPatternTable(): Map<string, number>` — normalized pattern → OLL number, built by inverse-applying each reference alg (this is the matching table of spec §3.4).

- [ ] **Step 1: Source the reference algorithms**

Fetch the standard algorithm list from the speedsolving wiki OLL page (`https://www.speedsolving.com/wiki/index.php/OLL`) — one algorithm per numbered case, any of the listed algs works since only the *pattern* it produces matters. Write them into `tools/oll-canonical.ts`:

```ts
export const CANONICAL_OLL: Record<number, string> = {
  1: "R U2 R2 F R F' U2 R' F R F'",
  2: "...", // ... all 57 entries, transcribed from the wiki
};
```

```ts
import { solvedCube } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { normalizedOllPattern, orientYellowUp } from '../src/core/cube/pattern';

export function canonicalPatternTable(): Map<string, number> {
  const table = new Map<string, number>();
  for (const [num, alg] of Object.entries(CANONICAL_OLL)) {
    const state = orientYellowUp(applyAlg(solvedCube(), toAlgString(invert(parseAlg(alg)))));
    table.set(normalizedOllPattern(state), Number(num));
  }
  return table;
}
```

- [ ] **Step 2: Write the failing structural tests**

`tools/oll-canonical.test.ts`:

```ts
import { expect, test } from 'vitest';
import { CANONICAL_OLL, canonicalPatternTable } from './oll-canonical';

test('57 entries producing 57 distinct patterns', () => {
  expect(Object.keys(CANONICAL_OLL)).toHaveLength(57);
  expect(canonicalPatternTable().size).toBe(57);
});

test('known invariants: dot cases have 0 oriented edges, OCLL has 4', () => {
  const byNumber = new Map([...canonicalPatternTable()].map(([p, n]) => [n, p]));
  const orientedEdges = (p: string) => [p[1], p[3], p[5], p[7]].filter(x => x === '1').length;
  for (const n of [1, 2, 3, 4, 17, 18, 19, 20]) expect(orientedEdges(byNumber.get(n)!), `OLL ${n}`).toBe(0);
  for (const n of [21, 22, 23, 24, 25, 26, 27]) expect(orientedEdges(byNumber.get(n)!), `OLL ${n}`).toBe(4);
});
```

**Invariant caveat:** `normalizedOllPattern` picks a lexicographic-minimum AUF rotation, which permutes which U indices hold edges vs corners — it does NOT permute edges into corner positions. U indices 1, 3, 5, 7 are always the four edge stickers under any U rotation, so the invariant test is rotation-safe.

Run: `npx vitest run tools/oll-canonical.test.ts` — expected: FAIL until the table is complete; a wrong/typoed wiki alg shows up as a duplicate pattern (size < 57) or a failed invariant. Fix by re-checking that alg against the wiki.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run tools/oll-canonical.test.ts` — expected: 2 PASS.

- [ ] **Step 4: Commit**

```bash
git add tools/oll-canonical.ts tools/oll-canonical.test.ts
git commit -m "feat(tools): canonical OLL number table derived from reference algs"
```

---

### Task 8: Case enrichment generator (pattern + OLL number)

**Files:**
- Create: `tools/gen-cases.ts`, `tools/enrich.ts`
- Modify: `data/cases.json` (enriched output)
- Test: `tools/enrich.test.ts`

**Interfaces:**
- Consumes: `data/cases.json` (Task 6), `canonicalPatternTable` (Task 7), `core/cube`.
- Produces:
  - `enrichCases(db: CasesDb): CasesDb` in `tools/enrich.ts` — pure; returns db with `pattern` (display pattern: 21-char string from inverse-applying `primary`, un-normalized) and `oll` (number) filled in on every case. Throws with the case id in the message if: primary and secondary produce different normalized patterns, F2L is broken after inverse-applying (bad alg), a pattern matches no canonical number, or two cases collide on the same normalized pattern.
  - `type CasesDb` — the cases.json shape, exported from `tools/enrich.ts`.
  - `npm run gen:cases` — reads, enriches, writes `data/cases.json` back (2-space indent). Idempotent.

- [ ] **Step 1: Write the failing test**

`tools/enrich.test.ts`:

```ts
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { enrichCases, type CasesDb } from './enrich';

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));

test('enrichment assigns a distinct number and pattern to all 57 cases', () => {
  const out = enrichCases(db);
  const numbers = new Set(out.cases.map(c => c.oll));
  expect(numbers.size).toBe(57);
  for (const c of out.cases) {
    expect(c.oll, c.id).toBeGreaterThanOrEqual(1);
    expect(c.oll, c.id).toBeLessThanOrEqual(57);
    expect(c.pattern, c.id).toMatch(/^[01]{21}$/);
  }
});

test('sune is OLL 27', () => {
  const out = enrichCases(db);
  expect(out.cases.find(c => c.id === 'sune')?.oll).toBe(27);
});
```

Run: `npx vitest run tools/enrich.test.ts` — expected: FAIL, module not found.

- [ ] **Step 2: Implement**

`tools/enrich.ts`:

```ts
import { solvedCube } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { f2lSolved, normalizedOllPattern, ollPattern, orientYellowUp } from '../src/core/cube/pattern';
import { canonicalPatternTable } from './oll-canonical';

export interface CaseEntry {
  id: string; name: string; group: string; primary: string;
  secondary?: string; triggers?: string; notes?: string; easy?: boolean;
  pattern?: string; oll?: number;
}
export interface CasesDb { version: number; set: string; groups: { id: string; name: string }[]; cases: CaseEntry[] }

function caseState(alg: string) {
  const state = orientYellowUp(applyAlg(solvedCube(), toAlgString(invert(parseAlg(alg)))));
  if (!f2lSolved(state)) throw new Error('alg does not preserve F2L');
  return state;
}

export function enrichCases(db: CasesDb): CasesDb {
  const table = canonicalPatternTable();
  const seen = new Map<string, string>();
  const cases = db.cases.map(c => {
    try {
      const state = caseState(c.primary);
      const norm = normalizedOllPattern(state);
      if (c.secondary && normalizedOllPattern(caseState(c.secondary)) !== norm)
        throw new Error('secondary alg produces a different case');
      const prev = seen.get(norm);
      if (prev) throw new Error(`same pattern as case "${prev}"`);
      seen.set(norm, c.id);
      const oll = table.get(norm);
      if (!oll) throw new Error('pattern matches no canonical OLL number');
      return { ...c, pattern: ollPattern(state), oll };
    } catch (e) {
      throw new Error(`case "${c.id}": ${(e as Error).message}`);
    }
  });
  return { ...db, cases };
}
```

`tools/gen-cases.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { enrichCases, type CasesDb } from './enrich';

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));
writeFileSync('data/cases.json', JSON.stringify(enrichCases(db), null, 2) + '\n');
console.log('enriched data/cases.json');
```

- [ ] **Step 3: Run the generator, fix transcription errors until green**

Run: `npx vitest run tools/enrich.test.ts` and `npm run gen:cases`.
Expected: errors initially — every message names the offending case id. Fix `data/cases.json` algorithms against the PDF (this is the self-detecting-typos property of spec §3.4 doing its job). Loop until both pass and `npm run gen:cases` is idempotent (running twice produces no diff).

- [ ] **Step 4: Commit**

```bash
git add tools/enrich.ts tools/gen-cases.ts tools/enrich.test.ts data/cases.json
git commit -m "feat(tools): derive case patterns and OLL numbers from algorithms"
```

---

### Task 9: Scramble pool generator

**Files:**
- Create: `tools/gen-scrambles.ts`, `tools/cubejs.d.ts`
- Create: `data/scrambles.json`

**Interfaces:**
- Consumes: enriched `data/cases.json`, `randomPllState`, `mulberry32`, `core/cube`, `cubejs` (devDependency).
- Produces: `data/scrambles.json`:

```jsonc
{ "version": 1, "seed": 20260813, "pools": { "sune": ["R U2 R' ...", /* ≥50 unique */] } }
```

- [ ] **Step 1: Install and declare cubejs**

Run: `npm install -D cubejs`. Create `tools/cubejs.d.ts`:

```ts
declare module 'cubejs' {
  export default class Cube {
    static initSolver(): void;
    static fromString(s: string): Cube;
    solve(maxDepth?: number): string;
  }
}
```

Check the actual API against `node_modules/cubejs/README.md` before relying on it (`fromString` takes the 54-char Kociemba facelet string that `toKociemba` produces; `initSolver` takes a few seconds once per process). Adjust the declaration if the README disagrees.

- [ ] **Step 2: Implement the generator**

`tools/gen-scrambles.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import Cube from 'cubejs';
import { solvedCube, toKociemba } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { f2lSolved, normalizedOllPattern } from '../src/core/cube/pattern';
import { randomPllState } from '../src/core/cube/pll';
import { mulberry32 } from '../src/core/rng';
import type { CasesDb } from './enrich';

const SEED = 20260813;
const PER_CASE = 50;
const MAX_HTM = 14;
const FACE_ONLY = /^[UDLRFB]['2]?$/;

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));
Cube.initSolver();
const rand = mulberry32(SEED);
const AUFS = ['', 'U', "U'", 'U2'];
const pools: Record<string, string[]> = {};

for (const c of db.cases) {
  const targetPattern = normalizedOllPattern(applyAlg(solvedCube(), toAlgString(invert(parseAlg(c.primary)))));
  const pool = new Set<string>();
  let attempts = 0;
  while (pool.size < PER_CASE) {
    if (++attempts > PER_CASE * 40) throw new Error(`case "${c.id}": too many rejected attempts`);
    let state = randomPllState(rand);
    state = applyAlg(state, toAlgString(invert(parseAlg(c.primary))));
    const auf = AUFS[Math.floor(rand() * 4)];
    if (auf) state = applyAlg(state, auf);
    const solution = Cube.fromString(toKociemba(state)).solve(MAX_HTM).trim();
    const scramble = solution ? toAlgString(invert(parseAlg(solution))) : '';
    if (!scramble) continue;
    const moves = scramble.split(' ');
    if (moves.length > MAX_HTM || !moves.every(m => FACE_ONLY.test(m))) continue;
    // self-verify before accepting
    const check = applyAlg(solvedCube(), scramble);
    if (!f2lSolved(check) || normalizedOllPattern(check) !== targetPattern) {
      throw new Error(`case "${c.id}": generated scramble failed verification: ${scramble}`);
    }
    pool.add(scramble);
  }
  pools[c.id] = [...pool];
  console.log(`${c.id}: ${pool.size} scrambles`);
}

writeFileSync('data/scrambles.json', JSON.stringify({ version: 1, seed: SEED, pools }, null, 2) + '\n');
console.log('wrote data/scrambles.json');
```

**Why a solver library here instead of the hand-rolled IDA\* the spec sketched:** an optimal-ish solver at depth ≤14 needs Korf-style pattern databases; that's a multi-week subproject, not tooling. `cubejs` is a pure-JS Kociemba two-phase solver (no binaries, CI-friendly). For LL-only states phase 1 is nearly trivial, so ≤14 HTM solutions come back quickly; anything longer is rejected and resampled. The verification step, not the solver, carries the correctness guarantee (spec §6.4).

- [ ] **Step 3: Generate the pools**

Run: `npm run gen:scrambles` (takes a few minutes: solver init + 57 × 50 solves).
Expected: 57 lines `<case-id>: 50 scrambles`, then `wrote data/scrambles.json`. If a case throws "too many rejected attempts", raise `MAX_HTM` acceptance by allowing more solve retries per state (call `.solve(MAX_HTM)` on a re-AUF'd state) rather than raising the move budget.

- [ ] **Step 4: Spot-check determinism**

Run: `npm run gen:scrambles` again; `git diff --stat data/scrambles.json` → expected: no changes (same seed → same file).

- [ ] **Step 5: Commit**

```bash
git add tools/gen-scrambles.ts tools/cubejs.d.ts data/scrambles.json package.json package-lock.json
git commit -m "feat(tools): generate verified scramble pools for all 57 cases"
```

---

### Task 10: Full verifier + CI wiring

**Files:**
- Create: `tools/verify.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: everything above.
- Produces: `npm run verify` — exit 0 only if all checks pass; CI runs it on every push/PR. This is the mandatory gate of spec §3.4 + §4.1.

- [ ] **Step 1: Implement the verifier**

`tools/verify.ts`:

```ts
import { readFileSync } from 'node:fs';
import { solvedCube } from '../src/core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../src/core/cube/parser';
import { f2lSolved, normalizedOllPattern } from '../src/core/cube/pattern';
import { enrichCases, type CasesDb } from './enrich';

let failures = 0;
const fail = (msg: string) => { failures++; console.error('FAIL:', msg); };

const db: CasesDb = JSON.parse(readFileSync('data/cases.json', 'utf8'));

// 1. cases.json is exactly what enrichment produces (committed file is up to date)
const reEnriched = JSON.stringify(enrichCases(db), null, 2) + '\n';
if (reEnriched !== readFileSync('data/cases.json', 'utf8')) {
  fail('data/cases.json is stale — run `npm run gen:cases` and commit the result');
}

// 2. pools: every scramble face-turn-only, <=14 HTM, F2L-preserving, right case, unique
const { pools } = JSON.parse(readFileSync('data/scrambles.json', 'utf8')) as { pools: Record<string, string[]> };
const FACE_ONLY = /^[UDLRFB]['2]?$/;
for (const c of db.cases) {
  const pool = pools[c.id] ?? [];
  const target = normalizedOllPattern(applyAlg(solvedCube(), toAlgString(invert(parseAlg(c.primary)))));
  if (pool.length < 50) fail(`${c.id}: pool has ${pool.length} < 50 scrambles`);
  if (new Set(pool).size !== pool.length) fail(`${c.id}: duplicate scrambles in pool`);
  for (const s of pool) {
    const moves = s.split(' ');
    if (moves.length > 14) fail(`${c.id}: scramble longer than 14 HTM: ${s}`);
    if (!moves.every(m => FACE_ONLY.test(m))) fail(`${c.id}: non-face-turn move in: ${s}`);
    const state = applyAlg(solvedCube(), s);
    if (!f2lSolved(state)) fail(`${c.id}: scramble breaks F2L: ${s}`);
    if (normalizedOllPattern(state) !== target) fail(`${c.id}: scramble produces wrong case: ${s}`);
  }
}
const orphans = Object.keys(pools).filter(id => !db.cases.some(c => c.id === id));
for (const id of orphans) fail(`pool for unknown case id "${id}"`);

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('verify: all checks passed');
```

- [ ] **Step 2: Run it**

Run: `npm run verify` → expected: `verify: all checks passed`, exit 0. Sanity-check the failure path: temporarily edit one scramble in `data/scrambles.json`, run again, expect a FAIL line and exit 1, then `git checkout data/scrambles.json`.

- [ ] **Step 3: Wire into CI**

In `.github/workflows/ci.yml`, add after the test step:

```yaml
      - run: npm run verify
```

- [ ] **Step 4: Commit**

```bash
git add tools/verify.ts .github/workflows/ci.yml
git commit -m "feat(ci): verify cases and scramble pools on every push"
```

---

## Self-review notes (resolved during writing)

- **Spec coverage:** §3.1 data (Task 6), §3.4 derivation/verification (Tasks 7–8), §4.1 pools + CI (Tasks 9–10), §6.3 `core/cube` + `tools/` (Tasks 2–5). §4.1's "LL permutation drawn uniformly at random" is implemented exactly (parity-valid uniform sampling in Task 5). Remaining spec sections belong to Plans 2–6.
- **Deviation 1 (needs user sign-off):** solver is `cubejs` (pure-JS Kociemba) in tooling, not the custom IDA* the spec pinned. Rationale in Task 9.
- **Deviation 2 (needs user sign-off):** "Easy Algs" is a flag, not an ownership group (Task 6 rationale); ownership groups number 14, not 15.
- **Type consistency:** `Move {label, base, q}`, `Cube = Uint8Array`, `CasesDb`/`CaseEntry` are each defined once and imported everywhere else.
