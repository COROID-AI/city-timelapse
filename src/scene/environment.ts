/**
 * Environment: procedural sky dome, sun, fog, ground plane, ambient particles.
 * All colours interpolate with the continuous era float.
 */

import * as THREE from 'three';
import { lerp, lerpColor } from '../state';
import type { AppState } from '../state';
import { themePairAt, rgbToHex } from '../theme';
import type { Theme, Rgb } from '../theme';
import type { TextureSet } from '../textures';

export interface EnvModule {
  group: THREE.Group;
  /** Scene-level fog — main.ts attaches this to the scene. */
  fog: THREE.Fog;
  update(dt: number, state: AppState): void;
  setEra(era: number, t: number): void;
  dispose(): void;
}

const SUN_TARGET = new THREE.Vector3(0, 0, 0);

export function createEnvironment(textures: TextureSet): EnvModule {
  const group = new THREE.Group();
  group.name = 'environment';

  /* ---------------- Sky dome ---------------- */
  const skyGeo = new THREE.SphereGeometry(220, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#3a4a5f') },
      uHorizon: { value: new THREE.Color('#d8b890') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        float k = clamp(pow(max(h, 0.0), 0.55), 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, k);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  group.add(sky);

  /* ---------------- Sun + directional light ---------------- */
  const sunGeo = new THREE.SphereGeometry(6, 16, 12);
  const sunMat = new THREE.MeshBasicMaterial({ color: '#fff2d0', fog: false });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  group.add(sun);

  const sunLight = new THREE.DirectionalLight('#fff0d0', 2.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.bias = -0.0005;
  group.add(sunLight);
  group.add(sunLight.target);

  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6a5644, 0.55);
  group.add(hemi);

  /* ---------------- Fog ---------------- */
  const fog = new THREE.Fog(0xd8b890, 60, 260);

  /* ---------------- Ground ---------------- */
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    color: '#3a3a3e',
    roughness: 0.92,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  /* ---------------- Ambient particles ---------------- */
  const particleCount = 300;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(particleCount * 3);
  const pVel = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 160;
    pPos[i * 3 + 1] = Math.random() * 40 + 1;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 160;
    pVel[i * 3] = (Math.random() - 0.5) * 0.6;
    pVel[i * 3 + 1] = Math.random() * 0.4 + 0.05;
    pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: '#c9b28a',
    size: 0.06,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  group.add(points);

  /* ---------------- State ---------------- */
  let currentEra = 0;
  const tmpColor = new THREE.Color();

  function applyTheme(theme: Theme): void {
    const t = theme;
    tmpColor.set(rgbToHex(t.sky.zenith));
    (skyMat.uniforms.uTop.value as THREE.Color).copy(tmpColor);
    tmpColor.set(rgbToHex(t.sky.horizon));
    (skyMat.uniforms.uHorizon.value as THREE.Color).copy(tmpColor);
    fog.color.set(rgbToHex(t.sky.fog));
    fog.near = 40;
    fog.far = 60 + (1 - t.sky.fogDensity * 220) * 220;
    tmpColor.set(rgbToHex(t.sky.sunColor));
    sunMat.color.copy(tmpColor);
    sunLight.color.copy(tmpColor);
    sunLight.intensity = t.sky.sunIntensity;
    sun.position.set(90, 60 * Math.sin(t.sky.sunElevation), -30);
    sunLight.position.copy(sun.position);
    sunLight.target.position.copy(SUN_TARGET);
    tmpColor.set(rgbToHex(t.ground.asphalt));
    groundMat.color.copy(tmpColor);
    const hemiTop = lerpColor(t.sky.zenith, { r: 0.9, g: 0.95, b: 1 }, 0.5);
    hemi.color.set(rgbToHex(hemiTop));
    const hemiGround = lerpColor(t.ground.asphalt, { r: 0.5, g: 0.4, b: 0.3 }, 0.5);
    hemi.groundColor.set(rgbToHex(hemiGround));
    pMat.color.set(rgbToHex(t.particles.color));
    pMat.size = t.particles.size;
    pMat.opacity = t.particles.opacity;
  }

  function update(dt: number, state: AppState): void {
    const { a, b, t } = themePairAt(state.eraFloat);
    currentEra = state.eraFloat;
    if (t < 0.001) {
      applyTheme(a);
    } else if (t > 0.999) {
      applyTheme(b);
    } else {
      const lerped = {
        sky: {
          zenith: lerpColor(a.sky.zenith, b.sky.zenith, t),
          horizon: lerpColor(a.sky.horizon, b.sky.horizon, t),
          fog: lerpColor(a.sky.fog, b.sky.fog, t),
          fogDensity: lerp(a.sky.fogDensity, b.sky.fogDensity, t),
          sunColor: lerpColor(a.sky.sunColor, b.sky.sunColor, t),
          sunIntensity: lerp(a.sky.sunIntensity, b.sky.sunIntensity, t),
          sunElevation: lerp(a.sky.sunElevation, b.sky.sunElevation, t),
        },
        ground: {
          asphalt: lerpColor(a.ground.asphalt, b.ground.asphalt, t),
          sidewalk: lerpColor(a.ground.sidewalk, b.ground.sidewalk, t),
          curb: lerpColor(a.ground.curb, b.ground.curb, t),
          roadLine: lerpColor(a.ground.roadLine, b.ground.roadLine, t),
          crosswalk: lerpColor(a.ground.crosswalk, b.ground.crosswalk, t),
        },
        particles: {
          color: lerpColor(a.particles.color, b.particles.color, t),
          count: lerp(a.particles.count, b.particles.count, t),
          size: lerp(a.particles.size, b.particles.size, t),
          speed: lerp(a.particles.speed, b.particles.speed, t),
          opacity: lerp(a.particles.opacity, b.particles.opacity, t),
        },
      } as Theme;
      applyTheme(lerped);
    }

    // Animate particles
    const pos = pGeo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const speed = (a.particles.speed + (b.particles.speed - a.particles.speed) * t) * 0.4;
    for (let i = 0; i < particleCount; i++) {
      arr[i * 3] += pVel[i * 3] * dt * speed;
      arr[i * 3 + 1] += pVel[i * 3 + 1] * dt * speed;
      arr[i * 3 + 2] += pVel[i * 3 + 2] * dt * speed;
      if (arr[i * 3] > 80) arr[i * 3] = -80;
      if (arr[i * 3] < -80) arr[i * 3] = 80;
      if (arr[i * 3 + 1] > 42) arr[i * 3 + 1] = 1;
      if (arr[i * 3 + 2] > 80) arr[i * 3 + 2] = -80;
      if (arr[i * 3 + 2] < -80) arr[i * 3 + 2] = 80;
    }
    pos.needsUpdate = true;

    // Gentle sun drift
    sun.position.x = 90 + Math.sin(state.elapsed * 0.02) * 6;
    sun.position.y = 60 * Math.sin(currentEra === 0 ? 0.55 : 0.85) + Math.sin(state.elapsed * 0.1) * 1.2;
    sunLight.position.copy(sun.position);
  }

  function setEra(era: number): void {
    currentEra = era;
  }

  function dispose(): void {
    skyGeo.dispose();
    skyMat.dispose();
    sunGeo.dispose();
    sunMat.dispose();
    groundGeo.dispose();
    groundMat.dispose();
    pGeo.dispose();
    pMat.dispose();
    group.removeFromParent();
  }

  return { group, fog, update, setEra, dispose };
}

export type { Rgb };