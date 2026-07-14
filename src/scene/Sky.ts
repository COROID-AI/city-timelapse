import * as THREE from 'three';
import type { EnvConfig } from '../config/eras';
import { lerp, clamp } from '../utils/math';
import { makeStarSprite } from '../utils/textures';

// ============================================================================
// Sky + environment manager. Owns the sky dome, fog, sun directional light,
// ambient light, hemisphere light, and stars. All interpolated smoothly
// between eras during the ~1.4s crossfade.
// ============================================================================

export class Sky {
  readonly group: THREE.Group;
  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;

  // current interpolated state
  private cur: EnvConfig;
  private from: EnvConfig;
  private to: EnvConfig;
  private t = 1; // transition progress 0..1
  private transitioning = false;
  private transStart = 0;
  private transDur = 1.4;

  constructor(initial: EnvConfig) {
    this.group = new THREE.Group();
    this.cur = { ...initial };
    this.from = { ...initial };
    this.to = { ...initial };

    // Sky dome — vertical gradient shader
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(initial.skyTop) },
        bottomColor: { value: new THREE.Color(initial.skyBottom) },
        offset: { value: 12 },
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float f = max(pow(max(h, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, f), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.skyMat);
    this.skyMesh.name = 'sky';
    this.group.add(this.skyMesh);

    // Sun
    this.sun = new THREE.DirectionalLight(initial.sunColor, initial.sunIntensity);
    this.sun.name = 'sun';
    this.group.add(this.sun);

    // Ambient
    this.ambient = new THREE.AmbientLight(initial.ambientColor, initial.ambientIntensity);
    this.group.add(this.ambient);

    // Hemisphere
    this.hemi = new THREE.HemisphereLight(initial.hemiSky, initial.hemiGround, initial.hemiIntensity);
    this.group.add(this.hemi);

    // Stars (for 2055 twilight)
    const starTex = makeStarSprite();
    this.starMat = new THREE.PointsMaterial({
      size: 2.5,
      map: starTex,
      transparent: true,
      opacity: initial.starIntensity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const starCount = 800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.6 + 0.1); // upper hemisphere
      const r = 350;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(starGeo, this.starMat);
    this.group.add(this.stars);

    this.applyEnv(this.cur);
  }

  transitionTo(env: EnvConfig): void {
    this.from = { ...this.cur };
    this.to = { ...env };
    this.t = 0;
    this.transitioning = true;
    this.transStart = performance.now() / 1000;
  }

  update(now: number): void {
    if (!this.transitioning) return;
    const elapsed = now - this.transStart;
    this.t = clamp(elapsed / this.transDur, 0, 1);
    // smoothstep
    const e = this.t * this.t * (3 - 2 * this.t);

    this.cur.skyTop = lerpHex(this.from.skyTop, this.to.skyTop, e);
    this.cur.skyBottom = lerpHex(this.from.skyBottom, this.to.skyBottom, e);
    this.cur.fogColor = lerpHex(this.from.fogColor, this.to.fogColor, e);
    this.cur.fogNear = lerp(this.from.fogNear, this.to.fogNear, e);
    this.cur.fogFar = lerp(this.from.fogFar, this.to.fogFar, e);
    this.cur.sunAzimuth = lerp(this.from.sunAzimuth, this.to.sunAzimuth, e);
    this.cur.sunElevation = lerp(this.from.sunElevation, this.to.sunElevation, e);
    this.cur.sunColor = lerpHex(this.from.sunColor, this.to.sunColor, e);
    this.cur.sunIntensity = lerp(this.from.sunIntensity, this.to.sunIntensity, e);
    this.cur.ambientColor = lerpHex(this.from.ambientColor, this.to.ambientColor, e);
    this.cur.ambientIntensity = lerp(this.from.ambientIntensity, this.to.ambientIntensity, e);
    this.cur.hemiSky = lerpHex(this.from.hemiSky, this.to.hemiSky, e);
    this.cur.hemiGround = lerpHex(this.from.hemiGround, this.to.hemiGround, e);
    this.cur.hemiIntensity = lerp(this.from.hemiIntensity, this.to.hemiIntensity, e);
    this.cur.starIntensity = lerp(this.from.starIntensity, this.to.starIntensity, e);
    this.cur.exposure = lerp(this.from.exposure, this.to.exposure, e);
    this.cur.groundColor = lerpHex(this.from.groundColor, this.to.groundColor, e);
    this.cur.sidewalkColor = lerpHex(this.from.sidewalkColor, this.to.sidewalkColor, e);
    this.cur.roadColor = lerpHex(this.from.roadColor, this.to.roadColor, e);
    this.cur.laneColor = lerpHex(this.from.laneColor, this.to.laneColor, e);
    this.cur.laneGlow = lerp(this.from.laneGlow, this.to.laneGlow, e);

    this.applyEnv(this.cur);

    if (this.t >= 1) {
      this.transitioning = false;
      this.cur = { ...this.to };
    }
  }

  get currentEnv(): EnvConfig {
    return this.cur;
  }

  private applyEnv(env: EnvConfig): void {
    (this.skyMat.uniforms.topColor.value as THREE.Color).set(env.skyTop);
    (this.skyMat.uniforms.bottomColor.value as THREE.Color).set(env.skyBottom);
    this.sun.color.set(env.sunColor);
    this.sun.intensity = env.sunIntensity;
    this.ambient.color.set(env.ambientColor);
    this.ambient.intensity = env.ambientIntensity;
    this.hemi.color.set(env.hemiSky);
    this.hemi.groundColor.set(env.hemiGround);
    this.hemi.intensity = env.hemiIntensity;
    this.starMat.opacity = env.starIntensity;

    // sun position from azimuth/elevation
    const az = (env.sunAzimuth * Math.PI) / 180;
    const el = (env.sunElevation * Math.PI) / 180;
    const r = 200;
    this.sun.position.set(
      r * Math.cos(el) * Math.sin(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az),
    );
  }

  setExposure(renderer: THREE.WebGLRenderer): void {
    renderer.toneMappingExposure = this.cur.exposure;
  }

  get sunLight(): THREE.DirectionalLight {
    return this.sun;
  }
}

function lerpHex(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  ca.lerp(cb, t);
  return `#${ca.getHexString()}`;
}
