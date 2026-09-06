import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { describe, expect, it } from 'vitest';

import { ERA_PRESETS, presetForEra } from '../presets';
import { vignetteGrainShader } from '../shaders/vignetteGrain';

/**
 * Unit tests for the post-processing building blocks: era presets and the
 * vignette/grain shader definition.
 */

describe('era post-processing presets', () => {
  it('defines a preset for every era id', () => {
    expect(Object.keys(ERA_PRESETS).sort()).toEqual(['1945', '1965', '1985', '2005', '2025']);
  });

  it('keeps bloom and grain subtle (per plan Phase 1 guidance)', () => {
    for (const preset of Object.values(ERA_PRESETS)) {
      expect(preset.bloomStrength).toBeLessThan(1.0);
      expect(preset.grain).toBeLessThanOrEqual(0.3);
      expect(preset.vignette).toBeGreaterThanOrEqual(0);
    }
  });

  it('differentiates 1945 (filmic, heavy grain) from 2025 (crisp, minimal grain)', () => {
    const past = ERA_PRESETS['1945'];
    const present = ERA_PRESETS['2025'];
    // Filmic past: stronger, softer bloom (lower threshold) + more grain/vignette.
    expect(past.grain).toBeGreaterThan(present.grain);
    expect(past.vignette).toBeGreaterThan(present.vignette);
    expect(past.bloomThreshold).toBeLessThan(present.bloomThreshold);
  });

  it('falls back to a neutral preset for unknown eras', () => {
    const fallback = presetForEra('1985');
    expect(fallback).toBe(ERA_PRESETS['1985']);
  });
});

describe('vignette/grain shader', () => {
  it('declares the uniforms the composer mutates at runtime', () => {
    expect(vignetteGrainShader.uniforms.tDiffuse).toBeDefined();
    expect(vignetteGrainShader.uniforms.vignette).toBeDefined();
    expect(vignetteGrainShader.uniforms.grain).toBeDefined();
    expect(vignetteGrainShader.uniforms.time).toBeDefined();
  });

  it('ships vertex + fragment GLSL', () => {
    expect(vignetteGrainShader.vertexShader).toContain('vUv');
    expect(vignetteGrainShader.fragmentShader).toContain('tDiffuse');
    expect(vignetteGrainShader.fragmentShader).toContain('vignette');
    expect(vignetteGrainShader.fragmentShader).toContain('grain');
  });

  it('is consumable as a ShaderPass (constructs headless)', () => {
    const pass = new ShaderPass(vignetteGrainShader);
    expect(pass.uniforms.vignette.value).toBe(0.25);
    pass.dispose();
  });
});