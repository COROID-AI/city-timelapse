/**
 * Camera rig: a three.js perspective camera bound to the navigation
 * controller, plus the React controller that lets a component drive it.
 *
 * The imperative {@link createCameraRig} is what the render pipeline uses: it
 * owns the camera, the damping loop and the projection updates, so era content
 * layers never touch camera maths. The {@link CameraRig} component is the thin
 * React wrapper for viewpoint presets — render it inside a scene canvas, hand
 * it a preset, and it applies the preset and reports state changes back.
 */

import { useEffect, type ReactElement, type ReactNode } from 'react'
import { PerspectiveCamera } from 'three'
import {
  applyCameraStateToCamera,
  createCameraBounds,
  createCameraState,
  createNavigationControls,
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_NEAR,
} from './controls'
import type {
  CameraMode,
  CameraRigApi,
  CameraState,
  CameraStatePatch,
  NavigationControlsOptions,
} from './types'

/** Aspect ratio used before the first resize measurement arrives. */
const DEFAULT_ASPECT = 16 / 9

/**
 * Creates the camera rig.
 *
 * The camera is written from the controller's *damped* state on every
 * {@link CameraRigApi.update}, and `configure` keeps the projection in step
 * with the canvas aspect and the quality tier's draw distance.
 */
export function createCameraRig(options: NavigationControlsOptions = {}): CameraRigApi {
  const bounds = createCameraBounds(options.bounds)
  const initial = createCameraState(options.state, bounds)
  const camera =
    options.camera ??
    new PerspectiveCamera(initial.fov, DEFAULT_ASPECT, DEFAULT_CAMERA_NEAR, DEFAULT_CAMERA_FAR)
  const controls = createNavigationControls({ ...options, bounds, camera })
  applyCameraStateToCamera(camera, controls.getView())

  let settling = false

  return {
    camera,
    controls,
    bounds,
    get settling(): boolean {
      return settling
    },
    setMode(mode: CameraMode): void {
      controls.setMode(mode)
      settling = true
    },
    setState(state: CameraStatePatch): void {
      controls.setState(state)
      settling = true
    },
    getState(): CameraState {
      return controls.getState()
    },
    getView(): CameraState {
      return controls.getView()
    },
    reset(): void {
      controls.reset()
      settling = true
    },
    configure({ aspect, far }: { aspect?: number; far?: number }): void {
      if (aspect !== undefined && Number.isFinite(aspect) && aspect > 0 && camera.aspect !== aspect) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }
      if (far !== undefined && Number.isFinite(far) && far > camera.near) {
        const current = controls.getState()
        if (Math.abs(current.far - far) > 1e-3) {
          controls.setState({ far })
          // Projection changes take effect immediately rather than at the next
          // damped frame, so a resize never renders one frame with stale lenses.
          applyCameraStateToCamera(camera, controls.getState())
        }
      }
    },
    update(deltaSeconds: number): boolean {
      settling = controls.update(deltaSeconds)
      return settling
    },
    dispose(): void {
      // The rig owns no GPU resources; the controller detaches its listeners
      // through the unbind function returned by `controls.bind`.
    },
  }
}

/** Props of the {@link CameraRig} React controller. */
export interface CameraRigProps {
  /** Rig to drive, normally `pipeline.rig` from the scene-canvas context. */
  readonly rig: CameraRigApi
  /** Camera mode to switch to whenever this prop changes. */
  readonly mode?: CameraMode
  /**
   * Viewpoint preset to apply whenever this prop's identity changes; memoise it
   * at the call site (era presets are stable module constants).
   */
  readonly state?: CameraStatePatch
  /** Called with the authoritative state after every input-driven change. */
  readonly onStateChange?: (state: CameraState) => void
  readonly children?: ReactNode
}

/**
 * React controller for a camera rig.
 *
 * Renders nothing but its children and never owns the rig: it only forwards
 * `mode`/`state` presets down and `onStateChange` back up, which keeps era
 * switching and viewpoint UI free of camera maths.
 */
export function CameraRig({ rig, mode, state, onStateChange, children }: CameraRigProps): ReactElement | null {
  useEffect(() => {
    if (mode !== undefined) {
      rig.setMode(mode)
    }
  }, [rig, mode])

  useEffect(() => {
    if (state !== undefined) {
      rig.setState(state)
    }
  }, [rig, state])

  useEffect(() => {
    if (onStateChange === undefined) {
      return undefined
    }
    return rig.controls.onStateChange(onStateChange)
  }, [rig, onStateChange])

  if (children === undefined) {
    return null
  }
  return <>{children}</>
}
