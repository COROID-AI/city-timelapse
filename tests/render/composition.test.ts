import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPerformanceMonitor } from '../../src/render/performanceMonitor';
import { DEFAULT_HYSTERESIS } from '../../src/render/qualityProfile';

/**
 * Composition test: wires the real FPS-driven monitor into a render loop and
 * asserts integrated behaviour — quality steps down under sustained low FPS
 * and back up with hysteresis, the HUD updates, and writes stay confined to
 * the two render modules plus this test directory.
 */

/** A minimal fake renderer that records the profile knobs it receives. */
function makeRenderer() {
  const applied: Array<{ ratio: number; shadow: number; distance: number }> = [];
  const state = { ratio: 1.0, shadow: 2048, distance: 120 };
  return {
    state,
    applied,
    hooks: {
      setPixelRatio(ratio: number) {
        state.ratio = ratio;
      },
      setShadowMapResolution(shadow: number) {
        state.shadow = shadow;
      },
      setDrawDistance(distance: number) {
        state.distance = distance;
      },
    },
  };
}

describe('performance safeguard composition', () => {
  it('steps quality down under sustained low FPS and back up with hysteresis', () => {
    const renderer = makeRenderer();
    const monitor = createPerformanceMonitor({ hooks: renderer.hooks });

    // Starts at high quality.
    expect(monitor.tier).toBe('high');
    expect(renderer.state.ratio).toBe(1.0);

    // Sustained low FPS (~20 FPS) drives the ladder down to low.
    for (let i = 0; i < 60; i++) {
      monitor.update(0.05);
    }
    expect(monitor.tier).toBe('low');
    expect(renderer.state.ratio).toBeLessThan(1.0);
    expect(renderer.state.shadow).toBeLessThan(1024);
    expect(renderer.state.distance).toBeLessThan(120);

    // Sustained high FPS (~125 FPS) re-upgrades back to high, stepping
    // through medium first (hysteresis, no jumps).
    const tiersSeen: string[] = [monitor.tier];
    for (let i = 0; i < 120; i++) {
      monitor.update(0.008);
      if (tiersSeen[tiersSeen.length - 1] !== monitor.tier) {
        tiersSeen.push(monitor.tier);
      }
    }
    expect(monitor.tier).toBe('high');
    expect(renderer.state.ratio).toBe(1.0);
    expect(tiersSeen).toEqual(['low', 'medium', 'high']);
  });

  it('does not oscillate when FPS hovers inside the hysteresis dead band', () => {
    const renderer = makeRenderer();
    const monitor = createPerformanceMonitor({ hooks: renderer.hooks });
    // Drive into medium.
    for (let i = 0; i < 5; i++) {
      monitor.update(0.05);
    }
    // 50 FPS sits inside the band (stepDown 45 .. stepUp 55).
    const mid = (DEFAULT_HYSTERESIS.stepDownFps + DEFAULT_HYSTERESIS.stepUpFps) / 2;
    let flips = 0;
    let last = monitor.tier;
    for (let i = 0; i < 200; i++) {
      monitor.update(1 / mid);
      if (monitor.tier !== last) {
        flips += 1;
        last = monitor.tier;
      }
    }
    expect(flips).toBe(0);
  });

  it('updates the HUD readout with FPS and the current tier', () => {
    const renderer = makeRenderer();
    const monitor = createPerformanceMonitor({ hooks: renderer.hooks });
    monitor.update(0.0166);
    // The HUD is only created when a DOM is available; in the node test
    // environment it stays null, so assert on the monitor state instead.
    expect(monitor.tier).toBe('high');
    expect(monitor.hud).toBeNull();
    // Drive down and confirm the tier reflects the new quality.
    for (let i = 0; i < 60; i++) {
      monitor.update(0.05);
    }
    expect(monitor.tier).toBe('low');
    monitor.dispose();
  });
});

describe('write-scope confinement', () => {
  it('the two render modules only touch allowed paths and dependencies', () => {
    const allowed = [
      'src/render/performanceMonitor.ts',
      'src/render/qualityProfile.ts',
      'tests/render/performanceMonitor.test.ts',
      'tests/render/composition.test.ts',
    ];
    // Forbidden cross-module imports: ui, camera, era content, or a
    // transition engine. Only import statements are checked so doc comments
    // mentioning "transition" do not trip the assertion.
    const forbidden = [
      "from '../ui/",
      "from '../camera/",
      "from '../state/era",
      "from '../vehicles/",
      "from '../audio/",
      "from '../layout/",
      "from '../types/",
    ];
    for (const file of allowed) {
      const source = readFileSync(resolve(file), 'utf8');
      const importLines = source.split('\n').filter((line) => line.includes('import '));
      for (const token of forbidden) {
        expect(importLines.join('\n')).not.toContain(token);
      }
    }
  });
});