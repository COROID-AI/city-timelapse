/**
 * Audio bridge: the one place the composed experience meets the audio engine.
 *
 * `src/audio` owns the WebAudio graph and the era registry owns the soundscape
 * data; neither knows about the other, and neither knows about the viewer's
 * intent. This module is the missing edge:
 *
 * - **Intent in.** The ui-controls store is the single source of the viewer's
 *   sound intent. The bridge listens to it, calls `unlock()` when the viewer's
 *   unlock intent is recorded, and keeps the master output muted until then —
 *   browser autoplay policies otherwise leave the page silent through no fault
 *   of the viewer.
 * - **Real state out.** Whatever the engine reports (context running, muted,
 *   bed playing) is written back into the same store, so the overlay shows the
 *   real state instead of a second, drifting copy.
 * - **Era beds.** One call to `crossfadeBeds` per era change, with the bed the
 *   shipped transition adapter derives from the era's soundscape. Requests made
 *   before the unlock are remembered and re-issued, so the first gesture starts
 *   the period's ambience immediately.
 * - **Vehicle SFX.** `SfxTrigger` events from the vehicle layer (horn, engine,
 *   transit bell, EV whine, tyre squeal) are mapped to synthesised one-shots,
 *   rate-limited per kind and globally, and never played while audio is locked.
 *
 * The engine is injected as {@link AudioEngineHandle}, a structural subset of
 * `AudioEngine`, so the composition suite can prove the routing behind a stub
 * and the application can pass the real engine.
 */

import { createAudioEngine, resolveOneShotId } from '../audio'
import type {
  AudioEngine,
  AudioEngineState,
  CrossfadeResult,
  OneShotHandle,
  OneShotId,
  OneShotOptions,
  SoundscapeDescriptor,
} from '../audio'
import type { SfxKind, SfxTrigger } from '../city/vehicles'
import { getSoundscape } from '../era'
import type { EraId, EraSoundscape, EraSoundscapeCue } from '../era'
import { createAudioEnginePort, soundscapeToBedDescriptor } from '../transition'
import type { TransitionAudioPort } from '../transition'
import { selectAudioMuted, selectAudioUnlocked } from '../ui'
import type { UIControlsStore } from '../ui'

/* -------------------------------------------------------------------------- */
/* Engine handle                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the audio engine the bridge drives.
 *
 * `AudioEngine` satisfies it structurally, so production passes the real engine
 * and a test passes a stub with the same seven methods.
 */
export interface AudioEngineHandle {
  unlock(): Promise<AudioEngineState>
  getState(): AudioEngineState
  subscribe(listener: (state: AudioEngineState) => void): () => void
  mute(muted?: boolean): boolean
  isMuted(): boolean
  crossfadeBeds(descriptor: SoundscapeDescriptor | null, seconds?: number): CrossfadeResult
  playOneShot(id: string, options?: OneShotOptions): OneShotHandle
  dispose?(): void
}

/* -------------------------------------------------------------------------- */
/* SFX mapping and rate limits                                                */
/* -------------------------------------------------------------------------- */

/**
 * One-shot patch each vehicle SFX kind plays through.
 *
 * Horns, engines, transit bells and EV whines all have dedicated synthesised
 * patches; a tyre squeal has none, so it is routed through the electric whine's
 * noise-adjacent patch rather than being dropped silently.
 */
export const SFX_ONE_SHOT_BY_KIND: Readonly<Record<SfxKind, OneShotId | null>> = Object.freeze({
  horn: 'horn',
  engine: 'engine',
  'transit-bell': 'streetcar-bell',
  'ev-whine': 'ev-whine',
  'tire-squeal': 'ev-whine',
})

/** Shortest gap between two routed events of the same kind, in seconds. */
export const SFX_MIN_INTERVAL_SECONDS: Readonly<Record<SfxKind, number>> = Object.freeze({
  horn: 1.25,
  engine: 0.5,
  'transit-bell': 2,
  'ev-whine': 1,
  'tire-squeal': 1.5,
})

/** Hard ceiling on routed events per rolling second, across every kind. */
export const SFX_MAX_PER_SECOND = 8

/** Window the global rate limit is measured over, in seconds. */
export const SFX_RATE_WINDOW_SECONDS = 1

/** Default crossfade length handed to the engine when a caller omits one. */
export const DEFAULT_BED_CROSSFADE_SECONDS = 2.5

