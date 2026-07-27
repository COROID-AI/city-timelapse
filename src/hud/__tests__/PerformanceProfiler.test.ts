/**
 * Tests for the PerformanceProfiler — FPS measurement and agent cap registry.
 *
 * Verifies that the profiler samples renderer.info, computes a rolling FPS
 * average, registers/queries agent caps, and reports the performance gate
 * status (meetsFloor).
 */
import { describe, expect, it } from 'vitest';
import type { WebGLRenderer } from 'three';
import {
  ERA_AGENT_CAPS,
  FPS_FLOOR,
  createPerformanceProfiler,
} from '../PerformanceProfiler.js';

/** Minimal WebGLRenderer mock exposing only `info`. */
function mockRenderer(): WebGLRenderer {
  const info = {
    render: { calls: 10, triangles: 50000 },
    memory: { geometries: 5, textures: 8 },
    programs: null,
    autoReset: true,
    custom: null,
  };
  return { info } as unknown as WebGLRenderer;
}

describe('PerformanceProfiler — agent caps', () => {
  it('registers and queries agent caps', () => {
    const profiler = createPerformanceProfiler(mockRenderer(), { createHud: false });
    profiler.registerAgentCap('vehicles', { label: 'Vehicles', max: 6 });
    profiler.registerAgentCap('peds', { label: 'Peds', max: 12 });
    const caps = profiler.getAgentCaps();
    expect(caps.vehicles.max).toBe(6);
    expect(caps.peds.label).toBe('Peds');
  });

  it('exposes documented era agent caps', () => {
    expect(ERA_AGENT_CAPS.vehicles).toBeDefined();
    expect(ERA_AGENT_CAPS.pedestrians).toBeDefined();
    expect(ERA_AGENT_CAPS.cyclists).toBeDefined();
    expect(ERA_AGENT_CAPS.dogs).toBeDefined();
    // Every cap max should be a positive integer.
    for (const key of Object.keys(ERA_AGENT_CAPS)) {
      expect(ERA_AGENT_CAPS[key].max).toBeGreaterThan(0);
      expect(Number.isInteger(ERA_AGENT_CAPS[key].max)).toBe(true);
    }
  });
});

describe('PerformanceProfiler — FPS sampling', () => {
  it('reports a finite FPS after sampling frames', () => {
    const profiler = createPerformanceProfiler(mockRenderer(), { createHud: false });
    // Simulate ~16ms frames (≈60 FPS).
    for (let i = 0; i < 30; i++) {
      profiler.update(16.67);
    }
    const fps = profiler.getFps();
    expect(fps).toBeGreaterThan(0);
    expect(Number.isFinite(fps)).toBe(true);
  });

  it('approximates 60 FPS for ~16ms frames', () => {
    const profiler = createPerformanceProfiler(mockRenderer(), { createHud: false });
    for (let i = 0; i < 60; i++) {
      profiler.update(16.67);
    }
    const fps = profiler.getFps();
    expect(fps).toBeGreaterThan(50);
    expect(fps).toBeLessThan(70);
  });

  it('reports draw-call and triangle counts from renderer.info', () => {
    const renderer = mockRenderer();
    const profiler = createPerformanceProfiler(renderer, { createHud: false });
    profiler.update(16);
    expect(profiler.getDrawCalls()).toBe(10);
    expect(profiler.getTriangles()).toBe(50000);
  });
});

describe('PerformanceProfiler — performance gate', () => {
  it('meetsFloor is true when FPS >= floor', () => {
    const profiler = createPerformanceProfiler(mockRenderer(), { createHud: false });
    for (let i = 0; i < 60; i++) {
      profiler.update(16.67);
    }
    expect(profiler.meetsFloor()).toBe(true);
  });

  it('meetsFloor is false when FPS < floor', () => {
    const profiler = createPerformanceProfiler(mockRenderer(), { createHud: false });
    // Simulate ~40ms frames (≈25 FPS — below floor).
    for (let i = 0; i < 60; i++) {
      profiler.update(40);
    }
    expect(profiler.meetsFloor()).toBe(false);
  });

  it('floor is 30 FPS as required by the spec', () => {
    expect(FPS_FLOOR).toBe(30);
  });
});
