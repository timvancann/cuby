// Bounded-latency wrapper around cubejs's solve(). cubejs's synchronous search
// cannot be interrupted from inside its own process, and (see task-9-report.md)
// forcing maxDepth=14 can occasionally run for tens of seconds to minutes when
// no <=14 solution exists for a given state. To keep the generator's wall-clock
// time bounded and predictable, each solve request is handed to a small pool of
// persistent subprocesses (tools/solve-worker.ts); a request that doesn't answer
// within TIMEOUT_MS is treated as a rejection and its worker is killed and
// respawned.
import { type ChildProcessByStdio, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';

const TSX_BIN = path.resolve('node_modules/.bin/tsx');
const WORKER_SCRIPT = path.resolve('tools/solve-worker.ts');

export type SolveResult = { type: 'OK'; alg: string } | { type: 'FAIL' } | { type: 'TIMEOUT' };

class Worker {
  private proc!: ChildProcessByStdio<Writable, Readable, null>;
  private ready!: Promise<void>;
  private pending: ((line: string) => void) | null = null;
  // Bumped on every (re)spawn. Each readline listener closes over the
  // generation of the process it was attached to, so lines that arrive from
  // a killed child after respawn() has already moved on (kill is not
  // synchronous -- already-buffered stdout can still be delivered) are
  // dropped instead of being misattributed to whatever request is now
  // pending on this worker.
  private generation = 0;

  constructor() {
    this.spawnProc();
  }

  private spawnProc(): void {
    // detached: true puts the process in its own process group (pgid ===
    // pid). tsx's CLI is itself a wrapper that spawns a nested node process
    // to actually run the worker script; killing just the wrapper's pid
    // leaves that nested process running (confirmed: it gets reparented to
    // pid 1 and keeps consuming CPU forever). Killing the negative pid kills
    // the whole group -- wrapper and nested child together.
    this.proc = spawn(TSX_BIN, [WORKER_SCRIPT], { stdio: ['pipe', 'pipe', 'inherit'], detached: true });
    const myGeneration = ++this.generation;
    const rl = createInterface({ input: this.proc.stdout });
    let sawReady = false;
    let resolveReady: () => void;
    this.ready = new Promise((res) => { resolveReady = res; });
    rl.on('line', (line) => {
      if (myGeneration !== this.generation) return; // stale line from a killed process
      if (!sawReady) {
        if (line === 'READY') { sawReady = true; resolveReady(); }
        return;
      }
      if (this.pending) { const p = this.pending; this.pending = null; p(line); }
    });
  }

  private killGroup(): void {
    const pid = this.proc.pid;
    if (pid !== undefined) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        this.proc.kill('SIGKILL'); // fallback: at least kill the wrapper
      }
    }
  }

  private respawn(): void {
    this.killGroup();
    this.pending = null;
    this.spawnProc();
  }

  kill(): void {
    this.killGroup();
  }

  async solve(facelets: string, timeoutMs: number): Promise<SolveResult> {
    await this.ready;
    return new Promise<SolveResult>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.respawn();
        resolve({ type: 'TIMEOUT' });
      }, timeoutMs);
      this.pending = (line: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (line.startsWith('OK ')) resolve({ type: 'OK', alg: line.slice(3).trim() });
        else resolve({ type: 'FAIL' });
      };
      this.proc.stdin.write(facelets + '\n');
    });
  }
}

export class SolverPool {
  private workers: Worker[];
  private next = 0;

  constructor(size: number) {
    this.workers = Array.from({ length: size }, () => new Worker());
  }

  // Solves a batch of facelet strings. Requests are dispatched round-robin
  // across the pool and awaited together, but results are returned in the
  // same order as `batch` regardless of completion timing, so callers can
  // stay deterministic (e.g. seeded-RNG-driven generation).
  async solveBatch(batch: string[], timeoutMs: number): Promise<SolveResult[]> {
    const promises = batch.map((facelets) => {
      const worker = this.workers[this.next];
      this.next = (this.next + 1) % this.workers.length;
      return worker.solve(facelets, timeoutMs);
    });
    return Promise.all(promises);
  }

  shutdown(): void {
    for (const w of this.workers) w.kill();
  }
}
