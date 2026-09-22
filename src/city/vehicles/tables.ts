/**
 * Per-era vehicle tables and the procedural model catalogue.
 *
 * Two bodies of data live here, both pure (no three.js, no React):
 *
 * - {@link VEHICLE_MODELS} describes every vehicle of the five periods as a
 *   list of primitive parts in metres. A model is data, so the same record
 *   drives the instanced renderer, the fleet planner and the unit suite
 *   without a second source of truth for proportions.
 * - {@link ERA_VEHICLE_TABLES} is the census, lane configuration, road-marking
 *   plan and SFX cadence of each era, keyed by the shared `EraId`. Behaviour
 *   numbers that the era registry already owns (density, cruising speed,
 *   parked ratio, transit model list) stay in the registry: the tables declare
 *   the *vehicle-layer* detail and {@link validateEraVehicleTable} proves the
 *   two records agree.
 *
 * The layer never contains a year literal in animation code: period behaviour
 * is a table lookup, so a new period is one more record.
 */

import { ERA_IDS, getEra, type EraId, type EraTraffic, type HexColor } from '../../era'
import {
  SFX_KINDS,
  VEHICLE_CLASSES,
  type EraMarkingSpec,
  type EraVehicleTable,
  type FleetEntrySpec,
  type LaneConfiguration,
  type PaletteKey,
  type SfxKind,
  type SfxProfile,
  type VehicleClass,
  type VehicleModelSpec,
  type VehiclePartSpec,
  type VehiclePower,
} from './types'

/* ------------------------------------------------------------------------- *\
 * Part helpers: primitives in metres, local to the model
 * ------------------------------------------------------------------------- */

/** Material role implied by a colour key. */
function roleFromColour(colourKey: VehiclePartSpec['colourKey']): VehiclePartSpec['role'] {
  switch (colourKey) {
    case 'paint':
      return 'body'
    case 'glass':
      return 'glass'
    case 'tire':
      return 'tire'
    case 'headlamp':
    case 'taillamp':
      return 'lamp'
    case 'glow':
      return 'glow'
    case 'sign':
    case 'metal':
      return 'detail'
    case 'trim':
    default:
      return 'trim'
  }
}

/** A box primitive; `size` is `[width, height, length]` in metres. */
function box(
  name: string,
  colourKey: VehiclePartSpec['colourKey'],
  size: readonly [number, number, number],
  offset: readonly [number, number, number],
  rotationY = 0,
): VehiclePartSpec {
  const part: VehiclePartSpec = {
    name,
    role: roleFromColour(colourKey),
    shape: 'box',
    size,
    offset,
    colourKey,
  }
  return rotationY === 0 ? part : { ...part, rotationY }
}

/** A vertical cylinder; `size` is `[radius, height, 0]`. */
function cylinder(
  name: string,
  colourKey: VehiclePartSpec['colourKey'],
  radius: number,
  height: number,
  offset: readonly [number, number, number],
): VehiclePartSpec {
  return {
    name,
    role: roleFromColour(colourKey),
    shape: 'cylinder',
    size: [radius, height, 0],
    offset,
    colourKey,
  }
}

/** A sphere; `size` is `[radius, 0, 0]`. */
function sphere(
  name: string,
  colourKey: VehiclePartSpec['colourKey'],
  radius: number,
  offset: readonly [number, number, number],
): VehiclePartSpec {
  return {
    name,
    role: roleFromColour(colourKey),
    shape: 'sphere',
    size: [radius, 0, 0],
    offset,
    colourKey,
  }
}

/** A road wheel; `size` is `[radius, width, 0]`, the axis runs along local `x`. */
function wheel(name: string, radius: number, width: number, x: number, z: number): VehiclePartSpec {
  return {
    name,
    role: 'tire',
    shape: 'wheel',
    size: [radius, width, 0],
    offset: [x, radius, z],
    colourKey: 'tire',
  }
}

/** Wheel placement of an axle set. */
interface WheelPlacement {
  readonly radius: number
  readonly width: number
  /** Half the distance between the left and right wheels. */
  readonly trackHalf: number
  /** Local `z` of each axle centre. */
  readonly axles: readonly number[]
}

/** Two wheels per axle, one either side. */
function axleWheels(placement: WheelPlacement): VehiclePartSpec[] {
  const parts: VehiclePartSpec[] = []
  placement.axles.forEach((z, axle) => {
    parts.push(wheel(`wheel-l${axle}`, placement.radius, placement.width, -placement.trackHalf, z))
    parts.push(wheel(`wheel-r${axle}`, placement.radius, placement.width, placement.trackHalf, z))
  })
  return parts
}

/** A left/right pair of lamps at one height. */
function lampPair(
  prefix: string,
  colourKey: 'headlamp' | 'taillamp' | 'glow',
  size: readonly [number, number, number],
  y: number,
  z: number,
  spread: number,
): VehiclePartSpec[] {
  return [
    box(`${prefix}-left`, colourKey, size, [-spread, y, z]),
    box(`${prefix}-right`, colourKey, size, [spread, y, z]),
  ]
}

/* ------------------------------------------------------------------------- *\
 * Assembly builders
 * ------------------------------------------------------------------------- */

/** Lamp sizes shared by every model, in metres. */
export const LAMP_SIZES = {
  head: [0.26, 0.14, 0.07],
  tail: [0.22, 0.13, 0.07],
  indicator: [0.13, 0.1, 0.08],
} as const satisfies Readonly<Record<string, readonly [number, number, number]>>

interface CarPartsOptions {
  readonly length: number
  readonly width: number
  /** Ground clearance under the body. */
  readonly ride: number
  readonly bodyHeight: number
  readonly cabinHeight: number
  readonly cabinLength: number
  /** Local `z` of the cabin centre; negative moves it rearward. */
  readonly cabinZ: number
  readonly wheels: WheelPlacement
  /** Thin painted cap over the cabin. */
  readonly roof?: boolean
  /** False makes the cabin solid bodywork, as on a panel van. */
  readonly glazed?: boolean
  /** Lamp strip height as a fraction of the body height. */
  readonly lampHeightRatio?: number
  readonly extras?: readonly VehiclePartSpec[]
}

/**
 * Body + cabin + bumpers + wheels + lamps: the assembly every car-derived
 * model of the catalogue is built from. Period silhouettes come from the
 * proportions and the `extras`, not from extra code.
 */
function carParts(options: CarPartsOptions): VehiclePartSpec[] {
  const { length, width, ride, bodyHeight, cabinHeight, cabinLength, cabinZ } = options
  const parts: VehiclePartSpec[] = [
    box('body', 'paint', [width, bodyHeight, length], [0, ride + bodyHeight / 2, 0]),
  ]

  if (cabinHeight > 0) {
    parts.push(
      box(
        'cabin',
        options.glazed === false ? 'paint' : 'glass',
        [width * 0.88, cabinHeight, cabinLength],
        [0, ride + bodyHeight + cabinHeight / 2, cabinZ],
      ),
    )
    if (options.roof === true) {
      parts.push(
        box(
          'roof',
          'paint',
          [width * 0.84, 0.08, cabinLength * 0.72],
          [0, ride + bodyHeight + cabinHeight + 0.04, cabinZ],
        ),
      )
    }
  }

  parts.push(box('bumper-front', 'trim', [width, 0.16, 0.2], [0, ride + 0.18, length / 2]))
  parts.push(box('bumper-rear', 'trim', [width, 0.16, 0.2], [0, ride + 0.18, -length / 2]))
  parts.push(...axleWheels(options.wheels))

  const lampY = ride + bodyHeight * (options.lampHeightRatio ?? 0.72)
  parts.push(...lampPair('headlamp', 'headlamp', LAMP_SIZES.head, lampY, length / 2 + 0.01, width * 0.33))
  parts.push(...lampPair('taillamp', 'taillamp', LAMP_SIZES.tail, lampY, -length / 2 - 0.01, width * 0.33))
  parts.push(
    ...lampPair(
      'indicator',
      'glow',
      LAMP_SIZES.indicator,
      ride + bodyHeight * 0.52,
      length / 2 - 0.03,
      width * 0.46,
    ),
  )
  parts.push(...(options.extras ?? []))
  return parts
}

interface TransitPartsOptions {
  readonly length: number
  readonly width: number
  readonly ride: number
  readonly bodyHeight: number
  readonly wheels: WheelPlacement
  /** Height of the glazing band centre above the body base. */
  readonly windowBandY: number
  readonly windowBandHeight: number
  /** Destination sign over the windscreen. */
  readonly destinationSign: boolean
  /** Trolley pole / pantograph, for the streetcar. */
  readonly overheadPole: boolean
  readonly extras?: readonly VehiclePartSpec[]
}

