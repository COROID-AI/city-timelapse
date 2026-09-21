/**
 * Sign artwork: descriptors and their runtime painter.
 *
 * A {@link SignSurface} says *what* to draw (pixel size, period colours,
 * letterform, copy) and {@link paintSignSurface} draws it — background, stripes,
 * border, glow, price bubble and finally the type, through the bundled stroke
 * font of `typography.ts`. No image file, no web font and no remote request is
 * involved, and the canvas factory is injectable so the unit suite can prove
 * the pixels are generated at runtime.
 *
 * Texture sizes are tiered from the shared quality settings and priced in bytes
 * so a plan can be checked against {@link STOREFRONT_TEXTURE_BUDGET_BYTES}
 * before a single texture is uploaded.
 */

import type { QualityTierName } from '../../lib/quality'
import type {
  IlluminationKind,
  PaintedSign,
  PaintOp,
  SignBorder,
  SignCanvas2D,
  SignCanvasFactory,
  SignPurpose,
  SignSurface,
  SignTextLine,
} from './types'
import { alignOffset, drawTextRun, measureTextRun } from './typography'

/**
 * Base pixel size of each artwork kind at the `high` tier. Lower tiers halve
 * and quarter these, which is how the layer stays inside the texture budget on
 * a phone without dropping any storefront.
 */
export const SIGN_TEXTURE_BASE_SIZES: Readonly<Record<SignPurpose, readonly [number, number]>> = {
  'shop-sign': [512, 128],
  'blade-sign': [256, 192],
  billboard: [384, 256],
  'painted-wall': [512, 256],
  'poster-panel': [256, 384],
  'newspaper-board': [256, 320],
  transient: [256, 320],
  awning: [512, 96],
  graffiti: [256, 128],
}

/** Resolution multiplier applied to {@link SIGN_TEXTURE_BASE_SIZES}. */
const TIER_TEXTURE_SCALE: Readonly<Record<QualityTierName, number>> = {
  high: 1,
  medium: 0.5,
  low: 0.25,
}

/** Smallest texture the painter will allocate, in pixels. */
export const MIN_TEXTURE_SIZE = 16

/**
 * Ceiling for one era's signage and advertising textures.
 *
 * One plan carries roughly seventy boards, a dozen street advertisements and a
 * handful of graffiti decals; at the `high` tier that is under 25 MB, so 32 MB
 * leaves room for a denser block while still failing loudly on a regression
 * that stops the material cache from reusing identical artwork.
 */
export const STOREFRONT_TEXTURE_BUDGET_BYTES = 32 * 1024 * 1024

/** Pixel size of one artwork kind at one quality tier. */
export function textureSizeFor(
  purpose: SignPurpose,
  tier: QualityTierName,
): { readonly widthPx: number; readonly heightPx: number } {
  const [baseWidth, baseHeight] = SIGN_TEXTURE_BASE_SIZES[purpose]
  const scale = TIER_TEXTURE_SCALE[tier]
  return {
    widthPx: Math.max(MIN_TEXTURE_SIZE, Math.round(baseWidth * scale)),
    heightPx: Math.max(MIN_TEXTURE_SIZE, Math.round(baseHeight * scale)),
  }
}

/** Bytes a surface occupies on the GPU: RGBA8 at its declared pixel size. */
export function surfaceTextureBytes(surface: SignSurface): number {
  return Math.round(surface.widthPx * surface.heightPx * 4)
}

/** Fields a caller supplies; the derived values are added by {@link createSignSurface}. */
export type SignSurfaceRequest = Omit<SignSurface, 'textureKey' | 'bytes'>

/** Completes a surface descriptor with its cache key and byte price. */
export function createSignSurface(request: SignSurfaceRequest): SignSurface {
  return {
    ...request,
    textureKey: request.id,
    bytes: Math.round(request.widthPx * request.heightPx * 4),
  }
}

/** Sum of {@link surfaceTextureBytes} over a set of surfaces. */
export function totalTextureBytes(surfaces: readonly SignSurface[]): number {
  return surfaces.reduce((total, surface) => total + surface.bytes, 0)
}

/** Border thickness in pixels, as a fraction of the artwork's short side. */
const BORDER_WIDTH = 0.05

/** Padding inside the artwork box, as a fraction of the short side. */
const TEXT_PADDING = 0.07

