# OLL Trainer — Design Specification

> Status: complete draft, co-authored. Implementation target: Claude Code.
> Product: a frontend-only PWA for practicing Rubik's cube last-layer recognition and execution.

## 1. Overview, Goals, Non-Goals

A personal, frontend-only PWA to drill Rubik's cube last-layer recognition and execution, built around the CubeHead "OLL in One Month" learning order. The core loop: the app shows a scramble, the user recognizes the case on the physical cube, solves it, and the app reveals the case and records recognition/solve splits.

- **Primary user:** the author. Single user, phone-first, one hand on the phone and one on the cube. No accounts, no server, no telemetry.
- **Goals:**
  1. Make recognition practice frictionless enough for daily use.
  2. Split recognition time from execution time so the per-case bottleneck is visible.
  3. Be a serviceable everyday speedcube timer, so the app replaces an existing timer rather than supplementing one.
  4. Work fully offline after first load.
- **Non-goals for v1:** multi-user or sync; adaptive scheduling (the data model records what it needs, but scheduling stays uniform-random); PLL/F2L/other case sets (the architecture leaves the door open, see §8); smart-cube connectivity (event-source interface only, §3.3); app store distribution.

## 2. Domain Model

Terms used consistently throughout this spec and the codebase:

- **Case** — one of the 57 OLL states, identified by canonical number (1–57) and PDF name, belonging to exactly one **Group**. A case's identity is its top-layer *orientation pattern* (which of the 8 LL pieces have yellow facing up, and where the yellow stickers of the misoriented ones point). Recognition is rotation-dependent in appearance but the case is AUF-invariant: the same case seen at 4 possible angles.
- **Algorithm** — an ordered move sequence in standard notation (face, wide, slice, rotation moves; primes; doubles) that solves a case. Each case has a default primary and optional secondary algorithm, plus trigger shorthand and notes. Exactly one algorithm per case is *active* (default: primary; user-overridable).
- **Scramble** — a move sequence that, applied to a solved cube held yellow-up, produces a chosen case with a randomized LL permutation and randomized AUF, leaving F2L intact.
- **Attempt** — one timed unit. Common fields: mode, timestamps, total duration, flag (`ok` / `misrecognized` / `dnf`), and mode-specific fields: case id + scramble + recognition/solve splits (case training); ordered named phase splits (CFOP timer); nothing extra (full solve).
- **Session** — a run of consecutive attempts in one mode with one configuration (the selected case subset for case training; the phase set for the CFOP timer). Attempts always belong to a session; a session records its configuration snapshot so history stays interpretable after the selection changes.
- **Phase set** — a user-editable named list of phase labels for the CFOP timer (default: Cross, F2L, OLL, PLL).
- **Timer event** — a timestamped signal (`tap`) consumed by the timer core to advance the attempt state machine. V1 has one event source (screen taps); the interface is designed so a future smart-cube source can emit equivalent events (first-turn-detected, solved-detected).

## 3. Features

### 3.1 Case selection

- The case library for v1 is the 57 OLL cases, grouped exactly as in the source PDF ("How to Learn OLL in One Month", CubeHead): Easy Algs, Oriented Edges (OCLL), T-shapes, Squares, Solved Corners, Lightning Bolts, P-shapes, C-shapes, Fishes, L-shapes, W-shapes, Lines, Knight Moves, Awkward Shapes, Dot cases. These groups double as the learning order, so selection maps naturally onto "the groups I've learned so far".
- Cases are identified primarily by their PDF name (Sune, Key, Breakneck, …) with the canonical OLL number (1–57) shown as a secondary label for cross-referencing other resources.
- Selection UI: a grid of case tiles per group. Each tile shows the case's top-view diagram (yellow pattern + side-sticker orientation marks), name + OLL number, and selected state. Tap a tile to toggle; tap a group header to toggle the whole group.
- The current selection is persisted and is the input to every training session ("session = selected subset", always).
- Minimum selection to start a session: 2 cases (with 1 there is nothing to recognize).

### 3.2 Training loop (core feature)

One attempt flows through four states, advanced by tapping anywhere in the large central tap zone:

