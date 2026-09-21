/**
 * Browser verification for the era building layer.
 *
 * The spec loads the layer's own harness page (`src/city/buildings/harness.html`)
 * from the Vite dev server Playwright's `webServer` owns. The page mounts the
 * real block plus the real layer through a minimal react-three-fiber canvas and
 * exposes an era selector, a blend slider and the layer statistics, so this
 * proof never depends on the composed application.
 *
 * It asserts the per-era scene graph (building, facade, roof-kit, lot and
 * construction group counts), the era roof-kit vocabulary, the night-only
 * window glow, the per-era screenshots used as the QA baseline, the anchored
 * frontage, the blend interpolation and the offline/deterministic behaviour.
 */

import { expect, test, type ConsoleMessage, type Page, type Request, type TestInfo } from '@playwright/test'

const HARNESS_PATH = '/src/city/buildings/harness.html'
const ERA_IDS = ['1945', '1965', '1985', '2005', '2025'] as const

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

interface GroupCount {
  meshCount: number
  triangles: number
}

interface BuildingsStats {
  eraId: string
  night: boolean
  parcelCount: number
  buildingCount: number
  vacantLotCount: number
  constructionCount: number
  heightMin: number
  heightMax: number
  heightMean: number
  floorsMin: number
  floorsMax: number
  floorsMean: number
  footprintAreaMean: number
  windowCount: number
  facadeEdgeCount: number
  masonryCourseCount: number
  spandrelBandCount: number
  mullionCount: number
  balconyCount: number
  roofKitCount: number
  roofKitsByKit: Record<string, number>
  addOnCount: number
  addOnsByKind: Record<string, number>
  addOnMeshCount: number
  frontageClearanceCount: number
  anchorCount: number
  triangleEstimate: number
  meshCount: number
  drawCallEstimate: number
  windowEmissiveIntensity: number
  triangleBudget: number
  drawCallBudget: number
}

interface PlotSnapshot {
  parcelId: string
  state: string
  facing: string[]
  height: number
  floors: number
  footprintArea: number
  windows: number
  frontage: number
  addOns: number
  edgeCount: number
  anchors: string[]
}

interface BuildingsSnapshot {
  eraId: string
  fromEra: string
  toEra: string
  progress: number
  transitioning: boolean
  night: boolean
  stats: BuildingsStats
  groups: Record<string, GroupCount>
  meshCount: number
  triangleCount: number
  instancedMeshCount: number
  meshNames: string[]
  roofKits: Record<string, number>
  addOns: Record<string, number>
  emissive: { glass: number; mass: number }
  materials: string[]
  plots: PlotSnapshot[]
  anchorsUsed: string[]
  parcelCount: number
  anchorCatalogueSize: number
  layoutHash: string
  deterministic: boolean
  fingerprints: Record<string, number>
  textures: string[]
  webgl: boolean
  errors: string[]
}

interface BuildingsHarnessApi {
  webgl: boolean
  errors: string[]
  snapshot: BuildingsSnapshot | null
  eras: string[]
  eraTable: Array<{ id: string; year: number; label: string }>
  selectEra(eraId: string): BuildingsSnapshot | null
  setBlend(from: string, to: string, t: number): BuildingsSnapshot | null
  stats(): BuildingsStats | null
  render(): { triangles: number; calls: number; frame: number }
}

/** Add-ons each era must show, matching the acceptance criteria. */
const ERA_ADD_ON_VOCABULARY: Record<string, string[]> = {
  '1945': ['coal-chimney', 'water-tank', 'fire-escape'],
  '1965': ['roof-signage', 'roof-vent'],
  '1985': ['window-ac', 'antenna', 'satellite-dish', 'roof-ac-unit'],
  '2005': ['mechanical-penthouse', 'roof-deck'],
  '2025': ['solar-array', 'green-roof', 'roof-deck'],
}

function isExternalRequest(request: Request): boolean {
  let url: URL
  try {
    url = new URL(request.url())
  } catch {
    return false
  }
  return !(LOCAL_HOSTNAMES.has(url.hostname) || url.protocol === 'data:' || url.protocol === 'blob:')
}

async function readSnapshot(page: Page): Promise<BuildingsSnapshot> {
  const snapshot = await page.evaluate(
    () => (window as unknown as { __buildingsHarness?: BuildingsHarnessApi }).__buildingsHarness?.snapshot ?? null,
  )
  expect(snapshot, 'harness published a buildings snapshot').not.toBeNull()
  return snapshot as BuildingsSnapshot
}

