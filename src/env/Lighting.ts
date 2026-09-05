/**
 * src/env/Lighting.ts — era-aware lighting presets.
 *
 * Reads the era from EraState and applies period-appropriate lighting via the
 * shared morph timeline: sun/directional color, ambient/hemisphere tint, fog
 * color/density, and procedural exposure (sun glow, sodium cast, white LED).
 * No camera access; pure lights + fog on the scene, all driven by the morph
 * engine's lerped uniforms.
 */

import * as THREE from 'three';

import type { MorphEngine } from '../core/MorphEngine';
import { LIGHTING_ERA_PRESETS, type EraId, type LightingEraPreset } from '../eras';
import { EraState } from '../state/EraState';

export class Lighting {
  private readonly sun: THREE.DirectionalLight;
  private readonly ambient: THREE.HemisphereLight;
  private readonly fog: THREE.Fog;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly unsubscribe: () => void;

  constructor(scene: THREE.Scene, eraState: EraState, morphEngine: MorphEngine) {
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(30, 40, 20);
    this.sun.castShadow = false;
    scene.add(this.sun);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    scene.add(this.ambient);

    this.fog = new THREE.Fog(0x000000, 25, 120);
    scene.fog = this.fog;

    this.uniforms = {
      sunColor: { value: new THREE.Color('#ffffff') },
      sunIntensity: { value: this.sun.intensity },
      ambientColor: { value: new THREE.Color('#ffffff') },
      ambientIntensity: { value: this.ambient.intensity },
      fogColor: { value: this.fog.color.clone() },
      fogDensity: { value: 0.01 },
      exposure: { value: 1 },
    };

    // Per-era readers resolve each preset from the declarative registry in
    // src/eras.ts — no era-specific logic is hardcoded in imperative code here.
    const presetReader = (id: EraId): LightingEraPreset => LIGHTING_ERA_PRESETS[id];

    morphEngine.bindColorUniform(
      this.uniforms,
      'sunColor',
      (s) => new THREE.Color(presetReader(s.id).sunColor),
      (s) => new THREE.Color(presetReader(s.id).sunColor),
    );
    morphEngine.bindNumericUniform(
      this.uniforms,
      'sunIntensity',
      (s) => presetReader(s.id).sunIntensity,
      (s) => presetReader(s.id).sunIntensity,
    );
    morphEngine.bindColorUniform(
      this.uniforms,
      'ambientColor',
      (s) => new THREE.Color(presetReader(s.id).ambientColor),
      (s) => new THREE.Color(presetReader(s.id).ambientColor),
    );
    morphEngine.bindNumericUniform(
      this.uniforms,
      'ambientIntensity',
      (s) => presetReader(s.id).ambientIntensity,
      (s) => presetReader(s.id).ambientIntensity,
    );
    morphEngine.bindColorUniform(
      this.uniforms,
      'fogColor',
      (s) => new THREE.Color(presetReader(s.id).fogColor),
      (s) => new THREE.Color(presetReader(s.id).fogColor),
    );
    morphEngine.bindNumericUniform(
      this.uniforms,
      'fogDensity',
      (s) => presetReader(s.id).fogDensity,
      (s) => presetReader(s.id).fogDensity,
    );
    morphEngine.bindNumericUniform(
      this.uniforms,
      'exposure',
      (s) => presetReader(s.id).exposure,
      (s) => presetReader(s.id).exposure,
    );

    // Snap immediately on era change; the morph engine continues the lerp.
    this.unsubscribe = eraState.subscribe((id) => {
      this.applyPreset(LIGHTING_ERA_PRESETS[id]);
    });
  }

  private applyPreset(preset: LightingEraPreset): void {
    this.sun.color.set(preset.sunColor);
    this.sun.intensity = preset.sunIntensity;
    this.ambient.color.set(preset.ambientColor);
    this.ambient.intensity = preset.ambientIntensity;
  }

  /** Copy the lerped uniforms into the live lights/fog. Call every frame. */
  update(): void {
    this.sun.color.copy(this.uniforms.sunColor.value as THREE.Color);
    this.sun.intensity = this.uniforms.sunIntensity.value as number;
    this.ambient.color.copy(this.uniforms.ambientColor.value as THREE.Color);
    this.ambient.intensity = this.uniforms.ambientIntensity.value as number;
    const fogDensity = this.uniforms.fogDensity.value as number;
    this.fog.color.copy(this.uniforms.fogColor.value as THREE.Color);
    this.fog.far = 25 + fogDensity * 120;
  }

  dispose(): void {
    this.unsubscribe();
  }
}