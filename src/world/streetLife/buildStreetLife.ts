/**
 * Street Life Builder: Vehicles, Pedestrians, Outfits and Animation
 *
 * Primary entry point for Phase 3 Street Life:
 * - `buildStreetLife(era, layout?, theme?, options?)`: returns a `StreetLifeGroup` containing
 *   the era's vehicle fleet and pedestrian crowd.
 * - Exposes the downstream morph and transition contract (`update(dt, elapsed)`,
 *   `setOpacity(alpha)`, `setTransitionProgress(p)`, `dispose()`).
 * - Emits default themes for all 5 requested eras (`ERA_YEARS`: 1945, 1965, 1985, 2005, 2025).
 */

import * as THREE from 'three';
import { ERA_YEARS, type EraId, type EraTheme } from '../../era/types';
import { ERA_PALETTES } from '../../era/palette';
import { createBlockLayout, type BlockLayout } from '../layout';
import { createSeededRng } from '../../lib/rng';
import { createEraFleet, updateVehicles, type VehicleInstance } from './vehicles';
import { createEraCrowd, updatePedestrians, type PedestrianInstance } from './pedestrians';

export interface StreetLifeOptions {
  seed?: number;
  vehicleCount?: number;
  pedestrianCount?: number;
  includeMicromobility?: boolean;
}

export interface StreetLifeGroup {
  readonly group: THREE.Group;
  readonly era: EraId;
  readonly layout: BlockLayout;
  readonly theme: EraTheme;
  readonly vehicles: VehicleInstance[];
  readonly pedestrians: PedestrianInstance[];
  readonly materials: THREE.Material[];
  readonly geometries: THREE.BufferGeometry[];
  readonly isDisposed: boolean;

  update(dt: number, elapsed?: number): void;
  setOpacity(opacity: number): void;
  setTransitionProgress(progress: number): void;
  setScale(scale: number): void;
  dispose(): void;
}

// ============================================================================
// Default Era Themes (1945, 1965, 1985, 2005, 2025)
// ============================================================================

