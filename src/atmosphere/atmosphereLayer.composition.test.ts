// @vitest-environment node
//
// Headless composition test — AtmosphereLayer integrated with SceneRuntime and
// EraSystem. Verifies that attach registers the layer into the scene graph, a
// five-era walk applies atmosphere changes, EraSystem transitions drive the
// blend, and disposal clears every atmospheric effect.

import { Color, FogExp2, Scene } from 'three';
import { describe, expect, it } from 'vitest';

import { SceneRuntime } from '../core/sceneRuntime';
import { ERA_IDS, ERAS, EraSystem, type EraId } from '../eras/eraSystem';
import { AtmosphereLayer } from './atmosphereLayer';

const RIG_NAME = 'atmosphere:light-rig';

function rigRegistered(scene: Scene): boolean {
  return scene.children.some((child) => child.name === RIG_NAME);
}

describe('atmosphere layer composition', () => {
  it('attaches into the headless runtime and walks all five eras', () => {
    const runtime = new SceneRuntime({ scene: new Scene() });
    const layer = new AtmosphereLayer({ scene: runtime.scene, initialEra: 1945 });
    runtime.attachLayer(layer);

    // attach registers into the scene graph through the runtime
    expect(runtime.layerCount).toBe(1);
    expect(runtime.hasLayer('atmosphere')).toBe(true);
    expect(rigRegistered(runtime.scene)).toBe(true);
    expect(runtime.scene.fog).not.toBeNull();
    expect(runtime.scene.background).not.toBeNull();

    const captured = new Map<
      EraId,
      { sky: string; fog: string; fogDensity: number; bloom: number }
    >();
    for (const eraId of ERA_IDS) {
      layer.applyEra(eraId, 1);
      runtime.step(1 / 60); // per-frame update applies the era to the graph

      const era = ERAS[eraId];
      const background = runtime.scene.background as Color;
      const fog = runtime.scene.fog as FogExp2;
      expect(background.getHexString()).toBe(era.palette.sky.slice(1).toLowerCase());
      expect(fog.color.getHexString()).toBe(era.atmosphere.fogColor.slice(1).toLowerCase());
      expect(fog.density).toBe(era.atmosphere.fogDensity);
      expect(layer.controllers.sun.intensity).toBe(era.atmosphere.sunIntensity);
      expect(layer.controllers.sun.position.y).toBeGreaterThan(0);
      expect(layer.postProcessing.bloomStrength).toBe(era.atmosphere.bloom);
      expect(layer.getState().eraId).toBe(eraId);
      expect(layer.getState().transitioning).toBe(false);

      captured.set(eraId, {
        sky: background.getHexString(),
        fog: fog.color.getHexString(),
        fogDensity: fog.density,
        bloom: layer.postProcessing.bloomStrength,
      });
    }

    // every era contributes a distinct atmosphere, and the neon era glows most
    expect(captured.size).toBe(5);
    expect(new Set([...captured.values()].map((c) => c.sky)).size).toBe(5);
    expect(new Set([...captured.values()].map((c) => c.fogDensity)).size).toBe(5);
    expect(captured.get(1985)!.bloom).toBeGreaterThan(captured.get(1965)!.bloom);
    expect(captured.get(1985)!.bloom).toBeGreaterThan(captured.get(2025)!.bloom);
  });

  it('follows EraSystem transitions and disposes cleanly', () => {
    const runtime = new SceneRuntime({ scene: new Scene() });
    const layer = new AtmosphereLayer({ scene: runtime.scene, initialEra: 1945 });
    runtime.attachLayer(layer);

    const system = new EraSystem(1945);
    const off = system.subscribe('era-transition', ({ to, progress }) => {
      layer.applyEra(to, progress);
    });

    // 1945 → 1985 through the eased transition state machine
    system.selectEra(1985);
    expect(layer.getState().transitioning).toBe(true);
    while (system.getState().phase === 'transitioning') {
      system.update(0.05);
      runtime.step(0.05);
    }
    expect(system.getState().current).toBe(1985);
    expect(layer.getState().eraId).toBe(1985);
    expect(layer.getState().transitioning).toBe(false);
    expect((runtime.scene.background as Color).getHexString()).toBe(
      ERAS[1985].palette.sky.slice(1).toLowerCase(),
    );

    // 1985 → 2025
    system.selectEra(2025);
    while (system.getState().phase === 'transitioning') {
      system.update(0.05);
      runtime.step(0.05);
    }
    expect(layer.getState().eraId).toBe(2025);
    expect(layer.postProcessing.bloomStrength).toBe(ERAS[2025].atmosphere.bloom);
    expect(layer.postProcessing.toneMapping).toBe('crisp-led');
    off();

    // disposal removes the rig and clears every atmospheric effect
    runtime.dispose();
    expect(runtime.layerCount).toBe(0);
    expect(runtime.scene.background).toBeNull();
    expect(runtime.scene.fog).toBeNull();
    expect(rigRegistered(runtime.scene)).toBe(false);
    expect(() => layer.applyEra(1965, 1)).toThrow(/disposed/i);
  });
});