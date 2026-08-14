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
    if (wanted && document.visibilityState === 'visible' && (!sentinel || sentinel.released)) {
      void request();
    }
  });
}

export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  await request();
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  try {
    await sentinel?.release();
  } catch {
    // already auto-released by the OS — non-fatal
  }
  sentinel = null;
}
