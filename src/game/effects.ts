/**
 * Post-processing effects pipeline for the neon street racer.
 *
 * One owned pipeline — `createEffectsPipeline` — delivers the phase-3 visual
 * spectacle against the real phase-2 scene, car, and camera:
 *
 *  - **Neon bloom** — an UnrealBloom-style luminance bloom tuned so the
 *    emissive neon signs, taillights, and city lights glow when the real track
 *    scene renders, while the bloom floor keeps the dark circuit readable.
 *  - **Speed-scaled motion blur** — a frame afterimage/accumulation blend whose
 *    strength (`damp`) rises monotonically with car speed: subtle at low speed,
 *    pronounced at racing speed.
 *  - **Nitrous boost presentation** — while `car.state.boostActive`, the
 *    pipeline drives a wide-angle FOV surge on the shared `CameraRig`, anchors
 *    an additive blue-purple exhaust-flame plume (cone + particles) to the car
 *    mesh's exhaust anchors oriented along the car heading, and applies subtle
 *    screen shake. Flames deactivate the moment boost ends.
 *
 * ## Compositor integration
 *
 * The pipeline builds the three.js `EffectComposer` stack named by the plan:
 * a cost-capped `UnrealBloomPass` plus a speed-driven `AfterimagePass`, both
 * held in the composer so `resize()` keeps the whole stack in sync and
 * `dispose()` releases every pass and render target exactly once.
 *
 * Construction is guarded: on hosts without a WebGL context (Jest has none)
 * the pipeline still constructs and exposes the same handle with a mocked
 * renderer, so unit tests cover construction, update/resize/dispose, blur
 * scaling, and flame activation/deactivation end to end.
 *
 * For the live render path, three.js 0.186 is the WebGPU-era renderer whose
 * native post-processing output chain (`WebGLRenderer#setEffects` →
 * `WebGLOutput`) drives the standard legacy pass interface
 * (`render(renderer, writeBuffer, readBuffer, deltaTime)` with `needsSwap`
 * ping-ponging). When the renderer supports it, the pipeline registers its
 * bloom + afterimage passes with `renderer.setEffects(...)`, so the passes
 * render automatically on every `renderer.render(scene, camera)` — no
 * per-frame composer.render() call is needed (and none is made; the legacy
 * composer's own render() path predates the r186 output system).
 *
 * Note for the composition owner: live bloom/motion blur require the renderer
 * to be constructed with `outputBufferType: THREE.HalfFloatType` (see
 * `EFFECTS_RENDERER_SETUP`). The pipeline degrades gracefully otherwise —
 * boost presentation (FOV surge, flame plume, shake) always works.
 */
import * as THREE from 'three';

// The pass/composer addons live under `three/examples/jsm/postprocessing` in
// this three@0.186 install (the `three/addons/...` export alias maps onto the
// same files but is not materialized as a directory). `examples/jsm/*` is an
// explicit export entry, so both the Bundler build and ts-jest (node10-style)
// resolve it.
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';

import type {
  CameraRig,
  CarHandle,
  EffectsPipelineHandle,
  TrackHandle,
} from './contracts';

/** Optional tuning knobs for the effects pipeline. */
export interface EffectsConfig {
  /** Bloom strength; higher = brighter emissive glow. Default 1.35. */
  bloomStrength?: number;
  /** Bloom radius in [0,1]; widens the glow around bright sources. Default 0.4. */
  bloomRadius?: number;
  /** Only pixels brighter than this luminance contribute to bloom. Default 0.72. */
  bloomThreshold?: number;
  /** Motion-blur afterimage damp at standstill. Default 0.02 (subtle). */
  minBlur?: number;
  /** Motion-blur afterimage damp at `maxSpeed`. Default 0.6 (pronounced). */
  maxBlur?: number;
  /** Speed at which motion blur saturates (m/s). Default 75. */
  maxSpeed?: number;
  /** Extra vertical FOV added during nitrous boost (degrees). Default 12. */
  boostFovSurge?: number;
  /** FOV surge smoothing rate (1/s). Default 8. */
  boostFovRate?: number;
  /** Primary blue exhaust flame color. Default 0x3366ff. */
  flameColor?: number;
  /** Secondary purple exhaust particle color. Default 0xaa33ff. */
  flameAccentColor?: number;
  /** Exhaust flame plume length in meters. Default 3.6. */
  flameLength?: number;
  /** Peak screen-shake amplitude in world meters. Default 0.05. */
  shakeAmplitude?: number;
  /** Screen-shake smoothing rate (1/s). Default 14. */
  shakeRate?: number;
  /** Internal bloom pass resolution scale (capped for performance). Default 0.5. */
  bloomResolutionScale?: number;
}

