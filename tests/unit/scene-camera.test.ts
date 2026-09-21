/**
 * Camera rig, navigation controls and lighting rig.
 *
 * These are the parts of the render pipeline that are pure enough to pin down
 * without a GPU: spherical camera maths, bounds clamping, damped input
 * handling (pointer, wheel, keyboard and touch), serialisable camera state, and
 * the parameter-driven lighting rig. Everything is imported from the scene
 * barrel (`src/scene/index.ts`) so the suite also proves the public surface
 * consumers are told to use.
 */

import { PerspectiveCamera, Vector3 } from 'three'
import type { Scene } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  BLOCK_CAMERA_BOUNDS,
  CAMERA_MODES,
  DAY_LIGHTING,
  DEFAULT_CAMERA_STATE,
  DEFAULT_NAVIGATION_SENSITIVITY,
  KEY_BINDINGS,
  LIGHTING_PRESET_PARAMS,
  NIGHT_LIGHTING,
  NIGHT_SUN_FACTOR,
  applyCameraStateToCamera,
  cameraStateForMode,
  cameraStatePosition,
  cameraStateToOrbit,
  cameraStateToStreet,
  cameraStateView,
  cameraStatesEqual,
  clampToBoundsDisc,
  cloneCameraState,
  createCameraBounds,
  createCameraState,
  createLightingParams,
  createLightingRig,
  createNavigationControls,
  createCameraRig,
  distanceXZ,
  isSunBelowHorizon,
  orbitPosition,
  patchCameraState,
  resolveLightingPreset,
  resolveLightingProfile,
  sanitizeCameraState,
  streetForward,
  streetRight,
  sunDirectionFromAngles,
  wrapAngle,
  type CameraState,
  type NavigationControls,
  type PointerSample,
  type TouchListSample,
} from '../../src/scene'

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Minimal `TouchList` stand-in: the controller only reads length and indices. */
function touchList(...points: Array<[number, number]>): TouchListSample {
  const list: Record<number, { clientX: number; clientY: number }> = {}
  points.forEach(([clientX, clientY], index) => {
    list[index] = { clientX, clientY }
  })
  return { length: points.length, ...list } as TouchListSample
}

function pointer(pointerId: number, clientX: number, clientY: number, extra: Partial<PointerSample> = {}): PointerSample {
  return { pointerId, clientX, clientY, ...extra }
}

/** Advances the controller by `seconds` in 60 fps steps. */
function settle(controls: NavigationControls, seconds = 1): number {
  const step = 1 / 60
  const steps = Math.round(seconds / step)
  let last = 0
  for (let index = 0; index < steps; index += 1) {
    last = controls.update(step) ? 1 : 0
  }
  return last
}

/* -------------------------------------------------------------------------- */
/* Camera state maths                                                          */
/* -------------------------------------------------------------------------- */

