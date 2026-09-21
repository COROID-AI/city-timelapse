/**
 * Public surface of the era street-furniture layer.
 *
 * ```ts
 * import { PropsLayer, applyEra, applyEraTransition, createPropsRuntime } from '../city/props'
 *
 * // React: mount the layer for an era.
 * <PropsLayer layout={layout} eraId="1985" night />
 *
 * // Imperative: the transition director drives the layer directly.
 * const runtime = createPropsRuntime(layout)
 * applyEra('1945', { runtime })
 * applyEraTransition({ from: '1945', to: '1985', t: 0.4 }, { runtime })
 * ```
 *
 * The layer owns one anchor category set of the block (lamp posts, signal heads,
 * hydrants, utility pole tops, parcel prop points and corner clutter), the prop
 * catalogue that dresses them per period, the wear and lamp rules that follow
 * each era's palette and lighting data, and the staged appear/transform/retire
 * schedule a period change plays out.
 *
 * | group            | what it is                                                    |
 * | ---------------- | ------------------------------------------------------------- |
 * | `types.ts`       | the data contract: slots, recipes, wear, plans, transitions    |
 * | `recipes.ts`     | shared part catalogue, material palette and prop recipes       |
 * | `tables.ts`      | the five era catalogues, lifespans and wear profiles           |
 * | `placement.ts`   | deterministic anchor → prop placement, legality and transitions |
 * | `PropsLayer.tsx` | three.js batching, the runtime and the React component         |
 *
 * Nothing here writes to the layout: props are attached to the layout's named
 * anchors and are placed inside the sidewalk sub-bands the layout publishes.
 */

export * from './types'
export * from './recipes'
export * from './tables'
export * from './placement'
export {
  PropsLayer,
  applyEra,
  applyEraTransition,
  buildPartGeometry,
  buildPropsObject,
  createPropsGeometryCache,
  createPropsRuntime,
  disposeBuiltLayer,
  partLocalMatrix,
  partVisibleAtTier,
  placementMatrix,
  setPropTransform,
  settleBuiltLayer,
  RUNTIME_ERA_CACHE_LIMIT,
  type BuildPropsOptions,
  type BuiltPropBatch,
  type BuiltPropsLayer,
  type PropInstanceSlot,
  type PropsGeometryCache,
  type PropsApplyContext,
  type PropsLayerHandle,
  type PropsLayerProps,
  type PropsRuntime,
  type PropsRuntimeOptions,
  type PropTransform,
} from './PropsLayer'

import type { BlockLayout } from '../layout'
import type { EraId } from '../../era'
import type { PropsLayerPlan } from './types'
import type { PropsApplyContext, PropsRuntime } from './PropsLayer'
import { createPropsRuntime } from './PropsLayer'

/* ------------------------------------------------------------------------- *
 * Integration names
 * ------------------------------------------------------------------------- */

/**
 * The canonical integration handle: a props runtime for the canonical block.
 *
 * Same contract as {@link createPropsRuntime}; named for the scene integration,
 * which builds one runtime per block and drives it from the era store.
 */
export function createCityProps(
  layout: BlockLayout,
  options: Parameters<typeof createPropsRuntime>[1] = {},
): PropsRuntime {
  return createPropsRuntime(layout, options)
}

/**
 * Applies one era to a runtime held by the integration.
 *
 * Thin wrapper over `PropsRuntime.applyEra` so the composition root can call
 * `applyEra('2005', { runtime, night })` without importing the class of the
 * runtime, exactly as the plan's integration contract describes.
 */
export function applyEraToRuntime(eraId: EraId, context: PropsApplyContext): PropsLayerPlan {
  return context.runtime.applyEra(eraId, { night: context.night })
}
