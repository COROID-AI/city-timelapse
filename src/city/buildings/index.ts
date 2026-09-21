/**
 * Public surface of the era buildings layer.
 *
 * ```ts
 * import { BuildingsLayer, applyEra, applyEraTransition } from '../city/buildings'
 *
 * const plan = applyEra('1985', { layout })                       // one era, built
 * const staged = applyEraTransition({ from: '1985', to: '2005', t: 0.5 }, { layout })
 * staged.mix                                                     // 0.5 — grow depth
 * ```
 *
 * The barrel is the only module other owners import: the scene composition
 * mounts the group built by {@link createBuildingsGroup}, the transition director
 * drives {@link applyEraTransition}, and the layer's own tests use the same two
 * entry points.
 *
 * A *plan* is plain data — one {@link BuildingInstance} per parcel, each in
 * exactly one of the three states (`building`, `vacant-lot`, `construction`) —
 * so the unit suite can hash a whole era and the browser harness can publish it
 * without a serialiser. The three.js side is a separate, small module
 * ({@link createBuildingsGroup}) that paints that data.
 */

import { ERA_IDS, type EraId } from '../../era'
import { resolveQualityTier } from '../../lib/quality'
import type { QualityTierName } from '../../lib/quality'
import { applyEra } from './massing'
import type { BuildingContext, BuildingPlan } from './types'

export * from './types'
export * from './tables'
export * from './facades'
export * from './massing'
export {
  BuildingsLayer,
  BuildingsLayerComponent,
  applyProgressiveSwap,
  createBuildingsGroup,
  disposeBuildingsGroup,
  summariseBuildingsGroup,
} from './BuildingsLayer'
export type {
  BuildingsGroupOptions,
  BuildingsLayerProps,
  BuildingsSceneSummary,
} from './BuildingsLayer'

/** Quality tier and its facade density, re-exported for harness pages. */
export interface BuildingsQualitySelection {
  readonly tier: QualityTierName
  readonly facadeDetail: number
}

/** Resolves the tier a plan is built at and the facade detail it draws with. */
export function resolveBuildingsQuality(tier?: QualityTierName): BuildingsQualitySelection {
  const resolved = resolveQualityTier(tier)
  return { tier: resolved.name, facadeDetail: resolved.density.facadeDetail }
}

/**
 * Stable digest of a plan.
 *
 * The plans are pure data built in a fixed parcel order, so the digest is stable
 * across runs and machines; the tests use it to prove an era rebuilds
 * identically and that two eras never collide.
 */
export function buildingPlanHash(plan: BuildingPlan): string {
  const serialised = JSON.stringify(plan)
  let low = 0x811c9dc5
  let high = 0x1b873593
  for (let index = 0; index < serialised.length; index += 1) {
    const code = serialised.charCodeAt(index)
    low = Math.imul(low ^ code, 0x01000193) >>> 0
    high = Math.imul(high ^ code, 0x01000193) >>> 0
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`
}

/** Every era's building plan for a block, in timeline order. */
export function buildAllEraPlans(context: BuildingContext): readonly BuildingPlan[] {
  return ERA_IDS.map((eraId: EraId) => applyEra(eraId, context))
}
