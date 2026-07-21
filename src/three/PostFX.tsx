import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  EffectComposer as PostEffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  BlendFunction,
} from 'postprocessing';
import { useSceneStore } from '../store/useSceneStore';
import { sampleSky } from '../engine/sceneSampler';

// ---------------------------------------------------------------------------
// Postprocessing — adaptive bloom (stronger at night / neon eras) and a
// vignette. Uses the `postprocessing` library directly via useThree/useFrame
// rather than the @react-three/postprocessing React wrapper, which has an
// internal scene-graph serialization incompatibility with R3F v9.
//
// Bloom intensity is driven by eraFloat so the look morphs smoothly across
// transitions (stronger glow for neon/hologram eras).
// ---------------------------------------------------------------------------

export function PostFX() {
  const { gl, scene, camera, size } = useThree();

  // Create the composer + effects once. These are plain postprocessing objects,
  // not R3F-managed, so no React reconciliation or serialization occurs.
  const composerRef = useRef<PostEffectComposer | null>(null);
  const bloomRef = useRef<BloomEffect | null>(null);

  const objs = useMemo(() => {
    const composer = new PostEffectComposer(gl, {
      multisampling: 0,
      frameBufferType: THREE.HalfFloatType,
    });

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloom = new BloomEffect({
      intensity: 0.5,
      luminanceThreshold: 0.4,
      luminanceSmoothing: 0.4,
      mipmapBlur: true,
    });

    const vignette = new VignetteEffect({
      offset: 0.25,
      darkness: 0.65,
      blendFunction: BlendFunction.NORMAL,
    });

    const effectPass = new EffectPass(camera, bloom, vignette);
    composer.addPass(effectPass);

    return { composer, renderPass, bloom, vignette, effectPass };
  }, [gl, scene, camera]);

  composerRef.current = objs.composer;
  bloomRef.current = objs.bloom;

  // Keep size in sync
  useEffect(() => {
    objs.composer.setSize(size.width, size.height);
  }, [objs.composer, size.width, size.height]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      objs.composer.dispose();
      objs.bloom.dispose();
      objs.vignette.dispose();
      objs.effectPass.dispose();
      objs.renderPass.dispose();
    };
  }, [objs]);

  // Render the composer every frame (replaces the default R3F render).
  // We use render priority 1 so R3F doesn't auto-render, and we call
  // composer.render() ourselves.
  useFrame((_, dt) => {
    const eraFloat = useSceneStore.getState().eraFloat;
    const sky = sampleSky(eraFloat);

    // Adaptive bloom: night/neon eras get stronger bloom
    const nightness = 1 - sky.sunIntensity / 1.7; // 0 (day) → ~0.76 (night)
    if (bloomRef.current) {
      bloomRef.current.intensity = 0.35 + nightness * 1.4;
    }

    composerRef.current?.render(dt);
  }, 1); // priority 1 → takes over rendering

  return null;
}
