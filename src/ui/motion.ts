import { cubicOut } from 'svelte/easing';

// Everything that opens or closes animates over the same 300ms, so the eye can
// follow where a panel came from and went. Drill stage changes stay instant:
// they are timing-critical. Reduced motion turns it all off.
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const MOTION_MS = reduced ? 0 : 300;
export const MOTION = { duration: MOTION_MS, easing: cubicOut };

// A bottom sheet slides up from below the screen edge.
export function rise(_node: Element) {
  return { ...MOTION, css: (_t: number, u: number) => `transform: translateY(${u * 100}%)` };
}
