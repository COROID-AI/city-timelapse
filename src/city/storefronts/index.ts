/**
 * Public surface of the era storefront, signage and advertising layer.
 *
 * ```ts
 * import { StorefrontLayer, applyEra, applyEraTransition } from '../city/storefronts'
 *
 * const plan = applyEra('1985', { layout })                  // one era, dressed
 * const staged = applyEraTransition({ from: '1985', to: '2005', t: 0.5 }, { layout })
 * staged.mix                                                // 0.5 — cross-fade depth
 * ```
 *
 * The barrel is the *only* module other owners import: the scene integration
 * mounts {@link StorefrontLayer}, the transition director drives
 * {@link applyEraTransition}, and the layer's own harness page uses the same two
 * entry points, so the browser proof exercises the shipped code.
 *
 * A *plan* is plain data: one {@link StorefrontUnit} per layout storefront-bay
 * anchor, {@link AdvertisingPlacement}s on the layout's projecting sign anchors,
 * {@link GraffitiPlacement}s on real shopfront faces, and the {@link SignSurface}
 * descriptors the renderer paints at runtime. Nothing is read from disk, no
 * image or font is fetched, and the same seed plus era always rebuilds the same
 * block.
 */

import { getEra, type EraDefinition, type EraId } from '../../era'
import { createRng, type Seed } from '../../lib/rng'
import { resolveQualityTier } from '../../lib/quality'
import type { QualityTierName } from '../../lib/quality'
import { buildAdvertising, buildGraffiti, advertisingCounts, distinctAdCampaigns, surfacesOf } from './advertising'
import { buildStorefrontUnits, shopTypeCounts } from './fronts'
import { STOREFRONT_TEXTURE_BUDGET_BYTES, totalTextureBytes } from './signage'
import { isNightLighting, signageEmissiveIntensity, storefrontEraData } from './tables'
import type {
  SignSurface,
  StorefrontContext,
  StorefrontPlan,
  StorefrontStats,
  StorefrontTransition,
  StorefrontTransitionPlan,
} from './types'
import { isIlluminated } from './types'

export * from './types'
export * from './typography'
export * from './signage'
export * from './tables'
export * from './fronts'
export * from './advertising'

export {
  StorefrontLayer,
  StorefrontsLayer,
  applyProgressiveSwap,
  createStorefrontGroup,
  disposeStorefrontGroup,
  summariseStorefrontGroup,
} from './StorefrontsLayer'
export type {
  StorefrontGroupOptions,
  StorefrontSceneSummary,
  StorefrontLayerProps,
  StorefrontsLayerProps,
} from './StorefrontsLayer'

/** Discriminant of every plan this layer produces. */
export const STOREFRONT_PLAN_KIND = 'storefront-plan'

/** Discriminant of every staged transition this layer produces. */
export const STOREFRONT_TRANSITION_KIND = 'storefront-transition'

/** Emissive strength above which a sign reads as lit rather than painted. */
export const LIT_SIGN_THRESHOLD = 0.05

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Quality tier and its storefront density, resolved once per plan. */
export interface StorefrontQualitySelection {
  readonly tier: QualityTierName
  readonly detail: number
}

/** Resolves the tier (and its decoration multiplier) a plan is built at. */
export function resolveStorefrontQuality(tier?: QualityTierName): StorefrontQualitySelection {
  const resolved = resolveQualityTier(tier)
  return { tier: resolved.name, detail: resolved.density.storefrontDetail }
}

/** Artworks addressed by texture key, so identical boards share one texture. */
function uniqueSurfaces(surfaces: readonly SignSurface[]): readonly SignSurface[] {
  const seen = new Set<string>()
  const unique: SignSurface[] = []
  for (const surface of surfaces) {
    if (seen.has(surface.textureKey)) {
      continue
    }
    seen.add(surface.textureKey)
    unique.push(surface)
  }
  return unique
}

function buildStats(
  plan: Omit<StorefrontPlan, 'stats'>,
  advertisingTotal: number,
  advertisingByKind: Readonly<Record<string, number>>,
  distinctCopy: number,
): StorefrontStats {
  const surfaces = plan.surfaces
  const textureBytes = totalTextureBytes(surfaces)
  const data = storefrontEraData(plan.eraId)
  return {
    bayCount: plan.units.length,
    dressedBays: plan.units.length,
    bareBays: 0,
    shopTypeCounts: shopTypeCounts(plan.units),
    advertisingTotal,
    advertisingByKind: advertisingByKind as StorefrontStats['advertisingByKind'],
    distinctAdCopy: distinctCopy,
    graffitiCount: plan.graffiti.length,
    graffitiState: data.graffiti.state,
    surfaceCount: surfaces.length,
    uniqueTextures: surfaces.length,
    textureBytes,
    textureBudgetBytes: STOREFRONT_TEXTURE_BUDGET_BYTES,
    withinTextureBudget: textureBytes <= STOREFRONT_TEXTURE_BUDGET_BYTES,
    emissiveIntensity: signageEmissiveIntensity(getEra(plan.eraId), {
      night: plan.night,
      illumination: data.illumination,
    }),
    // A board counts as illuminated when its *technology* is self-luminous, not
    // merely when its emissive value is non-zero: a painted board reflects the
    // period's lamps whatever their strength.
    illuminatedSigns: plan.units.filter((unit) => isIlluminated(unit.signBoard.illumination)).length,
    night: plan.night,
    signageVocabulary: data.signage,
    typographyId: data.typography.id,
    illumination: data.illumination,
  }
}