1. **SCRAMBLED → READY.** The app picks a case from the selected subset (v1: uniform random; see §8 for adaptive scheduling) and generates a scramble for it (§4). The scramble is displayed in large monospace type. The user executes it on the physical cube, yellow side up. No case image, name, or hint is shown — recognition happens on the physical cube, not the screen.
2. **Tap 1 — recognition starts.** The user looks at the cube. Screen shows a running timer, nothing else.
3. **Tap 2 — recognition ends, solve starts.** Tapped at the moment the user begins turning. The recognition split is stored; the solve timer runs.
4. **Tap 3 — solve ends, reveal.** The app reveals: case name + number, its diagram, the user's configured algorithm for it (with alternative notation names, e.g. "sexy + sledge"), and this attempt's splits (recognition / solve / total). A prominent "next" action generates the following attempt.

Additional rules:

- On the reveal screen the user can flag the attempt: **OK** (default), **misrecognized** (solved it as the wrong case first), or **DNF**. Flags are stored with the attempt and feed stats.
- A discreet "abort" control (small, outside the tap zone) cancels the current attempt without recording it — for interruptions and botched scrambles.
- Screen stays awake during a session (Wake Lock API). Optional vibration feedback on each tap.
- The tap zone must be large and forgiving: this is used with one hand while the other holds a cube.

### 3.3 Timer modes

Three modes share one timer core. The core consumes timestamped events from an abstract **event source** — v1 has exactly one source (screen taps), but the interface must allow a future Bluetooth smart-cube source to emit the same events (§8).

1. **Full solve.** Classic speedcube timer: tap to start, tap to stop. Generates its own random-state full scrambles. Stores single-duration attempts.
2. **CFOP phase timer.** Like full solve, but intermediate taps mark named phase boundaries. Default phase set: Cross → F2L → OLL → PLL. Phase sets are user-editable named lists ("stopwatch with named rounds") so e.g. Cross → F2L1–4 → OLL → PLL is possible. Stores per-phase splits.
3. **Case training.** The loop from §3.2. Phases are fixed: recognition → solve.

All modes record attempts into the same local store with a mode discriminator.

### 3.4 Algorithm reference

- A browsable overview of all cases by group (Cube Academy style). Per case: diagram, name + OLL number, primary algorithm, secondary algorithm, trigger shorthand ("F (sexy) F'", "(sexy) (sledge)"), and the PDF's notes/fingertrick hints.
- Content source: the "OLL in One Month" PDF (CubeHead). It is converted once, at build time, into a canonical `cases.json`; the app never parses PDFs at runtime. The JSON is checked into the repo and hand-correctable.
- **Case identity is derived, not transcribed.** The build pipeline applies the *inverse* of each case's primary algorithm to a solved cube (simulated) and reads the resulting top-layer orientation pattern — that pattern *is* the case diagram, and matching it against the canonical OLL 1–57 table yields the number. The secondary algorithm is verified to produce the same pattern; a mismatch fails the build. This makes alg typos in the source data self-detecting.
- Algorithm notation in the library may include wide moves (r, f), slice moves (M), rotations (y, y2, x), and D moves — the notation parser and animator must support the full set (the existing cube-stepper core already does).
- Per case, the user can override the primary algorithm (this is the one shown on training reveals). Overrides are validated the same way (must solve the case), stored locally, marked as user-modified, with reset-to-default.
- Each case detail view includes a step-through animation of the primary algorithm (reuse of the cube-stepper Three.js core).

## 4. Scramble Generation

**Decision: precomputed pools for case training; runtime library scrambles for the two full-cube timer modes.**

### 4.1 Case-training pools (build time)

- For each of the 57 cases, a generator script (repo tooling, run offline — not app code) produces **N ≥ 50 distinct scrambles** and writes them to `scrambles.json`, keyed by case id.
- Each pool entry is generated from a random target state in the case's family: F2L solved, top-layer orientation = the case, LL permutation drawn uniformly at random, random AUF. The state is then solved near-optimally and the inverse solution is stored as the scramble.
- Length budget: **≤ 14 HTM** per scramble (LL-only states are optimally solvable well within this). Short scrambles are a feature: less execution surface, fewer botched setups.
- Generator tooling (decided): a small custom TS IDA* solver over last-layer states, reusing the app's own cube model and parser (§6.3). It is written against "solve to a target state family", not OLL specifically, so future LL sets reuse it (§6.4). The acceptance criteria below hold regardless of tooling.
- **CI verification (mandatory):** every pool scramble is simulated with the app's own cube model and must (a) leave F2L solved, (b) produce exactly its case's orientation pattern up to AUF, (c) be unique within its pool. The pipeline fails otherwise. Scrambles use face turns only (no wide/slice/rotations) so they're unambiguous to execute quickly.

### 4.2 Runtime selection

