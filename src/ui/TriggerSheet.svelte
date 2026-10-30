<script lang="ts">
  import CubeAnimator from './animator/CubeAnimator.svelte';
  import AlgText from './AlgText.svelte';
  import Sheet from './Sheet.svelte';
  import type { Scheme } from './animator/engine';

  let { name, moves, onClose, scheme = 'yellow-top' }: {
    name: string; moves: string; onClose: () => void; scheme?: Scheme;
  } = $props();
</script>

<Sheet title={name} {onClose}>
  <p class="alg"><AlgText alg={moves} /></p>
  <CubeAnimator alg={moves} {scheme} />
</Sheet>

<style>
  .alg { font: 600 17px/1.5 var(--font-mono); max-width: 28ch; }
</style>
