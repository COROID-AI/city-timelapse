/**
 * blockLayer.ts — the coherent static block layer for the city block.
 *
 * BlockLayer owns the entire static block surface for all five eras: the four
 * lot buildings, storefront facades, building-mounted advertisements and the
 * street surface (sidewalks, crosswalks, road markings, 1945 trolley tracks
 * and the 2025 bike lane). Architecturally it is one SceneLayer so structures,
 * storefronts and signage change in lockstep when the selected year changes.
 *
 * Public contract:
 *   attach(group)                 — add the layer root to any Object3D.
 *   applyEra(eraId, progress)     — continuous facade-material lerp plus a
 *                                   discrete variant swap at the midpoint.
 *   dispose()                     — unsubscribes, removes and releases assets.
 *   createRoot()/update()/dispose() — SceneLayer contract consumed by
 *                                   SceneRuntime.attachLayer.
 *
 * All geometry is sourced read-only from src/core/blockLayout.ts; era content
 * is sourced read-only from src/eras/eraSystem.ts. Neither module is written.
 */

import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three';
import {
  CROSSWALK,
  LOT_EXTENTS,
  ROAD,
  SIDEWALK,
  type LotId,
  type Rect,
} from '../core/blockLayout';
import type { FrameState, SceneLayer } from '../core/sceneRuntime';
import {
  EraSystem,
  getEraDefinition,
  isEraId,
  type EraDefinition,
  type EraId,
} from '../eras/eraSystem';
import {
  buildBuilding,
  makeTunable,
  type BuildingRecord,
  type TunableMaterial,
} from './buildings';
import {
  buildAdvertisement,
  buildStorefront,
  type Advertisement,
  type StorefrontFacade,
} from './signage';

/** The four lots in stable order. */
export const BLOCK_LOT_IDS: readonly LotId[] = ['NW', 'NE', 'SW', 'SE'];

/** Multiplier from an era's atmosphere bloom to sign glow intensity. */
export const GLOW_GAIN = 1.4;
/** Eased progress at which discrete variants swap during a transition. */
export const DISCRETE_SWAP_PROGRESS = 0.5;

export interface BlockLayerOptions {
  /** Starting era (defaults to EraSystem state or 1945). */
  readonly initialEra?: EraId;
  /** Optional EraSystem: BlockLayer subscribes and follows transitions. */
  readonly eraSystem?: EraSystem;
}

/** Per-era road-marking style (discrete, swapped at the variant midpoint). */
export interface StreetEraStyle {
  readonly label: string;
  readonly centerLineColor: string;
  readonly crosswalkColor: string;
}

export const STREET_STYLE_BY_ERA: Readonly<Record<EraId, StreetEraStyle>> = Object.freeze({
  1945: { label: 'worn-asphalt', centerLineColor: '#c9bea8', crosswalkColor: '#d2c8b2' },
  1965: { label: 'fresh-asphalt', centerLineColor: '#ece9e2', crosswalkColor: '#eceae2' },
  1985: { label: 'reflective-asphalt', centerLineColor: '#f0f0ea', crosswalkColor: '#f0eeea' },
  2005: { label: 'modern-asphalt', centerLineColor: '#f5f5f0', crosswalkColor: '#f4f2ec' },
  2025: { label: 'crisp-asphalt', centerLineColor: '#ffffff', crosswalkColor: '#ffffff' },
});

const CROSSWALK_RECTS: readonly Rect[] = [
  CROSSWALK.northWest,
  CROSSWALK.northEast,
  CROSSWALK.eastNorth,
  CROSSWALK.eastSouth,
  CROSSWALK.southEast,
  CROSSWALK.southWest,
  CROSSWALK.westSouth,
  CROSSWALK.westNorth,
];

/** Ring accessor: returns each road band with its sidewalk-side inner edge. */
interface RoadBand {
  readonly rect: Rect;
  /** The axis the band runs along (the long axis of the strip). */
  readonly along: 'x' | 'z';
  /** Inner edge coordinate (sidewalk side) on the across axis. */
  readonly inner: number;
  /** +1 when the band extends away from the block at inner+, -1 otherwise. */
  readonly innerSign: 1 | -1;
}

