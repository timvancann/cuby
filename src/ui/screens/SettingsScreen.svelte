<script lang="ts">
  import { getSetting, setSetting, getPhaseSet, setPhaseSet } from '../../data/settings';
  import { parsePhaseLabels } from '../phaseSet';
  import { navigate } from '../router.svelte';
  import TriggerSheet from '../TriggerSheet.svelte';
  import PllDiagram from '../PllDiagram.svelte';
  import { solvedCube, applyMoves } from '../../core/cube/model';
  import { parseAlg, invert } from '../../core/cube/parser';
  import { ringColors } from '../../core/cube/pattern';
  import { exportAll, validateBackup, importAll, clearHistory, type BackupFile } from '../../data/backup';

  let vibration = $state(true);
  let dryDisplay = $state<'cube' | 'diagram'>('cube');
  let persisted = $state<boolean | null>(null);
  let usage = $state('');
  let phaseText = $state('');
  let phaseError = $state('');
  let triggersOpen = $state(false);
  let notationOpen = $state(false);
  let pllOpen = $state(false);
  let openTrigger = $state<{ name: string; moves: string } | null>(null);

  const NOTATION: { name: string; moves: string }[] = [
    { name: 'R — right face, clockwise', moves: 'R' },
    { name: "R' — prime: counterclockwise", moves: "R'" },
    { name: 'R2 — half turn, 180°', moves: 'R2' },
    { name: 'U D L F B — up, down, left, front, back', moves: 'U D L F B' },
    { name: 'r — lowercase: two layers (wide)', moves: 'r' },
    { name: 'M — middle slice, follows L', moves: 'M' },
    { name: 'E — equator slice, follows D', moves: 'E' },
    { name: 'S — standing slice, follows F', moves: 'S' },
    { name: 'x — rotate whole cube, follows R', moves: 'x' },
    { name: 'y — rotate whole cube, follows U', moves: 'y' },
    { name: 'z — rotate whole cube, follows F', moves: 'z' },
  ];

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

  // 2-look PLL, six algs from cube.academy/2-look-pll-algs. Notes name the triggers inside each.
  const PLL: { name: string; moves: string; note: string }[] = [
    { name: 'Headlights (T perm)', moves: "R U R' U' R' F R2 U' R' U' R U R' F'",
      note: "sexy, R' F R2, then U' R' U' R U R' F'" },
    { name: 'No headlights (Y perm)', moves: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
      note: "F R U' R' U', R U R' F', then sexy + sledgehammer" },
    { name: 'Ua perm', moves: "R2 U' R' U' R U R U R U' R",
      note: "R2 U' R' U', then R U R U R U' R" },
    { name: 'Ub perm', moves: "R' U R' U' R' U' R' U R U R2",
      note: "R' U R' U' R' U', then R' U R U R2 (inverse of Ua)" },
    { name: 'H perm', moves: "M2 U' M2 U2 M2 U' M2",
      note: "M2 around U', U2, U'" },
    { name: 'Z perm', moves: "M' U' M2 U' M2 U' M' U2 M2",
      note: "M' U', M2 U', M2 U', M' U2 M2, then AUF" },
  ];

  // The state each alg solves from: inverse-apply it to a solved cube.
  const pllRing = (moves: string) => ringColors(applyMoves(solvedCube(), invert(parseAlg(moves))));

  function loadSettings() {
    getSetting('vibration', true).then(v => { vibration = v; });
    getSetting<boolean | null>('storagePersisted', null).then(p => { persisted = p; });
    navigator.storage?.estimate?.().then(e => {
      if (e.usage != null) usage = `${(e.usage / 1024 / 1024).toFixed(1)} MB used`;
    });
    getPhaseSet().then(p => { phaseText = p.join(', '); });
    getSetting<'cube' | 'diagram'>('dryDisplay', 'cube').then(d => { dryDisplay = d; });
  }

  $effect(() => {
    loadSettings();
  });

  function toggleDryDisplay() {
    dryDisplay = dryDisplay === 'cube' ? 'diagram' : 'cube';
    void setSetting('dryDisplay', dryDisplay);
  }

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

  let fileInput = $state<HTMLInputElement | null>(null);
  let exportMsg = $state('');
  let importError = $state('');
  let importMsg = $state('');
  let pendingImport = $state.raw<BackupFile | null>(null);
  let clearOpen = $state(false);
  let clearMsg = $state('');

  async function doExport() {
    clearMsg = '';
    const backup = await exportAll(Date.now());
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cuby-export-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    exportMsg = `exported ${backup.attempts.length} attempts`;
  }

  function pickImportFile() {
    importError = '';
    importMsg = '';
    clearMsg = '';
    pendingImport = null;
    fileInput?.click();
  }

  async function onFileChosen(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importError = '';
    importMsg = '';
    pendingImport = null;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      importError = 'not valid JSON';
      return;
    }
    const err = validateBackup(data);
    if (err) {
      importError = err;
      return;
    }
    pendingImport = data as BackupFile;
  }

  async function confirmImport() {
    if (!pendingImport) return;
    await importAll(pendingImport);
    importMsg = 'import complete';
    pendingImport = null;
    loadSettings();
  }

  function cancelImport() {
    pendingImport = null;
  }

  function openClearConfirm() {
    clearMsg = '';
    clearOpen = true;
  }

  function cancelClear() {
    clearOpen = false;
  }

  async function confirmClear() {
    await clearHistory();
    clearOpen = false;
    clearMsg = 'history cleared';
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
    <button class="row" onclick={toggleDryDisplay}>
      <span>Dry practice display</span><span class="dim">{dryDisplay === 'cube' ? '3D cube' : 'diagram'}</span>
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
    <button class="row" onclick={() => (notationOpen = !notationOpen)}>
      <span>Cube notation</span><span class="dim">{notationOpen ? 'hide' : 'show'}</span>
    </button>
    {#if notationOpen}
      {#each NOTATION as n}
        <button class="row trigger" onclick={() => (openTrigger = n)}>
          <span class="notation-name">{n.name}</span><span class="moves">{n.moves}</span>
        </button>
      {/each}
    {/if}
    <button class="row" onclick={() => (pllOpen = !pllOpen)}>
      <span>2-look PLL</span><span class="dim">{pllOpen ? 'hide' : 'show'}</span>
    </button>
    {#if pllOpen}
      {#each PLL as p}
        <button class="row trigger pll" onclick={() => (openTrigger = p)}>
          <PllDiagram ring={pllRing(p.moves)} size={64} />
          <span class="pll-text">
            <span>{p.name}</span>
            <span class="moves">{p.moves}</span>
            <span class="note">{p.note}</span>
          </span>
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
  <h2 class="section-title">Data</h2>
  <section>
    <button class="row" onclick={doExport}>
      <span>Export</span><span class="dim">download backup</span>
    </button>
    {#if exportMsg}<p class="hint">{exportMsg}</p>{/if}
    <button class="row" onclick={pickImportFile}>
      <span>Import</span><span class="dim">replace with backup file</span>
    </button>
    {#if importError}<p class="error">{importError}</p>{/if}
    {#if importMsg}<p class="hint">{importMsg}</p>{/if}
    {#if pendingImport}
      <div class="row confirm">
        <span>Replace ALL data with this file? ({pendingImport.attempts.length} attempts, exported {new Date(pendingImport.exportedAt).toISOString().slice(0, 10)})</span>
        <div class="actions">
          <button class="btn" onclick={confirmImport}>Confirm</button>
          <button class="btn" onclick={cancelImport}>Cancel</button>
        </div>
      </div>
    {/if}
    <input
      type="file"
      accept="application/json"
      bind:this={fileInput}
      onchange={onFileChosen}
      class="hidden-input"
    />
    {#if !clearOpen}
      <button class="row" onclick={openClearConfirm}>
        <span>Clear history</span><span class="dim">delete sessions &amp; attempts</span>
      </button>
    {:else}
      <div class="row confirm">
        <span>Delete ALL sessions and attempts? Algorithms and settings survive.</span>
        <div class="actions">
          <button class="btn" onclick={doExport}>Export first</button>
          <button class="btn bad" onclick={confirmClear}>Delete</button>
          <button class="btn" onclick={cancelClear}>Cancel</button>
        </div>
      </div>
    {/if}
    {#if clearMsg}<p class="hint">{clearMsg}</p>{/if}
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
  .row.trigger { padding: 10px 14px; gap: 12px; }
  .moves { font: 600 14px var(--font-mono); color: var(--accent); white-space: nowrap; }
  .notation-name { font-size: 13px; }
  .row.pll { justify-content: flex-start; align-items: center; gap: 12px; }
  .pll-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .row.pll .moves { white-space: normal; }
  .note { font: 12px var(--font-ui); color: var(--dim); }
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
  .hint { background: var(--panel); color: var(--dim); font: 12px var(--font-ui); padding: 8px 14px; margin: 0;
    border-top: 1px solid var(--line); }
  .hidden-input { display: none; }
  .row.confirm { flex-direction: column; align-items: stretch; gap: 10px; cursor: auto; }
  .actions { display: flex; gap: 8px; justify-content: flex-end; }
  .btn { background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 4px;
    font: 500 13px var(--font-ui); padding: 8px 14px; cursor: pointer; }
  .btn:active { opacity: 0.8; }
  .btn.bad { background: var(--bad); color: var(--accent-ink); border-color: var(--bad); }
</style>
