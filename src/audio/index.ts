// ─── Era-Aware Audio Controller ───────────────────────────────────────
// Integrates procedural SFX synthesis (sfx.ts) with the crossfade mixer (mixer.ts).
// Exposes a simple API: init(), setEra(id), dispose().
// Era-flavored ambience is driven by SFX_ERA_DATA from src/eras.ts.

import type { EraId } from '../eras.js';
import { generateAllEraBuffers } from './sfx.js';
import { SfxMixer, type SfxMixerOptions } from './mixer.js';

/** Options for the AudioController */
export interface AudioControllerOptions extends SfxMixerOptions {
  /** Whether to auto-init on user gesture (default: true) */
  autoInit?: boolean;
}

/**
 * Era-aware audio controller.
 *
 * Generates all era audio buffers procedurally and manages playback
 * via the SfxMixer with click-free crossfades.
 *
 * Usage:
 *   const audio = new AudioController();
 *   audio.init();            // or let autoInit handle it
 *   audio.setEra('1945');    // starts playing 1945-era SFX
 *   audio.setEra('2025');    // crossfades to 2025-era SFX
 *   audio.dispose();         // cleanup
 */
export class AudioController {
  private mixer: SfxMixer;
  private currentEra: EraId | null = null;

  constructor(options: AudioControllerOptions = {}) {
    this.mixer = new SfxMixer(options);

    if (options.autoInit !== false) {
      this.mixer.autoInitOnGesture();
    }
  }

  /** Initialize the audio engine and generate all era buffers */
  async init(): Promise<void> {
    await this.mixer.init();
    const ctx = this.mixer['ctx'];
    if (!ctx) return;

    // Generate all era buffers procedurally — zero external files
    const allBuffers = generateAllEraBuffers(ctx);
    this.mixer.setAllBuffers(allBuffers);
  }

  /**
   * Switch to a new era. Triggers click-free crossfade.
   * If not yet initialized, initializes first.
   */
  async setEra(id: EraId): Promise<void> {
    if (!this.mixer.isReady) {
      await this.init();
    }
    this.currentEra = id;
    await this.mixer.setEra(id);
  }

  /** Get the currently active era id */
  get era(): EraId | null {
    return this.currentEra;
  }

  /** Check if audio is ready */
  get isReady(): boolean {
    return this.mixer.isReady;
  }

  /** Full cleanup */
  dispose(): void {
    this.mixer.dispose();
    this.currentEra = null;
  }
}

// ── Convenience singleton ──────────────────────────────────────────────

let _controller: AudioController | null = null;

/**
 * Get or create the global audio controller instance.
 * Call `init()` before using, or pass `{ autoInit: true }` at creation.
 */
export function getAudioController(options?: AudioControllerOptions): AudioController {
  if (!_controller) {
    _controller = new AudioController(options);
  }
  return _controller;
}

// ── Re-export types ────────────────────────────────────────────────────

export type { EraAudioBuffers } from './sfx.js';
export type { SfxMixerOptions } from './mixer.js';
