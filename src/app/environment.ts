// ─── Environment Manager — Era-Aware Atmosphere & Lighting ──────────────
// Provides era-tinted sky colors, fog density, sun angle/intensity/color,
// day/night cycle with era-aware defaults, and night emissive lighting.
// Blends smoothly during era transitions — no visual pops.

import * as THREE from 'three';
import type { EraId } from '../eras.js';

const EASE_OUT = (t: number) => 1 - Math.pow(1 - t, 3); // ease-out cubic

// ── Era atmospheric config ──────────────────────────────────────────────

interface EraAtmosphere {
  /** Sky background color */
  skyColor: THREE.Color;
  /** Fog color */
  fogColor: THREE.Color;
  /** Fog density (0 = none, higher = denser) */
  fogDensity: number;
  /** Sun direction (normalized vector) */
  sunDirection: THREE.Vector3;
  /** Sun light color */
  sunColor: THREE.Color;
  /** Sun light intensity multiplier */
  sunIntensity: number;
  /** Hemisphere sky color */
  hemiSkyColor: THREE.Color;
  /** Hemisphere ground color */
  hemiGroundColor: THREE.Color;
  /** Hemisphere intensity */
  hemiIntensity: number;
  /** Ambient light color */
  ambientColor: THREE.Color;
  /** Ambient intensity */
  ambientIntensity: number;
}

interface EraNightConfig {
  /** Default hour (0–24) for this era */
  defaultHour: number;
  /** Night sky tint when sun is below horizon */
  nightSkyTint: THREE.Color;
  /** Night fog tint */
  nightFogTint: THREE.Color;
  /** Night ambient color */
  nightAmbientColor: THREE.Color;
  /** Night ambient intensity boost */
  nightAmbientIntensity: number;
  /** Emissive sign/lamp color that dominates at night */
  nightEmissiveColor: THREE.Color;
  /** Emissive intensity multiplier at night */
  nightEmissiveIntensity: number;
}

const ATMOSPHERE: Record<EraId, EraAtmosphere> = {
  '1945': {
    // Sepia / warm haze
    skyColor: new THREE.Color(0xc4a86e),
    fogColor: new THREE.Color(0xb8a060),
    fogDensity: 0.012,
    sunDirection: new THREE.Vector3(0.6, 0.7, 0.4).normalize(),
    sunColor: new THREE.Color(0xffd49a),
    sunIntensity: 1.1,
    hemiSkyColor: new THREE.Color(0xd4b878),
    hemiGroundColor: new THREE.Color(0x3a3520),
    hemiIntensity: 0.5,
    ambientColor: new THREE.Color(0xfff0d0),
    ambientIntensity: 0.12,
  },
  '1965': {
    // Sunny pastel blue
    skyColor: new THREE.Color(0x87c4e8),
    fogColor: new THREE.Color(0x9ad4f0),
    fogDensity: 0.006,
    sunDirection: new THREE.Vector3(0.5, 0.85, 0.3).normalize(),
    sunColor: new THREE.Color(0xfff8e8),
    sunIntensity: 1.5,
    hemiSkyColor: new THREE.Color(0xa8d8f8),
    hemiGroundColor: new THREE.Color(0x4a7a3a),
    hemiIntensity: 0.65,
    ambientColor: new THREE.Color(0xffffff),
    ambientIntensity: 0.18,
  },
  '1985': {
    // Smoggy amber-gray
    skyColor: new THREE.Color(0x9a9080),
    fogColor: new THREE.Color(0x8a8070),
    fogDensity: 0.018,
    sunDirection: new THREE.Vector3(0.4, 0.5, 0.6).normalize(),
    sunColor: new THREE.Color(0xffcc70),
    sunIntensity: 0.85,
    hemiSkyColor: new THREE.Color(0xaa9a80),
    hemiGroundColor: new THREE.Color(0x3a3a30),
    hemiIntensity: 0.4,
    ambientColor: new THREE.Color(0xe8dcc0),
    ambientIntensity: 0.1,
  },
  '2005': {
    // Bright hazy white-blue
    skyColor: new THREE.Color(0xc0d4e8),
    fogColor: new THREE.Color(0xb8cce0),
    fogDensity: 0.010,
    sunDirection: new THREE.Vector3(0.55, 0.75, 0.3).normalize(),
    sunColor: new THREE.Color(0xfaf8f0),
    sunIntensity: 1.3,
    hemiSkyColor: new THREE.Color(0xd0e0f0),
    hemiGroundColor: new THREE.Color(0x5a6a50),
    hemiIntensity: 0.55,
    ambientColor: new THREE.Color(0xfff8f0),
    ambientIntensity: 0.16,
  },
  '2025': {
    // Clear blue with slight cool cast
    skyColor: new THREE.Color(0x6aafe0),
    fogColor: new THREE.Color(0x8ac0e8),
    fogDensity: 0.003,
    sunDirection: new THREE.Vector3(0.45, 0.9, 0.2).normalize(),
    sunColor: new THREE.Color(0xfafaff),
    sunIntensity: 1.6,
    hemiSkyColor: new THREE.Color(0x80c0f0),
    hemiGroundColor: new THREE.Color(0x4a6a40),
    hemiIntensity: 0.7,
    ambientColor: new THREE.Color(0xf0f4ff),
    ambientIntensity: 0.2,
  },
};