/** Long, tall box with a glazing band: the bus and streetcar assembly. */
function transitParts(options: TransitPartsOptions): VehiclePartSpec[] {
  const { length, width, ride, bodyHeight } = options
  const parts: VehiclePartSpec[] = [
    box('body', 'paint', [width, bodyHeight, length], [0, ride + bodyHeight / 2, 0]),
    box('roof', 'paint', [width * 0.96, 0.1, length * 0.98], [0, ride + bodyHeight + 0.05, 0]),
    box(
      'glazing-left',
      'glass',
      [0.06, options.windowBandHeight, length * 0.86],
      [-width / 2, ride + options.windowBandY, 0],
    ),
    box(
      'glazing-right',
      'glass',
      [0.06, options.windowBandHeight, length * 0.86],
      [width / 2, ride + options.windowBandY, 0],
    ),
    box('windscreen', 'glass', [width * 0.9, options.windowBandHeight, 0.06], [0, ride + options.windowBandY, length / 2]),
    box('door-front', 'trim', [0.08, bodyHeight * 0.78, 1.1], [width / 2 - 0.02, ride + bodyHeight * 0.42, length * 0.22]),
    box('door-rear', 'trim', [0.08, bodyHeight * 0.78, 1.1], [width / 2 - 0.02, ride + bodyHeight * 0.42, -length * 0.22]),
    box('bumper-front', 'trim', [width, 0.24, 0.22], [0, ride + 0.2, length / 2]),
    box('bumper-rear', 'trim', [width, 0.24, 0.22], [0, ride + 0.2, -length / 2]),
  ]
  parts.push(...axleWheels(options.wheels))
  parts.push(...lampPair('headlamp', 'headlamp', [0.3, 0.18, 0.08], ride + 0.55, length / 2 + 0.01, width * 0.34))
  parts.push(...lampPair('taillamp', 'taillamp', [0.24, 0.18, 0.08], ride + 0.6, -length / 2 - 0.01, width * 0.34))
  parts.push(
    ...lampPair('indicator', 'glow', LAMP_SIZES.indicator, ride + 0.45, length / 2 - 0.04, width * 0.46),
  )
  if (options.destinationSign) {
    parts.push(box('destination-sign', 'sign', [width * 0.62, 0.26, 0.05], [0, ride + bodyHeight - 0.16, length / 2 + 0.03]))
  }
  if (options.overheadPole) {
    parts.push(cylinder('trolley-pole', 'metal', 0.04, 1.6, [0, ride + bodyHeight + 0.85, -length * 0.12]))
  }
  parts.push(...(options.extras ?? []))
  return parts
}

interface BicyclePartsOptions {
  readonly wheelbase: number
  readonly wheelRadius: number
  /** Cargo box over the rear wheel (courier and cargo bikes). */
  readonly cargoBox: boolean
  /** Battery pack and hub motor (e-bikes). */
  readonly electric: boolean
  readonly paint: boolean
}

/** Two inline wheels, frame, handlebar and an optional cargo box or battery. */
function bicycleParts(options: BicyclePartsOptions): VehiclePartSpec[] {
  const { wheelbase, wheelRadius: radius } = options
  const parts: VehiclePartSpec[] = [
    wheel('wheel-front', radius, 0.05, 0, wheelbase / 2),
    wheel('wheel-rear', radius, 0.05, 0, -wheelbase / 2),
    box('top-tube', options.paint ? 'paint' : 'metal', [0.05, 0.05, wheelbase * 0.92], [0, radius + 0.62, 0]),
    box('seat-tube', 'metal', [0.05, 0.42, 0.05], [0, radius + 0.5, -wheelbase / 2 + 0.12]),
    box('saddle', 'trim', [0.14, 0.07, 0.3], [0, radius + 0.78, -wheelbase / 2 + 0.1]),
    box('stem', 'metal', [0.05, 0.4, 0.05], [0, radius + 0.62, wheelbase / 2]),
    box('handlebar', 'metal', [0.52, 0.05, 0.05], [0, radius + 0.85, wheelbase / 2]),
    box('headlamp', 'headlamp', [0.12, 0.1, 0.06], [0, radius + 0.5, wheelbase / 2 + 0.05]),
    box('taillamp', 'taillamp', [0.1, 0.08, 0.05], [0, radius + 0.55, -wheelbase / 2 - 0.06]),
  ]
  if (options.cargoBox) {
    parts.push(box('cargo-box', 'sign', [0.52, 0.44, 0.5], [0, radius + 0.55, -wheelbase / 2 - 0.3]))
  }
  if (options.electric) {
    parts.push(box('battery', 'metal', [0.12, 0.16, 0.34], [0, radius + 0.34, -0.08]))
  }
  return parts
}

interface KickScooterPartsOptions {
  readonly deckLength: number
  readonly wheelRadius: number
  /** Full bodywork, as on a period motor scooter. */
  readonly motorised: boolean
  readonly paint: boolean
}

/** Deck, mast and two small wheels: kick and e-scooters, plus motor scooters. */
function scooterParts(options: KickScooterPartsOptions): VehiclePartSpec[] {
  const { deckLength, wheelRadius: radius } = options
  const parts: VehiclePartSpec[] = [
    wheel('wheel-front', radius, 0.08, 0, deckLength / 2 + 0.12),
    wheel('wheel-rear', radius, 0.08, 0, -deckLength / 2 - 0.12),
    box('deck', options.paint ? 'paint' : 'metal', [0.4, 0.12, deckLength], [0, radius + 0.1, 0]),
    box('mast', 'metal', [0.06, 0.72, 0.06], [0, radius + 0.5, deckLength / 2 + 0.06]),
    box('handlebar', 'metal', [0.5, 0.05, 0.05], [0, radius + 0.86, deckLength / 2 + 0.06]),
    box('headlamp', 'headlamp', [0.12, 0.1, 0.06], [0, radius + 0.66, deckLength / 2 + 0.1]),
    box('taillamp', 'taillamp', [0.1, 0.07, 0.05], [0, radius + 0.3, -deckLength / 2 - 0.12]),
  ]
  if (options.motorised) {
    parts.push(box('body-shell', 'paint', [0.46, 0.5, deckLength * 0.7], [0, radius + 0.42, -deckLength * 0.12]))
    parts.push(box('saddle', 'trim', [0.3, 0.12, 0.5], [0, radius + 0.72, -deckLength * 0.2]))
    parts.push(box('windscreen', 'glass', [0.42, 0.34, 0.04], [0, radius + 0.86, deckLength / 2 + 0.12]))
  }
  return parts
}

interface RobotPartsOptions {
  readonly length: number
  readonly width: number
  readonly bodyHeight: number
  readonly wheelRadius: number
}

/** Six-wheeled delivery robot with a sensor mast. */
function robotParts(options: RobotPartsOptions): VehiclePartSpec[] {
  const { length, width, bodyHeight, wheelRadius: radius } = options
  const deck = radius + bodyHeight / 2
  const parts: VehiclePartSpec[] = [
    box('body', 'paint', [width, bodyHeight, length], [0, deck, 0]),
    box('lid', 'trim', [width * 0.94, 0.08, length * 0.94], [0, deck + bodyHeight / 2 + 0.04, 0]),
    cylinder('sensor-mast', 'metal', 0.035, 0.3, [0, deck + bodyHeight / 2 + 0.2, 0]),
    sphere('sensor-head', 'headlamp', 0.08, [0, deck + bodyHeight / 2 + 0.38, 0]),
    box('headlamp', 'headlamp', [0.16, 0.08, 0.05], [0, deck + 0.06, length / 2 + 0.01]),
    box('taillamp', 'taillamp', [0.16, 0.07, 0.05], [0, deck + 0.06, -length / 2 - 0.01]),
    sphere('marker-left', 'glow', 0.05, [-width * 0.4, deck + 0.14, length / 2]),
    sphere('marker-right', 'glow', 0.05, [width * 0.4, deck + 0.14, length / 2]),
  ]
  for (const z of [length * 0.32, -length * 0.32]) {
    parts.push(wheel(`wheel-l${z > 0 ? 'f' : 'r'}`, radius, 0.08, -width * 0.5, z))
    parts.push(wheel(`wheel-r${z > 0 ? 'f' : 'r'}`, radius, 0.08, width * 0.5, z))
  }
  return parts
}

/* ------------------------------------------------------------------------- *\
 * Assembly bounds and model catalogue
 * ------------------------------------------------------------------------- */

interface Extents {
  readonly x: number
  readonly y: number
  readonly z: number
}

function partExtents(part: VehiclePartSpec): Extents {
  const [first, second, third] = part.size
  switch (part.shape) {
    case 'cylinder':
      return { x: first, y: second / 2, z: first }
    case 'sphere':
      return { x: first, y: first, z: first }
    case 'wheel':
      return { x: second / 2, y: first, z: first }
    case 'box':
    default:
      return { x: first / 2, y: second / 2, z: third / 2 }
  }
}

/** Overall size of a procedural assembly, in metres. */
export function assemblyBounds(parts: readonly VehiclePartSpec[]): {
  readonly lengthM: number
  readonly widthM: number
  readonly heightM: number
} {
  let halfLength = 0
  let halfWidth = 0
  let height = 0
  for (const part of parts) {
    const extents = partExtents(part)
    halfLength = Math.max(halfLength, Math.abs(part.offset[2]) + extents.z)
    halfWidth = Math.max(halfWidth, Math.abs(part.offset[0]) + extents.x)
    height = Math.max(height, part.offset[1] + extents.y)
  }
  const round = (value: number): number => Math.round(value * 1000) / 1000
  return { lengthM: round(halfLength * 2), widthM: round(halfWidth * 2), heightM: round(height) }
}

