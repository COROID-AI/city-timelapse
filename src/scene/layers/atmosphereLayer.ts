/**
 * Atmosphere layer — procedural sky, lighting, and fog per era.
 *
 * Provides a visually distinct mood for each of the five eras
 * through interpolated sky gradients, hemisphere/directional lighting,
 * exponential fog, and a subtle animated sky variation loop.
 *
 * All atmosphere values are sourced from EraContent.atmosphere so
 * other layers can read them without duplicating data.
 */

import * as THREE from 'three';
import type { EraId } from '../../eras.js';
import type { AtmosphereSettings } from '../../content/eraConfig.js';
import defaultEras from '../../content/eraConfig.js';

// ─── Public API ─────────────────────────────────────────────────────────

export interface AtmosphereLayerResult {
  /** THREE.Group containing the sky dome (added to scene). */
  group: THREE.Group;
  /** Apply a new era's atmosphere settings with smooth transition. */
  applyEra(eraId: EraId, duration?: number): void;
  /** Per-frame update called from the render loop. */
  update(deltaTime: number): void;
  /** Dispose all resources. */
  dispose(): void;
}

// ─── Sky shader sources ─────────────────────────────────────────────────

const skyVertexShader = /* glsl */ `
varying vec2 vUv;
varying float vYNorm;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  // Normalised Y from bottom (0) to top (1) of sphere
  vYNorm = position.y / radius + 0.5;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uHorizonColor;
uniform vec3 uZenithColor;
uniform vec3 uMidColor;
uniform float uMidFactor;
uniform float uCloudOpacity;
uniform vec3 uSunDir;
uniform float uSunIntensity;
uniform float uTime;

varying vec2 vUv;
varying float vYNorm;
varying vec3 vWorldPos;

// ── Simplex-like 3D noise (compact) ────────────────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x  = x_ * ns.x + ns.yyyy;
  vec4 y  = y_ * ns.x + ns.yyyy;
  vec4 h  = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main() {
  vec3 dir = normalize(vWorldPos);

  // ── Height-based gradient ────────────────────────────────────────────
  float height = clamp(vYNorm, 0.0, 1.0);
  vec3 skyColor = mix(uHorizonColor, uZenithColor, pow(height, 0.7));

  // Optional mid-band
  bool hasMid = uMidFactor > 0.0 && (uMidColor.r > 0.0 || uMidColor.g > 0.0 || uMidColor.b > 0.0);
  if (hasMid) {
    float midBlend = smoothstep(uMidFactor - 0.15, uMidFactor + 0.15, height);
    skyColor = mix(skyColor, uMidColor, midBlend * 0.5);
  }

  // ── Clouds ───────────────────────────────────────────────────────────
  float cloudNoise = snoise(dir * 4.0 + vec3(uTime * 0.015, 0.0, uTime * 0.005));
  float cloudNoise2 = snoise(dir * 8.0 - vec3(uTime * 0.01, 0.0, 0.0));
  float clouds = smoothstep(0.1, 0.6, cloudNoise * 0.6 + cloudNoise2 * 0.4);
  clouds *= smoothstep(0.0, 0.3, height); // fade near horizon
  vec3 cloudColor = mix(uHorizonColor, vec3(1.0), 0.5);
  skyColor = mix(skyColor, cloudColor, clouds * uCloudOpacity);

  // ── Sun glow ─────────────────────────────────────────────────────────
  float sunDot = max(dot(dir, uSunDir), 0.0);
  float sunHalo = pow(sunDot, 8.0) * 0.4 * uSunIntensity;
  float sunGlow = pow(sunDot, 64.0) * 1.5 * uSunIntensity;
  skyColor += vec3(1.0, 0.95, 0.8) * (sunHalo + sunGlow);

  // Gamma
  skyColor = pow(clamp(skyColor, 0.0, 1.0), vec3(1.0 / 2.2));

  gl_FragColor = vec4(skyColor, 1.0);
}`;

// ─── Easing ─────────────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Interpolation helpers ──────────────────────────────────────────────

function lerpColorHex(a: number, b: number, t: number): number {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return ca.getHex();
}

function copyAtmosphere(src: AtmosphereSettings): AtmosphereSettings {
  return {
    sky: { ...src.sky },
    fogDensity: src.fogDensity,
    fogColor: src.fogColor,
    sun: { ...src.sun },
    hemiSkyColor: src.hemiSkyColor,
    hemiGroundColor: src.hemiGroundColor,
    hemiIntensity: src.hemiIntensity,
    dirIntensity: src.dirIntensity,
  };
}