const NIGHT_CONFIG: Record<EraId, EraNightConfig> = {
  '1945': {
    defaultHour: 18.5, // early sunset due to blackout atmosphere
    nightSkyTint: new THREE.Color(0x2a2010),
    nightFogTint: new THREE.Color(0x1a1508),
    nightAmbientColor: new THREE.Color(0xffd080),
    nightAmbientIntensity: 0.25,
    nightEmissiveColor: new THREE.Color(0xffc040), // warm gas-look glow
    nightEmissiveIntensity: 2.5,
  },
  '1965': {
    defaultHour: 19.0,
    nightSkyTint: new THREE.Color(0x101830),
    nightFogTint: new THREE.Color(0x0a1020),
    nightAmbientColor: new THREE.Color(0xa0b0e0),
    nightAmbientIntensity: 0.2,
    nightEmissiveColor: new THREE.Color(0xc0d8ff), // mercury blue-white
    nightEmissiveIntensity: 2.0,
  },
  '1985': {
    defaultHour: 19.5,
    nightSkyTint: new THREE.Color(0x1a1410),
    nightFogTint: new THREE.Color(0x100a08),
    nightAmbientColor: new THREE.Color(0xffc060),
    nightAmbientIntensity: 0.3,
    nightEmissiveColor: new THREE.Color(0xffa020), // sodium orange wash
    nightEmissiveIntensity: 3.0,
  },
  '2005': {
    defaultHour: 19.0,
    nightSkyTint: new THREE.Color(0x141828),
    nightFogTint: new THREE.Color(0x0e1220),
    nightAmbientColor: new THREE.Color(0xd0d8f0),
    nightAmbientIntensity: 0.22,
    nightEmissiveColor: new THREE.Color(0xd0e0ff), // mixed warm/cool
    nightEmissiveIntensity: 2.2,
  },
  '2025': {
    defaultHour: 18.5,
    nightSkyTint: new THREE.Color(0x0c1428),
    nightFogTint: new THREE.Color(0x081020),
    nightAmbientColor: new THREE.Color(0xc8d8f0),
    nightAmbientIntensity: 0.18,
    nightEmissiveColor: new THREE.Color(0xe8f0ff), // LED neutral
    nightEmissiveIntensity: 2.8,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color().lerpColors(a, b, t);
}

function lerpVec3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3().lerpVectors(a, b, t);
}

/** Determine if it's "night" for a given hour (sun below horizon threshold) */
function isNight(hour: number): boolean {
  return hour < 6 || hour >= 19;
}

/** Sun elevation factor: 1 at noon, 0 at sunrise/sunset, negative at night */
function sunElevationFactor(hour: number): number {
  // Simple model: sun rises at 6, peaks at 13, sets at 19
  if (hour < 6 || hour > 19) return 0;
  const range = 13; // 6 to 19 hours total daylight
  const t = (hour - 6) / range;
  // Parabolic curve peaking at 1
  return Math.sin(t * Math.PI);
}

// ── Interpolated state for blending ──────────────────────────────────────

interface BlendState {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
}

// ── Public API ───────────────────────────────────────────────────────────

export interface EnvironmentOptions {
  /** Scene to modify */
  scene: THREE.Scene;
  /** Sun directional light */
  sunLight: THREE.DirectionalLight;
  /** Hemisphere light */
  hemiLight: THREE.HemisphereLight;
  /** Ambient light */
  ambientLight: THREE.AmbientLight;
  /** Night emissive point lights container (group or array) */
  emissiveLights?: THREE.Light[];
}

