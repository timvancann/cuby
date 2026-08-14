<script lang="ts">
  let { size = 84 }: { size?: number } = $props();

  // True perspective projection of a unit cube, camera above-front-right.
  type V3 = [number, number, number];
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: V3, b: V3): V3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (a: V3): V3 => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  };

  const eye: V3 = [3.2, 3.9, 3.2];
  const fwd = norm(sub([0, 0, 0], eye));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const F = 3.4;

  function proj(p: V3): [number, number] {
    const d = sub(p, eye);
    const z = dot(d, fwd);
    return [(dot(d, right) * F) / z, (-dot(d, up) * F) / z];
  }

  // Fit the projected silhouette into the viewBox.
  const silhouette: V3[] = [
    [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1],   // top corners
    [-1, -1, 1], [1, -1, 1], [1, -1, -1],             // visible bottom corners
  ];
  const raw = silhouette.map(proj);
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = 106 / Math.max(maxX - minX, maxY - minY);
  const ox = (120 - (maxX - minX) * s) / 2 - minX * s;
  const oy = (120 - (maxY - minY) * s) / 2 - minY * s;

  function pt(p: V3): string {
    const [x, y] = proj(p);
    return `${(x * s + ox).toFixed(1)},${(y * s + oy).toFixed(1)}`;
  }

  const face = (pts: V3[]) => pts.map(pt).join(' ');

  const topFace = face([[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]);
  const frontFace = face([[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]]);
  const rightFace = face([[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]]);

  // Solved OLL: every top cell yellow.
  const t = (k: number) => -1 + (2 * k) / 3;
  function topCell(i: number, j: number): string {
    const pts2 = [
      proj([t(j), 1, t(i)]),
      proj([t(j + 1), 1, t(i)]),
      proj([t(j + 1), 1, t(i + 1)]),
      proj([t(j), 1, t(i + 1)]),
    ].map(([x, y]) => [x * s + ox, y * s + oy]);
    const cx = (pts2[0][0] + pts2[2][0]) / 2;
    const cy = (pts2[0][1] + pts2[2][1]) / 2;
    return pts2.map(q => `${(cx + (q[0] - cx) * 0.86).toFixed(1)},${(cy + (q[1] - cy) * 0.86).toFixed(1)}`).join(' ');
  }

  // Grid lines on the two visible side faces, at thirds, both directions.
  function seg(a: V3, b: V3): string {
    return `M${pt(a)} L${pt(b)}`;
  }
  const sideGrid = [1, 2]
    .flatMap(k => [
      seg([t(k), 1, 1], [t(k), -1, 1]),   // front verticals
      seg([-1, t(k), 1], [1, t(k), 1]),   // front horizontals
      seg([1, 1, t(k)], [1, -1, t(k)]),   // right verticals
      seg([1, t(k), -1], [1, t(k), 1]),   // right horizontals
    ])
    .join('');
</script>

<svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
  <polygon points={frontFace} fill="#31353f" />
  <polygon points={rightFace} fill="#252932" />
  <path d={sideGrid} stroke="#1a1c21" stroke-width="1.6" fill="none" />
  <polygon points={topFace} fill="#3a3f4a" />
  {#each [0, 1, 2] as i}
    {#each [0, 1, 2] as j}
      <polygon points={topCell(i, j)} fill="var(--accent)" />
    {/each}
  {/each}
</svg>
