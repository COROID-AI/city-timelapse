// @vitest-environment node
/**
 * qualityConfig.test.ts — unit coverage for the renderer quality configuration.
 *
 * Asserts the picker surface (pixel-ratio cap, antialias, geometry/material
 * reuse and instancing flags), the validated override merge and the
 * performance/memory report hook: effective pixel-ratio clamping, canvas pixel
 * accounting, shared geometry/material counting on a real three.js scene graph
 * and the memory estimate.
 */

import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

import {
  DEFAULT_QUALITY_CONFIG,
  QUALITY_REPORT_HOOK,
  createPerformanceReport,
  effectivePixelRatio,
  formatBytes,
  resolveQualityConfig,
  type QualityConfig,
} from './qualityConfig';

/** Scene with one shared geometry/material pair reused by six meshes plus
 * one unique mesh. */
function buildSharedScene(): Group {
  const root = new Group();
  const sharedGeometry = new BoxGeometry(1, 1, 1);
  const sharedMaterial = new MeshStandardMaterial({ color: 0xd8d8d8 });
  for (let i = 0; i < 6; i += 1) {
    const mesh = new Mesh(sharedGeometry, sharedMaterial);
    mesh.position.x = i;
    root.add(mesh);
  }
  const uniqueGeometry = new BoxGeometry(0.5, 0.5, 0.5);
  const uniqueMaterial = new MeshStandardMaterial({ color: 0x222222 });
  root.add(new Mesh(uniqueGeometry, uniqueMaterial));
  return root;
}

describe('quality config — picker surface and defaults', () => {
  it('exposes every picker field with polished high-end defaults', () => {
    expect(DEFAULT_QUALITY_CONFIG.pixelRatioCap).toBe(2);
    expect(DEFAULT_QUALITY_CONFIG.antialias).toBe(true);
    expect(DEFAULT_QUALITY_CONFIG.geometryReuse).toBe(true);
    expect(DEFAULT_QUALITY_CONFIG.materialReuse).toBe(true);
    expect(DEFAULT_QUALITY_CONFIG.instancing).toBe(true);
    expect(Object.isFrozen(DEFAULT_QUALITY_CONFIG)).toBe(true);
  });

  it('merges overrides onto defaults and returns a frozen config', () => {
    const typed: QualityConfig = {
      pixelRatioCap: 1.5,
      antialias: false,
      geometryReuse: false,
      materialReuse: true,
      instancing: false,
    };
    const config = resolveQualityConfig(typed);
    expect(config).toEqual(typed);
    expect(Object.isFrozen(config)).toBe(true);

    const partial = resolveQualityConfig({ antialias: false, pixelRatioCap: 1.5 });
    expect(partial).toEqual({
      pixelRatioCap: 1.5,
      antialias: false,
      geometryReuse: true,
      materialReuse: true,
      instancing: true,
    });

    expect(resolveQualityConfig()).toEqual(DEFAULT_QUALITY_CONFIG);
  });

  it('rejects invalid pixel-ratio caps and non-boolean flags', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => resolveQualityConfig({ pixelRatioCap: bad })).toThrow(/pixelRatioCap/);
    }
    expect(() =>
      resolveQualityConfig({ antialias: 'yes' as unknown as boolean }),
    ).toThrow(/antialias/);
    expect(() =>
      resolveQualityConfig({ instancing: 1 as unknown as boolean }),
    ).toThrow(/instancing/);
  });
});

describe('quality config — effective pixel ratio', () => {
  it('clamps the device pixel ratio to the configured cap', () => {
    expect(effectivePixelRatio(3, resolveQualityConfig())).toBe(2);
    expect(effectivePixelRatio(1, resolveQualityConfig())).toBe(1);
    expect(effectivePixelRatio(2.5, resolveQualityConfig({ pixelRatioCap: 1 }))).toBe(1);
    expect(effectivePixelRatio(1.25, resolveQualityConfig({ pixelRatioCap: 1.5 }))).toBe(1.25);
  });

  it('floors unreadable device ratios to 1', () => {
    expect(effectivePixelRatio(Number.NaN, resolveQualityConfig())).toBe(1);
    expect(effectivePixelRatio(-2, resolveQualityConfig())).toBe(1);
  });
});

describe('quality config — performance/memory report hook', () => {
  it('reports mesh counts and shared geometry/material reuse', () => {
    const report = createPerformanceReport(buildSharedScene());

    expect(report.hook).toBe(QUALITY_REPORT_HOOK);
    expect(report.meshCount).toBe(7);
    expect(report.geometryCount).toBe(2);
    expect(report.sharedGeometryCount).toBe(6);
    expect(report.geometryReuseRatio).toBeCloseTo(6 / 7, 6);
    expect(report.materialCount).toBe(2);
    expect(report.sharedMaterialCount).toBe(6);
    expect(report.materialReuseRatio).toBeCloseTo(6 / 7, 6);
    expect(report.instancingEnabled).toBe(true);
    expect(report.instancedMeshCount).toBe(0);
  });

  it('respects the pixel-ratio cap when accounting canvas pixels', () => {
    const report = createPerformanceReport(buildSharedScene(), {
      width: 100,
      height: 50,
      devicePixelRatio: 3, // retina display capped at 2x
      frameCount: 42,
    });
    expect(report.effectivePixelRatio).toBe(2);
    expect(report.canvasPixels).toBe(100 * 50 * 2 * 2);
    expect(report.frameCount).toBe(42);

    const at1x = createPerformanceReport(buildSharedScene(), {
      width: 100,
      height: 50,
      devicePixelRatio: 4,
    }, { pixelRatioCap: 1 });
    expect(at1x.effectivePixelRatio).toBe(1);
    expect(at1x.canvasPixels).toBe(100 * 50);
  });

  it('estimates a positive memory footprint and reports a label', () => {
    const report = createPerformanceReport(buildSharedScene());
    expect(report.estimatedMemoryBytes).toBeGreaterThan(0);
    expect(report.memoryLabel).toMatch(/[KM]?B$/);
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('propagates the resolved reuse/instancing flags from config overrides', () => {
    const disabled = createPerformanceReport(buildSharedScene(), {}, {
      geometryReuse: false,
      materialReuse: false,
      instancing: false,
    });
    expect(disabled.geometryReuseEnabled).toBe(false);
    expect(disabled.materialReuseEnabled).toBe(false);
    expect(disabled.instancingEnabled).toBe(false);
    // The measured ratio reports what the scene actually does, independently.
    expect(disabled.geometryReuseRatio).toBeCloseTo(6 / 7, 6);
    expect(disabled.materialReuseRatio).toBeCloseTo(6 / 7, 6);
  });
});