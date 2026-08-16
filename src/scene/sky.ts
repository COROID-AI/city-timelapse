import * as THREE from 'three';

// ── Era atmosphere definition ───────────────────────────────────────
/**
 * Describes the visual atmosphere for a single era.
 * All fields are interpolated linearly between eras during transitions.
 */
export interface EraAtmosphere {
  /** Sun direction (normalized). The renderer will orient a directional light. */
  sunDirection: [number, number, number];
  /** Sun color in hex. */
  sunColor: number;
  /** Sun intensity multiplier. */
  sunIntensity: number;
  /** Hemisphere sky color (top). */
  hemiSkyColor: number;
  /** Hemisphere ground color (bottom). */
  hemiGroundColor: number;
  /** Hemisphere intensity. */
  hemiIntensity: number;
  /** Fog color in hex. */
  fogColor: number;
  /** Fog density (0 = no fog, higher = denser). */
  fogDensity: number;
  /** Sky dome gradient top color in hex. */
  skyTopColor: number;
  /** Sky dome gradient bottom color in hex. */
  skyBottomColor: number;
  /** Ambient color in hex (fallback fill). */
  ambientColor: number;
  /** Ambient intensity. */
  ambientIntensity: number;
}

/** Default modern-era atmosphere. */
export const DEFAULT_ATMOSPHERE: EraAtmosphere = {
  sunDirection: [0.5, 0.8, 0.3],
  sunColor: 0xfff4e0,
  sunIntensity: 2.0,
  hemiSkyColor: 0x87ceeb,
  hemiGroundColor: 0x3a7d3a,
  hemiIntensity: 0.6,
  fogColor: 0xb0c4de,
  fogDensity: 0.008,
  skyTopColor: 0x1a3a6a,
  skyBottomColor: 0xc8ddf0,
  ambientColor: 0x404060,
  ambientIntensity: 0.3,
};

/** Early-era (e.g. 1940s) atmosphere — hazier, warmer. */
export const EARLY_ATMOSPHERE: EraAtmosphere = {
  sunDirection: [0.3, 0.5, 0.7],
  sunColor: 0xffcc88,
  sunIntensity: 1.2,
  hemiSkyColor: 0xd4a574,
  hemiGroundColor: 0x5a4a3a,
  hemiIntensity: 0.4,
  fogColor: 0xa09070,
  fogDensity: 0.015,
  skyTopColor: 0x4a3a2a,
  skyBottomColor: 0xc8b090,
  ambientColor: 0x302820,
  ambientIntensity: 0.2,
};

/** Helper: lerp two hex colors and return new hex. */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * SkyRig — manages the sky dome, sun, hemisphere light, fog,
 * and ambient light. Driven by EraAtmosphere parameters.
 *
 * Supports smooth interpolation between two era atmospheres
 * over a parametric t ∈ [0, 1] without shader reload.
 */
export class SkyRig {
  private _scene: THREE.Scene;

  // Light objects
  private _sunLight: THREE.DirectionalLight;
  private _hemiLight: THREE.HemisphereLight;
  private _ambientLight: THREE.AmbientLight;

  // Sky dome
  private _skyDome: THREE.Mesh;

  // Two era atmospheres
  private _atmA: EraAtmosphere;
  private _atmB: EraAtmosphere;
  private _t = 1; // current blend factor (0 = A, 1 = B)

  constructor(scene: THREE.Scene, atmA: EraAtmosphere = DEFAULT_ATMOSPHERE, atmB: EraAtmosphere = EARLY_ATMOSPHERE) {
    this._scene = scene;
    this._atmA = atmA;
    this._atmB = atmB;

    // ── Directional sun light ───────────────────────────────────
    this._sunLight = new THREE.DirectionalLight(0xffffff, 2);
    this._sunLight.castShadow = true;
    this._sunLight.shadow.mapSize.set(2048, 2048);
    this._sunLight.shadow.camera.left = -30;
    this._sunLight.shadow.camera.right = 30;
    this._sunLight.shadow.camera.top = 30;
    this._sunLight.shadow.camera.bottom = -30;
    this._sunLight.shadow.camera.near = 0.5;
    this._sunLight.shadow.camera.far = 100;
    this._sunLight.shadow.bias = -0.001;
    scene.add(this._sunLight);

    // ── Hemisphere light ────────────────────────────────────────
    this._hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
    scene.add(this._hemiLight);

    // ── Ambient light ───────────────────────────────────────────
    this._ambientLight = new THREE.AmbientLight(0x404060, 0.3);
    scene.add(this._ambientLight);

    // ── Sky dome (custom shader material) ───────────────────────
    this._skyDome = this._createSkyDome();
    scene.add(this._skyDome);

    // ── Fog ─────────────────────────────────────────────────────
    this.applyAtmosphere(1); // start with ATM_B
  }

