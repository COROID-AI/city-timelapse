/**
 * Public surface of the overlay UI.
 *
 * `scene-integration` mounts exactly one component — {@link Overlay} — and gets
 * the top-pinned timeline, the era HUD, the audio/quality/motion controls, the
 * help legend and the loading/error/first-use states. Components accept the era
 * store, the era registry and the ui-controls store as optional props so tests
 * and embedded sandboxes can inject their own instances; omitting them uses the
 * application-wide stores.
 *
 * The same barrel exposes the ui-controls store contract
 * ({@link useUIControlsStore}, its selectors and its intent types) that the
 * audio engine, the render pipeline and the adaptive-quality controller consume.
 *
 * The module graph under `src/ui` deliberately imports neither `src/audio` nor
 * `src/scene`: the overlay records intent, the integrator reacts to it.
 *
 * ```tsx
 * import { Overlay } from './ui'
 *
 * <Overlay status={sceneStatus} errorMessage={sceneError} onRetry={reload} />
 * ```
 */

import './styles.css'

export { TimelineSlider, resolveStepTarget, stepForTimelineKey, stopIndexFromPointer, stopPosition } from './TimelineSlider'
export type { TimelineSliderProps, TimelineStep } from './TimelineSlider'

export { EraStop } from './EraStop'
export type { EraStopProps } from './EraStop'

export { Hud } from './Hud'
export type { HudProps } from './Hud'

export {
  CONTROL_LEGEND,
  LEGEND_GROUP_LABELS,
  LEGEND_GROUP_ORDER,
  ControlsLegend,
  groupLegendEntries,
} from './ControlsLegend'
export type { ControlsLegendProps, LegendEntry, LegendGroup } from './ControlsLegend'

export { Overlay, OverlayControls, formatYearList } from './Overlay'
export type { OverlayProps, SceneStatus } from './Overlay'

export {
  MOTION_PREFERENCES,
  MOTION_PREFERENCE_LABELS,
  QUALITY_TIER_HINTS,
  QUALITY_TIER_LABELS,
  REDUCED_MOTION_QUERY,
  UI_CONTROLS_DEFAULTS,
  createUIControlsStore,
  isMotionPreference,
  requireMotionPreference,
  requireQualityTierName,
  resolveReducedMotion,
  selectAudioIntent,
  selectAudioMuted,
  selectAudioUnlocked,
  selectLegendVisible,
  selectMotionIntent,
  selectMotionManualOverride,
  selectMotionPreference,
  selectOverlayDismissed,
  selectOverlayIntent,
  selectOverlayVisible,
  selectQualityIntent,
  selectQualityManualOverride,
  selectRequestedQualityTier,
  subscribeToAudioIntent,
  subscribeToMotionIntent,
  subscribeToQualityIntent,
  subscribeToUIControls,
  systemPrefersReducedMotion,
  useResolvedReducedMotion,
  useSystemReducedMotion,
  useUIControls,
  useUIControlsStore,
} from './uiStore'
export type {
  AudioIntent,
  MotionIntent,
  MotionPreference,
  OverlayIntent,
  QualityIntent,
  UIControlsSeed,
  UIControlsState,
  UIControlsStore,
} from './uiStore'
