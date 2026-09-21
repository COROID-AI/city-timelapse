/**
 * Procedural facade materials and the injectable texture factory.
 *
 * Two things live here:
 *
 * 1. **Material parameters.** {@link materialSpecsFor} turns an era table into
 *    one MeshStandardMaterial-compatible record per
 *    {@link BuildingMaterialKey}: colour, roughness, metalness and — as the
 *    acceptance criteria require — an emissive window intensity that is
 *    non-zero *exactly* when the era's own lighting says it is night.
 * 2. **Textures.** {@link FacadeTextureFactory} is the injection point. The
 *    default implementation ({@link createCanvasTextureFactory}) draws the
 *    window grid, masonry coursing, concrete bands, curtain-wall mullions and
 *    roof surfaces into a 2D canvas at runtime; tests inject
 *    {@link createRecordingTextureFactory} instead and assert *which* textures
 *    the generator asked for, without needing a DOM canvas at all.
 *
 * Nothing here knows about a specific year: the pattern to draw comes from the
 * era table's `textureSet` and `facade` records.
 */

import { DataTexture, RGBAFormat, SRGBColorSpace, Texture } from 'three'
import type { EraId } from '../../era'
import { hashStringToSeed } from '../../lib/rng'
import type {
  BuildingEraTable,
  BuildingMaterialKey,
  BuildingMaterialPalette,
  FacadeStyle,
  FacadeWindowGrid,
} from './types'

/* ------------------------------------------------------------------------- *
 * Material parameters
 * ------------------------------------------------------------------------- */

/** Surfaces the factory can paint. */
export const TEXTURE_SURFACES = ['mass', 'glass', 'roof', 'lot'] as const

export type TextureSurface = (typeof TEXTURE_SURFACES)[number]

/** MeshStandardMaterial-compatible parameters of one material slot. */
export interface BuildingMaterialSpec {
  readonly color: number
  readonly roughness: number
  readonly metalness: number
  readonly emissive: number
  readonly emissiveIntensity: number
  /** Procedural texture this slot asks the factory for, or `null` for flat colour. */
  readonly textureSurface: TextureSurface | null
}

/** Parses `#rrggbb` into the number three.js expects. */
export function hexToNumber(hex: string): number {
  const value = hex.startsWith('#') ? hex.slice(1) : hex
  const parsed = Number.parseInt(value, 16)
  return Number.isFinite(parsed) ? parsed : 0x808080
}

/** Mass surface response, by facade language rather than by year. */
const MASS_SURFACE: Readonly<Record<FacadeStyle, { roughness: number; metalness: number }>> = {
  'masonry-coursed': { roughness: 0.94, metalness: 0 },
  'brick-and-glass': { roughness: 0.86, metalness: 0.02 },
  'concrete-band-and-mullion': { roughness: 0.74, metalness: 0.06 },
  'curtain-wall-spandrel': { roughness: 0.42, metalness: 0.22 },
  'exposed-structure-balcony': { roughness: 0.5, metalness: 0.18 },
}

/** Glass response, by facade language: the later the curtain wall, the shinier. */
const GLASS_SURFACE: Readonly<Record<FacadeStyle, { roughness: number; metalness: number }>> = {
  'masonry-coursed': { roughness: 0.42, metalness: 0.08 },
  'brick-and-glass': { roughness: 0.32, metalness: 0.14 },
  'concrete-band-and-mullion': { roughness: 0.24, metalness: 0.28 },
  'curtain-wall-spandrel': { roughness: 0.12, metalness: 0.48 },
  'exposed-structure-balcony': { roughness: 0.16, metalness: 0.42 },
}

/**
 * Material parameter set of one era.
 *
 * The mass, glass, trim, roof, lot, construction and add-on slots all read the
 * era palette, and the glass slot carries the era's emissive window intensity,
 * which {@link tables} already zeroed for day eras.
 */
export function materialSpecsFor(
  table: BuildingEraTable,
): Readonly<Record<BuildingMaterialKey, BuildingMaterialSpec>> {
  const palette: BuildingMaterialPalette = table.palette
  const mass = MASS_SURFACE[table.facade.style]
  const glass = GLASS_SURFACE[table.facade.style]
  return {
    mass: {
      color: hexToNumber(palette.mass),
      roughness: mass.roughness,
      metalness: mass.metalness,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: 'mass',
    },
    glass: {
      color: hexToNumber(palette.glass),
      roughness: glass.roughness,
      metalness: glass.metalness,
      emissive: hexToNumber(palette.glow),
      emissiveIntensity: table.windowEmissiveIntensity,
      textureSurface: 'glass',
    },
    trim: {
      color: hexToNumber(palette.trim),
      roughness: 0.62,
      metalness: 0.24,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: null,
    },
    detail: {
      color: hexToNumber(palette.detail),
      roughness: 0.72,
      metalness: 0.1,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: null,
    },
    roof: {
      color: hexToNumber(palette.roof),
      roughness: 0.92,
      metalness: 0.04,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: 'roof',
    },
    lot: {
      color: hexToNumber(palette.mass),
      roughness: 0.95,
      metalness: 0,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: 'lot',
    },
    construction: {
      color: hexToNumber(palette.accent),
      roughness: 0.66,
      metalness: 0.18,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: null,
    },
    'add-on': {
      color: hexToNumber(palette.trim),
      roughness: 0.5,
      metalness: 0.52,
      emissive: 0x000000,
      emissiveIntensity: 0,
      textureSurface: null,
    },
  }
}

