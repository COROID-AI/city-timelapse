// Per-era visual "mood": palettes, lighting and atmosphere parameters.
// Everything here is data — scene modules query moodAt() to interpolate
// continuous values between discrete eras during transitions.

import * as THREE from 'three';
import type { EraId } from './eras';
import { eraIndex } from './eras';

export interface VehicleStyle {
  color: string;
  accent: string;
  /** Relative width of body vs cabin (1 = classic sedan, wider = modern/SUV). */
  bodyWidth: number;
  /** Cabin height as a fraction of body height (lower = sleek, higher = boxy). */
  cabinHeight: number;
  /** 0..1 — how much the roof curves back (fastback/sedan profile). */
  roofSlope: number;
  /** Tail fin height for the classic "fins" era, in model units. */
  finHeight: number;
}

export interface BuildingStyle {
  facade: string;
  facadeAlt: string;
  trim: string;
  windowGlow: string;
  windowGlowIntensity: number;
  windowColor: string;
  roof: string;
  /** Multiplier for lit window grids (1 = standard, higher = brighter). */
  emissiveBoost: number;
  /** 0..1 — fraction of windows lit (office occupancy). */
  occupancy: number;
  maxHeight: number;
  minHeight: number;
}

export interface SkyMood {
  skyTop: string;
  skyHorizon: string;
  skyGround: string;
  sunColor: string;
  sunIntensity: number;
  fogColor: string;
  fogDensity: number;
  ambientColor: string;
  ambientIntensity: number;
  dirColor: string;
  dirIntensity: number;
  /** Sun height: low = dramatic dusk/night, high = bright day. */
  sunHeight: number;
  /** Amount of light-pollution glow washing over the street at night. */
  nightGlow: number;
  /** Extra sky tint when neon-heavy eras are active. */
  neonWash: number;
  /** Overall scene exposure bonus for dark eras. */
  exposure: number;
}

export interface ParticleMood {
  color: string;
  size: number;
  opacity: number;
  count: number;
  /** 0 = heavy slow (dust), 1 = light fast (neon flakes / pollen). */
  flutter: number;
}

export interface EraMood {
  id: EraId;
  sky: SkyMood;
  building: BuildingStyle;
  buildingAlt: BuildingStyle;
  vehicle: VehicleStyle;
  road: string;
  sidewalk: string;
  park: string;
  treeColor: string;
  particle: ParticleMood;
  /** Poster/ad copy palette for era billboards. */
  posterBg: string;
  posterFg: string;
  posterAccent: string;
  label: string;
}

// ---- Math helpers ----

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function lerpColor(out: THREE.Color, a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return out.lerpColors(a, b, t);
}

// ---- Per-era mood data ----

const MOOD_1945: EraMood = {
  id: '1945',
  sky: {
    skyTop: '#3b4a63',
    skyHorizon: '#97a3b8',
    skyGround: '#5d6673',
    sunColor: '#ffd9a0',
    sunIntensity: 1.15,
    fogColor: '#7c8899',
    fogDensity: 0.017,
    ambientColor: '#8f9bb0',
    ambientIntensity: 0.55,
    dirColor: '#ffd9a0',
    dirIntensity: 1.8,
    sunHeight: 0.32,
    nightGlow: 0.06,
    neonWash: 0,
    exposure: 1,
  },
  building: {
    facade: '#8d5a3b',
    facadeAlt: '#9a6a44',
    trim: '#6f442c',
    windowGlow: '#ffc36e',
    windowGlowIntensity: 2.6,
    windowColor: '#f7e2b0',
    roof: '#57402e',
    emissiveBoost: 0.9,
    occupancy: 0.45,
    maxHeight: 22,
    minHeight: 8,
  },
  buildingAlt: {
    facade: '#7c6a4f',
    facadeAlt: '#8b7a57',
    trim: '#5b5241',
    windowGlow: '#ffcf86',
    windowGlowIntensity: 2.2,
    windowColor: '#f3d9a0',
    roof: '#4c4233',
    emissiveBoost: 0.75,
    occupancy: 0.4,
    maxHeight: 18,
    minHeight: 7,
  },
  vehicle: {
    color: '#b03a2e',
    accent: '#d8c6a6',
    bodyWidth: 1.1,
    cabinHeight: 1.15,
    roofSlope: 0.45,
    finHeight: 0,
  },
  road: '#3a3330',
  sidewalk: '#8a857c',
  park: '#636b4a',
  treeColor: '#6c8a4f',
  particle: { color: '#d8b98a', size: 0.05, opacity: 0.3, count: 260, flutter: 0.22 },
  posterBg: '#b6482f',
  posterFg: '#f7e8c0',
  posterAccent: '#123c63',
  label: '1945',
};

