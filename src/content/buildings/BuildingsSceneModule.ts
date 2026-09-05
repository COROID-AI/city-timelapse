/**
 * src/content/buildings/BuildingsSceneModule.ts — era-aware building block.
 *
 * Owns the five-plot city block. On construction it builds the shared topologies
 * once (envelope + window grid + three anchor registration groups per plot) and
 * registers them with the foundation MorphEngine. Construction detail (billboards,
 * scaffolds, water tanks, satellite dishes, neon signs, screens, solar panels,
 * green walls) is era-specific: when an era changes the module disposes the
 * previous era's detail groups and rebuilds the new era's detail groups on the
 * SAME shared anchor groups — so there are never orphaned meshes and every mesh
 * is accounted for.
 *
 * Contract: { group, update(dt), setEra(era, t), dispose() } — no renderer/loop,
 * all era differences come from declarative BuildingEraSpec data in src/eras.ts.
 */

import * as THREE from 'three';

import {
  BUILDING_ERA_SPECS,
  ERA_ANCHOR_SLOTS,
  ERA_IDS,
  type BuildingDetailSpec,
  type BuildingPlotSpec,
  type EraId,
} from '../../eras';
import type { MorphEngine } from '../../core/MorphEngine';
import { buildDetail, disposeDetailGroup, type DetailBuildContext } from './details';
import { BuildingMorphSlot } from './morph';
import {
  buildBuildingMaterials,
  disposeMaterialSet,
  type BuildingMaterialSet,
} from './materials';

export interface BuildingsSceneModuleOptions {
  /** Position the whole block at. Default { x: 0, y: 0, z: 0 }. */
  origin?: { x: number; y: number; z: number };
}

/** Latest declarative per-era building specs. */
const ERA_SPECS = BUILDING_ERA_SPECS;

const ANCHOR_SLOTS = ['doorway', 'window', 'shelf'] as const;
type AnchorSlotName = (typeof ANCHOR_SLOTS)[number];

export class BuildingsSceneModule {
  readonly group = new THREE.Group();
  private readonly slots = new Map<string, BuildingMorphSlot>();
  private readonly materials = new Map<string, BuildingMaterialSet>();
  private currentEra: EraId = ERA_IDS[0];
  private readonly detailGroups = new Map<string, THREE.Group[]>();
  private readonly labelCache = new Map<string, THREE.Texture>();
  private readonly unregister: (() => void)[] = [];

  constructor(morphEngine: MorphEngine | null, options: BuildingsSceneModuleOptions = {}) {
    const origin = options.origin ?? { x: 0, y: 0, z: 0 };
    this.group.name = 'Buildings';
    if (origin.x !== 0 || origin.y !== 0 || origin.z !== 0) {
      this.group.position.set(origin.x, origin.y, origin.z);
    }

    // Build the same five plots for every era (ids/positions stable).
    const firstEra = ERA_IDS[0];
    const firstPlotIds = ERA_SPECS[firstEra].plots.map((p) => p.id);

    const engine = morphEngine;
    for (const plotId of firstPlotIds) {
      const basePlot = ERA_SPECS[firstEra].plots.find((p) => p.id === plotId);
      if (!basePlot) {
        continue;
      }
      const materials = buildBuildingMaterials(basePlot, {
        color: ERA_SPECS[firstEra].windowGlowColor,
        intensity: ERA_SPECS[firstEra].windowGlowIntensity,
      });
      this.materials.set(plotId, materials);

      const slot = new BuildingMorphSlot(plotId, ERA_SPECS, materials);
      slot.group.position.set(basePlot.x, 0, basePlot.z);
      this.slots.set(plotId, slot);
      this.group.add(slot.group);

      // Pose driver: use the foundation MorphEngine when supplied (it owns the
      // shared timeline), otherwise keep a private pose snapshot (isolation).
      if (engine) {
        engine.registerDriver((progress, fromEra, toEra) => {
          slot.applyPose(progress, fromEra, toEra);
        });
      } else {
        slot.applyPose(1, firstEra, firstEra);
      }
    }

    // Build the first era's construction details on construction (setEra would
    // early-return because currentEra already equals firstEra).
    this.buildDetails(firstEra);
  }

  /** Current declarative spec for the active era. */
  get spec(): (typeof ERA_SPECS)[EraId] {
    return ERA_SPECS[this.currentEra];
  }

