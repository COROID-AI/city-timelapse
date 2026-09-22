/**
 * The cinematic tour: an autopilot that walks the block and stops to look.
 *
 * The route is the block's own **sidewalk loop** — the pedestrian spline the
 * layout publishes — sampled by arc length, so the tour treads the pavement
 * instead of flying a decorative curve. Points of interest are *not* authored
 * either: they are the composition's published inspection targets whose bounds
 * come within {@link DEFAULT_STATION_RADIUS} metres of that loop, sorted by
 * where they sit along it. Storefronts, parked cars and street furniture
 * therefore become stations the moment the layers place them, without this
 * module knowing anything about a layer.
 *
 * Each frame {@link CinematicTour.advance} returns a camera state produced by
 * the same {@link orbitFramingFor} the named viewpoints use: eye on the
 * pavement, looking a short way ahead along the walk, or at the station the
 * tour is pausing in front of. The tour itself owns no camera — the controller
 * writes the sample through the render pipeline — which is what makes
 * "dismissible by any input, restoring the previous camera" a decision of the
 * caller rather than a hidden side effect.
 */

import type { BlockLayout, PathSpline } from '../city/layout'
import { splinePoseAt } from '../city/layout'
import type { InspectionCategory, InspectionTarget } from '../app/inspectionTargets'
import type { CameraBounds, CameraState, Vec3 } from '../scene'
import { DEFAULT_CAMERA_STATE } from '../scene'
import { orbitFramingFor } from './viewpoints'

/* -------------------------------------------------------------------------- */
/* Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/** Walking speed of the tour along the sidewalk loop, in metres per second. */
export const DEFAULT_TOUR_SPEED_MPS = 5.2

/** How long the tour rests in front of a point of interest. */
export const DEFAULT_TOUR_PAUSE_SECONDS = 2.6

/** How far ahead along the pavement the tour looks while it walks. */
export const DEFAULT_TOUR_LOOK_AHEAD = 9

/** Eye height above the pavement, in metres. */
export const DEFAULT_TOUR_EYE_HEIGHT = 1.75

/** Largest number of stations a tour keeps, spread along the loop. */
export const DEFAULT_STATION_LIMIT = 10

/** How close to the loop a target must sit to become a station, in metres. */
export const DEFAULT_STATION_RADIUS = 26

/** Target categories worth pausing for, most interesting first. */
export const DEFAULT_STATION_CATEGORIES: readonly InspectionCategory[] = [
  'building',
  'storefront',
  'signage',
  'advertising',
  'graffiti',
  'vehicle',
  'pedestrian',
  'street-furniture',
  'prop',
  'anchor',
]

/* -------------------------------------------------------------------------- */
/* Plan                                                                       */
/* -------------------------------------------------------------------------- */

/** One place the tour pauses. */
export interface TourStation {
  readonly id: string
  readonly targetId: string
  readonly label: string
  readonly category: InspectionCategory
  readonly layerId: string
  /** Arc length along the sidewalk loop where the pause begins. */
  readonly distance: number
  readonly pauseSeconds: number
  /** Point the camera frames while paused. */
  readonly focus: Vec3
}

/** The resolved route: one sidewalk loop plus its stations. */
export interface TourPlan {
  /** The sampled sidewalk loop the tour walks. */
  readonly spline: PathSpline
  readonly pathName: string
  readonly length: number
  readonly stations: readonly TourStation[]
}

/** Everything the tour plan needs. */
export interface TourPlanOptions {
  readonly layout: BlockLayout
  readonly targets: readonly InspectionTarget[]
  readonly stationLimit?: number
  readonly stationRadius?: number
  readonly pauseSeconds?: number
  readonly categories?: readonly InspectionCategory[]
}

/** Arc length of the point on `spline` closest to `point`. */
export function nearestDistanceOnSpline(spline: PathSpline, point: Vec3): number {
  let best = Number.POSITIVE_INFINITY
  let bestDistance = 0
  for (let index = 0; index < spline.sampleCount; index += 1) {
    const base = index * 3
    const x = spline.positions[base] ?? 0
    const z = spline.positions[base + 2] ?? 0
    const distance = Math.hypot(x - point[0], z - point[2])
    if (distance < best) {
      best = distance
      bestDistance = spline.distances[index] ?? index * spline.sampleSpacing
    }
  }
  return bestDistance
}

