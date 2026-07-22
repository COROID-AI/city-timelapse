// ============================================================
//  POST-PROCESSING — bloom, vignette, era-aware color grade
//  Gives Chronopolis its cinematic, high-end glow.
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ---- Vignette + grade shader ----
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 1.0 },     // 0 = none, 1 = full
    uVignetteSoft: { value: 0.45 }, // softness
    uSaturation: { value: 1.0 },
    uContrast: { value: 1.0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintMix: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uVignetteSoft;
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec3 uTint;
    uniform float uTintMix;
    varying vec2 vUv;
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      // saturation
      float luma = dot(col.rgb, vec3(0.299,0.587,0.114));
      col.rgb = mix(vec3(luma), col.rgb, uSaturation);
      // contrast around 0.5
      col.rgb = (col.rgb - 0.5) * uContrast + 0.5;
      // tint
      col.rgb = mix(col.rgb, col.rgb * uTint, uTintMix);
      // vignette
      vec2 d = vUv - 0.5;
      float vig = smoothstep(0.8, uVignetteSoft, length(d));
      col.rgb *= mix(1.0, vig, uVignette);
      gl_FragColor = col;
    }
  `,
};

// Era-specific grade presets
const ERA_GRADES = {
  1945: { saturation: 0.82, contrast: 1.06, tint: new THREE.Color(1.06, 0.96, 0.78), tintMix: 0.22, vignette: 0.75 },
  1965: { saturation: 1.05, contrast: 1.04, tint: new THREE.Color(1.02, 0.98, 0.92), tintMix: 0.12, vignette: 0.55 },
  1985: { saturation: 1.18, contrast: 1.12, tint: new THREE.Color(1.05, 0.82, 1.08), tintMix: 0.28, vignette: 0.7 },
  2005: { saturation: 1.02, contrast: 1.05, tint: new THREE.Color(0.92, 0.98, 1.06), tintMix: 0.15, vignette: 0.5 },
  2025: { saturation: 1.08, contrast: 1.06, tint: new THREE.Color(0.88, 0.98, 1.1), tintMix: 0.18, vignette: 0.55 },
  2055: { saturation: 1.15, contrast: 1.08, tint: new THREE.Color(0.85, 1.05, 0.98), tintMix: 0.2, vignette: 0.5 },
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom — era + night aware
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.5, 0.85);
    this.composer.addPass(this.bloom);

    // Vignette + color grade
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    // Output (tone mapping + color space)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this._target = { strength: 0.6, threshold: 0.85, radius: 0.5, ...ERA_GRADES[2025] };
    this.reducedMotion = false;
  }

  setReducedMotion(v) { this.reducedMotion = v; }

  setEra(eraId, isNight) {
    const g = ERA_GRADES[eraId] || ERA_GRADES[2025];
    this._target = {
      // Bloom strength by era — neon decade & night get the most glow
      strength: isNight ? 1.1 : (eraId === 1985 ? 0.95 : eraId >= 2055 ? 0.7 : 0.5),
      threshold: isNight ? 0.55 : (eraId === 1985 ? 0.6 : 0.82),
      radius: isNight ? 0.7 : (eraId === 1985 ? 0.75 : 0.45),
      ...g,
    };
    if (isNight) {
      this._target.vignette = Math.min(1.0, g.vignette + 0.15);
    }
  }

  update(dt) {
    const t = this._target;
    if (!t) return;
    const L = this.reducedMotion ? 1000 : 2.5;
    this.bloom.strength = _damp(this.bloom.strength, t.strength, L, dt);
    this.bloom.threshold = _damp(this.bloom.threshold, t.threshold, L, dt);
    this.bloom.radius = _damp(this.bloom.radius, t.radius, L, dt);

    const u = this.gradePass.uniforms;
    u.uSaturation.value = _damp(u.uSaturation.value, t.saturation, L, dt);
    u.uContrast.value = _damp(u.uContrast.value, t.contrast, L, dt);
    u.uVignette.value = _damp(u.uVignette.value, t.vignette, L, dt);
    _dampColor(u.uTint.value, t.tint, L, dt);
    u.uTintMix.value = _damp(u.uTintMix.value, t.tintMix, L, dt);
  }

  render() {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  setEnabled(on) {
    this.enabled = on;
  }
}

// local dampers (avoid circular dep with util)
function _damp(cur, target, lambda, dt) {
  return THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-lambda * dt));
}
function _dampColor(c, target, lambda, dt) {
  const k = 1 - Math.exp(-lambda * dt);
  c.r = THREE.MathUtils.lerp(c.r, target.r, k);
  c.g = THREE.MathUtils.lerp(c.g, target.g, k);
  c.b = THREE.MathUtils.lerp(c.b, target.b, k);
}
