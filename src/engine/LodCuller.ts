/**
 * LOD culling: marks distant or off-screen groups invisible.
 *
 * The scene is composed of era-scoped groups. Registering a group with this
 * module lets the engine hide it when it is either:
 *
 *   - farther than `maxDistance` from the camera (distance LOD), or
 *   - outside the camera's view frustum (frustum LOD), or
 *   - occluded by a registered occluder (occlusion LOD).
 *
 * The module is intentionally DOM-free and renderer-free: it only flips the
 * `visible` flag on registered groups based on pure math (Sphere/Frustum
 * intersection), so it runs identically in the app and in unit tests.
 *
 * Occlusion is a conservative estimate: a group is considered occluded when
 * the camera-to-group ray passes through one of the registered occluder
 * spheres *and* the occluder is closer to the camera than the group. This is
 * block-scale (no per-building collision), so a couple of large occluder
 * spheres (the tallest towers) are enough to keep the camera from rendering
 * things hidden behind them.
 */
import { Frustum, Matrix4 } from 'three';
import type { Sphere, Vector3 } from 'three';

/** A group registered for LOD culling. */
export interface LodGroup {
  /** Three.js group whose `visible` flag the culler toggles. */
  readonly group: { visible: boolean };
  /** World-space bounding sphere used for distance/frustum tests. */
  readonly sphere: Sphere;
  /** Groups beyond this distance (world units) are hidden. */
  readonly maxDistance: number;
}

/** A sphere that occludes groups behind it. */
export interface Occluder {
  /** World-space center. */
  readonly center: Vector3;
  /** World-space radius. */
  readonly radius: number;
}

/** State handed to `update()` each frame. */
export interface LodCameraState {
  /** Camera world position. */
  readonly position: Vector3;
  /** Camera view matrix (world → view). */
  readonly viewMatrix: Matrix4;
  /** Camera projection matrix. */
  readonly projectionMatrix: Matrix4;
}

/** Result of one frame's culling pass. */
export interface LodUpdateResult {
  /** Number of groups hidden this frame. */
  readonly hiddenCount: number;
  /** Number of groups visible this frame. */
  readonly visibleCount: number;
}

/** LOD culling engine. Call `update()` every frame after the camera moved. */
export class LodCuller {
  private readonly groups: LodGroup[] = [];
  private readonly occluders: Occluder[] = [];

  /** Registers a group for culling. */
  register(group: LodGroup): void {
    this.groups.push(group);
  }

  /** Removes a group from culling. */
  unregister(group: LodGroup): void {
    const index = this.groups.indexOf(group);
    if (index >= 0) this.groups.splice(index, 1);
  }

  /** Registers a sphere that occludes groups behind it. */
  addOccluder(occluder: Occluder): void {
    this.occluders.push(occluder);
  }

  /** Removes an occluder. */
  removeOccluder(occluder: Occluder): void {
    const index = this.occluders.indexOf(occluder);
    if (index >= 0) this.occluders.splice(index, 1);
  }

  /**
   * Runs the culling pass. Groups outside the frustum, beyond their max
   * distance, or occluded are marked invisible; the rest are marked visible.
   */
  update(camera: LodCameraState): LodUpdateResult {
    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.viewMatrix),
    );

    let hiddenCount = 0;
    let visibleCount = 0;

    for (const entry of this.groups) {
      const sphere = entry.sphere;
      const inFrustum = frustum.intersectsSphere(sphere);
      const distance = sphere.center.distanceTo(camera.position);
      const withinDistance = distance <= entry.maxDistance;
      const occluded = this.isOccluded(sphere, camera.position);

      const visible = inFrustum && withinDistance && !occluded;
      entry.group.visible = visible;
      if (visible) visibleCount += 1;
      else hiddenCount += 1;
    }

    return { hiddenCount, visibleCount };
  }

  /** True when `sphere` is behind any occluder relative to the camera. */
  private isOccluded(sphere: Sphere, cameraPosition: Vector3): boolean {
    for (const occluder of this.occluders) {
      const toGroup = sphere.center.clone().sub(cameraPosition);
      const toOccluder = occluder.center.clone().sub(cameraPosition);
      const toGroupLen = toGroup.length();
      const toOccluderLen = toOccluder.length();
      if (toGroupLen < 1e-6 || toOccluderLen < 1e-6) continue;

      const dir = toGroup.normalize();
      // Project the occluder center onto the camera→group ray.
      const t = toOccluder.dot(dir);
      if (t < 0) continue; // occluder behind the camera

      // Distance from the occluder center to the ray.
      const lateral = toOccluder.clone().sub(dir.clone().multiplyScalar(t)).length();
      const rayDistance = sphere.radius + occluder.radius;
      if (lateral <= rayDistance && t < toGroupLen) {
        return true;
      }
    }
    return false;
  }
}