const MOOD_1965: EraMood = {
  id: '1965',
  sky: {
    skyTop: '#4f6f9f',
    skyHorizon: '#c3d0e2',
    skyGround: '#76849a',
    sunColor: '#ffe2a8',
    sunIntensity: 1.3,
    fogColor: '#9fb0c4',
    fogDensity: 0.011,
    ambientColor: '#a9b7cc',
    ambientIntensity: 0.62,
    dirColor: '#ffe2a8',
    dirIntensity: 1.9,
    sunHeight: 0.42,
    nightGlow: 0.08,
    neonWash: 0.1,
    exposure: 1.02,
  },
  building: {
    facade: '#e8cdba',
    facadeAlt: '#f0d9c4',
    trim: '#c6a68a',
    windowGlow: '#ffd292',
    windowGlowIntensity: 3.0,
    windowColor: '#ffe2b0',
    roof: '#9b8070',
    emissiveBoost: 0.95,
    occupancy: 0.55,
    maxHeight: 34,
    minHeight: 10,
  },
  buildingAlt: {
    facade: '#a9c6c2',
    facadeAlt: '#bcd5d0',
    trim: '#8bb1ad',
    windowGlow: '#caeee0',
    windowGlowIntensity: 2.6,
    windowColor: '#e0f5ea',
    roof: '#7f9e99',
    emissiveBoost: 0.8,
    occupancy: 0.5,
    maxHeight: 40,
    minHeight: 11,
  },
  vehicle: {
    color: '#c23b4e',
    accent: '#eef1f5',
    bodyWidth: 1.05,
    cabinHeight: 1.0,
    roofSlope: 0.6,
    finHeight: 0.85,
  },
  road: '#3c3636',
  sidewalk: '#8f8a80',
  park: '#6f7f52',
  treeColor: '#7fa05c',
  particle: { color: '#fff0c8', size: 0.045, opacity: 0.28, count: 240, flutter: 0.32 },
  posterBg: '#e8654a',
  posterFg: '#fff6dc',
  posterAccent: '#2b6ca3',
  label: '1965',
};

const MOOD_1985: EraMood = {
  id: '1985',
  sky: {
    skyTop: '#31406e',
    skyHorizon: '#ff8b8b',
    skyGround: '#4c5a78',
    sunColor: '#ffd9a8',
    sunIntensity: 1.1,
    fogColor: '#a0566e',
    fogDensity: 0.014,
    ambientColor: '#6d7a9c',
    ambientIntensity: 0.5,
    dirColor: '#ffd9a8',
    dirIntensity: 1.5,
    sunHeight: 0.18,
    nightGlow: 0.35,
    neonWash: 0.28,
    exposure: 1.05,
  },
  building: {
    facade: '#8290a3',
    facadeAlt: '#93a0b2',
    trim: '#6c7788',
    windowGlow: '#ff5f8f',
    windowGlowIntensity: 3.6,
    windowColor: '#4a5c8c',
    roof: '#5f6a78',
    emissiveBoost: 1.4,
    occupancy: 0.7,
    maxHeight: 48,
    minHeight: 16,
  },
  buildingAlt: {
    facade: '#a08c9e',
    facadeAlt: '#b09bab',
    trim: '#84707f',
    windowGlow: '#4ff0ff',
    windowGlowIntensity: 3.4,
    windowColor: '#6a547a',
    roof: '#77637a',
    emissiveBoost: 1.3,
    occupancy: 0.65,
    maxHeight: 30,
    minHeight: 12,
  },
  vehicle: {
    color: '#d8d8e0',
    accent: '#8a8a94',
    bodyWidth: 1.2,
    cabinHeight: 1.3,
    roofSlope: 0.15,
    finHeight: 0,
  },
  road: '#2f2c31',
  sidewalk: '#7c7a80',
  park: '#5d6b4e',
  treeColor: '#5f8a54',
  particle: { color: '#ff5f8f', size: 0.05, opacity: 0.4, count: 320, flutter: 0.5 },
  posterBg: '#00b4d8',
  posterFg: '#ffffff',
  posterAccent: '#ff2d6f',
  label: '1985',
};

