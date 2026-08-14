<script lang="ts">
  import { getSetting, setSetting } from '../../data/settings';
  import { navigate } from '../router.svelte';

  let vibration = $state(true);
  let persisted = $state<boolean | null>(null);
  let usage = $state('');

  $effect(() => {
    getSetting('vibration', true).then(v => { vibration = v; });
    getSetting<boolean | null>('storagePersisted', null).then(p => { persisted = p; });
    navigator.storage?.estimate?.().then(e => {
      if (e.usage != null) usage = `${(e.usage / 1024 / 1024).toFixed(1)} MB used`;
    });
  });

  function toggleVibration() {
    vibration = !vibration;
    void setSetting('vibration', vibration);
  }
</script>

<div class="screen">
  <h1>Settings</h1>
  <section>
    <button class="row" onclick={() => navigate('/cases')}>
      <span>Case selection</span><span class="dim">choose on Cases tab</span>
    </button>
    <button class="row" onclick={toggleVibration}>
      <span>Vibration on tap</span><span class="dim">{vibration ? 'on' : 'off'}</span>
    </button>
    <div class="row">
      <span>Persistent storage</span>
      <span class="dim">
        {persisted === null ? 'not requested' : persisted ? 'granted' : 'denied'}{usage ? `, ${usage}` : ''}
      </span>
    </div>
  </section>
</div>

<style>
  h1 { font-size: 20px; margin-bottom: 12px; }
  section { display: grid; gap: 1px; background: var(--line); border-radius: var(--radius); overflow: hidden; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    background: var(--panel); color: var(--text); border: 0; text-align: left;
    font: 500 14px var(--font-ui); padding: 14px 14px; cursor: pointer;
  }
</style>
