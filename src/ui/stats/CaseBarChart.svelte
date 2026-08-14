<script lang="ts">
  interface Row { label: string; recognition: number; solve: number }
  const { rows }: { rows: Row[] } = $props();

  const BAR_H = 18;
  const GAP = 8;
  const sorted = $derived([...rows].sort((a, b) => (b.recognition + b.solve) - (a.recognition + a.solve)));
  const maxTotal = $derived(Math.max(1, ...sorted.map(r => r.recognition + r.solve)));
  const width = 300;
  const labelW = 90;
  const chartW = width - labelW;
  const height = $derived(sorted.length * (BAR_H + GAP));
</script>

{#if rows.length === 0}
  <p class="dim empty">no case data yet</p>
{:else}
  <svg viewBox="0 0 {width} {height}" width="100%" style="height: {height}px">
    {#each sorted as row, i}
      {@const y = i * (BAR_H + GAP)}
      {@const recW = (row.recognition / maxTotal) * chartW}
      {@const solveW = (row.solve / maxTotal) * chartW}
      <text x="0" y={y + BAR_H / 2} dy="0.35em" class="label">{row.label}</text>
      <rect x={labelW} y={y} width={recW} height={BAR_H} class="recognition" />
      <rect x={labelW + recW} y={y} width={solveW} height={BAR_H} class="solve" />
    {/each}
  </svg>
{/if}

<style>
  .empty { font-size: 13px; padding: 12px 0; }
  svg { display: block; }
  text.label {
    font: 500 9px var(--font-ui, system-ui);
    fill: var(--dim);
  }
  rect.recognition { fill: var(--accent); }
  rect.solve { fill: var(--dim); }
</style>
