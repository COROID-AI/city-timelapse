// Buildings module — public exports

export type { BuildingSpec, BuildingFootprint, RooftopProps, BuildingStyleKey, BuildingMaterials } from './specs.js';

export {
  ERA_BUILDING_MAP,
  BUILDINGS_1945,
  BUILDINGS_1965,
  BUILDINGS_1985,
  BUILDINGS_2005,
  BUILDINGS_2025,
} from './specs.js';

export {
  buildBuilding,
  buildEraBuildings,
  resolveMaterials,
  debugFootprintComparison,
} from './registry.js';

export {
  mergeGeometries,
  buildFacade,
  buildCornice,
  buildBayWindow,
  buildFireEscape,
  buildStorefront,
  buildWaterTower,
  buildTVAntenna,
  buildSatelliteDish,
  buildACUnit,
  buildACBank,
  buildSolarArray,
  buildGreenRoof,
  buildChimney,
  buildHelipad,
} from './parts.js';

export { BuildingTextureBuilder } from './parts.js';