const ROAD_BANDS: readonly RoadBand[] = [
  { rect: ROAD.north, along: 'x', inner: ROAD.north.minZ, innerSign: 1 },
  { rect: ROAD.south, along: 'x', inner: ROAD.south.maxZ, innerSign: -1 },
  { rect: ROAD.east, along: 'z', inner: ROAD.east.minX, innerSign: 1 },
  { rect: ROAD.west, along: 'z', inner: ROAD.west.maxX, innerSign: -1 },
];

/** Converts an across-axis offset from a band's inner edge to a coordinate. */
function bandAcross(band: RoadBand, offset: number): number {
  return band.inner + band.innerSign * offset;
}

/** Resolves one tunable's era palette entry (ground/light are single colors). */
function paletteColor(era: EraDefinition, tun: TunableMaterial): string {
  switch (tun.channel) {
    case 'buildings':
      return era.palette.buildings[tun.index % era.palette.buildings.length];
    case 'accents':
      return era.palette.accents[tun.index % era.palette.accents.length];
    case 'signs':
      return era.palette.signs[tun.index % era.palette.signs.length];
    case 'ground':
      return era.palette.ground;
    case 'light':
      return era.palette.light;
    default:
      return era.palette.light;
  }
}

/** Disposes every geometry and material under an object subtree. */
function disposeObjectAssets(object: Object3D): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material?.dispose();
  });
}

/* ------------------------------------------------------------------ *
 * Street surface model.
 * ------------------------------------------------------------------ */

/** The street surface: geometry, markings and era-specific features. */
export interface StreetSurface {
  readonly root: Group;
  readonly sidewalkCount: number;
  readonly roadBandCount: number;
  readonly crosswalkStripeCount: number;
  readonly trolleyRailCount: number;
  readonly trolleyTieCount: number;
  readonly bikeLaneBandCount: number;
  readonly bikeLaneDashCount: number;
  readonly styleLabel: string;
  readonly tunables: readonly TunableMaterial[];
  applyEra(era: EraDefinition): void;
}

class StreetSurfaceModel implements StreetSurface {
  readonly root = new Group();
  readonly tunables: TunableMaterial[] = [];

  sidewalkCount = 0;
  roadBandCount = 0;
  crosswalkStripeCount = 0;
  trolleyRailCount = 0;
  trolleyTieCount = 0;
  bikeLaneBandCount = 0;
  bikeLaneDashCount = 0;
  styleLabel = '';

  private readonly features = new Group();
  private readonly crosswalkMaterial = new MeshStandardMaterial({ color: '#d2c8b2' });
  private readonly centerLineMaterial = new MeshStandardMaterial({ color: '#c9bea8' });
  private readonly laneDashMaterial = new MeshStandardMaterial({ color: '#c9bea8' });

  constructor(era: EraDefinition) {
    this.root.name = 'street-surface';
    this.root.add(this.features);
    this.features.name = 'street-features';

    const sidewalkTunable = makeTunable('ground', 0, era.palette.ground);
    const roadTunable = makeTunable('ground', 1, era.palette.ground);
    this.tunables.push(sidewalkTunable, roadTunable);

    // Sidewalk ring — one slab per band at the shared layout offset.
    for (const band of [SIDEWALK.north, SIDEWALK.east, SIDEWALK.south, SIDEWALK.west]) {
      const slab = new Mesh(new BoxGeometry(band.width, 0.1, band.depth), sidewalkTunable.material);
      slab.name = 'sidewalk';
      slab.position.set((band.minX + band.maxX) / 2, 0.05, (band.minZ + band.maxZ) / 2);
      this.root.add(slab);
      this.sidewalkCount += 1;
    }

    // Road ring — one asphalt band per side.
    for (const band of [ROAD.north, ROAD.east, ROAD.south, ROAD.west]) {
      const asphalt = new Mesh(new BoxGeometry(band.width, 0.06, band.depth), roadTunable.material);
      asphalt.name = 'road';
      asphalt.position.set((band.minX + band.maxX) / 2, 0.03, (band.minZ + band.maxZ) / 2);
      this.root.add(asphalt);
      this.roadBandCount += 1;
    }

    // Center dividing line + lane dashes for every road band.
    for (const band of ROAD_BANDS) {
      this.addCenterLine(band);
      this.addLaneDashes(band);
    }

    // Crosswalk stripes at every one of the eight corner crossings.
    for (const rect of CROSSWALK_RECTS) {
      this.addCrosswalkStripes(rect);
    }

    this.applyEra(era);
  }

