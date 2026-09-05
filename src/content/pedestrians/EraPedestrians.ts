/**
 * src/content/pedestrians/EraPedestrians.ts — era-distinct sidewalk life.
 *
 * Builds five complete pedestrian populations (one per era) as procedural
 * meshes walking the SIDEWALK_LOOP past the storefronts. Each silhouette is a
 * stylised figure (head, torso, pelvis, limbs) dressed by its era's outfit
 * builder: 1945 wartime workwear/coats, 1965 slim suits and dresses, 1985 bold
 * disco and leather, 2005 casual denim/hoodies, 2025 athleisure and techwear.
 * Fabrics are declarative strings that map onto material roughness so wool
 * reads dull, silk reads gloss, denim/leather/goretex read matte, and spandex
 * reads tight.
 *
 * Transition-safe scheduling mirrors the vehicles: every population is built
 * once, population *swaps* ride the shared morph engine's onTimeline feed
 * (leaving pedestrians keep walking on and fade, arriving ones fade in at
 * their usual phase), and deterministic endpoints leave exactly one era's
 * population visible. Walk speed/phase come from the declarative specs, so a
 * whole sidewalk changes character without rebuilding the city.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../../core/MorphEngine';
import type { EraId, PedestrianSpec } from '../../eras';
import { ERA_SCENE_STATES } from '../../eras';
import {
  fadeIn,
  fadeOut,
  loopLength,
  mod1,
  sampleLoop,
  SIDEWALK_LOOP,
} from '../vehicles/WorldPaths';

import { buildOutfitGeometry, type OutfitPalette } from './PedestrianModels';

interface PedestrianRig {
  spec: PedestrianSpec;
  root: THREE.Group;
  phase: number;
}

interface PopulationBuild {
  group: THREE.Group;
  rigs: PedestrianRig[];
  opacity: number;
}

const LOOP_LEN = loopLength(SIDEWALK_LOOP);

export class EraPedestrians {
  readonly group = new THREE.Group();
  private readonly populations = new Map<EraId, PopulationBuild>();
  private readonly timelineOff: () => void;
  private activeEra: EraId;

  constructor(eraStateEra: EraId, morphEngine: MorphEngine) {
    this.group.name = 'EraPedestrians';
    this.activeEra = eraStateEra;

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

  /** Advance walkers along the sidewalk loop; all rigs keep stepping so a
   *  leaving population is still walking while it crossfades out. */
  update(dtSeconds: number): void {
    for (const build of this.populations.values()) {
      for (const rig of build.rigs) {
        rig.phase = mod1(rig.phase + (rig.spec.speed * dtSeconds) / LOOP_LEN);
        this.placeRig(rig);
      }
    }
  }

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
    group.name = `pedestrians-${era}`;
    const rigs: PedestrianRig[] = [];
    for (const spec of ERA_SCENE_STATES[era].pedestrians) {
      const rig = this.buildRig(era, spec);
      group.add(rig.root);
      rigs.push(rig);
    }
    return { group, rigs, opacity: era === this.activeEra ? 1 : 0 };
  }

  private buildRig(era: EraId, spec: PedestrianSpec): PedestrianRig {
    const palette: OutfitPalette = {
      color: spec.color,
      accentColor: spec.accentColor,
      skinColor: spec.skinColor,
      hairColor: spec.hairColor,
      fabric: spec.fabric,
    };
    const set = buildOutfitGeometry(spec.model, palette);
    const root = new THREE.Group();
    root.name = spec.id;
    const { headMat, skinMat, upperMat, lowerMat, accentMat, shoeMat } = this.makeMaterials(palette);
    this.addMesh(root, set.head, headMat);
    this.addMesh(root, set.skin, skinMat);
    this.addMesh(root, set.upper, upperMat);
    this.addMesh(root, set.lower, lowerMat);
    this.addMesh(root, set.accent, accentMat);
    this.addMesh(root, set.shoes, shoeMat);
    this.placeRig({ spec, root, phase: spec.phase });
    root.userData.era = era;
    root.userData.model = spec.model;
    root.userData.fabric = spec.fabric;
    return { spec, root, phase: spec.phase };
  }

  private makeMaterials(palette: OutfitPalette): {
    headMat: THREE.MeshStandardMaterial;
    skinMat: THREE.MeshStandardMaterial;
    upperMat: THREE.MeshStandardMaterial;
    lowerMat: THREE.MeshStandardMaterial;
    accentMat: THREE.MeshStandardMaterial;
    shoeMat: THREE.MeshStandardMaterial;
  } {
    // Fabric descriptor drives how the garment reads: wool/silk/spandex get
    // glossier and tighter; denim/leather/canvas/goretex/synthetic stay matte.
    const fabricRoughness: Record<string, number> = {
      cotton_duck: 0.95,
      wool: 0.92,
      cotton: 0.9,
      wool_blend: 0.88,
      silk: 0.45,
      cotton_blend: 0.86,
      spandex: 0.6,
      leather: 0.7,
      nylon: 0.75,
      fleece: 0.95,
      denim: 0.96,
      canvas: 0.94,
      synthetic: 0.85,
      goretex: 0.9,
    };
    const garmentRoughness = fabricRoughness[palette.fabric] ?? 0.88;
    return {
      headMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.hairColor),
        roughness: 0.85,
        metalness: 0.05,
      }),
      skinMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.skinColor),
        roughness: 0.75,
        metalness: 0.02,
      }),
      upperMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.color),
        roughness: garmentRoughness,
        metalness: 0.05,
      }),
      lowerMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.accentColor),
        roughness: garmentRoughness,
        metalness: 0.05,
      }),
      accentMat: new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.accentColor),
        roughness: garmentRoughness,
        metalness: 0.05,
      }),
      shoeMat: new THREE.MeshStandardMaterial({
        color: 0x22242a,
        roughness: 0.75,
        metalness: 0.15,
      }),
    };
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

  private placeRig(rig: PedestrianRig): void {
    const sample = sampleLoop(SIDEWALK_LOOP, rig.phase);
    rig.root.position.set(sample.x, 0, sample.z);
    rig.root.rotation.y = sample.yaw + Math.PI;
  }
}