// Keyboard support for drill screens: space acts as the tap zone, Escape as
// the screen's back-out action. Returns the cleanup function for $effect.
export function drillKeys(handlers: {
  onSpace: () => void;
  onEscape?: () => void;
  enabled?: () => boolean;
}): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
    if (handlers.enabled && !handlers.enabled()) return;
    if (e.key === ' ') {
      // preventDefault also stops a focused button from click-firing on keyup.
      e.preventDefault();
      handlers.onSpace();
    } else if (e.key === 'Escape' && handlers.onEscape) {
      e.preventDefault();
      handlers.onEscape();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
