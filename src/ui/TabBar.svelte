<script lang="ts">
  import { currentRoute, navigate, type Route } from './router.svelte';
  const tabs: { path: Route; label: string }[] = [
    { path: '/train', label: 'Train' },
    { path: '/timer', label: 'Timer' },
    { path: '/cases', label: 'Cases' },
    { path: '/stats', label: 'Stats' },
    { path: '/settings', label: 'Settings' },
  ];
</script>

<nav>
  {#each tabs as tab}
    <button class:on={currentRoute() === tab.path} onclick={() => navigate(tab.path)}>
      {tab.label}
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed; inset: auto 0 0 0; height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    display: flex; background: var(--panel); border-top: 1px solid var(--line);
  }
  button {
    flex: 1; background: none; border: 0; color: var(--dim);
    font: 500 12px var(--font-ui); cursor: pointer;
  }
  button.on { color: var(--accent); }
</style>
