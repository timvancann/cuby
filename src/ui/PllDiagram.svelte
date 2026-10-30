<script lang="ts">
  import { pllDiagramLayout } from './diagram';
  import { R, F, L, B } from '../core/cube/model';
  let { ring, size = 72 }: { ring: number[]; size?: number } = $props();
  const bars = $derived(pllDiagramLayout(ring));
  // Yellow top, green front: orange is on the right (matches the 3D engine).
  const COLOR: Record<number, string> = { [R]: '#ff8c00', [F]: '#00a651', [L]: '#d0021b', [B]: '#0051ba' };
  const POS = [9, 35.5, 62];
</script>

<svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="PLL diagram">
  {#each POS as y}
    {#each POS as x}
      <rect {x} {y} width="25" height="25" rx="2" fill="var(--accent)" />
    {/each}
  {/each}
  {#each bars as bar}
    <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="2" fill={COLOR[bar.face] ?? 'var(--panel-2)'} />
  {/each}
</svg>
