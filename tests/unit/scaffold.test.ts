/**
 * Scaffold contract tests.
 *
 * These lock down the shared foundation every later task builds on: the seeded
 * PRNG stays reproducible, the quality tiers stay ordered and complete, the
 * determinism hash stays order-independent, the manifest keeps the agreed
 * dependencies and scripts, and nothing in the app source reaches out to a
 * remote asset origin.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SCENE_ASSETS } from '../../src/App'
import {
  DEFAULT_QUALITY_TIER,
  DEGRADED_TARGET_FPS,
  FRAME_BUDGET_MS,
  QUALITY_TIERS,
  QUALITY_TIER_NAMES,
  TARGET_FPS,
  downgradeQualityTier,
  isQualityTierName,
  isWithinFrameBudget,
  resolveQualityTier,
  upgradeQualityTier,
} from '../../src/lib/quality'
import {
  DEFAULT_RNG_SEED,
  createRng,
  createRngFromState,
  deriveSeed,
  hashStringToSeed,
  normalizeSeed,
} from '../../src/lib/rng'
import { hashValue, stableStringify } from '../support/hash'

/**
 * Locates the repository root without relying on `import.meta.url`, which the
 * jsdom environment rewrites to an http URL. Walks up from the working
 * directory until the project manifest appears.
 */
function findProjectRoot(): string {
  let current = process.cwd()
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(current, 'package.json')) && existsSync(join(current, 'src'))) {
      return current
    }
    const parent = join(current, '..')
    if (parent === current) {
      break
    }
    current = parent
  }
  throw new Error(`Could not locate the project root from ${process.cwd()}`)
}

const projectRoot = findProjectRoot()

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), 'utf8')
}

