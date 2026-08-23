/**
 * Adaptive quality manager for the City Era Timelapse scene.
 *
 * The renderer shell feeds `update(dt)` every frame. The manager watches a
 * rolling two-second FPS window and protects the frame rate on typical
 * hardware without sacrificing the polished default look: two consecutive
 * windows below 30 fps step the quality down ONE level (high → medium → low),
 * two consecutive windows above 55 fps step it back up. Gradual, single-notch
 * steps avoid visible popping.
 *
 * Every level maps to:
 * - a device-pixel-ratio clamp (`getPixelRatio()`),
 * - a shadow map size (`getShadowMapSize()`),
 * - a detail tier (`getTier()`) that era modules may consult for optional
 *   LOD toggles.
 *
 * A manual `setLevel()` call pins the level and suspends automatic stepping
 * until `resumeAuto()` is called (settings-toggle escape hatch). `dispose()`
 * neutralizes the instance; it owns no GPU/DOM resources itself.
 */

/** Named quality levels, ordered from best to worst. */
export type QualityLevel = 'high' | 'medium' | 'low';

/** Numeric LOD tier surfaced for era modules (higher = more detail). */
export type DetailTier = 0 | 1 | 2;

/** Ordered quality levels, best → worst; stepping down walks toward the end. */
export const QUALITY_LEVELS: readonly QualityLevel[] = ['high', 'medium', 'low'];

/** Detail tier per level; era modules gate optional props on these values. */
export const DETAIL_TIER: Readonly<Record<QualityLevel, DetailTier>> = {
  high: 2,
  medium: 1,
  low: 0,
};

/** Fraction of the device pixel ratio each level renders at. */
export const PIXEL_RATIO_SCALE: Readonly<Record<QualityLevel, number>> = {
  high: 1.0,
  medium: 0.75,
  low: 0.5,
};

/** Shadow map resolution per level (square, in texels). */
export const SHADOW_MAP_SIZE: Readonly<Record<QualityLevel, number>> = {
  high: 2048,
  medium: 1024,
  low: 512,
};

/** Length of the rolling measurement window in seconds. */
export const FPS_WINDOW_SECONDS = 2;

/** Average FPS at or above which a window counts as "too slow". */
export const LOW_FPS_THRESHOLD = 30;

/** Average FPS above which a window counts as "fast enough to upgrade". */
export const HIGH_FPS_THRESHOLD = 55;

/** Consecutive bad/good windows required before the level changes. */
export const CONSECUTIVE_WINDOWS_REQUIRED = 2;

/** Upper clamp applied to the derived pixel ratio (renderer-shell policy). */
export const DEFAULT_MAX_PIXEL_RATIO = 2;

/**
 * Frames longer than this are treated as hitches (tab suspension, breakpoint)
 * rather than real performance signal and are discarded.
 */
export const MAX_SAMPLED_DELTA_SECONDS = 0.5;

/** Position of each level inside {@link QUALITY_LEVELS}. */
const LEVEL_INDEX: Readonly<Record<QualityLevel, number>> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface QualityManagerOptions {
  /** Level to start at. Defaults to `'high'` (the polished default look). */
  readonly initialLevel?: QualityLevel;
  /** Device pixel ratio; defaults to `globalThis.devicePixelRatio` or `1`. */
  readonly devicePixelRatio?: number;
  /** Ceiling for the derived pixel ratio. Defaults to `2` (shell policy). */
  readonly maxPixelRatio?: number;
  /** Notified whenever the active level changes (auto step or manual set). */
  readonly onChange?: (level: QualityLevel) => void;
}

function isQualityLevel(value: unknown): value is QualityLevel {
  return (
    typeof value === 'string' &&
    (QUALITY_LEVELS as readonly string[]).includes(value)
  );
}

function requirePositiveFinite(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(
      `QualityManager: ${name} must be a positive finite number, got ${String(value)}.`,
    );
  }
  return value;
}

function detectDevicePixelRatio(): number {
  const scope = globalThis as { devicePixelRatio?: unknown };
  const value = scope.devicePixelRatio;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 1;
}

export class QualityManager {
  #level: QualityLevel;
  #automatic = true;
  #disposed = false;
  readonly #devicePixelRatio: number;
  readonly #maxPixelRatio: number;
  #onChange: ((level: QualityLevel) => void) | null;

  // Rolling-window bookkeeping.
  #windowSeconds = 0;
  #windowFrames = 0;
  #consecutiveSlowWindows = 0;
  #consecutiveFastWindows = 0;