  private addCenterLine(band: RoadBand): void {
    const center = bandAcross(band, ROAD.width / 2);
    const mesh =
      band.along === 'x'
        ? new Mesh(
            new BoxGeometry(band.rect.width, 0.06, ROAD.centerLineWidth),
            this.centerLineMaterial,
          )
        : new Mesh(
            new BoxGeometry(ROAD.centerLineWidth, 0.06, band.rect.depth),
            this.centerLineMaterial,
          );
    mesh.name = 'center-line';
    if (band.along === 'x') {
      mesh.position.set((band.rect.minX + band.rect.maxX) / 2, 0.07, center);
    } else {
      mesh.position.set(center, 0.07, (band.rect.minZ + band.rect.maxZ) / 2);
    }
    this.root.add(mesh);
  }

  private addLaneDashes(band: RoadBand): void {
    const separators = [ROAD.laneWidth, ROAD.laneWidth * 3];
    const start = band.along === 'x' ? band.rect.minX : band.rect.minZ;
    const end = band.along === 'x' ? band.rect.maxX : band.rect.maxZ;
    for (const offset of separators) {
      const across = bandAcross(band, offset);
      for (let position = start + 1; position < end; position += 6) {
        const dash =
          band.along === 'x'
            ? new Mesh(new BoxGeometry(3, 0.06, 0.22), this.laneDashMaterial)
            : new Mesh(new BoxGeometry(0.22, 0.06, 3), this.laneDashMaterial);
        dash.name = 'lane-dash';
        if (band.along === 'x') {
          dash.position.set(position, 0.07, across);
        } else {
          dash.position.set(across, 0.07, position);
        }
        this.root.add(dash);
      }
    }
  }

  private addCrosswalkStripes(rect: Rect): void {
    const stripesRunAlongZ = rect.width === CROSSWALK.width;
    const count = Math.floor(CROSSWALK.width / (CROSSWALK.stripeWidth + CROSSWALK.stripeGap));
    const step = CROSSWALK.width / count;
    for (let i = 0; i < count; i += 1) {
      const stripe =
        stripesRunAlongZ
          ? new Mesh(new BoxGeometry(CROSSWALK.stripeWidth, 0.045, rect.depth), this.crosswalkMaterial)
          : new Mesh(new BoxGeometry(rect.width, 0.045, CROSSWALK.stripeWidth), this.crosswalkMaterial);
      stripe.name = 'crosswalk-stripe';
      if (stripesRunAlongZ) {
        stripe.position.set(rect.minX + CROSSWALK.stripeWidth / 2 + i * step, 0.045, (rect.minZ + rect.maxZ) / 2);
      } else {
        stripe.position.set((rect.minX + rect.maxX) / 2, 0.045, rect.minZ + CROSSWALK.stripeWidth / 2 + i * step);
      }
      this.root.add(stripe);
      this.crosswalkStripeCount += 1;
    }
  }

  applyEra(era: EraDefinition): void {
    disposeObjectAssets(this.features);
    this.features.clear();
    this.trolleyRailCount = 0;
    this.trolleyTieCount = 0;
    this.bikeLaneBandCount = 0;
    this.bikeLaneDashCount = 0;

    const style = STREET_STYLE_BY_ERA[era.id];
    this.styleLabel = style.label;
    this.crosswalkMaterial.color.set(style.crosswalkColor);
    this.centerLineMaterial.color.set(style.centerLineColor);
    this.laneDashMaterial.color.set(style.centerLineColor);

    if (era.id === 1945) {
      this.addTrolleyTracks(ROAD_BANDS[0]);
      this.addTrolleyTracks(ROAD_BANDS[1]);
    } else if (era.id === 2025) {
      for (const band of ROAD_BANDS) this.addBikeLane(band);
    }
  }

  /** Twin rails + ties on a main avenue band (1945 trolley line). */
  private addTrolleyTracks(band: RoadBand): void {
    const railMaterial = new MeshStandardMaterial({
      color: '#6a6f72',
      metalness: 0.9,
      roughness: 0.3,
    });
    const tieMaterial = new MeshStandardMaterial({ color: '#4a4038', roughness: 0.95 });
    const offsets = [ROAD.laneCenters[1], ROAD.laneCenters[2]];
    for (const offset of offsets) {
      const rail = new Mesh(
        new BoxGeometry(band.rect.width, 0.12, 0.12),
        railMaterial,
      );
      rail.name = 'trolley-track';
      rail.position.set(0, 0.1, bandAcross(band, offset));
      this.features.add(rail);
      this.trolleyRailCount += 1;
    }
    // Cross ties between the rails.
    const between = bandAcross(band, (offsets[0] + offsets[1]) / 2);
    for (let x = band.rect.minX + 0.75; x < band.rect.maxX; x += 2.5) {
      const tie = new Mesh(new BoxGeometry(0.6, 0.06, 1.5), tieMaterial);
      tie.name = 'trolley-tie';
      tie.position.set(x, 0.09, between);
      this.features.add(tie);
      this.trolleyTieCount += 1;
    }
  }

