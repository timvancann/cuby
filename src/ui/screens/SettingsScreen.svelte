<script lang="ts">
  import { slide } from 'svelte/transition';
  import { getSetting, setSetting, getPhaseSet, setPhaseSet } from '../../data/settings';
  import { parsePhaseLabels } from '../phaseSet';
  import { navigate } from '../router.svelte';
  import TriggerSheet from '../TriggerSheet.svelte';
  import PllDiagram from '../PllDiagram.svelte';
  import Icon from '../Icon.svelte';
  import { MOTION } from '../motion';
  import { plural } from '../format';
  import { resetDrillHistory } from '../drillState.svelte';
  import { db } from '../../data/db';
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
  let phaseMsg = $state('');
  let open = $state<'triggers' | 'notation' | 'pll' | null>(null);
  let openTrigger = $state<{ name: string; moves: string } | null>(null);

  const NOTATION: { name: string; moves: string }[] = [
    { name: "R: right face, clockwise", moves: 'R' },
    { name: "R': prime, counterclockwise", moves: "R'" },
    { name: 'R2: half turn, 180°', moves: 'R2' },
    { name: 'U D L F B: up, down, left, front, back', moves: 'U D L F B' },
    { name: 'r: lowercase, two layers (wide)', moves: 'r' },
    { name: 'M: middle slice, follows L', moves: 'M' },
    { name: 'E: equator slice, follows D', moves: 'E' },
    { name: 'S: standing slice, follows F', moves: 'S' },
    { name: 'x: rotate whole cube, follows R', moves: 'x' },
    { name: 'y: rotate whole cube, follows U', moves: 'y' },
    { name: 'z: rotate whole cube, follows F', moves: 'z' },
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
      note: "solved bar in front. R2 U' R' U', then R U R U R U' R" },
    { name: 'Ub perm', moves: "R' U R' U' R' U' R' U R U R2",
      note: "solved bar in front. R' U R' U' R' U', then R' U R U R2 (inverse of Ua)" },
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
    navigator.storage?.persisted?.().then(p => { if (p) persisted = true; });
    navigator.storage?.estimate?.().then(e => {
      if (e.usage != null) usage = `${(e.usage / 1024 / 1024).toFixed(1)} MB used`;
    });
    getPhaseSet().then(p => { phaseText = p.join(', '); });
    getSetting<'cube' | 'diagram'>('dryDisplay', 'cube').then(d => { dryDisplay = d; });
  }

  $effect(() => {
    loadSettings();
  });

  function toggle(section: 'triggers' | 'notation' | 'pll') {
    open = open === section ? null : section;
  }

  function toggleDryDisplay() {
    dryDisplay = dryDisplay === 'cube' ? 'diagram' : 'cube';
    void setSetting('dryDisplay', dryDisplay);
  }

  function toggleVibration() {
    vibration = !vibration;
    void setSetting('vibration', vibration);
  }

  async function requestPersist() {
    if (!navigator.storage?.persist) return;
    persisted = await navigator.storage.persist();
    await setSetting('storagePersisted', persisted);
  }

  function savePhases() {
    const parsed = parsePhaseLabels(phaseText);
    phaseMsg = '';
    if ('error' in parsed) { phaseError = parsed.error; return; }
    phaseError = '';
    phaseText = parsed.labels.join(', ');
    void setPhaseSet(parsed.labels).then(() => { phaseMsg = 'saved'; });
  }

  let fileInput = $state<HTMLInputElement | null>(null);
  let exportMsg = $state('');
  let importError = $state('');
  let importMsg = $state('');
  let pendingImport = $state.raw<BackupFile | null>(null);
  // Clear history asks twice (spec §5.2): 'ask' explains, 'final' is the point of no return.
  let clearStep = $state<'closed' | 'ask' | 'final'>('closed');
  let clearCount = $state(0);
  let clearMsg = $state('');

  async function doExport() {
    clearMsg = '';
    const backup = await exportAll(Date.now());
    const json = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const name = `cuby-export-${date}.json`;
    const file = new File([json], name, { type: 'application/json' });
    const done = `exported ${plural(backup.attempts.length, 'attempt')}`;
    // The share sheet works in an installed iOS PWA, where a download link
    // doesn't. If sharing is refused (e.g. the tap's user activation expired
    // while the backup was read), fall back to the download below.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'cuby backup' });
        exportMsg = done;
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // you closed the share sheet
      }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    exportMsg = done;
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
    resetDrillHistory();
    importMsg = 'import complete';
    pendingImport = null;
    loadSettings();
  }

  async function openClearConfirm() {
    clearMsg = '';
    clearCount = await db.attempts.count();
    clearStep = 'ask';
  }

  async function confirmClear() {
    await clearHistory();
    resetDrillHistory();
    clearStep = 'closed';
    clearMsg = 'history cleared';
  }
