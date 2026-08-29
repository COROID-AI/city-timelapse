/**
 * Shared path, mount, and block-extent constants for the application.
 *
 * These names are the single source of truth for DOM mount points and
 * directory conventions used across the codebase, so downstream tasks can
 * rely on them instead of inventing their own paths.
 *
 * The block-extent constants describe the city block footprint. Buildings,
 * environment, and the camera controller all derive their bounds from these
 * shared values so they agree on the block footprint.
 */

/** DOM selector for the single application mount point. */
export const APP_MOUNT_SELECTOR = '#app';

/** DOM selector for the loading overlay shown until the first frame renders. */
export const LOADING_OVERLAY_SELECTOR = '#loading';

/** Root directory under which all domain module folders live. */
export const SRC_ROOT = 'src';

/** Domain module directories that later tasks own exclusively. */
export const DOMAIN_DIRECTORIES = [
  'engine',
  'data/eras',
  'environment',
  'buildings',
  'props',
  'vehicles',
  'pedestrians',
  'ui',
  'assets',
  'audio',
] as const;

/** Half-extent of the city block along the local X axis, in world units. */
export const BLOCK_HALF_EXTENT_X = 14;
/** Half-extent of the city block along the local Z axis, in world units. */
export const BLOCK_HALF_EXTENT_Z = 12;
/** Height above the block (y=0) where the sky enclosure / atmosphere sits. */
export const BLOCK_MAX_HEIGHT = 10;
/** The block starts at this X coordinate. */
export const BLOCK_MIN_X = -BLOCK_HALF_EXTENT_X;
/** The block ends at this X coordinate. */
export const BLOCK_MAX_X = BLOCK_HALF_EXTENT_X;
/** The block starts at this Z coordinate. */
export const BLOCK_MIN_Z = -BLOCK_HALF_EXTENT_Z;
/** The block ends at this Z coordinate. */
export const BLOCK_MAX_Z = BLOCK_HALF_EXTENT_Z;