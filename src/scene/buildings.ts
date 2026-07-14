import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { BLOCK_SIZE, LOT_SIZE, LOTS_PER_AXIS, ROAD_WIDTH, lotCenter } from './ground';
import { mulberry32, pick, randFloat, lerpN, smoothstep } from '../util/math';
import { makeWindowTexture, makeTextTexture } from '../util/textures';
import { lerpColorInto } from '../util/color';

interface BuildingLot {
  index: number;
  cx: number;
  cz: number;
  // Per-era target heights so we can lerp the scale.y
  heights: number[];
  footprintW: number;
  footprintD: number;
  mesh: THREE.Mesh;
  baseMat: BuildingMaterial;
  billboard?: Billboard;
}

interface BuildingMaterial {
  mat: THREE.MeshStandardMaterial;
  emissiveTex: THREE.CanvasTexture;
  fromEra: number;
  toEra: number;
  curColor: THREE.Color;
}

interface Billboard {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  phrases: string[];
}

/**
 * The building layer. Each of the 16 lots holds a building whose target height
 * differs per era; during a transition we ease the mesh scale.y toward the
 * target. Facade colour, glassness, window glow and billboards are driven by
 * per-era config and interpolated.
 */
export class BuildingsModule implements SceneModule {
  readonly group = new THREE.Group();
  private lots: BuildingLot[] = [];
  private time = 0;

  constructor() {
    const rng = mulberry32(73_541);
    for (let iz = 0; iz < LOTS_PER_AXIS; iz++) {
      for (let ix = 0; ix < LOTS_PER_AXIS; ix++) {
        const i = iz * LOTS_PER_AXIS + ix;
        const cx = lotCenter(ix);
        const cz = lotCenter(iz);
        // Vary footprint slightly within the lot
        const fw = LOT_SIZE * randFloat(rng, 0.62, 0.86);
        const fd = LOT_SIZE * randFloat(rng, 0.62, 0.86);
        const rotY = pick(rng, [0, 0, 0, Math.PI / 2]);

        // Per-era heights
        const heights = ERA_LIST.map((era) =>
          randFloat(rng, era.buildingMinHeight, era.buildingMaxHeight)
        );

        const mat = this.createMaterial(0);
        // Box geometry with origin at the base (y=0 is ground)
        const geo = new THREE.BoxGeometry(fw, 1, fd);
        geo.translate(0, 0.5, 0); // pivot at base
        const mesh = new THREE.Mesh(geo, mat.mat);
        mesh.position.set(cx, 0.3, cz); // sit on sidewalk
        mesh.rotation.y = rotY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.scale.y = heights[0];

        const lot: BuildingLot = {
          index: i,
          cx,
          cz,
          heights,
          footprintW: fw,
          footprintD: fd,
          mesh,
          baseMat: { mat: mat.mat, emissiveTex: mat.tex, fromEra: 0, toEra: 0, curColor: new THREE.Color() }
        };

        // Billboards on ~40% of lots, mounted on roof edge
        if (rng() < 0.4) {
          const bb = this.createBillboard(i, rng);
          lot.billboard = bb;
          mesh.add(bb.mesh);
        }

        this.lots.push(lot);
        this.group.add(mesh);
      }
    }
    this.setEra(ERA_LIST[0]);
  }

  private createMaterial(eraIndex: number): { mat: THREE.MeshStandardMaterial; tex: THREE.CanvasTexture } {
    const era = ERA_LIST[eraIndex];
    const cols = Math.max(3, Math.round(randFloat(mulberry32(eraIndex + 9), 4, 8)));
    const rows = Math.max(4, Math.round(randFloat(mulberry32(eraIndex + 21), 6, 12)));
    const tex = makeWindowTexture(cols, rows, era.windowLitRatio, era.windowEmissive, eraIndex * 1000 + 7);
    tex.repeat.set(2, 4);
    const base = pick(mulberry32(eraIndex + 31), era.facadeColors);
    const mat = new THREE.MeshStandardMaterial({
      color: base,
      roughness: lerpN(0.9, 0.15, era.glassness),
      metalness: lerpN(0.0, 0.9, era.glassness),
      emissive: new THREE.Color(era.windowEmissive).convertSRGBToLinear(),
      emissiveMap: tex,
      emissiveIntensity: era.nightFactor * 2.0 + 0.15
    });
    return { mat, tex };
  }

