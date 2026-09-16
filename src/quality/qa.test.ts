// @vitest-environment node
/**
 * qa.test.ts — final acceptance QA for the city timelapse (1945–2025).
 *
 * End-to-end headless walk of the COMPOSED app: boots `AppComposition` with a
 * fake Web Audio context (no WebGL, no rAF, no DOM), then drives every slider
 * stop through `EraSystem.selectEra` — the exact method the timeline invokes —
 * and asserts:
 *
 *  - layer registration and the composed graph boots (the app builds);
 *  - content counts per era (buildings, storefronts, advertisements, street
 *    props, vehicles, pedestrians, atmosphere);
 *  - era integrity (registry order, validity, frozen definitions, per-era
 *    identity of every transformed layer);
 *  - absence of runtime errors across the walk (console.error stays silent);
 *  - the README documents install/run/build/test instructions;
 *  - the performance/memory reporting hook works against the walked scene.
 */

import readmeText from '../../README.md?raw';
import { describe, expect, it, vi } from 'vitest';
import { Color } from 'three';

import { AppComposition, CONTROLLER_LAYER_ID } from '../app/composition';
import {
  ERA_IDS,
  ERAS,
  getEraDefinition,
  isEraId,
  type EraDefinition,
  type EraId,
} from '../eras/eraSystem';
import { BLOCK_LOT_IDS } from '../block/blockLayer';
import { BUILDING_VARIANT_BY_ERA } from '../block/buildings';
import { ATMOSPHERE_LAYER_ID } from '../atmosphere/atmosphereLayer';
import { PEDESTRIAN_LAYER_ID } from '../pedestrians/pedestrianLayer';
import { PROP_KINDS, type PropKind } from '../props/streetPropsLayer';
import { createFakeAudioContext } from '../audio/audioContextFake';
import {
  QUALITY_REPORT_HOOK,
  createPerformanceReport,
  type QualityReportHook,
} from './qualityConfig';

/** The five slider stops in registry order (boot era is 1945). */
const SLIDER_ORDER: readonly EraId[] = [1945, 1965, 1985, 2005, 2025];

/** Advances the composed frame loop until the era tween settles. */
function driveToSettled(app: AppComposition, stepSeconds = 0.05, maxSteps = 2000): void {
  let guard = 0;
  while (app.eraSystem.getState().phase === 'transitioning' && guard < maxSteps) {
    app.runtime.step(stepSeconds);
    guard += 1;
  }
  expect(app.eraSystem.getState().phase).toBe('idle');
}

/** Hex sky color the atmosphere layer applied to the runtime scene. */
function sceneSkyHex(app: AppComposition): string {
  const background = app.runtime.scene.background;
  expect(background).toBeInstanceOf(Color);
  return (background as Color).getHexString();
}

/** Prop instance counts of the currently visible street-props era. */
function streetPropCounts(app: AppComposition): Readonly<Record<PropKind, number>> {
  const counts: Record<string, number> = {};
  for (const kind of PROP_KINDS) counts[kind] = 0;
  const root = app.streetProps.createRoot();
  for (const eraGroup of root.children) {
    if (!eraGroup.visible) continue;
    for (const prop of eraGroup.children) {
      const kind = prop.userData.kind as PropKind | undefined;
      if (kind !== undefined) counts[kind] = (counts[kind] ?? 0) + 1;
    }
  }
  return counts as Readonly<Record<PropKind, number>>;
}

/** Optional street-prop kinds the layer documents per era. */
const OPTIONAL_PROPS_BY_ERA: Readonly<Record<EraId, { readonly present: readonly PropKind[]; readonly absent: readonly PropKind[] }>> = {
  1945: { present: ['newspaper-stand'], absent: ['parking-meter', 'phone-booth', 'ev-charger'] },
  1965: { present: ['parking-meter', 'newspaper-stand', 'phone-booth'], absent: ['ev-charger'] },
  1985: { present: ['parking-meter', 'newspaper-stand', 'phone-booth'], absent: ['ev-charger'] },
  2005: { present: ['parking-meter'], absent: ['newspaper-stand', 'phone-booth', 'ev-charger'] },
  2025: { present: ['parking-meter', 'ev-charger'], absent: ['newspaper-stand', 'phone-booth'] },
};

const ALWAYS_PROPS: readonly PropKind[] = ['lamp', 'tree', 'hydrant', 'bench', 'trash'];

