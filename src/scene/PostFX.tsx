import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Vector2 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { useSceneState } from './scene-state';

/**
 * Post-processing chain using three.js's native EffectComposer.
 *
 * Bloom (UnrealBloomPass) is the hero effect for emissive window grids,
 * headlights, and neon signage. Its strength/radius/threshold are driven from
 * the shared scene state every frame for seamless era grading. A vignette pass
 * frames the view, and OutputPass applies ACES tone mapping + color space.
 *
 * Uses `useFrame` priority 1 to take over rendering from R3F so the composer
 * controls the full render pipeline. All priority-0 callbacks (lighting,
 * materials, transforms) still run first every frame.
 */
export function PostFX() {
  const state = useSceneState();
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);

  // Create the composer once when gl/scene/camera are available.
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;

    const composer = new EffectComposer(gl);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
      new Vector2(size.width, size.height),
      state.bloomStrength,
      state.bloomRadius,
      state.bloomThreshold,
    );
    composer.addPass(bloom);

    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset.value = 1.0;
    vignette.uniforms.darkness.value = 1.15;
    composer.addPass(vignette);

    composer.addPass(new OutputPass());

    composerRef.current = composer;
    bloomRef.current = bloom;

    return () => {
      composer.dispose();
      composerRef.current = null;
      bloomRef.current = null;
    };
    // gl/scene/camera are stable R3F references — effect runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  // Handle resize.
  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height);
  }, [size]);

  // Priority 1: take over rendering. All priority-0 useFrame callbacks
  // (TransitionController, Atmosphere, Buildings, etc.) run first, mutating
  // transforms/materials. Then we render through the composer.
  useFrame(() => {
    const b = bloomRef.current;
    if (b) {
      b.strength = state.bloomStrength;
      b.radius = state.bloomRadius;
      b.threshold = state.bloomThreshold;
    }
    gl.toneMappingExposure = state.exposure;
    composerRef.current?.render();
  }, 1);

  return null;
}
