/**
 * Browser verification for the canonical block layout.
 *
 * The spec loads the layout's own harness page (`src/city/layout/harness.html`)
 * straight from the Vite dev server that Playwright's `webServer` owns. The page
 * mounts the generated block meshes with a minimal three.js renderer, so this
 * proof never depends on the render pipeline or the composed application.
 *
 * It asserts the named mesh groups and counts for the fixed seed, that the
 * layout is inside its triangle budget, that the anchor catalogue and splines
 * are complete, that the page logs nothing and stays offline, and that the
 * browser reproduces the layout byte for byte for the same seed while producing
 * a different, still valid block for another seed.
 */

import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'

const CANONICAL_SEED = 'city-block'
const ALTERNATE_SEED = 'city-block-alternate'
const HARNESS_PATH = '/src/city/layout/harness.html'

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

interface HarnessGroupCount {
  meshCount: number
  triangles: number
}

interface HarnessSnapshot {
  seed: string
  hash: string
  deterministic: boolean
  version: number
  tier: string
  detail: number
  triangleCount: number
  triangleBudget: number
  meshCount: number
  groups: Record<string, HarnessGroupCount>
  meshes: string[]
  parcels: Array<{
    id: string
    facing: string[]
    corner: string | null
    bays: number
    footprintArea: number
    floors: number
    maxHeight: number
  }>
  anchors: { total: number; byKind: Record<string, number>; names: string[] }
  splines: Array<{
    name: string
    kind: string
    role: string
    closed: boolean
    sampleCount: number
    sampleSpacing: number
    length: number
  }>
  crossings: Array<{ name: string; spline: string; waitingPoints: number; crossingPoints: number }>
  utilityLines: number
}

interface HarnessRebuild {
  seed: string
  hash: string
  deterministic: boolean
  triangleCount: number
  triangleBudget: number
  meshCount: number
  groups: Record<string, HarnessGroupCount>
  meshes: string[]
}

interface HarnessApi {
  webgl: boolean
  errors: string[]
  snapshot: HarnessSnapshot | null
  rebuild(seed: string): HarnessRebuild
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
  const snapshot = await page.evaluate(() => {
    const harness = (window as unknown as { __layoutHarness?: HarnessApi }).__layoutHarness
    return harness?.snapshot ?? null
  })
  expect(snapshot, 'harness published a layout snapshot').not.toBeNull()
  return snapshot as HarnessSnapshot
}

/** Groups the layout must ship, with the counts the fixed seed produces. */
const EXPECTED_GROUPS: Record<string, number> = {
  parcels: 16,
  roads: 12,
  'lane-strips': 28,
  'parking-strips': 16,
  sidewalks: 8,
  curbs: 4,
  crosswalks: 8,
  drainage: 24,
}

