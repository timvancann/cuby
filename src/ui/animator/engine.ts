import type { Move } from '../../core/cube/model';

// ---------- color scheme (yellow-top only) ----------
// face order matches cubie material index: +x, -x, +y, -y, +z, -z
const SCHEME = { px: 0xff8c00, nx: 0xd0021b, py: 0xffd500, ny: 0xf5f5f0, pz: 0x00a651, nz: 0x0051ba };
const PLASTIC = 0x0c0d10;

// ---------- visual move table ----------
// axis: rotation axis; layers: which coordinate slices move; q: quarter turns
// sign convention: q>0 rotates by -90° * q around the axis (clockwise seen from +axis)
export const VISUAL_BASE: Record<string, { axis: 'x' | 'y' | 'z'; layers: number[]; q: number }> = {
  R: { axis: 'x', layers: [1], q: 1 },
  L: { axis: 'x', layers: [-1], q: -1 },
  U: { axis: 'y', layers: [1], q: 1 },
  D: { axis: 'y', layers: [-1], q: -1 },
  F: { axis: 'z', layers: [1], q: 1 },
  B: { axis: 'z', layers: [-1], q: -1 },
  M: { axis: 'x', layers: [0], q: -1 },
  E: { axis: 'y', layers: [0], q: -1 },
  S: { axis: 'z', layers: [0], q: 1 },
  x: { axis: 'x', layers: [-1, 0, 1], q: 1 },
  y: { axis: 'y', layers: [-1, 0, 1], q: 1 },
  z: { axis: 'z', layers: [-1, 0, 1], q: 1 },
  r: { axis: 'x', layers: [0, 1], q: 1 },
  l: { axis: 'x', layers: [-1, 0], q: -1 },
  u: { axis: 'y', layers: [0, 1], q: 1 },
  d: { axis: 'y', layers: [-1, 0], q: -1 },
  f: { axis: 'z', layers: [0, 1], q: 1 },
  b: { axis: 'z', layers: [-1, 0], q: -1 },
};

const DURATION = 320;

interface VisualMove {
  label: string;
  axis: 'x' | 'y' | 'z';
  layers: number[];
  q: number;
}

function toVisualMove(m: Move): VisualMove {
  const base = VISUAL_BASE[m.base];
  if (!base) throw new Error(`Unknown move base "${m.base}"`);
  return { label: m.label, axis: base.axis, layers: base.layers, q: base.q * m.q };
}

export class CubeEngine {
  position = 0;

  private moves: VisualMove[] = [];
  private setupMoves: VisualMove[] = [];
  private playing = false;
  private busy = false;
  private rafId = 0;
  private destroyed = false;
  private resizeObserver: ResizeObserver;

  private constructor(
    private container: HTMLElement,
    private THREE: typeof import('three'),
    private scene: import('three').Scene,
    private camera: import('three').PerspectiveCamera,
    private renderer: import('three').WebGLRenderer,
    private holder: import('three').Group,
    private cubeRoot: import('three').Group,
    private pivot: import('three').Group,
    private cubies: import('three').Mesh[],
  ) {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  static async create(container: HTMLElement): Promise<CubeEngine> {
    const THREE = await import('three');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 11.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 0.35);
    key.position.set(4, 7, 6);
    scene.add(key);

    const holder = new THREE.Group(); // user orbit
    holder.rotation.set(0.42, -0.55, 0);
    scene.add(holder);
    const cubeRoot = new THREE.Group(); // holds cubies
    holder.add(cubeRoot);
    const pivot = new THREE.Group(); // temporary rotation group
    holder.add(pivot);

    const engine = new CubeEngine(container, THREE, scene, camera, renderer, holder, cubeRoot, pivot, []);
    engine.buildCube();
    engine.resize();
    engine.wireDrag();
    engine.rafId = requestAnimationFrame(engine.tick);
    return engine;
  }

  load(moves: Move[], setup: Move[] = []): void {
    this.stopPlay();
    this.setupMoves = setup.map(toVisualMove);
    this.moves = moves.map(toVisualMove);
    this.rebuildTo(0);
    this.position = 0;
  }

  stepForward(onDone?: (moved: boolean) => void): void {
    if (this.destroyed || this.busy || this.position >= this.moves.length) {
      onDone?.(false);
      return;
    }
    this.busy = true;
    this.startMove(this.moves[this.position], false, this.duration(), () => {
      this.position++;
      this.busy = false;
      onDone?.(true);
    });
  }

  stepBack(): void {
    if (this.destroyed || this.busy || this.position <= 0) return;
    this.stopPlay();
    this.busy = true;
    this.startMove(this.moves[this.position - 1], true, this.duration(), () => {
      this.position--;
      this.busy = false;
    });
  }

