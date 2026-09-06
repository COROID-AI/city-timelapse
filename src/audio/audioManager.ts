/**
 * AudioManager — per-era ambient soundscape + one-shot SFX layer.
 *
 * Responsibilities:
 *   - Owns a single WebAudio `AudioContext` and a conservative master gain.
 *   - Builds all five era ambient beds up front so era switches crossfade
 *     instantly with no build latency, no clicks and no gaps.
 *   - Schedules low-volume, era-appropriate random one-shot SFX (horns,
 *     bells, blips, pings, ...) from the active era's pool.
 *   - Respects browser autoplay policy: starts muted and suspended, and
 *     only resumes the context on the first user gesture (the sound toggle).
 *   - Renders a small sound toggle button in the HUD corner.
 *
 * Lifecycle contract: `bootstrap` (constructor) -> `update` (setEra, crossfade)
 * -> `dispose`.
 */
import type { EraKey } from '../data/eraDefinition';
import { eraAudioLayers, AUDIO_ERA_KEYS } from './eras/index';
import type { AmbientHandle, EraAudioLayer } from './eras/types';
import { fadeTo } from './eras/helpers';

/** Options for constructing the AudioManager. */
export interface AudioManagerOptions {
  /** Host element into which the sound toggle button is mounted. */
  host: HTMLElement;
  /** The era active at bootstrap (defaults to the first era, 1945). */
  initialYear?: EraKey;
  /** Crossfade duration in seconds (default 0.8). */
  crossfadeSeconds?: number;
  /** Master gain ceiling, kept conservative to avoid clipping (default 0.7). */
  masterGain?: number;
  /** Min/max seconds between random one-shot SFX triggers. */
  sfxInterval?: [number, number];
}

/** An active ambient bed plus its crossfade gain node. */
interface ActiveBed {
  handle: AmbientHandle;
  gain: GainNode;
}

/** Default SFX spacing (seconds). */
const DEFAULT_SFX_INTERVAL: [number, number] = [2.5, 7.0];

/**
 * Pick a random element from a weighted list. `weight` is relative; a higher
 * weight makes a cue more likely to be chosen.
 */