/**
 * Dresses the whole block for one era.
 *
 * Determinism: the generator is forked from the layout seed with the era id, so
 * `applyEra('1985', ctx)` is byte-identical on every run and on every machine,
 * while two eras share no shop assignment, sign copy or advertisement.
 */
export function buildStorefrontPlan(eraId: EraId, context: StorefrontContext): StorefrontPlan {
  const era: EraDefinition = getEra(eraId)
  const data = storefrontEraData(era.id)
  const quality = resolveStorefrontQuality(context.qualityTier)
  const night = context.night ?? isNightLighting(era.lighting)
  const reducedMotion = context.reducedMotion ?? false
  const seed: Seed = context.seed ?? context.layout.seedInput
  const rng = createRng(seed, `storefronts:${era.id}`).fork(era.id)

  const units = buildStorefrontUnits({
    era,
    data,
    layout: context.layout,
    tier: quality.tier,
    detail: quality.detail,
    night,
    rng,
  })
  const advertising = buildAdvertising({
    era,
    data,
    layout: context.layout,
    tier: quality.tier,
    detail: quality.detail,
    night,
    rng,
    units,
  })
  const graffiti = buildGraffiti({
    era,
    data,
    layout: context.layout,
    tier: quality.tier,
    detail: quality.detail,
    night,
    rng,
    units,
  })

  const surfaces = uniqueSurfaces([
    ...units.flatMap((unit) => unit.surfaces),
    ...surfacesOf(advertising, graffiti),
  ])

  const withoutStats: Omit<StorefrontPlan, 'stats'> = {
    kind: STOREFRONT_PLAN_KIND,
    eraId: era.id,
    year: era.year,
    seed,
    qualityTier: quality.tier,
    detail: quality.detail,
    night,
    reducedMotion,
    lighting: {
      artificialLightColor: era.lighting.artificialLightColor,
      artificialLightIntensity: era.lighting.artificialLightIntensity,
      windowGlass: era.palette.windowGlass,
      night,
    },
    surfaces,
    units,
    advertising,
    graffiti,
  }

  return {
    ...withoutStats,
    stats: buildStats(
      withoutStats,
      advertising.length,
      advertisingCounts(advertising),
      distinctAdCampaigns(advertising).length,
    ),
  }
}

/**
 * Plan for one era — the entry point the scene integration and the transition
 * director both call.
 */
export function applyEra(eraId: EraId, context: StorefrontContext): StorefrontPlan {
  return buildStorefrontPlan(eraId, context)
}

/**
 * Plan for a staged era change.
 *
 * `mix` runs 0 → 1 as the block cross-fades from `from` to `to`; the renderer
 * swaps storefronts, signage, advertising and graffiti progressively, unit by
 * unit, at that depth (see {@link applyProgressiveSwap}). Under reduced motion
 * the change is one step: `mix` snaps to 0 or 1, so nothing animates.
 *
 * At `t = 1` the resolved plan is exactly `applyEra(to, context)`, which is what
 * makes the director's final frame identical to a direct switch.
 */
export function applyEraTransition(
  transition: StorefrontTransition,
  context: StorefrontContext,
): StorefrontTransitionPlan {
  const from = getEra(transition.from).id
  const to = getEra(transition.to).id
  const t = clamp(Number.isFinite(transition.t) ? transition.t : 0, 0, 1)
  const reducedMotion = context.reducedMotion ?? false
  const settled = from === to
  const fromPlan = applyEra(from, { ...context, reducedMotion })
  const toPlan = settled ? fromPlan : applyEra(to, { ...context, reducedMotion })
  const instant = reducedMotion && !settled
  const mix = settled ? 0 : instant ? (t >= 0.5 ? 1 : 0) : t
  const resolvedEra: EraId = settled ? to : mix >= 0.5 ? to : from
  const resolvedPlan = resolvedEra === to ? toPlan : fromPlan

  return {
    kind: STOREFRONT_TRANSITION_KIND,
    from,
    to,
    resolvedEra,
    t,
    mix,
    instant,
    plan: resolvedPlan,
    fromPlan,
    toPlan,
  }
}

/**
 * Stable digest of a plan.
 *
 * The plans are pure data built in a fixed order, so the digest is stable across
 * runs and machines; the harness publishes it and the tests use it to prove an
 * era rebuilds identically.
 */
export function storefrontPlanHash(plan: StorefrontPlan): string {
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
