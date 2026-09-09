/**
 * Shared era definitions and year conversion utilities.
 *
 * Fixed era set: 1945, 1965, 1985, 2005, 2025.
 * Pure logic and types only — no DOM, no Three.js.
 */

export const ERAS = ['1945', '1965', '1985', '2005', '2025'] as const;

export type EraId = (typeof ERAS)[number];

export const DEFAULT_ERA: EraId = '1945';

/**
 * Type guard to verify if an arbitrary value is a valid EraId.
 */
export function isEraId(value: unknown): value is EraId {
  return typeof value === 'string' && (ERAS as readonly string[]).includes(value);
}

/**
 * Returns the zero-based index of the era (0 to 4), or -1 if invalid.
 */
export function getEraIndex(era: EraId): number {
  return ERAS.indexOf(era);
}

/**
 * Returns the EraId at the given zero-based index, or undefined if out of range.
 */
export function getEraByIndex(index: number): EraId | undefined {
  return ERAS[index];
}

/**
 * Returns the next chronological EraId, or undefined if already at the last era.
 */
export function getNextEra(era: EraId): EraId | undefined {
  const index = getEraIndex(era);
  if (index < 0 || index >= ERAS.length - 1) return undefined;
  return ERAS[index + 1];
}

/**
 * Returns the previous chronological EraId, or undefined if already at the first era.
 */
export function getPreviousEra(era: EraId): EraId | undefined {
  const index = getEraIndex(era);
  if (index <= 0) return undefined;
  return ERAS[index - 1];
}

/**
 * Converts an EraId to its integer year number (e.g. '1945' -> 1945).
 */
export function eraToYearNumber(era: EraId): number {
  return Number.parseInt(era, 10);
}

/**
 * Converts a year number to its matching EraId, or undefined if not one of the five eras.
 */
export function yearNumberToEra(year: number): EraId | undefined {
  const str = String(year);
  return isEraId(str) ? str : undefined;
}

/**
 * Converts a continuous global timeline progress (0.0 at 1945 to 1.0 at 2025)
 * into a discrete TimelineChannel span { fromEra, toEra, t }.
 */
export function globalProgressToChannel(progress: number): {
  fromEra: EraId;
  toEra: EraId;
  t: number;
} {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const segmentCount = ERAS.length - 1; // 4 segments

  if (clamped >= 1) {
    const lastEra = ERAS[ERAS.length - 1];
    return { fromEra: lastEra, toEra: lastEra, t: 0 };
  }

  const scaled = clamped * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaled), segmentCount - 1);
  const localT = scaled - segmentIndex;

  return {
    fromEra: ERAS[segmentIndex],
    toEra: ERAS[segmentIndex + 1],
    t: localT,
  };
}

/**
 * Converts a TimelineChannel { fromEra, toEra, t } into a continuous global progress (0.0 to 1.0).
 */
export function channelToGlobalProgress(channel: {
  fromEra: EraId;
  toEra: EraId;
  t: number;
}): number {
  const fromIdx = getEraIndex(channel.fromEra);
  const toIdx = getEraIndex(channel.toEra);
  const segmentCount = ERAS.length - 1;

  if (fromIdx < 0 || toIdx < 0 || segmentCount === 0) return 0;
  if (fromIdx === toIdx) return fromIdx / segmentCount;

  const t = Math.max(0, Math.min(1, Number.isFinite(channel.t) ? channel.t : 0));
  const interpolatedIdx = fromIdx + (toIdx - fromIdx) * t;
  return Math.max(0, Math.min(1, interpolatedIdx / segmentCount));
}
