<script lang="ts">
  import CubeAnimator from './animator/CubeAnimator.svelte';

  let { name, moves, onClose }: { name: string; moves: string; onClose: () => void } = $props();
</script>

<button class="overlay" aria-label="close" onclick={onClose}></button>
<div class="sheet">
  <h2>{name}</h2>
  <p class="alg">{moves}</p>
  <CubeAnimator alg={moves} />
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
</style>
