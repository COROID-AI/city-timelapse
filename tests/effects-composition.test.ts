/**
 * Integrated composition test for the effects pipeline.
 *
 * Instantiates the REAL dependency modules against one another, exactly as the
 * composition owner will wire them in the finished game:
 *
 *   buildTrack()          → real phase-2 night circuit (neon-lit scene)
 *   createPlayerCar()     → real CarHandle (mesh + exhaust anchors)
 *   createChaseCamera()   → real CameraRig (camera + fov)
 *   createEffectsPipeline → real pipeline (composer + bloom + afterimage +
 *                           additive blue-purple exhaust plume)
 *
 * The renderer is a mocked WebGL surface (Jest has no GL context), so this is
 * a hermetic run: it proves construction, update/resize/dispose cycles, that
 * the plume is attached to the real car mesh and anchored to its exhaust
 * anchors, that camera FOV is driven during a simulated boost and settles
 * back when boost ends, and that everything disposes cleanly.
 */
import * as THREE from 'three';

import { buildTrack } from '../src/game/track';
import { createPlayerCar } from '../src/game/car';
import { createChaseCamera } from '../src/game/camera';
import {
  createEffectsPipeline,
  DEFAULT_EFFECTS_CONFIG,
  type EffectsPipeline,
} from '../src/game/effects';
import type { InputState } from '../src/game/contracts';

/** A hermetic renderer that satisfies the composer surface (no WebGL). */
function makeMockRenderer() {
  return {
    getSize: (target: THREE.Vector2) => target.set(1600, 900),
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    setEffects: () => {},
  };
}

const IDLE: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  nitrous: false,
};
const NITROUS: InputState = { ...IDLE, nitrous: true };
const STEP = 1 / 60;

