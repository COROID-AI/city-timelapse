/**
 * Procedural vehicle style registry.
 *
 * The vehicles task renders era-appropriate silhouettes with placeholder
 * geometries (repo-wide plan scope: asset builders provide era identifiers,
 * the scene manager composes procedural unit parts; no external models).
 * Every `StyleDef` is pure data: proportions + part placements that get
 * instanced per vehicle. The mapping from `EraData.vehicles.types` strings
 * to style ids lives here so the per-era vehicle mix stays data-driven.
 *
 * Parts are expressed in local meters with the model facing +X and sitting
 * on Y=0. The renderer scales unit geometries per part, so one shared box /
 * cylinder / sphere geometry feeds every vehicle instance.
 */

import type { EraId } from '../../eras'
import { ERA_DATA } from '../../era-data'

export type StyleId =
  | 'vintage' // 1945 pre-war boxy sedan
  | 'panel' // 1945 panel truck
  | 'wagon' // 1945 delivery wagon
  | 'trolley' // 1945 trolleybus (overhead wire arm)
  | 'coupe' // 1965 chrome coupe
  | 'convertible' // 1965 classic convertible
  | 'scooter' // 1965 vintage scooter / 2025 e-scooter
  | 'truck' // 1965 delivery truck
  | 'boxySedan' // 1985 boxy sedan
  | 'muscle' // 1985 muscle car
  | 'van' // 1985 delivery van
  | 'taxi' // 1985 taxi / 2005 hybrid taxi
  | 'suv' // 2005 suv
  | 'minivan' // 2005 minivan
  | 'compact' // 2005 rounded compact
  | 'evSedan' // 2025 smooth EV sedan
  | 'bus' // 2025 electric bus (dedicated bus lane)
  | 'robot' // 2025 delivery robot (sidewalk courier)
  | 'bike' // 2025 cyclist (dedicated bike lane)

export interface BoxPart {
  kind: 'box'
  pos: [number, number, number]
  scale: [number, number, number]
}

export interface CylPart {
  kind: 'cyl'
  pos: [number, number, number]
  scale: [number, number, number]
}

export interface SpherePart {
  kind: 'sphere'
  pos: [number, number, number]
  scale: [number, number, number]
}

export type Part = BoxPart | CylPart | SpherePart

/** Wheel anchor as fractions of (length, width) from the model origin. */
export type WheelAnchor = [fx: number, fz: number]

export interface StyleDef {
  id: StyleId
  label: string
  body: Part[]
  cab: Part[]
  wheelR: number
  wheelW: number
  /** Wheel positions as fractions of length/width (x = fx*length, z = fz*width). */
  wheels: WheelAnchor[]
  chrome: Part[]
  headlights: Part[]
  tailLights: Part[]
  length: number
  width: number
}

function boxPart(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): BoxPart {
  return { kind: 'box', pos: [x, y, z], scale: [sx, sy, sz] }
}

function spherePart(
  x: number,
  y: number,
  z: number,
  s: number,
): SpherePart {
  return { kind: 'sphere', pos: [x, y, z], scale: [s, s, s] }
}

function car4Wheels(fx: number, fz: number): WheelAnchor[] {
  return [
    [-fx, fz],
    [fx, fz],
    [-fx, -fz],
    [fx, -fz],
  ]
}

function sixWheels(): WheelAnchor[] {
  return [
    [-0.33, 0.5],
    [0, 0.5],
    [0.33, 0.5],
    [-0.33, -0.5],
    [0, -0.5],
    [0.33, -0.5],
  ]
}

function lightPair(x: number, y: number, z: number, s: number): Part[] {
  return [spherePart(x, y, z, s), spherePart(x, y, -z, s)]
}

interface CarOpts {
  length: number
  width: number
  bodyH: number
  ride: number
  cabL: number
  cabH: number
  cabZ?: number
  /** Offset the cab along +X (vans/trucks put the cab near the nose). */
  cabShift?: number
  wheelR?: number
  wheelW?: number
  wheelFrac?: [number, number]
  chrome?: 'grille' | 'grille-rear' | 'none'
  roofSign?: boolean
  extraBody?: Part[]
  extraCab?: Part[]
}

