import * as THREE from 'three';
import { ERAS } from './eras/data';
import type { EraId } from './eras/types';

/**
 * Manages the Three.js renderer, scene graph, era-specific lighting, sky dome
 * and fog. The era ambiance (sky gradient, fog tint, sun color/intensity) is
 * tweened smoothly on era change.
 */
export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly threeScene: THREE.Scene;

  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly sky: THREE.Mesh;

  private currentColors = {
    skyTop: new THREE.Color('#000'),
    skyBottom: new THREE.Color('#000'),
    fog: new THREE.Color('#000'),
    sun: new THREE.Color('#fff'),
    ambient: new THREE.Color('#fff'),
  };
  private targetColors = { ...this.currentColors };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.threeScene = new THREE.Scene();
    const first = ERAS['1945'];
    this.threeScene.fog = new THREE.FogExp2(first.fogColor, first.fogDensity);
    this.currentColors.fog.set(first.fogColor);
    this.targetColors = this.cloneColors(this.currentColors);

    // Lighting
    this.ambient = new THREE.AmbientLight(first.ambientColor, first.ambientIntensity);
    this.threeScene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(first.sunColor, first.sunIntensity);
    this.sun.position.set(40, 60, 24);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.bias = -0.0005;
    this.threeScene.add(this.sun);
    this.threeScene.add(this.sun.target);

    // Sky dome with gradient shader.
    this.skyMat = createSkyMaterial(first.skyTop, first.skyBottom);
    this.currentColors.skyTop.set(first.skyTop);
    this.currentColors.skyBottom.set(first.skyBottom);
    this.targetColors = this.cloneColors(this.currentColors);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.skyMat);
    this.sky.name = 'sky';
    this.threeScene.add(this.sky);
  }

  /** Begin tweening the ambiance (sky/fog/light) toward the target era. */
  transitionTo(era: EraId, duration = 800): void {
    const desc = ERAS[era];
    this.targetColors = {
      skyTop: new THREE.Color(desc.skyTop),
      skyBottom: new THREE.Color(desc.skyBottom),
      fog: new THREE.Color(desc.fogColor),
      sun: new THREE.Color(desc.sunColor),
      ambient: new THREE.Color(desc.ambientColor),
    };

    const start = performance.now();
    const from = this.cloneColors(this.currentColors);
    const fromFogDensity = (this.threeScene.fog as THREE.FogExp2).density;
    const toFogDensity = desc.fogDensity;
    const fromSunI = this.sun.intensity;
    const fromAmbI = this.ambient.intensity;

    const step = (now: number): void => {
      const t = Math.min((now - start) / Math.max(duration, 1), 1);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.currentColors.skyTop.lerpColors(from.skyTop, this.targetColors.skyTop, e);
      this.currentColors.skyBottom.lerpColors(from.skyBottom, this.targetColors.skyBottom, e);
      this.currentColors.fog.lerpColors(from.fog, this.targetColors.fog, e);
      this.currentColors.sun.lerpColors(from.sun, this.targetColors.sun, e);
      this.currentColors.ambient.lerpColors(from.ambient, this.targetColors.ambient, e);

      this.skyMat.uniforms.topColor.value.copy(this.currentColors.skyTop);
      this.skyMat.uniforms.bottomColor.value.copy(this.currentColors.skyBottom);
      const fog = this.threeScene.fog as THREE.FogExp2;
      fog.color.copy(this.currentColors.fog);
      fog.density = fromFogDensity + (toFogDensity - fromFogDensity) * e;
      this.sun.color.copy(this.currentColors.sun);
      this.sun.intensity = fromSunI + (desc.sunIntensity - fromSunI) * e;
      this.ambient.color.copy(this.currentColors.ambient);
      this.ambient.intensity = fromAmbI + (desc.ambientIntensity - fromAmbI) * e;

      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.threeScene, camera);
  }

  dispose(): void {
    this.sky.geometry.dispose();
    this.skyMat.dispose();
    this.renderer.dispose();
  }

  private cloneColors(c: typeof this.currentColors) {
    return {
      skyTop: c.skyTop.clone(),
      skyBottom: c.skyBottom.clone(),
      fog: c.fog.clone(),
      sun: c.sun.clone(),
      ambient: c.ambient.clone(),
    };
  }
}

/** Simple vertical-gradient sky shader. */
function createSkyMaterial(top: string, bottom: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(top) },
      bottomColor: { value: new THREE.Color(bottom) },
      offset: { value: 33 },
      exponent: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
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
        float h = normalize(vWorldPosition + offset).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
}