  jumpTo(i: number): void {
    if (this.destroyed || this.busy) return;
    this.stopPlay();
    this.rebuildTo(i);
    this.position = i;
  }

  private rebuildTo(i: number): void {
    this.buildCube();
    for (const m of this.setupMoves) this.startMove(m, false, 0);
    for (let idx = 0; idx < i; idx++) this.startMove(this.moves[idx], false, 0);
  }

  play(onStep: (i: number) => void, onEnd: () => void): void {
    if (this.destroyed || this.playing) return;
    if (this.position >= this.moves.length) this.jumpTo(0);
    this.playing = true;
    const loop = () => {
      if (this.destroyed || !this.playing) return;
      this.stepForward(moved => {
        if (!moved || this.position >= this.moves.length) {
          this.playing = false;
          onEnd();
          return;
        }
        onStep(this.position);
        setTimeout(loop, 60);
      });
    };
    loop();
  }

  pause(): void {
    this.stopPlay();
  }

  destroy(): void {
    this.destroyed = true;
    this.playing = false;
    this.resizeObserver.disconnect();
    cancelAnimationFrame(this.rafId);
    this.disposeCubies();
    this.geometry?.dispose();
    this.geometry = null;
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private stopPlay(): void {
    this.playing = false;
  }

  private duration(): number {
    return this.reducedMotion() ? 0 : DURATION;
  }

  private reducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private geometry: import('three').BoxGeometry | null = null;

  private disposeCubies(): void {
    for (const c of this.cubies) {
      this.cubeRoot.remove(c);
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      for (const m of mats) m.dispose();
    }
  }

  private buildCube(): void {
    const THREE = this.THREE;
    this.disposeCubies();
    this.cubies = [];
    this.geometry?.dispose();
    const geo = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    this.geometry = geo;
    const faceMat = (color: number | null) =>
      new THREE.MeshLambertMaterial({ color: color === null ? PLASTIC : color });
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const mats = [
            faceMat(x === 1 ? SCHEME.px : null),
            faceMat(x === -1 ? SCHEME.nx : null),
            faceMat(y === 1 ? SCHEME.py : null),
            faceMat(y === -1 ? SCHEME.ny : null),
            faceMat(z === 1 ? SCHEME.pz : null),
            faceMat(z === -1 ? SCHEME.nz : null),
          ];
          const cubie = new THREE.Mesh(geo, mats);
          cubie.position.set(x, y, z);
          this.cubeRoot.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private wireDrag(): void {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', e => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!dragging) return;
      this.holder.rotation.y += (e.clientX - lastX) * 0.008;
      this.holder.rotation.x += (e.clientY - lastY) * 0.008;
      this.holder.rotation.x = Math.max(-1.4, Math.min(1.4, this.holder.rotation.x));
      lastX = e.clientX;
      lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => (dragging = false));
    el.addEventListener('pointercancel', () => (dragging = false));
  }

  private anim: { move: VisualMove; angle: number; start: number; duration: number; onDone?: () => void } | null =
    null;

  private startMove(move: VisualMove, invert: boolean, duration: number, onDone?: () => void): void {
    const angle = -(Math.PI / 2) * move.q * (invert ? -1 : 1);
    const parts = this.cubies.filter(c => move.layers.includes(Math.round(c.position[move.axis])));
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.updateMatrixWorld();
    for (const c of parts) this.pivot.attach(c);
    if (duration <= 0 || this.reducedMotion()) {
      this.pivot.rotation[move.axis] = angle;
      this.bake(onDone);
      return;
    }
    this.anim = { move, angle, start: performance.now(), duration, onDone };
  }

  private bake(onDone?: () => void): void {
    this.pivot.updateMatrixWorld();
    const parts = [...this.pivot.children];
    for (const c of parts) {
      this.cubeRoot.attach(c);
      c.position.set(Math.round(c.position.x), Math.round(c.position.y), Math.round(c.position.z));
      this.snapQuaternion(c);
    }
    this.pivot.rotation.set(0, 0, 0);
    this.anim = null;
    onDone?.();
  }

  private snapQuaternion(obj: import('three').Object3D): void {
    const m = new this.THREE.Matrix4().makeRotationFromQuaternion(obj.quaternion);
    const e = m.elements;
    for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
    obj.quaternion.setFromRotationMatrix(m);
  }

  private easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private tick = (now: number): void => {
    if (this.destroyed) return;
    if (this.anim) {
      const t = Math.min(1, (now - this.anim.start) / this.anim.duration);
      this.pivot.rotation[this.anim.move.axis] = this.anim.angle * this.easeInOut(t);
      if (t >= 1) this.bake(this.anim.onDone);
    }
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
