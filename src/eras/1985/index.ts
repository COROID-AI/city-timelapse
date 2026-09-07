import { Object3D } from 'three';
import { EraYear } from '../../types/city';
import { CityBlockLayout, createCityBlockLayout } from '../../layout/cityBlockLayout';
import { SfxContext } from '../../audio/sfxContext';
import { create1985Buildings, Era1985BuildingGroup } from './buildings';
import { create1985Storefronts, Era1985StorefrontGroup } from './storefronts';
import { create1985Ads, Era1985AdGroup } from './ads';
import { create1985Vehicles, Era1985VehicleGroup } from './vehicles';
import { create1985StreetFurniture, Era1985StreetFurnitureGroup } from './streetFurniture';
import { create1985Pedestrians, Era1985PedestrianGroup } from './pedestrians';
import { PALETTE_1985, Era1985Palette, compute1985LightingGrade } from './palette';
import { create1985Audio, Era1985Audio } from './audio';

/**
 * EraContent contract representation.
 *
 * Implemented by each self-contained era content module.
 * Mounts onto a Three.js scene and is positioned via the foundation CityBlockLayout lot anchors.
 */
export interface EraContent {
  /** The era year this module delivers. */
  readonly year: EraYear;
  /** Root Object3D container holding all meshes for this era. */
  readonly root: Object3D;
  /** Alias for root (for scene.add(content.group)) */
  readonly group: Object3D;
  /** Palette & lighting definition */
  readonly palette: Era1985Palette;
  /** Building collection */
  readonly buildings: Era1985BuildingGroup;
  /** Storefront collection */
  readonly storefronts: Era1985StorefrontGroup;
  /** Ads collection */
  readonly ads: Era1985AdGroup;
  /** Vehicle collection */
  readonly vehicles: Era1985VehicleGroup;
  /** Street furniture collection */
  readonly streetFurniture: Era1985StreetFurnitureGroup;
  /** Pedestrian collection */
  readonly pedestrians: Era1985PedestrianGroup;
  /** Audio stems and playback */
  readonly audio: Era1985Audio;

  /** Initialize or instantiate against a layout. */
  instantiate(layout: CityBlockLayout, sfxContext?: SfxContext): void;
  /** Per-frame update (animations, traffic, pedestrian walk loops, neon flicker). */
  update(dt: number, timeOfDay?: number): void;
  /** Clean up resources and audio. */
  dispose(): void;
}

/**
 * Factory that creates the 1985 EraContent instance.
 */
export function createEra1985Content(layout?: CityBlockLayout, sfxContext?: SfxContext): EraContent {
  const currentLayout = layout ?? createCityBlockLayout();
  const root = new Object3D();

  // Instantiate subcomponents
  const buildings = create1985Buildings(currentLayout.lots);
  const storefronts = create1985Storefronts(currentLayout.lots);
  const ads = create1985Ads(currentLayout.lots);
  const vehicles = create1985Vehicles(currentLayout);
  const streetFurniture = create1985StreetFurniture(currentLayout);
  const pedestrians = create1985Pedestrians(currentLayout);
  const audio = create1985Audio(sfxContext);

  // Assemble into root container
  root.add(
    buildings.root,
    storefronts.root,
    ads.root,
    vehicles.root,
    streetFurniture.root,
    pedestrians.root,
  );

  const eraContent: EraContent = {
    year: 1985,
    root,
    get group() {
      return root;
    },
    palette: PALETTE_1985,
    buildings,
    storefronts,
    ads,
    vehicles,
    streetFurniture,
    pedestrians,
    audio,

    instantiate(newLayout: CityBlockLayout, newSfx?: SfxContext) {
      // Re-instantiate if needed
      audio.dispose();
      while (root.children.length > 0) {
        root.remove(root.children[0]);
      }
      const b = create1985Buildings(newLayout.lots);
      const s = create1985Storefronts(newLayout.lots);
      const a = create1985Ads(newLayout.lots);
      const v = create1985Vehicles(newLayout);
      const f = create1985StreetFurniture(newLayout);
      const p = create1985Pedestrians(newLayout);
      const au = create1985Audio(newSfx);

      root.add(b.root, s.root, a.root, v.root, f.root, p.root);

      (eraContent as { buildings: Era1985BuildingGroup }).buildings = b;
      (eraContent as { storefronts: Era1985StorefrontGroup }).storefronts = s;
      (eraContent as { ads: Era1985AdGroup }).ads = a;
      (eraContent as { vehicles: Era1985VehicleGroup }).vehicles = v;
      (eraContent as { streetFurniture: Era1985StreetFurnitureGroup }).streetFurniture = f;
      (eraContent as { pedestrians: Era1985PedestrianGroup }).pedestrians = p;
      (eraContent as { audio: Era1985Audio }).audio = au;
    },

    update(dt: number, timeOfDay = 0.5) {
      vehicles.update(dt);
      pedestrians.update(dt);
      storefronts.update(timeOfDay, dt);
      ads.update(timeOfDay, dt);
      streetFurniture.update(timeOfDay);
      audio.update(dt);
    },

    dispose() {
      audio.dispose();
      while (root.children.length > 0) {
        root.remove(root.children[0]);
      }
    },
  };

  return eraContent;
}

/**
 * Authoritative era1985Content export meeting the producedExports contract.
 */
export const era1985Content: EraContent = createEra1985Content();

export {
  PALETTE_1985,
  compute1985LightingGrade,
};
