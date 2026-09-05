/**
 * src/content/storefronts/specs.ts — storefront spec re-export.
 *
 * The canonical declarative specs (period-correct signage, awnings, window
 * copy for all five eras) live in src/eras.ts, which is the single source of
 * truth required by the plan ("src/eras.ts holds declarative specs"). This
 * module re-exports them behind the content-module boundary so builders can
 * import from ./specs without blurring ownership.
 */

export { STOREFRONT_SPECS } from '../../eras';
export type { StorefrontSpec } from '../../eras';