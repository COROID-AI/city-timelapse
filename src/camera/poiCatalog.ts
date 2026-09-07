import { CityBlockLayout, createCityBlockLayout } from '../layout/cityBlockLayout';

/**
 * Point of Interest (POI) data contract.
 *
 * Numbered POIs define curated vantage points and look-at targets across the
 * city block layout for smooth camera fly-to navigation.
 */
export interface PointOfInterest {
  /** Unique identifier. */
  id: string;
  /** 1-based sequential number for UI and keyboard jumping. */
  number: number;
  /** Short human-readable name. */
  name: string;
  /** Description of the landmark or vantage. */
  description: string;
  /** Ideal camera vantage position in world space. */
  position: { x: number; y: number; z: number };
  /** World-space focal point the camera looks at. */
  lookAt: { x: number; y: number; z: number };
  /** Optional associated lot index (0..9). */
  lotIndex?: number;
}

/**
 * Generate the catalog of numbered Points of Interest based on the city block layout.
 */
export function createPoiCatalog(layout?: CityBlockLayout): PointOfInterest[] {
  const blockLayout = layout ?? createCityBlockLayout();
  const lots = blockLayout.lots;
  const crossStreet = blockLayout.crossStreet;
  const intersection = blockLayout.intersection;

  const pois: PointOfInterest[] = [
    {
      id: 'poi-1',
      number: 1,
      name: 'Block Overview',
      description: 'Elevated bird-eye perspective overlooking the entire district.',
      position: { x: 35, y: 32, z: 42 },
      lookAt: { x: 0, y: 6, z: 0 },
    },
    {
      id: 'poi-2',
      number: 2,
      name: 'South-East Intersection',
      description: 'Bustling corner intersection with traffic signals and streetlife.',
      position: {
        x: intersection.center.x - 8,
        y: 9,
        z: intersection.center.z - 8,
      },
      lookAt: {
        x: intersection.center.x,
        y: 2,
        z: intersection.center.z,
      },
    },
    {
      id: 'poi-3',
      number: 3,
      name: 'Cross Street Promenade',
      description: 'East-west axis cutting through the center of the block.',
      position: {
        x: crossStreet.rect.origin.x - 6,
        y: 6,
        z: crossStreet.rect.origin.z + crossStreet.rect.depth / 2,
      },
      lookAt: {
        x: crossStreet.rect.origin.x + crossStreet.rect.width / 2,
        y: 3,
        z: crossStreet.rect.origin.z + crossStreet.rect.depth / 2,
      },
    },
    {
      id: 'poi-4',
      number: 4,
      name: 'North-West Lot',
      description: 'North-west anchor building lot at the edge of the block.',
      position: {
        x: lots[0].center.x - 6,
        y: 8,
        z: lots[0].center.z - 8,
      },
      lookAt: {
        x: lots[0].center.x,
        y: 4,
        z: lots[0].center.z,
      },
      lotIndex: 0,
    },
    {
      id: 'poi-5',
      number: 5,
      name: 'North-East Lot',
      description: 'North-east corner parcel with prominent street frontage.',
      position: {
        x: lots[4].center.x + 6,
        y: 8,
        z: lots[4].center.z - 8,
      },
      lookAt: {
        x: lots[4].center.x,
        y: 4,
        z: lots[4].center.z,
      },
      lotIndex: 4,
    },
    {
      id: 'poi-6',
      number: 6,
      name: 'South-West Lot',
      description: 'South-west corner development and pedestrian sidewalk.',
      position: {
        x: lots[5].center.x - 6,
        y: 8,
        z: lots[5].center.z + 8,
      },
      lookAt: {
        x: lots[5].center.x,
        y: 4,
        z: lots[5].center.z,
      },
      lotIndex: 5,
    },
    {
      id: 'poi-7',
      number: 7,
      name: 'South-East Commercial Lot',
      description: 'Prime commercial lot facing the main transit corner.',
      position: {
        x: lots[9].center.x + 6,
        y: 8,
        z: lots[9].center.z + 8,
      },
      lookAt: {
        x: lots[9].center.x,
        y: 4,
        z: lots[9].center.z,
      },
      lotIndex: 9,
    },
  ];

  return pois;
}

/** Pre-built default POI catalog. */
export const defaultPoiCatalog: readonly PointOfInterest[] = Object.freeze(createPoiCatalog());

/** Find a POI by its string id. */
export function findPoiById(
  catalog: readonly PointOfInterest[],
  id: string,
): PointOfInterest | undefined {
  return catalog.find((poi) => poi.id === id);
}

/** Find a POI by its 1-based number. */
export function findPoiByNumber(
  catalog: readonly PointOfInterest[],
  num: number,
): PointOfInterest | undefined {
  return catalog.find((poi) => poi.number === num);
}

/** Find the nearest POI to a given world position. */
export function findNearestPoi(
  catalog: readonly PointOfInterest[],
  pos: { x: number; y: number; z: number },
): PointOfInterest | undefined {
  let bestPoi: PointOfInterest | undefined;
  let bestDistSq = Infinity;

  for (const poi of catalog) {
    const dx = poi.position.x - pos.x;
    const dy = poi.position.y - pos.y;
    const dz = poi.position.z - pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoi = poi;
    }
  }

  return bestPoi;
}