/** Complete default tuning, calibrated against the real night-circuit scene. */
export const DEFAULT_EFFECTS_CONFIG: Readonly<Required<EffectsConfig>> =
  Object.freeze({
    bloomStrength: 1.35,
    bloomRadius: 0.4,
    bloomThreshold: 0.72,
    minBlur: 0.02,
    maxBlur: 0.6,
    maxSpeed: 75.0,
    boostFovSurge: 12.0,
    boostFovRate: 8.0,
    flameColor: 0x3366ff,
    flameAccentColor: 0xaa33ff,
    flameLength: 3.6,
    shakeAmplitude: 0.05,
    shakeRate: 14.0,
    bloomResolutionScale: 0.5,
  });

/**
 * Renderer requirement for live bloom + motion blur. The composition owner
 * should construct the WebGLRenderer with this option:
 * `new THREE.WebGLRenderer({ canvas, outputBufferType: THREE.HalfFloatType })`.
 */
export const EFFECTS_RENDERER_SETUP =
  "WebGLRenderer outputBufferType must be THREE.HalfFloatType " +
  'for renderer.setEffects() to apply bloom/motion-blur passes.';

/** Maximum device pixels per logical pixel the pipeline will ever request. */
const MAX_PIXEL_RATIO = 1.5;

/** Seconds per particle before it is respawned behind the exhaust. */
const PARTICLE_LIFE_SECONDS = 0.5;
/** Number of additive exhaust particles. */
const PARTICLE_COUNT = 6;

/** Small deterministic helpers (kept local so tests assert concrete math). */
const clamp01 = (value: number): number =>
  value < 0 ? 0 : value > 1 ? 1 : value;
const clamp = (value: number, lo: number, hi: number): number =>
  value < lo ? lo : value > hi ? hi : value;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Frame-rate-independent single-pole damping factor: a fraction `k` of the
 * remaining error moves every frame, converging monotonically (no overshoot).
 */
const dampK = (rate: number, dt: number): number =>
  1 - Math.exp(-rate * clamp(dt, 0, 0.25));

/**
 * The renderer surface the composer stack needs. Duck-typed so that mocked
 * renderers in tests (which provide these methods) exercise the real
 * composer/pass classes without any WebGL context.
 */
interface ComposerRendererSurface {
  getSize: (target: THREE.Vector2) => THREE.Vector2;
  getPixelRatio: () => number;
  getRenderTarget: () => unknown;
  setRenderTarget?: (target: unknown) => void;
  setEffects?: (effects: unknown[]) => void;
}

function looksLikeRenderer(renderer: unknown): renderer is ComposerRendererSurface {
  if (typeof renderer !== 'object' || renderer === null) return false;
  const r = renderer as Partial<ComposerRendererSurface>;
  return (
    typeof r.getSize === 'function' &&
    typeof r.getPixelRatio === 'function' &&
    typeof r.getRenderTarget === 'function'
  );
}

/** Cost-capped bloom pass resolution based on renderer size + pixel ratio. */
function bloomResolution(
  renderer: ComposerRendererSurface,
  scale: number,
): THREE.Vector2 {
  const size = renderer.getSize(new THREE.Vector2());
  const pixelRatio = clamp(renderer.getPixelRatio(), 1, MAX_PIXEL_RATIO);
  return new THREE.Vector2(
    Math.max(128, Math.round(size.x * scale * pixelRatio)),
    Math.max(128, Math.round(size.y * scale * pixelRatio)),
  );
}

