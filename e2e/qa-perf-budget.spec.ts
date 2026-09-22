/**
 * Frame budget, quality tiers and the degraded fallback.
 *
 * The brief asks for a polished, high-end result, which is a frame-rate promise.
 * This spec checks the three things that promise decomposes into, all of them
 * against the running composed application and through its published surfaces:
 *
 * 1. **The shared budget is the one in force.** The default tier targets the
 *    shared 60 fps budget from `src/lib/quality.ts`, the page reports that budget,
 *    and the adaptive controller's own decision record carries the budget it
 *    measured against — which must equal {@link FRAME_BUDGET_MS}.
 * 2. **Sustained over-budget frames degrade exactly one tier at a time, without
 *    oscillating.** With automatic quality and no manual tier, the controller must
 *    react to a sustained breach, never climb back while the load persists, and
 *    never change more tiers than the ladder has steps. The bottom of the ladder
 *    is the degraded fallback — 30 fps / 33.33 ms from the shared table — and the
 *    app is expected to end there and stay there.
 * 3. **Lower tiers cost less.** The authored population of every density-driven
 *    layer is strictly smaller at `low` than at `high` for the same period, so the
 *    tier does real work rather than only switching effects off.
 *
 * On absolute frame time in this environment: the browser checks run on a
 * software rasteriser with no GPU (`--use-angle=swiftshader`), where a block of
 * this size renders in tens of milliseconds per frame at any tier. The absolute
 * 60 fps target is therefore not reachable here, and asserting it would assert a
 * property of the sandbox rather than of the app. What *is* asserted is what the
 * app owns: it measures frame time against the shared budget, it degrades when
 * that budget is breached, it stops at the degraded floor instead of flapping, and
 * it yields to a hand-picked tier. Every measurement is written to
 * `tests/qa/artifacts/era-perf.json`, so the absolute gap stays on the record.
 */

import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import {
  DEGRADED_FRAME_BUDGET_MS,
  DEGRADED_TARGET_FPS,
  FRAME_BUDGET_MS,
  QUALITY_TIER_ORDER,
  QUALITY_TIERS,
  TARGET_FPS,
} from '../src/lib/quality'
import type { QualityTierName } from '../src/lib/quality'
import { artifactPath, writeJsonArtifact } from '../tests/qa/pixelBaseline'

test.describe.configure({ timeout: 280_000 })

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

interface LayerRecord {
  readonly id: string
  readonly qualityTier: QualityTierName
  readonly objects: number
  readonly meshes: number
  readonly instances: number
  readonly triangles: number
  readonly stats?: Readonly<Record<string, number>>
}

interface DebugSnapshot {
  readonly eraId: string
  readonly qualityTier: QualityTierName
  readonly frame: number
  readonly fps: number
  readonly frameTimeMs: number
  readonly layers: readonly LayerRecord[]
  readonly loading: { readonly ready: boolean }
}

interface QualityNotice {
  readonly id: string
  readonly from: QualityTierName
  readonly to: QualityTierName
  readonly reason: 'over-budget' | 'headroom'
  readonly frameTimeMs: number
  readonly budgetMs: number
  readonly message: string
}

interface InteractionSnapshot {
  readonly eraId: string
  readonly qualityTier: QualityTierName
  readonly frame: number
  readonly averageFrameTimeMs: number
  readonly quality: {
    readonly tier: QualityTierName
    readonly manualOverride: boolean
    readonly suspended: boolean
    readonly samples: number
    readonly changes: number
    readonly lastReason: string
    readonly notices: readonly QualityNotice[]
  }
}

async function readDebug(page: Page): Promise<DebugSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapse?: { read(): unknown } }).__cityTimelapse
    return (surface?.read() ?? null) as unknown as DebugSnapshot | null
  })
}

async function readInteraction(page: Page): Promise<InteractionSnapshot | null> {
  return page.evaluate(() => {
    const surface = (window as unknown as { __cityTimelapseInteraction?: { read(): unknown } })
      .__cityTimelapseInteraction
    return (surface?.read() ?? null) as unknown as InteractionSnapshot | null
  })
}

