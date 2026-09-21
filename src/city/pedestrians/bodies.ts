/**
 * Bodies, gaits and walk cycles of the era crowd.
 *
 * This module is pure arithmetic: no three.js, no React, no renderer. It turns
 * the block's seeded PRNG into a {@link BodyProfile} and a {@link GaitProfile},
 * and turns those plus a walk-cycle phase into a {@link PoseFrame} — one
 * position and rotation per skeletal part, in the pedestrian's own frame.
 *
 * Two consequences the rest of the layer relies on:
 *
 * - **Determinism.** Every person is a pure function of the seed, the era id and
 *   the pedestrian index, so unit and composition tests step the supplied clock
 *   and compare poses without mounting anything.
 * - **One shape library.** The body part shapes are the layout's reference
 *   figure, 1.75 m tall; every figure scales them through the instance matrix,
 *   so a child, a slim adult and a broad-shouldered adult share one geometry.
 *
 * ## Rig conventions
 *
 * `+Z` is the pedestrian's forward, `+Y` up, so a positive `x` rotation swings a
 * limb *backwards*. The walk cycle follows a standard two-step cycle: phase `0`
 * is left heel strike, phase `0.5` right heel strike, one cycle covers two
 * strides of `gait.strideLengthM` each.
 */

import { createRng, type Rng, type Seed } from '../../lib/rng'
import type { QualityTierName } from '../../lib/quality'
import { v3, type Vec3 } from '../layout'
import type {
  AnimationLod,
  BodyBuild,
  BodyProfile,
  GaitProfile,
  PartId,
  PartTransform,
  PedestrianState,
  PoseFrame,
  PrimitiveShape,
} from './types'
import { PART_IDS } from './types'

/* ------------------------------------------------------------------------- *
 * Reference figure
 * ------------------------------------------------------------------------- */

/** Height of the reference figure every shape is authored against. */
export const REFERENCE_HEIGHT_M = 1.75

/** Shoulder width of the reference figure, in metres. */
export const REFERENCE_SHOULDER_WIDTH_M = 0.4

/**
 * Joint ratios of the reference adult: every value is a fraction of the figure's
 * height, measured upwards from the ground plane.
 */
export const REFERENCE_JOINTS = {
  ankle: 0.043,
  knee: 0.28,
  hip: 0.526,
  hips: 0.549,
  torso: 0.709,
  shoulder: 0.817,
  head: 0.914,
} as const

/** Joint ratios of a growing child: shorter legs, a proportionally bigger head. */
export const CHILD_JOINTS = {
  ankle: 0.04,
  knee: 0.25,
  hip: 0.47,
  hips: 0.49,
  torso: 0.65,
  shoulder: 0.78,
  head: 0.87,
} as const

/** Half the distance between the shoulders of the reference figure, in metres. */
export const REFERENCE_SHOULDER_HALF_M = 0.2

/** Half the distance between the hip joints of the reference figure, in metres. */
export const REFERENCE_HIP_HALF_M = 0.09

/** Radius of the reference head, in metres; the head sphere is an ellipsoid. */
export const REFERENCE_HEAD_RADIUS_M = 0.115

/**
 * Shapes every figure is built from, authored for the reference figure.
 *
 * The whole crowd shares these eleven volumes: height, build and posture are
 * applied through the instance matrix instead of through more geometry.
 */
export const BODY_PART_SHAPES: Readonly<Record<PartId, PrimitiveShape>> = {
  hips: box(0.32, 0.26, 0.22),
  torso: box(0.38, 0.46, 0.22, [0, -0.01, 0]),
  head: sphere(0.23, 0.28, 0.25),
  upperArmL: cylinder(0.052, 0.28, 6, [0, -0.14, 0]),
  upperArmR: cylinder(0.052, 0.28, 6, [0, -0.14, 0]),
  forearmL: cylinder(0.045, 0.24, 6, [0, -0.12, 0]),
  forearmR: cylinder(0.045, 0.24, 6, [0, -0.12, 0]),
  handL: box(0.08, 0.15, 0.05, [0, -0.06, 0]),
  handR: box(0.08, 0.15, 0.05, [0, -0.06, 0]),
  thighL: cylinder(0.075, 0.4, 6, [0, -0.2, 0]),
  thighR: cylinder(0.075, 0.4, 6, [0, -0.2, 0]),
  shinL: cylinder(0.058, 0.38, 6, [0, -0.19, 0]),
  shinR: cylinder(0.058, 0.38, 6, [0, -0.19, 0]),
  footL: box(0.09, 0.07, 0.22, [0, 0.03, 0.06]),
  footR: box(0.09, 0.07, 0.22, [0, 0.03, 0.06]),
}

