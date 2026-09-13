// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../audio/audioEngine';
import { EraStore } from '../era/state';
import { createTimelineSlider, type TimelineSlider } from './timelineSlider';

// ============================================================================
// Minimal Web Audio stub harness (mirrors src/audio/audioEngine.test.ts).
// The AudioEngine under test is real; only the concrete AudioContext graph
// nodes are stubbed so jsdom can run it.
// ============================================================================

class StubAudioParam {
  value = 0;

  setValueAtTime(value: number): void {
    this.value = value;
  }

  linearRampToValueAtTime(value: number): void {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }

  cancelScheduledValues(): void {}
}

class StubAudioNode {
  connect(_destination: StubAudioNode): StubAudioNode {
    return _destination;
  }

  disconnect(): void {}
}

class StubGain extends StubAudioNode {
  readonly gain = new StubAudioParam();
}

class StubOscillator extends StubAudioNode {
  type: OscillatorType = 'sine';
  readonly frequency = new StubAudioParam();
  onended: (() => void) | null = null;

  start(): void {}
  stop(): void {}
}

class StubBiquadFilter extends StubAudioNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new StubAudioParam();
  readonly Q = new StubAudioParam();
}

class StubBufferSource extends StubAudioNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;

  start(): void {}
  stop(): void {}
}

class StubAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  private readonly _channels: Float32Array[];

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
  readonly destination = new StubGain();
  createdGains = 0;

  createGain(): GainNode {
    this.createdGains += 1;
    return new StubGain() as unknown as GainNode;
  }

  createOscillator(): OscillatorNode {
    return new StubOscillator() as unknown as OscillatorNode;
  }

  createBiquadFilter(): BiquadFilterNode {
    return new StubBiquadFilter() as unknown as BiquadFilterNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    return new StubBufferSource() as unknown as AudioBufferSourceNode;
  }

  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
    return new StubAudioBuffer(channels, length, sampleRate) as unknown as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }
}

// ============================================================================
// Test helpers
// ============================================================================

function stopByYear(slider: TimelineSlider, year: number): HTMLElement | null {
  const yearKey = String(year);
  for (const stop of Array.from(slider.element.querySelectorAll<HTMLElement>('[data-hud-stop]'))) {
    if (stop.getAttribute('data-year') === yearKey) {
      return stop;
    }
  }
  return null;
}

function readoutText(slider: TimelineSlider): string {
  const year = slider.element.querySelector('[data-hud-readout-year]');
  return year?.textContent ?? '';
}

function isCurrent(stop: HTMLElement): boolean {
  return stop.classList.contains('is-current') && stop.getAttribute('aria-current') === 'true';
}

/** jsdom does not set `key` on KeyboardEvent from its init dict — inject it. */
function keydown(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'key', { configurable: true, value: key });
  return event;
}

// ============================================================================
// Integration tests: real EraStore + real AudioEngine (nodes stubbed)
// ============================================================================

describe('TimelineSlider integration (real EraStore + AudioEngine)', () => {
  let store: EraStore;
  let engine: AudioEngine;
  let stubCtx: StubAudioContext;
  let container: HTMLElement;
  let slider: TimelineSlider;
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    store = new EraStore();
    stubCtx = new StubAudioContext();
    engine = new AudioEngine({
      audioContextFactory: () => stubCtx as unknown as AudioContext,
      autoUnlock: false,
      initialMasterVolume: 0.8,
    });
    onSelect = vi.fn();
    slider = createTimelineSlider({ container, store, audio: engine, onSelect });
  });

  afterEach(() => {
    slider.dispose();
    engine.dispose();
    document.body.replaceChildren();
  });

  it('mounts bound to the real store, reflecting the current era', () => {
    expect(slider.currentEra).toBe(1945);
    expect(readoutText(slider)).toBe('1945');
    expect(isCurrent(stopByYear(slider, 1945)!)).toBe(true);
    expect(slider.isTransitioning).toBe(false);
  });

  it('drives highlight, readout and the transition progress indicator from the store', () => {
    store.requestEra(2025);

    expect(slider.currentEra).toBe(2025);
    expect(readoutText(slider)).toBe('2025');
    expect(isCurrent(stopByYear(slider, 2025)!)).toBe(true);
    expect(isCurrent(stopByYear(slider, 1945)!)).toBe(false);
    expect(slider.isTransitioning).toBe(true);
    expect(slider.transitionProgress).toBe(0);

    const status = container.querySelector('[data-hud-transition-status]') as HTMLElement;
    expect(status.hasAttribute('hidden')).toBe(false);
    expect(status.textContent).toContain('1945 → 2025');
    expect(status.textContent).toContain('0%');

    store.setTransitionProgress(0.5);
    expect(slider.transitionProgress).toBe(0.5);
    expect(status.textContent).toContain('50%');
    const fill = container.querySelector('[data-hud-progress]') as HTMLElement;
    expect(fill.style.width).toBe('50%');

    store.setTransitionProgress(1);
    expect(slider.isTransitioning).toBe(false);
    expect(slider.transitionProgress).toBe(0);
    expect(status.hasAttribute('hidden')).toBe(true);
    expect(fill.style.width).toBe('0%');
  });

  it('publishes user selection through the store and calls onSelect only on genuine change', () => {
    const stop1965 = stopByYear(slider, 1965);
    expect(stop1965).not.toBeNull();

    stop1965!.click();
    expect(store.current).toBe(1965);
    expect(slider.currentEra).toBe(1965);
    expect(readoutText(slider)).toBe('1965');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1965);

    // Same stop again: idempotent, no additional publish.
    stop1965!.click();
    expect(onSelect).toHaveBeenCalledTimes(1);

    // Keyboard navigation publishes through the same store contract.
    const track = container.querySelector('[data-hud-track]') as HTMLElement;
    track.focus();
    track.dispatchEvent(keydown('ArrowRight'));
    expect(store.current).toBe(1985);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith(1985);
  });

  it('routes the mute toggle through the real AudioEngine with state reflection', () => {
    const muteButton = container.querySelector('[data-hud-mute]') as HTMLButtonElement;

    expect(engine.isMuted()).toBe(false);
    expect(slider.muted).toBe(false);
    expect(muteButton.getAttribute('aria-pressed')).toBe('false');

    muteButton.click();
    expect(engine.isMuted()).toBe(true);
    expect(slider.muted).toBe(true);
    expect(muteButton.getAttribute('aria-pressed')).toBe('true');
    expect(muteButton.getAttribute('data-muted')).toBe('true');

    // Click feedback went through the engine: the lazy node graph was built.
    expect(stubCtx.createdGains).toBeGreaterThan(0);

    muteButton.click();
    expect(engine.isMuted()).toBe(false);
    expect(slider.muted).toBe(false);
    expect(muteButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('toggles the help overlay and handles ? / Escape while bound to real systems', () => {
    const helpButton = container.querySelector('[data-hud-help]') as HTMLButtonElement;

    expect(slider.helpVisible).toBe(false);
    helpButton.click();
    expect(slider.helpVisible).toBe(true);
    expect(helpButton.getAttribute('aria-expanded')).toBe('true');

    window.dispatchEvent(keydown('?'));
    expect(slider.helpVisible).toBe(false);

    window.dispatchEvent(keydown('?'));
    expect(slider.helpVisible).toBe(true);

    window.dispatchEvent(keydown('Escape'));
    expect(slider.helpVisible).toBe(false);
  });
});