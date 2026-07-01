import type { EraId } from './types';

/**
 * The five eras the timeline can stop on. Order is significant: it drives the
 * progress rail width and adjacency diff checks.
 */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'] as const;

export const DEFAULT_ERA_INDEX = 0;

/** Duration (ms) of the camera + scene crossfade tween between two eras. */
export const ERA_TWEEN_MS = 800;

/** Clamp window for externally requested tween durations (ms). */
export const TWEEN_DURATION_RANGE: readonly [number, number] = [0, 5000] as const;

/** Clamp a requested tween duration into the allowed range. */
export function clampTweenDuration(ms: number): number {
  return Math.max(TWEEN_DURATION_RANGE[0], Math.min(TWEEN_DURATION_RANGE[1], Math.round(ms)));
}

/** Validate that an index points to a real era; returns a normalized index or throws. */
export function assertValidEraIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= ERA_IDS.length) {
    throw new RangeError(
      `Invalid era index ${index}; must be an integer in [0, ${ERA_IDS.length - 1}].`,
    );
  }
  return index;
}

/** Safely coerce a value to an era index, rejecting unknown ids. */
export function eraIdToIndex(id: string): number {
  const idx = ERA_IDS.indexOf(id as EraId);
  if (idx < 0) {
    throw new RangeError(`Unknown era id "${id}"; expected one of ${ERA_IDS.join(', ')}.`);
  }
  return idx;
}

export { eraIdToIndex as toEraIndex };
