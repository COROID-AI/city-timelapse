/**
 * Public surface of the era vehicle layer.
 *
 * ```ts
 * import { createVehicleLayer, applyEra, applyEraTransition, ERA_VEHICLE_TABLES } from 'src/city/vehicles'
 *
 * const layer = createVehicleLayer({ layout, eraId: '1985' })
 * applyEra('2005', { layout, target: layer })                       // instant switch
 * applyEraTransition({ from: '2005', to: '2025', t: 0.5 }, { layout, target: layer })
 * ```
 *
 * The barrel is the single entry point other owners use: the composition layer
 * mounts `<VehiclesLayer>`, the transition director drives `applyEra` /
 * `applyEraTransition`, and the audio owner consumes the `SfxTrigger` events the
 * layer emits through its callback. The layer imports the era registry and the
 * layout, never the other way round, so it can be mounted on its own — which is
 * exactly what `harness.html` does.
 *
 * Exports in one glance:
 *
 * - **contract** — every record type of the layer, plus the SFX trigger shape.
 * - **data** — `VEHICLE_MODELS`, `ERA_VEHICLE_TABLES`, the validator, and the
 *   per-era fleet/marking/SFX tables keyed by the shared `EraId`.
 * - **markings** — era road markings and lane configuration as flat piece data.
 * - **traffic** — pure kinematics, parking, lights and SFX, plus
 *   `applyEra` / `applyEraTransition` and the `createVehicleLayer` factory.
 * - **models** — the three.js bridge: instanced procedural assemblies and the
 *   merged marking meshes.
 * - **component** — `<VehiclesLayer>` for react-three-fiber hosts.
 */

export * from './types'
export * from './tables'
export * from './markings'
export * from './traffic'
export * from './models'
export { VehiclesLayer } from './VehiclesLayer'