describe('QA — five-era end-to-end walk through the composed app', () => {
  it('boots the composed app headlessly: every layer registers and the graph builds', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });

    expect(app.runtime.hasLayer('block')).toBe(true);
    expect(app.runtime.hasLayer('street-props')).toBe(true);
    expect(app.runtime.hasLayer('vehicles')).toBe(true);
    expect(app.runtime.hasLayer(PEDESTRIAN_LAYER_ID)).toBe(true);
    expect(app.runtime.hasLayer(ATMOSPHERE_LAYER_ID)).toBe(true);
    expect(app.runtime.hasLayer(CONTROLLER_LAYER_ID)).toBe(true);
    expect(app.runtime.layerCount).toBe(6);

    expect(app.eraSystem.getState()).toMatchObject({ current: 1945, next: null, phase: 'idle' });

    app.dispose();
    expect(app.isDisposed).toBe(true);
  });

  it('walks all five eras end-to-end with correct content counts and era identity', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });

    for (const eraId of SLIDER_ORDER) {
      app.selectEra(eraId);
      driveToSettled(app);
      app.runtime.step(1 / 60);
      const era: EraDefinition = ERAS[eraId];

      // Era state machine settled on the destination.
      expect(app.eraSystem.getState()).toMatchObject({ current: eraId, next: null, phase: 'idle' });

      // Buildings: one record per lot, era variant deployed, positive mass.
      expect(Object.keys(app.block.lotBuildings)).toHaveLength(BLOCK_LOT_IDS.length);
      for (const lotId of BLOCK_LOT_IDS) {
        const record = app.block.lotBuildings[lotId];
        expect(record.variantKey).toBe(BUILDING_VARIANT_BY_ERA[eraId]);
        expect(record.eraId).toBe(eraId);
        expect(record.heightMeters).toBeGreaterThan(0);
        expect(record.floors).toBeGreaterThan(0);
      }

      // Storefronts: one facade per lot with the era's signage anatomy.
      expect(app.block.storefronts.length).toBe(BLOCK_LOT_IDS.length);
      for (const facade of app.block.storefronts) {
        expect(facade.eraId).toBe(eraId);
        expect(facade.signageKey).toBe(era.storefronts.signage);
        expect(facade.displayWindowCount).toBeGreaterThan(0);
        expect(facade.doorCount).toBeGreaterThan(0);
      }

      // Advertisements: rooftop + facade per lot, era display technology.
      expect(app.block.advertisements.length).toBe(BLOCK_LOT_IDS.length * 2);
      for (const ad of app.block.advertisements) {
        expect(ad.eraId).toBe(eraId);
        expect(ad.technology).toBe(era.advertisements.technology);
        expect(ad.animated).toBe(era.advertisements.animated);
        expect(ad.copy.length).toBeGreaterThan(0);
      }

      // Street props: always-kind presence and era optional kinds.
      const props = streetPropCounts(app);
      expect(app.streetProps.getState().activeEra).toBe(eraId);
      for (const kind of ALWAYS_PROPS) expect(props[kind]).toBeGreaterThan(0);
      for (const kind of OPTIONAL_PROPS_BY_ERA[eraId].present) {
        expect(props[kind]).toBeGreaterThan(0);
      }
      for (const kind of OPTIONAL_PROPS_BY_ERA[eraId].absent) {
        expect(props[kind]).toBe(0);
      }

      // Vehicles: era fleet deployed and populated.
      expect(app.vehicles.currentEra).toBe(eraId);
      expect(app.vehicles.count).toBeGreaterThan(0);

      // Pedestrians: era outfits everywhere.
      expect(app.pedestrians.activeEra).toBe(eraId);
      expect(app.pedestrians.pedestrianCount).toBeGreaterThan(0);
      expect(app.pedestrians.outfits().every((outfit) => outfit.era === eraId)).toBe(true);

      // Atmosphere: settled era sky matches the registry palette.
      expect(app.atmosphere.getState().eraId).toBe(eraId);
      expect(app.atmosphere.getState().transitioning).toBe(false);
      expect(sceneSkyHex(app)).toBe(era.palette.sky.slice(1).toLowerCase());

      // Audio ambience and navigation adopted the era.
      expect(app.audio.activeEra).toBe(eraId);
      expect(app.audio.nodeCount).toBeGreaterThan(0);
      expect(app.navigation.activeEraId).toBe(eraId);
    }

    // One whoosh per slider selection after the 1945 boot (four selections).
    expect(app.audio.stats.whooshes).toBe(ERA_IDS.length - 1);

    // The walk reverses cleanly back to the first stop.
    app.selectEra(1945);
    driveToSettled(app);
    expect(app.block.currentEra).toBe(1945);
    expect(app.vehicles.currentEra).toBe(1945);
    expect(app.pedestrians.activeEra).toBe(1945);
    expect(app.atmosphere.getState().eraId).toBe(1945);

    app.dispose();
  });

  it('exposes the performance/memory report hook against the walked scene', () => {
    const app = new AppComposition({ audioContext: createFakeAudioContext() });
    const eras: readonly EraId[] = [1965, 1985, 2005, 2025];
    for (const eraId of eras) {
      app.selectEra(eraId);
      driveToSettled(app);
    }
    app.runtime.step(1 / 60);

    const report = createPerformanceReport(app.runtime.scene, {
      width: 1280,
      height: 720,
      devicePixelRatio: 3,
      frameCount: 60,
    });

    expect(report.hook).toBe(QUALITY_REPORT_HOOK);
    expect(report.effectivePixelRatio).toBe(2); // 3x display capped at 2x
    expect(report.canvasPixels).toBe(1280 * 720 * 4);
    expect(report.frameCount).toBe(60);
    expect(report.meshCount).toBeGreaterThan(0);
    expect(report.geometryCount).toBeGreaterThan(0);
    expect(report.materialCount).toBeGreaterThan(0);
    expect(report.instancingEnabled).toBe(true);
    expect(report.estimatedMemoryBytes).toBeGreaterThan(0);
    expect(report.memoryLabel).toMatch(/[KM]?B$/);

    // Seeding-hook consumption shape: a sink receives and stores the snapshot.
    const seeds: string[] = [];
    const sink: QualityReportHook = (snapshot) => seeds.push(snapshot.memoryLabel);
    sink(report);
    expect(seeds).toEqual([report.memoryLabel]);

    app.dispose();
  });
});

