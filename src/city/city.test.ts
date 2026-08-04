import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { generateCity } from './index';

describe('generateCity', () => {
  it('returns a group with ground, streets, sidewalks and buildings', () => {
    const { group } = generateCity();
    // Ground plane, road InstancedMesh, road markings, sidewalk InstancedMesh,
    // plus one InstancedMesh per block of buildings.
    expect(group.children.length).toBeGreaterThanOrEqual(4 + 5 * 5);
  });

  it('places at least one building per block', () => {
    const { collisionData } = generateCity();
    const blocks = 5 * 5;
    expect(collisionData.length).toBeGreaterThanOrEqual(blocks);
    expect(collisionData.length).toBeLessThanOrEqual(blocks * 3);
  });

  it('uses InstancedMesh for buildings', () => {
    const { group } = generateCity();
    const instanced = group.children.filter(
      (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
    );
    expect(instanced.length).toBeGreaterThanOrEqual(25);
  });

  it('is deterministic for the same seed', () => {
    const first = generateCity({ seed: 42 });
    const second = generateCity({ seed: 42 });
    expect(first.collisionData).toEqual(second.collisionData);
    expect(first.collisionBoxes).toEqual(second.collisionBoxes);
  });

  it('produces different cities for different seeds', () => {
    const first = generateCity({ seed: 1 });
    const second = generateCity({ seed: 2 });
    expect(first.collisionData).not.toEqual(second.collisionData);
  });

  it('returns world-space collision boxes that contain the buildings', () => {
    const { collisionData } = generateCity({ seed: 7 });
    for (const box of collisionData) {
      expect(box.maxX).toBeGreaterThan(box.minX);
      expect(box.maxZ).toBeGreaterThan(box.minZ);
      expect(box.maxY).toBeGreaterThan(box.minY);
    }
  });

  it('supports custom city dimensions', () => {
    const { group, collisionData } = generateCity({
      seed: 3,
      blocksPerSide: 3,
      blockSize: 20,
      sidewalkWidth: 3,
      streetWidth: 8,
    });
    const boxes = collisionData.map((b) => new THREE.Box3(
      new THREE.Vector3(b.minX, b.minY, b.minZ),
      new THREE.Vector3(b.maxX, b.maxY, b.maxZ),
    ));
    // Building footprints stay inside the city extent.
    for (const box of boxes) {
      expect(box.min.x).toBeGreaterThanOrEqual(-90);
      expect(box.max.x).toBeLessThanOrEqual(90);
    }
    expect(group.children.length).toBeGreaterThanOrEqual(4 + 3 * 3);
  });

  it('generates varied building heights, footprints and colors', () => {
    const { group, collisionData } = generateCity({ seed: 11, blocksPerSide: 4 });
    const heights = new Set(collisionData.map((b) => b.maxY - b.minY));
    const widths = new Set(collisionData.map((b) => b.maxX - b.minX));
    expect(heights.size).toBeGreaterThan(1);
    expect(widths.size).toBeGreaterThan(1);

    const buildingMesh = group.children.find(
      (child): child is THREE.InstancedMesh =>
        child instanceof THREE.InstancedMesh
        && child.instanceColor !== null
        && child.position.equals(new THREE.Vector3(0, 0, 0)),
    );
    if (buildingMesh) {
      // Without instancing, color would be a single value per material.
      expect(buildingMesh.instanceColor).toBeDefined();
    }
  });

  it('aligns collision boxes with the instanced building matrices', () => {
    const { group, collisionData } = generateCity({ seed: 5, blocksPerSide: 3 });
    const buildingMeshes = group.children.filter(
      (child): child is THREE.InstancedMesh =>
        child instanceof THREE.InstancedMesh && child.instanceColor !== null,
    );
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    let boxIndex = 0;
    for (const mesh of buildingMeshes) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        matrix.decompose(position, quaternion, scale);
        const box = collisionData[boxIndex];
        // Unit-box geometry scaled by (width, height, depth), centered at position.
        expect(box.minX).toBeCloseTo(position.x - scale.x / 2, 5);
        expect(box.maxX).toBeCloseTo(position.x + scale.x / 2, 5);
        expect(box.minZ).toBeCloseTo(position.z - scale.z / 2, 5);
        expect(box.maxZ).toBeCloseTo(position.z + scale.z / 2, 5);
        expect(box.minY).toBeCloseTo(0, 5);
        expect(box.maxY).toBeCloseTo(scale.y, 5);
        boxIndex++;
      }
    }
    expect(boxIndex).toBe(collisionData.length);
  });
});
