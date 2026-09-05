/**
 * src/eras.test.ts — foundation parity tests.
 *
 * Verifies the shared anchor contract: every one of the five EraSceneStates
 * exposes the same named anchor slots, and the era registry/data model is
 * complete and consistent. This is the single highest-value guard for the
 * vertex-morph engine: if one era forgot an anchor or defined a different slot,
 * morphing between eras would not be lossless.
 */

import { describe, expect, it } from 'vitest';

import {
  ERA_ANCHOR_SLOTS,
  ERA_IDS,
  ERA_REGISTRY,
  ERA_SCENE_STATES,
  SFX_ERA_DATA,
  WEATHER_ERA_PRESETS,
  LIGHTING_ERA_PRESETS,
  getEraSpec,
} from './eras';

const REQUIRED_ANCHOR_KEYS = ['doorway', 'window', 'shelf'] as const;
const REQUIRED_CONTENT_KEYS = [
  'buildings',
  'vehicles',
  'pedestrians',
  'storefronts',
  'ads',
  'streetFurniture',
] as const;

describe('era data model', () => {
  it('defines all five era ids', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
    expect(ERA_REGISTRY).toHaveLength(5);
  });

  it('registry entries are well-formed and ordered oldest-to-newest', () => {
    for (const spec of ERA_REGISTRY) {
      expect(spec.id).toBeDefined();
      expect(spec.year).toBe(Number(spec.id));
      expect(spec.label).toBe(spec.id);
      expect(typeof spec.description).toBe('string');
    }
    const years = ERA_REGISTRY.map((s) => s.year);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it('getEraSpec returns the right spec and throws for unknown ids', () => {
    expect(getEraSpec('1985').year).toBe(1985);
    // @ts-expect-error unknown era id is a compile-time error too
    expect(() => getEraSpec('1899')).toThrow();
  });

  it('every era has sfx, lighting, and weather data', () => {
    for (const id of ERA_IDS) {
      expect(SFX_ERA_DATA[id]).toBeDefined();
      expect(SFX_ERA_DATA[id].events.length).toBeGreaterThan(0);
      expect(LIGHTING_ERA_PRESETS[id]).toBeDefined();
      expect(WEATHER_ERA_PRESETS[id]).toBeDefined();
    }
  });
});

describe('shared anchor contract', () => {
  it('every EraSceneState exposes the same named anchor slots', () => {
    for (const id of ERA_IDS) {
      const state = ERA_SCENE_STATES[id];
      expect(state.id).toBe(id);
      expect(Object.keys(state.anchors).sort()).toEqual(
        [...REQUIRED_ANCHOR_KEYS].sort(),
      );
      for (const key of REQUIRED_ANCHOR_KEYS) {
        const anchor = state.anchors[key];
        expect(anchor).toBeDefined();
        for (const prop of ['x', 'y', 'z', 'width', 'height', 'depth'] as const) {
          expect(typeof anchor[prop]).toBe('number');
          expect(Number.isFinite(anchor[prop])).toBe(true);
        }
      }
    }
  });

  it('per-era anchor dimensions differ (morphable), matching ERA_ANCHOR_SLOTS', () => {
    for (const id of ERA_IDS) {
      expect(ERA_SCENE_STATES[id].anchors).toEqual(ERA_ANCHOR_SLOTS[id]);
    }
    // Sanity: at least one dimension changes across the timeline, so the morph
    // engine has something to interpolate.
    const widths = ERA_IDS.map(
      (id) => ERA_SCENE_STATES[id].anchors.window.width,
    );
    expect(new Set(widths).size).toBeGreaterThan(1);
  });

  it('every engine content key exists on every era state (empty-but-typed stubs)', () => {
    for (const id of ERA_IDS) {
      const state = ERA_SCENE_STATES[id];
      for (const key of REQUIRED_CONTENT_KEYS) {
        expect(state).toHaveProperty(key);
        expect(Array.isArray(state[key])).toBe(true);
      }
      expect(state.sfx).toBeDefined();
    }
  });
});