/** Skin colours of the crowd: period-independent, varied per person. */
export const SKIN_TONES: readonly string[] = [
  '#f0c9a4',
  '#e2b28a',
  '#c98f66',
  '#a96f4a',
  '#7d4f33',
  '#5b3a26',
  '#f6d8bd',
  '#8f6042',
]

/* ------------------------------------------------------------------------- *
 * Shape helpers
 * ------------------------------------------------------------------------- */

/** A box shape, centred on its part origin plus `offset`. */
export function box(
  width: number,
  height: number,
  depth: number,
  offset: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): PrimitiveShape {
  return { kind: 'box', size: [width, height, depth], segments: 1, taper: 1, offset, rotation }
}

/** A sphere/ellipsoid shape; the builder bakes `size` as a non-uniform scale. */
export function sphere(
  width: number,
  height: number,
  depth: number,
  offset: readonly [number, number, number] = [0, 0, 0],
  segments = 8,
): PrimitiveShape {
  return { kind: 'sphere', size: [width, height, depth], segments, taper: 1, offset, rotation: [0, 0, 0] }
}

/** A straight tube, sized by its radius and height. */
export function cylinder(
  radius: number,
  height: number,
  segments: number,
  offset: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): PrimitiveShape {
  return {
    kind: 'cylinder',
    size: [radius * 2, height, radius * 2],
    segments,
    taper: 1,
    offset,
    rotation,
  }
}

/** A tapered tube (skirt, gown, lampshade silhouette); `taper` is top/bottom. */
export function taperedCylinder(
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number,
  offset: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): PrimitiveShape {
  return {
    kind: 'tapered-cylinder',
    size: [Math.max(bottomRadius, topRadius) * 2, height, Math.max(bottomRadius, topRadius) * 2],
    segments,
    taper: bottomRadius > 0 ? topRadius / bottomRadius : 0,
    offset,
    rotation,
  }
}

/** A cone: a tapered tube whose top radius is zero. */
export function cone(
  radius: number,
  height: number,
  segments: number,
  offset: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): PrimitiveShape {
  return {
    kind: 'cone',
    size: [radius * 2, height, radius * 2],
    segments,
    taper: 0,
    offset,
    rotation,
  }
}

/** A ring: hat brims, belts, collars and handbag handles. */
export function torus(
  radius: number,
  tube: number,
  segments: number,
  offset: readonly [number, number, number] = [0, 0, 0],
  rotation: readonly [number, number, number] = [0, 0, 0],
): PrimitiveShape {
  return {
    kind: 'torus',
    size: [radius * 2, tube * 2, radius * 2],
    segments,
    taper: radius > 0 ? tube / radius : 0,
    offset,
    rotation,
  }
}

/** Triangles a primitive of this kind and resolution submits. */
export function shapeTriangleCount(shape: PrimitiveShape): number {
  const segments = Math.max(3, Math.round(shape.segments))
  switch (shape.kind) {
    case 'box':
      return 12
    case 'cylinder':
    case 'cone':
    case 'tapered-cylinder': {
      const heightSegments = 1
      const side = 2 * segments * heightSegments
      const topRadius = Math.max(shape.size[0], shape.size[2]) / 2 * shape.taper
      const bottomRadius = Math.max(shape.size[0], shape.size[2]) / 2
      const caps = (topRadius > 0 ? segments : 0) + (bottomRadius > 0 ? segments : 0)
      return side + caps
    }
    case 'sphere': {
      const heightSegments = Math.max(3, Math.round(segments / 2))
      return 2 * segments * (heightSegments - 1)
    }
    case 'torus':
      return 2 * segments * Math.max(3, Math.round(segments * 1.5))
    default:
      return 12
  }
}

