/**
 * Public surface of the era atmosphere layer (`src/vfx`).
 *
 * This barrel is the only module other owners may import. It exposes:
 *
 * - `<VfxLayer>` — the React component the composed application mounts inside
 *   its `<SceneCanvas>`; it takes the pipeline from the scene context (or a
 *   `pipeline` prop) plus `era`, `clock`, `plumeSources` and an optional
 *   `transition`.
 * - `createVfxController` — the same layer without React, for harnesses, tests
 *   and imperative callers.
 * - `applyEra(eraId, ctx)` and `applyEraTransition({ from, to, t }, ctx)` — the
 *   stateless entry points the transition director uses to stage the atmosphere
 *   ahead of the built layers, and to switch instantly for reduced motion.
 * - `resolveVfxSnapshot` and the per-domain resolvers (sky, fog, grade, weather,
 *   plumes) plus the shipped `VFX_ERA_TABLES`, for QA and for content layers that
 *   need era values without mounting anything.
 *
 * Integration notes for the composition task
 * -----------------------------------------
 * 1. Mount `<VfxLayer era={selected} clock={clock} plumeSources={sources} />` as
 *    a child of `<SceneCanvas>`; the layer finds the pipeline in context.
 * 2. `plumeSources` is how live vehicles and vents reach the atmosphere:
 *    `{ id, kind: 'exhaust' | 'steam' | 'evGlow', position: [x, y, z], intensity }`.
 *    Pass `[]` (or nothing) and the era's own baseline plumes still render.
 * 3. For a staged change, drive `applyEraTransition({ from, to, t }, ctx)` from
 *    the director, or pass a `transition` prop; `t >= 1` lands exactly on the
 *    destination era, and `applyEra` is the instant/reduced-motion path.
 * 4. The layer drives sun, fog and grade only through the pipeline's public
 *    `applyLighting`/`applyPostProcessing` surface and adds exactly one group
 *    (`vfx-root`) to `pipeline.world`; it never creates a light or a pass.
 */

export * from './types'
export * from './sky'
export * from './fog'
export * from './grade'
export * from './particles'
export * from './plumes'
export * from './tables'
export * from './VfxLayer'