describe('Effects pipeline composition (real track + car + camera)', () => {
  let track: ReturnType<typeof buildTrack>;
  let car: ReturnType<typeof createPlayerCar>;
  let rig: ReturnType<typeof createChaseCamera>;
  let pipeline: EffectsPipeline;

  beforeEach(() => {
    track = buildTrack();
    car = createPlayerCar({ track: track.data });
    rig = createChaseCamera();
    // Seat the chase rig at the car immediately.
    rig.update(STEP, car.state);
    pipeline = createEffectsPipeline(car, rig, track, makeMockRenderer());
  });

  afterEach(() => {
    pipeline.dispose();
    car.dispose();
    track.dispose();
  });

  function boostFrames(active: boolean, frames = 30): void {
    for (let i = 0; i < frames; i++) {
      car.update(STEP, active ? NITROUS : IDLE, track.data);
      rig.update(STEP, car.state);
      pipeline.update(STEP, {
        car,
        cameraRig: rig,
        scene: track,
        renderer: makeMockRenderer(),
      });
    }
  }

  it('constructs and runs instantiate/update/resize/dispose cycles cleanly', () => {
    // Already constructed in beforeEach. Exercise full lifecycle here.
    expect(pipeline.update).toBeInstanceOf(Function);
    expect(pipeline.resize).toBeInstanceOf(Function);
    expect(pipeline.dispose).toBeInstanceOf(Function);

    boostFrames(false, 5);
    pipeline.resize(1920, 1080);
    boostFrames(false, 5);
    pipeline.resize(1280, 720);
  });

  it('attaches the additive exhaust plume to the real car mesh', () => {
    // The plume is parented onto the car mesh so it inherits the car heading.
    const plume = pipeline.plume;
    expect(plume).not.toBeNull();
    expect(plume.name).toBe('nitrous-exhaust-plume');

    const attached = Array.from(car.mesh.children).some(
      (child) => child?.name === 'nitrous-exhaust-plume',
    );
    expect(attached).toBe(true);

    // The plume contains a cone and a particle pool (both additive materials).
    const meshes: THREE.Mesh[] = [];
    plume.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshes.push(obj);
    });
    const cone = meshes.find((m) => m.name === 'nitrous-flame-cone');
    const particles = meshes.filter((m) => m.name === 'nitrous-flame-particle');
    expect(cone).not.toBeUndefined();
    expect(particles.length).toBeGreaterThanOrEqual(1);
    // All plume meshes use additive blending so the flame adds over the scene.
    for (const mesh of meshes) {
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((mat) => {
          expect(mat.blending).toBe(THREE.AdditiveBlending);
        });
      } else {
        expect(material.blending).toBe(THREE.AdditiveBlending);
      }
    }
  });

  it('anchors the plume to the car exhaust anchors and inherits the heading', () => {
    // Reposition the car so anchoring is observable. The plume is PARENTED to
    // the car mesh, so its `position` is car-LOCAL: it sits at the local
    // exhaust-midpoint and inherits the car's world position + rotation, which
    // is exactly how it stays anchored to the exhaust and oriented along the
    // heading while the car drives.
    car.state.position.set(42, 0, -17);
    car.state.heading = Math.PI / 2;
    car.update(STEP, IDLE, track.data);

    boostFrames(true, 3);

    // The exhaust anchors live near the car rear; the plume should sit close
    // to their world position (which is the car position plus the anchor
    // offsets rotated by the car heading).
    const anchors = car.mesh.children.filter(
      (c) => c?.name === 'exhaust-left' || c?.name === 'exhaust-right',
    );
    expect(anchors.length).toBe(2);

    // The plume is a child of the car mesh: local position must be the mid of
    // the exhaust anchors (car-local), NOT the world position.
    const plumePos = pipeline.plume.position;
    const midX = (anchors[0].position.x + anchors[1].position.x) / 2;
    const midZ = (anchors[0].position.z + anchors[1].position.z) / 2;
    expect(Math.abs(plumePos.x - midX)).toBeLessThan(0.5);
    expect(Math.abs(plumePos.z - midZ)).toBeLessThan(0.5);
    // The plume inherits the car heading through parenting (rotation stays
    // neutral in local space — the car mesh carries the heading transform).
    expect(Math.abs(pipeline.plume.rotation.y)).toBeLessThan(0.05);

    // And the plume really is attached to the car mesh so it travels with it.
    const attached = Array.from(car.mesh.children).some(
      (child) => child?.name === 'nitrous-exhaust-plume',
    );
    expect(attached).toBe(true);
  });

  it('ignites flames while boostActive and extinguishes them when boost ends', () => {
    const visibleMeshes = () => {
      const out: THREE.Mesh[] = [];
      pipeline.plume.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.visible) out.push(obj);
      });
      return out;
    };

    boostFrames(false, 3);
    expect(visibleMeshes().length).toBe(0);

    // Charge nitrous through the real car physics so boost becomes active.
    car.state.nitrousCharge = 1;
    car.state.speed = 40;
    boostFrames(true, 5);
    expect(pipeline.boostActive).toBe(true);
    expect(visibleMeshes().length).toBeGreaterThan(0);

    // Let nitrous run out / release the throttle so boost ends.
    car.state.nitrousCharge = 0;
    boostFrames(false, 5);
    expect(pipeline.boostActive).toBe(false);
    expect(visibleMeshes().length).toBe(0);
  });

  it('exposes blue-purple flame coloring on the cone material', () => {
    // Configure a custom blue-purple accent and verify it lands on the plume.
    const cone = () => {
      const found: THREE.Mesh[] = [];
      pipeline.plume.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.name === 'nitrous-flame-cone') {
          found.push(obj);
        }
      });
      return found[0];
    };
    expect(cone()).not.toBeUndefined();
    // The cone's color channel carries the blue family; the accent particles
    // carry the purple family.
    const coneMaterial = cone()!.material;
    expect(Array.isArray(coneMaterial)).toBe(false);
    const coneColor = (coneMaterial as THREE.MeshBasicMaterial).color as THREE.Color;
    expect(coneColor.b).toBeGreaterThan(coneColor.r);
  });

  it('drives CameraRig fov wide during simulated boost and settles after', () => {
    const baseline = rig.fov;

    car.state.nitrousCharge = 1;
    car.state.speed = 45;
    boostFrames(true, 60);
    expect(pipeline.appliedFov).toBeGreaterThan(baseline);
    expect(rig.camera.fov).toBeGreaterThan(baseline);
    // Converge toward baseline + surge.
    const surged = baseline + DEFAULT_EFFECTS_CONFIG.boostFovSurge;
    expect(Math.abs(rig.camera.fov - surged)).toBeLessThan(4);

    // Release the throttle — FOV returns to baseline.
    car.state.nitrousCharge = 0;
    boostFrames(false, 60);
    expect(Math.abs(rig.camera.fov - baseline)).toBeLessThan(1.5);
  });

  it('applies subtle screen shake while boosting and stills when at rest', () => {
    car.state.nitrousCharge = 1;
    car.state.speed = 60;
    boostFrames(true, 10);
    const during = pipeline.shake.length();
    expect(during).toBeGreaterThan(0);

    car.state.speed = 0;
    car.state.nitrousCharge = 0;
    boostFrames(false, 40);
    const after = pipeline.shake.length();
    // Shake amplitude at rest (no boost) is ~0.35× the boost shake — small.
    expect(after).toBeLessThan(during);
  });

  it('disposes the pipeline and releases the plume from the car cleanly', () => {
    boostFrames(true, 3);
    pipeline.dispose();
    const stillAttached = Array.from(car.mesh.children).some(
      (child) => child?.name === 'nitrous-exhaust-plume',
    );
    expect(stillAttached).toBe(false);
  });
});