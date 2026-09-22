/**
 * Audio module tests: first-gesture unlock, instant master mute, era
 * crossfades driven by the *real* era timeline core, transition cues,
 * documented content-hook one-shots, distance ducking, and the node/voice
 * budget.
 *
 * Everything runs against a deterministic fake Web Audio context (jsdom has
 * no real `AudioContext`): the fake evaluates `AudioParam` automation
 * timelines piecewise so tests can assert actual ramped mix values, and it
 * fires `onended` when the audio clock passes a source's stop time so pool
 * recycling and node teardown are observable.
 */

import { describe, expect, it } from 'vitest';
import { EraTimelineCore, ERA_YEARS } from '../era/timeline';
import { AUDIO_MASTER_LEVEL, AudioDirector, DEFAULT_VOICE_POOL_SIZE } from './director';
import { AUDIO_HOOK_EVENTS } from './hooks';
import { ERAS, SOUNDSCAPES } from './soundscapes';
import { NODE_BUDGET } from './synthesis';
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioContextStateLike,
  AudioNodeLike,
  AudioParamLike,
  AudioScheduledSourceLike,
  BiquadFilterNodeLike,
  DynamicsCompressorNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from './synthesis';

/* -------------------------------------------------------------------------- */
/* Fake Web Audio implementation                                              */
/* -------------------------------------------------------------------------- */

interface FakeParamEvent {
  readonly time: number;
  readonly type: 'exp' | 'linear' | 'set';
  readonly value: number;
}

class FakeAudioParam implements AudioParamLike {
  readonly #events: FakeParamEvent[] = [];
  readonly #clock: () => number;
  readonly #initial: number;

  constructor(clock: () => number, initial: number) {
    this.#clock = clock;
    this.#initial = initial;
  }

  /** Value implied by the automation timeline at the current clock time. */
  get value(): number {
    const now = this.#clock();
    let lastValue = this.#initial;
    let lastTime = Number.NEGATIVE_INFINITY;
    for (const event of this.#events) {
      if (event.time > now) {
        if (event.type === 'linear' && lastTime !== Number.NEGATIVE_INFINITY) {
          const span = event.time - lastTime;
          const t = span > 0 ? (now - lastTime) / span : 1;
          return lastValue + (event.value - lastValue) * t;
        }
        break;
      }
      lastValue = event.value;
      lastTime = event.time;
    }
    return lastValue;
  }

  setValueAtTime(value: number, startTime: number): AudioParamLike {
    this.#events.push({ type: 'set', value, time: startTime });
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike {
    this.#events.push({ type: 'linear', value, time: endTime });
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): AudioParamLike {
    this.#events.push({ type: 'exp', value, time: endTime });
    return this;
  }

  cancelScheduledValues(startTime: number): AudioParamLike {
    for (let i = this.#events.length - 1; i >= 0; i -= 1) {
      if (this.#events[i].time >= startTime) this.#events.splice(i, 1);
    }
    return this;
  }
}

class FakeAudioNode implements AudioNodeLike {
  readonly connections = new Set<unknown>();
  disconnected = false;
  readonly kind: string;
  readonly ctx: FakeAudioContext;

  constructor(kind: string, ctx: FakeAudioContext) {
    this.kind = kind;
    this.ctx = ctx;
  }

  connect(destination: AudioNodeLike | AudioParamLike): void {
    this.connections.add(destination);
  }

  disconnect(): void {
    this.connections.clear();
    this.disconnected = true;
  }
}

class FakeAudioSource extends FakeAudioNode implements AudioScheduledSourceLike {
  onended: (() => void) | null = null;
  started = false;
  stoppedAt: number | null = null;
  ended = false;

  start(_when?: number): void {
    this.started = true;
    this.ctx.registerSource(this);
  }

  stop(when?: number): void {
    // Real AudioScheduledSourceNode throws when stop() precedes start();
    // mirror that invariant so unit tests catch ordering regressions.
    if (!this.started) {
      throw new DOMException(
        "Failed to execute 'stop' on 'AudioScheduledSourceNode': cannot call stop without calling start first.",
        'InvalidStateError',
      );
    }
    this.stoppedAt = when ?? this.ctx.currentTime;
  }
}

class FakeOscillator extends FakeAudioSource implements OscillatorNodeLike {
  readonly frequency: FakeAudioParam;
  readonly detune: FakeAudioParam;
  type: OscillatorType = 'sine';

  constructor(ctx: FakeAudioContext) {
    super('oscillator', ctx);
    this.frequency = new FakeAudioParam(() => ctx.currentTime, 440);
    this.detune = new FakeAudioParam(() => ctx.currentTime, 0);
  }
}

class FakeBufferSource extends FakeAudioSource implements AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  readonly playbackRate: FakeAudioParam;

  constructor(ctx: FakeAudioContext) {
    super('buffer-source', ctx);
    this.playbackRate = new FakeAudioParam(() => ctx.currentTime, 1);
  }
}

class FakeGain extends FakeAudioNode implements GainNodeLike {
  readonly gain: FakeAudioParam;

