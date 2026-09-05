/**
 * src/content/streetfurniture/index.ts — era-aware street furniture module.
 *
 * Owns every piece of era street furniture (lamps, traffic lights, benches,
 * hydrants, bins, bus stops, payphones, newsstands, trees and planters) and
 * the painted crosswalk/road markings. All specs are declarative
 * StreetFurnitureEraSpec entries in src/eras.ts; this module only consumes
 * them and never hardcodes era logic.
 *
 * The module builds one group per era and keeps them all mounted. Era swaps
 * ride the shared MorphEngine timeline: the leaving era's furniture fades
 * out, the arriving era's furniture fades in (deterministic endpoints leave
 * exactly one era visible), so there are never orphaned meshes and never a
 * rebuild hitch mid-transition.
 *
 * Contract: { group, update(dt), setEra(era, t), dispose() } — no renderer,
 * no loop.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../../core/MorphEngine';
import type { EraId, StreetFurnitureEraSpec, StreetFurnitureSpec } from '../../eras';
import { ERA_IDS, ERA_SCENE_STATES } from '../../eras';
import { buildFurnitureGeometry } from './FurnitureModels';

interface FurnitureRig {
  spec: StreetFurnitureSpec;
  root: THREE.Group;
}

interface PopulationBuild {
  group: THREE.Group;
  rigs: FurnitureRig[];
  opacity: number;
}

/** Fade profile: leaving furniture stays until 45%, then out; arriving fades in after 55%. */
function fadeOut(progress: number): number {
  return progress < 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
}

function fadeIn(progress: number): number {
  return progress > 0.55 ? 1 : Math.max(0, progress / 0.55);
}

/** Crosswalk bands painted on the road plane for one era (empty group = none). */
function buildCrosswalks(spec: StreetFurnitureEraSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = `crosswalks-${spec.era}`;
  if (!spec.crosswalks) {
    return group;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(spec.crosswalkColor),
    roughness: 0.92,
    metalness: 0.02,
  });
  // Three zebra crossings across the two lanes.
  const cols = [6, 14, 22];
  for (const z of cols) {
    for (let i = 0; i < 5; i += 1) {
      const x = -1.2 + i * 0.6;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 2.6), mat);
      band.rotation.x = -Math.PI / 2;
      band.position.set(x, 0.012, z);
      group.add(band);
    }
  }
  group.userData.disposeList = [mat];
  return group;
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
  });
  group.clear();
}

export interface StreetFurnitureModuleOptions {
  /** Initial era the module starts in (defaults to the first era). */
  initialEra?: EraId;
  /** Paint crosswalk/road markings (default true). */
  crosswalks?: boolean;
}

export class StreetFurnitureModule {
  readonly group = new THREE.Group();
  private readonly populations = new Map<EraId, PopulationBuild>();
  private readonly crosswalkGroups = new Map<EraId, THREE.Group>();
  private readonly timelineOff: () => void;
  private activeEra: EraId;

  constructor(morphEngine: MorphEngine, options: StreetFurnitureModuleOptions = {}) {
    this.group.name = 'StreetFurniture';
    this.activeEra = options.initialEra ?? ERA_IDS[0];

    for (const era of Object.keys(ERA_SCENE_STATES) as EraId[]) {
      const build = this.buildPopulation(era);
      this.group.add(build.group);
      this.populations.set(era, build);

      if (options.crosswalks ?? true) {
        const cross = buildCrosswalks(ERA_SCENE_STATES[era].streetFurniture[0]);
        this.group.add(cross);
        this.crosswalkGroups.set(era, cross);
      }
    }
    this.applyOpacity();
    this.applyCrosswalkOpacity();

    this.timelineOff = morphEngine.onTimeline((state) => {
      const { progress, fromEra, toEra } = state;
      if (progress <= 0) {
        for (const build of this.populations.values()) {
          build.opacity = 0;
        }
        const leaving = this.populations.get(fromEra);
        if (leaving) {
          leaving.opacity = 1;
        }
        this.applyOpacity();
        this.applyCrosswalkOpacity(fromEra);
        return;
      }
      if (progress >= 1) {
        for (const build of this.populations.values()) {
          build.opacity = 0;
        }
        const arriving = this.populations.get(toEra);
        if (arriving) {
          arriving.opacity = 1;
        }
        this.applyOpacity();
        this.applyCrosswalkOpacity(toEra);
        return;
      }
      const leaving = this.populations.get(fromEra);
      const arriving = this.populations.get(toEra);
      if (leaving && arriving) {
        leaving.opacity = fadeOut(progress);
        arriving.opacity = fadeIn(progress);
        this.applyOpacity();
      }
      // Crosswalks are painted details; switch them around the midpoint.
      this.applyCrosswalkOpacity(progress < 0.5 ? fromEra : toEra);
    });
  }

  /** Advance per-frame logic (no-op — furniture is static outside transitions). */
  update(_dt: number): void {
    // no-op — transforms are placed once and era swaps ride the timeline.
  }

  setEra(era: EraId): void {
    this.activeEra = era;
  }

  dispose(): void {
    this.timelineOff();
    for (const build of this.populations.values()) {
      disposeGroup(build.group);
    }
    for (const cross of this.crosswalkGroups.values()) {
      disposeGroup(cross);
    }
    this.populations.clear();
    this.crosswalkGroups.clear();
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

  private applyCrosswalkOpacity(visibleEra?: EraId): void {
    const era = visibleEra ?? this.activeEra;
    for (const [id, cross] of this.crosswalkGroups) {
      cross.visible = id === era;
    }
  }

  private buildPopulation(era: EraId): PopulationBuild {
    const group = new THREE.Group();
    group.name = `furniture-${era}`;
    const rigs: FurnitureRig[] = [];
    const spec = ERA_SCENE_STATES[era].streetFurniture[0];
    const items = spec ? [...spec.street, ...spec.greenery] : [];
    for (const item of items) {
      const rig = this.buildRig(item);
      group.add(rig.root);
      rigs.push(rig);
    }
    return { group, rigs, opacity: era === this.activeEra ? 1 : 0 };
  }

  private buildRig(spec: StreetFurnitureSpec): FurnitureRig {
    const set = buildFurnitureGeometry(spec.model);
    const root = new THREE.Group();
    root.name = spec.id;

    const mainMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.color),
      roughness: 0.8,
      metalness: 0.12,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.accentColor),
      roughness: 0.5,
      metalness: 0.15,
    });

    this.addMesh(root, set.main, mainMat);
    this.addMesh(root, set.accent, accentMat);
    this.addMesh(root, set.panel, new THREE.MeshStandardMaterial({ color: 0x22262c }));

    root.position.set(spec.x, 0, spec.z);
    if (spec.rotation) {
      root.rotation.y = spec.rotation;
    }
    root.userData.era = spec.model;
    root.userData.kind = spec.kind;
    return { spec, root };
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
}