/* -------------------------------------------------------------------------- */
/* Bridge                                                                     */
/* -------------------------------------------------------------------------- */

/** Everything the debug surface and the composition suite read back. */
export interface AudioBridgeState {
  /** False when the host has no WebAudio: every call is then a safe no-op. */
  readonly supported: boolean
  /** True once the viewer's unlock intent has been honoured by the engine. */
  readonly unlocked: boolean
  readonly muted: boolean
  /** The viewer's stored unlock intent, straight from the ui-controls store. */
  readonly intentUnlocked: boolean
  /** The viewer's stored mute intent. */
  readonly intentMuted: boolean
  /** True when the block should actually be making sound right now. */
  readonly active: boolean
  /** Bed the engine is playing (or has pending). */
  readonly bedId: string | null
  /** Era the current bed belongs to. */
  readonly bedEraId: EraId | null
  readonly engine: AudioEngineState
  /** Crossfades issued by the director or by an era change. */
  readonly crossfades: number
  /** Era cue SFX issued by the director. */
  readonly cues: number
  /** Vehicle SFX routed to the engine. */
  readonly sfxRouted: number
  /** Vehicle SFX dropped by the rate limiter or by the locked engine. */
  readonly sfxSuppressed: number
  readonly routedByKind: Readonly<Record<string, number>>
  readonly lastSfx: { readonly kind: SfxKind; readonly id: OneShotId | null; readonly atSeconds: number } | null
}

/** Options of {@link createAudioBridge}. */
export interface AudioBridgeOptions {
  /** Engine to drive; defaults to the real WebAudio engine. */
  readonly engine?: AudioEngineHandle
  /** ui-controls store owning the viewer's sound intent. */
  readonly uiStore: UIControlsStore
  /** Crossfade length used when a caller does not pass one. */
  readonly crossfadeSeconds?: number
  /** Per-shot shaping applied to every routed vehicle SFX. */
  readonly sfxOptions?: OneShotOptions
  /** Monotonic clock in seconds; injectable so tests control the rate limiter. */
  readonly now?: () => number
}

/** The composition-facing audio surface. */
export interface AudioBridge {
  readonly engine: AudioEngineHandle
  /** Port the transition director crossfades and fires its era cues through. */
  readonly port: TransitionAudioPort
  /** Honours the viewer's unlock intent; resolves true once audio can play. */
  unlock(): Promise<boolean>
  /** Crossfades to one era's ambience bed; returns the engine's own result. */
  crossfadeToEra(eraId: EraId, seconds?: number): CrossfadeResult | null
  /** Routes one vehicle SFX event; returns the handle, or null when dropped. */
  handleSfxTrigger(trigger: SfxTrigger): OneShotHandle | null
  /** Records the unlock intent on the first gesture on `target`. */
  attachGestureUnlock(target: EventTarget): () => void
  /** Re-reads the store's intent and applies it to the engine. */
  syncFromStore(): void
  getState(): AudioBridgeState
  subscribe(listener: (state: AudioBridgeState) => void): () => void
  dispose(): void
}

/** Deterministic stereo placement from the lane a trigger came from. */
export function panForSpline(splineName: string): number {
  let hash = 0
  for (let index = 0; index < splineName.length; index += 1) {
    hash = (hash * 31 + splineName.charCodeAt(index)) % 9973
  }
  return ((hash % 200) - 100) / 200
}

/** Default monotonic clock, in seconds. */
function systemSeconds(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now() / 1000
  }
  return Date.now() / 1000
}

/** Resolves the one-shot patch a vehicle trigger plays through. */
export function oneShotForTrigger(trigger: SfxTrigger): OneShotId | null {
  const mapped = SFX_ONE_SHOT_BY_KIND[trigger.kind]
  return mapped ?? resolveOneShotId(trigger.kind)
}

/**
 * Creates the bridge over one engine and one ui-controls store.
 *
 * The engine starts muted: sound only begins when the viewer's unlock intent is
 * recorded in the store, which the overlay's "Enable sound" button (or a first
 * gesture on the canvas) writes.
 */
