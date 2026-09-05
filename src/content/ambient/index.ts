/**
 * src/content/ambient/index.ts — era-aware ambient life module.
 *
 * Owns the era background life on the block: birds/pigeons, street steam,
 * chimney smoke, drifting dust/leaves and subtle crowd chatter. Every element
 * is declaratively specified per era in src/eras.ts (AMBIENT_SPECS) and only
 * constructed here; nothing hardcodes a period.
 *
 * Like the furniture/vehicle/pedestrian populations, all five eras are built
 * once and kept mounted. Era swaps ride the shared MorphEngine timeline with
 * a population-style crossfade (deterministic endpoints, no orphan meshes):
 * the leaving era's birds/particles fade out while the arriving era's fade
 * in, and per-frame particle/bird motion keeps running the whole time.
 *
 * Contract: { group, update(dt), setEra(era, t), dispose() } — no renderer,
 * no loop.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../../core/MorphEngine';
import type { EraId } from '../../eras';
import { ERA_IDS, ERA_SCENE_STATES } from '../../eras';
import {
  buildBirdRig,
  buildChatterDots,
  buildParticleField,
  makeParticleTexture,
  type BirdRig,
  type ParticleFieldRig,
} from './AmbientModels';

interface PopulationBuild {
  group: THREE.Group;
  birds: BirdRig[];
  fields: ParticleFieldRig[];
  opacity: number;
}

/** Fade profile: leaving life stays until 45%, then out; arriving fades in after 55%. */
function fadeOut(progress: number): number {
  return progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
}

function fadeIn(progress: number): number {
  return progress > 0.55 ? 1 : Math.max(0, progress / 0.55);
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = (mesh as THREE.Mesh | null)?.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) {
      for (const m of material) {
        m.dispose();
      }
    } else if (material) {
      material.dispose();
    }
    const disposeList = (obj.userData.disposeList ?? []) as Array<THREE.Material | THREE.BufferGeometry>;
    for (const item of disposeList) {
      item.dispose();
    }
  });
  group.clear();
}

export class AmbientLifeModule {
  readonly group = new THREE.Group();
  private readonly populations = new Map<EraId, PopulationBuild>();
  private readonly timelineOff: () => void;
  private activeEra: EraId;
  private readonly particleTexture: THREE.CanvasTexture;

  constructor(morphEngine: MorphEngine, initialEra: EraId = ERA_IDS[0]) {
    this.group.name = 'AmbientLife';
    this.activeEra = initialEra;
    this.particleTexture = makeParticleTexture();

    for (const era of Object.keys(ERA_SCENE_STATES) as EraId[]) {
      const build = this.buildPopulation(era);
      this.group.add(build.group);
      this.populations.set(era, build);
    }
    this.applyOpacity();

    this.timelineOff = morphEngine.onTimeline((state) => {
      const { progress, fromEra, toEra } = state;
      if (progress <= 0) {
        for (const build of this.populations.values()) {
          build.opacity = 0;
        }
        this.populations.get(fromEra)!.opacity = 1;
        this.applyOpacity();
        return;
      }
      if (progress >= 1) {
        for (const build of this.populations.values()) {
          build.opacity = 0;
        }
        this.populations.get(toEra)!.opacity = 1;
        this.applyOpacity();
        return;
      }
      const leaving = this.populations.get(fromEra);
      const arriving = this.populations.get(toEra);
      if (leaving && arriving) {
        leaving.opacity = fadeOut(progress);
        arriving.opacity = fadeIn(progress);
        this.applyOpacity();
      }
    });
  }

  /** Advance bird flight, steam/smoke/dust/leaves drift. */
  update(dt: number): void {
    for (const build of this.populations.values()) {
      const t = dt;
      // Birds hop and flap around their home anchor.
      for (const bird of build.birds) {
        bird.phase = (bird.phase + t * bird.speed * 0.25) % 1;
        const flap = Math.sin(bird.phase * Math.PI * 2) * bird.amp;
        for (const wing of bird.wings) {
          wing.rotation.x = flap;
        }
        const hop = Math.abs(Math.sin(bird.phase * Math.PI * 2)) * 0.06;
        bird.root.position.y = specAltitude(bird.root) + hop;
        bird.root.rotation.y = Math.sin(bird.phase * Math.PI) * 0.6;
      }
      // Particles rise/drift and wrap around their home band.
      for (const field of build.fields) {
        if (field.points.geometry.attributes.position.count === 0) {
          continue;
        }
        const positions = field.points.geometry.attributes.position.array as Float32Array;
        const seeds = field.seeds;
        const count = positions.length / 3;
        for (let i = 0; i < count; i += 1) {
          const s = seeds[i];
          positions[i * 3 + 1] += field.rise * t * (0.5 + s);
          positions[i * 3] += Math.sin(s * 6.28 + (field.drift * t) * 1.4) * field.drift * t;
          positions[i * 3 + 2] += Math.cos(s * 6.28 + (field.drift * t) * 1.1) * field.drift * t * 0.6;
          if (field.dissipate && positions[i * 3 + 1] > 6) {
            positions[i * 3 + 1] = 0.2 + s * 0.8;
          }
          if (!field.dissipate && positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 4.5;
          }
        }
        field.points.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  setEra(era: EraId): void {
    this.activeEra = era;
  }

  dispose(): void {
    this.timelineOff();
    for (const build of this.populations.values()) {
      disposeGroup(build.group);
    }
    this.populations.clear();
    this.particleTexture.dispose();
    this.group.clear();
  }

  private applyOpacity(): void {
    for (const build of this.populations.values()) {
      const opacity = build.opacity;
      build.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const material = mesh?.material as THREE.MeshStandardMaterial | THREE.PointsMaterial | undefined;
        if (material) {
          material.opacity = opacity;
          material.transparent = opacity < 1;
        }
      });
    }
  }

  private buildPopulation(era: EraId): PopulationBuild {
    const group = new THREE.Group();
    group.name = `ambient-${era}`;
    const birds: BirdRig[] = [];
    const fields: ParticleFieldRig[] = [];

    for (const spec of ERA_SCENE_STATES[era].ambient) {
      if (spec.kind === 'pigeons') {
        const count = Math.max(0, spec.count);
        for (let i = 0; i < count; i += 1) {
          const bird = buildBirdRig(spec);
          bird.root.position.set((Math.random() - 0.5) * 16, (spec.altitude ?? 1.4) + Math.random() * 0.6, -9 + Math.random() * 18);
          bird.root.userData.baseY = bird.root.position.y;
          group.add(bird.root);
          birds.push(bird);
        }
      } else if (spec.kind === 'chatter') {
        group.add(buildChatterDots(spec));
      } else if (spec.count > 0) {
        const field = buildParticleField(spec.kind, spec, this.particleTexture);
        group.add(field.points);
        fields.push(field);
      }
    }

    return { group, birds, fields, opacity: era === this.activeEra ? 1 : 0 };
  }
}

/** Home altitude stored on the bird rig when placed. */
function specAltitude(root: THREE.Object3D): number {
  return (root.userData.baseY as number | undefined) ?? 0;
}