  /** Set the blend factor and apply all interpolations immediately. */
  setTransition(t: number): void {
    this._t = Math.max(0, Math.min(1, t));
    this.applyAtmosphere(this._t);
  }

  /** Get current blend factor. */
  get transition(): number {
    return this._t;
  }

  /** Apply interpolated atmosphere based on current t. */
  applyAtmosphere(t: number): void {
    const a = this._atmA;
    const b = this._atmB;

    // Lerp values
    const sunDir = this._lerpVec3(a.sunDirection, b.sunDirection, t);
    const sunColor = lerpColor(a.sunColor, b.sunColor, t);
    const sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
    const hemiSky = lerpColor(a.hemiSkyColor, b.hemiSkyColor, t);
    const hemiGround = lerpColor(a.hemiGroundColor, b.hemiGroundColor, t);
    const hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t;
    const fogColor = lerpColor(a.fogColor, b.fogColor, t);
    const fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * t;
    const skyTop = lerpColor(a.skyTopColor, b.skyTopColor, t);
    const skyBottom = lerpColor(a.skyBottomColor, b.skyBottomColor, t);
    const ambientColor = lerpColor(a.ambientColor, b.ambientColor, t);
    const ambientIntensity = a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * t;

    // ── Update lights ───────────────────────────────────────────
    this._sunLight.color.setHex(sunColor);
    this._sunLight.intensity = sunIntensity;
    this._sunLight.position.setFromSpherical(
      new THREE.Spherical(1, Math.acos(sunDir[1]), Math.atan2(sunDir[0], sunDir[2])),
    );

    this._hemiLight.color.setHex(hemiSky);
    this._hemiLight.groundColor.setHex(hemiGround);
    this._hemiLight.intensity = hemiIntensity;

    this._ambientLight.color.setHex(ambientColor);
    this._ambientLight.intensity = ambientIntensity;

    // ── Fog ─────────────────────────────────────────────────────
    this._scene.fog = new THREE.FogExp2(fogColor, fogDensity);

    // ── Sky dome shader uniforms ────────────────────────────────
    if (this._skyDome.material instanceof THREE.ShaderMaterial) {
      this._skyDome.material.uniforms.topColor.value.setHex(skyTop);
      this._skyDome.material.uniforms.bottomColor.value.setHex(skyBottom);
      this._skyDome.material.uniforms.offset.value = 20;
      this._skyDome.material.uniforms.exponent.value = 0.5;
    }
  }

  private _lerpVec3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  /** Create the sky dome mesh with a custom gradient shader. */
  private _createSkyDome(): THREE.Mesh {
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `;

    const uniforms = {
      topColor: { value: new THREE.Color(DEFAULT_ATMOSPHERE.skyTopColor) },
      bottomColor: { value: new THREE.Color(DEFAULT_ATMOSPHERE.skyBottomColor) },
      offset: { value: 20 },
      exponent: { value: 0.5 },
    };

    const skyGeo = new THREE.SphereGeometry(500, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(skyGeo, skyMat);
    mesh.name = 'sky_dome';
    return mesh;
  }

  /** Dispose all resources. */
  dispose(): void {
    this._scene.remove(this._skyDome);
    this._skyDome.geometry.dispose();
    if (this._skyDome.material instanceof THREE.ShaderMaterial) {
      this._skyDome.material.dispose();
    }
    this._scene.remove(this._sunLight);
    this._sunLight.dispose();
    this._scene.remove(this._hemiLight);
    this._hemiLight.dispose();
    this._scene.remove(this._ambientLight);
    this._ambientLight.dispose();
  }
}
