import * as THREE from 'three';
import { ERA_YEARS, setActiveEra, type EraYear } from '../eras';
import { buildEraBuildings, disposeBuildings } from '../content/buildings';
import { buildEraEnvironment, disposeEnvironment } from '../content/environment';
import { createVehicleTraffic, type VehicleTrafficHandle } from '../content/vehicles';
import { createPedestrianCrowd, type PedestrianCrowdHandle } from '../content/pedestrians';
import { createEraStorefronts, type EraStorefrontsHandle } from '../content/storefronts';
import { TransitionOverlay } from './transitionOverlay';

/**
 * Era-transition engine.
 *
 * Coordinates all five content aspects (buildings, vehicles, storefronts/ads,
 * pedestrians, environment) so that switching eras animates a smooth, eased,
 * staggered morph instead of a hard cut:
 *
 *  - Buildings and environment (owned groups) crossfade: the prior group fades
 *    and scales out while the new group fades and scales in.
 *  - Vehicles, pedestrians and storefronts (self-contained handles that rebuild
 *    in place) fade out, swap at full transparency, then fade back in.
 *  - A brief radial "time-warp" overlay sweeps across the swap window.
 *
 * Prior-era geometries/materials are disposed (buildings, environment) or
 * rebuilt in place by the content handles (vehicles, pedestrians, storefronts)
 * so repeated switching does not grow GPU memory.
 *
 * Rapid/overlapping switches are queued (and coalesced) so they never overlap
 * or throw — the engine runs one transition at a time.
 */

// Per-aspect normalized timing windows (t in 0..1 across the whole transition).
interface CrossfadeTiming {
  outStart: number;
  outEnd: number;
  inStart: number;
  inEnd: number;
  scaleOut: number;
  scaleIn: number;
}

interface SwapTiming {
  outStart: number;
  outEnd: number;
  swap: number;
  inStart: number;
  inEnd: number;
}

const BUILDINGS_TIMING: CrossfadeTiming = {
  outStart: 0.0,
  outEnd: 0.45,
  inStart: 0.3,
  inEnd: 1.0,
  scaleOut: 0.12,
  scaleIn: 0.12,
};

const ENV_TIMING: CrossfadeTiming = {
  outStart: 0.06,
  outEnd: 0.52,
  inStart: 0.36,
  inEnd: 1.0,
  scaleOut: 0.08,
  scaleIn: 0.08,
};

const VEHICLES_TIMING: SwapTiming = {
  outStart: 0.12,
  outEnd: 0.5,
  swap: 0.53,
  inStart: 0.56,
  inEnd: 1.0,
};

const PEDESTRIANS_TIMING: SwapTiming = {
  outStart: 0.18,
  outEnd: 0.56,
  swap: 0.59,
  inStart: 0.62,
  inEnd: 1.0,
};

const STOREFRONTS_TIMING: SwapTiming = {
  outStart: 0.24,
  outEnd: 0.62,
  swap: 0.65,
  inStart: 0.68,
  inEnd: 1.0,
};

interface SwappedFlags {
  vehicles: boolean;
  pedestrians: boolean;
  storefronts: boolean;
}

interface TransitionState {
  from: EraYear;
  to: EraYear;
  elapsed: number;
  duration: number;
  newBuildings: THREE.Group;
  newEnv: THREE.Group;
  swapped: SwappedFlags;
}

export interface EraTransitionEngineOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Era to load on startup (default 1945). */
  initialEra?: EraYear;
  /** Full transition duration in seconds (default 1.15). */
  duration?: number;
}

// --- small math helpers ------------------------------------------------------

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function easeInCubic(x: number): number {
  return x * x * x;
}

function easeOutCubic(x: number): number {
  const v = 1 - x;
  return 1 - v * v * v;
}

function setGroupOpacity(group: THREE.Object3D, opacity: number): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) {
      return;
    }
    const materials = Array.isArray(material) ? material : [material];
    for (const m of materials) {
      if (!m) {
        continue;
      }
      m.transparent = true;
      m.opacity = opacity;
      m.needsUpdate = true;
    }
  });
}

function setGroupScale(group: THREE.Object3D, scale: number): void {
  group.scale.setScalar(scale);
}

// --- engine -----------------------------------------------------------------

export class EraTransitionEngine {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly duration: number;
  private readonly overlay: TransitionOverlay;

