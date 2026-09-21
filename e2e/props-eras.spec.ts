/**
 * Browser verification for the era street-furniture layer.
 *
 * The spec loads the layer's own harness page (`src/city/props/harness.html`)
 * straight from the Vite dev server that Playwright's `webServer` owns. The page
 * mounts the real canonical block, the real props layer and a minimal
 * react-three-fiber canvas, with no dependency on the composed application.
 *
 * It asserts, per era, that the era's own prop groups are on the block, that the
 * lamp technology and its emissive state follow the era lighting data and the
 * night switch, that the placement stays legal and inside the shared budgets,
 * that a staged period change and its reduced-motion path behave as specified,
 * and it captures one screenshot per era as the QA baseline.
 */

import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'

const HARNESS_PATH = '/src/city/props/harness.html'
const ERAS = ['1945', '1965', '1985', '2005', '2025'] as const
type EraId = (typeof ERAS)[number]

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

/** Prop id each era must show, and a prop it must no longer show. */
const ERA_EXPECTATIONS: Record<
  EraId,
  { readonly technology: string; readonly present: readonly string[]; readonly absent: readonly string[] }
> = {
  '1945': {
    technology: 'gas',
    present: [
      'cast-iron-lamp',
      'early-electric-lamp',
      'fire-hydrant',
      'news-stand',
      'coal-chute',
      'hitching-post',
    ],
    absent: ['smart-pole', 'sodium-lamp', 'payphone'],
  },
  '1965': {
    technology: 'incandescent',
    present: ['incandescent-lamp', 'telephone-booth', 'bus-shelter', 'parking-meter', 'traffic-light-1960s'],
    absent: ['cast-iron-lamp', 'smart-pole', 'ev-charger'],
  },
  '1985': {
    technology: 'mercury-sodium',
    present: ['sodium-lamp', 'payphone', 'graffiti-mailbox', 'dumpster', 'boom-box', 'construction-barrier'],
    absent: ['cast-iron-lamp', 'ev-charger', 'incandescent-lamp'],
  },
  '2005': {
    technology: 'led',
    present: ['led-lamp', 'atm', 'bike-rack', 'parking-kiosk', 'security-camera'],
    absent: ['sodium-lamp', 'payphone', 'ev-charger'],
  },
  '2025': {
    technology: 'smart-pole',
    present: ['smart-pole', 'ev-charger', 'e-scooter-rack', 'parklet-bench', 'planter', 'air-quality-sensor'],
    absent: ['coal-chute', 'payphone', 'sodium-lamp'],
  },
}

interface HarnessLamp {
  readonly technology: string
  readonly colour: string
  readonly emissiveIntensity: number
  readonly glowRadius: number
  readonly light: boolean
  readonly lightIntensity: number
}

interface HarnessProp {
  readonly anchorName: string
  readonly propId: string
  readonly slot: string
  readonly category: string
  readonly band: string
  readonly mount: string
  readonly scale: number
  readonly contact: { readonly x: number; readonly z: number }
  readonly lamp: HarnessLamp | null
}

interface HarnessPlan {
  readonly props: number
  readonly triangles: number
  readonly issues: ReadonlyArray<{ readonly code: string; readonly target: string; readonly message: string }>
  readonly lamp: {
    readonly technology: string
    readonly label: string
    readonly colour: string
    readonly emissiveIntensity: number
    readonly pointLights: number
    readonly pointLightIntensity: number
  }
  readonly byCategory: Readonly<Record<string, number>>
  readonly bySlot: Readonly<Record<string, number>>
  readonly detail: Readonly<Record<string, number>>
  readonly activeProps: readonly string[]
  readonly retiredProps: readonly string[]
  readonly uniqueToEra: readonly string[]
  readonly coverage: Readonly<Record<string, { readonly expected: readonly string[]; readonly placed: readonly string[]; readonly missing: readonly string[]; readonly duplicated: readonly string[] }>>
}

interface HarnessStats {
  readonly eraId: string
  readonly propCount: number
  readonly instanceCount: number
  readonly triangles: number
  readonly drawCalls: number
  readonly recipesUsed: number
  readonly lamp: { readonly technology: string; readonly emissiveVisible: boolean; readonly pointLights: number }
  readonly coverage: { readonly anchors: number; readonly placed: number; readonly missing: readonly string[] }
  readonly issues: readonly unknown[]
}