export function createDefaultEraTheme(era: EraId): EraTheme {
  const palette = ERA_PALETTES[era];

  switch (era) {
    case 1945:
      return {
        id: 1945,
        label: 'Wartime 1945',
        description: 'Pre-war brick architecture, rounded sedans and trucks, wartime wool coats and fedoras.',
        palette,
        buildings: {
          heightRange: [12, 28],
          windowStyle: 'small-paned',
          roofStyle: 'cornice',
          facadeMaterial: 'brick-sandstone',
          storefrontFrontage: 0.6,
        },
        vehicles: {
          bodyStyle: 'rounded-sedan',
          colors: ['#26262a', '#1e2b37', '#3b2c20', '#283228', '#453830'],
          lengthRange: [4.5, 5.4],
          speedRange: [6, 9],
          lightGlow: 0.3,
        },
        storefronts: {
          signStyle: 'painted',
          awningStyle: 'striped',
          windowDressing: 'paper-displays',
          awningDensity: 0.8,
        },
        ads: {
          medium: 'painted-billboard',
          brightness: 0.4,
          colors: ['#b03a2e', '#4c4540', '#8c5a3b'],
          density: 0.4,
        },
        pedestrians: {
          outfitStyle: 'wartime-coats',
          outfitColors: ['#4a453b', '#5c5446', '#3b4044', '#665948', '#2e3338'],
          walkSpeedRange: [1.0, 1.3],
          density: 0.5,
          accessoryKeywords: ['fedora', 'cloche-hat', 'briefcase', 'vintage-handbag'],
        },
        atmosphere: {
          airQuality: 'dusty',
          haze: 0.3,
          precipitation: 'none',
          daylightMood: 'warm-amber',
        },
        ambience: {
          streetNoise: 0.4,
          soundscape: 'big-band-street',
          streetActivity: 0.5,
        },
      };

    case 1965:
      return {
        id: 1965,
        label: 'Mid-Century 1965',
        description: 'Pastel optimism, finned cruisers with two-tone paint, mod tailoring and sunglasses.',
        palette,
        buildings: {
          heightRange: [16, 36],
          windowStyle: 'horizontal-ribbon',
          roofStyle: 'flat-overhang',
          facadeMaterial: 'pastel-stucco',
          storefrontFrontage: 0.7,
        },
        vehicles: {
          bodyStyle: 'finned-cruiser',
          colors: ['#38a3a5', '#e27396', '#eaac8b', '#577590', '#f4f1de'],
          lengthRange: [4.8, 5.6],
          speedRange: [8, 11],
          lightGlow: 0.5,
        },
        storefronts: {
          signStyle: 'neon-script',
          awningStyle: 'flat-canopy',
          windowDressing: 'mannequins',
          awningDensity: 0.6,
        },
        ads: {
          medium: 'neon-sign',
          brightness: 0.7,
          colors: ['#ff6f91', '#1fa3a3', '#f5e6c8'],
          density: 0.6,
        },
        pedestrians: {
          outfitStyle: 'mod-tailoring',
          outfitColors: ['#1fa3a3', '#ff6f91', '#f5e6c8', '#4a6fa5', '#e07a5f'],
          walkSpeedRange: [1.1, 1.4],
          density: 0.6,
          accessoryKeywords: ['sunglasses', 'mod-handbag', 'newsboy-cap'],
        },
        atmosphere: {
          airQuality: 'clear',
          haze: 0.15,
          precipitation: 'none',
          daylightMood: 'bright-optimistic',
        },
        ambience: {
          streetNoise: 0.5,
          soundscape: 'jazz-pop-street',
          streetActivity: 0.6,
        },
      };

    case 1985:
      return {
        id: 1985,
        label: 'Neon 1985',
        description: 'Smoggy concrete skyline, boxy sedans and station wagons, neon windbreakers and headphones.',
        palette,
        buildings: {
          heightRange: [22, 50],
          windowStyle: 'tinted-strip',
          roofStyle: 'flat-parapet',
          facadeMaterial: 'concrete-glass',
          storefrontFrontage: 0.65,
        },
        vehicles: {
          bodyStyle: 'boxy-sedan',
          colors: ['#9e2a2b', '#335c67', '#e09f3e', '#540b0e', '#7f7f87'],
          lengthRange: [4.4, 5.2],
          speedRange: [9, 12],
          lightGlow: 0.6,
        },
        storefronts: {
          signStyle: 'illuminated-plastic',
          awningStyle: 'retractable',
          windowDressing: 'electronic-goods',
          awningDensity: 0.5,
        },
        ads: {
          medium: 'neon-billboard',
          brightness: 0.9,
          colors: ['#ff2bd6', '#00e5ff', '#ffe600'],
          density: 0.8,
        },
        pedestrians: {
          outfitStyle: 'neon-80s',
          outfitColors: ['#ff2bd6', '#00e5ff', '#ffe600', '#7b2cbf', '#ff5400'],
          walkSpeedRange: [1.2, 1.5],
          density: 0.7,
          accessoryKeywords: ['headphones', 'neon-cap', 'sunglasses', 'cassette-player'],
        },
        atmosphere: {
          airQuality: 'smoggy',
          haze: 0.35,
          precipitation: 'none',
          daylightMood: 'amber-smog',
        },
        ambience: {
          streetNoise: 0.65,
          soundscape: 'synthwave-bustle',
          streetActivity: 0.7,
        },
      };

    case 2005:
      return {
        id: 2005,
        label: 'Millennium 2005',
        description: 'Glass commercial towers, rounded crossovers and hatchbacks, Y2K denim with flip phones.',
        palette,
        buildings: {
          heightRange: [28, 65],
          windowStyle: 'glass-curtain',
          roofStyle: 'mechanical-screen',
          facadeMaterial: 'steel-glass-panels',
          storefrontFrontage: 0.75,
        },
        vehicles: {
          bodyStyle: 'crossover',
          colors: ['#cfd8dc', '#546e7a', '#78909c', '#37474f', '#90a4ae'],
          lengthRange: [4.1, 4.9],
          speedRange: [10, 13],
          lightGlow: 0.7,
        },
        storefronts: {
          signStyle: 'channel-letters',
          awningStyle: 'glass-steel',
          windowDressing: 'digital-lifestyle',
          awningDensity: 0.4,
        },
        ads: {
          medium: 'large-print-billboard',
          brightness: 0.75,
          colors: ['#1f6feb', '#bfe3ff', '#b9c4cc'],
          density: 0.7,
        },
        pedestrians: {
          outfitStyle: 'y2k-denim',
          outfitColors: ['#415a77', '#778da9', '#e0e1dd', '#1b263b', '#a3b18a'],
          walkSpeedRange: [1.1, 1.4],
          density: 0.7,
          accessoryKeywords: ['flip-phone', 'messenger-bag', 'beanie'],
        },
        atmosphere: {
          airQuality: 'clean',
          haze: 0.1,
          precipitation: 'none',
          daylightMood: 'crisp-blue',
        },
        ambience: {
          streetNoise: 0.6,
          soundscape: 'urban-traffic-hum',
          streetActivity: 0.7,
        },
      };

    case 2025:
    default:
      return {
        id: 2025,
        label: 'Modern Green 2025',
        description: 'Green-roofed biophilic towers, sleek EVs, e-scooters and bike lanes, athleisure with smartphones.',
        palette,
        buildings: {
          heightRange: [35, 80],
          windowStyle: 'smart-glass',
          roofStyle: 'green-roof-solar',
          facadeMaterial: 'composite-timber-glass',
          storefrontFrontage: 0.8,
        },
        vehicles: {
          bodyStyle: 'ev-modern',
          colors: ['#e8edf0', '#263238', '#00897b', '#37474f', '#80cbc4'],
          lengthRange: [1.1, 4.8],
          speedRange: [5, 14],
          lightGlow: 0.9,
        },
        storefronts: {
          signStyle: 'digital-oled',
          awningStyle: 'solar-canopy',
          windowDressing: 'interactive-screens',
          awningDensity: 0.45,
        },
        ads: {
          medium: 'led-video-wall',
          brightness: 0.95,
          colors: ['#2ee6a8', '#9dffd0', '#7fbf9c'],
          density: 0.75,
        },
        pedestrians: {
          outfitStyle: 'athleisure',
          outfitColors: ['#2d3142', '#4f5d75', '#bfc0c0', '#4f9f7f', '#ffffff'],
          walkSpeedRange: [1.2, 1.5],
          density: 0.8,
          accessoryKeywords: ['smartphone', 'wireless-earbuds', 'modern-backpack'],
        },
        atmosphere: {
          airQuality: 'clear-eco',
          haze: 0.05,
          precipitation: 'none',
          daylightMood: 'golden-green',
        },
        ambience: {
          streetNoise: 0.45,
          soundscape: 'ev-hum-bustle',
          streetActivity: 0.8,
        },
      };
  }
}

