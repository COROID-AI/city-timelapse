import * as THREE from 'three';
import type { EraId } from './eras/types';
import { ERAS } from './eras/data';
import { mulberry32, randRange } from './utils/rng';
import { makeBuilding, makeVehicle, makePedestrian } from './assetBuilder';
import type { BuiltBuilding } from './assetBuilder/eras';

/** Building lot archetype keyed by position in the grid. */
type LotType = 'residential' | 'commercial' | 'office' | 'lot';

export interface BuildingHit {
  object: THREE.Object3D;
  focusPoint: THREE.Vector3;
  storefrontName: string;
}

/**
 * A full city block for one era. Generates a deterministic layout of buildings
 * around a perimeter, with vehicles looping the roads and pedestrians walking
 * the sidewalks. Everything is era-themed via the asset builders.
 */
export class CityBlock {
  readonly group = new THREE.Group();

  private buildings: BuiltBuilding[] = [];
  private vehicles: MovingVehicle[] = [];
  private pedestrians: MovingPedestrian[] = [];
  private colliders: THREE.Object3D[] = [];

  /** Ground + sidewalk meshes (rebuilt per era for tint differences). */
  private ground: THREE.Mesh | null = null;
  private sidewalks: THREE.Group = new THREE.Group();

  private readonly halfBlock = 30; // road runs at +/- halfBlock

  /** All geometry/material resources created for the current era, for disposal. */
  private disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

  constructor() {
    this.group.name = 'city-block';
    this.group.add(this.sidewalks);
  }

  /** Build (or rebuild) the entire block for the given era. */
  build(era: EraId): void {
    this.dispose();
    const desc = ERAS[era];
    const rng = mulberry32(desc.seed);

    this.buildGround(desc);
    this.buildBuildings(era, rng);
    this.buildVehicles(era, rng);
    this.buildPedestrians(era, rng);
  }

  private buildGround(desc: (typeof ERAS)[EraId]): void {
    // Asphalt road surface
    const roadGeo = new THREE.PlaneGeometry(120, 120);
    const roadMat = new THREE.MeshStandardMaterial({
      color: desc.groundColor,
      roughness: 0.95,
      metalness: 0.0,
    });
    this.ground = new THREE.Mesh(roadGeo, roadMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.disposables.push(roadGeo, roadMat);
    this.group.add(this.ground);

    // Sidewalk ring around the central block.
    const swMat = new THREE.MeshStandardMaterial({
      color: desc.sidewalkColor,
      roughness: 0.9,
    });
    this.disposables.push(swMat);
    const swH = 0.3;
    const inner = this.halfBlock - 6;
    const outer = this.halfBlock;
    const bands: Array<[number, number, number, number]> = [
      // [x, z, width, depth]
      [0, (inner + outer) / 2, inner * 2, outer - inner],
      [0, -(inner + outer) / 2, inner * 2, outer - inner],
      [(inner + outer) / 2, 0, outer - inner, inner * 2],
      [-(inner + outer) / 2, 0, outer - inner, inner * 2],
    ];
    for (const [x, z, w, d] of bands) {
      const g = new THREE.BoxGeometry(w, swH, d);
      const m = new THREE.Mesh(g, swMat);
      m.position.set(x, swH / 2, z);
      m.receiveShadow = true;
      this.disposables.push(g);
      this.sidewalks.add(m);
    }
  }

  private buildBuildings(era: EraId, rng: () => number): void {
    const desc = ERAS[era];
    const storefronts = desc.storefronts;
    // Grid of lots around the block interior.
    const lots: Array<{ x: number; z: number; type: LotType }> = [
      { x: -18, z: -18, type: 'office' },
      { x: 0, z: -18, type: 'commercial' },
      { x: 18, z: -18, type: 'office' },
      { x: -18, z: 0, type: 'residential' },
      { x: 18, z: 0, type: 'commercial' },
      { x: -18, z: 18, type: 'office' },
      { x: 0, z: 18, type: 'commercial' },
      { x: 18, z: 18, type: 'residential' },
    ];

    let storefrontIdx = 0;
    for (const lot of lots) {
      // Always produce a building (fallback to 'lot' variant) so no pop-in gaps.
      const type: LotType = rng() < 0.12 ? 'lot' : lot.type;
      const name =
        storefronts[storefrontIdx % storefronts.length]?.name ?? `${desc.label} Shop`;
      storefrontIdx++;
      const built = makeBuilding(era, type, name);
      // Orient the building so its front (+Z) faces the nearest road.
      built.group.position.set(lot.x, 0, lot.z);
      const yaw = nearestRoadYaw(lot.x, lot.z);
      built.group.rotation.y = yaw;
      // Recompute focus point in world space after placement.
      const worldFocus = built.focusPoint.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      worldFocus.add(built.group.position);
      built.focusPoint.copy(worldFocus);

      this.group.add(built.group);
      this.buildings.push(built);
      this.colliders.push(built.group);
    }
  }

  private buildVehicles(era: EraId, rng: () => number): void {
    const desc = ERAS[era];
    const variants = desc.vehicles;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const variant = variants[Math.floor(rng() * variants.length)] ?? 'car';
      const mesh = makeVehicle(era, variant, i);
      const lane = i % 2 === 0 ? 1 : -1; // two directions
      const roadOffset = lane * 3.2;
      const horizontal = i % 4 < 2; // alternate X vs Z road
      mesh.position.set(
        horizontal ? randRange(rng, -this.halfBlock, this.halfBlock) : roadOffset,
        0,
        horizontal ? roadOffset : randRange(rng, -this.halfBlock, this.halfBlock),
      );
      mesh.rotation.y = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : lane > 0 ? 0 : Math.PI;
      this.group.add(mesh);
      this.vehicles.push({
        mesh,
        axis: horizontal ? 'x' : 'z',
        dir: lane,
        speed: randRange(rng, 6, 12),
        spin: mesh.getObjectByName('wheels') ?? null,
      });
    }
  }

