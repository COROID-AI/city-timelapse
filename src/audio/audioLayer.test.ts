/**
 * audioLayer.test.ts — per-era ambience and procedural SFX generation tests.
 *
 * Runs entirely against the fake AudioContext (audioContextFake.ts): no real
 * audio output, no user-gesture gating, and every synthesized node is a plain
 * object with assertable parameters.
 */
import { describe, expect, it } from 'vitest';
import { ERA_IDS, ERAS } from '../eras/eraSystem';
import { AudioLayer, BED_SPECS, LAYER_MASTER_LEVEL, type PlayClickKind } from './audioLayer';
import {
  FakeBiquadFilter,
  FakeBufferSource,
  createFakeAudioContext,
  nodesByKind,
  paramOf,
} from './audioContextFake';

/** Lowest tone present in an era bed — 1985 owns the deep-rumble register. */
function lowestTone(eraId: (typeof ERA_IDS)[number]): number {
  return Math.min(...BED_SPECS[eraId].tones.map((tone) => tone.frequency));
}

/** Sum of tonal levels — 2025's EV bed should be the quietest. */
function totalToneLevel(eraId: (typeof ERA_IDS)[number]): number {
  return BED_SPECS[eraId].tones.reduce((sum, tone) => sum + tone.level, 0);
}

describe('AudioLayer construction and attach', () => {
  it('attaches an injected context and builds a master gain to destination', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);

    expect(layer.nodeCount).toBe(1);
    const master = ctx.nodes[0];
    expect(master.kind).toBe('gain');
    expect(paramOf(master, 'gain').value).toBe(LAYER_MASTER_LEVEL);
    expect(master.connections.some((node) => node.kind === 'destination')).toBe(true);
  });

  it('creates the context from an injected factory when attach has no argument', () => {
    const layer = new AudioLayer({ contextFactory: () => createFakeAudioContext() });
    layer.attach();
    expect(layer.nodeCount).toBe(1);
  });

  it('throws when no context can be obtained', () => {
    expect(() => new AudioLayer().attach()).toThrow(/AudioContext/);
  });

  it('rejects attaching twice', () => {
    const layer = new AudioLayer();
    layer.attach(createFakeAudioContext());
    expect(() => layer.attach(createFakeAudioContext())).toThrow(/already attached/);
  });

  it('throws when mutated before attach, but dispose stays a safe no-op', async () => {
    const layer = new AudioLayer();
    expect(() => layer.applyEra(1945, 1)).toThrow(/attach/);
    expect(() => layer.playTick()).toThrow(/attach/);
    expect(() => layer.playWhoosh()).toThrow(/attach/);
    expect(() => layer.playClick('open')).toThrow(/attach/);
    await expect(layer.resume()).rejects.toThrow(/attach/);
    expect(() => layer.dispose()).not.toThrow();
  });

  it('keeps the context suspended until resume() unlocks it from a gesture', async () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);

    expect(ctx.state).toBe('suspended');
    await layer.resume();
    expect(ctx.state).toBe('running');
    expect(ctx.resumeCalls).toBe(1);
    await layer.resume();
    expect(ctx.resumeCalls).toBe(2);
  });

  it('applies master mute to the master bus', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    const master = ctx.nodes.find(
      (node) => node.kind === 'gain' && node.connections.some((next) => next.kind === 'destination'),
    );
    expect(master).toBeDefined();
    expect(layer.isMuted).toBe(false);

    layer.setMuted(true);
    expect(layer.isMuted).toBe(true);
    expect(paramOf(master!, 'gain').value).toBe(0);

    expect(layer.toggleMute()).toBe(false);
    expect(paramOf(master!, 'gain').value).toBe(LAYER_MASTER_LEVEL);
  });
});

