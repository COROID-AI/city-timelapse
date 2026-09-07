/**
 * AudioCrossfade: outgoing ambience fades while incoming rises.
 *
 * The five era modules describe their audio stems with heterogeneous shapes
 * (1945 exposes `sfxStems` metadata + an `EraAudio` rig, 1965 exposes a
 * `start/stop/setMasterVolume` rig, 1985 exposes `startAmbience/stopAmbience`,
 * 2005/2025 expose static stem metadata). This module wraps each era's audio
 * surface behind a uniform stem interface and drives a volume crossfade over
 * the transition timeline: the outgoing era fades toward silence while the
 * incoming era fades in.
 */

/** A single crossfade-managed audio stem. */
export interface CrossfadeStem {
  /** Stable stem id. */
  id: string;
  /** Current volume in [0, 1]. */
  volume: number;
  /** Set the stem volume; the owner maps this onto its audio rig. */
  setVolume(volume: number): void;
}

/**
 * A uniform, crossfade-manageable handle over one era's audio.
 *
 * The director calls `fadeTo(volume)` each frame with the tweened volume and
 * `stop()` when the era is disposed.
 */
export interface EraAudioHandle {
  /** The era year. */
  year: number;
  /** The managed stems. */
  stems: readonly CrossfadeStem[];
  /** Fade all stems toward a target volume in [0, 1]. */
  fadeTo(volume: number): void;
  /** Stop all stems (used on dispose / after fade-out completes). */
  stop(): void;
  /** Release any resources held by the handle. */
  dispose(): void;
}

/** A normalized audio stem descriptor. */

/** Extract a list of stem ids from an era audio object of any shape. */
function extractStemIds(audio: unknown): string[] {
  if (!audio || typeof audio !== 'object') return [];
  const a = audio as Record<string, unknown>;

  // 1945: audio.stems is an array of { id, ... }.
  if (Array.isArray(a.stems)) {
    const ids: string[] = [];
    for (const s of a.stems) {
      if (s && typeof s === 'object') {
        const id = (s as Record<string, unknown>).id;
        if (typeof id === 'string') ids.push(id);
      }
    }
    if (ids.length > 0) return ids;
  }

  // 1985: audio.stems is an object of { name: fn } plus stemNames: string[].
  if (Array.isArray(a.stemNames)) {
    return (a.stemNames as unknown[]).filter((n) => typeof n === 'string') as string[];
  }

  // 2005: audio.sfxStems is a string[].
  if (Array.isArray(a.sfxStems)) {
    return (a.sfxStems as unknown[]).filter((n) => typeof n === 'string') as string[];
  }

  // 2025: audio.stems is an array of { id, ... } (handled above); also try
  // audio.stems.loopId.
  return [];
}

/**
 * Create a crossfade handle for an era audio object. Adapts the era-specific
 * rig (start/stop/setMasterVolume for 1965, startAmbience/stopAmbience for
 * 1985, play/dispose for 1945, static metadata for 2005/2025) into the common
 * handle interface.
 */
export function createEraAudioHandle(
  year: number,
  audio: unknown,
): EraAudioHandle {
  const ids = extractStemIds(audio);
  const stems: CrossfadeStem[] = ids.map((id) => ({
    id,
    volume: 0,
    setVolume(v: number) {
      this.volume = Math.max(0, Math.min(1, v));
    },
  }));

  const a = (audio && typeof audio === 'object' ? audio : {}) as Record<string, unknown>;

  // 1965-style rig: start/stop/setMasterVolume.
  const hasMaster =
    typeof a.start === 'function' &&
    typeof a.stop === 'function' &&
    typeof a.setMasterVolume === 'function';

  // 1985-style rig: startAmbience/stopAmbience.
  const hasAmbience =
    typeof a.startAmbience === 'function' &&
    typeof a.stopAmbience === 'function';

  // 1945-style rig: play/dispose with a stems array (already extracted above).

  const started = { value: false };

  const start = (): void => {
    if (started.value) return;
    started.value = true;
    if (hasMaster) {
      (a.start as () => void)();
    } else if (hasAmbience) {
      (a.startAmbience as () => void)();
    }
  };

  return {
    year,
    stems,
    fadeTo(volume: number) {
      const v = Math.max(0, Math.min(1, volume));
      for (const s of stems) s.setVolume(v);
      if (v > 0.01 && !started.value) {
        start();
      }
      if (hasMaster) {
        (a.setMasterVolume as (vol: number) => void)(v);
      }
    },
    stop() {
      started.value = false;
      if (hasMaster) {
        (a.stop as () => void)();
      } else if (hasAmbience) {
        (a.stopAmbience as () => void)();
      }
      for (const s of stems) s.setVolume(0);
    },
    dispose() {
      this.stop();
      if (typeof a.dispose === 'function') {
        (a.dispose as () => void)();
      }
    },
  };
}

/** A crossfade between two era audio handles. */
export interface AudioCrossfade {
  /** The handle fading out. */
  readonly outgoing: EraAudioHandle;
  /** The handle fading in. */
  readonly incoming: EraAudioHandle;
  /**
   * Advance the crossfade to `progress` in [0, 1]. Outgoing volume goes
   * 1 -> 0, incoming volume goes 0 -> 1 (constant-power-ish, softened).
   */
  update(progress: number): void;
  /** Finish the crossfade: stop the outgoing handle. */
  finish(): void;
  /** Dispose both handles. */
  dispose(): void;
}

/**
 * Create an audio crossfade between an outgoing and an incoming era audio
 * rig. At progress 0 the outgoing is at full volume and the incoming silent;
 * at progress 1 the incoming is at full volume and the outgoing stopped.
 */
export function createAudioCrossfade(
  outgoing: EraAudioHandle,
  incoming: EraAudioHandle,
): AudioCrossfade {
  return {
    outgoing,
    incoming,
    update(progress: number) {
      const t = Math.max(0, Math.min(1, progress));
      const outVol = Math.cos((t * Math.PI) / 2); // 1 -> 0, constant-power
      const inVol = Math.sin((t * Math.PI) / 2); // 0 -> 1
      outgoing.fadeTo(outVol);
      incoming.fadeTo(inVol);
    },
    finish() {
      outgoing.stop();
      incoming.fadeTo(1);
    },
    dispose() {
      outgoing.dispose();
      incoming.dispose();
    },
  };
}