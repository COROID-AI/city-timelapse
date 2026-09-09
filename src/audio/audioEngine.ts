/**
 * Procedural WebAudio Engine for City Time Period Timelapse.
 *
 * Implements master/bus audio graph, era music loops, ambience textures,
 * gesture-gated resume, mute/volume HUD APIs, and EraSystem lifecycle.
 */

import type { AudioEraSpec, EraSystem, TimelineChannel } from '../era/types';
import { ERAS, type EraId, isEraId } from '../era/years';
import { audioEraData } from './audioEraData';
import { createSfxController, type SfxController } from './sfx';
import {
  createEraAmbiencePlayer,
  createEraMusicPlayer,
  type EraAmbiencePlayer,
  type EraMusicPlayer,
} from './synth';

export type AudioBusType = 'master' | 'ambience' | 'music' | 'sfx';

export interface AudioEngineUpdateOptions {
  /** Whether an animated timeline transition is actively running. */
  readonly isTransitioning?: boolean;
  /** Whether the user is actively scrubbing the timeline. */
  readonly isScrubbing?: boolean;
}

export interface AudioEngineOptions {
  /**
   * Injectable AudioContext factory for tests and custom audio environments.
   * If omitted, attempts to instantiate `window.AudioContext` or falls back to a fake context.
   */
  contextFactory?: () => AudioContext;
  /** Initial master volume level [0.0..1.0]. Defaults to 0.7. */
  masterVolume?: number;
  /** Initial ambience bus volume level [0.0..1.0]. Defaults to 0.8. */
  ambienceVolume?: number;
  /** Initial music bus volume level [0.0..1.0]. Defaults to 0.6. */
  musicVolume?: number;
  /** Initial SFX bus volume level [0.0..1.0]. Defaults to 0.9. */
  sfxVolume?: number;
  /** Whether to automatically attach gesture listeners in browser environments. Defaults to true. */
  autoResumeOnGesture?: boolean;
}

export interface AudioEngine extends EraSystem {
  /** Underlying WebAudio AudioContext instance. */
  readonly context: AudioContext;
  /** Whether the audio context is currently in the suspended state. */
  isSuspended(): boolean;
  /** Resumes the audio context upon user gesture. */
  resume(): Promise<void>;
  /** Whether the engine is currently muted. */
  isMuted(): boolean;
  /** Sets the mute state for the master audio graph. */
  setMuted(muted: boolean): void;
  /** Gets the master volume [0.0..1.0]. */
  getVolume(): number;
  /** Sets the master volume [0.0..1.0]. */
  setVolume(volume: number): void;
  /** Gets the volume for a specific bus ('master' | 'ambience' | 'music' | 'sfx'). */
  getBusVolume(bus: AudioBusType): number;
  /** Sets the volume for a specific bus ('master' | 'ambience' | 'music' | 'sfx'). */
  setBusVolume(bus: AudioBusType, volume: number): void;
  /** Returns the current timeline channel active in the engine. */
  getChannel(): TimelineChannel;
  /** Returns the active era weights [0.0..1.0] across all 5 eras. */
  getEraWeights(): Record<EraId, number>;
  /** Procedural SFX controller. */
  readonly sfx: SfxController;
  /** Triggers the time-warp transition whoosh effect. */
  triggerWhoosh(durationSeconds?: number): void;
  /** Triggers a vehicle pass-by sound effect. */
  triggerCarPassBy(options?: { direction?: 'left-to-right' | 'right-to-left'; speed?: number }): void;
  /** Triggers an era-specific horn honk. */
  triggerHorn(hornType?: AudioEraSpec['hornType']): void;
  /** Attaches the engine and sets up gesture listeners (EraSystem lifecycle). */
  attach(context?: unknown): void;
  /** Updates the audio engine each frame (EraSystem lifecycle). */
  update(channel: TimelineChannel, deltaSeconds: number, options?: AudioEngineUpdateOptions): void;
  /** Disposes all audio nodes, schedulers, and listeners (EraSystem lifecycle). */
  dispose(): void;
}

/**
 * Creates a lightweight mock / fake AudioParam for non-audio testing environments.
 */
function createFakeAudioParam(initialValue = 1.0): AudioParam {
  const param = {
    value: initialValue,
    defaultValue: initialValue,
    minValue: -3.4028235e38,
    maxValue: 3.4028235e38,
    setValueAtTime(val: number, _time: number) {
      param.value = val;
      return param as unknown as AudioParam;
    },
    linearRampToValueAtTime(val: number, _time: number) {
      param.value = val;
      return param as unknown as AudioParam;
    },
    exponentialRampToValueAtTime(val: number, _time: number) {
      param.value = val;
      return param as unknown as AudioParam;
    },
    setTargetAtTime(val: number, _time: number, _timeConstant: number) {
      param.value = val;
      return param as unknown as AudioParam;
    },
    setValueCurveAtTime(_values: Float32Array | number[], _time: number, _duration: number) {
      return param as unknown as AudioParam;
    },
    cancelScheduledValues(_time: number) {
      return param as unknown as AudioParam;
    },
    cancelAndHoldAtTime(_time: number) {
      return param as unknown as AudioParam;
    },
  };
  return param as unknown as AudioParam;
}