/* ------------------------------------------------------------------------- *
 * Texture factory
 * ------------------------------------------------------------------------- */

/** Everything the factory needs to paint one surface of one era. */
export interface FacadeTextureRequest {
  readonly id: string
  readonly surface: TextureSurface
  readonly eraId: EraId
  /** Era table's surface family, e.g. `soot-brick` or `curtain-wall`. */
  readonly textureSet: string
  readonly palette: BuildingMaterialPalette
  /** Window grid the glass pattern paints, or `null` for wall/roof surfaces. */
  /** Window grid the glass pattern paints, or `null` for wall/roof surfaces. */
  readonly grid: FacadeWindowGrid | null
  /** Fraction of windows the pattern paints as lit. */
  readonly litWindowFraction: number
  readonly night: boolean
  /** Edge length of the square texture, in pixels. */
  readonly size: number
  /** Scale of the coursing/band pattern, in courses per facade. */
  readonly courses: number
  readonly seed: number
}

/** Opaque texture the bridge can hand to a three.js material. */
export interface TextureHandle {
  readonly id: string
  readonly request: FacadeTextureRequest
  /** `THREE.Texture` for the default factory; tests inject a null payload. */
  readonly payload: unknown
}

/** Injectable texture source. Swap it to run the generator without a canvas. */
export interface FacadeTextureFactory {
  readonly name: string
  create(request: FacadeTextureRequest): TextureHandle
}

/** Builds the request for one surface of one era. */
export function facadeTextureRequest(input: {
  readonly table: BuildingEraTable
  readonly surface: TextureSurface
  readonly grid: FacadeWindowGrid | null
  readonly size: number
  /** Courses per facade; defaults to the era's own coursing or storey pitch. */
  readonly courses?: number
}): FacadeTextureRequest {
  const { table, surface, grid, size } = input
  return {
    id: `${table.eraId}:${surface}:${table.textureSet}`,
    surface,
    eraId: table.eraId,
    textureSet: table.textureSet,
    palette: table.palette,
    grid,
    litWindowFraction: table.litWindowFraction,
    night: table.night,
    size,
    courses:
      input.courses ??
      (table.facade.masonryCourseHeight === null ? 12 : Math.round(12 / table.facade.masonryCourseHeight)),
    seed: hashStringToSeed(`${table.eraId}:${surface}:${table.textureSet}`),
  }
}

/**
 * Recording factory: real requests, no canvas.
 *
 * Every created texture is recorded in order, which is what the composition
 * suite asserts on — the generator must ask for a mass, a glass, a roof and a
 * lot texture per era, and the glass request must carry the era's window grid.
 */
export interface RecordingTextureFactory extends FacadeTextureFactory {
  readonly requests: readonly FacadeTextureRequest[]
  clear(): void
}

/** Creates a factory that records its requests and returns empty handles. */
export function createRecordingTextureFactory(name = 'recording'): RecordingTextureFactory {
  const requests: FacadeTextureRequest[] = []
  let counter = 0
  return {
    name,
    requests,
    clear(): void {
      requests.length = 0
    },
    create(request: FacadeTextureRequest): TextureHandle {
      counter += 1
      requests.push(request)
      return { id: `${request.id}#${counter}`, request, payload: null }
    },
  }
}

/** Options of the default factory. */
export interface CanvasTextureFactoryOptions {
  /** Edge length of the square texture; defaults to the tier's texture size. */
  readonly size?: number
  /** Document used to create canvases; defaults to the page document. */
  readonly document?: Document
}

