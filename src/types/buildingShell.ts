import { EraYear, isEraYear, Rect, RotationDeg } from './city';

/**
 * BuildingShell contract.
 *
 * A building shell is the simple placeholder grey box rendered on a lot until
 * a downstream era module replaces it with full content. The contract describes
 * the shell's footprint and the era content slot it represents.
 */

/** A simple placeholder building shell placed on a lot. */
export interface BuildingShell {
  /** Unique id within the layout. */
  id: string;
  /** Footprint (position + size) in world units. */
  rect: Rect;
  /** Building height in world units. */
  height: number;
  /** Rotation of the building about its footprint origin. */
  rotation: RotationDeg;
  /** Era year this shell's content slot is currently showing. */
  era: EraYear;
}

/** Runtime validator for a BuildingShell. Returns an error string or null. */
export function validateBuildingShell(shell: BuildingShell): string | null {
  if (!shell) return 'building shell is null/undefined';
  if (!shell.id) return 'building shell missing id';
  if (!shell.rect) return 'building shell missing rect';
  if (shell.rect.width <= 0) return 'building shell width must be > 0';
  if (shell.rect.depth <= 0) return 'building shell depth must be > 0';
  if (shell.height <= 0) return 'building shell height must be > 0';
  if (!isEraYear(shell.era)) return `building shell has invalid era ${shell.era}`;
  return null;
}