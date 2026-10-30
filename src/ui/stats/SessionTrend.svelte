<script lang="ts">
  import { fmtMs } from '../format';

  const { points }: { points: number[] } = $props();

  // Labels get their own gutter on the left so they never sit on the data.
  const width = 340;
  const height = 110;
  const gutter = 44;
  const pad = 8;

  const min = $derived(Math.min(...points));
  const max = $derived(Math.max(...points));
  const range = $derived(max - min || 1);

  function x(i: number): number {
    const w = width - gutter - pad * 2;
    return points.length <= 1 ? gutter + w / 2 : gutter + pad + (i / (points.length - 1)) * w;
  }
  function y(v: number): number {
    return height - pad - ((v - min) / range) * (height - pad * 2);
  }

  const path = $derived(points.map((v, i) => `${x(i)},${y(v)}`).join(' '));
</script>

{#if points.length < 2}
  <p class="dim empty">not enough sessions yet</p>
{:else}
  <svg viewBox="0 0 {width} {height}" width="100%" role="img"
    aria-label="session mean times, oldest to newest">
    <line x1={gutter} x2={width} y1={y(max)} y2={y(max)} class="grid" />
    <line x1={gutter} x2={width} y1={y(min)} y2={y(min)} class="grid" />
    <polyline points={path} class="line" />
    {#each points as v, i}<circle cx={x(i)} cy={y(v)} r="2.5" class="dot" />{/each}
    <text x={gutter - 6} y={y(max) + 3} class="axis">{fmtMs(max)}</text>
    <text x={gutter - 6} y={y(min) + 3} class="axis">{fmtMs(min)}</text>
  </svg>
  <p class="dim caption">session means, oldest to newest</p>
{/if}

<style>
  .empty { font-size: var(--fs-small); padding: 12px 0; }
  svg { display: block; }
  .line { fill: none; stroke: var(--accent); stroke-width: 1.75; stroke-linejoin: round; }
  .dot { fill: var(--accent); }
  .grid { stroke: var(--line); stroke-dasharray: 2 3; }
  .axis { font: 500 var(--fs-label) var(--font-mono, monospace); fill: var(--dim); text-anchor: end; }
  .caption { font-size: var(--fs-caption); }
</style>
