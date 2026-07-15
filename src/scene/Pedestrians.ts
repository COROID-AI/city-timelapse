import * as THREE from 'three';
import type { EraConfig } from '../types';
import { toColor } from '../three-helpers';
import { hash } from '../math';

interface Ped {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  /** lane: which sidewalk ring segment */
  side: number;
  offset: number;
  dir: 1 | -1;
  speed: number;
  isRobot: boolean;
  robotMat?: THREE.MeshStandardMaterial;
  eyeMat?: THREE.MeshBasicMaterial;
}

/**
 * Pedestrians walk along the sidewalk grid. Their count (density), outfit
 * palette, and a share of robots (2055) respond to the era config. Robots
 * crossfade in via smoothstep opacity.
 */
export class Pedestrians {
  group = new THREE.Group();
  private peds: Ped[] = [];
  private maxPeds = 48;

  constructor() {
    const roadHalf = 7;
    const swY = roadHalf + 2.0;

    // Four sidewalk lines (top, bottom, left, right)
    const lines = [
      { axis: 'x' as const, cross: swY, dir: 1 as const },
      { axis: 'x' as const, cross: -swY, dir: -1 as const },
      { axis: 'z' as const, cross: swY, dir: 1 as const },
      { axis: 'z' as const, cross: -swY, dir: -1 as const },
    ];

    let id = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const count = this.maxPeds / lines.length;
      for (let k = 0; k < count; k++) {
        const isRobot = false; // determined dynamically in update
        const ped = this.makePed(id++, li, line.axis, line.dir, isRobot);
        ped.offset = (k / count) * 84 + hash(id) * 4;
        this.peds.push(ped);
      }
    }
  }

  private makePed(
    id: number,
    side: number,
    axis: 'x' | 'z',
    dir: 1 | -1,
    isRobot: boolean,
  ): Ped {
    const g = new THREE.Group();
    const seed = id * 5.1 + 2.2;

    // Body (torso + legs as a capsule-ish stack)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hash(seed), 0.5, 0.45),
      roughness: 0.7,
    });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), bodyMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    g.add(torso);

    const headMat = new THREE.MeshStandardMaterial({
      color: 0xc9a07a,
      roughness: 0.8,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), headMat);
    head.position.y = 1.3;
    g.add(head);

    let robotMat: THREE.MeshStandardMaterial | undefined;
    let eyeMat: THREE.MeshBasicMaterial | undefined;
    if (isRobot) {
      // (created lazily; we mark flag here but add parts in update)
    }
    void robotMat;
    void eyeMat;

    this.group.add(g);
    return {
      group: g,
      bodyMat,
      headMat,
      side,
      offset: 0,
      dir,
      speed: 1.2,
      isRobot,
    };

  }

  update(cfg: EraConfig, dt: number, time: number): void {
    const activeCount = Math.round(this.maxPeds * cfg.pedestrianDensity);
    const palette = cfg.pedestrianPalette;
    const robotShare = cfg.robotAmount;

    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      const isActive = i < activeCount;
      const targetVis = isActive ? 1 : 0;
      const curVis = p.group.scale.y;
      const vis = THREE.MathUtils.lerp(curVis, targetVis, 0.06);
      p.group.visible = vis > 0.02;
      p.group.scale.setScalar(vis);

      if (!p.group.visible) continue;

      // Walk along the sidewalk line
      const speed = p.speed * (0.8 + 0.4 * hash(i));
      p.offset = (p.offset + speed * dt * p.dir + 42) % 42;
      const pos = -21 + p.offset;
      const roadHalf = 7;
      const cross = roadHalf + 2.0;
      const lines = [cross, -cross];
      const c = lines[p.side % 2];
      if (p.side < 2) {
        // x-axis lines
        p.group.position.set(pos, 0, c);
        p.group.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        p.group.position.set(c, 0, pos);
        p.group.rotation.y = p.dir > 0 ? 0 : Math.PI;
      }

      // Bobbing walk
      p.group.position.y = Math.abs(Math.sin(time * 6 + i)) * 0.06;

      // Outfit colour from era palette
      const col = palette[i % palette.length] ?? palette[0];
      p.bodyMat.color.copy(toColor(col));

      // Robot crossfade: a fraction of peds become metallic with glowing eyes
      const isRobotNow = hash(i * 13.1) < robotShare;
      if (isRobotNow) {
        p.bodyMat.metalness = 0.9;
        p.bodyMat.roughness = 0.2;
        p.bodyMat.color.setHex(0x99aabb).lerp(toColor(col), 0.2);
        p.headMat.color.setHex(0xbbccdd);
        p.headMat.emissive.setHex(0x1133aa);
        p.headMat.emissiveIntensity = 0.4 + 0.3 * Math.sin(time * 4 + i);
      } else {
        p.bodyMat.metalness = 0.0;
        p.bodyMat.roughness = 0.7;
        p.headMat.color.setHex(0xc9a07a);
        p.headMat.emissive.setHex(0x000000);
        p.headMat.emissiveIntensity = 0;
      }
    }
  }

  dispose(): void {
    for (const p of this.peds) {
      p.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
  }
}
