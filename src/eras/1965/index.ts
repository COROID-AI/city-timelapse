import { Object3D, Scene } from 'three';
import { CityBlockLayout } from '../../layout/cityBlockLayout';
import { EraState } from '../../types/era';
import { SfxContext } from '../../audio/sfxContext';
import { EraYear } from '../../types/city';
import { ERA_1965_PALETTE, Era1965Palette } from './palette';
import { Building1965, create1965Buildings } from './buildings';
import { AdSystem, create1965Ads } from './ads';
import { VehicleSystem, create1965Vehicles } from './vehicles';
import { StreetFurnitureInstance, create1965StreetFurniture } from './streetFurniture';
import { PedestrianSystem, create1965Pedestrians } from './pedestrians';
import { Era1965Audio, create1965Audio } from './audio';

/**
 * EraContent Contract Definition.
 *
 * Each era module implements this contract, providing full visual and audio lifecycle
 * management against the foundation CityBlockLayout lot anchors, EraState, and SfxContext.
 */
export interface EraContentContext {
  scene: Scene;
  layout: CityBlockLayout;
  eraState?: EraState;
  sfxContext?: SfxContext;
}

export interface EraContent {
  readonly year: EraYear;
  readonly palette: Era1965Palette;
  readonly root: Object3D;
  readonly buildings: readonly Building1965[];
  readonly ads: AdSystem;
  readonly vehicles: VehicleSystem;
  readonly streetFurniture: readonly StreetFurnitureInstance[];
  readonly pedestrians: PedestrianSystem;
  readonly audio: Era1965Audio;
  instantiate(context: EraContentContext): void;
  update(dt: number): void;
  dispose(): void;
}

/**
 * Factory creating the 1965 EraContent instance.
 */
export function createEra1965Content(initialContext?: EraContentContext): EraContent {
  const root = new Object3D();

  let currentContext: EraContentContext | null = null;
  let unsubscribeEraState: (() => void) | null = null;
  let elapsedTime = 0;

  // Subsystems (initialized on instantiate or with dummy layout)
  let buildingsData: { buildings: Building1965[]; root: Object3D } | null = null;
  let adsData: AdSystem | null = null;
  let vehiclesData: VehicleSystem | null = null;
  let furnitureData: { items: StreetFurnitureInstance[]; root: Object3D } | null = null;
  let pedestriansData: PedestrianSystem | null = null;
  let audioData: Era1965Audio | null = null;

  function buildAll(context: EraContentContext): void {
    currentContext = context;

    // 1. Architecture / Buildings on Lot Anchors
    buildingsData = create1965Buildings(context.layout);
    root.add(buildingsData.root);

    // 2. Advertisements, Billboard & Neon
    adsData = create1965Ads();
    root.add(adsData.root);

    // 3. Vehicles & Traffic Loop
    vehiclesData = create1965Vehicles(context.layout);
    root.add(vehiclesData.root);

    // 4. Street Furniture
    furnitureData = create1965StreetFurniture(context.layout);
    root.add(furnitureData.root);

    // 5. Pedestrians
    pedestriansData = create1965Pedestrians(context.layout);
    root.add(pedestriansData.root);

    // 6. Audio Stems
    audioData = create1965Audio(context.sfxContext);

    // Attach root to Scene
    context.scene.add(root);

    // Subscribe to EraState to activate / deactivate when slider changes
    if (context.eraState) {
      const checkEra = (year: EraYear) => {
        if (year === 1965) {
          root.position.y = 0; // active in scene
          audioData?.start();
        } else {
          // Inactive or transitioning out
          audioData?.stop();
        }
      };

      unsubscribeEraState = context.eraState.subscribe(checkEra);
      checkEra(context.eraState.year);
    } else {
      audioData.start();
    }
  }

  if (initialContext) {
    buildAll(initialContext);
  }

  const content: EraContent = {
    year: 1965,
    palette: ERA_1965_PALETTE,
    get root() {
      return root;
    },
    get buildings() {
      return buildingsData ? buildingsData.buildings : [];
    },
    get ads() {
      if (!adsData) {
        adsData = create1965Ads();
      }
      return adsData;
    },
    get vehicles() {
      if (!vehiclesData && currentContext) {
        vehiclesData = create1965Vehicles(currentContext.layout);
      }
      return vehiclesData!;
    },
    get streetFurniture() {
      return furnitureData ? furnitureData.items : [];
    },
    get pedestrians() {
      if (!pedestriansData && currentContext) {
        pedestriansData = create1965Pedestrians(currentContext.layout);
      }
      return pedestriansData!;
    },
    get audio() {
      if (!audioData) {
        audioData = create1965Audio(currentContext?.sfxContext);
      }
      return audioData;
    },

    instantiate(context: EraContentContext) {
      if (currentContext) {
        content.dispose();
      }
      buildAll(context);
    },

    update(dt: number) {
      elapsedTime += dt;

      // Update storefront animations
      if (buildingsData) {
        for (const b of buildingsData.buildings) {
          if (b.storefront) {
            b.storefront.update(dt, elapsedTime);
          }
        }
      }

      // Update Ads / Neon flicker
      adsData?.update(dt, elapsedTime);

      // Update Vehicles traffic
      vehiclesData?.update(dt);

      // Update Pedestrians walk cycles
      pedestriansData?.update(dt, elapsedTime);

      // Update Audio modulation
      audioData?.update(dt, elapsedTime);
    },

    dispose() {
      if (unsubscribeEraState) {
        unsubscribeEraState();
        unsubscribeEraState = null;
      }

      audioData?.dispose();
      audioData = null;

      if (currentContext && currentContext.scene) {
        currentContext.scene.remove(root);
      }

      // Remove all children from root
      while (root.children.length > 0) {
        const child = root.children[0];
        root.remove(child);
      }

      buildingsData = null;
      adsData = null;
      vehiclesData = null;
      furnitureData = null;
      pedestriansData = null;
      currentContext = null;
      elapsedTime = 0;
    },
  };

  return content;
}

/**
 * Authoritative default export for 1965 EraContent.
 */
export const era1965Content: EraContent = createEra1965Content();
