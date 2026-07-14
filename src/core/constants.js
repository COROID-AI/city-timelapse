// Global shared constants for the city timelapse scene.

export const ERA_KEYS = ['1945', '1965', '1985', '2005', '2025', '2055'];

export const TRANSITION = {
  duration: 2.6, // seconds for a full era-to-era change
  waveFade: 0.22, // fraction of the wave-front band width (relative to world span)
};

export const WORLD = {
  half: 120, // half extent of the ground plane
  roadWidth: 16,
  sidewalkWidth: 5,
  edgeMargin: 6,
};

// Convenience derived geometry values.
export const ROAD_HALF = WORLD.roadWidth / 2;
// Inner edge where building plots begin (road half + sidewalk).
export const BLOCK_INNER = ROAD_HALF + WORLD.sidewalkWidth;

export const BUILD = {
  bayWidth: 4.2, // width of one window bay (used to compute window column counts)
  floorHeight: 3.6,
};

export const COLORS = {
  asphalt: '#23262b',
  asphaltLine: '#c9b23a',
  sidewalk: '#9a9690',
  curb: '#5b5853',
};
