/**
 * Application entrypoint for the City Time Period Timelapse.
 *
 * `boot()` composes the whole running application:
 *
 *   - a {@link SceneEngine} (renderer + fixed-step loop + damped navigation
 *     camera) whose WebGL canvas fills the mount container,
 *   - the {@link EraSceneRegistry} composed on one shared block layout,
 *   - the {@link EraSwapWiring} pipeline (EraStore -> TransitionController ->
 *     stage swap -> AudioEngine ambience crossfade + whoosh),
 *   - the {@link createTimelineSlider} HUD mounted over the canvas (year
 *     stops, mute, help overlay), and
 *   - a first-interaction audio unlock through the slider.
 *
 * The app boots into era 1945 (the first chronological timeline stop) with
 * its atmosphere and ambience applied before the loop starts, so the first
 * frame shows the correct era with no console errors.
 *
 * Headless safety: the renderer factory, audio-context factory and auto-start
 * are injectable, so the same boot sequence runs under Vitest with stubbed
 * WebGL/Audio while the browser uses the real three.js/WebGL pipeline. The
 * module auto-boots only when loaded as the index.html script entry
 * (`document.currentScript` is set); the appBoot integration test drives
 * `boot()` explicitly.
 */

import * as THREE from 'three';
import { AudioEngine } from './audio/audioEngine';
import type { RendererFactory } from './core/renderer';
import { createWebGLRenderer } from './core/renderer';
import { SceneEngine } from './core/engine';
import { EraStore } from './era/state';
import { DEFAULT_MORPH_DURATION, TransitionController } from './transition/transitionController';
import { createTimelineSlider, type TimelineSlider } from './ui/timelineSlider';
import {
  createEraSwapWiring,
  DEFAULT_ERA,
  EraSceneRegistry,
  type EraSwapWiring,
} from './integration/eraSceneRegistry';
import { applyPolishToApp } from './polish/index';

/** Options accepted by `boot` (everything is injectable for tests). */
export interface BootOptions {
  /** DOM mount for the canvas + HUD. Defaults to `#app` / `body`. */
  readonly container?: HTMLElement;
  /** Renderer factory. Defaults to the real three.js/WebGL renderer. */
  readonly factory?: RendererFactory<THREE.Scene>;
  /** AudioContext factory. Defaults to the browser's AudioContext. */
  readonly audioContextFactory?: () => AudioContext;
  /** Initial output size in CSS pixels (defaults to the container size). */
  readonly width?: number;
  readonly height?: number;
  /** Start the render loop immediately. Defaults to true in the browser. */
  readonly autoStart?: boolean;
}

/** The fully-wired application handle returned by {@link boot}. */
export interface CityApp {
  readonly engine: SceneEngine<THREE.Scene>;
  readonly registry: EraSceneRegistry;
  readonly store: EraStore;
  readonly controller: TransitionController;
  readonly wiring: EraSwapWiring;
  readonly slider: TimelineSlider;
  readonly audio: AudioEngine;
  /** The shared stage group holding the visible era scene root(s). */
  readonly stage: THREE.Group;
  /** Stop every loop/listener and release all resources. */
  dispose(): void;
}

/**
 * Adapt the shared HUD's absolutely-positioned stop buttons onto the track.
 *
 * The producer's `.hud-stop` buttons are absolutely positioned with no
 * horizontal coordinate, so browsers stack them at the track origin and
 * later buttons intercept the earlier ones' pointer events. This integration
 * layer gives each stop its timeline fraction (same law the thumb and
 * progress fill use) through the HUD's own public DOM, without touching the
 * producer source. jsdom tests are unaffected (they use selector handlers).
 */
function arrangeTimelineStops(slider: TimelineSlider): void {
  const years = slider.years;
  const last = years.length - 1;
  if (typeof document === 'undefined' || last < 1) {
    return;
  }
  const stops = Array.from(slider.element.querySelectorAll<HTMLElement>('[data-hud-stop]'));
  for (const stop of stops) {
    const year = Number(stop.dataset.year);
    let index = -1;
    for (let i = 0; i < years.length; i += 1) {
      if (years[i] === year) {
        index = i;
        break;
      }
    }
    if (index < 0) {
      continue;
    }
    stop.style.left = `${(index / last) * 100}%`;
  }
}

/** Make the mount a full-viewport, relative-positioned rendering surface. */
function prepareContainer(container: HTMLElement): void {
  if (typeof container.style === 'undefined') {
    return;
  }
  if (typeof document !== 'undefined' && document.body !== null) {
    // The scaffold page has no app-level stylesheet: kill the default body
    // margin so the canvas truly fills the viewport.
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
  }
  container.style.position = 'relative';
  if (container.style.width === '' || container.style.height === '') {
    container.style.width = '100vw';
    container.style.height = '100vh';
  }
}