/** Line height, as a multiple of the line's cap height. */
const LINE_LEAD = 1.3

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** One line of copy placed inside an artwork box. */
export interface PlacedSignLine {
  readonly line: SignTextLine
  /** Baseline of the run, pixels from the top of the artwork. */
  readonly y: number
  /** Cap height of the run, pixels. */
  readonly capHeight: number
  /** Left edge of the run, pixels; already aligned inside the box. */
  readonly x: number
}

/**
 * Lays the copy out inside the artwork box.
 *
 * Returns each line with its placed baseline and left edge, so the painter draws
 * exactly what the tests can assert without re-deriving the typography.
 */
export function layoutSignLines(surface: SignSurface): readonly PlacedSignLine[] {
  const height = surface.heightPx
  const width = surface.widthPx
  const padding = Math.min(width, height) * TEXT_PADDING
  const measured = surface.lines.map((line) => {
    const capHeight = Math.max(4, height * clamp(line.scale, 0.05, 0.6))
    return { line, capHeight, runWidth: measureTextRun(line.text, surface.typography, capHeight) }
  })
  const totalHeight = measured.reduce((total, entry) => total + entry.capHeight * LINE_LEAD, 0)
  let cursor = Math.max(padding, (height - totalHeight) / 2)
  return measured.map((entry) => {
    const capHeight = entry.capHeight
    const placed: PlacedSignLine = {
      line: entry.line,
      y: cursor + capHeight,
      capHeight,
      x: alignOffset(entry.line.align, width, entry.runWidth, padding),
    }
    cursor += capHeight * LINE_LEAD
    return placed
  })
}

function paintBackground(ctx: SignCanvas2D, surface: SignSurface, ops: PaintOp[]): void {
  if (surface.purpose === 'graffiti') {
    // Graffiti is the one decal surface: strokes over a transparent base, so
    // the brick or shutter behind it stays visible between the spray marks.
    ctx.clearRect(0, 0, surface.widthPx, surface.heightPx)
    ops.push({ op: 'detail', kind: 'transparent-base', colour: surface.background })
    return
  }
  ctx.fillStyle = surface.background
  ctx.fillRect(0, 0, surface.widthPx, surface.heightPx)
  ops.push({ op: 'background', colour: surface.background })
}

function paintStripes(ctx: SignCanvas2D, surface: SignSurface, ops: PaintOp[]): void {
  if (surface.purpose !== 'awning') {
    return
  }
  const stripes = Math.max(2, Math.round(surface.widthPx / 64))
  const stripeWidth = surface.widthPx / stripes
  ctx.fillStyle = surface.accent
  for (let index = 0; index < stripes; index += 1) {
    if (index % 2 === 0) {
      ctx.fillRect(index * stripeWidth, 0, stripeWidth, surface.heightPx)
    }
  }
  ops.push({ op: 'detail', kind: 'stripes', colour: surface.accent })
}

function paintBorder(ctx: SignCanvas2D, surface: SignSurface, ops: PaintOp[]): void {
  if (surface.border === 'none') {
    return
  }
  const inset = Math.max(1, Math.min(surface.widthPx, surface.heightPx) * BORDER_WIDTH)
  const weight = Math.max(1, inset * 0.5)
  ctx.strokeStyle = surface.accent
  ctx.lineWidth = weight
  ctx.strokeRect(inset, inset, surface.widthPx - inset * 2, surface.heightPx - inset * 2)
  if (surface.border === 'enamel' || surface.border === 'gilt' || surface.border === 'chrome') {
    // A second, thinner rule inside the frame is the period detail that makes
    // an enamel or gilt board read as manufactured rather than as a flat panel.
    const inner = inset * 2
    ctx.lineWidth = weight * 0.6
    ctx.strokeRect(inner, inner, surface.widthPx - inner * 2, surface.heightPx - inner * 2)
    ops.push({ op: 'detail', kind: 'inner-rule', colour: surface.accent })
  }
  ops.push({ op: 'border', kind: surface.border, colour: surface.accent })
}

