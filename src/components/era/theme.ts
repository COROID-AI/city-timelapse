import { Color } from 'three'
import themeData from './themeData.json'

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

/** Raw JSON shape — colors are hex strings, enums are plain strings. */
type RawTheme = Omit<EraTheme, 'skyTop' | 'skyBottom' | 'ground' | 'buildingTint' | 'storefront' | 'accent' | 'sunColor' | 'streetColor' | 'pedestrian' | 'vehicle'> & {
  skyTop: string
  skyBottom: string
  ground: string
  buildingTint: string
  storefront: string
  accent: string
  sunColor: string
  streetColor: string
  pedestrian: string
  vehicle: string
}

/** Convert a raw JSON theme (hex strings) into a typed EraTheme with Color objects. */
function parseTheme(raw: RawTheme): EraTheme {
  return {
    ...raw,
    skyTop: new Color(raw.skyTop),
    skyBottom: new Color(raw.skyBottom),
    ground: new Color(raw.ground),
    buildingTint: new Color(raw.buildingTint),
    storefront: new Color(raw.storefront),
    accent: new Color(raw.accent),
    sunColor: new Color(raw.sunColor),
    streetColor: new Color(raw.streetColor),
    pedestrian: new Color(raw.pedestrian),
    vehicle: new Color(raw.vehicle),
  }
}

/** Build the era theme table from the externalized JSON data. */
export const ERA_THEMES: Record<EraYear, EraTheme> = ERA_YEARS.reduce(
  (acc, year) => {
    const raw = (themeData as RawTheme[]).find((t) => t.year === year)
    if (!raw) throw new Error(`Missing theme data for year ${year}`)
    acc[year] = parseTheme(raw)
    return acc
  },
  {} as Record<EraYear, EraTheme>
)

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
