/**
 * Headless application boot test.
 *
 * Boots src/main.ts end to end under jsdom with a stubbed renderer (no
 * WebGL), stubbed AudioContext and no real-time loop (`autoStart: false`),
 * proving the full wiring is connected:
 *
 *   SceneEngine render loop + camera rig
 *     + EraSceneRegistry (boots into era 1945)
 *     + TimelineSlider HUD mounted over the canvas
 *     + EraStore -> TransitionController -> stage swap -> AudioEngine
 *
 * Replaces the scaffold's placeholder src/main.test.ts stub-marker test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CameraView } from '../core/cameraRig';
import type { LightState } from '../core/lighting';
import type { SceneRenderer } from '../core/renderer';
import * as THREE from 'three';
import { ERA_YEARS } from '../era/types';
import type { CityApp } from '../main';

// ============================================================================
// Stub WebGL / Audio / timing infrastructure
// ============================================================================

/** Scene-root stand-in: records what the boot attaches to the engine scene. */
class StubScene {
  readonly children: unknown[] = [];

  add(child: unknown): void {
    this.children.push(child);
  }

  remove(child: unknown): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
  }
}

class StubRenderer implements SceneRenderer<THREE.Scene> {
  readonly scene = new StubScene() as unknown as THREE.Scene;
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

  createGain(): GainNode {
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
// Boot harness
// ============================================================================

let container: HTMLElement;
let stubCtx: StubAudioContext;
let renderer: StubRenderer;
let app: CityApp;

function runFrames(seconds: number): void {
  const frames = Math.max(1, Math.ceil(seconds / (1 / 60)));
  for (let i = 0; i < frames; i += 1) {
    app.engine.step(1 / 60);
  }
}

beforeEach(async () => {
  // Suppress the browser auto-boot so the test drives boot() explicitly
  // with stubbed renderer/audio (see src/main.ts shouldAutoBoot).
  (globalThis as { __CITY_TIMELAPSE_AUTO_BOOT__?: boolean }).__CITY_TIMELAPSE_AUTO_BOOT__ = false;
  container = document.createElement('div');
  container.id = 'app';
  document.body.append(container);
  stubCtx = new StubAudioContext();
  renderer = new StubRenderer();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 0;
  });

  const { boot } = await import('../main');
  app = boot({
    container,
    factory: () => renderer,
    audioContextFactory: () => stubCtx as unknown as AudioContext,
    autoStart: false,
    width: 640,
    height: 480,
  });
});

afterEach(() => {
  if (typeof app !== 'undefined') {
    app.dispose();
  }
  container.replaceChildren();
  document.body.replaceChildren();
  delete (globalThis as { __CITY_TIMELAPSE_AUTO_BOOT__?: boolean }).__CITY_TIMELAPSE_AUTO_BOOT__;
  vi.unstubAllGlobals();
});

describe('app boot (src/main.ts)', () => {
  it('boots the full wiring headlessly without throwing', () => {
    // Engine + registry + HUD + audio all connected.
    expect(app.engine).toBeDefined();
    expect(app.registry).toBeDefined();
    expect(app.store).toBeDefined();
    expect(app.controller).toBeDefined();
    expect(app.wiring).toBeDefined();
    expect(app.slider).toBeDefined();
    expect(app.audio).toBeDefined();
    expect(app.stage).toBeDefined();
    // Equals the *same* EraStore the HUD reflects.
    expect(app.slider.currentEra).toBe(app.store.current);
  });

  it('boots into era 1945 (first chronological stop) with no errors', () => {
    expect(app.store.current).toBe(1945);
    expect(app.wiring.activeScene.era).toBe(1945);
    expect(app.slider.currentEra).toBe(1945);
    // Initial ambience + atmosphere were applied at boot.
    expect(app.audio.getCurrentEra()).toBe('1945');
    expect(app.engine.isRunning).toBe(false); // loop not started (autoStart false)
    expect(app.engine.getLighting()).toBeDefined();
  });

  it('mounts the timeline HUD over the canvas and attaches the era stage to the scene', () => {
    const hud = container.querySelector('[data-hud="timeline"]');
    expect(hud).not.toBeNull();
    // The stage group carrying the era scene roots was attached to the scene.
    expect(renderer.scene.children).toContain(app.stage);
    expect((app.stage.children as unknown[]).length).toBe(1);
    expect((app.stage.children as unknown[])[0]).toBe(app.wiring.activeScene.root);
  });

  it('arranges the five year stops across the track (no overlapping hit areas)', () => {
    const stops = Array.from(container.querySelectorAll<HTMLElement>('[data-hud-stop]'));
    expect(stops).toHaveLength(5);
    // Each stop carries a timeline-fraction inline left (browser-layout adapter).
    const lefts = stops.map((stop) => stop.style.left);
    expect(lefts).toEqual(['0%', '25%', '50%', '75%', '100%']);
  });

  it('drives slider -> store -> transition -> swap -> audio end to end', () => {
    const initial1945 = app.wiring.activeScene;
    expect(app.slider.selectEra(1985)).toBe(true);
    expect(app.store.current).toBe(1985);
    expect(app.controller.active).toBe(true);
    expect(app.audio.getCurrentEra()).toBe('1985');

    runFrames(0.6); // mid-morph: store reports an in-flight transition
    expect(app.store.transition).not.toBeNull();

    runFrames(1.2); // finish the morph
    expect(app.controller.settledEra).toBe(1985);
    expect(app.store.transition).toBeNull();
    expect(app.wiring.activeScene.era).toBe(1985);
    expect(app.slider.currentEra).toBe(1985);
    expect(app.audio.getCurrentEra()).toBe('1985');
    expect(initial1945.isDisposed).toBe(true);
  });

  it('supports orbit + walk camera navigation with the loop wired', () => {
    const camera = app.engine.getCamera();
    expect(camera.getMode()).toBe('orbit');
    // Orbit: the default camera sits at a non-zero eye position.
    const orbitView = camera.getView();
    expect(Math.hypot(orbitView.position.x, orbitView.position.z)).toBeGreaterThan(0);

    // Walk mode: W key walks the first-person camera forward through the loop.
    camera.setMode('walk');
    const before = camera.getView().position.z;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, code: 'KeyW' }));
    runFrames(1);
    document.body.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, code: 'KeyW' }));
    const after = camera.getView().position.z;
    expect(after).toBeLessThan(before);
  });

  it('routes the mute toggle through the real AudioEngine', () => {
    expect(app.slider.muted).toBe(false);
    expect(app.slider.toggleMute()).toBe(true);
    expect(app.audio.isMuted()).toBe(true);
    expect(app.slider.muted).toBe(true);
    app.slider.toggleMute();
    expect(app.audio.isMuted()).toBe(false);
  });

  it('exposes all five timeline stops through the HUD', () => {
    expect(app.slider.years).toEqual([...ERA_YEARS]);
  });

  it('tears down cleanly: disposes HUD, wiring, engine and audio', () => {
    const initial1945 = app.wiring.activeScene;
    app.dispose();
    expect(initial1945.isDisposed).toBe(true);
    expect(renderer.disposed).toBe(true);
    expect(container.querySelector('[data-hud="timeline"]')).toBeNull();
    expect(renderer.scene.children).not.toContain(app.stage);
  });
});