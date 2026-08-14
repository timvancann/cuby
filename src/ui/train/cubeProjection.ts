// Perspective projection of a unit cube (camera above-front-right), shared by
// the mode-card art and the app-icon generator.

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

export interface CubeGeometry {
  topFace: string;
  frontFace: string;
  rightFace: string;
  sideGrid: string;
  topCells: string[]; // 9 polygons, row-major
}

// viewSize: the square viewBox edge; fit: pixel size the silhouette is scaled to.
export function cubeGeometry(viewSize: number, fit: number): CubeGeometry {
  const silhouette: V3[] = [
    [-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1],
    [-1, -1, 1], [1, -1, 1], [1, -1, -1],
  ];
  const raw = silhouette.map(proj);
  const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = fit / Math.max(maxX - minX, maxY - minY);
  const ox = (viewSize - (maxX - minX) * s) / 2 - minX * s;
  const oy = (viewSize - (maxY - minY) * s) / 2 - minY * s;

  const pt = (p: V3): string => {
    const [x, y] = proj(p);
    return `${(x * s + ox).toFixed(1)},${(y * s + oy).toFixed(1)}`;
  };
  const face = (pts: V3[]) => pts.map(pt).join(' ');
  const t = (k: number) => -1 + (2 * k) / 3;

  const topCells: string[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const pts2 = [
        proj([t(j), 1, t(i)]),
        proj([t(j + 1), 1, t(i)]),
        proj([t(j + 1), 1, t(i + 1)]),
        proj([t(j), 1, t(i + 1)]),
      ].map(([x, y]) => [x * s + ox, y * s + oy]);
      const cx = (pts2[0][0] + pts2[2][0]) / 2;
      const cy = (pts2[0][1] + pts2[2][1]) / 2;
      topCells.push(
        pts2.map(q => `${(cx + (q[0] - cx) * 0.86).toFixed(1)},${(cy + (q[1] - cy) * 0.86).toFixed(1)}`).join(' '),
      );
    }
  }

  const seg = (a: V3, b: V3) => `M${pt(a)} L${pt(b)}`;
  const sideGrid = [1, 2]
    .flatMap(k => [
      seg([t(k), 1, 1], [t(k), -1, 1]),
      seg([-1, t(k), 1], [1, t(k), 1]),
      seg([1, 1, t(k)], [1, -1, t(k)]),
      seg([1, t(k), -1], [1, t(k), 1]),
    ])
    .join('');

  return {
    topFace: face([[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]),
    frontFace: face([[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1]]),
    rightFace: face([[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1]]),
    sideGrid,
    topCells,
  };
}
