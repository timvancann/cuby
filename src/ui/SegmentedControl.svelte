<script lang="ts">
  let { options, value, onChange, disabled = false }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
  } = $props();

  const idx = $derived(Math.max(0, options.findIndex(o => o.value === value)));
</script>

<div class="seg" role="group" style="--n: {options.length}; --i: {idx}">
  <div class="thumb"></div>
  {#each options as o}
    <button aria-pressed={o.value === value} class:on={o.value === value} {disabled} onclick={() => onChange(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 4px;
  }
  .thumb {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 8px) / var(--n));
    transform: translateX(calc(var(--i) * 100%));
    background: var(--panel-2);
    border-radius: 9px;
    box-shadow: inset 0 0 0 1px #343a45;
    transition: transform var(--motion) var(--ease);
  }
  button {
    position: relative;
    z-index: 1;
    background: none;
    border: 0;
    color: var(--dim);
    font: 600 var(--fs-button) var(--font-ui);
    min-height: var(--tap);
    white-space: nowrap;
    cursor: pointer;
    transition: color 150ms;
  }
  button.on { color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: default; }
</style>
