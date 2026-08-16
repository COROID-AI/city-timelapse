// ─── UI Module Barrel Export ────────────────────────────────────────
// All DOM-over-canvas UI components for the City Era Timelapse.

export {
  mountTimeline,
  unmountTimeline,
  getCurrentEraIndex,
  setEraByIndex,
  setEraById,
  EraChangeEvent,
  type EraChangeDetail,
} from './timeline.js';

export {
  mountControls,
  unmountControls,
  injectSfxMixer,
  CameraResetEvent,
  type SfxMixerLike,
} from './controls-overlay.js';

export {
  mountHud,
  unmountHud,
} from './hud.js';
