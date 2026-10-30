<script lang="ts">
  import type { Split } from '../../core/timer/attempt';
  import { fmtMs } from '../format';

  let { phases, splits, liveMs = 0 }: {
    phases: readonly string[];
    splits: Split[];
    liveMs?: number; // elapsed in the currently running phase, 0 when done
  } = $props();

  const COLORS = ['#5b9dd9', '#6fbf73', '#ffd500', '#e08c3c', '#5bc8c2', '#d96b6b', '#c9a27a', '#c9c9c9'];
  const color = (i: number) => COLORS[i % COLORS.length];

  // Each phase gets: its recorded ms, the live ms if it's running, or 0 (pending).
  const segments = $derived(
    phases.map((label, i) => ({
      label,
      ms: i < splits.length ? splits[i].ms : i === splits.length ? liveMs : 0,
      pending: i > splits.length || (i === splits.length && liveMs === 0),
    })),
  );
</script>

<!-- Each label sits under its own segment, so the column widths follow the bar. -->
<div class="phasebar" style="--n: {phases.length}">
  {#each segments as seg, i}
    <div class="col" class:pending={seg.pending} style="flex-grow: {seg.pending ? 0 : Math.max(seg.ms, 1)}">
      <div class="seg" style="background: {seg.pending ? 'var(--panel-2)' : color(i)}"></div>
      <span class="label" style="color: {seg.pending ? 'var(--dim)' : color(i)}">{seg.label}</span>
      <b>{seg.pending && seg.ms === 0 ? '' : fmtMs(seg.ms)}</b>
    </div>
  {/each}
</div>

<style>
  .phasebar { width: 100%; max-width: 360px; display: flex; gap: 3px; }
  /* Columns get a fair share of the width as their floor, capped at 52px, so
     any number of phases fits. */
  .col {
    --floor: min(52px, calc((100% - (var(--n) - 1) * 3px) / var(--n)));
    flex-basis: 0; min-width: var(--floor); display: flex; flex-direction: column; align-items: center; gap: 4px;
    transition: flex-grow 120ms linear;
  }
  .col.pending { flex: 0 0 var(--floor); }
  .seg { width: 100%; height: 10px; border-radius: 5px; }
  .label {
    max-width: 100%; overflow: hidden; text-overflow: ellipsis;
    font: 500 var(--fs-small) var(--font-ui); white-space: nowrap;
  }
  b { color: var(--text); font: 600 var(--fs-small) var(--font-mono); min-height: 1.2em; font-variant-numeric: tabular-nums; }
</style>