/** State object updated each frame by animate() */
export interface EnvironmentState {
  currentEra: EraId;
  targetEra: EraId;
  blendProgress: number; // 0 = fully old era, 1 = fully new era
  hour: number; // 0–24
  isNight: boolean;
  sunElevation: number;
}

export class EnvironmentManager {
  private readonly _scene: THREE.Scene;
  private readonly _sunLight: THREE.DirectionalLight;
  private readonly _hemiLight: THREE.HemisphereLight;
  private readonly _ambientLight: THREE.AmbientLight;
  private readonly _emissiveLights: THREE.Light[];

  private _currentEra: EraId = '1945';
  private _targetEra: EraId | null = null;
  private _blendProgress = 1; // 1 = fully blended to current

  /** Current time-of-day hour (0–24). Controlled via setTimeOfDay() */
  private _hour: number;

  /** Whether the day/night cycle is auto-advancing */
  private _autoCycle = false;
  private _cycleSpeed = 0.5; // hours per second

  // Interpolated state for smooth blending
  private _blendState: BlendState | null = null;
  private _targetBlendState: BlendState | null = null;

  constructor(options: EnvironmentOptions) {
    this._scene = options.scene;
    this._sunLight = options.sunLight;
    this._hemiLight = options.hemiLight;
    this._ambientLight = options.ambientLight;
    this._emissiveLights = options.emissiveLights ?? [];

    // Initialize to first era defaults
    this._currentEra = '1945';
    const nightCfg = NIGHT_CONFIG['1945'];
    this._hour = nightCfg.defaultHour;

    // Apply initial state immediately
    this._applyToScene(this._currentEra, this._hour, 1);

    // Subscribe to era changes
    document.addEventListener('erachange', this._onEraChange.bind(this));
  }

  // ── Era change subscription ──────────────────────────────────────────

  private _onEraChange = (e: Event): void => {
    const detail = (e as CustomEvent).detail;
    if (!detail || !detail.eraId) return;

    const newEra = detail.eraId as EraId;
    if (newEra === this._currentEra) return;

    // Start blending to new era
    this._startTransition(newEra);
  };

  /**
   * Called by the host app to set the current era directly
   * (alternative to listening for events).
   */
  setEra(eraId: EraId): void {
    if (eraId === this._currentEra && this._blendProgress >= 1) return;

    if (this._blendProgress >= 1) {
      // Fresh transition from fully-blended state
      this._startTransition(eraId);
    } else {
      // Mid-transition: jump target to new era
      this._targetEra = eraId;
      const cfg = ATMOSPHERE[eraId];
      this._blendState = {
        skyColor: cfg.skyColor.clone(),
        fogColor: cfg.fogColor.clone(),
        fogDensity: cfg.fogDensity,
        sunDir: cfg.sunDirection.clone(),
        sunColor: cfg.sunColor.clone(),
        sunIntensity: cfg.sunIntensity,
        hemiSky: cfg.hemiSkyColor.clone(),
        hemiGround: cfg.hemiGroundColor.clone(),
        hemiIntensity: cfg.hemiIntensity,
        ambientColor: cfg.ambientColor.clone(),
        ambientIntensity: cfg.ambientIntensity,
      };
    }
  }

  private _startTransition(newEra: EraId): void {
    const oldEra = this._currentEra;
    this._targetEra = newEra;
    this._blendProgress = 0;

    // Capture old era values as starting point
    const oldCfg = ATMOSPHERE[oldEra];
    const newCfg = ATMOSPHERE[newEra];

    this._blendState = {
      skyColor: oldCfg.skyColor.clone(),
      fogColor: oldCfg.fogColor.clone(),
      fogDensity: oldCfg.fogDensity,
      sunDir: oldCfg.sunDirection.clone(),
      sunColor: oldCfg.sunColor.clone(),
      sunIntensity: oldCfg.sunIntensity,
      hemiSky: oldCfg.hemiSkyColor.clone(),
      hemiGround: oldCfg.hemiGroundColor.clone(),
      hemiIntensity: oldCfg.hemiIntensity,
      ambientColor: oldCfg.ambientColor.clone(),
      ambientIntensity: oldCfg.ambientIntensity,
    };

    // Also store target values for interpolation
    this._targetBlendState = {
      skyColor: newCfg.skyColor.clone(),
      fogColor: newCfg.fogColor.clone(),
      fogDensity: newCfg.fogDensity,
      sunDir: newCfg.sunDirection.clone(),
      sunColor: newCfg.sunColor.clone(),
      sunIntensity: newCfg.sunIntensity,
      hemiSky: newCfg.hemiSkyColor.clone(),
      hemiGround: newCfg.hemiGroundColor.clone(),
      hemiIntensity: newCfg.hemiIntensity,
      ambientColor: newCfg.ambientColor.clone(),
      ambientIntensity: newCfg.ambientIntensity,
    };
  }

