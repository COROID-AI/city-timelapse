// Re-export all asset builder modules
export { createBuilding, buildingBuilder } from './building.js';
export { createVehicle, vehicleBuilder } from './vehicle.js';
export { createPedestrian, pedestrianBuilder } from './pedestrian.js';
export { createStorefront, storefrontBuilder } from './storefront.js';
export { createAssetSet, type AssetSet } from './assetSet.js';
export type { AssetBuilder, BaseAssetConfig, Position3D } from './assetSet.js';