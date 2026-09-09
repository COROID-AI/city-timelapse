/**
 * Buildings system: procedural building meshes for every BlockLayout plot,
 * restyled by era via `BuildingsEraSpec`.
 *
 * Implements the shared `EraSystem` contract:
 *
 * - `attach(context)` — builds one procedural building group per layout plot
 *   (merged BoxGeometry body + instanced emissive windows + era roof props)
 *   and attaches them to the scene.
 * - `update(channel, deltaSeconds)` — lerps palettes/heights and dissolves
 *   silhouette changes so buildings **morph in place** across 1945→2025:
 *   * palette lerp: facade material color + emissive window color lerp
 *     through the ease curve;
 *   * height lerp: `group.scale.y` morphs from the source-era height toward
 *     the target-era height;
 *   * silhouette dissolve: during the central band of a transition the system
 *     crossfades each plot's structure (roof era props AND window geometry)
 *     between the from-era authored build and a to-era ghost build, then
 *     **commits** the ghost as the new primary so the era architecture
 *     actually changes rather than teleporting.
 * - `dispose()` — idempotently frees every building mesh/material/texture and
 *   detaches from the scene.
 *
 * This module is strictly layout + era driven: it never imports the signage,
 * vehicles, or pedestrians modules, and all textures are procedural canvases.
 */

import { Group } from 'three';
import type { EraSystem, TimelineChannel } from '../../../era/types';
import type { BlockLayout, BuildingPlot } from '../../layout/types';
import { buildingEraData } from './buildingEraData';
import {
  buildingHeightFor,
  createBuildingGroup,
  getEraData,
  interpolateBuildingStyle,
  setGroupOpacity,
  type BuildingGroup,
  type InterpolatedBuildingStyle,
} from './buildingFactory';

/* ------------------------------------------------------------------ */
/* Context + handle types                                              */
/* ------------------------------------------------------------------ */

/**
 * Context required to attach the buildings system. `scene` is the root Group
 * (or scene object) the building groups are added to.
 */
export interface BuildingsSystemContext {
  scene: Group;
}

/**
 * Debug/introspection handle returned by `createBuildingsSystem`. It exposes
 * per-plot building groups so compose-scene-app integration tests and visual
 * checks can assert per-plot counts, morph state, and disposal.
 */
export interface BuildingsSystemHandle extends EraSystem<BuildingsSystemContext> {
  /** Per-plot building groups, keyed by plot id. */
  readonly buildings: ReadonlyMap<string, BuildingGroup>;
  /** Every plot id from the layout this system fills. */
  readonly plotIds: readonly string[];
  /** Layout seed this system was created for. */
  readonly seed: string;
  /** Last channel id + t passed to update (for diagnostics). */
  readonly lastChannel: TimelineChannel | null;
  /** Era ids that were used to author each plot's ghost (dissolve) build. */
  readonly ghostEraByPlot: ReadonlyMap<string, string>;
}

/* ------------------------------------------------------------------ */
/* System implementation                                               */
/* ------------------------------------------------------------------ */

/** Central band of a transition where the silhouette crossfades. */
const DISSOLVE_START = 0.42;
const DISSOLVE_END = 0.62;

interface PlotState {
  plot: BuildingPlot;
  /** Current (committed-era) building group. */
  primary: BuildingGroup;
  /** Ghost (to-era) building group active only during dissolve. */
  ghost: BuildingGroup | null;
  /** Era id used to author the primary build. */
  primaryEra: string;
  /** Era id used to author the ghost build (null until dissolve starts). */
  ghostEra: string | null;
}

const STARTING_ERA = '1945';

/**
 * Creates the BuildingsSystem for `layout`. The returned handle is lazy —
 * nothing is built until `attach()`; `update()` before attach is a no-op.
 */
