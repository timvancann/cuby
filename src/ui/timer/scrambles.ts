// Full-solve scramble service: a classic worker (public/solver/worker.js,
// deliberately outside the bundle) running the vendored cubejs two-phase
// solver. warmUp() starts the worker (and its one-time solver init) early;
// nextFullScramble() hands out the prefetched scramble and immediately
// starts generating the next one.

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(`${import.meta.env.BASE_URL}solver/worker.js`);
  worker.onmessage = (e: MessageEvent<{ id: number; scramble?: string; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.scramble) p.resolve(e.data.scramble);
    else p.reject(new Error(e.data.error ?? 'scramble failed'));
  };
  worker.onerror = err => {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    worker?.terminate();
    worker = null; // next request spawns a fresh worker
  };
  return worker;
}

function generate(): Promise<string> {
  const w = ensureWorker();
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    w.postMessage({ id });
  });
}

let prefetched: Promise<string> | null = null;

export function warmUp(): void {
  if (prefetched) return;
  const p = generate();
  prefetched = p;
  p.catch(() => {
    if (prefetched === p) prefetched = null; // never hand out a known-failed prefetch
  });
}

export function nextFullScramble(): Promise<string> {
  const current = prefetched ?? generate();
  prefetched = null;
  warmUp(); // arm the next one
  return current;
}