  constructor(options: QualityManagerOptions = {}) {
    const initial = options.initialLevel ?? 'high';
    if (!isQualityLevel(initial)) {
      throw new RangeError(
        `QualityManager: unknown quality level "${String(initial)}".`,
      );
    }
    this.#level = initial;
    this.#devicePixelRatio =
      options.devicePixelRatio === undefined
        ? detectDevicePixelRatio()
        : requirePositiveFinite('devicePixelRatio', options.devicePixelRatio);
    this.#maxPixelRatio = requirePositiveFinite(
      'maxPixelRatio',
      options.maxPixelRatio ?? DEFAULT_MAX_PIXEL_RATIO,
    );
    this.#onChange = options.onChange ?? null;
  }

  /** Current quality level. */
  getLevel(): QualityLevel {
    return this.#level;
  }

  /** Detail tier for era modules' optional LOD toggles (0 = lowest). */
  getTier(): DetailTier {
    return DETAIL_TIER[this.#level];
  }

  /**
   * Pixel ratio the renderer should use: the level's fraction of the device
   * pixel ratio, clamped to the configured ceiling.
   */
  getPixelRatio(): number {
    return Math.min(
      this.#devicePixelRatio * PIXEL_RATIO_SCALE[this.#level],
      this.#maxPixelRatio,
    );
  }

  /** Shadow map resolution (square texels) the renderer should allocate. */
  getShadowMapSize(): number {
    return SHADOW_MAP_SIZE[this.#level];
  }

  /** True while automatic FPS-driven stepping is active. */
  isAutomatic(): boolean {
    return this.#automatic && !this.#disposed;
  }

  /**
   * Manually pin the quality level. Suspends automatic stepping until
   * {@link resumeAuto} is called. Ignored after {@link dispose}.
   */
  setLevel(level: QualityLevel): void {
    if (this.#disposed) return;
    if (!isQualityLevel(level)) {
      throw new RangeError(
        `QualityManager: unknown quality level "${String(level)}".`,
      );
    }
    this.#automatic = false;
    this.#resetWindowBookkeeping();
    this.#applyLevel(level);
  }

  /** Re-enable automatic stepping after a manual override. */
  resumeAuto(): void {
    if (this.#disposed) return;
    this.#automatic = true;
    this.#resetWindowBookkeeping();
  }

  /**
   * Feed one frame's delta (seconds). Invalid or hitch-sized deltas are
   * discarded so tab suspensions cannot fake a slowdown. While a manual
   * override is active the manager only observes — it never steps.
   */
  update(dt: number): void {
    if (this.#disposed || !this.#automatic) return;
    if (!Number.isFinite(dt) || dt <= 0 || dt > MAX_SAMPLED_DELTA_SECONDS) {
      return;
    }

    this.#windowFrames += 1;
    this.#windowSeconds += dt;
    if (this.#windowSeconds < FPS_WINDOW_SECONDS) return;

    const averageFps = this.#windowFrames / this.#windowSeconds;
    // Carry the sub-frame remainder so long sessions stay drift-free.
    this.#windowSeconds -= FPS_WINDOW_SECONDS;
    this.#windowFrames = 0;
    this.#evaluateWindow(averageFps);
  }

  /** Detaches the change callback and freezes the instance. Idempotent. */
  dispose(): void {
    this.#disposed = true;
    this.#onChange = null;
    this.#automatic = false;
    this.#resetWindowBookkeeping();
  }

  #resetWindowBookkeeping(): void {
    this.#windowSeconds = 0;
    this.#windowFrames = 0;
    this.#consecutiveSlowWindows = 0;
    this.#consecutiveFastWindows = 0;
  }

  #evaluateWindow(averageFps: number): void {
    if (averageFps < LOW_FPS_THRESHOLD) {
      this.#consecutiveSlowWindows += 1;
      this.#consecutiveFastWindows = 0;
    } else if (averageFps > HIGH_FPS_THRESHOLD) {
      this.#consecutiveFastWindows += 1;
      this.#consecutiveSlowWindows = 0;
    } else {
      // Healthy middle band: evidence for both directions expires.
      this.#consecutiveSlowWindows = 0;
      this.#consecutiveFastWindows = 0;
    }

    const index = LEVEL_INDEX[this.#level];

    if (
      this.#consecutiveSlowWindows >= CONSECUTIVE_WINDOWS_REQUIRED &&
      index < QUALITY_LEVELS.length - 1
    ) {
      this.#resetWindowBookkeeping();
      this.#applyLevel(QUALITY_LEVELS[index + 1]);
      return;
    }
    if (
      this.#consecutiveFastWindows >= CONSECUTIVE_WINDOWS_REQUIRED &&
      index > 0
    ) {
      this.#resetWindowBookkeeping();
      this.#applyLevel(QUALITY_LEVELS[index - 1]);
      return;
    }
    if (
      this.#consecutiveSlowWindows >= CONSECUTIVE_WINDOWS_REQUIRED ||
      this.#consecutiveFastWindows >= CONSECUTIVE_WINDOWS_REQUIRED
    ) {
      // Already pinned at the extreme in this direction; start counting afresh.
      this.#resetWindowBookkeeping();
    }
  }

  #applyLevel(level: QualityLevel): void {
    if (level === this.#level) return;
    this.#level = level;
    this.#onChange?.(level);
  }
}
