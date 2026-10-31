<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import Icon from './Icon.svelte';
  import { drillKeys } from './keys';
  import { MOTION, rise } from './motion';

  let { title, onClose, canClose = () => true, children }: {
    title?: string;
    onClose: () => void;
    canClose?: () => boolean; // false keeps the sheet open (e.g. an unsaved edit)
    children: Snippet;
  } = $props();

  // The sheet owns a history entry, so the phone's back gesture closes it
  // instead of leaving the tab. Every close goes through history.back().
  let pushed = false;
  let confirmed = false; // canClose already said yes; don't ask again on the popstate

  function requestClose() {
    if (!canClose()) return;
    confirmed = true;
    if (pushed) history.back();
    else onClose();
  }

  $effect(() => {
    document.body.classList.add('sheet-open');
    const hash = location.hash;
    history.pushState({ cubySheet: true }, '');
    pushed = true;
    const onPop = () => {
      if (!pushed) return;
      if (!confirmed && !canClose()) { history.pushState({ cubySheet: true }, ''); return; }
      pushed = false;
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.classList.remove('sheet-open');
      // Closed by the app itself (not via back): drop our entry, unless the
      // route already moved on, where going back would undo that navigation.
      if (pushed && location.hash === hash) history.back();
      pushed = false;
    };
  });

  $effect(() => drillKeys({ onSpace: () => {}, onEscape: requestClose }));

  // Keyboard focus moves into the sheet when it opens and back to whatever
  // opened it when it closes, so Tab doesn't wander the screen behind it.
  let sheetEl: HTMLDivElement;
  $effect(() => {
    const opener = document.activeElement as HTMLElement | null;
    sheetEl.focus({ preventScroll: true });
    return () => opener?.focus({ preventScroll: true });
  });
</script>

<button class="overlay" aria-label="close" onclick={requestClose} transition:fade|global={MOTION}></button>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={sheetEl} transition:rise|global>
  <div class="head">
    <span class="grab" aria-hidden="true"></span>
    {#if title}<h2>{title}</h2>{/if}
    <button class="close" aria-label="close" onclick={requestClose}><Icon name="close" /></button>
  </div>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 20;
    background: rgba(0, 0, 0, 0.55); border: 0; cursor: pointer;
  }
  .sheet {
    position: fixed; inset: auto 0 0 0; z-index: 21;
    max-width: 560px; margin-inline: auto; max-height: 85dvh;
    display: flex; flex-direction: column;
    background: var(--panel); border-top: 1px solid var(--line); border-radius: 14px 14px 0 0;
  }
  .sheet:focus { outline: none; }
  .head {
    position: relative; flex: none; display: flex; align-items: center; justify-content: center;
    min-height: 52px; padding: 10px 56px 0;
  }
  .grab {
    position: absolute; top: 6px; left: 50%; translate: -50% 0;
    width: 36px; height: 4px; border-radius: 2px; background: var(--line);
  }
  h2 { font: 600 var(--fs-title)/1.3 var(--font-ui); text-align: center; }
  .close {
    position: absolute; top: 4px; right: 6px;
    width: var(--tap); height: var(--tap); display: grid; place-items: center;
    background: none; border: 0; border-radius: var(--radius); color: var(--dim); cursor: pointer;
  }
  .close:hover { color: var(--text); }
  .body {
    min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    padding: 4px 20px calc(20px + env(safe-area-inset-bottom));
  }
  /* Overflowing content scrolls; it never squashes (an SVG would collapse to 0). */
  .body > :global(*) { flex-shrink: 0; }

  /* Desktop: a centred dialog, no drag handle. Keep in sync with DESKTOP_QUERY. */
  @media (min-width: 900px) and (min-height: 600px) {
    .sheet {
      inset: 0; margin: auto; width: min(560px, calc(100vw - 48px)); height: fit-content;
      border: 1px solid var(--line); border-radius: 14px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    }
    .grab { display: none; }
    .head { padding-top: 6px; }
    .body { padding-bottom: 24px; }
  }
</style>