describe('camera state maths (src/scene/controls.ts)', () => {
  it('places the orbit eye on a sphere around the target', () => {
    const target = [3, 6, -2] as const
    const orbit = { azimuth: 0.9, polar: 1.05, radius: 24 }
    const eye = orbitPosition(target, orbit)
    expect(Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2])).toBeCloseTo(24, 6)
    expect(eye[1] - target[1]).toBeCloseTo(24 * Math.cos(1.05), 6)
    // Azimuth is measured clockwise from +Z.
    expect(eye[0] - target[0]).toBeGreaterThan(0)
    expect(eye[2] - target[2]).toBeGreaterThan(0)
  })

  it('round-trips orbit -> street -> orbit without moving the eye', () => {
    const state = createCameraState({
      orbit: { azimuth: -1.25, polar: 1.1, radius: 32 },
      target: [2, 5, -4],
    })
    const street = cameraStateToStreet(state)
    expect(street.mode).toBe('street')
    expect(street.street.heading).toBeCloseTo(-1.25, 6)
    expect(street.street.pitch).toBeCloseTo(1.1 - Math.PI / 2, 6)

    const restored = cameraStateToOrbit(street)
    expect(restored.orbit.azimuth).toBeCloseTo(-1.25, 6)
    expect(restored.orbit.polar).toBeCloseTo(1.1, 6)
    expect(restored.orbit.radius).toBeCloseTo(32, 6)
    expect(restored.target[0]).toBeCloseTo(2, 6)
    expect(restored.target[1]).toBeCloseTo(5, 6)
    expect(restored.target[2]).toBeCloseTo(-4, 6)
  })

  it('keeps a viewer in place when the camera mode changes', () => {
    const state = createCameraState({ mode: 'orbit', orbit: { azimuth: 0.4, polar: 1.2, radius: 28 } })
    const eye = cameraStatePosition(state)
    const street = cameraStateForMode(state, 'street')
    expect(distanceXZ(street.street.position, eye)).toBeLessThan(1e-6)
    expect(street.street.position[1]).toBeCloseTo(eye[1], 6)

    const backToOrbit = cameraStateForMode(street, 'orbit')
    expect(distanceXZ(cameraStatePosition(backToOrbit), eye)).toBeLessThan(1e-6)
  })

  it('clamps orbit radius, polar angle and target height into the bounds', () => {
    const bounds = createCameraBounds({ radius: 20, orbitRadius: { min: 8, max: 60 }, orbitPolar: { min: 0.2, max: 1.3 } })
    const wild = sanitizeCameraState(
      createCameraState({ target: [200, 900, -200], orbit: { radius: 5000, polar: 3.1 } }),
      bounds,
    )
    expect(distanceXZ(wild.target, bounds.center)).toBeCloseTo(20, 6)
    expect(wild.orbit.radius).toBe(60)
    expect(wild.orbit.polar).toBe(1.3)
    expect(wild.target[1]).toBe(bounds.maxY)

    const tooClose = sanitizeCameraState(createCameraState({ orbit: { radius: 0.5 } }), bounds)
    expect(tooClose.orbit.radius).toBe(8)
  })

  it('clamps the street-level eye inside the block envelope', () => {
    const street = sanitizeCameraState(
      createCameraState({
        mode: 'street',
        street: { position: [400, 500, -400], heading: Math.PI * 7, pitch: 3 },
      }),
    )
    expect(distanceXZ(street.street.position, BLOCK_CAMERA_BOUNDS.center)).toBeCloseTo(
      BLOCK_CAMERA_BOUNDS.radius,
      6,
    )
    expect(street.street.position[1]).toBe(BLOCK_CAMERA_BOUNDS.streetHeight.max)
    expect(street.street.pitch).toBe(BLOCK_CAMERA_BOUNDS.streetPitch.max)
    expect(street.street.heading).toBeGreaterThanOrEqual(-Math.PI)
    expect(street.street.heading).toBeLessThanOrEqual(Math.PI)
  })

  it('clamps a point onto the bounds disc leaving inside points alone', () => {
    const bounds = createCameraBounds({ center: [10, 0, 10], radius: 5 })
    expect(clampToBoundsDisc(10, 10, bounds)).toEqual([10, 10])
    const [x, z] = clampToBoundsDisc(30, 10, bounds)
    expect(Math.hypot(x - 10, z - 10)).toBeCloseTo(5, 6)
  })

  it('derives a unit forward vector and a look-ahead target', () => {
    const street = createCameraState({ mode: 'street', street: { heading: Math.PI / 2, pitch: 0.3 } })
    const view = cameraStateView(street)
    expect(Math.hypot(view.forward[0], view.forward[1], view.forward[2])).toBeCloseTo(1, 6)
    expect(view.forward[0]).toBeCloseTo(-Math.cos(0.3), 6)
    expect(view.forward[1]).toBeCloseTo(Math.sin(0.3), 6)
    expect(streetForward(Math.PI / 2)[0]).toBeCloseTo(-1, 6)
    expect(streetRight(0)).toEqual([1, 0, -0])
    expect(view.target[0]).toBeLessThan(view.position[0])
  })

  it('wraps headings and reports state equality', () => {
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 9)
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(Math.PI, 9)
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 9)
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9)
    const state = createCameraState({ mode: 'street' })
    expect(cameraStatesEqual(state, cloneCameraState(state))).toBe(true)
    expect(cameraStatesEqual(state, createCameraState({ mode: 'street', street: { heading: 1 } }))).toBe(false)
  })

  it('applies state to a three.js camera including the lens', () => {
    const camera = new PerspectiveCamera(30, 1, 0.1, 100)
    const state = createCameraState({ orbit: { azimuth: 0.3, polar: 1.0, radius: 40 }, target: [0, 5, 0] })
    applyCameraStateToCamera(camera, state)
    const expected = cameraStatePosition(state)
    expect(camera.position.distanceTo(new Vector3(expected[0], expected[1], expected[2]))).toBeLessThan(1e-6)
    expect(camera.fov).toBe(state.fov)
    expect(camera.far).toBe(state.far)

    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const view = cameraStateView(state)
    expect(forward.x).toBeCloseTo(view.forward[0], 6)
    expect(forward.y).toBeCloseTo(view.forward[1], 6)
    expect(forward.z).toBeCloseTo(view.forward[2], 6)
  })

  it('patches a state without losing the other mode and transitions safely', () => {
    const base = createCameraState({ orbit: { azimuth: 0.5, radius: 30 } })
    const patched = patchCameraState(base, { orbit: { radius: 12 } })
    expect(patched.orbit.radius).toBe(12)
    expect(patched.orbit.azimuth).toBeCloseTo(0.5, 6)

    const switched = patchCameraState(base, { mode: 'street' })
    expect(switched.mode).toBe('street')
    expect(distanceXZ(switched.street.position, cameraStatePosition(base))).toBeLessThan(1e-6)
  })
})