  private readonly vehicles: VehicleTrafficHandle;
  private readonly pedestrians: PedestrianCrowdHandle;
  private readonly storefronts: EraStorefrontsHandle;

  private buildingsGroup: THREE.Group | null = null;
  private envGroup: THREE.Group | null = null;

  private currentYear: EraYear;
  private transitioning = false;
  private queue: EraYear[] = [];
  private transition: TransitionState | null = null;
  private disposed = false;

  constructor(options: EraTransitionEngineOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.duration = options.duration ?? 1.15;
    this.currentYear = options.initialEra ?? 1945;
    this.overlay = new TransitionOverlay(this.camera);

    // Self-contained dynamic aspects (they add their own container to the scene).
    this.vehicles = createVehicleTraffic(this.scene, { era: this.currentYear });
    this.pedestrians = createPedestrianCrowd(this.scene, { era: this.currentYear });
    this.storefronts = createEraStorefronts(this.scene, { era: this.currentYear });

    this.loadInitialEra(this.currentYear);
  }

  /** Load an era without animation (used for the startup era). */
  private loadInitialEra(year: EraYear): void {
    this.buildingsGroup = buildEraBuildings(year);
    this.scene.add(this.buildingsGroup);

    this.envGroup = buildEraEnvironment(year);
    this.scene.add(this.envGroup);

    setActiveEra(year);
  }

  /**
   * Request a transition to the given era. Overlapping/rapid switches are
   * queued and coalesced so transitions never overlap.
   */
  selectEra(year: EraYear): void {
    if (this.disposed) {
      return;
    }
    if (year === this.currentYear) {
      return;
    }
    if (!this.transitioning) {
      this.startTransition(year);
      return;
    }
    const target = this.transition?.to;
    if (target === year) {
      return;
    }
    const last = this.queue[this.queue.length - 1];
    if (last !== year) {
      this.queue.push(year);
    }
  }

  private startTransition(to: EraYear): void {
    const from = this.currentYear;

    // Build the incoming owned groups now so they can crossfade in.
    const newBuildings = buildEraBuildings(to);
    const newEnv = buildEraEnvironment(to);
    setGroupOpacity(newBuildings, 0);
    setGroupScale(newBuildings, 1 - BUILDINGS_TIMING.scaleIn);
    setGroupOpacity(newEnv, 0);
    setGroupScale(newEnv, 1 - ENV_TIMING.scaleIn);
    this.scene.add(newBuildings);
    this.scene.add(newEnv);

    this.transition = {
      from,
      to,
      elapsed: 0,
      duration: this.duration,
      newBuildings,
      newEnv,
      swapped: { vehicles: false, pedestrians: false, storefronts: false },
    };
    this.transitioning = true;
    this.overlay.begin();
    setActiveEra(to);
  }

  /** Advance handles and the active transition. Call every frame. */
  update(delta: number): void {
    if (this.disposed) {
      return;
    }
    this.overlay.setAspect(this.camera.aspect);

    // Dynamic aspects keep animating even between transitions.
    this.vehicles.update(delta);
    this.pedestrians.update(delta);
    this.storefronts.update(delta);

    if (!this.transitioning || !this.transition) {
      return;
    }

    const tr = this.transition;
    tr.elapsed += delta;
    const t = clamp01(tr.elapsed / tr.duration);

    this.applyCrossfade(tr.newBuildings, this.buildingsGroup, t, BUILDINGS_TIMING);
    this.applyCrossfade(tr.newEnv, this.envGroup, t, ENV_TIMING);

    this.applySwap(this.vehicles, 'vehicle-traffic', tr, t, VEHICLES_TIMING);
    this.applySwap(this.pedestrians, 'pedestrian-crowd', tr, t, PEDESTRIANS_TIMING);
    this.applySwap(this.storefronts, 'era-storefronts', tr, t, STOREFRONTS_TIMING);

    this.overlay.update(t);

    if (t >= 1) {
      this.finalizeTransition();
    }
  }

