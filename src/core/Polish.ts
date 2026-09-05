/**
 * src/core/Polish.ts — cinematic visual polish layer (skybox, post-processing,
 * AO feel, smooth visibility ramping).
 *
 * Everything here is scheduled through the SAME shared foundation morph timeline
 * that the rest of the scene swaps on (MorphEngine.bindColorUniform /
 * bindNumericUniform / onTimeline), so no polish value pops at an era change:
 *  - a procedural gradient skybox whose era color grade (1945 sepia, 1965
 *    warm, 1985 smoggy, 2005 clear, 2025 clean modern) lerps over the morph;
 *  - a post-processing chain: tone mapping always on, subtle bloom during neon
 *    eras (1965/1985/2025), film grain in 1945, and a subtle vignette;
 *  - a soft ambient-occlusion feel hemisphere light (ground bounce);
 *  - smooth visibility ramping: the building module rebuilds its construction
 *    details on era change, so Polish captures the leaving era's detail meshes
 *    as an independently-faded "veil" (cloned meshes + materials), fades them
 *    out over the first half of the morph, and fades the arriving era's live
 *    detail meshes in over the second half — nothing pops in or out.
 *
 * Polish must be constructed BEFORE SceneShell so its era subscription runs
 * first on an era change: it captures the old detail veil while those meshes
 * are still live, before the building module rebuilds (and disposes) them.
 *
 * Contract: { group, update(dt), render(), setSize(w,h), dispose() } — the
 * composition root (src/main.ts) owns the render loop; Polish never starts one.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import type { MorphEngine } from './MorphEngine';
import type { EraState } from '../state/EraState';
import type { EraId } from '../eras';

// ---------------------------------------------------------------------------
// Era polish presets
// ---------------------------------------------------------------------------

export interface PolishEraPreset {
  /** Zenith gradient color of the era skybox. */
  skyTop: string;
  /** Horizon gradient color of the era skybox. */
  skyHorizon: string;
  /** Below-horizon gradient color (ground haze of the sky). */
  skyBottom: string;
  /** 0..1 UnrealBloom strength; neon eras glow subtly. */
  bloomStrength: number;
  /** 0..1 film grain intensity; only 1945 has grain. */
  grainIntensity: number;
  /** Ground-bounce hemisphere tint for the soft AO feel. */
  hemiGround: string;
}

/** Distinct period-appropriate polish presets. Owned by Polish. */
export const POLISH_ERA_PRESETS: Record<EraId, PolishEraPreset> = {
  '1945': {
    skyTop: '#2c2113',
    skyHorizon: '#b08d5e',
    skyBottom: '#d8c39a',
    bloomStrength: 0,
    grainIntensity: 0.38,
    hemiGround: '#4a3725',
  },
  '1965': {
    skyTop: '#24344e',
    skyHorizon: '#e3c98f',
    skyBottom: '#f3e3c0',
    bloomStrength: 0.35,
    grainIntensity: 0,
    hemiGround: '#6a5a42',
  },
  '1985': {
    skyTop: '#27282f',
    skyHorizon: '#9c9aa8',
    skyBottom: '#b7b3be',
    bloomStrength: 0.8,
    grainIntensity: 0,
    hemiGround: '#3b3f4a',
  },
  '2005': {
    skyTop: '#16293d',
    skyHorizon: '#c9d9e8',
    skyBottom: '#e6eef5',
    bloomStrength: 0,
    grainIntensity: 0,
    hemiGround: '#46586a',
  },
  '2025': {
    skyTop: '#0c1824',
    skyHorizon: '#8fd0e8',
    skyBottom: '#cfeef7',
    bloomStrength: 0.45,
    grainIntensity: 0,
    hemiGround: '#3d5a68',
  },
};

