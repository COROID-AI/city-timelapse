import { Scene } from 'three';
import { SfxContext } from '../../audio/sfxContext';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { EraMeta } from '../../types/era';
import { eraRegistry } from '../../state/eraRegistry';
import { EraYear } from '../../types/city';
import { StreetFeature } from '../../types/streetFeature';
import { buildEraBuilding, era1945Buildings, buildingFootprints } from './buildings';
import { buildEraStorefront, era1945Storefronts } from './storefronts';
import { buildEraAds, era1945Ads } from './ads';
import { createEraVehicleFleet, era1945Vehicles } from './vehicles';
import {
  buildEraStreetFurniture,
  era1945StreetFeatures,
  era1945TramTracks,
} from './streetFurniture';
import {
  createEraPedestrianSet,
  era1945Pedestrians,
} from './pedestrians';
import { applyEraLighting, apply1945Grade, era1945Palette } from './palette';
import { createEraAudio, era1945SfxStems, EraAudio } from './audio';
import { era1945Textures } from './textures';

/**
 * EraContent contract (1945).
 *
 * The foundation scaffold declares EraState / EraMeta / StreetFeature /
 * BuildingShell but does not yet declare a shared EraContent interface. To
 * avoid touching shared foundation files (disjoint write ownership), this
 * module declares the EraContent contract here and implements it. The Phase 6
 * integration task consumes `era1945Content` against this shape.
 */
export interface EraContent {
  /** The canonical year this era implements. */
  readonly year: EraYear;
  /** Registry metadata for this era. */
  readonly meta: EraMeta;
  /** The 1945 palette / lighting grade. */
  readonly palette: typeof era1945Palette;
  /** The 1945 buildings (data, one per lot). */
  readonly buildings: typeof era1945Buildings;
  /** The 1945 storefronts. */
  readonly storefronts: typeof era1945Storefronts;
  /** The 1945 advertising. */
  readonly ads: typeof era1945Ads;
  /** The 1945 vehicle definitions. */
  readonly vehicles: typeof era1945Vehicles;
  /** The 1945 pedestrian definitions. */
  readonly pedestrians: typeof era1945Pedestrians;
  /** The 1945 tram-track definition. */
  readonly tramTracks: typeof era1945TramTracks;
  /** The 1945 SFX stems. */
  readonly sfxStems: typeof era1945SfxStems;
  /** The 1945 procedural textures. */
  readonly textures: typeof era1945Textures;
  /** The validated 1945 street features (shared StreetFeature contract). */
  readonly streetFeatures: readonly StreetFeature[];
  /** True when this era is active. */
  readonly active: boolean;

  /**
   * Attach all 1945 content to a scene at the foundation lot anchors.
   * Returns an update step (for animated content) and a dispose function.
   */
  attach(scene: Scene, layout: CityBlockLayout): {
    update(dt: number): void;
    dispose(): void;
  };

  /** Apply the 1945 palette grade / lighting to a scene. */
  applyGrade(scene: Scene): () => void;

  /** Create the 1945 audio rig against a foundation SfxContext. */
  createAudio(sfx: SfxContext): EraAudio;

  /** Whether the content is currently active. */
  setActive(active: boolean): void;
}

const YEAR: EraYear = 1945;
const META = eraRegistry.get(YEAR);

/**
 * The 1945 era content module.
 *
 * Lifecycle: instantiate -> attach (builds meshes) -> update (animates
 * vehicles/pedestrians) -> dispose (removes meshes and lights). Implements the
 * EraContent contract declared above.
 */
export const era1945Content: EraContent = {
  year: YEAR,
  meta: META,
  palette: era1945Palette,
  buildings: era1945Buildings,
  storefronts: era1945Storefronts,
  ads: era1945Ads,
  vehicles: era1945Vehicles,
  pedestrians: era1945Pedestrians,
  tramTracks: era1945TramTracks,
  sfxStems: era1945SfxStems,
  textures: era1945Textures,
  streetFeatures: Object.freeze(era1945StreetFeatures()),
  active: false,

  attach(scene: Scene, layout: CityBlockLayout) {
    const meshes: { dispose(): void }[] = [];
    const disposeMesh = (m: { dispose(): void }) => {
      meshes.push(m);
    };

    // Buildings at lot anchors.
    for (const b of era1945Buildings) {
      const ms = buildEraBuilding(scene, layout, b.lotIndex, b, true);
      // buildEraBuilding returns meshes; wrap as disposable.
      for (const m of ms) {
        disposeMesh({ dispose: () => scene.remove(m) });
      }
    }

    // Storefronts.
    for (const s of era1945Storefronts) {
      const ms = buildEraStorefront(scene, layout, s);
      for (const m of ms) disposeMesh({ dispose: () => scene.remove(m) });
    }

    // Advertising.
    const adMeshes = buildEraAds(scene, layout);
    for (const m of adMeshes) disposeMesh({ dispose: () => scene.remove(m) });

    // Street furniture + tram tracks.
    const furnMeshes = buildEraStreetFurniture(scene, layout);
    for (const m of furnMeshes) disposeMesh({ dispose: () => scene.remove(m) });

    // Lighting grade.
    const removeGrade = applyEraLighting(scene);
    meshes.push({ dispose: removeGrade });

    // Vehicles.
    const fleet = createEraVehicleFleet(scene, layout);

    // Pedestrians.
    const people = createEraPedestrianSet(scene, layout);

    return {
      update(dt: number) {
        for (const v of fleet) v.update(dt);
        for (const p of people) p.update(dt);
      },
      dispose() {
        for (const m of meshes) m.dispose();
        for (const v of fleet) {
          for (const m of v.meshes) scene.remove(m);
        }
        for (const p of people) {
          for (const m of p.meshes) scene.remove(m);
        }
      },
    };
  },

  applyGrade(scene: Scene) {
    return applyEraLighting(scene);
  },

  createAudio(sfx: SfxContext) {
    return createEraAudio(sfx);
  },

  setActive(active: boolean) {
    (era1945Content as { active: boolean }).active = active;
  },
};

/**
 * Convenience: the world-space footprints of 1945 buildings, used by tests
 * and the composition harness to prove buildings land on their lot anchors.
 */
export function era1945BuildingFootprints(
  layout: CityBlockLayout,
): ReturnType<typeof buildingFootprints> {
  return buildingFootprints(layout);
}

/** Convenience: apply the 1945 grade to an RGB triple (for tests). */
export function era1945Grade(color: { r: number; g: number; b: number }) {
  return apply1945Grade(color);
}