import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { generateCity } from '../city';
import { createStreetProps } from './streetProps';
import { TrafficSystem } from './traffic';

/** Sidewalk band (distance from a road center line) where props/pedestrians live. */
function sidewalkBand(grid: { streetWidth: number; sidewalkWidth: number }): [number, number] {
  return [
    grid.streetWidth / 2 - 0.5,
    grid.streetWidth / 2 + grid.sidewalkWidth + 0.5,
  ];
}

describe('createStreetProps', () => {
  it('places all four prop types as instanced meshes aligned to the grid', () => {
    const city = generateCity({ seed: 42 });
    const props = createStreetProps({ seed: city.seed, grid: city.grid });

    expect(props.counts.lamp).toBeGreaterThan(0);
    expect(props.counts.tree).toBeGreaterThan(0);
    expect(props.counts.bench).toBeGreaterThan(0);
    expect(props.counts.sign).toBeGreaterThan(0);

    const instanced = props.group.children.filter(
      (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
    );
    // One InstancedMesh per single-color prop (lamp, bench, sign) plus the
    // tree trunk and foliage meshes = 5 draw calls total.
    expect(instanced.length).toBe(5);
  });

  it('places props on sidewalk strips, never inside buildings', () => {
    const city = generateCity({ seed: 7 });
    const props = createStreetProps({ seed: city.seed, grid: city.grid });
    const halfLen = city.grid.stripLength / 2;
    const [bandMin, bandMax] = sidewalkBand(city.grid);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    let checked = 0;
    for (const mesh of props.group.children) {
      if (!(mesh instanceof THREE.InstancedMesh)) continue;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        const { x, z } = position;

        // On a sidewalk: one coordinate sits inside the sidewalk band of some
        // road line, the other stays within the strip span.
        const onSidewalk =
          city.grid.roadLines.some(
            (line) => Math.abs(z - line) >= bandMin && Math.abs(z - line) <= bandMax,
          )
          || city.grid.roadLines.some(
            (line) => Math.abs(x - line) >= bandMin && Math.abs(x - line) <= bandMax,
          );
        expect(onSidewalk).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(halfLen + 0.01);
        expect(Math.abs(z)).toBeLessThanOrEqual(halfLen + 0.01);

        // Never inside any building footprint (props sit on the ground, so
        // any x/z overlap with a building column is a placement error).
        for (const box of city.collisionData) {
          const inside =
            x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ;
          expect(inside).toBe(false);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed and varied across seeds', () => {
    const city = generateCity({ seed: 42 });
    const a = createStreetProps({ seed: city.seed, grid: city.grid });
    const b = createStreetProps({ seed: city.seed, grid: city.grid });
    expect(a.counts).toEqual(b.counts);
    const other = generateCity({ seed: 43 });
    const c = createStreetProps({ seed: other.seed, grid: other.grid });
    expect(c.counts).not.toEqual(a.counts);
  });
});

describe('TrafficSystem', () => {
  it('creates instanced vehicles and pedestrians aligned to the grid', () => {
    const city = generateCity({ seed: 42 });
    const traffic = new TrafficSystem({ seed: city.seed, grid: city.grid });

    expect(traffic.counts.vehicles).toBeGreaterThan(0);
    expect(traffic.counts.pedestrians).toBeGreaterThan(0);

    const instanced = traffic.group.children.filter(
      (child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh,
    );
    expect(instanced.length).toBe(2);

    const [vehicleMesh, pedestrianMesh] = instanced;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const [bandMin, bandMax] = sidewalkBand(city.grid);
    const halfLen = city.grid.stripLength / 2;

    // Vehicles sit on a travel lane within a road strip.
    for (let i = 0; i < vehicleMesh.count; i++) {
      vehicleMesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      const onRoad =
        city.grid.roadLines.some((line) => Math.abs(position.z - line) < 2.0)
        || city.grid.roadLines.some((line) => Math.abs(position.x - line) < 2.0);
      expect(onRoad).toBe(true);
      expect(Math.abs(position.x)).toBeLessThanOrEqual(halfLen + 0.5);
      expect(Math.abs(position.z)).toBeLessThanOrEqual(halfLen + 0.5);
    }

    // Pedestrians walk the sidewalk centerline (inside the sidewalk band).
    for (let i = 0; i < pedestrianMesh.count; i++) {
      pedestrianMesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      const onSidewalk =
        city.grid.roadLines.some(
          (line) => Math.abs(position.z - line) >= bandMin
            && Math.abs(position.z - line) <= bandMax,
        )
        || city.grid.roadLines.some(
          (line) => Math.abs(position.x - line) >= bandMin
            && Math.abs(position.x - line) <= bandMax,
        );
      expect(onSidewalk).toBe(true);
      expect(Math.abs(position.x)).toBeLessThanOrEqual(halfLen + 0.5);
      expect(Math.abs(position.z)).toBeLessThanOrEqual(halfLen + 0.5);
    }
  });

  it('animates vehicles and pedestrians in update()', () => {
    const city = generateCity({ seed: 5 });
    const traffic = new TrafficSystem({ seed: city.seed, grid: city.grid });

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const vehicleMesh = traffic.group.children[0] as THREE.InstancedMesh;
    const pedestrianMesh = traffic.group.children[1] as THREE.InstancedMesh;

    const before = new Float32Array(vehicleMesh.count * 3);
    for (let i = 0; i < vehicleMesh.count; i++) {
      vehicleMesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      before.set([position.x, position.y, position.z], i * 3);
    }

    traffic.update(1.0);
    let moved = 0;
    for (let i = 0; i < vehicleMesh.count; i++) {
      vehicleMesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      const dx = position.x - before[i * 3];
      const dz = position.z - before[i * 3 + 2];
      if (Math.hypot(dx, dz) > 0.5) moved++;
    }
    expect(moved).toBeGreaterThan(0);

    const beforeP = new Float32Array(pedestrianMesh.count * 3);
    for (let i = 0; i < pedestrianMesh.count; i++) {
      pedestrianMesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      beforeP.set([position.x, position.y, position.z], i * 3);
    }
    traffic.update(1.0);
    let movedP = 0;
    for (let i = 0; i < pedestrianMesh.count; i++) {
      pedestrianMesh.getMatrixAt(i, matrix);
      position.setFromMatrixPosition(matrix);
      const dx = position.x - beforeP[i * 3];
      const dz = position.z - beforeP[i * 3 + 2];
      if (Math.hypot(dx, dz) > 0.5) movedP++;
    }
    expect(movedP).toBeGreaterThan(0);
  });

  it('keeps traffic on the road/sidewalk strips over time', () => {
    const city = generateCity({ seed: 9 });
    const traffic = new TrafficSystem({ seed: city.seed, grid: city.grid });
    const limit = city.grid.stripLength / 2 - 1;
    for (let t = 0; t < 30; t++) traffic.update(0.5);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    for (const mesh of traffic.group.children) {
      if (!(mesh instanceof THREE.InstancedMesh)) continue;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        position.setFromMatrixPosition(matrix);
        expect(Math.abs(position.x)).toBeLessThanOrEqual(limit + 0.5);
        expect(Math.abs(position.z)).toBeLessThanOrEqual(limit + 0.5);
      }
    }
  });
});
