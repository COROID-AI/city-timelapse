import { Mesh, Object3D, Scene } from 'three';
import { CityBlockLayout } from '../layout/cityBlockLayout';
import { EraState } from '../types/era';
import { EraYear } from '../types/city';
import {
  AnimationTimeline,
  buildInOvershoot,
  cubicInOut,
  Easing,
} from './animationTimeline';
import {
  createPaletteTween,
  EraPaletteSnapshot,
  LightingGrade,
  Rgb,
} from './paletteTween';
import { createAudioCrossfade, EraAudioHandle } from './audioCrossfade';

/**
 * TransitionDirector: the core of the era transition engine.
 *
 * Subscribes to an `EraState` store and, whenever the user picks a new year,
 * resolves the incoming/outgoing era content pair and animates a
 * crossfade + build-morph handoff:
 *
 *  - Outgoing era meshes fade their material color toward transparent while
 *    their traffic/pedestrians continue stepping (driving off / fading).
 *  - Incoming era meshes build in: they rise from the ground with a slight
 *    overshoot, per-mesh, landing exactly on their resting pose.
 *  - The palette / lighting grade (sky color, sun position, fog density,
 *    light color temperature) is interpolated over the same timeline.
 *  - Audio stems crossfade: outgoing ambience fades while incoming rises.
 *
 * Cleanup is deterministic: after each transition the outgoing era's meshes,
 * materials, geometries, listeners and SFX stems are fully disposed. Rapid
 * era switching mid-transition cancels the in-flight animation and retargets
 * cleanly (the half-built incoming era is disposed and the still-visible
 * current era becomes the new outgoing).
 *
 * The director is generic over `EraModuleAdapter`s so it can drive the five
 * heterogeneous era content modules (see `src/transition/index.ts` for the
 * concrete adapters).
 */

/** A live, attached era scene. */
export interface EraSceneHandle {
  /** All meshes owned by this era, targeted by the opacity/build-morph. */
  readonly meshes: readonly Object3D[];
  /** Step animated content (vehicles, pedestrians, signage). */
  update(dt: number): void;
  /** Fully dispose meshes, materials, geometries, listeners and SFX. */
  dispose(): void;
}

/** A normalized adapter over one era content module. */
export interface EraModuleAdapter {
  /** The era year this adapter drives. */
  readonly year: EraYear;
  /** Attach the era's meshes to the scene at the layout. */
  attach(scene: Scene, layout: CityBlockLayout): EraSceneHandle;
  /** Build an audio crossfade handle for this era. */
  createAudio(): EraAudioHandle;
  /** Palette snapshot used for lighting-grade interpolation. */
  palette(): EraPaletteSnapshot;
  /** Optional per-era photographic grade applied to the crossfade. */
  grade?(color: Rgb): Rgb;
}

/** Applies an interpolated lighting grade to the scene's sky/light rig. */
export interface SceneGrade {
  apply(grade: LightingGrade): void;
}

/** Options for constructing a TransitionDirector. */
export interface TransitionDirectorOptions {
  /** The reactive era store this director subscribes to. */
  state: EraState;
  /** The Three.js scene meshes are attached to. */
  scene: Scene;
  /** The city-block layout lot anchors. */
  layout: CityBlockLayout;
  /** The available era content adapters, keyed by year. */
  registry: ReadonlyMap<EraYear, EraModuleAdapter>;
  /** Optional applier of the interpolated lighting grade. */
  grade?: SceneGrade;
  /** Transition duration in seconds. Defaults to ~1.8s. */
  duration?: number;
  /** Easing function. Defaults to cubic in-out. */
  easing?: Easing;
  /** Called when a transition starts. */
  onTransitionStart?: (from: EraYear, to: EraYear) => void;
  /** Called when a transition completes. */
  onTransitionEnd?: (from: EraYear, to: EraYear) => void;
}

interface MeshState {
  mesh: Mesh;
  baseColor: Rgb;
  baseY: number;
}

interface ActiveEra {
  adapter: EraModuleAdapter;
  handle: EraSceneHandle;
  audio: EraAudioHandle;
  palette: EraPaletteSnapshot;
  meshes: MeshState[];
}

interface Flight {
  from: EraYear;
  to: EraYear;
  timeline: AnimationTimeline;
  incoming: {
    adapter: EraModuleAdapter;
    handle: EraSceneHandle;
    audio: EraAudioHandle;
    palette: EraPaletteSnapshot;
    meshes: MeshState[];
  };
  crossfade: ReturnType<typeof createAudioCrossfade>;
}

