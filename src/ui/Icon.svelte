<script lang="ts" module>
  // One stroke icon set: 24px grid, 1.75 stroke, round caps, currentColor.
  // Paths are drawn for this app, not taken from an icon library.
  const PATHS = {
    train: 'M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9',
    timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2M9.5 2.5h5M19 5.5l1.5-1.5',
    cases: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    stats: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
    settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
    back: 'M15 5l-7 7 7 7',
    close: 'M6 6l12 12M18 6 6 18',
    chevron: 'M6 9l6 6 6-6',
    play: 'M8 5.5v13l10-6.5-10-6.5Z',
    pause: 'M8 5v14M16 5v14',
    first: 'M6 5v14M18 6l-8 6 8 6V6Z',
    last: 'M18 5v14M6 6l8 6-8 6V6Z',
    prev: 'M15 6l-6 6 6 6',
    next: 'M9 6l6 6-6 6',
    sortDown: 'M12 5v14M6 13l6 6 6-6',
    sortUp: 'M12 19V5M6 11l6-6 6 6',
    retry: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5',
    export: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    import: 'M12 15V4M7 9l5-5 5 5M5 20h14',
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
><path d={PATHS[name]} /></svg>

<style>
  .icon { display: block; flex: none; }
</style>