function car(id: StyleId, label: string, opts: CarOpts): StyleDef {
  const L = opts.length
  const W = opts.width
  const ride = opts.ride
  const bodyH = opts.bodyH
  const cabZ = opts.cabZ ?? Math.max(0.2, W - 0.15)
  const cabShift = opts.cabShift ?? 0
  const wheelR = opts.wheelR ?? 0.3
  const wheelW = opts.wheelW ?? 0.22
  const [fx, fz] = opts.wheelFrac ?? [0.33, 0.4]
  const chrome =
    opts.chrome === 'grille' || opts.chrome === 'grille-rear'
      ? [boxPart(L / 2 + 0.06, ride + bodyH * 0.35, 0, 0.18, bodyH * 0.7, W * 0.92)]
      : []
  if (opts.chrome === 'grille-rear') {
    chrome.push(boxPart(-L / 2 - 0.06, ride + bodyH * 0.45, 0, 0.12, bodyH * 0.5, W * 0.75))
  }
  const cabH = opts.cabH
  const cab: Part[] = [boxPart(cabShift, ride + bodyH + cabH / 2, 0, opts.cabL, cabH, cabZ)]
  if (opts.roofSign) {
    cab.push(boxPart(cabShift, ride + bodyH + cabH + 0.15, 0, 0.55, 0.3, 0.9))
  }
  if (opts.extraCab) cab.push(...opts.extraCab)
  return {
    id,
    label,
    body: opts.extraBody ? [...opts.extraBody, boxPart(0, ride + bodyH / 2, 0, L, bodyH, W)] : [boxPart(0, ride + bodyH / 2, 0, L, bodyH, W)],
    cab,
    wheelR,
    wheelW,
    wheels: car4Wheels(fx, fz),
    chrome,
    headlights: lightPair(L / 2 + 0.06, ride + bodyH * 0.72, W * 0.32, 0.16),
    tailLights: lightPair(-L / 2 - 0.06, ride + bodyH * 0.6, W * 0.32, 0.13),
    length: L,
    width: W,
  }
}