describe('QA — era registry integrity', () => {
  it('exposes exactly the five slider eras in order and rejects others', () => {
    expect(ERA_IDS).toEqual(SLIDER_ORDER);
    expect(Object.keys(ERAS)).toEqual(SLIDER_ORDER.map(String));
    expect(Object.keys(ERAS)).toHaveLength(5);

    for (const eraId of SLIDER_ORDER) expect(isEraId(eraId)).toBe(true);
    for (const invalid of [2055, 1946, 1999, 2030, 0, -1, '1945', null, undefined]) {
      expect(isEraId(invalid)).toBe(false);
    }
  });

  it('returns deeply frozen, complete definitions with real content', () => {
    for (const eraId of SLIDER_ORDER) {
      const era = getEraDefinition(eraId);
      expect(era).toBe(ERAS[eraId]);
      expect(era.id).toBe(eraId);
      expect(era.label).toBe(String(eraId));
      expect(era.title.length).toBeGreaterThan(0);
      expect(Object.isFrozen(era)).toBe(true);

      // Palette: hex colors and non-empty swatch sets.
      for (const swatch of [
        era.palette.buildings,
        era.palette.accents,
        era.palette.signs,
      ]) {
        expect(swatch.length).toBeGreaterThan(0);
        for (const color of swatch) expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      for (const color of [era.palette.sky, era.palette.haze, era.palette.ground, era.palette.light]) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }

      // Content arrays are populated and frozen read-only.
      expect(Object.isFrozen(era.vehicles.types)).toBe(true);
      expect(era.vehicles.types.length).toBeGreaterThan(0);
      expect(era.vehicles.parkedTypes.length).toBeGreaterThan(0);
      expect(era.vehicles.colors.length).toBeGreaterThan(0);
      expect(era.outfits.styles.length).toBeGreaterThan(0);
      expect(era.outfits.palette.length).toBeGreaterThan(0);
      expect(era.outfits.accessories.length).toBeGreaterThan(0);
      expect(era.outfits.props.length).toBeGreaterThan(0);
      expect(era.storefronts.shopTypes.length).toBeGreaterThan(0);
      expect(era.storefronts.awningColors.length).toBeGreaterThan(0);
      expect(era.advertisements.copy.length).toBeGreaterThan(0);
      expect(era.advertisements.colors.length).toBeGreaterThan(0);

      // Atmosphere + SFX numbers are finite and within documented ranges.
      expect(Number.isFinite(era.atmosphere.fogDensity)).toBe(true);
      expect(era.atmosphere.fogDensity).toBeGreaterThanOrEqual(0);
      expect(era.atmosphere.fogDensity).toBeLessThanOrEqual(1);
      expect(Number.isFinite(era.sfx.trafficLevel)).toBe(true);
      expect(era.sfx.trafficLevel).toBeGreaterThanOrEqual(0);
      expect(era.sfx.masterLevel).toBeGreaterThan(0);
    }

    // Unknown eras are rejected by the accessor.
    for (const invalid of [2055, 1946]) {
      expect(() => getEraDefinition(invalid as EraId)).toThrow(/unknown era/);
    }
  });
});

describe('QA — no runtime errors + README run instructions', () => {
  it('walks every era without uncaught errors or console.error output', () => {
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });

    const app = new AppComposition({ audioContext: createFakeAudioContext() });
    try {
      for (const eraId of SLIDER_ORDER) {
        expect(() => app.selectEra(eraId)).not.toThrow();
        expect(() => driveToSettled(app)).not.toThrow();
        expect(() => app.runtime.step(1 / 60)).not.toThrow();
      }
      expect(() => app.resize(960, 640)).not.toThrow();
      expect(() => app.dispose()).not.toThrow();
      expect(() => app.dispose()).not.toThrow(); // idempotent teardown
    } finally {
      spy.mockRestore();
    }

    expect(errors).toEqual([]);
  });

  it('documents install/run/build/test instructions in the README', () => {
    const readme = readmeText;
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run dev');
    expect(readme).toContain('npm run build');
    expect(readme).toContain('npm test');
    // The five implemented slider stops are documented.
    for (const eraId of SLIDER_ORDER) expect(readme).toContain(String(eraId));
  });
});