/**
 * Attach the stage group to whatever scene root the renderer exposes.
 * The real renderer exposes a THREE.Scene; headless stubs provide an
 * `add`-compatible object. Inert when the scene has no `add` surface.
 */
function attachEraStage(scene: unknown, stage: THREE.Group): void {
  if (typeof scene !== 'object' || scene === null) {
    return;
  }
  const holder = scene as { add?: (child: THREE.Group) => void };
  if (typeof holder.add === 'function') {
    holder.add(stage);
  }
}

/** Reverse of {@link attachEraStage}: detach the stage on teardown. */
function detachEraStage(scene: unknown, stage: THREE.Group): void {
  if (typeof scene !== 'object' || scene === null) {
    return;
  }
  const holder = scene as { remove?: (child: THREE.Group) => void };
  if (typeof holder.remove === 'function') {
    holder.remove(stage);
  }
}

/**
 * Boot the integrated application.
 *
 * Browser entry (`/src/main.ts` via index.html) calls `boot()` automatically;
 * tests call it with stubbed factories. Returns the full `CityApp` handle.
 */
export function boot(options: BootOptions = {}): CityApp {
  const container =
    options.container ??
    (typeof document !== 'undefined' ? document.getElementById('app') : null) ??
    (typeof document !== 'undefined' ? document.body : null) ??
    (() => {
      throw new Error('boot: no container and no DOM document available.');
    })();

  prepareContainer(container);

  const registry = new EraSceneRegistry();
  const initialScene = registry.get(DEFAULT_ERA);

  const engine = new SceneEngine<THREE.Scene>({
    container,
    factory: options.factory ?? createWebGLRenderer,
    width: options.width,
    height: options.height,
    atmosphere: initialScene.atmosphere,
    camera: {
      mode: 'orbit',
      orbitCenter: { x: 0, y: 2.5, z: 0 },
      walkSpeed: 9,
    },
    navigation: {
      // Drag/zoom on the canvas surface; WASD/arrow keys anywhere on the page.
      pointerTarget: container,
      keyTarget: typeof document !== 'undefined' && document.body !== null ? document.body : container,
    },
  });

  const stage = new THREE.Group();
  stage.name = 'era-stage';
  attachEraStage(engine.getScene(), stage);

  const audio = new AudioEngine({
    audioContextFactory: options.audioContextFactory,
    autoUnlock: true,
  });
  const store = new EraStore();
  const controller = new TransitionController({
    duration: DEFAULT_MORPH_DURATION,
    // prefers-reduced-motion users get an instant swap, no staged morph.
    reducedMotionDuration: 0,
  });
  const wiring = createEraSwapWiring({
    store,
    registry,
    controller,
    engine,
    stage,
    audio,
    morphDuration: DEFAULT_MORPH_DURATION,
  });

  const slider = createTimelineSlider({
    container,
    store,
    audio,
    onSelect: () => {
      // First user gesture wins autoplay right: with an SVG/CSS hijack the
      // slider selection may be the first real interaction, so unlock here
      // in addition to the AudioEngine's own window-gesture listeners.
      void audio.unlock();
    },
  });
  arrangeTimelineStops(slider);

  if (options.autoStart !== false) {
    engine.start();
  }

  return {
    engine,
    registry,
    store,
    controller,
    wiring,
    slider,
    audio,
    stage,
    dispose: () => {
      slider.dispose();
      wiring.dispose();
      detachEraStage(engine.getScene(), stage);
      engine.dispose();
      try {
        audio.dispose();
      } catch {
        // Audio teardown must never break application shutdown.
      }
    },
  };
}

/**
 * Global opt-out for the browser auto-boot, set by headless tests
 * (`__CITY_TIMELAPSE_AUTO_BOOT__ = false`) before importing this module so
 * they can drive `boot()` with stubbed renderer/audio. Undefined in the
 * real browser -> the app boots automatically.
 */
const AUTO_BOOT_FLAG = '__CITY_TIMELAPSE_AUTO_BOOT__';

function shouldAutoBoot(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  return (globalThis as { [AUTO_BOOT_FLAG]?: boolean })[AUTO_BOOT_FLAG] !== false;
}

// Auto-boot when loaded as the Vite page entry (real browser). Headless
// integration tests set the opt-out flag and drive `boot()` explicitly.
if (shouldAutoBoot()) {
  // The polish pass is the final additive layer: detail enrichment (night
  // window glows, instanced props, surface wear) on every era scene plus the
  // perf overlay (`?perf=1`) and pixel-ratio / draw-call guardrails, applied
  // after the integrated scene boots (see src/polish).
  applyPolishToApp(boot());
}