/**
 * HUD state helpers — pure, DOM-free building blocks for the neon HUD.
 *
 * The overlay does *minimal DOM diffing*: text and style writes only happen
 * when a value has actually changed across frames. Keeping those primitives
 * pure (no `document` access) means they are trivially unit-testable in the
 * Node Jest environment and give the hot per-frame `update()` a cheap,
 * allocation-light fingerprinting path.
 *
 * All functions here are intentionally side-effect free so the integration
 * task and the diffing tests can rely on shallow, deterministic behaviour.
 */

/** A per-key value tracker that reports whether a value changed since the last call. */
export interface DiffTracker {
  /**
   * Record a value under `key`. Returns `true` when the value differs from the
   * most recently recorded value for that key (including the first time it is
   * ever seen), and `false` when it is identical. Use the return value to gate
   * a DOM write so unchanged frames touch nothing.
   */
  record(key: string, next: unknown): boolean;
}

/**
 * Create a fresh diff tracker backed by a plain keyed cache. Values are
 * compared with strict equality (`===`), so callers should pass *derived*
 * strings/numbers (already formatted) rather than raw floats that would jitter
 * every frame.
 */
export function createDiffTracker(): DiffTracker {
  const seen = new Map<string, unknown>();
  return {
    record(key: string, next: unknown): boolean {
      const prev = seen.get(key);
      if (prev === next) return false;
      seen.set(key, next);
      return true;
    },
  };
}

/**
 * Format a world-unit-per-second speed as an integer string for the speed
 * readout. Speeds are shown to the player as absolute kilometres-per-hour by
 * scaling the world units (cheap and readable for a neon arcade HUD).
 */
export function formatSpeed(speed: number): string {
  return String(Math.max(0, Math.round(speed * 3.6)));
}

/**
 * Format milliseconds as `mm:ss.mmm` (e.g. `01:23.456`). Used for both the
 * running lap time and the total race clock so the readout never flickers
 * between layouts while digits tick over.
 */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}

/**
 * Render a lap counter as `current/total` (1-based), clamping the current lap
 * into the valid range so a finished car shows exactly `total/total`.
 */
export function formatLap(lap: number, total: number): string {
  const safeTotal = total > 0 ? total : 3;
  const cur = Math.min(Math.max(1, lap), safeTotal);
  return `${cur}/${safeTotal}`;
}

/**
 * Turn the race director's remaining `seconds` into the 3-2-1-GO label: the
 * ceiling of the remaining time while counting down (`3` → `2` → `1`) and
 * `GO` the instant the countdown is exhausted.
 */
export function countdownLabel(seconds: number): string {
  const n = Math.ceil(seconds);
  return n > 0 ? String(n) : 'GO';
}

/**
 * Convert a [0, 1] ratio (e.g. nitrous reserve) into a 0..100 percentage used
 * as the meter fill width. Clamped so out-of-range state never overflows.
 */
export function tintPercent(ratio: number): number {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}