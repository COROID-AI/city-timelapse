import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NAV_BOUNDS } from './constants.js';

/**
 * Enforce collision-aware framing bounds on the navigation rig.
 *
 * OrbitControls integrates user input (orbit / pan / zoom) each frame. After it
 * settles we clamp the orbit target back inside the block's bounding box; the
 * spherical distance and polar-angle limits (set on the controls at creation)
 * keep the camera itself near the block. Together this guarantees the view
 * always stays framed on the city block.
 *
 * Call this every frame after `controls.update()`.
 */
export function applyNavigationBounds(controls: OrbitControls): void {
  controls.target.clamp(NAV_BOUNDS.minTarget, NAV_BOUNDS.maxTarget);
}
