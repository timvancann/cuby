<script lang="ts">
  import TabBar from './ui/TabBar.svelte';
  import { currentRoute } from './ui/router.svelte';
  import { pwa } from './ui/pwa.svelte';
  import TrainScreen from './ui/screens/TrainScreen.svelte';
  import TimerScreen from './ui/screens/TimerScreen.svelte';
  import CasesScreen from './ui/screens/CasesScreen.svelte';
  import StatsScreen from './ui/screens/StatsScreen.svelte';
  import SettingsScreen from './ui/screens/SettingsScreen.svelte';
  import { fly } from 'svelte/transition';
  import { MOTION } from './ui/motion';
</script>

{#if currentRoute() === '/train'}<TrainScreen />
{:else if currentRoute() === '/timer'}<TimerScreen />
{:else if currentRoute() === '/cases'}<CasesScreen />
{:else if currentRoute() === '/stats'}<StatsScreen />
{:else}<SettingsScreen />{/if}
<TabBar />

{#if pwa.needRefresh}
  <button class="update-toast" onclick={() => pwa.reload()} transition:fly={{ ...MOTION, y: 24 }}>
    Update available, tap to reload
  </button>
{/if}

<style>
  .update-toast {
    position: fixed;
    left: 0;
    right: 0;
    margin-inline: auto;
    width: max-content;
    bottom: calc(68px + env(safe-area-inset-bottom));
    z-index: 30;
    background: var(--accent);
    color: var(--accent-ink);
    border: 0;
    border-radius: 999px;
    font: 600 var(--fs-small) var(--font-ui, system-ui);
    padding: 12px 20px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }
  @media (min-width: 900px) and (min-height: 600px) {
    .update-toast { left: var(--rail); bottom: 24px; }
  }
</style>