/**
 * Creates a lightweight mock / fake AudioNode.
 */
function createFakeAudioNode(): AudioNode {
  return {
    connect(dest: unknown) {
      return dest as AudioNode;
    },
    disconnect() {},
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: 'max',
    channelInterpretation: 'speakers',
  } as unknown as AudioNode;
}

/**
 * Creates a fallback fake AudioContext for test and headless environments.
 */
export function createFakeAudioContext(): AudioContext {
  let state: AudioContextState = 'suspended';
  let currentTime = 0;

  const fakeCtx = {
    get state() {
      return state;
    },
    get currentTime() {
      return currentTime;
    },
    sampleRate: 44100,
    destination: createFakeAudioNode(),
    createGain(): GainNode {
      const node = createFakeAudioNode() as GainNode;
      (node as { gain: AudioParam }).gain = createFakeAudioParam(1.0);
      return node;
    },
    createOscillator(): OscillatorNode {
      const node = createFakeAudioNode() as OscillatorNode;
      (node as { frequency: AudioParam }).frequency = createFakeAudioParam(440);
      (node as { detune: AudioParam }).detune = createFakeAudioParam(0);
      (node as { type: OscillatorType }).type = 'sine';
      (node as { start: (time?: number) => void }).start = (_time?: number) => {};
      (node as { stop: (time?: number) => void }).stop = (_time?: number) => {};
      return node;
    },
    createBiquadFilter(): BiquadFilterNode {
      const node = createFakeAudioNode() as BiquadFilterNode;
      (node as { frequency: AudioParam }).frequency = createFakeAudioParam(1000);
      (node as { Q: AudioParam }).Q = createFakeAudioParam(1.0);
      (node as { gain: AudioParam }).gain = createFakeAudioParam(0);
      (node as { detune: AudioParam }).detune = createFakeAudioParam(0);
      (node as { type: BiquadFilterType }).type = 'lowpass';
      return node;
    },
    createBufferSource(): AudioBufferSourceNode {
      const node = createFakeAudioNode() as AudioBufferSourceNode;
      (node as { playbackRate: AudioParam }).playbackRate = createFakeAudioParam(1.0);
      (node as { detune: AudioParam }).detune = createFakeAudioParam(0);
      (node as { loop: boolean }).loop = false;
      (node as { loopStart: number }).loopStart = 0;
      (node as { loopEnd: number }).loopEnd = 0;
      (node as { buffer: AudioBuffer | null }).buffer = null;
      (node as { start: (time?: number) => void }).start = (_time?: number) => {};
      (node as { stop: (time?: number) => void }).stop = (_time?: number) => {};
      return node;
    },
    createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
      const channelData: Float32Array[] = [];
      for (let i = 0; i < channels; i++) {
        channelData.push(new Float32Array(length));
      }
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: (ch: number) => channelData[ch] || new Float32Array(length),
        copyFromChannel: () => {},
        copyToChannel: () => {},
      } as AudioBuffer;
    },
    createStereoPanner(): StereoPannerNode {
      const node = createFakeAudioNode() as StereoPannerNode;
      (node as { pan: AudioParam }).pan = createFakeAudioParam(0);
      return node;
    },
    resume(): Promise<void> {
      state = 'running';
      return Promise.resolve();
    },
    suspend(): Promise<void> {
      state = 'suspended';
      return Promise.resolve();
    },
    close(): Promise<void> {
      state = 'closed';
      return Promise.resolve();
    },
    addEventListener() {},
    removeEventListener() {},
    // Test helper to advance fake time
    _advanceTime(delta: number) {
      currentTime += delta;
    },
  };

  return fakeCtx as unknown as AudioContext;
}

/**
 * Creates the complete Procedural WebAudio Engine.
 */