// ─── Uniform type for the sky shader ────────────────────────────────────

interface SkyUniformValue {
  value: THREE.Color | THREE.Vector3 | number;
}

// ─── Factory ────────────────────────────────────────────────────────────

export function createAtmosphereLayer(scene: THREE.Scene): AtmosphereLayerResult {
  const group = new THREE.Group();
  group.name = 'atmosphere-layer';

  // ── Procedural sky dome ──────────────────────────────────────────────
  const skyRadius = 300;
  const skyGeo = new THREE.SphereGeometry(skyRadius, 32, 24);

  const skyUniforms: Record<string, SkyUniformValue> = {
    uHorizonColor: { value: new THREE.Color(0xc4a882) },
    uZenithColor:  { value: new THREE.Color(0x8a7d6b) },
    uMidColor:     { value: new THREE.Color(0xffffff) },
    uMidFactor:    { value: 0.0 },
    uCloudOpacity: { value: 0.25 },
    uSunDir:       { value: new THREE.Vector3(0.6, 0.35, 0.7).normalize() },
    uSunIntensity: { value: 1.0 },
    uTime:         { value: 0.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.renderOrder = -1000;
  group.add(skyMesh);

  // ── Lighting ─────────────────────────────────────────────────────────
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
  hemiLight.name = 'atmosphere-hemi';
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.name = 'atmosphere-sun';
  scene.add(dirLight);

  // ── Fog ──────────────────────────────────────────────────────────────
  scene.fog = new THREE.FogExp2(0xbfa882, 0.012);

  // ─── Transition state ────────────────────────────────────────────────

  let prevSettings: AtmosphereSettings | null = null;
  let currentSettings: AtmosphereSettings;
  let targetSettings: AtmosphereSettings;
  let transitionProgress = 1.0; // 1 = fully transitioned
  let transitionDuration = 1.5; // seconds
  let transitionStart = performance.now();

  // Initialise to the first era
  const firstEra = defaultEras['1945'];
  currentSettings = copyAtmosphere(firstEra.atmosphere);
  targetSettings = copyAtmosphere(firstEra.atmosphere);

  function applySettings(settings: AtmosphereSettings): void {
    // Sky uniforms
    (skyUniforms.uHorizonColor.value as THREE.Color).setHex(settings.sky.horizonColor);
    (skyUniforms.uZenithColor.value as THREE.Color).setHex(settings.sky.zenithColor);
    if (settings.sky.midColor !== undefined) {
      (skyUniforms.uMidColor.value as THREE.Color).setHex(settings.sky.midColor);
      skyUniforms.uMidFactor.value = settings.sky.midFactor ?? 0.5;
    } else {
      (skyUniforms.uMidColor.value as THREE.Color).setHex(0xffffff);
      skyUniforms.uMidFactor.value = 0.0;
    }

    // Sun direction
    (skyUniforms.uSunDir.value as THREE.Vector3).set(settings.sun.x, settings.sun.y, settings.sun.z).normalize();
    skyUniforms.uSunIntensity.value = settings.dirIntensity;

    // Directional light
    dirLight.color.setHex(settings.sun.color);
    dirLight.position.set(settings.sun.x * 50, settings.sun.y * 50, settings.sun.z * 50);
    dirLight.intensity = settings.dirIntensity;

    // Hemisphere light
    hemiLight.color.setHex(settings.hemiSkyColor);
    hemiLight.groundColor.setHex(settings.hemiGroundColor);
    hemiLight.intensity = settings.hemiIntensity;

    // Fog
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.setHex(settings.fogColor);
      scene.fog.density = settings.fogDensity;
    }
  }

  // ── Public methods ───────────────────────────────────────────────────

  function applyEra(eraId: EraId, duration?: number): void {
    const eraContent = defaultEras[eraId];
    if (!eraContent) {
      console.warn(`[AtmosphereLayer] Unknown era: ${eraId}`);
      return;
    }

    prevSettings = copyAtmosphere(currentSettings);
    targetSettings = copyAtmosphere(eraContent.atmosphere);
    transitionDuration = duration ?? 1.5;
    transitionStart = performance.now();
    transitionProgress = 0.0;

    // Immediately set visual to target (smooth interpolation is driven by update)
    applySettings(targetSettings);
  }

  function update(deltaTime: number): void {
    // Advance transition
    if (transitionProgress < 1.0) {
      const elapsed = (performance.now() - transitionStart) / 1000;
      transitionProgress = Math.min(elapsed / transitionDuration, 1.0);
      const eased = easeInOutCubic(transitionProgress);

      // Interpolate scalar values
      const fogDensity = prevSettings!.fogDensity + (targetSettings.fogDensity - prevSettings!.fogDensity) * eased;
      const hemiIntensity = prevSettings!.hemiIntensity + (targetSettings.hemiIntensity - prevSettings!.hemiIntensity) * eased;
      const dirIntensity = prevSettings!.dirIntensity + (targetSettings.dirIntensity - prevSettings!.dirIntensity) * eased;

      // Interpolate colors
      const hemiSkyColor = lerpColorHex(prevSettings!.hemiSkyColor, targetSettings.hemiSkyColor, eased);
      const hemiGroundColor = lerpColorHex(prevSettings!.hemiGroundColor, targetSettings.hemiGroundColor, eased);
      const fogColor = lerpColorHex(prevSettings!.fogColor, targetSettings.fogColor, eased);
      const sunColor = lerpColorHex(prevSettings!.sun.color, targetSettings.sun.color, eased);

      // Interpolate sun direction
      const sunX = prevSettings!.sun.x + (targetSettings.sun.x - prevSettings!.sun.x) * eased;
      const sunY = prevSettings!.sun.y + (targetSettings.sun.y - prevSettings!.sun.y) * eased;
      const sunZ = prevSettings!.sun.z + (targetSettings.sun.z - prevSettings!.sun.z) * eased;

      // Interpolate sky colors
      const horizonColor = lerpColorHex(prevSettings!.sky.horizonColor, targetSettings.sky.horizonColor, eased);
      const zenithColor = lerpColorHex(prevSettings!.sky.zenithColor, targetSettings.sky.zenithColor, eased);

      // Update uniforms & lights
      (skyUniforms.uHorizonColor.value as THREE.Color).setHex(horizonColor);
      (skyUniforms.uZenithColor.value as THREE.Color).setHex(zenithColor);
      (skyUniforms.uSunDir.value as THREE.Vector3).set(sunX, sunY, sunZ).normalize();
      skyUniforms.uSunIntensity.value = dirIntensity;

      dirLight.color.setHex(sunColor);
      dirLight.position.set(sunX * 50, sunY * 50, sunZ * 50);
      dirLight.intensity = dirIntensity;

      hemiLight.color.setHex(hemiSkyColor);
      hemiLight.groundColor.setHex(hemiGroundColor);
      hemiLight.intensity = hemiIntensity;

      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(fogColor);
        scene.fog.density = fogDensity;
      }

      // Update stored state
      currentSettings = {
        sky: {
          horizonColor: Number(horizonColor),
          zenithColor: Number(zenithColor),
          midColor: prevSettings!.sky.midColor !== undefined
            ? lerpColorHex(prevSettings!.sky.midColor!, targetSettings.sky.midColor!, eased)
            : undefined,
        },
        fogDensity,
        fogColor: Number(fogColor),
        sun: { x: sunX, y: sunY, z: sunZ, color: Number(sunColor) },
        hemiSkyColor: Number(hemiSkyColor),
        hemiGroundColor: Number(hemiGroundColor),
        hemiIntensity,
        dirIntensity,
      };

      if (transitionProgress >= 1.0) {
        prevSettings = null;
        currentSettings = copyAtmosphere(targetSettings);
      }
    }

    // ── Subtle animated sky variation (always running) ─────────────────
    const time = (skyUniforms.uTime.value as number);
    skyUniforms.uTime.value = time + deltaTime;

    // Very subtle sun shimmer
    const shimmerAmount = 0.02;
    skyUniforms.uSunIntensity.value =
      targetSettings.dirIntensity + Math.sin(time * 2.0) * shimmerAmount * targetSettings.dirIntensity;

    // Subtle cloud drift is handled inside the shader via uTime
  }

  function dispose(): void {
    skyGeo.dispose();
    skyMat.dispose();
    scene.remove(hemiLight);
    scene.remove(dirLight);
    hemiLight.dispose();
    dirLight.dispose();
    scene.fog = null;
  }

  // ── Expose public API ────────────────────────────────────────────────

  return {
    group,
    applyEra,
    update,
    dispose,
  };
}
