/**
 * Public surface of the era pedestrian layer.
 *
 * ```ts
 * import { PedestriansLayer, applyEra, applyEraTransition, posePedestrians } from '../city/pedestrians'
 *
 * const plan = applyEra('1985', { layout })                       // one era, dressed
 * const staged = applyEraTransition({ from: '1985', to: '2025', t: 0.4 }, { layout })
 * posePedestrians(staged.plan, layout, 12.5)                      // world poses at t = 12.5 s
 * ```
 *
 * The barrel is the only module other owners import: the composition mounts the
 * group built by {@link createCrowdSceneObject}, the transition director drives
 * {@link applyEraTransition}, and the tests use the same entry points.
 *
 * A *plan* is plain data — one {@link Pedestrian} per person, each bound to a
 * real sampled sidewalk spline or a real crosswalk waypoint — so a crowd can be
 * hashed for determinism and published by the harness without a serialiser. The
 * three.js side ({@link createCrowdSceneObject}) paints that data with instanced
 * figures.
 */

export * from './types'
export * from './tables'
export * from './crowd'
export {
  FIGURE_HEIGHT_M,
  applyCrowdSwap,
  createCrowdSceneObject,
  outfitTint,
  summariseCrowdGroup,
} from './bodies'
export type { CrowdSceneCounts, CrowdSceneObject, CrowdSceneOptions } from './bodies'
export { PedestriansLayer } from './PedestriansLayer'
export type { PedestriansLayerProps } from './PedestriansLayer'
