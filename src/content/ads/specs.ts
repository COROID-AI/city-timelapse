/**
 * src/content/ads/specs.ts — ad spec re-export.
 *
 * The canonical declarative ad specs (media timeline: mural → neon →
 * billboard → screen, with period copy and palettes) live in src/eras.ts, the
 * single source of truth required by the plan. This module re-exports them
 * behind the content-module boundary so builders import from ./specs.
 */

export { AD_SPECS } from '../../eras';
export type { AdSpec } from '../../eras';