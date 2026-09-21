/**
 * Bundled stroke font: era typography drawn as geometry, never as a font file.
 *
 * The project ships no images, no web fonts and no remote content, so historic
 * lettering is approximated the way a signwriter would: every glyph is a set of
 * polylines in a 10 × 10 box, and one era's personality is a small set of
 * parameters applied to those strokes — weight, slant, tracking, width, slab
 * serifs, outline, drop shadow and baseline ligatures (see
 * {@link LetterformStyle}).
 *
 * The module is engine-free: it draws into {@link SignCanvas2D}, the minimum
 * slice of the canvas API the painter uses. {@link createDefaultSignCanvasFactory}
 * produces real canvases in a browser; the unit suite injects a recording
 * double, which is what proves the artwork is generated at runtime rather than
 * shipped.
 */

import type {
  LetterformStyle,
  PaintOp,
  SignCanvas2D,
  SignCanvasFactory,
  SignCanvasSurface,
  TextAlign,
  TextRole,
} from './types'

/** Side of the square glyph box every stroke coordinate lives in. */
export const GLYPH_BOX = 10

/** Horizontal advance of one glyph, as a fraction of the cap height. */
export const DEFAULT_GLYPH_ADVANCE = 0.68

/** Advance of a space, as a fraction of the cap height. */
export const SPACE_ADVANCE = 0.34

/**
 * Stroke skeleton of the bundled font.
 *
 * Each entry is a list of polylines; a polyline is a flat `x, y, x, y …` list in
 * the {@link GLYPH_BOX} box, `y` growing downwards exactly like canvas
 * coordinates. Curves are approximated with enough facets to read at
 * street-level sign distance.
 */
