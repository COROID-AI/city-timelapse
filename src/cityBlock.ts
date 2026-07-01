import * as THREE from 'three';
import { Era, YEARS } from './eras/types';
import { getEra } from './eras/data';
import { buildEraScene, BuiltEra } from './assetBuilder';
import { makeGroundTexture } from './assetBuilder/textures';

/** Manages all 5 pre-built era scenes and the cross-fade between them. */
export class CityBlock {
  private root: THREE.Object3D;
  private eras: Map<Era, BuiltEra> = new Map();
  private currentEra: Era = 1945;
  private transition: { from: Era | null; to: Era; t: number; duration: number } = {
    from: null,
    to: 1945,
    t: 1,
    duration: 1.6,
  };
  private ground: THREE.Mesh;
  private groundTex: THREE.CanvasTexture;
  private disposables: { dispose: () => void }[] = [];

  constructor(root: THREE.Object3D) {
    this.root = root;

    // Ground plane sized to the block (+ surrounding road).
    const groundSize = 120;
    this.groundTex = makeGroundTexture('#3a3a3a');
    this.groundTex.repeat.set(8, 8);
    const groundMat = new THREE.MeshStandardMaterial({
      map: this.groundTex,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.disposables.push(this.groundTex, groundMat);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.root.add(this.ground);

    // Pre-build all 5 era scenes once at startup.
    YEARS.forEach((year) => {
      const built = buildEraScene(year);
      // start hidden except the initial era (1945)
      built.group.visible = year === 1945;
      built.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            m.transparent = true;
          });
        }
      });
      this.eras.set(year, built);
      this.root.add(built.group);
    });
  }

  public get era(): Era {
    return this.currentEra;
  }

  /** Begin a cross-fade to the target era. */
  public setEra(year: Era): void {
    if (year === this.currentEra && this.transition.t >= 1) return;
    this.transition.from = this.currentEra;
    this.transition.to = year;
    this.transition.t = 0;
    this.currentEra = year;
    const target = this.eras.get(year);
    if (target) target.group.visible = true;
  }

  /** Advance transition + animate vehicles/pedestrians. Call each frame. */
  public update(dt: number, elapsed: number): void {
    // transition
    if (this.transition.t < 1) {
      this.transition.t = Math.min(1, this.transition.t + dt / this.transition.duration);
      const t = this.transition.t;
      const from = this.transition.from ? this.eras.get(this.transition.from) : null;
      const to = this.eras.get(this.transition.to);
      if (to) this.setGroupOpacity(to.group, t);
      if (from) this.setGroupOpacity(from.group, 1 - t);
      if (t >= 1) {
        if (from) from.group.visible = false;
      }
    }

    // animate all visible eras' vehicles + pedestrians (only current matters for perf)
    const cur = this.eras.get(this.currentEra);
    if (cur) {
      cur.vehicles.forEach((v) => {
        const g = v.group;
        const speed = (g.userData.speed as number) ?? 6;
        const dir = (g.userData.dir as number) ?? 1;
        const axis = (g.userData.axis as string) ?? 'x';
        if (axis === 'x') g.position.x += dir * speed * dt;
        else g.position.z += dir * speed * dt;
        // wrap around block
        const limit = 40;
        if (axis === 'x') {
          if (g.position.x > limit) g.position.x = -limit;
          if (g.position.x < -limit) g.position.x = limit;
        } else {
          if (g.position.z > limit) g.position.z = -limit;
          if (g.position.z < -limit) g.position.z = limit;
        }
        // roll wheels
        const wheels = g.getObjectByName('wheels');
        if (wheels) {
          wheels.children.forEach((w) => {
            w.rotation.x += dir * speed * dt * 1.2;
          });
        }
      });
      cur.pedestrians.forEach((p) => p.animate(dt));
      cur.spinners.forEach((s) => {
        s.rotation.y += dt * 0.8;
        const ring = s.children[0];
        if (ring) ring.rotation.z = elapsed * 0.5;
      });
    }
  }

  private setGroupOpacity(group: THREE.Object3D, opacity: number): void {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          const mm = m as THREE.Material & { opacity: number };
          mm.opacity = opacity;
        });
      }
    });
  }

  public dispose(): void {
    this.eras.forEach((b) => b.dispose());
    this.disposables.forEach((d) => d.dispose());
    this.ground.geometry.dispose();
  }
}

export function getEraPalette(year: Era) {
  return getEra(year).palette;
}
