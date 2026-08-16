// ─── Vehicles Module Exports ────────────────────────────────────────
// Era-aware procedural vehicle system for the city timelapse.

export { createVehicle, createInstancedVehicle } from './factory.js';
export type { VehicleType } from './specs.js';
export { ERA_TRAFFIC_SPECS, resolveFactoryType } from './specs.js';
export type { EraTrafficSpec, VehicleEntry, LaneConfig, ParkingConfig, StreetMarkings } from './specs.js';
export { TrafficManager } from './traffic.js';
export {
  assembleVehicle,
  createChassis,
  createCabin,
  createWheel,
  createWheelPair,
  createHeadlights,
  createBumper,
  createMirrors,
  createEScooter,
  createEBike,
} from './parts.js';
