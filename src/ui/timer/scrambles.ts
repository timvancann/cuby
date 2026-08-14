let prefetched: Promise<string> | null = null;

async function generate(): Promise<string> {
  const { randomScrambleForEvent } = await import('cubing/scramble');
  const alg = await randomScrambleForEvent('333');
  return alg.toString();
}

export function warmUp(): void {
  prefetched ??= generate();
}

export function nextFullScramble(): Promise<string> {
  const current = prefetched ?? generate();
  prefetched = generate();
  return current;
}
