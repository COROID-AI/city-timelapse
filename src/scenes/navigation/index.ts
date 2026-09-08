/**
 * Camera & navigation rig.
 *
 * Owns an orbit camera (rotate / zoom / pan with damping and clamped pitch)
 * and named focus points consumed read-only from the layout module, so the
 * user can orbit the block, zoom in on buildings, and jump to vantages with a
 * smooth lerp. The pose is stable across era transitions because the rig never
 * resets the viewport and nothing else writes to it.
 *
 * @packageDocumentation
 */

export * from './types.js';
export * from './camera.js';
export * from './rig.js';
export { NavigationRig } from './rig.js';