/* -------------------------------------------------------------------------- */
/* Navigation controls                                                         */
/* -------------------------------------------------------------------------- */

describe('navigation controls (pointer, wheel, keyboard, touch)', () => {
  it('mutates the authoritative state immediately and damps the rendered state', () => {
    const controls = createNavigationControls({ state: { orbit: { azimuth: 0, polar: 1.0, radius: 40 } } })
    controls.orbitBy(0.8, 0.1)
    expect(controls.getState().orbit.azimuth).toBeCloseTo(0.8, 9)
    expect(controls.getView().orbit.azimuth).toBeCloseTo(0, 9)
    expect(controls.update(1 / 60)).toBe(true)
    const midway = controls.getView().orbit.azimuth
    expect(midway).toBeGreaterThan(0)
    expect(midway).toBeLessThan(0.8)
    settle(controls, 1.5)
    expect(controls.getView().orbit.azimuth).toBeCloseTo(0.8, 6)
    expect(controls.update(1 / 60)).toBe(false)
  })

  it('orbits, pans and zooms with the pointer', () => {
    const controls = createNavigationControls({ state: { orbit: { azimuth: 0, polar: 1.0, radius: 40 } } })
    controls.handlePointerDown(pointer(1, 100, 100))
    controls.handlePointerMove(pointer(1, 200, 140))
    controls.handlePointerUp(pointer(1, 200, 140))
    const afterDrag = controls.getState()
    expect(afterDrag.orbit.azimuth).toBeCloseTo(-100 * DEFAULT_NAVIGATION_SENSITIVITY.orbit, 9)
    expect(afterDrag.orbit.polar).toBeCloseTo(1.0 - 40 * DEFAULT_NAVIGATION_SENSITIVITY.orbit, 9)
    expect(afterDrag.target).toEqual(DEFAULT_CAMERA_STATE.target)

    controls.setState({ orbit: { azimuth: 0, polar: 1.0, radius: 40 } })
    controls.handlePointerDown(pointer(2, 0, 0, { secondary: true }))
    controls.handlePointerMove(pointer(2, 60, 0))
    controls.handlePointerUp(pointer(2, 60, 0))
    const panned = controls.getState()
    expect(panned.orbit.azimuth).toBeCloseTo(0, 9)
    expect(distanceXZ(panned.target, DEFAULT_CAMERA_STATE.target)).toBeGreaterThan(0)

    controls.setState({ orbit: { radius: 40 } })
    controls.handleWheel(200)
    const zoomedOut = controls.getState().orbit.radius
    expect(zoomedOut).toBeCloseTo(40 * Math.exp(200 * DEFAULT_NAVIGATION_SENSITIVITY.zoom), 6)
    controls.handleWheel(-1000)
    expect(controls.getState().orbit.radius).toBeLessThan(zoomedOut)
    for (let index = 0; index < 40; index += 1) {
      controls.handleWheel(-1000)
    }
    expect(controls.getState().orbit.radius).toBe(6)
  })

  it('turns and walks the camera at street level', () => {
    const controls = createNavigationControls({ state: { mode: 'street', street: { position: [0, 1.75, 20], heading: 0 } } })
    controls.handlePointerDown(pointer(1, 0, 0))
    controls.handlePointerMove(pointer(1, 50, -25))
    controls.handlePointerUp(pointer(1, 50, -25))
    const looked = controls.getState()
    expect(looked.street.heading).toBeCloseTo(-50 * DEFAULT_NAVIGATION_SENSITIVITY.orbit, 9)
    expect(looked.street.pitch).toBeCloseTo(25 * DEFAULT_NAVIGATION_SENSITIVITY.orbit, 9)

    controls.setState({ mode: 'street', street: { position: [0, 1.75, 20], heading: 0, pitch: 0 } })
    // Heading 0 faces -Z, so walking forward must reduce Z.
    controls.moveBy(5, 0)
    expect(controls.getState().street.position[2]).toBeCloseTo(15, 6)
    controls.moveBy(0, 5)
    expect(controls.getState().street.position[0]).toBeCloseTo(5, 6)
  })

  it('never lets walking leave the block envelope', () => {
    const controls = createNavigationControls({ state: { mode: 'street' } })
    for (let index = 0; index < 200; index += 1) {
      controls.moveBy(20, 20)
    }
    const state = controls.getState()
    expect(distanceXZ(state.street.position, BLOCK_CAMERA_BOUNDS.center)).toBeLessThanOrEqual(
      BLOCK_CAMERA_BOUNDS.radius + 1e-6,
    )
    expect(state.street.position[1]).toBeGreaterThanOrEqual(BLOCK_CAMERA_BOUNDS.streetHeight.min)
  })

  it('drives orbit, pan and zoom from the keyboard, frame-rate independently', () => {
    const controls = createNavigationControls({ state: { orbit: { azimuth: 0, polar: 1.0, radius: 40 } } })
    expect(controls.handleKeyDown('ArrowRight')).toBe(true)
    expect(controls.isKeyDown('ArrowRight')).toBe(true)
    controls.update(0.25)
    const quarterSecond = controls.getState().orbit.azimuth
    expect(quarterSecond).toBeCloseTo(DEFAULT_NAVIGATION_SENSITIVITY.turn * 0.25, 6)
    controls.handleKeyUp('ArrowRight')
    expect(controls.isKeyDown('ArrowRight')).toBe(false)

    // Shift turns the arrows into a pan of the target.
    controls.handleKeyDown('ShiftLeft')
    controls.handleKeyDown('ArrowUp')
    controls.update(0.25)
    const panned = controls.getState()
    expect(panned.target[2]).toBeLessThan(DEFAULT_CAMERA_STATE.target[2])
    expect(panned.orbit.azimuth).toBeCloseTo(quarterSecond, 6)
    controls.handleKeyUp('ArrowUp')
    controls.handleKeyUp('ShiftLeft')

    controls.handleKeyDown('Equal')
    controls.update(0.25)
    expect(controls.getState().orbit.radius).toBeLessThan(40)
    controls.handleKeyUp('Equal')

    expect(controls.handleKeyDown('KeyM')).toBe(true)
    expect(controls.getState().mode).toBe('street')
    expect(controls.handleKeyDown('KeyR')).toBe(true)
    expect(controls.getState().mode).toBe('orbit')
    // Reset restores the state the controller was created with, not the global
    // default viewpoint.
    expect(
      cameraStatesEqual(
        controls.getState(),
        createCameraState({ orbit: { azimuth: 0, polar: 1.0, radius: 40 } }),
      ),
    ).toBe(true)
    expect(controls.handleKeyDown('KeyZ')).toBe(false)
  })

  it('orbits, pinches and pans with touch gestures', () => {
    const controls = createNavigationControls({ state: { orbit: { azimuth: 0, polar: 1.0, radius: 40 } } })
    controls.handleTouchStart(touchList([100, 100]))
    controls.handleTouchMove(touchList([160, 100]))
    controls.handleTouchEnd(touchList())
    expect(controls.getState().orbit.azimuth).toBeCloseTo(-60 * DEFAULT_NAVIGATION_SENSITIVITY.orbit, 9)

    controls.setState({ orbit: { radius: 40, azimuth: 0, polar: 1 } })
    controls.handleTouchStart(touchList([0, 0], [100, 0]))
    controls.handleTouchMove(touchList([0, 0], [50, 0]))
    expect(controls.getState().orbit.radius).toBeGreaterThan(40)
    controls.handleTouchEnd(touchList([0, 0]))
    expect(controls.getState().orbit.radius).toBeGreaterThan(40)
    controls.handleTouchEnd(touchList())

    // A touch stream that arrives after pointer events must not double-apply.
    const pointerDriven = createNavigationControls({ state: { orbit: { azimuth: 0, polar: 1, radius: 40 } } })
    pointerDriven.handlePointerDown(pointer(7, 0, 0, { pointerType: 'touch' }))
    pointerDriven.handleTouchStart(touchList([0, 0]))
    pointerDriven.handleTouchMove(touchList([30, 0]))
    expect(pointerDriven.getState().orbit.azimuth).toBeCloseTo(0, 9)
    pointerDriven.handlePointerMove(pointer(7, 30, 0, { pointerType: 'touch' }))
    expect(pointerDriven.getState().orbit.azimuth).toBeCloseTo(-30 * DEFAULT_NAVIGATION_SENSITIVITY.orbit, 9)
  })

  it('notifies subscribers and stops notifying after unsubscribe', () => {
    const controls = createNavigationControls()
    const listener = vi.fn()
    const unsubscribe = controls.onStateChange(listener)
    controls.orbitBy(0.2, 0)
    expect(listener).toHaveBeenCalledTimes(1)
    const [state, passedControls] = listener.mock.calls[0] as [CameraState, NavigationControls]
    expect(state.orbit.azimuth).toBeCloseTo(DEFAULT_CAMERA_STATE.orbit.azimuth + 0.2, 9)
    expect(passedControls).toBe(controls)
    unsubscribe()
    controls.orbitBy(0.2, 0)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('binds DOM pointer, wheel and keyboard input', () => {
    const controls = createNavigationControls({ state: { orbit: { azimuth: 0, polar: 1.0, radius: 40 } } })
    const element = document.createElement('canvas')
    document.body.append(element)
    const unbind = controls.bind(element)
    expect(element.style.touchAction).toBe('none')

    const pointerEvent = (type: string, init: PointerEventInit): Event => {
      if (typeof PointerEvent === 'function') {
        return new PointerEvent(type, init)
      }
      const fallback = new Event(type, { bubbles: true })
      Object.assign(fallback, init)
      return fallback
    }

    element.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 }))
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientX: 110, clientY: 10 }))
    window.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 110, clientY: 10 }))
    expect(controls.getState().orbit.azimuth).toBeLessThan(0)

    const before = controls.getState().orbit.radius
    element.dispatchEvent(new WheelEvent('wheel', { deltaY: 240, cancelable: true }))
    expect(controls.getState().orbit.radius).toBeGreaterThan(before)

    const azimuthBeforeKey = controls.getState().orbit.azimuth
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', cancelable: true }))
    controls.update(0.25)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }))
    expect(controls.getState().orbit.azimuth).toBeCloseTo(
      azimuthBeforeKey - DEFAULT_NAVIGATION_SENSITIVITY.turn * 0.25,
      6,
    )

    unbind()
    const settled = controls.getState().orbit.azimuth
    element.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 0, clientY: 0 }))
    window.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 90, clientY: 0 }))
    expect(controls.getState().orbit.azimuth).toBe(settled)
    element.remove()
  })
})

