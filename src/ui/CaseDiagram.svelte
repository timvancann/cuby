<script lang="ts">
  import { diagramLayout } from './diagram';
  let { pattern, size = 72 }: { pattern: string; size?: number } = $props();
  const layout = $derived(diagramLayout(pattern));
</script>

<svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="case diagram">
  {#each layout.grid as cell}
    <rect x={cell.x} y={cell.y} width={cell.w} height={cell.h} rx="2"
      fill={cell.on ? 'var(--accent)' : 'var(--panel-2)'} />
  {/each}
  {#each layout.bars as bar}
    <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="2" fill="var(--accent)" />
  {/each}
</svg>