/** The block's sidewalk loop, or `null` for a layout that publishes none. */
export function sidewalkLoop(layout: BlockLayout): PathSpline | null {
  return layout.pedestrianSplines.find((spline) => spline.role === 'sidewalk-loop') ?? null
}

/**
 * Builds the tour route.
 *
 * Stations are the published targets near the loop, ordered by their position
 * along it and thinned to `stationLimit` so the tour never turns into a queue of
 * pauses. Returns `null` when the block publishes no sidewalk loop.
 */
export function buildTourPlan(options: TourPlanOptions): TourPlan | null {
  const path = sidewalkLoop(options.layout)
  if (path === null) {
    return null
  }
  const categories = options.categories ?? DEFAULT_STATION_CATEGORIES
  const radius = options.stationRadius ?? DEFAULT_STATION_RADIUS
  const pause = options.pauseSeconds ?? DEFAULT_TOUR_PAUSE_SECONDS
  const limit = Math.max(1, Math.round(options.stationLimit ?? DEFAULT_STATION_LIMIT))

  const candidates: TourStation[] = []
  const seen = new Set<string>()
  for (const target of options.targets) {
    if (!categories.includes(target.category) || seen.has(target.id)) {
      continue
    }
    const centre: Vec3 = [...target.bounds.center]
    // The loop's closest sample, not the arc length, is the gap that decides
    // whether a target is close enough to pause in front of.
    if (closestSampleGap(path, centre) > radius) {
      continue
    }
    const distance = nearestDistanceOnSpline(path, centre)
    seen.add(target.id)
    candidates.push({
      id: `station:${target.id}`,
      targetId: target.id,
      label: target.label,
      category: target.category,
      layerId: target.layerId,
      distance,
      pauseSeconds: pause,
      focus: centre,
    })
  }

  candidates.sort((left, right) => left.distance - right.distance)
  const thinned =
    candidates.length <= limit
      ? candidates
      : Array.from({ length: limit }, (_, index) => {
          const position = Math.floor((index * candidates.length) / limit)
          return candidates[position]
        }).filter((station): station is TourStation => station !== undefined)

  return { spline: path, pathName: path.name, length: path.length, stations: thinned }
}

/** 2-D gap between a point and the closest sample of a loop. */
function closestSampleGap(spline: PathSpline, point: Vec3): number {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < spline.sampleCount; index += 1) {
    const base = index * 3
    const gap = Math.hypot((spline.positions[base] ?? 0) - point[0], (spline.positions[base + 2] ?? 0) - point[2])
    if (gap < best) {
      best = gap
    }
  }
  return best
}

/* -------------------------------------------------------------------------- */
/* Tour                                                                       */
/* -------------------------------------------------------------------------- */

export interface CinematicTourOptions {
  readonly bounds: CameraBounds
  /** Viewer's camera when the tour starts; its style is carried through. */
  readonly current?: CameraState
  readonly eyeHeight?: number
  readonly lookAhead?: number
  readonly speedMps?: number
}

/** One frame of the tour. */
export interface TourSample {
  readonly camera: CameraState
  /** Arc length along the loop. */
  readonly distance: number
  /** Arc length as a fraction of one lap, `0..1`. */
  readonly progress: number
  readonly stationId: string | null
  readonly stationLabel: string | null
  readonly stationCategory: InspectionCategory | null
  readonly paused: boolean
  /** Completed laps; the loop is closed, so the tour keeps going. */
  readonly laps: number
}

export interface CinematicTour {
  readonly plan: TourPlan
  readonly active: boolean
  readonly distance: number
  readonly laps: number
  /** Arc length the tour is currently paused at, or `null`. */
  pausedAt(): TourStation | null
  /** Camera the tour would use at an arbitrary distance along the loop. */
  sampleAt(distance: number, station?: TourStation | null): TourSample
  /** Starts the tour from `distance` and returns the camera captured on start. */
  start(): CameraState
  /** Stops the tour; returns the camera state captured when it started. */
  stop(): CameraState | null
  advance(deltaSeconds: number): TourSample
}

