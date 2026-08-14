<script lang="ts">
  import CaseDiagram from './CaseDiagram.svelte';
  import CubeAnimator from './animator/CubeAnimator.svelte';
  import type { CaseInfo } from '../data/caseSet';
  import { activeAlg } from '../data/settings';
  import { getOverride, setOverride, clearOverride } from '../data/overrides';

  let { info, onClose }: { info: CaseInfo; onClose: () => void } = $props();
  let alg = $state('');
  let hasOverride = $state(false);
  let editing = $state(false);
  let draft = $state('');
  let error = $state('');

  async function refresh() {
    const [a, o] = await Promise.all([activeAlg(info.id), getOverride(info.id)]);
    alg = a;
    hasOverride = o !== null;
  }

  $effect(() => {
    alg = '';
    hasOverride = false;
    refresh();
  });

  function startEdit() {
    draft = alg;
    error = '';
    editing = true;
  }

  function cancelEdit() {
    editing = false;
    error = '';
  }

  async function save() {
    const err = await setOverride(info.id, draft, Date.now());
    if (err) {
      error = err;
      return;
    }
    editing = false;
    error = '';
    await refresh();
  }

  async function reset() {
    await clearOverride(info.id);
    editing = false;
    error = '';
    await refresh();
  }
</script>

<button class="overlay" aria-label="close" onclick={onClose}></button>
<div class="sheet">
  <CaseDiagram pattern={info.pattern} size={84} />
  <h2>{info.name} <span class="dim">#{info.oll}</span></h2>
  <p class="alg">
    {alg}
    {#if hasOverride}<span class="badge">modified</span>{/if}
  </p>
  {#key alg}
    <CubeAnimator {alg} setup={alg} />
  {/key}
  {#if info.secondary}<p class="alg secondary">{info.secondary}</p>{/if}
  {#if info.triggers}<p class="dim small">{info.triggers}</p>{/if}
  {#if info.notes}<p class="dim small">{info.notes}</p>{/if}

  {#if !editing}
    <button class="text-btn" onclick={startEdit}>edit</button>
  {:else}
    <div class="editor">
      <textarea class="draft" bind:value={draft} rows="2"></textarea>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="editor-actions">
        <button class="btn" onclick={cancelEdit}>Cancel</button>
        {#if hasOverride}<button class="btn" onclick={reset}>Reset to default</button>{/if}
        <button class="btn primary" onclick={save}>Save</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    border: 0;
    z-index: 20;
    cursor: pointer;
  }
  .sheet {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 21;
    background: var(--panel);
    border-top: 1px solid var(--line);
    border-radius: 14px 14px 0 0;
    padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    animation: rise 160ms ease-out;
    max-height: 85dvh;
    overflow-y: auto;
  }
  @keyframes rise {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  h2 { font-size: 19px; }
  .alg {
    font: 600 17px/1.5 var(--font-mono);
    max-width: 28ch;
    min-height: 1.5em;
  }
  .alg.secondary { color: var(--dim); font-size: 14px; }
  .small { font-size: 12px; max-width: 34ch; }
  .badge {
    display: inline-block;
    margin-left: 6px;
    padding: 2px 7px;
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 999px;
    font: 600 11px var(--font-ui);
    vertical-align: middle;
  }
  .text-btn {
    border: 0;
    background: transparent;
    color: var(--dim);
    font: 500 13px var(--font-ui);
    cursor: pointer;
    text-decoration: underline;
    padding: 4px;
  }
  .editor {
    width: 100%;
    max-width: 32ch;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .draft {
    font: 600 15px/1.4 var(--font-mono);
    width: 100%;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--panel-2);
    color: var(--text);
    padding: 8px;
    resize: vertical;
  }
  .error {
    color: var(--bad);
    font: 400 12px var(--font-mono);
    margin: 0;
  }
  .editor-actions { display: flex; gap: 8px; }
  .btn {
    flex: 1;
    border: 1px solid var(--line);
    background: var(--panel-2);
    color: var(--text);
    border-radius: var(--radius);
    font: 500 13px var(--font-ui);
    padding: 8px 0;
    cursor: pointer;
  }
  .btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 700; }
  .btn:hover { border-color: var(--dim); }
</style>
