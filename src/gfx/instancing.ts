/**
 * Instancing helpers and batch matrix management for 60fps repeated elements.
 *
 * Provides utilities for creating and mutating THREE.InstancedMesh instances for:
 * - Windows across repetitive building facades (500+ instances at 60fps)
 * - Bricks, stones, and decorative repeating modular blocks
 * - Pedestrian crowd proxies and street props
 *
 * Handles matrix compositions, per-instance color buffers, bounding sphere updates,
 * and high-efficiency batch updates.
 */

import * as THREE from 'three';

/** Transform descriptor for positioning an instance without creating a Matrix4 manually. */
export interface InstanceTransform {
  /** Translation vector [x, y, z] or THREE.Vector3. Defaults to [0, 0, 0]. */
  position?: [number, number, number] | THREE.Vector3;
  /** Euler rotation angles [x, y, z] in radians or THREE.Euler. Defaults to [0, 0, 0]. */
  rotation?: [number, number, number] | THREE.Euler;
  /** Scale factor number (uniform) or [sx, sy, sz] or THREE.Vector3. Defaults to 1. */
  scale?: number | [number, number, number] | THREE.Vector3;
}

const TEMP_POSITION = new THREE.Vector3();
const TEMP_ROTATION = new THREE.Euler();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_SCALE = new THREE.Vector3(1, 1, 1);
const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_COLOR = new THREE.Color();

/**
 * Compose a THREE.Matrix4 from an InstanceTransform descriptor.
 */
export function composeInstanceMatrix(
  transform: InstanceTransform,
  target: THREE.Matrix4 = new THREE.Matrix4(),
): THREE.Matrix4 {
  if (transform.position) {
    if (Array.isArray(transform.position)) {
      TEMP_POSITION.set(transform.position[0], transform.position[1], transform.position[2]);
    } else {
      TEMP_POSITION.copy(transform.position);
    }
  } else {
    TEMP_POSITION.set(0, 0, 0);
  }

  if (transform.rotation) {
    if (Array.isArray(transform.rotation)) {
      TEMP_ROTATION.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);
      TEMP_QUATERNION.setFromEuler(TEMP_ROTATION);
    } else {
      TEMP_QUATERNION.setFromEuler(transform.rotation);
    }
  } else {
    TEMP_QUATERNION.identity();
  }

  if (transform.scale !== undefined) {
    if (typeof transform.scale === 'number') {
      TEMP_SCALE.set(transform.scale, transform.scale, transform.scale);
    } else if (Array.isArray(transform.scale)) {
      TEMP_SCALE.set(transform.scale[0], transform.scale[1], transform.scale[2]);
    } else {
      TEMP_SCALE.copy(transform.scale);
    }
  } else {
    TEMP_SCALE.set(1, 1, 1);
  }

  target.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
  return target;
}

/** Options for creating an InstancedMesh wrapper. */
export interface CreateInstancedMeshOptions {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  count: number;
  name?: string;
  dynamic?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  colors?: boolean;
}

/**
 * Creates an InstancedMesh with configured shadow casting, optional per-instance color buffer,
 * and dynamic buffer usage flag for fast per-frame streaming.
 */
export function createInstancedMesh(options: CreateInstancedMeshOptions): THREE.InstancedMesh {
  const {
    geometry,
    material,
    count,
    name = 'instancedMesh',
    dynamic = false,
    castShadow = true,
    receiveShadow = true,
    colors = true,
  } = options;

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.name = name;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.instanceMatrix.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);

  if (colors) {
    const colorArray = new Float32Array(mesh.count * 3);
    // Initialize all to white (1, 1, 1)
    colorArray.fill(1.0);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    mesh.instanceColor.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
  }

  return mesh;
}

/**
 * Set the transform of a single instance in an InstancedMesh.
 */