/** True when an object is a Mesh (has a material + position). */
function isMesh(node: Object3D): node is Mesh {
  return typeof (node as Mesh).material !== 'undefined';
}

/** Recursively collect all meshes under a root object. */
function collectMeshes(root: Object3D): Mesh[] {
  const out: Mesh[] = [];
  const stack: Object3D[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as Object3D;
    if (isMesh(node)) out.push(node);
    for (const child of node.children) stack.push(child);
  }
  return out;
}

/** Capture each mesh's resting color and y-position for the morph. */
function captureMeshStates(meshes: readonly Object3D[]): MeshState[] {
  const out: MeshState[] = [];
  for (const obj of meshes) {
    if (!isMesh(obj)) continue;
    const mesh = obj as Mesh;
    const c = mesh.material.color;
    out.push({
      mesh,
      baseColor: { r: c.r, g: c.g, b: c.b },
      baseY: mesh.position.y,
    });
  }
  return out;
}

function scaleColor(c: Rgb, f: number): Rgb {
  return { r: c.r * f, g: c.g * f, b: c.b * f };
}

/**
 * The era transition director. See the module doc for behavior.
 */
export class TransitionDirector {
  private readonly state: EraState;
  private readonly scene: Scene;
  private readonly layout: CityBlockLayout;
  private readonly registry: ReadonlyMap<EraYear, EraModuleAdapter>;
  private readonly grade?: SceneGrade;
  private readonly duration: number;
  private readonly easing: Easing;
  private readonly onTransitionStart?: (from: EraYear, to: EraYear) => void;
  private readonly onTransitionEnd?: (from: EraYear, to: EraYear) => void;
  private readonly unsubscribe: () => void;

  private active: ActiveEra | null = null;
  private flight: Flight | null = null;
  private disposed = false;

  constructor(options: TransitionDirectorOptions) {
    this.state = options.state;
    this.scene = options.scene;
    this.layout = options.layout;
    this.registry = options.registry;
    this.grade = options.grade;
    this.duration = options.duration ?? 1.8;
    this.easing = options.easing ?? cubicInOut;
    this.onTransitionStart = options.onTransitionStart;
    this.onTransitionEnd = options.onTransitionEnd;

    // Attach the initial era at full visibility.
    const initial = this.registry.get(this.state.year);
    if (initial) {
      this.active = this.attachActive(initial);
      this.applyGrade(this.active.palette);
    }

    this.unsubscribe = this.state.subscribe((year) => {
      this.handleYearChange(year);
    });
  }

  /** The era currently displayed (fully visible). */
  get currentYear(): EraYear | null {
    return this.active ? this.active.adapter.year : null;
  }

  /** Whether an animated transition is currently in flight. */
  get transitioning(): boolean {
    return this.flight !== null;
  }

  /** Eased progress of the in-flight transition in [0, 1], or 0 when idle. */
  get progress(): number {
    return this.flight ? this.flight.timeline.eased : 0;
  }

  private attachActive(adapter: EraModuleAdapter): ActiveEra {
    const handle = adapter.attach(this.scene, this.layout);
    const audio = adapter.createAudio();
    const palette = adapter.palette();
    const meshes = captureMeshStates(handle.meshes);
    // Start the era's audio at full volume.
    audio.fadeTo(1);
    return { adapter, handle, audio, palette, meshes };
  }

  private applyGrade(palette: EraPaletteSnapshot): void {
    if (!this.grade) return;
    const tween = createPaletteTween(palette, palette);
    this.grade.apply(tween(1).grade);
  }

  private handleYearChange(toYear: EraYear): void {
    if (this.disposed) return;
    const adapter = this.registry.get(toYear);
    if (!adapter) return;
    // Ignore re-selecting the currently displayed era.
    if (this.active && this.active.adapter.year === toYear) return;

    // Cancel any in-flight transition and retarget cleanly.
    if (this.flight) {
      this.cancelFlight();
    }

    const from = this.active ? this.active.adapter.year : (null as EraYear | null);
    if (!this.active) {
      // No current era (rare): just attach the target directly.
      this.active = this.attachActive(adapter);
      this.applyGrade(this.active.palette);
      return;
    }

    // Attach the incoming era and begin the transition.
    const incomingHandle = adapter.attach(this.scene, this.layout);
    const incomingAudio = adapter.createAudio();
    const incomingPalette = adapter.palette();
    const incomingMeshes = captureMeshStates(incomingHandle.meshes);

    const timeline = new AnimationTimeline({
      duration: this.duration,
      easing: this.easing,
    });
    timeline.start();

    const crossfade = createAudioCrossfade(this.active.audio, incomingAudio);

    this.flight = {
      from: from as EraYear,
      to: toYear,
      timeline,
      incoming: {
        adapter,
        handle: incomingHandle,
        audio: incomingAudio,
        palette: incomingPalette,
        meshes: incomingMeshes,
      },
      crossfade,
    };

    if (this.onTransitionStart) {
      this.onTransitionStart(this.active.adapter.year, toYear);
    }
  }

