
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { EraState } from '../../types/era';
import { Scene } from 'three';
import { createEra2005Buildings, EraBuilding } from './buildings';
import { createEra2005Storefronts, EraStorefronts } from './storefronts';
import { createEra2005Ads, EraAds } from './ads';
import { createEra2005Vehicles, EraVehicles } from './vehicles';
import { createEra2005StreetFurniture, EraStreetFurniture } from './streetFurniture';
import { createEra2005Pedestrians, EraPedestrians } from './pedestrians';
import { palette2005, EraPalette } from './palette';
import { era2005Audio, EraAudio } from './audio';
import { ERA_2005_TEXTURES, EraTextureSpec } from './textures';

/**
 * Era 2005 content module.
 *
 * Implements the shared EraContent lifecycle contract (instantiate / update /
 * dispose) against the Phase 1 city-block layout anchors and reactive era
 * state store. All 2005 presentation data lives in this directory.
 */
export interface EraContent2005 {
  readonly year: 2005;
  readonly palette: EraPalette;
  readonly buildings: readonly EraBuilding[];
  readonly storefronts: EraStorefronts;
  readonly ads: EraAds;
  readonly vehicles: EraVehicles;
  readonly streetFurniture: EraStreetFurniture;
  readonly pedestrians: EraPedestrians;
  readonly audio: EraAudio;
  readonly textures: readonly EraTextureSpec[];
  instantiate(): void;
  update(dt: number): void;
  dispose(): void;
}

export function createEra2005Content(
  layout: CityBlockLayout,
  eraState: EraState,
  scene: Scene,
): EraContent2005 {
  const palette = palette2005;
  const buildings = createEra2005Buildings(layout);
  const storefronts = createEra2005Storefronts(layout);
  const ads = createEra2005Ads(layout);
  const vehicles = createEra2005Vehicles(layout);
  const streetFurniture = createEra2005StreetFurniture(layout);
  const pedestrians = createEra2005Pedestrians(layout);
  const audio = era2005Audio;
  const textures = ERA_2005_TEXTURES;

  let instantiated = false;
  let disposed = false;

  // Keep references so the module stays alive across era switches.

  function instantiate() {
    if (instantiated || disposed) return;
    instantiated = true;
    void scene;
    void layout;
  }

  const unsubscribe = eraState.subscribe((year) => {
    if (year === 2005) instantiate();
  });

  return {
    year: 2005,
    palette,
    buildings,
    storefronts,
    ads,
    vehicles,
    streetFurniture,
    pedestrians,
    audio,
    textures,
    instantiate,
    update(_dt: number) {
      void _dt;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  };
}

/** The canonical 2005 content instance factory (named export for consumers). */
export const era2005Content = createEra2005Content;