describe('per-era ambience generation', () => {
  it('builds a distinct bed for every era with its characteristic timbre', () => {
    for (const eraId of ERA_IDS) {
      const ctx = createFakeAudioContext();
      const layer = new AudioLayer();
      layer.attach(ctx);
      layer.applyEra(eraId, 1);

      const spec = BED_SPECS[eraId];
      expect(layer.activeEra).toBe(eraId);
      expect(layer.getBedGain(eraId)).toBe(ERAS[eraId].sfx.masterLevel);
      expect(layer.stats.whooshes).toBe(0); // booting an era is not a selection

      // Every spec tone exists as a started oscillator at the right frequency.
      for (const tone of spec.tones) {
        const osc = nodesByKind(ctx, 'oscillator').find(
          (node) => paramOf(node, 'frequency').value === tone.frequency,
        );
        expect(osc).toBeDefined();
        expect(osc!.startedAt).not.toBeNull();
      }

      // Looped traffic-noise bed through the era's low-pass cutoff.
      const noiseSource = nodesByKind(ctx, 'buffer-source').find(
        (node) => (node as FakeBufferSource).buffer !== null,
      );
      expect(noiseSource).toBeDefined();
      expect((noiseSource as FakeBufferSource).loop).toBe(true);
      expect(noiseSource!.startedAt).not.toBeNull();

      const lowpass = nodesByKind(ctx, 'filter')[0];
      expect(paramOf(lowpass, 'frequency').value).toBe(spec.noiseCutoff);
      expect(paramOf(lowpass, 'Q').value).toBe(0.6);

      // The noise level lands in the graph.
      expect(
        nodesByKind(ctx, 'gain').some((node) => paramOf(node, 'gain').value === spec.noiseLevel),
      ).toBe(true);
    }
  });

  it('gives the five eras distinct timbral fingerprints', () => {
    const fingerprints = ERA_IDS.map((eraId) =>
      BED_SPECS[eraId].tones.map((tone) => `${tone.type}@${tone.frequency}`).join(','),
    );
    expect(new Set(fingerprints).size).toBe(5);
    expect(new Set(ERA_IDS.map((eraId) => BED_SPECS[eraId].noiseCutoff)).size).toBe(5);
    expect(new Set(ERA_IDS.map((eraId) => BED_SPECS[eraId].lfoRate)).size).toBe(5);

    // 1985 owns the deep low-frequency rumble register.
    expect(lowestTone(1985)).toBeLessThan(lowestTone(1965));
    expect(lowestTone(1985)).toBeLessThan(lowestTone(2005));
    // 1985 traffic noise is busier than 1945's quiet post-war street.
    expect(BED_SPECS[1985].noiseLevel).toBeGreaterThan(BED_SPECS[1945].noiseLevel);
    // 2025 EV bed: no heavy rumble, airy digital tones, quietest overall.
    expect(lowestTone(2025)).toBeGreaterThanOrEqual(180);
    expect(BED_SPECS[2025].noiseLevel).toBeLessThan(BED_SPECS[1945].noiseLevel);
    expect(totalToneLevel(2025)).toBeLessThan(totalToneLevel(1985));
    expect(totalToneLevel(2025)).toBeLessThan(totalToneLevel(1965));
  });

  it('walks through every era without cross-contamination between fresh layers', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);
    const bootNodes = layer.nodeCount;

    // 1965 is selected at progress 0 and settles; the 1945 bed is retired.
    layer.applyEra(1965, 0);
    expect(layer.nodeCount).toBeGreaterThan(bootNodes); // incoming bed + whoosh
    layer.applyEra(1965, 1);
    expect(layer.activeEra).toBe(1965);
    expect(layer.getBedGain(1945)).toBeNull();
    expect(layer.getBedGain(1965)).toBe(ERAS[1965].sfx.masterLevel);
  });
});

describe('transition whoosh SFX', () => {
  it('plays one whoosh per slider selection and not on repeated progress', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);
    expect(layer.stats.whooshes).toBe(0);

    layer.applyEra(1985, 0);
    layer.applyEra(1985, 0.4); // same in-flight target: no second whoosh
    expect(layer.stats.whooshes).toBe(1);

    layer.applyEra(2005, 1); // direct settle still counts as a selection
    expect(layer.stats.whooshes).toBe(2);
  });

  it('synthesizes a band-pass noise sweep layered with a rising glide', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);
    layer.applyEra(1985, 0);

    const bandpasses = nodesByKind(ctx, 'filter').filter(
      (node) => (node as FakeBiquadFilter).type === 'bandpass',
    );
    expect(bandpasses).toHaveLength(1);
    const sweep = paramOf(bandpasses[0], 'frequency');
    expect(sweep.events.some((event) => event.method === 'setValueAtTime' && event.value === 280)).toBe(
      true,
    );
    expect(
      sweep.events.some(
        (event) => event.method === 'exponentialRampToValueAtTime' && event.value === 2600,
      ),
    ).toBe(true);

    // The whoosh noise source and the glide oscillator were started.
    const sources = nodesByKind(ctx, 'buffer-source');
    expect(sources.some((node) => node.startedAt !== null)).toBe(true);
    const glides = nodesByKind(ctx, 'oscillator').filter((node) =>
      paramOf(node, 'frequency').events.some(
        (event) => event.method === 'exponentialRampToValueAtTime' && event.value === 880,
      ),
    );
    expect(glides.length).toBeGreaterThanOrEqual(1);
    expect(glides[0].startedAt).not.toBeNull();
  });
});