export function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  transform: InstanceTransform | THREE.Matrix4,
): void {
  if (index < 0 || index >= mesh.count) return;

  if (transform instanceof THREE.Matrix4) {
    mesh.setMatrixAt(index, transform);
  } else {
    composeInstanceMatrix(transform, TEMP_MATRIX);
    mesh.setMatrixAt(index, TEMP_MATRIX);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Set the tint color of a single instance in an InstancedMesh.
 */
export function setInstanceColor(
  mesh: THREE.InstancedMesh,
  index: number,
  color: THREE.Color | string | number,
): void {
  if (index < 0 || index >= mesh.count) return;

  if (color instanceof THREE.Color) {
    mesh.setColorAt(index, color);
  } else {
    TEMP_COLOR.set(color as string);
    mesh.setColorAt(index, TEMP_COLOR);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

/**
 * Batch update multiple instance transforms in a single call.
 */
export function batchSetTransforms(
  mesh: THREE.InstancedMesh,
  transforms: ReadonlyArray<{ index: number; transform: InstanceTransform | THREE.Matrix4 }>,
): void {
  for (const item of transforms) {
    if (item.index >= 0 && item.index < mesh.count) {
      if (item.transform instanceof THREE.Matrix4) {
        mesh.setMatrixAt(item.index, item.transform);
      } else {
        composeInstanceMatrix(item.transform, TEMP_MATRIX);
        mesh.setMatrixAt(item.index, TEMP_MATRIX);
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Batch update multiple instance colors in a single call.
 */
export function batchSetColors(
  mesh: THREE.InstancedMesh,
  colors: ReadonlyArray<{ index: number; color: THREE.Color | string | number }>,
): void {
  for (const item of colors) {
    if (item.index >= 0 && item.index < mesh.count) {
      if (item.color instanceof THREE.Color) {
        mesh.setColorAt(item.index, item.color);
      } else {
        TEMP_COLOR.set(item.color as string);
        mesh.setColorAt(item.index, TEMP_COLOR);
      }
    }
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Specialized High-Detail Instancing Helpers
// ---------------------------------------------------------------------------

/**
 * Create a specialized InstancedMesh for repeating facade windows (500+ count).
 */
export function createWindowInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  count: number,
): THREE.InstancedMesh {
  return createInstancedMesh({
    geometry,
    material,
    count,
    name: 'windowInstancedMesh',
    dynamic: false,
    castShadow: true,
    receiveShadow: true,
    colors: true,
  });
}

/**
 * Create a specialized InstancedMesh for repeating decorative bricks or stone quoins.
 */
export function createBrickInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  count: number,
): THREE.InstancedMesh {
  return createInstancedMesh({
    geometry,
    material,
    count,
    name: 'brickInstancedMesh',
    dynamic: false,
    castShadow: true,
    receiveShadow: true,
    colors: true,
  });
}

/**
 * Create a specialized InstancedMesh for animated crowd pedestrian proxies.
 */
export function createCrowdInstancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  count: number,
): THREE.InstancedMesh {
  return createInstancedMesh({
    geometry,
    material,
    count,
    name: 'crowdInstancedMesh',
    dynamic: true,
    castShadow: true,
    receiveShadow: false,
    colors: true,
  });
}

/**
 * Helper to arrange instances into a 2D or 3D grid layout on a building facade or ground plane.
 */
export interface InstanceGridLayoutOptions {
  mesh: THREE.InstancedMesh;
  rows: number;
  columns: number;
  spacingX: number;
  spacingY: number;
  origin?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  colorFn?: (row: number, col: number, index: number) => THREE.Color | string | number;
}

export function populateInstancedGrid(options: InstanceGridLayoutOptions): number {
  const {
    mesh,
    rows,
    columns,
    spacingX,
    spacingY,
    origin = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    colorFn,
  } = options;

  let index = 0;
  const startX = origin[0] - ((columns - 1) * spacingX) / 2;
  const startY = origin[1];
  const z = origin[2];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (index >= mesh.count) break;

      const posX = startX + c * spacingX;
      const posY = startY + r * spacingY;

      setInstanceTransform(mesh, index, {
        position: [posX, posY, z],
        rotation,
        scale,
      });

      if (colorFn) {
        setInstanceColor(mesh, index, colorFn(r, c, index));
      }

      index++;
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return index;
}
