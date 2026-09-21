/**
 * Public surface of the era pedestrian crowd.
 *
 * ```ts
 * import {
 *   createPedestrianLayer,
 *   applyEra,
 *   applyEraTransition,
 *   estimateCrowdCost,
 *   PedestriansLayer,
 * } from 'src/city/pedestrians'
 *
 * // The transition director owns the staging; the layer owns the crowd.
 * const handle = createPedestrianLayer({ layout, tier: 'high', eraId: '1945' })
 * applyEra('1985', handle)                                   // instant path
 * applyEraTransition({ from: '1985', to: '2025', t: 0.5 }, handle) // staged path
 * estimateCrowdCost(handle.crowd, { cameraPosition })        // budget check
 * ```
 *
 * The barrel is the only module other owners import: the crowd can be driven
 * from a caller-supplied clock (`advanceCrowd`, `seekCrowd`) and rendered either
 * through the react-three-fiber component or straight from the instanced payload
 * (`collectInstances`), so nothing downstream depends on this layer's internal
 * file layout.
 *
 * Everything outside {@link PedestriansLayer} is renderer-free — the tables,
 * body generators, walk cycles, crowd simulation and cost estimate all run in
 * Node — which is how the unit and composition suites verify era-correct
 * outfits, crowds and crossings without a browser.
 */

export * from './types'
export * from './tables'
export * from './bodies'
export * from './outfits'
export * from './crowd'
export * from './PedestriansLayer'