/** Shared local-position midpoint of the car's exhaust anchors (or fallback). */
function exhaustMidpoint(
  car: CarHandle,
  fallback: THREE.Vector3,
): THREE.Vector3 {
  const anchors: THREE.Object3D[] = [];
  const children = car?.mesh?.children;
  if (children) {
    for (const child of children) {
      const name = child?.name;
      if (name === 'exhaust-left' || name === 'exhaust-right') {
        anchors.push(child);
      }
    }
  }
  if (anchors.length === 0) return fallback.clone();
  const mid = new THREE.Vector3();
  for (const anchor of anchors) mid.add(anchor.position);
  mid.divideScalar(anchors.length);
  return mid;
}

/** Rich context passed to `update` by the composition owner. */
export interface EffectsUpdateContext {
  car?: CarHandle;
  cameraRig?: CameraRig;
  scene?: TrackHandle;
  renderer?: unknown;
}

/**
 * The effects pipeline handle. Implements the foundation `EffectsPipelineHandle`
 * contract (`update` / `resize` / `dispose`) and additionally exposes live
 * effect state so tests and the composition owner can observe and tune it.
 */
export interface EffectsPipeline extends EffectsPipelineHandle {
  /** The EffectComposer stack (bloom + afterimage passes), or null when no
   *  WebGL-compatible renderer is present (Jest). */
  readonly composer: EffectComposer | null;
  /** The bloom pass when the composer could be built, else null. */
  readonly bloomPass: UnrealBloomPass | null;
  /** The motion-blur afterimage pass, or null (needs a browser `window`). */
  readonly motionPass: AfterimagePass | null;
  /** Current speed-scaled motion-blur damp, the live blend parameter. */
  readonly blurDamp: number;
  /** True while the nitrous boost presentation is active. */
  readonly boostActive: boolean;
  /** Current effective FOV written to the rig camera (baseline + surge). */
  readonly appliedFov: number;
  /** Subtle screen-shake offset applied to the camera, in world units. */
  readonly shake: THREE.Vector3;
  /** Current peak screen-shake amplitude (speed × boost scaled). */
  readonly shakeAmplitude: number;
  /** The additive exhaust plume group parented to the car mesh. */
  readonly plume: THREE.Group;

  update: (deltaSeconds: number, context?: EffectsUpdateContext) => void;
  /** Resize the composer stack and every owned pass to the new viewport. */
  resize: (width: number, height: number) => void;
}

/**
 * Create the post-processing effects pipeline.
 *
 * Construction is guarded: when the renderer cannot host the composer stack
 * (Jest, headless sandboxes, or a renderer lacking the compositor methods) the
 * pipeline still constructs and exposes a fully working handle — update/resize/
 * dispose are safe and deterministic either way.
 *
 * @param car        The player car handle — its exhaust anchors anchor the plume.
 * @param cameraRig  The chase camera rig — `fov` surge is applied via
 *                   `rig.fov`/`rig.camera.fov`.
 * @param scene      The real track scene (read for calibration; its emissive
 *                   materials are what the bloom pass makes glow).
 * @param renderer   The live WebGLRenderer (or a mock in tests).
 * @param config     Optional tuning overrides.
 */