/** Default SFX family of a model, derived from what drives it. */
export function sfxKindsFor(power: VehiclePower, vehicleClass: VehicleClass): SfxKind[] {
  const kinds: SfxKind[] = []
  if (vehicleClass === 'streetcar' || vehicleClass === 'bus') {
    kinds.push('transit-bell')
    kinds.push(power === 'electric' ? 'ev-whine' : 'engine')
    if (vehicleClass === 'bus') {
      kinds.push('horn')
    }
  } else if (vehicleClass === 'micro') {
    if (power === 'human') {
      kinds.push('horn')
    } else if (power === 'electric') {
      kinds.push('ev-whine')
    } else {
      kinds.push('horn')
      kinds.push('engine')
    }
  } else {
    kinds.push('horn')
    kinds.push(power === 'electric' ? 'ev-whine' : 'engine')
  }
  return SFX_KINDS.filter((kind) => kinds.includes(kind))
}

interface ModelOptions {
  readonly key: string
  readonly label: string
  readonly class: VehicleClass
  readonly power: VehiclePower
  readonly silhouette: VehicleModelSpec['silhouette']
  readonly tags: readonly string[]
  readonly parts: readonly VehiclePartSpec[]
  readonly lamps: VehicleModelSpec['lamps']
  /** Defaults to true for cars, taxis, police, vans and trucks. */
  readonly parks?: boolean
  /** Defaults to the model's class being `micro`. */
  readonly micro?: boolean
  /** Extra SFX beyond the family default, e.g. tire squeal. */
  readonly extraSfx?: readonly SfxKind[]
}

const PARKING_CLASSES: readonly VehicleClass[] = ['car', 'taxi', 'police', 'van', 'truck']

function defineModel(options: ModelOptions): VehicleModelSpec {
  const bounds = assemblyBounds(options.parts)
  const extra = options.extraSfx ?? []
  const sfxKinds = SFX_KINDS.filter(
    (kind) => sfxKindsFor(options.power, options.class).includes(kind) || extra.includes(kind),
  )
  return {
    key: options.key,
    label: options.label,
    class: options.class,
    power: options.power,
    silhouette: options.silhouette,
    tags: options.tags,
    ...bounds,
    wheelbaseM: 0,
    wheelRadiusM: 0,
    wheelWidthM: 0,
    trackHalfM: 0,
    lamps: options.lamps,
    parks: options.parks ?? PARKING_CLASSES.includes(options.class),
    micro: options.micro ?? options.class === 'micro',
    parts: options.parts,
    sfxKinds,
  }
}

function modelList(specs: readonly VehicleModelSpec[]): Readonly<Record<string, VehicleModelSpec>> {
  const catalogue: Record<string, VehicleModelSpec> = {}
  for (const spec of specs) {
    if (catalogue[spec.key] !== undefined) {
      throw new Error(`Duplicate vehicle model key ${spec.key}`)
    }
    catalogue[spec.key] = spec
  }
  return catalogue
}

/** Wheel and lamp summary copied onto every model for quick reporting. */
function withWheels(spec: VehicleModelSpec, placement: WheelPlacement): VehicleModelSpec {
  return {
    ...spec,
    wheelbaseM: Math.abs((placement.axles[0] ?? 0) - (placement.axles[placement.axles.length - 1] ?? 0)),
    wheelRadiusM: placement.radius,
    wheelWidthM: placement.width,
    trackHalfM: placement.trackHalf,
  }
}

/* ------------------------------------------------------------------------- *\
 * The catalogue
 * ------------------------------------------------------------------------- */

const ROUNDED_WHEELS: WheelPlacement = { radius: 0.34, width: 0.2, trackHalf: 0.68, axles: [-1.32, 1.32] }

/** 1945: tall, narrow, rounded bodies with separate fenders and running boards. */
const MODEL_1945_SEDAN = withWheels(
  defineModel({
    key: 'sedan-1940s',
    label: '1940s sedan',
    class: 'car',
    power: 'combustion',
    silhouette: 'rounded',
    tags: ['sedan', 'rounded-fenders', 'running-board'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.5,
      width: 1.8,
      ride: 0.34,
      bodyHeight: 0.92,
      cabinHeight: 0.66,
      cabinLength: 1.9,
      cabinZ: -0.16,
      wheels: ROUNDED_WHEELS,
      roof: true,
      lampHeightRatio: 0.66,
      extras: [
        box('fender-left', 'paint', [0.22, 0.5, 1.3], [-0.9, 0.55, 1.1]),
        box('fender-right', 'paint', [0.22, 0.5, 1.3], [0.9, 0.55, 1.1]),
        box('running-board', 'trim', [1.9, 0.06, 1.2], [0, 0.32, -0.1]),
      ],
    }),
  }),
  ROUNDED_WHEELS,
)

const MODEL_1945_COUPE = withWheels(
  defineModel({
    key: 'coupe-1940s',
    label: '1940s coupe',
    class: 'car',
    power: 'combustion',
    silhouette: 'rounded',
    tags: ['coupe', 'rounded-fenders'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.1,
      width: 1.78,
      ride: 0.32,
      bodyHeight: 0.8,
      cabinHeight: 0.6,
      cabinLength: 1.5,
      cabinZ: -0.5,
      wheels: { radius: 0.33, width: 0.19, trackHalf: 0.66, axles: [-1.2, 1.2] },
      roof: true,
      lampHeightRatio: 0.62,
      extras: [
        box('trunk-rack', 'trim', [1.2, 0.08, 0.5], [0, 1.05, -1.5]),
        box('spare-wheel', 'tire', [0.34, 0.9, 0.34], [0.78, 0.6, -1.5]),
      ],
    }),
  }),
  { radius: 0.33, width: 0.19, trackHalf: 0.66, axles: [-1.2, 1.2] },
)

const MODEL_1945_PANEL_VAN = withWheels(
  defineModel({
    key: 'panel-van-1940s',
    label: '1940s panel delivery van',
    class: 'van',
    power: 'combustion',
    silhouette: 'utility',
    tags: ['delivery-truck', 'panel-van'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.8,
      width: 1.9,
      ride: 0.36,
      bodyHeight: 1.6,
      cabinHeight: 0,
      cabinLength: 0,
      cabinZ: 0,
      wheels: { radius: 0.36, width: 0.22, trackHalf: 0.72, axles: [-1.5, 1.5] },
      glazed: false,
      lampHeightRatio: 0.42,
      extras: [
        box('windscreen', 'glass', [1.5, 0.5, 0.06], [0, 1.62, 2.3]),
        box('load-door-left', 'trim', [0.06, 1, 1.2], [-0.95, 0.95, -1.1]),
        box('load-door-right', 'trim', [0.06, 1, 1.2], [0.95, 0.95, -1.1]),
        box('sign-panel', 'sign', [1.4, 0.5, 0.05], [0, 1.2, -2.41]),
      ],
    }),
  }),
  { radius: 0.36, width: 0.22, trackHalf: 0.72, axles: [-1.5, 1.5] },
)

const MODEL_1945_TRUCK = withWheels(
  defineModel({
    key: 'army-surplus-truck',
    label: 'Surplus flatbed truck',
    class: 'truck',
    power: 'combustion',
    silhouette: 'utility',
    tags: ['work-truck', 'flatbed'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: [
      ...carParts({
        length: 3.2,
        width: 1.9,
        ride: 0.42,
        bodyHeight: 1.1,
        cabinHeight: 0.7,
        cabinLength: 1.4,
        cabinZ: 0.6,
        wheels: { radius: 0.4, width: 0.24, trackHalf: 0.74, axles: [-1.4, 1.2] },
        glazed: false,
        lampHeightRatio: 0.5,
        extras: [box('windscreen', 'glass', [1.5, 0.5, 0.06], [0, 1.5, 1.58])],
      }),
      box('flatbed', 'trim', [2, 0.14, 3.4], [0, 0.95, -2.1]),
      box('bed-side-left', 'paint', [0.1, 0.6, 3.4], [-0.95, 1.3, -2.1]),
      box('bed-side-right', 'paint', [0.1, 0.6, 3.4], [0.95, 1.3, -2.1]),
      box('bed-tail', 'paint', [2, 0.6, 0.1], [0, 1.3, -3.75]),
    ],
  }),
  { radius: 0.4, width: 0.24, trackHalf: 0.74, axles: [-1.4, 1.2] },
)

const MODEL_1945_TRAM = withWheels(
  defineModel({
    key: 'tram-car-1930s',
    label: '1930s streetcar',
    class: 'streetcar',
    power: 'electric',
    silhouette: 'transit',
    tags: ['streetcar', 'transit', 'railed'],
    parks: false,
    lamps: { head: 1, tail: 2, indicators: false, roofBeacon: false },
    parts: transitParts({
      length: 12.4,
      width: 2.4,
      ride: 0.5,
      bodyHeight: 2.5,
      wheels: { radius: 0.42, width: 0.16, trackHalf: 0.7, axles: [-4, -3.2, 3.2, 4] },
      windowBandY: 1.5,
      windowBandHeight: 0.85,
      destinationSign: true,
      overheadPole: true,
      extras: [
        box('rail-skirt-left', 'trim', [0.12, 0.3, 12.2], [-0.7, 0.42, 0]),
        box('rail-skirt-right', 'trim', [0.12, 0.3, 12.2], [0.7, 0.42, 0]),
      ],
    }),
  }),
  { radius: 0.42, width: 0.16, trackHalf: 0.7, axles: [-4, -3.2, 3.2, 4] },
)

/** 1965: long, low, tailfinned and chromed. */
const MODEL_1965_TAILFIN = withWheels(
  defineModel({
    key: 'tailfin-sedan-1960s',
    label: 'Tailfin sedan',
    class: 'car',
    power: 'combustion',
    silhouette: 'tailfin',
    tags: ['sedan', 'tailfin', 'chrome'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 5.5,
      width: 2.0,
      ride: 0.28,
      bodyHeight: 0.82,
      cabinHeight: 0.6,
      cabinLength: 2.1,
      cabinZ: -0.3,
      wheels: { radius: 0.36, width: 0.22, trackHalf: 0.74, axles: [-1.6, 1.6] },
      roof: true,
      lampHeightRatio: 0.55,
      extras: [
        box('fin-left', 'paint', [0.14, 0.42, 1.5], [-0.92, 1.18, -2.1]),
        box('fin-right', 'paint', [0.14, 0.42, 1.5], [0.92, 1.18, -2.1]),
        box('chrome-trim', 'metal', [2.02, 0.08, 5.4], [0, 0.72, 0]),
      ],
    }),
  }),
  { radius: 0.36, width: 0.22, trackHalf: 0.74, axles: [-1.6, 1.6] },
)