  // ── Time-of-day control ──────────────────────────────────────────────

  /** Set the current time-of-day hour (0–24) */
  setTimeOfDay(hour: number): void {
    this._hour = Math.max(0, Math.min(24, hour));
  }

  /** Get the current time-of-day hour */
  getTimeOfDay(): number {
    return this._hour;
  }

  /** Toggle automatic day/night cycling */
  toggleAutoCycle(enabled?: boolean): void {
    this._autoCycle = enabled ?? !this._autoCycle;
  }

  /** Check if auto-cycle is active */
  isAutoCycling(): boolean {
    return this._autoCycle;
  }

  /** Advance the clock by delta seconds at the configured speed */
  advanceClock(delta: number): void {
    if (!this._autoCycle) return;
    this._hour += this._cycleSpeed * delta;
    if (this._hour >= 24) this._hour -= 24;
    if (this._hour < 0) this._hour += 24;
  }

  // ── Frame update (called from animate loop) ─────────────────────────

  /**
   * Update the environment for the current frame.
   * Call this every frame from the animation loop.
   */
  updateFrame(delta: number): void {
    // Advance clock if auto-cycling
    this.advanceClock(delta);

    // Blend progress for era transitions
    if (this._targetEra !== null && this._blendProgress < 1) {
      // Use same easing as transitions (ease-out cubic)
      this._blendProgress = Math.min(1, this._blendProgress + delta * (1000 / 2400));
      const eased = EASE_OUT(this._blendProgress);

      this._applyToScene(this._targetEra, this._hour, eased);

      if (this._blendProgress >= 1) {
        this._currentEra = this._targetEra!;
        this._targetEra = null;
        this._blendState = null;
        this._targetBlendState = null;
      }
    } else if (this._blendProgress >= 1) {
      // Fully blended — just apply current era + time
      this._applyToScene(this._currentEra, this._hour, 1);
    }
  }