describe('procedural UI SFX', () => {
  it('generates slider ticks with a falling blip envelope', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    const oscillatorsBefore = nodesByKind(ctx, 'oscillator').length;
    layer.playTick();
    layer.playTick();

    expect(layer.stats.ticks).toBe(2);
    const newOscillators = nodesByKind(ctx, 'oscillator').slice(oscillatorsBefore);
    expect(newOscillators).toHaveLength(2);
    for (const osc of newOscillators) {
      expect(osc.startedAt).not.toBeNull();
      const frequency = paramOf(osc, 'frequency');
      expect(frequency.events.some((event) => event.value === 1100)).toBe(true);
      expect(
        frequency.events.some(
          (event) => event.method === 'exponentialRampToValueAtTime' && event.value === 650,
        ),
      ).toBe(true);
      expect(osc.stoppedAt).not.toBeNull();
    }
  });

  it('generates UI click feedback for tap/open/close with distinct pitches', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    const oscillatorsBefore = nodesByKind(ctx, 'oscillator').length;
    layer.playClick('open');
    layer.playClick('close');
    layer.playClick('tap');

    expect(layer.stats.clicks).toEqual({ tap: 1, open: 1, close: 1 });
    const newOscillators = nodesByKind(ctx, 'oscillator').slice(oscillatorsBefore);
    expect(newOscillators).toHaveLength(3);
    for (const osc of newOscillators) {
      expect((osc as unknown as { type: string }).type).toBe('triangle');
      expect(osc.startedAt).not.toBeNull();
      expect(osc.stoppedAt).not.toBeNull();
    }

    const kinds: PlayClickKind[] = ['open', 'close', 'tap'];
    const startFrequencies = new Set(
      newOscillators.map((osc) => {
        const events = paramOf(osc, 'frequency').events;
        return events.find((event) => event.method === 'setValueAtTime')?.value;
      }),
    );
    expect(startFrequencies.size).toBe(3); // each kind gets its own pitch
    expect(kinds.length).toBe(3);
  });

  it('prunes finished one-shot SFX nodes on update', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    const before = layer.nodeCount;
    layer.playWhoosh();
    layer.playTick();
    expect(layer.nodeCount).toBeGreaterThan(before);

    ctx.currentTime = 5; // well past every one-shot's stop time
    layer.update(1 / 60);
    expect(layer.nodeCount).toBe(before);
  });
});

describe('crossfade and per-frame ambience', () => {
  it('crossfades gains by progress and frees the outgoing bed on settle', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);
    const initial1945 = ERAS[1945].sfx.masterLevel;
    const final1985 = ERAS[1985].sfx.masterLevel;

    layer.applyEra(1985, 0.25);
    expect(layer.getBedGain(1985)).toBeCloseTo(0.25 * final1985, 6);
    expect(layer.getBedGain(1945)).toBeCloseTo(0.75 * initial1945, 6);

    layer.applyEra(1985, 0.6);
    expect(layer.getBedGain(1985)).toBeCloseTo(0.6 * final1985, 6);
    expect(layer.getBedGain(1945)).toBeCloseTo(0.4 * initial1945, 6);

    layer.applyEra(1985, 1);
    expect(layer.activeEra).toBe(1985);
    expect(layer.getBedGain(1985)).toBe(final1985);
    expect(layer.getBedGain(1945)).toBeNull();
  });

  it('retires an in-flight bed when the selection retargets mid-transition', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    layer.applyEra(1985, 0.4);
    layer.applyEra(2005, 0.1);

    expect(layer.stats.whooshes).toBe(2);
    expect(layer.getBedGain(1985)).toBeNull(); // replaced before it settled
    expect(layer.getBedGain(2005)).toBeCloseTo(0.1 * ERAS[2005].sfx.masterLevel, 6);
    expect(layer.getBedGain(1945)).toBeCloseTo(0.9 * ERAS[1945].sfx.masterLevel, 6);

    layer.applyEra(2005, 1);
    expect(layer.activeEra).toBe(2005);
    expect(layer.getBedGain(1945)).toBeNull();
  });

  it('modulates the active ambience bed every frame', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    const lowpass = nodesByKind(ctx, 'filter')[0];
    const frequency = paramOf(lowpass, 'frequency');
    const base = BED_SPECS[1945].noiseCutoff;
    expect(frequency.value).toBe(base);

    layer.update(0.5);
    const first = frequency.value;
    expect(first).not.toBe(base);
    layer.update(0.5);
    expect(frequency.value).not.toBe(first);

    // The breathing modulation is bounded around the era's cutoff.
    expect(frequency.value).toBeGreaterThanOrEqual(base * 0.72 - 1e-6);
    expect(frequency.value).toBeLessThanOrEqual(base * 1.28 + 1e-6);
  });

  it('applies the same era again without restarting the bed', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);

    const nodesBefore = layer.nodeCount;
    layer.applyEra(1945, 0.5); // stray nudge on the settled era
    expect(layer.stats.whooshes).toBe(0);
    expect(layer.nodeCount).toBe(nodesBefore);
    expect(layer.activeEra).toBe(1945);
  });
});

describe('dispose', () => {
  it('clears every owned audio node and blocks further use', () => {
    const ctx = createFakeAudioContext();
    const layer = new AudioLayer();
    layer.attach(ctx);
    layer.applyEra(1945, 1);
    layer.applyEra(1965, 0.6); // in-flight bed
    layer.playWhoosh();
    layer.playTick();

    expect(layer.nodeCount).toBeGreaterThan(0);
    layer.dispose();

    expect(layer.nodeCount).toBe(0);
    expect(layer.activeEra).toBeNull();
    // Every node the fake ever minted (beds, SFX, master) is disconnected.
    expect(ctx.nodes.every((node) => node.disconnectedCount > 0)).toBe(true);
    expect(() => layer.applyEra(1985, 1)).toThrow(/attach/);
    expect(() => layer.playClick('tap')).toThrow(/attach/);
    expect(() => layer.dispose()).not.toThrow(); // idempotent
  });
});