export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  // AudioContext instantiation:
  // 1. Injected context factory
  // 2. Browser AudioContext / webkitAudioContext
  // 3. Fallback fake context for jsdom/Node
  let ctx: AudioContext;
  if (options.contextFactory) {
    ctx = options.contextFactory();
  } else if (typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioContextClass();
  } else {
    ctx = createFakeAudioContext();
  }

  // ---------------------------------------------------------------------------
  // Master & Bus Audio Graph Construction
  // ---------------------------------------------------------------------------
  let masterVolume = Math.max(0, Math.min(1, options.masterVolume ?? 0.7));
  let ambienceVolume = Math.max(0, Math.min(1, options.ambienceVolume ?? 0.8));
  let musicVolume = Math.max(0, Math.min(1, options.musicVolume ?? 0.6));
  let sfxVolume = Math.max(0, Math.min(1, options.sfxVolume ?? 0.9));
  let isMuted = false;

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const ambienceBus = ctx.createGain();
  ambienceBus.gain.setValueAtTime(ambienceVolume, ctx.currentTime);
  ambienceBus.connect(masterGain);

  const musicBus = ctx.createGain();
  musicBus.gain.setValueAtTime(musicVolume, ctx.currentTime);
  musicBus.connect(masterGain);

  const sfxBus = ctx.createGain();
  sfxBus.gain.setValueAtTime(sfxVolume, ctx.currentTime);
  sfxBus.connect(masterGain);

  // ---------------------------------------------------------------------------
  // SFX Controller Sub-System
  // ---------------------------------------------------------------------------
  const sfxController: SfxController = createSfxController(ctx, sfxBus);

  // ---------------------------------------------------------------------------
  // Era Music & Ambience Track Sub-Graphs
  // ---------------------------------------------------------------------------
  const eraMusicPlayers: Record<EraId, EraMusicPlayer> = {} as Record<EraId, EraMusicPlayer>;
  const eraAmbiencePlayers: Record<EraId, EraAmbiencePlayer> = {} as Record<EraId, EraAmbiencePlayer>;

  for (const era of ERAS) {
    eraMusicPlayers[era] = createEraMusicPlayer(ctx, era, musicBus);
    eraAmbiencePlayers[era] = createEraAmbiencePlayer(ctx, era, ambienceBus);
  }

  // Initial channel and era weights
  let currentChannel: TimelineChannel = {
    fromEra: '1945',
    toEra: '1945',
    t: 0,
  };

  const eraWeights: Record<EraId, number> = {
    '1945': 1.0,
    '1965': 0.0,
    '1985': 0.0,
    '2005': 0.0,
    '2025': 0.0,
  };

  let previousTransitionState = {
    fromEra: '1945' as EraId,
    toEra: '1945' as EraId,
    isTransitioning: false,
  };

  let disposed = false;
  let gestureUnlocked = false;

  // ---------------------------------------------------------------------------
  // User Gesture Autoplay Unlock
  // ---------------------------------------------------------------------------
  async function unlockAudio(): Promise<void> {
    if (disposed) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Resume safety
      }
    }
    gestureUnlocked = true;
    removeGestureListeners();
  }

  const gestureEvents = ['pointerdown', 'click', 'keydown', 'touchstart'];
  function onGestureEvent() {
    unlockAudio();
  }

  function addGestureListeners() {
    if (typeof window === 'undefined') return;
    for (const evt of gestureEvents) {
      window.addEventListener(evt, onGestureEvent, { once: true, passive: true });
    }
  }

  function removeGestureListeners() {
    if (typeof window === 'undefined') return;
    for (const evt of gestureEvents) {
      window.removeEventListener(evt, onGestureEvent);
    }
  }

  if (options.autoResumeOnGesture !== false) {
    addGestureListeners();
  }

  // Helper to re-apply gain with mute logic
  function syncMasterGain() {
    const targetGain = isMuted ? 0.0001 : masterVolume;
    try {
      masterGain.gain.setValueAtTime(targetGain, ctx.currentTime);
    } catch {
      masterGain.gain.value = targetGain;
    }
  }

  function computeWeights(channel: TimelineChannel): void {
    for (const era of ERAS) {
      eraWeights[era] = 0;
    }

    if (!isEraId(channel.fromEra) || !isEraId(channel.toEra)) {
      eraWeights['1945'] = 1.0;
      return;
    }

    if (channel.fromEra === channel.toEra) {
      eraWeights[channel.fromEra] = 1.0;
      return;
    }

    const t = Math.max(0, Math.min(1, Number.isFinite(channel.t) ? channel.t : 0));
    eraWeights[channel.fromEra] = 1.0 - t;
    eraWeights[channel.toEra] = t;
  }

  return {
    context: ctx,

    isSuspended(): boolean {
      return ctx.state === 'suspended' && !gestureUnlocked;
    },

    async resume(): Promise<void> {
      await unlockAudio();
    },

    isMuted(): boolean {
      return isMuted;
    },

    setMuted(muted: boolean): void {
      isMuted = !!muted;
      syncMasterGain();
    },

    getVolume(): number {
      return masterVolume;
    },

    setVolume(vol: number): void {
      masterVolume = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 0));
      syncMasterGain();
    },

    getBusVolume(bus: AudioBusType): number {
      switch (bus) {
        case 'master':
          return masterVolume;
        case 'ambience':
          return ambienceVolume;
        case 'music':
          return musicVolume;
        case 'sfx':
          return sfxVolume;
      }
    },

    setBusVolume(bus: AudioBusType, vol: number): void {
      const safeVol = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 0));
      switch (bus) {
        case 'master':
          masterVolume = safeVol;
          syncMasterGain();
          break;
        case 'ambience':
          ambienceVolume = safeVol;
          try {
            ambienceBus.gain.setValueAtTime(ambienceVolume, ctx.currentTime);
          } catch {
            ambienceBus.gain.value = ambienceVolume;
          }
          break;
        case 'music':
          musicVolume = safeVol;
          try {
            musicBus.gain.setValueAtTime(musicVolume, ctx.currentTime);
          } catch {
            musicBus.gain.value = musicVolume;
          }
          break;
        case 'sfx':
          sfxVolume = safeVol;
          try {
            sfxBus.gain.setValueAtTime(sfxVolume, ctx.currentTime);
          } catch {
            sfxBus.gain.value = sfxVolume;
          }
          break;
      }
    },

    getChannel(): TimelineChannel {
      return currentChannel;
    },

    getEraWeights(): Record<EraId, number> {
      return { ...eraWeights };
    },

    sfx: sfxController,

    triggerWhoosh(durationSeconds?: number): void {
      sfxController.playTransitionWhoosh(durationSeconds);
    },

    triggerCarPassBy(opt?: { direction?: 'left-to-right' | 'right-to-left'; speed?: number }): void {
      sfxController.playCarPassBy(opt);
    },

    triggerHorn(hornType?: AudioEraSpec['hornType']): void {
      const activeHorn = hornType ?? audioEraData[currentChannel.toEra]?.hornType ?? 'classic_car_horn';
      sfxController.playHorn(activeHorn);
    },

    attach(_context?: unknown): void {
      // Re-bind gesture listeners if needed
      if (options.autoResumeOnGesture !== false) {
        addGestureListeners();
      }
      // Initialize with default weights
      computeWeights(currentChannel);
      for (const era of ERAS) {
        eraMusicPlayers[era]?.update(eraWeights[era], ctx.currentTime);
        eraAmbiencePlayers[era]?.update(eraWeights[era], ctx.currentTime);
      }
    },

    update(channel: TimelineChannel, deltaSeconds: number, updateOptions?: AudioEngineUpdateOptions): void {
      if (disposed) return;
      currentChannel = channel;

      const isScrubbing = updateOptions?.isScrubbing === true;
      const isCurrentlyTransitioning = updateOptions?.isTransitioning !== undefined
        ? updateOptions.isTransitioning
        : channel.fromEra !== channel.toEra;

      // Detect transition trigger: starting a transition or changing target era during transition
      if (!isScrubbing) {
        if (
          (isCurrentlyTransitioning && !previousTransitionState.isTransitioning) ||
          (isCurrentlyTransitioning && previousTransitionState.toEra !== channel.toEra)
        ) {
          sfxController.playTransitionWhoosh();
        }
      }

      previousTransitionState = {
        fromEra: channel.fromEra,
        toEra: channel.toEra,
        isTransitioning: isCurrentlyTransitioning && !isScrubbing,
      };

      computeWeights(channel);

      // Update all era music and ambience sub-graphs
      for (const era of ERAS) {
        eraMusicPlayers[era]?.update(eraWeights[era], ctx.currentTime);
        eraAmbiencePlayers[era]?.update(eraWeights[era], ctx.currentTime);
      }

      // Update crowd murmur based on dominant era
      const activeEra = channel.t >= 0.5 ? channel.toEra : channel.fromEra;
      const dominantWeight = eraWeights[activeEra] || 1.0;
      sfxController.setCrowdDensity(dominantWeight * 0.7);

      sfxController.update(ctx.currentTime, deltaSeconds);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      removeGestureListeners();

      for (const era of ERAS) {
        eraMusicPlayers[era]?.dispose();
        eraAmbiencePlayers[era]?.dispose();
      }

      sfxController.dispose();

      try {
        masterGain.disconnect();
        ambienceBus.disconnect();
        musicBus.disconnect();
        sfxBus.disconnect();
      } catch {
        // Safe disposal
      }

      if (typeof ctx.close === 'function' && ctx.state !== 'closed') {
        try {
          ctx.close();
        } catch {
          // Closed safe
        }
      }
    },
  };
}
