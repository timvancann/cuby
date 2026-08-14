let prefetched: Promise<string> | null = null;

async function generate(): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble');
  const alg = await randomScrambleForEvent('333');
  return alg.toString();
}

export function warmUp(): void {
  if (prefetched) return;
  const p = generate();
  prefetched = p;
  p.catch(() => {
    if (prefetched === p) prefetched = null;
  });
}

export function nextFullScramble(): Promise<string> {
  const current = prefetched ?? generate();
  prefetched = null;
  warmUp();
  return current;
}
