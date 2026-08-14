<script lang="ts">
  import CaseDiagram from '../CaseDiagram.svelte';
  import { cases, groups } from '../../data/caseSet';
  import { getCaseSelection, setCaseSelection } from '../../data/settings';
  import { toggleCase, toggleGroup } from '../selection';

  let selected = $state<string[]>([]);
  let loaded = $state(false);

  $effect(() => {
    getCaseSelection().then(ids => { selected = ids; loaded = true; });
  });

  function update(next: string[]) {
    selected = next;
    void setCaseSelection(next);
  }

  const byGroup = $derived(groups.map(g => ({ ...g, cases: cases.filter(c => c.group === g.id) })));
</script>

<div class="screen">
  <h1>Cases <span class="dim">{selected.length}/{cases.length} selected</span></h1>
  {#if loaded}
    {#each byGroup as group}
      <section>
        <button class="group-header" onclick={() => update(toggleGroup(selected, group.cases.map(c => c.id)))}>
          {group.name}
          <span class="dim">{group.cases.filter(c => selected.includes(c.id)).length}/{group.cases.length}</span>
        </button>
        <div class="grid">
          {#each group.cases as c}
            <button class="tile" class:on={selected.includes(c.id)} onclick={() => update(toggleCase(selected, c.id))}>
              <CaseDiagram pattern={c.pattern} size={64} />
              <span class="name">{c.name}</span>
              <span class="dim">#{c.oll}</span>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  h1 { font-size: 20px; margin-bottom: 12px; }
  h1 .dim { font-size: 13px; font-weight: 400; margin-left: 8px; }
  section { margin-bottom: 20px; }
  .group-header {
    width: 100%; display: flex; justify-content: space-between; align-items: baseline;
    background: none; border: 0; border-bottom: 1px solid var(--line);
    color: var(--text); font: 600 15px var(--font-ui); padding: 8px 2px; cursor: pointer;
  }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-top: 10px; }
  .tile {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    background: var(--panel); border: 2px solid transparent; border-radius: var(--radius);
    color: var(--text); padding: 10px 4px 8px; cursor: pointer; font: 500 12px var(--font-ui);
  }
  .tile.on { border-color: var(--accent); }
  .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
