import * as THREE from 'three';
import { ERAS, ERA_COUNT } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { hash, hashRange } from '../core/mathUtils';

// Per-era vehicle fleets built once; each is a Group of meshes positioned
// along the road. Vehicles drive in both directions; fleets crossfade opacity
// by era weight — never rebuilt on slider input.

interface Lane { z: number; dir: number; }
const LANES: Lane[] = [
  { z: -1.4, dir: 1 },
  { z: 1.4, dir: -1 },
  { z: -3.0, dir: 1 },
  { z: 3.0, dir: -1 },
];
const ROAD_SPAN = 60;

export class Vehicles {
  private scene: THREE.Scene;
  private fleets: THREE.Group[] = [];
  private fleetMats: THREE.MeshStandardMaterial[][] = [];
  private fleetGlowMats: THREE.MeshStandardMaterial[][] = [];
  private runtime: { pos: Float32Array; dir: Float32Array; speed: Float32Array; lane: Int8Array; floatY: Float32Array } | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    let total = 0;
    for (let e = 0; e < ERA_COUNT; e++) total += ERAS[e].vehicles.count;
    this.runtime = {
      pos: new Float32Array(total),
      dir: new Float32Array(total),
      speed: new Float32Array(total),
      lane: new Int8Array(total),
      floatY: new Float32Array(total),
    };
    let gi = 0;
    for (let e = 0; e < ERA_COUNT; e++) {
      const group = new THREE.Group();
      const mats: THREE.MeshStandardMaterial[] = [];
      const glows: THREE.MeshStandardMaterial[] = [];
      const era = ERAS[e];
      for (let i = 0; i < era.vehicles.count; i++) {
        const laneIdx = i % LANES.length;
        const lane = LANES[laneIdx];
        const bodyColor = era.vehicles.body[i % era.vehicles.body.length];
        const { body, mat, glowMat } = this.makeVehicle(era.vehicles.type, bodyColor, era.vehicles.glow);
        const x = hashRange(i * 53 + e * 17, -ROAD_SPAN / 2, ROAD_SPAN / 2);
        body.position.set(x, this.vehicleBaseY(e), lane.z);
        body.rotation.y = lane.dir > 0 ? 0 : Math.PI;
        group.add(body);
        mats.push(mat);
        glows.push(glowMat);
        if (this.runtime) {
          this.runtime.pos[gi] = x;
          this.runtime.dir[gi] = lane.dir;
          this.runtime.speed[gi] = era.vehicles.speed * (0.85 + hash(i * 29 + e * 3) * 0.3);
          this.runtime.lane[gi] = laneIdx;
          this.runtime.floatY[gi] = era.vehicles.type === 'hover' || era.vehicles.type === 'pod' ? 1.4 : 0;
        }
        gi++;
      }
      group.visible = e === 0;
      scene.add(group);
      this.fleets.push(group);
      this.fleetMats.push(mats);
      this.fleetGlowMats.push(glows);
    }
  }

  private vehicleBaseY(e: number): number {
    const t = ERAS[e].vehicles.type;
    return t === 'hover' || t === 'pod' ? 1.4 : 0;
  }

  private makeVehicle(
    type: string, color: number, glow: number,
  ): { body: THREE.Group; mat: THREE.MeshStandardMaterial; glowMat: THREE.MeshStandardMaterial } {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.45, metalness: 0.55,
      transparent: true, opacity: 1,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: glow,
      transparent: true, opacity: 1, depthWrite: false,
    });

    if (type === 'retro') {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.0), bodyMat);
      chassis.position.y = 0.55;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), bodyMat);
      cabin.position.set(-0.1, 1.15, 0);
      group.add(chassis, cabin);
      this.addWheels(group, 2.0, 0.3);
      this.addLights(group, glow, 0xffffff, 1.15);
    } else if (type === 'classic') {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.05), bodyMat);
      chassis.position.y = 0.5;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.95), bodyMat);
      cabin.position.set(-0.2, 1.0, 0);
      group.add(chassis, cabin);
      this.addWheels(group, 2.4, 0.3);
      this.addLights(group, glow, 0xfff0c0, 1.0);
    } else if (type === 'boxy') {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.1), bodyMat);
      chassis.position.y = 0.55;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 1.0), bodyMat);
      cabin.position.set(0, 1.2, 0);
      group.add(chassis, cabin);
      this.addWheels(group, 2.2, 0.32);
      this.addLights(group, glow, 0xff60a0, 1.15);
    } else if (type === 'modern' || type === 'electric') {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.65, 1.15), bodyMat);
      chassis.position.y = 0.5;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 1.0), bodyMat);
      cabin.position.set(-0.1, 1.0, 0);
      group.add(chassis, cabin);
      this.addWheels(group, 2.5, 0.3);
      this.addLights(group, glow, type === 'electric' ? 0xf0f4ff : 0xfff0d0, 1.0);
    } else {
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.2), bodyMat);
      chassis.position.y = 1.4;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.0), bodyMat);
      cabin.position.set(0, 1.8, 0);
      const under = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.0), glowMat);
      under.position.y = 1.1;
      group.add(chassis, cabin, under);
      this.addLights(group, glow * 0.5, type === 'pod' ? 0x40e0ff : 0x40ffd0, 1.8);
    }
    return { body: group, mat: bodyMat, glowMat };
  }

  private addWheels(group: THREE.Group, wheelBase: number, radius: number): void {
    const geo = new THREE.CylinderGeometry(radius, radius, 0.25, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const positions: [number, number][] = [
      [wheelBase * 0.5, 0.5], [-wheelBase * 0.5, 0.5],
      [wheelBase * 0.5, -0.5], [-wheelBase * 0.5, -0.5],
    ];
    for (const [x, z] of positions) {
      const w = new THREE.Mesh(geo, mat);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, radius, z);
      group.add(w);
    }
  }

  private addLights(group: THREE.Group, intensity: number, color: number, y: number): void {
    if (intensity <= 0.1) return;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: color, emissiveIntensity: intensity,
      transparent: true, opacity: 1, depthWrite: false,
    });
    const geo = new THREE.BoxGeometry(0.1, 0.15, 0.2);
    const front = new THREE.Mesh(geo, mat);
    front.position.set(1.35, y, 0.35);
    const front2 = new THREE.Mesh(geo, mat);
    front2.position.set(1.35, y, -0.35);
    group.add(front, front2);
  }

  update(weights: EraWeights, dt: number, time: number): void {
    if (!this.runtime) return;
    let gi = 0;
    for (let e = 0; e < ERA_COUNT; e++) {
      const w = weights[e];
      const visible = w > 0.003;
      const fleet = this.fleets[e];
      fleet.visible = visible;
      for (const mat of this.fleetMats[e]) mat.opacity = w;
      for (const mat of this.fleetGlowMats[e]) mat.opacity = w;

      const count = ERAS[e].vehicles.count;
      for (let i = 0; i < count; i++) {
        const lane = LANES[this.runtime.lane[gi]];
        this.runtime.pos[gi] += this.runtime.dir[gi] * this.runtime.speed[gi] * dt;
        if (this.runtime.dir[gi] > 0 && this.runtime.pos[gi] > ROAD_SPAN / 2) {
          this.runtime.pos[gi] = -ROAD_SPAN / 2;
        } else if (this.runtime.dir[gi] < 0 && this.runtime.pos[gi] < -ROAD_SPAN / 2) {
          this.runtime.pos[gi] = ROAD_SPAN / 2;
        }
        const child = fleet.children[i] as THREE.Group | undefined;
        if (child) {
          const fy = this.runtime.floatY[gi];
          child.position.x = this.runtime.pos[gi];
          child.position.y = fy > 0 ? fy + Math.sin(time * 2 + gi) * 0.15 : 0;
          child.position.z = lane.z;
        }
        gi++;
      }
    }
  }

  dispose(): void {
    for (const fleet of this.fleets) {
      this.scene.remove(fleet);
      fleet.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    for (const mats of this.fleetMats) for (const m of mats) m.dispose();
    for (const mats of this.fleetGlowMats) for (const m of mats) m.dispose();
    this.fleets = []; this.fleetMats = []; this.fleetGlowMats = [];
  }
}

void hash;