- On each attempt: pick a case (v1: uniform over the selected subset, never the same case twice in a row when |subset| ≥ 3), pick a pool variant uniformly (never the same variant twice in a row for that case), and append a random final AUF from {∅, U, U', U2} so the same variant still presents at varying angles.
- Anti-memorization stance: 50 variants × 4 AUFs per case exceeds what is practically memorizable; if it ever proves insufficient, regenerate pools with a new random seed — no app change needed.

### 4.3 Full-solve and CFOP modes

- These need genuine random-state full scrambles. Use `cubing.js` (`randomScrambleForEvent("333")`) — the WCA-official scramble library — executed in a web worker, assets cached by the service worker so it works offline after first load.
- The dependency is isolated to these two modes; case training never touches it.

## 5. Data, Stats, Persistence

### 5.1 Storage

- IndexedDB via **Dexie**. No backend, no accounts, no telemetry. Tables:
  - `sessions` — id, mode, startedAt, configSnapshot (selected case ids | phase set)
  - `attempts` — id, sessionId, mode, caseId?, scramble?, startedAt, splits (ordered {label, ms}), totalMs, flag (`ok`/`misrecognized`/`dnf`)
  - `algOverrides` — caseId, moves, updatedAt
  - `settings` — key/value (case selection, active phase set, preferences)
- On first run, request `navigator.storage.persist()`; show the granted/denied result and current usage estimate in Settings.
- All durations are integer milliseconds; all timestamps epoch ms.

### 5.2 Backup & clearing

- **Export**: one versioned JSON file containing all tables, via the share sheet / file download. **Import**: full replace after explicit confirmation (no merge semantics in v1 — merge is error-prone and serves no single-user need).
- **Clear history**: deletes all sessions and attempts — entire history only, by design; no single-attempt deletion. Double confirmation, with an "export first" shortcut in the dialog. Alg overrides and settings survive a history clear.

### 5.3 Stats

- **Per case**: attempt count, best/mean recognition, best/mean solve, DNF rate, misrecognition rate, last-seen date. Sortable — "worst recognition" and "least practiced" orderings are the v1 (read-only) precursor of adaptive scheduling.
- **Per session**: attempt list with splits, session means.
- **Per mode, global**: current/best ao5, ao12, ao50, ao100 and lifetime mean (mirroring the "Last avg of" table in the reference timer app). Averages follow WCA trimming rules: aoN drops best and worst; a DNF counts as worst; two DNFs make the average DNF.
- Charts are v1-minimal: a per-case bar of mean recognition vs solve time, and a session-over-session trend line. Everything else is roadmap.

## 6. Tech Stack & Architecture

### 6.1 Stack

- **Svelte 5 + TypeScript + Vite.** Dexie for IndexedDB (§5). Vitest for tests.
- **Three.js** only on the case-detail animation view, in a lazy-loaded route chunk — timer paths never pay for it. The animator is a port of the existing cube-stepper core.
- **cubing.js** in a web worker, used only by the full-solve and CFOP modes (§4.3).
- Fonts (Space Grotesk, JetBrains Mono) self-hosted. No runtime CDN dependencies anywhere; offline is a goal, not a fallback.

### 6.2 Hosting & PWA

- GitHub Pages, deployed by GitHub Actions on push to main (build → verify pipeline (§3.4, §4.1) → deploy).
- Hash-based routing (no server rewrites on Pages).
- `vite-plugin-pwa` service worker, precache-everything strategy (the entire app including cubing.js worker assets is small). Versioned updates surface as a discreet "reload for update" prompt, never a forced reload mid-session.

### 6.3 Module layout

Dependency direction is strictly top to bottom:

- `core/cube` — pure logical cube model (sticker permutation), move application, notation parser (one parser shared by app and tooling; supports the full move set of §3.4), top-layer pattern extraction. Zero dependencies, fully unit-tested. Note this is distinct from the Three.js render model: the animator shows moves, `core/cube` answers questions about state.
- `core/timer` — the attempt state machine, consuming timestamped events from an event-source interface (§2). V1 has one implementation: screen taps.
- `core/stats` — WCA aoN trimming, per-case and per-session aggregation. Pure functions over attempt lists.
- `data/` — Dexie schema and repository functions, settings store, export/import.
- `ui/` — Svelte routes and components. Case diagrams are SVG top-views rendered from the logical pattern in `cases.json` — never hand-drawn assets, so diagram and data cannot disagree. The Three.js animator is wrapped as one component.
- `tools/` (repo tooling, not shipped) — PDF → `cases.json` extraction, the scramble pool generator (custom TS IDA* over last-layer states, per §4.1), and the CI verifier that simulates every scramble and every algorithm against `core/cube`.

### 6.4 Extension point: case sets as data

`cases.json` + `scrambles.json` together define a *case set*. OLL is the only set in v1, but nothing in `core/` or `data/` assumes 57 cases or orientation-only patterns. A future PLL set is new data plus a new target-state definition in the generator; the entire last layer is ~62k states, so the same solver covers any LL set (OLL, PLL, COLL, ZBLL) unchanged. F2L would additionally need a two-phase solver backend behind the same `scrambles.json` contract (§8). The app depends on the data format, not on the program that produced it — the CI verifier, not the solver, is what makes pool data trustworthy.

### 6.5 Storage durability

Request `navigator.storage.persist()` on first run; show the result and a usage estimate in Settings (§5.1). Manual export (§5.2) is the real safety net against eviction.

## 7. UI & Navigation

### 7.1 Navigation

Bottom tab bar with five destinations: **Train, Timer, Cases, Stats, Settings**. Train is the case-training loop (§3.2); Timer hosts full-solve and CFOP behind a two-way mode toggle at the top of the screen. Hash-based routes; each tab remembers its own sub-state (e.g. which case detail was open).

### 7.2 Visual direction

Extends the existing cube-stepper tool: dark-only theme, near-black background, sticker-yellow accent reserved for the primary action and the running timer, Space Grotesk for UI text, JetBrains Mono for everything cube-notational (scrambles, algorithms, times). Case diagrams are flat SVG top-views — yellow stickers filled, side-pointing stickers drawn as bars on the tile edge, matching the PDF's convention.

### 7.3 One-handed constraints

The design driver for Train and Timer:

- The tap zone is the entire screen minus a slim top status strip and the abort control; every state advance is "tap anywhere", so thumb reach is irrelevant by construction.
- The scramble is readable at arm's length with the phone flat on a desk.
- Abort is small, in a top corner, outside natural tap paths, and needs no confirmation (nothing is recorded on abort).
- The reveal screen puts the flag buttons (OK / misrecognized / DNF) and "next" in the bottom third, thumb territory. Tapping anywhere else advances to the next attempt with flag OK, keeping the fast path "tap, tap, tap". A short dead-time (~300 ms) after the solve-ending tap prevents an accidental double tap from skipping the reveal.
- Wake lock is held while Train or Timer is foregrounded; optional haptic tick on each state advance.

### 7.4 Screens

- **Train** — the 4-state loop of §3.2, plus a live session summary (attempt count, means).
- **Timer** — full solve / CFOP with mode toggle, current phase readout during CFOP attempts, same session summary.
- **Cases** — group list → tile grid (§3.1 selection UI) → case detail: diagram, name + number, algorithms with trigger shorthand and notes, step-through animation, alg override with reset-to-default.
- **Stats** — global aoN table per mode, sortable per-case table, the two v1 charts (§5.3).
- **Settings** — case selection shortcut, phase-set editor, storage status, export/import/clear, preferences (vibration, etc.).

### 7.5 Session lifecycle

A session starts implicitly with the first attempt after entering a mode and ends on leaving the mode or after 30 minutes idle. The active session's summary is always visible on its screen.

## 8. V1 Cut Line & Roadmap

**V1 ships:** everything in §3–§5 — case training with pool scrambles, full-solve and CFOP timers with cubing.js scrambles, algorithm reference with animation and overrides, stats with WCA averages and the two minimal charts, export/import, offline PWA on GitHub Pages.

**Explicitly not in v1**, and what unblocks each:

- **Adaptive scheduling** — needs the attempt data v1 will produce; the sortable stats table (§5.3) is the manual precursor. First roadmap item.
- **PLL / COLL / ZBLL sets** — blocked on nothing architecturally: new `cases.json` / `scrambles.json` plus a generator target definition (§6.4).
- **F2L training** — additionally needs a two-phase solver backend for the pool generator; the `scrambles.json` contract and app code are unchanged.
- **Smart cube (Web Bluetooth)** — the timer core already consumes abstract events (§2); a smart-cube source would emit first-turn-detected and solved-detected, auto-splitting recognition/solve.
- **Sync / cloud backup** — manual export covers the single-user need for now.
- **Richer charts, light theme, iOS polish** — nice-to-haves, unordered.

Roadmap order is roughly: adaptive scheduling → PLL → smart cube → the rest. Non-binding by design.
