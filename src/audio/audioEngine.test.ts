import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AmbienceBedInstance,
  createAmbienceBed,
  createEqualPowerFadeCurve,
  createNoiseBuffer,
  DEFAULT_ERA_AMBIENCE,
} from './ambience';
import { AudioEngine } from './audioEngine';
import { playClick, playSuccessTick, playTransitionWhoosh } from './sfx';

// ============================================================================
// Web Audio Test Stub Harness
// ============================================================================

interface MockAudioParamCalls {
  setValueAtTime: Array<{ value: number; startTime: number }>;
  linearRampToValueAtTime: Array<{ value: number; endTime: number }>;
  exponentialRampToValueAtTime: Array<{ value: number; endTime: number }>;
  cancelScheduledValues: Array<{ startTime: number }>;
}

class StubAudioParam {
  value: number;
  calls: MockAudioParamCalls = {
    setValueAtTime: [],
    linearRampToValueAtTime: [],
    exponentialRampToValueAtTime: [],
    cancelScheduledValues: [],
  };

  constructor(initialValue = 0) {
    this.value = initialValue;
  }

  setValueAtTime(value: number, startTime: number): void {
    this.value = value;
    this.calls.setValueAtTime.push({ value, startTime });
  }

  linearRampToValueAtTime(value: number, endTime: number): void {
    this.value = value;
    this.calls.linearRampToValueAtTime.push({ value, endTime });
  }

  exponentialRampToValueAtTime(value: number, endTime: number): void {
    this.value = value;
    this.calls.exponentialRampToValueAtTime.push({ value, endTime });
  }

  cancelScheduledValues(startTime: number): void {
    this.calls.cancelScheduledValues.push({ startTime });
  }
}

class StubAudioNode {
  connectedTo: StubAudioNode[] = [];
  isDisconnected = false;

  connect(destination: StubAudioNode): StubAudioNode {
    this.connectedTo.push(destination);
    return destination;
  }

  disconnect(): void {
    this.isDisconnected = true;
    this.connectedTo = [];
  }
}

class StubGainNode extends StubAudioNode {
  readonly gain: StubAudioParam;

  constructor(initialGain = 1.0) {
    super();
    this.gain = new StubAudioParam(initialGain);
  }
}

class StubOscillatorNode extends StubAudioNode {
  type: OscillatorType = 'sine';
  readonly frequency = new StubAudioParam(440);
  readonly detune = new StubAudioParam(0);
  started = false;
  stopped = false;
  onended: (() => void) | null = null;

  start(_time?: number): void {
    this.started = true;
  }

  stop(_time?: number): void {
    this.stopped = true;
    if (this.onended) {
      this.onended();
    }
  }
}

class StubBiquadFilterNode extends StubAudioNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new StubAudioParam(350);
  readonly Q = new StubAudioParam(1);
}

class StubAudioBufferSourceNode extends StubAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  started = false;
  stopped = false;
  onended: (() => void) | null = null;

  start(_time?: number): void {
    this.started = true;
  }

  stop(_time?: number): void {
    this.stopped = true;
    if (this.onended) {
      this.onended();
    }
  }
}

class StubAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  private _channels: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._channels = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this._channels[channel]!;
  }
}

class StubAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'suspended';
  readonly destination = new StubGainNode(1.0);

  createdGainNodes: StubGainNode[] = [];
  createdOscillators: StubOscillatorNode[] = [];
  createdFilters: StubBiquadFilterNode[] = [];
  createdBufferSources: StubAudioBufferSourceNode[] = [];
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;

  createGain(): GainNode {
    const node = new StubGainNode();
    this.createdGainNodes.push(node);
    return node as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    const node = new StubOscillatorNode();
    this.createdOscillators.push(node);
    return node as unknown as OscillatorNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    const node = new StubBiquadFilterNode();
    this.createdFilters.push(node);
    return node as unknown as BiquadFilterNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const node = new StubAudioBufferSourceNode();
    this.createdBufferSources.push(node);
    return node as unknown as AudioBufferSourceNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return new StubAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.resumeCalls++;
    this.state = 'running';
  }

  async suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
  }

  async close(): Promise<void> {
    this.closeCalls++;
    this.state = 'closed';
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('AudioEngine', () => {
  let stubCtx: StubAudioContext;
  let engine: AudioEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    stubCtx = new StubAudioContext();
    engine = new AudioEngine({
      audioContextFactory: () => stubCtx as unknown as AudioContext,
      initialMasterVolume: 0.8,
      defaultCrossfadeDuration: 1.5,
      autoUnlock: true,
    });
  });

  afterEach(() => {
    engine.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Initialization and Master Gain Architecture', () => {
    it('constructs with injectable AudioContext factory without immediately starting context', () => {
      expect(engine.getContext()).toBeNull();
      expect(engine.getMasterVolume()).toBe(0.8);
      expect(engine.isMuted()).toBe(false);
    });

    it('start() instantiates the node graph and connects sub-gains to master destination', () => {
      const ctx = engine.start();
      expect(ctx).toBe(stubCtx as unknown as AudioContext);
      expect(stubCtx.createdGainNodes.length).toBeGreaterThanOrEqual(3);

      // Master gain connects to destination
      const masterGain = stubCtx.createdGainNodes[0]!;
      expect(masterGain.connectedTo).toContain(stubCtx.destination);
    });

    it('clamps initialMasterVolume to [0, 1]', () => {
      const highEngine = new AudioEngine({
        audioContextFactory: () => stubCtx as unknown as AudioContext,
        initialMasterVolume: 2.5,
      });
      expect(highEngine.getMasterVolume()).toBe(1.0);
      highEngine.dispose();

      const lowEngine = new AudioEngine({
        audioContextFactory: () => stubCtx as unknown as AudioContext,
        initialMasterVolume: -0.5,
      });
      expect(lowEngine.getMasterVolume()).toBe(0.0);
      lowEngine.dispose();
    });
  });

  describe('Master Volume and Mute Toggle Automation', () => {
    it('setMasterVolume ramps master gain node and updates internal volume state', () => {
      engine.start();
      const masterGain = stubCtx.createdGainNodes[0]!;

      engine.setMasterVolume(0.5, 0.1);
      expect(engine.getMasterVolume()).toBe(0.5);

      const linearCalls = (masterGain.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime;
      expect(linearCalls.length).toBeGreaterThanOrEqual(1);
      const lastCall = linearCalls[linearCalls.length - 1]!;
      expect(lastCall.value).toBe(0.5);
    });

    it('mute() ramps gain to zero and toggleMute() alternates states correctly', () => {
      engine.start();
      const masterGain = stubCtx.createdGainNodes[0]!;

      expect(engine.isMuted()).toBe(false);
      engine.mute(0.05);
      expect(engine.isMuted()).toBe(true);

      const muteCalls = (masterGain.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime;
      expect(muteCalls[muteCalls.length - 1]?.value).toBe(0);

      // unmute restores pre-mute volume
      engine.unmute(0.05);
      expect(engine.isMuted()).toBe(false);
      expect(engine.getMasterVolume()).toBe(0.8);
      const unmuteCalls = (masterGain.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime;
      expect(unmuteCalls[unmuteCalls.length - 1]?.value).toBe(0.8);

      // toggleMute: currently unmuted -> mutes (returns true)
      const nowMuted = engine.toggleMute();
      expect(nowMuted).toBe(true);
      expect(engine.isMuted()).toBe(true);

      // toggleMute: currently muted -> unmutes (returns false)
      const nowUnmuted = engine.toggleMute();
      expect(nowUnmuted).toBe(false);
      expect(engine.isMuted()).toBe(false);
    });

    it('setMasterVolume while muted preserves updated volume target for when unmuted', () => {
      engine.start();
      engine.mute();
      expect(engine.isMuted()).toBe(true);

      // Change volume while muted
      engine.setMasterVolume(0.4);
      expect(engine.getMasterVolume()).toBe(0.4);

      // When unmuting, it should restore 0.4
      engine.unmute();
      expect(engine.getMasterVolume()).toBe(0.4);
      const masterGain = stubCtx.createdGainNodes[0]!;
      const linearCalls = (masterGain.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime;
      expect(linearCalls[linearCalls.length - 1]?.value).toBe(0.4);
    });
  });

  describe('Autoplay Unlock Gesture Handling', () => {
    it('initializes suspended-safe and unlock() resumes context', async () => {
      stubCtx.state = 'suspended';
      expect(engine.isUnlocked()).toBe(false);

      const result = await engine.unlock();
      expect(result).toBe(true);
      expect(stubCtx.resumeCalls).toBe(1);
      expect(engine.isUnlocked()).toBe(true);
    });

    it('unlock() is idempotent — calling multiple times only resumes once', async () => {
      stubCtx.state = 'suspended';

      await engine.unlock();
      await engine.unlock();
      await engine.unlock();

      expect(stubCtx.resumeCalls).toBe(1);
      expect(engine.isUnlocked()).toBe(true);
    });

    it('responds to simulated DOM pointerdown / keydown gesture event once', async () => {
      stubCtx.state = 'suspended';

      const pointerEvent = new Event('pointerdown');
      window.dispatchEvent(pointerEvent);

      // Let microtasks resolve
      await Promise.resolve();
      expect(stubCtx.resumeCalls).toBe(1);
      expect(engine.isUnlocked()).toBe(true);

      // Subsequent events should not trigger extra resume calls
      window.dispatchEvent(new Event('keydown'));
      await Promise.resolve();
      expect(stubCtx.resumeCalls).toBe(1);
    });

    it('preserves muted state across unlock gesture', async () => {
      stubCtx.state = 'suspended';
      engine.mute();

      await engine.unlock();
      expect(engine.isMuted()).toBe(true);
    });
  });

  describe('Era Ambience Synthesis and Crossfades', () => {
    it('contains distinct preset descriptors for all 6 eras', () => {
      const eraKeys = ['1945', '1965', '1985', '2005', '2025', '2055'];
      for (const era of eraKeys) {
        const desc = DEFAULT_ERA_AMBIENCE[era];
        expect(desc).toBeDefined();
        expect(desc?.id).toBe(era);
        expect(desc?.tones.length).toBeGreaterThan(0);
        expect(desc?.noise.length).toBeGreaterThan(0);
      }

      // Check distinct acoustic characters
      // 1945 post-war: lower traffic, bandpass noise at 650Hz
      expect(DEFAULT_ERA_AMBIENCE['1945']?.noise[0]?.cutoff).toBe(650);
      // 1965 mid-century: 60Hz mains hum tone
      expect(DEFAULT_ERA_AMBIENCE['1965']?.tones[0]?.frequency).toBe(60);
      // 1985 neon/city: 1200Hz bandpass
      expect(DEFAULT_ERA_AMBIENCE['1985']?.noise[0]?.cutoff).toBe(1200);
      // 2005 metropolis: heavy lowpass 1600Hz
      expect(DEFAULT_ERA_AMBIENCE['2005']?.noise[0]?.cutoff).toBe(1600);
      // 2025 EV/smart city: 320Hz triangle EV motor whine + 2200Hz shimmer
      expect(DEFAULT_ERA_AMBIENCE['2025']?.tones[0]?.frequency).toBe(320);
      expect(DEFAULT_ERA_AMBIENCE['2025']?.noise[0]?.cutoff).toBe(2200);
      // 2055 futuristic: 216Hz & 432Hz harmonic tones + 4500Hz cyber shimmer
      expect(DEFAULT_ERA_AMBIENCE['2055']?.tones[0]?.frequency).toBe(216);
      expect(DEFAULT_ERA_AMBIENCE['2055']?.noise[0]?.cutoff).toBe(4500);
    });

    it('setEra() creates ambience bed and schedules linear-ramp automation', () => {
      engine.setEra('1945', undefined, 1.5);
      expect(engine.getCurrentEra()).toBe('1945');

      expect(stubCtx.createdOscillators.length).toBeGreaterThan(0);
      expect(stubCtx.createdFilters.length).toBeGreaterThan(0);

      // Verify linear ramp automation was scheduled for the incoming bed
      const bedGains = stubCtx.createdGainNodes;
      const rampScheduled = bedGains.some(
        g => (g.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime.length > 0,
      );
      expect(rampScheduled).toBe(true);
    });

    it('crossfade between eras ramps outgoing bed to 0 and incoming bed to baseVolume', () => {
      // 1. Initial era
      engine.setEra('1945', undefined, 1.0);
      vi.advanceTimersByTime(1100);

      // 2. Crossfade to 1965
      engine.setEra('1965', undefined, 1.0);
      expect(engine.getCurrentEra()).toBe('1965');

      // Verify that gain automations were scheduled
      const bedGains = stubCtx.createdGainNodes;
      const ramps = bedGains.flatMap(
        g => (g.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime,
      );
      expect(ramps.some(r => r.value === 0)).toBe(true); // Outgoing bed ramped to 0
      expect(ramps.some(r => r.value === DEFAULT_ERA_AMBIENCE['1965']!.baseVolume)).toBe(true); // Incoming bed ramped up

      // Advance time to allow crossfade to finish and clean up
      vi.advanceTimersByTime(1100);
    });

    it('calling setEra with the same active era is a no-op', () => {
      engine.setEra('1965', undefined, 1.0);
      vi.advanceTimersByTime(1100);

      const oscCountBefore = stubCtx.createdOscillators.length;
      const filterCountBefore = stubCtx.createdFilters.length;

      // Repeat setEra with '1965'
      engine.setEra('1965');
      expect(stubCtx.createdOscillators.length).toBe(oscCountBefore);
      expect(stubCtx.createdFilters.length).toBe(filterCountBefore);
    });

    it('handles mid-fade interruption cleanly without orphan beds or errors', () => {
      // Start fade to 1945
      engine.setEra('1945', undefined, 2.0);

      // 500ms into 2000ms transition, user switches to 1985
      vi.advanceTimersByTime(500);
      engine.setEra('1985', undefined, 2.0);
      expect(engine.getCurrentEra()).toBe('1985');

      // 500ms later, user switches to 2025
      vi.advanceTimersByTime(500);
      engine.setEra('2025', undefined, 2.0);
      expect(engine.getCurrentEra()).toBe('2025');

      // Allow final transition to complete
      vi.advanceTimersByTime(2500);
      expect(engine.getCurrentEra()).toBe('2025');
    });
  });

  describe('Synthesized SFX (Whoosh, Click, Success Tick)', () => {
    it('playTransitionWhoosh synthesizes noise sweep + sub bass with envelope matching duration', () => {
      const sfx = engine.playTransitionWhoosh(1.5, 0.9);
      expect(sfx).not.toBeNull();

      // Verify noise filter was created and ramped
      const filters = stubCtx.createdFilters;
      expect(filters.length).toBeGreaterThan(0);
      const sweepFilter = filters[filters.length - 1]!;
      const freqRamps = (sweepFilter.frequency as unknown as StubAudioParam).calls.linearRampToValueAtTime;
      expect(freqRamps.length).toBe(2); // Peak and end ramp
      expect(freqRamps[0]?.value).toBe(2400);

      // Verify sub oscillator was created
      const oscs = stubCtx.createdOscillators;
      expect(oscs.length).toBeGreaterThan(0);

      sfx?.stop();
    });

    it('playClick synthesizes a short filtered burst', () => {
      const click = engine.playClick(2000, 0.03);
      expect(click).not.toBeNull();

      const oscs = stubCtx.createdOscillators;
      const lastOsc = oscs[oscs.length - 1]!;
      expect(lastOsc.type).toBe('triangle');

      click?.stop();
    });

    it('playSuccessTick synthesizes dual harmonic chime', () => {
      const tick = engine.playSuccessTick(0.3);
      expect(tick).not.toBeNull();

      const oscs = stubCtx.createdOscillators;
      expect(oscs.length).toBeGreaterThanOrEqual(2);

      tick?.stop();
    });

    it('SFX route through master gain so mute silences all SFX', () => {
      engine.start();
      engine.mute();

      engine.playClick();
      engine.playTransitionWhoosh();
      engine.playSuccessTick();

      // Master gain is zero
      const masterGain = stubCtx.createdGainNodes[0]!;
      expect(engine.isMuted()).toBe(true);
      const lastMasterRamp = (masterGain.gain as unknown as StubAudioParam).calls.linearRampToValueAtTime;
      expect(lastMasterRamp[lastMasterRamp.length - 1]?.value).toBe(0);
    });
  });

  describe('Procedural Synthesis Isolation & Resource Cleanup', () => {
    it('createNoiseBuffer generates deterministic procedural noise without audio files', () => {
      const buf1 = createNoiseBuffer(stubCtx as unknown as AudioContext, 1, 42);
      const buf2 = createNoiseBuffer(stubCtx as unknown as AudioContext, 1, 42);
      const data1 = buf1.getChannelData(0);
      const data2 = buf2.getChannelData(0);

      expect(data1.length).toBe(44100);
      expect(data1[0]).toBe(data2[0]);
      expect(data1[100]).toBe(data2[100]);
    });

    it('createEqualPowerFadeCurve computes constant power energy values', () => {
      const fadeIn = createEqualPowerFadeCurve(0, 1, 16);
      const fadeOut = createEqualPowerFadeCurve(1, 0, 16);

      expect(fadeIn.length).toBe(16);
      expect(fadeOut.length).toBe(16);

      expect(fadeIn[0]).toBeCloseTo(0);
      expect(fadeIn[15]!).toBeCloseTo(1);
      expect(fadeOut[0]).toBeCloseTo(1);
      expect(fadeOut[15]!).toBeCloseTo(0);

      // Midpoint equal-power sum: sin^2(pi/4) + cos^2(pi/4) = 0.5 + 0.5 = 1.0
      // In amplitude, both are ~0.707 (sqrt(0.5))
      const midIdx = 7;
      const midIn = fadeIn[midIdx]!;
      const midOut = fadeOut[midIdx]!;
      expect(midIn * midIn + midOut * midOut).toBeCloseTo(1.0, 1);
    });

    it('dispose() disconnects all nodes, cancels timers, and closes context', () => {
      engine.start();
      engine.setEra('1945');
      engine.setEra('1965');

      engine.dispose();

      expect(stubCtx.closeCalls).toBe(1);

      // Subsequent actions should be safe no-ops or throw
      expect(engine.playClick()).toBeNull();
      expect(engine.playTransitionWhoosh()).toBeNull();
    });

    it('createAmbienceBed can be instantiated standalone and manipulated', () => {
      const dest = stubCtx.createGain();
      const bed: AmbienceBedInstance = createAmbienceBed(
        stubCtx as unknown as AudioContext,
        dest,
        DEFAULT_ERA_AMBIENCE['1945']!,
      );

      expect(bed.eraId).toBe('1945');
      bed.setVolume(0.5, 0.1);
      bed.stop();
      bed.disconnect();
    });

    it('standalone SFX functions execute cleanly', () => {
      const dest = stubCtx.createGain();
      const ctx = stubCtx as unknown as AudioContext;

      const whoosh = playTransitionWhoosh(ctx, dest, { duration: 0.8, intensity: 0.8 });
      expect(whoosh.node).toBeDefined();
      whoosh.stop();

      const click = playClick(ctx, dest, { frequency: 1200, duration: 0.02 });
      expect(click.node).toBeDefined();
      click.stop();

      const tick = playSuccessTick(ctx, dest, { volume: 0.15 });
      expect(tick.node).toBeDefined();
      tick.stop();
    });

    it('custom ambience descriptors can be passed to constructor or setEra', () => {
      const customBedDesc = {
        id: 'custom-era',
        name: 'Custom Era Test',
        baseVolume: 0.6,
        tones: [{ type: 'sine' as const, frequency: 150, gain: 0.2 }],
        noise: [{ filterType: 'lowpass' as const, cutoff: 800, gain: 0.2 }],
      };

      engine.setEra('custom-era', customBedDesc, 0.5);
      expect(engine.getCurrentEra()).toBe('custom-era');
    });

    it('unlocking an already running context succeeds immediately', async () => {
      stubCtx.state = 'running';
      const result = await engine.unlock();
      expect(result).toBe(true);
      expect(engine.isUnlocked()).toBe(true);
      expect(stubCtx.resumeCalls).toBe(0);
    });

    it('throws helpful error if default context factory is called without AudioContext available', () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error - simulating environment without AudioContext
      delete globalThis.window;

      const noCtxEngine = new AudioEngine({ autoUnlock: false });
      expect(() => noCtxEngine.start()).toThrow('AudioContext is not supported');

      globalThis.window = originalWindow;
    });
  });
});
