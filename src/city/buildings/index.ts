/**
 * buildings-api — the era-evolving building layer for the block corner.
 *
 * Builds six to eight detailed procedural buildings whose massing, facade
 * materials, window grids, cornices, fire escapes, entrances, storefront bay
 * frames, and rooftop worlds morph across 1945 / 1965 / 1985 / 2005 / 2025.
 *
 * Every building implements the shared `EraTransformable` contract on the
 * `facade` choreography stage (so facades lead the transition), and the module
 * exposes:
 * - `storefrontBays`: the 6-unit-pitch / 5-unit-clear bay slots at y=0.15 the
 *   storefront module fills (signage and interiors stay downstream — only the
 *   era-morphing bay frames are owned here),
 * - `pickables`: per-building pick descriptors for click-to-focus callouts.
 *
 * All geometry and materials are procedural through the shared gfx material
 * library; windows, lintels, AC units, fire-escape parts, and solar arrays are
 * instanced for near-60fps repetition.
 */

import * as THREE from 'three';
import type { EraMorphStage, EraTransformRegistry, EraTransformable } from '../../era/contracts';
import { ProceduralGfxLibrary } from '../../gfx/materials';
import { createFacade, type FacadeFrame, type FacadeRig } from './facades';
import { createRooftop, type RooftopRig } from './rooftops';
import {
  BLOCK_ALIGNMENT,
  BUILDING_ERAS,
  BUILDING_LOTS,
  baseHeightFor,
  clamp01,
  createBuildingBuildContext,
  detailWeight,
  eraWeightMap,
  lerp,
  slotCenterWorld,
  topHeightFor,
  type BuildingBuildContext,
  type BuildingEraBlend,
  type BuildingEraYear,
  type BuildingLot,
  type BuildingsGfxLibrary,
} from './variants';

// Public buildings-api vocabulary for the integration owner.
export {
  BLOCK_ALIGNMENT,
  BUILDING_ERAS,
  BUILDING_LOTS,
  ERA_TREATMENTS,
  FRONTAGE_LINE,
  STREET_HALF_WIDTH,
} from './variants';
export type {
  BuildingEraBlend,
  BuildingEraYear,
  BuildingLot,
  BuildingsGfxLibrary,
  EraCorniceStyle,
  EraRoofWorld,
  EraTreatment,
  EraWindowStyle,
  LotFrontage,
} from './variants';
export type { FacadeFrame } from './facades';

/**
 * One storefront bay slot a downstream storefront module fills. Positions are
 * world-space; `anchor` is a stable era-independent Object3D parented into the
 * building so shopfront interiors stay attached while the facade morphs.
 */
export interface StorefrontBay {
  /** Stable id: `${buildingId}:f${frontIndex}:s${slotIndex}`. */
  bayId: string;
  buildingId: string;
  buildingName: string;
  frontIndex: number;
  slotIndex: number;
  /** World-space center of the bay opening, y pinned to the base height. */
  position: THREE.Vector3;
  /** Unit outward normal of the bay face. */
  facing: THREE.Vector3;
  /** Clear bay opening width (5). */
  width: number;
  /** Bay slot pitch along the frontage (6). */
  slotPitch: number;
  /** Base height of the opening (0.15, flush with the sidewalk top). */
  baseY: number;
  /** Era-independent anchor object for storefront interiors/signage. */
  anchor: THREE.Object3D;
}

/**
 * Pickable descriptor for click-to-focus. Structurally compatible with the
 * navigation module's `PickableDescriptor` ({ id, object, focusDistance?,
 * focusHeight? }) plus building identity for era-aware callout content.
 */
export interface BuildingPickDescriptor {
  id: string;
  object: THREE.Object3D;
  focusDistance?: number;
  focusHeight?: number;
  buildingId: string;
  buildingName: string;
}

