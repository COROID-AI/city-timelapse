import * as React from 'react';
import { useEffect, useRef, useState } from 'react';

import { interpolateEra, getEra, getEraYears } from './eras/index.js';
import type { EraData } from './eras/types.js';
import { CITY_BLOCK_LAYOUT } from './layout/index.js';
import { Buildings } from './buildings/index.js';
import type { MergedGeometry } from './buildings/types.js';
import { Vehicles } from './vehicles/index.js';
import type { VehicleBuffers } from './vehicles/types.js';
import { Storefronts } from './storefronts/index.js';
import type { StorefrontsState } from './storefronts/types.js';
import { Pedestrians } from './pedestrians.js';
import { Atmosphere } from './atmosphere.js';
import { AmbientAudio } from './audio/index.js';
import type { AudioContextFactory } from './audio/types.js';
import { NavigationRig } from './navigation/index.js';
import type { CameraState } from './navigation/types.js';
import type { EraStore } from '../state/eraStore.js';
import { TimelineSlider } from '../components/TimelineSlider.js';
import { CityView } from '../components/CityView.js';

/**
 * CityScene — the composed city-block timelapse entrypoint.
 *
 * Composes every phase-1/phase-2 subsystem (Buildings, Vehicles, Storefronts,
 * Pedestrians, Atmosphere, AmbientAudio) plus the NavigationRig and
 * TimelineSlider from ONE shared interpolated era. The era store owns the
 * tweened `progress` (0..1); this scene routes that single progress through
 * the shared `interpolateEra` engine and pipes the resulting `EraData` into
 * every subsystem, so selecting any of the five years transforms the whole
 * block in front of the viewer without resetting the viewport.
 *
 * ## Era-transition choreography
 *
 * The store holds a `current.year` plus a tweened `progress` toward the next
 * era. A per-frame clock advances `progress` by a fixed rate; each frame the
 * scene interpolates `interpolateEra(getEra(year), getEra(next), progress)`
 * once and feeds that single `EraData` to every subsystem. The camera rig is
 * attached once on mount and never touched by era changes, so the viewport
 * stays put while the block transforms in place.
 *
 * ## Cleanup contract (composition level)
 *
 * On unmount the scene disposes every owned subsystem it created: the
 * Buildings/Vehicles/Storefronts lifecycle states, the AmbientAudio graph
 * (stops oscillators and closes the AudioContext) and the NavigationRig. The
 * inline WebAudio references that used to live in CityScene are gone — audio
 * is fully delegated to the `AmbientAudio` module.
 *
 * ## Performance envelope
 *
 * - **Instancing**: Buildings and Vehicles merge every instance into shared
 *   geometry buffers consumed by the renderer as a few static buffers.
 * - **Paused off-screen updates**: the per-frame clock only runs while the
 *   scene is mounted, so no subsystem recomputes while hidden.
 * - **LOD / frustum culling** are renderer-side concerns; this composition
 *   exposes the merged buffers + camera pose so the renderer can apply them.
 */

/** Milliseconds per full step of transition progress (0 -> 1). */
const TRANSITION_MS = 1400;
/** Seconds between per-frame ticks (the tween driver). */
const TICK_SECONDS = 1 / 30;

/** The next era year after `year`, or `year` itself for the final era. */
function nextEraYear(year: number): number {
  const years = getEraYears();
  const idx = years.indexOf(year);
  if (idx === -1 || idx === years.length - 1) {
    return year;
  }
  return years[idx + 1]!;
}

/** The composed, observable state of the whole scene for one frame. */
export interface CitySceneState {
  /** The single interpolated era driving every subsystem this frame. */
  era: EraData;
  /** The current era year (from the store). */
  year: number;
  /** Tweened progress in [0,1] toward the next era (from the store). */
  progress: number;
  /** Merged building geometry buffers. */
  buildings: MergedGeometry;
  /** Merged vehicle fleet buffers. */
  vehicles: VehicleBuffers;
  /** Storefronts + advertisements scene state. */
  storefronts: StorefrontsState;
  /** The camera pose from the navigation rig. */
  camera: CameraState;
}