function wrapDistance(distance: number, length: number): number {
  if (!(length > 0)) {
    return 0
  }
  return ((distance % length) + length) % length
}

/**
 * Creates the cinematic tour over a resolved plan.
 *
 * The returned object is a plain state machine — no timers, no globals — so the
 * unit suite can walk a whole lap in one call and assert the pauses.
 */
export function createCinematicTour(plan: TourPlan, options: CinematicTourOptions): CinematicTour {
  const bounds = options.bounds
  const eyeHeight = options.eyeHeight ?? DEFAULT_TOUR_EYE_HEIGHT
  const lookAhead = options.lookAhead ?? DEFAULT_TOUR_LOOK_AHEAD
  const speed = options.speedMps ?? DEFAULT_TOUR_SPEED_MPS
  const style = options.current ?? DEFAULT_CAMERA_STATE
  const path: PathSpline = plan.spline
  const stations = plan.stations

  let active = false
  let distance = 0
  let laps = 0
  let pauseRemaining = 0
  let pausedStation: TourStation | null = null
  let entryCamera: CameraState | null = null

  const sampleAt = (at: number, station: TourStation | null = null): TourSample => {
    const wrapped = wrapDistance(at, plan.length)
    const pose = splinePoseAt(path, wrapped)
    const eye: Vec3 = [pose.position.x, pose.position.y + eyeHeight, pose.position.z]
    const lookAt: Vec3 =
      station !== null
        ? station.focus
        : (() => {
            const ahead = splinePoseAt(path, wrapped + lookAhead)
            return [ahead.position.x, ahead.position.y + eyeHeight, ahead.position.z] as Vec3
          })()
    return {
      camera: orbitFramingFor(eye, lookAt, bounds, style),
      distance: wrapped,
      progress: plan.length > 0 ? wrapped / plan.length : 0,
      stationId: station?.id ?? null,
      stationLabel: station?.label ?? null,
      stationCategory: station?.category ?? null,
      paused: station !== null,
      laps,
    }
  }

  const tour: CinematicTour = {
    plan,
    get active(): boolean {
      return active
    },
    get distance(): number {
      return distance
    },
    get laps(): number {
      return laps
    },
    pausedAt(): TourStation | null {
      return pausedStation
    },
    sampleAt(distance_: number, station: TourStation | null = pausedStation): TourSample {
      return sampleAt(distance_, station)
    },
    start(): CameraState {
      entryCamera = options.current ?? DEFAULT_CAMERA_STATE
      active = true
      distance = 0
      laps = 0
      pauseRemaining = 0
      pausedStation = null
      return entryCamera
    },
    stop(): CameraState | null {
      active = false
      pauseRemaining = 0
      pausedStation = null
      return entryCamera
    },
    advance(deltaSeconds: number): TourSample {
      const dt = Math.max(0, deltaSeconds)
      if (!active) {
        return sampleAt(distance, pausedStation)
      }
      if (pauseRemaining > 0) {
        pauseRemaining -= dt
        if (pauseRemaining > 0) {
          return sampleAt(distance, pausedStation)
        }
        pauseRemaining = 0
        pausedStation = null
      } else {
        const before = distance
        const step = speed * dt
        distance += step
        const nextLaps = Math.floor(distance / plan.length)
        if (nextLaps > laps) {
          laps = nextLaps
        }
        const after = wrapDistance(distance, plan.length)
        const hit = stations.find((station) => withinSweep(before, after, station.distance, step >= plan.length))
        if (hit !== undefined) {
          pausedStation = hit
          pauseRemaining = hit.pauseSeconds
          distance = hit.distance + (distance - after)
          return sampleAt(distance, hit)
        }
      }
      return sampleAt(distance, pausedStation)
    },
  }

  return tour
}

/** True when a station's arc length falls inside the step just travelled. */
function withinSweep(before: number, after: number, station: number, fullLap: boolean): boolean {
  if (fullLap) {
    return true
  }
  if (before <= after) {
    return station > before && station <= after
  }
  // The step wrapped past the end of the loop.
  return station > before || station <= after
}
