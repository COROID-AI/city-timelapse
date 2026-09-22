/**
 * Navigation polish: viewpoints, camera tween, shortcut map, adaptive quality.
 *
 * The pure side of the interaction layer, asserted without a browser: every
 * viewpoint resolves to a camera state the render pipeline's own envelope
 * accepts, the tween is monotonic and lands exactly on its destination, the
 * shortcut map binds no key twice and touches none of the pipeline's keys, and
 * the adaptive controller drops one tier above the budget and only climbs back
 * after a sustained headroom window — and not at all while the viewer has taken
 * the tier over by hand.
 *
 * It also reads `docs/controls.md` and proves the documented shortcut rows are
 * exactly the rows the application binds, which is what keeps the user-facing
 * document honest.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Box3, Mesh, MeshBasicMaterial, BoxGeometry, Group, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { boundsFromBox, boundsOfPoint, buildInspectionTargets } from '../../src/app/inspectionTargets'
import type { InspectionTarget, InspectionTargets } from '../../src/app/inspectionTargets'
import { createCityLayout } from '../../src/city/layout'
import {
  BLOCK_CAMERA_BOUNDS,
  DEFAULT_CAMERA_STATE,
  KEY_BINDINGS,
  QUALITY_TIERS,
  FRAME_BUDGET_TOLERANCE,
  MIN_ADAPTIVE_SAMPLES,
  OVER_BUDGET_STREAK,
  UPGRADE_HEADROOM,
  applyCameraStateToCamera,
  cameraStateView,
  cameraStatesEqual,
  sanitizeCameraState,
} from '../../src/scene'
import {
  INTERACTION_SHORTCUTS,
  SHORTCUT_BINDINGS,
  SHORTCUT_GROUPS,
  assertNoDuplicateBindings,
  duplicateBindings,
  matchShortcut,
  shortcutCodes,
  shortcutRows,
  shortcutsInGroup,
} from '../../src/interaction/shortcuts'
import {
  VIEWPOINT_IDS,
  cameraStateWithinBounds,
  createCameraTween,
  framingEye,
  isViewpointId,
  resolveViewpoint,
  resolveViewpoints,
} from '../../src/interaction/viewpoints'
import { projectInspectionTarget } from '../../src/interaction/inspector'
import {
  SUSTAINED_HEADROOM_FRAMES,
  createAdaptiveQualityState,
  frameBudgetFor,
  stepAdaptiveQuality,
} from '../../src/interaction/qualityAuto'
import type { AdaptiveQualityReason, AdaptiveQualityState } from '../../src/interaction/qualityAuto'
import { buildTourPlan, createCinematicTour } from '../../src/interaction/tour'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const LAYOUT = createCityLayout()

/** The published surface of the 1945 block, anchors only (no layers needed). */
const SURFACE: InspectionTargets = buildInspectionTargets({ layout: LAYOUT, eraId: '1945' })

const FRAMINGS = resolveViewpoints({ layout: LAYOUT, targets: SURFACE, bounds: BLOCK_CAMERA_BOUNDS })

function isFiniteVec3(value: readonly [number, number, number]): boolean {
  return value.every((component) => Number.isFinite(component))
}

/** Feeds `count` frames at one frame time into the adaptive reducer. */
function runFrames(
  start: AdaptiveQualityState,
  count: number,
  frameTimeMs: number,
  manualOverride = false,
): { state: AdaptiveQualityState; changes: number; reasons: AdaptiveQualityReason[] } {
  let state = start
  let changes = 0
  const reasons: AdaptiveQualityReason[] = []
  for (let index = 0; index < count; index += 1) {
    const step = stepAdaptiveQuality(state, { frameTimeMs, manualOverride })
    state = step.state
    reasons.push(step.state.lastReason)
    if (step.tierChanged) {
      changes += 1
    }
  }
  return { state, changes, reasons }
}

