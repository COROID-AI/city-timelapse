import { Color } from 'three'

export type EraYear = 1945 | 1965 | 1985 | 2005 | 2025 | 2055
export const ERA_YEARS: EraYear[] = [1945, 1965, 1985, 2005, 2025, 2055]

export type EraTheme = {
  year: EraYear
  name: string
  /** sky color at zenith */
  skyTop: Color
  /** sky color at horizon */
  skyBottom: Color
  /** ground color */
  ground: Color
  /** building material tint */
  buildingTint: Color
  /** storefront primary color */
  storefront: Color
  /** accent color for ads/signs */
  accent: Color
  /** fog density (0 = none) */
  fog: number
  /** ambient light intensity */
  ambient: number
  /** directional light color */
  sunColor: Color
  /** building style: 'artDeco' | 'modern' | 'glass' | 'neoFuture' */
  buildingStyle: 'artDeco' | 'modern' | 'glass' | 'neoFuture'
  /** street / vehicle color */
  streetColor: Color
  /** pedestrian outfit color */
  pedestrian: Color
  /** vehicle color */
  vehicle: Color
  /** ad signage text */
  adText: string
  /** whether flying vehicles exist */
  flyingVehicles: boolean
  /** whether holographic ads exist */
  holograms: boolean
  /** ground detail level */
  groundDetail: 'low' | 'medium' | 'high'
  /** number of pedestrians */
  pedestrianCount: number
  /** number of ground vehicles */
  vehicleCount: number
}

export const ERA_THEMES: Record<EraYear, EraTheme> = {
  1945: {
    year: 1945,
    name: 'Post-War',
    skyTop: new Color(0.55, 0.72, 0.92),
    skyBottom: new Color(0.78, 0.86, 0.96),
    ground: new Color(0.28, 0.27, 0.25),
    buildingTint: new Color(0.72, 0.68, 0.62),
    storefront: new Color(0.65, 0.42, 0.33),
    accent: new Color(0.9, 0.25, 0.2),
    ambient: 0.55,
    sunColor: new Color(1.0, 0.96, 0.88),
    buildingStyle: 'artDeco',
    streetColor: new Color(0.18, 0.17, 0.16),
    pedestrian: new Color(0.15, 0.12, 0.1),
    vehicle: new Color(0.25, 0.18, 0.18),
    adText: 'WAR BONDS',
    fog: 0.02,
    flyingVehicles: false,
    holograms: false,
    groundDetail: 'low',
    pedestrianCount: 6,
    vehicleCount: 4,
  },
  1965: {
    year: 1965,
    name: 'Googie',
    skyTop: new Color(0.5, 0.7, 0.95),
    skyBottom: new Color(0.82, 0.88, 0.97),
    ground: new Color(0.32, 0.31, 0.29),
    buildingTint: new Color(0.78, 0.72, 0.66),
    storefront: new Color(0.72, 0.48, 0.36),
    accent: new Color(0.95, 0.55, 0.15),
    ambient: 0.6,
    sunColor: new Color(1.0, 0.96, 0.88),
    buildingStyle: 'artDeco',
    streetColor: new Color(0.22, 0.21, 0.2),
    pedestrian: new Color(0.28, 0.22, 0.18),
    vehicle: new Color(0.35, 0.22, 0.22),
    adText: 'SODA POP',
    fog: 0.015,
    flyingVehicles: false,
    holograms: false,
    groundDetail: 'low',
    pedestrianCount: 8,
    vehicleCount: 6,
  },
  1985: {
    year: 1985,
    name: 'Neon',
    skyTop: new Color(0.18, 0.22, 0.38),
    skyBottom: new Color(0.35, 0.38, 0.52),
    ground: new Color(0.15, 0.15, 0.16),
    buildingTint: new Color(0.32, 0.3, 0.34),
    storefront: new Color(0.52, 0.22, 0.28),
    accent: new Color(0.15, 0.85, 0.9),
    ambient: 0.45,
    sunColor: new Color(1.0, 0.92, 0.7),
    buildingStyle: 'modern',
    streetColor: new Color(0.12, 0.12, 0.13),
    pedestrian: new Color(0.45, 0.38, 0.34),
    vehicle: new Color(0.55, 0.25, 0.28),
    adText: 'ARCADE',
    fog: 0.03,
    flyingVehicles: false,
    holograms: false,
    groundDetail: 'medium',
    pedestrianCount: 10,
    vehicleCount: 8,
  },
  2005: {
    year: 2005,
    name: 'Glass & Steel',
    skyTop: new Color(0.42, 0.62, 0.88),
    skyBottom: new Color(0.72, 0.82, 0.95),
    ground: new Color(0.22, 0.22, 0.23),
    buildingTint: new Color(0.65, 0.68, 0.72),
    storefront: new Color(0.82, 0.72, 0.58),
    accent: new Color(0.9, 0.65, 0.2),
    ambient: 0.7,
    sunColor: new Color(1.0, 0.96, 0.86),
    buildingStyle: 'glass',
    streetColor: new Color(0.28, 0.27, 0.26),
    pedestrian: new Color(0.55, 0.48, 0.42),
    vehicle: new Color(0.42, 0.32, 0.3),
    adText: 'COFFEE',
    fog: 0.008,
    flyingVehicles: false,
    holograms: false,
    groundDetail: 'medium',
    pedestrianCount: 12,
    vehicleCount: 10,
  },
  2025: {
    year: 2025,
    name: 'Modern',
    skyTop: new Color(0.32, 0.55, 0.82),
    skyBottom: new Color(0.68, 0.78, 0.9),
    ground: new Color(0.28, 0.28, 0.29),
    buildingTint: new Color(0.72, 0.74, 0.78),
    storefront: new Color(0.88, 0.82, 0.68),
    accent: new Color(0.12, 0.72, 0.55),
    ambient: 0.75,
    sunColor: new Color(1.0, 0.96, 0.86),
    buildingStyle: 'glass',
    streetColor: new Color(0.32, 0.31, 0.3),
    pedestrian: new Color(0.62, 0.55, 0.48),
    vehicle: new Color(0.38, 0.38, 0.38),
    adText: 'APP',
    fog: 0.005,
    flyingVehicles: false,
    holograms: true,
    groundDetail: 'high',
    pedestrianCount: 14,
    vehicleCount: 12,
  },
  2055: {
    year: 2055,
    name: 'Neo-Future',
    skyTop: new Color(0.06, 0.08, 0.22),
    skyBottom: new Color(0.22, 0.28, 0.48),
    ground: new Color(0.12, 0.12, 0.14),
    buildingTint: new Color(0.22, 0.24, 0.32),
    storefront: new Color(0.18, 0.62, 0.72),
    accent: new Color(0.55, 0.3, 0.95),
    ambient: 0.6,
    sunColor: new Color(0.95, 0.9, 0.7),
    buildingStyle: 'neoFuture',
    streetColor: new Color(0.08, 0.08, 0.1),
    pedestrian: new Color(0.72, 0.68, 0.64),
    vehicle: new Color(0.48, 0.48, 0.55),
    adText: 'NEURAL',
    fog: 0.04,
    flyingVehicles: true,
    holograms: true,
    groundDetail: 'high',
    pedestrianCount: 16,
    vehicleCount: 10,
  },
}

