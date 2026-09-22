/**
 * Documented audio hook events — the only supported way for content modules
 * (vehicles, signage, storefronts, pedestrians…) to ask the sound director
 * for a synthesized one-shot.
 *
 * Contract for content modules:
 * - emit events through {@link AudioHookBus.emit} on the bus exposed as
 *   `AudioDirector.hooks`;
 * - always include a world position (`x`, `z`; `y` is optional) when the
 *   sound comes from a specific object so the director can distance-duck it;
 * - `gain` (0..1+) is an optional per-emitter intensity multiplier.
 *
 * Every documented event maps to a synthesized voice via
 * {@link HOOK_ONE_SHOTS} — no audio files, no ad-hoc sounds outside this
 * table. Events emitted before the first user gesture (or while the master
 * mute is on) are counted for telemetry but never create audio nodes.
 */

import type { OneShotVoice } from './soundscapes';

/** Payload of a content-module hook event. All fields are optional. */
export interface AudioHookEvent {
  /** World Y coordinate of the emitter (optional; ducking uses X/Z). */
  readonly y?: number;
  /** World X coordinate of the emitter. */
  readonly x?: number;
  /** World Z coordinate of the emitter. */
  readonly z?: number;
  /** Per-emitter intensity multiplier (default 1). */
  readonly gain?: number;
}

/**
 * The documented hook event names content modules may emit:
 * - `street-horn`: a vehicle horn honk;
 * - `neon-hum`: a neon sign flicker/buzz emphasis;
 * - `door`: a shop or apartment door;
 * - `brake`: bus/truck air brakes;
 * - `footstep`: a close pedestrian footstep;
 * - `ringtone`: a cell phone ring;
 * - `arcade-bleep`: an arcade cabinet interaction;
 * - `streetcar-bell`: a streetcar bell from a passing tram;
 * - `scooter-zip`: an electric scooter pass-by.
 */
export const AUDIO_HOOK_EVENTS = [
  'street-horn',
  'neon-hum',
  'door',
  'brake',
  'footstep',
  'ringtone',
  'arcade-bleep',
  'streetcar-bell',
  'scooter-zip',
] as const;

/** One documented hook event name. */
export type AudioHookEventName = (typeof AUDIO_HOOK_EVENTS)[number];

/** Listener signature for {@link AudioHookBus.on}. */
export type AudioHookListener = (event: AudioHookEvent) => void;

/** How the director answers a hook event: which voice and at what level. */
export interface HookOneShotBinding {
  /** Synthesized voice to trigger. */
  readonly voice: OneShotVoice;
  /** Base level of the shot (multiplied by the event's `gain`). */
  readonly gain: number;
}

/**
 * Hook event -> synthesized one-shot mapping. Keeping this table exhaustive
 * (`Record`) makes new documented events fail type-checking until the director
 * knows how to answer them.
 */
export const HOOK_ONE_SHOTS: Readonly<Record<AudioHookEventName, HookOneShotBinding>> = {
  'street-horn': { voice: 'car-horn', gain: 0.45 },
  'neon-hum': { voice: 'neon-buzz', gain: 0.4 },
  door: { voice: 'door', gain: 0.5 },
  brake: { voice: 'bus-brake', gain: 0.5 },
  footstep: { voice: 'footstep', gain: 0.5 },
  ringtone: { voice: 'cell-ringtone', gain: 0.45 },
  'arcade-bleep': { voice: 'arcade-bleep', gain: 0.4 },
  'streetcar-bell': { voice: 'streetcar-bell', gain: 0.5 },
  'scooter-zip': { voice: 'scooter-zip', gain: 0.45 },
};

/**
 * Tiny synchronous event bus for the documented hook events.
 *
 * Deliberately minimal: a Map of Sets, allocation-free dispatch beyond the
 * Set iteration, and unsubscribe functions returned from `on`. Content
 * modules hold the bus (via `AudioDirector.hooks`) and emit; the director is
 * the sole listener in the current composition.
 */
export class AudioHookBus {
  readonly #listeners = new Map<AudioHookEventName, Set<AudioHookListener>>();

  /** Subscribe to a documented event; returns an unsubscribe function. */
  on(name: AudioHookEventName, listener: AudioHookListener): () => void {
    let set = this.#listeners.get(name);
    if (!set) {
      set = new Set();
      this.#listeners.set(name, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  }

  /** Remove a previously registered listener. */
  off(name: AudioHookEventName, listener: AudioHookListener): void {
    this.#listeners.get(name)?.delete(listener);
  }

  /** Emit a documented event; returns the number of listeners notified. */
  emit(name: AudioHookEventName, event: AudioHookEvent = {}): number {
    const set = this.#listeners.get(name);
    if (!set || set.size === 0) return 0;
    for (const listener of set) listener(event);
    return set.size;
  }

  /** Number of listeners for one event (or for all events when omitted). */
  listenerCount(name?: AudioHookEventName): number {
    if (name !== undefined) return this.#listeners.get(name)?.size ?? 0;
    let total = 0;
    for (const set of this.#listeners.values()) total += set.size;
    return total;
  }

  /** Drop every listener (used on director teardown). */
  clear(): void {
    this.#listeners.clear();
  }
}

/** Create an empty hook bus. */
export function createAudioHookBus(): AudioHookBus {
  return new AudioHookBus();
}