function weightedPick<T extends { weight: number }>(items: T[]): T {
  let total = 0;
  for (const item of items) {
    total += Math.max(0, item.weight);
  }
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

/** Uniform random value in [min, max). */
function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class AudioManager {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly layers: Record<EraKey, EraAudioLayer>;
  private readonly beds = new Map<EraKey, ActiveBed>();
  private readonly host: HTMLElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly crossfadeSeconds: number;
  private readonly masterGain: number;
  private readonly sfxInterval: [number, number];

  private activeYear: EraKey;
  private soundOn = false;
  private disposed = false;
  private sfxTimer: number | null = null;

  /** Bootstrap: build context, master gain, all era beds, and the toggle. */
  constructor(options: AudioManagerOptions) {
    this.host = options.host;
    this.activeYear = options.initialYear ?? AUDIO_ERA_KEYS[0];
    this.crossfadeSeconds = options.crossfadeSeconds ?? 0.8;
    this.masterGain = options.masterGain ?? 0.7;
    this.sfxInterval = options.sfxInterval ?? DEFAULT_SFX_INTERVAL;

    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0; // start muted
    this.master.connect(this.ctx.destination);

    // Build every era layer + bed up front for click-free crossfades.
    this.layers = eraAudioLayers(this.ctx);
    for (const year of AUDIO_ERA_KEYS) {
      const gain = this.ctx.createGain();
      gain.gain.value = year === this.activeYear ? 1 : 0;
      gain.connect(this.master);
      const handle = this.layers[year].createAmbient(this.ctx, gain);
      this.beds.set(year, { handle, gain });
    }

    this.toggleButton = this.buildToggle();
  }

  /** Current active year. */
  get year(): EraKey {
    return this.activeYear;
  }

  /** Whether sound is currently enabled (un-muted). */
  get isSoundOn(): boolean {
    return this.soundOn;
  }

  /** WebAudio context state — 'running' once resumed by a user gesture. */
  get contextState(): AudioContextState {
    return this.ctx.state;
  }

  /** Crossfade to a new era. No-op when the era is unchanged. */
  update(year: EraKey): void {
    if (year === this.activeYear || this.disposed) {
      return;
    }
    const from = this.beds.get(this.activeYear);
    const to = this.beds.get(year);
    if (!from || !to) {
      return;
    }
    fadeTo(from.gain, 0, this.crossfadeSeconds, this.ctx);
    fadeTo(to.gain, 1, this.crossfadeSeconds, this.ctx);
    this.activeYear = year;
    this.restartSfxScheduler();
  }

  /** Alias of `update` used as the `setEra` crossfade API. */
  setEra(year: EraKey): void {
    this.update(year);
  }

  /**
   * Toggle sound on/off. The first call is a user gesture that resumes the
   * WebAudio context (satisfying browser autoplay policy).
   */
  toggleSound(): void {
    if (this.disposed) {
      return;
    }
    this.soundOn = !this.soundOn;
    if (this.soundOn) {
      // First user gesture — resume the suspended context.
      try {
        this.ctx.resume();
      } catch {
        /* context may already be running */
      }
    }
    fadeTo(this.master, this.soundOn ? this.masterGain : 0, 0.25, this.ctx);
    this.restartSfxScheduler();
  }

  /** Programmatic mute (keeps the toggle button state in sync). */
  mute(): void {
    if (this.soundOn) {
      this.soundOn = false;
      fadeTo(this.master, 0, 0.25, this.ctx);
      this.restartSfxScheduler();
    }
  }

  /** Dispose: stop all sources, clear timers, remove the toggle button. */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.sfxTimer !== null) {
      window.clearTimeout(this.sfxTimer);
      this.sfxTimer = null;
    }
    for (const bed of this.beds.values()) {
      bed.handle.dispose();
      try {
        bed.gain.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.beds.clear();
    try {
      this.master.disconnect();
    } catch {
      /* already disconnected */
    }
    this.toggleButton.remove();
    try {
      void this.ctx.close();
    } catch {
      /* context already closed */
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private buildToggle(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'audio-toggle';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', 'Toggle sound');
    button.title = 'Toggle sound';
    button.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:20;width:44px;height:44px;' +
      'border-radius:50%;border:1px solid rgba(255,255,255,0.35);' +
      'background:rgba(10,14,20,0.72);color:#e8e8e8;font-size:18px;cursor:pointer;' +
      'backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,0.45);' +
      'display:flex;align-items:center;justify-content:center;';
    button.textContent = '\u{1F509}'; // muted speaker emoji
    button.addEventListener('click', () => {
      this.toggleSound();
      button.setAttribute('aria-pressed', String(this.soundOn));
      button.textContent = this.soundOn ? '\u{1F50A}' : '\u{1F509}'; // speaker on/off
    });
    this.host.appendChild(button);
    return button;
  }

  private restartSfxScheduler(): void {
    if (this.sfxTimer !== null) {
      window.clearTimeout(this.sfxTimer);
      this.sfxTimer = null;
    }
    if (!this.soundOn || this.disposed) {
      return;
    }
    this.scheduleNextSfx();
  }

  private scheduleNextSfx(): void {
    if (!this.soundOn || this.disposed) {
      return;
    }
    const layer = this.layers[this.activeYear];
    if (!layer || layer.sfx.length === 0) {
      return;
    }
    const delayMs = randRange(this.sfxInterval[0], this.sfxInterval[1]) * 1000;
    this.sfxTimer = window.setTimeout(() => {
      this.sfxTimer = null;
      this.playRandomSfx();
      this.scheduleNextSfx();
    }, delayMs);
  }

  private playRandomSfx(): void {
    if (!this.soundOn || this.disposed) {
      return;
    }
    const layer = this.layers[this.activeYear];
    if (!layer || layer.sfx.length === 0) {
      return;
    }
    const cue = weightedPick(layer.sfx);
    cue.play(this.ctx, this.master);
  }
}