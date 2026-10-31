<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import CaseDiagram from '../CaseDiagram.svelte';
  import { caseById, pools } from '../../data/caseSet';
  import { activeAlg, getCaseSelection, getSetting, setSetting } from '../../data/settings';
  import { type Flag } from '../../data/db';
  import { recordAttempt, setAttemptFlag } from '../../data/attempts';
  import { totalMs } from '../../core/timer/attempt';
  import { mulberry32 } from '../../core/rng';
  import { navigate } from '../router.svelte';
  import { newAttempt, retryAttempt, tapZone } from '../train/flow';
  import TriggerSheet from '../TriggerSheet.svelte';
  import DryPractice from '../train/DryPractice.svelte';
  import { drillKeys } from '../keys';
  import ScrambleGrid from '../ScrambleGrid.svelte';
  import ModeCubeArt from '../train/ModeCubeArt.svelte';
  import AlgText from '../AlgText.svelte';
  import Icon from '../Icon.svelte';
  import { acquireWakeLock, releaseWakeLock } from '../wakeLock';
  import { bumpCount, dry, sessionCount, train } from '../drillState.svelte';
  import { fmtMs } from '../format';
  import { clockNow, slopTap } from '../tap';
  import { MOTION } from '../motion';

  const rand = mulberry32(Date.now() >>> 0);

  let selected = $state<string[]>([]);
  let loaded = $state(false);
  let now = $state(0);
  let vibration = $state(true);
  let showScramble = $state(false);

  // 'select' shows the mode cards; a chosen mode is remembered so the tab
  // reopens straight into it.
  let view = $state<'select' | 'cube' | 'dry' | null>(null);

  $effect(() => {
    getCaseSelection().then(ids => {
      const valid = ids.filter(id => id in pools);
      selected = valid;
      loaded = true;
      const key = valid.join(',');
      // Keep the dealt attempt across tab switches unless the selection changed.
      if (valid.length >= 2 && (!train.flow || train.selectionKey !== key)) {
        train.flow = newAttempt(null, valid, rand);
        train.retry = false;
      }
      train.selectionKey = key;
    });
    getSetting<'cube' | 'dry' | null>('practiceMode', null).then(m => { view = m ?? 'select'; });
  });

  $effect(() => {
    void acquireWakeLock();
    getSetting('vibration', true).then(v => { vibration = v; });
    return () => {
      void releaseWakeLock();
      // Leaving mid-solve (back gesture, anything) discards the solve: the
      // clock would otherwise keep running and save a made-up time.
      discardSolve();
    };
  });

  $effect(() => {
    if (train.flow?.stage !== 'solving') return;
    let raf = 0;
    const tick = () => { now = clockNow(); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  $effect(() =>
    drillKeys({
      onSpace: () => void onTap(clockNow()),
      onEscape: skip,
      enabled: () => view === 'cube' && train.flow !== null && !showScramble,
    }),
  );

  function discardSolve() {
    if (train.flow?.stage === 'solving') {
      train.flow = newAttempt(train.flow, selected, rand);
      train.retry = false;
    }
  }

  async function onTap(t: number) {
    const before = train.flow;
    if (!before) return;
    const next = tapZone(before, selected, rand, t);
    if (next === before) return;
    if (vibration && 'vibrate' in navigator) navigator.vibrate(10);
    if (before.stage === 'reveal') train.retry = false; // a fresh case was dealt
    train.flow = next;
    if (next.stage === 'reveal') {
      train.flag = 'ok';
      train.attemptId = null;
      train.revealAlg = '';
      train.revealAlg = await activeAlg(next.pick.caseId);
      const newId = await recordAttempt({
        mode: 'case', config: selected, now: Date.now(), timer: next.timer,
        caseId: next.pick.caseId, scramble: next.pick.scramble, retry: train.retry,
      });
      train.attemptId = newId;
      if (train.flag !== 'ok') await setAttemptFlag(newId, train.flag);
      if (!train.retry) bumpCount(train.count, Date.now());
    }
  }

  // Before the solve: deal another case. During it: throw the solve away.
  // Nothing is recorded either way. On the reveal there is nothing to undo.
  function skip() {
    const f = train.flow;
    if (!f || f.stage === 'reveal') return;
    train.flow = newAttempt(f, selected, rand);
    train.retry = false;
  }

  async function setFlag(f: Flag) {
    train.flag = f;
    if (train.attemptId !== null) await setAttemptFlag(train.attemptId, f);
  }

  function retry() {
    if (!train.flow || train.flow.stage !== 'reveal') return;
    train.flow = retryAttempt(train.flow);
    train.retry = true;
  }

  const flow = $derived(train.flow);
  const c = $derived(flow ? caseById.get(flow.pick.caseId) : undefined);
  const tap = slopTap(t => void onTap(t));

  function enterMode(m: 'cube' | 'dry') {
    view = m;
    void setSetting('practiceMode', m);
  }

  function backToModes() {
    discardSolve();
    view = 'select';
    void setSetting('practiceMode', null);
  }
</script>

<div class="screen train">
  <!-- One grid cell: switching views crossfades instead of stacking them. -->
  <div class="stage">
  {#if loaded && selected.length < 2}
    <div class="empty" transition:fade={MOTION}>
      <h1 class="h1">Train</h1>
      <p>Pick the OLL cases you're learning first, at least two.</p>
      <p class="dim">Then choose how to practice: <b>cube practice</b> deals a scramble for your
        real cube and times the solve, <b>dry practice</b> shows cases on screen and times how
        fast you recognize them.</p>
      <button class="primary" onclick={() => navigate('/cases')}>Choose cases</button>
    </div>
  {:else if view === 'select' && loaded}
    <div class="mode-select" transition:fade={MOTION}>
      <div class="mode-col">
        <h1 class="h1">Train</h1>
        <button class="mode-card" onclick={() => enterMode('cube')}>
          <ModeCubeArt size={112} />
          <span class="mode-name">Cube practice</span>
          <span class="dim">scramble, recognize and solve on your cube</span>
        </button>
        <button class="mode-card" onclick={() => enterMode('dry')}>
          <CaseDiagram pattern={caseById.get('sune')?.pattern ?? ''} size={104} />
          <span class="mode-name">Dry practice</span>
          <span class="dim">recognition only, no cube in hand</span>
        </button>
      </div>
    </div>
  {:else if view && view !== 'select' && flow}
    <div class="drill" transition:fade={MOTION}>
      <header>
        <button class="back" onclick={backToModes}><Icon name="back" />Modes</button>
        {#if view === 'cube'}
          {#if flow.stage === 'scrambled'}
            <button class="ghost" onclick={skip}>Skip case</button>
          {:else if flow.stage === 'solving'}
            <button class="ghost" onclick={skip}>Abort</button>
          {:else}
            <button class="ghost" onclick={() => (showScramble = true)}>Animate scramble</button>
          {/if}
        {/if}
      </header>
      <p class="sub dim">
        {view === 'cube' ? 'Cube practice' : 'Dry practice'}, {sessionCount(view === 'cube' ? train.count : dry.count, Date.now())} this session
      </p>
      {#if view === 'dry'}
        <DryPractice {selected} />
      {:else}
        <div class="zone" role="button" tabindex="-1" {...tap}>
          <div class="zone-inner">
            {#if flow.stage === 'scrambled'}
              <p class="hint">{train.retry ? 'same scramble again: ' : ''}execute, then tap to start solving</p>
              <ScrambleGrid scramble={flow.pick.scramble} perRow={4} />
            {:else if flow.stage === 'solving'}
              <p class="clock">{fmtMs(Math.max(0, now - flow.timer.startedAt))}</p>
              <p class="hint">solving, tap when done</p>
            {:else if c}
              <div class="reveal">
                <p class="time">{fmtMs(totalMs(flow.timer))}</p>
                <CaseDiagram pattern={c.pattern} size={96} />
                <h2>{c.name} <span class="dim">#{c.oll}</span></h2>
                <p class="alg"><AlgText alg={train.revealAlg} /></p>
                {#if c.triggers}<p class="dim small">{c.triggers}</p>{/if}
                {#if c.notes}<p class="dim small note">{c.notes}</p>{/if}
                <div class="reveal-scramble">
                  <span class="section-label">scramble</span>
                  <ScrambleGrid scramble={flow.pick.scramble} small perRow={5} />
                </div>
                <p class="hint">tap anywhere for the next case</p>
              </div>
            {/if}
          </div>
        </div>
        {#if flow.stage === 'reveal'}
          <footer transition:slide={MOTION}>
            <div class="flags" role="group" aria-label="flag this attempt">
              <button aria-pressed={train.flag === 'ok'} class:on={train.flag === 'ok'} onclick={() => setFlag('ok')}>OK</button>
              <button aria-pressed={train.flag === 'misrecognized'} class:on={train.flag === 'misrecognized'} onclick={() => setFlag('misrecognized')}>Misrecognized</button>
              <button aria-pressed={train.flag === 'dnf'} class:on={train.flag === 'dnf'} onclick={() => setFlag('dnf')}>DNF</button>
            </div>
            <div class="actions">
              <button class="secondary" onclick={retry}><Icon name="retry" size={18} />Retry scramble</button>
              <button class="primary" onclick={() => void onTap(clockNow())}>Next</button>
            </div>
          </footer>
        {/if}
      {/if}
    </div>
  {/if}
  </div>
</div>

{#if showScramble && flow}
  <TriggerSheet name="Scramble" moves={flow.pick.scramble} onClose={() => (showScramble = false)} />
{/if}

<style>
  .train { display: flex; flex-direction: column; height: 100dvh; min-height: 0; }
  .stage { flex: 1; min-height: 0; display: grid; grid-template: minmax(0, 1fr) / minmax(0, 1fr); }
  .stage > * { grid-area: 1 / 1; min-height: 0; }
  .drill { display: flex; flex-direction: column; }
  .empty { margin: auto 0; display: grid; gap: 12px; max-width: 36ch; }
  .empty .primary { justify-self: start; padding: 0 20px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .sub { font-size: var(--fs-small); margin-top: 6px; }
  .back, .ghost {
    display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
    min-height: var(--tap); padding: 0 14px; border-radius: var(--radius); cursor: pointer;
    font: 600 var(--fs-body) var(--font-ui);
  }
  .back { background: var(--panel); border: 1px solid var(--line); color: var(--text); padding-left: 8px; }
  .ghost { background: none; border: 1px solid var(--line); color: var(--dim); font-weight: 500; font-size: var(--fs-button); }
  .mode-select { flex: 1; display: flex; align-items: center; justify-content: center; }
  .mode-col { display: grid; gap: 16px; width: min(100%, 38dvh); }
  .mode-card {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
    aspect-ratio: 1; width: 100%;
    background: var(--panel); border: 2px solid var(--line); border-radius: 14px;
    color: var(--text); text-align: center; padding: 18px; cursor: pointer;
  }
  .mode-card:active { border-color: var(--accent); }
  .mode-name { font: 700 var(--fs-title) var(--font-ui); margin-top: 6px; }
  .mode-card .dim { font-size: var(--fs-small); max-width: 24ch; text-wrap: balance; }
  .zone {
    flex: 1; min-height: 0; overflow: hidden auto; display: flex; flex-direction: column;
    color: var(--text); cursor: pointer; outline: none;
    -webkit-tap-highlight-color: transparent; touch-action: pan-y; user-select: none;
  }
  /* margin:auto centres when there's room and scrolls from the top when there isn't. */
  .zone-inner { margin: auto 0; padding: 16px 0; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .hint { color: var(--dim); font-size: var(--fs-small); text-align: center; }
  .clock { font: 600 64px var(--font-mono); font-variant-numeric: tabular-nums; }
  .reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .time { font: 600 40px var(--font-mono); color: var(--accent); font-variant-numeric: tabular-nums; margin-bottom: 4px; }
  .reveal h2 { font: 600 var(--fs-title) var(--font-ui); }
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 30ch; }
  .small { font-size: var(--fs-small); max-width: 34ch; }
  .reveal-scramble { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 6px 0 4px; }
  footer { flex: none; display: grid; gap: 8px; padding: 8px 0; }
  .flags { display: flex; gap: 8px; }
  .flags button {
    flex: 1; min-height: var(--tap); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  /* Selected flag: outlined, so the only solid yellow is the Next action. */
  .flags button.on { color: var(--accent); background: var(--panel-2); border-color: var(--accent); font-weight: 600; }
  .actions { display: grid; grid-template-columns: 1fr 1.2fr; gap: 8px; }
  .secondary {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 48px; background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: var(--radius); font: 600 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  .primary {
    min-height: 48px; background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 var(--fs-body) var(--font-ui); cursor: pointer;
  }
  @media (hover: hover) {
    .mode-card:hover { border-color: var(--dim); }
  }

  /* Desktop: the two mode cards side by side, and a bigger clock. */
  @media (min-width: 900px) and (min-height: 600px) {
    .train { max-width: 800px; }
    .mode-col { grid-template-columns: 1fr 1fr; width: min(100%, 720px); }
    .mode-col .h1 { grid-column: 1 / -1; }
    .drill { width: 100%; max-width: 560px; justify-self: center; }
    .clock { font-size: 96px; }
  }
</style>
