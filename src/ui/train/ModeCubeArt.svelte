<script lang="ts">
  import { cubeGeometry } from './cubeProjection';

  let { size = 84 }: { size?: number } = $props();

  const g = cubeGeometry(120, 106);
</script>

<svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
  <polygon points={g.frontFace} fill="#31353f" />
  <polygon points={g.rightFace} fill="#252932" />
  <path d={g.sideGrid} stroke="#1a1c21" stroke-width="1.6" fill="none" />
  <polygon points={g.topFace} fill="#3a3f4a" />
  {#each g.topCells as cell}
    <polygon points={cell} fill="var(--accent)" />
  {/each}
</svg>
