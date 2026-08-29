import { describe, expect, it } from 'vitest';
import { Frustum, Matrix4, PerspectiveCamera, Sphere, Vector3 } from 'three';

import { LodCuller } from '../LodCuller';
import type { LodGroup } from '../LodCuller';

/** Builds a camera state from a positioned camera. */
function cameraState(camera: PerspectiveCamera) {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return {
    position: camera.position.clone(),
    viewMatrix: camera.matrixWorldInverse.clone(),
    projectionMatrix: camera.projectionMatrix.clone(),
  };
}

/** Creates a group with a world-space sphere. */
function group(
  center: Vector3,
  radius = 1,
  maxDistance = 100,
): LodGroup {
  return {
    group: { visible: true },
    sphere: new Sphere(center.clone(), radius),
    maxDistance,
  };
}

describe('LodCuller — marks distant/occluded groups invisible', () => {
  it('hides groups beyond their max distance', () => {
    const camera = new PerspectiveCamera(60, 1.5, 0.1, 400);
    camera.position.set(0, 5, 0);
    camera.lookAt(0, 0, -10);

    const culler = new LodCuller();
    const near = group(new Vector3(0, 0, -10), 1, 100);
    const far = group(new Vector3(0, 0, -200), 1, 50);
    culler.register(near);
    culler.register(far);

    const result = culler.update(cameraState(camera));
    expect(near.group.visible).toBe(true);
    expect(far.group.visible).toBe(false);
    expect(result.hiddenCount).toBe(1);
    expect(result.visibleCount).toBe(1);
  });

  it('hides groups outside the view frustum', () => {
    const camera = new PerspectiveCamera(60, 1.5, 0.1, 400);
    camera.position.set(0, 5, 0);
    camera.lookAt(0, 0, -10);

    const culler = new LodCuller();
    const inFront = group(new Vector3(0, 0, -10), 1, 100);
    const behind = group(new Vector3(0, 0, 10), 1, 100);
    culler.register(inFront);
    culler.register(behind);

    culler.update(cameraState(camera));
    expect(inFront.group.visible).toBe(true);
    expect(behind.group.visible).toBe(false);
  });

  it('marks a group occluded by a closer occluder sphere', () => {
    const camera = new PerspectiveCamera(60, 1.5, 0.1, 400);
    camera.position.set(0, 2, -20);
    camera.lookAt(0, 0, 0);

    const culler = new LodCuller();
    const target = group(new Vector3(0, 0, 20), 1, 100);
    culler.register(target);
    culler.addOccluder({ center: new Vector3(0, 0, 0), radius: 5 });

    culler.update(cameraState(camera));
    expect(target.group.visible).toBe(false);
  });

  it('unregisters a group and stops culling it', () => {
    const camera = new PerspectiveCamera(60, 1.5, 0.1, 400);
    camera.position.set(0, 5, 0);
    camera.lookAt(0, 0, 0);

    const culler = new LodCuller();
    const g = group(new Vector3(0, 0, 200), 1, 50);
    culler.register(g);
    culler.unregister(g);

    // After unregistering, the group's visible flag is left alone.
    g.group.visible = true;
    culler.update(cameraState(camera));
    expect(g.group.visible).toBe(true);
  });

  it('uses the actual frustum intersection math', () => {
    const camera = new PerspectiveCamera(60, 1.5, 0.1, 400);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const frustum = new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    // A sphere far behind the camera is outside the frustum.
    expect(frustum.intersectsSphere(new Sphere(new Vector3(0, 0, 20), 1))).toBe(false);
    // A sphere in front is inside.
    expect(frustum.intersectsSphere(new Sphere(new Vector3(0, 0, -10), 1))).toBe(true);
  });
});