<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { AttemptRow, Flag, Mode } from '../../data/db';
  import { caseById } from '../../data/caseSet';
  import { attemptsForModes, setAttemptFlag } from '../../data/attempts';
  import { getCaseSelection } from '../../data/settings';
  import { aoN, bestAoN, lifetimeMean } from '../../core/stats/wca';
  import {
    perCaseStats, phaseStats, sessionSummaries, timedResults, type CaseStats, type StatAttempt,
  } from '../../core/stats/aggregate';
  import { navigate } from '../router.svelte';
  import SessionTrend from '../stats/SessionTrend.svelte';
  import CaseDiagram from '../CaseDiagram.svelte';
  import SegmentedControl from '../SegmentedControl.svelte';
  import Sheet from '../Sheet.svelte';
  import ScrambleGrid from '../ScrambleGrid.svelte';
  import Icon from '../Icon.svelte';
  import { fmtMs, fmtTime, plural } from '../format';
  import { MOTION } from '../motion';

  type View = 'case' | 'dry' | 'full' | 'cfop';
  // Every CFOP solve is also a full solve, so Full averages over both.
  const MODES: Record<View, Mode[]> = { case: ['case'], dry: ['dry'], full: ['full', 'cfop'], cfop: ['cfop'] };
  const FLAGS: Record<View, { value: Flag; label: string }[]> = {
    case: [{ value: 'ok', label: 'OK' }, { value: 'misrecognized', label: 'Misrecognized' }, { value: 'dnf', label: 'DNF' }],
    dry: [{ value: 'ok', label: 'Recognized' }, { value: 'misrecognized', label: 'Got it wrong' }],
    full: [{ value: 'ok', label: 'OK' }, { value: 'dnf', label: 'DNF' }],
    cfop: [{ value: 'ok', label: 'OK' }, { value: 'dnf', label: 'DNF' }],
  };

  let view = $state<View>('case');
  let attempts = $state.raw<AttemptRow[]>([]);
  let selection = $state<string[]>([]);
  let loaded = $state(false);
  let expanded = $state<number | null>(null);
  let editing = $state<AttemptRow | null>(null);

  type SortKey = 'name' | 'count' | 'recentSolve' | 'dnfRate' | 'misrecRate';
  let sortKey = $state<SortKey>('recentSolve');
  let sortDesc = $state(true);

  let loadToken = 0;

  async function load(v: View) {
    const token = ++loadToken;
    const rows = await attemptsForModes(MODES[v]);
    if (token !== loadToken) return; // a later view switch already superseded this query
    attempts = rows;
    loaded = true;
  }

  // The previous view stays on screen until the new rows arrive (a few ms), so
  // switching views animates the sections instead of blanking the page.
  $effect(() => {
    expanded = null;
    void load(view);
  });

  $effect(() => {
    getCaseSelection().then(ids => { selection = ids; });
  });

  function fmtPct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const statAttempts = $derived<StatAttempt[]>(
    attempts.map(a => ({
      sessionId: a.sessionId, caseId: a.caseId, startedAt: a.startedAt,
      splits: a.splits, totalMs: a.totalMs, flag: a.flag, retry: a.retry,
    }))
  );

  const results = $derived(timedResults(statAttempts));
  const singles = $derived(results.filter(r => !r.dnf).map(r => r.totalMs));
  const avgRows = $derived([
    { label: 'single', current: results.length ? (results.at(-1)!.dnf ? 'dnf' as const : results.at(-1)!.totalMs) : null,
      best: singles.length ? Math.min(...singles) : null },
    ...[5, 12, 50, 100].map(n => ({ label: `ao${n}`, current: aoN(results, n), best: bestAoN(results, n) })),
  ]);
  const meanValue = $derived(lifetimeMean(results));

  // CFOP: phases in the order they were first recorded.
  const phaseLabels = $derived([...new Set(attempts.flatMap(a => a.splits.map(s => s.label)))]);
  const phaseRows = $derived(view === 'cfop' ? phaseStats(statAttempts, phaseLabels) : []);

  // Practiced cases, plus selected cases never practiced (n = 0), so "least practiced" can surface them.
  const caseRows = $derived.by(() => {
    const rows = perCaseStats(statAttempts);
    const seen = new Set(rows.map(r => r.caseId));
    for (const id of selection) {
      if (seen.has(id) || !caseById.has(id)) continue;
      rows.push({ caseId: id, count: 0, bestSolve: null, meanSolve: null, recentSolve: null, dnfRate: 0, misrecRate: 0, lastSeen: 0 });
    }
    return rows;
  });

  function sortValue(c: CaseStats, key: SortKey): number | string {
    switch (key) {
      case 'name': return caseById.get(c.caseId)?.name ?? c.caseId;
      case 'count': return c.count;
      case 'recentSolve': return c.recentSolve ?? -1;
      case 'dnfRate': return c.dnfRate;
      case 'misrecRate': return c.misrecRate;
    }
  }

  const sortedCaseRows = $derived(
    [...caseRows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDesc ? -cmp : cmp;
    })
  );

  function sortBy(key: SortKey) {
    if (sortKey === key) { sortDesc = !sortDesc; return; }
    sortKey = key;
    sortDesc = key !== 'name';
  }

  const allSessionSummaries = $derived(sessionSummaries(statAttempts));
  const sessions = $derived([...allSessionSummaries].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20));
  const trendPoints = $derived(allSessionSummaries.map(s => s.meanTotalMs).filter((v): v is number => v !== null));
  const sessionAttempts = $derived(expanded === null ? [] : attempts.filter(a => a.sessionId === expanded));

  function toggleSession(sessionId: number) {
    expanded = expanded === sessionId ? null : sessionId;
  }

  async function changeFlag(a: AttemptRow, flag: Flag) {
    if (a.id === undefined) return;
    await setAttemptFlag(a.id, flag);
    attempts = attempts.map(r => (r.id === a.id ? { ...r, flag } : r));
    editing = { ...a, flag };
  }

  function flagLabel(f: Flag): string {
    return FLAGS[view].find(x => x.value === f)?.label ?? f;
  }

  const timeLabel = $derived(view === 'dry' ? 'recog.' : 'solve');
  const emptyRoute = $derived(view === 'case' || view === 'dry' ? '/train' : '/timer');