/** Linear interpolation between two era themes based on a 0..1 progress. */
export function lerpTheme(from: EraTheme, to: EraTheme, t: number): EraTheme {
  const l = (a: number, b: number) => a + (b - a) * t
  const lColor = (a: Color, b: Color) =>
    new Color(l(a.r, b.r), l(a.g, b.g), l(a.b, b.b))
  const lFlag = (a: boolean, b: boolean) => (t < 0.5 ? a : b)
  const lEnum = <T extends string>(a: T, b: T) => (t < 0.5 ? a : b)

  return {
    year: to.year,
    name: to.name,
    skyTop: lColor(from.skyTop, to.skyTop),
    skyBottom: lColor(from.skyBottom, to.skyBottom),
    ground: lColor(from.ground, to.ground),
    buildingTint: lColor(from.buildingTint, to.buildingTint),
    storefront: lColor(from.storefront, to.storefront),
    accent: lColor(from.accent, to.accent),
    ambient: l(from.ambient, to.ambient),
    sunColor: lColor(from.sunColor, to.sunColor),
    buildingStyle: lEnum(from.buildingStyle, to.buildingStyle),
    streetColor: lColor(from.streetColor, to.streetColor),
    pedestrian: lColor(from.pedestrian, to.pedestrian),
    vehicle: lColor(from.vehicle, to.vehicle),
    adText: to.adText,
    fog: l(from.fog, to.fog),
    flyingVehicles: lFlag(from.flyingVehicles, to.flyingVehicles),
    holograms: lFlag(from.holograms, to.holograms),
    groundDetail: lEnum(from.groundDetail, to.groundDetail),
    pedestrianCount: Math.round(l(from.pedestrianCount, to.pedestrianCount)),
    vehicleCount: Math.round(l(from.vehicleCount, to.vehicleCount)),
  }
}
