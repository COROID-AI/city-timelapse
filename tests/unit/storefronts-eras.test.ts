/**
 * Unit contract for the era storefront, signage and advertising tables.
 *
 * The layer is only as period-correct as its data, so these tests lock the data
 * down first: every era defines a complete shop list, signage vocabulary,
 * letterform, advertisement set and graffiti programme, and no two adjacent
 * eras can be confused for one another. They then prove the artwork is produced
 * at *runtime*: the sign painter is driven through an injected canvas factory,
 * and the recorded drawing calls carry the era's own letterform and colours
 * while never rasterising a font glyph.
 */

import { describe, expect, it } from 'vitest'
import { ERA_IDS, getEra, type EraId } from '../../src/era'
import { createCityLayout } from '../../src/city/layout'
import {
  ADVERTISING_KINDS,
  applyEra,
  createSignSurface,
  drawTextRun,
  glyphAdvance,
  glyphStrokes,
  isStorefrontEraId,
  isNightLighting,
  luminance,
  measureTextRun,
  paintSignSurface,
  signageEmissiveIntensity,
  storefrontEraData,
  ILLUMINATION_GAIN,
  STOREFRONT_ERA_IDS,
  STOREFRONT_TEXTURE_BUDGET_BYTES,
  surfaceTextureBytes,
  storefrontPlanHash,
  textureSizeFor,
} from '../../src/city/storefronts'
import type {
  SignCanvas2D,
  SignCanvasFactory,
  SignSurface,
  TextRole,
} from '../../src/city/storefronts'

/* ------------------------------------------------------------------------- *
 * Recording canvas double
 * ------------------------------------------------------------------------- */

interface FakeCanvas {
  readonly width: number
  readonly height: number
  getContext(id: string): unknown
}

/** Canvas 2D double that records every drawing call the painter makes. */
class RecordingContext implements SignCanvas2D {
  private fillValue = '#000000'
  private strokeValue = '#000000'

  readonly canvas = { width: 0, height: 0 }
  lineWidth = 1
  lineCap: 'butt' | 'round' | 'square' = 'butt'
  lineJoin: 'round' | 'bevel' | 'miter' = 'round'
  globalAlpha = 1

  /** Colours assigned to `fillStyle`, in order. */
  readonly fillStyles: string[] = []
  /** Colours assigned to `strokeStyle`, in order. */
  readonly strokeStyles: string[] = []
  readonly rectangles: { x: number; y: number; width: number; height: number; fill: string }[] = []
  /** Any text rasterisation; must stay empty — the font is drawn as geometry. */
  readonly textCalls: string[] = []
  moves = 0
  lines = 0
  strokes = 0
  fills = 0

  constructor(width: number, height: number) {
    this.canvas = { width, height }
  }

  get fillStyle(): string {
    return this.fillValue
  }

  set fillStyle(value: string) {
    this.fillValue = value
    this.fillStyles.push(value)
  }

  get strokeStyle(): string {
    return this.strokeValue
  }

  set strokeStyle(value: string) {
    this.strokeValue = value
    this.strokeStyles.push(value)
  }

  save(): void {}
  restore(): void {}
  translate(): void {}
  scale(): void {}
  beginPath(): void {}
  closePath(): void {}

  moveTo(): void {
    this.moves += 1
  }

  lineTo(): void {
    this.lines += 1
  }

  stroke(): void {
    this.strokes += 1
  }

  fill(): void {
    this.fills += 1
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.rectangles.push({ x, y, width, height, fill: this.fillStyle })
  }

  strokeRect(): void {}

  clearRect(): void {}

  /** Not part of the painter's surface: exists so a regression that falls back
   * to a font rasteriser would be recorded rather than crash. */
  fillText(text: string): void {
    this.textCalls.push(text)
  }

  strokeText(text: string): void {
    this.textCalls.push(text)
  }
}

interface Recorder {
  readonly factory: SignCanvasFactory<FakeCanvas>
  readonly contexts: RecordingContext[]
  readonly canvases: FakeCanvas[]
}

function createRecorder(): Recorder {
  const contexts: RecordingContext[] = []
  const canvases: FakeCanvas[] = []
  const factory: SignCanvasFactory<FakeCanvas> = (width, height) => {
    const context = new RecordingContext(width, height)
    const canvas: FakeCanvas = { width, height, getContext: () => context }
    contexts.push(context)
    canvases.push(canvas)
    return { canvas, context }
  }
  return { factory, contexts, canvases }
}

