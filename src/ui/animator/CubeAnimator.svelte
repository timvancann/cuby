<script lang="ts">
  import { parseAlg, invert } from '../../core/cube/parser';
  import type { Move } from '../../core/cube/model';
  import { CubeEngine, type Scheme } from './engine';
  import Icon from '../Icon.svelte';

  let { alg, setup, controls = true, onReady, size, scheme = 'yellow-top' }: {
    alg: string;
    setup?: string;
    controls?: boolean;
    onReady?: () => void;
    size?: number; // fixed pixel size; defaults to the responsive CSS size
    scheme?: Scheme;
  } = $props();

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
        const e = await CubeEngine.create(container, scheme);
        if (cancelled) { e.destroy(); return; }
        engine = e;
        engine.load(moves, setupMoves);
        position = engine.position;
        ready = true;
        onReady?.();
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
  <div class="stage" bind:this={container} style={size ? `width:${size}px;height:${size}px` : ''}>
    {#if !ready && !error}<div class="loading">loading…</div>{/if}
  </div>
  {#if error}
    <p class="error">{error}</p>
  {:else if controls}
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
      <button class="btn" onclick={() => jumpTo(0)} aria-label="back to start"><Icon name="first" /></button>
      <button class="btn" onclick={stepBack} aria-label="previous move"><Icon name="prev" /></button>
      <button class="btn primary" onclick={togglePlay} aria-label={playing ? 'pause' : 'play'}>
        <Icon name={playing ? 'pause' : 'play'} />{playing ? 'Pause' : 'Play'}
      </button>
      <button class="btn" onclick={stepForward} aria-label="next move"><Icon name="next" /></button>
      <button class="btn" onclick={() => jumpTo(moves.length)} aria-label="jump to end"><Icon name="last" /></button>
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
    font-size: var(--fs-small);
  }
  .error {
    color: var(--bad);
    font: 400 var(--fs-caption) var(--font-mono);
  }
  .tape {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px;
    max-width: 100%;
  }
  .tok {
    font: 600 16px var(--font-mono);
    min-width: var(--tap);
    min-height: var(--tap);
    padding: 0 8px;
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
    font: 500 var(--fs-button) var(--font-ui);
    min-height: var(--tap);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    cursor: pointer;
  }
  .btn.primary { flex: 2; }
  .btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 700; }
  .btn:hover { border-color: var(--dim); }
</style>