/** Draws one procedural surface into a 2D context. */
function paintSurface(
  context: CanvasRenderingContext2D,
  request: FacadeTextureRequest,
): void {
  const size = request.size
  const { palette, grid } = request

  context.fillStyle = request.surface === 'roof' ? palette.roof : palette.mass
  context.fillRect(0, 0, size, size)

  // Deterministic speckle: a tiny xorshift seeded by the request.
  let state = request.seed >>> 0
  const noise = (): number => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state / 0xffffffff
  }

  if (request.surface === 'mass') {
    // Coursing for the masonry eras, panel joints for the concrete and glass ones.
    const courses = Math.max(4, Math.min(64, request.courses))
    const courseHeight = size / courses
    context.strokeStyle = palette.accent
    context.globalAlpha = 0.35
    context.lineWidth = Math.max(1, size / 256)
    for (let index = 0; index <= courses; index += 1) {
      const y = Math.round(index * courseHeight) + 0.5
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
    context.globalAlpha = 0.18
    for (let index = 0; index < courses * 2; index += 1) {
      const x = Math.round(noise() * size) + 0.5
      const y = Math.round(noise() * size) + 0.5
      context.strokeStyle = palette.trim
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x, y + courseHeight)
      context.stroke()
    }
    context.globalAlpha = 1
    return
  }

  if (request.surface === 'glass') {
    const columns = Math.max(1, Math.min(48, grid?.columns ?? 6))
    const rows = Math.max(1, Math.min(48, grid?.rows ?? 6))
    const cellWidth = size / columns
    const cellHeight = size / rows
    const frame = Math.max(1, size / 256)
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const lit = request.night && noise() < request.litWindowFraction
        context.fillStyle = lit ? palette.glow : palette.glass
        context.globalAlpha = lit ? 1 : 0.9
        context.fillRect(
          column * cellWidth + frame,
          row * cellHeight + frame,
          Math.max(1, cellWidth - frame * 2),
          Math.max(1, cellHeight - frame * 2),
        )
      }
    }
    context.globalAlpha = 0.6
    context.strokeStyle = palette.trim
    context.lineWidth = frame
    for (let column = 0; column <= columns; column += 1) {
      const x = Math.round(column * cellWidth) + 0.5
      context.beginPath()
      context.moveTo(x, 0)
      context.lineTo(x, size)
      context.stroke()
    }
    for (let row = 0; row <= rows; row += 1) {
      const y = Math.round(row * cellHeight) + 0.5
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.stroke()
    }
    context.globalAlpha = 1
    return
  }

  if (request.surface === 'roof') {
    const gravel = Math.max(64, Math.round(size * 1.5))
    for (let index = 0; index < gravel; index += 1) {
      const shade = noise()
      context.fillStyle = shade > 0.6 ? palette.accent : palette.trim
      context.globalAlpha = 0.2 + noise() * 0.25
      const dot = Math.max(1, Math.round(size / 96))
      context.fillRect(Math.round(noise() * size), Math.round(noise() * size), dot, dot)
    }
    context.globalAlpha = 1
    return
  }

  // Cleared lot: a mottled rubble field.
  for (let index = 0; index < 60; index += 1) {
    context.fillStyle = noise() > 0.5 ? palette.trim : palette.accent
    context.globalAlpha = 0.25
    const patch = Math.max(2, Math.round(size / 24))
    context.fillRect(Math.round(noise() * size), Math.round(noise() * size), patch, patch)
  }
  context.globalAlpha = 1
}

/** Builds a tiny deterministic data texture when no 2D canvas is available. */
function fallbackTexture(request: FacadeTextureRequest): Texture {
  const size = 8
  const data = new Uint8Array(size * size * 4)
  let state = request.seed >>> 0
  for (let index = 0; index < size * size; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    data[index * 4] = state & 0xff
    data[index * 4 + 1] = (state >>> 8) & 0xff
    data[index * 4 + 2] = (state >>> 16) & 0xff
    data[index * 4 + 3] = 255
  }
  const texture = new DataTexture(data, size, size, RGBAFormat)
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * Default factory: draws each surface into a canvas at runtime.
 *
 * Falls back to a small data texture when the environment has no 2D canvas
 * (jsdom without the `canvas` package, a headless renderer with no DOM), so the
 * layer always mounts *something* and never throws.
 */
export function createCanvasTextureFactory(
  options: CanvasTextureFactoryOptions = {},
): FacadeTextureFactory {
  const defaultSize = options.size ?? 256
  const documents: Document | null =
    options.document ?? (typeof document === 'undefined' ? null : document)
  const cache = new Map<string, TextureHandle>()

  return {
    name: 'canvas',
    create(request: FacadeTextureRequest): TextureHandle {
      const size = request.size > 0 ? request.size : defaultSize
      const key = `${request.id}:${size}`
      const cached = cache.get(key)
      if (cached !== undefined) {
        return cached
      }

      const resolved: FacadeTextureRequest = { ...request, size }
      let handle: TextureHandle
      const canvas = documents?.createElement('canvas') ?? null
      const context = canvas === null ? null : (canvas.getContext('2d') as CanvasRenderingContext2D | null)
      if (canvas !== null && context !== null) {
        canvas.width = size
        canvas.height = size
        paintSurface(context, resolved)
        const texture = new Texture(canvas)
        texture.colorSpace = SRGBColorSpace
        texture.needsUpdate = true
        handle = { id: key, request: resolved, payload: texture }
      } else {
        handle = { id: key, request: resolved, payload: fallbackTexture(resolved) }
      }
      cache.set(key, handle)
      return handle
    },
  }
}

/** Default factory of the layer: the canvas implementation. */
export const DEFAULT_TEXTURE_FACTORY: FacadeTextureFactory = createCanvasTextureFactory()
