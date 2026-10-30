<script lang="ts">
  // An algorithm as text that only line-breaks between groups: "(R U R' U')"
  // never splits across lines, and neither does a lone move like "U2'".
  import { algGroups } from './algGroups';

  let { alg }: { alg: string } = $props();

  const pieces = $derived(algGroups(alg));
</script>

{#each pieces as p}{#if /^\s$/.test(p)}{p}{:else}<span class="g">{p}</span>{/if}{/each}

<style>
  .g { white-space: nowrap; }
</style>
