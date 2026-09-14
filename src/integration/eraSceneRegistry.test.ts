/**
 * Scene-integration composition tests.
 *
 * Proves, headlessly (stubbed WebGL renderer + Web Audio graph):
 *
 *  1. The EraSceneRegistry composes BlockLayout + buildBuildings +
 *     buildStreetLife + buildStorefronts + buildStreetFurniture into a
 *     complete, ready-to-render era scene graph for each of the five eras,
 *     exposing root/update/dispose per era against the EraTheme contract.
 *  2. The store -> transition -> swap -> audio pipeline works end to end:
 *     EraStore request -> TransitionController morph of the era scene graphs
 *     -> AudioEngine ambience crossfade + transition whoosh (with audio
 *     unlock on the first request), interrupted transitions converge to the
 *     final target, outgoing content is disposed, the stage never grows
 *     beyond the outgoing+incoming pair, and a stubbed
 *     `matchMedia('(prefers-reduced-motion: reduce)')` forces an instant era
 *     swap with no staged morph animation.
 *
 * The real `AudioEngine` runs under a stub AudioContext (mirroring
 * src/audio/audioEngine.test.ts), so the ambience/whoosh wiring is exercised
 * against the actual engine code without an AudioContext in jsdom.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CameraView } from '../core/cameraRig';
import { SceneEngine } from '../core/engine';
import { applyAtmosphere, lightStateEquals, type LightState } from '../core/lighting';
import type { RendererFactoryOptions, SceneRenderer } from '../core/renderer';
import { AudioEngine } from '../audio/audioEngine';
import { EraStore } from '../era/state';
import { ERA_YEARS, type EraId } from '../era/types';
import { TransitionController } from '../transition/transitionController';
import { serializeBuildings, getBuildingsDescriptor } from '../world/buildings/buildBuildings';
import type { StorefrontSceneInfo } from '../world/storefronts/buildStorefronts';
import { createBlockLayout } from '../world/layout';
import * as THREE from 'three';
import {
  createEraSwapWiring,
  EraSceneRegistry,
  type EraScene,
  type EraSwapWiring,
} from './eraSceneRegistry';

// ============================================================================
// Headless renderer stub (real SceneEngine, no GPU)
// ============================================================================

class StubRenderer implements SceneRenderer<string> {
  readonly scene = 'stub-scene';
  lightStates: LightState[] = [];
  renderCount = 0;
  disposed = false;

  resize(): void {}
  applyLighting(state: LightState): void {
    this.lightStates.push(state);
  }
  updateCamera(_view: CameraView): void {}
  render(): void {
    this.renderCount += 1;
  }
  dispose(): void {
    this.disposed = true;
  }
}

// ============================================================================
// Web Audio stub harness (mirrors src/audio/audioEngine.test.ts)
// ============================================================================

class StubAudioParam {
  value = 0;
  setValueAtTime(value: number): void {
    this.value = value;
  }
  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
  cancelScheduledValues(): void {}
}

class StubAudioNode {
  connect(_destination: StubAudioNode): StubAudioNode {
    return _destination;
  }
  disconnect(): void {}
}

class StubGain extends StubAudioNode {
  readonly gain = new StubAudioParam();
}

class StubOscillator extends StubAudioNode {
  type: OscillatorType = 'sine';
  readonly frequency = new StubAudioParam();
  onended: (() => void) | null = null;
  start(): void {}
  stop(): void {}
}

class StubBiquadFilter extends StubAudioNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new StubAudioParam();
  readonly Q = new StubAudioParam();
}

class StubBufferSource extends StubAudioNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  start(): void {}
  stop(): void {}
}

class StubAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  private readonly _channels: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._channels = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this._channels[channel]!;
  }
}

class StubAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'suspended';
  readonly destination = new StubGain();
  createdGains = 0;

  createGain(): GainNode {
    this.createdGains += 1;
    return new StubGain() as unknown as GainNode;
  }
  createOscillator(): OscillatorNode {
    return new StubOscillator() as unknown as OscillatorNode;
  }
  createBiquadFilter(): BiquadFilterNode {
    return new StubBiquadFilter() as unknown as BiquadFilterNode;
  }
  createBufferSource(): AudioBufferSourceNode {
    return new StubBufferSource() as unknown as AudioBufferSourceNode;
  }
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return new StubAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }
  async resume(): Promise<void> {
    this.state = 'running';
  }
  async suspend(): Promise<void> {
    this.state = 'suspended';
  }
  async close(): Promise<void> {
    this.state = 'closed';
  }
}

// ============================================================================
// Harness
// ============================================================================

interface WiringHarness {
  store: EraStore;
  engine: SceneEngine<string>;
  renderer: StubRenderer;
  controller: TransitionController;
  registry: EraSceneRegistry;
  stage: THREE.Group;
  audio: AudioEngine;
  stubCtx: StubAudioContext;
  wiring: EraSwapWiring;
  completed: EraId[];
  dispose(): void;
}

function runSeconds(engine: SceneEngine<string>, seconds: number, stepSeconds = 1 / 60): void {
  const frames = Math.max(1, Math.ceil(seconds / stepSeconds));
  for (let i = 0; i < frames; i += 1) {
    engine.step(stepSeconds);
  }
}

function makeWiring(
  controllerOptions: ConstructorParameters<typeof TransitionController>[0] = { duration: 1.2, reducedMotion: false },
  seed = 42,
): WiringHarness {
  const store = new EraStore();
  const renderer = new StubRenderer();
  const engine = new SceneEngine<string>({
    container: document.createElement('div'),
    factory: (_options: RendererFactoryOptions) => renderer,
    width: 320,
    height: 240,
  });
  const controller = new TransitionController(controllerOptions);
  const registry = new EraSceneRegistry({ seed });
  const stage = new THREE.Group();
  const stubCtx = new StubAudioContext();
  const audio = new AudioEngine({
    audioContextFactory: () => stubCtx as unknown as AudioContext,
    initialMasterVolume: 0.8,
    defaultCrossfadeDuration: 1.2,
    autoUnlock: false,
  });
  const completed: EraId[] = [];
  controller.onComplete((era) => completed.push(era));
  const wiring = createEraSwapWiring({
    store,
    registry,
    controller,
    engine,
    stage,
    audio,
    morphDuration: 1.2,
  });
  return {
    store,
    engine,
    renderer,
    controller,
    registry,
    stage,
    audio,
    stubCtx,
    wiring,
    completed,
    dispose: () => {
      wiring.dispose();
      engine.dispose();
      audio.dispose();
    },
  };
}

function countMeshes(group: THREE.Group): number {
  let count = 0;
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      count += 1;
    }
  });
  return count;
}

function stageRoots(stage: THREE.Group): unknown[] {
  return stage.children as unknown[];
}

function sceneStorefrontEra(scene: EraScene): EraId | undefined {
  const info = scene.storefronts.userData as unknown as { era?: EraId } | undefined;
  return info?.era;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// 1. Registry composition
// ============================================================================

describe('EraSceneRegistry composition', () => {
  it('composes layout + the four builders into a complete scene graph for all five eras', () => {
    const registry = new EraSceneRegistry({ seed: 42 });
    expect(registry.eras).toEqual([1945, 1965, 1985, 2005, 2025]);
    expect(registry.layout).toBeDefined();

    for (const era of ERA_YEARS) {
      const scene = registry.get(era);
      expect(scene.era).toBe(era);
      expect(scene.layout).toBe(registry.layout);
      expect(scene.theme.id).toBe(era);
      expect(scene.atmosphere).toBe(scene.furniture.atmosphere);
      expect(scene.atmosphere).toBeDefined();

      // Every producer contributed to the composed root.
      const names = (scene.root.children as unknown[] as Array<{ name?: string }>).map((c) => c.name);
      expect(names).toContain(`buildings-${era}`);
      expect(names).toContain(`streetLife-${era}`);
      expect(names).toContain(`storefronts-${era}`);

      // Per-producer descriptors agree on the era.
      expect(getBuildingsDescriptor(scene.buildings)?.eraId).toBe(era);
      expect(scene.streetLife.era).toBe(era);
      expect(sceneStorefrontEra(scene)).toBe(era);
      expect(scene.furniture.era).toBe(era);

      // The scene graph genuinely contains content in every layer.
      expect(countMeshes(scene.root)).toBeGreaterThan(0);
      expect(scene.streetLife.vehicles.length).toBeGreaterThan(0);
      expect(scene.streetLife.pedestrians.length).toBeGreaterThan(0);
      expect(scene.furniture.lamps.length).toBeGreaterThan(0);

      // The morph bundle exposes the controller surface (elements/update/dispose).
      expect(scene.bundle.group).toBe(`era-${era}`);
      expect(scene.bundle.elements).toHaveLength(3);
      expect(typeof scene.bundle.update).toBe('function');
      expect(typeof scene.bundle.dispose).toBe('function');
      expect(scene.isDisposed).toBe(false);
      expect(typeof scene.update).toBe('function');
      expect(typeof scene.dispose).toBe('function');
    }
  });

  it('is deterministic for a seed and pairwise-distinct across the five eras', () => {
    const a = new EraSceneRegistry({ seed: 7 });
    const b = new EraSceneRegistry({ seed: 7 });
    const signatures: string[] = [];
    for (const era of ERA_YEARS) {
      const scene = a.get(era);
      signatures.push(serializeBuildings(scene.buildings));
      // Same seed -> identical building output.
      expect(serializeBuildings(b.get(era).buildings)).toBe(serializeBuildings(scene.buildings));
    }
    // All five eras produce visibly different building sets.
    expect(new Set(signatures).size).toBe(5);

    // Storefront signage kinds differ between at least two eras.
    const signKinds = ERA_YEARS.map((era) => {
      const info = a.get(era).storefronts.userData as unknown as StorefrontSceneInfo | undefined;
      return info?.summary?.signageKinds?.join(',') ?? '';
    });
    expect(new Set(signKinds).size).toBeGreaterThan(1);
  });

  it('shares one BlockLayout across every era and keeps off the road', () => {
    const registry = new EraSceneRegistry({ seed: 11 });
    const scenes = ERA_YEARS.map((era) => registry.get(era));
    expect(new Set(scenes.map((s) => s.layout)).size).toBe(1);
    for (const scene of scenes) {
      // Buildings stay inside their lots (never over the roadway/sidewalk).
      for (const lot of scene.layout.lots) {
        const lotRect = lot.bounds;
        for (const band of scene.layout.sidewalkBands) {
          expect(rectsOverlap(lotRect, band.bounds)).toBe(false);
        }
      }
    }
  });
});

function rectsOverlap(
  a: { minX: number; maxX: number; minZ: number; maxZ: number },
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxZ <= b.minZ || a.minZ >= b.maxZ);
}

// ============================================================================
// 2. Swap pipeline
// ============================================================================

describe('EraSwapWiring pipeline', () => {
  it('boots the initial era (first chronological stop) with atmosphere + ambience', () => {
    const h = makeWiring();
    expect(h.store.current).toBe(1945);
    expect(h.wiring.activeEra).toBe(1945);
    expect(h.wiring.activeScene.era).toBe(1945);
    expect(h.wiring.attached).toHaveLength(1);
    expect(stageRoots(h.stage)).toContain(h.wiring.activeScene.root);
    expect(h.audio.getCurrentEra()).toBe('1945');
    expect(
      lightStateEquals(h.renderer.lightStates.at(-1)!, applyAtmosphere(h.registry.get(1945).atmosphere)),
    ).toBe(true);
    h.dispose();
  });

  it('drives the full store -> transition -> swap -> audio pipeline on selection', async () => {
    const h = makeWiring();
    const whoosh = vi.spyOn(h.audio, 'playTransitionWhoosh');

    // Same-era requests are idempotent no-ops.
    expect(h.wiring.requestEra(1945)).toBe(false);

    expect(h.wiring.requestEra(2005)).toBe(true);
    // Store opened the transition and swapped immediately at progress 0.
    expect(h.store.current).toBe(2005);
    expect(h.store.transition).not.toBeNull();
    expect(h.controller.active).toBe(true);
    expect(h.controller.targetEra).toBe(2005);
    // The outgoing 1945 scene and incoming 2005 scene are both staged.
    expect(h.wiring.attached).toHaveLength(2);
    const outgoing = h.registry.get(1945);
    const incoming = h.registry.get(2005);
    expect(stageRoots(h.stage)).toContain(outgoing.root);
    expect(stageRoots(h.stage)).toContain(incoming.root);
    expect(outgoing.isDisposed).toBe(false);
    // Audio: ambience crossfade targeted 2005 + whoosh fired + autoplay unlock ran.
    expect(h.audio.getCurrentEra()).toBe('2005');
    // `unlock()` resolves asynchronously (resumes the stubbed context).
    await Promise.resolve();
    expect(h.audio.isUnlocked()).toBe(true);
    expect(whoosh).toHaveBeenCalledTimes(1);

    // The morph choreographs the scene graphs through their element surfaces.
    expect(incoming.bundle.elements![0]).toBeDefined();
    expect(outgoing.bundle.elements![0]).toBeDefined();

    runSeconds(h.engine, 1.5); // run the 1.2s morph via the engine loop

    expect(h.controller.active).toBe(false);
    expect(h.controller.settledEra).toBe(2005);
    expect(h.completed).toEqual([2005]);
    expect(h.store.transition).toBeNull();
    expect(h.wiring.activeScene.era).toBe(2005);
    expect(h.wiring.attached).toHaveLength(1);
    expect(stageRoots(h.stage)).toContain(incoming.root);
    expect(stageRoots(h.stage)).not.toContain(outgoing.root);
    // Outgoing content disposed exactly once; incoming stays live.
    expect(outgoing.isDisposed).toBe(true);
    expect(incoming.isDisposed).toBe(false);
    // Atmosphere driven through the engine lighting pipeline.
    expect(
      lightStateEquals(h.renderer.lightStates.at(-1)!, applyAtmosphere(incoming.atmosphere)),
    ).toBe(true);
    h.dispose();
  });

  it('serves the settled era from the shared layout and animates street life via the loop', () => {
    const h = makeWiring();
    const vehicle = h.wiring.activeScene.streetLife.vehicles[0]!;
    const before = vehicle.distance;
    runSeconds(h.engine, 2);
    expect(vehicle.distance).toBeGreaterThan(before);
    expect(h.renderer.renderCount).toBeGreaterThan(0);
    h.dispose();
  });

  it('converges when the slider moves again mid-transition', () => {
    const h = makeWiring();
    const first = h.registry.get(1945);
    const second = h.registry.get(2005);
    const third = h.registry.get(1965);

    expect(h.wiring.requestEra(2005)).toBe(true);
    runSeconds(h.engine, 0.5); // half of the 1.2s morph
    expect(h.controller.active).toBe(true);

    expect(h.wiring.requestEra(1965)).toBe(true);
    // The superseded outgoing root left the stage; 2005 (new outgoing) and
    // 1965 (new incoming) are staged.
    expect(stageRoots(h.stage)).not.toContain(first.root);
    expect(stageRoots(h.stage)).toContain(second.root);
    expect(stageRoots(h.stage)).toContain(third.root);
    expect(h.audio.getCurrentEra()).toBe('1965');

    runSeconds(h.engine, 1.5); // run the retargeted morph out

    expect(h.completed).toEqual([1965]);
    expect(h.controller.settledEra).toBe(1965);
    expect(h.store.current).toBe(1965);
    expect(h.store.transition).toBeNull();
    expect(first.isDisposed).toBe(true);
    expect(second.isDisposed).toBe(true); // demodeled down and disposed on settle
    expect(third.isDisposed).toBe(false);
    expect(stageRoots(h.stage)).toHaveLength(1);
    expect(stageRoots(h.stage)).toContain(third.root);
    expect(h.wiring.attached).toHaveLength(1);
    h.dispose();
  });

  it('never leaks scene nodes across repeated rapid swaps', () => {
    const h = makeWiring();
    const swappable: EraId[] = [1965, 1985, 2005, 2025, 1945, 1985, 2025, 1965];
    // Capture the initially-composed scenes; revisiting an era rebuilds a
    // fresh scene, so disposal assertions must target these originals.
    const initialScenes = new Map<EraId, EraScene>(
      ERA_YEARS.map((era) => [era, h.registry.get(era)] as const),
    );
    let maxStaged = 0;
    const visited = new Set<EraId>();

    for (const era of swappable) {
      visited.add(era);
      expect(h.wiring.requestEra(era)).toBe(true);
      maxStaged = Math.max(maxStaged, stageRoots(h.stage).length);
      runSeconds(h.engine, 1.4); // complete each morph
      expect(stageRoots(h.stage).length).toBe(1);
      expect(h.wiring.attached).toHaveLength(1);
      expect(h.wiring.activeScene.era).toBe(era);
      expect(h.wiring.activeScene.isDisposed).toBe(false);
    }

    // The stage never held more than the outgoing+incoming pair.
    expect(maxStaged).toBeLessThanOrEqual(2);
    // The registry cache is bounded by the five eras, not the swap count.
    expect(h.registry.size).toBe(visited.size);
    expect(h.registry.size).toBeLessThanOrEqual(5);
    // Every originally-visible scene was disposed once it left the stage;
    // the currently active scene stays live.
    for (const scene of initialScenes.values()) {
      if (scene !== h.wiring.activeScene) {
        expect(scene.isDisposed).toBe(true);
      }
    }
    expect(h.wiring.activeScene.isDisposed).toBe(false);
    h.dispose();
  });

  it('force-settles the store and disposes cleanly on teardown', () => {
    const h = makeWiring();
    const outgoing = h.registry.get(1945);
    const incoming = h.registry.get(2025);
    expect(h.wiring.requestEra(2025)).toBe(true);
    h.engine.step(1); // mid-morph
    h.dispose();
    // Teardown released the engine/audio without throwing and the wiring is inert.
    expect(h.renderer.disposed).toBe(true);
    // The in-flight pair was disposed exactly once (registry cache aside).
    expect(outgoing.isDisposed).toBe(true);
    expect(incoming.isDisposed).toBe(true);
    expect(h.wiring.requestEra(1965)).toBe(false); // wiring is inert after dispose
  });
});

// ============================================================================
// 3. Reduced motion
// ============================================================================

describe('prefers-reduced-motion swap wiring', () => {
  it('forces an instant era swap (no staged morph) when the media query matches', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);

    const h = makeWiring({ duration: 1.2, reducedMotionDuration: 0 }); // no reducedMotion override
    const outgoing = h.registry.get(1945);
    const incoming = h.registry.get(2025);

    expect(h.wiring.requestEra(2025)).toBe(true);
    // The wiring consulted the media query through the controller.
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(h.controller.reducedMotion).toBe(true);

    // With a zero reduced-motion duration the swap completes on the next frame.
    h.engine.step(1 / 60);
    expect(h.controller.active).toBe(false);
    expect(h.controller.settledEra).toBe(2025);
    expect(h.wiring.activeScene.era).toBe(2025);
    expect(outgoing.isDisposed).toBe(true);
    expect(incoming.isDisposed).toBe(false);
    expect(stageRoots(h.stage)).toHaveLength(1);
    expect(stageRoots(h.stage)).toContain(incoming.root);
    expect(h.store.transition).toBeNull();
    h.dispose();
  });

  it('uses the staged choreographed morph by default (no media query match)', () => {
    const matchMedia = vi.fn(() => ({ matches: false }));
    vi.stubGlobal('matchMedia', matchMedia);

    const h = makeWiring({ duration: 1.2, reducedMotionDuration: 0.35 });
    expect(h.wiring.requestEra(1965)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(h.controller.reducedMotion).toBe(false);

    // Still mid-morph after one frame at the normal 1.2s duration.
    h.engine.step(1 / 60);
    expect(h.controller.active).toBe(true);
    expect(h.completed).toHaveLength(0);

    runSeconds(h.engine, 1.5);
    expect(h.controller.settledEra).toBe(1965);
    expect(h.completed).toEqual([1965]);
    h.dispose();
  });
});

// ============================================================================
// 4. Shared layout sanity
// ============================================================================

describe('shared BlockLayout across builders', () => {
  it('registers the same layout that the producers consume', () => {
    const registry = new EraSceneRegistry({ seed: 12345 });
    const scene = registry.get(1965);
    const direct = createBlockLayout(12345);
    // Same seed -> structurally identical layout.
    expect(JSON.stringify(scene.layout)).toBe(JSON.stringify(direct));
    expect(scene.furniture.layout).toBe(scene.layout);
    expect(scene.streetLife.layout).toBe(scene.layout);
  });
});