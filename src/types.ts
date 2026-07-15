import type * as THREE from "three";

/** The six selectable years, in chronological order. */
export const ERA_YEARS = [1945, 1965, 1985, 2005, 2025, 2055] as const;
export type EraYear = (typeof ERA_YEARS)[number];
export const ERA_COUNT = ERA_YEARS.length;
/** A 0-based index into the era list. */
export type EraIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface Vec3Config {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * All tunable visual parameters for a single era. Colors are sRGB hex numbers
 * (as written in code); they are converted to THREE.Color and interpreted as
 * sRGB before interpolation in linear working space.
 */
export interface EraVisualConfig {
  readonly year: EraYear;
  readonly name: string;
  readonly tagline: string;
  /** Scene background color. */
  readonly sky: number;
  readonly fog: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly sunColor: number;
  readonly sunIntensity: number;
  readonly sunPos: Vec3Config;
  readonly sunShadowFar: number;
  readonly ambientColor: number;
  readonly ambientIntensity: number;
  readonly hemiSky: number;
  readonly hemiGround: number;
  readonly hemiIntensity: number;
  readonly groundColor: number;
  readonly roadColor: number;
  readonly sidewalkColor: number;
  /** Base colors used to tint facade textures. */
  readonly buildingColors: readonly number[];
  /** Emissive accent used on signage / futuristic glow. */
  readonly accent: number;
  readonly vehicleColors: readonly number[];
  readonly pedestrianColors: readonly number[];
  /** Pedestrian count multiplier relative to a nominal block. */
  readonly density: number;
  readonly buildingFloorsMin: number;
  readonly buildingFloorsMax: number;
  readonly mood: string;
  /** Short contextual facts surfaced via hover. */
  readonly facts: {
    readonly buildings: string;
    readonly vehicles: string;
    readonly pedestrians: string;
    readonly props: string;
    readonly signage: string;
  };
}

/** An object that can be inspected via the hover raycaster. */
export interface Interactable {
  readonly object: THREE.Object3D;
  readonly title: string;
  readonly body: string;
}

/** Reusable scratch color used by hot-path lerp helpers. */
export type ScratchColor = THREE.Color;