export function createAudioBridge(options: AudioBridgeOptions): AudioBridge {
  const engine = options.engine ?? (createAudioEngine() satisfies AudioEngine)
  const uiStore = options.uiStore
  const crossfadeSeconds = options.crossfadeSeconds ?? DEFAULT_BED_CROSSFADE_SECONDS
  const now = options.now ?? systemSeconds
  const listeners = new Set<(state: AudioBridgeState) => void>()

  const routedByKind: Record<string, number> = {}
  const lastKindSeconds = new Map<SfxKind, number>()
  const recentEvents: number[] = []
  let crossfades = 0
  let cues = 0
  let sfxRouted = 0
  let sfxSuppressed = 0
  let bedId: string | null = null
  let bedEraId: EraId | null = null
  let lastSfx: AudioBridgeState['lastSfx'] = null
  let unlocking: Promise<AudioEngineState> | null = null
  let disposed = false
  /**
   * True once the bridge has pushed the viewer's mute intent into the engine.
   *
   * Until then the engine's own muted state is the bridge's *defensive* silence,
   * not the viewer's choice, so it must not be mirrored into the store as intent.
   */
  let muteIntentApplied = false

  const enginePortTarget = {
    crossfadeBeds: (descriptor: SoundscapeDescriptor | null, seconds?: number): CrossfadeResult =>
      engine.crossfadeBeds(descriptor, seconds),
    playOneShot: (id: string, shotOptions?: OneShotOptions): OneShotHandle =>
      engine.playOneShot(id, shotOptions),
  }
  const enginePort = createAudioEnginePort(enginePortTarget)

  /** The state a caller reads; every field is derived, never a second source. */
  const snapshot = (): AudioBridgeState => {
    const engineState = engine.getState()
    const unlocked = engineState.unlocked && engineState.supported
    const muted = engineState.muted
    return {
      supported: engineState.supported,
      unlocked,
      muted,
      intentUnlocked: uiStore.getState().audioUnlocked,
      intentMuted: uiStore.getState().audioMuted,
      active: unlocked && !muted && !engineState.disposed,
      bedId: engineState.currentBed ?? bedId ?? engineState.pendingBed,
      bedEraId,
      engine: engineState,
      crossfades,
      cues,
      sfxRouted,
      sfxSuppressed,
      routedByKind: { ...routedByKind },
      lastSfx,
    }
  }

  const notify = (): void => {
    if (listeners.size === 0) {
      return
    }
    const state = snapshot()
    for (const listener of listeners) {
      listener(state)
    }
  }

  /**
   * Writes the engine's real state back into the ui-controls store.
   *
   * This is the "no second copy" rule: the store describes what the viewer
   * asked for *and* what the engine actually does, and this function is the only
   * path that updates the second half. It compares before it writes, so the
   * intent subscription below cannot loop.
   *
   * Before the first unlock the engine is muted defensively, which is not the
   * viewer's intent and must never be recorded as if it were: the mirror only
   * runs once the engine reports a live context.
   */
  const reflectEngineState = (): void => {
    if (disposed) {
      return
    }
    const engineState = engine.getState()
    if (!engineState.unlocked) {
      return
    }
    const store = uiStore.getState()
    if (engineState.unlocked && !store.audioUnlocked) {
      store.setAudioUnlocked(true)
    }
    if (muteIntentApplied && engineState.muted !== store.audioMuted) {
      store.setAudioMuted(engineState.muted)
    }
  }

  const unsubscribeEngine = engine.subscribe(() => {
    reflectEngineState()
    notify()
  })

  const applyIntent = (): void => {
    const store = uiStore.getState()
    const engineState = engine.getState()
    if (!store.audioUnlocked) {
      // Nothing may sound before the viewer's unlock intent is recorded.
      if (!engineState.muted) {
        engine.mute(true)
      }
      return
    }
    if (engineState.muted !== store.audioMuted) {
      engine.mute(store.audioMuted)
    }
    muteIntentApplied = true
  }

  const unsubscribeIntent = uiStore.subscribe(
    (state) => ({ unlocked: selectAudioUnlocked(state), muted: selectAudioMuted(state) }),
    () => {
      const wantedUnlock = uiStore.getState().audioUnlocked
      if (wantedUnlock && !engine.getState().unlocked) {
        void bridge.unlock()
        return
      }
      applyIntent()
      notify()
    },
    {
      equalityFn: (left, right) => left.unlocked === right.unlocked && left.muted === right.muted,
    },
  )

  // Silent from the very first frame, whatever the engine's default is.
  if (!engine.getState().muted) {
    engine.mute(true)
  }

  const port: TransitionAudioPort = {
    crossfadeToSoundscape(request): void {
      enginePort.crossfadeToSoundscape(request)
      crossfades += 1
      bedId = request.soundscape.descriptor
      bedEraId = request.eraId
      reflectEngineState()
      notify()
    },
    playCue(request): void {
      enginePort.playCue(request)
      cues += 1
      notify()
    },
  }

  const bridge: AudioBridge = {
    engine,
    port,
    async unlock(): Promise<boolean> {
      if (disposed) {
        return false
      }
      unlocking = unlocking ?? engine.unlock()
      const state = await unlocking
      unlocking = null
      // The viewer's mute intent is applied to the freshly unlocked engine
      // before its state is mirrored back, so the defensive pre-unlock mute is
      // never mistaken for the viewer's choice.
      applyIntent()
      reflectEngineState()
      notify()
      return state.unlocked && state.supported
    },
    crossfadeToEra(eraId: EraId, seconds = crossfadeSeconds): CrossfadeResult | null {
      if (disposed) {
        return null
      }
      const soundscape: EraSoundscape = getSoundscape(eraId)
      const result = engine.crossfadeBeds(soundscapeToBedDescriptor(soundscape), seconds)
      crossfades += 1
      bedId = soundscape.descriptor
      bedEraId = eraId
      reflectEngineState()
      notify()
      return result
    },
    handleSfxTrigger(trigger: SfxTrigger): OneShotHandle | null {
      if (disposed) {
        return null
      }
      const state = snapshot()
      if (!state.active) {
        sfxSuppressed += 1
        return null
      }
      const at = now()
      const minimum = SFX_MIN_INTERVAL_SECONDS[trigger.kind] ?? 1
      const previous = lastKindSeconds.get(trigger.kind)
      if (previous !== undefined && at - previous < minimum) {
        sfxSuppressed += 1
        return null
      }
      while (recentEvents.length > 0 && at - (recentEvents[0] ?? 0) > SFX_RATE_WINDOW_SECONDS) {
        recentEvents.shift()
      }
      if (recentEvents.length >= SFX_MAX_PER_SECOND) {
        sfxSuppressed += 1
        return null
      }
      const id = oneShotForTrigger(trigger)
      if (id === null) {
        sfxSuppressed += 1
        return null
      }
      lastKindSeconds.set(trigger.kind, at)
      recentEvents.push(at)
      const handle = engine.playOneShot(id, {
        ...options.sfxOptions,
        gain: trigger.gain,
        pan: panForSpline(trigger.splineName),
      })
      if (handle.started) {
        sfxRouted += 1
        routedByKind[trigger.kind] = (routedByKind[trigger.kind] ?? 0) + 1
        lastSfx = { kind: trigger.kind, id, atSeconds: at }
      } else {
        sfxSuppressed += 1
      }
      notify()
      return handle
    },
    attachGestureUnlock(target: EventTarget): () => void {
      if (disposed) {
        return () => {}
      }
      let done = false
      const onGesture = (): void => {
        if (done) {
          return
        }
        done = true
        detach()
        // The gesture is recorded as intent; the store stays the source of truth.
        uiStore.getState().requestAudioUnlock()
      }
      const detach = (): void => {
        target.removeEventListener('pointerdown', onGesture)
        target.removeEventListener('keydown', onGesture)
        target.removeEventListener('touchstart', onGesture)
      }
      target.addEventListener('pointerdown', onGesture)
      target.addEventListener('keydown', onGesture)
      target.addEventListener('touchstart', onGesture)
      return detach
    },
    syncFromStore(): void {
      applyIntent()
      notify()
    },
    getState(): AudioBridgeState {
      return snapshot()
    },
    subscribe(listener: (state: AudioBridgeState) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose(): void {
      if (disposed) {
        return
      }
      disposed = true
      unsubscribeEngine()
      unsubscribeIntent()
      listeners.clear()
      lastKindSeconds.clear()
      recentEvents.length = 0
      engine.dispose?.()
    },
  }

  return bridge
}

/** Convenience: the epoch cue ids of an era, for tests and reports. */
export function cueIdsOf(eraId: EraId): readonly string[] {
  return getSoundscape(eraId).cues.map((cue: EraSoundscapeCue) => cue.id)
}