export const GLYPHS: Readonly<Record<string, readonly (readonly number[])[]>> = {
  A: [[0, 10, 5, 0, 10, 10], [2, 6, 8, 6]],
  B: [[0, 0, 0, 10], [0, 0, 7, 0, 9, 2, 7, 4, 0, 4], [0, 4, 8, 4, 10, 6, 10, 8, 8, 10, 0, 10]],
  C: [[10, 2, 8, 0, 2, 0, 0, 2, 0, 8, 2, 10, 8, 10, 10, 8]],
  D: [[0, 0, 0, 10], [0, 0, 6, 0, 9, 2, 9, 8, 6, 10, 0, 10]],
  E: [[9, 0, 0, 0, 0, 10, 9, 10], [0, 5, 7, 5]],
  F: [[9, 0, 0, 0, 0, 10], [0, 5, 7, 5]],
  G: [[10, 2, 8, 0, 2, 0, 0, 2, 0, 8, 2, 10, 8, 10, 10, 8, 10, 5, 5, 5]],
  H: [[0, 0, 0, 10], [10, 0, 10, 10], [0, 5, 10, 5]],
  I: [[2, 0, 8, 0], [5, 0, 5, 10], [2, 10, 8, 10]],
  J: [[9, 0, 9, 8, 7, 10, 2, 10, 0, 8]],
  K: [[0, 0, 0, 10], [9, 0, 0, 6], [3, 4, 9, 10]],
  L: [[0, 0, 0, 10, 9, 10]],
  M: [[0, 10, 0, 0, 5, 6, 10, 0, 10, 10]],
  N: [[0, 10, 0, 0, 10, 10, 10, 0]],
  O: [[2, 0, 8, 0, 10, 2, 10, 8, 8, 10, 2, 10, 0, 8, 0, 2, 2, 0]],
  P: [[0, 10, 0, 0, 8, 0, 10, 2, 8, 4, 0, 4]],
  Q: [[2, 0, 8, 0, 10, 2, 10, 8, 8, 10, 2, 10, 0, 8, 0, 2, 2, 0], [6, 7, 10, 10]],
  R: [[0, 10, 0, 0, 8, 0, 10, 2, 8, 4, 0, 4], [5, 4, 10, 10]],
  S: [[10, 1, 8, 0, 2, 0, 0, 2, 2, 4, 8, 4, 10, 6, 8, 10, 2, 10, 0, 9]],
  T: [[0, 0, 10, 0], [5, 0, 5, 10]],
  U: [[0, 0, 0, 8, 2, 10, 8, 10, 10, 8, 10, 0]],
  V: [[0, 0, 5, 10, 10, 0]],
  W: [[0, 0, 2, 10, 5, 5, 8, 10, 10, 0]],
  X: [[0, 0, 10, 10], [10, 0, 0, 10]],
  Y: [[0, 0, 5, 5, 10, 0], [5, 5, 5, 10]],
  Z: [[0, 0, 10, 0, 0, 10, 10, 10]],
  '0': [[2, 0, 8, 0, 10, 2, 10, 8, 8, 10, 2, 10, 0, 8, 0, 2, 2, 0], [2, 8, 8, 2]],
  '1': [[2, 2, 5, 0, 5, 10], [2, 10, 8, 10]],
  '2': [[0, 2, 2, 0, 8, 0, 10, 2, 0, 10, 10, 10]],
  '3': [[0, 1, 2, 0, 8, 0, 10, 2, 8, 4, 4, 4], [8, 4, 10, 6, 8, 10, 2, 10, 0, 9]],
  '4': [[8, 10, 8, 0, 0, 7, 10, 7]],
  '5': [[10, 0, 2, 0, 0, 4, 6, 4, 9, 6, 9, 8, 7, 10, 2, 10, 0, 9]],
  '6': [[9, 1, 7, 0, 3, 0, 0, 3, 0, 8, 2, 10, 8, 10, 10, 8, 10, 6, 8, 4, 2, 4, 0, 6]],
  '7': [[0, 0, 10, 0, 4, 10]],
  '8': [
    [2, 0, 8, 0, 10, 2, 8, 4, 2, 4, 0, 2, 2, 0],
    [2, 4, 0, 6, 0, 8, 2, 10, 8, 10, 10, 8, 10, 6, 8, 4],
  ],
  '9': [[10, 4, 8, 6, 2, 6, 0, 4, 0, 2, 2, 0, 8, 0, 10, 2, 10, 7, 8, 10, 3, 10]],
  ' ': [],
  '.': [[5, 9, 5, 10]],
  ',': [[5, 9, 4, 11]],
  '!': [[5, 0, 5, 7], [5, 9, 5, 10]],
  "'": [[5, 0, 4, 3]],
  '-': [[1, 5, 9, 5]],
  '+': [[5, 2, 5, 8], [2, 5, 8, 5]],
  '=': [[1, 3.5, 9, 3.5], [1, 6.5, 9, 6.5]],
  '/': [[10, 0, 0, 10]],
  ':': [[5, 2, 5, 3], [5, 8, 5, 9]],
  '$': [
    [10, 1, 8, 0, 2, 0, 0, 2, 2, 4, 8, 4, 10, 6, 8, 10, 2, 10, 0, 9],
    [5, -1, 5, 11],
  ],
  '%': [[0, 10, 10, 0], [1, 1, 2, 0, 3, 1, 2, 2, 1, 1], [7, 9, 8, 8, 9, 9, 8, 10, 7, 9]],
  '&': [[10, 10, 4, 0, 1, 2, 4, 7, 10, 10], [7, 4, 3, 10]],
  '(': [[6, 0, 3, 3, 3, 7, 6, 10]],
  ')': [[4, 0, 7, 3, 7, 7, 4, 10]],
  '*': [[5, 2, 5, 8], [1, 3, 9, 7], [9, 3, 1, 7]],
  '?': [[0, 2, 2, 0, 8, 0, 10, 2, 5, 5, 5, 6], [5, 9, 5, 10]],
  '#': [[3, 0, 1, 10], [7, 0, 5, 10], [0, 4, 9, 4], [1, 7, 10, 7]],
  '★': [[5, 0, 6.2, 3.6, 10, 3.6, 7, 6, 8.2, 10, 5, 7.6, 1.8, 10, 3, 6, 0, 3.6, 3.8, 3.6, 5, 0]],
}

/** Stroke box drawn for a character the bundled font does not cover. */
const MISSING_GLYPH: readonly (readonly number[])[] = [[0, 0, 10, 0, 10, 10, 0, 10, 0, 0]]

