import * as THREE from 'three';
import { createRng, pick, randRange } from './rng';
import type {
  CityGrid,
  CityGridLayout,
  CityOptions,
  CityResult,
  CollisionBox,
} from './types';

const FACADE_COLORS: readonly number[] = [
  0x8d6e63, 0xa1887f, 0xbc9b7a, 0xbcaaa4, 0xcdc9c3, 0xc8a97e, 0x9e9d8b,
  0x7f8c8d, 0x6d7b8d, 0x5f7d8c, 0x7986cb, 0x90a4ae, 0xa7adba, 0xcfcfcf,
];

const ROAD_COLOR = 0x4a4a52;
const ROAD_MARKING_COLOR = 0xf2f0e4;
const SIDEWALK_COLOR = 0x9a948b;
const GROUND_COLOR = 0x75756e;

/** Y of the marking layer, just above the road surface (road top is 0.05). */
const MARKING_Y = 0.07;

/**
 * Generate the procedural city: a large ground plane, a street grid with
 * intersections, sidewalk rings around every block and per-block instanced
 * buildings with varied height, footprint and facade color.
 *
 * Street layout:
 * - `blocksPerSide` square blocks per axis, each `blockSize` wide (building
 *   area + a sidewalk ring of `sidewalkWidth`).
 * - A road strip of `streetWidth` runs along every block boundary, plus an
 *   outer ring road around the whole city, so there are `blocksPerSide + 1`
 *   road lines per axis centered on the gaps between blocks.
 * - Roads and sidewalks are instanced (one draw call each); lane lines and
 *   crosswalks are instanced markings laid on top of the road surface.
 *
 * Generation is fully deterministic for a given seed: the building RNG stream
 * consumes calls in the exact same order as before, so a fixed seed always
 * reproduces the same building layout.
 */
