<script lang="ts">
  let { size = 84 }: { size?: number } = $props();

  // Isometric cube: top face is a rhombus T-R-B-L, sides drop by H.
  const T = [60, 16], R = [104, 38], B = [60, 60], L = [16, 38];
  const u = [(R[0] - T[0]) / 3, (R[1] - T[1]) / 3]; // one cell along T->R
  const v = [(L[0] - T[0]) / 3, (L[1] - T[1]) / 3]; // one cell along T->L
  const H = 52;

  // Solved OLL: the whole top layer yellow.
  const PATTERN = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
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

  // Vertical thirds on the side faces so they read as a cube grid.
  function sideLine(a: number[], b: number[], k: number): string {
    const x = a[0] + ((b[0] - a[0]) * k) / 3;
    const y = a[1] + ((b[1] - a[1]) * k) / 3;
    return `M${x},${y} v${H}`;
  }
</script>

<svg viewBox="0 0 120 116" width={size} height={size * 116 / 120} aria-hidden="true">
  <polygon points={leftFace} fill="#31353f" />
  <polygon points={rightFace} fill="#252932" />
  <polygon points={topFace} fill="#3a3f4a" />
  <path d={sideLine(L, B, 1) + sideLine(L, B, 2) + sideLine(B, R, 1) + sideLine(B, R, 2)}
    stroke="#1a1c21" stroke-width="1.6" fill="none" />
  <path d={`M${L[0]},${L[1] + H / 3 + 4} L${B[0]},${B[1] + H / 3 + 4} L${R[0]},${R[1] + H / 3 + 4}
            M${L[0]},${L[1] + (2 * H) / 3 + 2} L${B[0]},${B[1] + (2 * H) / 3 + 2} L${R[0]},${R[1] + (2 * H) / 3 + 2}`}
    stroke="#1a1c21" stroke-width="1.6" fill="none" />
  {#each PATTERN as row, i}
    {#each row as on, j}
      <polygon points={cellPoints(i, j)} fill={on ? 'var(--accent)' : '#101114'} />
    {/each}
  {/each}
</svg>