function requireDefined<T>(value: T | undefined, label: string): T {
  if (value === undefined) {
    throw new Error(`Expected ${label} to be defined`)
  }
  return value
}

/* ------------------------------------------------------------------------- *
 * Fixtures
 * ------------------------------------------------------------------------- */

const layout = createCityLayout()

function planFor(eraId: EraId) {
  return applyEra(eraId, { layout })
}

function shopSignSurface(eraId: EraId): SignSurface {
  return requireDefined(
    planFor(eraId).surfaces.find((surface) => surface.purpose === 'shop-sign'),
    `${eraId} shop sign surface`,
  )
}

/* ------------------------------------------------------------------------- *
 * Era tables
 * ------------------------------------------------------------------------- */

describe('storefront era tables', () => {
  it('covers every era of the registry, in order and exactly once', () => {
    expect([...STOREFRONT_ERA_IDS]).toEqual([...ERA_IDS])
    for (const eraId of ERA_IDS) {
      expect(isStorefrontEraId(eraId)).toBe(true)
      expect(storefrontEraData(eraId).eraId).toBe(eraId)
      expect(() => storefrontEraData(eraId)).not.toThrow()
    }
    expect(isStorefrontEraId('2055')).toBe(false)
    expect(isStorefrontEraId(1945)).toBe(false)
  })

  it('defines a complete shop-type vocabulary per era', () => {
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      expect(data.shopTypes.length, `${eraId} shop types`).toBeGreaterThanOrEqual(5)
      const ids = data.shopTypes.map((shop) => shop.id)
      expect(new Set(ids).size, `${eraId} shop ids are unique`).toBe(ids.length)
      for (const shop of data.shopTypes) {
        expect(shop.names.length, `${eraId}/${shop.id} names`).toBeGreaterThanOrEqual(2)
        expect(shop.signLines.length, `${eraId}/${shop.id} sign lines`).toBeGreaterThanOrEqual(2)
        expect(shop.priceLines.length, `${eraId}/${shop.id} price lines`).toBeGreaterThanOrEqual(1)
        for (const line of [...shop.signLines, ...shop.priceLines]) {
          expect(line.trim().length, `${eraId}/${shop.id} copy "${line}"`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('names the period shop types the brief calls for', () => {
    const expected: Readonly<Record<string, readonly string[]>> = {
      '1945': ['bakery', 'tailor', 'hardware', 'wartime-grocer'],
      '1965': ['appliance-dealer', 'diner', 'record-shop'],
      '1985': ['video-rental', 'arcade', 'electronics'],
      '2005': ['chain-pharmacy', 'coffee-chain', 'mobile-store'],
      '2025': ['bank-branch', 'specialty-coffee', 'delivery-micro-hub'],
    }
    for (const [eraId, ids] of Object.entries(expected)) {
      const shopIds = storefrontEraData(eraId as EraId).shopTypes.map((shop) => shop.id)
      for (const id of ids) {
        expect(shopIds, `${eraId} lists ${id}`).toContain(id)
      }
    }
  })

  it('defines a signage vocabulary and a letterform per era', () => {
    const vocabulary = new Set<string>()
    const letterforms = new Set<string>()
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      expect(data.signage.length, `${eraId} signage terms`).toBeGreaterThanOrEqual(4)
      for (const term of data.signage) {
        expect(term.length).toBeGreaterThan(2)
        vocabulary.add(`${eraId}:${term}`)
      }
      const typography = data.typography
      expect(typography.id, `${eraId} letterform id`).toContain(eraId)
      expect(typography.weight, `${eraId} stroke weight`).toBeGreaterThan(0.05)
      expect(typography.weight).toBeLessThan(0.35)
      expect(typography.xScale, `${eraId} width`).toBeGreaterThan(0.8)
      expect(typography.xScale).toBeLessThan(1.5)
      expect(Math.abs(typography.slant), `${eraId} slant`).toBeLessThan(0.4)
      expect(typography.tracking).toBeGreaterThanOrEqual(0)
      letterforms.add(`${typography.id}:${typography.family}`)
    }
    expect(vocabulary.size).toBe(ERA_IDS.length * 6)
    expect(letterforms.size).toBe(ERA_IDS.length)
  })

  it('defines advertisement copy for every medium, using the era campaigns', () => {
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      const era = getEra(eraId)
      const tags = new Set<string>()
      for (const kind of ADVERTISING_KINDS) {
        const copies = data.advertising[kind]
        expect(copies.length, `${eraId} ${kind} copy`).toBeGreaterThanOrEqual(1)
        expect(data.advertisingMix[kind], `${eraId} ${kind} mix`).toBeGreaterThanOrEqual(0)
        for (const copy of copies) {
          expect(copy.brand.trim().length, `${eraId} ${kind} brand`).toBeGreaterThan(0)
          expect(copy.headline.trim().length, `${eraId} ${kind} headline`).toBeGreaterThan(0)
          expect(copy.body.trim().length, `${eraId} ${kind} body`).toBeGreaterThan(0)
          expect(copy.price.trim().length, `${eraId} ${kind} price`).toBeGreaterThan(0)
          // Every campaign this layer advertises belongs to the era model's own
          // advertising vocabulary, so the period copy cannot drift apart.
          expect(era.contentTags.advertisements, `${eraId} campaign ${copy.tag}`).toContain(copy.tag)
          tags.add(copy.tag)
        }
      }
      expect(tags.size, `${eraId} distinct campaigns`).toBe(era.contentTags.advertisements.length)
      expect(data.transientMessages.length).toBeGreaterThanOrEqual(3)
      expect(data.advertisingMix.transient).toBeGreaterThan(0)
    }
  })

  it('makes every adjacent pair of eras measurably different', () => {
    for (let index = 1; index < ERA_IDS.length; index += 1) {
      const previous = storefrontEraData(ERA_IDS[index - 1] as EraId)
      const current = storefrontEraData(ERA_IDS[index] as EraId)
      expect(current.signage, `${current.eraId} signage`).not.toEqual(previous.signage)
      expect(current.typography.id, `${current.eraId} letterform`).not.toBe(previous.typography.id)
      expect(
        current.shopTypes.map((shop) => shop.id),
        `${current.eraId} shop types`,
      ).not.toEqual(previous.shopTypes.map((shop) => shop.id))
      expect(current.advertisingMix, `${current.eraId} advertising mix`).not.toEqual(
        previous.advertisingMix,
      )
      expect(current.graffiti.state, `${current.eraId} graffiti state`).not.toBe(
        previous.graffiti.state,
      )
      // The period's sign technology pair must differ as well: 1965 and 1985
      // both run neon, but only 1985 also runs backlit plastic.
      expect(
        [current.illumination, current.secondaryIllumination],
        `${current.eraId} illumination`,
      ).not.toEqual([previous.illumination, previous.secondaryIllumination])
    }
  })

  it('never enables graffiti in an era whose table disables it', () => {
    for (const eraId of ERA_IDS) {
      const profile = storefrontEraData(eraId).graffiti
      if (profile.state === 'none') {
        expect(profile.density, `${eraId} density`).toBe(0)
        expect(planFor(eraId).graffiti, `${eraId} placements`).toHaveLength(0)
      } else {
        expect(profile.density).toBeGreaterThan(0)
        expect(profile.styles.length).toBeGreaterThan(0)
        expect(profile.messages.length).toBeGreaterThan(0)
        expect(profile.colours.length).toBeGreaterThan(0)
      }
    }
  })
})

/* ------------------------------------------------------------------------- *
 * Canvas painting
 * ------------------------------------------------------------------------- */

describe('procedural signage typography', () => {
  it('bundles a stroke font broad enough for the shipped copy', () => {
    const covered = new Set<string>()
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      for (const surface of plan.surfaces) {
        for (const line of surface.lines) {
          for (const char of line.text.toUpperCase()) {
            if (char === ' ') {
              continue
            }
            covered.add(char)
          }
        }
      }
    }
    for (const char of covered) {
      const strokes = glyphStrokes(char)
      expect(strokes.length, `glyph ${char}`).toBeGreaterThan(0)
      expect(strokes[0]?.length ?? 0).toBeGreaterThanOrEqual(4)
    }
  })

  it('lays a run out with the era letterform and reports its advance', () => {
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      const style = data.typography
      const width = measureTextRun('HARDWARE & PAINT', style, 40)
      expect(width, `${eraId} run width`).toBeGreaterThan(40 * 4)
      expect(width).toBeLessThan(40 * 22)
      expect(glyphAdvance(' ', style)).toBeGreaterThan(0)
      expect(measureTextRun('', style, 40)).toBe(0)
      const recorder = createRecorder()
      const context = new RecordingContext(512, 128)
      const ops: Parameters<typeof drawTextRun>[2]['ops'] = []
      const result = drawTextRun(context, 'BAKERY 1945', {
        x: 4,
        y: 40,
        capHeight: 32,
        role: 'brand' satisfies TextRole,
        style,
        colour: '#112233',
        ops,
      })
      expect(result.glyphs).toBe('BAKERY 1945'.length)
      expect(result.width).toBeCloseTo(measureTextRun('BAKERY 1945', style, 32), 6)
      expect(context.strokes).toBeGreaterThan(0)
      expect(context.textCalls).toEqual([])
      expect(ops.filter((op) => op.op === 'glyph')).toHaveLength('BAKERY 1945'.length)
      const fontOp = ops.find((op) => op.op === 'font')
      expect(fontOp).toBeDefined()
      expect(fontOp?.op === 'font' ? fontOp.styleId : '').toBe(style.id)
      expect(recorder.contexts).toHaveLength(0)
    }
  })

  it('draws every era sign through the injected canvas factory in the era colour', () => {
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      const surface = shopSignSurface(eraId)
      const recorder = createRecorder()
      const painted = paintSignSurface(surface, recorder.factory)

      expect(recorder.contexts).toHaveLength(1)
      expect(painted.canvas).toBe(recorder.canvases[0])
      const context = requireDefined(recorder.contexts[0], `${eraId} recorder`)

      // Background and ink come from the surface, which is built from the era
      // palette; the painter never invents a colour of its own.
      expect(context.fillStyles).toContain(surface.background)
      expect(context.strokeStyles).toContain(surface.ink)
      expect(context.rectangles[0]?.fill).toBe(surface.background)

      // Type is geometry: strokes were laid down, no font was rasterised.
      expect(context.moves, `${eraId} moveTo`).toBeGreaterThan(0)
      expect(context.lines, `${eraId} lineTo`).toBeGreaterThan(0)
      expect(context.strokes, `${eraId} strokes`).toBeGreaterThan(0)
      expect(context.textCalls, `${eraId} text rasterisation`).toEqual([])

      const fontOps = painted.ops.filter((op) => op.op === 'font')
      expect(fontOps.length).toBe(surface.lines.length)
      for (const op of fontOps) {
        expect(op.op === 'font' ? op.styleId : '').toBe(data.typography.id)
        expect(op.op === 'font' ? op.family : '').toBe(data.typography.family)
      }
      const visibleCharacters = surface.lines
        .flatMap((line) => [...line.text])
        .filter((char) => char !== ' ').length
      const glyphOps = painted.ops.filter((op) => op.op === 'glyph')
      expect(glyphOps).toHaveLength(
        surface.lines.reduce((total, line) => total + [...line.text].length, 0),
      )
      const drawnGlyphs = painted.ops.filter(
        (op) => op.op === 'glyph' && (op.char !== ' ' || op.glyphWidth > 0),
      )
      expect(drawnGlyphs.length).toBe(surface.lines.reduce((total, line) => total + line.text.length, 0))
      expect(visibleCharacters).toBeGreaterThan(10)

      // The price strip is styled as a price, not as another line of prose.
      if (surface.lines.some((line) => line.role === 'price')) {
        expect(painted.ops.some((op) => op.op === 'detail' && op.kind === 'price-bubble')).toBe(true)
      }
      // A shop board is painted, not a decal: it gets an opaque period base.
      expect(painted.ops.some((op) => op.op === 'background')).toBe(true)
      expect(
        painted.ops.some((op) => op.op === 'detail' && op.kind === 'transparent-base'),
      ).toBe(false)
    }
  })

  it('uses the period border treatment and paint-only base for graffiti', () => {
    const recorder = createRecorder()
    const graffiti = requireDefined(
      planFor('1985').graffiti[0],
      '1985 graffiti placement',
    )
    const painted = paintSignSurface(graffiti.surface, recorder.factory)
    const context = requireDefined(recorder.contexts[0], 'graffiti recorder')
    expect(graffiti.surface.purpose).toBe('graffiti')
    // A decal is strokes over a transparent base: no opaque background fill.
    expect(painted.ops.some((op) => op.op === 'background')).toBe(false)
    expect(painted.ops.some((op) => op.op === 'detail' && op.kind === 'transparent-base')).toBe(true)
    expect(context.rectangles.filter((rect) => rect.width === painted.surface.widthPx)).toHaveLength(0)
    expect(context.strokes).toBeGreaterThan(0)
  })

  it('prices and sizes artwork per quality tier', () => {
    const high = textureSizeFor('shop-sign', 'high')
    const medium = textureSizeFor('shop-sign', 'medium')
    const low = textureSizeFor('shop-sign', 'low')
    expect(high.widthPx).toBeGreaterThan(medium.widthPx)
    expect(medium.widthPx).toBeGreaterThan(low.widthPx)
    const surface = createSignSurface({
      id: 'test:surface',
      eraId: '1945',
      purpose: 'shop-sign',
      widthPx: 128,
      heightPx: 64,
      background: '#ffffff',
      ink: '#000000',
      accent: '#ff0000',
      illumination: 'painted',
      emissive: 0,
      typography: storefrontEraData('1945').typography,
      lines: [{ text: 'TEST', role: 'brand', scale: 0.4, colour: '#000000', align: 'centre' }],
      border: 'enamel',
    })
    expect(surface.textureKey).toBe(surface.id)
    expect(surface.bytes).toBe(128 * 64 * 4)
    expect(surfaceTextureBytes(surface)).toBe(surface.bytes)
  })
})

