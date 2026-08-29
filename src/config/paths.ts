/**
 * Shared path constants for the application.
 *
 * These names are the single source of truth for DOM mount points and
 * directory conventions used across the codebase, so downstream tasks can
 * rely on them instead of inventing their own paths.
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