async function selectEra(page: Page, eraId: string): Promise<BuildingsSnapshot> {
  const snapshot = await page.evaluate(
    (era) =>
      (window as unknown as { __buildingsHarness: BuildingsHarnessApi }).__buildingsHarness.selectEra(era),
    eraId,
  )
  expect(snapshot).not.toBeNull()
  return snapshot as BuildingsSnapshot
}

async function captureEra(testInfo: TestInfo, page: Page, eraId: string): Promise<Buffer> {
  const shot = await page.screenshot()
  await testInfo.attach(`buildings-${eraId}`, { body: shot, contentType: 'image/png' })
  return shot
}

test.describe('era building layer harness', () => {
  test('mounts every era, reports the scene graph and captures the QA baseline', async ({
    page,
  }, testInfo) => {
    // Five era rebuilds plus five full-page screenshots exceed the default budget
    // on a software-rasterised WebGL context.
    test.slow()
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

    const response = await page.goto(HARNESS_PATH, { waitUntil: 'load' })
    expect(response?.status(), 'harness document responds successfully').toBe(200)

    const body = page.locator('body')
    await expect(body).toHaveAttribute('data-buildings-status', 'ready')
    await expect(body).toHaveAttribute('data-buildings-deterministic', 'true')
    await expect(page.getByTestId('buildings-summary')).toContainText(/buildings/i)
    await expect(page.getByTestId('buildings-report')).toContainText('per parcel:')

    const harnessErrors = await page.evaluate(
      () => (window as unknown as { __buildingsHarness?: BuildingsHarnessApi }).__buildingsHarness?.errors ?? [],
    )
    expect(harnessErrors, 'harness reported no runtime problems').toEqual([])
    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
    expect(externalRequests, 'no remote asset or font requests').toEqual([])

    const eras = await page.evaluate(
      () => (window as unknown as { __buildingsHarness: BuildingsHarnessApi }).__buildingsHarness.eras,
    )
    expect(eras).toEqual([...ERA_IDS])
    for (const eraId of ERA_IDS) {
      await expect(page.getByTestId(`buildings-era-${eraId}`)).toHaveCount(1)
    }

    const perEra: BuildingsSnapshot[] = []
    for (const eraId of ERA_IDS) {
      await page.getByTestId(`buildings-era-${eraId}`).click()
      await expect(body).toHaveAttribute('data-buildings-era', eraId)
      const snapshot = await readSnapshot(page)
      perEra.push(snapshot)

      const stats = snapshot.stats
      expect(snapshot.eraId).toBe(eraId)
      expect(snapshot.progress).toBe(0)
      expect(snapshot.fromEra).toBe(eraId)
      expect(snapshot.toEra).toBe(eraId)
      expect(snapshot.transitioning).toBe(false)
      expect(snapshot.stats.eraId).toBe(eraId)
      expect(snapshot.deterministic).toBe(true)
      expect(Object.keys(snapshot.fingerprints).sort()).toEqual([...ERA_IDS].sort())

      // Every parcel resolves to exactly one state.
      expect(snapshot.parcelCount).toBe(16)
      expect(snapshot.plots).toHaveLength(16)
      expect(stats.parcelCount).toBe(16)
      expect(stats.buildingCount + stats.vacantLotCount + stats.constructionCount).toBe(16)
      expect(new Set(snapshot.plots.map((plot) => plot.parcelId)).size).toBe(16)
      for (const plot of snapshot.plots) {
        expect(['building', 'vacant-lot', 'construction']).toContain(plot.state)
        if (plot.state === 'building') {
          expect(plot.height).toBeGreaterThan(0)
          expect(plot.floors).toBeGreaterThan(1)
          expect(plot.windows).toBeGreaterThan(0)
          expect(plot.edgeCount).toBeGreaterThan(0)
          // Street-facing parcels leave their retail frontage clear; interior
          // parcels have no shopfronts to leave clear.
          if (plot.facing.length > 0) {
            expect(plot.frontage).toBeGreaterThan(0)
          } else {
            expect(plot.frontage).toBe(0)
          }
        } else {
          expect(plot.height).toBe(0)
          expect(plot.windows).toBe(0)
        }
      }

      // The mounted scene graph matches the declared plan.
      expect(snapshot.groups.masses?.meshCount).toBe(stats.buildingCount)
      expect(snapshot.groups.facades?.meshCount).toBe(stats.buildingCount)
      expect(snapshot.groups['roof-kits']?.meshCount).toBe(stats.roofKitCount)
      expect(snapshot.groups.lots?.meshCount).toBe(stats.vacantLotCount)
      expect(snapshot.groups.construction?.meshCount).toBe(stats.constructionCount)
      expect(snapshot.groups['add-ons']?.meshCount).toBe(stats.addOnMeshCount)
      expect(snapshot.meshCount).toBeGreaterThan(0)
      expect(snapshot.meshCount).toBeLessThanOrEqual(stats.drawCallBudget)
      expect(snapshot.triangleCount).toBeGreaterThan(500)
      expect(snapshot.triangleCount).toBeLessThanOrEqual(stats.triangleBudget)
      expect(snapshot.instancedMeshCount).toBeGreaterThanOrEqual(0)
      expect(new Set(snapshot.meshNames).size).toBe(snapshot.meshNames.length)

      // Named meshes address every state.
      for (const plot of snapshot.plots) {
        if (plot.state === 'building') {
          expect(snapshot.meshNames).toContain(`building:${plot.parcelId}:mass`)
          expect(snapshot.meshNames).toContain(`building:${plot.parcelId}:facade`)
          expect(snapshot.meshNames).toContain(`building:${plot.parcelId}:roof`)
        } else if (plot.state === 'vacant-lot') {
          expect(snapshot.meshNames).toContain(`lot:${plot.parcelId}`)
        } else {
          expect(snapshot.meshNames).toContain(`construction:${plot.parcelId}`)
        }
      }

      // Era roof kit vocabulary.
      for (const kind of ERA_ADD_ON_VOCABULARY[eraId] ?? []) {
        expect(snapshot.addOns[kind], `${eraId} places ${kind}`).toBeGreaterThan(0)
      }
      expect(stats.roofKitsByKit[Object.keys(stats.roofKitsByKit).find((kit) => stats.roofKitsByKit[kit] === stats.buildingCount) ?? ''] ?? 0).toBe(stats.buildingCount)

      // Window glow follows the era's own night flag.
      if (eraId === '1985') {
        expect(stats.night).toBe(true)
        expect(snapshot.emissive.glass).toBeGreaterThan(0)
      } else {
        expect(stats.night).toBe(false)
        expect(snapshot.emissive.glass).toBe(0)
      }
      expect(snapshot.emissive.mass).toBe(0)

      // The procedural texture factory ran for every surface of the era.
      expect(snapshot.textures).toHaveLength(4)
      expect(snapshot.textures.every((id) => id.includes(eraId))).toBe(true)
      expect(snapshot.materials).toHaveLength(8)
      expect(snapshot.anchorsUsed.length).toBeGreaterThan(10)
      expect(snapshot.anchorCatalogueSize).toBeGreaterThan(snapshot.anchorsUsed.length)

      await expect(body).toHaveAttribute('data-buildings-meshes', String(snapshot.meshCount))
      await expect(body).toHaveAttribute('data-buildings-triangles', String(snapshot.triangleCount))

      await captureEra(testInfo, page, eraId)
    }

    // Adjacent eras differ measurably in massing, windows and scene cost.
    for (let index = 1; index < perEra.length; index += 1) {
      const previous = perEra[index - 1] as BuildingsSnapshot
      const current = perEra[index] as BuildingsSnapshot
      expect(current.stats.heightMean, `${previous.eraId} -> ${current.eraId} height`).toBeGreaterThan(
        previous.stats.heightMean,
      )
      expect(current.stats.windowCount, `${previous.eraId} -> ${current.eraId} windows`).not.toBe(
        previous.stats.windowCount,
      )
      expect(current.stats.meshCount).not.toBe(previous.stats.meshCount)
    }
    const last = perEra[perEra.length - 1] as BuildingsSnapshot
    const first = perEra[0] as BuildingsSnapshot
    expect(last.triangleCount).toBeGreaterThan(first.triangleCount * 2)
    expect(last.stats.heightMean).toBeGreaterThan(first.stats.heightMean * 3)

    // Heading back to the first era restores its exact numbers.
    const restored = await selectEra(page, '1945')
    expect(restored.stats).toEqual(first.stats)
  })

  test('cross-fades two eras through a staged blend and settles instantly', async ({ page }) => {
    await page.goto(HARNESS_PATH, { waitUntil: 'load' })
    await expect(page.locator('body')).toHaveAttribute('data-buildings-status', 'ready')

    const from = await selectEra(page, '1945')
    const to = await selectEra(page, '2025')

    const blend = async (t: number): Promise<BuildingsSnapshot> =>
      (await page.evaluate(
        (value) =>
          (window as unknown as { __buildingsHarness: BuildingsHarnessApi }).__buildingsHarness.setBlend(
            '1945',
            '2025',
            value,
          ),
        t,
      )) as BuildingsSnapshot

    const atZero = await blend(0)
    const atHalf = await blend(0.5)
    await expect(page.locator('body')).toHaveAttribute('data-buildings-progress', '0.5')
    const atOne = await blend(1)

    expect(atZero.progress).toBe(0)
    expect(atZero.stats.heightMean).toBe(from.stats.heightMean)
    expect(atOne.progress).toBe(1)
    expect(atOne.stats.heightMean).toBe(to.stats.heightMean)
    expect(atHalf.progress).toBe(0.5)
    expect(atHalf.stats.heightMean).toBeGreaterThan(from.stats.heightMean)
    expect(atHalf.stats.heightMean).toBeLessThan(to.stats.heightMean)
    expect(atHalf.stats.windowCount).toBeGreaterThan(from.stats.windowCount)
    expect(atHalf.stats.windowCount).toBeLessThan(to.stats.windowCount)
    expect(atHalf.transitioning).toBe(true)
    expect(atHalf.fromEra).toBe('1945')
    expect(atHalf.toEra).toBe('2025')
    await expect(page.locator('body')).toHaveAttribute('data-buildings-progress', '1')

    // A staged blend into the night era switches the window glow on.
    const intoNight = (await page.evaluate(() =>
      (window as unknown as { __buildingsHarness: BuildingsHarnessApi }).__buildingsHarness.setBlend(
        '1945',
        '1985',
        0.5,
      ),
    )) as BuildingsSnapshot
    expect(intoNight.night).toBe(true)
    expect(intoNight.stats.windowEmissiveIntensity).toBeGreaterThan(0)

    // Settling collapses the blend to one mounted era.
    await blend(0.5)
    await page.getByTestId('buildings-blend-settle').click()
    await expect(page.locator('body')).toHaveAttribute('data-buildings-progress', '0')
    const settled = await readSnapshot(page)
    expect(settled.transitioning).toBe(false)
    expect(settled.eraId).toBe('2025')
    expect(settled.stats.heightMean).toBe(to.stats.heightMean)
  })

  test('renders the layer with the react-three-fiber harness canvas', async ({ page }, testInfo) => {
    test.slow()
    await page.goto(HARNESS_PATH, { waitUntil: 'load' })
    await expect(page.locator('body')).toHaveAttribute('data-buildings-status', 'ready')

    const webgl = await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas')
        return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null
      } catch {
        return false
      }
    })
    test.skip(!webgl, 'WebGL unavailable in this browser')

    await expect(page.locator('body')).toHaveAttribute('data-buildings-webgl', 'true')
    const viewport = page.getByTestId('buildings-viewport')
    await expect(viewport.locator('canvas')).toHaveCount(1)

    const drawn = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return { width: canvas?.width ?? 0, height: canvas?.height ?? 0 }
    })
    expect(drawn.width).toBeGreaterThan(0)
    expect(drawn.height).toBeGreaterThan(0)

    // Switching eras redraws the same canvas with the new geometry.
    const shots = new Map<string, Buffer>()
    for (const eraId of ['1945', '1985', '2025'] as const) {
      await page.getByTestId(`buildings-era-${eraId}`).click()
      await expect(page.locator('body')).toHaveAttribute('data-buildings-era', eraId)
      await expect(viewport.locator('canvas')).toHaveCount(1)
      const drawn = await page.evaluate(
        () => (window as unknown as { __buildingsHarness: BuildingsHarnessApi }).__buildingsHarness.render(),
      )
      expect(drawn.triangles, `${eraId} drew triangles`).toBeGreaterThan(500)
      expect(drawn.calls).toBeGreaterThan(0)
      expect(drawn.frame).toBeGreaterThan(0)
      shots.set(eraId, await captureEra(testInfo, page, `render-${eraId}`))
    }
    // The five eras are visibly different images, not the same frame relabelled.
    expect(shots.get('1945')?.equals(shots.get('1985') as Buffer)).toBe(false)
    expect(shots.get('1985')?.equals(shots.get('2025') as Buffer)).toBe(false)

    const stillRunning = await page.evaluate(
      () => (window as unknown as { __buildingsHarness: BuildingsHarnessApi }).__buildingsHarness.snapshot?.triangleCount ?? 0,
    )
    expect(stillRunning).toBeGreaterThan(500)
  })
})