/* -------------------------------------------------------------------------- */
/* Camera rig                                                                  */
/* -------------------------------------------------------------------------- */

describe('camera rig (src/scene/CameraRig.tsx)', () => {
  it('writes the damped view onto the camera every update', () => {
    const rig = createCameraRig({ state: { orbit: { azimuth: 0, polar: 1.0, radius: 40 } } })
    rig.controls.applyState({ orbit: { azimuth: 1 } })
    expect(rig.update(1 / 60)).toBe(true)
    for (let index = 0; index < 120; index += 1) {
      rig.update(1 / 60)
    }
    const view = rig.getView()
    const expected = cameraStatePosition(view)
    expect(rig.camera.position.distanceTo(new Vector3(expected[0], expected[1], expected[2]))).toBeLessThan(1e-6)
    expect(rig.settling).toBe(false)

    rig.setMode('street')
    expect(rig.controls.mode).toBe('street')
    rig.update(1 / 60)
    expect(rig.getView().mode).toBe('street')
    rig.reset()
    expect(rig.getView().mode).toBe('orbit')
  })

  it('keeps the projection in step with the canvas and the draw distance', () => {
    const rig = createCameraRig()
    rig.configure({ aspect: 2.5, far: 280 })
    expect(rig.camera.aspect).toBe(2.5)
    expect(rig.camera.far).toBe(280)
    expect(rig.getState().far).toBe(280)
  })
})