  private applyCrossfade(
    newGroup: THREE.Group,
    oldGroup: THREE.Group | null,
    t: number,
    timing: CrossfadeTiming,
  ): void {
    if (oldGroup) {
      const out = clamp01((t - timing.outStart) / (timing.outEnd - timing.outStart));
      const eased = easeInCubic(out);
      setGroupOpacity(oldGroup, 1 - eased);
      setGroupScale(oldGroup, 1 - timing.scaleOut * eased);
    }
    const inn = clamp01((t - timing.inStart) / (timing.inEnd - timing.inStart));
    const eased = easeOutCubic(inn);
    setGroupOpacity(newGroup, eased);
    setGroupScale(newGroup, 1 - timing.scaleIn + timing.scaleIn * eased);
  }

  private applySwap(
    handle: { setEra(year: EraYear): void },
    containerName: string,
    tr: TransitionState,
    t: number,
    timing: SwapTiming,
  ): void {
    const container = this.findContainer(containerName);
    if (!container) {
      return;
    }
    const key = containerNameToFlag(containerName);
    if (!tr.swapped[key]) {
      if (t >= timing.swap) {
        handle.setEra(tr.to);
        setGroupOpacity(container, 0);
        tr.swapped[key] = true;
      } else {
        const out = clamp01((t - timing.outStart) / (timing.outEnd - timing.outStart));
        setGroupOpacity(container, 1 - easeInCubic(out));
      }
      return;
    }
    const inn = clamp01((t - timing.inStart) / (timing.inEnd - timing.inStart));
    setGroupOpacity(container, easeOutCubic(inn));
  }

  private findContainer(name: string): THREE.Group | null {
    const obj = this.scene.getObjectByName(name);
    return obj instanceof THREE.Group ? obj : null;
  }

  private finalizeTransition(): void {
    const tr = this.transition;
    if (!tr) {
      return;
    }

    // Dispose the prior owned groups.
    if (this.buildingsGroup) {
      this.scene.remove(this.buildingsGroup);
      disposeBuildings(this.buildingsGroup);
    }
    if (this.envGroup) {
      this.scene.remove(this.envGroup);
      disposeEnvironment(this.envGroup);
    }

    // The incoming groups become the current ones, fully opaque/scaled.
    setGroupOpacity(tr.newBuildings, 1);
    setGroupScale(tr.newBuildings, 1);
    setGroupOpacity(tr.newEnv, 1);
    setGroupScale(tr.newEnv, 1);
    this.buildingsGroup = tr.newBuildings;
    this.envGroup = tr.newEnv;

    // Ensure dynamic containers are fully opaque after their fade-in.
    for (const name of ['vehicle-traffic', 'pedestrian-crowd', 'era-storefronts']) {
      const container = this.findContainer(name);
      if (container) {
        setGroupOpacity(container, 1);
      }
    }

    this.currentYear = tr.to;
    this.transition = null;
    this.transitioning = false;
    this.overlay.end();

    // Start the next queued transition, if any.
    const next = this.queue.shift();
    if (next !== undefined) {
      this.startTransition(next);
    }
  }

  /** The era currently rendered. */
  getEra(): EraYear {
    return this.currentYear;
  }

  /** Whether a transition is currently in progress. */
  isTransitioning(): boolean {
    return this.transitioning;
  }

  /** Release all GPU resources owned by the engine. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.vehicles.dispose();
    this.pedestrians.dispose();
    this.storefronts.dispose();

    if (this.buildingsGroup) {
      this.scene.remove(this.buildingsGroup);
      disposeBuildings(this.buildingsGroup);
      this.buildingsGroup = null;
    }
    if (this.envGroup) {
      this.scene.remove(this.envGroup);
      disposeEnvironment(this.envGroup);
      this.envGroup = null;
    }
    if (this.transition) {
      this.scene.remove(this.transition.newBuildings);
      disposeBuildings(this.transition.newBuildings);
      this.scene.remove(this.transition.newEnv);
      disposeEnvironment(this.transition.newEnv);
    }
    this.overlay.dispose();
    this.transition = null;
    this.queue.length = 0;
  }
}

function containerNameToFlag(name: string): keyof SwappedFlags {
  switch (name) {
    case 'vehicle-traffic':
      return 'vehicles';
    case 'pedestrian-crowd':
      return 'pedestrians';
    default:
      return 'storefronts';
  }
}

/** Create an era-transition engine wired to the given scene/camera. */
export function createEraTransitionEngine(
  options: EraTransitionEngineOptions,
): EraTransitionEngine {
  return new EraTransitionEngine(options);
}

/** The canonical era years, re-exported for convenience. */
export { ERA_YEARS };
