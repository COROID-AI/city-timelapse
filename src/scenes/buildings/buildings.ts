/**
 * Per-era buildings & architecture systems: era-derived computation.
 *
 * Builds one `BuildingParams` per city-block lot from the shared era registry
 * and layout anchors, then merges every instanced detail box into shared,
 * renderer-friendly geometry buffers. Numeric facade aspects (height, glass,
 * masonry, signage) interpolate continuously during era transitions via the
 * shared `interpolateEra` engine; discrete aspects follow the era registry.
 *
 * This module owns no era data and no lot geometry — both are consumed
 * read-only from `src/scenes/eras/` and `src/scenes/layout/`.
 */

import { getEra, getEraYears, interpolateEra } from '../eras/index.js';
import { CITY_BLOCK_LAYOUT } from '../layout/index.js';
import type { EraData } from '../eras/index.js';
import type { Lot } from '../layout/index.js';
import type {
  Box,
  BuildingDetails,
  BuildingParams,
  BuildingSignage,
  MergedGeometry,
} from './types.js';

/** Facade setback from the lot edge (m). */
const FACADE_INSET = 0.5;
/** Ground clearance for storefront awnings (m). */
const AWNING_CLEARANCE = 3;
/** Fire escape ladder rung spacing (m). */
const FIRE_ESCAPE_RUNG_SPACING = 0.35;