const MODEL_1965_MUSCLE = withWheels(
  defineModel({
    key: 'muscle-coupe-1965',
    label: 'Muscle coupe',
    class: 'car',
    power: 'combustion',
    silhouette: 'tailfin',
    tags: ['muscle-car', 'coupe', 'fast'],
    extraSfx: ['tire-squeal'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.9,
      width: 2.05,
      ride: 0.26,
      bodyHeight: 0.8,
      cabinHeight: 0.52,
      cabinLength: 1.7,
      cabinZ: -0.55,
      wheels: { radius: 0.37, width: 0.26, trackHalf: 0.8, axles: [-1.42, 1.42] },
      lampHeightRatio: 0.52,
      extras: [
        box('hood-scoop', 'paint', [0.9, 0.16, 0.9], [0, 1.14, 1.4]),
        box('stripe-left', 'sign', [0.18, 0.06, 4.6], [-0.6, 1.1, 0]),
        box('stripe-right', 'sign', [0.18, 0.06, 4.6], [0.6, 1.1, 0]),
      ],
    }),
  }),
  { radius: 0.37, width: 0.26, trackHalf: 0.8, axles: [-1.42, 1.42] },
)

const MODEL_1965_WAGON = withWheels(
  defineModel({
    key: 'station-wagon-1965',
    label: 'Station wagon',
    class: 'car',
    power: 'combustion',
    silhouette: 'tailfin',
    tags: ['station-wagon', 'family-car'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 5.4,
      width: 2.0,
      ride: 0.3,
      bodyHeight: 0.88,
      cabinHeight: 0.72,
      cabinLength: 3.4,
      cabinZ: -0.9,
      wheels: { radius: 0.37, width: 0.22, trackHalf: 0.74, axles: [-1.7, 1.7] },
      roof: true,
      lampHeightRatio: 0.5,
      extras: [box('roof-rack', 'trim', [1.4, 0.1, 2.4], [0, 1.95, -0.9])],
    }),
  }),
  { radius: 0.37, width: 0.22, trackHalf: 0.74, axles: [-1.7, 1.7] },
)

const MODEL_1965_BUS = withWheels(
  defineModel({
    key: 'city-bus-1960s',
    label: '1960s city bus',
    class: 'bus',
    power: 'combustion',
    silhouette: 'transit',
    tags: ['bus', 'transit'],
    parks: false,
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: transitParts({
      length: 10.8,
      width: 2.5,
      ride: 0.48,
      bodyHeight: 2.4,
      wheels: { radius: 0.46, width: 0.26, trackHalf: 0.84, axles: [-3.4, 3.2] },
      windowBandY: 1.5,
      windowBandHeight: 0.8,
      destinationSign: true,
      overheadPole: false,
      extras: [box('livery-band', 'sign', [2.52, 0.3, 10.6], [0, 1.1, 0])],
    }),
  }),
  { radius: 0.46, width: 0.26, trackHalf: 0.84, axles: [-3.4, 3.2] },
)

const MODEL_1965_VAN = withWheels(
  defineModel({
    key: 'delivery-van-1960s',
    label: '1960s delivery van',
    class: 'van',
    power: 'combustion',
    silhouette: 'boxy',
    tags: ['delivery-van', 'round-nose'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: [
      ...carParts({
        length: 4.6,
        width: 1.95,
        ride: 0.36,
        bodyHeight: 1.75,
        cabinHeight: 0,
        cabinLength: 0,
        cabinZ: 0,
        wheels: { radius: 0.36, width: 0.22, trackHalf: 0.74, axles: [-1.4, 1.4] },
        glazed: false,
        lampHeightRatio: 0.36,
        extras: [
          box('windscreen', 'glass', [1.6, 0.55, 0.06], [0, 1.6, 2.28]),
          box('sign-panel', 'sign', [1.5, 0.6, 0.05], [0, 1.25, -2.31]),
        ],
      }),
    ],
  }),
  { radius: 0.36, width: 0.22, trackHalf: 0.74, axles: [-1.4, 1.4] },
)

const MODEL_1965_SCOOTER = withWheels(
  defineModel({
    key: 'motor-scooter-1960s',
    label: 'Motor scooter',
    class: 'micro',
    power: 'combustion',
    silhouette: 'micro',
    tags: ['scooter', 'micro-mobility'],
    parks: false,
    lamps: { head: 1, tail: 1, indicators: false, roofBeacon: false },
    parts: scooterParts({ deckLength: 1.2, wheelRadius: 0.24, motorised: true, paint: true }),
  }),
  { radius: 0.24, width: 0.1, trackHalf: 0.18, axles: [-0.64, 0.64] },
)

/** 1985: boxy, angular and aerodynamic only by accident. */
const MODEL_1985_HATCH = withWheels(
  defineModel({
    key: 'hatchback-1980s',
    label: '1980s hatchback',
    class: 'car',
    power: 'combustion',
    silhouette: 'boxy',
    tags: ['economy-car', 'hatchback', 'boxy'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.0,
      width: 1.72,
      ride: 0.3,
      bodyHeight: 0.84,
      cabinHeight: 0.66,
      cabinLength: 1.9,
      cabinZ: -0.42,
      wheels: { radius: 0.31, width: 0.2, trackHalf: 0.64, axles: [-1.2, 1.2] },
      roof: true,
      lampHeightRatio: 0.62,
      extras: [box('bumper-plastic', 'trim', [1.76, 0.2, 0.16], [0, 0.4, -2.02])],
    }),
  }),
  { radius: 0.31, width: 0.2, trackHalf: 0.64, axles: [-1.2, 1.2] },
)

const MODEL_1985_VAN = withWheels(
  defineModel({
    key: 'panel-van-1985',
    label: '1985 boxy van',
    class: 'van',
    power: 'combustion',
    silhouette: 'boxy',
    tags: ['van', 'boxy-van', 'delivery'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.9,
      width: 2.0,
      ride: 0.36,
      bodyHeight: 2.0,
      cabinHeight: 0,
      cabinLength: 0,
      cabinZ: 0,
      wheels: { radius: 0.34, width: 0.22, trackHalf: 0.78, axles: [-1.5, 1.5] },
      glazed: false,
      lampHeightRatio: 0.32,
      extras: [
        box('windscreen', 'glass', [1.7, 0.55, 0.06], [0, 1.85, 2.43]),
        box('side-window', 'glass', [0.06, 0.45, 1.1], [1.0, 1.8, 1.4]),
        box('sign-panel', 'sign', [1.6, 0.7, 0.05], [0, 1.4, -2.46]),
      ],
    }),
  }),
  { radius: 0.34, width: 0.22, trackHalf: 0.78, axles: [-1.5, 1.5] },
)

