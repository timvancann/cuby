import { cubicOut } from 'svelte/easing';

// Everything that opens or closes animates over the same 300ms, so the eye can
// follow where a panel came from and went. Drill stage changes stay instant:
// they are timing-critical. Reduced motion turns it all off.
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const MOTION_MS = reduced ? 0 : 300;
export const MOTION = { duration: MOTION_MS, easing: cubicOut };

// Wide, tall windows get the desktop layout: a side rail instead of the tab
// bar, centred dialogs instead of bottom sheets. The min-height keeps phones in
// landscape on the phone layout. CSS repeats this query as a literal.
export const DESKTOP_QUERY = '(min-width: 900px) and (min-height: 600px)';

// A bottom sheet slides up from below the screen edge; on desktop it is a
// centred dialog that fades and scales in.
export function rise(_node: Element) {
  if (matchMedia(DESKTOP_QUERY).matches) {
    return { ...MOTION, css: (t: number, u: number) => `opacity: ${t}; transform: scale(${1 - u * 0.04})` };
  }
  return { ...MOTION, css: (_t: number, u: number) => `transform: translateY(${u * 100}%)` };
}