  private cancelFlight(): void {
    if (!this.flight) return;
    // Dispose the half-built incoming era completely.
    this.flight.incoming.handle.dispose();
    this.flight.incoming.audio.dispose();
    // Restore the still-visible current era to full opacity.
    if (this.active) {
      for (const ms of this.active.meshes) {
        const c = ms.baseColor;
        ms.mesh.material.color.setRGB(c.r, c.g, c.b);
      }
    }
    this.flight = null;
  }

  /**
   * Advance the engine by `dt` seconds. Steps any in-flight transition and
   * steps the active/incoming era content (vehicles, pedestrians).
   */
  update(dt: number): void {
    if (this.disposed) return;

    // Always step the fully-visible active era's animated content.
    if (this.active) {
      this.active.handle.update(dt);
    }

    if (!this.flight) return;

    const flight = this.flight;
    const eased = flight.timeline.update(dt);
    const build = buildInOvershoot(eased);

    // Incoming meshes build in: rise from the ground with slight overshoot.
    for (const ms of flight.incoming.meshes) {
      const c = ms.baseColor;
      ms.mesh.material.color.setRGB(c.r, c.g, c.b);
      ms.mesh.position.y = ms.baseY * build;
    }
    // Step the incoming era's animated content (spawning in).
    flight.incoming.handle.update(dt);

    // Outgoing (active) meshes fade toward transparent while traffic drives off.
    if (this.active) {
      const fade = 1 - eased;
      for (const ms of this.active.meshes) {
        const c = scaleColor(ms.baseColor, fade);
        ms.mesh.material.color.setRGB(c.r, c.g, c.b);
      }
    }

    // Synchronized palette / lighting grade interpolation.
    if (this.grade) {
      const tween = createPaletteTween(
        this.active!.palette,
        flight.incoming.palette,
        this.active!.adapter.grade,
        flight.incoming.adapter.grade,
      );
      this.grade.apply(tween(eased).grade);
    }

    // Audio stem crossfade: outgoing fades while incoming rises.
    flight.crossfade.update(eased);

    if (flight.timeline.done) {
      this.completeTransition();
    }
  }

  private completeTransition(): void {
    if (!this.flight || !this.active) return;
    const flight = this.flight;

    // Finish the audio crossfade (stop outgoing, incoming at full).
    flight.crossfade.finish();

    // Fully dispose the outgoing era: meshes, materials, geometries,
    // listeners and SFX stems.
    this.active.handle.dispose();
    this.active.audio.dispose();

    // Promote the incoming era to the active, fully-visible era.
    this.active = {
      adapter: flight.incoming.adapter,
      handle: flight.incoming.handle,
      audio: flight.incoming.audio,
      palette: flight.incoming.palette,
      meshes: flight.incoming.meshes,
    };
    // Restore incoming meshes to their exact resting pose.
    for (const ms of this.active.meshes) {
      ms.mesh.position.y = ms.baseY;
      const c = ms.baseColor;
      ms.mesh.material.color.setRGB(c.r, c.g, c.b);
    }
    this.applyGrade(this.active.palette);

    const from = flight.from;
    const to = flight.to;
    this.flight = null;

    if (this.onTransitionEnd) {
      this.onTransitionEnd(from, to);
    }
  }

  /** Dispose the engine: unsubscribe and dispose all era content. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    if (this.flight) {
      this.flight.incoming.handle.dispose();
      this.flight.incoming.audio.dispose();
      this.flight = null;
    }
    if (this.active) {
      this.active.handle.dispose();
      this.active.audio.dispose();
      this.active = null;
    }
  }
}

/** Export the mesh-collection helper for concrete adapters. */
export { collectMeshes };