/** Deterministic pseudo-random number in [0,1) from a string seed. */
function seeded(seed: string, salt: number): number {
  let h = 2166136261;
  const s = `${seed}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h *= 16777619;
  }
  return ((h >>> 16) & 0xffff) / 65536;
}

/** Pick a hex colour from a palette deterministically for a seed. */
function pickColor(palette: readonly string[], seed: string, salt: number): string {
  const paletteArr = palette.length > 0 ? palette : ['#8b7d6c'];
  return paletteArr[Math.floor(seeded(seed, salt) * paletteArr.length) % paletteArr.length]!;
}

/**
 * Resolve the era-interpolated data for a given year. If the year is one of
 * the five canonical registry years, the exact (unblended) era data is used;
 * otherwise the two bracketing eras are blended with `interpolateEra`.
 */
export function eraDataForYear(year: number): EraData {
  const years = getEraYears();
  const exact = years.indexOf(year);
  if (exact !== -1) {
    return getEra(year);
  }
  let lower = years[0]!;
  let upper = years[years.length - 1]!;
  for (let i = 0; i < years.length - 1; i++) {
    const a = years[i]!;
    const b = years[i + 1]!;
    if (year >= a && year <= b) {
      lower = a;
      upper = b;
      break;
    }
  }
  if (year <= lower) {
    return getEra(lower);
  }
  if (year >= upper) {
    return getEra(upper);
  }
  const t = (year - lower) / (upper - lower);
  return interpolateEra(getEra(lower), getEra(upper), t);
}

/**
 * Resolve one building's era-derived parameters for a lot at a given year.
 * Deterministic: the same (lot, year) always yields the same instance.
 */
export function resolveBuilding(lot: Lot, year: number): BuildingParams {
  const era = eraDataForYear(year);
  const arch = era.architecture;
  const store = era.storefronts;
  const ads = era.advertisements;

  const bounds = lot.bounds;
  const footprintDepth = Math.max(4, bounds.depth - FACADE_INSET * 2);
  const footprintWidth = Math.max(4, bounds.width - FACADE_INSET * 2);

  // Continuous height interpolation: blend between era min/max by a
  // deterministic per-lot factor, so the skyline rises smoothly across eras.
  const heightFactor = 0.4 + seeded(lot.id, 1) * 0.6;
  const heightM =
    arch.minHeightM + (arch.maxHeightM - arch.minHeightM) * heightFactor;

  const facadeColor = pickColor(arch.facadePalette, lot.id, 2);

  const signage: BuildingSignage = {
    medium: ads.medium,
    intensity: ads.intensity,
    neonToLed: ads.neonToLed,
    posterSaturation: ads.posterSaturation,
    awning: store.awning,
    neonLevel: store.neonLevel,
  };

  const details = resolveDetails(lot.id, era);

  return {
    id: `building-${lot.id}`,
    lotId: lot.id,
    position: { x: lot.facadeCenter.x, z: lot.facadeCenter.z },
    footprintWidth,
    footprintDepth,
    heightM,
    material: {
      styleId: arch.styleId,
      masonry: arch.masonry,
      glassRatio: arch.glassRatio,
      palette: arch.facadePalette.slice(),
      roofStyle: arch.roofStyle,
    },
    facadeColor,
    signage,
    details,
  };
}

/**
 * Resolve the instanced detail elements for a building from its era profile.
 * Window mullion count and rooftop machinery scale with building height and
 * glazing so detail density stays era-authentic.
 */
export function resolveDetails(seed: string, era: EraData): BuildingDetails {
  const arch = era.architecture;
  const store = era.storefronts;
  const ads = era.advertisements;

  const heightFactor = 0.4 + seeded(seed, 1) * 0.6;
  const nominalHeight =
    arch.minHeightM + (arch.maxHeightM - arch.minHeightM) * heightFactor;

  const mullionCount = Math.max(
    0,
    Math.round((8 + nominalHeight * 0.25) * (0.4 + arch.glassRatio * 0.6)),
  );
  const cornice = arch.roofStyle !== 'green-roof' && seeded(seed, 3) > 0.35;
  const fireEscape = arch.masonry > 0.45 && seeded(seed, 4) > 0.25;
  const awning = store.awning !== 'none' && seeded(seed, 5) > 0.2;

  const rooftopMachineryCount = Math.max(0, Math.round(2 + nominalHeight * 0.08));
  const greenWall = arch.roofStyle === 'green-roof' && seeded(seed, 6) > 0.15;
  const solarPanelCount = arch.roofStyle === 'green-roof' ? Math.round(nominalHeight * 0.5) : 0;
  const ledAccent = arch.roofLighting > 0.8 && ads.neonToLed > 0.5;

  return {
    mullionCount,
    cornice,
    fireEscape,
    awning,
    rooftopMachineryCount,
    greenWall,
    solarPanelCount,
    ledAccent,
  };
}

/**
 * Merge every resolved building's instanced detail boxes into shared buffers.
 * All boxes are flattened into the returned arrays so a renderer uploads a
 * small number of static geometry buffers (instancing) instead of issuing a
 * draw call per box — this is the performance contract of the module.
 */
export function mergeGeometry(buildings: readonly BuildingParams[]): MergedGeometry {
  const buildingBoxes: Box[] = [];
  const mullions: Box[] = [];
  const cornices: Box[] = [];
  const fireEscapes: Box[] = [];
  const awnings: Box[] = [];
  const rooftopMachinery: Box[] = [];
  const greenWalls: Box[] = [];
  const solarPanels: Box[] = [];
  const ledAccents: Box[] = [];

  for (const b of buildings) {
    const { x, z } = b.position;
    const hw = b.footprintWidth / 2;

    // The building spans the lot depth behind the facade: the box's front
    // face sits at the facade center (position.z), extending into the lot.
    buildingBoxes.push({
      x: x - hw,
      y: 0,
      z: z - b.footprintDepth,
      width: b.footprintWidth,
      height: b.heightM,
      depth: b.footprintDepth,
      color: b.facadeColor,
    });

    // Window mullions: vertical bars across the facade face.
    const face = facadeFace(b);
    const barHeight = Math.max(1, b.heightM - 1);
    for (let i = 0; i < b.details.mullionCount; i++) {
      const t = (i + 0.5) / Math.max(1, b.details.mullionCount);
      const bx = face.x + face.width * t;
      mullions.push({
        x: bx - 0.08,
        y: 1.5,
        z: face.z - 0.05,
        width: 0.16,
        height: barHeight,
        depth: 0.1,
        color: '#e8e6e0',
      });
    }

    // Cornice / parapet cap along the facade top.
    if (b.details.cornice) {
      cornices.push({
        x: face.x,
        y: b.heightM - 0.35,
        z: face.z - 0.3,
        width: face.width,
        height: 0.35,
        depth: 0.6,
        color: b.facadeColor,
      });
    }

    // Exterior fire escape: a ladder column with landing platforms.
    if (b.details.fireEscape) {
      const ladderX = face.x + face.width * 0.25;
      const rungs = Math.max(3, Math.floor(b.heightM / FIRE_ESCAPE_RUNG_SPACING));
      for (let r = 0; r < rungs; r++) {
        fireEscapes.push({
          x: ladderX - 0.6,
          y: 0.4 + r * FIRE_ESCAPE_RUNG_SPACING,
          z: face.z + 0.55,
          width: 1.2,
          height: 0.06,
          depth: 0.06,
          color: '#3a3a3a',
        });
      }
      const landings = Math.max(1, Math.floor(b.heightM / 6));
      for (let l = 1; l <= landings; l++) {
        fireEscapes.push({
          x: ladderX - 0.7,
          y: l * 6,
          z: face.z + 0.5,
          width: 1.4,
          height: 0.1,
          depth: 0.9,
          color: '#3a3a3a',
        });
      }
    }

    // Storefront awning / canopy.
    if (b.details.awning) {
      const awningW = Math.min(face.width, 9);
      awnings.push({
        x: face.x + (face.width - awningW) / 2,
        y: AWNING_CLEARANCE,
        z: face.z - 0.5,
        width: awningW,
        height: 0.25,
        depth: 1.4,
        color: awningColor(b.signage),
      });
    }

    // Rooftop machinery: AC units, water towers, vents on the roof.
    const roofY = b.heightM;
    for (let i = 0; i < b.details.rooftopMachineryCount; i++) {
      const mw = 0.9 + seeded(b.id, 7 + i) * 0.8;
      const mh = 0.8 + seeded(b.id, 17 + i) * 0.9;
      const offX = (seeded(b.id, 27 + i) - 0.5) * (b.footprintWidth - 2);
      const offZ = (seeded(b.id, 37 + i) - 0.5) * (b.footprintDepth - 2);
      rooftopMachinery.push({
        x: x + offX - mw / 2,
        y: roofY,
        z: z + offZ - mw / 2,
        width: mw,
        height: mh,
        depth: mw,
        color: '#9a9a94',
      });
    }

    // Green wall panels on the facade (bioclimatic era).
    if (b.details.greenWall) {
      const panelW = Math.min(face.width, 10);
      greenWalls.push({
        x: face.x + (face.width - panelW) / 2,
        y: 1,
        z: face.z - 0.15,
        width: panelW,
        height: Math.max(3, b.heightM * 0.55),
        depth: 0.3,
        color: '#4c7a4c',
      });
    }

    // Rooftop solar panels.
    const panelW = 1.6;
    const panelD = 1.0;
    const cols = Math.max(1, Math.floor((b.footprintWidth - 1) / (panelW + 0.3)));
    const rows = Math.max(1, Math.floor((b.footprintDepth - 1) / (panelD + 0.3)));
    for (let r = 0; r < rows && solarPanels.length < 400; r++) {
      for (let c = 0; c < cols; c++) {
        const px = x - b.footprintWidth / 2 + 0.5 + c * (panelW + 0.3);
        const pz = z - b.footprintDepth / 2 + 0.5 + r * (panelD + 0.3);
        solarPanels.push({
          x: px,
          y: roofY + 0.2,
          z: pz,
          width: panelW,
          height: 0.12,
          depth: panelD,
          color: '#1f2a4a',
        });
      }
    }

    // LED accent strips (cool modern lighting).
    if (b.details.ledAccent) {
      ledAccents.push({
        x: face.x,
        y: b.heightM * 0.5,
        z: face.z - 0.1,
        width: face.width,
        height: 0.08,
        depth: 0.12,
        color: '#bff0ff',
      });
    }
  }

  const all = [
    buildingBoxes,
    mullions,
    cornices,
    fireEscapes,
    awnings,
    rooftopMachinery,
    greenWalls,
    solarPanels,
    ledAccents,
  ];
  const vertexCount = all.reduce((sum, boxes) => sum + boxes.length * 8, 0);

  return {
    buildingBoxes,
    mullions,
    cornices,
    fireEscapes,
    awnings,
    rooftopMachinery,
    greenWalls,
    solarPanels,
    ledAccents,
    instanceCount: buildings.length,
    vertexCount,
  };
}

/** The street-facing facade edge of a building (front face, toward the street). */
function facadeFace(b: BuildingParams): Box {
  const { x, z } = b.position;
  const hw = b.footprintWidth / 2;
  // The facade sits on the street-facing edge at the facade center (z).
  return {
    x: x - hw,
    y: 0,
    z,
    width: b.footprintWidth,
    height: b.heightM,
    depth: 0,
    color: b.facadeColor,
  };
}

/** Awning colour derived from the era storefront palette. */
function awningColor(s: BuildingSignage): string {
  switch (s.awning) {
    case 'canvas-stripe':
      return '#c23b22';
    case 'vintage-butter':
      return '#e6c27a';
    case 'solar-canopy':
      return '#2f5d8a';
    default:
      return '#c23b22';
  }
}

/**
 * Resolve every building in the block for a given year, then merge all
 * instanced geometry into shared buffers. This is the primary entry point
 * for the buildings subsystem.
 */
export function buildBuildings(year: number): MergedGeometry {
  const buildings = CITY_BLOCK_LAYOUT.lots.map((lot) => resolveBuilding(lot, year));
  return mergeGeometry(buildings);
}