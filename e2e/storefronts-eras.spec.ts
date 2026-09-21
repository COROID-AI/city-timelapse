/**
 * Browser verification for the era storefront, signage and advertising layer.
 *
 * The spec loads the layer's own harness page
 * (`src/city/storefronts/harness.html`) from the Vite dev server Playwright's
 * `webServer` owns. That page mounts the shipped React layer on a minimal
 * react-three-fiber canvas over the *real* canonical block, so this proof never
 * depends on the composed application.
 *
 * For each era it asserts what the mounted scene actually contains — one bay
 * group per storefront anchor, a fascia board and an awning for each, the street
 * advertising and graffiti the plan places — and that the sign materials carry
 * the era's own illumination: painted and dark in 1945, neon and fully lit in
 * 1985, backlit by day in 2005 and LED at dusk in 2025. A per-era screenshot is
 * captured as the QA visual baseline, and the page is checked to be fully
 * offline: no image, font or remote request of any kind.
 *
 * The two tests share one describe in serial mode: each mounts a software-GL
 * canvas with the whole block dressed, so running them one at a time keeps the
 * browser inside the container's memory budget without weakening the assertions.
 */

import { expect, test, type Page } from '@playwright/test'

const HARNESS_PATH = '/src/city/storefronts/harness.html'

const ERAS = ['1945', '1965', '1985', '2005', '2025'] as const

type EraId = (typeof ERAS)[number]

/** Artificial light colour of each era, from the era registry. */
const ERA_LIGHT_COLOUR: Readonly<Record<EraId, string>> = {
  '1945': '#ffb469',
  '1965': '#fff3cf',
  '1985': '#ff3ea5',
  '2005': '#fff1e0',
  '2025': '#d8f0ff',
}

/**
 * Sign technologies each era's block is built from: the period's own, plus the
 * previous generation that a minority of shops still runs.
 */
const ERA_ILLUMINATION_KINDS: Readonly<Record<EraId, readonly string[]>> = {
  '1945': ['painted'],
  '1965': ['neon', 'fluorescent'],
  '1985': ['neon', 'backlit-vinyl'],
  '2005': ['backlit-vinyl', 'fluorescent'],
  '2025': ['led', 'backlit-vinyl'],
}

interface HarnessStats {
  bayCount: number
  dressedBays: number
  bareBays: number
  shopTypeCounts: Record<string, number>
  advertisingTotal: number
  advertisingByKind: Record<string, number>
  distinctAdCopy: number
  graffitiCount: number
  graffitiState: string
  surfaceCount: number
  uniqueTextures: number
  textureBytes: number
  textureBudgetBytes: number
  withinTextureBudget: boolean
  emissiveIntensity: number
  illuminatedSigns: number
  night: boolean
  signageVocabulary: string[]
  typographyId: string
  illumination: string
}

interface HarnessScene {
  signMeshes: number
  awningMeshes: number
  unitGroups: number
  advertisingMeshes: number
  graffitiMeshes: number
  litMeshes: number
  emissiveSigns: number
  meanEmissiveIntensity: number
  maxEmissiveIntensity: number
  emissiveColour: string
  emissiveSignColour: string
  textureCount: number
}

interface HarnessTransition {
  from: string
  to: string
  t: number
  fromChildren: number
  toChildren: number
  fromVisible: number
  toVisible: number
}

interface HarnessSnapshot {
  eraId: string
  year: number
  ready: boolean
  mounted: boolean
  webgl: boolean
  sceneBacked: boolean
  night: boolean
  planHash: string
  stats: HarnessStats
  summary: unknown
  transition: HarnessTransition | null
  scene: HarnessScene
}

interface HarnessPlan {
  eraId: string
  hash: string
  stats: HarnessStats
  signTexts: string[]
  campaigns: string[]
  illuminationKinds: string[]
  emissives: number[]
}

interface HarnessHandle {
  readonly eraIds: string[]
  readonly ready: boolean
  readonly mounted: boolean
  readonly webgl: boolean
  readonly errors: string[]
  readonly snapshot: HarnessSnapshot
  setEra(eraId: string): string
  setNight(value: boolean | null): boolean | null
  setQualityTier(tier: string): string
  stageTransition(from: string, to: string, t: number): number
  settleTransition(): string
  planFor(eraId: string): HarnessPlan
}

interface HarnessWindow {
  __storefrontsHarness: HarnessHandle
}

