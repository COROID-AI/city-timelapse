/**
 * Asset Builder Module - Factory patterns for era-specific 3D assets
 */

export { BuildingFactory, type Building } from './building';
export { VehicleFactory, type Vehicle } from './vehicle';
export { PedestrianFactory, type Pedestrian } from './pedestrian';
export { StorefrontFactory, type Storefront } from './storefront';
export { AssetSet, type AssetConfig } from './assetSet';