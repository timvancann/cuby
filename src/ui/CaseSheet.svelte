<script lang="ts">
  import CaseDiagram from './CaseDiagram.svelte';
  import type { CaseInfo } from '../data/caseSet';
  import { activeAlg } from '../data/settings';

  let { info, onClose }: { info: CaseInfo; onClose: () => void } = $props();
  let alg = $state('');

  $effect(() => {
    alg = '';
    activeAlg(info.id).then(a => {
      alg = a;
    });
  });
</script>

<button class="overlay" aria-label="close" onclick={onClose}></button>
<div class="sheet">
  <CaseDiagram pattern={info.pattern} size={110} />
  <h2>{info.name} <span class="dim">#{info.oll}</span></h2>
  <p class="alg">{alg}</p>
  {#if info.secondary}<p class="alg secondary">{info.secondary}</p>{/if}
  {#if info.triggers}<p class="dim small">{info.triggers}</p>{/if}
  {#if info.notes}<p class="dim small">{info.notes}</p>{/if}
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
</style>
