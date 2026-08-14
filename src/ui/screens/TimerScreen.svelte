<script lang="ts">
  import { phaseIndex, splits, totalMs } from '../../core/timer/attempt';
  import { recordAttempt, setAttemptFlag } from '../../data/attempts';
  import { endActiveSession } from '../../data/sessions';
  import { DEFAULT_PHASES, getPhaseSet, getSetting } from '../../data/settings';
  import type { Flag } from '../../data/db';
  import { acquireWakeLock, releaseWakeLock } from '../wakeLock';
  import { nextFullScramble, warmUp } from '../timer/scrambles';
  import { abortTimer, newTimerAttempt, tapTimer, type TimerFlow } from '../timer/flow';

  let mode = $state<'full' | 'cfop'>('full');
  let cfopPhases = $state<string[]>(DEFAULT_PHASES);
  let scramble = $state<string | null>(null);
  let scrambleError = $state(false);
  let flow = $state<TimerFlow>(newTimerAttempt(['solve']));
  let attemptId = $state<number | null>(null);
  let flag = $state<Flag>('ok');
  let now = $state(0);
  let vibration = $state(true);
  let sessionCount = $state(0);

  const phases = $derived(mode === 'cfop' ? cfopPhases : ['solve']);

  function loadScramble() {
    scrambleError = false;
    nextFullScramble().then(s => { scramble = s; }).catch(() => { scrambleError = true; });
  }

  $effect(() => {
    void acquireWakeLock();
    warmUp();
    getPhaseSet().then(p => {
      cfopPhases = p;
      if (mode === 'cfop' && flow.stage === 'idle') flow = newTimerAttempt(p);
    });
    getSetting('vibration', true).then(v => { vibration = v; });
    loadScramble();
    return () => {
      void releaseWakeLock();
      void endActiveSession(Date.now());
    };
  });

  $effect(() => {
    if (flow.stage !== 'running') return;
    let raf = 0;
    const tick = () => { now = Date.now(); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  function fmt(ms: number): string {
    return (ms / 1000).toFixed(2);
  }

  function setMode(m: 'full' | 'cfop') {
    if (flow.stage === 'running') return;
    mode = m;
    flow = newTimerAttempt(m === 'cfop' ? cfopPhases : ['solve']);
    attemptId = null;
  }

  async function onTap() {
    if (scrambleError) { loadScramble(); return; }
    if (!scramble) return;
    const t = Date.now();
    now = t;
    const next = tapTimer(flow, t);
    if (next === flow) return;
    if (vibration && 'vibrate' in navigator) navigator.vibrate(10);
    if (next === 'next') {
      scramble = null;
      flow = newTimerAttempt(phases);
      attemptId = null;
      loadScramble();
      return;
    }
    flow = next;
    if (next.stage === 'done') {
      flag = 'ok';
      attemptId = null;
      const id = await recordAttempt({
        mode, config: mode === 'cfop' ? cfopPhases : [], now: t,
        timer: next.timer, scramble,
      });
      attemptId = id;
      sessionCount += 1;
      if (flag !== 'ok') await setAttemptFlag(id, flag);
    }
  }

  function abort() {
    if (flow.stage !== 'running') return;
    flow = abortTimer(flow, phases);
  }

  async function chooseFlag(f: Flag) {
    flag = f;
    if (attemptId !== null) await setAttemptFlag(attemptId, f);
  }
</script>

<div class="screen timer">
  <header>
    <div class="pill" role="group" aria-label="Timer mode">
      <button class:on={mode === 'full'} disabled={flow.stage === 'running'} onclick={() => setMode('full')}>Full solve</button>
      <button class:on={mode === 'cfop'} disabled={flow.stage === 'running'} onclick={() => setMode('cfop')}>CFOP</button>
    </div>
    <span class="dim">{sessionCount} this session</span>
    <button class="abort" onclick={abort}>abort</button>
  </header>

  <button class="zone" onpointerdown={onTap}>
    {#if flow.stage === 'idle'}
      {#if scrambleError}
        <p class="hint">couldn't generate a scramble — tap to retry</p>
      {:else if scramble}
        <p class="scramble">{scramble}</p>
        <p class="hint">tap to start</p>
      {:else}
        <p class="hint">generating scramble…</p>
      {/if}
    {:else if flow.stage === 'running'}
      <p class="clock">{fmt(now - flow.timer.startedAt)}</p>
      {#if mode === 'cfop'}
        <p class="phase">{phases[phaseIndex(flow.timer)]}</p>
        <div class="mini-splits">
          {#each splits(flow.timer) as sp}<span>{sp.label} <b>{fmt(sp.ms)}</b></span>{/each}
        </div>
      {:else}
        <p class="hint">tap to stop</p>
      {/if}
    {:else}
      <p class="clock final">{fmt(totalMs(flow.timer))}</p>
      {#if mode === 'cfop'}
        <div class="mini-splits">
          {#each splits(flow.timer) as sp}<span>{sp.label} <b>{fmt(sp.ms)}</b></span>{/each}
        </div>
      {/if}
    {/if}
  </button>

  {#if flow.stage === 'done'}
    <footer>
      <div class="flags">
        <button class:on={flag === 'ok'} onclick={() => chooseFlag('ok')}>OK</button>
        <button class:on={flag === 'dnf'} onclick={() => chooseFlag('dnf')}>DNF</button>
      </div>
      <button class="primary" onpointerdown={onTap}>Next</button>
    </footer>
  {/if}
</div>

<style>
  .timer { display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 10px; }
  .pill { display: flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
  .pill button {
    background: transparent; border: 0; color: var(--dim);
    font: 500 12px var(--font-ui); padding: 6px 12px; cursor: pointer;
  }
  .pill button.on { background: var(--panel-2); color: var(--text); }
  .pill button:disabled { opacity: 0.5; cursor: default; }
  header .dim { margin-left: auto; font-size: 12px; }
  .abort {
    background: none; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 12px var(--font-ui); padding: 4px 10px; cursor: pointer;
  }
  .zone {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; background: none; border: 0; color: var(--text); cursor: pointer;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;
  }
  .scramble { font: 600 24px/1.7 var(--font-mono); max-width: 24ch; }
  .hint { color: var(--dim); font-size: 13px; }
  .clock { font: 600 64px var(--font-mono); font-variant-numeric: tabular-nums; }
  .clock.final { color: var(--accent); }
  .phase { font: 600 18px var(--font-ui); color: var(--accent); }
  .mini-splits { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; color: var(--dim); font-size: 13px; }
  .mini-splits b { color: var(--text); font-family: var(--font-mono); }
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