export const STYLES: Record<StyleId, StyleDef> = {
  vintage: car('vintage', '1945 pre-war sedan', {
    length: 4.3, width: 1.85, bodyH: 0.95, ride: 0.42, cabL: 2.3, cabH: 0.78, chrome: 'grille',
  }),
  panel: car('panel', '1945 panel truck', {
    length: 4.7, width: 1.9, bodyH: 1.75, ride: 0.4, cabL: 1.5, cabH: 0.75, cabShift: 1.2, chrome: 'none', wheelR: 0.32,
  }),
  wagon: car('wagon', '1945 delivery wagon', {
    length: 3.7, width: 1.75, bodyH: 1.15, ride: 0.4, cabL: 2.6, cabH: 0.8, chrome: 'grille', wheelR: 0.28, wheelW: 0.2,
  }),
  trolley: {
    id: 'trolley',
    label: '1945 trolleybus',
    body: [boxPart(0, 0.5 + 1.05 / 2, 0, 9, 1.05, 2.4)],
    cab: [boxPart(0, 0.5 + 1.05 + 0.18 / 2, 0, 8.6, 0.18, 2.55)],
    wheelR: 0.36,
    wheelW: 0.2,
    wheels: sixWheels(),
    chrome: [boxPart(4.5, 1.7, 0, 0.1, 0.25, 0.06)],
    headlights: lightPair(4.5, 1.2, 1.0, 0.18),
    tailLights: lightPair(-4.5, 1.1, 1.0, 0.15),
    length: 9,
    width: 2.4,
  },
  coupe: car('coupe', '1965 chrome coupe', {
    length: 5.1, width: 2.0, bodyH: 0.9, ride: 0.4, cabL: 2.4, cabH: 0.62, chrome: 'grille-rear', wheelFrac: [0.34, 0.4],
  }),
  convertible: car('convertible', '1965 classic convertible', {
    length: 4.9, width: 1.95, bodyH: 0.75, ride: 0.42, cabL: 1.2, cabH: 0.5, cabShift: 0.1, chrome: 'grille',
  }),
  scooter: {
    id: 'scooter',
    label: 'two-wheeled scooter',
    body: [boxPart(0, 0.52, 0, 0.7, 0.4, 0.3)],
    cab: [boxPart(0.28, 1.0, 0, 0.9, 0.9, 0.08)],
    wheelR: 0.22,
    wheelW: 0.1,
    wheels: [
      [-0.42, 0.15],
      [0.46, 0.15],
    ],
    chrome: [],
    headlights: [spherePart(0.52, 0.6, 0, 0.1)],
    tailLights: [spherePart(-0.48, 0.5, 0, 0.08)],
    length: 1.5,
    width: 0.6,
  },
  truck: {
    id: 'truck',
    label: '1965 delivery truck',
    body: [boxPart(-0.5, 0.45 + 2.5 / 2, 0, 4.4, 2.5, 2.3)],
    cab: [boxPart(2.5, 0.45 + 1.2 / 2, 0, 1.8, 1.2, 2.25)],
    wheelR: 0.36,
    wheelW: 0.24,
    wheels: sixWheels(),
    chrome: [boxPart(3.35, 0.85, 0, 0.2, 0.6, 2.1)],
    headlights: lightPair(3.35, 1.35, 0.9, 0.16),
    tailLights: lightPair(-2.65, 0.85, 0.9, 0.14),
    length: 6.8,
    width: 2.3,
  },
  boxySedan: car('boxySedan', '1985 boxy sedan', {
    length: 4.5, width: 1.85, bodyH: 1.15, ride: 0.42, cabL: 2.6, cabH: 0.9, chrome: 'grille',
  }),
  muscle: car('muscle', '1985 muscle car', {
    length: 4.9, width: 2.0, bodyH: 0.95, ride: 0.4, cabL: 2.1, cabH: 0.55, chrome: 'grille-rear', wheelR: 0.32, wheelW: 0.26, wheelFrac: [0.33, 0.4],
  }),
  van: car('van', '1985 delivery van', {
    length: 4.9, width: 1.95, bodyH: 1.9, ride: 0.42, cabL: 1.6, cabH: 0.8, cabShift: 1.25, chrome: 'none', wheelR: 0.32,
  }),
  taxi: car('taxi', 'tall-yellow taxi with roof sign', {
    length: 4.5, width: 1.85, bodyH: 1.15, ride: 0.42, cabL: 2.6, cabH: 0.9, chrome: 'grille', roofSign: true,
  }),
  suv: car('suv', '2005 sport utility vehicle', {
    length: 4.9, width: 2.0, bodyH: 1.5, ride: 0.45, cabL: 3.2, cabH: 1.0, wheelR: 0.32, wheelW: 0.24,
  }),
  minivan: car('minivan', '2005 minivan', {
    length: 4.7, width: 1.95, bodyH: 1.7, ride: 0.42, cabL: 3.0, cabH: 0.95, wheelR: 0.32,
  }),
  compact: car('compact', '2005 rounded compact', {
    length: 3.95, width: 1.75, bodyH: 1.05, ride: 0.4, cabL: 2.5, cabH: 0.72, wheelW: 0.2,
  }),
  evSedan: car('evSedan', '2025 smooth EV sedan', {
    length: 4.6, width: 1.95, bodyH: 0.95, ride: 0.4, cabL: 2.8, cabH: 0.65,
  }),
  bus: {
    id: 'bus',
    label: '2025 electric bus',
    body: [boxPart(0, 0.5 + 2.4 / 2, 0, 10.2, 2.4, 2.5)],
    cab: [boxPart(0, 0.5 + 2.4 + 0.14 / 2, 0, 9.8, 0.14, 2.55)],
    wheelR: 0.38,
    wheelW: 0.24,
    wheels: sixWheels(),
    chrome: [],
    headlights: lightPair(5.1, 2.0, 1.0, 0.18),
    tailLights: lightPair(-5.1, 1.9, 1.0, 0.15),
    length: 10.2,
    width: 2.5,
  },
  robot: {
    id: 'robot',
    label: '2025 delivery robot',
    body: [boxPart(0, 0.18 + 0.6 / 2, 0, 0.55, 0.6, 0.5)],
    cab: [],
    wheelR: 0.1,
    wheelW: 0.08,
    wheels: [
      [-0.3, 0.45],
      [0.3, 0.45],
      [-0.3, -0.45],
      [0.3, -0.45],
    ],
    chrome: [],
    headlights: [spherePart(0.3, 0.45, 0.22, 0.08)],
    tailLights: [spherePart(0.3, 0.45, -0.22, 0.08)],
    length: 0.55,
    width: 0.5,
  },
  bike: {
    id: 'bike',
    label: '2025 cyclist',
    body: [boxPart(0, 0.42, 0, 0.4, 0.2, 0.9)],
    cab: [boxPart(-0.12, 1.02, 0, 0.32, 0.7, 0.4)],
    wheelR: 0.2,
    wheelW: 0.07,
    wheels: [
      [-0.42, 0.15],
      [0.5, 0.15],
    ],
    chrome: [],
    headlights: [spherePart(0.52, 0.45, 0, 0.07)],
    tailLights: [],
    length: 1.3,
    width: 0.5,
  },
}

export const STYLE_IDS = Object.keys(STYLES) as StyleId[]

const TYPE_TO_STYLE: Record<string, StyleId> = {
  trolley: 'trolley',
  'panel truck': 'panel',
  'vintage sedan': 'vintage',
  'delivery wagon': 'wagon',
  'chrome coupe': 'coupe',
  'classic convertible': 'convertible',
  'vintage scooter': 'scooter',
  'delivery truck': 'truck',
  'boxy sedan': 'boxySedan',
  'muscle car': 'muscle',
  van: 'van',
  taxi: 'taxi',
  suv: 'suv',
  minivan: 'minivan',
  'compact car': 'compact',
  'hybrid taxi': 'taxi',
  'ev sedan': 'evSedan',
  'e-scooter': 'scooter',
  'delivery drone': 'robot',
  'electric bus': 'bus',
}

/** Era type string → style id; unknown types fall back to the boxy sedan. */
export function styleForType(type: string): StyleId {
  return TYPE_TO_STYLE[type] ?? 'boxySedan'
}

/** The data-driven style mix for an era, in types order (round-robin spawner rotates it). */
export function eraStyleIds(era: EraId): StyleId[] {
  return ERA_DATA[era].vehicles.types.map(styleForType)
}