/* -------------------------------------------------------------------------- */
/* Lighting rig                                                                */
/* -------------------------------------------------------------------------- */

describe('lighting rig (src/scene/lighting.ts)', () => {
  it('derives sun directions from azimuth and elevation', () => {
    const overhead = sunDirectionFromAngles(0, Math.PI / 2)
    expect(overhead[0]).toBeCloseTo(0, 9)
    expect(overhead[1]).toBeCloseTo(1, 9)
    expect(overhead[2]).toBeCloseTo(0, 9)

    const towardsPositiveX = sunDirectionFromAngles(Math.PI / 2, 0)
    expect(towardsPositiveX[0]).toBeCloseTo(1, 9)
    expect(towardsPositiveX[2]).toBeCloseTo(0, 9)

    for (const angle of [0, 0.6, 2.2, -1.4]) {
      const direction = sunDirectionFromAngles(angle, 0.4)
      expect(Math.hypot(direction[0], direction[1], direction[2])).toBeCloseTo(1, 9)
    }
  })

  it('clamps messy parameters into valid ranges', () => {
    const params = createLightingParams({
      sunIntensity: -4,
      ambientIntensity: 40,
      fogDensity: 5,
      sunElevation: 9,
    })
    expect(params.sunIntensity).toBe(0)
    expect(params.ambientIntensity).toBe(10)
    expect(params.fogDensity).toBe(0.25)
    expect(params.sunElevation).toBeCloseTo(Math.PI / 2, 9)
  })

  it('leaves day parameters alone and reshapes night into a city-glow look', () => {
    const day = resolveLightingProfile(DAY_LIGHTING)
    expect(day.sunIntensity).toBe(DAY_LIGHTING.sunIntensity)
    expect(day.sunColor).toBe(DAY_LIGHTING.sunColor)
    expect(day.night).toBe(false)
    expect(isSunBelowHorizon(DAY_LIGHTING)).toBe(false)

    const night = resolveLightingProfile({ ...NIGHT_LIGHTING, sunColor: '#ffd7a8', skyTint: '#7fa4e0' })
    expect(night.night).toBe(true)
    expect(night.sunIntensity).toBeCloseTo(NIGHT_LIGHTING.sunIntensity * NIGHT_SUN_FACTOR, 6)
    expect(night.sunColor).not.toBe('#ffd7a8')
    expect(night.skyTint).not.toBe('#7fa4e0')
    // City glow keeps the night readable instead of pitch black.
    expect(night.ambientIntensity).toBeGreaterThan(0)
    expect(resolveLightingProfile({ ...DAY_LIGHTING, night: true }).sunIntensity).toBeLessThan(
      DAY_LIGHTING.sunIntensity,
    )
  })

  it('resolves presets and reports the light direction', () => {
    const preset = resolveLightingPreset('night')
    expect(preset).toEqual(LIGHTING_PRESET_PARAMS.night)
    const rig = createLightingRig({ params: LIGHTING_PRESET_PARAMS.goldenHour })
    expect(rig.sunDirection[1]).toBeCloseTo(Math.sin(LIGHTING_PRESET_PARAMS.goldenHour.sunElevation), 6)
    rig.dispose()
  })

  it('rebuilds sun, hemisphere, ambient, background and fog from parameters', () => {
    const scene = { background: null, fog: null } as unknown as Scene
    const rig = createLightingRig({ scene, params: DAY_LIGHTING, shadowMapSize: 512 })
    const dayIntensity = rig.sun.intensity
    expect(rig.group.name).toBe('lighting-rig')
    expect(rig.sun.name).toBe('sun-light')

    const applied = rig.apply({ sunIntensity: 5, sunColor: '#ff0000', sunAzimuth: Math.PI / 2, skyTint: '#00ff00', night: false })
    expect(applied.sunIntensity).toBe(5)
    expect(rig.sun.color.getHexString()).toBe('ff0000')
    expect(rig.sun.intensity).toBe(5)
    expect(rig.hemisphere.color.getHexString()).toBe('00ff00')
    expect(rig.sun.position.x).toBeGreaterThan(0)
    expect(scene.background).not.toBeNull()
    expect(scene.fog).not.toBeNull()

    rig.apply({ night: true })
    expect(rig.sun.intensity).toBeLessThan(dayIntensity)
    expect(rig.ambient.intensity).toBeGreaterThan(0)

    // Blending moves towards the destination without jumping to it.
    const alpha = rig.blendTo({ sunIntensity: 20 }, 0.5)
    expect(alpha.sunIntensity).toBeGreaterThan(4)
    expect(alpha.sunIntensity).toBeLessThan(20)

    rig.configureShadows({ mapSize: 2048, castShadows: false, softShadows: true })
    expect(rig.sun.shadow.mapSize.width).toBe(2048)
    expect(rig.sun.castShadow).toBe(false)
    expect(rig.sun.shadow.radius).toBeGreaterThan(1)

    rig.configureShadows({ mapSize: 1024 })
    expect(rig.sun.shadow.mapSize.height).toBe(1024)
    rig.dispose()
    expect(rig.group.parent).toBeNull()
    expect(scene.background).toBeNull()
  })

  it('exposes the keyboard map it documents', () => {
    expect(Object.values(KEY_BINDINGS)).toContain('toggleMode')
    expect(KEY_BINDINGS['ArrowUp']).toBe('orbitUp')
    expect([...CAMERA_MODES]).toEqual(['orbit', 'street'])
  })
})
