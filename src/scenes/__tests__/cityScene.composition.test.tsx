import { describe, expect, it, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
import { createElement } from 'react';

import { useEraStore } from '../../state/eraStore.js';
import { CityScene } from '../CityScene.js';
import type {
  AudioContextLike,
  AudioContextFactory,
  GainLike,
  OscillatorLike,
} from '../audio/types.js';

/**
 * Composition integration test for the CityScene entrypoint.
 *
 * Mounts the full composed scene (Buildings, Vehicles, Storefronts,
 * Pedestrians, Atmosphere, AmbientAudio + NavigationRig + TimelineSlider)
 * against a single shared interpolated era and asserts that every subsystem
 * updates across all five canonical years during a tweened transition, and
 * that the camera viewport is never reset by era changes.
 *
 * A lightweight mock AudioContext stands in for the Web Audio API so the
 * AmbientAudio graph can be exercised in the Node test environment.
 */

/** All five canonical era years. */
const YEARS: readonly number[] = [1945, 1965, 1985, 2005, 2025];

/** Records every oscillator created and whether it was stopped/started. */
interface TrackedOscillator extends OscillatorLike {
  started: boolean;
  stopped: boolean;
}

/** Mock `AudioContext` implementing the structural contract. */
class MockAudioContext implements AudioContextLike {
  readonly currentTime = 0;
  readonly destination = 'destination';
  closed = false;
  oscillators: TrackedOscillator[] = [];

  createOscillator(): TrackedOscillator {
    const osc: TrackedOscillator = {
      type: 'sine',
      frequency: { value: 0 },
      detune: { value: 0 },
      started: false,
      stopped: false,
      connect: vi.fn(),
      start: vi.fn(() => {
        osc.started = true;
      }),
      stop: vi.fn(() => {
        osc.stopped = true;
      }),
    };
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): GainLike {
    return {
      gain: { value: 0 },
      connect: vi.fn(),
    };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

type Renderer = ReturnType<typeof create>;

/** A rendered node in the react-test-renderer JSON tree. */
interface JsonNode {
  type: string;
  props?: Record<string, unknown>;
  children?: Array<JsonNode | string>;
}

/** The JSON tree of the rendered scene (avoids circular refs). */
function tree(renderer: Renderer): JsonNode {
  return renderer.toJSON() as JsonNode;
}

/** Collect every node of the given element type, with its props. */
function nodesOfType(node: JsonNode, type: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  if (node.type === type && node.props) {
    out.push(node.props);
  }
  for (const child of node.children ?? []) {
    if (typeof child === 'object' && child !== null) {
      out.push(...nodesOfType(child, type));
    }
  }
  return out;
}

/** Mount the full CityScene against a fresh store + mock audio context. */
function mountScene(): { renderer: Renderer; store: ReturnType<typeof useEraStore>; ctx: MockAudioContext } {
  const store = useEraStore(1945);
  const ctx = new MockAudioContext();
  const factory: AudioContextFactory = () => ctx;
  let renderer: Renderer | undefined;
  act(() => {
    renderer = create(
      createElement(CityScene, { store, audioContextFactory: factory }),
    );
  });
  if (renderer === undefined) {
    throw new Error('renderer was not created');
  }
  return { renderer, store, ctx };
}

/** Select an era; the store subscription re-renders the mounted scene. */
function selectEra(renderer: Renderer, store: ReturnType<typeof useEraStore>, year: number): void {
  act(() => store.select(year));
}

describe('CityScene composition across all five eras', () => {
  it('mounts every subsystem and updates buildings/vehicles/storefronts across the five years', () => {
    const { renderer, store } = mountScene();

    const buildingVertices = new Set<number>();
    const vehicleDensities = new Set<number>();
    const storefrontStyles = new Set<string>();

    for (const year of YEARS) {
      selectEra(renderer, store, year);
      const root = tree(renderer);

      const buildings = nodesOfType(root, 'buildings-display');
      const vehicles = nodesOfType(root, 'vehicles-display');
      const storefronts = nodesOfType(root, 'storefronts-display');

      expect(buildings.length).toBe(1);
      expect(vehicles.length).toBe(1);
      expect(storefronts.length).toBe(1);

      // Buildings: merged instanced buffers present, vertex count era-scaled.
      const b = buildings[0]!;
      expect(b['instanceCount']).toBeGreaterThan(0);
      expect(b['boxCount']).toBe(b['instanceCount']);
      expect(b['vertexCount']).toBeGreaterThan(0);
      buildingVertices.add(Number(b['vertexCount']));

      // Vehicles: merged fleet buffers present, traffic density era-scaled.
      const v = vehicles[0]!;
      expect(v['instanceCount']).toBeGreaterThan(0);
      vehicleDensities.add(Number(v['trafficDensity']));

      // Storefronts: signage + ads present, era style id era-scaled.
      const s = storefronts[0]!;
      expect(s['signageCount']).toBeGreaterThan(0);
      expect(s['adCount']).toBeGreaterThan(0);
      storefrontStyles.add(String(s['eraStyleId']));
    }

    // Every subsystem genuinely transforms across the timeline (not stubbed).
    expect(buildingVertices.size).toBeGreaterThan(1);
    expect(vehicleDensities.size).toBeGreaterThan(1);
    expect(storefrontStyles.size).toBe(5);

    renderer.unmount();
  });

  it('updates pedestrians and atmosphere across the five years', () => {
    const { renderer, store } = mountScene();

    const outfitStyles = new Set<string>();
    const atmosphereProfiles = new Set<string>();

    for (const year of YEARS) {
      selectEra(renderer, store, year);
      const root = tree(renderer);

      // Pedestrians: each era renders an authentic outfit variant.
      const entries = nodesOfType(root, 'pedestrian-entry');
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        outfitStyles.add(String(entry['styleId']));
      }

      // Atmosphere: each era renders a distinct sky/lighting profile.
      const atmospheres = nodesOfType(root, 'atmosphere-display');
      expect(atmospheres.length).toBe(1);
      atmosphereProfiles.add(String(atmospheres[0]!['profileId']));
    }

    // Both subsystems genuinely transform across all five eras.
    expect(outfitStyles.size).toBe(5);
    expect(atmosphereProfiles.size).toBe(5);

    renderer.unmount();
  });

  it('routes a single interpolated era and preserves the viewport (no reset)', () => {
    const { renderer, store } = mountScene();

    const cameraPoses = new Set<string>();
    let firstEraYear = -1;
    let lastEraYear = -1;

    for (const year of YEARS) {
      selectEra(renderer, store, year);
      const root = tree(renderer);

      // The scene root carries the interpolated era's year + tweened progress.
      const scene = nodesOfType(root, 'div').find((n) => n['className'] === 'city-scene');
      expect(scene).toBeDefined();
      const eraYear = Number(scene!['data-era']);
      if (year === YEARS[0]) {
        firstEraYear = eraYear;
      }
      if (year === YEARS[YEARS.length - 1]) {
        lastEraYear = eraYear;
      }

      // Camera pose is stable across era transitions (no viewport reset).
      const cameras = nodesOfType(root, 'camera-display');
      expect(cameras.length).toBe(1);
      const cam = cameras[0]!;
      cameraPoses.add(`${cam['x']}:${cam['y']}:${cam['z']}:${cam['yaw']}:${cam['pitch']}:${cam['distance']}`);
    }

    // The scene reflects the first and last eras distinctly.
    expect(firstEraYear).toBe(1945);
    expect(lastEraYear).toBe(2025);
    // The camera pose never changes across the whole timeline.
    expect(cameraPoses.size).toBe(1);

    renderer.unmount();
  });

  it('delegates audio to AmbientAudio and preserves the cleanup contract', async () => {
    const { renderer, store, ctx } = mountScene();

    // Audio effect attached the initial era's ambience (oscillators running).
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    expect(ctx.oscillators.every((o) => o.started && !o.stopped)).toBe(true);

    // Changing era re-tunes the ambience (previous oscillators stopped).
    const before = ctx.oscillators.length;
    selectEra(renderer, store, 2025);
    const previous = ctx.oscillators.slice(0, before);
    expect(previous.every((o) => o.stopped)).toBe(true);
    expect(ctx.oscillators.slice(before).length).toBeGreaterThan(0);

    // Unmount disposes every subsystem + closes the AudioContext.
    act(() => renderer.unmount());
    expect(ctx.closed).toBe(true);
    expect(ctx.oscillators.every((o) => o.stopped)).toBe(true);
  });
});