/** One era-morphing building registered with the transform registry. */
export interface Building extends EraTransformable {
  readonly id: string;
  readonly name: string;
  readonly lot: BuildingLot;
  readonly group: THREE.Group;
  readonly bays: readonly StorefrontBay[];
  readonly pickable: BuildingPickDescriptor;
  /** Continuous massing top height above road level after the last frame. */
  readonly topHeight: number;
  /** Era years whose facade layer group is currently visible. */
  visibleEras(): BuildingEraYear[];
}

class BuildingImpl implements Building {
  readonly stage: EraMorphStage = 'facade';
  readonly id: string;
  readonly name: string;
  readonly lot: BuildingLot;
  readonly group: THREE.Group;
  readonly bays: readonly StorefrontBay[];
  readonly pickable: BuildingPickDescriptor;

  readonly #facade: FacadeRig;
  readonly #roof: RooftopRig;
  readonly #baseHeight: number;
  #topHeight: number;

  constructor(lot: BuildingLot, lotIndex: number, ctx: BuildingBuildContext) {
    this.id = lot.id;
    this.name = lot.name;
    this.lot = lot;
    this.#baseHeight = baseHeightFor(lot);
    this.#topHeight = lot.massing[BUILDING_ERAS[0]];

    this.group = new THREE.Group();
    this.group.name = `building:${lot.id}`;
    this.group.position.set((lot.x0 + lot.x1) / 2, 0, (lot.z0 + lot.z1) / 2);
    this.group.userData = { part: 'building', id: lot.id, name: lot.name };

    this.#facade = createFacade(lot, ctx, lotIndex);
    this.#roof = createRooftop(lot, ctx);
    this.group.add(this.#facade.group);
    this.group.add(this.#roof.anchor);

    // Storefront bay descriptors + stable anchors.
    const bays: StorefrontBay[] = [];
    const centerX = (lot.x0 + lot.x1) / 2;
    const centerZ = (lot.z0 + lot.z1) / 2;
    lot.fronts.forEach((front, frontIndex) => {
      const facing =
        front.facing === 'south'
          ? new THREE.Vector3(0, 0, -1)
          : front.facing === 'north'
            ? new THREE.Vector3(0, 0, 1)
            : front.facing === 'west'
              ? new THREE.Vector3(-1, 0, 0)
              : new THREE.Vector3(1, 0, 0);
      for (let slotIndex = 0; slotIndex < front.bays; slotIndex++) {
        const along = slotCenterWorld(front, slotIndex);
        const isXAxis = front.facing === 'south' || front.facing === 'north';
        const position = isXAxis
          ? new THREE.Vector3(
              along,
              BLOCK_ALIGNMENT.bayBaseY,
              front.facing === 'south' ? lot.z0 : lot.z1,
            )
          : new THREE.Vector3(
              front.facing === 'west' ? lot.x0 : lot.x1,
              BLOCK_ALIGNMENT.bayBaseY,
              along,
            );
        const bayId = `${lot.id}:f${frontIndex}:s${slotIndex}`;
        const anchor = new THREE.Object3D();
        anchor.name = `bay:${bayId}`;
        anchor.position.set(
          position.x - centerX,
          BLOCK_ALIGNMENT.bayBaseY,
          position.z - centerZ,
        );
        anchor.userData = { part: 'storefront-bay', bayId };
        this.group.add(anchor);
        bays.push({
          bayId,
          buildingId: lot.id,
          buildingName: lot.name,
          frontIndex,
          slotIndex,
          position,
          facing,
          width: BLOCK_ALIGNMENT.bayClearWidth,
          slotPitch: BLOCK_ALIGNMENT.baySlotPitch,
          baseY: BLOCK_ALIGNMENT.bayBaseY,
          anchor,
        });
      }
    });
    this.bays = bays;

    const width = lot.x1 - lot.x0;
    const depth = lot.z1 - lot.z0;
    this.pickable = {
      id: `building:${lot.id}`,
      object: this.group,
      focusDistance: Math.round(Math.hypot(width, depth) * 1.6),
      focusHeight: 1.7,
      buildingId: lot.id,
      buildingName: lot.name,
    };

    // Sync the initial era (first timeline stop) before the first frame.
    const first = BUILDING_ERAS[0];
    this.applyEraBlend({ from: first, to: first, fraction: 0 }, 0, 1);
  }

  get topHeight(): number {
    return this.#topHeight;
  }

  visibleEras(): BuildingEraYear[] {
    return this.#facade.layers.filter((layer) => layer.group.visible).map((layer) => layer.era);
  }

  /**
   * Apply one staged transition frame:
   * - era weights crossfade facade skins, glazing, storefront frames,
   *   entrances, fire escapes, AC units, and rooftop layers (facade stage),
   * - the upper massing section scales continuously with the blend fraction,
   * - secondary details settle with the stage-local detail weight so surfaces
   *   lead and detail trails without ever popping at rest.
   */
  applyEraBlend(blend: BuildingEraBlend, _stageOffset: number, progress: number): void {
    const weights = eraWeightMap(blend);
    const fraction = clamp01(blend.fraction);
    const p = clamp01(progress);

    const detail = new Map<BuildingEraYear, number>();
    for (const era of BUILDING_ERAS) {
      detail.set(era, detailWeight(weights.get(era) ?? 0, p));
    }

    const topSection = lerp(
      topHeightFor(this.lot, blend.from),
      topHeightFor(this.lot, blend.to),
      fraction,
    );
    this.#topHeight = this.#baseHeight + topSection;

    const frame: FacadeFrame = {
      weights,
      detail,
      topSection,
      topTotal: this.#topHeight,
    };
    this.#facade.apply(frame);
    this.#roof.apply(frame);
  }
}

export interface BuildingsModuleOptions {
  /** Gfx library to compose with (defaults to the shared procedural library). */
  library?: BuildingsGfxLibrary;
  /** Lots to build (defaults to the seven-lot corner arrangement). */
  lots?: readonly BuildingLot[];
  /** Deterministic seed for rooftop jitter and texture variation. */
  seed?: number;
}

/** The produced buildings-api module consumed by the integration owner. */
export interface BuildingsModule {
  /** Root group holding every building; parent this to the scene cityRoot. */
  readonly root: THREE.Group;
  readonly buildings: readonly Building[];
  readonly storefrontBays: readonly StorefrontBay[];
  readonly pickables: readonly BuildingPickDescriptor[];
  /**
   * Register every building into an EraTransformable registry (facade stage).
   * Returns an unregister function that removes them all.
   */
  registerInto(registry: EraTransformRegistry): () => void;
  /** Detach the scene graph and release procedural resources. */
  dispose(): void;
}

/**
 * Build the era-evolving buildings module: seven procedural corner lots with
 * instanced era window grids, morphing massing, evolving rooftops, exposed
 * storefront bays, and pickable descriptors.
 */
export function createBuildingsModule(options: BuildingsModuleOptions = {}): BuildingsModule {
  const lots = options.lots ?? BUILDING_LOTS;
  const ctx = createBuildingBuildContext(
    options.library ?? ProceduralGfxLibrary,
    options.seed ?? 1945,
  );

  const root = new THREE.Group();
  root.name = 'buildings';

  const buildings: Building[] = [];
  const bays: StorefrontBay[] = [];
  const pickables: BuildingPickDescriptor[] = [];

  lots.forEach((lot, lotIndex) => {
    const building = new BuildingImpl(lot, lotIndex, ctx);
    buildings.push(building);
    bays.push(...building.bays);
    pickables.push(building.pickable);
    root.add(building.group);
  });

  return {
    root,
    buildings,
    storefrontBays: bays,
    pickables,
    registerInto(registry: EraTransformRegistry): () => void {
      const unregisters = buildings.map((building) => registry.register(building));
      return () => {
        for (const unregister of unregisters) unregister();
      };
    },
    dispose(): void {
      root.clear();
      ctx.dispose();
    },
  };
}
