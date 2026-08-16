<script lang="ts">
  let { scramble, small = false, perRow = 6 }: {
    scramble: string;
    small?: boolean;
    perRow?: number;
  } = $props();

  const rows = $derived.by(() => {
    const moves = scramble.split(' ');
    const out: string[][] = [];
    for (let i = 0; i < moves.length; i += perRow) out.push(moves.slice(i, i + perRow));
    return out;
  });
</script>

<div class="grid" class:small style="--cols: {perRow}">
  {#each rows as row}
    <div class="row">
      {#each row as m}<span>{m}</span>{/each}
    </div>
  {/each}
</div>

<style>
  .grid { display: grid; gap: 6px; }
  .row {
    /* font lives on the row so the 3ch column width is measured in the mono font */
    font: 600 24px var(--font-mono);
    display: grid;
    grid-template-columns: repeat(var(--cols), 3ch);
    justify-content: center;
    gap: 6px;
  }
  span { text-align: left; color: var(--text); }
  /* alternate colors per column; with an even perRow this alternates per move */
  span:nth-child(even) { color: var(--accent); }
  .small .row { font-size: 17px; }
  .small span:nth-child(odd) { color: var(--dim); }
  .small span:nth-child(even) { color: color-mix(in srgb, var(--accent) 70%, var(--dim)); }
</style>