const MODEL_1985_BOX_TRUCK = withWheels(
  defineModel({
    key: 'box-truck-1980s',
    label: '1980s box truck',
    class: 'truck',
    power: 'combustion',
    silhouette: 'utility',
    tags: ['box-truck', 'delivery'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: [
      ...carParts({
        length: 2.6,
        width: 2.05,
        ride: 0.5,
        bodyHeight: 1.15,
        cabinHeight: 0.7,
        cabinLength: 1.5,
        cabinZ: 0.5,
        wheels: { radius: 0.42, width: 0.26, trackHalf: 0.8, axles: [-1.55, 1.0] },
        glazed: false,
        lampHeightRatio: 0.42,
        extras: [box('windscreen', 'glass', [1.7, 0.6, 0.06], [0, 1.62, 1.29])],
      }),
      box('cargo-box', 'paint', [2.2, 2.2, 4.1], [0, 1.85, -2.05]),
      box('cargo-ribs', 'trim', [2.24, 2.2, 0.1], [0, 1.85, -3.6]),
      box('mudflap-left', 'trim', [0.05, 0.4, 0.5], [-0.85, 0.25, -3.9]),
      box('mudflap-right', 'trim', [0.05, 0.4, 0.5], [0.85, 0.25, -3.9]),
    ],
  }),
  { radius: 0.42, width: 0.26, trackHalf: 0.8, axles: [-1.55, 1.0] },
)

const MODEL_1985_TAXI = withWheels(
  defineModel({
    key: 'checker-taxi-1985',
    label: '1985 taxi',
    class: 'taxi',
    power: 'combustion',
    silhouette: 'boxy',
    tags: ['taxi', 'roof-sign'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: true },
    parts: carParts({
      length: 4.9,
      width: 1.9,
      ride: 0.3,
      bodyHeight: 0.95,
      cabinHeight: 0.7,
      cabinLength: 2.4,
      cabinZ: -0.4,
      wheels: { radius: 0.34, width: 0.22, trackHalf: 0.7, axles: [-1.5, 1.5] },
      roof: true,
      lampHeightRatio: 0.6,
      extras: [box('roof-sign', 'sign', [0.9, 0.22, 0.34], [0, 1.86, -0.3])],
    }),
  }),
  { radius: 0.34, width: 0.22, trackHalf: 0.7, axles: [-1.5, 1.5] },
)

const MODEL_1985_POLICE = withWheels(
  defineModel({
    key: 'police-cruiser-1985',
    label: '1985 police cruiser',
    class: 'police',
    power: 'combustion',
    silhouette: 'boxy',
    tags: ['police', 'cruiser', 'emergency'],
    extraSfx: ['tire-squeal'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: true },
    parts: carParts({
      length: 5.1,
      width: 1.94,
      ride: 0.3,
      bodyHeight: 0.92,
      cabinHeight: 0.66,
      cabinLength: 2.3,
      cabinZ: -0.42,
      wheels: { radius: 0.35, width: 0.24, trackHalf: 0.72, axles: [-1.55, 1.55] },
      roof: true,
      lampHeightRatio: 0.58,
      extras: [
        box('light-bar', 'glow', [1.3, 0.16, 0.3], [0, 1.72, -0.2]),
        box('door-panel-left', 'sign', [0.06, 0.5, 1.6], [-0.98, 0.9, -0.3]),
        box('door-panel-right', 'sign', [0.06, 0.5, 1.6], [0.98, 0.9, -0.3]),
      ],
    }),
  }),
  { radius: 0.35, width: 0.24, trackHalf: 0.72, axles: [-1.55, 1.55] },
)

const MODEL_1985_BMX = withWheels(
  defineModel({
    key: 'bmx-bike-1985',
    label: '1985 BMX bike',
    class: 'micro',
    power: 'human',
    silhouette: 'micro',
    tags: ['bike', 'bmx', 'micro-mobility'],
    parks: false,
    lamps: { head: 1, tail: 1, indicators: false, roofBeacon: false },
    parts: bicycleParts({ wheelbase: 1.05, wheelRadius: 0.3, cargoBox: false, electric: false, paint: true }),
  }),
  { radius: 0.3, width: 0.05, trackHalf: 0, axles: [-0.53, 0.53] },
)

/** 2005: smoother, taller, more glass. */
const MODEL_2005_COMPACT = withWheels(
  defineModel({
    key: 'compact-sedan-2000s',
    label: '2000s compact sedan',
    class: 'car',
    power: 'combustion',
    silhouette: 'aero',
    tags: ['compact', 'sedan'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.4,
      width: 1.8,
      ride: 0.26,
      bodyHeight: 0.86,
      cabinHeight: 0.62,
      cabinLength: 2.0,
      cabinZ: -0.2,
      wheels: { radius: 0.32, width: 0.22, trackHalf: 0.68, axles: [-1.3, 1.3] },
      lampHeightRatio: 0.66,
      extras: [box('clear-lens', 'headlamp', [1.5, 0.14, 0.05], [0, 0.9, 2.21])],
    }),
  }),
  { radius: 0.32, width: 0.22, trackHalf: 0.68, axles: [-1.3, 1.3] },
)

const MODEL_2005_SUV = withWheels(
  defineModel({
    key: 'suv-2000s',
    label: '2000s SUV',
    class: 'car',
    power: 'combustion',
    silhouette: 'boxy',
    tags: ['suv', 'tall'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.9,
      width: 2.0,
      ride: 0.42,
      bodyHeight: 1.1,
      cabinHeight: 0.76,
      cabinLength: 2.7,
      cabinZ: -0.5,
      wheels: { radius: 0.4, width: 0.26, trackHalf: 0.78, axles: [-1.5, 1.5] },
      roof: true,
      lampHeightRatio: 0.68,
      extras: [
        box('roof-rail-left', 'trim', [0.08, 0.08, 2.3], [-0.6, 2.32, -0.5]),
        box('roof-rail-right', 'trim', [0.08, 0.08, 2.3], [0.6, 2.32, -0.5]),
      ],
    }),
  }),
  { radius: 0.4, width: 0.26, trackHalf: 0.78, axles: [-1.5, 1.5] },
)

const MODEL_2005_MINIVAN = withWheels(
  defineModel({
    key: 'minivan-2005',
    label: '2005 minivan',
    class: 'car',
    power: 'combustion',
    silhouette: 'aero',
    tags: ['minivan', 'family-car', 'sliding-door'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 5.0,
      width: 1.98,
      ride: 0.34,
      bodyHeight: 1.2,
      cabinHeight: 0.8,
      cabinLength: 3.3,
      cabinZ: -0.7,
      wheels: { radius: 0.37, width: 0.24, trackHalf: 0.76, axles: [-1.55, 1.55] },
      roof: true,
      lampHeightRatio: 0.6,
      extras: [box('sliding-door-left', 'trim', [0.06, 1.1, 1.5], [-1.0, 1.1, -0.9])],
    }),
  }),
  { radius: 0.37, width: 0.24, trackHalf: 0.76, axles: [-1.55, 1.55] },
)

const MODEL_2005_TAXI = withWheels(
  defineModel({
    key: 'taxi-sedan-2005',
    label: '2005 taxi',
    class: 'taxi',
    power: 'combustion',
    silhouette: 'aero',
    tags: ['taxi', 'roof-sign', 'livery'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: true },
    parts: carParts({
      length: 4.7,
      width: 1.86,
      ride: 0.28,
      bodyHeight: 0.92,
      cabinHeight: 0.68,
      cabinLength: 2.4,
      cabinZ: -0.25,
      wheels: { radius: 0.34, width: 0.23, trackHalf: 0.7, axles: [-1.42, 1.42] },
      roof: true,
      lampHeightRatio: 0.64,
      extras: [
        box('roof-sign', 'sign', [0.8, 0.2, 0.3], [0, 1.9, -0.25]),
        box('door-livery-left', 'sign', [0.06, 0.42, 1.4], [-0.94, 0.9, -0.2]),
        box('door-livery-right', 'sign', [0.06, 0.42, 1.4], [0.94, 0.9, -0.2]),
      ],
    }),
  }),
  { radius: 0.34, width: 0.23, trackHalf: 0.7, axles: [-1.42, 1.42] },
)

const MODEL_2005_SPRINTER = withWheels(
  defineModel({
    key: 'sprinter-van-2000s',
    label: '2000s high-roof van',
    class: 'van',
    power: 'combustion',
    silhouette: 'aero',
    tags: ['van', 'high-roof', 'parcel'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 5.9,
      width: 2.1,
      ride: 0.4,
      bodyHeight: 2.4,
      cabinHeight: 0,
      cabinLength: 0,
      cabinZ: 0,
      wheels: { radius: 0.38, width: 0.24, trackHalf: 0.82, axles: [-1.7, 1.8] },
      glazed: false,
      lampHeightRatio: 0.28,
      extras: [
        box('windscreen', 'glass', [1.8, 0.7, 0.07], [0, 2.15, 2.93]),
        box('side-window', 'glass', [0.07, 0.5, 1.0], [1.05, 2.1, 2.0]),
        box('parcel-panel', 'sign', [1.8, 1.4, 0.05], [0, 1.5, -2.96]),
      ],
    }),
  }),
  { radius: 0.38, width: 0.24, trackHalf: 0.82, axles: [-1.7, 1.8] },
)

const MODEL_2005_BUS = withWheels(
  defineModel({
    key: 'city-bus-2000s',
    label: '2000s city bus',
    class: 'bus',
    power: 'combustion',
    silhouette: 'transit',
    tags: ['bus', 'transit', 'low-floor'],
    parks: false,
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: transitParts({
      length: 11.4,
      width: 2.55,
      ride: 0.42,
      bodyHeight: 2.5,
      wheels: { radius: 0.47, width: 0.28, trackHalf: 0.86, axles: [-3.6, 3.4] },
      windowBandY: 1.6,
      windowBandHeight: 0.9,
      destinationSign: true,
      overheadPole: false,
      extras: [box('livery-band', 'sign', [2.57, 0.35, 11.2], [0, 1.05, 0])],
    }),
  }),
  { radius: 0.47, width: 0.28, trackHalf: 0.86, axles: [-3.6, 3.4] },
)

const MODEL_2005_COURIER_BIKE = withWheels(
  defineModel({
    key: 'courier-bike-2000s',
    label: '2000s courier bike',
    class: 'micro',
    power: 'human',
    silhouette: 'micro',
    tags: ['bike', 'courier', 'micro-mobility'],
    parks: false,
    lamps: { head: 1, tail: 1, indicators: false, roofBeacon: false },
    parts: bicycleParts({ wheelbase: 1.08, wheelRadius: 0.34, cargoBox: true, electric: false, paint: true }),
  }),
  { radius: 0.34, width: 0.05, trackHalf: 0, axles: [-0.54, 0.54] },
)

