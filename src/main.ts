import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { getSetting, setSetting } from './data/settings';

void (async () => {
  if (await getSetting<boolean | null>('storagePersisted', null) === null && navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    await setSetting('storagePersisted', granted);
  }
})();

export default mount(App, { target: document.getElementById('app')! });
