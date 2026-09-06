/**
 * Shared audio timing/level constants.
 *
 * These constants are the single source of truth for the audio engine's
 * crossfade behaviour and bus levels. Crossfade timing is intentionally
 * configurable here so the main-integration can tune the transition feel
 * without touching the synthesis code.
 */

/** Duration (seconds) of the era ambience crossfade. Must stay within 2–4s. */
export const CROSSFADE_SECONDS = 3;

/** Default master output volume (0..1). */
export const DEFAULT_VOLUME = 0.8;

/** Master gain for the ambience bus (era beds). */
export const AMBIENCE_BUS_GAIN = 0.8;

/** Master gain for the SFX bus (one-shots and loops). */
export const SFX_BUS_GAIN = 0.9;