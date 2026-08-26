import * as THREE from 'three';

/**
 * City block layout — the stable coordinate reference for the whole scene.
 *
 * Every subsystem (buildings, vehicles, pedestrians, street props) reads its
 * anchor positions and lane/pavement geometry from this module instead of
 * hard-coding coordinates. This keeps the scene coherent and lets the ground,
 * streets and sidewalks render consistently with the layout that all other
 * subsystems attach to.
 *
 * Coordinate convention (X right, Z toward viewer, Y up):
 *  - The block is centred on the origin.
 *  - `blockSize` is the width/depth of the central buildable parcel.
 *  - A sidewalk band runs around the block; streets run outside the sidewalk.
 */

export interface BlockLayout {
  /** Total footprint width (X) of the buildable block, in world units. */
  blockSize: number;
  /** Width of the sidewalk band around the block. */
  sidewalkWidth: number;
  /** Width of one street lane. */
  laneWidth: number;
  /** Number of street lanes on each side of the block. */
  lanesPerSide: number;
  /** Ground elevation (Y) at which everything sits. */
  groundY: number;

  /** World-space half extents used to build meshes. */
  blockHalf: number;
  /** Inner sidewalk bounds (X/Z) — the block edge. */
  sidewalkInner: number;
  /** Outer sidewalk bounds (X/Z). */
  sidewalkOuter: number;
  /** Street inner edge (X/Z) — where the curb meets the road. */
  streetInner: number;
  /** Street outer edge (X/Z). */
  streetOuter: number;
}

export const BLOCK_LAYOUT: BlockLayout = buildLayout({
  blockSize: 120,
  sidewalkWidth: 4,
  laneWidth: 3.5,
  lanesPerSide: 2,
  groundY: 0,
});

function buildLayout(cfg: {
  blockSize: number;
  sidewalkWidth: number;
  laneWidth: number;
  lanesPerSide: number;
  groundY: number;
}): BlockLayout {
  const blockHalf = cfg.blockSize / 2;
  const sidewalkInner = blockHalf; // block edge
  const sidewalkOuter = sidewalkInner + cfg.sidewalkWidth;
  const streetInner = sidewalkOuter;
  const streetOuter = streetInner + cfg.laneWidth * cfg.lanesPerSide;
  return {
    blockSize: cfg.blockSize,
    sidewalkWidth: cfg.sidewalkWidth,
    laneWidth: cfg.laneWidth,
    lanesPerSide: cfg.lanesPerSide,
    groundY: cfg.groundY,
    blockHalf,
    sidewalkInner,
    sidewalkOuter,
    streetInner,
    streetOuter,
  };
}

/** The four cardinal street axes (N/E/S/W) used to place lanes & traffic. */
export type StreetSide = 'north' | 'east' | 'south' | 'west';

/** Anchor positions for a building placed on the block, on a given side. */
export interface BuildingAnchor {
  /** Centre position at ground level on the block. */
  position: THREE.Vector3;
  /** Footprint width (X) and depth (Z) available for the building. */
  size: { width: number; depth: number };
  /** Which street the building fronts. */
  side: StreetSide;
}

/** Vehicle lane anchor: a centre line along a street with a direction. */
export interface LaneAnchor {
  /** Start point of the lane. */
  start: THREE.Vector3;
  /** End point of the lane. */
  end: THREE.Vector3;
  /** Unit direction of travel (X/Z plane). */
  direction: THREE.Vector3;
  /** Side of the block this lane runs along. */
  side: StreetSide;
  /** 1 = forward along the side, -1 = reverse. */
  sense: 1 | -1;
}

/**
 * Build the list of building anchor footprints around the four sides of the
 * block, leaving gaps for cross-streets at the corners.
 */