export function generateCity(options: CityOptions = {}): CityResult {
  const seed = options.seed === undefined ? 20260804 : options.seed >>> 0;
  const rng = createRng(seed);

  const blocksPerSide = Math.max(1, Math.floor(options.blocksPerSide ?? 5));
  const blockSize = Math.max(4, options.blockSize ?? 36);
  const sidewalkWidth = Math.max(0, options.sidewalkWidth ?? 4);
  const streetWidth = Math.max(1, options.streetWidth ?? 14);
  const heightRange = options.buildingHeight ?? [6, 46];
  const footprintRange = options.buildingFootprint ?? [9, 30];

  const buildingArea = Math.max(1, blockSize - 2 * sidewalkWidth);
  const blockStride = blockSize + streetWidth;
  // Total built extent (blocks + streets between them), centered on the origin.
  const cityExtent = blocksPerSide * blockSize + (blocksPerSide - 1) * streetWidth;
  const halfCity = cityExtent / 2;
  // Road lines per axis: one between every pair of adjacent blocks plus the
  // outer ring roads. Sorted from the -side ring road to the +side ring road.
  const roadLines: number[] = [];
  for (let k = 0; k <= blocksPerSide; k++) {
    roadLines.push(k * blockStride - halfCity - streetWidth / 2);
  }
  // Length of each road strip / sidewalk strip (covers the outer sidewalks).
  const stripLength = 2 * (halfCity + streetWidth + sidewalkWidth);

  const group = new THREE.Group();
  const collisionBoxes: THREE.Box3[] = [];
  const collisionData: CollisionBox[] = [];
  // Layout constants (detail placement: props, markings, traffic) plus the
  // top-down road/sidewalk segments (HUD minimap) share one grid object.
  const grid: CityGrid & CityGridLayout = {
    blocksPerSide,
    blockStride,
    halfCity,
    streetWidth,
    sidewalkWidth,
    roadLines,
    stripLength,
    segments: [],
    halfExtent: halfCity,
  };

  // ---- Ground ---------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(stripLength + 320, stripLength + 320),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  // ---- Street grid (roads + sidewalks) --------------------------------
  // One box per road strip; roads and sidewalks are each a single
  // InstancedMesh so the whole grid costs a handful of draw calls.
  const roadGeometry = new THREE.BoxGeometry(1, 0.1, 1);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: ROAD_COLOR });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ color: SIDEWALK_COLOR });

  const roadCount = roadLines.length * 2;
  const roadMeshes = new THREE.InstancedMesh(roadGeometry, roadMaterial, roadCount);
  const sidewalkMeshes = new THREE.InstancedMesh(
    roadGeometry,
    sidewalkMaterial,
    roadCount * 2,
  );

  const placement = new THREE.Object3D();
  const sidewalkOffset = (streetWidth + sidewalkWidth) / 2;
  let roadIndex = 0;
  let sidewalkIndex = 0;
  for (const line of roadLines) {
    for (const axis of [0, 1] as const) {
      placement.position.set(0, 0.006, 0);
      placement.rotation.set(0, 0, 0);
      placement.scale.set(
        axis === 0 ? stripLength : streetWidth,
        1,
        axis === 0 ? streetWidth : stripLength,
      );
      placement.position.x = axis === 0 ? 0 : line;
      placement.position.z = axis === 0 ? line : 0;
      placement.updateMatrix();
      roadMeshes.setMatrixAt(roadIndex, placement.matrix);
      roadIndex++;
      grid.segments.push({
        kind: 'road',
        x: axis === 0 ? 0 : line,
        z: axis === 0 ? line : 0,
        width: axis === 0 ? stripLength : streetWidth,
        depth: axis === 0 ? streetWidth : stripLength,
      });

      // Sidewalks: two strips bordering this road, offset to each side.
      for (const side of [-1, 1]) {
        placement.position.set(0, 0, 0);
        placement.rotation.set(0, 0, 0);
        placement.scale.set(
          axis === 0 ? stripLength : sidewalkWidth,
          1,
          axis === 0 ? sidewalkWidth : stripLength,
        );
        placement.position.x = axis === 0 ? 0 : line + side * sidewalkOffset;
        placement.position.z = axis === 0 ? line + side * sidewalkOffset : 0;
        placement.updateMatrix();
        sidewalkMeshes.setMatrixAt(sidewalkIndex, placement.matrix);
        sidewalkIndex++;
        grid.segments.push({
          kind: 'sidewalk',
          x: axis === 0 ? 0 : line + side * sidewalkOffset,
          z: axis === 0 ? line + side * sidewalkOffset : 0,
          width: axis === 0 ? stripLength : sidewalkWidth,
          depth: axis === 0 ? sidewalkWidth : stripLength,
        });
      }
    }
  }
  roadMeshes.instanceMatrix.needsUpdate = true;
  sidewalkMeshes.instanceMatrix.needsUpdate = true;

  group.add(roadMeshes);
  group.add(sidewalkMeshes);

  // ---- Road markings (lane lines + crosswalks) ------------------------
  // Dashed lane lines along every road strip plus solid edge lines, and
  // zebra crosswalks across both roads at every intersection. All markings
  // share one material and sit just above the road surface; they are
  // collected first so the InstancedMesh counts are exact.
  const markingMaterial = new THREE.MeshStandardMaterial({
    color: ROAD_MARKING_COLOR,
  });

  const dashGeometry = new THREE.BoxGeometry(1, 0.02, 1);
  const DASH_LENGTH = 1.8;
  const DASH_PERIOD = 4.0;
  const dashMargin = 1;
  const dashCount = Math.max(1, Math.floor((stripLength - 2 * dashMargin) / DASH_PERIOD));
  const dashMatrices: THREE.Matrix4[] = [];
  for (const line of roadLines) {
    // Single dashed center line per road (the lane divider between the two
    // travel directions); vehicles drive in the lanes beside it.
    for (let i = 0; i < dashCount; i++) {
      const along = -stripLength / 2 + dashMargin + i * DASH_PERIOD + DASH_LENGTH / 2;
      // Skip dashes that would run through an intersection (crossing road).
      let inIntersection = false;
      for (const crossing of roadLines) {
        if (Math.abs(along - crossing) < streetWidth / 2 + 0.5) {
          inIntersection = true;
          break;
        }
      }
      if (inIntersection) continue;
      // Horizontal road (runs along x): dash spans x; vertical: spans z.
      placement.position.set(0, 0, 0);
      placement.rotation.set(0, 0, 0);
      placement.scale.set(DASH_LENGTH, 1, 0.2);
      placement.position.set(along, MARKING_Y, line);
      placement.updateMatrix();
      dashMatrices.push(placement.matrix.clone());
      placement.scale.set(0.2, 1, DASH_LENGTH);
      placement.position.set(line, MARKING_Y, along);
      placement.updateMatrix();
      dashMatrices.push(placement.matrix.clone());
    }
  }

  const edgeMatrices: THREE.Matrix4[] = [];
  const edgeOffset = streetWidth / 2 - 1.0;
  for (const line of roadLines) {
    for (const side of [-1, 1]) {
      placement.position.set(0, MARKING_Y, line + side * edgeOffset);
      placement.rotation.set(0, 0, 0);
      placement.scale.set(stripLength, 1, 0.15);
      placement.updateMatrix();
      edgeMatrices.push(placement.matrix.clone());
      placement.position.set(line + side * edgeOffset, MARKING_Y, 0);
      placement.scale.set(0.15, 1, stripLength);
      placement.updateMatrix();
      edgeMatrices.push(placement.matrix.clone());
    }
  }

  const crosswalkMatrices: THREE.Matrix4[] = [];
  const BAR_COUNT = 8;
  const BAR_SPACING = 1.0;
  for (const pz of roadLines) {
    for (const px of roadLines) {
      // Bars across the horizontal road (span the road width along z).
      for (let k = 0; k < BAR_COUNT; k++) {
        const x = px + (k - (BAR_COUNT - 1) / 2) * BAR_SPACING;
        placement.position.set(x, MARKING_Y, pz);
        placement.rotation.set(0, 0, 0);
        placement.scale.set(0.8, 1, streetWidth);
        placement.updateMatrix();
        crosswalkMatrices.push(placement.matrix.clone());
      }
      // Bars across the vertical road (span the road width along x).
      for (let k = 0; k < BAR_COUNT; k++) {
        const z = pz + (k - (BAR_COUNT - 1) / 2) * BAR_SPACING;
        placement.position.set(px, MARKING_Y, z);
        placement.rotation.set(0, 0, 0);
        placement.scale.set(streetWidth, 1, 0.8);
        placement.updateMatrix();
        crosswalkMatrices.push(placement.matrix.clone());
      }
    }
  }

  const laneLines = createInstancedMesh(dashGeometry, markingMaterial, dashMatrices);
  const edgeLines = createInstancedMesh(dashGeometry, markingMaterial, edgeMatrices);
  const crosswalks = createInstancedMesh(dashGeometry, markingMaterial, crosswalkMatrices);
  group.add(laneLines);
  group.add(edgeLines);
  group.add(crosswalks);

  // ---- Buildings (instanced per block) --------------------------------
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let bx = 0; bx < blocksPerSide; bx++) {
    for (let bz = 0; bz < blocksPerSide; bz++) {
      const blockMinX = bx * blockStride - halfCity + sidewalkWidth;
      const blockMinZ = bz * blockStride - halfCity + sidewalkWidth;
      const blockCenterX = blockMinX + buildingArea / 2;
      const blockCenterZ = blockMinZ + buildingArea / 2;
      const buildingCount = Math.max(1, Math.floor(rng() * 3) + 1);

      const mesh = new THREE.InstancedMesh(boxGeometry, buildingMaterial, buildingCount);
      for (let i = 0; i < buildingCount; i++) {
        // Keep footprints inside the building area so walls never poke into
        // the sidewalk where street props live (RNG stream unchanged).
        const width = Math.min(randRange(rng, footprintRange[0], footprintRange[1]), buildingArea);
        const depth = Math.min(randRange(rng, footprintRange[0], footprintRange[1]), buildingArea);
        const height = randRange(rng, heightRange[0], heightRange[1]);

        const halfWidth = width / 2;
        const halfDepth = depth / 2;
        const maxOffsetX = Math.max(0, buildingArea / 2 - halfWidth);
        const maxOffsetZ = Math.max(0, buildingArea / 2 - halfDepth);
        const cx = blockCenterX + randRange(rng, -maxOffsetX, maxOffsetX);
        const cz = blockCenterZ + randRange(rng, -maxOffsetZ, maxOffsetZ);

        dummy.position.set(cx, height / 2, cz);
        dummy.scale.set(width, height, depth);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        color.setHex(pick(rng, FACADE_COLORS));
        mesh.setColorAt(i, color);

        // Collision data: full box from ground to roof.
        const box = new THREE.Box3(
          new THREE.Vector3(cx - halfWidth, 0, cz - halfDepth),
          new THREE.Vector3(cx + halfWidth, height, cz + halfDepth),
        );
        collisionBoxes.push(box);
        collisionData.push({
          minX: box.min.x,
          minY: box.min.y,
          minZ: box.min.z,
          maxX: box.max.x,
          maxY: box.max.y,
          maxZ: box.max.z,
        });
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
      group.add(mesh);
    }
  }

  return { group, collisionBoxes, collisionData, seed, grid };
}

/**
 * Build an InstancedMesh from a list of matrices. Any unused capacity (never
 * happens with real city sizes) is filled with zero-scale instances so stray
 * geometry never appears at the origin.
 */
function createInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  matrices: readonly THREE.Matrix4[],
): THREE.InstancedMesh {
  const count = Math.max(1, matrices.length);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    if (i < matrices.length) {
      mesh.setMatrixAt(i, matrices[i]);
    } else {
      dummy.position.set(0, 0, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export type {
  CityOptions,
  CityResult,
  CollisionBox,
  CityGrid,
  CityGridLayout,
} from './types';
