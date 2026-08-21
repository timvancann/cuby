<script lang="ts">
  import { db, type AttemptRow, type Mode } from '../../data/db';
  import { caseById } from '../../data/caseSet';
  import { aoN, bestAoN, lifetimeMean, type TimedResult } from '../../core/stats/wca';
  import { perCaseStats, sessionSummaries, type CaseStats, type StatAttempt } from '../../core/stats/aggregate';
  import { navigate } from '../router.svelte';
  import SessionTrend from '../stats/SessionTrend.svelte';
  import CaseDiagram from '../CaseDiagram.svelte';
  import SegmentedControl from '../SegmentedControl.svelte';

  let mode = $state<Mode>('case');
  let attempts = $state<AttemptRow[]>([]);
  let loaded = $state(false);
  let expanded = $state<number | null>(null);
  let expandedAttempts = $state<AttemptRow[]>([]);

  type SortKey = 'name' | 'count' | 'meanSolve' | 'dnfRate' | 'misrecRate';
  let sortKey = $state<SortKey>('meanSolve');
  let sortDesc = $state(true);

  let loadToken = 0;

  $effect(() => {
    loaded = false;
    expanded = null;
    const token = ++loadToken;
    db.attempts.where('mode').equals(mode).sortBy('startedAt').then(rows => {
      if (token !== loadToken) return; // a later mode switch already superseded this query
      attempts = rows;
      loaded = true;
    });
  });

  function fmtMs(ms: number): string {
    const s = ms / 1000;
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const rem = (s - m * 60).toFixed(2).padStart(5, '0');
      return `${m}:${rem}`;
    }
    return s.toFixed(2);
  }

  function fmtTime(v: number | 'dnf' | null): string {
    if (v === 'dnf') return 'DNF';
    if (v === null) return '—';
    return fmtMs(v);
  }

  function fmtPct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  const results = $derived<TimedResult[]>(attempts.map(a => ({ totalMs: a.totalMs, dnf: a.flag === 'dnf' })));

  const avgRows = $derived(
    [5, 12, 50, 100].map(n => ({ label: `ao${n}`, current: aoN(results, n), best: bestAoN(results, n) }))
  );
  const meanValue = $derived(lifetimeMean(results));

  const statAttempts = $derived<StatAttempt[]>(
    attempts.map(a => ({
      sessionId: a.sessionId, caseId: a.caseId, startedAt: a.startedAt,
      splits: a.splits, totalMs: a.totalMs, flag: a.flag,
    }))
  );

  const caseRows = $derived(perCaseStats(statAttempts));

  function sortValue(c: CaseStats, key: SortKey): number | string {
    switch (key) {
      case 'name': return caseById.get(c.caseId)?.name ?? c.caseId;
      case 'count': return c.count;
      case 'meanSolve': return c.meanSolve ?? -1;
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
    sortDesc = true;
  }

  function caret(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDesc ? ' ▼' : ' ▲';
  }

  const allSessionSummaries = $derived(sessionSummaries(statAttempts));

  const sessions = $derived(
    [...allSessionSummaries].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20)
  );

  const trendPoints = $derived(
    allSessionSummaries.map(s => s.meanTotalMs).filter((v): v is number => v !== null)
  );

  async function toggleSession(sessionId: number) {
    if (expanded === sessionId) { expanded = null; return; }
    expanded = sessionId;
    expandedAttempts = await db.attempts.where('sessionId').equals(sessionId).sortBy('startedAt');
  }

  const emptyRoute = $derived(mode === 'case' ? '/train' : '/timer');
</script>

