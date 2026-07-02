/**
 * Application entry point.
 *
 * This is a minimal bootstrap that imports the asset-builder subsystem to
 * verify the foundation compiles and loads without runtime errors. The full
 * scene wiring (renderer, camera controller, timeline HUD, era transitions)
 * is added by the downstream "Main scene bootstrap" task.
 */

import {
  ERA_REGISTRY,
  getAssetSet,
  disposeAllAssets,
} from './assetBuilder/index.js';

// Verify the era registry and asset sets are intact at load time.
// This guards against any runtime import errors in the foundation.
const eraCount = ERA_REGISTRY.length;
const assetSetsOk = ERA_REGISTRY.every((spec) => {
  const set = getAssetSet(spec);
  return (
    set.building.facadePalette.length > 0 &&
    set.vehicle.palette.length > 0 &&
    set.pedestrian.combos.length > 0 &&
    set.street.lampColor.length > 0
  );
});

if (!assetSetsOk) {
  throw new Error('[main] Asset set validation failed for one or more eras.');
}

// Log readiness to the console (the full scene will attach to #app later).
console.info(
  `[city-timelapse] Asset foundation ready — ${eraCount} eras validated.`,
);

// Expose a teardown helper for hot-reload / testing.
if (typeof window !== 'undefined') {
  (window as unknown as { __cityTimelapseDispose?: () => void }).__cityTimelapseDispose =
    disposeAllAssets;
}
