/**
 * Tests for the SfxSystem — generated, license-free ambient beds and cues via
 * the Web Audio API.
 *
 * Because the test environment has no real audio hardware, we install a fake
 * AudioContext that records every node created and every method called. This
 * lets us assert: muted-by-default behaviour, lazy AudioContext creation on
 * first unmute, era-appropriate bed building, cue triggering, and safe disposal.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSfxSystem } from '../SfxSystem.js';
import { ERA_KEYS } from '../../eras/eraConfig.js';

// ---------------------------------------------------------------------------
// Fake Web Audio API
// ---------------------------------------------------------------------------

/** A recording fake AudioParam — tracks scheduled value changes. */
class FakeAudioParam {
  value = 0;
  events: { method: string; time: number; value?: number }[] = [];
  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ method: 'setValueAtTime', time, value });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ method: 'linearRampToValueAtTime', time, value });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ method: 'exponentialRampToValueAtTime', time, value });
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.events.push({ method: 'cancelScheduledValues', time });
    return this;
  }
}

/** A recording fake AudioNode base. */
class FakeAudioNode {
  connections: FakeAudioNode[] = [];
  connect(dest: FakeAudioNode): this {
    this.connections.push(dest);
    return this;
  }
  disconnect(): void {
    this.connections = [];
  }
}

class FakeGainNode extends FakeAudioNode {
  gain = new FakeAudioParam();
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type = 'lowpass';
  frequency = new FakeAudioParam();
  Q = new FakeAudioParam();
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  started = false;
  stopped: number | null = null;
  start(_time = 0): void {
    this.started = true;
  }
  stop(time = 0): void {
    this.stopped = time;
  }
}

class FakeBufferSourceNode extends FakeAudioNode {
  buffer: { getChannelData: () => Float32Array } | null = null;
  loop = false;
  started = false;
  stopped: number | null = null;
  start(_time = 0): void {
    this.started = true;
  }
  stop(time = 0): void {
    this.stopped = time;
  }
}

