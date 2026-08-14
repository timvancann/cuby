export interface TimedResult { totalMs: number; dnf: boolean }

function windowAverage(win: TimedResult[]): number | 'dnf' {
  const n = win.length;
  const trim = Math.max(1, Math.ceil(n * 0.05)); // csTimer-style: trim best/worst 5% (at least 1 each side)
  const dnfs = win.filter(r => r.dnf).length;
  if (dnfs > trim) return 'dnf';
  if (2 * trim >= n) return 'dnf'; // degenerate window: trimming both ends leaves nothing
  const sorted = [...win].sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1; // DNF sorts as worst
    return a.totalMs - b.totalMs;
  });
  const kept = sorted.slice(trim, n - trim);
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
