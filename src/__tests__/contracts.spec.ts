import { describe, expect, it } from 'vitest';

import { BLOCK, CAMERA_ANCHORS, CURB, SIDEWALK, STREET } from '../layout';
import { ERA_IDS, type EraAmbience, type EraContent, type EraId, type EraLayout, type SimState } from '../types';

/**
 * Contracts smoke test — verifies the frozen shared contracts that every
 * parallel module authors against exist and have the expected shape.
 */
describe('shared era contracts', () => {
  it('defines the five eras in chronological order', () => {
    expect(ERA_IDS).toEqual(['1945', '1965', '1985', '2005', '2025']);
  });

  it('freezes the layout constants', () => {
    expect(BLOCK.width).toBeGreaterThan(0);
    expect(STREET.laneCount).toBe(4);
    expect(SIDEWALK.height).toBeGreaterThan(0);
    expect(CURB.height).toBeGreaterThan(0);
    expect(Object.isFrozen(BLOCK)).toBe(true);
    expect(Object.isFrozen(STREET)).toBe(true);
    expect(Object.isFrozen(SIDEWALK)).toBe(true);
    expect(Object.isFrozen(CURB)).toBe(true);
  });

  it('provides one camera anchor per era', () => {
    expect(CAMERA_ANCHORS).toHaveLength(ERA_IDS.length);
    expect(CAMERA_ANCHORS.map((a) => a.id)).toEqual(ERA_IDS);
    CAMERA_ANCHORS.forEach((anchor) => {
      expect(anchor.position).toBeDefined();
      expect(anchor.lookAt).toBeDefined();
    });
  });

  it('declares the EraId union with exactly the five periods', () => {
    const ids: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
    expect(ids).toEqual(ERA_IDS);
  });

  it('exposes EraLayout and SimState shapes', () => {
    // Type-level contract checks: these assignments must compile.
    const layout: EraLayout = {
      block: BLOCK,
      street: STREET,
      sidewalk: SIDEWALK,
      curb: CURB,
      cameraAnchors: [...CAMERA_ANCHORS],
    };
    const state: SimState = {
      currentEra: '1945',
      currentEraIndex: 0,
      elapsedMs: 0,
      frame: 0,
      isTransitioning: false,
      pendingEra: null,
      paused: false,
    };
    expect(layout.block.width).toBe(BLOCK.width);
    expect(state.currentEra).toBe('1945');
  });

  it('accepts an EraContent and EraAmbience shaped object', () => {
    const content: EraContent = {
      build: () => undefined,
      update: () => undefined,
      dispose: () => undefined,
      interactivePoints: [],
      isFastPath: false,
    };
    const ambience: EraAmbience = {
      build: () => undefined,
      update: () => undefined,
      dispose: () => undefined,
    };
    expect(content.interactivePoints).toEqual([]);
    expect(typeof ambience.build).toBe('function');
  });
});