interface HarnessTransitionFrame {
  readonly from: string
  readonly to: string
  readonly t: number
  readonly staged: boolean
  readonly counts: {
    readonly persistent: number
    readonly appearing: number
    readonly retiring: number
    readonly replaced: number
    readonly hidden: number
  }
  readonly props: ReadonlyArray<{
    readonly anchorName: string
    readonly propId: string
    readonly phase: string
    readonly source: string
    readonly weight: number
  }>
}

interface HarnessSnapshot {
  readonly eraId: string
  readonly night: boolean
  readonly nightMode: string
  readonly reducedMotion: boolean
  readonly qualityTier: string
  readonly webgl: boolean
  readonly frames: number
  readonly renderTriangles: number
  readonly renderCalls: number
  readonly plan: HarnessPlan
  readonly stats: HarnessStats | null
  readonly budgets: { readonly triangles: number; readonly drawCalls: number }
  readonly props: readonly HarnessProp[]
  readonly transitionFrame?: HarnessTransitionFrame
}

interface HarnessApi {
  readonly eras: readonly string[]
  readonly webgl: boolean
  readonly errors: readonly string[]
  readonly mounted: boolean
  readonly snapshot: HarnessSnapshot | null
  selectEra(eraId: string): void
  setLightingMode(mode: string): void
  setNight(value: boolean): void
  setReducedMotion(value: boolean): void
  setQualityTier(tier: string): void
  applyTransition(from: string, to: string, t: number): void
  planFor(eraId: string): {
    readonly eraId: string
    readonly props: number
    readonly triangles: number
    readonly issues: readonly unknown[]
    readonly lamp: { readonly technology: string }
    readonly activeProps: readonly string[]
  }
}

declare global {
  interface Window {
    __propsHarness?: HarnessApi
  }
}

