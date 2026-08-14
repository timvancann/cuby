# Case Reference & Animator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The long-press case sheet becomes the full §3.4 case detail — step-through Three.js animation of the active algorithm and a validated algorithm override editor — and the Settings trigger rows animate their moves.

**Architecture:** The cube-stepper Three.js core (in-repo at `cube-stepper.html`, the authoritative port source) becomes a lazily-loaded animator module: a plain-TS engine class owning the Three scene/move mechanics and a thin Svelte component owning controls and the move tape. Notation handling reuses `core/cube/parser` — one parser everywhere (§6.3). Overrides get a `data/overrides.ts` write path that validates via `core/cube` before persisting (the §3.4 rule: an override must solve the case), following the plain-object-at-the-boundary rule.

**Tech Stack:** `three` (new runtime dep, dynamically imported — own chunk like cubing). Everything else as before.

**Spec:** `cube-trainer-spec.md` §3.4 (reference content, overrides, animation), §6.3 (render model vs `core/cube`, lazy Three). User decisions: cube-stepper port over twisty-player; detail lives in the existing long-press sheet (no new navigation); Settings triggers animate too.

## Global Constraints

- All prior global constraints (TS strict, browser-clean src, plain objects at persistence boundaries, work directly on main, commit per green task).
- `three` may be imported ONLY inside `src/ui/animator/` and only via dynamic `import('three')` — `npm run build` must show it in its own lazy chunk; `grep -rn "three" src/ --include="*.ts" --include="*.svelte"` hits only `src/ui/animator/`.
- The animator is the *render* model: it may not be used to answer state questions; validation logic uses `core/cube` only (§6.3).
- Override rows: `{ caseId, moves, updatedAt }` exactly per §5.1 schema (already in db); `activeAlg` in `settings.ts` already resolves override-first — do not duplicate that logic.
- Sheet stays one-handed: controls in the lower half, tap-outside-to-close preserved, content scrolls when tall (max-height ~85dvh).

---

### Task 1: Animator engine + component (cube-stepper port), trigger animation in Settings

**Files:**
- Create: `src/ui/animator/engine.ts`, `src/ui/animator/CubeAnimator.svelte`, `src/ui/TriggerSheet.svelte`
- Modify: `src/ui/screens/SettingsScreen.svelte` (trigger rows open the sheet), `package.json` (`npm install three @types/three`)
- Test: `src/ui/animator/engine.test.ts` (pure parts only)

