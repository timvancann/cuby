<script lang="ts">
  import { slide } from 'svelte/transition';
  import CaseDiagram from '../CaseDiagram.svelte';
  import CaseSheet from '../CaseSheet.svelte';
  import { cases, groups, type CaseInfo } from '../../data/caseSet';
  import { getCaseSelection, setCaseSelection } from '../../data/settings';
  import { toggleCase, toggleGroup } from '../selection';
  import { longpress } from '../longpress';
  import { MOTION } from '../motion';

  let selected = $state<string[]>([]);
  let loaded = $state(false);
  let peek = $state<CaseInfo | null>(null);

  $effect(() => {
    getCaseSelection().then(ids => { selected = ids; loaded = true; });
  });

  function update(next: string[]) {
    selected = next;
    void setCaseSelection(next);
  }

  const byGroup = $derived(groups.map(g => ({ ...g, cases: cases.filter(c => c.group === g.id) })));
  const easyIds = cases.filter(c => c.easy).map(c => c.id);
</script>

<div class="screen wide">
  <h1 class="h1">Cases <span class="dim count">{selected.length}/{cases.length} selected</span></h1>
  <p class="hint dim">Tap a case to see its algorithm, hold it to select it.</p>
  <div class="presets">
    <button class="chip" onclick={() => update(cases.map(c => c.id))}>Select all</button>
    <button class="chip" onclick={() => update(easyIds)}>Easy {easyIds.length}</button>
    <button class="chip" onclick={() => update([])} disabled={selected.length === 0}>None</button>
  </div>
  {#if loaded && selected.length < 2}
    <p class="warn" transition:slide={MOTION}>Pick at least 2 cases to train, there's nothing to recognize with one.</p>
  {/if}
  {#if loaded}
    <div class="groups">
    {#each byGroup as group}
      {@const n = group.cases.filter(c => selected.includes(c.id)).length}
      <section>
        <button class="group-header" onclick={() => update(toggleGroup(selected, group.cases.map(c => c.id)))}>
          <span class="section-label">{group.name}</span>
          <span class="group-action">
            <span class="dim">{n}/{group.cases.length}</span>
            <span class="pill">{n === group.cases.length ? 'clear' : 'select all'}</span>
          </span>
        </button>
        <div class="grid">
          {#each group.cases as c}
            <button
              class="tile"
              class:on={selected.includes(c.id)}
              aria-label="{c.name} #{c.oll}{selected.includes(c.id) ? ', selected' : ''}"
              use:longpress={{ onLongPress: () => update(toggleCase(selected, c.id)) }}
              onclick={() => (peek = c)}
            >
              <CaseDiagram pattern={c.pattern} size={64} />
              <span class="name">{c.name}</span>
              <span class="dim">#{c.oll}</span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
    </div>
  {/if}
</div>

{#if peek}
  {@const id = peek.id}
  <CaseSheet info={peek} onClose={() => (peek = null)}
    selected={selected.includes(id)} onToggle={() => update(toggleCase(selected, id))} />
{/if}

<style>
  .h1 { margin-bottom: 4px; }
  .count { font: 400 var(--fs-small) var(--font-ui); margin-left: 8px; letter-spacing: 0; }
  .hint { font-size: var(--fs-small); margin-bottom: 12px; }
  .presets { display: flex; gap: 8px; margin-bottom: 12px; }
  .chip {
    min-height: var(--tap); padding: 0 14px; border-radius: 999px;
    background: var(--panel); border: 1px solid var(--line); color: var(--text);
    font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  .chip:disabled { color: var(--dim); cursor: default; }
  .warn {
    background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--radius);
    color: var(--text); font-size: var(--fs-small); padding: 10px 12px; margin-bottom: 12px;
  }
  section { margin-bottom: 20px; }
  .group-header {
    width: 100%; min-height: var(--tap); display: flex; justify-content: space-between; align-items: center;
    background: none; border: 0; border-bottom: 1px solid var(--line); padding: 0 2px; cursor: pointer;
  }
  .group-header .section-label { color: var(--text); }
  .group-action { display: inline-flex; align-items: center; gap: 10px; font: 500 var(--fs-small) var(--font-ui); }
  .pill {
    color: var(--accent); border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px;
    font: 500 var(--fs-caption) var(--font-ui);
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 10px; }
  .tile {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: var(--panel); border: 2px solid transparent; border-radius: var(--radius);
    color: var(--text); padding: 10px 4px 8px; cursor: pointer; font: 500 var(--fs-caption) var(--font-ui);
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    transition: border-color 150ms;
  }
  .tile.on { border-color: var(--accent); }
  .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (hover: hover) {
    .tile:hover:not(.on) { border-color: var(--line); }
    .group-header:hover .pill { border-color: var(--dim); }
  }

  /* Desktop: the groups flow into columns instead of one long list. */
  @media (min-width: 900px) and (min-height: 600px) {
    .hint, .presets, .warn { max-width: 560px; }
    .groups { columns: 3 300px; column-gap: 32px; }
    /* Each group sits in a faint card so the column boundaries read clearly. */
    section {
      break-inside: avoid; margin-bottom: 24px; padding: 4px 12px 12px;
      background: #121316; border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 12px;
    }
  }
</style>