function isExternalRequest(request: Request): boolean {
  let url: URL
  try {
    url = new URL(request.url())
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  return !LOCAL_HOSTNAMES.has(url.hostname)
}

async function readSnapshot(page: Page): Promise<HarnessSnapshot> {
  const snapshot = await page.evaluate(() => window.__propsHarness?.snapshot ?? null)
  expect(snapshot, 'harness published a snapshot').not.toBeNull()
  return snapshot as HarnessSnapshot
}

async function openHarness(page: Page): Promise<void> {
  const response = await page.goto(HARNESS_PATH, { waitUntil: 'load' })
  expect(response?.status(), 'harness document responds successfully').toBe(200)
  await expect(page.locator('body')).toHaveAttribute('data-props-status', 'ready')
  await expect(page.getByTestId('props-viewport')).toBeVisible()
}

test.describe('era street furniture harness', () => {
  test('renders every era with its own props, lamp type and emissive state', async ({ page }, testInfo) => {
    await openHarness(page)
    const api = await page.evaluate(() => ({
      eras: window.__propsHarness?.eras ?? [],
      custom: Boolean(window.__propsHarness),
    }))
    expect(api.custom, 'harness API is published').toBe(true)
    expect(api.eras).toEqual([...ERAS])

    for (const eraId of ERAS) {
      await page.evaluate((era) => window.__propsHarness?.selectEra(era), eraId)
      await expect(page.locator('body')).toHaveAttribute('data-props-era', eraId)
      const snapshot = await readSnapshot(page)

      expect(snapshot.eraId, `selected era ${eraId}`).toBe(eraId)
      expect(snapshot.plan.props, `${eraId} prop count`).toBeGreaterThan(40)
      expect(snapshot.plan.issues, `${eraId} plan issues`).toEqual([])

      // Coverage: every anchor category is populated exactly once.
      for (const entry of Object.values(snapshot.plan.coverage)) {
        expect(entry.missing, `${eraId} missing anchors`).toEqual([])
        expect(entry.duplicated, `${eraId} duplicate anchors`).toEqual([])
        expect(entry.placed.length).toBe(entry.expected.length)
      }

      // Era-specific prop groups.
      const propIds = new Set(snapshot.props.map((prop) => prop.propId))
      for (const expected of ERA_EXPECTATIONS[eraId].present) {
        expect([...propIds], `${eraId} shows ${expected}`).toContain(expected)
      }
      for (const absent of ERA_EXPECTATIONS[eraId].absent) {
        expect([...propIds], `${eraId} no longer shows ${absent}`).not.toContain(absent)
      }

      // Prop families: lighting, signals, furniture, utility detail and clutter.
      for (const category of ['lighting', 'signals', 'furniture', 'utility', 'clutter']) {
        expect(snapshot.plan.byCategory[category] ?? 0, `${eraId} has ${category}`).toBeGreaterThan(0)
      }
      for (const detail of ['drain', 'grate', 'vent', 'drainpipe', 'awning-frame', 'patch', 'pile']) {
        expect(snapshot.plan.detail[detail] ?? 0, `${eraId} has ${detail} detail`).toBeGreaterThan(0)
      }

      // Lamp technology and emissive state.
      expect(snapshot.plan.lamp.technology, `${eraId} lamp technology`).toBe(
        ERA_EXPECTATIONS[eraId].technology,
      )
      const lamps = snapshot.props.filter((prop) => prop.lamp !== null)
      expect(lamps.length, `${eraId} lamps`).toBeGreaterThan(0)
      for (const lamp of lamps) {
        expect(lamp.lamp?.technology, `${eraId} ${lamp.propId} technology`).toBe(
          ERA_EXPECTATIONS[eraId].technology,
        )
        expect(lamp.lamp?.emissiveIntensity ?? 0, `${eraId} ${lamp.propId} emission`).toBeGreaterThan(0)
      }
      expect(snapshot.plan.lamp.emissiveIntensity, `${eraId} peak emission`).toBeGreaterThan(0)
      expect(Number(await page.locator('body').getAttribute('data-props-emissive'))).toBeGreaterThan(0)

      // Budgets.
      const stats = snapshot.stats
      if (stats !== null) {
        expect(stats.drawCalls, `${eraId} draw calls`).toBeLessThanOrEqual(snapshot.budgets.drawCalls)
        expect(stats.triangles, `${eraId} triangles`).toBeLessThanOrEqual(snapshot.budgets.triangles)
        expect(stats.coverage.missing, `${eraId} mounted coverage`).toEqual([])
        expect(stats.instanceCount).toBeGreaterThanOrEqual(stats.propCount)
      }

      await page.screenshot({
        path: testInfo.outputPath(`props-${eraId}.png`),
        fullPage: false,
      })
    }

    // The night era is the one that lights its street for real.
    await page.evaluate(() => window.__propsHarness?.selectEra('1985'))
    const night = await readSnapshot(page)
    expect(night.night).toBe(true)
    expect(night.nightMode).toBe('auto')
    expect(night.plan.lamp.pointLights).toBeGreaterThan(0)
    expect(night.plan.lamp.pointLightIntensity).toBeGreaterThan(0)

    // Forcing a daylight era to night relights it…
    await page.evaluate(() => window.__propsHarness?.selectEra('1965'))
    const day = await readSnapshot(page)
    expect(day.night).toBe(false)
    expect(day.plan.lamp.pointLights).toBe(0)
    await page.evaluate(() => window.__propsHarness?.setLightingMode('night'))
    await expect(page.locator('body')).toHaveAttribute('data-props-era', '1965')
    await expect(page.locator('body')).toHaveAttribute('data-props-night-mode', 'night')
    const forcedNight = await readSnapshot(page)
    expect(forcedNight.night).toBe(true)
    expect(forcedNight.plan.lamp.emissiveIntensity).toBeGreaterThan(day.plan.lamp.emissiveIntensity)
    expect(forcedNight.plan.lamp.pointLights).toBeGreaterThan(0)

    // …and forcing the night era into daylight dims it and drops its lights.
    await page.evaluate(() => window.__propsHarness?.selectEra('1985'))
    await page.evaluate(() => window.__propsHarness?.setLightingMode('day'))
    const forcedDay = await readSnapshot(page)
    expect(forcedDay.night).toBe(false)
    expect(forcedDay.plan.lamp.emissiveIntensity).toBeLessThan(night.plan.lamp.emissiveIntensity)
    expect(forcedDay.plan.lamp.pointLights).toBe(0)
    await page.evaluate(() => window.__propsHarness?.setLightingMode('auto'))
    const restored = await readSnapshot(page)
    expect(restored.night).toBe(true)
  })

  test('stages a period change and swaps instantly under reduced motion', async ({ page }, testInfo) => {
    await openHarness(page)

    await page.evaluate(() => window.__propsHarness?.applyTransition('1945', '1985', 0.5))
    await expect(page.locator('body')).toHaveAttribute('data-props-era', '1985')
    const midway = await readSnapshot(page)
    const frame = midway.transitionFrame
    expect(frame, 'transition frame is published').toBeDefined()
    expect(frame?.staged).toBe(true)
    expect(frame?.from).toBe('1945')
    expect(frame?.to).toBe('1985')
    expect(Math.abs((frame?.t ?? 0) - 0.5)).toBeLessThan(0.001)
    expect(frame?.counts.replaced ?? 0).toBeGreaterThan(0)
    expect(frame?.counts.persistent ?? 0).toBeGreaterThan(0)
    const partial = (frame?.props ?? []).filter((prop) => prop.weight > 0 && prop.weight < 1)
    expect(partial.length, 'props mid-apparition').toBeGreaterThan(0)
    const retiring = (frame?.props ?? []).filter((prop) => prop.phase === 'retiring')
    expect(retiring.length).toBeGreaterThan(0)

    await page.screenshot({ path: testInfo.outputPath('props-transition-midway.png') })

    // Reduced motion collapses the schedule to a single swap.
    await page.evaluate(() => window.__propsHarness?.setReducedMotion(true))
    await page.evaluate(() => window.__propsHarness?.applyTransition('1945', '1985', 0.25))
    const early = await readSnapshot(page)
    expect(early.reducedMotion).toBe(true)
    expect(early.transitionFrame?.staged).toBe(false)
    expect((early.transitionFrame?.props ?? []).filter((prop) => prop.weight > 0 && prop.weight < 1)).toEqual([])

    await page.evaluate(() => window.__propsHarness?.applyTransition('1945', '1985', 0.75))
    const late = await readSnapshot(page)
    expect(late.transitionFrame?.staged).toBe(false)
    expect((late.transitionFrame?.props ?? []).every((prop) => prop.source !== 'to' || prop.weight === 1)).toBe(true)

    // Settling returns to a single era at full weight.
    await page.evaluate(() => window.__propsHarness?.selectEra('2025'))
    const settled = await readSnapshot(page)
    expect(settled.eraId).toBe('2025')
    expect(settled.transitionFrame).toBeUndefined()
    expect(settled.plan.issues).toEqual([])
    await page.evaluate(() => window.__propsHarness?.setReducedMotion(false))
  })

  test('publishes legal, era-specific plans without needing the renderer', async ({ page }) => {
    await openHarness(page)
    const plans = await page.evaluate((eras) => eras.map((era) => window.__propsHarness?.planFor(era)), [
      ...ERAS,
    ])
    expect(plans).toHaveLength(ERAS.length)
    plans.forEach((plan, index) => {
      const eraId = ERAS[index] as EraId
      expect(plan, `${eraId} plan`).not.toBeNull()
      expect(plan?.issues, `${eraId} issues`).toEqual([])
      expect(plan?.props ?? 0).toBeGreaterThan(40)
      expect(plan?.lamp.technology).toBe(ERA_EXPECTATIONS[eraId].technology)
      for (const expected of ERA_EXPECTATIONS[eraId].present) {
        expect(plan?.activeProps ?? [], `${eraId} places ${expected}`).toContain(expected)
      }
    })
    // Adjacent eras place different things.
    const signatures = plans.map((plan) => [...(plan?.activeProps ?? [])].sort().join('|'))
    expect(new Set(signatures).size).toBe(ERAS.length)
  })

  test('renders the block and stays offline', async ({ page }, testInfo) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const externalRequests: string[] = []
    page.on('console', (message: ConsoleMessage) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error: Error) => pageErrors.push(error.message))
    page.on('request', (request: Request) => {
      if (isExternalRequest(request)) {
        externalRequests.push(request.url())
      }
    })

    await openHarness(page)

    const webgl = await page.evaluate(
      () =>
        (window.__propsHarness?.webgl ?? false) &&
        (document.createElement('canvas').getContext('webgl2') !== null ||
          document.createElement('canvas').getContext('webgl') !== null),
    )
    test.skip(!webgl, 'WebGL unavailable in this browser')

    await expect(page.locator('body')).toHaveAttribute('data-props-webgl', 'true')
    await expect(page.getByTestId('props-viewport').locator('canvas')).toHaveCount(1)

    const first = await readSnapshot(page)
    await page.waitForTimeout(300)
    const later = await readSnapshot(page)
    expect(later.frames, 'the render loop advances').toBeGreaterThan(first.frames)
    expect(later.renderCalls, 'the layer draws').toBeGreaterThan(0)

    const harnessErrors = await page.evaluate(() => window.__propsHarness?.errors ?? [])
    expect(harnessErrors, 'harness reported no runtime problems').toEqual([])
    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
    expect(externalRequests, 'no remote asset or font requests').toEqual([])

    await page.evaluate(() => window.__propsHarness?.selectEra('2025'))
    await expect(page.locator('body')).toHaveAttribute('data-props-era', '2025')
    await page.screenshot({ path: testInfo.outputPath('props-render-2025.png') })
  })
})
