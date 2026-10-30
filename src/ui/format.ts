// Times as cubers read them: 9.84, 1:15.23.
export function fmtMs(ms: number): string {
  const cs = Math.floor(ms / 10); // truncate to centiseconds, like a stackmat
  const s = cs / 100;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = (s - m * 60).toFixed(2).padStart(5, '0');
    return `${m}:${rem}`;
  }
  return s.toFixed(2);
}

export function fmtTime(v: number | 'dnf' | null): string {
  if (v === 'dnf') return 'DNF';
  if (v === null) return '-';
  return fmtMs(v);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
