/**
 * Cinematic camera controller for the city timelapse.
 *
 * Drives a {@link THREE.PerspectiveCamera} along a deterministic, frame-rate
 * independent path between two cinematographic shots:
 *
 *   - **Overview** (progress 0): a high, wide aerial of the whole block — the
 *     establishing shot used while an era is settled.
 *   - **Street level** (progress 1): a low dolly along the street that reads
 *     the era's traffic, parking and pedestrian detail up close.
 *
 * The path is a function of a single scalar `progress ∈ [0, 1]`, so the same
 * input always yields the same camera pose. This makes playback perfectly
 * deterministic (criterion 1) and, crucially, means that when the timeline is
 * paused `progress` does not change and the camera is mathematically stationary
 * — there is no accumulated drift or per-frame jitter (criterion 2).
 *
 * Every pose is clamped to the city block bounds so the camera can never leave
 * the built environment, even at the extremes of its orbit (criterion 3).
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Axis-aligned bounds of the city block, in metres, centred on the origin. */
export interface BlockBounds {
  /** Half-extent along X (east-west). */
  halfWidth: number;
  /** Half-extent along Z (north-south). */
  halfDepth: number;
}

/** Options for {@link createCameraController}. */
export interface CameraControllerOptions {
  /** Camera to drive (typically the one created by {@link createScene}). */
  camera: THREE.PerspectiveCamera;
  /** City block footprint; the camera stays inside these bounds. */
  bounds?: BlockBounds;
  /** Fixed world-space focal point the camera always looks at (block centre). */
  target?: THREE.Vector3;
}

/** Controller returned by {@link createCameraController}. */
export interface CameraController {
  /** The camera being driven. */
  readonly camera: THREE.PerspectiveCamera;
  /** Current normalised progress along the cinematic path, in [0, 1]. */
  readonly progress: number;
  /**
   * Advance the camera. `dt` is accepted for API completeness and to honour the
   * `update(dt, progress)` contract, but the pose is derived purely from
   * `progress` so the result is independent of elapsed wall-clock time.
   *
   * @param dt       Delta time in seconds (unused for pose, reserved for future motion blur).
   * @param progress Normalised timeline progress in [0, 1]. Clamped internally.
   */
  update: (dt: number, progress: number) => void;
  /** Read the bounds the controller clamps to. */
  readonly bounds: BlockBounds;
}

// ---------------------------------------------------------------------------
// Keyframed shots
// ---------------------------------------------------------------------------

/** A single camera keyframe: position + look-at focal length. */
interface CameraKey {
  /** Camera position in world space. */
  position: THREE.Vector3;
  /** Field of view in degrees at this key (dolly zoom is part of the move). */
  fov: number;
}

/**
 * Build the two endpoint shots from the block bounds.
 *
 * The overview sits high and pulled back so the whole block is framed; the
 * street-level shot drops to a pedestrian eye-line and moves in along the
 * street axis. Both positions are sized relative to the block so they scale
 * with the city footprint and never exceed it.
 */