const MOOD_2005: EraMood = {
  id: '2005',
  sky: {
    skyTop: '#1f2d4d',
    skyHorizon: '#b43a3a',
    skyGround: '#3a4666',
    sunColor: '#ffd3a2',
    sunIntensity: 1.0,
    fogColor: '#5a3a4a',
    fogDensity: 0.012,
    ambientColor: '#54628c',
    ambientIntensity: 0.46,
    dirColor: '#ffd3a2',
    dirIntensity: 1.3,
    sunHeight: 0.22,
    nightGlow: 0.5,
    neonWash: 0.35,
    exposure: 1.08,
  },
  building: {
    facade: '#5c6e84',
    facadeAlt: '#6d7f94',
    trim: '#4a586b',
    windowGlow: '#8fd3ff',
    windowGlowIntensity: 3.0,
    windowColor: '#7faecc',
    roof: '#465162',
    emissiveBoost: 1.3,
    occupancy: 0.8,
    maxHeight: 56,
    minHeight: 20,
  },
  buildingAlt: {
    facade: '#8b6f7d',
    facadeAlt: '#9d7d8b',
    trim: '#755d68',
    windowGlow: '#a8e0ff',
    windowGlowIntensity: 2.8,
    windowColor: '#9a7a8c',
    roof: '#6b5560',
    emissiveBoost: 1.2,
    occupancy: 0.75,
    maxHeight: 44,
    minHeight: 16,
  },
  vehicle: {
    color: '#b9bec6',
    accent: '#6b7280',
    bodyWidth: 1.3,
    cabinHeight: 1.25,
    roofSlope: 0.2,
    finHeight: 0,
  },
  road: '#26262c',
  sidewalk: '#6f6f74',
  park: '#4f5d44',
  treeColor: '#4f874f',
  particle: { color: '#8fd3ff', size: 0.04, opacity: 0.24, count: 220, flutter: 0.72 },
  posterBg: '#111827',
  posterFg: '#f9fafb',
  posterAccent: '#3b82f6',
  label: '2005',
};

const MOOD_2025: EraMood = {
  id: '2025',
  sky: {
    skyTop: '#0d1530',
    skyHorizon: '#2a3d66',
    skyGround: '#17203f',
    sunColor: '#ffffff',
    sunIntensity: 1.25,
    fogColor: '#22335c',
    fogDensity: 0.008,
    ambientColor: '#3c4f86',
    ambientIntensity: 0.6,
    dirColor: '#d9e6ff',
    dirIntensity: 1.55,
    sunHeight: 0.3,
    nightGlow: 0.68,
    neonWash: 0.55,
    exposure: 1.1,
  },
  building: {
    facade: '#3b4a66',
    facadeAlt: '#4c5c7a',
    trim: '#2c384e',
    windowGlow: '#a6ecff',
    windowGlowIntensity: 3.8,
    windowColor: '#5aa8cc',
    roof: '#263349',
    emissiveBoost: 1.6,
    occupancy: 0.9,
    maxHeight: 64,
    minHeight: 22,
  },
  buildingAlt: {
    facade: '#4a3b56',
    facadeAlt: '#5c4a6d',
    trim: '#392d44',
    windowGlow: '#c0a6ff',
    windowGlowIntensity: 3.6,
    windowColor: '#b58ad4',
    roof: '#332943',
    emissiveBoost: 1.5,
    occupancy: 0.85,
    maxHeight: 52,
    minHeight: 18,
  },
  vehicle: {
    color: '#d6dde8',
    accent: '#7fd4c1',
    bodyWidth: 1.22,
    cabinHeight: 1.05,
    roofSlope: 0.3,
    finHeight: 0,
  },
  road: '#1c1d22',
  sidewalk: '#5c5d64',
  park: '#4a5a3c',
  treeColor: '#3f8f59',
  particle: { color: '#a6ecff', size: 0.035, opacity: 0.2, count: 200, flutter: 0.85 },
  posterBg: '#0f172a',
  posterFg: '#e0f2fe',
  posterAccent: '#22d3ee',
  label: '2025',
};

const MOODS: readonly EraMood[] = [MOOD_1945, MOOD_1965, MOOD_1985, MOOD_2005, MOOD_2025];

export const ERA_COUNT = MOODS.length;

export function getMood(id: EraId): EraMood {
  const mood = MOODS[eraIndex(id)];
  if (!mood) throw new Error(`No mood for era ${id}`);
  return mood;
}

// ---- Interpolation ----

const TMP_A = new THREE.Color();
const TMP_B = new THREE.Color();
const TMP_OUT = new THREE.Color();

function mixColor(hexA: string, hexB: string, t: number): string {
  TMP_A.set(hexA);
  TMP_B.set(hexB);
  return TMP_OUT.lerpColors(TMP_A, TMP_B, t).getStyle();
}

function mixNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixSky(out: SkyMood, a: SkyMood, b: SkyMood, t: number): void {
  out.skyTop = mixColor(a.skyTop, b.skyTop, t);
  out.skyHorizon = mixColor(a.skyHorizon, b.skyHorizon, t);
  out.skyGround = mixColor(a.skyGround, b.skyGround, t);
  out.sunColor = mixColor(a.sunColor, b.sunColor, t);
  out.fogColor = mixColor(a.fogColor, b.fogColor, t);
  out.ambientColor = mixColor(a.ambientColor, b.ambientColor, t);
  out.dirColor = mixColor(a.dirColor, b.dirColor, t);
  out.sunIntensity = mixNumber(a.sunIntensity, b.sunIntensity, t);
  out.fogDensity = mixNumber(a.fogDensity, b.fogDensity, t);
  out.ambientIntensity = mixNumber(a.ambientIntensity, b.ambientIntensity, t);
  out.dirIntensity = mixNumber(a.dirIntensity, b.dirIntensity, t);
  out.sunHeight = mixNumber(a.sunHeight, b.sunHeight, t);
  out.nightGlow = mixNumber(a.nightGlow, b.nightGlow, t);
  out.neonWash = mixNumber(a.neonWash, b.neonWash, t);
  out.exposure = mixNumber(a.exposure, b.exposure, t);
}

function mixBuilding(out: BuildingStyle, a: BuildingStyle, b: BuildingStyle, t: number): void {
  out.facade = mixColor(a.facade, b.facade, t);
  out.facadeAlt = mixColor(a.facadeAlt, b.facadeAlt, t);
  out.trim = mixColor(a.trim, b.trim, t);
  out.windowGlow = mixColor(a.windowGlow, b.windowGlow, t);
  out.windowColor = mixColor(a.windowColor, b.windowColor, t);
  out.roof = mixColor(a.roof, b.roof, t);
  out.windowGlowIntensity = mixNumber(a.windowGlowIntensity, b.windowGlowIntensity, t);
  out.emissiveBoost = mixNumber(a.emissiveBoost, b.emissiveBoost, t);
  out.occupancy = mixNumber(a.occupancy, b.occupancy, t);
  out.maxHeight = mixNumber(a.maxHeight, b.maxHeight, t);
  out.minHeight = mixNumber(a.minHeight, b.minHeight, t);
}

function mixVehicle(out: VehicleStyle, a: VehicleStyle, b: VehicleStyle, t: number): void {
  out.color = mixColor(a.color, b.color, t);
  out.accent = mixColor(a.accent, b.accent, t);
  out.bodyWidth = mixNumber(a.bodyWidth, b.bodyWidth, t);
  out.cabinHeight = mixNumber(a.cabinHeight, b.cabinHeight, t);
  out.roofSlope = mixNumber(a.roofSlope, b.roofSlope, t);
  out.finHeight = mixNumber(a.finHeight, b.finHeight, t);
}

function mixParticle(out: ParticleMood, a: ParticleMood, b: ParticleMood, t: number): void {
  out.color = mixColor(a.color, b.color, t);
  out.size = mixNumber(a.size, b.size, t);
  out.opacity = mixNumber(a.opacity, b.opacity, t);
  out.count = Math.round(mixNumber(a.count, b.count, t));
  out.flutter = mixNumber(a.flutter, b.flutter, t);
}

/** Interpolated mood for a continuous timeline position in [0, eraCount-1]. */
export function moodAt(t: number): EraMood {
  const clamped = Math.min(MOODS.length - 1, Math.max(0, t));
  const idx = Math.floor(clamped);
  const frac = smoothstep(clamped - idx);
  const a = MOODS[idx];
  const b = MOODS[Math.min(MOODS.length - 1, idx + 1)];
  const out: EraMood = {
    ...a,
    sky: { ...a.sky },
    building: { ...a.building },
    buildingAlt: { ...a.buildingAlt },
    vehicle: { ...a.vehicle },
    particle: { ...a.particle },
  };
  mixSky(out.sky, a.sky, b.sky, frac);
  mixBuilding(out.building, a.building, b.building, frac);
  mixBuilding(out.buildingAlt, a.buildingAlt, b.buildingAlt, frac);
  mixVehicle(out.vehicle, a.vehicle, b.vehicle, frac);
  mixParticle(out.particle, a.particle, b.particle, frac);
  out.label = b.label;
  out.id = b.id;
  return out;
}