</script>

<div class="screen wide">
  <h1 class="h1">Settings</h1>
  <div class="cols">
  <div class="col">
  <section>
    <button class="row" onclick={() => navigate('/cases')}>
      <span>Case selection</span><span class="dim val">on the Cases tab <Icon name="next" size={16} /></span>
    </button>
    <button class="row" onclick={toggleVibration} role="switch" aria-checked={vibration}>
      <span>Vibration on tap</span><span class="dim">{vibration ? 'on' : 'off'}</span>
    </button>
    <button class="row" onclick={toggleDryDisplay}>
      <span>Dry practice display</span><span class="dim">{dryDisplay === 'cube' ? '3D cube' : 'diagram'}</span>
    </button>
  </section>

  <h2 class="section-label title">Reference</h2>
  <section>
    {#snippet disclosure(id: 'triggers' | 'notation' | 'pll', label: string)}
      <button class="row" aria-expanded={open === id} onclick={() => toggle(id)}>
        <span>{label}</span><span class="chev" class:open={open === id}><Icon name="chevron" size={18} /></span>
      </button>
    {/snippet}
    {@render disclosure('triggers', 'Common triggers')}
    {#if open === 'triggers'}
      <div class="list" transition:slide={MOTION}>
        {#each TRIGGERS as t}
          <button class="row trigger" onclick={() => (openTrigger = t)}>
            <span>{t.name}</span><span class="moves">{t.moves}</span>
          </button>
        {/each}
      </div>
    {/if}
    {@render disclosure('notation', 'Cube notation')}
    {#if open === 'notation'}
      <div class="list" transition:slide={MOTION}>
        {#each NOTATION as n}
          <button class="row trigger" onclick={() => (openTrigger = n)}>
            <span class="notation-name">{n.name}</span><span class="moves">{n.moves}</span>
          </button>
        {/each}
      </div>
    {/if}
    {@render disclosure('pll', '2-look PLL')}
    {#if open === 'pll'}
      <div class="list" transition:slide={MOTION}>
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
      </div>
    {/if}
  </section>
  </div>

  <div class="col">
  <h2 class="section-label title">CFOP phases</h2>
  <section>
    <div class="row editor">
      <input class="phase-input" bind:value={phaseText} spellcheck="false" aria-label="CFOP phases, comma separated" />
      <button class="save" onclick={savePhases}>Save</button>
    </div>
    {#if phaseError}<p class="error">{phaseError}</p>{/if}
    {#if phaseMsg}<p class="hint">{phaseMsg}</p>{/if}
  </section>

  <h2 class="section-label title">Data</h2>
  <section>
    <button class="row" onclick={doExport}>
      <span>Export</span><span class="dim val">save a backup file <Icon name="export" size={16} /></span>
    </button>
    {#if exportMsg}<p class="hint">{exportMsg}</p>{/if}
    <button class="row" onclick={pickImportFile}>
      <span>Import</span><span class="dim val">replace with a backup <Icon name="import" size={16} /></span>
    </button>
    {#if importError}<p class="error">{importError}</p>{/if}
    {#if importMsg}<p class="hint">{importMsg}</p>{/if}
    {#if pendingImport}
      <div class="row confirm" transition:slide={MOTION}>
        <span>Replace ALL data (history, algorithms, settings) with this file?
          {plural(pendingImport.attempts.length, 'attempt')}, exported {new Date(pendingImport.exportedAt).toISOString().slice(0, 10)}.</span>
        <div class="actions">
          <button class="btn" onclick={() => (pendingImport = null)}>Cancel</button>
          <button class="btn" onclick={doExport}>Export current first</button>
          <button class="btn bad" onclick={confirmImport}>Replace</button>
        </div>
      </div>
    {/if}
    <input type="file" accept="application/json" bind:this={fileInput} onchange={onFileChosen} class="hidden-input" />
    <button class="row" onclick={openClearConfirm} disabled={clearStep !== 'closed'}>
      <span>Clear history</span><span class="dim">delete sessions and attempts</span>
    </button>
    {#if clearStep === 'ask'}
      <div class="row confirm" transition:slide={MOTION}>
        <span>Delete all {plural(clearCount, 'attempt')} and their sessions? Algorithms and settings stay.</span>
        <div class="actions">
          <button class="btn" onclick={() => (clearStep = 'closed')}>Cancel</button>
          <button class="btn" onclick={doExport}>Export first</button>
          <button class="btn bad" onclick={() => (clearStep = 'final')}>Delete</button>
        </div>
      </div>
    {:else if clearStep === 'final'}
      <div class="row confirm" transition:slide={MOTION}>
        <span><b>This can't be undone.</b> Are you sure?</span>
        <div class="actions">
          <button class="btn" onclick={() => (clearStep = 'closed')}>Keep my history</button>
          <button class="btn bad" onclick={confirmClear}>Yes, delete everything</button>
        </div>
      </div>
    {/if}
    {#if clearMsg}<p class="hint">{clearMsg}</p>{/if}
  </section>

  <h2 class="section-label title">Storage</h2>
  <section>
    <div class="row static">
      <span>Persistent storage</span>
      <span class="dim">{persisted ? 'granted' : persisted === false ? 'not granted' : 'not requested'}{usage ? `, ${usage}` : ''}</span>
    </div>
    {#if !persisted}
      <div class="row confirm">
        <span class="dim small">Without it the browser may delete your history when the device runs low on space.
          Installing cuby to the home screen usually gets it granted. Export a backup now and then either way.</span>
        <div class="actions">
          <button class="btn" onclick={requestPersist}>Ask again</button>
        </div>
      </div>
    {/if}
  </section>
  </div>
  </div>
</div>

{#if openTrigger}
  <TriggerSheet name={openTrigger.name} moves={openTrigger.moves} onClose={() => (openTrigger = null)} />
{/if}

<style>
  .h1 { margin-bottom: 16px; }
  .title { margin: 24px 2px 8px; }
  section { display: grid; gap: 1px; background: var(--line); border-radius: var(--radius); overflow: hidden; }
  .list { display: grid; gap: 1px; }
  .row {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    min-height: 48px; background: var(--panel); color: var(--text); border: 0; text-align: left;
    font: 500 var(--fs-body) var(--font-ui); padding: 10px 14px; cursor: pointer;
  }
  .row:disabled { cursor: default; color: var(--dim); }
  .row.static { cursor: auto; }
  .val { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-button); }
  .chev { color: var(--dim); display: grid; transition: transform var(--motion) var(--ease); }
  .chev.open { transform: rotate(180deg); }
  .row.editor { gap: 8px; cursor: auto; padding: 8px; }
  .row.trigger { background: var(--panel-2); min-height: var(--tap); padding: 8px 14px; }
  .moves { font: 600 var(--fs-button) var(--font-mono); color: var(--accent); white-space: nowrap; }
  .notation-name { font-size: var(--fs-button); }
  .row.pll { justify-content: flex-start; gap: 12px; }
  .pll-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .row.pll .moves { white-space: normal; }
  .note { font: var(--fs-small)/1.35 var(--font-ui); color: var(--dim); }
  .small { font-size: var(--fs-small); line-height: 1.4; }
  .phase-input {
    flex: 1; min-width: 0; min-height: var(--tap); font: var(--fs-button) var(--font-mono);
    background: var(--bg); color: var(--text); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 0 12px; outline: none;
  }
  .phase-input:focus { border-color: var(--accent); }
  .save {
    min-height: var(--tap); background: var(--accent); color: var(--accent-ink); border: 0; border-radius: var(--radius);
    font: 700 var(--fs-button) var(--font-ui); padding: 0 18px; cursor: pointer;
  }
  .save:active { opacity: 0.8; }
  .error { background: var(--panel); color: var(--bad); font: var(--fs-small) var(--font-ui); padding: 10px 14px; }
  .hint { background: var(--panel); color: var(--dim); font: var(--fs-small) var(--font-ui); padding: 10px 14px; }
  .hidden-input { display: none; }
  .row.confirm { flex-direction: column; align-items: stretch; gap: 10px; cursor: auto; background: var(--panel-2); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  .btn {
    min-height: var(--tap); background: var(--bg); color: var(--text); border: 1px solid var(--line);
    border-radius: var(--radius); font: 500 var(--fs-button) var(--font-ui); padding: 0 14px; cursor: pointer;
  }
  .btn:active { opacity: 0.8; }
  .btn.bad { background: var(--bad); color: var(--accent-ink); border-color: var(--bad); font-weight: 700; }

  /* The columns are invisible on phones: everything stacks as before. */
  .cols, .col { display: contents; }
  @media (hover: hover) {
    .row:not(.static, .editor, .confirm, :disabled):hover { background: var(--panel-2); }
    .row.trigger:hover { background: #2a2d35; }
  }

  /* Desktop: preferences and references left, phases and data right. */
  @media (min-width: 900px) and (min-height: 600px) {
    .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; align-items: start; }
    .col { display: block; }
    .col > .title:first-child { margin-top: 0; }
  }
</style>
