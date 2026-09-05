/**
 * src/content/buildings/index.ts — public surface of the buildings module.
 *
 * Re-exports the scene module contract and the morph/detail primitives so other
 * scene modules (vehicles, street furniture, storefronts) can register content
 * against the same shared anchors without importing deep file paths.
 */

export { BuildingsSceneModule } from './BuildingsSceneModule';
export type { BuildingsSceneModuleOptions } from './BuildingsSceneModule';

export { BuildingMorphSlot, WINDOW_TEMPLATE, plotCenterAnchor } from './morph';
export type { BuildingAnchorGroup, BuildingMeshes } from './morph';

export { buildDetail, disposeDetailGroup } from './details';
export type { DetailBuildContext } from './details';

export { buildBuildingMaterials, disposeMaterialSet, buildLabelTexture } from './materials';
export type { BuildingMaterialSet, BuildingGlow } from './materials';

export {
  computeEnvelopePositions,
  computeWindowGridPositions,
  computeAnchorDims,
  fillBoxPositions,
  envelopeHeight,
  ANCHOR_SLOT_NAMES,
} from './geometry';

export type {
  AnchorDims,
  AnchorSlotName,
  EnvelopeDims,
  WindowGridLayout,
  WindowGridTemplate,
} from './geometry';