function collectSourceFiles(relativeDir: string): string[] {
  return readdirSync(join(projectRoot, relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`
    if (entry.isDirectory()) {
      return collectSourceFiles(relativePath)
    }
    return /\.(ts|tsx|css|html)$/.test(entry.name) ? [relativePath] : []
  })
}

function sample(seed: string | number, length = 64): number[] {
  const rng = createRng(seed)
  return Array.from({ length }, () => rng.uint32())
}

const DENSITY_MULTIPLIER_KEYS = [
  'buildings',
  'facadeDetail',
  'storefrontDetail',
  'props',
  'vehicles',
  'pedestrians',
  'particles',
] as const

const EFFECT_SWITCH_KEYS = [
  'antialias',
  'shadows',
  'softShadows',
  'bloom',
  'ssao',
  'depthOfField',
  'reflections',
  'motionBlur',
  'fog',
  'postprocessing',
] as const

const REQUIRED_DEPENDENCIES = [
  'react',
  'react-dom',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  'postprocessing',
  'zustand',
  'vite',
  'typescript',
  'vitest',
  'jsdom',
  '@testing-library/react',
  '@testing-library/user-event',
  '@playwright/test',
] as const

const REQUIRED_SCRIPTS = ['dev', 'build', 'preview', 'typecheck', 'test', 'test:e2e'] as const

/** Any absolute remote URL (asset, font, script or stylesheet). */
const EXTERNAL_URL_PATTERN = /\bhttps?:\/\//i

describe('seeded PRNG (src/lib/rng.ts)', () => {
  it('is pure: the same seed always yields the same sequence', () => {
    expect(sample('city-block')).toEqual(sample('city-block'))
    expect(sample(1945)).toEqual(sample(1945))
    expect(hashValue(sample('city-block', 256))).toBe(hashValue(sample('city-block', 256)))
  })

  it('diverges for different seeds', () => {
    const first = sample('city-block')
    const second = sample('city-block-2055')
    expect(first).not.toEqual(second)
    expect(first.filter((value, index) => value !== second[index]).length).toBeGreaterThan(0)
    expect(hashValue(first)).not.toBe(hashValue(second))
  })

  it('keeps integer draws integral and inside the requested range', () => {
    const rng = createRng('range-check')
    for (let index = 0; index < 5_000; index += 1) {
      const value = rng.int(4, 12)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(4)
      expect(value).toBeLessThan(12)
    }
  })

  it('honours the float, int and bool contracts at their edges', () => {
    const rng = createRng('contract-check')
    for (let index = 0; index < 2_000; index += 1) {
      const value = rng.float(-2.5, 2.5)
      expect(value).toBeGreaterThanOrEqual(-2.5)
      expect(value).toBeLessThan(2.5)
      expect(rng.next()).toBeGreaterThanOrEqual(0)
      expect(rng.next()).toBeLessThan(1)
    }
    expect(rng.int(5, 5)).toBe(5)
    expect(rng.float(2, 2)).toBe(2)
    expect(rng.bool(0)).toBe(false)
    expect(rng.bool(1)).toBe(true)

    const coin = createRng('coin-flip')
    const flips = Array.from({ length: 400 }, () => coin.bool(0.5))
    expect(flips).toContain(true)
    expect(flips).toContain(false)
  })

  it('picks and shuffles deterministically', () => {
    const items = ['house', 'tower', 'garage', 'shop', 'office', 'cinema'] as const
    const first = createRng('pick-check')
    const second = createRng('pick-check')
    const picks = Array.from({ length: 32 }, () => first.pick(items))
    expect(picks).toEqual(Array.from({ length: 32 }, () => second.pick(items)))
    for (const pick of picks) {
      expect(items).toContain(pick)
    }

    const shuffled = first.shuffle(items)
    expect(shuffled).toHaveLength(items.length)
    expect([...shuffled].sort()).toEqual([...items].sort())
    expect(createRng('pick-check').pick(items)).toBe(picks[0])
    expect(() => createRng('empty').pick([])).toThrow(/empty/i)
  })

  it('creates independent but reproducible forks', () => {
    const parent = createRng('city-root')
    const buildingsA = parent.fork('buildings')
    const buildingsB = createRng('city-root').fork('buildings')
    const vehicles = createRng('city-root').fork('vehicles')

    const buildingsSequence = Array.from({ length: 64 }, () => buildingsA.uint32())
    expect(buildingsSequence).toEqual(Array.from({ length: 64 }, () => buildingsB.uint32()))
    expect(buildingsSequence).not.toEqual(Array.from({ length: 64 }, () => vehicles.uint32()))
    expect(deriveSeed('city-root', 'buildings')).toBe(deriveSeed('city-root', 'buildings'))
    expect(deriveSeed('city-root', 'buildings')).not.toBe(deriveSeed('city-root', 'vehicles'))
  })

  it('replays exactly from a snapshot state', () => {
    const rng = createRng('snapshot-check')
    for (let index = 0; index < 3; index += 1) {
      rng.uint32()
    }
    const replay = createRngFromState(rng.state, 'replay', rng.seed)
    expect(Array.from({ length: 16 }, () => replay.uint32())).toEqual(
      Array.from({ length: 16 }, () => rng.uint32()),
    )
  })

  it('normalises every flavour of seed material', () => {
    expect(normalizeSeed(3.9)).toBe(3)
    expect(normalizeSeed(-1)).toBe(4294967295)
    expect(normalizeSeed('city')).toBe(hashStringToSeed('city'))
    expect(hashStringToSeed('city')).toBe(hashStringToSeed('city'))
    expect(hashStringToSeed('city')).not.toBe(hashStringToSeed('City'))
    expect(createRng().seed).toBe(normalizeSeed(DEFAULT_RNG_SEED))
    expect(() => createRng(Number.NaN)).toThrow(TypeError)
  })

  it('never reads ambient randomness', () => {
    const source = readProjectFile('src/lib/rng.ts')
    // Strip prose so documentation may still name the globals it avoids.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/Math\.random/)
    expect(code).not.toMatch(/Date\.now|new Date|performance\.now/)
  })
})

describe('quality constants (src/lib/quality.ts)', () => {
  it('exposes the frame budget and the target frame rate', () => {
    expect(TARGET_FPS).toBe(60)
    expect(FRAME_BUDGET_MS).toBeCloseTo(16.667, 2)
    expect(DEGRADED_TARGET_FPS).toBe(30)
    expect(isWithinFrameBudget(FRAME_BUDGET_MS)).toBe(true)
    expect(isWithinFrameBudget(FRAME_BUDGET_MS * 2)).toBe(false)
    expect(isWithinFrameBudget(50, 'low')).toBe(false)
  })

  it('defines the three named tiers with complete records', () => {
    expect([...QUALITY_TIER_NAMES]).toEqual(['high', 'medium', 'low'])
    for (const name of QUALITY_TIER_NAMES) {
      const tier = QUALITY_TIERS[name]
      expect(tier.name).toBe(name)
      expect(tier.label.length).toBeGreaterThan(0)
      expect(tier.targetFps).toBeGreaterThan(0)
      expect(tier.frameBudgetMs).toBeGreaterThan(0)
      expect(tier.pixelRatio.min).toBeGreaterThan(0)
      expect(tier.pixelRatio.max).toBeGreaterThanOrEqual(tier.pixelRatio.min)
      expect(Number.isInteger(tier.effects.shadowMapSize)).toBe(true)
      expect(Number.isInteger(tier.effects.textureResolution)).toBe(true)
    }
  })

  it('orders density and detail monotonically from low to high', () => {
    for (const key of DENSITY_MULTIPLIER_KEYS) {
      expect(QUALITY_TIERS.high.density[key]).toBeGreaterThan(0)
      expect(QUALITY_TIERS.high.density[key]).toBeLessThanOrEqual(1)
      expect(QUALITY_TIERS.low.density[key]).toBeLessThanOrEqual(QUALITY_TIERS.medium.density[key])
      expect(QUALITY_TIERS.medium.density[key]).toBeLessThanOrEqual(QUALITY_TIERS.high.density[key])
    }
    expect(QUALITY_TIERS.low.density.drawDistance).toBeLessThan(QUALITY_TIERS.high.density.drawDistance)
  })

  it('exposes per-tier effect switches and resolutions', () => {
    for (const tier of Object.values(QUALITY_TIERS)) {
      for (const key of EFFECT_SWITCH_KEYS) {
        expect(typeof tier.effects[key]).toBe('boolean')
      }
    }
    expect(QUALITY_TIERS.high.effects.shadowMapSize).toBeGreaterThan(QUALITY_TIERS.medium.effects.shadowMapSize)
    expect(QUALITY_TIERS.medium.effects.shadowMapSize).toBeGreaterThan(QUALITY_TIERS.low.effects.shadowMapSize)
    expect(QUALITY_TIERS.high.effects.textureResolution).toBeGreaterThan(QUALITY_TIERS.low.effects.textureResolution)
    expect(QUALITY_TIERS.high.effects.postprocessing).toBe(true)
    expect(QUALITY_TIERS.low.effects.postprocessing).toBe(false)
    expect(QUALITY_TIERS.high.effects.shadows).toBe(true)
  })

  it('resolves unknown tier names to the default tier', () => {
    expect(resolveQualityTier('medium').name).toBe('medium')
    expect(resolveQualityTier('ultra').name).toBe(DEFAULT_QUALITY_TIER)
    expect(resolveQualityTier(undefined).name).toBe(DEFAULT_QUALITY_TIER)
    expect(resolveQualityTier(null).name).toBe(DEFAULT_QUALITY_TIER)
    expect(isQualityTierName('low')).toBe(true)
    expect(isQualityTierName('LOW')).toBe(false)
    expect(isQualityTierName(3)).toBe(false)
  })

  it('steps along the tier ladder without falling off', () => {
    expect(downgradeQualityTier('high')).toBe('medium')
    expect(downgradeQualityTier('high', 2)).toBe('low')
    expect(downgradeQualityTier('low', 5)).toBe('low')
    expect(upgradeQualityTier('low')).toBe('medium')
    expect(upgradeQualityTier('low', 5)).toBe('high')
    expect(upgradeQualityTier('high', 2)).toBe('high')
  })
})

describe('determinism hash helper (tests/support/hash.ts)', () => {
  it('ignores object key insertion order', () => {
    expect(stableStringify({ height: 12, floors: 4 })).toBe(stableStringify({ floors: 4, height: 12 }))
    expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }))
    expect(hashValue({ nested: { b: [1, 2], a: 'x' } })).toBe(hashValue({ nested: { a: 'x', b: [1, 2] } }))
  })

  it('changes when a value changes and respects array order', () => {
    expect(hashValue([1, 2, 3])).not.toBe(hashValue([3, 2, 1]))
    expect(hashValue({ floors: 4 })).not.toBe(hashValue({ floors: 5 }))
    expect(hashValue('city')).not.toBe(hashValue('citi'))
  })

  it('handles cycles, special numbers and typed arrays without throwing', () => {
    const cyclic: Record<string, unknown> = { name: 'block' }
    cyclic['self'] = cyclic
    expect(stableStringify(cyclic)).toContain('[circular]')
    expect(hashValue({ n: Number.NaN, i: Number.POSITIVE_INFINITY, z: -0 })).toBe(
      hashValue({ z: -0, i: Number.POSITIVE_INFINITY, n: Number.NaN }),
    )
    expect(hashValue(new Float32Array([1, 2, 3]))).toBe(hashValue(new Float32Array([1, 2, 3])))
    expect(hashValue(new Float32Array([1, 2, 3]))).not.toBe(hashValue(new Float32Array([1, 2, 4])))
  })
})

describe('project manifest and entry points', () => {
  const manifest = JSON.parse(readProjectFile('package.json')) as {
    scripts?: Record<string, string>
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const declaredPackages: Record<string, string> = {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  }

  it.each([...REQUIRED_DEPENDENCIES])('declares the %s dependency', (packageName) => {
    expect(declaredPackages).toHaveProperty(packageName)
  })

  it.each([...REQUIRED_SCRIPTS])('exposes the %s npm script', (scriptName) => {
    expect(manifest.scripts ?? {}).toHaveProperty(scriptName)
  })

  it('ships the scaffold entry points and harness files', () => {
    for (const relativePath of [
      'index.html',
      'vite.config.ts',
      'tsconfig.json',
      'playwright.config.ts',
      'src/main.tsx',
      'src/App.tsx',
      'src/styles/global.css',
      'src/lib/rng.ts',
      'src/lib/quality.ts',
      'tests/setup.ts',
      'tests/support/render.tsx',
      'tests/support/hash.ts',
      'e2e/smoke.spec.ts',
    ]) {
      expect(existsSync(join(projectRoot, relativePath)), `${relativePath} is missing`).toBe(true)
    }
  })

  it('mounts the app from the Vite entry script', () => {
    const html = readProjectFile('index.html')
    expect(html).toContain('id="root"')
    expect(html).toContain('src="/src/main.tsx"')
    expect(html).not.toMatch(EXTERNAL_URL_PATTERN)
  })
})

describe('procedural-only assets', () => {
  it('declares an empty external asset manifest', () => {
    expect(SCENE_ASSETS).toEqual([])
  })

  it('references no external asset or font origin in the app source', () => {
    const files = collectSourceFiles('src')
    expect(files.length).toBeGreaterThan(0)
    for (const relativePath of files) {
      expect(
        EXTERNAL_URL_PATTERN.test(readProjectFile(relativePath)),
        `${relativePath} references an external origin`,
      ).toBe(false)
    }
  })
})
