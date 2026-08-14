<script lang="ts">
  import CaseDiagram from '../CaseDiagram.svelte';
  import CubeAnimator from '../animator/CubeAnimator.svelte';
  import { caseById, pools } from '../../data/caseSet';
  import { activeAlg, getSetting } from '../../data/settings';
  import { mulberry32 } from '../../core/rng';
  import { solvedCube } from '../../core/cube/model';
  import { applyAlg, invert, parseAlg, toAlgString } from '../../core/cube/parser';
  import { ollPattern } from '../../core/cube/pattern';
  import { pickAttempt, type AttemptPick } from '../../core/train/select';

  let { selected }: { selected: string[] } = $props();

  const rand = mulberry32(Date.now() >>> 0);
  const REVEAL_DEAD_MS = 300;

  let pick = $state<AttemptPick | null>(null);
  let stage = $state<'show' | 'reveal'>('show');
  let shownAt = $state(0);       // 0 until the cube has actually rendered
  let elapsedMs = $state(0);
  let revealAt = $state(0);
  let revealAlg = $state('');
  let count = $state(0);
  let lastCaseId: string | undefined;
  let lastVariantByCase: Record<string, string> = {};

  let display = $state<'cube' | 'diagram' | null>(null);

  // CubeAnimator inverts its setup prop, so pass the scramble's inverse:
  // invert(invert(scramble)) = scramble applied to solved = the case state.
  const setupAlg = $derived(pick ? toAlgString(invert(parseAlg(pick.scramble))) : '');

  // The pattern as the scramble actually presents it (random AUF included),
  // so the symbolic view varies its U rotation like the physical cube would.
  const presentedPattern = $derived(pick ? ollPattern(applyAlg(solvedCube(), pick.scramble)) : '');

  function next() {
    pick = pickAttempt({ selected, pools, lastCaseId, lastVariantByCase, rand });
    lastCaseId = pick.caseId;
    lastVariantByCase[pick.caseId] = pick.variant;
    stage = 'show';
    elapsedMs = 0;
    // The diagram renders synchronously; the 3D cube reports readiness via onReady.
    shownAt = display === 'diagram' ? Date.now() : 0;
  }

  $effect(() => {
    if (selected.length < 2 || pick) return;
    getSetting<'cube' | 'diagram'>('dryDisplay', 'cube').then(d => {
      display = d;
      next();
    });
  });

  function cubeReady() {
    shownAt = Date.now();
  }

  // A drag on the cube is a rotation, not a tap: decide on pointerup, but time
  // the tap from the pointerdown moment so recognition timing stays honest.
  const DRAG_SLOP_PX = 10;
  let down: { x: number; y: number; t: number } | null = null;

  function onDown(e: PointerEvent) {
    down = { x: e.clientX, y: e.clientY, t: Date.now() };
  }

  function onUp(e: PointerEvent) {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const t = down.t;
    down = null;
    if (moved > DRAG_SLOP_PX) return;
    void onTap(t);
  }

  async function onTap(t: number) {
    if (!pick) return;
    if (stage === 'show') {
      if (shownAt === 0) return; // cube not rendered yet — timer hasn't started
      elapsedMs = t - shownAt;
      stage = 'reveal';
      revealAt = t;
      count += 1;
      revealAlg = await activeAlg(pick.caseId);
      return;
    }
    if (t - revealAt < REVEAL_DEAD_MS) return;
    next();
  }

  const c = $derived(pick ? caseById.get(pick.caseId) : undefined);
</script>

<button class="zone" onpointerdown={onDown} onpointerup={onUp} onpointercancel={() => (down = null)}>
  {#if pick && stage === 'show'}
    {#if display === 'diagram'}
      <CaseDiagram pattern={presentedPattern} size={200} />
    {:else}
      {#key pick.scramble}
        <CubeAnimator alg="" setup={setupAlg} controls={false} onReady={cubeReady} />
      {/key}
    {/if}
    <p class="hint">{shownAt ? 'tap when you recognize the case' : 'dealing…'}</p>
  {:else if c}
    <div class="reveal">
      <CaseDiagram pattern={c.pattern} size={96} />
      <h2>{c.name} <span class="dim">#{c.oll}</span></h2>
      <p class="alg">{revealAlg}</p>
      {#if c.triggers}<p class="dim">{c.triggers}</p>{/if}
      <p class="time">{(elapsedMs / 1000).toFixed(2)}s</p>
      <p class="hint">tap for the next case</p>
    </div>
  {/if}
</button>
<p class="count dim">{count} recognized this session — nothing is recorded in dry mode</p>

<style>
  .zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: none;
    border: 0;
    color: var(--text);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
  }
  .hint { color: var(--dim); font-size: 13px; }
  .reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .reveal h2 { font-size: 20px; }
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 26ch; }
  .time { font: 600 40px var(--font-mono); color: var(--accent); font-variant-numeric: tabular-nums; }
  .count { font-size: 12px; text-align: center; padding-bottom: 8px; }
</style>