async function readSnapshot(page: Page): Promise<HarnessSnapshot> {
  return page.evaluate(() => (window as unknown as HarnessWindow).__storefrontsHarness.snapshot)
}

async function readPlan(page: Page, eraId: string): Promise<HarnessPlan> {
  return page.evaluate(
    (era) => (window as unknown as HarnessWindow).__storefrontsHarness.planFor(era),
    eraId,
  )
}

async function openHarness(page: Page): Promise<HarnessSnapshot> {
  await page.goto(HARNESS_PATH, { waitUntil: 'load' })
  await expect(page.locator('body')).toHaveAttribute('data-storefronts-status', 'ready')
  await expect.poll(async () => (await readSnapshot(page)).mounted, { timeout: 30_000 }).toBe(true)
  return readSnapshot(page)
}

/** Selects an era and waits for the mounted scene to report that era back. */
async function showEra(page: Page, eraId: EraId): Promise<HarnessSnapshot> {
  await page.evaluate(
    (era) => (window as unknown as HarnessWindow).__storefrontsHarness.setEra(era),
    eraId,
  )
  await expect(page.locator('body')).toHaveAttribute('data-storefronts-era', eraId)
  await expect
    .poll(async () => (await readSnapshot(page)).mounted, { timeout: 30_000, message: `mounted ${eraId}` })
    .toBe(true)
  return readSnapshot(page)
}

test.describe.configure({ mode: 'serial' })

