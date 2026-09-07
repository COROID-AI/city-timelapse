/**
 * Era 2025: smart-city EV-era city block content module.
 *
 * The complete 2025 presentation of the city block, built on top of the
 * Phase 1 layout contract. This module is self-contained: all content lives
 * under `src/eras/2025/`. It implements the `EraContent` contract that the
 * Phase 6 integration task consumes and registers via `era2025Content`.
 */

import { EraYear } from '../../types/city';
import { EraState } from '../../types/era';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { BuildingShell } from '../../types/buildingShell';
import { SfxContext } from '../../audio/sfxContext';
import { buildBuildings, Building } from './buildings';
import { storefronts, Storefront } from './storefronts';
import { advertisements, Advertisement } from './ads';
import { vehicles, Vehicle } from './vehicles';
import { streetFurniture, toStreetFeatures, StreetFurniture } from './streetFurniture';
import { pedestrians, Pedestrian } from './pedestrians';
import { palette, Palette } from './palette';
import { audioStems, AudioStems } from './audio';
import { textures, Texture } from './textures';

/**
 * The shared era content contract implemented by every era module.
 *
 * Declared here because the Phase 1 foundation defines the supporting types
 * (EraState, CityBlockLayout, SfxContext) but does not itself declare a
 * single `EraContent` interface. This is the repository-compatible surface
 * era modules export for the Phase 6 integration task to consume.
 */
export interface EraContent {
  /** Canonical year this module renders. */
  readonly year: EraYear;
  /** Human-readable label. */
  readonly label: string;
  /** Thematic description. */
  readonly description: string;
  /** Palette and lighting grade. */
  readonly palette: Palette;
  /** Era ambience / SFX stems. */
  readonly audio: AudioStems;
  /** Buildings placed on the lot shells. */
  readonly buildings: readonly Building[];
  /** Storefronts / signage. */
  readonly storefronts: readonly Storefront[];
  /** Street-level advertising. */
  readonly advertisements: readonly Advertisement[];
  /** Vehicle traffic mix. */
  readonly vehicles: readonly Vehicle[];
  /** Street furniture. */
  readonly streetFurniture: readonly StreetFurniture[];
  /** Pedestrians and outfits. */
  readonly pedestrians: readonly Pedestrian[];
  /** Material textures. */
  readonly textures: readonly Texture[];
  /** Street features mapped to the shared contract. */
  streetFeatures(): ReturnType<typeof toStreetFeatures>;
  /**
   * Instantiate the era against the real foundation layout and era state.
   * Called when the scene switches to 2025.
   */
  instantiate(layout: CityBlockLayout, state: EraState, sfx: SfxContext): void;
  /**
   * Advance the scene by `dt` seconds. Stepped each frame while active.
   */
  update(dt: number): void;
  /** Dispose the era, releasing any resources. */
  dispose(): void;
}

/** The 2025 smart-city EV era content module. */
export const era2025Content: EraContent = {
  year: 2025,
  label: '2025',
  description: 'Smart-city EV era: glass tower, EV traffic, digital advertising.',
  palette,
  audio: audioStems,
  buildings: buildBuildings(createDefaultShells()),
  storefronts,
  advertisements,
  vehicles,
  streetFurniture,
  pedestrians,
  textures,
  streetFeatures: toStreetFeatures,
  instantiate() {
    // Content is static data; instantiation registers nothing mutable.
    // The integration owner wires scene meshes from this data.
  },
  update(_dt: number) {
    // No per-frame mutable state in the data module.
  },
  dispose() {
    // Nothing to release: all content is static data.
  },
};

/**
 * Build placeholder shells used to derive the building set before the
 * integration task supplies the real layout. The buildings only key off the
 * lot index, so these shells are sufficient for content derivation.
 */
function createDefaultShells(): BuildingShell[] {
  const shells: BuildingShell[] = [];
  for (let i = 0; i < 10; i++) {
    shells.push({
      id: `shell-${i}`,
      rect: { origin: { x: 0, z: 0 }, width: 12, depth: 28 },
      height: 8 + (i % 4) * 3,
      rotation: 0,
      era: 2025,
    });
  }
  return shells;
}