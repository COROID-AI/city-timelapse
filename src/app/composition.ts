/**
 * composition.ts — the composed city-block application (1945–2025).
 *
 * AppComposition builds the headless scene-runtime graph and registers every
 * era layer:
 *
 *  - Scene layers (SceneRuntime.attachLayer): BlockLayer (buildings,
 *    storefronts, advertisements, street surface), StreetPropsLayer, 
 *    VehicleLayer, PedestrianLayer and AtmosphereLayer.
 *  - Controller-driven components: AudioLayer (procedural ambience + SFX),
 *    NavigationAPI (orbit/pan/zoom + era viewpoint presets) and TimelineUI
 *    (top slider with the five era stops).
 *
 * EraSystem is the single shared era controller. The composition binds slider
 * selection to `EraSystem.selectEra` — the same method the slider invokes —
 * and drives the shared transition tween through every layer's
 * `applyEra(eraId, progress)` so buildings, storefronts, advertisements,
 * street props, vehicles, pedestrians, atmosphere and audio all transform in
 * lockstep:
 *
 *  - `era-select`      → discrete layers adopt the destination (vehicle fleet
 *                        swap, audio whoosh + silent destination bed).
 *  - `era-transition`  → continuous layers blend with the eased progress.
 *  - `era-settled`     → every layer settles at progress 1.
 *
 * This module is WebGL-agnostic and DOM-free by design: creating the
 * WebGLRenderer and canvas, mounting the TimelineUI DOM and starting the frame
 * loop are deferred to the browser entry (src/main.ts), which supplies a
 * `RendererLike` adapter. Headless tests boot the same graph with
 * `renderer: null` (and no DOM), driving era selection through
 * `EraSystem.selectEra` exactly as the slider does.
 */

import {
  SceneRuntime,
  type FrameState,
  type RendererLike,
  type SceneLayer,
} from '../core/sceneRuntime';
import { EraSystem, isEraId, type EraId } from '../eras/eraSystem';
import { BlockLayer } from '../block/blockLayer';
import { StreetPropsLayer } from '../props/streetPropsLayer';
import { VehicleLayer } from '../vehicles/vehicleLayer';
import { PedestrianLayer } from '../pedestrians/pedestrianLayer';
import { AtmosphereLayer } from '../atmosphere/atmosphereLayer';
import { AudioLayer, type AudioContextLike } from '../audio/audioLayer';
import { NavigationAPI, type NavigationLimits } from '../navigation/navigation';
import { TimelineUI } from '../ui/timeline';

/** SceneLayer id of the composition's per-frame controller adapter. */
export const CONTROLLER_LAYER_ID = 'app-controller';

export interface CompositionOptions {
  /** Renderer backing the runtime; omitted/null in headless contexts. */
  readonly renderer?: RendererLike | null;
  /** Era settled at boot (default 1945). */
  readonly initialEra?: EraId;
  /** Era tween duration in seconds (default EraSystem's 2s). */
  readonly transitionDurationSeconds?: number;
  /**
   * Headless Web-Audio-like context attached at boot (tests inject the fake).
   * When neither `audioContext` nor `audioContextFactory` is supplied the
   * audio layer stays silent and detached (still safe to update/dispose).
   */
  readonly audioContext?: AudioContextLike;
  /** Browser factory used to create and attach the AudioContext at boot. */
  readonly audioContextFactory?: () => AudioContextLike;
  /** Orbit/pan/zoom envelope overrides for NavigationAPI. */
  readonly navigationLimits?: Partial<NavigationLimits>;
  /** Accent color for the timeline UI (defaults to the widget's blue). */
  readonly timelineAccentColor?: string;
}

/** The first slider stop (1945) is the boot era throughout the app. */
export const DEFAULT_INITIAL_ERA: EraId = 1945;

export class AppComposition {
  readonly runtime: SceneRuntime;
  readonly eraSystem: EraSystem;

  /** Buildings, storefronts, advertisements and street surface. */
  readonly block: BlockLayer;
  /** Street lamps, trees, hydrants, benches, meters, kiosks, chargers. */
  readonly streetProps: StreetPropsLayer;
  /** Era fleets, traffic loop and parked cars. */
  readonly vehicles: VehicleLayer;
  /** Procedural pedestrians with era outfits and walk routes. */
  readonly pedestrians: PedestrianLayer;
  /** Per-era sky, fog, sun, ambient light and postprocessing. */
  readonly atmosphere: AtmosphereLayer;
  /** Procedural era ambience, transition whoosh and UI ticks. */
  readonly audio: AudioLayer;
  /** Orbit/pan/zoom controls and era viewpoint presets. */
  readonly navigation: NavigationAPI;
  /** Top slider with the five era stops; mounted by the browser entry. */
  readonly timeline: TimelineUI;

  private readonly controller: SceneLayer;
  private readonly unsubscribes: Array<() => void> = [];
  private readonly audioAttached: boolean;
  private disposed = false;