  /** Build the era's construction details on the shared anchor groups. */
  private buildDetails(era: EraId): void {
    // Dispose any previous era's detail groups first (no orphans).
    this.disposeDetails();

    const spec = ERA_SPECS[era];
    const eraAnchors = ERA_ANCHOR_SLOTS[era];
    for (const [plotId, slot] of this.slots) {
      const plot = this.plotFor(era, plotId);
      const groups: THREE.Group[] = [];
      this.detailGroups.set(plotId, groups);
      for (const detail of plot.details) {
        const anchorSlot = detail.anchor ?? defaultAnchorFor(detail.kind);
        const anchorGroup = slot.meshes.anchors[anchorSlot];
        if (!anchorGroup) {
          continue;
        }
        const ctx: DetailBuildContext = {
          anchor: anchorSlot,
          plot,
          eraAnchors,
          labels: this.labelCache,
          defaultLabel: spec.billboard,
          accent: spec.accentColor,
        };
        const detailGroup = buildDetail(detail, ctx);
        anchorGroup.group.add(detailGroup);
        groups.push(detailGroup);
      }
    }
  }

  private plotFor(era: EraId, plotId: string): BuildingPlotSpec {
    const plot = ERA_SPECS[era].plots.find((p) => p.id === plotId);
    if (!plot) {
      throw new Error(`Buildings: missing plot ${plotId} in era ${era}.`);
    }
    return plot;
  }

  /** Dispose every detail group (materials + geometry) and detach from parents. */
  private disposeDetails(): void {
    for (const groups of this.detailGroups.values()) {
      for (const group of groups) {
        disposeDetailGroup(group);
        // Detach from the anchor group so old detail meshes never linger.
        if (group.parent) {
          group.parent.remove(group);
        }
      }
    }
    this.detailGroups.clear();
  }

  /** Synchronize materials for the new era (window glow, facade tint). */
  private applyEraMaterials(era: EraId): void {
    const glow = {
      color: ERA_SPECS[era].windowGlowColor,
      intensity: ERA_SPECS[era].windowGlowIntensity,
    };
    for (const [plotId, set] of this.materials) {
      set.windows.emissive.set(glow.color);
      set.windows.emissiveIntensity = glow.intensity;
      set.windows.needsUpdate = true;
      const plot = this.plotFor(era, plotId);
      set.facade.color.set(plot.facadeColor ?? defaultFacadeColor(plot.facade));
      set.facade.needsUpdate = true;
      set.trim.color.setHex(defaultSpandrelColor(plot.facade));
      set.trim.needsUpdate = true;
    }
  }

  /** Set the active era: rebuild details, refresh materials. */
  setEra(era: EraId, _t = 0): void {
    if (era === this.currentEra) {
      return;
    }
    this.currentEra = era;
    this.applyEraMaterials(era);
    this.buildDetails(era);
  }

  /** Advance per-frame logic (no-op — morphs are timeline-driven). */
  update(_dt: number): void {
    // no-op — the MorphEngine timeline drives applyPose per frame.
  }

  dispose(): void {
    for (const unregister of this.unregister) {
      unregister();
    }
    this.unregister.length = 0;
    this.disposeDetails();
    for (const slot of this.slots.values()) {
      slot.dispose();
    }
    for (const set of this.materials.values()) {
      disposeMaterialSet(set);
    }
    this.slots.clear();
    this.materials.clear();
    this.labelCache.clear();
    this.group.clear();
  }
}

/** Default anchor slot per detail kind when the spec does not override it. */
function defaultAnchorFor(kind: BuildingDetailSpec['kind']): AnchorSlotName {
  switch (kind) {
    case 'canopy':
      return 'doorway';
    case 'scaffold':
    case 'ac_unit':
    case 'green_wall':
      return 'shelf';
    case 'billboard':
    case 'water_tank':
    case 'satellite_dish':
    case 'neon_sign':
    case 'screen':
    case 'solar_panel':
    default:
      return 'window';
  }
}

/** Facade color per facade kind (same table as materials). */
function defaultFacadeColor(kind: BuildingPlotSpec['facade']): number {
  switch (kind) {
    case 'brick':
      return 0x8a4a32;
    case 'glass':
      return 0x22303c;
    case 'precast':
      return 0xb7bfc4;
    case 'concrete':
      return 0x70777f;
    case 'curtain':
      return 0x24303c;
    case 'timber':
      return 0x8a6b4f;
  }
}

/** Spandrel color per facade kind (same table as materials). */
function defaultSpandrelColor(kind: BuildingPlotSpec['facade']): number {
  switch (kind) {
    case 'brick':
      return 0x6f3a26;
    case 'glass':
      return 0x182028;
    case 'precast':
      return 0x9aa4a9;
    case 'concrete':
      return 0x565c63;
    case 'curtain':
      return 0x18222e;
    case 'timber':
      return 0x6f5439;
  }
}