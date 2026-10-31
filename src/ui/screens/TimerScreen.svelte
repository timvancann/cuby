<script lang="ts">
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { splits, totalMs } from '../../core/timer/attempt';
  import { aoN, moN } from '../../core/stats/wca';
  import { timedResults } from '../../core/stats/aggregate';
  import { attemptsForModes, recordAttempt, setAttemptFlag } from '../../data/attempts';
  import { DEFAULT_PHASES, getPhaseSet, getSetting, setSetting } from '../../data/settings';
  import type { AttemptRow, Flag } from '../../data/db';
  import { acquireWakeLock, releaseWakeLock } from '../wakeLock';
  import { nextFullScramble, warmUp } from '../timer/scrambles';
  import { abortTimer, newTimerAttempt, tapTimer } from '../timer/flow';
  import { invert, parseAlg, toAlgString } from '../../core/cube/parser';
  import TriggerSheet from '../TriggerSheet.svelte';
  import CubeAnimator from '../animator/CubeAnimator.svelte';
  import PhaseBar from '../timer/PhaseBar.svelte';
  import ScrambleGrid from '../ScrambleGrid.svelte';
  import { drillKeys } from '../keys';
  import SegmentedControl from '../SegmentedControl.svelte';
  import { bumpCount, sessionCount, timer as t } from '../drillState.svelte';
  import { fmtMs, fmtTime } from '../format';
  import { clockNow, slopTap } from '../tap';
  import { MOTION } from '../motion';

  let cfopPhases = $state<string[]>(DEFAULT_PHASES);
  let scrambleError = $state(false);
  let now = $state(0);
  let vibration = $state(true);
  let solves = $state.raw<AttemptRow[]>([]); // full + cfop solves, for the live averages

  const phases = $derived(t.mode === 'cfop' ? cfopPhases : ['solve']);
  const flow = $derived(t.flow ?? newTimerAttempt(phases));

  // CubeAnimator inverts its setup, so pass the scramble's inverse to show
  // the scrambled state (same trick as dry practice).
  const setupFor = (s: string) => toAlgString(invert(parseAlg(s)));

  // Elapsed in the phase currently running, for the live segment.
  const liveMs = $derived(
    flow.stage === 'running' ? now - (flow.timer.boundaries.at(-1) ?? flow.timer.startedAt) : 0,
  );

  function loadScramble() {
    scrambleError = false;
    nextFullScramble().then(s => { t.scramble = s; }).catch(() => { scrambleError = true; });
  }

  $effect(() => untrack(() => {
    void acquireWakeLock();
    warmUp();
    Promise.all([getSetting<'full' | 'cfop'>('timerMode', 'full'), getPhaseSet()]).then(([m, p]) => {
      cfopPhases = p;
      if (t.flow && t.flow.stage !== 'idle') return; // mid-attempt: keep what's on screen
      t.mode = m;
      t.flow = newTimerAttempt(m === 'cfop' ? p : ['solve']);
    });
    getSetting('vibration', true).then(v => { vibration = v; });
    attemptsForModes(['full', 'cfop']).then(rows => { solves = rows; });
    if (!t.scramble) loadScramble();
    return () => {
      void releaseWakeLock();
      // Leaving mid-solve discards it: the clock would keep running otherwise.
      if (t.flow?.stage === 'running') t.flow = abortTimer(t.flow, phases);
    };
  }));

  $effect(() => {
    if (flow.stage !== 'running') return;
    let raf = 0;
    const tick = () => { now = clockNow(); raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  });

  function promoteUpcoming() {
    // The upcoming scramble was prefetched when the result appeared.
    if (t.upcoming) {
      t.scramble = t.upcoming;
      t.upcoming = null;
    } else {
      t.scramble = null;
      loadScramble();
    }
  }

  function setMode(m: 'full' | 'cfop') {
    if (flow.stage === 'running') return;
    if (flow.stage === 'done') promoteUpcoming(); // the shown scramble was already solved
    t.mode = m;
    void setSetting('timerMode', m);
    t.flow = newTimerAttempt(m === 'cfop' ? cfopPhases : ['solve']);
    t.attemptId = null;
  }

  async function onTap(at: number) {
    if (scrambleError) { loadScramble(); return; }
    if (!t.scramble) return;
    now = at;
    const next = tapTimer(flow, at);
    if (next === flow) return;
    if (vibration && 'vibrate' in navigator) navigator.vibrate(10);
    if (next === 'next') {
      promoteUpcoming();
      t.flow = newTimerAttempt(phases);
      t.attemptId = null;
      return;
    }
    t.flow = next;
    if (next.stage === 'done') {
      t.flag = 'ok';
      t.attemptId = null;
      t.upcoming = null;
      nextFullScramble().then(s => { t.upcoming = s; }).catch(() => {});
      const mode = t.mode;
      const id = await recordAttempt({
        mode, config: mode === 'cfop' ? cfopPhases : [], now: Date.now(),
        timer: next.timer, scramble: t.scramble ?? undefined,
      });
      t.attemptId = id;
      bumpCount(t.count, Date.now());
      if (t.flag !== 'ok') await setAttemptFlag(id, t.flag);
      solves = [...solves, {
        id, sessionId: 0, mode, startedAt: next.timer.startedAt,
        splits: splits(next.timer), totalMs: totalMs(next.timer), flag: t.flag,
      }];
    }
  }

  function abort() {
    if (flow.stage !== 'running') return;
    t.flow = abortTimer(flow, phases);
  }

  async function chooseFlag(f: Flag) {
    t.flag = f;
    const id = t.attemptId;
    if (id === null) return;
    solves = solves.map(r => (r.id === id ? { ...r, flag: f } : r));
    await setAttemptFlag(id, f);
  }

  // Same pools as the Stats tab: Full averages every solve (a CFOP solve is a
  // full solve too), CFOP only the CFOP ones.
  const modeSolves = $derived(t.mode === 'cfop' ? solves.filter(r => r.mode === 'cfop') : solves);
  const results = $derived(timedResults(modeSolves));
  const live = $derived([
    { label: 'mo3', v: moN(results, 3) },
    { label: 'ao5', v: aoN(results, 5) },
    { label: 'ao12', v: aoN(results, 12) },
  ]);
  const recent = $derived(modeSolves.slice(-5).reverse());

  let showScramble = $state(false);
  const tap = slopTap(at => void onTap(at));

  $effect(() =>
    drillKeys({
      onSpace: () => void onTap(clockNow()),
      onEscape: abort,
      enabled: () => !showScramble,
    }),
  );
</script>

<div class="screen timer">
  <header>
    <div class="mode-wrap">
      <SegmentedControl
        options={[{ value: 'full', label: 'Full' }, { value: 'cfop', label: 'CFOP' }]}
        value={t.mode}
        disabled={flow.stage === 'running'}
        onChange={v => setMode(v as 'full' | 'cfop')}
      />
    </div>
    {#if flow.stage === 'running'}
      <button class="ghost" onclick={abort}>Abort</button>
    {:else if flow.stage === 'idle' && t.scramble}
      <button class="ghost" onclick={() => (showScramble = true)}>Animate</button>
    {/if}
  </header>

  <div class="zone" role="button" tabindex="-1" {...tap}>
    <div class="zone-inner">
      {#if flow.stage === 'idle'}
        {#if scrambleError}
          <p class="hint">couldn't generate a scramble, tap to retry</p>
        {:else if t.scramble}
          <p class="clock idle">0.00</p>
          <ScrambleGrid scramble={t.scramble} />
          {#key t.scramble}
            <CubeAnimator alg="" setup={setupFor(t.scramble)} controls={false} size={170} scheme="white-top" />
          {/key}
          <p class="hint">white on top, green in front. Tap to start</p>
        {:else}
          <p class="hint">generating scramble…</p>
        {/if}
      {:else if flow.stage === 'running'}
        <p class="clock">{fmtMs(Math.max(0, now - flow.timer.startedAt))}</p>
        {#if t.mode === 'cfop'}
          <PhaseBar {phases} splits={splits(flow.timer)} {liveMs} />
        {:else}
          <p class="hint">tap to stop</p>
        {/if}
      {:else}
        <p class="clock final">{fmtMs(totalMs(flow.timer))}</p>
        {#if t.mode === 'cfop'}
          <PhaseBar {phases} splits={splits(flow.timer)} />
        {/if}
        {#if t.upcoming}
          <div class="next-up">
            <span class="section-label">next scramble</span>
            <ScrambleGrid scramble={t.upcoming} small />
            {#key t.upcoming}
              <CubeAnimator alg="" setup={setupFor(t.upcoming)} controls={false} size={140} scheme="white-top" />
            {/key}
          </div>
        {/if}
      {/if}
    </div>
  </div>

  {#if flow.stage !== 'running'}
    <div class="live" transition:slide={MOTION}>
      <p class="pool section-label">{t.mode === 'cfop' ? 'CFOP solves' : 'all solves, CFOP included'}</p>
      <div class="avgs">
        {#each live as a}
          <span><span class="section-label">{a.label}</span><b>{fmtTime(a.v)}</b></span>
        {/each}
      </div>
      <p class="recent dim">
        {sessionCount(t.count, Date.now())} this session{#if recent.length}: {#each recent as r, i}<span class:dnf={r.flag !== 'ok'}>{r.flag === 'dnf' ? 'DNF' : fmtMs(r.totalMs)}</span>{i < recent.length - 1 ? ', ' : ''}{/each}{/if}
      </p>
    </div>
  {/if}

  {#if flow.stage === 'done'}
    <footer transition:slide={MOTION}>
      <div class="flags" role="group" aria-label="flag this solve">
        <button aria-pressed={t.flag === 'ok'} class:on={t.flag === 'ok'} onclick={() => chooseFlag('ok')}>OK</button>
        <button aria-pressed={t.flag === 'dnf'} class:on={t.flag === 'dnf'} onclick={() => chooseFlag('dnf')}>DNF</button>
      </div>
      <button class="primary" onclick={() => void onTap(clockNow())}>Next</button>
    </footer>
  {/if}
</div>

{#if showScramble && t.scramble}
  <TriggerSheet name="Scramble" moves={t.scramble} scheme="white-top" onClose={() => (showScramble = false)} />
{/if}

<style>
  .timer { display: flex; flex-direction: column; height: 100dvh; min-height: 0; }
  header { display: flex; align-items: center; gap: 10px; }
  .mode-wrap { flex: 1; min-width: 0; max-width: 220px; }
  header .ghost { margin-left: auto; }
  .ghost {
    min-height: var(--tap); padding: 0 14px; white-space: nowrap;
    background: none; border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  .zone {
    flex: 1; min-height: 0; overflow: hidden auto; display: flex; flex-direction: column;
    color: var(--text); cursor: pointer; outline: none;
    -webkit-tap-highlight-color: transparent; touch-action: pan-y; user-select: none;
  }
  .zone-inner { margin: auto 0; padding: 12px 0; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .next-up { display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 6px; }
  .hint { color: var(--dim); font-size: var(--fs-small); text-align: center; }
  .clock { font: 600 64px var(--font-mono); font-variant-numeric: tabular-nums; }
  .clock.idle { color: var(--dim); font-size: 48px; }
  .clock.final { color: var(--accent); }
  .live { flex: none; display: grid; gap: 4px; padding: 8px 0 4px; border-top: 1px solid var(--line); }
  .pool { text-align: center; }
  .avgs { display: grid; grid-template-columns: repeat(3, 1fr); }
  .avgs > span { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .avgs b { font: 600 17px var(--font-mono); font-variant-numeric: tabular-nums; }
  .recent { font: 400 var(--fs-caption) var(--font-mono); text-align: center; }
  .recent .dnf { color: var(--bad); }
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

  /* Desktop: the clock is read from arm's length. */
  @media (min-width: 900px) and (min-height: 600px) {
    .clock { font-size: 96px; }
    .clock.idle { font-size: 64px; }
  }
</style>
