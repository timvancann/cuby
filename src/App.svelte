<script lang="ts">
  import TabBar from './ui/TabBar.svelte';
  import { currentRoute } from './ui/router.svelte';
  import { pwa } from './ui/pwa.svelte';
  import TrainScreen from './ui/screens/TrainScreen.svelte';
  import TimerScreen from './ui/screens/TimerScreen.svelte';
  import CasesScreen from './ui/screens/CasesScreen.svelte';
  import StatsScreen from './ui/screens/StatsScreen.svelte';
  import SettingsScreen from './ui/screens/SettingsScreen.svelte';
</script>

{#if currentRoute() === '/train'}<TrainScreen />
{:else if currentRoute() === '/timer'}<TimerScreen />
{:else if currentRoute() === '/cases'}<CasesScreen />
{:else if currentRoute() === '/stats'}<StatsScreen />
{:else}<SettingsScreen />{/if}
<TabBar />

{#if pwa.needRefresh}
  <button class="update-toast" onclick={() => pwa.reload()}>
    Update available — tap to reload
  </button>
{/if}

<style>
  .update-toast {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(68px + env(safe-area-inset-bottom));
    z-index: 30;
    background: var(--accent);
    color: var(--accent-ink);
    border: 0;
    border-radius: 999px;
    font: 600 13px var(--font-ui, system-ui);
    padding: 12px 20px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }
</style>
