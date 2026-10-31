<script lang="ts">
  import { currentRoute, navigate, type Route } from './router.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { solveInProgress } from './drillState.svelte';

  const tabs: { path: Route; label: string; icon: IconName }[] = [
    { path: '/train', label: 'Train', icon: 'train' },
    { path: '/timer', label: 'Timer', icon: 'timer' },
    { path: '/cases', label: 'Cases', icon: 'cases' },
    { path: '/stats', label: 'Stats', icon: 'stats' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  const hidden = $derived(solveInProgress());
</script>

<nav class:hidden inert={hidden}>
  {#each tabs as tab}
    <button
      class:on={currentRoute() === tab.path}
      aria-current={currentRoute() === tab.path ? 'page' : undefined}
      onclick={() => navigate(tab.path)}
    >
      <Icon name={tab.icon} size={22} />
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav {
    position: fixed; inset: auto 0 0 0; height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    display: flex; background: var(--panel); border-top: 1px solid var(--line);
    transition: transform var(--motion) var(--ease);
  }
  nav.hidden { transform: translateY(100%); }
  button {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    background: none; border: 0; color: var(--dim);
    font: 500 var(--fs-label) var(--font-ui); letter-spacing: 0.02em; cursor: pointer;
  }
  button.on { color: var(--accent); }
  button.on span { font-weight: 700; }

  /* Desktop: a rail down the left edge. Keep in sync with DESKTOP_QUERY. */
  @media (min-width: 900px) and (min-height: 600px) {
    nav {
      inset: 0 auto 0 0; width: var(--rail); height: auto; padding: 16px 8px;
      flex-direction: column; gap: 4px;
      border-top: 0; border-right: 1px solid var(--line);
    }
    nav.hidden { transform: translateX(-100%); }
    button { flex: none; height: 64px; border-radius: var(--radius); gap: 4px; }
    button:hover { color: var(--text); background: var(--panel-2); }
    button.on, button.on:hover { color: var(--accent); background: var(--panel-2); }
  }
</style>
