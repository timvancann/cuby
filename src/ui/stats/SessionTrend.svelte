<script lang="ts">
  const { points }: { points: number[] } = $props();

  const width = 300;
  const height = 100;
  const pad = 8;

  const min = $derived(Math.min(...points));
  const max = $derived(Math.max(...points));
  const range = $derived(max - min || 1);

  function x(i: number): number {
    return points.length <= 1 ? width / 2 : pad + (i / (points.length - 1)) * (width - pad * 2);
  }
  function y(v: number): number {
    return height - pad - ((v - min) / range) * (height - pad * 2);
  }

  const path = $derived(points.map((v, i) => `${x(i)},${y(v)}`).join(' '));

  function fmt(ms: number): string {
    const s = ms / 1000;
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const rem = (s - m * 60).toFixed(2).padStart(5, '0');
      return `${m}:${rem}`;
    }
    return s.toFixed(2);
  }
</script>

{#if points.length < 2}
  <p class="dim empty">not enough sessions yet</p>
{:else}
  <svg viewBox="0 0 {width} {height}" width="100%" style="height: {height}px">
    <polyline points={path} class="line" />
    {#each points as v, i}
      <circle cx={x(i)} cy={y(v)} r="2.5" class="dot" />
    {/each}
    <text x="2" y="10" class="axis">{fmt(max)}</text>
    <text x="2" y={height - 2} class="axis">{fmt(min)}</text>
  </svg>
{/if}

<style>
  .empty { font-size: 13px; padding: 12px 0; }
  svg { display: block; }
  .line { fill: none; stroke: var(--accent); stroke-width: 1.5; }
  .dot { fill: var(--accent); }
  .axis { font: 500 9px var(--font-mono, monospace); fill: var(--dim); }
</style>