  constructor(options: CompositionOptions = {}) {
    const initialEra = options.initialEra ?? DEFAULT_INITIAL_ERA;
    if (!isEraId(initialEra)) {
      throw new Error(
        `AppComposition: unknown era ${String(initialEra)}; known eras: 1945, 1965, 1985, 2005, 2025`,
      );
    }

    this.eraSystem = new EraSystem(initialEra, options.transitionDurationSeconds);
    this.runtime = new SceneRuntime({ renderer: options.renderer ?? null });

    // Layers. BlockLayer receives the era system and follows transitions on
    // its own; StreetPropsLayer, PedestrianLayer and AtmosphereLayer start on
    // the initial era; AudioLayer/NavigationAPI/TimelineUI are driven below.
    this.block = new BlockLayer({ eraSystem: this.eraSystem, initialEra });
    this.streetProps = new StreetPropsLayer(initialEra);
    this.vehicles = new VehicleLayer();
    this.pedestrians = new PedestrianLayer({ era: initialEra });
    this.atmosphere = new AtmosphereLayer({ scene: this.runtime.scene, initialEra });
    this.audio = new AudioLayer(
      options.audioContextFactory ? { contextFactory: options.audioContextFactory } : {},
    );
    this.navigation = new NavigationAPI({
      camera: this.runtime.camera,
      initialEra,
      limits: options.navigationLimits,
    });
    // The slider's onSelect is the composition's selectEra, which delegates to
    // EraSystem.selectEra — the single era controller.
    this.timeline = new TimelineUI({
      onSelect: (year) => this.selectEra(year),
      accentColor: options.timelineAccentColor,
    });

    // Register the scene layers (audio/navigation/timeline are not three.js
    // scene layers; they are driven by the controller adapter below).
    this.runtime.attachLayer(this.block);
    this.runtime.attachLayer(this.streetProps);
    this.runtime.attachLayer(this.vehicles);
    this.runtime.attachLayer(this.pedestrians);
    this.runtime.attachLayer(this.atmosphere);

    // Boot the discrete layers onto the initial era. The discrete vehicle
    // fleet starts empty until the first applyEra, so compose it now.
    this.vehicles.applyEra(initialEra, 1);

    // Audio: attach when a context or factory is supplied, then adopt the boot
    // era's ambience bed without a selection whoosh.
    this.audioAttached =
      options.audioContext !== undefined || options.audioContextFactory !== undefined;
    if (this.audioAttached) {
      if (options.audioContext !== undefined) {
        this.audio.attach(options.audioContext);
      } else if (options.audioContextFactory !== undefined) {
        this.audio.attach(options.audioContextFactory());
      }
      this.audio.applyEra(initialEra, 1);
    }

    // Drive the shared transition tween through every layer's applyEra.
    this.unsubscribes.push(
      this.eraSystem.subscribe('era-select', ({ to }) => {
        // Discrete layers swap at selection: the vehicle fleet adopts the
        // destination era and audio starts the silent destination bed (the
        // whoosh fires once per slider selection).
        this.vehicles.applyEra(to, 0);
        if (this.audioAttached) this.audio.applyEra(to, 0);
      }),
      this.eraSystem.subscribe('era-transition', ({ to, progress }) => {
        // Continuous layers blend with the eased progress.
        this.streetProps.applyEra(to, progress);
        this.pedestrians.applyEra(to, progress);
        this.atmosphere.applyEra(to, progress);
        if (this.audioAttached) this.audio.applyEra(to, progress);
        this.navigation.applyEra(to, progress);
      }),
      this.eraSystem.subscribe('era-settled', ({ to }) => {
        // Every layer settles at progress 1.
        this.streetProps.applyEra(to, 1);
        this.pedestrians.applyEra(to, 1);
        this.atmosphere.applyEra(to, 1);
        if (this.audioAttached) this.audio.applyEra(to, 1);
        this.navigation.applyEra(to, 1);
      }),
    );

    // Per-frame controller: advances the shared era tween, reflects the state
    // in the timeline UI and ticks audio ambience + navigation damping. Runs
    // inside SceneRuntime.step() (headless tests) or the browser rAF loop.
    this.controller = {
      id: CONTROLLER_LAYER_ID,
      update: (state: FrameState) => {
        this.eraSystem.update(state.delta);
        this.timeline.update(this.eraSystem.getState());
        this.audio.update(state.delta);
        this.navigation.update(state.delta);
      },
    };
    this.runtime.attachLayer(this.controller);
  }

  /** True once dispose() has been called. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Select an era through the same EraSystem.selectEra the slider invokes.
   * No-op when the era is already active; otherwise starts the shared tween.
   */
  selectEra(year: EraId): void {
    this.assertUsable();
    this.eraSystem.selectEra(year);
  }

  /**
   * Resize the runtime viewport: updates the camera aspect and the renderer
   * backing store. With no arguments the renderer's DOM element dimensions
   * are used (browser window resize path).
   */
  resize(width?: number, height?: number): void {
    this.runtime.resize(width, height);
  }

  /**
   * Unlock the audio context from a user gesture (browser-only; no-op when no
   * context was attached).
   */
  async unlockAudio(): Promise<void> {
    if (this.audioAttached) {
      await this.audio.resume();
    }
  }

  /**
   * Stop the frame loop, dispose every layer (scene layers through the
   * runtime, then audio/navigation/timeline/era system) and release listeners.
   * Idempotent.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.unsubscribes) off();
    this.unsubscribes.length = 0;
    this.runtime.dispose();
    this.audio.dispose();
    this.navigation.dispose();
    this.timeline.dispose();
    this.eraSystem.dispose();
  }

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('AppComposition has been disposed and can no longer be used');
    }
  }
}