test.describe('city block layout harness', () => {
  test('mounts the generated block and reports every named mesh group', async ({ page }) => {
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
    await expect(body).toHaveAttribute('data-layout-status', 'ready')
    await expect(body).toHaveAttribute('data-layout-seed', CANONICAL_SEED)
    await expect(page.getByTestId('layout-summary')).toContainText(/deterministic yes/i)
    await expect(page.getByTestId('layout-report')).toContainText('mesh groups:')

    const harnessErrors = await page.evaluate(
      () => (window as unknown as { __layoutHarness?: HarnessApi }).__layoutHarness?.errors ?? [],
    )
    expect(harnessErrors, 'harness reported no runtime problems').toEqual([])
    expect(pageErrors, 'no uncaught page errors').toEqual([])
    expect(consoleErrors, 'no console errors').toEqual([])
    expect(externalRequests, 'no remote asset or font requests').toEqual([])

    const snapshot = await readSnapshot(page)
    expect(snapshot.seed).toBe(CANONICAL_SEED)
    expect(snapshot.deterministic).toBe(true)
    expect(snapshot.version).toBe(1)
    expect(snapshot.tier).toBe('high')

    for (const [group, meshCount] of Object.entries(EXPECTED_GROUPS)) {
      expect(snapshot.groups[group], `group ${group} exists`).toBeDefined()
      expect(snapshot.groups[group]?.meshCount, `group ${group} mesh count`).toBe(meshCount)
      expect(snapshot.groups[group]?.triangles, `group ${group} triangle count`).toBeGreaterThan(0)
    }

    expect(snapshot.meshCount).toBe(Object.values(EXPECTED_GROUPS).reduce((total, count) => total + count, 0))
    expect(snapshot.meshes).toHaveLength(snapshot.meshCount)
    expect(new Set(snapshot.meshes).size).toBe(snapshot.meshCount)
    for (const name of [
      'surface:road:north',
      'surface:road:intersection:north-east',
      'surface:road:apron:north-west',
      'surface:sidewalk:north',
      'surface:sidewalk:corner:north-east',
      'curb:north',
      'crosswalk:north-east:north',
      'street:north:lane:0',
      'street:north:parking:0',
      'manhole:north:1',
      'drain:north:1',
    ]) {
      expect(snapshot.meshes, `${name} is mounted`).toContain(name)
    }

    expect(snapshot.triangleCount).toBeGreaterThan(500)
    expect(snapshot.triangleCount).toBeLessThanOrEqual(snapshot.triangleBudget)
    const summed = Object.values(snapshot.groups).reduce((total, entry) => total + entry.triangles, 0)
    expect(summed).toBe(snapshot.triangleCount)
  })

  test('exposes parcels, anchors, splines and crossings for content layers', async ({ page }) => {
    await page.goto(HARNESS_PATH, { waitUntil: 'load' })
    await expect(page.locator('body')).toHaveAttribute('data-layout-status', 'ready')
    const snapshot = await readSnapshot(page)

    expect(snapshot.parcels).toHaveLength(16)
    for (const parcel of snapshot.parcels) {
      expect(parcel.bays).toBeGreaterThanOrEqual(0)
      expect(parcel.floors).toBeGreaterThan(0)
      expect(parcel.footprintArea).toBeGreaterThan(0)
      expect(parcel.maxHeight).toBeGreaterThan(0)
    }
    expect(snapshot.parcels.filter((parcel) => parcel.facing.length > 0)).toHaveLength(12)
    expect(snapshot.parcels.filter((parcel) => parcel.corner !== null)).toHaveLength(4)
    expect(snapshot.parcels.filter((parcel) => parcel.corner === null && parcel.bays === 0)).toHaveLength(4)

    expect(snapshot.anchors.total).toBe(snapshot.anchors.names.length)
    expect(new Set(snapshot.anchors.names).size).toBe(snapshot.anchors.total)
    for (const kind of [
      'storefront-bay',
      'sign-mount',
      'prop-point',
      'light-post',
      'signal-head',
      'hydrant',
      'utility-endpoint',
      'parking-bay',
      'inspection-focus',
    ]) {
      expect(snapshot.anchors.byKind[kind], `anchor kind ${kind}`).toBeGreaterThan(0)
    }
    expect(snapshot.anchors.names).toContain('street:north:light:3')
    expect(snapshot.utilityLines).toBe(12)

    expect(snapshot.splines).toHaveLength(14)
    expect(snapshot.splines.filter((spline) => spline.kind === 'vehicle')).toHaveLength(5)
    expect(snapshot.splines.filter((spline) => spline.role === 'sidewalk-loop')).toHaveLength(1)
    for (const spline of snapshot.splines) {
      expect(spline.closed, `${spline.name} is closed`).toBe(true)
      expect(spline.sampleCount, `${spline.name} sample count`).toBeGreaterThan(8)
      expect(spline.length, `${spline.name} length`).toBeGreaterThan(10)
      expect(spline.length).toBeCloseTo(spline.sampleCount * spline.sampleSpacing, 3)
    }

    expect(snapshot.crossings).toHaveLength(8)
    for (const crossing of snapshot.crossings) {
      expect(crossing.waitingPoints).toBe(2)
      expect(crossing.crossingPoints).toBe(2)
      expect(snapshot.splines.map((spline) => spline.name)).toContain(crossing.spline)
    }
  })

  test('reproduces the same block in the browser and stays valid for another seed', async ({ page }) => {
    await page.goto(HARNESS_PATH, { waitUntil: 'load' })
    await expect(page.locator('body')).toHaveAttribute('data-layout-status', 'ready')
    const first = await readSnapshot(page)

    const sameSeed = await page.evaluate(
      (seed) => (window as unknown as { __layoutHarness: HarnessApi }).__layoutHarness.rebuild(seed),
      CANONICAL_SEED,
    )
    expect(sameSeed.deterministic).toBe(true)
    expect(sameSeed.hash).toBe(first.hash)
    expect(sameSeed.meshes).toEqual(first.meshes)

    const otherSeed = await page.evaluate(
      (seed) => (window as unknown as { __layoutHarness: HarnessApi }).__layoutHarness.rebuild(seed),
      ALTERNATE_SEED,
    )
    expect(otherSeed.hash).not.toBe(first.hash)
    expect(otherSeed.deterministic).toBe(true)
    expect(otherSeed.triangleCount).toBeLessThanOrEqual(otherSeed.triangleBudget)
    for (const [group, meshCount] of Object.entries(EXPECTED_GROUPS)) {
      expect(otherSeed.groups[group]?.meshCount, `alternate seed group ${group}`).toBe(meshCount)
    }

    const restored = await page.evaluate(
      (seed) => (window as unknown as { __layoutHarness: HarnessApi }).__layoutHarness.rebuild(seed),
      CANONICAL_SEED,
    )
    expect(restored.hash).toBe(first.hash)
    await expect(page.locator('body')).toHaveAttribute('data-layout-hash', first.hash)
  })

  test('renders the block with the harness renderer when WebGL is available', async ({ page }) => {
    await page.goto(HARNESS_PATH, { waitUntil: 'load' })
    await expect(page.locator('body')).toHaveAttribute('data-layout-status', 'ready')

    const webgl = await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas')
        return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null
      } catch {
        return false
      }
    })
    test.skip(!webgl, 'WebGL unavailable in this browser')

    await expect(page.locator('body')).toHaveAttribute('data-layout-webgl', 'true')
    const viewport = page.getByTestId('layout-viewport')
    await expect(viewport.locator('canvas')).toHaveCount(1)

    const drawn = await page.evaluate(() => {
      const canvas = document.querySelector('canvas')
      return { width: canvas?.width ?? 0, height: canvas?.height ?? 0 }
    })
    expect(drawn.width).toBeGreaterThan(0)
    expect(drawn.height).toBeGreaterThan(0)

    // Rebuilding replaces the meshes without losing the mounted block.
    await page.getByTestId('layout-rebuild-alt').click()
    await expect(page.locator('body')).toHaveAttribute('data-layout-seed', ALTERNATE_SEED)
    await expect(viewport.locator('canvas')).toHaveCount(1)
    await page.getByTestId('layout-rebuild').click()
    await expect(page.locator('body')).toHaveAttribute('data-layout-seed', CANONICAL_SEED)
    await expect(page.locator('body')).toHaveAttribute('data-layout-status', 'ready')
  })
})