/* ------------------------------------------------------------------------- *
 * Body generation
 * ------------------------------------------------------------------------- */

/** Builds pass to a body profile; `slim` and `broad` are cut from the same data. */
const BUILD_WIDTH: Readonly<Record<BodyBuild, number>> = {
  slim: 0.9,
  regular: 1,
  broad: 1.14,
}

/** Stride multiplier of a build: broad figures roll, slim figures stride. */
const BUILD_STRIDE: Readonly<Record<BodyBuild, number>> = {
  slim: 1.04,
  regular: 1,
  broad: 0.95,
}

function lerp(left: number, right: number, t: number): number {
  return left + (right - left) * t
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Fraction of the reference figure's shoulder width a build is cut for. */
function buildWidthScale(build: BodyBuild): number {
  return BUILD_WIDTH[build]
}

/**
 * Generates one person's proportions.
 *
 * @param rng Generator owned by this pedestrian; draws happen in a fixed order,
 *   so the same seed always produces the same figure.
 * @param childRatio Probability that this figure is a child, from the era's
 *   population data.
 */
export function createBodyProfile(rng: Rng, childRatio: number): BodyProfile {
  const isChild = rng.bool(clamp(childRatio, 0, 1))
  const heightM = isChild ? rng.float(1.12, 1.46) : rng.float(1.56, 1.93)
  const buildRoll = rng.next()
  const build: BodyBuild = buildRoll < 0.3 ? 'slim' : buildRoll < 0.84 ? 'regular' : 'broad'
  const widthScale = buildWidthScale(build) * rng.float(0.95, 1.06)
  const heightScale = heightM / REFERENCE_HEIGHT_M
  const joints = jointHeights(isChild, heightM)

  const shoulderHalf = REFERENCE_SHOULDER_HALF_M * widthScale
  const hipHalf = REFERENCE_HIP_HALF_M * widthScale
  const elbowY = joints.shoulder - (isChild ? 0.16 : 0.171) * heightM
  const wristY = joints.shoulder - (isChild ? 0.3 : 0.32) * heightM
  const limbThicknessM = 0.05 * widthScale

  return {
    heightM,
    build,
    isChild,
    heightScale,
    widthScale,
    shoulderWidthM: shoulderHalf * 2,
    hipWidthM: hipHalf * 2,
    chestDepthM: 0.22 * widthScale,
    limbThicknessM,
    headScale: heightScale * (isChild ? 1.14 : 1),
    strideScale: heightScale * BUILD_STRIDE[build] * (isChild ? 0.94 : 1),
    origins: {
      hips: v3(0, joints.hips, 0),
      torso: v3(0, joints.torso, 0),
      head: v3(0, joints.head, 0),
      upperArmL: v3(-shoulderHalf, joints.shoulder, 0),
      upperArmR: v3(shoulderHalf, joints.shoulder, 0),
      forearmL: v3(-shoulderHalf, elbowY, 0),
      forearmR: v3(shoulderHalf, elbowY, 0),
      handL: v3(-shoulderHalf, wristY, 0),
      handR: v3(shoulderHalf, wristY, 0),
      thighL: v3(-hipHalf, joints.hip, 0),
      thighR: v3(hipHalf, joints.hip, 0),
      shinL: v3(-hipHalf, joints.knee, 0),
      shinR: v3(hipHalf, joints.knee, 0),
      footL: v3(-hipHalf, joints.ankle, 0),
      footR: v3(hipHalf, joints.ankle, 0),
    },
    limbs: {
      thigh: joints.hip - joints.knee,
      shin: joints.knee - joints.ankle,
      upperArm: joints.shoulder - elbowY,
      forearm: elbowY - wristY,
    },
  }
}

/**
 * Joint heights of one figure: the reference ratios, shifted towards growing
 * proportions for a child, multiplied by the figure's own height.
 */
function jointHeights(
  isChild: boolean,
  heightM: number,
): Readonly<Record<keyof typeof REFERENCE_JOINTS, number>> {
  const ratio = isChild ? 1 : 0
  return {
    ankle: lerp(REFERENCE_JOINTS.ankle, CHILD_JOINTS.ankle, ratio) * heightM,
    knee: lerp(REFERENCE_JOINTS.knee, CHILD_JOINTS.knee, ratio) * heightM,
    hip: lerp(REFERENCE_JOINTS.hip, CHILD_JOINTS.hip, ratio) * heightM,
    hips: lerp(REFERENCE_JOINTS.hips, CHILD_JOINTS.hips, ratio) * heightM,
    torso: lerp(REFERENCE_JOINTS.torso, CHILD_JOINTS.torso, ratio) * heightM,
    shoulder: lerp(REFERENCE_JOINTS.shoulder, CHILD_JOINTS.shoulder, ratio) * heightM,
    head: lerp(REFERENCE_JOINTS.head, CHILD_JOINTS.head, ratio) * heightM,
  }
}

/**
 * Generates one person's own walk from the era's mean gait.
 *
 * Every term varies around the era value, so the crowd reads as one period with
 * many people in it: a 1945 crowd really does shuffle where a 2025 crowd strides.
 */
export function createGaitProfile(rng: Rng, eraGait: GaitProfile, body: BodyProfile): GaitProfile {
  const pace = rng.float(0.86, 1.16)
  const speedMps = eraGait.speedMps * pace * (body.isChild ? 1.08 : 1)
  const strideLengthM = eraGait.strideLengthM * body.strideScale * rng.float(0.94, 1.06)
  return {
    speedMps,
    strideLengthM,
    cadenceStepsPerMin: (speedMps / Math.max(strideLengthM, 0.1)) * 60,
    armSwingRad: eraGait.armSwingRad * rng.float(0.86, 1.14),
    hipSwayRad: eraGait.hipSwayRad * rng.float(0.9, 1.1),
    bobM: eraGait.bobM * rng.float(0.85, 1.15),
    leanRad: eraGait.leanRad * rng.float(0.8, 1.2),
    posture: eraGait.posture,
  }
}

/* ------------------------------------------------------------------------- *
 * Animation level of detail
 * ------------------------------------------------------------------------- */

/**
 * Distance thresholds, in metres, between animation levels of detail.
 *
 * Below the first value a pedestrian is fully animated, between the two it
 * updates at a third of the frame rate and drops props and accessories, and
 * beyond the second it is a static palette-coloured silhouette. Cheaper tiers
 * pull both thresholds in, which is what keeps a dense crowd inside the shared
 * quality budgets.
 */
export const ANIMATION_LOD_DISTANCES: Readonly<Record<QualityTierName, readonly [number, number]>> = {
  high: [48, 120],
  medium: [36, 90],
  low: [24, 58],
}

/** Resolves the animation level of detail for a distance and quality tier. */
export function animationLodFor(distanceM: number, tier: QualityTierName): AnimationLod {
  const [near, far] = ANIMATION_LOD_DISTANCES[tier]
  if (distanceM <= near) {
    return 0
  }
  return distanceM <= far ? 1 : 2
}

/* ------------------------------------------------------------------------- *
 * Walk cycles
 * ------------------------------------------------------------------------- */

/** What a pedestrian is doing, plus what its hands are holding. */
export interface PoseInput {
  readonly body: BodyProfile
  readonly gait: GaitProfile
  readonly state: PedestrianState
  /** Current ground speed in metres per second; 0 when standing still. */
  readonly speedMps: number
  /** Walk-cycle phase in `[0, 1)`; one cycle is two steps. */
  readonly phase: number
  /** Simulated seconds, used by the idle sway and the head look. */
  readonly seconds: number
  /** Per-person phase offset of the idle sway. */
  readonly idlePhase: number
  /** Per-person phase offset of the head look. */
  readonly lookPhase: number
  /** True when a carried prop occupies that hand. */
  readonly holdLeft: boolean
  readonly holdRight: boolean
}

/** Below this speed a walker is treated as standing still. */
const IDLE_SPEED_THRESHOLD = 0.05

/** Seconds of one idle sway cycle. */
const IDLE_SWAY_PERIOD = 5.6

/** Peak head yaw of a walker who is looking around, in radians. */
const WALKING_LOOK_RAD = 0.12

/** Peak head yaw of a waiter scanning the traffic, in radians. */
const WAITING_LOOK_RAD = 0.42

/** Elbow flexion of a relaxed arm, in radians. */
const ELBOW_REST_RAD = 0.3

/** Shoulder and elbow angles of an arm holding something in front of the body. */
const HOLD_SHOULDER_RAD = -0.62
const HOLD_ELBOW_RAD = -1.15

function restTransform(position: Vec3): PartTransform {
  return { position, rotation: v3(0, 0, 0) }
}

/** The neutral stance of a figure: every joint straight, feet under the hips. */
export function restPose(body: BodyProfile): PoseFrame {
  const frame = {} as Record<PartId, PartTransform>
  for (const part of PART_IDS) {
    frame[part] = restTransform(body.origins[part])
  }
  return frame
}

/** Rotates a limb vector downwards from a joint by `pitch` radians about `x`. */
function limbTip(origin: Vec3, length: number, pitch: number): Vec3 {
  return v3(origin.x, origin.y - length * Math.cos(pitch), origin.z - length * Math.sin(pitch))
}

/** Knee flexion over one leg cycle: nearly straight at mid-stance, deep in swing. */
function kneeFlex(legPhase: number, amplitude: number): number {
  // The leg is furthest forward at phase 0.25 and furthest back at 0.75, so its
  // swing runs from 0.75 back round to 0.25: mid-swing (and deepest knee bend)
  // is at phase 0, mid-stance (nearly straight) at 0.5.
  const cycle = 2 * Math.PI * (legPhase - 0.5)
  return 0.12 + amplitude * (0.5 - 0.5 * Math.cos(cycle))
}

/** Ankle rotation: a small push-off at the back of the stance, a lift in swing. */
function ankleAngle(legPhase: number): number {
  return 0.22 * Math.sin(2 * Math.PI * (legPhase - 0.05))
}

/**
 * Builds one pose.
 *
 * Walking figures run a two-step cycle whose stride, arm swing, hip sway and bob
 * all come from {@link GaitProfile}; waiting figures run a slower weighting
 * sway with the head scanning the traffic, which is what a crowd looks like when
 * it is held at a kerb by a red signal.
 */
export function posePedestrian(input: PoseInput): PoseFrame {
  const { body, gait } = input
  const idle = input.state !== 'walking' || input.speedMps < IDLE_SPEED_THRESHOLD
  const frame = {} as Record<PartId, PartTransform>
  const cycle = 2 * Math.PI * input.phase
  const swing = Math.sin(cycle)
  const stance = 0.5 - 0.5 * Math.cos(2 * cycle)
  const swayPhase = 2 * Math.PI * (input.seconds / IDLE_SWAY_PERIOD + input.idlePhase)
  const look = 2 * Math.PI * (input.seconds / 4.2 + input.lookPhase)

  const strideScale = clamp(input.gait.strideLengthM / 0.68, 0.6, 1.6)
  const hipAngle = gait.hipSwayRad * strideScale
  const kneeAmplitude = 0.55 * strideScale
  const bob = idle ? 0 : gait.bobM * stance

  const sway = idle ? Math.sin(swayPhase) : Math.sin(cycle) * 0.5
  const hips: Vec3 = v3(body.origins.hips.x + sway * 0.012 * body.widthScale, body.origins.hips.y + bob, 0)
  const torsoRoll = idle ? sway * 0.07 : sway * 0.05
  const torsoYaw = idle ? sway * 0.02 : -sway * gait.hipSwayRad * 0.35
  const lean = idle ? gait.leanRad * 0.35 : gait.leanRad

  frame.hips = {
    position: hips,
    rotation: v3(0, idle ? sway * 0.04 : sway * gait.hipSwayRad * 0.6, torsoRoll),
  }
  frame.torso = {
    position: v3(
      body.origins.torso.x + sway * 0.01,
      body.origins.torso.y + bob * 0.9 - Math.sin(lean) * 0.02,
      Math.sin(lean) * 0.04,
    ),
    rotation: v3(lean, torsoYaw, torsoRoll),
  }
  const headLook = idle ? Math.sin(look) * WAITING_LOOK_RAD : Math.sin(look * 0.5) * WALKING_LOOK_RAD
  frame.head = {
    position: v3(body.origins.head.x + sway * 0.008, body.origins.head.y + bob * 0.8, 0),
    rotation: v3(-lean * 0.6, headLook - torsoYaw * 0.5, -torsoRoll * 0.6),
  }

  const armPitch = (side: 1 | -1): number => {
    if (idle) {
      return sway * side * 0.06
    }
    return swing * side * gait.armSwingRad
  }

  for (const side of [1, -1] as const) {
    const shoulderKey = side === 1 ? 'upperArmL' : 'upperArmR'
    const forearmKey = side === 1 ? 'forearmL' : 'forearmR'
    const handKey = side === 1 ? 'handL' : 'handR'
    const holding = side === 1 ? input.holdLeft : input.holdRight
    const shoulder = holding ? HOLD_SHOULDER_RAD : armPitch(side) + lean * 0.4
    const elbow = holding ? HOLD_ELBOW_RAD : -ELBOW_REST_RAD - (idle ? 0.05 : 0.3 * Math.max(0, -swing * side))
    const shoulderOrigin = body.origins[shoulderKey]
    const elbowOrigin = limbTip(shoulderOrigin, body.limbs.upperArm, shoulder)
    const wristOrigin = limbTip(elbowOrigin, body.limbs.forearm, shoulder + elbow)

    frame[shoulderKey] = { position: shoulderOrigin, rotation: v3(shoulder, 0, side * (holding ? -0.18 : 0.06)) }
    frame[forearmKey] = { position: elbowOrigin, rotation: v3(shoulder + elbow, 0, side * 0.05) }
    frame[handKey] = { position: wristOrigin, rotation: v3(shoulder + elbow, 0, 0) }
  }

  for (const side of [1, -1] as const) {
    const thighKey = side === 1 ? 'thighL' : 'thighR'
    const shinKey = side === 1 ? 'shinL' : 'shinR'
    const footKey = side === 1 ? 'footL' : 'footR'
    const legPhase = side === 1 ? input.phase : (input.phase + 0.5) % 1
    const legSwing = Math.sin(2 * Math.PI * legPhase)
    const thigh = idle
      ? 0.02 * sway * side
      : -legSwing * hipAngle
    const knee = idle ? 0.06 + 0.03 * Math.max(0, sway * side) : kneeFlex(legPhase, kneeAmplitude)
    const ankle = idle ? 0 : ankleAngle(legPhase)
    const hipOrigin = body.origins[thighKey]
    const kneeOrigin = limbTip(hipOrigin, body.limbs.thigh, thigh)
    const ankleOrigin = limbTip(kneeOrigin, body.limbs.shin, thigh + knee)

    frame[thighKey] = { position: hipOrigin, rotation: v3(thigh, 0, side * 0.02) }
    frame[shinKey] = { position: kneeOrigin, rotation: v3(thigh + knee, 0, 0) }
    frame[footKey] = { position: ankleOrigin, rotation: v3(thigh + knee + ankle, 0, 0) }
  }

  return frame
}

/**
 * Deterministic generator of one pedestrian.
 *
 * Identity, proportions, gait and every era's outfit are drawn from it, so the
 * same seed always dresses and animates the same crowd — independently of the
 * era currently applied.
 */
export function pedestrianRng(seed: Seed, index: number): Rng {
  return createRng(seed, 'pedestrians').fork(`pedestrian:${index}`)
}

/** Scale a person's shapes: vertical by height, horizontal by build. */
export function bodyScale(body: BodyProfile): Vec3 {
  return v3(body.widthScale, body.heightScale, body.widthScale)
}
