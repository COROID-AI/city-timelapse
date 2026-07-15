import * as THREE from 'three';
import type { EraConfig } from '../types';
import { toColor } from '../three-helpers';
import { hash } from '../math';

interface Vehicle {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial;
  flying: boolean;
  lane: number; // 0..3
  speed: number;
  offset: number; // phase along the lane
  axis: 'x' | 'z'; // which road axis
  dir: 1 | -1;
}

/**
 * Vehicles travel along the two perpendicular roads. In 2055 a large share
 * become flying cars that cruise in elevated air lanes instead. Vehicle body
 * style (boxiness, fins) and palette shift with the era.
 */
export class Vehicles {
  group = new THREE.Group();
  private vehicles: Vehicle[] = [];
  private maxGround = 16;
  private maxFlying = 10;

  constructor() {
    const roadHalf = 7;
    const laneOffsets = [-4.5, -1.5, 1.5, 4.5];

    // Ground vehicles: two axes, multiple lanes
    let id = 0;
    for (const axis of ['x', 'z'] as const) {
      for (let li = 0; li < laneOffsets.length; li++) {
        const count = 4;
        for (let k = 0; k < count; k++) {
          const dir: 1 | -1 = li < 2 ? 1 : -1;
          const v = this.makeVehicle(id++, false, li, axis, dir);
          v.offset = (k / count) * 84;
          const cross = laneOffsets[li];
          if (axis === 'x') v.group.position.set(0, 0, cross * (dir > 0 ? 1 : 1));
          else v.group.position.set(cross, 0, 0);
          this.vehicles.push(v);
        }
      }
    }
    void roadHalf;

    // Flying vehicles (air lanes at y≈10..16)
    for (let li = 0; li < 4; li++) {
      for (let k = 0; k < 3; k++) {
        const axis = li % 2 === 0 ? 'x' : 'z';
        const dir: 1 | -1 = li < 2 ? 1 : -1;
        const v = this.makeVehicle(id++, true, li, axis, dir);
        v.offset = (k / 3) * 84;
        v.group.position.y = 10 + li * 2.2;
        this.vehicles.push(v);
      }
    }
  }

  private makeVehicle(
    id: number,
    flying: boolean,
    lane: number,
    axis: 'x' | 'z',
    dir: 1 | -1,
  ): Vehicle {
    const g = new THREE.Group();
    const seed = id * 9.7 + 3.1;
    const hue = hash(seed);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.6, 0.45),
      roughness: 0.35,
      metalness: 0.6,
    });

    // Body shape varies: older eras rounder/longer, newer sleeker.
    const bodyGeo = new THREE.BoxGeometry(2.0, 0.7, 1.0);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    g.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.0, 0.5, 0.85);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x222233,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-0.1, 0.55, 0);
    g.add(cabin);

    // Underglow / thruster glow (strong in 2055)
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.4;
    g.add(glow);

    // Wheels for ground vehicles
    if (!flying) {
      const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const wheelPositions: [number, number, number][] = [
        [-0.7, -0.35, 0.5],
        [0.7, -0.35, 0.5],
        [-0.7, -0.35, -0.5],
        [0.7, -0.35, -0.5],
      ];
      for (const p of wheelPositions) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(...p);
        g.add(w);
      }
    } else {
      // Thruster nacelles for flying cars
      const nacGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10);
      const nacMat = new THREE.MeshStandardMaterial({ color: 0x333344, metalness: 0.8, roughness: 0.3 });
      for (const p of [[-0.8, -0.3, 0], [0.8, -0.3, 0]] as [number, number, number][]) {
        const n = new THREE.Mesh(nacGeo, nacMat);
        n.position.set(...p);
        g.add(n);
      }
    }

    this.group.add(g);
    return {
      group: g,
      bodyMat,
      glowMat,
      flying,
      lane,
      speed: 0,
      offset: 0,
      axis,
      dir,
    };

  }

  update(cfg: EraConfig, dt: number, time: number): void {
    const groundShare = cfg.groundVehicleAmount;
    const flyShare = cfg.flyingCarAmount;
    const palette = cfg.vehiclePalette;

    // Number of active ground vs flying vehicles scales with config.
    const activeGround = Math.round(this.maxGround * cfg.vehicleDensity * groundShare);
    const activeFlying = Math.round(this.maxFlying * cfg.vehicleDensity * flyShare);

    let groundIdx = 0;
    let flyIdx = 0;
    const range = 42; // travel distance before wrap

    for (const v of this.vehicles) {
      const isActive = v.flying ? flyIdx < activeFlying : groundIdx < activeGround;
      if (v.flying) flyIdx++;
      else groundIdx++;

      // Crossfade visibility via scale + opacity
      const targetVis = isActive ? 1 : 0;
      const curVis = v.group.scale.x;
      const vis = THREE.MathUtils.lerp(curVis, targetVis, 0.06);
      v.group.scale.setScalar(vis < 0.02 ? 0 : vis);
      v.group.visible = vis > 0.01;

      if (!v.group.visible) continue;

      // Speed varies subtly by era (faster in future)
      const baseSpeed = 6 + cfg.flyingCarAmount * 4;
      v.offset = (v.offset + baseSpeed * dt * v.dir + range) % range;

      // Position along axis
      const pos = -range / 2 + v.offset;
      const laneOffsets = [-4.5, -1.5, 1.5, 4.5];
      const cross = laneOffsets[v.lane % 4];
      if (v.axis === 'x') {
        v.group.position.x = pos;
        if (!v.flying) v.group.position.z = cross;
        else v.group.position.z = cross * 0.6;
        v.group.rotation.y = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        v.group.position.z = pos;
        if (!v.flying) v.group.position.x = cross;
        else v.group.position.x = cross * 0.6;
        v.group.rotation.y = v.dir > 0 ? 0 : Math.PI;
      }

      // Flying cars bob and trail glow
      if (v.flying) {
        v.group.position.y = (10 + v.lane * 2.2) + Math.sin(time * 1.5 + v.offset) * 0.4;
        v.glowMat.opacity = 0.5 + 0.3 * Math.sin(time * 4 + v.offset);
      } else {
        v.group.position.y = 0;
        v.glowMat.opacity = 0;
      }

      // Palette colour from era config
      const c = palette[v.lane % palette.length] ?? palette[0];
      v.bodyMat.color.copy(toColor(c));
      v.glowMat.color.setHSL((time * 0.05 + v.lane * 0.25) % 1, 1, 0.6);
    }
  }

  dispose(): void {
    for (const v of this.vehicles) {
      v.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else m.dispose();
        }
      });
      v.bodyMat.dispose();
      v.glowMat.dispose();
    }
  }
}
