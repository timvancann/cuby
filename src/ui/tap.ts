// High-resolution wall-clock ms on the same timeline as event.timeStamp, so
// tap times and the live clock agree and system clock jumps can't skew a solve.
export function clockNow(): number {
  return performance.timeOrigin + performance.now();
}

export const DRAG_SLOP_PX = 10;

// Handlers for a whole-screen tap zone. A tap resolves on pointerup and only if
// the pointer moved less than DRAG_SLOP_PX (drags scroll or rotate the cube, they
// never count), but it is timed from the pointerdown moment so timing stays honest.
export function slopTap(onTap: (t: number) => void) {
  let down: { x: number; y: number; t: number; id: number } | null = null;
  return {
    onpointerdown(e: PointerEvent) {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: performance.timeOrigin + e.timeStamp, id: e.pointerId };
    },
    onpointerup(e: PointerEvent) {
      if (!down || e.pointerId !== down.id) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const t = down.t;
      down = null;
      if (moved < DRAG_SLOP_PX) onTap(t);
    },
    onpointercancel() {
      down = null;
    },
  };
}
