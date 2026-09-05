/**
 * src/content/buildings/morph.ts — per-plot vertex-morph slots.
 *
 * Every plot registers against the shared anchor groups (doorway / window /
 * shelf). Each anchor group is a positioned THREE.Group holding one
 * origin-centered morphed "registration" box; the morph engine lerps the
 * group's position AND the box's morph targets between eras, so construction
 * details attached to the group ride the same lossless transition.
 *
 * The envelope and the window grid are also fixed-topology morphed meshes with
 * one morph target per era (declarative specs from src/eras.ts). Unused window
 * cells collapse to invisible slivers, keeping vertex counts identical across
 * eras — no index remapping, no reconstruction, no orphaned meshes.
 */

import * as THREE from 'three';

import { ERA_IDS, type BuildingEraSpec, type BuildingPlotSpec, type EraId } from '../../eras';
import {
  buildAnchorGeometry,
  buildEnvelopeGeometry,
  buildWindowGridGeometry,
  computeAnchorDims,
  ANCHOR_SLOT_NAMES,
  type AnchorDims,
  type AnchorSlotName,
  type EnvelopeDims,
  type WindowGridLayout,
} from './geometry';
import type { BuildingMaterialSet } from './materials';

/** Window template constants: any era may use fewer stories/rows/columns. */
export const WINDOW_TEMPLATE = {
  maxStories: 20,
  maxRows: 2,
  maxColumns: 6,
} as const;

export interface BuildingAnchorGroup {
  /** The shared anchor slot (doorway / window / shelf). */
  name: AnchorSlotName;
  /** Group positioned at the era's anchor center; detail meshes attach here. */
  group: THREE.Group;
  /** Origin-centered morphed registration box (driven by the morph engine). */
  mesh: THREE.Mesh;
}

export interface BuildingMeshes {
  envelope: THREE.Mesh;
  windows: THREE.Mesh;
  anchors: Record<AnchorSlotName, BuildingAnchorGroup>;
}

/** Per-era meshes for a single plot — all sharing a fixed topology. */
export class BuildingMorphSlot {
  readonly group = new THREE.Group();
  readonly id: string;
  private readonly envelope: THREE.Mesh;
  private readonly windows: THREE.Mesh;
  private readonly anchorGroups: Record<AnchorSlotName, BuildingAnchorGroup>;
  private readonly eraEnvelope: Record<EraId, EnvelopeDims>;
  private readonly eraWindowLayouts: Record<EraId, WindowGridLayout>;
  private readonly eraAnchorDims: Record<EraId, { doorway: AnchorDims; window: AnchorDims; shelf: AnchorDims }>;
  private readonly eraAnchorCenters: Record<EraId, Record<AnchorSlotName, { x: number; y: number; z: number }>>;

  constructor(
    id: string,
    eraSpecs: Record<EraId, BuildingEraSpec>,
    materials: BuildingMaterialSet,
  ) {
    const baseEra = ERA_IDS[0];
    this.id = id;
    this.group.name = `plot-${id}`;

    this.eraEnvelope = this.buildEraEnvelopes(eraSpecs);
    this.eraWindowLayouts = this.buildEraWindowLayouts(eraSpecs);
    this.eraAnchorDims = this.buildEraAnchorDims(eraSpecs);
    this.eraAnchorCenters = this.buildEraAnchorCenters();

    const baseEnvelope = this.eraEnvelope[baseEra];
    const baseWindowLayout = this.eraWindowLayouts[baseEra];
    const baseAnchorDims = this.eraAnchorDims[baseEra];
    const baseAnchorCenters = this.eraAnchorCenters[baseEra];

    this.envelope = new THREE.Mesh(
      buildEnvelopeGeometry(baseEnvelope, this.eraEnvelope),
      materials.facade,
    );
    this.envelope.name = `envelope-${id}`;
    this.envelope.castShadow = true;
    this.envelope.receiveShadow = true;
    this.group.add(this.envelope);

    this.windows = new THREE.Mesh(
      buildWindowGridGeometry(baseWindowLayout, WINDOW_TEMPLATE, this.eraWindowLayouts),
      materials.windows,
    );
    this.windows.name = `windows-${id}`;
    this.windows.castShadow = false;
    this.group.add(this.windows);

    this.anchorGroups = {} as Record<AnchorSlotName, BuildingAnchorGroup>;
    for (const slot of ANCHOR_SLOT_NAMES) {
      const group = new THREE.Group();
      group.name = `anchor-${slot}-${id}`;
      // Per-slot morph targets: one AnchorDims per era (same topology).
      const slotTargets = {} as Record<EraId, AnchorDims>;
      for (const eraId of ERA_IDS) {
        slotTargets[eraId] = this.eraAnchorDims[eraId][slot];
      }
      const mesh = new THREE.Mesh(
        buildAnchorGeometry(baseAnchorDims[slot], slotTargets),
        materials.neutral,
      );
      mesh.name = `registration-${slot}-${id}`;
      mesh.visible = false;
      group.add(mesh);
      group.position.set(
        baseAnchorCenters[slot].x,
        baseAnchorCenters[slot].y,
        baseAnchorCenters[slot].z,
      );
      this.anchorGroups[slot] = { name: slot, group, mesh };
      this.group.add(group);
    }

    // Collapse to the base era (1945) instantly on construction so the morph
    // influences and anchor centers are deterministic from frame 0.
    this.applyPose(1, baseEra, baseEra);
  }

  // --- Declarative per-era data ---------------------------------------------