  constructor(ctx: FakeAudioContext) {
    super('gain', ctx);
    this.gain = new FakeAudioParam(() => ctx.currentTime, 1);
  }
}

class FakeFilter extends FakeAudioNode implements BiquadFilterNodeLike {
  readonly frequency: FakeAudioParam;
  readonly Q: FakeAudioParam;
  readonly gain: FakeAudioParam;
  type: BiquadFilterType = 'lowpass';

  constructor(ctx: FakeAudioContext) {
    super('filter', ctx);
    this.frequency = new FakeAudioParam(() => ctx.currentTime, 350);
    this.Q = new FakeAudioParam(() => ctx.currentTime, 1);
    this.gain = new FakeAudioParam(() => ctx.currentTime, 0);
  }
}

class FakeCompressor extends FakeAudioNode implements DynamicsCompressorNodeLike {
  readonly threshold: FakeAudioParam;
  readonly knee: FakeAudioParam;
  readonly ratio: FakeAudioParam;
  readonly attack: FakeAudioParam;
  readonly release: FakeAudioParam;

  constructor(ctx: FakeAudioContext) {
    super('compressor', ctx);
    this.threshold = new FakeAudioParam(() => ctx.currentTime, -24);
    this.knee = new FakeAudioParam(() => ctx.currentTime, 30);
    this.ratio = new FakeAudioParam(() => ctx.currentTime, 12);
    this.attack = new FakeAudioParam(() => ctx.currentTime, 0.003);
    this.release = new FakeAudioParam(() => ctx.currentTime, 0.25);
  }
}

class FakeBuffer implements AudioBufferLike {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  readonly #data: Float32Array;

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.#data = new Float32Array(length);
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }

  getChannelData(_channel: number): Float32Array {
    return this.#data;
  }
}

class FakeAudioContext implements AudioContextLike {
  currentTime = 0;
  readonly sampleRate = 48000;
  state: AudioContextStateLike = 'suspended';
  readonly destination: FakeAudioNode;
  readonly nodesCreated: FakeAudioNode[] = [];
  readonly #sources: FakeAudioSource[] = [];

  constructor() {
    // The destination is ambient infrastructure, not a created graph node.
    this.destination = new FakeAudioNode('destination', this);
  }

  /** Total nodes ever created through `create*`. */
  get createdNodeCount(): number {
    return this.nodesCreated.length;
  }

  /** Nodes created but not yet disconnected (the live budget). */
  get activeNodeCount(): number {
    let active = 0;
    for (const node of this.nodesCreated) if (!node.disconnected) active += 1;
    return active;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  /** Advance the audio clock and fire `onended` for sources past their stop. */
  advance(seconds: number): void {
    this.currentTime += Math.max(0, seconds);
    for (const source of this.#sources) {
      if (
        source.started &&
        !source.ended &&
        source.stoppedAt !== null &&
        source.stoppedAt <= this.currentTime
      ) {
        source.ended = true;
        const handler = source.onended;
        source.onended = null;
        if (handler) handler();
      }
    }
  }

  registerSource(source: FakeAudioSource): void {
    this.#sources.push(source);
  }

  createGain(): GainNodeLike {
    return this.#track(new FakeGain(this));
  }

  createOscillator(): OscillatorNodeLike {
    return this.#track(new FakeOscillator(this));
  }

  createBiquadFilter(): BiquadFilterNodeLike {
    return this.#track(new FakeFilter(this));
  }

  createDynamicsCompressor(): DynamicsCompressorNodeLike {
    return this.#track(new FakeCompressor(this));
  }

  createBufferSource(): AudioBufferSourceNodeLike {
    return this.#track(new FakeBufferSource(this));
  }

  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike {
    return new FakeBuffer(channels, length, sampleRate);
  }

  #track<T extends FakeAudioNode>(node: T): T {
    this.nodesCreated.push(node);
    return node;
  }
}