test.describe('era storefronts in the browser', () => {
  test('dresses every bay per era, lights it by period and captures screenshots', async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const remoteRequests: string[] = []
    const assetRequests: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      const url = request.url()
      if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(new URL(url).hostname)) {
        remoteRequests.push(url)
      }
      if (/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf)(\?|$)/i.test(url)) {
        assetRequests.push(url)
      }
    })

    const initial = await openHarness(page)
    test.skip(!initial.webgl, 'WebGL unavailable in this browser: the harness still publishes its plan')
    expect(initial.stats.bayCount).toBeGreaterThan(20)
    expect(initial.stats.dressedBays).toBe(initial.stats.bayCount)
    expect(initial.stats.bareBays).toBe(0)
    expect(initial.stats.withinTextureBudget).toBe(true)

    const signTexts = new Map<string, string[]>()
    const campaigns = new Map<string, string[]>()
    const shopTypes = new Map<string, string[]>()
    const advertising = new Map<string, number>()
    const graffiti = new Map<string, number>()
    const illumination = new Map<string, string>()
    const signageSignature = new Map<string, string>()
    const emissive = new Map<string, number>()

    for (const era of ERAS) {
      const eraSnapshot = await showEra(page, era)
      const { stats, scene } = eraSnapshot
      expect(eraSnapshot.sceneBacked, `${era} scene-backed`).toBe(true)
      expect(stats.bayCount, `${era} bays`).toBe(initial.stats.bayCount)

      // Exactly one dressed assembly per bay: a fascia board and an awning each.
      expect(scene.unitGroups, `${era} bay groups`).toBe(stats.bayCount)
      expect(scene.signMeshes, `${era} fascia boards`).toBe(stats.bayCount)
      expect(scene.awningMeshes, `${era} awning panels`).toBeGreaterThanOrEqual(stats.bayCount)
      expect(scene.advertisingMeshes, `${era} advertising`).toBe(stats.advertisingTotal)
      expect(scene.graffitiMeshes, `${era} graffiti`).toBe(stats.graffitiCount)
      expect(scene.textureCount, `${era} textures`).toBe(stats.surfaceCount)

      await expect(page.locator('body')).toHaveAttribute(
        'data-storefronts-signs',
        String(stats.bayCount),
      )
      await expect(page.locator('body')).toHaveAttribute(
        'data-storefronts-ads',
        String(stats.advertisingTotal),
      )

      // Illumination: the block is built from the period's own sign technology
      // plus the previous generation a minority of shops still runs, and every
      // lit board glows with that period's artificial light colour.
      const plan = await readPlan(page, era)
      expect([...plan.illuminationKinds].sort(), `${era} sign technologies`).toEqual(
        [...ERA_ILLUMINATION_KINDS[era]].sort(),
      )
      expect(plan.emissives, `${era} emissive per bay`).toHaveLength(stats.bayCount)
      if (era === '1945') {
        // A hand-painted block: no board emits light of its own in daylight.
        expect(eraSnapshot.night, '1945 is daylight').toBe(false)
        expect(scene.emissiveSigns, '1945 lit signs').toBe(0)
        expect(scene.meanEmissiveIntensity).toBeLessThan(0.05)
        expect(scene.maxEmissiveIntensity).toBeLessThan(0.1)
      } else {
        expect(scene.emissiveSigns, `${era} lit signs`).toBe(stats.bayCount)
        expect(scene.meanEmissiveIntensity).toBeGreaterThan(0)
        expect(scene.emissiveSignColour.toLowerCase(), `${era} glow colour`).toBe(
          ERA_LIGHT_COLOUR[era],
        )
      }
      if (era === '1985') {
        expect(eraSnapshot.night, '1985 is a neon night').toBe(true)
        expect(scene.maxEmissiveIntensity).toBeGreaterThan(1)
      }
      if (era === '2025') {
        expect(eraSnapshot.night, '2025 is dusk, not night').toBe(false)
        expect(scene.maxEmissiveIntensity).toBeGreaterThan(0.2)
      }
      emissive.set(era, scene.maxEmissiveIntensity)
      expect(plan.signTexts, `${era} sign copy per bay`).toHaveLength(stats.bayCount)
      expect(new Set(plan.signTexts).size, `${era} varied sign copy`).toBeGreaterThan(4)
      expect(plan.campaigns.length).toBe(stats.advertisingTotal)

      signTexts.set(era, plan.signTexts)
      campaigns.set(era, [...new Set(plan.campaigns)].sort())
      shopTypes.set(era, Object.keys(stats.shopTypeCounts).sort())
      advertising.set(era, stats.advertisingTotal)
      graffiti.set(era, stats.graffitiCount)
      illumination.set(era, stats.illumination)
      signageSignature.set(
        era,
        `${stats.illumination}|${stats.typographyId}|${stats.signageVocabulary.join(',')}`,
      )

      await page.screenshot({
        path: testInfo.outputPath(`storefronts-${era}.png`),
        animations: 'disabled',
      })
    }

    // Period identity: every adjacent era differs in shop vocabulary, sign copy,
    // advertisement campaigns, how much the street advertises and its signage.
    for (let index = 1; index < ERAS.length; index += 1) {
      const previous = ERAS[index - 1] as EraId
      const current = ERAS[index] as EraId
      expect(shopTypes.get(current), `${previous} → ${current} shops`).not.toEqual(
        shopTypes.get(previous),
      )
      expect(signTexts.get(current), `${previous} → ${current} copy`).not.toEqual(
        signTexts.get(previous),
      )
      expect(campaigns.get(current), `${previous} → ${current} campaigns`).not.toEqual(
        campaigns.get(previous),
      )
      expect(advertising.get(current), `${previous} → ${current} ad count`).not.toBe(
        advertising.get(previous),
      )
      expect(signageSignature.get(current), `${previous} → ${current} signage`).not.toBe(
        signageSignature.get(previous),
      )
    }

    // The sign technology climbs the historical ladder, era by era.
    expect(illumination.get('1945')).toBe('painted')
    expect(illumination.get('1965')).toBe('neon')
    expect(illumination.get('1985')).toBe('neon')
    expect(illumination.get('2005')).toBe('backlit-vinyl')
    expect(illumination.get('2025')).toBe('led')

    // Graffiti appears, spreads to murals and is cleaned again.
    expect(graffiti.get('1945')).toBe(0)
    expect(graffiti.get('1985')).toBeGreaterThan(graffiti.get('2005') ?? 0)

    // Emissive strength follows the period lighting rather than a fixed ladder:
    // the 1985 neon night outshines every daylight block by an order of
    // magnitude, and the 2025 LED dusk is brighter than the 2005 backlit midday.
    const neonNight = emissive.get('1985') ?? 0
    expect(neonNight).toBeGreaterThan(1)
    for (const era of ['1945', '1965', '2005', '2025'] as const) {
      expect(emissive.get(era) ?? 0, `${era} dimmer than the neon night`).toBeLessThan(neonNight)
    }
    expect(emissive.get('2025') ?? 0).toBeGreaterThan(emissive.get('2005') ?? 0)

    // Everything on screen was generated at runtime: no remote host, no image
    // or font file, one texture per distinct artwork.
    expect(remoteRequests).toEqual([])
    expect(assetRequests).toEqual([])
    expect(initial.stats.uniqueTextures).toBe(initial.stats.surfaceCount)
    expect(initial.stats.textureBytes).toBeLessThan(initial.stats.textureBudgetBytes)
    expect(consoleErrors).toEqual([])
    expect(pageErrors).toEqual([])
  })

  test('lifts the same block at night and swaps eras progressively', async ({ page }) => {
    const initial = await openHarness(page)
    test.skip(!initial.webgl, 'WebGL unavailable in this browser')

    const day = await showEra(page, '2005')
    expect(day.night).toBe(false)
    expect(day.scene.emissiveSigns).toBe(day.stats.bayCount)

    // The night flag is what drives emissive strength: same shopfronts, more light.
    await page.getByTestId('storefronts-night').click()
    await expect(page.locator('body')).toHaveAttribute('data-storefronts-night', 'true')
    await expect
      .poll(async () => (await readSnapshot(page)).scene.meanEmissiveIntensity, { timeout: 30_000 })
      .toBeGreaterThan(day.scene.meanEmissiveIntensity * 1.5)
    const night = await readSnapshot(page)
    expect(night.night).toBe(true)
    expect(night.scene.emissiveSignColour.toLowerCase()).toBe(ERA_LIGHT_COLOUR['2005'])
    expect(night.scene.signMeshes).toBe(day.scene.signMeshes)
    expect(night.stats.bayCount).toBe(day.stats.bayCount)

    await page.evaluate(() => (window as unknown as HarnessWindow).__storefrontsHarness.setNight(null))

    // A staged change mounts both eras and reveals the incoming block progressively.
    const stagedMix = await page.evaluate(() => {
      const harness = (window as unknown as HarnessWindow).__storefrontsHarness
      return harness.stageTransition('1985', '2005', 0.5)
    })
    expect(stagedMix).toBe(0.5)
    await expect(page.locator('body')).toHaveAttribute('data-storefronts-era', '2005')
    await expect
      .poll(async () => (await readSnapshot(page)).transition?.toVisible ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(0)

    const middle = await readSnapshot(page)
    const transition = middle.transition
    expect(transition).not.toBeNull()
    if (transition === null) {
      throw new Error('Expected a staged transition report')
    }
    expect(transition.from).toBe('1985')
    expect(transition.to).toBe('2005')
    expect(transition.toChildren).toBeGreaterThan(20)
    expect(transition.toVisible).toBe(Math.round(transition.toChildren / 2))
    expect(transition.fromVisible).toBe(
      transition.fromChildren - Math.round(transition.fromChildren / 2),
    )
    expect(middle.stats.illumination).toBe('backlit-vinyl')

    await page.evaluate(() => {
      const harness = (window as unknown as HarnessWindow).__storefrontsHarness
      harness.stageTransition('1985', '2005', 1)
    })
    await expect
      .poll(async () => (await readSnapshot(page)).transition?.fromVisible ?? -1, { timeout: 30_000 })
      .toBe(0)
    const finished = await readSnapshot(page)
    expect(finished.transition?.toVisible).toBe(finished.transition?.toChildren)

    await page.getByTestId('storefronts-reset').click()
    await expect.poll(async () => (await readSnapshot(page)).transition).toBeNull()
    await expect
      .poll(async () => (await readSnapshot(page)).scene.signMeshes, { timeout: 30_000 })
      .toBe(initial.stats.bayCount)
    const settled = await readSnapshot(page)
    expect(settled.stats.bayCount).toBe(initial.stats.bayCount)
    expect(settled.scene.signMeshes).toBe(settled.stats.bayCount)
    expect(settled.scene.awningMeshes).toBeGreaterThanOrEqual(settled.stats.bayCount)

    // A hand-painted era stays painted after dark: the night flag lights its
    // shop interiors, never its boards.
    await page.evaluate(() => (window as unknown as HarnessWindow).__storefrontsHarness.setNight(true))
    const wartimeNight = await showEra(page, '1945')
    expect(wartimeNight.night).toBe(true)
    expect(wartimeNight.scene.emissiveSigns).toBe(0)
    expect(wartimeNight.scene.litMeshes).toBeGreaterThan(0)
    expect(wartimeNight.scene.signMeshes).toBe(wartimeNight.stats.bayCount)
  })
})