/**
 * Waits for the composition to be live and reporting the tier it was built at.
 *
 * The first rendered frame publishes a fresh census (the composition's debug
 * records are measured from the scene graph), so this is a cheap wait: the mount
 * build, then a frame or two.
 */
async function waitForReady(page: Page, tier: QualityTierName): Promise<DebugSnapshot> {
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, {
      timeout: 180_000,
      intervals: [250, 500, 1000],
    })
    .toBe(true)
  await expect
    .poll(async () => (await readDebug(page))?.frame ?? 0, { timeout: 60_000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(0)
  await expect
    .poll(async () => (await readDebug(page))?.layers.length ?? 0, { timeout: 60_000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(0)
  const snapshot = await readDebug(page)
  if (snapshot === null) {
    throw new Error('The composition debug surface is not available on window.__cityTimelapse.')
  }
  expect(
    snapshot.layers.every((layer) => layer.qualityTier === tier),
    `the published layer records belong to the ${tier} build`,
  ).toBe(true)
  return snapshot
}

/** Density-driven layers whose authored population must follow the tier. */
const DENSITY_LAYERS = ['atmosphere', 'storefronts', 'props', 'vehicles'] as const

/**
 * The metric that visibly shrinks for each density-driven layer.
 *
 * Calibrated from the two builds of era 1945: the atmosphere's particle budget
 * (850 -> 551 instances), the storefront facade subdivision (11 184 -> 10 368
 * triangles), the prop population (439 -> 416 instances) and the vehicle
 * population (1 376 -> 917 instances). The frozen block contributes nothing to
 * any of them.
 */
const SCALING_METRICS: readonly { readonly id: string; readonly metric: 'instances' | 'triangles' }[] = [
  { id: 'atmosphere', metric: 'instances' },
  { id: 'storefronts', metric: 'triangles' },
  { id: 'props', metric: 'instances' },
  { id: 'vehicles', metric: 'instances' },
]

/** Artifact test 1 leaves behind so test 2 measures the same period at both tiers. */
const HIGH_BASELINE_FILE = 'era-perf-high-baseline.json'

interface AuthoredLoad {
  readonly perLayer: Record<string, LayerRecord>
  readonly totals: { objects: number; meshes: number; instances: number; triangles: number }
}

function authoredLoad(snapshot: DebugSnapshot): AuthoredLoad {
  const perLayer: Record<string, LayerRecord> = {}
  const totals = { objects: 0, meshes: 0, instances: 0, triangles: 0 }
  for (const id of DENSITY_LAYERS) {
    const layer = snapshot.layers.find((candidate) => candidate.id === id)
    if (layer === undefined) {
      continue
    }
    perLayer[id] = layer
    totals.objects += layer.objects
    totals.meshes += layer.meshes
    totals.instances += layer.instances
    totals.triangles += layer.triangles
  }
  return { perLayer, totals }
}

/* -------------------------------------------------------------------------- */
/* 1 & 2: the budget, the reaction and the degraded floor                     */
/* -------------------------------------------------------------------------- */

test('automatic quality reacts to sustained over-budget frames and settles on the degraded floor', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  // No `?tier` flag: the default tier, with the automatic controller in charge.
  await page.goto('/', { waitUntil: 'load' })
  await expect(page.getByTestId('ui-overlay')).toBeVisible()
  await expect
    .poll(async () => (await readDebug(page))?.loading.ready ?? false, {
      timeout: 180_000,
      intervals: [250, 500, 1000],
    })
    .toBe(true)
  await expect
    .poll(async () => (await readDebug(page))?.frame ?? 0, { timeout: 60_000, intervals: [250, 500, 1000] })
    .toBeGreaterThan(0)
  await expect(page.getByTestId('scene-status')).toContainText(`${TARGET_FPS} fps`)
  await expect(page.getByTestId('scene-status')).toContainText(`${FRAME_BUDGET_MS.toFixed(2)} ms frame budget`)

  // The first rendered frame publishes a census measured from the scene graph.
  // It is the richest tier's build of the opening period, and it is recorded here
  // so the tier comparison below can reuse it instead of paying for a second
  // high-tier build.
  const highSnapshot = await waitForReady(page, 'high')
  const highBaseline = authoredLoad(highSnapshot)
  const highLayoutMeshes = highSnapshot.layers.find((layer) => layer.id === 'layout')?.meshes ?? 0
  writeJsonArtifact(HIGH_BASELINE_FILE, {
    generatedAt: new Date().toISOString(),
    era: highSnapshot.eraId,
    tier: 'high',
    totals: highBaseline.totals,
    perLayer: highBaseline.perLayer,
    layoutMeshes: highLayoutMeshes,
  })

  const initial = await readInteraction(page)
  expect(initial, 'the interaction surface is live').not.toBeNull()
  expect(initial?.quality.manualOverride, 'no manual tier was requested').toBe(false)
  // The window opens on the richest tier; by the time the first read lands the
  // controller may already have reacted, so every notice is collected rather than
  // only the current tier.
  expect(['high', 'medium']).toContain(initial?.quality.tier)

  /* ---------------------------------------------------------------------- */
  /* Collect every adaptive decision and sample the tier while it settles   */
  /* ---------------------------------------------------------------------- */

  const notices = new Map<string, QualityNotice>()
  const tiers: QualityTierName[] = []
  const measured: number[] = []
  const deadline = Date.now() + 120_000
  let settled = false
  while (Date.now() < deadline) {
    const interaction = await readInteraction(page)
    if (interaction !== null) {
      for (const notice of interaction.quality.notices) {
        notices.set(notice.id, notice)
      }
      const last = tiers[tiers.length - 1]
      if (last !== interaction.quality.tier) {
        tiers.push(interaction.quality.tier)
      }
      measured.push(interaction.averageFrameTimeMs)
      if (interaction.quality.tier === 'low' && interaction.quality.changes >= 1 && last === 'low') {
        settled = true
        break
      }
    }
    await page.waitForTimeout(1500)
  }

  const finalInteraction = await readInteraction(page)
  const finalDebug = await readDebug(page)
  const quality = finalInteraction?.quality
  expect(quality, 'quality state is readable').toBeDefined()

  // The controller measured against the shared primary budget and reacted to it.
  const decisions = [...notices.values()]
  const overBudget = decisions.filter((notice) => notice.reason === 'over-budget')
  expect(overBudget.length, 'at least one over-budget degradation was taken').toBeGreaterThan(0)
  const firstDecision = overBudget[0]
  expect(firstDecision?.budgetMs, 'the decision was taken against the shared 60 fps budget').toBeCloseTo(
    FRAME_BUDGET_MS,
    5,
  )
  expect(firstDecision?.from, 'the ladder starts at the richest tier').toBe(
    QUALITY_TIER_ORDER[QUALITY_TIER_ORDER.length - 1],
  )
  expect(firstDecision?.to, 'degradation moves exactly one tier').toBe('medium')
  expect(
    firstDecision?.frameTimeMs ?? 0,
    'the notice records the measured frame time that breached the budget',
  ).toBeGreaterThan(firstDecision?.budgetMs ?? 0)
  expect(firstDecision?.message, 'the notice names the budget it measured against').toContain('16.7 ms budget')

  // No oscillation: one downgrade at a time, never an upgrade, never more changes
  // than the ladder has steps, and no headroom climb while the load persists.
  expect(quality?.changes ?? 0, 'at most one change per ladder step').toBeLessThanOrEqual(
    QUALITY_TIER_ORDER.length - 1,
  )
  expect(tiers, 'the tier sequence never climbs back under sustained load').toEqual(
    [...tiers].sort((a, b) => QUALITY_TIER_ORDER.indexOf(b) - QUALITY_TIER_ORDER.indexOf(a)),
  )
  expect(decisions.some((notice) => notice.reason === 'headroom'), 'no upgrade was attempted under load').toBe(false)

  // Degraded fallback: the app ends at the bottom of the ladder, whose target is
  // the shared degraded 30 fps budget, and the page reports it.
  expect(settled, 'the controller settled on the degraded floor within the window').toBe(true)
  expect(quality?.tier).toBe('low')
  expect(QUALITY_TIERS.low.frameBudgetMs).toBeCloseTo(DEGRADED_FRAME_BUDGET_MS, 5)
  expect(finalDebug?.qualityTier, 'debug surface and controller agree').toBe(quality?.tier)
  await expect(page.getByTestId('scene-status')).toContainText(`${DEGRADED_TARGET_FPS} fps`)
  await expect(page.getByTestId('scene-status')).toContainText(
    `${DEGRADED_FRAME_BUDGET_MS.toFixed(2)} ms frame budget`,
  )
  await expect(page.getByTestId('quality-status')).toHaveText(/automatic/i)

  // The frame loop is live and reporting a real measurement.
  const measuredFrameTime = finalDebug?.frameTimeMs ?? 0
  expect(measuredFrameTime).toBeGreaterThan(0)
  expect(Number.isFinite(measuredFrameTime)).toBe(true)

  const artifact = writeJsonArtifact('era-perf.json', {
    generatedAt: new Date().toISOString(),
    environment:
      'headless Chromium with swiftshader software rasterisation; no GPU. The absolute 60 fps target is not reachable in this sandbox, so the enforced property is the adaptive reaction, the degraded floor and the tier-dependent load, all measured below.',
    budgets: {
      targetFps: TARGET_FPS,
      frameBudgetMs: FRAME_BUDGET_MS,
      degradedTargetFps: DEGRADED_TARGET_FPS,
      degradedFrameBudgetMs: DEGRADED_FRAME_BUDGET_MS,
    },
    decisions: decisions.map((notice) => ({
      id: notice.id,
      from: notice.from,
      to: notice.to,
      reason: notice.reason,
      frameTimeMs: notice.frameTimeMs,
      budgetMs: notice.budgetMs,
    })),
    tierSequence: tiers,
    finalQuality: quality ?? null,
    finalMeasurement: {
      frame: finalDebug?.frame ?? 0,
      frameTimeMs: measuredFrameTime,
      fps: finalDebug?.fps ?? 0,
      averageFrameTimeMs: finalInteraction?.averageFrameTimeMs ?? 0,
      exceedsSharedBudget: measuredFrameTime > FRAME_BUDGET_MS,
      withinDegradedBudget: measuredFrameTime <= DEGRADED_FRAME_BUDGET_MS,
    },
    sampledAverageFrameTimeMs: measured,
  })
  expect(artifact).toContain('era-perf.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})

/* -------------------------------------------------------------------------- */
/* 3: lower tiers cost less                                                   */
/* -------------------------------------------------------------------------- */

test('a lower quality tier reduces the authored load of every density-driven layer', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error: Error) => pageErrors.push(error.message))

  // The tier ladder itself is ordered: a cheaper tier never asks for more density.
  for (let index = 1; index < QUALITY_TIER_ORDER.length; index += 1) {
    const cheaper = QUALITY_TIERS[QUALITY_TIER_ORDER[index - 1] ?? 'low']
    const richer = QUALITY_TIERS[QUALITY_TIER_ORDER[index] ?? 'high']
    for (const key of Object.keys(richer.density) as (keyof typeof richer.density)[]) {
      expect(cheaper.density[key], `${cheaper.name}.${key} <= ${richer.name}.${key}`).toBeLessThanOrEqual(
        richer.density[key],
      )
    }
  }

  // The high-tier census comes from the run above: it is that build's own
  // first-frame measurement of the opening period, so this test only pays for the
  // cheap tier and both readings describe the same year.
  const baseline = JSON.parse(readFileSync(artifactPath(HIGH_BASELINE_FILE), 'utf8')) as {
    era: string
    totals: AuthoredLoad['totals']
    perLayer: Record<string, LayerRecord>
    layoutMeshes: number
  }
  expect(baseline.totals.instances, 'the high-tier baseline carries real content').toBeGreaterThan(0)

  // `?tier=low` seeds the tier before the block is built and records the choice as
  // the viewer's, so the tier is suspended from adaptation and the page reports
  // the matching target.
  await page.goto('/?tier=low', { waitUntil: 'load' })
  const lowSnapshot = await waitForReady(page, 'low')
  const low = authoredLoad(lowSnapshot)
  const lowLayoutMeshes = lowSnapshot.layers.find((layer) => layer.id === 'layout')?.meshes ?? 0
  expect(lowSnapshot.eraId, 'both censuses describe the same period').toBe(baseline.era)
  await expect(page.getByTestId('scene-status')).toContainText(`${DEGRADED_TARGET_FPS} fps`)
  await expect(page.getByTestId('scene-status')).toContainText(
    `${DEGRADED_FRAME_BUDGET_MS.toFixed(2)} ms frame budget`,
  )
  await expect(page.getByTestId('quality-low')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('quality-status')).toHaveText(/manual/i)
  const lowQuality = (await readInteraction(page))?.quality
  expect(lowQuality?.manualOverride, 'a hand-picked tier is recorded as manual').toBe(true)
  expect(lowQuality?.suspended, 'the adaptive controller yields to the viewer').toBe(true)

  // The frozen block is not a quality lever: only the dressing scales.
  expect(lowLayoutMeshes, 'the layout is tier-independent').toBe(baseline.layoutMeshes)

  const describe = (layer: LayerRecord | undefined): string =>
    layer === undefined
      ? 'missing'
      : `objects=${layer.objects} meshes=${layer.meshes} instances=${layer.instances} triangles=${layer.triangles}`
  for (const { id, metric } of SCALING_METRICS) {
    const cheap = low.perLayer[id]
    const rich = baseline.perLayer[id]
    expect(cheap, `${id} low-tier record`).toBeDefined()
    expect(rich, `${id} high-tier record`).toBeDefined()
    expect(
      rich?.[metric] ?? 0,
      `${id} ${metric} must shrink at the cheap tier (high: ${describe(rich)}, low: ${describe(cheap)})`,
    ).toBeGreaterThan(cheap?.[metric] ?? 0)
  }
  // And the draw calls the renderer issues follow the population down.
  expect(
    baseline.perLayer['props']?.stats?.['drawCalls'] ?? 0,
    `props draw calls must shrink at the cheap tier (high: ${baseline.perLayer['props']?.stats?.['drawCalls']}, low: ${low.perLayer['props']?.stats?.['drawCalls']})`,
  ).toBeGreaterThan(low.perLayer['props']?.stats?.['drawCalls'] ?? 0)
  for (const key of ['objects', 'meshes', 'instances', 'triangles'] as const) {
    expect(
      low.totals[key],
      `total ${key} must shrink at the cheap tier (high: ${baseline.totals[key]}, low: ${low.totals[key]})`,
    ).toBeLessThan(baseline.totals[key])
  }

  const artifact = writeJsonArtifact('era-perf-tiers.json', {
    generatedAt: new Date().toISOString(),
    era: lowSnapshot.eraId,
    low: low.totals,
    high: baseline.totals,
    perLayer: Object.fromEntries(
      DENSITY_LAYERS.map((id) => [id, { low: low.perLayer[id] ?? null, high: baseline.perLayer[id] ?? null }]),
    ),
    layoutMeshes: { low: lowLayoutMeshes, high: baseline.layoutMeshes },
    declaredDensity: {
      low: QUALITY_TIERS.low.density,
      medium: QUALITY_TIERS.medium.density,
      high: QUALITY_TIERS.high.density,
    },
  })
  expect(artifact).toContain('era-perf-tiers.json')

  expect(pageErrors, 'no uncaught page errors').toEqual([])
})
