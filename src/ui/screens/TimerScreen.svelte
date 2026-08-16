<script lang="ts">
  import { splits, totalMs } from '../../core/timer/attempt';
  import { recordAttempt, setAttemptFlag } from '../../data/attempts';
  import { endActiveSession } from '../../data/sessions';
  import { DEFAULT_PHASES, getPhaseSet, getSetting } from '../../data/settings';
  import type { Flag } from '../../data/db';
  import { acquireWakeLock, releaseWakeLock } from '../wakeLock';
  import { nextFullScramble, warmUp } from '../timer/scrambles';
  import { abortTimer, newTimerAttempt, tapTimer, type TimerFlow } from '../timer/flow';
  import { invert, parseAlg, toAlgString } from '../../core/cube/parser';
  import TriggerSheet from '../TriggerSheet.svelte';
  import CubeAnimator from '../animator/CubeAnimator.svelte';
  import PhaseBar from '../timer/PhaseBar.svelte';
  import { drillKeys } from '../keys';

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

  // CubeAnimator inverts its setup, so pass the scramble's inverse to show
  // the scrambled state (same trick as dry practice).
  const setupFor = (s: string) => toAlgString(invert(parseAlg(s)));
  const scrambleRows = (s: string) => {
    const moves = s.split(' ');
    const rows: string[][] = [];
    for (let i = 0; i < moves.length; i += 6) rows.push(moves.slice(i, i + 6));
    return rows;
  };

  let upcoming = $state<string | null>(null);

  // Elapsed in the phase currently running, for the live segment.
  const liveMs = $derived(
    flow.stage === 'running'
      ? now - (flow.timer.boundaries.length ? flow.timer.boundaries[flow.timer.boundaries.length - 1] : flow.timer.startedAt)
      : 0,
  );

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
      // The upcoming scramble was prefetched when the result appeared.
      if (upcoming) {
        scramble = upcoming;
        upcoming = null;
      } else {
        scramble = null;
        loadScramble();
      }
      flow = newTimerAttempt(phases);
      attemptId = null;
      return;
    }
    flow = next;
    if (next.stage === 'done') {
      flag = 'ok';
      attemptId = null;
      upcoming = null;
      nextFullScramble().then(s => { upcoming = s; }).catch(() => {});
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

  let showScramble = $state(false);

  $effect(() =>
    drillKeys({
      onSpace: () => void onTap(),
      onEscape: abort,
      enabled: () => !showScramble,
    }),
  );
</script>

<div class="screen timer">
  <header>
    <div class="pill" role="group" aria-label="Timer mode">
      <button class:on={mode === 'full'} disabled={flow.stage === 'running'} onclick={() => setMode('full')}>Full</button>
      <button class:on={mode === 'cfop'} disabled={flow.stage === 'running'} onclick={() => setMode('cfop')}>CFOP</button>
    </div>
    <span class="dim">{sessionCount} this session</span>
    {#if flow.stage === 'idle' && scramble}
      <button class="abort" onclick={() => (showScramble = true)}>animate</button>
    {/if}
    <button class="abort" onclick={abort}>abort</button>
  </header>

  <button class="zone" onpointerdown={onTap}>
    {#if flow.stage === 'idle'}
      {#if scrambleError}
        <p class="hint">couldn't generate a scramble — tap to retry</p>
      {:else if scramble}
        <p class="clock idle">0.00</p>
        <div class="scramble-grid">
          {#each scrambleRows(scramble) as row}
            <div class="srow">{#each row as m}<span>{m}</span>{/each}</div>
          {/each}
        </div>
        <div class="cube" role="presentation" onpointerdown={e => e.stopPropagation()}>
          {#key scramble}
            <CubeAnimator alg="" setup={setupFor(scramble)} controls={false} size={185} />
          {/key}
        </div>
        <p class="hint">tap to start</p>
      {:else}
        <p class="hint">generating scramble…</p>
      {/if}
    {:else if flow.stage === 'running'}
      <p class="clock">{fmt(now - flow.timer.startedAt)}</p>
      {#if mode === 'cfop'}
        <PhaseBar {phases} splits={splits(flow.timer)} {liveMs} />
      {:else}
        <p class="hint">tap to stop</p>
      {/if}
    {:else}
      <p class="clock final">{fmt(totalMs(flow.timer))}</p>
      {#if mode === 'cfop'}
        <PhaseBar {phases} splits={splits(flow.timer)} />
      {/if}
      {#if upcoming}
        <div class="next-up">
          <p class="hint">next scramble</p>
          <div class="scramble-grid small">
            {#each scrambleRows(upcoming) as row}
              <div class="srow">{#each row as m}<span>{m}</span>{/each}</div>
            {/each}
          </div>
          <div class="cube" role="presentation" onpointerdown={e => e.stopPropagation()}>
            {#key upcoming}
              <CubeAnimator alg="" setup={setupFor(upcoming)} controls={false} size={140} />
            {/key}
          </div>
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

{#if showScramble && scramble}
  <TriggerSheet name="Scramble" moves={scramble} onClose={() => (showScramble = false)} />
{/if}

<style>
  .timer { display: flex; flex-direction: column; }
  header { display: flex; align-items: center; gap: 10px; }
  .pill { display: flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; }
  .pill button {
    background: transparent; border: 0; color: var(--dim);
    font: 500 14px var(--font-ui); padding: 0 18px; min-height: 44px; cursor: pointer;
  }
  .pill button.on { background: var(--panel-2); color: var(--text); }
  .pill button:disabled { opacity: 0.5; cursor: default; }
  header .dim { margin-left: auto; font-size: 12px; }
  .abort {
    background: none; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 14px var(--font-ui); padding: 0 16px; min-height: 44px; cursor: pointer;
  }
  .zone {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 14px; background: none; border: 0; color: var(--text); cursor: pointer;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation; user-select: none;
  }
  .scramble-grid { display: grid; gap: 6px; }
  .scramble-grid .srow { display: grid; grid-template-columns: repeat(6, 44px); justify-content: center; }
  .scramble-grid span { font: 600 22px var(--font-mono); text-align: center; }
  .scramble-grid.small .srow { grid-template-columns: repeat(6, 36px); }
  .scramble-grid.small span { font-size: 17px; color: var(--dim); }
  .cube { display: flex; justify-content: center; }
  .next-up { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 6px; }
  .hint { color: var(--dim); font-size: 13px; }
  .clock { font: 600 64px var(--font-mono); font-variant-numeric: tabular-nums; }
  .clock.idle { color: var(--dim); font-size: 48px; }
  .clock.final { color: var(--accent); }
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