  /**
   * Apply atmosphere/lighting to the scene for a given era and time.
   * @param eraId - Target era
   * @param hour - Time of day (0–24)
   * @param blend - Blend factor (0 = old era, 1 = new era)
   */
  private _applyToScene(eraId: EraId, hour: number, blend: number): void {
    const cfg = ATMOSPHERE[eraId];
    const nightCfg = NIGHT_CONFIG[eraId];
    const night = isNight(hour);
    const elev = sunElevationFactor(hour);

    // If blending, interpolate between old and new era values
    let skyColor: THREE.Color;
    let fogColor: THREE.Color;
    let fogDensity: number;
    let sunDir: THREE.Vector3;
    let sunColor: THREE.Color;
    let sunIntensity: number;
    let hemiSky: THREE.Color;
    let hemiGround: THREE.Color;
    let hemiIntensity: number;
    let ambientColor: THREE.Color;
    let ambientIntensity: number;

    const newBlend = this._targetBlendState;

    if (blend > 0 && blend < 1 && this._blendState && newBlend) {
      // Interpolating between eras using blendState (old) → newBlend (new)
      const t = blend;
      skyColor = lerpColor(this._blendState.skyColor, newBlend.skyColor, t);
      fogColor = lerpColor(this._blendState.fogColor, newBlend.fogColor, t);
      fogDensity = this._blendState.fogDensity + (newBlend.fogDensity - this._blendState.fogDensity) * t;
      sunDir = lerpVec3(this._blendState.sunDir, newBlend.sunDir, t);
      sunColor = lerpColor(this._blendState.sunColor, newBlend.sunColor, t);
      sunIntensity = this._blendState.sunIntensity + (newBlend.sunIntensity - this._blendState.sunIntensity) * t;
      hemiSky = lerpColor(this._blendState.hemiSky, newBlend.hemiSky, t);
      hemiGround = lerpColor(this._blendState.hemiGround, newBlend.hemiGround, t);
      hemiIntensity = this._blendState.hemiIntensity + (newBlend.hemiIntensity - this._blendState.hemiIntensity) * t;
      ambientColor = lerpColor(this._blendState.ambientColor, newBlend.ambientColor, t);
      ambientIntensity = this._blendState.ambientIntensity + (newBlend.ambientIntensity - this._blendState.ambientIntensity) * t;
    } else {
      skyColor = cfg.skyColor;
      fogColor = cfg.fogColor;
      fogDensity = cfg.fogDensity;
      sunDir = cfg.sunDirection;
      sunColor = cfg.sunColor;
      sunIntensity = cfg.sunIntensity;
      hemiSky = cfg.hemiSkyColor;
      hemiGround = cfg.hemiGroundColor;
      hemiIntensity = cfg.hemiIntensity;
      ambientColor = cfg.ambientColor;
      ambientIntensity = cfg.ambientIntensity;
    }

    // ── Day/night modifications ──────────────────────────────────────

    // Night sky tint blend
    const nightBlend = night ? 1 : Math.max(0, elev * 2); // ramp up near dawn/dusk
    const effectiveSky = nightBlend > 0
      ? lerpColor(skyColor, nightCfg.nightSkyTint, nightBlend * 0.7)
      : skyColor;
    const effectiveFog = nightBlend > 0
      ? lerpColor(fogColor, nightCfg.nightFogTint, nightBlend * 0.6)
      : fogColor;

    // Night ambient boost
    const effectiveAmbientColor = night
      ? lerpColor(ambientColor, nightCfg.nightAmbientColor, 0.6)
      : ambientColor;
    const effectiveAmbientIntensity = night
      ? nightCfg.nightAmbientIntensity
      : ambientIntensity;

    // Sun adjustments for time of day
    const effectiveSunIntensity = sunIntensity * Math.max(0, elev);
    const effectiveSunColor = night
      ? nightCfg.nightEmissiveColor.clone().multiplyScalar(0.15)
      : sunColor;

    // Apply to scene
    this._scene.background = effectiveSky;
    this._scene.fog = this._scene.fog || new THREE.FogExp2(effectiveFog.getHex(), fogDensity);
    if (this._scene.fog instanceof THREE.FogExp2) {
      this._scene.fog.color.copy(effectiveFog);
      this._scene.fog.density = fogDensity;
    }

    // Sun light
    this._sunLight.position.copy(sunDir.clone().multiplyScalar(80));
    this._sunLight.color.copy(effectiveSunColor);
    this._sunLight.intensity = effectiveSunIntensity;

    // Hemisphere light
    this._hemiLight.color.copy(nightBlend > 0
      ? lerpColor(hemiSky, nightCfg.nightSkyTint, nightBlend * 0.5)
      : hemiSky);
    this._hemiLight.groundColor.copy(hemiGround);
    this._hemiLight.intensity = nightBlend > 0
      ? hemiIntensity * (1 - nightBlend * 0.5)
      : hemiIntensity;

    // Ambient light
    this._ambientLight.color.copy(effectiveAmbientColor);
    this._ambientLight.intensity = effectiveAmbientIntensity;

    // Emissive lights at night
    const emissiveOn = night && this._emissiveLights.length > 0;
    for (const light of this._emissiveLights) {
      if (light instanceof THREE.PointLight || light instanceof THREE.SpotLight) {
        light.color.copy(nightCfg.nightEmissiveColor);
        light.intensity = emissiveOn ? nightCfg.nightEmissiveIntensity : 0;
        light.visible = emissiveOn;
      } else if (light.isLight) {
        (light as THREE.Light).visible = emissiveOn;
      }
    }

    // Tone mapping exposure adjustment for night
    this._scene.userData.__envNightBlend = nightBlend;
  }

  // ── Query helpers ────────────────────────────────────────────────────

  getCurrentEra(): EraId {
    return this._currentEra;
  }

  getTargetEra(): EraId | null {
    return this._targetEra;
  }

  getBlendProgress(): number {
    return this._blendProgress;
  }

  getEnvironmentState(): EnvironmentState {
    return {
      currentEra: this._currentEra,
      targetEra: this._targetEra ?? this._currentEra,
      blendProgress: this._blendProgress,
      hour: this._hour,
      isNight: isNight(this._hour),
      sunElevation: sunElevationFactor(this._hour),
    };
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  dispose(): void {
    document.removeEventListener('erachange', this._onEraChange as EventListener);
  }
}
