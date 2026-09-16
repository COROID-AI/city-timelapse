// @vitest-environment node
//
// Foundation unit tests: shared block layout contract + headless SceneRuntime.
// Runs in the default Node environment — three.js scene graph work needs no
// DOM and no WebGL renderer.

import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';

import {
  BLOCK_BOUNDS,
  CROSSWALK,
  LOT_ALLEY_GAP,
  LOT_EXTENTS,
  ROAD,
  SIDEWALK,
  WORLD_BOUNDS,
  type Rect,
} from './blockLayout';
import { SceneRuntime, type FrameState, type RendererLike } from './sceneRuntime';

// --- geometry helpers -------------------------------------------------------

interface RectLike {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** True when two axis-aligned rects share any interior area (strict bounds). */
function overlaps(a: RectLike, b: RectLike): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function contains(outer: RectLike, inner: RectLike): boolean {
  return (
    outer.minX <= inner.minX &&
    outer.maxX >= inner.maxX &&
    outer.minZ <= inner.minZ &&
    outer.maxZ >= inner.maxZ
  );
}

function allPairs<T>(items: readonly T[]): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

const SIDEWALK_RECTS: readonly Rect[] = [
  SIDEWALK.north,
  SIDEWALK.east,
  SIDEWALK.south,
  SIDEWALK.west,
];
const ROAD_RECTS: readonly Rect[] = [ROAD.north, ROAD.east, ROAD.south, ROAD.west];
const CROSSWALK_RECTS: readonly Rect[] = [
  CROSSWALK.northWest,
  CROSSWALK.northEast,
  CROSSWALK.eastNorth,
  CROSSWALK.eastSouth,
  CROSSWALK.southEast,
  CROSSWALK.southWest,
  CROSSWALK.westSouth,
  CROSSWALK.westNorth,
];

describe('blockLayout', () => {
  it('exposes block bounds centered on the origin', () => {
    expect(BLOCK_BOUNDS.minX).toBe(-60);
    expect(BLOCK_BOUNDS.maxX).toBe(60);
    expect(BLOCK_BOUNDS.minZ).toBe(-50);
    expect(BLOCK_BOUNDS.maxZ).toBe(50);
    expect(BLOCK_BOUNDS.width).toBe(120);
    expect(BLOCK_BOUNDS.depth).toBe(100);
  });

  it('defines four non-overlapping lots inside the block bounds', () => {
    const lots = Object.values(LOT_EXTENTS);
    expect(lots).toHaveLength(4);
    for (const lot of lots) {
      expect(contains(BLOCK_BOUNDS, lot)).toBe(true);
      expect(lot.width).toBeGreaterThan(0);
      expect(lot.depth).toBeGreaterThan(0);
    }
    for (const [a, b] of allPairs(lots)) {
      expect(overlaps(a, b)).toBe(false);
    }
    // The service alley separates neighbouring quadrants.
    expect(LOT_ALLEY_GAP).toBeGreaterThan(0);
    expect(LOT_EXTENTS.SE.minX - LOT_EXTENTS.SW.maxX).toBe(LOT_ALLEY_GAP);
    expect(LOT_EXTENTS.NW.minZ - LOT_EXTENTS.SW.maxZ).toBe(LOT_ALLEY_GAP);
  });

  it('keeps sidewalk bands adjacent to the block edge without overlap', () => {
    expect(SIDEWALK.width).toBeGreaterThan(0);
    expect(SIDEWALK.north.minZ).toBe(BLOCK_BOUNDS.maxZ);
    expect(SIDEWALK.south.maxZ).toBe(BLOCK_BOUNDS.minZ);
    expect(SIDEWALK.east.minX).toBe(BLOCK_BOUNDS.maxX);
    expect(SIDEWALK.west.maxX).toBe(BLOCK_BOUNDS.minX);
    for (const [a, b] of allPairs(SIDEWALK_RECTS)) {
      expect(overlaps(a, b)).toBe(false);
    }
  });

  it('derives road lanes that tile the road band exactly', () => {
    expect(ROAD.laneCount).toBe(4);
    expect(ROAD.laneWidth * ROAD.laneCount).toBe(ROAD.width);
    expect(ROAD.laneCenters).toHaveLength(ROAD.laneCount);
    for (let i = 0; i < ROAD.laneCenters.length; i += 1) {
      expect(ROAD.laneCenters[i]).toBeCloseTo((i + 0.5) * ROAD.laneWidth, 6);
      expect(ROAD.laneCenters[i]).toBeGreaterThan(0);
      expect(ROAD.laneCenters[i]).toBeLessThan(ROAD.width);
    }
    // Roads start where the sidewalk ring ends.
    expect(ROAD.north.minZ).toBe(SIDEWALK.north.maxZ);
    expect(ROAD.south.maxZ).toBe(SIDEWALK.south.minZ);
    expect(ROAD.east.minX).toBe(SIDEWALK.east.maxX);
    expect(ROAD.west.maxX).toBe(SIDEWALK.west.minX);
    for (const [a, b] of allPairs(ROAD_RECTS)) {
      expect(overlaps(a, b)).toBe(false);
    }
  });

  it('places eight crosswalks on the road band, one full road depth wide', () => {
    expect(CROSSWALK_RECTS).toHaveLength(8);
    expect(CROSSWALK.width).toBeGreaterThan(0);
    expect(CROSSWALK.offset).toBeGreaterThan(0);
    for (const crosswalk of CROSSWALK_RECTS) {
      expect(ROAD_RECTS.some((road) => contains(road, crosswalk))).toBe(true);
      // Each strip spans the full road band in one axis and CROSSWALK.width in
      // the other (a corner-adjacent crossing, never a partial cut).
      const spansFullRoad =
        crosswalk.depth === ROAD.width || crosswalk.width === ROAD.width;
      const hasCrosswalkWidth =
        crosswalk.width === CROSSWALK.width || crosswalk.depth === CROSSWALK.width;
      expect(spansFullRoad).toBe(true);
      expect(hasCrosswalkWidth).toBe(true);
    }
    for (const [a, b] of allPairs(CROSSWALK_RECTS)) {
      expect(overlaps(a, b)).toBe(false);
    }
  });

  it('exposes the full world footprint from road outer edges', () => {
    expect(WORLD_BOUNDS.minX).toBe(ROAD.west.minX);
    expect(WORLD_BOUNDS.maxX).toBe(ROAD.east.maxX);
    expect(WORLD_BOUNDS.minZ).toBe(ROAD.south.minZ);
    expect(WORLD_BOUNDS.maxZ).toBe(ROAD.north.maxZ);
  });

  it('is read-only: layout objects are frozen', () => {
    expect(Object.isFrozen(LOT_EXTENTS)).toBe(true);
    expect(Object.isFrozen(SIDEWALK)).toBe(true);
    expect(Object.isFrozen(ROAD)).toBe(true);
    expect(Object.isFrozen(CROSSWALK)).toBe(true);
    expect(Object.isFrozen(WORLD_BOUNDS)).toBe(true);
    expect(() => {
      (LOT_EXTENTS.SW as unknown as { minX: number }).minX = 999;
    }).toThrow(TypeError);
  });
});

// --- SceneRuntime -----------------------------------------------------------

describe('SceneRuntime', () => {
  it('assembles and traverses a layer scene graph without WebGL', () => {
    const runtime = new SceneRuntime();
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    mesh.name = 'lot-box';
    root.add(mesh);

    runtime.attachLayer({ id: 'structures', createRoot: () => root });

    expect(runtime.layerCount).toBe(1);
    expect(runtime.scene.children).toContain(root);
    expect(runtime.scene.getObjectByName('lot-box')).toBe(mesh);

    let visited = 0;
    runtime.scene.traverse(() => {
      visited += 1;
    });
    expect(visited).toBeGreaterThan(1);

    runtime.dispose();
  });

  it('rejects duplicate layer ids', () => {
    const runtime = new SceneRuntime();
    runtime.attachLayer({ id: 'dupe' });
    expect(() => runtime.attachLayer({ id: 'dupe' })).toThrow(/already attached/);
  });

  it('detaches layers and reports unknown ids', () => {
    const runtime = new SceneRuntime();
    const root = new Group();
    runtime.attachLayer({ id: 'a', createRoot: () => root });

    expect(runtime.detachLayer('missing')).toBe(false);
    expect(runtime.detachLayer('a')).toBe(true);
    expect(runtime.scene.children).not.toContain(root);
    expect(runtime.layerCount).toBe(0);
  });

  it('drives per-layer updates headlessly with step()', () => {
    const states: FrameState[] = [];
    const runtime = new SceneRuntime();
    runtime.attachLayer({ id: 'u', update: (state) => states.push(state) });

    runtime.step(0.1);
    runtime.step(0.25);

    expect(states).toHaveLength(2);
    expect(states[0].delta).toBeCloseTo(0.1);
    expect(states[1].delta).toBeCloseTo(0.25);
    expect(states[0].time).toBeCloseTo(0.1);
    expect(states[1].time).toBeCloseTo(0.35);
  });

  it('renders through the renderer abstraction each frame', () => {
    const render = vi.fn();
    const renderer: RendererLike = { setSize: vi.fn(), render, dispose: vi.fn() };
    const runtime = new SceneRuntime({ renderer });

    runtime.step(1 / 60);

    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(runtime.scene, runtime.camera);
  });

  it('resizes the camera and renderer', () => {
    const setSize = vi.fn();
    const domElement = { clientWidth: 640, clientHeight: 360 } as unknown as HTMLElement;
    const runtime = new SceneRuntime({
      renderer: { domElement, setSize, render: vi.fn(), dispose: vi.fn() },
    });

    runtime.resize();
    expect(setSize).toHaveBeenCalledWith(640, 360);
    expect(runtime.camera.aspect).toBeCloseTo(640 / 360, 6);

    runtime.resize(800, 600);
    expect(setSize).toHaveBeenLastCalledWith(800, 600);
    expect(runtime.camera.aspect).toBeCloseTo(800 / 600, 6);
  });

  it('starts and stops the frame loop through an injected scheduler', () => {
    const states: FrameState[] = [];
    const pending = new Map<number, FrameRequestCallback>();
    let nextHandle = 0;
    const raf = (callback: FrameRequestCallback): number => {
      nextHandle += 1;
      pending.set(nextHandle, callback);
      return nextHandle;
    };
    const cancelRaf = vi.fn((handle: number): boolean => pending.delete(handle));
    const fireFrames = (...times: number[]): void => {
      for (const time of times) {
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) callback(time);
      }
    };

    const runtime = new SceneRuntime({ raf, cancelRaf, timeSource: () => 0 });
    runtime.attachLayer({ id: 'u', update: (state) => states.push(state) });

    runtime.start();
    expect(runtime.isRunning).toBe(true);
    expect(pending.size).toBe(1);

    fireFrames(1000, 1016);
    // First frame delta is clamped to the loop's maximum.
    expect(states).toHaveLength(2);
    expect(states[0].delta).toBeCloseTo(0.05);
    expect(states[0].time).toBeCloseTo(0.05);
    expect(states[1].delta).toBeCloseTo(0.016);
    expect(states[1].time).toBeCloseTo(0.066);
    expect(pending.size).toBe(1); // rescheduled for the next frame

    runtime.stop();
    expect(runtime.isRunning).toBe(false);
    expect(cancelRaf).toHaveBeenCalled();
    expect(pending.size).toBe(0);

    fireFrames(2000);
    expect(states).toHaveLength(2); // loop is stopped
  });

  it('disposes layers, renderer and scene graph', () => {
    const disposeLayer = vi.fn();
    const disposeRenderer = vi.fn();
    const pending = new Map<number, FrameRequestCallback>();
    let nextHandle = 0;
    const raf = (callback: FrameRequestCallback): number => {
      nextHandle += 1;
      pending.set(nextHandle, callback);
      return nextHandle;
    };
    const cancelRaf = (handle: number): void => {
      pending.delete(handle);
    };

    const renderer: RendererLike = {
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: disposeRenderer,
    };
    const runtime = new SceneRuntime({ renderer, raf, cancelRaf });
    runtime.attachLayer({ id: 'x', createRoot: () => new Group(), dispose: disposeLayer });
    runtime.start();

    runtime.dispose();

    expect(runtime.isRunning).toBe(false);
    expect(pending.size).toBe(0);
    expect(disposeLayer).toHaveBeenCalledOnce();
    expect(disposeRenderer).toHaveBeenCalledOnce();
    expect(runtime.layerCount).toBe(0);
    expect(runtime.scene.children).toHaveLength(0);

    runtime.step(0.016); // safe after dispose
    expect(runtime.layerCount).toBe(0);
  });
});