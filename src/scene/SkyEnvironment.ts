import * as THREE from 'three';
import { ERAS } from '../config/eras';
import type { EraWeights } from '../core/EraTransition';
import { blendScalar } from '../core/mathUtils';

// Sky dome (gradient shader), sun (directional light), ambient + hemisphere
// light, exponential fog, and a starfield. All interpolate per era weights.

const STAR_COUNT = 1200;

// Pre-computed per-era arrays — built once, never reallocated per frame.
const TOPS = ERAS.map(e => e.sky.top);
const HORS = ERAS.map(e => e.sky.horizon);
const SUNS = ERAS.map(e => e.sky.sunColor);
const AMBS = ERAS.map(e => e.sky.ambientColor);
const H_SKY = ERAS.map(e => e.sky.hemiSky);
const H_GROUND = ERAS.map(e => e.sky.hemiGround);
const FOGS = ERAS.map(e => e.sky.fogColor);
const SUN_INT = ERAS.map(e => e.sky.sunIntensity);
const AMB_INT = ERAS.map(e => e.sky.ambientIntensity);
const SUN_AZ = ERAS.map(e => e.sky.sunAzimuth);
const SUN_EL = ERAS.map(e => e.sky.sunElevation);
const FOG_DEN = ERAS.map(e => e.sky.fogDensity);
const STARS = ERAS.map(e => e.sky.stars);
const _blendTmp = new THREE.Color();

export class SkyEnvironment {
  private scene: THREE.Scene;
  private skyMat: THREE.ShaderMaterial;
  private sun: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private stars: THREE.Points;
  private starsMat: THREE.PointsMaterial;
  private tmpTop = new THREE.Color();
  private tmpHor = new THREE.Color();
  private tmpSun = new THREE.Color();
  private tmpAmb = new THREE.Color();
  private tmpSky = new THREE.Color();
  private tmpGround = new THREE.Color();
  private tmpFog = new THREE.Color();
  private sunPos = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0xb8a06a) },
        horizonColor: { value: new THREE.Color(0xd8c089) },
        offset: { value: 12 },
        exponent: { value: 0.7 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vWorld;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        void main() {
          float h = normalize(vWorld + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
        }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), this.skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    scene.fog = new THREE.FogExp2(0xc8b080, 0.012);

    this.sun = new THREE.DirectionalLight(0xffe6b0, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 140;
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(0x9a8460, 0.5);
    scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight(0xb0a070, 0x4a3a28, 0.4);
    scene.add(this.hemi);

    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9 + 0.05);
      const r = 250;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.4, sizeAttenuation: false,
      transparent: true, opacity: 0, depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starsMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);
  }

  getSun(): THREE.DirectionalLight { return this.sun; }

  update(weights: EraWeights, time: number): void {
    blendHex(TOPS, weights, this.tmpTop);
    blendHex(HORS, weights, this.tmpHor);
    blendHex(SUNS, weights, this.tmpSun);
    blendHex(AMBS, weights, this.tmpAmb);
    blendHex(H_SKY, weights, this.tmpSky);
    blendHex(H_GROUND, weights, this.tmpGround);
    blendHex(FOGS, weights, this.tmpFog);

    (this.skyMat.uniforms.topColor.value as THREE.Color).copy(this.tmpTop);
    (this.skyMat.uniforms.horizonColor.value as THREE.Color).copy(this.tmpHor);

    this.sun.color.copy(this.tmpSun);
    this.ambient.color.copy(this.tmpAmb);
    this.hemi.color.copy(this.tmpSky);
    this.hemi.groundColor.copy(this.tmpGround);

    this.sun.intensity = blendScalar(SUN_INT, weights, 0);
    this.ambient.intensity = blendScalar(AMB_INT, weights, 0);

    const az = blendScalar(SUN_AZ, weights, 0);
    const el = blendScalar(SUN_EL, weights, 0);
    const r = 80;
    this.sunPos.set(
      Math.cos(el) * Math.cos(az) * r,
      Math.sin(el) * r + 6,
      Math.cos(el) * Math.sin(az) * r,
    );
    this.sun.position.copy(this.sunPos);
    this.sun.target.position.set(0, 0, 0);

    const fogDensity = blendScalar(FOG_DEN, weights, 0);
    if (this.scene.fog && (this.scene.fog as THREE.FogExp2).density !== undefined) {
      (this.scene.fog as THREE.FogExp2).color.copy(this.tmpFog);
      (this.scene.fog as THREE.FogExp2).density = fogDensity;
    }

    const starsVis = blendScalar(STARS, weights, 0);
    this.starsMat.opacity = starsVis;
    this.stars.rotation.y = time * 0.004;
    this.starsMat.size = 1.2 + Math.sin(time * 1.5) * 0.1;
  }

  dispose(): void {
    this.skyMat.dispose();
    this.starsMat.dispose();
    this.stars.geometry.dispose();
  }
}

/** Blend hex colors by era weights into a reusable Color (no allocation). */
function blendHex(perEra: number[], weights: Float32Array, out: THREE.Color): void {
  out.setRGB(0, 0, 0);
  const n = Math.min(perEra.length, weights.length);
  for (let i = 0; i < n; i++) {
    const w = weights[i];
    if (w === 0) continue;
    _blendTmp.setHex(perEra[i]);
    out.r += _blendTmp.r * w;
    out.g += _blendTmp.g * w;
    out.b += _blendTmp.b * w;
  }
}
