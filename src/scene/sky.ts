import * as THREE from 'three';
import type { EraConfig, SceneModule, SceneState } from '../types';
import { ERA_LIST } from '../config/eras';
import { lerpN, smoothstep } from '../util/math';
import { lerpColorInto } from '../util/color';

const _v = new THREE.Vector3();
const _colA = new THREE.Color();
const _colB = new THREE.Color();

/** A simple two-color vertical gradient sky dome. */
function createSkyShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#6d7e93') },
      uBottom: { value: new THREE.Color('#c2b79a') },
      uOffset: { value: 0.0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vPos;
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform float uOffset;
      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        h = clamp(h + uOffset, 0.0, 1.0);
        vec3 col = mix(uBottom, uTop, smoothstep(0.0, 0.75, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
}

export class SkyModule implements SceneModule {
  readonly group = new THREE.Group();
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sky: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.sun = new THREE.DirectionalLight('#ffdca0', 1.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.camera.left = -120;
    this.sun.shadow.camera.right = 120;
    this.sun.shadow.camera.top = 120;
    this.sun.shadow.camera.bottom = -120;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;

    this.ambient = new THREE.AmbientLight('#8d8b7e', 0.55);
    this.hemi = new THREE.HemisphereLight('#9aa3b0', '#6b5d48', 0.5);

    this.skyMat = createSkyShader();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;

    this.group.add(this.sky, this.sun, this.sun.target, this.ambient, this.hemi);
    this.setEra(ERA_LIST[0]);
  }

  update(dt: number, state: SceneState): void {
    void dt;
    const a = ERA_LIST[state.fromIndex];
    const b = ERA_LIST[state.toIndex];
    const t = smoothstep(state.progress);

    // Sky colors
    lerpColorInto(a.skyTop, b.skyTop, t, this.skyMat.uniforms.uTop.value);
    lerpColorInto(a.skyBottom, b.skyBottom, t, this.skyMat.uniforms.uBottom.value);

    // Sun
    const az = lerpN(a.sunAzimuth, b.sunAzimuth, t);
    const el = lerpN(a.sunElevation, b.sunElevation, t);
    const r = 300;
    _v.set(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az)
    ).multiplyScalar(r);
    this.sun.position.copy(_v);
    this.sun.target.position.set(0, 0, 0);
    lerpColorInto(a.sunColor, b.sunColor, t, _colA);
    this.sun.color.copy(_colA);
    this.sun.intensity = lerpN(a.sunIntensity, b.sunIntensity, t);

    // Ambient
    lerpColorInto(a.ambientColor, b.ambientColor, t, _colB);
    this.ambient.color.copy(_colB);
    this.ambient.intensity = lerpN(a.ambientIntensity, b.ambientIntensity, t);

    // Hemisphere
    lerpColorInto(a.hemiSky, b.hemiSky, t, this.hemi.color);
    lerpColorInto(a.hemiGround, b.hemiGround, t, this.hemi.groundColor);

    // Fog
    const fogColor = lerpColorInto(a.fogColor, b.fogColor, t, new THREE.Color());
    const fogNear = lerpN(a.fogNear, b.fogNear, t);
    const fogFar = lerpN(a.fogFar, b.fogFar, t);
    this.renderer.setClearColor(fogColor, 1);
    if (!this.scene.fog || !(this.scene.fog instanceof THREE.Fog)) {
      this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    } else {
      const f = this.scene.fog as THREE.Fog;
      f.color.copy(fogColor);
      f.near = fogNear;
      f.far = fogFar;
    }

    // Exposure
    this.renderer.toneMappingExposure = lerpN(a.exposure, b.exposure, t);
  }

  setEra(config: EraConfig): void {
    lerpColorInto(config.skyTop, config.skyTop, 0, this.skyMat.uniforms.uTop.value);
    lerpColorInto(config.skyBottom, config.skyBottom, 0, this.skyMat.uniforms.uBottom.value);

    const r = 300;
    _v.set(
      Math.cos(config.sunElevation) * Math.cos(config.sunAzimuth),
      Math.sin(config.sunElevation),
      Math.cos(config.sunElevation) * Math.sin(config.sunAzimuth)
    ).multiplyScalar(r);
    this.sun.position.copy(_v);
    this.sun.color.set(config.sunColor).convertSRGBToLinear();
    this.sun.intensity = config.sunIntensity;

    this.ambient.color.set(config.ambientColor).convertSRGBToLinear();
    this.ambient.intensity = config.ambientIntensity;

    this.hemi.color.set(config.hemiSky).convertSRGBToLinear();
    this.hemi.groundColor.set(config.hemiGround).convertSRGBToLinear();

    const fogColor = new THREE.Color(config.fogColor).convertSRGBToLinear();
    this.renderer.setClearColor(fogColor, 1);
    this.scene.fog = new THREE.Fog(fogColor, config.fogNear, config.fogFar);
    this.renderer.toneMappingExposure = config.exposure;
  }

  get sunLight(): THREE.DirectionalLight {
    return this.sun;
  }

  dispose(): void {
    this.skyMat.dispose();
    this.sky.geometry.dispose();
  }
}

/** Blend two era configs into a single interpolated config snapshot. */
export function blendEra(a: EraConfig, b: EraConfig, rawT: number): EraConfig {
  const t = smoothstep(rawT);
  return {
    ...a,
    year: Math.round(lerpN(a.year, b.year, t)),
    nightFactor: lerpN(a.nightFactor, b.nightFactor, t),
    windowLitRatio: lerpN(a.windowLitRatio, b.windowLitRatio, t),
    glassness: lerpN(a.glassness, b.glassness, t),
    buildingMaxHeight: lerpN(a.buildingMaxHeight, b.buildingMaxHeight, t),
    buildingMinHeight: lerpN(a.buildingMinHeight, b.buildingMinHeight, t)
  } as EraConfig;
}