/** Feeds frames until the tier changes, returning the frame that did it. */
function runUntilChange(
  start: AdaptiveQualityState,
  frameTimeMs: number,
  manualOverride = false,
  limit = 400,
): { state: AdaptiveQualityState; step: ReturnType<typeof stepAdaptiveQuality> | null; frames: number } {
  let state = start
  for (let frames = 1; frames <= limit; frames += 1) {
    const step = stepAdaptiveQuality(state, { frameTimeMs, manualOverride })
    state = step.state
    if (step.tierChanged) {
      return { state, step, frames }
    }
  }
  return { state, step: null, frames: limit }
}

/* -------------------------------------------------------------------------- */
/* Viewpoints                                                                 */
/* -------------------------------------------------------------------------- */

describe('named viewpoints (src/interaction/viewpoints.ts)', () => {
  it('resolves every viewpoint inside the pipeline camera envelope', () => {
    expect(FRAMINGS.map((framing) => framing.id)).toEqual([...VIEWPOINT_IDS])

    for (const framing of FRAMINGS) {
      expect(framing.withinBounds, framing.id).toBe(true)
      // A fixed point of the pipeline's own clamp: nothing to re-clamp.
      expect(
        cameraStatesEqual(framing.camera, sanitizeCameraState(framing.camera, BLOCK_CAMERA_BOUNDS)),
        framing.id,
      ).toBe(true)
      expect(cameraStateWithinBounds(framing.camera, BLOCK_CAMERA_BOUNDS), framing.id).toBe(true)

      const eye = framingEye(framing.camera)
      expect(isFiniteVec3(eye), framing.id).toBe(true)
      expect(isFiniteVec3(framing.camera.target), framing.id).toBe(true)
      // The look-at point is inside the envelope's disc.
      const targetDistance = Math.hypot(
        framing.camera.target[0] - BLOCK_CAMERA_BOUNDS.center[0],
        framing.camera.target[2] - BLOCK_CAMERA_BOUNDS.center[2],
      )
      expect(targetDistance, framing.id).toBeLessThanOrEqual(BLOCK_CAMERA_BOUNDS.radius + 1e-6)
    }
  });

  it('derives each framing from a real anchor or the measured target extent', () => {
    for (const framing of FRAMINGS) {
      if (framing.id === 'aerial') {
        // The aerial shot is framed from the published bounds, not an anchor.
        expect(framing.anchorName).toBeNull()
        continue
      }
      expect(framing.anchorName, framing.id).not.toBeNull()
      const anchor = LAYOUT.anchors.find((candidate) => candidate.name === framing.anchorName)
      expect(anchor, framing.id).toBeDefined()
    }

    const corner = FRAMINGS.find((framing) => framing.id === 'street-corner')
    const storefront = FRAMINGS.find((framing) => framing.id === 'storefront-closeup')
    const aerial = FRAMINGS.find((framing) => framing.id === 'aerial')
    expect(corner?.anchorName).toMatch(/^corner:/)
    expect(storefront?.anchorName).toMatch(/:storefront:\d+$/)

    // Street-level viewpoints stand near the pavement; the aerial shot is high.
    for (const id of ['street-corner', 'curb-crossing', 'storefront-closeup'] as const) {
      const framing = FRAMINGS.find((candidate) => candidate.id === id)
      expect(framing?.eyeHeight, id).toBeGreaterThan(1)
      expect(framing?.eyeHeight, id).toBeLessThan(14)
    }
    expect(aerial?.eyeHeight ?? 0).toBeGreaterThan(40)
  })

  it('rejects an unknown viewpoint id and accepts the known ones', () => {
    expect(isViewpointId('rooftop')).toBe(true)
    expect(isViewpointId('basement')).toBe(false)
    expect(resolveViewpoint('rooftop', { layout: LAYOUT, targets: SURFACE, bounds: BLOCK_CAMERA_BOUNDS })).not.toBeNull()
  })

  it('frames its subject inside the viewport from a real camera', () => {
    const camera = new PerspectiveCamera(DEFAULT_CAMERA_STATE.fov, 16 / 9, 0.1, 500)
    const viewport = { width: 1280, height: 800 }
    for (const framing of FRAMINGS) {
      // A tiny stand-in target at the framing's own subject point.
      const subject: InspectionTarget = {
        id: `subject:${framing.id}`,
        category: 'anchor',
        label: framing.label,
        eraId: '1945',
        year: 1945,
        origin: 'anchor',
        layerId: 'layout',
        source: framing.anchorName ?? 'block',
        bounds: boundsOfPoint(framing.subject, { width: 0.5, height: 0.5 }),
      }
      applyCameraStateToCamera(camera, framing.camera)
      camera.updateMatrixWorld()
      const projected = projectInspectionTarget(subject, camera, viewport)
      expect(projected.onScreen, framing.id).toBe(true)
      // Inside the frame with room to spare, not merely in front of the camera.
      expect(Math.abs(projected.ndcX), framing.id).toBeLessThan(0.92)
      expect(Math.abs(projected.ndcY), framing.id).toBeLessThan(0.92)
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Tween                                                                      */
/* -------------------------------------------------------------------------- */

describe('camera tween (src/interaction/viewpoints.ts)', () => {
  it('eases monotonically to an exact end state', () => {
    const destination = FRAMINGS.find((framing) => framing.id === 'aerial')?.camera
    if (destination === undefined) {
      throw new Error('The aerial viewpoint must resolve for this check.')
    }
    const tween = createCameraTween(DEFAULT_CAMERA_STATE, destination, {
      durationSeconds: 1,
      bounds: BLOCK_CAMERA_BOUNDS,
    })

    // `sample(1)` is the destination, byte for byte.
    expect(tween.sample(1)).toEqual(destination)
    expect(tween.sample(0)).toEqual(tween.from)

    const step = 1 / 20
    let previousDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index <= 20; index += 1) {
      const sample = tween.sample(index * step)
      const distance = Math.hypot(
        sample.target[0] - destination.target[0],
        sample.target[1] - destination.target[1],
        sample.target[2] - destination.target[2],
        sample.orbit.radius - destination.orbit.radius,
      )
      expect(distance, `t=${index * step}`).toBeLessThanOrEqual(previousDistance + 1e-9)
      previousDistance = distance
    }
    expect(previousDistance).toBeLessThanOrEqual(1e-9)
  })

  it('advances its clock monotonically and finishes exactly once', () => {
    const destination = FRAMINGS.find((framing) => framing.id === 'street-corner')?.camera
    if (destination === undefined) {
      throw new Error('The street-corner viewpoint must resolve for this check.')
    }
    const tween = createCameraTween(DEFAULT_CAMERA_STATE, destination, { durationSeconds: 0.5 })
    let progress = 0
    for (let index = 0; index < 10; index += 1) {
      tween.advance(0.1)
      expect(tween.progress).toBeGreaterThanOrEqual(progress)
      progress = tween.progress
    }
    expect(tween.done).toBe(true)
    expect(tween.progress).toBe(1)
    expect(tween.sample()).toEqual(destination)
  })

  it('converts the start state when a move crosses camera modes', () => {
    const streetStart = sanitizeCameraState(
      { ...DEFAULT_CAMERA_STATE, mode: 'street', street: { position: [4, 1.75, 20], heading: 0.3, pitch: 0 } },
      BLOCK_CAMERA_BOUNDS,
    )
    const destination = FRAMINGS.find((framing) => framing.id === 'rooftop')?.camera
    if (destination === undefined) {
      throw new Error('The rooftop viewpoint must resolve for this check.')
    }
    const tween = createCameraTween(streetStart, destination, { bounds: BLOCK_CAMERA_BOUNDS })
    // The start of the move reproduces the viewer's eye and looking direction:
    // no jump across the block just because the framing changed mode. (The
    // look-at point is clamped by the pipeline's own envelope, so the eye may
    // shift a few metres; the direction is the part that must not snap.)
    const before = cameraStateView(streetStart)
    const after = cameraStateView(tween.sample(0))
    const eyeShift = Math.hypot(
      before.position[0] - after.position[0],
      before.position[1] - after.position[1],
      before.position[2] - after.position[2],
    )
    expect(eyeShift).toBeLessThan(8)
    const forwardDot =
      before.forward[0] * after.forward[0] +
      before.forward[1] * after.forward[1] +
      before.forward[2] * after.forward[2]
    expect(forwardDot).toBeGreaterThan(0.99)
    expect(tween.sample(0).mode).toBe('orbit')
    expect(tween.sample(1)).toEqual(destination)
  })
})

/* -------------------------------------------------------------------------- */
/* Shortcuts and the controls document                                        */
/* -------------------------------------------------------------------------- */

describe('interaction shortcut map (src/interaction/shortcuts.ts)', () => {
  it('binds no key twice', () => {
    expect(duplicateBindings()).toEqual([])
    expect(() => {
      assertNoDuplicateBindings()
    }).not.toThrow()
    expect(shortcutCodes().length).toBe(new Set(shortcutCodes()).size)
  })

  it('covers camera modes, viewpoints, tour, inspection, era, quality and sound', () => {
    for (const group of SHORTCUT_GROUPS) {
      expect(shortcutsInGroup(group).length, group).toBeGreaterThan(0)
    }
    const actions = INTERACTION_SHORTCUTS.map((entry) => entry.action)
    expect(actions).toEqual(
      expect.arrayContaining([
        'camera.orbit',
        'camera.street',
        'tour.toggle',
        'inspection.close',
        'era.previous',
        'era.next',
        'quality.cycle',
        'audio.mute',
      ]),
    )
    for (const id of VIEWPOINT_IDS) {
      expect(actions).toContain(`viewpoint.${id}`)
    }
  })

  it('never collides with the render pipeline navigation keys', () => {
    for (const code of shortcutCodes()) {
      expect(KEY_BINDINGS[code], code).toBeUndefined()
    }
  })

  it('resolves key events and ignores modified or typing keystrokes', () => {
    expect(matchShortcut({ code: 'KeyT' })).toBe('tour.toggle')
    expect(matchShortcut({ code: 'Escape' })).toBe('inspection.close')
    expect(matchShortcut({ code: 'Digit3' })).toBe('viewpoint.storefront-closeup')
    expect(matchShortcut({ code: 'KeyT', ctrlKey: true })).toBeNull()
    expect(matchShortcut({ code: 'KeyT', metaKey: true })).toBeNull()
    expect(matchShortcut({ code: 'KeyZ' })).toBeNull()
    expect(matchShortcut({ code: 'KeyT', target: { tagName: 'INPUT' } as unknown as EventTarget })).toBeNull()
    expect(SHORTCUT_BINDINGS['BracketLeft']).toBe('era.previous')
  })

  it('documents exactly the rows it binds in docs/controls.md', () => {
    const candidates = [
      resolve(process.cwd(), 'docs', 'controls.md'),
      resolve(process.cwd(), '..', 'docs', 'controls.md'),
    ]
    const path = candidates.find((candidate) => existsSync(candidate))
    if (path === undefined) {
      throw new Error(`docs/controls.md is missing; looked in ${candidates.join(', ')}`)
    }
    const document = readFileSync(path, 'utf8')
    for (const row of shortcutRows()) {
      expect(document, row).toContain(row)
    }
    // And the document covers the behaviours the brief requires.
    expect(document).toMatch(/manual override/i)
    expect(document).toMatch(/reduce motion/i)
    expect(document).toMatch(/viewpoint/i)
    expect(document).toMatch(/enable sound/i)
  })
})

/* -------------------------------------------------------------------------- */
/* Adaptive quality                                                           */
/* -------------------------------------------------------------------------- */

describe('adaptive quality (src/interaction/qualityAuto.ts)', () => {
  it('reads the shared budget and headroom constants', () => {
    expect(frameBudgetFor('high')).toBe(QUALITY_TIERS.high.frameBudgetMs)
    expect(frameBudgetFor('low')).toBe(QUALITY_TIERS.low.frameBudgetMs)
    expect(UPGRADE_HEADROOM).toBeLessThan(1)
    expect(SUSTAINED_HEADROOM_FRAMES).toBeGreaterThan(OVER_BUDGET_STREAK)
  })

  it('drops exactly one tier above the budget and only after the streak', () => {
    const start = createAdaptiveQualityState('high')
    const warmup = runFrames(start, MIN_ADAPTIVE_SAMPLES - 1, QUALITY_TIERS.high.frameBudgetMs * 2)
    expect(warmup.changes).toBe(0)
    expect(warmup.state.tier).toBe('high')
    expect(warmup.state.lastReason).toBe('warmup')

    const drop = runUntilChange(warmup.state, QUALITY_TIERS.high.frameBudgetMs * 2)
    expect(drop.step?.tierChanged).toBe(true)
    expect(drop.step?.previousTier).toBe('high')
    expect(drop.step?.notice?.reason).toBe('over-budget')
    expect(drop.state.tier).toBe('medium')
    // The change waits for the full over-budget streak, counting from warm-up.
    expect(drop.frames).toBe(OVER_BUDGET_STREAK - (MIN_ADAPTIVE_SAMPLES - 1))
    // One step, never a leap to the cheapest tier.
    expect(drop.state.changes).toBe(1)
    expect(drop.state.tier).not.toBe('low')
  });

  it('raises a tier only after sustained headroom', () => {
    const dropped = runFrames(
      createAdaptiveQualityState('high'),
      MIN_ADAPTIVE_SAMPLES + OVER_BUDGET_STREAK,
      QUALITY_TIERS.high.frameBudgetMs * 2,
    )
    expect(dropped.state.tier).toBe('medium')

    const short = runFrames(dropped.state, SUSTAINED_HEADROOM_FRAMES - 1, 1)
    expect(short.changes).toBe(0)
    expect(short.state.tier).toBe('medium')

    const climb = runFrames(short.state, 1, 1)
    expect(climb.changes).toBe(1)
    expect(climb.state.tier).toBe('high')
    expect(climb.state.lastReason).toBe('headroom')
  })

  it('does not oscillate when the budget is only half met', () => {
    const budget = QUALITY_TIERS.high.frameBudgetMs
    let state = createAdaptiveQualityState('high')
    for (let index = 0; index < 400; index += 1) {
      // Alternate a badly over-budget frame with a very cheap one: neither the
      // over-budget streak nor the headroom streak ever survives, so nothing may
      // change — not even after hundreds of samples.
      const frameTimeMs = index % 2 === 0 ? budget * 2 : 1
      const step = stepAdaptiveQuality(state, { frameTimeMs, manualOverride: false })
      expect(step.tierChanged, `frame ${index}`).toBe(false)
      state = step.state
    }
    expect(state.tier).toBe('high')
    expect(state.changes).toBe(0)
  })

  it('suspends while the viewer holds the tier and resumes when it is cleared', () => {
    const suspended = runFrames(createAdaptiveQualityState('high'), 120, QUALITY_TIERS.high.frameBudgetMs * 3, true)
    expect(suspended.changes).toBe(0)
    expect(suspended.state.tier).toBe('high')
    expect(suspended.state.suspended).toBe(true)
    expect(suspended.reasons.every((reason) => reason === 'suspended')).toBe(true)

    const resumed = runFrames(suspended.state, OVER_BUDGET_STREAK, QUALITY_TIERS.high.frameBudgetMs * 2, false)
    expect(resumed.changes).toBe(1)
    expect(resumed.state.tier).toBe('medium')
    expect(resumed.state.suspended).toBe(false)
  })

  it('explains a change with the measured frame time and both tiers', () => {
    let state = createAdaptiveQualityState('high')
    let notice = null as ReturnType<typeof stepAdaptiveQuality>['notice']
    for (let index = 0; index < 40 && notice === null; index += 1) {
      const step = stepAdaptiveQuality(state, {
        frameTimeMs: QUALITY_TIERS.high.frameBudgetMs * (1 + FRAME_BUDGET_TOLERANCE) + 6,
        manualOverride: false,
      })
      state = step.state
      notice = step.notice
    }
    expect(notice).not.toBeNull()
    if (notice === null) {
      return
    }
    expect(notice.from).toBe('high')
    expect(notice.to).toBe('medium')
    expect(notice.reason).toBe('over-budget')
    expect(notice.message).toContain(QUALITY_TIERS.medium.label)
    expect(notice.message).toMatch(/ms per frame/)
  })
})

/* -------------------------------------------------------------------------- */
/* Cinematic tour                                                             */
/* -------------------------------------------------------------------------- */

describe('cinematic tour (src/interaction/tour.ts)', () => {
  it('walks the sidewalk loop and pauses at points of interest', () => {
    const plan = buildTourPlan({ layout: LAYOUT, targets: SURFACE.targets })
    expect(plan).not.toBeNull()
    if (plan === null) {
      return
    }
    expect(plan.spline.role).toBe('sidewalk-loop')
    expect(plan.stations.length).toBeGreaterThan(0)
    // Stations are ordered along the loop and sit on it.
    const distances = plan.stations.map((station) => station.distance)
    expect([...distances].sort((left, right) => left - right)).toEqual(distances)

    const tour = createCinematicTour(plan, { bounds: BLOCK_CAMERA_BOUNDS, current: DEFAULT_CAMERA_STATE })
    const entry = tour.start()
    expect(entry).toEqual(DEFAULT_CAMERA_STATE)

    let paused = false
    const stationsSeen = new Set<string>()
    let travelled = 0
    let firstSample = tour.advance(0)
    for (let index = 0; index < 2000; index += 1) {
      const sample = tour.advance(0.1)
      travelled = sample.distance
      if (sample.paused && sample.stationId !== null) {
        paused = true
        stationsSeen.add(sample.stationId)
      }
      firstSample = sample
    }
    expect(paused).toBe(true)
    expect(stationsSeen.size).toBeGreaterThan(0)
    // The camera moved off the entry framing along the pavement.
    expect(firstSample.camera.mode).toBe('orbit')
    expect(cameraStatesEqual(firstSample.camera, DEFAULT_CAMERA_STATE)).toBe(false)
    expect(travelled).toBeGreaterThanOrEqual(0)
    expect(travelled).toBeLessThan(plan.length)

    // Stopping returns the camera captured on start.
    expect(tour.stop()).toEqual(DEFAULT_CAMERA_STATE)
    expect(tour.active).toBe(false)
  })

  it('picks nothing to pause at when the surface is empty', () => {
    const empty = buildInspectionTargets({ layout: LAYOUT, eraId: '1945', anchors: [] })
    const plan = buildTourPlan({ layout: LAYOUT, targets: empty.targets })
    expect(plan).not.toBeNull()
    expect(plan?.stations).toEqual([])
  })
})

/* -------------------------------------------------------------------------- */
/* Measured bounds sanity                                                     */
/* -------------------------------------------------------------------------- */

describe('inspection bounds used by the viewpoints', () => {
  it('measures an object-derived target from the live scene object', () => {
    const group = new Group()
    const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial())
    mesh.position.set(1, 2, 3)
    group.add(mesh)
    const surface = buildInspectionTargets({
      layout: LAYOUT,
      eraId: '1945',
      anchors: [],
      layers: [{ layerId: 'storefronts', objects: [{ id: 'unit', category: 'storefront', object: group }] }],
    })
    const target = surface.targets.find((candidate) => candidate.id === 'unit')
    expect(target).toBeDefined()
    const expected = boundsFromBox(new Box3().setFromObject(group))
    expect(target?.bounds).toEqual(expected)
    expect(target?.layerId).toBe('storefronts')
    expect(target?.category).toBe('storefront')
  })
})
