<script lang="ts">
  import { parseAlg, invert } from '../../core/cube/parser';
  import type { Move } from '../../core/cube/model';
  import { CubeEngine } from './engine';

  let { alg, setup }: { alg: string; setup?: string } = $props();

  let container: HTMLDivElement;
  let engine: CubeEngine | null = null;
  let ready = $state(false);
  let error = $state('');
  let moves = $state<Move[]>([]);
  let position = $state(0);
  let playing = $state(false);

  $effect(() => {
    let cancelled = false;
    (async () => {
      try {
        moves = parseAlg(alg);
        const setupMoves = setup ? invert(parseAlg(setup)) : [];
        error = '';
        const e = await CubeEngine.create(container);
        if (cancelled) { e.destroy(); return; }
        engine = e;
        engine.load(moves, setupMoves);
        position = engine.position;
        ready = true;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    })();
    return () => {
      cancelled = true;
      engine?.destroy();
      engine = null;
    };
  });

  function stepForward() {
    engine?.stepForward(() => { position = engine!.position; });
  }
  function stepBack() {
    engine?.stepBack();
    position = engine?.position ?? position;
  }
  function jumpTo(i: number) {
    engine?.jumpTo(i);
    position = engine?.position ?? position;
  }
  function togglePlay() {
    if (!engine) return;
    if (playing) {
      engine.pause();
      playing = false;
      return;
    }
    playing = true;
    engine.play(
      i => { position = i; },
      () => { playing = false; position = engine!.position; },
    );
  }
</script>

<div class="animator">
  <div class="stage" bind:this={container}>
    {#if !ready && !error}<div class="loading">loading…</div>{/if}
  </div>
  {#if error}
    <p class="error">{error}</p>
  {:else}
    <div class="tape">
      {#each moves as mv, i (i)}
        <button
          class="tok"
          class:done={i < position}
          class:current={i === position}
          onclick={() => jumpTo(i)}
        >{mv.label}</button>
      {/each}
    </div>
    <div class="transport">
      <button class="btn" onclick={() => jumpTo(0)} title="Back to start">⏮</button>
      <button class="btn" onclick={stepBack} title="Previous move">◀</button>
      <button class="btn primary" onclick={togglePlay} title="Play / pause">{playing ? '⏸ Pause' : '▶ Play'}</button>
      <button class="btn" onclick={stepForward} title="Next move">▶</button>
      <button class="btn" onclick={() => jumpTo(moves.length)} title="Jump to end">⏭</button>
    </div>
  {/if}
</div>

<style>
  .animator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
  }
  .stage {
    width: min(78vw, 300px);
    height: min(78vw, 300px);
    position: relative;
  }
  .stage :global(canvas) { cursor: grab; touch-action: none; }
  .stage :global(canvas:active) { cursor: grabbing; }
  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--dim);
    font-size: 13px;
  }
  .error {
    color: var(--bad);
    font: 400 12px var(--font-mono);
  }
  .tape {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    max-width: 100%;
  }
  .tok {
    font: 600 16px var(--font-mono);
    padding: 5px 9px;
    border-radius: 6px;
    border: 1px solid transparent;
    color: var(--dim);
    cursor: pointer;
    user-select: none;
    background: transparent;
  }
  .tok.done { color: var(--text); }
  .tok.current { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
  .tok:hover:not(.current) { border-color: var(--line); }
  .transport { display: flex; gap: 8px; align-items: center; width: 100%; }
  .btn {
    flex: 1;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--text);
    border-radius: var(--radius);
    font: 500 14px var(--font-ui);
    padding: 9px 0;
    text-align: center;
    cursor: pointer;
  }
  .btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 700; }
  .btn:hover { border-color: var(--dim); }
</style>