  private plotFor(eraSpecs: Record<EraId, BuildingEraSpec>, id: EraId): BuildingPlotSpec {
    const plot = eraSpecs[id].plots.find((p) => p.id === this.id);
    if (!plot) {
      throw new Error(`BuildingMorphSlot ${this.id}: missing plot in era ${id}.`);
    }
    return plot;
  }

  private buildEraEnvelopes(
    eraSpecs: Record<EraId, BuildingEraSpec>,
  ): Record<EraId, EnvelopeDims> {
    const out = {} as Record<EraId, EnvelopeDims>;
    for (const id of ERA_IDS) {
      const plot = this.plotFor(eraSpecs, id);
      out[id] = {
        width: plot.width,
        depth: plot.depth,
        height: plot.stories * plot.storyHeight + plot.parapetHeight,
      };
    }
    return out;
  }

  private buildEraWindowLayouts(
    eraSpecs: Record<EraId, BuildingEraSpec>,
  ): Record<EraId, WindowGridLayout> {
    const out = {} as Record<EraId, WindowGridLayout>;
    for (const id of ERA_IDS) {
      const plot = this.plotFor(eraSpecs, id);
      out[id] = {
        width: plot.width,
        depth: plot.depth,
        storyHeight: plot.storyHeight,
        stories: plot.stories,
        columns: plot.windows.columns,
        rows: plot.windows.rows,
        gapX: plot.windows.gapX,
        gapY: plot.windows.gapY,
      };
    }
    return out;
  }

  private buildEraAnchorDims(
    eraSpecs: Record<EraId, BuildingEraSpec>,
  ): Record<EraId, Record<'doorway' | 'window' | 'shelf', AnchorDims>> {
    const out = {} as Record<EraId, Record<'doorway' | 'window' | 'shelf', AnchorDims>>;
    for (const id of ERA_IDS) {
      const plot = this.plotFor(eraSpecs, id);
      const dims = {} as Record<'doorway' | 'window' | 'shelf', AnchorDims>;
      for (const slot of ANCHOR_SLOT_NAMES) {
        dims[slot] = computeAnchorDims(slot, plot, id);
      }
      out[id] = dims;
    }
    return out;
  }

  private buildEraAnchorCenters(): Record<
    EraId,
    Record<AnchorSlotName, { x: number; y: number; z: number }>
  > {
    const out = {} as Record<
      EraId,
      Record<AnchorSlotName, { x: number; y: number; z: number }>
    >;
    for (const id of ERA_IDS) {
      const dims = this.eraAnchorDims[id];
      out[id] = {
        doorway: { x: dims.doorway.cx, y: dims.doorway.cy, z: dims.doorway.cz },
        window: { x: dims.window.cx, y: dims.window.cy, z: dims.window.cz },
        shelf: { x: dims.shelf.cx, y: dims.shelf.cy, z: dims.shelf.cz },
      };
    }
    return out;
  }

  // --- Pose driving ---------------------------------------------------------

  /** Zero all morph influences, then set from→to by progress (0..1). */
  private driveInfluences(mesh: THREE.Mesh, progress: number, fromEra: EraId, toEra: EraId): void {
    const influences = mesh.morphTargetInfluences ?? [];
    if (influences.length < ERA_IDS.length) {
      influences.length = ERA_IDS.length;
    }
    for (let i = 0; i < ERA_IDS.length; i += 1) {
      influences[i] = 0;
    }
    const t = Math.min(1, Math.max(0, progress));
    influences[ERA_IDS.indexOf(fromEra)] = 1 - t;
    influences[ERA_IDS.indexOf(toEra)] = t;
  }

  /** Drive envelope + windows + anchor groups to one morph pose. */
  applyPose(progress: number, fromEra: EraId, toEra: EraId): void {
    this.driveInfluences(this.envelope, progress, fromEra, toEra);
    this.driveInfluences(this.windows, progress, fromEra, toEra);
    const t = Math.min(1, Math.max(0, progress));

    for (const slot of ANCHOR_SLOT_NAMES) {
      const anchor = this.anchorGroups[slot];
      this.driveInfluences(anchor.mesh, progress, fromEra, toEra);
      // Lerp the anchor group center so details ride the morph position.
      const from = this.eraAnchorCenters[fromEra][slot];
      const to = this.eraAnchorCenters[toEra][slot];
      anchor.group.position.set(
        from.x + (to.x - from.x) * t,
        from.y + (to.y - from.y) * t,
        from.z + (to.z - from.z) * t,
      );
      // Registration meshes are visible only mid-morph; detail meshes built on
      // the group are always visible when the era matches.
      anchor.mesh.visible = t > 0.05 && t < 0.95;
    }
  }

  /** Snap to a single era (construction / instant requests). */
  snapTo(era: EraId): void {
    this.applyPose(1, era, era);
  }

  get meshes(): BuildingMeshes {
    return {
      envelope: this.envelope,
      windows: this.windows,
      anchors: this.anchorGroups,
    };
  }

  dispose(): void {
    this.envelope.geometry.dispose();
    this.windows.geometry.dispose();
    for (const slot of ANCHOR_SLOT_NAMES) {
      this.anchorGroups[slot].mesh.geometry.dispose();
    }
    this.group.clear();
  }
}

/** Center-of-mass anchor for a plot at an era (used for camera framing). */
export function plotCenterAnchor(plot: BuildingPlotSpec): { x: number; y: number; z: number } {
  const height = plot.stories * plot.storyHeight + plot.parapetHeight;
  return { x: 0, y: height / 2, z: 0 };
}