/** Stroke skeleton of `char`, uppercased; never empty for a visible character. */
export function glyphStrokes(char: string): readonly (readonly number[])[] {
  const key = char.toUpperCase()
  const glyph = GLYPHS[key]
  if (glyph !== undefined) {
    return glyph
  }
  return MISSING_GLYPH
}

/**
 * Advance of one glyph, in tenths of the cap height: the letter width times the
 * style's width multiplier, plus the style's tracking.
 */
export function glyphAdvance(char: string, style: LetterformStyle): number {
  if (char === ' ') {
    return SPACE_ADVANCE * GLYPH_BOX + style.tracking * GLYPH_BOX * 0.5
  }
  return DEFAULT_GLYPH_ADVANCE * GLYPH_BOX * style.xScale * (1 + style.tracking)
}

/** Width of a whole run of text at a given cap height, in pixels. */
export function measureTextRun(text: string, style: LetterformStyle, capHeight: number): number {
  let advance = 0
  for (const char of text) {
    advance += glyphAdvance(char, style)
  }
  return (advance / GLYPH_BOX) * capHeight
}

/** Horizontal starting offset of a run inside a box, per its alignment. */
export function alignOffset(
  align: TextAlign,
  boxWidth: number,
  runWidth: number,
  padding: number,
): number {
  if (align === 'left') {
    return padding
  }
  if (align === 'right') {
    return boxWidth - padding - runWidth
  }
  return (boxWidth - runWidth) / 2
}

/** One glyph stroke laid out in canvas space. */
interface PlacedStroke {
  readonly points: readonly number[]
  readonly lineWidth: number
}

/** Options accepted by {@link drawTextRun}. */
export interface DrawTextRunOptions {
  /** Left edge of the text box, pixels. */
  readonly x: number
  /** Baseline (bottom of the cap box) of the run, pixels. */
  readonly y: number
  /** Cap height in pixels. Every glyph is scaled to this. */
  readonly capHeight: number
  /** Role the run plays in the artwork, carried into the operation log. */
  readonly role: TextRole
  readonly style: LetterformStyle
  /** Ink colour of the glyph strokes. */
  readonly colour: string
  /** Drop-shadow colour; only drawn when the style asks for one. */
  readonly shadowColour?: string
  /** Outline colour; only drawn when the style asks for one. */
  readonly outlineColour?: string
  /** Operation log the painter records into. */
  readonly ops: PaintOp[]
}

/** Result of one {@link drawTextRun} call. */
export interface DrawTextRunResult {
  readonly width: number
  readonly glyphs: number
  readonly endX: number
}

function placeStrokes(
  char: string,
  penX: number,
  baseline: number,
  capHeight: number,
  style: LetterformStyle,
): PlacedStroke[] {
  const strokes = glyphStrokes(char)
  const scale = capHeight / GLYPH_BOX
  const weight = Math.max(0.6, style.weight * capHeight)
  const placed: PlacedStroke[] = []
  for (const stroke of strokes) {
    const points: number[] = []
    for (let index = 0; index + 1 < stroke.length; index += 2) {
      const px = stroke[index] ?? 0
      const py = stroke[index + 1] ?? 0
      // Italic shear leans the top of the glyph away from the baseline.
      const shear = style.slant * (capHeight - py * scale)
      points.push(penX + px * scale * style.xScale + shear, baseline + py * scale - capHeight)
    }
    placed.push({ points, lineWidth: weight })
    if (style.serifs && points.length >= 4) {
      // Slab ticks at both terminals turn the skeleton into signwriter serifs.
      const terminals = [0, points.length - 2]
      for (const index of terminals) {
        const tx = points[index] ?? 0
        const ty = points[index + 1] ?? 0
        const tick = weight * 1.4
        placed.push({ points: [tx - tick, ty, tx + tick, ty], lineWidth: weight })
      }
    }
  }
  return placed
}