/**
 * Composed handle to a live CityScene, exposed only for browser QA.
 *
 * Lets the E2E/regression harness assert real integrated behaviour — the
 * AmbientAudio graph and the era store — against a running browser mount.
 */
export interface ComposedSceneHandle {
  /** The live AmbientAudio engine (oscillators + AudioContext lifecycle). */
  readonly audio: AmbientAudio;
  /** The single era selection store driving the scene. */
  readonly store: EraStore;
}

/**
 * The composed CityScene React component.
 *
 * @param store the era selection store (owns current year + tweened progress)
 * @param audioContextFactory optional WebAudio context factory for tests; when
 *   omitted the AmbientAudio module uses the environment's global AudioContext
 * @param onComposedReady optional browser-QA hook invoked once mounted with a
 *   live handle to the composed subsystem instances
 */
export function CityScene({
  store,
  audioContextFactory,
  onComposedReady,
}: {
  store: EraStore;
  audioContextFactory?: AudioContextFactory | undefined;
  onComposedReady?: ((handle: ComposedSceneHandle) => void) | undefined;
}): React.ReactElement {
  // ---- Subsystem lifecycle instances (created once, owned here) ----------
  const buildings = useRef(Buildings.instantiate(store.current.year));
  const vehicles = useRef(Vehicles.instantiate(store.current.year));
  const storefronts = useRef(Storefronts.instantiate());
  const audio = useRef(
    new AmbientAudio(
      audioContextFactory === undefined
        ? undefined
        : { audioContextFactory },
    ),
  );
  const rig = useRef(new NavigationRig(CITY_BLOCK_LAYOUT));

  // Attach storefronts once (idempotent, cheap). Buildings/Vehicles are
  // updated each frame from the interpolated era below.
  storefronts.current.attach();

  // ---- Frame clock (drives the tweened transition) -----------------------
  const [now, setNow] = useState(0);

  // ---- Subscribe to store changes so the scene re-renders in place --------
  // The store is the single source of truth for year + progress; when it
  // changes (slider select, or the tween clock advancing progress) we bump a
  // revision to re-render the whole block from the one interpolated era.
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    return store.subscribe(() => setRevision((r) => r + 1));
  }, [store]);

  // Browser-QA debug hook: expose the live composed handle once mounted.
  const readyCalled = useRef(false);
  useEffect(() => {
    if (!readyCalled.current && onComposedReady !== undefined) {
      readyCalled.current = true;
      onComposedReady({ audio: audio.current, store });
    }
  }, [onComposedReady, store]);

  // ---- Mount the camera rig once (preserve the viewport across eras) -----
  const [camera, setCamera] = useState<CameraState>(() => rig.current.attach());

  // ---- AmbientAudio: delegate the era's SFX (no inline WebAudio) ---------
  // Audio is keyed on the registered era year (AmbientAudio resolves it via
  // getEra), so it re-tunes when the selection actually changes.
  useEffect(() => {
    audio.current.attach(store.current.year);
  }, [store.current.year]);

  // ---- Per-frame clock: advance progress, pause when off-screen ----------
  useEffect(() => {
    const timer = setInterval(() => {
      // QA-only pause: the E2E harness freezes the auto-tween so each selected
      // era holds steady on screen (real year still driven by the slider) and
      // per-era screenshots are deterministic. Undefined in the Node/jest env.
      const paused =
        typeof window !== 'undefined' &&
        (window as { __CITY_QA_PAUSE__?: boolean }).__CITY_QA_PAUSE__ === true;
      if (!paused) {
        store.advance(TICK_SECONDS / (TRANSITION_MS / 1000)); // notifies -> re-render
        setNow((n) => n + 1);
      }
      // Advance the rig (no-op when no user input / focus lerp) without ever
      // resetting the pose during era transitions.
      setCamera(rig.current.update(TICK_SECONDS));
    }, TICK_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [store]);

  // ---- Cleanup contract (composition level) ------------------------------
  useEffect(() => {
    return () => {
      Buildings.dispose(buildings.current);
      Vehicles.dispose(vehicles.current);
      storefronts.current.dispose();
      void audio.current.dispose();
      rig.current.dispose();
    };
  }, []);

  // ---- Era transition choreography: ONE shared interpolated era ----------
  const era = interpolateEra(
    getEra(store.current.year),
    getEra(nextEraYear(store.current.year)),
    store.current.progress,
  );

  // Route the single interpolated era into every geometry subsystem. Buildings
  // and Vehicles recompute their merged instanced buffers from the interpolated
  // year so the whole block transforms continuously during transitions.
  const buildingsBuf = Buildings.update(buildings.current, era.year);
  const vehiclesBuf = Vehicles.update(vehicles.current, era.year);
  // Storefronts interpolate internally via getInterpolatedEra(year, t), so it
  // expects the EXACT selected year + tweened progress (a blended year like
  // 1946 would be rejected by getEra). Route the store's canonical year in.
  const storefrontsState = storefronts.current.update(
    store.current.year,
    store.current.progress,
  );

  return (
    <div
      className="city-scene"
      data-era={era.year}
      data-progress={store.current.progress}
      data-revision={revision}
    >
      <TimelineSlider store={store} />
      <div className="city-scene-viewport">
        <BuildingsDisplay buffers={buildingsBuf} />
        <VehiclesDisplay buffers={vehiclesBuf} />
        <StorefrontsDisplay state={storefrontsState} />
        <Pedestrians era={era} now={now} />
        <Atmosphere era={era} />
        <CameraDisplay camera={camera} />
        <CityView era={era} buffers={buildingsBuf} vehicles={vehiclesBuf} storefronts={storefrontsState} />
      </div>
    </div>
  );
}

/** Minimal renderer stubs (React Three Fiber mounts these in production). */
function BuildingsDisplay({ buffers }: { buffers: MergedGeometry }): React.ReactElement {
  return (
    <buildings-display
      instanceCount={buffers.instanceCount}
      vertexCount={buffers.vertexCount}
      boxCount={buffers.buildingBoxes.length}
    />
  );
}

function VehiclesDisplay({ buffers }: { buffers: VehicleBuffers }): React.ReactElement {
  return (
    <vehicles-display
      instanceCount={buffers.instanceCount}
      trafficDensity={buffers.trafficDensity}
      electricRatio={buffers.electricRatio}
    />
  );
}

function StorefrontsDisplay({ state }: { state: StorefrontsState }): React.ReactElement {
  return (
    <storefronts-display
      signageCount={state.signage.length}
      adCount={state.advertisements.length}
      eraStyleId={state.eraStyleId}
    />
  );
}

function CameraDisplay({ camera }: { camera: CameraState }): React.ReactElement {
  return (
    <camera-display
      x={camera.position.x}
      y={camera.position.y}
      z={camera.position.z}
      yaw={camera.yaw}
      pitch={camera.pitch}
      distance={camera.distance}
    />
  );
}

/* Minimal intrinsic element declarations so the module compiles under the
   react-jsx transform regardless of the app's component library. Mounting
   (tests) reads these as data attributes via react-dom/server. */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'buildings-display': {
        instanceCount?: number;
        vertexCount?: number;
        boxCount?: number;
      };
      'vehicles-display': {
        instanceCount?: number;
        trafficDensity?: number;
        electricRatio?: number;
      };
      'storefronts-display': {
        signageCount?: number;
        adCount?: number;
        eraStyleId?: string;
      };
      'camera-display': {
        x?: number;
        y?: number;
        z?: number;
        yaw?: number;
        pitch?: number;
        distance?: number;
      };
    }
  }
}