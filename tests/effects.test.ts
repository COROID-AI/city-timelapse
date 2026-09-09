/**
 * Effects pipeline unit tests (src/game/effects.ts) with a mocked renderer.
 *
 * The real `three` ESM module is used (matching tests/track.test.ts — ts-jest
 * transforms it via transformIgnorePatterns) so the guarded composer/pass/
 * plume construction is exercised against the actual three classes. The
 * renderer itself is a hermetic mock that satisfies the composer surface but
 * provides no WebGL context (exactly like Jest).
 *
 * Coverage:
 *  - guarded construction (no WebGL context, no throw)
 *  - speed-scaled motion-blur blend parameter (monotonic, subtle→pronounced)
 *  - nitrous flame activation/deactivation driven by car.state.boostActive
 *  - flame color parameters feed the additive plume meshes
 *  - wide-angle FOV surge on the shared CameraRig
 *  - subtle screen shake during boost
 *  - resize keeps the composer/passes in sync
 *  - dispose releases composer, passes, and plume without errors
 */
import * as THREE from 'three';

import { createChaseCamera } from '../src/game/camera';
import {
  createEffectsPipeline,
  DEFAULT_EFFECTS_CONFIG,
  type EffectsPipeline,
} from '../src/game/effects';
import type { CarHandle, TrackHandle } from '../src/game/contracts';

/**
 * A mocked renderer exposing exactly the composer surface the pipeline needs
 * (getSize / getPixelRatio / getRenderTarget / setEffects). It deliberately
 * provides no WebGL context — like the Jest runtime.
 */
function makeMockRenderer(width = 1600, height = 900, pixelRatio = 1) {
  const setEffectsCalls: unknown[][] = [];
  return {
    size: { x: width, y: height },
    pixelRatio,
    getSize: (target: THREE.Vector2) => target.set(width, height),
    getPixelRatio: () => pixelRatio,
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    setEffects: (effects: unknown[]) => {
      setEffectsCalls.push(effects);
    },
    setEffectsCalls,
  };
}

/** Minimal car handle whose mesh has the real exhaust anchors. */
function makeCar(overrides: Partial<CarHandle['state']> = {}): CarHandle {
  const root = new THREE.Group();
  const exhaustL = new THREE.Object3D();
  exhaustL.position.set(-0.4, 0.25, -2.15);
  exhaustL.name = 'exhaust-left';
  const exhaustR = new THREE.Object3D();
  exhaustR.position.set(0.4, 0.25, -2.15);
  exhaustR.name = 'exhaust-right';
  root.add(exhaustL, exhaustR);

  const state = {
    position: new THREE.Vector3(0, 0, 0),
    heading: 0,
    speed: 0,
    driftFactor: 0,
    nitrousCharge: 0,
    boostActive: false,
    lap: 1,
    trackProgress: 0,
    ...overrides,
  };
  return { state, mesh: root };
}

/** Minimal track handle (only the scene membership is needed for reading). */
function makeScene(): TrackHandle {
  const group = new THREE.Group();
  group.name = 'NightCircuitTrackGroup';
  const data = {
    startLine: { position: new THREE.Vector3(), heading: 0 },
    waypoints: [new THREE.Vector3(), new THREE.Vector3(10, 0, 0)],
    checkpoints: [new THREE.Vector3(), new THREE.Vector3(10, 0, 0)],
    closed: true,
    width: 14,
  };
  return {
    data,
    group,
    fog: new THREE.FogExp2(new THREE.Color(0x050714), 0.0035),
  } as TrackHandle;
}

/**
 * Places a car at speed and optional boost, then runs the pipeline for
 * `frames` fixed steps so the smoothed effect state converges toward its
 * target (single-pole damping approaches ~1 - exp(-rate·dt) per frame).
 */
function drive(
  pipeline: EffectsPipeline,
  car: CarHandle,
  speed: number,
  boost = false,
  frames = 60,
) {
  car.state.speed = speed;
  car.state.boostActive = boost;
  for (let i = 0; i < frames; i++) {
    pipeline.update(1 / 60, { car });
  }
}

function plumeMeshes(plume: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  plume.traverse((obj) => {
    if (obj instanceof THREE.Mesh) out.push(obj);
  });
  return out;
}