// ---------------------------------------------------------------------------
// Vignette shader (subtle, always on)
// ---------------------------------------------------------------------------

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.32 },
    radius: { value: 0.72 },
    softness: { value: 0.45 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float radius;
    uniform float softness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      float vig = 1.0 - strength * smoothstep(radius - softness, radius + softness, d);
      gl_FragColor = vec4(texel.rgb * vig, texel.a);
    }
  `,
};

// ---------------------------------------------------------------------------
// Detail veil helpers — fades the "leaving era's" building details out
// ---------------------------------------------------------------------------

interface VeilEntry {
  root: THREE.Object3D;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
}

/** Fade profile for the veil: gone by ~60% of the morph. */
function veilFadeOut(progress: number): number {
  return 1 - Math.min(1, progress / 0.6);
}

/** Fade-in profile for arriving details: starts crawling in after 50%. */
function arriveFadeIn(progress: number): number {
  if (progress <= 0.5) {
    return 0;
  }
  return (progress - 0.5) / 0.5;
}

export class Polish {
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;
  private readonly morphEngine: MorphEngine;
  private readonly composer: EffectComposer;
  private readonly skybox: THREE.Mesh;
  private readonly skyMaterial: THREE.ShaderMaterial;
  private readonly aoLight: THREE.HemisphereLight;
  private readonly bloom: UnrealBloomPass;
  private readonly film: FilmPass;
  private readonly vignette: ShaderPass;
  private readonly output: OutputPass;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly unsubscribe: () => void;
  private readonly timelineOff: () => void;
  private readonly veilGroup = new THREE.Group();
  private readonly veilEntries: VeilEntry[] = [];
  private readonly liveFadeTargets: THREE.Mesh[] = [];
  private veilAlpha = 0;
  private rampActive = false;
  private liveFadeReady = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    eraState: EraState,
    morphEngine: MorphEngine,
  ) {
    this.scene = scene;
    this.morphEngine = morphEngine;
    this.group.name = 'Polish';

    // --- Procedural gradient skybox ---------------------------------------
    const first = POLISH_ERA_PRESETS[eraState.era];
    this.uniforms = {
      skyTop: { value: new THREE.Color(first.skyTop) },
      skyHorizon: { value: new THREE.Color(first.skyHorizon) },
      skyBottom: { value: new THREE.Color(first.skyBottom) },
      bloomStrength: { value: first.bloomStrength },
      grainIntensity: { value: first.grainIntensity },
      hemiGround: { value: new THREE.Color(first.hemiGround) },
    };

    this.skyMaterial = new THREE.ShaderMaterial({
      name: 'polish-skybox',
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 skyTop;
        uniform vec3 skyHorizon;
        uniform vec3 skyBottom;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = dir.y;
          vec3 col = h >= 0.0
            ? mix(skyHorizon, skyTop, smoothstep(0.0, 0.45, h))
            : mix(skyHorizon, skyBottom, smoothstep(0.0, -0.3, -h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.skybox = new THREE.Mesh(
      new THREE.SphereGeometry(160, 32, 16),
      this.skyMaterial,
    );
    this.skybox.name = 'polish-skybox';
    this.skybox.renderOrder = -10;
    this.group.add(this.skybox);

    // --- Soft AO-feel hemisphere (ground bounce) ---------------------------
    this.aoLight = new THREE.HemisphereLight(0xffffff, first.hemiGround, 0.32);
    this.aoLight.name = 'polish-ao-hemisphere';
    scene.add(this.aoLight);

    // --- Post-processing ----------------------------------------------------
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      first.bloomStrength,
      0.55,
      0.78,
    );
    this.film = new FilmPass(first.grainIntensity, false);
    this.vignette = new ShaderPass(VIGNETTE_SHADER);
    this.output = new OutputPass();
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.film);
    this.composer.addPass(this.vignette);
    this.composer.addPass(this.output);

    // --- Morph-timeline scheduling ----------------------------------------
    this.bindPolishUniformsToTimeline();

    this.timelineOff = morphEngine.onTimeline((state) => {
      this.tickTimeline(state);
    });

    // Any era change starts the detail ramp. Polish subscribes BEFORE the
    // building module's rebuild listener (constructed first in main.ts), so the
    // leaving era's detail meshes are still live when we capture the veil.
    this.unsubscribe = eraState.subscribe(() => {
      this.captureVeil();
      this.rampActive = true;
      this.veilAlpha = 1;
    });
  }

  /** Advance per-frame Polish logic (uniform copies into live objects). */
  update(_dt: number): void {
    this.bloom.strength = this.uniforms.bloomStrength.value as number;
    (this.film.uniforms as { intensity: { value: number } }).intensity.value =
      this.uniforms.grainIntensity.value as number;
    this.aoLight.groundColor.copy(this.uniforms.hemiGround.value as THREE.Color);
    // If a transition is mid-flight, keep the live arriving details fading in
    // from their current opacity (the timeline callback drives the value).
    // No-op in steady state (rampActive false).
  }

  /** Render the full post-processing chain (replaces renderer.render). */
  render(): void {
    this.composer.render();
  }

  /** Resize the composer with the renderer. */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  dispose(): void {
    this.unsubscribe();
    this.timelineOff();
    this.disposeVeil();
    this.skyMaterial.dispose();
    this.skybox.geometry.dispose();
    if (this.aoLight.parent) {
      this.aoLight.parent.remove(this.aoLight);
    }
    this.aoLight.dispose();
    this.bloom.dispose();
    this.film.dispose();
    this.vignette.dispose();
    this.output.dispose();
    this.composer.dispose();
    this.group.clear();
  }

  // --- Foundation-morph uniform bindings -----------------------------------

  private bindPolishUniformsToTimeline(): void {
    const reader = (id: EraId): PolishEraPreset => POLISH_ERA_PRESETS[id];
    const skyColorReader = (id: EraId, key: keyof PolishEraPreset): THREE.Color =>
      new THREE.Color(reader(id)[key] as string);

    this.morphEngine.bindColorUniform(
      this.uniforms,
      'skyTop',
      (s) => skyColorReader(s.id, 'skyTop'),
      (s) => skyColorReader(s.id, 'skyTop'),
    );
    this.morphEngine.bindColorUniform(
      this.uniforms,
      'skyHorizon',
      (s) => skyColorReader(s.id, 'skyHorizon'),
      (s) => skyColorReader(s.id, 'skyHorizon'),
    );
    this.morphEngine.bindColorUniform(
      this.uniforms,
      'skyBottom',
      (s) => skyColorReader(s.id, 'skyBottom'),
      (s) => skyColorReader(s.id, 'skyBottom'),
    );
    this.morphEngine.bindColorUniform(
      this.uniforms,
      'hemiGround',
      (s) => skyColorReader(s.id, 'hemiGround'),
      (s) => skyColorReader(s.id, 'hemiGround'),
    );
    this.morphEngine.bindNumericUniform(
      this.uniforms,
      'bloomStrength',
      (s) => reader(s.id).bloomStrength,
      (s) => reader(s.id).bloomStrength,
    );
    this.morphEngine.bindNumericUniform(
      this.uniforms,
      'grainIntensity',
      (s) => reader(s.id).grainIntensity,
      (s) => reader(s.id).grainIntensity,
    );
  }

  // --- Detail veil ----------------------------------------------------------

  private captureVeil(): void {
    this.disposeVeil();
    const found: THREE.Group[] = [];
    this.scene.traverse((obj) => {
      if (obj.name.startsWith('detail-') && obj instanceof THREE.Group) {
        found.push(obj);
      }
    });
    for (const source of found) {
      // Capture the world transform of the WHOLE detail group (it includes the
      // anchor group's current morph-pose position). Bake it onto the clone ROOT
      // only; children keep their local transforms relative to the root, so the
      // composition reproduces exactly where the old detail was.
      source.updateWorldMatrix(true, true);
      const world = source.matrixWorld.clone();
      const clone = source.clone(true);
      clone.matrix.copy(world);
      clone.matrixAutoUpdate = false;

      const materials: THREE.Material[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          // The building module disposes the leaving era's original geometry
          // the moment its era listener runs (right after ours), so the veil
          // must own copies of the geometry to stay independent for the fade.
          const geoCopy = obj.geometry.clone();
          geometries.push(geoCopy);
          obj.geometry = geoCopy;

          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          const cloned = mats.map((mat) => {
            const copy = mat.clone();
            copy.transparent = true;
            copy.opacity = (mat as THREE.Material).opacity ?? 1;
            return copy;
          });
          obj.material = cloned.length === 1 ? cloned[0] : cloned;
          materials.push(...cloned);
        }
      });
      this.veilGroup.add(clone);
      this.veilEntries.push({ root: clone, materials, geometries });
    }
    if (this.veilEntries.length > 0) {
      this.scene.add(this.veilGroup);
      // Make sure the frozen root world lands before this frame renders.
      this.veilGroup.updateMatrixWorld(true);
    }
    this.veilAlpha = 1;
    this.applyVeilAlpha();
  }

  private applyVeilAlpha(): void {
    for (const entry of this.veilEntries) {
      for (const mat of entry.materials) {
        mat.opacity = this.veilAlpha;
        mat.needsUpdate = true;
      }
    }
  }

  private disposeVeil(): void {
    for (const entry of this.veilEntries) {
      for (const mat of entry.materials) {
        mat.dispose();
      }
      for (const geo of entry.geometries) {
        geo.dispose();
      }
    }
    if (this.veilGroup.parent) {
      this.veilGroup.parent.remove(this.veilGroup);
    }
    this.veilEntries.length = 0;
    this.veilGroup.clear();
  }

  // --- Live (arriving) detail fade-in --------------------------------------

  private captureLiveDetailTargets(): void {
    this.liveFadeTargets.length = 0;
    this.scene.traverse((obj) => {
      if (obj === this.veilGroup) {
        return;
      }
      if (obj.name.startsWith('detail-')) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const mat of mats) {
              mat.transparent = true;
              mat.opacity = 0;
              mat.needsUpdate = true;
            }
            this.liveFadeTargets.push(child);
          }
        });
      }
    });
  }

  private applyLiveFadeIn(opacity: number): void {
    for (const mesh of this.liveFadeTargets) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        mat.opacity = opacity;
        mat.needsUpdate = true;
      }
    }
  }

  // --- Timeline worker -------------------------------------------------------

  private tickTimeline(state: { progress: number; active: boolean }): void {
    if (!this.rampActive) {
      return;
    }
    const progress = state.progress;

    // Fade the leaving era's captured details out over the first half.
    this.veilAlpha = veilFadeOut(progress);
    this.applyVeilAlpha();

    // Capture the arriving era's live detail meshes on the first timeline tick
    // (the building module has already rebuilt them), then fade them in.
    if (!this.liveFadeReady) {
      this.captureLiveDetailTargets();
      this.liveFadeReady = true;
    } else {
      this.applyLiveFadeIn(arriveFadeIn(progress));
    }

    if (progress >= 1) {
      this.finishRamp();
    }
  }

  private finishRamp(): void {
    this.applyLiveFadeIn(1);
    this.liveFadeReady = false;
    this.liveFadeTargets.length = 0;
    this.disposeVeil();
    this.rampActive = false;
  }
}