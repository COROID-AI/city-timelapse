import * as THREE from 'three';
import { createRng, pick, randRange } from './rng';
import type { CityOptions, CityResult, CollisionBox } from './types';

const FACADE_COLORS: readonly number[] = [
  0x8d6e63, 0xa1887f, 0xbc9b7a, 0xbcaaa4, 0xcdc9c3, 0xc8a97e, 0x9e9d8b,
  0x7f8c8d, 0x6d7b8d, 0x5f7d8c, 0x7986cb, 0x90a4ae, 0xa7adba, 0xcfcfcf,
];

const ROAD_COLOR = 0x4a4a52;
const ROAD_MARKING_COLOR = 0xf2f0e4;
const SIDEWALK_COLOR = 0x9a948b;
const GROUND_COLOR = 0x75756e;

/**
 * Generate the procedural city: a large ground plane, a street grid with
 * intersections, sidewalk rings around every block and per-block instanced
 * buildings with varied height, footprint and facade color.
 *
 * Generation is fully deterministic for a given seed.
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
  const halfCity = (blocksPerSide * blockStride) / 2;

  const group = new THREE.Group();
  const collisionBoxes: THREE.Box3[] = [];
  const collisionData: CollisionBox[] = [];

  // ---- Ground ---------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(halfCity * 2 + 320, halfCity * 2 + 320),
    new THREE.MeshStandardMaterial({ color: GROUND_COLOR }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  const roadGeometry = new THREE.BoxGeometry(1, 0.1, 1);
  const roadMaterial = new THREE.MeshStandardMaterial({ color: ROAD_COLOR });
  const markingMaterial = new THREE.MeshStandardMaterial({
    color: ROAD_MARKING_COLOR,
  });

  // ---- Street grid (roads + lane markings + sidewalks) ----------------
  // One box per road segment: 2 * blocksPerSide horizontal + vertical
  // segments, so draw calls stay low (~10 meshes for the whole grid).
  const roadSegmentCount = blocksPerSide * 2;
  const segmentLength = blocksPerSide * blockStride;
  const roadLength = segmentLength + sidewalkWidth * 2 + streetWidth;

  const roadMeshes = new THREE.InstancedMesh(roadGeometry, roadMaterial, roadSegmentCount);
  const markingMeshes = new THREE.InstancedMesh(roadGeometry, markingMaterial, roadSegmentCount);
  const sidewalkMeshes = new THREE.InstancedMesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({ color: SIDEWALK_COLOR }),
    roadSegmentCount * 2,
  );

  const placement = new THREE.Object3D();
  let roadIndex = 0;
  let sidewalkIndex = 0;
  for (let i = 0; i < blocksPerSide; i++) {
    const center = (i + 0.5) * blockStride - halfCity;

    for (const axis of [0, 1] as const) {
      placement.position.set(0, 0, 0);
      placement.rotation.set(0, 0, 0);
      placement.scale.set(
        axis === 0 ? roadLength : streetWidth,
        1,
        axis === 0 ? streetWidth : roadLength,
      );
      placement.position.x = axis === 0 ? center : 0;
      placement.position.z = axis === 0 ? 0 : center;
      placement.updateMatrix();
      roadMeshes.setMatrixAt(roadIndex, placement.matrix);
      roadIndex++;

      // Sidewalks: two strips bordering this road, offset to each side.
      for (const side of [-1, 1]) {
        placement.position.set(0, 0, 0);
        placement.rotation.set(0, 0, 0);
        placement.scale.set(
          axis === 0 ? roadLength : sidewalkWidth,
          1,
          axis === 0 ? sidewalkWidth : roadLength,
        );
        placement.position.x = axis === 0 ? center : side * (streetWidth / 2 + sidewalkWidth / 2);
        placement.position.z = axis === 0 ? side * (streetWidth / 2 + sidewalkWidth / 2) : center;
        placement.updateMatrix();
        sidewalkMeshes.setMatrixAt(sidewalkIndex, placement.matrix);
        sidewalkIndex++;
      }
    }
  }
  roadMeshes.instanceMatrix.needsUpdate = true;
  markingMeshes.instanceMatrix.needsUpdate = true;
  sidewalkMeshes.instanceMatrix.needsUpdate = true;

  group.add(roadMeshes);

  // Dashed center line on every road segment.
  for (let k = 0; k < roadSegmentCount; k++) {
    roadMeshes.getMatrixAt(k, placement.matrix);
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    placement.matrix.decompose(position, quaternion, scale);
    placement.position.set(0, 0, 0);
    placement.rotation.set(0, 0, 0);
    placement.scale.set(scale.x, 1, scale.z);
    placement.updateMatrix();
    markingMeshes.setMatrixAt(k, placement.matrix);
  }
  group.add(markingMeshes);
  group.add(sidewalkMeshes);

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
        const width = randRange(rng, footprintRange[0], footprintRange[1]);
        const depth = randRange(rng, footprintRange[0], footprintRange[1]);
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

  return { group, collisionBoxes, collisionData, seed };
}

export type { CityOptions, CityResult, CollisionBox } from './types';
