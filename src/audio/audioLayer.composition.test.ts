/**
 * audioLayer.composition.test.ts — headless composition test.
 *
 * Wires the audio layer to the real EraSystem event bus and drives both from
 * the SceneRuntime frame loop (a SceneLayer adapter), then walks all five era
 * transitions. Asserts that every era applies its ambience bed and that each
 * selection fires the transition whoosh, plus the crossfade math during an
 * eased transition and full node cleanup through runtime disposal.
 */
import { describe, expect, it } from 'vitest';
import { ERA_IDS, ERAS, EraSystem, type EraId } from '../eras/eraSystem';
import { SceneRuntime, type SceneLayer } from '../core/sceneRuntime';
import { AudioLayer, BED_SPECS } from './audioLayer';
import { FakeBiquadFilter, createFakeAudioContext, nodesByKind, paramOf } from './audioContextFake';

/** Era-exclusive tone frequencies proving every bed was synthesized once. */
const ERA_MARKER_FREQUENCIES = [55, 90, 38, 15625, 220, 880];

describe('AudioLayer composition with the headless runtime', () => {
  it('walks all five eras applying ambience and SFX through the frame loop', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);

    const eraSystem = new EraSystem(1945);
    const runtime = new SceneRuntime({ renderer: null });

    // The audio layer joins the frame loop like any scene layer: its adapter
    // feeds the era state machine and the layer's per-frame ambience updates.
    const adapter: SceneLayer = {
      id: 'audio-adapter',
      update({ delta }) {
        eraSystem.update(delta);
        layer.update(delta);
      },
      dispose() {
        layer.dispose();
      },
    };
    runtime.attachLayer(adapter);

    const selected: Array<{ from: EraId; to: EraId }> = [];
    eraSystem.subscribe('era-select', ({ from, to }) => {
      selected.push({ from, to });
      layer.applyEra(to, 0);
    });
    eraSystem.subscribe('era-transition', ({ to, progress }) => {
      layer.applyEra(to, progress);
    });
    eraSystem.subscribe('era-settled', ({ to }) => {
      layer.applyEra(to, 1);
    });

    // Boot the initial era; the frame loop immediately breathes the 1945 bed.
    layer.applyEra(1945, 1);
    const bootFilter = nodesByKind(ctx, 'filter').find(() => true)!;
    expect(paramOf(bootFilter, 'frequency').value).toBe(BED_SPECS[1945].noiseCutoff);
    for (let i = 0; i < 30; i += 1) runtime.step(1 / 60);
    expect(paramOf(bootFilter, 'frequency').value).not.toBe(BED_SPECS[1945].noiseCutoff);

    // UI SFX ride along with the walk.
    layer.playTick();
    layer.playClick('open');

    for (const to of ERA_IDS.slice(1)) {
      eraSystem.selectEra(to);
      let guard = 0;
      while (eraSystem.getState().phase === 'transitioning' && guard < 2000) {
        runtime.step(0.05);
        guard += 1;
      }
      expect(eraSystem.getState().phase).toBe('idle');
    }

    // The walk selects exactly the four remaining eras, each firing a whoosh.
    expect(selected).toEqual([
      { from: 1945, to: 1965 },
      { from: 1965, to: 1985 },
      { from: 1985, to: 2005 },
      { from: 2005, to: 2025 },
    ]);
    expect(layer.stats.whooshes).toBe(4);
    expect(layer.stats.ticks).toBe(1);
    expect(layer.stats.clicks).toEqual({ tap: 0, open: 1, close: 0 });

    // Every era's ambience bed was synthesized over the walk.
    const frequencies = new Set(
      nodesByKind(ctx, 'oscillator').map((node) => paramOf(node, 'frequency').value),
    );
    for (const marker of ERA_MARKER_FREQUENCIES) {
      expect(frequencies.has(marker)).toBe(true);
    }
    // Each selection synthesized one band-pass whoosh sweep (280 -> 2.6kHz).
    const bandpasses = nodesByKind(ctx, 'filter').filter(
      (node) => (node as FakeBiquadFilter).type === 'bandpass',
    );
    expect(bandpasses).toHaveLength(4);
    for (const bandpass of bandpasses) {
      expect(
        paramOf(bandpass, 'frequency').events.some(
          (event) => event.method === 'exponentialRampToValueAtTime' && event.value === 2600,
        ),
      ).toBe(true);
    }

    // The 2025 EV bed is settled; every earlier bed was retired.
    expect(layer.activeEra).toBe(2025);
    expect(layer.getBedGain(2025)).toBe(ERAS[2025].sfx.masterLevel);
    expect(layer.getBedGain(1945)).toBeNull();
    expect(layer.getBedGain(1965)).toBeNull();
    expect(layer.getBedGain(1985)).toBeNull();
    expect(layer.getBedGain(2005)).toBeNull();

    // Runtime disposal cascades into the audio layer: every node is freed.
    runtime.dispose();
    expect(layer.nodeCount).toBe(0);
    expect(ctx.nodes.every((node) => node.disconnectedCount > 0)).toBe(true);
  });

  it('crossfades ambience as an eased era transition progresses', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);

    const eraSystem = new EraSystem(1945);
    eraSystem.subscribe('era-select', ({ to }) => layer.applyEra(to, 0));
    eraSystem.subscribe('era-transition', ({ to, progress }) => layer.applyEra(to, progress));
    eraSystem.subscribe('era-settled', ({ to }) => layer.applyEra(to, 1));

    layer.applyEra(1945, 1);
    const initial1945 = ERAS[1945].sfx.masterLevel;
    const final2025 = ERAS[2025].sfx.masterLevel;

    eraSystem.selectEra(2025);
    expect(layer.stats.whooshes).toBe(1);
    // Selection starts the new bed silent while the old bed stays at full.
    expect(layer.getBedGain(2025)).toBe(0);
    expect(layer.getBedGain(1945)).toBe(initial1945);

    // Drive the eased transition and observe a true crossfade midpoint.
    let guard = 0;
    let sawMidpoint = false;
    while (eraSystem.getState().phase === 'transitioning' && guard < 2000) {
      eraSystem.update(0.05);
      layer.update(0.05);
      const g2025 = layer.getBedGain(2025);
      const g1945 = layer.getBedGain(1945);
      if (
        g2025 !== null &&
        g1945 !== null &&
        g2025 > 0 &&
        g2025 < final2025 &&
        g1945 > 0 &&
        g1945 < initial1945
      ) {
        sawMidpoint = true;
      }
      guard += 1;
    }

    expect(sawMidpoint).toBe(true);
    expect(layer.activeEra).toBe(2025);
    expect(layer.getBedGain(2025)).toBe(final2025);
    expect(layer.getBedGain(1945)).toBeNull();

    layer.dispose();
    expect(layer.nodeCount).toBe(0);
  });
});