<div class="screen stats">
  <div class="mode-select-wrap">
    <SegmentedControl
      options={[{ value: 'case', label: 'Case' }, { value: 'full', label: 'Full' }, { value: 'cfop', label: 'CFOP' }]}
      value={mode}
      onChange={v => (mode = v as Mode)}
    />
  </div>

  {#if loaded && attempts.length === 0}
    <div class="empty">
      <p class="dim">no attempts yet</p>
      <button class="link" onclick={() => navigate(emptyRoute)}>go train</button>
    </div>
  {:else if loaded}
    <section>
      <h2>Averages</h2>
      <div class="avg-table">
        <div class="row head"><span></span><span>current</span><span>best</span></div>
        {#each avgRows as r}
          <div class="row">
            <span>{r.label}</span>
            <span class="mono">{fmtTime(r.current)}</span>
            <span class="mono">{fmtTime(r.best)}</span>
          </div>
        {/each}
        <div class="row">
          <span>mean</span>
          <span class="mono">{fmtTime(meanValue)}</span>
          <span class="mono">{fmtTime(meanValue)}</span>
        </div>
      </div>
    </section>

    {#if mode === 'case'}
      <section>
        <h2>Per case</h2>
        <div class="case-table">
          <div class="row head">
            <button onclick={() => sortBy('name')}>case{caret('name')}</button>
            <button onclick={() => sortBy('count')}>n{caret('count')}</button>
            <button onclick={() => sortBy('meanSolve')}>solve{caret('meanSolve')}</button>
            <span>last</span>
            <button onclick={() => sortBy('dnfRate')}>dnf%{caret('dnfRate')}</button>
            <button onclick={() => sortBy('misrecRate')}>mis%{caret('misrecRate')}</button>
          </div>
          {#each sortedCaseRows as c}
            {@const info = caseById.get(c.caseId)}
            <div class="row">
              <span class="case-name">
                {#if info}<CaseDiagram pattern={info.pattern} size={26} />{/if}
                <span class="name-text">{info?.name ?? c.caseId} <span class="dim">#{info?.oll}</span></span>
              </span>
              <span class="mono">{c.count}</span>
              <span class="mono stat-cell">
                <span>{c.meanSolve === null ? '—' : fmtMs(c.meanSolve)}</span>
                {#if c.count > 1}
                  <span class="dim stat-best">{c.bestSolve === null ? '—' : fmtMs(c.bestSolve)}</span>
                {/if}
              </span>
              <span class="mono dim">{fmtDate(c.lastSeen)}</span>
              <span class="mono">{fmtPct(c.dnfRate)}</span>
              <span class="mono">{fmtPct(c.misrecRate)}</span>
            </div>
          {/each}
        </div>
      </section>

    {/if}

    <section>
      <h2>Session trend</h2>
      <SessionTrend points={trendPoints} />
    </section>

    <section>
      <h2>Sessions</h2>
      <div class="sessions">
        {#each sessions as s}
          <button class="session-row" onclick={() => toggleSession(s.sessionId)}>
            <span>{fmtDate(s.startedAt)}</span>
            <span class="dim">{s.count} attempts</span>
            <span class="mono">{fmtTime(s.meanTotalMs)}</span>
          </button>
          {#if expanded === s.sessionId}
            <div class="session-detail">
              {#each expandedAttempts as a}
                <div class="attempt-row">
                  <span class="mono">{a.flag === 'dnf' ? 'DNF' : fmtMs(a.totalMs)}</span>
                  <span class="splits dim">
                    {#each a.splits as sp}<span>{sp.label} {fmtMs(sp.ms)}</span>{/each}
                  </span>
                  {#if a.flag === 'dnf'}<span class="flag bad">DNF</span>{/if}
                  {#if a.flag === 'misrecognized'}<span class="flag">misrec.</span>{/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .stats { display: flex; flex-direction: column; gap: 4px; }
  .mode-select-wrap { margin-bottom: 12px; }

  .empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 0; }
  .link {
    background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 14px var(--font-ui); padding: 10px 20px; cursor: pointer;
  }

  section { margin-bottom: 24px; }
  h2 { font-size: 14px; color: var(--dim); margin-bottom: 8px; font-weight: 600; }

  .avg-table, .case-table { border-top: 1px solid var(--line); }
  .row {
    display: grid; align-items: center; min-height: 36px;
    border-bottom: 1px solid var(--line); font-size: 13px;
  }
  .avg-table .row { grid-template-columns: 1fr 1fr 1fr; }
  .case-table .row { grid-template-columns: 1.9fr 0.4fr 1fr 0.9fr 0.6fr 0.6fr; gap: 4px; min-height: 44px; }
  .case-name { display: flex; align-items: center; gap: 8px; }
  .name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row.head { color: var(--dim); font-size: 11px; text-transform: uppercase; }
  .case-table .row.head button {
    background: none; border: 0; color: var(--dim); font: inherit; text-align: left;
    text-transform: uppercase; cursor: pointer; padding: 0; min-height: 36px;
  }
  .mono { font-family: var(--font-mono); }
  .stat-cell { display: flex; flex-direction: column; line-height: 1.3; }
  .stat-best { font-size: 10px; }

  .sessions { display: flex; flex-direction: column; }
  .session-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center;
    min-height: 44px; background: none; border: 0; border-bottom: 1px solid var(--line);
    color: var(--text); font: 500 13px var(--font-ui); cursor: pointer; text-align: left;
  }
  .session-detail { padding: 6px 0 12px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
  .attempt-row { display: flex; align-items: center; gap: 10px; font-size: 12px; flex-wrap: wrap; }
  .splits { display: flex; gap: 8px; }
  .flag { font-size: 11px; color: var(--accent); }
  .flag.bad { color: var(--bad); }
</style>
