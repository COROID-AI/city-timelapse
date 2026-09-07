import { EraYear, isEraYear, Rect, RotationDeg } from './city';

/**
 * StreetFeature contract.
 *
 * A street feature is any discrete, typed object placed on or beside a street
 * (traffic light, hydrant, bench, sign, tree pit, etc.). Downstream era modules
 * provide concrete reference implementations; this shared contract + runtime
 * validator keeps them interoperable.
 */

/** Discriminated kind of a street feature. */
export type StreetFeatureKind =
  | 'traffic_light'
  | 'hydrant'
  | 'bench'
  | 'sign'
  | 'tree_pit'
  | 'other';

/** A discrete street feature placed in world space. */
export interface StreetFeature {
  kind: StreetFeatureKind;
  /** Footprint (position + size) in world units. */
  rect: Rect;
  /** Rotation of the feature about its origin, in degrees. */
  rotation: RotationDeg;
  /** Era years in which this feature is present. */
  eras: readonly EraYear[];
  /** Optional per-kind payload. */
  data?: Record<string, unknown>;
}

/** Runtime validator for a StreetFeature. Returns an error string or null. */
export function validateStreetFeature(
  feature: StreetFeature,
): string | null {
  if (!feature) return 'street feature is null/undefined';
  if (!feature.kind) return 'street feature missing kind';
  if (!feature.rect) return 'street feature missing rect';
  if (feature.rect.width <= 0) return 'street feature width must be > 0';
  if (feature.rect.depth <= 0) return 'street feature depth must be > 0';
  if (feature.eras === undefined || feature.eras.length === 0) {
    return 'street feature must declare at least one era';
  }
  for (const y of feature.eras) {
    if (!isEraYear(y)) return `street feature has invalid era year ${y}`;
  }
  return null;
}