export const DEFAULT_ERA_THEMES: Record<EraId, EraTheme> = {
  1945: createDefaultEraTheme(1945),
  1965: createDefaultEraTheme(1965),
  1985: createDefaultEraTheme(1985),
  2005: createDefaultEraTheme(2005),
  2025: createDefaultEraTheme(2025),
};

// ============================================================================
// Top-Level Street Life Builder Implementation
// ============================================================================

export function buildStreetLife(
  era: EraId,
  layoutArg?: BlockLayout,
  themeArg?: EraTheme,
  options: StreetLifeOptions = {},
): StreetLifeGroup {
  if (!ERA_YEARS.includes(era)) {
    throw new Error(`buildStreetLife: unsupported era ${String(era)}`);
  }

  const seed = options.seed ?? 1000 + era;
  const rng = createSeededRng(seed);

  const layout = layoutArg ?? createBlockLayout(seed);
  const theme = themeArg ?? createDefaultEraTheme(era);

  const rootGroup = new THREE.Group();
  rootGroup.name = `streetLife-${era}`;

  const allGeometries: THREE.BufferGeometry[] = [];
  const allMaterials: THREE.Material[] = [];

  // 1. Build Vehicles
  const fleetResult = createEraFleet(
    era,
    layout,
    theme,
    {
      count: options.vehicleCount,
      includeMicromobility: options.includeMicromobility ?? (era === 2025),
    },
    rng,
  );

  const vehiclesGroup = new THREE.Group();
  vehiclesGroup.name = `vehicles-${era}`;
  for (const v of fleetResult.vehicles) {
    vehiclesGroup.add(v.mesh);
  }
  rootGroup.add(vehiclesGroup);
  allGeometries.push(...fleetResult.geometries);
  allMaterials.push(...fleetResult.materials);

  // 2. Build Pedestrians
  const crowdResult = createEraCrowd(
    era,
    layout,
    theme,
    {
      count: options.pedestrianCount,
    },
    rng,
  );

  const pedestriansGroup = new THREE.Group();
  pedestriansGroup.name = `pedestrians-${era}`;
  for (const p of crowdResult.pedestrians) {
    pedestriansGroup.add(p.mesh);
  }
  rootGroup.add(pedestriansGroup);
  allGeometries.push(...crowdResult.geometries);
  allMaterials.push(...crowdResult.materials);

  // Initial update to snap all entities to initial layout coordinates
  updateVehicles(fleetResult.vehicles, 0);
  updatePedestrians(crowdResult.pedestrians, 0, layout);

  let disposed = false;

  const streetLifeInstance: StreetLifeGroup = {
    group: rootGroup,
    era,
    layout,
    theme,
    vehicles: fleetResult.vehicles,
    pedestrians: crowdResult.pedestrians,
    materials: allMaterials,
    geometries: allGeometries,

    get isDisposed(): boolean {
      return disposed;
    },

    update(dt: number): void {
      if (disposed) return;
      updateVehicles(fleetResult.vehicles, dt);
      updatePedestrians(crowdResult.pedestrians, dt, layout);
    },

    setOpacity(opacity: number): void {
      if (disposed) return;
      const clamped = Math.max(0, Math.min(1, opacity));
      for (const mat of allMaterials) {
        mat.transparent = true;
        mat.opacity = clamped;
        mat.needsUpdate = true;
      }
    },

    setTransitionProgress(progress: number): void {
      if (disposed) return;
      const clamped = Math.max(0, Math.min(1, progress));
      this.setOpacity(clamped);
    },

    setScale(scale: number): void {
      if (disposed) return;
      rootGroup.scale.set(scale, scale, scale);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      // Dispose all registered geometries
      for (const geom of allGeometries) {
        try {
          geom.dispose();
        } catch {
          // ignore
        }
      }

      // Dispose all registered materials
      for (const mat of allMaterials) {
        try {
          mat.dispose();
        } catch {
          // ignore
        }
      }

      // Traverse scene graph for any nested resources
      rootGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          try {
            obj.geometry?.dispose();
          } catch {
            // ignore
          }
          if (Array.isArray(obj.material)) {
            for (const m of obj.material) {
              try {
                m.dispose();
              } catch {
                // ignore
              }
            }
          } else if (obj.material) {
            try {
              obj.material.dispose();
            } catch {
              // ignore
            }
          }
        }
      });

      rootGroup.clear();
      fleetResult.vehicles.length = 0;
      crowdResult.pedestrians.length = 0;
      allGeometries.length = 0;
      allMaterials.length = 0;
    },
  };

  return streetLifeInstance;
}
