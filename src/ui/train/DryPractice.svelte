<script lang="ts">
  import CaseDiagram from '../CaseDiagram.svelte';
  import CubeAnimator from '../animator/CubeAnimator.svelte';
  import AlgText from '../AlgText.svelte';
  import { caseById, pools } from '../../data/caseSet';
  import { activeAlg, getSetting } from '../../data/settings';
  import { recordAttempt, setAttemptFlag } from '../../data/attempts';
  import type { Flag } from '../../data/db';
  import { mulberry32 } from '../../core/rng';
  import { solvedCube } from '../../core/cube/model';
  import { applyAlg, invert, parseAlg, toAlgString } from '../../core/cube/parser';
  import { ollPattern } from '../../core/cube/pattern';
  import { createTimer, tap as tapTimer } from '../../core/timer/attempt';
  import { pickAttempt } from '../../core/train/select';
  import { drillKeys } from '../keys';
  import { bumpCount, dry as d } from '../drillState.svelte';
  import { fmtMs } from '../format';
  import { clockNow, slopTap } from '../tap';

  let { selected }: { selected: string[] } = $props();

  const rand = mulberry32(Date.now() >>> 0);
  const REVEAL_DEAD_MS = 300;

  let display = $state<'cube' | 'diagram' | null>(null);

  const pick = $derived(d.pick);

  // CubeAnimator inverts its setup prop, so pass the scramble's inverse:
  // invert(invert(scramble)) = scramble applied to solved = the case state.
  const setupAlg = $derived(pick ? toAlgString(invert(parseAlg(pick.scramble))) : '');

  // The pattern as the scramble actually presents it (random AUF included),
  // so the symbolic view varies its U rotation like the physical cube would.
  const presentedPattern = $derived(pick ? ollPattern(applyAlg(solvedCube(), pick.scramble)) : '');

  function next() {
    const p = pickAttempt({ selected, pools, lastCaseId: d.lastCaseId, lastVariantByCase: d.lastVariantByCase, rand });
    d.pick = p;
    d.lastCaseId = p.caseId;
    d.lastVariantByCase[p.caseId] = p.variant;
    d.stage = 'show';
    d.elapsedMs = 0;
    d.flag = 'ok';
    d.attemptId = null;
    // The diagram renders synchronously; the 3D cube reports readiness via onReady.
    d.shownAt = display === 'diagram' ? clockNow() : 0;
  }

  $effect(() => {
    if (selected.length < 2) return;
    const key = selected.join(',');
    getSetting<'cube' | 'diagram'>('dryDisplay', 'cube').then(disp => {
      display = disp;
      if (!d.pick || d.selectionKey !== key) {
        d.selectionKey = key;
        next();
      } else if (d.stage === 'show') {
        // Back from another tab with a case showing: recognition restarts now
        // (the time spent away doesn't count).
        d.shownAt = disp === 'diagram' ? clockNow() : 0;
      }
    });
  });

  function cubeReady() {
    d.shownAt = clockNow();
  }

  $effect(() => drillKeys({ onSpace: () => void onTap(clockNow()), onEscape: skip }));

  // A drag on the cube is a rotation, not a tap (slopTap decides on pointerup,
  // timed from pointerdown so recognition timing stays honest).
  const tap = slopTap(t => void onTap(t));

  async function onTap(t: number) {
    const p = d.pick;
    if (!p) return;
    if (d.stage === 'show') {
      // Not on screen yet, or the press began before the case appeared.
      if (d.shownAt === 0 || t < d.shownAt) return;
      const shownAt = d.shownAt;
      d.elapsedMs = t - shownAt;
      d.stage = 'reveal';
      d.revealAt = t;
      d.revealAlg = await activeAlg(p.caseId);
      const timer = tapTimer(tapTimer(createTimer(['recognition']), shownAt), t);
      const id = await recordAttempt({
        mode: 'dry', config: selected, now: Date.now(), timer, caseId: p.caseId, scramble: p.scramble,
      });
      bumpCount(d.count, Date.now());
      if (d.pick !== p) return; // already moved on: the flag buttons belong to the next case
      d.attemptId = id;
      if (d.flag !== 'ok') await setAttemptFlag(id, d.flag);
      return;
    }
    if (t - d.revealAt < REVEAL_DEAD_MS) return;
    next();
  }

  // Deal another case without recording (only while a case is showing).
  function skip() {
    if (d.stage === 'show') next();
  }

  async function setFlag(f: Flag) {
    d.flag = f;
    if (d.attemptId !== null) await setAttemptFlag(d.attemptId, f);
  }

  const c = $derived(pick ? caseById.get(pick.caseId) : undefined);
</script>

<div class="zone" role="button" tabindex="-1" {...tap}>
  <div class="zone-inner">
    {#if pick && d.stage === 'show' && display}
      {#if display === 'diagram'}
        <CaseDiagram pattern={presentedPattern} size={200} />
      {:else}
        {#key pick.scramble}
          <CubeAnimator alg="" setup={setupAlg} controls={false} onReady={cubeReady} />
        {/key}
      {/if}
      <p class="hint">{d.shownAt ? 'tap when you recognize the case' : 'dealing…'}</p>
    {:else if c && d.stage === 'reveal'}
      <div class="reveal">
        <p class="time">{fmtMs(d.elapsedMs)}</p>
        <CaseDiagram pattern={c.pattern} size={96} />
        <h2>{c.name} <span class="dim">#{c.oll}</span></h2>
        <p class="alg"><AlgText alg={d.revealAlg} /></p>
        {#if c.triggers}<p class="dim small">{c.triggers}</p>{/if}
        <p class="hint">tap anywhere for the next case</p>
      </div>
    {/if}
  </div>
</div>
<footer>
  {#if d.stage === 'reveal'}
    <div class="flags" role="group" aria-label="flag this attempt">
      <button aria-pressed={d.flag === 'ok'} class:on={d.flag === 'ok'} onclick={() => setFlag('ok')}>Recognized</button>
      <button aria-pressed={d.flag === 'misrecognized'} class:on={d.flag === 'misrecognized'} onclick={() => setFlag('misrecognized')}>Got it wrong</button>
    </div>
    <button class="primary" onclick={() => void onTap(clockNow())}>Next</button>
  {:else}
    <button class="ghost" onclick={skip}>Skip case</button>
  {/if}
</footer>

<style>
  .zone {
    flex: 1; min-height: 0; overflow: hidden auto; display: flex; flex-direction: column;
    color: var(--text); cursor: pointer; outline: none;
    -webkit-tap-highlight-color: transparent; touch-action: pan-y; user-select: none;
  }
  .zone-inner { margin: auto 0; padding: 16px 0; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .hint { color: var(--dim); font-size: var(--fs-small); text-align: center; }
  .reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .reveal h2 { font: 600 var(--fs-title) var(--font-ui); }
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 30ch; }
  .small { font-size: var(--fs-small); max-width: 34ch; }
  .time { font: 600 40px var(--font-mono); color: var(--accent); font-variant-numeric: tabular-nums; margin-bottom: 4px; }
  footer { flex: none; display: grid; gap: 8px; padding: 8px 0; }
  .flags { display: flex; gap: 8px; }
  .flags button {
    flex: 1; min-height: var(--tap); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  .flags button.on { color: var(--accent); background: var(--panel-2); border-color: var(--accent); font-weight: 600; }
  .primary {
    min-height: 48px; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 var(--fs-body) var(--font-ui); cursor: pointer;
  }
  .ghost {
    min-height: var(--tap); background: none; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
</style>
