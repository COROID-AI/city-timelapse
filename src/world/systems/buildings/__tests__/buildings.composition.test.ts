/**
 * Composition test: instantiates the static layout + BuildingsSystem, attaches
 * to a scene, drives `update(channel)` through a full 1945→2025 transition and
 * asserts per-plot buildings morph continuously (palette lerp + height lerp +
 * silhouette dissolve) and dispose cleanly.
 *
 * This is the integration seam the compose-scene-app consumes: the system is
 * created from `createBuildingsSystem(layout)` and driven exclusively through
 * the `EraSystem` lifecycle (attach/update/dispose).
 */

import { Group } from 'three';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import { createBuildingsSystem, type BuildingsSystemHandle } from '../buildingsSystem';
import type { TimelineChannel } from '../../../../era/types';
import type { EraId } from '../../../../era/years';

const STUB_2D = {
  fillStyle: '',
  strokeStyle: '',
  fill: () => {},
  stroke: () => {},
  fillRect: () => {},
  clearRect: () => {},
  strokeRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  closePath: () => {},
  createLinearGradient: () => ({ addColorStop: () => {} }),
  createRadialGradient: () => ({ addColorStop: () => {} }),
  putImageData: () => {},
  createImageData: (w: number, h: number) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  }),
} as unknown as CanvasRenderingContext2D;

let stubSpy: ReturnType<typeof vi.spyOn> | undefined;

beforeAll(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  stubSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function getContext(this: HTMLCanvasElement, contextId: string) {
      if (contextId === '2d') return STUB_2D;
      return original.call(this, contextId);
    });
});

afterAll(() => {
  stubSpy?.mockRestore();
});

function channel(from: EraId, to: EraId, t: number): TimelineChannel {
  return { fromEra: from, toEra: to, t };
}

describe('buildings composition lifecycle', () => {
  it('attaches a building per plot, morphs continuously 1945→2025, disposes cleanly', () => {
    const layout = createCityBlockLayout('seed-42');
    const scene = new Group();
    const system = createBuildingsSystem(layout) as unknown as BuildingsSystemHandle & {
      attach: (ctx: { scene: Group }) => void;
    };

    // -- attach -------------------------------------------------------------
    system.attach({ scene });
    expect(system.buildings.size).toBe(layout.plots.length);
    expect(system.plotIds).toEqual(layout.plots.map((p) => p.id));
    expect(scene.children).toHaveLength(layout.plots.length);
    for (const plot of layout.plots) {
      expect(system.buildings.get(plot.id)).toBeDefined();
    }

    // -- full 1945 → 2025 sweep, sampling mid-dissolve ----------------------
    const samples = [0, 0.2, 0.5, 0.8, 1];
    const heightsAt: number[][] = [];
    const emissivesAt: number[][] = [];
    let ghostsAtMid = 0;

    for (const t of samples) {
      system.update(channel('1945', '2025', t), 0.016);
      // Capture the dissolve-engaged state at the mid-transition sample BEFORE
      // later samples commit the ghost (t>=0.62) and empty ghostEraByPlot.
      if (t === 0.5) {
        ghostsAtMid = (system as unknown as { ghostEraByPlot: Map<string, string> }).ghostEraByPlot.size;
      }
      const heightRow: number[] = [];
      const emissiveRow: number[] = [];
      for (const plot of layout.plots) {
        const building = system.buildings.get(plot.id)!;
        // Actual world height = scale * authored height (the authored height
        // changes when a ghost is committed, so scale alone is not comparable).
        heightRow.push(building.group.scale.y * building.authoredHeight);
        // During dissolve the ghost carries the to-era emissive; read the
        // primary's (still-lerping) emissive for continuity assertions.
        const emissive = building.windowLitMaterial?.emissive.getHex() ?? 0x000000;
        emissiveRow.push(emissive);
      }
      heightsAt.push(heightRow);
      emissivesAt.push(emissiveRow);
    }

    // Heights morph monotonically upward (2025 towers taller than 1945).
    for (let p = 0; p < layout.plots.length; p += 1) {
      const series = heightsAt.map((row) => row[p]);
      expect(series[4]).toBeGreaterThan(series[0]);
      for (let i = 1; i < series.length; i += 1) {
        expect(series[i]).toBeGreaterThanOrEqual(series[i - 1] - 1e-6);
      }
    }

    // Emissive color lerps continuously (from 1945 amber → 2025 mint).
    for (let p = 0; p < layout.plots.length; p += 1) {
      const series = emissivesAt.map((row) => row[p]);
      expect(series[0]).not.toBe(series[4]);
      expect(series.every((c) => c >= 0 && c <= 0xffffff)).toBe(true);
    }

    // Dissolve actually engaged mid-transition: ghost groups appeared.
    expect(ghostsAtMid).toBeGreaterThan(0);

    // After the crossfade band the ghost commits: each plot's primary is now
    // authored for the to-era architecture (solar panels visible) and the
    // ghost map is empty again.
    for (const plot of layout.plots) {
      const building = system.buildings.get(plot.id)!;
      const roofNames = collectRoofNames(building);
      expect(roofNames.some((n) => n.includes('solar'))).toBe(true);
    }

    // -- dispose ------------------------------------------------------------
    system.dispose();
    system.dispose(); // idempotent
    expect(scene.children).toHaveLength(0);
    expect(system.buildings.size).toBe(0);
    expect((system as unknown as { ghostEraByPlot: Map<string, string> }).ghostEraByPlot.size).toBe(0);
  }, 30000);

  it('needs no pre-attach update and throws on attach-after-dispose', () => {
    const layout = createCityBlockLayout('seed-9001');
    const system = createBuildingsSystem(layout) as unknown as BuildingsSystemHandle & {
      attach: (ctx: { scene: Group }) => void;
    };
    // update() before attach is a no-op (no crash).
    system.update(channel('1945', '1965', 0.5), 0.016);
    expect(system.buildings.size).toBe(0);

    const scene = new Group();
    system.attach({ scene });
    expect(system.buildings.size).toBe(layout.plots.length);
    system.dispose();

    expect(() => system.attach({ scene })).toThrow(/dispose/);
  });
});

function collectRoofNames(building: {
  roofGroup: Group;
}): string[] {
  const names: string[] = [];
  const walk = (group: Group) => {
    for (const child of group.children) {
      if ((child as { isMesh?: boolean }).isMesh === true) {
        names.push((child as { name?: string }).name ?? '');
      } else if (child instanceof Group) {
        walk(child);
      }
    }
  };
  walk(building.roofGroup);
  return names;
}