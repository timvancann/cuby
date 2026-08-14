export interface LongPressOptions {
  duration?: number;
  onLongPress: () => void;
}

// Svelte action: fires onLongPress after a steady hold, and swallows the
// click that follows so the tile's tap handler doesn't also run.
export function longpress(node: HTMLElement, opts: LongPressOptions) {
  let timer = 0;
  let fired = false;
  let startX = 0;
  let startY = 0;
  let current = opts;

  const down = (e: PointerEvent) => {
    fired = false;
    startX = e.clientX;
    startY = e.clientY;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fired = true;
      current.onLongPress();
    }, current.duration ?? 450);
  };
  const cancel = () => window.clearTimeout(timer);
  const move = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
  };
  const click = (e: Event) => {
    if (fired) {
      e.stopPropagation();
      e.preventDefault();
      fired = false;
    }
  };
  const contextmenu = (e: Event) => e.preventDefault(); // mobile long-press menu

  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('click', click, true);
  node.addEventListener('contextmenu', contextmenu);

  return {
    update(next: LongPressOptions) {
      current = next;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', cancel);
      node.removeEventListener('pointercancel', cancel);
      node.removeEventListener('pointerleave', cancel);
      node.removeEventListener('click', click, true);
      node.removeEventListener('contextmenu', contextmenu);
    },
  };
}