/** Minimal fake AudioBuffer. */
class FakeAudioBuffer {
  length: number;
  sampleRate: number;
  data: Float32Array;
  constructor(_numberOfChannels: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

/** Recording fake AudioContext. Instances are tracked for white-box tests. */
class FakeAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  currentTime = 0;
  destination = new FakeAudioNode();
  nodesCreated = {
    gain: 0,
    biquadFilter: 0,
    oscillator: 0,
    bufferSource: 0,
    buffer: 0,
  };
  closed = false;

  constructor() {
    createdContexts.push(this);
  }
  createGain(): FakeGainNode {
    this.nodesCreated.gain++;
    return new FakeGainNode();
  }
  createBiquadFilter(): FakeBiquadFilterNode {
    this.nodesCreated.biquadFilter++;
    return new FakeBiquadFilterNode();
  }
  createOscillator(): FakeOscillatorNode {
    this.nodesCreated.oscillator++;
    return new FakeOscillatorNode();
  }
  createBufferSource(): FakeBufferSourceNode {
    this.nodesCreated.bufferSource++;
    return new FakeBufferSourceNode();
  }
  createBuffer(ch: number, length: number, sr: number): FakeAudioBuffer {
    this.nodesCreated.buffer++;
    return new FakeAudioBuffer(ch, length, sr);
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

/** All AudioContext instances ever created (for white-box assertions). */
const createdContexts: FakeAudioContext[] = [];

/** Track how many times the constructor was invoked. */
let ctorCallCount = 0;

/**
 * Subclass of FakeAudioContext that records every instantiation into
 * `createdContexts` and increments `ctorCallCount`. Used as the stubbed global
 * `window.AudioContext` / `AudioContext` so the SfxSystem gets a real,
 * method-bearing object from `new` while tests can introspect state.
 */
class CountingAudioContext extends FakeAudioContext {
  constructor() {
    super();
    ctorCallCount++;
    createdContexts.push(this);
  }
}

const fakeWindow = { AudioContext: CountingAudioContext };
vi.stubGlobal('AudioContext', CountingAudioContext as unknown as typeof AudioContext);
vi.stubGlobal('window', fakeWindow);
// Some browsers prefix the constructor.
vi.stubGlobal('webkitAudioContext', undefined);

/** Cast a created SfxSystem's internal context for white-box assertions. */
function lastFakeContext(): FakeAudioContext {
  return createdContexts[createdContexts.length - 1];
}

describe('SfxSystem', () => {
  beforeEach(() => {
    createdContexts.length = 0;
    ctorCallCount = 0;
  });

  it('is muted by default', () => {
    const sfx = createSfxSystem();
    expect(sfx.isMuted()).toBe(true);
  });

  it('does not create an AudioContext until unmuted (autoplay policy)', () => {
    const sfx = createSfxSystem();
    expect(ctorCallCount).toBe(0);
    sfx.setEra('1965');
    sfx.playLightChange();
    sfx.update(16);
    expect(ctorCallCount).toBe(0);
    sfx.dispose();
  });

  it('creates an AudioContext on first unmute (user gesture)', () => {
    const sfx = createSfxSystem();
    const muted = sfx.toggleMute();
    expect(muted).toBe(false); // now unmuted
    expect(ctorCallCount).toBe(1);
    expect(sfx.isEnabled()).toBe(true);
    sfx.dispose();
  });

  it('startMuted:false still requires explicit unmute to create context', () => {
    // The AudioContext is always created lazily on first unmute toggle.
    const sfx = createSfxSystem({ startMuted: false });
    // Even with startMuted:false, the context is not auto-created.
    expect(ctorCallCount).toBe(0);
    const muted = sfx.toggleMute(); // first toggle → muted
    expect(muted).toBe(true);
    // Still no context because we just muted.
    expect(ctorCallCount).toBe(0);
    const muted2 = sfx.toggleMute(); // unmute
    expect(muted2).toBe(false);
    expect(ctorCallCount).toBe(1);
    sfx.dispose();
  });

  it('builds an ambient bed with distinct traffic-hum + crowd nodes per era', () => {
    const sfx = createSfxSystem();
    sfx.setEra('1945');
    sfx.toggleMute(); // unmute → creates context + builds bed

    const ctx = lastFakeContext();
    // Traffic hum: a low-pass filter and gain.
    expect(ctx.nodesCreated.biquadFilter).toBeGreaterThanOrEqual(2);
    // Crowd murmur: band-pass filter + oscillator LFO.
    expect(ctx.nodesCreated.oscillator).toBeGreaterThanOrEqual(2);
    // Buffer sources for noise beds.
    expect(ctx.nodesCreated.bufferSource).toBeGreaterThanOrEqual(2);
    sfx.dispose();
  });

  it('cross-fades the bed when the era changes', () => {
    const sfx = createSfxSystem();
    sfx.toggleMute(); // unmute
    const ctxBefore = lastFakeContext();
    const sourcesBefore = ctxBefore.nodesCreated.bufferSource;

    sfx.setEra('2055');
    const ctxAfter = lastFakeContext();
    // A new bed is built → more buffer sources created.
    expect(ctxAfter.nodesCreated.bufferSource).toBeGreaterThan(sourcesBefore);
    sfx.dispose();
  });

  it('does not build a bed when muted, even on era change', () => {
    const sfx = createSfxSystem();
    expect(sfx.isMuted()).toBe(true);
    sfx.setEra('2055');
    expect(ctorCallCount).toBe(0);
    sfx.dispose();
  });

  it('playLightChange is a no-op when muted', () => {
    const sfx = createSfxSystem();
    sfx.playLightChange();
    expect(ctorCallCount).toBe(0);
    sfx.dispose();
  });

  it('playLightChange creates oscillator tones when unmuted', () => {
    const sfx = createSfxSystem();
    sfx.toggleMute(); // unmute
    const oscBefore = lastFakeContext().nodesCreated.oscillator;

    sfx.playLightChange();
    expect(lastFakeContext().nodesCreated.oscillator).toBeGreaterThan(oscBefore);
    sfx.dispose();
  });

  it('playTransitionWhoosh creates a filtered noise sweep when unmuted', () => {
    const sfx = createSfxSystem();
    sfx.toggleMute(); // unmute
    const filterBefore = lastFakeContext().nodesCreated.biquadFilter;

    sfx.playTransitionWhoosh();
    expect(lastFakeContext().nodesCreated.biquadFilter).toBeGreaterThan(filterBefore);
    sfx.dispose();
  });

  it('disposes all nodes and closes the AudioContext', async () => {
    const sfx = createSfxSystem();
    sfx.toggleMute(); // unmute → creates context + bed
    sfx.dispose();
    // The context must be closed.
    await Promise.resolve();
    const ctx = lastFakeContext();
    expect(ctx.closed).toBe(true);
  });

  it('update advances the scheduler and does not throw while muted', () => {
    const sfx = createSfxSystem();
    // Advance a long time; no accent should fire while muted.
    for (let i = 0; i < 100; i++) {
      sfx.update(100);
    }
    expect(ctorCallCount).toBe(0);
    sfx.dispose();
  });

  it('each era produces a bed (unmuted)', () => {
    for (const era of ERA_KEYS) {
      const sfx = createSfxSystem();
      sfx.setEra(era);
      sfx.toggleMute(); // unmute → builds bed for era
      const ctx = lastFakeContext();
      expect(ctx.nodesCreated.bufferSource).toBeGreaterThanOrEqual(2);
      expect(ctx.nodesCreated.oscillator).toBeGreaterThanOrEqual(2);
      sfx.dispose();
    }
  });

  it('toggleMute twice returns to muted state', () => {
    const sfx = createSfxSystem();
    expect(sfx.toggleMute()).toBe(false); // unmuted
    expect(sfx.toggleMute()).toBe(true); // muted again
    expect(sfx.isMuted()).toBe(true);
    sfx.dispose();
  });

  it('does not throw when toggling with no AudioContext available', () => {
    // Remove the global constructor to simulate unsupported environment.
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('window', { AudioContext: undefined });
    const sfx = createSfxSystem();
    expect(sfx.toggleMute()).toBe(true); // stays muted — no AudioContext
    expect(sfx.isEnabled()).toBe(false);
    // Restore for other tests.
    vi.stubGlobal('AudioContext', CountingAudioContext as unknown as typeof AudioContext);
    vi.stubGlobal('window', fakeWindow);
    sfx.dispose();
  });
});
