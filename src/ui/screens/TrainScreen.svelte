<script lang="ts">
  import CaseDiagram from '../CaseDiagram.svelte';
  import { caseById, pools } from '../../data/caseSet';
  import { activeAlg, getCaseSelection, getSetting, setSetting } from '../../data/settings';
  import { type Flag } from '../../data/db';
  import { endActiveSession } from '../../data/sessions';
  import { recordAttempt, setAttemptFlag } from '../../data/attempts';
  import { splits, totalMs } from '../../core/timer/attempt';
  import { mulberry32 } from '../../core/rng';
  import { navigate } from '../router.svelte';
  import { newAttempt, tapZone, type FlowState } from '../train/flow';
  import TriggerSheet from '../TriggerSheet.svelte';
  import DryPractice from '../train/DryPractice.svelte';
  import ModeCubeArt from '../train/ModeCubeArt.svelte';
  import { acquireWakeLock, releaseWakeLock } from '../wakeLock';

  const rand = mulberry32(Date.now() >>> 0);

  let selected = $state<string[]>([]);
  let flow = $state<FlowState | null>(null);
  let attemptId = $state<number | null>(null);
  let flag = $state<Flag>('ok');
  let revealAlg = $state('');
  let now = $state(0);
  let sessionCount = $state(0);
  let vibration = $state(true);

  $effect(() => {
    getCaseSelection().then(ids => {
      const valid = ids.filter(id => id in pools);
      selected = valid;
      if (valid.length >= 2) flow = newAttempt(null, valid, rand);
    });
  });

  $effect(() => {
    void acquireWakeLock();
    getSetting('vibration', true).then(v => { vibration = v; });
    return () => {
      void releaseWakeLock();
      void endActiveSession(Date.now());
    };
  });

  $effect(() => {
    if (flow?.stage !== 'recognizing' && flow?.stage !== 'solving') return;
    let raf = 0;
    const tick = () => { now = Date.now(); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  function fmt(ms: number): string {
    return (ms / 1000).toFixed(2);
  }

  async function onTap() {
    if (!flow) return;
    const t = Date.now();
    now = t;
    const before = flow;
    const next = tapZone(before, selected, rand, t);
    if (next === before) return;
    if (vibration && 'vibrate' in navigator) navigator.vibrate(10);
    flow = next;
    if (next.stage === 'reveal') {
      flag = 'ok';
      attemptId = null;
      revealAlg = '';
      revealAlg = await activeAlg(next.pick.caseId);
      const newId = await recordAttempt({
        mode: 'case', config: selected, now: t, timer: next.timer,
        caseId: next.pick.caseId, scramble: next.pick.scramble,
      });
      attemptId = newId;
      if (flag !== 'ok') await setAttemptFlag(newId, flag);
      sessionCount += 1;
    }
  }

  function abort() {
    if (!flow) return;
    flow = newAttempt(flow, selected, rand);
  }

  async function setFlag(f: Flag) {
    flag = f;
    if (attemptId !== null) await setAttemptFlag(attemptId, f);
  }

  const c = $derived(flow ? caseById.get(flow.pick.caseId) : undefined);

  let showScramble = $state(false);

  // 'select' shows the mode cards; a chosen mode is remembered so the tab
  // reopens straight into it. Back returns to (and re-arms) the selection.
  let view = $state<'select' | 'cube' | 'dry' | null>(null);

  $effect(() => {
    getSetting<'cube' | 'dry' | null>('practiceMode', null).then(m => { view = m ?? 'select'; });
  });

  function enterMode(m: 'cube' | 'dry') {
    view = m;
    void setSetting('practiceMode', m);
  }

  function backToModes() {
    view = 'select';
    void setSetting('practiceMode', null);
  }
</script>

<div class="screen train">
  {#if selected.length < 2}
    <div class="empty">
      <p>Select at least 2 cases to train.</p>
      <button class="primary" onclick={() => navigate('/cases')}>Choose cases</button>
    </div>
  {:else if view === 'select'}
    <div class="mode-select">
      <h1>Train</h1>
      <button class="mode-card" onclick={() => enterMode('cube')}>
        <ModeCubeArt size={120} />
        <span class="mode-name">OLL Cube Practice</span>
        <span class="dim">scramble, recognize, and solve on your cube</span>
      </button>
      <button class="mode-card" onclick={() => enterMode('dry')}>
        <CaseDiagram pattern={caseById.get('sune')?.pattern ?? ''} size={104} />
        <span class="mode-name">OLL Dry Practice</span>
        <span class="dim">recognition only — no cube in hand</span>
      </button>
    </div>
  {:else if view && flow}
    <header>
      <button class="back" onclick={backToModes}>← modes</button>
      {#if view === 'cube'}
        <span class="dim count">{sessionCount} this session</span>
        {#if flow.stage === 'scrambled'}
          <button class="abort" onclick={() => (showScramble = true)}>animate</button>
        {/if}
        <button class="abort" onclick={abort}>abort</button>
      {/if}
    </header>
    {#if view === 'dry'}
      <DryPractice {selected} />
    {:else}
    <button class="zone" onpointerdown={onTap}>
      {#if flow.stage === 'scrambled'}
        <p class="hint">execute, then tap to start recognition</p>
        <p class="scramble">{flow.pick.scramble}</p>
      {:else if flow.stage === 'recognizing'}
        <p class="clock">{fmt(now - flow.timer.startedAt)}</p>
        <p class="hint">recognizing — tap when you start turning</p>
      {:else if flow.stage === 'solving'}
        <p class="clock">{fmt(now - flow.timer.boundaries[0])}</p>
        <p class="hint">solving — tap when done</p>
      {:else if c}
        <div class="reveal">
          <CaseDiagram pattern={c.pattern} size={96} />
          <h2>{c.name} <span class="dim">#{c.oll}</span></h2>
          <p class="alg">{revealAlg}</p>
          {#if c.triggers}<p class="dim">{c.triggers}</p>{/if}
          {#if c.notes}<p class="dim note">{c.notes}</p>{/if}
          <div class="splits">
            {#each splits(flow.timer) as sp}
              <span>{sp.label} <b>{fmt(sp.ms)}</b></span>
            {/each}
            <span>total <b>{fmt(totalMs(flow.timer))}</b></span>
          </div>
        </div>
      {/if}
    </button>
    {#if flow.stage === 'reveal'}
      <footer>
        <div class="flags">
          <button class:on={flag === 'ok'} onclick={() => setFlag('ok')}>OK</button>
          <button class:on={flag === 'misrecognized'} onclick={() => setFlag('misrecognized')}>misrec.</button>
          <button class:on={flag === 'dnf'} onclick={() => setFlag('dnf')}>DNF</button>
        </div>
        <button class="primary next" onpointerdown={onTap}>Next</button>
      </footer>
    {/if}
    {/if}
  {/if}
</div>

{#if showScramble && flow}
  <TriggerSheet name="Scramble" moves={flow.pick.scramble} onClose={() => (showScramble = false)} />
{/if}

<style>
  .train { display: flex; flex-direction: column; }
  .empty { margin: auto; text-align: center; display: grid; gap: 12px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  header .count { margin-left: auto; }
  .back {
    background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--text); font: 600 15px var(--font-ui); padding: 0 18px; min-height: 44px; cursor: pointer;
  }
  .mode-select { display: grid; gap: 16px; align-content: center; justify-items: center; flex: 1; }
  .mode-select h1 { font-size: 20px; justify-self: start; }
  .mode-card {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    aspect-ratio: 1; width: min(100%, 38dvh);
    background: var(--panel); border: 2px solid var(--line); border-radius: 14px;
    color: var(--text); text-align: center; padding: 18px; cursor: pointer;
  }
  .mode-card:active { border-color: var(--accent); }
  .mode-name { font: 700 18px var(--font-ui); }
  .mode-card .dim { font-size: 12px; max-width: 24ch; }
  .abort {
    background: none; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 14px var(--font-ui); padding: 0 16px; min-height: 44px; cursor: pointer;
  }
  .zone {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 16px; background: none; border: 0; color: var(--text); cursor: pointer;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;
  }
  .hint { color: var(--dim); font-size: 13px; }
  .scramble { font: 600 26px/1.6 var(--font-mono); max-width: 22ch; }
  .clock { font: 600 64px var(--font-mono); font-variant-numeric: tabular-nums; }
  .reveal { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .reveal h2 { font-size: 20px; }
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 26ch; }
  .note { font-size: 12px; max-width: 34ch; }
  .splits { display: flex; gap: 14px; color: var(--dim); font-size: 13px; margin-top: 4px; }
  .splits b { color: var(--text); font-family: var(--font-mono); }
  footer { display: grid; gap: 10px; padding-bottom: 8px; }
  .flags { display: flex; gap: 8px; }
  .flags button {
    flex: 1; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 13px var(--font-ui); padding: 10px 0; cursor: pointer;
  }
  .flags button.on { color: var(--accent-ink); background: var(--accent); border-color: var(--accent); }
  .primary {
    background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 15px var(--font-ui); padding: 14px 0; cursor: pointer;
  }
</style>