function strokeStrokes(ctx: SignCanvas2D, strokes: readonly PlacedStroke[], colour: string): void {
  ctx.strokeStyle = colour
  ctx.lineJoin = 'round'
  for (const stroke of strokes) {
    if (stroke.points.length < 4) {
      continue
    }
    ctx.lineWidth = stroke.lineWidth
    ctx.beginPath()
    for (let index = 0; index + 1 < stroke.points.length; index += 2) {
      const x = stroke.points[index] ?? 0
      const y = stroke.points[index + 1] ?? 0
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
}

/**
 * Draws one run of text with the bundled stroke font.
 *
 * The context may be `null` (headless test hosts, lost contexts): the operation
 * log is still produced, so artwork generated without a canvas is still
 * verifiable and still deterministic.
 */
export function drawTextRun(
  ctx: SignCanvas2D | null,
  text: string,
  options: DrawTextRunOptions,
): DrawTextRunResult {
  const style = options.style
  const glyphs = [...text]
  const runWidth = measureTextRun(text, style, options.capHeight)
  options.ops.push({
    op: 'font',
    styleId: style.id,
    family: style.family,
    weight: style.weight,
  })
  options.ops.push({
    op: 'line',
    role: options.role,
    text,
    x: options.x,
    y: options.y,
    capHeight: options.capHeight,
    align: 'left',
  })

  let penX = options.x
  for (const char of glyphs) {
    const glyphWidth = (glyphAdvance(char, style) / GLYPH_BOX) * options.capHeight
    if (char !== ' ' && ctx !== null) {
      const placed = placeStrokes(char, penX, options.y, options.capHeight, style)
      if (style.shadow && options.shadowColour !== undefined) {
        const offset = options.capHeight * 0.06
        ctx.globalAlpha = 0.55
        strokeStrokes(
          ctx,
          placed.map((stroke) => ({
            points: stroke.points.map((value) => value + offset),
            lineWidth: stroke.lineWidth,
          })),
          options.shadowColour,
        )
        ctx.globalAlpha = 1
        options.ops.push({ op: 'detail', kind: 'shadow', colour: options.shadowColour })
      }
      if (style.outline && options.outlineColour !== undefined) {
        strokeStrokes(
          ctx,
          placed.map((stroke) => ({ points: stroke.points, lineWidth: stroke.lineWidth * 1.9 })),
          options.outlineColour,
        )
        options.ops.push({ op: 'detail', kind: 'outline', colour: options.outlineColour })
      }
      strokeStrokes(ctx, placed, options.colour)
    }
    options.ops.push({
      op: 'glyph',
      char,
      x: penX,
      y: options.y,
      capHeight: options.capHeight,
      glyphWidth,
    })
    penX += glyphWidth
  }

  if (style.ligatures && glyphs.length > 1 && ctx !== null) {
    // Neon and script runs sit on one baseline swash, which is what makes them
    // read as a single tube rather than as separate letters.
    ctx.strokeStyle = options.colour
    ctx.lineWidth = Math.max(1, options.capHeight * style.weight * 0.7)
    ctx.globalAlpha = 0.75
    ctx.beginPath()
    ctx.moveTo(options.x, options.y - options.capHeight * 0.04)
    for (let index = 1; index <= 8; index += 1) {
      const step = (index / 8) * runWidth
      ctx.lineTo(options.x + step, options.y - options.capHeight * 0.04)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    options.ops.push({ op: 'detail', kind: 'ligature', colour: options.colour })
  }

  return { width: runWidth, glyphs: glyphs.length, endX: penX }
}

/**
 * The shipped canvas factory: an offscreen `<canvas>` plus its 2D context.
 *
 * `context` is `null` when the host has no 2D canvas (headless jsdom, an
 * exhausted GPU process). Callers keep the geometry and fall back to flat
 * period colour instead of failing.
 */
export function createDefaultSignCanvasFactory(): SignCanvasFactory {
  return (width: number, height: number): SignCanvasSurface<HTMLCanvasElement> => {
    if (typeof document === 'undefined') {
      return { canvas: null as unknown as HTMLCanvasElement, context: null }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const raw = canvas.getContext('2d')
    if (raw === null) {
      return { canvas, context: null }
    }
    // CanvasRenderingContext2D is a superset of the painter's minimum surface.
    return { canvas, context: raw as unknown as SignCanvas2D }
  }
}