function paintGlow(ctx: SignCanvas2D, surface: SignSurface, ops: PaintOp[]): void {
  if (surface.emissive <= 0) {
    return
  }
  const rings = 3
  const reach = Math.min(surface.widthPx, surface.heightPx) * 0.14
  for (let ring = 0; ring < rings; ring += 1) {
    const alpha = clamp(surface.emissive, 0.05, 1) * (0.24 - ring * 0.07)
    if (alpha <= 0) {
      continue
    }
    const inset = -(reach / rings) * ring
    ctx.globalAlpha = alpha
    ctx.strokeStyle = surface.ink
    ctx.lineWidth = Math.max(1, reach / rings / 2)
    ctx.strokeRect(inset, inset, surface.widthPx - inset * 2, surface.heightPx - inset * 2)
  }
  ctx.globalAlpha = 1
  ops.push({ op: 'detail', kind: 'glow', colour: surface.ink })
}

function paintPriceBubble(
  ctx: SignCanvas2D,
  surface: SignSurface,
  entry: { readonly y: number; readonly capHeight: number },
  ops: PaintOp[],
): void {
  const bubbleWidth = surface.widthPx * 0.22
  const bubbleHeight = entry.capHeight * 1.5
  ctx.globalAlpha = 0.9
  ctx.fillStyle = surface.accent
  ctx.fillRect(surface.widthPx - bubbleWidth - surface.widthPx * 0.04, entry.y - entry.capHeight * 1.2, bubbleWidth, bubbleHeight)
  ctx.globalAlpha = 1
  ops.push({ op: 'detail', kind: 'price-bubble', colour: surface.accent })
}

/**
 * Paints one artwork through an injectable canvas factory.
 *
 * The operation log is returned alongside the canvas, so a caller without a 2D
 * context (jsdom, a headless harness) can still assert exactly which period
 * letterform and which period colour were used, and how many glyphs were laid
 * down for the copy.
 */
export function paintSignSurface<TCanvas>(
  surface: SignSurface,
  factory: SignCanvasFactory<TCanvas>,
): PaintedSign<TCanvas> {
  const target = factory(surface.widthPx, surface.heightPx)
  const ctx = target.context
  const ops: PaintOp[] = []

  if (ctx === null) {
    // Data-only fallback: keep the log complete so artwork generation stays
    // verifiable even when the host cannot give us a 2D canvas.
    ops.push(
      surface.purpose === 'graffiti'
        ? { op: 'detail', kind: 'transparent-base', colour: surface.background }
        : { op: 'background', colour: surface.background },
    )
    for (const line of surface.lines) {
      ops.push({ op: 'font', styleId: surface.typography.id, family: surface.typography.family, weight: surface.typography.weight })
      ops.push({ op: 'line', role: line.role, text: line.text, x: 0, y: 0, capHeight: 0, align: line.align })
      for (const char of line.text) {
        ops.push({ op: 'glyph', char, x: 0, y: 0, capHeight: 0, glyphWidth: 0 })
      }
    }
    return { surface, canvas: target.canvas, context: null, ops }
  }

  paintBackground(ctx, surface, ops)
  paintStripes(ctx, surface, ops)

  const placed = layoutSignLines(surface)
  for (const entry of placed) {
    if (entry.line.role === 'price') {
      paintPriceBubble(ctx, surface, entry, ops)
    }
    ops.push({
      op: 'style',
      fillStyle: entry.line.colour,
      strokeStyle: entry.line.colour,
      lineWidth: Math.max(1, entry.capHeight * surface.typography.weight),
      globalAlpha: 1,
    })
    drawTextRun(ctx, entry.line.text, {
      x: entry.x,
      y: entry.y,
      capHeight: entry.capHeight,
      role: entry.line.role,
      style: surface.typography,
      colour: entry.line.colour,
      shadowColour: surface.ink,
      outlineColour: surface.background,
      ops,
    })
  }

  paintBorder(ctx, surface, ops)
  paintGlow(ctx, surface, ops)

  return { surface, canvas: target.canvas, context: ctx, ops }
}

/**
 * Colour table for one artwork.
 *
 * The harness prints these per era, and the renderer uses them as the fallback
 * when the host has no 2D canvas: the artwork's period colours survive even
 * when its pixels could not be generated.
 */
export function surfaceColours(surface: SignSurface): {
  readonly background: string
  readonly ink: string
  readonly accent: string
  readonly illumination: IlluminationKind
  readonly border: SignBorder
} {
  return {
    background: surface.background,
    ink: surface.ink,
    accent: surface.accent,
    illumination: surface.illumination,
    border: surface.border,
  }
}
