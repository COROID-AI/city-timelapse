/**
 * performanceMonitor.ts
 *
 * Continuous performance safeguard for the render loop.
 *
 * Responsibilities:
 *  - Sample frame times each render frame and maintain a smoothed FPS value.
 *  - Walk the adaptive quality ladder (high / medium / low) using hysteresis
 *    thresholds so quality steps down under sustained low FPS and back up when
 *    headroom returns, without oscillating on borderline frame rates.
 *  - Push the current quality profile (pixel ratio, shadow-map resolution,
 *    draw distance) into the renderer through a small adapter.
 *  - Render a compact on-screen HUD readout (FPS + current quality tier) with
 *    inline styles, so it needs no external stylesheet.
 *
 * The module is intentionally dependency-free (no Three.js, no DOM module
 * imports) so the FPS sampler, hysteresis and profile transitions are directly
 * unit-testable. DOM usage is confined to the HUD helper.
 */
import {
  DEFAULT_HYSTERESIS,
  HysteresisThresholds,
  QUALITY_LADDER,
  QualityLadder,
  QualityProfile,
  QualityTier,
  nextTier,
  profileForTier,
} from './qualityProfile';

/** Smoothing factor for the exponential moving-average FPS. */
const FPS_ALPHA = 0.2;

/**
 * Adapter the monitor uses to push a quality profile into a renderer.
 * The integration owner wires this to the real WebGL renderer (pixel ratio,
 * shadow map, draw distance) without this module touching Three.js types.
 */
export interface QualityAdapter {
  /** Apply a quality profile to the renderer. */
  apply(profile: QualityProfile): void;
}

/** Renderer hooks that the safeguard drives. */
export interface RendererQualityHooks {
  /** Set the rendering pixel ratio (fraction of native resolution). */
  setPixelRatio(ratio: number): void;
  /** Set the shadow-map resolution in pixels. */
  setShadowMapResolution(resolution: number): void;
  /** Set the maximum draw distance in world units. */
  setDrawDistance(distance: number): void;
}

/** Public API of the performance monitor. */
export interface PerformanceMonitor {
  /**
   * Feed one frame's delta time (seconds). Call every render frame.
   * Returns the current quality tier for convenience.
   */
  update(dt: number): QualityTier;
  /** Current smoothed frames per second. */
  readonly fps: number;
  /** Current quality tier. */
  readonly tier: QualityTier;
  /** Current quality profile. */
  readonly profile: QualityProfile;
  /** The HUD readout element, or null when no DOM is available (tests). */
  readonly hud: HTMLElement | null;
  /** Dispose: remove the HUD element and stop future HUD updates. */
  dispose(): void;
}

export interface PerformanceMonitorOptions {
  /** Initial quality tier. Defaults to 'high'. */
  initialTier?: QualityTier;
  /** Hysteresis thresholds. Defaults to the standard band. */
  hysteresis?: HysteresisThresholds;
  /** Quality ladder. Defaults to the built-in ladder. */
  ladder?: QualityLadder;
  /** Renderer hooks to push quality into. Optional in tests. */
  hooks?: RendererQualityHooks;
  /** Apply the initial profile immediately on construction. */
  applyOnInit?: boolean;
}

/**
 * Create the performance monitor. On construction the initial quality profile
 * is applied to the renderer hooks (when provided) and the HUD is created.
 */
export function createPerformanceMonitor(
  options: PerformanceMonitorOptions = {},
): PerformanceMonitor {
  const {
    initialTier = 'high',
    hysteresis = DEFAULT_HYSTERESIS,
    ladder = QUALITY_LADDER,
    hooks,
    applyOnInit = true,
  } = options;

  let tier: QualityTier = initialTier;
  let profile: QualityProfile = profileForTier(tier, ladder);
  let fps = 0;
  let sampled = 0;

  /** Push a profile into the renderer hooks (when provided). */
  function applyProfile(p: QualityProfile): void {
    if (!hooks) return;
    hooks.setPixelRatio(p.pixelRatio);
    hooks.setShadowMapResolution(p.shadowMapResolution);
    hooks.setDrawDistance(p.drawDistance);
  }

  function setTier(next: QualityTier): void {
    if (next === tier) return;
    tier = next;
    profile = profileForTier(tier, ladder);
    applyProfile(profile);
  }

  function update(dt: number): QualityTier {
    if (dt > 0) {
      const instant = 1 / dt;
      // First sample seeds the average; afterwards use an EMA.
      sampled += 1;
      fps = sampled === 1 ? instant : fps + FPS_ALPHA * (instant - fps);
    }
    const next = nextTier(tier, fps, hysteresis);
    if (next !== tier) setTier(next);
    renderHud();
    return tier;
  }

  // --- HUD readout (inline-styled, no external stylesheet) ---
  // DOM is optional so the monitor stays unit-testable in a node environment.
  let hud: HTMLElement | null = null;
  if (typeof document !== 'undefined' && document.body) {
    hud = document.createElement('div');
    hud.className = 'perf-hud';
    hud.style.position = 'fixed';
    hud.style.bottom = '12px';
    hud.style.left = '12px';
    hud.style.zIndex = '1000';
    hud.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    hud.style.fontSize = '12px';
    hud.style.fontWeight = '600';
    hud.style.color = '#e6e6e6';
    hud.style.background = 'rgba(10, 12, 18, 0.6)';
    hud.style.padding = '4px 10px';
    hud.style.borderRadius = '8px';
    hud.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    hud.style.pointerEvents = 'none';
    hud.style.userSelect = 'none';
    hud.style.backdropFilter = 'blur(2px)';
    hud.textContent = 'FPS -- · quality --';
    document.body.appendChild(hud);
  }

  function renderHud(): void {
    if (hud) hud.textContent = `FPS ${fps.toFixed(0)} · quality ${tier}`;
  }

  if (applyOnInit && hooks) applyProfile(profile);
  renderHud();

  return {
    update,
    get fps() {
      return fps;
    },
    get tier() {
      return tier;
    },
    get profile() {
      return profile;
    },
    hud,
    dispose() {
      if (hud) hud.remove();
    },
  };
}

/**
 * Convenience adapter that maps a QualityProfile onto the renderer quality
 * hooks. Shared by the app assembler and composition tests.
 */
export function createQualityAdapter(
  hooks: RendererQualityHooks,
): QualityAdapter {
  return {
    apply(profile: QualityProfile) {
      hooks.setPixelRatio(profile.pixelRatio);
      hooks.setShadowMapResolution(profile.shadowMapResolution);
      hooks.setDrawDistance(profile.drawDistance);
    },
  };
}