  private buildPedestrians(era: EraId, rng: () => number): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const mesh = makePedestrian(era, i);
      const side = i % 2 === 0 ? 1 : -1;
      const inner = this.halfBlock - 5;
      const onX = i % 4 < 2;
      mesh.position.set(
        onX ? randRange(rng, -inner, inner) : side * inner,
        0.3,
        onX ? side * inner : randRange(rng, -inner, inner),
      );
      mesh.rotation.y = rng() * Math.PI * 2;
      this.group.add(mesh);
      this.pedestrians.push({
        mesh,
        speed: randRange(rng, 1.0, 1.8),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  /** Advance vehicles + pedestrians by `dt` seconds. */
  update(dt: number, elapsed: number): void {
    const bound = this.halfBlock + 6;
    for (const v of this.vehicles) {
      const pos = v.axis === 'x' ? 'x' : 'z';
      const delta = v.dir * v.speed * dt;
      v.mesh.position[pos] += delta;
      // Loop around the block.
      if (v.mesh.position[pos] > bound) v.mesh.position[pos] = -bound;
      if (v.mesh.position[pos] < -bound) v.mesh.position[pos] = bound;
      // Spin wheels.
      if (v.spin) v.spin.children.forEach((w) => (w.rotation.x += delta * 0.6));
    }

    for (const p of this.pedestrians) {
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.mesh.rotation);
      p.mesh.position.addScaledVector(forward, p.speed * dt);
      // Keep within sidewalk ring; bounce off bounds.
      const inner = this.halfBlock - 4;
      if (Math.abs(p.mesh.position.x) > inner || Math.abs(p.mesh.position.z) > inner) {
        p.mesh.rotation.y += Math.PI * 0.5 + Math.random() * 0.5;
        p.mesh.position.x = THREE.MathUtils.clamp(p.mesh.position.x, -inner, inner);
        p.mesh.position.z = THREE.MathUtils.clamp(p.mesh.position.z, -inner, inner);
      }
      // Leg swing walk animation.
      const swing = Math.sin(elapsed * 6 + p.phase) * 0.35;
      const legL = p.mesh.getObjectByName('leg_L');
      const legR = p.mesh.getObjectByName('leg_R');
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      const armL = p.mesh.getObjectByName('arm_L');
      const armR = p.mesh.getObjectByName('arm_R');
      if (armL) armL.rotation.x = -swing * 0.6;
      if (armR) armR.rotation.x = swing * 0.6;
    }
  }

  /** Pause + reset all movers (called on era swap so nothing carries over). */
  pauseAndReset(): void {
    this.vehicles.forEach((v) => {
      if (v.spin) v.spin.children.forEach((w) => (w.rotation.x = 0));
    });
  }

  /** Raycast against building groups; returns the nearest hit info. */
  hitBuildings(raycaster: THREE.Raycaster): BuildingHit | null {
    const hits = raycaster.intersectObjects(this.colliders, true);
    if (hits.length === 0) return null;
    const hit = hits[0];
    // Walk up to the building group root.
    let root: THREE.Object3D | null = hit.object;
    while (root && !this.buildings.some((b) => b.group === root)) {
      root = root.parent;
    }
    const found = this.buildings.find((b) => b.group === root);
    if (!found) return null;
    return {
      object: found.group,
      focusPoint: found.focusPoint,
      storefrontName: found.storefrontName,
    };
  }

  /** Dispose all era-specific geometry/materials. */
  dispose(): void {
    for (const b of this.buildings) this.removeDeep(b.group);
    for (const v of this.vehicles) this.removeDeep(v.mesh);
    for (const p of this.pedestrians) this.removeDeep(p.mesh);
    if (this.ground) this.removeDeep(this.ground);
    while (this.sidewalks.children.length) this.removeDeep(this.sidewalks.children[0]);

    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.buildings = [];
    this.vehicles = [];
    this.pedestrians = [];
    this.colliders = [];
    this.ground = null;
  }

  /** Remove an object from its parent and dispose its geometry/materials. */
  private removeDeep(obj: THREE.Object3D): void {
    obj.removeFromParent();
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
}

interface MovingVehicle {
  mesh: THREE.Group;
  axis: 'x' | 'z';
  dir: number;
  speed: number;
  spin: THREE.Object3D | null;
}

interface MovingPedestrian {
  mesh: THREE.Group;
  speed: number;
  phase: number;
}

/** Rotate building so its storefront faces the nearest road edge. */
function nearestRoadYaw(x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (az >= ax) {
    // closer to top/bottom road -> face +Z or -Z
    return z >= 0 ? 0 : Math.PI;
  }
  return x >= 0 ? -Math.PI / 2 : Math.PI / 2;
}
