import * as THREE from "three";
import type { EraVisualConfig } from "../types";

/**
 * Atmosphere controller: background, fog, sun (directional) light, ambient,
 * and hemisphere light. All lerped continuously across a transition.
 */
export class Sky {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.AmbientLight;
  readonly hemi: THREE.HemisphereLight;
  private readonly sunTarget: THREE.Object3D;
  private readonly bgColor: THREE.Color;
  private readonly fog: THREE.Fog;

  constructor(scene: THREE.Scene) {
    this.bgColor = new THREE.Color().setHex(0x12304a, THREE.SRGBColorSpace);
    this.fog = new THREE.Fog(0x12304a, 30, 140);
    scene.background = this.bgColor;
    scene.fog = this.fog;

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.near = 1;
    cam.far = 170;
    cam.left = -45;
    cam.right = 45;
    cam.top = 45;
    cam.bottom = -45;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;

    this.sunTarget = new THREE.Object3D();
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.hemi = new THREE.HemisphereLight(0xb6a47e, 0x46392b, 0.6);
    scene.add(this.sun, this.ambient, this.hemi);
  }

  applyAtmosphere(
    from: EraVisualConfig,
    to: EraVisualConfig,
    t: number
  ): void {
    const s = _scratch;

    // Background + fog color.
    this.bgColor
      .copy(s.cA.setHex(from.sky, THREE.SRGBColorSpace))
      .lerp(s.cB.setHex(to.sky, THREE.SRGBColorSpace), t);
    this.fog.color.copy(this.bgColor);
    this.fog.near = lerpNum(from.fogNear, to.fogNear, t);
    this.fog.far = lerpNum(from.fogFar, to.fogFar, t);

    // Sun.
    this.sun.color
      .copy(s.cA.setHex(from.sunColor, THREE.SRGBColorSpace))
      .lerp(s.cB.setHex(to.sunColor, THREE.SRGBColorSpace), t);
    this.sun.intensity = lerpNum(from.sunIntensity, to.sunIntensity, t);
    this.sun.position.set(
      lerpNum(from.sunPos.x, to.sunPos.x, t),
      lerpNum(from.sunPos.y, to.sunPos.y, t),
      lerpNum(from.sunPos.z, to.sunPos.z, t)
    );
    const sc = this.sun.shadow.camera;
    sc.far = Math.max(from.sunShadowFar, to.sunShadowFar) + 10;
    sc.updateProjectionMatrix();

    // Ambient + hemi.
    this.ambient.color
      .copy(s.cA.setHex(from.ambientColor, THREE.SRGBColorSpace))
      .lerp(s.cB.setHex(to.ambientColor, THREE.SRGBColorSpace), t);
    this.ambient.intensity = lerpNum(from.ambientIntensity, to.ambientIntensity, t);
    this.hemi.color
      .copy(s.cA.setHex(from.hemiSky, THREE.SRGBColorSpace))
      .lerp(s.cB.setHex(to.hemiSky, THREE.SRGBColorSpace), t);
    this.hemi.groundColor
      .copy(s.cA.setHex(from.hemiGround, THREE.SRGBColorSpace))
      .lerp(s.cB.setHex(to.hemiGround, THREE.SRGBColorSpace), t);
    this.hemi.intensity = lerpNum(from.hemiIntensity, to.hemiIntensity, t);
  }

  dispose(): void {
    this.sun.shadow.map?.dispose();
  }
}

const _scratch = { cA: new THREE.Color(), cB: new THREE.Color() };

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
