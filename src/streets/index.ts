// Streets module — public exports
// Era-aware storefronts, signage, advertisements, and street furniture

export { buildStreetscape } from './layer.js';

export {
  createSignTexture,
  createNeonSignTexture,
  createLEDStripTexture,
  buildSignMesh,
  buildNeonSignMesh,
  getSignForBuilding,
} from './signage.js';

export { buildStorefront } from './storefronts.js';

export {
  createAdTexture,
  buildBillboard,
  buildWallAd,
  getAdCount,
} from './ads.js';

export {
  buildStreetFurniture,
  buildPhoneBooth,
  buildFireHydrant,
  buildTrafficLight,
  buildBusStop,
  buildBench,
  buildTrashCan,
  buildMailbox,
  buildNewspaperStand,
} from './streetfurniture.js';