/** 2025: electric, smooth, sensor-laden. */
const MODEL_2025_CROSSOVER = withWheels(
  defineModel({
    key: 'electric-crossover',
    label: 'Electric crossover',
    class: 'car',
    power: 'electric',
    silhouette: 'aero',
    tags: ['electric', 'crossover', 'quiet'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 4.7,
      width: 1.95,
      ride: 0.3,
      bodyHeight: 0.95,
      cabinHeight: 0.7,
      cabinLength: 2.6,
      cabinZ: -0.3,
      wheels: { radius: 0.36, width: 0.24, trackHalf: 0.76, axles: [-1.45, 1.45] },
      roof: true,
      lampHeightRatio: 0.66,
      extras: [
        box('charge-port', 'metal', [0.22, 0.22, 0.1], [-0.9, 0.95, -1.6]),
        box('light-bar', 'headlamp', [1.7, 0.09, 0.06], [0, 0.92, 2.36]),
        box('radar-pod', 'metal', [0.3, 0.12, 0.2], [0, 1.98, 0.9]),
      ],
    }),
  }),
  { radius: 0.36, width: 0.24, trackHalf: 0.76, axles: [-1.45, 1.45] },
)

const MODEL_2025_VAN = withWheels(
  defineModel({
    key: 'delivery-van-2025',
    label: '2025 electric delivery van',
    class: 'van',
    power: 'electric',
    silhouette: 'aero',
    tags: ['electric-van', 'delivery', 'quiet'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: carParts({
      length: 5.6,
      width: 2.05,
      ride: 0.36,
      bodyHeight: 2.3,
      cabinHeight: 0,
      cabinLength: 0,
      cabinZ: 0,
      wheels: { radius: 0.38, width: 0.25, trackHalf: 0.8, axles: [-1.65, 1.7] },
      glazed: false,
      lampHeightRatio: 0.3,
      extras: [
        box('windscreen', 'glass', [1.8, 0.6, 0.07], [0, 2.05, 2.76]),
        box('sensor-pod', 'metal', [0.5, 0.16, 0.3], [0, 2.5, 2.4]),
        box('livery-panel', 'sign', [1.8, 1.2, 0.05], [0, 1.4, -2.81]),
      ],
    }),
  }),
  { radius: 0.38, width: 0.25, trackHalf: 0.8, axles: [-1.65, 1.7] },
)

const MODEL_2025_ROBOTAXI = withWheels(
  defineModel({
    key: 'robotaxi-pod',
    label: 'Robotaxi pod',
    class: 'car',
    power: 'electric',
    silhouette: 'pod',
    tags: ['robotaxi', 'autonomous', 'electric'],
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: true },
    parts: [
      box('body', 'paint', [1.9, 0.9, 4.2], [0, 0.75, 0]),
      sphere('canopy', 'glass', 1.0, [0, 1.42, -0.1]),
      box('skirt-front', 'trim', [1.88, 0.24, 0.22], [0, 0.4, 2.1]),
      box('skirt-rear', 'trim', [1.88, 0.24, 0.22], [0, 0.4, -2.1]),
      ...axleWheels({ radius: 0.34, width: 0.24, trackHalf: 0.74, axles: [-1.35, 1.35] }),
      ...lampPair('headlamp', 'headlamp', LAMP_SIZES.head, 0.75, 2.11, 0.62),
      ...lampPair('taillamp', 'taillamp', LAMP_SIZES.tail, 0.75, -2.11, 0.62),
      ...lampPair('indicator', 'glow', LAMP_SIZES.indicator, 0.55, 2.08, 0.86),
      cylinder('lidar', 'metal', 0.06, 0.35, [0, 2.4, -0.1]),
      sphere('lidar-head', 'headlamp', 0.11, [0, 2.6, -0.1]),
      box('roof-sign', 'sign', [0.7, 0.16, 0.4], [0, 2.1, 0.9]),
    ],
  }),
  { radius: 0.34, width: 0.24, trackHalf: 0.74, axles: [-1.35, 1.35] },
)

const MODEL_2025_BUS = withWheels(
  defineModel({
    key: 'electric-city-bus',
    label: '2025 electric city bus',
    class: 'bus',
    power: 'electric',
    silhouette: 'transit',
    tags: ['bus', 'transit', 'electric-bus', 'quiet'],
    parks: false,
    lamps: { head: 2, tail: 2, indicators: true, roofBeacon: false },
    parts: transitParts({
      length: 11.8,
      width: 2.55,
      ride: 0.4,
      bodyHeight: 2.6,
      wheels: { radius: 0.46, width: 0.28, trackHalf: 0.86, axles: [-3.7, 3.5] },
      windowBandY: 1.7,
      windowBandHeight: 1.05,
      destinationSign: true,
      overheadPole: false,
      extras: [
        box('battery-pack', 'metal', [2.3, 0.3, 6.0], [0, 2.75, 0]),
        box('livery-band', 'sign', [2.57, 0.4, 11.6], [0, 1.0, 0]),
        box('charge-port', 'metal', [0.2, 0.2, 0.12], [-1.24, 1.4, -4.2]),
      ],
    }),
  }),
  { radius: 0.46, width: 0.28, trackHalf: 0.86, axles: [-3.7, 3.5] },
)

const MODEL_2025_CARGO_BIKE = withWheels(
  defineModel({
    key: 'cargo-e-bike',
    label: 'Cargo e-bike',
    class: 'micro',
    power: 'electric',
    silhouette: 'micro',
    tags: ['bike', 'cargo-bike', 'electric', 'micro-mobility'],
    parks: false,
    lamps: { head: 1, tail: 1, indicators: false, roofBeacon: false },
    parts: bicycleParts({ wheelbase: 1.3, wheelRadius: 0.32, cargoBox: true, electric: true, paint: true }),
  }),
  { radius: 0.32, width: 0.05, trackHalf: 0, axles: [-0.65, 0.65] },
)

const MODEL_2025_SCOOTER = withWheels(
  defineModel({
    key: 'e-scooter-2025',
    label: 'Shared e-scooter',
    class: 'micro',
    power: 'electric',
    silhouette: 'micro',
    tags: ['scooter', 'shared', 'electric', 'micro-mobility'],
    parks: false,
    lamps: { head: 1, tail: 1, indicators: false, roofBeacon: false },
    parts: scooterParts({ deckLength: 0.9, wheelRadius: 0.14, motorised: false, paint: false }),
  }),
  { radius: 0.14, width: 0.08, trackHalf: 0.12, axles: [-0.57, 0.57] },
)

const MODEL_2025_ROBOT = withWheels(
  defineModel({
    key: 'delivery-robot-2025',
    label: 'Sidewalk delivery robot',
    class: 'micro',
    power: 'electric',
    silhouette: 'pod',
    tags: ['delivery-robot', 'autonomous', 'electric', 'micro-mobility'],
    parks: false,
    lamps: { head: 1, tail: 1, indicators: false, roofBeacon: true },
    parts: robotParts({ length: 0.85, width: 0.62, bodyHeight: 0.7, wheelRadius: 0.12 }),
  }),
  { radius: 0.12, width: 0.08, trackHalf: 0.31, axles: [-0.27, 0.27] },
)

/** Every model of the catalogue, keyed by its stable key. */
export const VEHICLE_MODELS: Readonly<Record<string, VehicleModelSpec>> = modelList([
  MODEL_1945_SEDAN,
  MODEL_1945_COUPE,
  MODEL_1945_PANEL_VAN,
  MODEL_1945_TRUCK,
  MODEL_1945_TRAM,
  MODEL_1965_TAILFIN,
  MODEL_1965_MUSCLE,
  MODEL_1965_WAGON,
  MODEL_1965_BUS,
  MODEL_1965_VAN,
  MODEL_1965_SCOOTER,
  MODEL_1985_HATCH,
  MODEL_1985_VAN,
  MODEL_1985_BOX_TRUCK,
  MODEL_1985_TAXI,
  MODEL_1985_POLICE,
  MODEL_1985_BMX,
  MODEL_2005_COMPACT,
  MODEL_2005_SUV,
  MODEL_2005_MINIVAN,
  MODEL_2005_TAXI,
  MODEL_2005_SPRINTER,
  MODEL_2005_BUS,
  MODEL_2005_COURIER_BIKE,
  MODEL_2025_CROSSOVER,
  MODEL_2025_VAN,
  MODEL_2025_ROBOTAXI,
  MODEL_2025_BUS,
  MODEL_2025_CARGO_BIKE,
  MODEL_2025_SCOOTER,
  MODEL_2025_ROBOT,
])

/** Catalogue keys in definition order. */
export const VEHICLE_MODEL_KEYS: readonly string[] = Object.keys(VEHICLE_MODELS)

/** The catalogue entry for a key, or a descriptive error. */
export function requireVehicleModel(key: string): VehicleModelSpec {
  const model = VEHICLE_MODELS[key]
  if (model === undefined) {
    throw new RangeError(`Unknown vehicle model ${key}`)
  }
  return model
}

/* ------------------------------------------------------------------------- *\
 * SFX cadence
 * ------------------------------------------------------------------------- */

/** Seconds of scene time one horn expectation is derived from. */
export const HORN_CADENCE_BASE_SEC = 6

/** Narrowest and widest horn cadence a table may declare, in seconds. */
export const HORN_CADENCE_LIMITS = { min: 12, max: 180 } as const

/**
 * Horn cadence of the era, derived from the era registry's horn probability so
 * the sounding behaviour stays one edit of the era data: a congested era with a
 * high probability recomputes to a tight cadence, a quiet one to a sparse one.
 */
export function hornIntervalFor(traffic: EraTraffic): number {
  const probability = Math.max(traffic.hornProbability, 0.02)
  const raw = HORN_CADENCE_BASE_SEC / probability
  const clamped = Math.min(HORN_CADENCE_LIMITS.max, Math.max(HORN_CADENCE_LIMITS.min, raw))
  return Math.round(clamped * 10) / 10
}

