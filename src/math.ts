import type { EraConfig, RGB } from './types';

/** Clamp a value into [lo, hi]. */
export function clamp(x: number, lo = 0, hi = 1): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep easing for crossfades. */
export function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Even smoother quintic easing. */
export function smootherstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export function hash(n: number): number {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

/** Deterministic pseudo-random in [-1,1). */
export function hashSigned(n: number): number {
  return hash(n) * 2 - 1;
}

export function rgb(r: number, g: number, b: number): RGB {
  return { r, g, b };
}

export function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

/**
 * Blend two full era configs. Numbers and colours interpolate linearly;
 * fixed-length colour palettes interpolate element-wise (padded if needed).
 */
export function lerpEra(a: EraConfig, b: EraConfig, t: number): EraConfig {
  const pl = Math.max(a.pedestrianPalette.length, b.pedestrianPalette.length);
  const vl = Math.max(a.vehiclePalette.length, b.vehiclePalette.length);
  const pad = (arr: RGB[], len: number): RGB[] => {
    const out: RGB[] = [];
    for (let i = 0; i < len; i++) out.push(arr[i % arr.length] ?? arr[0]);
    return out;
  };
  const ppA = pad(a.pedestrianPalette, pl);
  const ppB = pad(b.pedestrianPalette, pl);
  const vpA = pad(a.vehiclePalette, vl);
  const vpB = pad(b.vehiclePalette, vl);
  return {
    skyTop: lerpRGB(a.skyTop, b.skyTop, t),
    skyBottom: lerpRGB(a.skyBottom, b.skyBottom, t),
    sunColor: lerpRGB(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    sunAzimuth: lerp(a.sunAzimuth, b.sunAzimuth, t),
    sunElevation: lerp(a.sunElevation, b.sunElevation, t),
    fogColor: lerpRGB(a.fogColor, b.fogColor, t),
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    starsIntensity: lerp(a.starsIntensity, b.starsIntensity, t),
    cloudiness: lerp(a.cloudiness, b.cloudiness, t),
    ambientColor: lerpRGB(a.ambientColor, b.ambientColor, t),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, t),
    hemiSky: lerpRGB(a.hemiSky, b.hemiSky, t),
    hemiGround: lerpRGB(a.hemiGround, b.hemiGround, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    groundColor: lerpRGB(a.groundColor, b.groundColor, t),
    roadColor: lerpRGB(a.roadColor, b.roadColor, t),
    sidewalkColor: lerpRGB(a.sidewalkColor, b.sidewalkColor, t),
    buildingGlassiness: lerp(a.buildingGlassiness, b.buildingGlassiness, t),
    windowGlow: lerp(a.windowGlow, b.windowGlow, t),
    windowLitRatio: lerp(a.windowLitRatio, b.windowLitRatio, t),
    buildingTint: lerpRGB(a.buildingTint, b.buildingTint, t),
    buildingEmissive: lerpRGB(a.buildingEmissive, b.buildingEmissive, t),
    buildingMetalness: lerp(a.buildingMetalness, b.buildingMetalness, t),
    buildingRoughness: lerp(a.buildingRoughness, b.buildingRoughness, t),
    storefrontPaint: lerp(a.storefrontPaint, b.storefrontPaint, t),
    storefrontNeon: lerp(a.storefrontNeon, b.storefrontNeon, t),
    storefrontLED: lerp(a.storefrontLED, b.storefrontLED, t),
    storefrontHologram: lerp(a.storefrontHologram, b.storefrontHologram, t),
    billboardPaint: lerp(a.billboardPaint, b.billboardPaint, t),
    billboardNeon: lerp(a.billboardNeon, b.billboardNeon, t),
    billboardLED: lerp(a.billboardLED, b.billboardLED, t),
    billboardHologram: lerp(a.billboardHologram, b.billboardHologram, t),
    pedestrianDensity: lerp(a.pedestrianDensity, b.pedestrianDensity, t),
    robotAmount: lerp(a.robotAmount, b.robotAmount, t),
    pedestrianPalette: ppA.map((c, i) => lerpRGB(c, ppB[i], t)),
    vehicleDensity: lerp(a.vehicleDensity, b.vehicleDensity, t),
    flyingCarAmount: lerp(a.flyingCarAmount, b.flyingCarAmount, t),
    groundVehicleAmount: lerp(a.groundVehicleAmount, b.groundVehicleAmount, t),
    vehiclePalette: vpA.map((c, i) => lerpRGB(c, vpB[i], t)),
    neonIntensity: lerp(a.neonIntensity, b.neonIntensity, t),
  };
}
