<script lang="ts">
  import { getSetting, setSetting, getPhaseSet, setPhaseSet } from '../../data/settings';
  import { parsePhaseLabels } from '../phaseSet';
  import { navigate } from '../router.svelte';
  import TriggerSheet from '../TriggerSheet.svelte';

  let vibration = $state(true);
  let persisted = $state<boolean | null>(null);
  let usage = $state('');
  let phaseText = $state('');
  let phaseError = $state('');
  let triggersOpen = $state(false);
  let openTrigger = $state<{ name: string; moves: string } | null>(null);

  const TRIGGERS: { name: string; moves: string }[] = [
    { name: 'Sexy', moves: "R U R' U'" },
    { name: 'Anti-sexy', moves: "U R U' R'" },
    { name: 'Lefty sexy', moves: "L' U' L U" },
    { name: 'Lefty anti-sexy', moves: "U' L' U L" },
    { name: 'Sledgehammer', moves: "R' F R F'" },
    { name: 'Hedgeslammer', moves: "F R' F' R" },
    { name: 'Lefty sledge', moves: "L F' L' F" },
    { name: 'Lefty hedge', moves: "F' L F L'" },
  ];

  $effect(() => {
    getSetting('vibration', true).then(v => { vibration = v; });
    getSetting<boolean | null>('storagePersisted', null).then(p => { persisted = p; });
    navigator.storage?.estimate?.().then(e => {
      if (e.usage != null) usage = `${(e.usage / 1024 / 1024).toFixed(1)} MB used`;
    });
    getPhaseSet().then(p => { phaseText = p.join(', '); });
  });

  function toggleVibration() {
    vibration = !vibration;
    void setSetting('vibration', vibration);
  }

  function savePhases() {
    const parsed = parsePhaseLabels(phaseText);
    if ('error' in parsed) { phaseError = parsed.error; return; }
    phaseError = '';
    phaseText = parsed.labels.join(', ');
    void setPhaseSet(parsed.labels);
  }
</script>

<div class="screen">
  <h1>Settings</h1>
  <section>
    <button class="row" onclick={() => navigate('/cases')}>
      <span>Case selection</span><span class="dim">choose on Cases tab</span>
    </button>
    <button class="row" onclick={toggleVibration}>
      <span>Vibration on tap</span><span class="dim">{vibration ? 'on' : 'off'}</span>
    </button>
    <div class="row">
      <span>Persistent storage</span>
      <span class="dim">
        {persisted === null ? 'not requested' : persisted ? 'granted' : 'denied'}{usage ? `, ${usage}` : ''}
      </span>
    </div>
  </section>
  <h2 class="section-title">Reference</h2>
  <section>
    <button class="row" onclick={() => (triggersOpen = !triggersOpen)}>
      <span>Common triggers</span><span class="dim">{triggersOpen ? 'hide' : 'show'}</span>
    </button>
    {#if triggersOpen}
      {#each TRIGGERS as t}
        <button class="row trigger" onclick={() => (openTrigger = t)}>
          <span>{t.name}</span><span class="moves">{t.moves}</span>
        </button>
      {/each}
    {/if}
  </section>
  <h2 class="section-title">CFOP phases</h2>
  <section>
    <div class="row editor">
      <input class="phase-input" bind:value={phaseText} spellcheck="false" />
      <button class="save" onclick={savePhases}>Save</button>
    </div>
    {#if phaseError}<p class="error">{phaseError}</p>{/if}
  </section>
</div>

{#if openTrigger}
  <TriggerSheet name={openTrigger.name} moves={openTrigger.moves} onClose={() => (openTrigger = null)} />
{/if}

<style>
  h1 { font-size: 20px; margin-bottom: 12px; }
  h2.section-title { font-size: 16px; margin-top: 20px; margin-bottom: 8px; color: var(--dim); font-weight: 500; }
  section { display: grid; gap: 1px; background: var(--line); border-radius: var(--radius); overflow: hidden; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    background: var(--panel); color: var(--text); border: 0; text-align: left;
    font: 500 14px var(--font-ui); padding: 14px 14px; cursor: pointer;
  }
  .row.editor {
    gap: 8px; cursor: auto; padding: 8px 8px;
  }
  .row.trigger { padding: 10px 14px; }
  .moves { font: 600 14px var(--font-mono); color: var(--accent); }
  .phase-input {
    flex: 1; font: 13px var(--font-mono); background: var(--bg); color: var(--text); border: 1px solid var(--line);
    border-radius: 4px; padding: 8px 10px; outline: none;
  }
  .phase-input:focus { border-color: var(--accent); }
  .save { background: var(--accent); color: var(--accent-ink); border: 0; border-radius: 4px; font: 500 13px var(--font-ui);
    padding: 8px 14px; cursor: pointer; }
  .save:active { opacity: 0.8; }
  .error { background: var(--panel); color: var(--bad); font: 12px var(--font-ui); padding: 8px 14px; margin: 0;
    border-top: 1px solid var(--line); }
</style>