interface SfxProfileOptions {
  readonly engineIntervalSec: number
  readonly transitBellIntervalSec: number | null
  readonly evWhineIntervalSec: number | null
  readonly tireSquealIntervalSec: number | null
  readonly minIntervalSec: number
}

function sfxProfile(traffic: EraTraffic, options: SfxProfileOptions): SfxProfile {
  const hornIntervalSec = hornIntervalFor(traffic)
  return {
    hornIntervalSec,
    engineIntervalSec: options.engineIntervalSec,
    transitBellIntervalSec: options.transitBellIntervalSec,
    evWhineIntervalSec: options.evWhineIntervalSec,
    tireSquealIntervalSec: options.tireSquealIntervalSec,
    minIntervalSec: Math.max(0, options.minIntervalSec),
  }
}

/* ------------------------------------------------------------------------- *\
 * Era tables
 * ------------------------------------------------------------------------- */

type LaneSpecInput = Omit<LaneConfiguration, 'totalLanes'>

interface EraTableInput {
  readonly speedRangeMps: readonly [number, number]
  readonly lanes: LaneSpecInput
  readonly markings: EraMarkingSpec
  readonly sfx: SfxProfileOptions
  readonly fleet: readonly FleetEntrySpec[]
  readonly paints: readonly PaletteKey[]
  readonly microMobility: boolean
}

/** Lanes of one era, with the total derived the same way for every era. */
function laneConfiguration(lanes: LaneSpecInput): LaneConfiguration {
  return {
    ...lanes,
    totalLanes: lanes.travelLanesPerDirection * 2 + lanes.parkingLanes,
  }
}

function buildTable(eraId: EraId, input: EraTableInput): EraVehicleTable {
  const era = getEra(eraId)
  return {
    eraId,
    label: era.shortLabel,
    speedRangeMps: input.speedRangeMps,
    laneConfiguration: laneConfiguration(input.lanes),
    markings: input.markings,
    sfx: sfxProfile(era.traffic, input.sfx),
    fleet: input.fleet,
    paints: input.paints,
    microMobility: input.microMobility,
  }
}

function entry(modelKey: string, weight: number, paintKeys?: readonly PaletteKey[], role?: string): FleetEntrySpec {
  return paintKeys === undefined
    ? role === undefined
      ? { modelKey, weight }
      : { modelKey, weight, role }
    : role === undefined
      ? { modelKey, weight, paintKeys }
      : { modelKey, weight, paintKeys, role }
}

/**
 * The five era tables.
 *
 * Each census covers every model key the era registry demands, plus the
 * period extras the intent calls for (a streetcar and delivery truck in 1945,
 * station wagons in 1965, boxy vans and a taxi in 1985, minivans and taxis in
 * 2005, bikes, scooters and delivery robots in 2025).
 */
export const ERA_VEHICLE_TABLES: Readonly<Record<EraId, EraVehicleTable>> = {
  '1945': buildTable('1945', {
    speedRangeMps: [3.4, 7.2],
    lanes: {
      travelLanesPerDirection: 1,
      parkingLanes: 0,
      bikeLane: false,
      turnArrows: false,
      streetcarRails: true,
      chargingPointsPerStrip: 0,
      pedestrianPriority: false,
      laneWidthM: 3.2,
    },
    markings: { features: ['streetcar-rail'], paintOpacity: 0, railGaugeM: 1.435 },
    sfx: {
      engineIntervalSec: 95,
      transitBellIntervalSec: 26,
      evWhineIntervalSec: 70,
      tireSquealIntervalSec: null,
      minIntervalSec: 4,
    },
    fleet: [
      entry('sedan-1940s', 0.3),
      entry('coupe-1940s', 0.16),
      entry('panel-van-1940s', 0.22, undefined, 'delivery-truck'),
      entry('army-surplus-truck', 0.2, undefined, 'work-truck'),
      entry('tram-car-1930s', 0.12, undefined, 'streetcar'),
    ],
    paints: ['buildingBase', 'buildingAccent', 'storefrontBody', 'windowGlass', 'accent'],
    microMobility: false,
  }),
  '1965': buildTable('1965', {
    speedRangeMps: [6.4, 12.8],
    lanes: {
      travelLanesPerDirection: 1,
      parkingLanes: 2,
      bikeLane: false,
      turnArrows: false,
      streetcarRails: false,
      chargingPointsPerStrip: 0,
      pedestrianPriority: false,
      laneWidthM: 3.5,
    },
    markings: { features: ['centre-line', 'parking-lane'], paintOpacity: 1, railGaugeM: 1.435 },
    sfx: {
      engineIntervalSec: 42,
      transitBellIntervalSec: 55,
      evWhineIntervalSec: null,
      tireSquealIntervalSec: 90,
      minIntervalSec: 3,
    },
    fleet: [
      entry('tailfin-sedan-1960s', 0.26),
      entry('muscle-coupe-1965', 0.14, undefined, 'muscle-car'),
      entry('station-wagon-1965', 0.2, undefined, 'station-wagon'),
      entry('city-bus-1960s', 0.1, undefined, 'bus'),
      entry('delivery-van-1960s', 0.2, undefined, 'delivery-van'),
      entry('motor-scooter-1960s', 0.1, undefined, 'scooter'),
    ],
    paints: ['buildingAccent', 'storefrontBody', 'accent', 'facadeTrim', 'streetFurniture'],
    microMobility: true,
  }),
  '1985': buildTable('1985', {
    speedRangeMps: [7.2, 14.4],
    lanes: {
      travelLanesPerDirection: 2,
      parkingLanes: 0,
      bikeLane: false,
      turnArrows: true,
      streetcarRails: false,
      chargingPointsPerStrip: 0,
      pedestrianPriority: false,
      laneWidthM: 3.9,
    },
    markings: { features: ['centre-line', 'lane-division', 'turn-arrow'], paintOpacity: 1, railGaugeM: 1.435 },
    sfx: {
      engineIntervalSec: 34,
      transitBellIntervalSec: null,
      evWhineIntervalSec: null,
      tireSquealIntervalSec: 70,
      minIntervalSec: 2.5,
    },
    fleet: [
      entry('hatchback-1980s', 0.32, undefined, 'economy-car'),
      entry('panel-van-1985', 0.18, undefined, 'van'),
      entry('box-truck-1980s', 0.14, undefined, 'box-truck'),
      entry('checker-taxi-1985', 0.16, ['roadMarking'], 'taxi'),
      entry('police-cruiser-1985', 0.06, ['streetFurniture', 'facadeTrim'], 'police'),
      entry('bmx-bike-1985', 0.14, undefined, 'bike'),
    ],
    paints: ['buildingBase', 'buildingAccent', 'storefrontSign', 'accent', 'windowGlass'],
    microMobility: true,
  }),
  '2005': buildTable('2005', {
    speedRangeMps: [7.6, 15.6],
    lanes: {
      travelLanesPerDirection: 2,
      parkingLanes: 1,
      bikeLane: true,
      turnArrows: false,
      streetcarRails: false,
      chargingPointsPerStrip: 0,
      pedestrianPriority: false,
      laneWidthM: 3.5,
    },
    markings: {
      features: ['centre-line', 'lane-division', 'parking-lane', 'bike-lane'],
      paintOpacity: 1,
      railGaugeM: 1.435,
    },
    sfx: {
      engineIntervalSec: 30,
      transitBellIntervalSec: 48,
      evWhineIntervalSec: null,
      tireSquealIntervalSec: 120,
      minIntervalSec: 2.5,
    },
    fleet: [
      entry('compact-sedan-2000s', 0.22),
      entry('suv-2000s', 0.26, undefined, 'suv'),
      entry('minivan-2005', 0.16, undefined, 'minivan'),
      entry('taxi-sedan-2005', 0.12, ['accent', 'facadeTrim'], 'taxi'),
      entry('sprinter-van-2000s', 0.14, undefined, 'parcel-van'),
      entry('city-bus-2000s', 0.04, undefined, 'bus'),
      entry('courier-bike-2000s', 0.06, undefined, 'bike'),
    ],
    paints: ['buildingBase', 'buildingAccent', 'accent', 'streetFurniture', 'facadeTrim'],
    microMobility: true,
  }),
  '2025': buildTable('2025', {
    speedRangeMps: [6.2, 13.2],
    lanes: {
      travelLanesPerDirection: 2,
      parkingLanes: 0,
      bikeLane: true,
      turnArrows: false,
      streetcarRails: false,
      chargingPointsPerStrip: 6,
      pedestrianPriority: true,
      laneWidthM: 3.4,
    },
    markings: {
      features: ['centre-line', 'lane-division', 'bike-lane', 'charging-point', 'pedestrian-priority'],
      paintOpacity: 1,
      railGaugeM: 1.435,
    },
    sfx: {
      // The 2025 census is fully electric: no engine events exist to schedule.
      engineIntervalSec: 0,
      transitBellIntervalSec: 42,
      evWhineIntervalSec: 24,
      tireSquealIntervalSec: 150,
      minIntervalSec: 3,
    },
    fleet: [
      entry('electric-crossover', 0.3, undefined, 'electric-car'),
      entry('delivery-van-2025', 0.2, undefined, 'delivery-van'),
      entry('robotaxi-pod', 0.14, undefined, 'robotaxi'),
      entry('electric-city-bus', 0.08, undefined, 'bus'),
      entry('cargo-e-bike', 0.1, undefined, 'cargo-bike'),
      entry('e-scooter-2025', 0.12, undefined, 'scooter'),
      entry('delivery-robot-2025', 0.06, undefined, 'delivery-robot'),
    ],
    paints: ['facadeTrim', 'buildingBase', 'roadMarking', 'accent', 'storefrontBody'],
    microMobility: true,
  }),
}