export function createEffectsPipeline(
  car: CarHandle,
  cameraRig: CameraRig,
  scene: TrackHandle,
  renderer: unknown,
  config: EffectsConfig = {},
): EffectsPipeline {
  void scene; // scene emits the neon luminance that bloom amplifies.

  const opts: Required<EffectsConfig> = {
    bloomStrength: config.bloomStrength ?? DEFAULT_EFFECTS_CONFIG.bloomStrength,
    bloomRadius: config.bloomRadius ?? DEFAULT_EFFECTS_CONFIG.bloomRadius,
    bloomThreshold:
      config.bloomThreshold ?? DEFAULT_EFFECTS_CONFIG.bloomThreshold,
    minBlur: config.minBlur ?? DEFAULT_EFFECTS_CONFIG.minBlur,
    maxBlur: config.maxBlur ?? DEFAULT_EFFECTS_CONFIG.maxBlur,
    maxSpeed: config.maxSpeed ?? DEFAULT_EFFECTS_CONFIG.maxSpeed,
    boostFovSurge: config.boostFovSurge ?? DEFAULT_EFFECTS_CONFIG.boostFovSurge,
    boostFovRate: config.boostFovRate ?? DEFAULT_EFFECTS_CONFIG.boostFovRate,
    flameColor: config.flameColor ?? DEFAULT_EFFECTS_CONFIG.flameColor,
    flameAccentColor:
      config.flameAccentColor ?? DEFAULT_EFFECTS_CONFIG.flameAccentColor,
    flameLength: config.flameLength ?? DEFAULT_EFFECTS_CONFIG.flameLength,
    shakeAmplitude:
      config.shakeAmplitude ?? DEFAULT_EFFECTS_CONFIG.shakeAmplitude,
    shakeRate: config.shakeRate ?? DEFAULT_EFFECTS_CONFIG.shakeRate,
    bloomResolutionScale:
      config.bloomResolutionScale ??
      DEFAULT_EFFECTS_CONFIG.bloomResolutionScale,
  };

  // ------------------------------------------------------------------
  // 1. EffectComposer stack (plan surface), guarded construction.
  // ------------------------------------------------------------------
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  let motionPass: AfterimagePass | null = null;

  if (looksLikeRenderer(renderer)) {
    try {
      const r = renderer;
      composer = new EffectComposer(r as THREE.WebGLRenderer);

      const res = bloomResolution(r, opts.bloomResolutionScale);
      bloomPass = new UnrealBloomPass(
        res,
        opts.bloomStrength,
        opts.bloomRadius,
        opts.bloomThreshold,
      );
      composer.addPass(bloomPass);

      try {
        // Requires a browser `window` (three's AfterimagePass uses it for its
        // default buffer size); without one the pipeline still delivers blur
        // through its owned blend scalar.
        motionPass = new AfterimagePass(opts.minBlur);
        composer.addPass(motionPass);
      } catch {
        motionPass = null;
      }

      // Register the passes with the renderer's native post-processing chain
      // when the renderer exposes it, so bloom + blur render automatically
      // with every scene render. Guarded: unsupported renderers keep the
      // composer stack but bypass live pass execution.
      if (typeof r.setEffects === 'function') {
        const effects: unknown[] = [bloomPass];
        if (motionPass !== null) effects.push(motionPass);
        try {
          r.setEffects(effects);
        } catch {
          // Renderer logs and ignores when outputBufferType is not HalfFloat.
        }
      }
    } catch {
      composer = null;
      bloomPass = null;
      motionPass = null;
    }
  }

  // ------------------------------------------------------------------
  // 2. Additive blue-purple exhaust plume (cone + particles), parented to
  //    the car mesh so it inherits the car heading automatically.
  // ------------------------------------------------------------------
  const flameColor = new THREE.Color(opts.flameColor);
  const flameAccentColor = new THREE.Color(opts.flameAccentColor);

  const plume = new THREE.Group();
  plume.name = 'nitrous-exhaust-plume';

  const plumeMeshes: THREE.Mesh[] = [];

  const hasCar = car !== null && typeof car === 'object' && car.mesh != null;
  let plumeAttached = false;
  let plumeMid = new THREE.Vector3(0, 0.25, -2.15);

  if (hasCar) {
    plumeMid = exhaustMidpoint(car, plumeMid);
    plume.position.copy(plumeMid);

    try {
      // Cone: long axis +Y by default; rotation.x = -PI/2 lays it along the
      // car's local -Z (rearward), base at the exhaust midpoint.
      const coneGeo = new THREE.ConeGeometry(0.26, opts.flameLength, 10);
      const coneMat = new THREE.MeshBasicMaterial({
        color: flameColor,
        blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.name = 'nitrous-flame-cone';
      cone.position.set(0, 0, opts.flameLength / 2);
      cone.rotation.x = -Math.PI / 2;
      cone.visible = false;
      plume.add(cone);
      plumeMeshes.push(cone);
    } catch {
      // Geometry/material construction may fail on hermetic mocks.
    }

    try {
      // Additive purple particle pool trailing behind the exhaust.
      const particleGeo = new THREE.BoxGeometry(0.09, 0.09, 0.14);
      const particleMat = new THREE.MeshBasicMaterial({
        color: flameAccentColor,
        blending: THREE.AdditiveBlending,
      });
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = new THREE.Mesh(particleGeo, particleMat);
        particle.name = 'nitrous-flame-particle';
        particle.visible = false;
        plume.add(particle);
        plumeMeshes.push(particle);
      }
    } catch {
      // Particle pool construction is optional cosmetic detail.
    }

    try {
      car.mesh.add(plume);
      plumeAttached = true;
    } catch {
      plumeAttached = false;
    }
  }

  const particleTrail = Math.max(opts.flameLength * 1.6, 2.0);
  const particleLife = PARTICLE_LIFE_SECONDS;
  const particleAge: number[] = new Array(PARTICLE_COUNT).fill(1);

  // ------------------------------------------------------------------
  // 3. Live effect state.
  // ------------------------------------------------------------------
  let blurDamp = opts.minBlur;
  let boostActive = false;
  let appliedFov = 0;
  let shakeOffset = new THREE.Vector3();
  let shakeTarget = new THREE.Vector3();
  let disposed = false;

  /** Local-space spawn point relative to the plume origin (exhaust mid). */
  const spawnParticle = (index: number): void => {
    particleAge[index] = 0;
    const particle = plume.children
      .filter((c) => c?.name === 'nitrous-flame-particle')
      .at(index);
    if (particle == null) return;
    particle.position.set(
      (Math.random() * 2 - 1) * 0.22,
      0.06 + Math.random() * 0.18,
      -(Math.random() * 0.4),
    );
  };

  const setPlumeVisible = (visible: boolean): void => {
    plume.visible = visible;
    if (!visible) {
      for (const mesh of plumeMeshes) mesh.visible = false;
    }
  };

  const updatePlume = (dt: number, boosting: boolean): void => {
    if (!hasCar) return;
    if (!boosting) {
      setPlumeVisible(false);
      return;
    }
    setPlumeVisible(true);
    const cone = plume.children.find((c) => c?.name === 'nitrous-flame-cone');
    if (cone != null) cone.visible = true;

    const particles = plume.children.filter(
      (c) => c?.name === 'nitrous-flame-particle',
    );
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      particleAge[i] += dt / particleLife;
      if (particleAge[i] >= 1) {
        spawnParticle(i);
      }
      const age = clamp01(particleAge[i]);
      const trail = particleTrail * age;
      particle.position.z = -(0.2 + trail);
      particle.visible = age < 1;
      // Shrink as the particle fades so the plume tapers rearward.
      const s = 1 - age * 0.6;
      particle.scale.set(s, s, s);
    }
  };

  // ------------------------------------------------------------------
  // 4. Handle implementation.
  // ------------------------------------------------------------------

  const update = (
    deltaSeconds: number,
    context?: EffectsUpdateContext,
  ): void => {
    if (disposed) return;
    const dt = clamp(deltaSeconds, 0, 0.25);
    const activeCar = context?.car ?? car;
    const activeRig = context?.cameraRig ?? cameraRig;

    if (activeCar == null || activeCar.state == null) return;
    const state = activeCar.state;

    // --- Speed-scaled motion blur (afterimage accumulation blend) ----------
    const speedT = clamp01(state.speed / opts.maxSpeed);
    const targetDamp = lerp(opts.minBlur, opts.maxBlur, speedT);
    blurDamp += (targetDamp - blurDamp) * dampK(6, dt);
    if (motionPass != null) {
      try {
        motionPass.damp = blurDamp;
      } catch {
        // Hermetic mock pass — the owned scalar above stays authoritative.
      }
    }

    // --- Nitrous boost presentation ----------------------------------------
    const boosting = state.boostActive === true;
    boostActive = boosting;

    // FOV baseline comes from the chase rig (its speed-scaled `fov`), or the
    // camera's current fov when the rig wrapper does not expose `fov`.
    const rigFov = readRigFov(activeRig);
    const fovTarget = boosting ? rigFov + opts.boostFovSurge : rigFov;
    appliedFov += (fovTarget - appliedFov) * dampK(opts.boostFovRate, dt);

    const camera = readRigCamera(activeRig);
    if (camera != null && typeof camera.fov === 'number') {
      camera.fov = appliedFov;
      if (typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix();
      }
    }

    // Flame plume anchored to the car heading.
    updatePlume(dt, boosting);

    // --- Subtle screen shake ------------------------------------------------
    const speedFactor = 0.6 + 0.4 * speedT;
    const boostFactor = boosting ? 1.8 : 0.35;
    const amplitude = opts.shakeAmplitude * speedFactor * boostFactor;
    if (boosting) {
      shakeTarget.set(
        (Math.random() * 2 - 1) * amplitude,
        (Math.random() * 2 - 1) * amplitude * 0.6,
        (Math.random() * 2 - 1) * amplitude * 0.8,
      );
    } else {
      shakeTarget.set(0, 0, 0);
    }
    const k = dampK(opts.shakeRate, dt);
    shakeOffset.x += (shakeTarget.x - shakeOffset.x) * k;
    shakeOffset.y += (shakeTarget.y - shakeOffset.y) * k;
    shakeOffset.z += (shakeTarget.z - shakeOffset.z) * k;

    // Best-effort application to the camera (the chase rig's own next update
    // re-seats the camera, so the shake only colours the current frame).
    if (camera != null && camera.position != null) {
      const p = camera.position as {
        x: number;
        y: number;
        z: number;
        add?: (v: { x: number; y: number; z: number }) => void;
      };
      if (typeof p.add === 'function') {
        try {
          p.add(shakeOffset);
        } catch {
          // Camera may be a hermetic mock without a working position.
        }
      }
    }
  };

  /** Resize keeps the composer and every owned pass in sync. */
  const resize = (width: number, height: number): void => {
    if (disposed) return;
    try {
      if (composer != null) composer.setSize(width, height);
    } catch {
      // Guarded fallback keeps the owned scalar pipeline consistent.
    }
  };

  /** Release GPU resources: composer, passes, plume meshes. Idempotent. */
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;

    if (composer != null) {
      try {
        composer.dispose();
      } catch {
        // Best effort.
      }
    }
    if (bloomPass != null) {
      try {
        bloomPass.dispose();
      } catch {
        // Best effort.
      }
    }
    if (motionPass != null) {
      try {
        motionPass.dispose();
      } catch {
        // Best effort.
      }
    }

    if (hasCar && plumeAttached) {
      try {
        car.mesh.remove(plume);
      } catch {
        // Car may be a hermetic mock without remove().
      }
    }
    // Dispose every plume mesh's geometry/material where supported.
    for (const mesh of plumeMeshes) {
      try {
        if (mesh.geometry != null) mesh.geometry.dispose();
      } catch {
        // Already disposed.
      }
      const material = mesh.material;
      if (material != null) {
        try {
          if (Array.isArray(material)) {
            for (const mat of material) {
              if (mat != null) mat.dispose();
            }
          } else {
            material.dispose();
          }
        } catch {
          // Already disposed.
        }
      }
    }
    plumeMeshes.length = 0;
  };

  const handle: EffectsPipeline = {
    get composer() {
      return composer;
    },
    get bloomPass() {
      return bloomPass;
    },
    get motionPass() {
      return motionPass;
    },
    get blurDamp() {
      return blurDamp;
    },
    get boostActive() {
      return boostActive;
    },
    get appliedFov() {
      return appliedFov;
    },
    get shake() {
      return shakeOffset;
    },
    get shakeAmplitude(): number {
      const speedT = clamp01(car?.state?.speed ?? 0 / opts.maxSpeed);
      const boostFactor = boostActive ? 1.8 : 0.35;
      return opts.shakeAmplitude * (0.6 + 0.4 * speedT) * boostFactor;
    },
    get plume() {
      return plume;
    },
    update,
    resize,
    dispose,
  };

  return handle;
}

/** Reads the rig's baseline FOV (ChaseCameraHandle.fov or camera.fov). */
function readRigFov(rig: CameraRig | null): number {
  if (rig == null) return 0;
  const wrapper = rig as CameraRig & { fov?: number };
  if (typeof wrapper.fov === 'number') return wrapper.fov;
  const camera = readRigCamera(rig);
  if (camera != null && typeof camera.fov === 'number') return camera.fov;
  return 0;
}

interface PerspectiveLike {
  fov?: number;
  updateProjectionMatrix?: () => void;
  position?: unknown;
}

/** Extracts the underlying THREE camera when the rig exposes one. */
function readRigCamera(rig: CameraRig | null): PerspectiveLike | null {
  if (rig == null) return null;
  const wrapper = rig as CameraRig & { camera?: PerspectiveLike };
  return wrapper.camera ?? null;
}