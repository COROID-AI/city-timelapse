import type { CollisionBox } from '../city/types';

/**
 * Optional rectangular area the player is kept inside (the city extent), so
 * the walk camera cannot wander off into the empty ground beyond the streets.
 */
export interface CityBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * True when the circle (px, pz) with the given radius overlaps the horizontal
 * footprint of `box`. The box is treated as a vertical column (minY..maxY),
 * so this is a pure 2D test — building ground/roof bounds do not matter here
 * because every building rises well above eye level.
 */
export function circleOverlapsBox(
  px: number,
  pz: number,
  box: CollisionBox,
  radius: number,
): boolean {
  const cx = Math.min(Math.max(px, box.minX), box.maxX);
  const cz = Math.min(Math.max(pz, box.minZ), box.maxZ);
  const dx = px - cx;
  const dz = pz - cz;
  return dx * dx + dz * dz < radius * radius;
}

/** True when the circle overlaps any building bounding box. */
export function overlapsAnyBox(
  px: number,
  pz: number,
  boxes: readonly CollisionBox[],
  radius: number,
): boolean {
  for (const box of boxes) {
    if (circleOverlapsBox(px, pz, box, radius)) {
      return true;
    }
  }
  return false;
}

/**
 * Move the player by (dx, dz) with axis-separated AABB collision so movement
 * slides along walls instead of stopping dead or clipping through. The player
 * is modelled as a circle of `radius` centred on the camera.
 *
 * - The step is split into sub-steps of at most `radius` world units so large
 *   deltas (low frame rates, direct calls) cannot tunnel through a building.
 * - Within each sub-step the full X move is tried first (Z unchanged), then
 *   the Z move using the resolved X. Blocked axes keep their previous
 *   coordinate, which yields natural wall sliding at walking speeds.
 * - If the starting position is already inside a building (possible when the
 *   OrbitControls fallback teleports the camera), collision is skipped so the
 *   player can walk back out; collision resumes once outside.
 * - Optional `bounds` clamp keeps the player inside the city extent.
 */
export function resolveStep(
  px: number,
  pz: number,
  dx: number,
  dz: number,
  boxes: readonly CollisionBox[],
  radius: number,
  bounds?: CityBounds,
): { x: number; z: number } {
  const distance = Math.hypot(dx, dz);
  if (distance <= 1e-9) {
    return { x: px, z: pz };
  }

  const maxStep = Math.max(radius, 0.25);
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  const stepX = dx / steps;
  const stepZ = dz / steps;

  let x = px;
  let z = pz;
  for (let i = 0; i < steps; i++) {
    // Teleported inside a building: allow free movement so the player can
    // exit; collision resumes once the circle leaves the footprint.
    if (overlapsAnyBox(x, z, boxes, radius)) {
      x += stepX;
      z += stepZ;
    } else {
      const nx = overlapsAnyBox(x + stepX, z, boxes, radius) ? x : x + stepX;
      z = overlapsAnyBox(nx, z + stepZ, boxes, radius) ? z : z + stepZ;
      x = nx;
    }
    if (bounds) {
      x = Math.min(Math.max(x, bounds.minX), bounds.maxX);
      z = Math.min(Math.max(z, bounds.minZ), bounds.maxZ);
    }
  }
  return { x, z };
}

export interface VerticalOptions {
  /** Y coordinate of the ground plane (building footprints start here). */
  groundY: number;
  /** Camera height above the ground plane while standing. */
  eyeHeight: number;
  /** Gravity applied while airborne (positive = pulls down). */
  gravity: number;
  /** Initial vertical speed of a jump (positive = up). */
  jumpSpeed: number;
}

export interface VerticalState {
  /** Camera Y position. */
  y: number;
  /** Current vertical velocity (positive = up). */
  verticalVelocity: number;
  /** True when standing on the ground plane. */
  onGround: boolean;
}

/**
 * Integrate the vertical axis for one frame: applies a queued jump impulse,
 * gravity and ground clamping so the player always stays on (or briefly hops
 * above) the ground plane and never sinks below it.
 */
export function integrateVertical(
  state: VerticalState,
  delta: number,
  options: VerticalOptions,
  jumpRequested = false,
): VerticalState {
  let { y, verticalVelocity, onGround } = state;

  if (jumpRequested && onGround) {
    verticalVelocity = options.jumpSpeed;
    onGround = false;
  }

  verticalVelocity -= options.gravity * delta;
  y += verticalVelocity * delta;

  const floorY = options.groundY + options.eyeHeight;
  if (y <= floorY) {
    y = floorY;
    verticalVelocity = 0;
    onGround = true;
  }

  return { y, verticalVelocity, onGround };
}
