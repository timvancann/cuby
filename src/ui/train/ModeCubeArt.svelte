<script lang="ts">
  let { ghost = false, size = 84 }: { ghost?: boolean; size?: number } = $props();

  // Isometric cube: top face is a rhombus T-R-B-L, sides drop by H.
  const T = [60, 16], R = [104, 38], B = [60, 60], L = [16, 38];
  const u = [(R[0] - T[0]) / 3, (R[1] - T[1]) / 3]; // one cell along T->R
  const v = [(L[0] - T[0]) / 3, (L[1] - T[1]) / 3]; // one cell along T->L
  const H = 38;

  // The top pattern is a real case: Sune (#27), row 0 at the back.
  const PATTERN = [
    [0, 1, 0],
    [1, 1, 1],
    [1, 1, 0],
  ];

  function cellPoints(i: number, j: number): string {
    const p = [T[0] + v[0] * i + u[0] * j, T[1] + v[1] * i + u[1] * j];
    const pts = [
      p,
      [p[0] + u[0], p[1] + u[1]],
      [p[0] + u[0] + v[0], p[1] + u[1] + v[1]],
      [p[0] + v[0], p[1] + v[1]],
    ];
    const cx = (pts[0][0] + pts[2][0]) / 2;
    const cy = (pts[0][1] + pts[2][1]) / 2;
    return pts.map(q => `${(cx + (q[0] - cx) * 0.86).toFixed(1)},${(cy + (q[1] - cy) * 0.86).toFixed(1)}`).join(' ');
  }

  const rightFace = `${B[0]},${B[1]} ${R[0]},${R[1]} ${R[0]},${R[1] + H} ${B[0]},${B[1] + H}`;
  const leftFace = `${L[0]},${L[1]} ${B[0]},${B[1]} ${B[0]},${B[1] + H} ${L[0]},${L[1] + H}`;
  const topFace = `${T[0]},${T[1]} ${R[0]},${R[1]} ${B[0]},${B[1]} ${L[0]},${L[1]}`;
</script>

<svg viewBox="0 0 120 104" width={size} height={size * 104 / 120} aria-hidden="true">
  {#if ghost}
    <polygon points={leftFace} fill="none" stroke="var(--line)" stroke-width="1.5" />
    <polygon points={rightFace} fill="none" stroke="var(--line)" stroke-width="1.5" />
    <polygon points={topFace} fill="none" stroke="var(--line)" stroke-width="1.5" />
  {:else}
    <polygon points={leftFace} fill="#1c1e24" />
    <polygon points={rightFace} fill="#15171c" />
    <polygon points={topFace} fill="var(--panel-2)" />
  {/if}
  {#each PATTERN as row, i}
    {#each row as on, j}
      <polygon
        points={cellPoints(i, j)}
        fill={on ? 'var(--accent)' : ghost ? 'none' : '#101114'}
        stroke={on ? 'none' : 'var(--line)'}
        stroke-width={ghost ? 1 : 0.6}
      />
    {/each}
  {/each}
</svg>
