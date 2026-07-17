/**
 * Single mutable frame-state object, written by the one era-progress driver's
 * `useFrame` and read (read-only) by category animators. This avoids per-frame
 * store writes / React re-renders while keeping a single source of truth for
 * the continuous `eraProgress`.
 */
export interface FrameState {
  /** Continuous era progress in 0..5 era-index space. */
  progress: number
  /** Delta seconds for the current frame. */
  dt: number
  /** Elapsed seconds. */
  time: number
  /** True while the driver is still morphing toward the selected era. */
  transitioning: boolean
  /** Reduced-motion: category animators should snap, not glide. */
  reduced: boolean
  /** Quality preset. */
  quality: 'high' | 'low'
}

export const frame: FrameState = {
  progress: 0,
  dt: 0,
  time: 0,
  transitioning: false,
  reduced: false,
  quality: 'high',
}