  /** Green bike lane along the outer edge of every road band (2025). */
  private addBikeLane(band: RoadBand): void {
    const green = new MeshStandardMaterial({ color: '#2f8f5e', roughness: 0.75 });
    const white = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const strip =
      band.along === 'x'
        ? new Mesh(new BoxGeometry(band.rect.width, 0.05, 3.5), green)
        : new Mesh(new BoxGeometry(3.5, 0.05, band.rect.depth), green);
    strip.name = 'bike-lane';
    const stripAcross = bandAcross(band, ROAD.laneCenters[3]);
    if (band.along === 'x') {
      strip.position.set((band.rect.minX + band.rect.maxX) / 2, 0.035, stripAcross);
    } else {
      strip.position.set(stripAcross, 0.035, (band.rect.minZ + band.rect.maxZ) / 2);
    }
    this.features.add(strip);
    this.bikeLaneBandCount += 1;

    // White separation dashes along the lane's inner (sidewalk-side) edge.
    const start = band.along === 'x' ? band.rect.minX : band.rect.minZ;
    const end = band.along === 'x' ? band.rect.maxX : band.rect.maxZ;
    const dashAcross = bandAcross(band, ROAD.width - 3.5);
    for (let position = start + 1; position < end; position += 3) {
      const dash =
        band.along === 'x'
          ? new Mesh(new BoxGeometry(1.8, 0.05, 0.16), white)
          : new Mesh(new BoxGeometry(0.16, 0.05, 1.8), white);
      dash.name = 'bike-lane-dash';
      if (band.along === 'x') {
        dash.position.set(position, 0.055, dashAcross);
      } else {
        dash.position.set(dashAcross, 0.055, position);
      }
      this.features.add(dash);
      this.bikeLaneDashCount += 1;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Building / storefront / advertisement group builders.
 * ------------------------------------------------------------------ */

function buildAllBuildings(era: EraDefinition, parent: Group): Record<LotId, BuildingRecord> {
  const records = {} as Record<LotId, BuildingRecord>;
  BLOCK_LOT_IDS.forEach((lotId, index) => {
    const record = buildBuilding(LOT_EXTENTS[lotId], era.id, era.palette, index);
    parent.add(record.root);
    records[lotId] = record;
  });
  return records;
}

function buildAllStorefronts(
  era: EraDefinition,
  buildings: Record<LotId, BuildingRecord>,
  parent: Group,
): StorefrontFacade[] {
  const list: StorefrontFacade[] = [];
  BLOCK_LOT_IDS.forEach((lotId, index) => {
    const record = buildings[lotId];
    const placement = record.placement;
    const lot = LOT_EXTENTS[lotId];
    const frontZ =
      placement.primaryFace === 'north'
        ? placement.centerZ + placement.footprintDepth / 2
        : placement.centerZ - placement.footprintDepth / 2;
    const facade = buildStorefront({
      era,
      lotId,
      centerX: placement.centerX,
      centerZ: frontZ,
      face: placement.primaryFace,
      width: Math.min(lot.width * 0.48, 24),
      variety: index,
    });
    parent.add(facade.root);
    list.push(facade);
  });
  return list;
}

function buildAllAdvertisements(
  era: EraDefinition,
  buildings: Record<LotId, BuildingRecord>,
  parent: Group,
): Advertisement[] {
  const list: Advertisement[] = [];
  BLOCK_LOT_IDS.forEach((lotId, index) => {
    const record = buildings[lotId];
    const placement = record.placement;
    const frontSign = placement.primaryFace === 'north' ? 1 : -1;
    const facadeSign = placement.facadeFace === 'west' ? -1 : 1;

    const giant = era.id === 2025;
    const rooftopWidth = giant ? 16 : 11;
    const rooftopHeight = giant ? 8 : 6;
    const rooftop = buildAdvertisement({
      era,
      copy: era.advertisements.copy[index % era.advertisements.copy.length],
      kind: 'rooftop',
      position: {
        x: placement.centerX,
        y: record.heightMeters + 1.2 + rooftopHeight / 2,
        z: placement.centerZ + frontSign * (placement.footprintDepth / 2 - 1.6),
      },
      facing: placement.primaryFace,
      width: rooftopWidth,
      height: rooftopHeight,
    });
    parent.add(rooftop.root);
    list.push(rooftop);

    const facade = buildAdvertisement({
      era,
      copy: era.advertisements.copy[(index + 2) % era.advertisements.copy.length],
      kind: 'facade',
      position: {
        x: placement.centerX + facadeSign * (placement.footprintWidth / 2 + 0.25),
        y: Math.min(13, record.heightMeters * 0.55),
        z: placement.centerZ,
      },
      facing: placement.facadeFace,
      width: 8.5,
      height: 6,
    });
    parent.add(facade.root);
    list.push(facade);
  });
  return list;
}

/* ------------------------------------------------------------------ *
 * BlockLayer.
 * ------------------------------------------------------------------ */

/**
 * The parametric city block: buildings, storefronts, advertisements and the
 * street surface for all five eras. Attach to a group or register through
 * SceneRuntime, then applyEra() to transform the block.
 */
export class BlockLayer implements SceneLayer {
  readonly id = 'block';
  readonly root: Group;

  /** The era whose palette the block currently reflects (target after settle). */
  currentEra: EraId;
  /** The era whose discrete variants (shapes, features) are deployed. */
  deployedEra: EraId;

  private readonly buildingsGroup = new Group();
  private readonly storefrontsGroup = new Group();
  private readonly adsGroup = new Group();
  private readonly unsubscribes: Array<() => void> = [];
  private buildings: Record<LotId, BuildingRecord> = {} as Record<LotId, BuildingRecord>;
  private storefrontList: StorefrontFacade[] = [];
  private adList: Advertisement[] = [];
  private streetModel: StreetSurfaceModel;
  private tunables: TunableMaterial[] = [];
  private disposed = false;
  private readonly lerpColorA = new Color();
  private readonly lerpColorB = new Color();

  constructor(options: BlockLayerOptions = {}) {
    const systemEra = options.eraSystem?.getState().current;
    const initialEra = options.initialEra ?? systemEra ?? 1945;
    if (!isEraId(initialEra)) {
      throw new Error(
        `BlockLayer: unknown era ${String(initialEra)}; known eras: 1945, 1965, 1985, 2005, 2025`,
      );
    }
    this.currentEra = initialEra;
    this.deployedEra = initialEra;

    this.root = new Group();
    this.root.name = 'layer:block';
    this.buildingsGroup.name = 'buildings';
    this.storefrontsGroup.name = 'storefronts';
    this.adsGroup.name = 'advertisements';
    this.root.add(this.buildingsGroup, this.storefrontsGroup, this.adsGroup);

    const era = getEraDefinition(initialEra);
    this.buildings = buildAllBuildings(era, this.buildingsGroup);
    this.storefrontList = buildAllStorefronts(era, this.buildings, this.storefrontsGroup);
    this.adList = buildAllAdvertisements(era, this.buildings, this.adsGroup);
    this.streetModel = new StreetSurfaceModel(era);
    this.root.add(this.streetModel.root);
    this.rebuildTunables();
    // Settle the initial era so facade colors and glow are exact from the
    // first frame (no-op variant swap because the era is already deployed).
    this.applyEra(initialEra, 1);

    if (options.eraSystem) {
      const system = options.eraSystem;
      this.unsubscribes.push(
        system.subscribe('era-transition', ({ to, progress }) => this.applyEra(to, progress)),
      );
      this.unsubscribes.push(system.subscribe('era-settled', ({ to }) => this.applyEra(to, 1)));
    }
  }

  /** SceneLayer contract: the layer root is available before attach. */
  createRoot(): Group {
    this.assertUsable();
    return this.root;
  }

  /** Adds the layer root to an arbitrary group/Object3D (re-parents safely). */
  attach(target: Object3D): Group {
    this.assertUsable();
    if (this.root.parent) this.root.parent.remove(this.root);
    target.add(this.root);
    return this.root;
  }

  get lotBuildings(): Readonly<Record<LotId, BuildingRecord>> {
    return this.buildings;
  }

  get storefronts(): readonly StorefrontFacade[] {
    return this.storefrontList;
  }

  get advertisements(): readonly Advertisement[] {
    return this.adList;
  }

  get street(): StreetSurface {
    return this.streetModel;
  }

  /**
   * Transform the block toward `eraId`. Continuous facade materials lerp with
   * `progress`; discrete variants (building shapes, street features,
   * storefront/ad anatomy) swap once progress crosses the midpoint.
   */
  applyEra(eraId: EraId, progress = 1): void {
    this.assertUsable();
    if (!isEraId(eraId)) {
      throw new Error(`BlockLayer: unknown era ${String(eraId)}; known eras: 1945, 1965, 1985, 2005, 2025`);
    }
    const t = Math.min(1, Math.max(0, progress));
    const target = getEraDefinition(eraId);

    if (t >= DISCRETE_SWAP_PROGRESS && this.deployedEra !== eraId) {
      this.swapDiscreteVariants(target);
      this.deployedEra = eraId;
      this.currentEra = eraId;
    }

    this.lerpContinuously(getEraDefinition(this.deployedEra), target, t);

    if (t >= 1) {
      this.currentEra = eraId;
      this.deployedEra = eraId;
      this.lerpContinuously(target, target, 1);
    }
  }

  /** Animates era advertisement panels (CRT flicker, LED sequencing). */
  update(state: FrameState): void {
    for (const ad of this.adList) {
      if (!ad.animated) continue;
      const flicker = ad.technology === 'crt-billboard' ? 0.3 : 0.18;
      ad.panelMaterial.emissiveIntensity =
        ad.baseGlow *
        (1 - flicker + flicker * (0.5 + 0.5 * Math.sin(state.time * 7 + ad.phase)));
    }
  }

  /** Peak emissive intensity across all glow materials (introspection). */
  maxGlowIntensity(): number {
    let max = 0;
    for (const tun of this.tunables) {
      if (tun.glow) max = Math.max(max, tun.material.emissiveIntensity);
    }
    return max;
  }

  /** Removes the layer, unsubscribes and releases all scene resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.unsubscribes) off();
    this.unsubscribes.length = 0;
    if (this.root.parent) this.root.parent.remove(this.root);
    disposeObjectAssets(this.root);
    this.tunables = [];
  }

  private swapDiscreteVariants(era: EraDefinition): void {
    disposeObjectAssets(this.buildingsGroup);
    disposeObjectAssets(this.storefrontsGroup);
    disposeObjectAssets(this.adsGroup);
    this.buildingsGroup.clear();
    this.storefrontsGroup.clear();
    this.adsGroup.clear();

    this.buildings = buildAllBuildings(era, this.buildingsGroup);
    this.storefrontList = buildAllStorefronts(era, this.buildings, this.storefrontsGroup);
    this.adList = buildAllAdvertisements(era, this.buildings, this.adsGroup);
    this.streetModel.applyEra(era);
    this.rebuildTunables();
  }

  private rebuildTunables(): void {
    const list: TunableMaterial[] = [];
    for (const record of Object.values(this.buildings)) list.push(...record.tunables);
    for (const facade of this.storefrontList) list.push(...facade.tunables);
    for (const ad of this.adList) list.push(...ad.tunables);
    list.push(...this.streetModel.tunables);
    this.tunables = list;
  }

  private lerpContinuously(source: EraDefinition, target: EraDefinition, t: number): void {
    for (const tun of this.tunables) {
      const srcColor = paletteColor(source, tun);
      const dstColor = paletteColor(target, tun);
      this.lerpColorA.set(srcColor);
      this.lerpColorB.set(dstColor);
      tun.material.color.copy(this.lerpColorA).lerp(this.lerpColorB, t);
      if (tun.glow) {
        const sourceGlow = source.atmosphere.bloom * GLOW_GAIN;
        const targetGlow = target.atmosphere.bloom * GLOW_GAIN;
        this.lerpColorA.set(srcColor);
        this.lerpColorB.set(dstColor);
        tun.material.emissive.copy(this.lerpColorA).lerp(this.lerpColorB, t);
        tun.material.emissiveIntensity = sourceGlow + (targetGlow - sourceGlow) * t;
      }
    }
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('BlockLayer has been disposed and can no longer be used');
    }
  }
}