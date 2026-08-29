/**
 * UI module.
 *
 * Owns the timeline slider, era labels, and HUD overlays. The timeline is the
 * primary interaction surface: every era change flows through the shared
 * EraStateStore so the scene, camera, audio, and UI all react consistently.
 */
export { TimelineSlider, ERA_ACCENTS } from './TimelineSlider';
export type { TimelineSliderOptions } from './TimelineSlider';