export function createBuildingsSystem(layout: BlockLayout): BuildingsSystemHandle {
  const seed = layout.seed;
  const plots = [...layout.plots];
  const plotIds: string[] = plots.map((p) => p.id);
  const buildings = new Map<string, BuildingGroup>();
  const ghostEraByPlot = new Map<string, string>();
  const states = new Map<string, PlotState>();

  let scene: Group | null = null;
  let attached = false;
  let disposed = false;
  let lastChannel: TimelineChannel | null = null;

  /* ---- lifecycle ---------------------------------------------------- */

  function attach(context: BuildingsSystemContext): void {
    if (disposed) {
      throw new Error('buildings: attach after dispose');
    }
    if (attached) {
      return; // idempotent attach
    }
    scene = context.scene;

    for (const plot of plots) {
      const era = getEraData(STARTING_ERA);
      const style = interpolateBuildingStyle(STARTING_ERA, STARTING_ERA, 1);
      const height = buildingHeightFor(plot, style.heightScale, seed);
      const building = createBuildingGroup({
        plot,
        era,
        style,
        height,
        seed: `${seed}:build:${plot.id}`,
      });
      scene.add(building.group);
      buildings.set(plot.id, building);
      states.set(plot.id, {
        plot,
        primary: building,
        ghost: null,
        primaryEra: STARTING_ERA,
        ghostEra: null,
      });
    }
    attached = true;
  }

  /**
   * Drives palette/height lerp + silhouette dissolve from `channel.fromEra`
   * to `channel.toEra`. Called per frame by compose-scene-app.
   */
  function update(channel: TimelineChannel, deltaSeconds: number): void {
    void deltaSeconds;
    if (!attached || disposed) return;
    lastChannel = channel;

    const fromEra = channel.fromEra;
    const toEra = channel.toEra;
    const eta = ease(channel.t);
    const fromSpec = getEraData(fromEra).spec;
    const toSpec = getEraData(toEra).spec;

    for (const state of states.values()) {
      const plot = state.plot;
      const style = interpolateBuildingStyle(fromEra, toEra, channel.t);

      // -- palette lerp -------------------------------------------------
      applyStyleToBuilding(state.primary, style);

      // -- height lerp --------------------------------------------------
      const hFrom = buildingHeightFor(plot, fromSpec.heightScale, seed);
      const hTo = buildingHeightFor(plot, toSpec.heightScale, seed);
      const h = lerp(hFrom, hTo, eta);
      setHeightScale(state.primary, h);

      // -- silhouette dissolve ------------------------------------------
      const dissolving = channel.t > DISSOLVE_START && channel.t < DISSOLVE_END;
      if (dissolving) {
        ensureGhost(state, toEra);
        const localT = (channel.t - DISSOLVE_START) / (DISSOLVE_END - DISSOLVE_START);
        const amount = ease(localT);

        // Ghost (to-era) steps up to full, primary (from-era) steps down.
        setGroupOpacity(state.primary.group, 1 - amount);
        setGroupOpacity(state.ghost!.group, amount);
        // Ghost mirrors the same total height so both silhouettes match.
        setHeightScale(state.ghost!, h);
      } else if (channel.t >= DISSOLVE_END && state.ghost && state.ghostEra === toEra) {
        // Crossfade finished — the to-era structure becomes the new primary.
        commitGhost(state, toEra);
      } else {
        // Outside the dissolve band: fully show the primary. A stale ghost from
        // a partial/reversed transition is retired so it never lingers.
        setGroupOpacity(state.primary.group, 1);
        if (state.ghost) {
          if (state.ghostEra !== toEra) {
            state.ghost.dispose();
            state.ghost = null;
            state.ghostEra = null;
            ghostEraByPlot.delete(state.plot.id);
          } else {
            setGroupOpacity(state.ghost.group, 0);
          }
        }
      }
    }
  }

  /** Scales a building group's Y to world height `h` (morphs in place). */
  function setHeightScale(building: BuildingGroup, h: number): void {
    building.group.scale.set(1, h / building.authoredHeight, 1);
  }

  function ensureGhost(state: PlotState, toEra: string): void {
    if (state.ghost && state.ghostEra === toEra) return;
    // Dispose the previous ghost (different target era).
    if (state.ghost) {
      state.ghost.dispose();
      state.ghost = null;
      state.ghostEra = null;
      ghostEraByPlot.delete(state.plot.id);
    }
    const style = interpolateBuildingStyle(toEra, toEra, 1);
    const height = buildingHeightFor(state.plot, style.heightScale, seed);
    const era = getEraData(toEra);
    const ghost = createBuildingGroup({
      plot: state.plot,
      era,
      style,
      height,
      seed: `${seed}:ghost:${state.plot.id}:${toEra}`,
    });
    scene!.add(ghost.group);
    state.ghost = ghost;
    state.ghostEra = toEra;
    ghostEraByPlot.set(state.plot.id, toEra);
    setGroupOpacity(ghost.group, 0);
  }

  /**
   * After a completed crossfade the ghost IS the new architecture: it becomes
   * the primary (and the map handle), the old primary is disposed, and the
   * building continues morphing from this era onward.
   */
  function commitGhost(state: PlotState, toEra: string): void {
    if (!state.ghost || state.ghostEra !== toEra) return;
    const promoted = state.ghost;
    const retired = state.primary;

    state.primary = promoted;
    state.primaryEra = toEra;
    state.ghost = null;
    state.ghostEra = null;
    ghostEraByPlot.delete(state.plot.id);
    buildings.set(state.plot.id, promoted);

    setGroupOpacity(promoted.group, 1);
    setHeightScale(promoted, promoted.authoredHeight);
    retireBuilding(retired);
  }

  function retireBuilding(building: BuildingGroup): void {
    building.dispose();
  }

  function applyStyleToBuilding(building: BuildingGroup, style: InterpolatedBuildingStyle): void {
    const facade = building.facadeMaterial;
    if (facade.isMeshLambertMaterial === true) {
      facade.color.set(style.facadeColor);
    }
    const emissive = building.windowLitMaterial;
    if (emissive && emissive.isMeshLambertMaterial === true) {
      emissive.emissive.set(style.emissiveColor);
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const state of states.values()) {
      state.ghost?.dispose();
    }
    for (const building of buildings.values()) {
      building.dispose();
    }
    buildings.clear();
    states.clear();
    ghostEraByPlot.clear();
    scene = null;
    attached = false;
  }

  return {
    buildings,
    plotIds,
    seed,
    get lastChannel() {
      return lastChannel;
    },
    ghostEraByPlot,
    attach,
    update,
    dispose,
  } as unknown as BuildingsSystemHandle;
}

/* ------------------------------------------------------------------ */
/* Small local helpers                                                 */
/* ------------------------------------------------------------------ */

function ease(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < 0.5) return 4 * t * t * t;
  const f = 2 * t - 2;
  return 0.5 * f * f * f + 1;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Narrow helper used by tests to author the initial era. */
export function dominantEraFor(channel: TimelineChannel | null): string {
  return channel ? (channel.t >= 0.5 ? channel.toEra : channel.fromEra) : STARTING_ERA;
}

/** Exports the era data table alongside the system for the era environment. */
export { buildingEraData };