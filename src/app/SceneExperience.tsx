/**
 * `SceneExperience` — the React host of the composed experience.
 *
 * It renders nothing itself. What it does is bridge the two worlds: it takes the
 * live render pipeline from the enclosing `<SceneCanvas>` and, exactly once per
 * mount, builds the imperative composition inside that pipeline's own world —
 * the block layout, the era content layers, the atmosphere, the audio bridge and
 * the transition director.
 *
 * Why a component at all
 * ----------------------
 * Mount order, cleanup and React's strict-mode double invocation all need to be
 * handled by React, and the pipeline is only available through context. Builder,
 * cleanup and error containment therefore live here while the composition itself
 * stays framework-free and unit-testable.
 *
 * Properties this host owns
 * -------------------------
 * - **One mount per layer, disposed on unmount.** Creating the composition twice
 *   would double every layer; disposing it releases every geometry, material,
 *   texture, listener and WebAudio node.
 * - **Failure containment.** A throw during the build is reported through
 *   `onStatus`, never rethrown out of the React tree, so the overlay and the
 *   timeline stay operable.
 * - **Gesture-based audio unlock.** The viewer's first gesture on the canvas is
 *   recorded as unlock intent in the ui-controls store; the audio bridge then
 *   resumes the engine. Nothing plays before that.
 * - **Dev-only loading hold.** `?hold=loading` keeps the composition deferred so
 *   the loading state can be observed (see `debugSurface.devUrlFlag`); production
 *   builds ignore the flag.
 */

import { useLayoutEffect, useRef, type ReactElement } from 'react'
import type { BlockLayout } from '../city/layout'
import type { AnySignCanvasFactory } from '../city/storefronts'
import type { EraId } from '../era'
import type { QualityTierName } from '../lib/quality'
import type { Seed } from '../lib/rng'
import { useScenePipeline } from '../scene'
import type { EraStore } from '../state/eraStore'
import type { SceneStatus, UIControlsStore } from '../ui'
import type { AudioBridge, AudioEngineHandle } from './audioBridge'
import { HOLD_LOADING_FLAG, HOLD_LOADING_VALUE, devUrlFlag } from './debugSurface'
import { createSceneComposition } from './index'
import type { CompositionFailure, SceneComposition } from './index'

/** Props of the {@link SceneExperience} host. */
export interface SceneExperienceProps {
  /** Frozen block every layer is authored against. */
  readonly layout: BlockLayout
  /** Era store; defaults to the application-wide store. */
  readonly eraStore?: EraStore
  /** ui-controls store; defaults to the application-wide store. */
  readonly uiStore?: UIControlsStore
  /** Audio bridge to build with; `null` makes the host silent. */
  readonly audio?: AudioBridge | null
  /** Audio engine a bridge is built around; ignored when `audio` is given. */
  readonly audioEngine?: AudioEngineHandle | null
  /** Initial quality tier; later changes flow through the ui-controls store. */
  readonly qualityTier?: QualityTierName
  readonly seed?: Seed
  /** Artwork factory for storefront signs (tests and fixed-resolution captures). */
  readonly signCanvasFactory?: AnySignCanvasFactory
  /** Called once the composition is live. */
  readonly onReady?: (composition: SceneComposition) => void
  /** Called on every lifecycle change; `failedLayer` names a failed layer slot. */
  readonly onStatus?: (
    status: SceneStatus,
    message: string | null,
    failedLayer: string | null,
  ) => void
  /** Called for every layer failure the composition absorbs. */
  readonly onFailure?: (failure: CompositionFailure) => void
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Builds the composed experience inside the enclosing `<SceneCanvas>`.
 *
 * Returns null: the pipeline's scene graph is the output, and the visible
 * surfaces (timeline, HUD, controls, banners) are rendered by the application
 * around this component.
 */
export function SceneExperience(props: SceneExperienceProps): ReactElement | null {
  const pipeline = useScenePipeline()
  const { layout, eraStore, uiStore, audio, audioEngine, signCanvasFactory, seed } = props

  const callbacks = useRef({
    onReady: props.onReady,
    onStatus: props.onStatus,
    onFailure: props.onFailure,
  })
  callbacks.current = {
    onReady: props.onReady,
    onStatus: props.onStatus,
    onFailure: props.onFailure,
  }

  // Creation-time values only: a tier or seed change is applied through the
  // composition's own setters, never by rebuilding the scene.
  const initial = useRef({ qualityTier: props.qualityTier, seed })

  useLayoutEffect(() => {
    if (devUrlFlag(HOLD_LOADING_FLAG) === HOLD_LOADING_VALUE) {
      return undefined
    }

    let composition: SceneComposition
    try {
      composition = createSceneComposition({
        pipeline,
        layout,
        ...(eraStore === undefined ? {} : { eraStore }),
        ...(uiStore === undefined ? {} : { uiStore }),
        ...(audio === undefined ? {} : { audio }),
        ...(audioEngine === undefined ? {} : { audioEngine }),
        ...(initial.current.qualityTier === undefined
          ? {}
          : { qualityTier: initial.current.qualityTier }),
        ...(initial.current.seed === undefined ? {} : { seed: initial.current.seed }),
        ...(signCanvasFactory === undefined ? {} : { signCanvasFactory }),
        onFailure: (failure) => {
          callbacks.current.onFailure?.(failure)
        },
      })
    } catch (error) {
      callbacks.current.onStatus?.('error', messageOf(error), null)
      return undefined
    }

    callbacks.current.onReady?.(composition)
    const failure = composition.failures[0] ?? null
    callbacks.current.onStatus?.(
      failure === null ? 'ready' : 'error',
      failure === null ? null : failure.message,
      failure === null ? null : failure.layerId,
    )

    // The first gesture on the canvas is the viewer's permission to make sound;
    // it is recorded as intent in the ui-controls store, never held here.
    const detachGesture = composition.audio?.attachGestureUnlock(pipeline.canvas) ?? (() => {})

    const unsubscribe = composition.subscribe((next) => {
      const latest = next.failures[next.failures.length - 1]
      if (latest === undefined) {
        return
      }
      callbacks.current.onFailure?.(latest)
      callbacks.current.onStatus?.('error', latest.message, latest.layerId)
    })

    return () => {
      unsubscribe()
      detachGesture()
      composition.dispose()
    }
  }, [pipeline, layout, eraStore, uiStore, audio, audioEngine, signCanvasFactory])

  return null
}

/** Era a composition currently shows; exposed for hosts that need it in render. */
export function compositionEraId(composition: SceneComposition | null): EraId | null {
  return composition === null ? null : composition.currentEraId()
}