</script>

<div class="screen stats">
  <h1 class="h1">Stats</h1>
  <div class="mode-select-wrap">
    <SegmentedControl
      options={[
        { value: 'case', label: 'Case' }, { value: 'dry', label: 'Dry' },
        { value: 'full', label: 'Full' }, { value: 'cfop', label: 'CFOP' },
      ]}
      value={view}
      onChange={v => (view = v as View)}
    />
    {#if view === 'full'}<p class="dim note" transition:slide={MOTION}>Full includes your CFOP solves.</p>{/if}
    {#if view === 'case' || view === 'dry'}
      <p class="dim note" transition:slide={MOTION}>{view === 'case' ? 'Misrecognized solves' : 'Wrong recognitions'} count as DNF in averages.{view === 'case' ? ' Retries are left out.' : ''}</p>
    {/if}
  </div>

  {#if loaded && attempts.length === 0}
    <div class="empty">
      <p class="dim">no attempts yet</p>
      <button class="link" onclick={() => navigate(emptyRoute)}>Go train</button>
    </div>
  {:else if loaded}
    <section>
      <h2 class="section-label">Averages</h2>
      <div class="table avg">
        <div class="row head"><span></span><span class="num">current</span><span class="num">best</span></div>
        {#each avgRows as r}
          <div class="row">
            <span>{r.label}</span>
            <span class="num">{fmtTime(r.current)}</span>
            <span class="num">{fmtTime(r.best)}</span>
          </div>
        {/each}
        <div class="row">
          <span>mean</span>
          <span class="num">{fmtTime(meanValue)}</span>
          <span class="num dim">-</span>
        </div>
      </div>
    </section>

    {#if view === 'cfop' && phaseRows.length}
      <section transition:slide={MOTION}>
        <h2 class="section-label">Per phase</h2>
        <div class="table phase">
          <div class="row head"><span>phase</span><span class="num">mean</span><span class="num">ao5</span><span class="num">ao12</span><span class="num">best</span></div>
          {#each phaseRows as p}
            <div class="row">
              <span>{p.label}</span>
              <span class="num">{fmtTime(p.mean)}</span>
              <span class="num">{fmtTime(p.ao5)}</span>
              <span class="num">{fmtTime(p.ao12)}</span>
              <span class="num">{fmtTime(p.best)}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    {#if view === 'case' || view === 'dry'}
      <section transition:slide={MOTION}>
        <h2 class="section-label">Per case</h2>
        <p class="dim note">{timeLabel}: mean of your last 5 clean attempts, all-time mean underneath.</p>
        <div class="table cases" class:dry={view === 'dry'}>
          <div class="row head">
            {#snippet sortHead(key: SortKey, label: string, num = true)}
              <button class:num onclick={() => sortBy(key)} aria-label="sort by {label}{sortKey === key ? (sortDesc ? ', descending' : ', ascending') : ''}">
                {label}{#if sortKey === key}<Icon name={sortDesc ? 'sortDown' : 'sortUp'} size={12} />{/if}
              </button>
            {/snippet}
            {@render sortHead('name', 'case', false)}
            {@render sortHead('count', 'n')}
            {@render sortHead('recentSolve', timeLabel)}
            <span class="num last">last</span>
            {#if view === 'case'}{@render sortHead('dnfRate', 'dnf')}{/if}
            {@render sortHead('misrecRate', view === 'case' ? 'mis' : 'wrong')}
          </div>
          {#each sortedCaseRows as c (c.caseId)}
            {@const info = caseById.get(c.caseId)}
            <div class="row" class:unpracticed={c.count === 0}>
              <span class="case-name">
                {#if info}<CaseDiagram pattern={info.pattern} size={26} />{/if}
                <span class="name-text">{info?.name ?? c.caseId} <span class="dim">#{info?.oll}</span></span>
              </span>
              <span class="num">{c.count}</span>
              <span class="num stat-cell">
                <span>{fmtTime(c.recentSolve)}</span>
                {#if c.count > 1}<span class="dim sub">{fmtTime(c.meanSolve)}</span>{/if}
              </span>
              <span class="num dim last">{c.count ? fmtDate(c.lastSeen) : '-'}</span>
              {#if view === 'case'}<span class="num">{c.count ? fmtPct(c.dnfRate) : '-'}</span>{/if}
              <span class="num">{c.count ? fmtPct(c.misrecRate) : '-'}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h2 class="section-label">Session trend</h2>
      <SessionTrend points={trendPoints} />
    </section>

    <section>
      <h2 class="section-label">Sessions</h2>
      <p class="dim note">Tap an attempt to change its flag.</p>
      <div class="sessions">
        {#each sessions as s (s.sessionId)}
          <button class="session-row" aria-expanded={expanded === s.sessionId} onclick={() => toggleSession(s.sessionId)}>
            <span>{fmtDate(s.startedAt)}</span>
            <span class="dim">{plural(s.count, 'attempt')}</span>
            <span class="num">{fmtTime(s.meanTotalMs)}</span>
            <span class="chev" class:open={expanded === s.sessionId}><Icon name="chevron" size={16} /></span>
          </button>
          {#if expanded === s.sessionId}
            <div class="session-detail" transition:slide={MOTION}>
              {#each sessionAttempts as a (a.id)}
                {@const info = a.caseId ? caseById.get(a.caseId) : undefined}
                <button class="attempt-row" onclick={() => (editing = a)}>
                  <span class="mono">{a.flag === 'dnf' ? 'DNF' : fmtMs(a.totalMs)}</span>
                  <span class="dim what">
                    {#if info}{info.name}{:else}{a.splits.length > 1 ? a.splits.map(sp => fmtMs(sp.ms)).join(' / ') : ''}{/if}
                  </span>
                  {#if a.retry}<span class="tag">retry</span>{/if}
                  {#if a.flag !== 'ok'}<span class="tag" class:bad={a.flag === 'dnf'}>{flagLabel(a.flag)}</span>{/if}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}
</div>

{#if editing}
  {@const a = editing}
  {@const info = a.caseId ? caseById.get(a.caseId) : undefined}
  <Sheet title={info ? `${info.name} #${info.oll}` : 'Solve'} onClose={() => (editing = null)}>
    {#if info}<CaseDiagram pattern={info.pattern} size={72} />{/if}
    <p class="sheet-time">{a.flag === 'dnf' ? 'DNF' : fmtMs(a.totalMs)}</p>
    <p class="dim">{new Date(a.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}{a.retry ? ', retry' : ''}</p>
    {#if a.splits.length > 1}
      <p class="mono dim">{a.splits.map(sp => `${sp.label} ${fmtMs(sp.ms)}`).join(', ')}</p>
    {/if}
    {#if a.scramble}<ScrambleGrid scramble={a.scramble} small perRow={5} />{/if}
    <div class="flags" role="group" aria-label="flag">
      {#each FLAGS[view] as f}
        <button aria-pressed={a.flag === f.value} class:on={a.flag === f.value} onclick={() => changeFlag(a, f.value)}>{f.label}</button>
      {/each}
    </div>
  </Sheet>
{/if}

<style>
  .stats { display: flex; flex-direction: column; gap: 4px; }
  .h1 { margin-bottom: 8px; }
  .mode-select-wrap { margin-bottom: 16px; display: grid; gap: 6px; }
  .note { font-size: var(--fs-caption); }

  .empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 0; }
  .link {
    background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 var(--fs-button) var(--font-ui); min-height: var(--tap); padding: 0 20px; cursor: pointer;
  }

  section { margin-bottom: 24px; display: grid; gap: 8px; }
  .table { border-top: 1px solid var(--line); }
  .row {
    display: grid; align-items: center; gap: 6px; min-height: 40px;
    border-bottom: 1px solid var(--line); font-size: var(--fs-small); white-space: nowrap;
  }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; justify-self: end; }
  .mono { font-family: var(--font-mono); }
  .avg .row { grid-template-columns: 1fr 1fr 1fr; }
  .phase .row { grid-template-columns: 1.2fr repeat(4, 1fr); }
  .cases .row { grid-template-columns: minmax(0, 2fr) 0.4fr 1fr 0.8fr 0.6fr 0.6fr; min-height: 44px; }
  .cases.dry .row { grid-template-columns: minmax(0, 2fr) 0.4fr 1fr 0.8fr 0.7fr; }
  @media (max-width: 359px) {
    .last { display: none; }
    .cases .row { grid-template-columns: minmax(0, 2fr) 0.4fr 1fr 0.6fr 0.6fr; }
    .cases.dry .row { grid-template-columns: minmax(0, 2fr) 0.4fr 1fr 0.7fr; }
  }
  .row.unpracticed { color: var(--dim); }
  .case-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .name-text { overflow: hidden; text-overflow: ellipsis; }
  .row.head { color: var(--dim); font: 600 var(--fs-label) var(--font-ui); text-transform: uppercase; letter-spacing: 0.06em; }
  .row.head .num { font-family: var(--font-ui); }
  .row.head button {
    display: inline-flex; align-items: center; gap: 3px;
    background: none; border: 0; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit;
    cursor: pointer; padding: 0; min-height: var(--tap);
  }
  .row.head button.num { justify-content: flex-end; }
  .stat-cell { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3; }
  .sub { font-size: var(--fs-label); }

  .sessions { display: flex; flex-direction: column; }
  .session-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr 24px; align-items: center; gap: 6px;
    min-height: var(--tap); background: none; border: 0; border-bottom: 1px solid var(--line);
    color: var(--text); font: 500 var(--fs-small) var(--font-ui); cursor: pointer; text-align: left;
  }
  .chev { display: grid; place-items: center; color: var(--dim); transition: transform var(--motion) var(--ease); }
  .chev.open { transform: rotate(180deg); }
  .session-detail { border-bottom: 1px solid var(--line); display: flex; flex-direction: column; }
  .attempt-row {
    display: flex; align-items: center; gap: 10px; min-height: var(--tap); padding: 0 4px;
    background: none; border: 0; border-bottom: 1px solid var(--panel-2); color: var(--text);
    font: 400 var(--fs-small) var(--font-ui); text-align: left; cursor: pointer;
  }
  .attempt-row:last-child { border-bottom: 0; }
  .attempt-row .mono { min-width: 6ch; }
  .what { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { font: 600 var(--fs-label) var(--font-ui); color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; }
  .tag.bad { color: var(--bad); }

  .sheet-time { font: 600 40px var(--font-mono); color: var(--accent); font-variant-numeric: tabular-nums; }
  .flags { display: flex; gap: 8px; width: 100%; margin-top: 8px; }
  .flags button {
    flex: 1; min-height: var(--tap); background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--dim); font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  .flags button.on { color: var(--accent); border-color: var(--accent); font-weight: 600; }
</style>