export function getBuildingAnchors(): BuildingAnchor[] {
  const { blockHalf, sidewalkWidth } = BLOCK_LAYOUT;
  const inset = blockHalf - 1; // margin from the curb
  const sideLength = blockHalf * 2;
  // Reserve corner cutouts so each side's buildings stop short of the corners.
  const cornerInset = 10;
  const usable = sideLength - cornerInset * 2;
  const count = 3; // buildings per side
  const width = usable / count;

  const anchors: BuildingAnchor[] = [];
  const sides: StreetSide[] = ['north', 'east', 'south', 'west'];

  for (const side of sides) {
    const along = new THREE.Vector3();
    const normal = new THREE.Vector3();
    if (side === 'north') {
      along.set(1, 0, 0);
      normal.set(0, 0, -1);
    } else if (side === 'east') {
      along.set(0, 0, 1);
      normal.set(-1, 0, 0);
    } else if (side === 'south') {
      along.set(-1, 0, 0);
      normal.set(0, 0, 1);
    } else {
      along.set(0, 0, -1);
      normal.set(1, 0, 0);
    }

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5; // -0.5..0.5
      const alongOffset = t * usable;
      const center = new THREE.Vector3()
        .addScaledVector(along, alongOffset)
        .addScaledVector(normal, inset);
      anchors.push({
        position: center,
        size: { width, depth: blockHalf - sidewalkWidth },
        side,
      });
    }
  }
  return anchors;
}

/** Build vehicle lane anchors around all four street sides. */
export function getLaneAnchors(): LaneAnchor[] {
  const { streetInner, streetOuter, blockHalf } = BLOCK_LAYOUT;
  const laneCenter = (streetInner + streetOuter) / 2;
  const length = blockHalf * 2 + streetOuter * 2;

  const lanes: LaneAnchor[] = [];
  const halfLength = length / 2;

  // North street runs along Z = -laneCenter, travelling in +X.
  lanes.push(makeLane('north', new THREE.Vector3(-halfLength, 0, -laneCenter), new THREE.Vector3(halfLength, 0, -laneCenter), 1));
  // South street travels -X.
  lanes.push(makeLane('south', new THREE.Vector3(halfLength, 0, laneCenter), new THREE.Vector3(-halfLength, 0, laneCenter), -1));
  // East street travels +Z.
  lanes.push(makeLane('east', new THREE.Vector3(laneCenter, 0, -halfLength), new THREE.Vector3(laneCenter, 0, halfLength), 1));
  // West street travels -Z.
  lanes.push(makeLane('west', new THREE.Vector3(-laneCenter, 0, halfLength), new THREE.Vector3(-laneCenter, 0, -halfLength), -1));

  return lanes;
}

function makeLane(side: StreetSide, start: THREE.Vector3, end: THREE.Vector3, sense: 1 | -1): LaneAnchor {
  const direction = end.clone().sub(start).normalize();
  return { start, end, direction, side, sense };
}

/** A sidewalk anchor: a walkable strip along one side of the block. */
export interface SidewalkAnchor {
  /** Centre line start of the sidewalk strip. */
  start: THREE.Vector3;
  /** Centre line end of the sidewalk strip. */
  end: THREE.Vector3;
  /** Midpoint used as a spawn point for pedestrians. */
  midpoint: THREE.Vector3;
  side: StreetSide;
}

/** Build sidewalk anchors for pedestrian placement. */
export function getSidewalkAnchors(): SidewalkAnchor[] {
  const { sidewalkInner, sidewalkOuter } = BLOCK_LAYOUT;
  const centre = (sidewalkInner + sidewalkOuter) / 2;
  const length = BLOCK_LAYOUT.blockSize + sidewalkOuter * 2;
  const half = length / 2;

  const north: SidewalkAnchor = {
    start: new THREE.Vector3(-half, 0, -centre),
    end: new THREE.Vector3(half, 0, -centre),
    midpoint: new THREE.Vector3(0, 0, -centre),
    side: 'north',
  };
  const south: SidewalkAnchor = {
    start: new THREE.Vector3(half, 0, centre),
    end: new THREE.Vector3(-half, 0, centre),
    midpoint: new THREE.Vector3(0, 0, centre),
    side: 'south',
  };
  const east: SidewalkAnchor = {
    start: new THREE.Vector3(centre, 0, -half),
    end: new THREE.Vector3(centre, 0, half),
    midpoint: new THREE.Vector3(centre, 0, 0),
    side: 'east',
  };
  const west: SidewalkAnchor = {
    start: new THREE.Vector3(-centre, 0, half),
    end: new THREE.Vector3(-centre, 0, -half),
    midpoint: new THREE.Vector3(-centre, 0, 0),
    side: 'west',
  };
  return [north, east, south, west];
}