/* ------------------------------------------------------------------------- *
 * Illumination
 * ------------------------------------------------------------------------- */

describe('period signage illumination', () => {
  it('drives emissive strength from the era lighting and the night flag', () => {
    const painted = signageEmissiveIntensity(getEra('1945'), { night: false })
    const incandescent = signageEmissiveIntensity(getEra('1945'), { night: true })
    expect(painted).toBeLessThan(0.05)
    expect(incandescent).toBeGreaterThan(painted)

    const neonNight = signageEmissiveIntensity(getEra('1985'), { night: true })
    expect(neonNight).toBeGreaterThan(1)
    expect(neonNight).toBeCloseTo(
      getEra('1985').lighting.artificialLightIntensity * ILLUMINATION_GAIN.neon,
      4,
    )
    expect(isNightLighting(getEra('1985').lighting)).toBe(true)

    const backlitDay = signageEmissiveIntensity(getEra('2005'), { night: false })
    const backlitNight = signageEmissiveIntensity(getEra('2005'), { night: true })
    expect(backlitNight).toBeGreaterThan(backlitDay * 1.9)
    expect(backlitNight).toBeLessThan(backlitDay * 2.1)

    const ledDusk = signageEmissiveIntensity(getEra('2025'), { night: false })
    expect(ledDusk).toBeGreaterThan(backlitDay)
    expect(ledDusk).toBeLessThan(ledDusk * 2)
  })

  it('marks only the eras with a real light source as lit', () => {
    const emissive = (eraId: EraId) => planFor(eraId).stats.emissiveIntensity
    expect(emissive('1945')).toBeLessThan(0.05)
    expect(emissive('1985')).toBeGreaterThan(1)
    // 1945 is a hand-painted block: no board emits light of its own, and the
    // period's other technology — tungsten bulbs — lights the shop interiors
    // behind the glass instead.
    const wartime = planFor('1945')
    expect(wartime.stats.illuminatedSigns).toBe(0)
    expect(
      new Set(wartime.units.map((unit) => unit.signBoard.illumination)),
    ).toEqual(new Set(['painted']))
    expect(storefrontEraData('1945').secondaryIllumination).toBe('incandescent')
    // 1985 is a fully lit neon night, on tubes and backlit boxes alike.
    expect(planFor('1985').stats.illuminatedSigns).toBe(planFor('1985').stats.bayCount)
    expect(
      new Set(planFor('1985').units.map((unit) => unit.signBoard.illumination)),
    ).toEqual(new Set(['neon', 'backlit-vinyl']))
    expect(planFor('1985').stats.night).toBe(true)
    expect(planFor('2005').stats.night).toBe(false)
  })

  it('lights a day-era block when the night flag is forced on', () => {
    const day = applyEra('2005', { layout, night: false })
    const night = applyEra('2005', { layout, night: true })
    expect(day.night).toBe(false)
    expect(night.night).toBe(true)
    expect(night.stats.emissiveIntensity).toBeGreaterThan(day.stats.emissiveIntensity)
    expect(night.lighting.artificialLightColor).toBe(getEra('2005').lighting.artificialLightColor)
  })
})