**Interfaces:**
- Consumes: `cube-stepper.html` (port source, repo root), `parseAlg`/`invert` from `core/cube/parser`, `Move` type from `core/cube/model`.
- Produces:
  - `engine.ts` — `class CubeEngine`:
    - `static async create(container: HTMLElement): Promise<CubeEngine>` — dynamically imports `three`, builds scene/camera/renderer/cubies exactly as cube-stepper does (same colors: yellow-top scheme constants, plastic `0x0c0d10`, same lighting, same initial orbit rotation, drag-to-orbit with pointer events).
    - `load(moves: Move[], setup?: Move[]): void` — rebuilds the cube, instantly applies `setup` (no animation), sets the move list, position 0.
    - `stepForward(onDone?: () => void): void`, `stepBack(): void`, `jumpTo(i: number): void`, `play(onStep: (i: number) => void, onEnd: () => void): void`, `pause(): void` — port of cube-stepper's transport; animation duration fixed at 320 ms, honors `prefers-reduced-motion` (instant).
    - `position: number` (moves applied), `destroy(): void` (cancel RAF, dispose renderer, remove canvas).
    - `visualMoveTable` — port cube-stepper's cubie-level `BASE` table verbatim (axis/layers/q per move base). Exported as `VISUAL_BASE` for the test.
    - Port deltas from cube-stepper.html (everything else stays 1:1): tokenization comes from `parseAlg` (delete the HTML file's own `parseAlg`); no color-scheme toggle (yellow-top only); no speed selector (fixed 320); `three` via dynamic import instead of CDN script; resize via `ResizeObserver` on the container.
  - `CubeAnimator.svelte` — props `{ alg: string; setup?: string }`. Renders: the canvas container (square, ~min(78vw, 300px)), a move tape (buttons per move: done/current styling ported from cube-stepper's `.tok` classes, click to jump), transport row (⏮ ◀ ▶ Play ▶ ⏭). Creates the engine on mount (`await CubeEngine.create`), shows a "loading…" placeholder until ready, `destroy()` on unmount. Parses `alg`/`setup` with `parseAlg`; a parse error renders as a small error line instead of a crash.
  - `TriggerSheet.svelte` — props `{ name: string; moves: string; onClose: () => void }`: overlay + bottom sheet (same overlay/sheet CSS pattern as `CaseSheet.svelte`) containing the trigger name, the moves in mono, and `<CubeAnimator alg={moves} />` (no setup: the trigger plays from solved so its effect is visible).
  - `SettingsScreen.svelte`: trigger rows become buttons opening `TriggerSheet` for that trigger; everything else unchanged.

- [ ] **Step 1: Write the failing engine test (pure parts)**

`src/ui/animator/engine.test.ts`:

```ts
import { expect, test } from 'vitest';
import { VISUAL_BASE } from './engine';

// The visual move table must cover exactly the bases the shared parser can emit,
// with the same axis/direction conventions as cube-stepper's known-good table.
test('visual move table covers all 18 parser bases', () => {
  const bases = ['R', 'L', 'U', 'D', 'F', 'B', 'M', 'E', 'S', 'x', 'y', 'z', 'r', 'l', 'u', 'd', 'f', 'b'];
  expect(Object.keys(VISUAL_BASE).sort()).toEqual(bases.sort());
  expect(VISUAL_BASE.R).toEqual({ axis: 'x', layers: [1], q: 1 });
  expect(VISUAL_BASE.M).toEqual({ axis: 'x', layers: [0], q: -1 });
  expect(VISUAL_BASE.y).toEqual({ axis: 'y', layers: [-1, 0, 1], q: 1 });
  expect(VISUAL_BASE.f).toEqual({ axis: 'z', layers: [0, 1], q: 1 });
});
```

Run: `npx vitest run src/ui/animator/engine.test.ts` → FAIL. (The Three-dependent parts are exercised visually in Step 3; keep `VISUAL_BASE` and any other pure constants importable without touching `three` — i.e. module-level constants outside the class, `three` imported only inside `create`.)

- [ ] **Step 2: Port the engine and build the components**

Run `npm install three && npm install -D @types/three`. Port per the interface above, reading `cube-stepper.html` sections in this order: BASE table (lines ~224-243), scene setup (~264-336), move engine `startMove`/`bake`/`snapQuaternion`/`tick` (~338-391), transport logic (~425-463). The component's tape/controls markup mirrors the HTML file's `#tape`/`#transport` with the app's tokens (`--accent`, `--panel-2`, `--font-mono`).

- [ ] **Step 3: Verify**

`npm test` (engine test + suite green), `npm run check`, `npm run build` — three in its own chunk, entry unchanged; grep confirms three only under `src/ui/animator/`. Browser (127.0.0.1:5173, mobile viewport, NOT plain localhost): Settings → Common triggers → tap Sexy → sheet with an animated cube; Play walks R U R' U'; step buttons and tape-jump work; close and open Sledgehammer; no console errors; Timer/Train tabs unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/ui/animator src/ui/TriggerSheet.svelte src/ui/screens/SettingsScreen.svelte package.json package-lock.json
git commit -m "feat(ui): three.js cube animator (cube-stepper port), animated trigger reference"
```

---

### Task 2: Override data layer with validation

**Files:**
- Create: `src/data/overrides.ts`
- Test: `src/data/overrides.test.ts`

**Interfaces:**
- Consumes: `core/cube` (solvedCube, applyAlg, parseAlg, invert, toAlgString, orientYellowUp, f2lSolved, normalizedOllPattern), `caseById`, `db`.
- Produces:
  - `validateOverride(c: CaseInfo, moves: string): string | null` — returns an error message or null. Checks in order: parses (`Can't read "<tok>"` message passthrough), inverse-applied to a solved cube it must leave F2L solved after `orientYellowUp` ("algorithm breaks F2L"), and its normalized pattern must equal the primary's ("algorithm solves a different case").
  - `setOverride(caseId: string, moves: string, now: number): Promise<string | null>` — validates; on success `db.algOverrides.put({ caseId, moves: <trimmed string>, updatedAt: now })` and returns null, else returns the error without writing.
  - `clearOverride(caseId: string): Promise<void>` — delete the row.
  - `getOverride(caseId: string): Promise<string | null>` — the raw override moves or null (the sheet shows a "modified" badge from this).

- [ ] **Step 1: Write the failing tests**

`src/data/overrides.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import { db } from './db';
import { caseById } from './caseSet';
import { clearOverride, getOverride, setOverride, validateOverride } from './overrides';
import { activeAlg } from './settings';

const sune = caseById.get('sune')!;

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()));
});

test('a genuine alternative alg for the case validates', () => {
  expect(validateOverride(sune, sune.secondary!)).toBeNull();
});

test('wrong case, broken F2L, and garbage are rejected with messages', () => {
  const antiSune = caseById.get('anti-sune')!;
  expect(validateOverride(sune, antiSune.primary)).toMatch(/different case/);
  expect(validateOverride(sune, "R U R'")).toMatch(/breaks F2L|different case/);
  expect(validateOverride(sune, 'R T')).toMatch(/Can't read/);
});

test('setOverride persists valid, rejects invalid without writing', async () => {
  expect(await setOverride('sune', sune.secondary!, 5)).toBeNull();
  expect(await getOverride('sune')).toBe(sune.secondary);
  expect(await activeAlg('sune')).toBe(sune.secondary);
  expect(await setOverride('sune', "R U R'", 6)).not.toBeNull();
  expect(await getOverride('sune')).toBe(sune.secondary); // unchanged
});

test('clearOverride restores the primary', async () => {
  await setOverride('sune', sune.secondary!, 5);
  await clearOverride('sune');
  expect(await getOverride('sune')).toBeNull();
  expect(await activeAlg('sune')).toBe(sune.primary);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/overrides.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/data/overrides.ts`:

```ts
import { solvedCube } from '../core/cube/model';
import { applyAlg, invert, parseAlg, toAlgString } from '../core/cube/parser';
import { f2lSolved, normalizedOllPattern, orientYellowUp } from '../core/cube/pattern';
import { db } from './db';
import type { CaseInfo } from './caseSet';

function caseStateOf(alg: string) {
  return orientYellowUp(applyAlg(solvedCube(), toAlgString(invert(parseAlg(alg)))));
}

export function validateOverride(c: CaseInfo, moves: string): string | null {
  let state;
  try {
    state = caseStateOf(moves);
  } catch (e) {
    return (e as Error).message;
  }
  if (!f2lSolved(state)) return 'algorithm breaks F2L';
  if (normalizedOllPattern(state) !== normalizedOllPattern(caseStateOf(c.primary)))
    return 'algorithm solves a different case';
  return null;
}

export async function setOverride(caseId: string, moves: string, now: number): Promise<string | null> {
  const c = (await import('./caseSet')).caseById.get(caseId);
  if (!c) return `unknown case "${caseId}"`;
  const trimmed = moves.trim();
  const error = validateOverride(c, trimmed);
  if (error) return error;
  await db.algOverrides.put({ caseId, moves: trimmed, updatedAt: now });
  return null;
}

export async function clearOverride(caseId: string): Promise<void> {
  await db.algOverrides.delete(caseId);
}

export async function getOverride(caseId: string): Promise<string | null> {
  return (await db.algOverrides.get(caseId))?.moves ?? null;
}
```

(Use a plain static import for `caseById` instead of the dynamic import shown if no circularity arises — `caseSet` imports nothing from `overrides`, so a static import is fine; the snippet's dynamic form is only a fallback. Prefer static.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/overrides.test.ts` → 4 PASS; full `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add src/data/overrides.ts src/data/overrides.test.ts
git commit -m "feat(data): validated algorithm overrides"
```

---

### Task 3: Case sheet becomes the full detail

**Files:**
- Modify: `src/ui/CaseSheet.svelte`

**Interfaces:**
- Consumes: `CubeAnimator.svelte`, `overrides.ts`, `activeAlg`, existing sheet props `{ info, onClose }` (unchanged — CasesScreen needs no edits).
- Produces the expanded sheet, top to bottom:
  - Existing header block (diagram, name + #oll) — diagram shrinks to 84 to make room.
  - Active algorithm in mono with a `modified` badge (accent outline) when an override exists.
  - `<CubeAnimator alg={activeAlgText} setup={activeAlgText} />` — passing the alg as its own setup means the engine inverse-applies it instantly (the sheet's `setup` prop semantics: `CubeAnimator` computes `invert(parseAlg(setup))` and hands it to `engine.load` — the cube opens SHOWING the case, and stepping through solves it, matching how the user thinks about OLL).

    Note: this requires one addition to Task 1's `CubeAnimator`: interpret its `setup` prop as "alg whose inverse is the instant setup". Task 1 builds it that way from the start (TriggerSheet passes no setup).
  - Secondary alg + triggers + notes lines (existing).
  - Override editor: an `edit` text button; expands to a mono textarea prefilled with the active alg, Save / Cancel, plus Reset to default shown only when an override exists. Save → `setOverride(..., Date.now())`; error string shown in `--bad`; success collapses the editor, refreshes the shown alg and the animator. Reset → `clearOverride`, same refresh.
  - Sheet CSS gains `max-height: 85dvh; overflow-y: auto`.

- [ ] **Step 1: Implement**

Extend `CaseSheet.svelte` per the contract. State: `alg` (existing), `hasOverride`, `editing`, `draft`, `error`. Load `getOverride(info.id)` alongside `activeAlg` in the effect. `refresh()` re-runs both after save/reset. Key the animator on the alg text (`{#key alg}<CubeAnimator alg={alg} setup={alg} />{/key}`) so a changed override reloads the engine.

- [ ] **Step 2: Verify**

`npm test`, `npm run check`, `npm run build` green. Browser (127.0.0.1:5173): long-press Sune → sheet shows the case on the 3D cube (mis-oriented state), Play solves it, tape jump works; edit → paste Sune's secondary (`y' R' U2' R U R' U R`) → Save → `modified` badge, animator reloads showing the new alg; Train reveal for Sune now shows the override; edit → garbage `R T` → inline error, nothing saved; Reset → back to primary, badge gone. Confirm scrolling works with the sheet at full height on a small viewport.

- [ ] **Step 3: Commit**

```bash
git add src/ui/CaseSheet.svelte
git commit -m "feat(ui): case sheet gains animation and validated alg override editing"
```

---

## Self-review notes (resolved during writing)

- **Spec coverage:** §3.4 detail content + step-through animation (Tasks 1, 3), override with validation/user-modified marker/reset (Tasks 2, 3), one shared parser (engine consumes `parseAlg`), §6.3 lazy Three + render-model separation (Task 1 constraints). The §7.1 "tab remembers sub-state" question is mooted: detail is a sheet, not a route.
- **Setup semantics** defined once in Task 1 (`setup` = alg whose inverse is instantly applied) and consumed in Task 3; TriggerSheet omits it deliberately.
- **`validateOverride` compares normalized patterns of override vs primary** rather than trusting the stored `pattern` field — same self-contained derivation the verifier uses; stored `pattern` stays display-only.
- **Type consistency:** `VISUAL_BASE` shape `{ axis: 'x'|'y'|'z'; layers: number[]; q: number }` matches cube-stepper's table; `CaseInfo` reused from `caseSet`; sheet props unchanged so CasesScreen is untouched.
