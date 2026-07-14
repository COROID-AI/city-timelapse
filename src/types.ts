import type * as THREE from 'three';

export type EraId = '1945' | '1965' | '1985' | '2005' | '2025' | '2055';

export interface RGBHex {
  /** CSS hex string, e.g. "#aabbcc" */
  hex: string;
}

/** Per-era visual configuration — the single source of truth for the scene. */
export interface EraConfig {
  id: EraId;
  year: number;
  name: string;       // short label, e.g. "Postwar"
  tagline: string;    // longer descriptor shown in the timeline
  /** Sky + lighting */
  skyTop: string;
  skyBottom: string;
  sunColor: string;
  sunIntensity: number;
  sunAzimuth: number; // radians
  sunElevation: number; // radians above horizon
  ambientColor: string;
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  fogDensity: number; // 0 disables exponential-ish blend toward fogFar
  /** Ground */
  groundColor: string;
  roadColor: string;
  sidewalkColor: string;
  /** Buildings */
  facadeColors: string[];
  roofColor: string;
  windowEmissive: string;
  windowLitRatio: number;   // 0..1 fraction of windows lit at night-ish
  buildingMinHeight: number;
  buildingMaxHeight: number;
  glassness: number;        // 0..1 reflectivity of facades
  /** Vehicles */
  vehicleColors: string[];
  vehicleType: 'classic' | 'sedan' | 'modern' | 'future';
  vehicleCount: number;
  /** Pedestrians */
  pedColors: string[];
  pedHairColors: string[];
  pedCount: number;
  /** Street props */
  lampColor: string;
  lampStyle: 'gas' | 'cobra' | 'led' | 'hologram';
  propDensity: number; // 0..1
  /** Billboard / ads */
  adPalette: string[];
  adStyle: 'paint' | 'neon' | 'led' | 'hologram';
  adPhrases: string[];
  /** Particles */
  particleColor: string;
  particleType: 'embers' | 'dust' | 'leaves' | 'smog' | 'drones' | 'nanites';
  particleCount: number;
  /** Mood / exposure */
  exposure: number;
  nightFactor: number; // 0 day .. 1 deep night, drives window glow
}

export interface SceneState {
  /** eased 0..1 across eras (continuous) */
  progress: number;
  /** index into ERA_IDS of the era we are leaving */
  fromIndex: number;
  /** index into ERA_IDS of the era we are heading to */
  toIndex: number;
  /** current target era id */
  current: EraId;
  /** elapsed seconds for ambient motion */
  time: number;
}

/** Contract every scene module implements. */
export interface SceneModule {
  readonly group: THREE.Group;
  /** Per-frame update driven by eased state. */
  update(dt: number, state: SceneState): void;
  /** Snap directly to an era endpoint (no animation). */
  setEra(config: EraConfig): void;
  /** Release all GPU/CPU resources. */
  dispose(): void;
}

export interface QualitySettings {
  particles: boolean;
  shadows: boolean;
  particleScale: number;
}