  private createBillboard(seedBase: number, rng: () => number): Billboard {
    const era = ERA_LIST[0];
    const phrase = pick(rng, era.adPhrases);
    const bg = pick(rng, era.adPalette);
    const tex = makeTextTexture(phrase, bg, '#ffffff', seedBase);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide,
      transparent: true,
      fog: true
    });
    const w = randFloat(rng, 5, 8);
    const h = w * 0.5;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(randFloat(rng, -2, 2), randFloat(rng, 0.7, 1.0), randFloat(rng, -2, 2));
    mesh.rotation.y = randFloat(rng, 0, Math.PI * 2);
    return { mesh, mat, phrases: era.adPhrases.slice() };
  }

  update(dt: number, state: SceneState): void {
    this.time += dt;
    const a = ERA_LIST[state.fromIndex];
    const b = ERA_LIST[state.toIndex];
    const t = smoothstep(state.progress);

    const glassness = lerpN(a.glassness, b.glassness, t);
    const night = lerpN(a.nightFactor, b.nightFactor, t);
    const litRatio = lerpN(a.windowLitRatio, b.windowLitRatio, t);

    for (const lot of this.lots) {
      // Height morph
      const hFrom = lot.heights[state.fromIndex];
      const hTo = lot.heights[state.toIndex];
      lot.mesh.scale.y = lerpN(hFrom, hTo, t);

      // Facade color: pick from-era and to-era palette colors per lot deterministically
      const rngLot = mulberry32(lot.index * 101 + 5);
      pick(rngLot, a.facadeColors); // advance
      const fromColor = pick(rngLot, a.facadeColors);
      const rngLot2 = mulberry32(lot.index * 101 + 9);
      const toColor = pick(rngLot2, b.facadeColors);
      lerpColorInto(fromColor, toColor, t, lot.baseMat.curColor);
      lot.baseMat.mat.color.copy(lot.baseMat.curColor);

      // Material reflectivity
      lot.baseMat.mat.roughness = lerpN(0.9, 0.15, glassness);
      lot.baseMat.mat.metalness = lerpN(0.0, 0.9, glassness);

      // Emissive glow (windows at night)
      const glow = night * 2.2 + 0.12;
      lot.baseMat.mat.emissiveIntensity = glow;

      // Occasionally regenerate the emissive map when lit ratio changes significantly
      if (Math.abs(lot.baseMat.emissiveTex.userData.lit - litRatio) > 0.12) {
        this.refreshWindows(lot, state.toIndex, litRatio, t);
      }

      // Billboards: holo-ads spin and pulse in future eras
      if (lot.billboard) {
        const modern = b.year >= 2025 ? 1 : a.year >= 2025 ? 1 : 0;
        lot.billboard.mesh.rotation.y += dt * (0.3 + modern * 0.5);
        lot.billboard.mat.opacity = 0.7 + Math.sin(this.time * 2 + lot.index) * 0.15 + modern * 0.15;
      }
    }
  }

  private refreshWindows(lot: BuildingLot, eraIndex: number, litRatio: number, t: number): void {
    const era = ERA_LIST[eraIndex];
    const cols = Math.max(3, Math.round(randFloat(mulberry32(eraIndex + 9), 4, 8)));
    const rows = Math.max(4, Math.round(randFloat(mulberry32(eraIndex + 21), 6, 12)));
    const oldTex = lot.baseMat.emissiveTex;
    const newTex = makeWindowTexture(cols, rows, litRatio, era.windowEmissive, lot.index * 131 + eraIndex * 17);
    newTex.repeat.copy(oldTex.repeat);
    lot.baseMat.emissiveTex = newTex;
    lot.baseMat.mat.emissiveMap = newTex;
    lot.baseMat.mat.needsUpdate = true;
    oldTex.dispose();
    newTex.userData.lit = litRatio;
    void t;
  }

  setEra(config: EraConfig): void {
    const idx = ERA_LIST.findIndex((e) => e.id === config.id);
    if (idx < 0) return;
    for (const lot of this.lots) {
      lot.mesh.scale.y = lot.heights[idx];
      lot.baseMat.mat.color.set(pick(mulberry32(lot.index * 101 + 5), config.facadeColors));
      lot.baseMat.mat.roughness = lerpN(0.9, 0.15, config.glassness);
      lot.baseMat.mat.metalness = lerpN(0.0, 0.9, config.glassness);
      lot.baseMat.mat.emissiveIntensity = config.nightFactor * 2.2 + 0.12;
    }
  }

  dispose(): void {
    for (const lot of this.lots) {
      lot.baseMat.mat.dispose();
      lot.baseMat.emissiveTex.dispose();
      lot.mesh.geometry.dispose();
      if (lot.billboard) {
        lot.billboard.mat.dispose();
        lot.billboard.mat.map?.dispose();
        lot.billboard.mesh.geometry.dispose();
      }
    }
  }
}

// Re-export block constants for other modules
export { BLOCK_SIZE, ROAD_WIDTH, LOT_SIZE };