/** Era id of every vehicle table, in registry order. */
export const ERA_TABLE_IDS: readonly EraId[] = ERA_IDS.filter(
  (eraId) => ERA_VEHICLE_TABLES[eraId] !== undefined,
)

/** The table of one era, or a descriptive error. */
export function requireEraVehicleTable(eraId: EraId): EraVehicleTable {
  const table = ERA_VEHICLE_TABLES[eraId]
  if (table === undefined) {
    throw new RangeError(`No vehicle table for era ${eraId}`)
  }
  return table
}

/** Model keys of an era census, in table order. */
export function censusOf(table: EraVehicleTable): string[] {
  return table.fleet.map((fleetEntry) => fleetEntry.modelKey)
}

/* ------------------------------------------------------------------------- *\
 * Table diagnostics
 * ------------------------------------------------------------------------- */

/**
 * Checks one table against the era registry and against itself.
 *
 * The unit suite requires an empty problem list for all five eras, which is how
 * the plan proves that the vehicle layer and the era registry describe the same
 * periods: lane counts, census coverage, palette keys, marking features and SFX
 * availability all have to line up.
 */
export function validateEraVehicleTable(table: EraVehicleTable): string[] {
  const problems: string[] = []
  const era = getEra(table.eraId)
  const traffic = era.traffic
  const lanes = table.laneConfiguration

  const derivedTotal = lanes.travelLanesPerDirection * 2 + lanes.parkingLanes
  if (lanes.totalLanes !== derivedTotal) {
    problems.push(
      `era ${table.eraId}: totalLanes ${lanes.totalLanes} does not match ${lanes.travelLanesPerDirection}×2 travel + ${lanes.parkingLanes} parking`,
    )
  }
  if (lanes.totalLanes !== traffic.laneCount) {
    problems.push(
      `era ${table.eraId}: totalLanes ${lanes.totalLanes} does not match the registry laneCount ${traffic.laneCount}`,
    )
  }
  if (lanes.bikeLane && !lanes.parkingLanes && table.markings.features.includes('parking-lane')) {
    problems.push(`era ${table.eraId}: parking-lane paint needs a marked parking lane`)
  }
  if (table.markings.features.length === 0) {
    problems.push(`era ${table.eraId}: an era must declare at least one marking feature`)
  }
  if (new Set(table.markings.features).size !== table.markings.features.length) {
    problems.push(`era ${table.eraId}: marking features repeat`)
  }
  if (table.markings.features.includes('bike-lane') && !lanes.bikeLane) {
    problems.push(`era ${table.eraId}: bike-lane markings need bikeLane`)
  }
  if (lanes.bikeLane && !table.markings.features.includes('bike-lane')) {
    problems.push(`era ${table.eraId}: bikeLane needs bike-lane markings`)
  }
  if (table.markings.features.includes('turn-arrow') && lanes.travelLanesPerDirection < 2) {
    problems.push(`era ${table.eraId}: turn arrows need at least two travel lanes per direction`)
  }
  if (table.markings.features.includes('streetcar-rail') !== lanes.streetcarRails) {
    problems.push(`era ${table.eraId}: streetcar rails must agree between lanes and markings`)
  }
  if (table.markings.features.includes('charging-point') && lanes.chargingPointsPerStrip <= 0) {
    problems.push(`era ${table.eraId}: charging-point markings need chargingPointsPerStrip`)
  }
  if (table.markings.features.includes('pedestrian-priority') && !lanes.pedestrianPriority) {
    problems.push(`era ${table.eraId}: pedestrian-priority markings need the flag`)
  }
  if (table.markings.paintOpacity < 0 || table.markings.paintOpacity > 1) {
    problems.push(`era ${table.eraId}: paintOpacity must be within 0..1`)
  }
  if (!table.markings.features.some((feature) => feature !== 'streetcar-rail') && table.markings.paintOpacity !== 0) {
    problems.push(`era ${table.eraId}: an era that paints no lane markings must have paintOpacity 0`)
  }
  if (table.markings.railGaugeM <= 0) {
    problems.push(`era ${table.eraId}: rail gauge must be positive`)
  }

  const speed = traffic.averageSpeedMps
  if (speed < table.speedRangeMps[0] || speed > table.speedRangeMps[1]) {
    problems.push(
      `era ${table.eraId}: cruising speed ${speed} m/s is outside [${table.speedRangeMps[0]}, ${table.speedRangeMps[1]}]`,
    )
  }

  const census = censusOf(table)
  if (new Set(census).size !== census.length) {
    problems.push(`era ${table.eraId}: census repeats a model`)
  }
  if (table.fleet.length < 4) {
    problems.push(`era ${table.eraId}: a census needs at least four models`)
  }
  if (table.fleet.some((fleetEntry) => !(fleetEntry.weight > 0))) {
    problems.push(`era ${table.eraId}: every census weight must be positive`)
  }
  for (const fleetEntry of table.fleet) {
    if (VEHICLE_MODELS[fleetEntry.modelKey] === undefined) {
      problems.push(`era ${table.eraId}: unknown model ${fleetEntry.modelKey}`)
    }
  }
  for (const required of traffic.modelKeys) {
    if (!census.includes(required)) {
      problems.push(`era ${table.eraId}: the registry requires model ${required}`)
    }
  }

  const hasMicro = table.fleet.some((fleetEntry) => VEHICLE_MODELS[fleetEntry.modelKey]?.micro === true)
  if (hasMicro !== table.microMobility) {
    problems.push(`era ${table.eraId}: microMobility ${table.microMobility} disagrees with the census`)
  }

  const palette = era.palette as unknown as Record<string, HexColor>
  for (const key of table.paints) {
    if (palette[key] === undefined) {
      problems.push(`era ${table.eraId}: unknown palette key ${key}`)
    }
  }
  for (const fleetEntry of table.fleet) {
    for (const key of fleetEntry.paintKeys ?? []) {
      if (palette[key] === undefined) {
        problems.push(`era ${table.eraId}: model ${fleetEntry.modelKey} uses unknown palette key ${key}`)
      }
    }
  }

  const availableSfx = new Set<SfxKind>()
  const combustionModels = census.filter((key) => VEHICLE_MODELS[key]?.power === 'combustion')
  for (const key of census) {
    for (const kind of VEHICLE_MODELS[key]?.sfxKinds ?? []) {
      availableSfx.add(kind)
    }
  }
  if (!(table.sfx.minIntervalSec > 0)) {
    problems.push(`era ${table.eraId}: the SFX floor must be positive`)
  }
  if (table.sfx.hornIntervalSec < table.sfx.minIntervalSec) {
    problems.push(`era ${table.eraId}: horn cadence is below the rate-limit floor`)
  }
  if (table.sfx.engineIntervalSec < 0) {
    problems.push(`era ${table.eraId}: engine cadence cannot be negative`)
  }
  if (table.sfx.engineIntervalSec > 0 && combustionModels.length === 0) {
    problems.push(`era ${table.eraId}: the table declares an engine cadence no combustion model can use`)
  }
  if (table.sfx.engineIntervalSec > 0 && table.sfx.engineIntervalSec < table.sfx.minIntervalSec) {
    problems.push(`era ${table.eraId}: engine cadence is below the rate-limit floor`)
  }
  if (availableSfx.has('transit-bell') && table.sfx.transitBellIntervalSec === null) {
    problems.push(`era ${table.eraId}: the census has a bell but the table never rings it`)
  }
  if (!availableSfx.has('transit-bell') && table.sfx.transitBellIntervalSec !== null) {
    problems.push(`era ${table.eraId}: the table rings a bell no model has`)
  }
  if (!availableSfx.has('ev-whine') && table.sfx.evWhineIntervalSec !== null) {
    problems.push(`era ${table.eraId}: the table whines but no model is electric`)
  }
  if (table.sfx.transitBellIntervalSec !== null && table.sfx.transitBellIntervalSec < table.sfx.minIntervalSec) {
    problems.push(`era ${table.eraId}: bell cadence is below the rate-limit floor`)
  }
  if (table.sfx.evWhineIntervalSec !== null && table.sfx.evWhineIntervalSec < table.sfx.minIntervalSec) {
    problems.push(`era ${table.eraId}: EV whine cadence is below the rate-limit floor`)
  }
  if (table.sfx.tireSquealIntervalSec !== null && table.sfx.tireSquealIntervalSec < table.sfx.minIntervalSec) {
    problems.push(`era ${table.eraId}: tire squeal cadence is below the rate-limit floor`)
  }

  return problems
}

/** Classes present in a census, for reporting and assertions. */
export function classesOf(table: EraVehicleTable): VehicleClass[] {
  const classes = new Set<VehicleClass>()
  for (const fleetEntry of table.fleet) {
    const model = VEHICLE_MODELS[fleetEntry.modelKey]
    if (model !== undefined) {
      classes.add(model.class)
    }
  }
  return VEHICLE_CLASSES.filter((vehicleClass) => classes.has(vehicleClass))
}
