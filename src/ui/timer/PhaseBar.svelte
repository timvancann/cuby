<script lang="ts">
  import type { Split } from '../../core/timer/attempt';

  let { phases, splits, liveMs = 0 }: {
    phases: readonly string[];
    splits: Split[];
    liveMs?: number; // elapsed in the currently running phase, 0 when done
  } = $props();

  const COLORS = ['#5b9dd9', '#6fbf73', '#ffd500', '#e08c3c', '#b47ee0', '#d96b6b', '#5bc8c2', '#c9c9c9'];
  const color = (i: number) => COLORS[i % COLORS.length];

  const fmt = (ms: number) => (ms / 1000).toFixed(2);

  // Each phase gets: its recorded ms, the live ms if it's running, or 0 (pending).
  const segments = $derived(
    phases.map((label, i) => ({
      label,
      ms: i < splits.length ? splits[i].ms : i === splits.length ? liveMs : 0,
      pending: i > splits.length || (i === splits.length && liveMs === 0),
    })),
  );
</script>

<div class="phasebar">
  <div class="bar">
    {#each segments as seg, i}
      <div
        class="seg"
        class:pending={seg.pending}
        style="flex-grow: {seg.pending ? 0 : Math.max(seg.ms, 1)}; background: {seg.pending ? 'var(--panel-2)' : color(i)}"
      ></div>
    {/each}
  </div>
  <div class="labels" style="grid-template-columns: repeat({phases.length}, 1fr)">
    {#each segments as seg, i}
      <span class="label">
        <span style="color: {seg.pending ? 'var(--dim)' : color(i)}">{seg.label}</span>
        <b>{seg.pending && seg.ms === 0 ? '' : fmt(seg.ms)}</b>
      </span>
    {/each}
  </div>
</div>

<style>
  .phasebar { width: 100%; max-width: 340px; display: grid; gap: 8px; }
  .bar { display: flex; gap: 3px; height: 10px; }
  .seg { border-radius: 5px; min-width: 10px; transition: flex-grow 120ms linear; }
  .seg.pending { flex: 0 0 34px; }
  .labels { display: grid; gap: 4px; }
  .label { display: flex; flex-direction: column; align-items: center; gap: 2px; font: 500 13px var(--font-ui); }
  .label b { color: var(--text); font: 600 13px var(--font-mono); min-height: 1em; }
</style>
