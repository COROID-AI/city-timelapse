// Era-content toolkit — public API re-exports
export type {
  BuildingParams,
  ArchitecturalStyle,
  WallMaterial,
  WindowPattern,
  CorniceDetail,
  RooftopType,
  AwningStyle,
  BuildingResult,
} from './building.js';
export { generateBuilding } from './building.js';

export type {
  StorefrontParams,
  AwningStyle as StorefrontAwningStyle,
  StorefrontResult,
} from './storefront.js';
export { generateStorefront } from './storefront.js';

export type {
  SignageParams,
  SignType,
  SignageResult,
} from './signage.js';
export { generateSignage, generateLetteringTexture } from './signage.js';

export type {
  VehicleParams,
  VehicleBodyType,
  RoofDetail,
  VehicleResult,
} from './vehicle.js';
export { generateVehicle } from './vehicle.js';

export type {
  PedestrianParams,
  OutfitSet,
  HatStyle,
  AccessoryType,
  PedestrianResult,
} from './pedestrian.js';
export { generatePedestrian } from './pedestrian.js';

export type {
  PropsParams,
  PropType,
  PropStyle,
  PropsResult,
} from './props.js';
export { generateProp } from './props.js';
