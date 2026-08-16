import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { TextureFactory } from '../util/textures.js';
import type { BuildingSpec } from '../buildings/specs.js';
import { ERA_BUILDING_MAP } from '../buildings/specs.js';
import { buildStorefront } from './storefronts.js';
import { buildBillboard, buildWallAd, getAdCount } from './ads.js';
import { buildStreetFurniture } from './streetfurniture.js';

/** Average spacing between buildings for lamp post placement */
function averageSpacing(buildings: BuildingSpec[]): number {
  const active = buildings.filter((b) => b.active);
  if (active.length < 2) return 8;
  const xs = active.map((b) => b.footprint.x).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    diffs.push(Math.abs(xs[i] - xs[i - 1]));
  }
  return diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 8;
}

// ── Main entry point ──────────────────────────────────────────────────

/**
 * Build a complete streetscape group for a given era.
 * Assembles signs, ads, and street furniture positioned on building
 * facades and sidewalks using data from the building specs.
 *
 * @param eraId - The era identifier ('1945' | '1965' | '1985' | '2005' | '2025')
 * @param textures - Shared TextureFactory for canvas texture generation
 * @returns A THREE.Group containing all street-level elements
 */
export function buildStreetscape(
  eraId: EraId,
  textures: TextureFactory,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `streetscape_${eraId}`;

  const buildings = ERA_BUILDING_MAP[eraId];
  if (!buildings) return group;

  const spacing = averageSpacing(buildings);

  // ── Per-building: storefront signs & window displays ─────────────
  buildings.forEach((building) => {
    if (!building.active || !building.footprint.width) return;

    const facadeWidth = building.footprint.width;
    const facadeHeight = Math.max(3, building.floors * 2.5);

    const storefront = buildStorefront(building, eraId, textures, facadeWidth, facadeHeight);
    storefront.position.set(building.footprint.x, 0, building.footprint.z);

    // Rotate to face the sidewalk direction
    const isFrontRow = building.footprint.z < -10;
    const isBackRow = building.footprint.z > 10;
    const isRightCol = building.footprint.x > 15;
    const isLeftCol = building.footprint.x < -15;

    if (isFrontRow) {
      // Face outward (north), rotate 180 so front faces negative Z
      storefront.rotation.y = Math.PI;
    } else if (isBackRow) {
      // Face outward (south), no rotation needed
      storefront.rotation.y = 0;
    } else if (isRightCol) {
      // Face outward (east), rotate -90 degrees
      storefront.rotation.y = -Math.PI / 2;
    } else if (isLeftCol) {
      // Face outward (west), rotate +90 degrees
      storefront.rotation.y = Math.PI / 2;
    }

    group.add(storefront);
  });

  // ── Billboards on rooftops / upper facades ───────────────────────
  const adCount = getAdCount(eraId);
  let adIndex = 0;

  buildings.forEach((building) => {
    if (!building.active) return;

    // Place billboard on every other building, at roof level
    if (adIndex % 2 === 0) {
      const billboard = buildBillboard(adIndex % adCount, eraId, building.footprint.width * 0.7, 3);
      const roofY = building.floors * 2.5 + 1.5;
      billboard.position.set(building.footprint.x, roofY, building.footprint.z);

      // Orient billboard to face the street
      const isFrontRow = building.footprint.z < -10;
      const isRightCol = building.footprint.x > 15;
      const isLeftCol = building.footprint.x < -15;

      if (isFrontRow) billboard.rotation.y = Math.PI;
      else if (isRightCol) billboard.rotation.y = -Math.PI / 2;
      else if (isLeftCol) billboard.rotation.y = Math.PI / 2;

      group.add(billboard);
    }
    adIndex++;
  });

  // ── Painted wall ads on ground-level facades ─────────────────────
  adIndex = 0;
  buildings.forEach((building) => {
    if (!building.active || building.floors < 2) return;

    // Place a smaller wall ad on alternating buildings
    if (adIndex % 3 === 0) {
      const wallAd = buildWallAd(adIndex % adCount, eraId, building.footprint.width * 0.4, 1.5);
      const wallY = building.floors * 2.5 * 0.3; // Lower portion of facade
      wallAd.position.set(building.footprint.x, wallY, building.footprint.z);

      // Match orientation to building
      const isFrontRow = building.footprint.z < -10;
      if (isFrontRow) wallAd.rotation.y = Math.PI;

      group.add(wallAd);
    }
    adIndex++;
  });

  // ── Street furniture along sidewalks ─────────────────────────────
  // Use the first row of buildings as reference for sidewalk placement
  const frontBuildings = buildings.filter(
    (b) => b.active && b.footprint.z < -10,
  );

  if (frontBuildings.length > 0) {
    // Find the leftmost and rightmost building on the front row
    const minX = Math.min(...frontBuildings.map((b) => b.footprint.x));
    const maxX = Math.max(...frontBuildings.map((b) => b.footprint.x));
    const firstFront = frontBuildings.find((b) => b.footprint.x === minX)!;
    const sidewalkZ = firstFront.footprint.z - firstFront.footprint.depth / 2 - 2.5;

    const lampCount = Math.max(3, Math.ceil((maxX - minX) / spacing) + 1);
    const furnitureGroup = buildStreetFurniture(eraId, sidewalkZ, spacing, lampCount);
    group.add(furnitureGroup);
  }

  // Also add furniture along back row if present
  const backBuildings = buildings.filter(
    (b) => b.active && b.footprint.z > 10,
  );
  if (backBuildings.length > 0) {
    const minX = Math.min(...backBuildings.map((b) => b.footprint.x));
    const maxX = Math.max(...backBuildings.map((b) => b.footprint.x));
    const firstBack = backBuildings.find((b) => b.footprint.x === minX)!;
    const sidewalkZ = firstBack.footprint.z + firstBack.footprint.depth / 2 + 2.5;

    const lampCount = Math.max(2, Math.ceil((maxX - minX) / spacing));
    const furnitureGroup = buildStreetFurniture(eraId, sidewalkZ, spacing, lampCount);
    group.add(furnitureGroup);
  }

  // ── Furniture along side columns ─────────────────────────────────
  const rightBuildings = buildings.filter(
    (b) => b.active && b.footprint.x > 15,
  );
  if (rightBuildings.length > 0) {
    const minZ = Math.min(...rightBuildings.map((b) => b.footprint.z));
    const maxZ = Math.max(...rightBuildings.map((b) => b.footprint.z));
    const firstRight = rightBuildings.find((b) => b.footprint.z === minZ)!;
    const sidewalkZ = firstRight.footprint.z - 2.5;

    const lampCount = Math.max(2, Math.ceil((maxZ - minZ) / spacing) + 1);
    const furnitureGroup = buildStreetFurniture(eraId, sidewalkZ, spacing, lampCount);
    // Rotate 90° so furniture faces inward
    furnitureGroup.rotation.y = Math.PI / 2;
    furnitureGroup.position.set(firstRight.footprint.x + 2.5, 0, 0);
    group.add(furnitureGroup);
  }

  const leftBuildings = buildings.filter(
    (b) => b.active && b.footprint.x < -15,
  );
  if (leftBuildings.length > 0) {
    const minZ = Math.min(...leftBuildings.map((b) => b.footprint.z));
    const maxZ = Math.max(...leftBuildings.map((b) => b.footprint.z));
    const firstLeft = leftBuildings.find((b) => b.footprint.z === minZ)!;
    const sidewalkZ = firstLeft.footprint.z + 2.5;

    const lampCount = Math.max(2, Math.ceil((maxZ - minZ) / spacing) + 1);
    const furnitureGroup = buildStreetFurniture(eraId, sidewalkZ, spacing, lampCount);
    furnitureGroup.rotation.y = -Math.PI / 2;
    furnitureGroup.position.set(firstLeft.footprint.x - 2.5, 0, 0);
    group.add(furnitureGroup);
  }

  return group;
}