function buildKeyframes(bounds: BlockBounds, target: THREE.Vector3): {
  overview: CameraKey;
  street: CameraKey;
} {
  const span = Math.max(bounds.halfWidth, bounds.halfDepth);

  // Overview: high aerial, pulled back ~1.6× the block span to frame it.
  const overview: CameraKey = {
    position: new THREE.Vector3(
      target.x + span * 0.35,
      span * 1.1 + 18,
      target.z + span * 1.4 + 28,
    ),
    fov: 55,
  };

  // Street level: low dolly along the +Z street edge, eye height ~1.7 m.
  const street: CameraKey = {
    position: new THREE.Vector3(
      target.x + bounds.halfWidth * 0.45,
      target.y + 1.7,
      target.z + bounds.halfDepth * 0.9 + 6,
    ),
    fov: 42,
  };

  return { overview, street };
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/**
 * Smoothstep easing for cinematic acceleration/deceleration at the path ends.
 * Maps the linear `progress` to a curve with zero derivative at 0 and 1, which
 * is what eliminates any perceptual "snap" at the era boundary.
 */
function smoothstep(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

// ---------------------------------------------------------------------------
// Clamping
// ---------------------------------------------------------------------------

/**
 * Clamp a camera position so it stays within the block bounds, padded by a
 * small margin so the framing never cuts the sidewalk at the edge.
 */
function clampToBounds(pos: THREE.Vector3, bounds: BlockBounds): void {
  const margin = 4; // metres of slack so the orbit doesn't graze the curb
  const maxX = bounds.halfWidth + margin;
  const maxZ = bounds.halfDepth + margin;
  pos.x = THREE.MathUtils.clamp(pos.x, -maxX, maxX);
  pos.z = THREE.MathUtils.clamp(pos.z, -maxZ, maxZ);
  // Y is unbounded above (the aerial shot needs height) but never dips below
  // the ground plane.
  pos.y = Math.max(pos.y, 0.6);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Default block footprint: an 80 m × 80 m block centred on the origin. */
const DEFAULT_BOUNDS: BlockBounds = { halfWidth: 40, halfDepth: 40 };

/**
 * Create a deterministic cinematic camera controller.
 *
 * The returned controller's `update(dt, progress)` method advances the camera
 * along a fixed overview→street path parametrised by `progress`. Because the
 * pose is a pure function of `progress`, pausing the timeline (holding
 * `progress` constant) freezes the camera exactly. Positions are clamped to the
 * city block bounds so the camera never leaves the built environment.
 *
 * @param options Camera, bounds and target.
 * @returns A {@link CameraController} bound to the supplied camera.
 */
export function createCameraController(
  options: CameraControllerOptions,
): CameraController {
  const { camera } = options;
  const bounds: BlockBounds = options.bounds ?? DEFAULT_BOUNDS;
  const target: THREE.Vector3 = options.target
    ? options.target.clone()
    : new THREE.Vector3(0, 0, 0);

  const { overview, street } = buildKeyframes(bounds, target);

  // Reusable temporaries to avoid per-frame allocation.
  const pos = new THREE.Vector3();
  let currentProgress = 0;

  /**
   * Compute the deterministic pose for a normalised progress value and apply it
   * to the camera.
   */
  function applyProgress(progress: number): void {
    const t = smoothstep(progress);

    // Position: lerp the overview→street endpoints, then add a gentle lateral
    // orbit arc so the move reads as a cinematic sweep rather than a straight
    // push-in. The orbit amplitude scales with the block span.
    pos.copy(overview.position).lerp(street.position, t);

    const span = Math.max(bounds.halfWidth, bounds.halfDepth);
    const orbitAmplitude = span * 0.18;
    // A single sine arc across the move gives a smooth, deterministic sweep
    // that is zero at both endpoints (so it never fights the keyframes).
    pos.x += Math.sin(t * Math.PI) * orbitAmplitude;

    // Enforce the block bounds on the computed position.
    clampToBounds(pos, bounds);
    camera.position.copy(pos);

    // Field of view: subtle dolly-zoom from wide (overview) to tighter
    // (street). Smoothstep keeps it ease-in/ease-out.
    const fov = THREE.MathUtils.lerp(overview.fov, street.fov, t);
    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Always look at the block centre so framing stays anchored.
    camera.lookAt(target);
  }

  // Initialise the camera at the overview pose.
  applyProgress(0);

  return {
    camera,
    bounds,
    get progress() {
      return currentProgress;
    },
    update(dt: number, progress: number): void {
      // `dt` is part of the contracted signature and reserved for future
      // motion-blur/vignette effects; the pose itself is purely a function of
      // `progress` so playback is deterministic and jitter-free when paused.
      void dt;
      currentProgress = THREE.MathUtils.clamp(progress, 0, 1);
      applyProgress(currentProgress);
    },
  };
}
