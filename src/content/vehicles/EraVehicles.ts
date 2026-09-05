/**
 * src/content/vehicles/EraVehicles.ts — era-distinct street traffic.
 *
 * Builds five complete vehicle populations (one per era) as procedural meshes
 * driven by the shared morph timeline. Each rig advances along STREET_PATH on
 * its lane (lane 0 heads +Z, lane 1 heads −Z), wrapping at both ends so the
 * avenue reads as one block-long stretch.
 *
 * Transition-safe scheduling: vehicle motion itself is per-frame along the
 * path (the same time-fraction the shared morph engine uses), and population
 * *swaps* ride the engine's onTimeline feed. On `setEra(progress, from, to)`
 * the leaving population drives off over the next DRIVE_OFF_FRACTION of its
 * loop while the arriving population drives in from the same pull-back; a
 * crossfade sweeps both groups so there are no orphaned meshes and no visible
 * z-fighting between eras. Deterministic endpoints: when progress is 0 or 1
 * exactly one population is fully visible.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../../core/MorphEngine';
import type { EraId, VehicleSpec } from '../../eras';
import { ERA_SCENE_STATES } from '../../eras';
import {
  DRIVE_OFF_FRACTION,
  DRIVE_IN_PULL_FRACTION,
  LANE_OFFSET,
  STREET_PATH,
  fadeIn,
  fadeOut,
  loopLength,
  mod1,
  sampleLoop,
} from './WorldPaths';
import { buildVehicleGeometry, type VehiclePalette } from './VehicleModels';

interface VehicleRig {
  spec: VehicleSpec;
  root: THREE.Group;
  offset: number;
}

interface PopulationBuild {
  group: THREE.Group;
  rigs: VehicleRig[];
  opacity: number;
}

/** Total street length in metres; converts metres/second into loop fraction. */
const AVENUE_LENGTH = loopLength(STREET_PATH);

export class EraVehicles {
  readonly group = new THREE.Group();
  private readonly populations = new Map<EraId, PopulationBuild>();
  private readonly timelineOff: () => void;
  private activeEra: EraId;

  constructor(eraStateEra: EraId, morphEngine: MorphEngine) {
    this.group.name = 'EraVehicles';
    this.activeEra = eraStateEra;

    for (const era of Object.keys(ERA_SCENE_STATES) as EraId[]) {
      const build = this.buildPopulation(era);
      this.group.add(build.group);
      this.populations.set(era, build);
    }
    this.applyOpacity();

    // All population swaps are scheduled by the shared morph timeline. Each
    // frame of a transition the driver moves the old group off and the new
    // group in; the visible one always matches the user's era selection even
    // if the transition is interrupted by another era change.
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
        // Push the departing rigs around the loop so they physically drive
        // off screen while the arrivals pull back and drive in.
        for (const rig of leaving.rigs) {
          rig.offset = mod1(rig.offset + DRIVE_OFF_FRACTION * progress);
        }
        // Pull the arrivals back so they physically "drive in" from off stage.
        for (const rig of arriving.rigs) {
          rig.offset = mod1(rig.spec.offset - DRIVE_IN_PULL_FRACTION * progress);
        }
        this.applyOpacity();
      }
    });
  }

  /** Advance traffic along the street. All rigs keep cruising so a leaving
   *  population is still in motion while it crossfades out. */
  update(dtSeconds: number): void {
    for (const build of this.populations.values()) {
      for (const rig of build.rigs) {
        const direction = rig.spec.lane === 0 ? 1 : -1;
        rig.offset = mod1(rig.offset + (direction * rig.spec.speed * dtSeconds) / AVENUE_LENGTH);
        this.placeRig(rig);
      }
    }
  }

  /** Called by the shared timeline when the era selection changes. */
  setEra(era: EraId): void {
    this.activeEra = era;
  }

  dispose(): void {
    this.timelineOff();
    for (const build of this.populations.values()) {
      for (const rig of build.rigs) {
        rig.root.traverse((obj) => {
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
        });
      }
      build.group.clear();
    }
    this.populations.clear();
    this.group.clear();
  }

  private applyOpacity(): void {
    for (const build of this.populations.values()) {
      const opacity = build.opacity;
      build.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const material = mesh?.material as THREE.MeshStandardMaterial | undefined;
        if (material) {
          material.opacity = opacity;
          material.transparent = opacity < 1;
        }
      });
    }
  }

  private buildPopulation(era: EraId): PopulationBuild {
    const group = new THREE.Group();
    group.name = `vehicles-${era}`;
    const rigs: VehicleRig[] = [];
    for (const spec of ERA_SCENE_STATES[era].vehicles) {
      const rig = this.buildRig(era, spec);
      group.add(rig.root);
      rigs.push(rig);
    }
    return { group, rigs, opacity: era === this.activeEra ? 1 : 0 };
  }

  private buildRig(era: EraId, spec: VehicleSpec): VehicleRig {
    const palette: VehiclePalette = {
      color: spec.color,
      accentColor: spec.accentColor,
      trimColor: spec.trimColor,
    };
    const set = buildVehicleGeometry(spec.model, palette);
    const root = new THREE.Group();
    root.name = spec.id;
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.color),
      roughness: 0.55,
      metalness: 0.35,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.accentColor),
      roughness: 0.5,
      metalness: 0.3,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0c1016,
      roughness: 0.15,
      metalness: 0.7,
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.trimColor),
      roughness: 0.25,
      metalness: 0.85,
    });
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffe8a0,
      emissive: new THREE.Color(0xffd060),
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xa01818,
      emissive: new THREE.Color(0x7a0d0d),
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    this.addMesh(root, set.body, bodyMat);
    this.addMesh(root, set.accent, accentMat);
    this.addMesh(root, set.glass, glassMat);
    this.addMesh(root, set.wheels, wheelMat);
    this.addMesh(root, set.trim, trimMat);
    this.addMesh(root, set.lights, lightMat);
    this.addMesh(root, set.tail, tailMat);
    this.placeRig({ spec, root, offset: spec.offset });
    root.userData.era = era;
    root.userData.model = spec.model;
    return { spec, root, offset: spec.offset };
  }

  private addMesh(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material): void {
    const position = geometry.attributes.position;
    if (!position || position.count === 0) {
      geometry.dispose();
      return;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = parent.name;
    parent.add(mesh);
  }

  private placeRig(rig: VehicleRig): void {
    const sample = sampleLoop(STREET_PATH, rig.offset);
    const laneX = LANE_OFFSET[rig.spec.lane];
    rig.root.position.set(sample.x + laneX, 0, sample.z);
    rig.root.rotation.y = sample.yaw + (rig.spec.lane === 0 ? 0 : Math.PI);
  }
}