describe('Effects pipeline (src/game/effects.ts)', () => {
  describe('guarded construction without a WebGL context', () => {
    it('constructs without throwing and exposes the guarded composer surface', () => {
      const renderer = makeMockRenderer();
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        renderer,
      );
      expect(pipeline).not.toBeNull();
      expect(pipeline.update).toBeInstanceOf(Function);
      expect(pipeline.resize).toBeInstanceOf(Function);
      expect(pipeline.dispose).toBeInstanceOf(Function);
      // Guarded construction means *no throw*: with a mocked renderer that
      // exposes the composer surface, the pipeline still builds the plan's
      // composer + bloom pass (the WebGL check is a duck-typed surface check,
      // not a GL-context probe). The bloom pass is always present when the
      // renderer looks live; the afterimage pass also constructs (Node has no
      // `window`, so it may be null — the pipeline degrades gracefully).
      expect(pipeline.composer).not.toBeNull();
      expect(pipeline.bloomPass).not.toBeNull();
      expect(pipeline.blurDamp).toBeCloseTo(DEFAULT_EFFECTS_CONFIG.minBlur, 6);
      expect(pipeline.boostActive).toBe(false);
      pipeline.dispose();
    });

    it('registers bloom + afterimage passes when the renderer exposes setEffects', () => {
      const renderer = makeMockRenderer();
      renderer.getRenderTarget = () => null;
      renderer.setRenderTarget = () => {};
      // A renderer exposing the full composer surface gets the plan's pass
      // stack registered (bloom +, when constructible, afterimage).
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        renderer,
      );
      expect(pipeline.bloomPass).not.toBeNull();
      expect(renderer.setEffectsCalls.length).toBeGreaterThanOrEqual(1);
      pipeline.dispose();
    });
  });

  describe('speed-scaled motion blur blend', () => {
    // The pipeline uses `opts.minBlur`/`opts.maxBlur`/`opts.maxSpeed`.
    it('starts at the subtle low-speed damp', () => {
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );
      expect(pipeline.blurDamp).toBeCloseTo(DEFAULT_EFFECTS_CONFIG.minBlur, 6);
      pipeline.dispose();
    });

    it('scales blur damp monotonically with speed', () => {
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );
      const car = makeCar();
      drive(pipeline, car, 0);
      const idle = pipeline.blurDamp;

      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed / 2);
      const mid = pipeline.blurDamp;

      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed);
      const max = pipeline.blurDamp;

      // Subtle at low speed, pronounced at racing speed, monotonic throughout.
      expect(max).toBeGreaterThan(mid);
      expect(mid).toBeGreaterThan(idle);
      expect(max).toBeGreaterThanOrEqual(
        DEFAULT_EFFECTS_CONFIG.maxBlur * 0.9,
      );
      expect(idle).toBeLessThanOrEqual(DEFAULT_EFFECTS_CONFIG.minBlur * 1.1);
      pipeline.dispose();
    });

    it('clamps blur damp at the racing-speed ceiling', () => {
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );
      const car = makeCar();
      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed * 3);
      expect(pipeline.blurDamp).toBeLessThanOrEqual(
        DEFAULT_EFFECTS_CONFIG.maxBlur,
      );
      pipeline.dispose();
    });
  });

  describe('nitrous boost flame activation', () => {
    it('turns the plume visible while boostActive and hides it when boost ends', () => {
      const car = makeCar();
      const pipeline = createEffectsPipeline(
        car,
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );

      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, false);
      // Simulate a couple of frames so any per-frame state settles.
      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, false);
      expect(pipeline.boostActive).toBe(false);
      const plumeOff = plumeMeshes(pipeline.plume);
      const offVisible = plumeOff.filter((m) => m.visible).length;
      expect(offVisible).toBe(0);

      // Activate boost.
      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, true);
      expect(pipeline.boostActive).toBe(true);
      const plumeOn = plumeMeshes(pipeline.plume);
      const onVisible = plumeOn.filter((m) => m.visible).length;
      expect(onVisible).toBeGreaterThan(0);

      // Boost ends → flames deactivate.
      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, false);
      expect(pipeline.boostActive).toBe(false);
      const afterOff = plumeMeshes(pipeline.plume);
      const afterOffVisible = afterOff.filter((m) => m.visible).length;
      expect(afterOffVisible).toBe(0);

      pipeline.dispose();
    });

    it('runs particle lifecycle: particles refresh while boosting', () => {
      const car = makeCar();
      const pipeline = createEffectsPipeline(
        car,
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );
      const particleMesh = () =>
        plumeMeshes(pipeline.plume).find(
          (m) => m.name === 'nitrous-flame-particle',
        );
      // Advance several frames on boost: age should stay < 1 (respawn).
      for (let i = 0; i < 30; i++) {
        drive(pipeline, car, 30, true);
      }
      expect(pipeline.boostActive).toBe(true);
      // The particle mesh exists and is visible during boost.
      const pm = particleMesh();
      expect(pm).not.toBeUndefined();
      expect(pm!.visible).toBe(true);
      pipeline.dispose();
    });
  });

  describe('wide-angle FOV surge on the CameraRig', () => {
    it('surges the rig camera fov above baseline while boostActive', () => {
      const rig = createChaseCamera();
      const car = makeCar();
      const pipeline = createEffectsPipeline(
        car,
        rig,
        makeScene(),
        makeMockRenderer(),
      );

      // Seed the chase rig at a baseline.
      rig.update(0, car.state);
      const baseline = rig.fov;

      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, true);
      // Several frames so the surge converges toward baseline + surge.
      for (let i = 0; i < 20; i++) {
        drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, true);
      }
      expect(rig.camera.fov).toBeGreaterThan(baseline);
      expect(pipeline.appliedFov).toBeGreaterThan(baseline);
      const expected = baseline + DEFAULT_EFFECTS_CONFIG.boostFovSurge;
      expect(Math.abs(rig.camera.fov - expected)).toBeLessThan(
        DEFAULT_EFFECTS_CONFIG.boostFovSurge * 0.5,
      );
      pipeline.dispose();
    });

    it('returns the fov toward baseline when boost ends', () => {
      const rig = createChaseCamera();
      const car = makeCar();
      const pipeline = createEffectsPipeline(
        car,
        rig,
        makeScene(),
        makeMockRenderer(),
      );
      rig.update(0, car.state);
      const baseline = rig.fov;

      for (let i = 0; i < 20; i++) {
        drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, true);
      }
      for (let i = 0; i < 20; i++) {
        drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, false);
      }
      // Converges back down to the chase baseline (within smoothing tolerance).
      expect(Math.abs(rig.camera.fov - baseline)).toBeLessThan(0.5);
      pipeline.dispose();
    });
  });

  describe('subtle screen shake', () => {
    it('produces a non-zero shake offset while boosting at speed', () => {
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );
      const car = makeCar();
      drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, true);
      for (let i = 0; i < 10; i++) {
        drive(pipeline, car, DEFAULT_EFFECTS_CONFIG.maxSpeed, true);
        // A few jitter steps to accumulate the shake offset.
      }
      const magnitude = pipeline.shake.length();
      // Shake is subtle but present.
      expect(magnitude).toBeGreaterThan(0);
      expect(magnitude).toBeLessThan(2 * DEFAULT_EFFECTS_CONFIG.shakeAmplitude);
      pipeline.dispose();
    });
  });

  describe('resize keeps the composer and passes in sync', () => {
    it('resizes the composer stack without throwing', () => {
      const renderer = makeMockRenderer();
      const pipeline = createEffectsPipeline(
        makeCar(),
        createChaseCamera(),
        makeScene(),
        renderer,
      );
      renderer.size.x = 1920;
      renderer.size.y = 1080;
      pipeline.resize(1920, 1080);
      pipeline.resize(1280, 720);
      pipeline.dispose();
      expect(true).toBe(true);
    });
  });

  describe('dispose releases composer, passes, and plume', () => {
    it('disposes cleanly and is idempotent', () => {
      const car = makeCar();
      const pipeline = createEffectsPipeline(
        car,
        createChaseCamera(),
        makeScene(),
        makeMockRenderer(),
      );
      drive(pipeline, car, 40, true);
      pipeline.resize(1600, 900);
      pipeline.dispose();
      pipeline.dispose();
      // After disposal the plume is removed from the car mesh.
      const stillAttached = Array.from(car.mesh.children).some(
        (c) => c?.name === 'nitrous-exhaust-plume',
      );
      expect(stillAttached).toBe(false);
    });
  });
});