/* -------------------------------------------------------------------------- */
/* Test harness                                                               */
/* -------------------------------------------------------------------------- */

interface Harness {
  readonly core: EraTimelineCore;
  readonly fake: FakeAudioContext;
  readonly director: AudioDirector;
}

async function createHarness(options: { muted?: boolean } = {}): Promise<Harness> {
  const core = new EraTimelineCore();
  const fake = new FakeAudioContext();
  const director = new AudioDirector({ core, context: fake, random: () => 0.5 });
  if (options.muted) director.setMuted(true);
  const unlocked = await director.enable();
  expect(unlocked).toBe(true);
  return { core, fake, director };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('first-gesture unlock', () => {
  it('creates no audio nodes and stays silent before the first gesture', async () => {
    const core = new EraTimelineCore();
    const fake = new FakeAudioContext();
    const director = new AudioDirector({ core, context: fake, gestureTarget: null });

    director.update(1);
    director.setListenerPosition(10, 0);
    director.hooks.emit('street-horn', { x: 0, z: 0 });

    expect(fake.createdNodeCount).toBe(0);
    expect(fake.state).toBe('suspended');
    expect(director.isUnlocked).toBe(false);
    expect(director.mixSnapshot().master).toBe(0);
    expect(director.stats().nodeCount).toBe(0);
  });

  it('arms gesture listeners, unlocks on the first gesture, then disarms', async () => {
    const core = new EraTimelineCore();
    const fake = new FakeAudioContext();
    const target = new EventTarget();
    const director = new AudioDirector({ core, context: fake, gestureTarget: target });

    director.armFirstGesture();
    expect(fake.createdNodeCount).toBe(0);

    target.dispatchEvent(new Event('pointerdown'));
    const unlocked = await director.enable(); // joins the in-flight unlock
    expect(unlocked).toBe(true);
    expect(director.isUnlocked).toBe(true);
    expect(fake.state).toBe('running');
    expect(fake.createdNodeCount).toBeGreaterThan(20);

    const afterUnlock = fake.createdNodeCount;
    target.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(fake.createdNodeCount).toBe(afterUnlock);
    director.dispose();
  });

  it('dispose stops all nodes and unsubscribes from core and hooks', async () => {
    const { core, fake, director } = await createHarness();
    const before = fake.createdNodeCount;

    director.dispose();
    expect(fake.activeNodeCount).toBe(0);
    expect(director.isUnlocked).toBe(false);

    core.selectYear(1985);
    director.hooks.emit('street-horn', { x: 0, z: 0 });
    director.update(1);
    expect(fake.createdNodeCount).toBe(before);
    expect(await director.enable()).toBe(false);
  });
});

describe('master mute', () => {
  it('silences instantly and restores, including mute set before unlock', async () => {
    const { director } = await createHarness();
    expect(director.mixSnapshot().master).toBeCloseTo(AUDIO_MASTER_LEVEL, 5);

    director.setMuted(true);
    expect(director.mixSnapshot().master).toBe(0); // no clock advance needed

    director.setMuted(false);
    expect(director.mixSnapshot().master).toBeCloseTo(AUDIO_MASTER_LEVEL, 5);

    const mutedEarly = await createHarness({ muted: true });
    expect(mutedEarly.director.isMuted).toBe(true);
    expect(mutedEarly.director.mixSnapshot().master).toBe(0);
  });

  it('suppresses one-shots while muted but still counts intent', async () => {
    const { core, fake, director } = await createHarness({ muted: true });
    const before = fake.createdNodeCount;

    for (const name of AUDIO_HOOK_EVENTS) director.hooks.emit(name, { x: 3, z: 1 });
    expect(director.stats().hookCount).toBe(AUDIO_HOOK_EVENTS.length);
    expect(director.stats().activeVoices).toBe(0);

    core.selectYear(1985);
    expect(director.stats().cueCount).toBe(1);
    expect(director.stats().activeVoices).toBe(0);
    expect(fake.createdNodeCount).toBe(before);
  });
});

describe('era crossfade from the real timeline core', () => {
  it('crossfades era buses and re-balances the beds during a transition', async () => {
    const { core, fake, director } = await createHarness();

    const initial = director.mixSnapshot();
    expect(initial.eraWeights).toEqual([1, 0, 0, 0, 0]);
    expect(initial.traffic).toBeCloseTo(0.3, 5);
    expect(initial.footsteps).toBeCloseTo(0.5, 5);
    expect(initial.chatter).toBeCloseTo(0.42, 5);
    expect(initial.eraBusGains[0]).toBeCloseTo(1, 5);

    core.transitionTo(1965, 1);
    expect(director.stats().cueCount).toBe(1); // whoosh + era chime on year change

    const startTraffic = initial.traffic;
    let sawWeightMidBlend = false;
    let sawBusMidBlend = false;
    let trafficMid = -1;

    for (let i = 0; i < 10; i += 1) {
      core.advance(0.1);
      director.update(0.1);
      fake.advance(0.1);
      const snapshot = director.mixSnapshot();
      const weights = snapshot.eraWeights;
      expect(weights[0] + weights[1] + weights[2] + weights[3] + weights[4]).toBeCloseTo(1, 5);
      if (
        weights[0] > 0.1 &&
        weights[0] < 0.9 &&
        weights[1] > 0.1 &&
        weights[1] < 0.9
      ) {
        sawWeightMidBlend = true;
        trafficMid = snapshot.traffic;
      }
      const buses = snapshot.eraBusGains;
      if (buses[0] > 0.1 && buses[0] < 0.9 && buses[1] > 0.1 && buses[1] < 0.9) {
        sawBusMidBlend = true;
        expect(buses[0] + buses[1]).toBeCloseTo(1, 3); // equal-power-free linear crossfade
      }
    }

    fake.advance(0.5); // let the final ramps settle on the audio clock
    const settled = director.mixSnapshot();
    expect(sawWeightMidBlend).toBe(true);
    expect(sawBusMidBlend).toBe(true);
    expect(settled.eraWeights[1]).toBeCloseTo(1, 5);
    expect(settled.eraWeights[0]).toBeCloseTo(0, 5);
    expect(settled.eraBusGains[1]).toBeCloseTo(1, 5);
    expect(settled.eraBusGains[0]).toBeCloseTo(0, 5);
    expect(settled.traffic).toBeCloseTo(0.42, 5); // 1965 bed profile
    expect(trafficMid).toBeGreaterThan(startTraffic + 0.005);
    expect(trafficMid).toBeLessThan(0.42 - 0.005);
  });

  it('fires whoosh + era chime cues only on actual year changes', async () => {
    const { core, fake, director } = await createHarness();
    const before = fake.createdNodeCount;

    core.selectYear(1985);
    expect(director.stats().cueCount).toBe(1);
    const cueNodes = fake.createdNodeCount - before;
    expect(cueNodes).toBeGreaterThanOrEqual(3); // whoosh source + 2 chime partials

    core.selectYear(1985); // same year again: no cue
    expect(director.stats().cueCount).toBe(1);
    expect(fake.createdNodeCount).toBe(before + cueNodes);

    core.transitionTo(1985, 1); // already there: no year change, no cue
    expect(director.stats().cueCount).toBe(1);
    expect(fake.createdNodeCount).toBe(before + cueNodes);
  });

  it('produces a distinct mix signature for each of the five eras', async () => {
    const { core, fake, director } = await createHarness();
    const signatures = new Set<string>();

    for (let i = 0; i < ERA_YEARS.length; i += 1) {
      const year = ERA_YEARS[i];
      core.selectYear(year);
      director.update(0.01);
      fake.advance(0.4); // settle the crossfade ramps
      const snapshot = director.mixSnapshot();
      expect(snapshot.eraWeights[i]).toBeCloseTo(1, 5);
      expect(snapshot.traffic).toBeGreaterThan(0);
      expect(snapshot.footsteps).toBeGreaterThan(0);
      expect(snapshot.chatter).toBeGreaterThan(0);
      signatures.add(
        JSON.stringify([
          snapshot.traffic,
          snapshot.footsteps,
          snapshot.chatter,
          ...snapshot.eraBusGains,
        ]),
      );
    }

    expect(signatures.size).toBe(5);
  });

  it('defines unique texture and pattern material for every era', () => {
    const textureSignatures = ERAS.map((era) =>
      era.textures.map((texture) => texture.id).join('|'),
    );
    const patternSignatures = ERAS.map((era) => era.patterns.map((pattern) => pattern.id).join('|'));
    expect(new Set(textureSignatures).size).toBe(5);
    expect(new Set(patternSignatures).size).toBe(5);
    for (const era of ERAS) {
      expect(era.textures.length).toBeGreaterThan(0);
      expect(era.patterns.length).toBeGreaterThan(0);
      expect(SOUNDSCAPES[era.year]).toBe(era);
      expect(era.year).toBe(ERA_YEARS[textureSignatures.indexOf(textureSignatures[ERAS.indexOf(era)])]);
    }
  });

  it('spawns era pattern one-shots on schedule while the era is audible', async () => {
    const { director, fake } = await createHarness();
    let spawned = false;
    for (let i = 0; i < 60 && !spawned; i += 1) {
      director.update(0.25);
      if (director.stats().activeVoices > 0) spawned = true;
      fake.advance(0.25);
    }
    expect(spawned).toBe(true);
  });
});

describe('documented hook events and distance ducking', () => {
  it('triggers a synthesized one-shot for every documented hook event', async () => {
    const { fake, director } = await createHarness();
    for (const name of AUDIO_HOOK_EVENTS) {
      director.hooks.emit(name, { x: 4, z: 1 });
      expect(director.stats().activeVoices).toBeGreaterThan(0);
      expect(director.stats().lastShotGain).toBeGreaterThan(0);
      fake.advance(1.5); // voices end, pool slots recycle
      expect(director.stats().activeVoices).toBe(0);
    }
    expect(director.stats().hookCount).toBe(AUDIO_HOOK_EVENTS.length);
  });

  it('ducks one-shots by emitter distance', async () => {
    const { fake, director } = await createHarness();
    director.hooks.emit('street-horn', { x: 4, z: 0 });
    const nearGain = director.stats().lastShotGain;
    fake.advance(1.5);
    director.hooks.emit('street-horn', { x: 500, z: 0 });
    const farGain = director.stats().lastShotGain;

    expect(nearGain).toBeGreaterThan(0.4); // inside the reference distance
    expect(farGain).toBeLessThan(nearGain * 0.06); // inverse-distance falloff
  });

  it('ducks the whole street mix as the listener moves away', async () => {
    const { fake, director } = await createHarness();
    expect(director.mixSnapshot().spatial).toBeCloseTo(1, 5);

    director.setListenerPosition(600, 0);
    fake.advance(0.3);
    const far = director.mixSnapshot().spatial;
    expect(far).toBeLessThan(0.5);
    expect(far).toBeGreaterThan(0.25); // beds never vanish completely

    director.setListenerPosition(0, 0);
    fake.advance(0.3);
    expect(director.mixSnapshot().spatial).toBeCloseTo(1, 5);
  });
});

describe('performance budget', () => {
  it('keeps the voice pool capped and the node count under budget', async () => {
    const { fake, director } = await createHarness();

    for (let i = 0; i < 40; i += 1) director.hooks.emit('street-horn', { x: 5, z: 5 });
    const stats = director.stats();
    expect(stats.activeVoices).toBe(DEFAULT_VOICE_POOL_SIZE);
    // Multi-tone voices claim several pool slots per shot, so this burst drops
    // more attempts than surplus emitters — but never allocates past the pool.
    expect(stats.droppedVoices).toBeGreaterThanOrEqual(40 - DEFAULT_VOICE_POOL_SIZE);
    expect(stats.layersBuilt).toBeGreaterThanOrEqual(8);
    expect(stats.nodeCount + stats.activeVoices).toBeLessThanOrEqual(NODE_BUDGET);
    expect(fake.activeNodeCount).toBeLessThanOrEqual(NODE_BUDGET);

    fake.advance(2);
    expect(director.stats().activeVoices).toBe(0); // every voice recycled

    director.dispose();
    expect(fake.activeNodeCount).toBe(0);
  });
});
