import * as THREE from 'three';
import type { EraConfig } from '../types';
import { toColor, makeWindowTexture } from '../three-helpers';
import { hash } from '../math';

interface Building {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  baseHeight: number;
  targetHeight: number;
  heightSeed: number;
  /** per-building window texture so lit patterns are stable */
  emissiveTex: THREE.CanvasTexture;
  mapTex: THREE.CanvasTexture;
}

/**
 * A grid of buildings around the block whose height, window glow, glassiness,
 * emissive and metalness all respond to the blended era config.
 *
 * Building *heights* change per era: earlier eras have shorter, boxier stock;
 * later eras grow taller and glassier. We lerp each building's scale.y toward
 * its era-derived target each frame.
 */
export class Buildings {
  group = new THREE.Group();

  private buildings: Building[] = [];
  private windowLit = 0;
  private curGlassiness = 0;

  constructor() {
    // Place buildings in four quadrants, leaving the road grid (±7) clear.
    const slots: { x: number; z: number; quad: number }[] = [];
    const blockHalf = 16; // building zone half extent (road is ±7, sidewalk ~±9)
    const cols = 3;
    const spacing = 10;
    // Quadrant origins
    const qOff = 14;
    const quads = [
      { x: qOff, z: qOff },
      { x: -qOff, z: qOff },
      { x: qOff, z: -qOff },
      { x: -qOff, z: -qOff },
    ];
    let qi = 0;
    for (const q of quads) {
      for (let cx = 0; cx < cols; cx++) {
        for (let cz = 0; cz < cols; cz++) {
          const x = q.x + (cx - 1) * spacing + hash(qi * 31 + cx * 7) * 2;
          const z = q.z + (cz - 1) * spacing + hash(qi * 53 + cz * 11) * 2;
          slots.push({ x, z, quad: qi });
        }
      }
      qi++;
      void blockHalf;
    }

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const seed = i * 12.9898 + 78.233;
      const wW = 5 + hash(seed) * 2.5;
      const wD = 5 + hash(seed * 1.7) * 2.5;
      const cols2 = Math.max(2, Math.round(wW / 1.6));
      const rows = 10;

      // Facade texture (shared conceptually but generated per building for variety)
      const { map, emissive } = makeWindowTexture(
        cols2,
        rows,
        0.5,
        '#3a3a3a',
        '#1a1a1a',
        '#ffdfa0',
        seed,
      );

      const mat = new THREE.MeshStandardMaterial({
        color: 0x8a8278,
        roughness: 0.85,
        metalness: 0.0,
        map,
        emissiveMap: emissive,
        emissive: new THREE.Color(0xffe0a0),
        emissiveIntensity: 0,
      });

      const geo = new THREE.BoxGeometry(wW, 1, wD);
      // Stretch UVs so the texture tiles vertically with the height.
      // Box geometry default UVs are fine; we scale via material map repeat.

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(s.x, 0.5, s.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.scale.y = 1;
      this.group.add(mesh);

      // Add a small roof cap detail
      const capGeo = new THREE.BoxGeometry(wW * 0.5, 0.6, wD * 0.5);
      const capMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.9,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(0, 0, 0);
      cap.castShadow = true;
      mesh.add(cap);
      // Cap sits at top of the unit box (local y=0.5); mesh.scale.y stretches it.
      cap.position.y = 0.5;

      this.buildings.push({
        mesh,
        mat,
        baseHeight: 1,
        targetHeight: 1,
        heightSeed: seed,
        emissiveTex: emissive,
        mapTex: map,
      });
    }
  }

  update(cfg: EraConfig, eraProgress: number): void {
    this.windowLit = cfg.windowGlow;
    this.curGlassiness = cfg.buildingGlassiness;

    const tint = toColor(cfg.buildingTint);
    const emis = toColor(cfg.buildingEmissive);

    for (const b of this.buildings) {
      // Target height depends on era progress (0..5): older=shorter.
      // Add per-building variation via hash.
      const eraFactor = 0.5 + eraProgress / 5; // 0.5 .. 1.5
      const variation = 0.6 + hash(b.heightSeed) * 0.9;
      b.targetHeight = (8 + eraProgress * 4) * eraFactor * variation;

      // Smoothly approach target height (the transition controller also
      // moves eraProgress; this gives a little extra settling).
      const cur = b.mesh.scale.y;
      const next = THREE.MathUtils.lerp(cur, b.targetHeight, 0.04);
      b.mesh.scale.y = next;
      b.mesh.position.y = next * 0.5;

      // Place roof cap at the top
      if (b.mesh.children[0]) {
        b.mesh.children[0].position.y = 0.5; // top of the unit box (scaled)
      }

      // Material props
      b.mat.color.copy(tint);
      b.mat.emissive.copy(emis);
      b.mat.emissiveIntensity = cfg.windowGlow * cfg.windowLitRatio * 2.2;
      b.mat.roughness = THREE.MathUtils.lerp(0.9, cfg.buildingRoughness, cfg.buildingGlassiness);
      b.mat.metalness = THREE.MathUtils.lerp(0.0, cfg.buildingMetalness, cfg.buildingGlassiness);
    }
  }

  dispose(): void {
    for (const b of this.buildings) {
      b.mesh.geometry.dispose();
      b.mat.dispose();
      b.emissiveTex.dispose();
      b.mapTex.dispose();
      for (const child of b.mesh.children) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }
    }
  }
}
