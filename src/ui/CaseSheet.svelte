<script lang="ts">
  import CaseDiagram from './CaseDiagram.svelte';
  import CubeAnimator from './animator/CubeAnimator.svelte';
  import AlgText from './AlgText.svelte';
  import Sheet from './Sheet.svelte';
  import { slide } from 'svelte/transition';
  import { MOTION } from './motion';
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

  // An edit in progress is never thrown away silently.
  const canClose = () => !editing || draft.trim() === alg.trim() || confirm('Discard your algorithm edit?');

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

<Sheet title="{info.name} #{info.oll}" {onClose} {canClose}>
  <CaseDiagram pattern={info.pattern} size={84} />
  <p class="alg">
    <AlgText {alg} />
    {#if hasOverride}<span class="badge">modified</span>{/if}
  </p>
  {#if alg}
    {#key alg}
      <CubeAnimator {alg} setup={alg} />
    {/key}
  {/if}
  {#if info.secondary}<p class="alg secondary"><AlgText alg={info.secondary} /></p>{/if}
  {#if info.triggers}<p class="dim small">{info.triggers}</p>{/if}
  {#if info.notes}<p class="dim small">{info.notes}</p>{/if}

  {#if !editing}
    <button class="btn edit" onclick={startEdit}>Edit algorithm</button>
  {:else}
    <div class="editor" transition:slide={MOTION}>
      <textarea class="draft" bind:value={draft} rows="2" spellcheck="false" aria-label="algorithm"></textarea>
      {#if error}<p class="error">{error}</p>{/if}
      <div class="editor-actions">
        <button class="btn" onclick={cancelEdit}>Cancel</button>
        {#if hasOverride}<button class="btn" onclick={reset}>Reset to default</button>{/if}
        <button class="btn primary" onclick={save}>Save</button>
      </div>
    </div>
  {/if}
</Sheet>

<style>
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 28ch; }
  .alg.secondary { color: var(--dim); font-size: var(--fs-button); }
  .small { font-size: var(--fs-small); max-width: 34ch; }
  .badge {
    display: inline-block; margin-left: 6px; padding: 2px 7px;
    border: 1px solid var(--accent); color: var(--accent); border-radius: 999px;
    font: 600 var(--fs-label) var(--font-ui); vertical-align: middle;
  }
  .editor { width: 100%; max-width: 32ch; display: flex; flex-direction: column; gap: 8px; }
  .draft {
    font: 600 var(--fs-body)/1.4 var(--font-mono); width: 100%;
    border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--panel-2); color: var(--text); padding: 10px; resize: vertical;
  }
  .draft:focus { outline: none; border-color: var(--accent); }
  .error { color: var(--bad); font: 400 var(--fs-caption) var(--font-mono); }
  .editor-actions { display: flex; gap: 8px; }
  .btn {
    flex: 1; min-height: var(--tap); padding: 0 14px;
    border: 1px solid var(--line); background: var(--panel-2); color: var(--text);
    border-radius: var(--radius); font: 500 var(--fs-button) var(--font-ui); cursor: pointer;
  }
  .btn.edit { flex: none; margin-top: 4px; }
  .btn.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 700; }
  .btn:hover { border-color: var(--dim); }
</style>