/* ------------------------------------------------------------------------- *
 * Plans
 * ------------------------------------------------------------------------- */

describe('storefront plans', () => {
  it('dresses every bay of the real layout exactly once, in every era', () => {
    const bays = layout.anchors.filter((anchor) => anchor.kind === 'storefront-bay')
    expect(bays.length).toBeGreaterThan(20)
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.units).toHaveLength(bays.length)
      expect(new Set(plan.units.map((unit) => unit.anchor)).size).toBe(bays.length)
      expect(plan.stats.bareBays).toBe(0)
      expect(plan.stats.dressedBays).toBe(bays.length)
      for (const unit of plan.units) {
        expect(unit.surfaces.length).toBeGreaterThanOrEqual(2)
        expect(unit.width).toBeGreaterThan(1)
        expect(unit.height).toBeGreaterThan(2)
        expect(unit.awning.surface.purpose).toBe('awning')
        expect(unit.signBoard.surface.purpose).toBe('shop-sign')
      }
    }
  })

  it('is deterministic from the layout seed and the era id', () => {
    for (const eraId of ERA_IDS) {
      const first = planFor(eraId)
      const second = planFor(eraId)
      expect(storefrontPlanHash(second)).toBe(storefrontPlanHash(first))
      expect(JSON.stringify(second)).toBe(JSON.stringify(first))
      const other = applyEra(eraId, { layout, seed: 'other-block' })
      expect(storefrontPlanHash(other), `${eraId} other seed`).not.toBe(storefrontPlanHash(first))
    }
  })

  it('assigns every period shop type and varies the copy per bay', () => {
    for (const eraId of ERA_IDS) {
      const data = storefrontEraData(eraId)
      const plan = planFor(eraId)
      expect(Object.keys(plan.stats.shopTypeCounts).sort()).toEqual(
        data.shopTypes.map((shop) => shop.id).sort(),
      )
      const names = new Set(plan.units.map((unit) => unit.shopName))
      expect(names.size, `${eraId} distinct shop names`).toBeGreaterThan(3)
      const signTexts = new Set(
        plan.units.map((unit) => unit.signBoard.surface.lines.map((line) => line.text).join('|')),
      )
      expect(signTexts.size, `${eraId} distinct sign copy`).toBeGreaterThan(4)
    }
  })

  it('keeps one era well inside the texture budget and shrinks with quality', () => {
    for (const eraId of ERA_IDS) {
      const plan = planFor(eraId)
      expect(plan.stats.withinTextureBudget, `${eraId} budget`).toBe(true)
      expect(plan.stats.textureBytes).toBeLessThan(STOREFRONT_TEXTURE_BUDGET_BYTES)
      expect(plan.stats.uniqueTextures).toBe(plan.surfaces.length)
      expect(new Set(plan.surfaces.map((surface) => surface.textureKey)).size).toBe(
        plan.surfaces.length,
      )
      const low = applyEra(eraId, { layout, qualityTier: 'low' })
      expect(low.stats.textureBytes).toBeLessThan(plan.stats.textureBytes)
      expect(low.stats.bayCount).toBe(plan.stats.bayCount)
    }
  })

  it('reports sign palettes that come from the era registry', () => {
    for (const eraId of ERA_IDS) {
      const era = getEra(eraId)
      const plan = planFor(eraId)
      const paletteColours = new Set(Object.values(era.palette))
      for (const unit of plan.units) {
        expect(unit.signBoard.colour).toBe(era.palette.storefrontSign)
        expect(unit.frame.colour).toBe(era.palette.storefrontBody)
        expect(unit.frame.trimColour).toBe(era.palette.facadeTrim)
        expect(unit.glazing.colour).toBe(era.palette.windowGlass)
        for (const colour of unit.awning.colours) {
          expect(paletteColours.has(colour), `${eraId} awning colour ${colour}`).toBe(true)
        }
      }
      for (const placement of plan.advertising) {
        expect(paletteColours.has(placement.surface.background)).toBe(true)
        expect(placement.surface.accent).toBe(era.palette.accent)
      }
      expect(luminance('#ffffff')).toBeGreaterThan(0.9)
      expect(luminance('#000000')).toBeLessThan(0.1)
    }
  })
})
