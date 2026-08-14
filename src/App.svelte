<script lang="ts">
  import TabBar from './ui/TabBar.svelte';
  import { currentRoute } from './ui/router.svelte';
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
