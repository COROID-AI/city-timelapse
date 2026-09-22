import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import type { CompositionFailure, SceneComposition } from './app'
import { CompositionFallback, WEBGL_FALLBACK_MESSAGE } from './app/Fallback'
import { CompositionProgress, createLoadingState } from './app/loading'
import { SceneProvider, type SceneContextValue } from './app/providers'
import { SceneExperience } from './app/SceneExperience'
import { ExtensionSlot } from './app/extensionSlots'
import { createCityLayout } from './city/layout'
import { getEra } from './era'
import { isQualityTierName, resolveQualityTier, type QualityTierName } from './lib/quality'
import { SceneCanvas, type RenderPipeline } from './scene'
import { useEraStore, useSelectedEra } from './state/eraStore'
import {
  Overlay,
  selectRequestedQualityTier,
  useUIControls,
  useUIControlsStore,
} from './ui'
import type { SceneStatus } from './ui'
import { devUrlFlag } from './app/debugSurface'

/**
 * Application shell of the city timelapse.
 *
 * The page owns three things: the block layout (generated once, deterministic),
 * the lifecycle the overlay renders (loading → ready, or a clear error) and the
 * provider tree that hands the composed scene to everything else. The scene
 * itself is built imperatively by {@link SceneExperience} inside the render
 * pipeline, because layers mount three.js objects into the pipeline's world
 * rather than into React's tree.
 *
 * Quality, sound and motion all come from the ui-controls store — the single
 * source of the viewer's intent — so the overlay, the pipeline and the
 * transition director never disagree. The `qualityTier` prop is a diagnostic
 * override used by tests: it writes the tier into that same store rather than
 * keeping a second copy.
 */

/**
 * Manifest of external scene assets. It is deliberately empty: every texture,
 * mesh and sound in this project is generated in code, so there is nothing to
 * download at build time or at runtime.
 */
export const SCENE_ASSETS: readonly string[] = []

/** Dev-only deep link that seeds the quality tier before the scene is built. */
export const QUALITY_TIER_FLAG = 'tier'

let cachedWebglSupport: boolean | null = null

/**
 * Detects a usable WebGL context without throwing in environments that have no
 * canvas implementation (jsdom, some headless browsers). The result is cached
 * because probing creates a canvas element.
 */
export function supportsWebGL(): boolean {
  if (cachedWebglSupport !== null) {
    return cachedWebglSupport
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cachedWebglSupport = false
    return cachedWebglSupport
  }
  if (
    typeof WebGLRenderingContext === 'undefined' &&
    typeof WebGL2RenderingContext === 'undefined'
  ) {
    cachedWebglSupport = false
    return cachedWebglSupport
  }
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cachedWebglSupport = context !== null
  } catch {
    cachedWebglSupport = false
  }
  return cachedWebglSupport
}

export interface AppProps {
  /** Diagnostic override for the quality tier; writes the ui-controls store. */
  readonly qualityTier?: QualityTierName
}

/** Application shell: header, composed scene, overlay and status line. */
export default function App({ qualityTier }: AppProps): ReactElement {
  const eraStore = useEraStore
  const uiStore = useUIControlsStore
  const eraId = useSelectedEra()
  const requestedTier = useUIControls(selectRequestedQualityTier)

  // `?tier=low` (development only) lets a capture or a browser check start on a
  // cheap tier without paying for a first build at the default one. The value
  // never reaches a production build: `devUrlFlag` returns null there.
  const [flaggedTier] = useState(() => {
    const flagged = devUrlFlag(QUALITY_TIER_FLAG)
    return isQualityTierName(flagged) ? flagged : null
  })
  const tierOverride = qualityTier ?? flaggedTier ?? undefined

  const [layout] = useState(() => createCityLayout())
  const [pipeline, setPipeline] = useState<RenderPipeline | null>(null)
  const [composition, setComposition] = useState<SceneComposition | null>(null)
  const [status, setStatus] = useState<SceneStatus>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [failedLayer, setFailedLayer] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => createLoadingState())

  const webgl = useMemo(supportsWebGL, [])
  const tier = resolveQualityTier(tierOverride ?? requestedTier)
  const era = getEra(eraId)

  // The tier override becomes the viewer's stored request, so the store keeps
  // being the single source of truth for quality.
  useEffect(() => {
    if (tierOverride !== undefined) {
      uiStore.getState().requestQualityTier(tierOverride)
    }
  }, [tierOverride, uiStore])

  // Without WebGL the page still works: the overlay, the timeline and the
  // controls stay operable and the message explains what is missing.
  useEffect(() => {
    if (webgl) {
      return
    }
    setStatus('error')
    setErrorMessage(WEBGL_FALLBACK_MESSAGE)
  }, [webgl])

  const handleStatus = useCallback(
    (next: SceneStatus, message: string | null, layer: string | null): void => {
      setStatus(next)
      setErrorMessage(message)
      setFailedLayer(layer)
    },
    [],
  )

  const handleFailure = useCallback((failure: CompositionFailure): void => {
    setFailedLayer(failure.layerId)
    setErrorMessage(failure.message)
  }, [])

  const retry = useCallback((): void => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [])

  // Mount progress is reported by the composition itself, so the panel shows
  // the real steps rather than a timer.
  useEffect(() => {
    if (composition === null) {
      return undefined
    }
    setLoading(composition.loading)
    return composition.subscribe((current) => {
      setLoading(current.loading)
    })
  }, [composition])

  const contextValue: SceneContextValue = useMemo(
    () => ({
      pipeline,
      composition,
      eraStore,
      uiStore,
      eraId,
      qualityTier: tier.name,
      status,
      errorMessage,
      failedLayer,
      loading,
      audio: composition?.audio ?? null,
    }),
    [
      pipeline,
      composition,
      eraStore,
      uiStore,
      eraId,
      tier.name,
      status,
      errorMessage,
      failedLayer,
      loading,
    ],
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">City Time Period Timelapse</h1>
        <p className="app-subtitle">
          One city block, re-dressed in front of you — buildings, storefronts, traffic,
          crowds, props and weather all change with the year you pick.
        </p>
      </header>

      <main className="app-main">
        <SceneProvider value={contextValue}>
          <div
            className="scene-host"
            data-testid="scene-host"
            data-webgl={webgl ? 'true' : 'false'}
            data-quality-tier={tier.name}
          >
            {webgl ? (
              <SceneCanvas
                qualityTier={tier.name}
                adaptiveQuality={false}
                className="scene-canvas"
                onReady={setPipeline}
                onError={(reason) => {
                  handleStatus('error', reason, null)
                }}
                fallback={
                  <CompositionFallback
                    reason="webgl-unavailable"
                    message={WEBGL_FALLBACK_MESSAGE}
                    onRetry={retry}
                  />
                }
              >
                <SceneExperience
                  layout={layout}
                  eraStore={eraStore}
                  uiStore={uiStore}
                  {...(tierOverride === undefined ? {} : { qualityTier: tierOverride })}
                  onReady={setComposition}
                  onStatus={handleStatus}
                  onFailure={handleFailure}
                />
              </SceneCanvas>
            ) : (
              <CompositionFallback reason="webgl-unavailable" onRetry={retry} />
            )}
            {failedLayer === null ? null : (
              <CompositionFallback
                reason="layer-failure"
                layerId={failedLayer}
                message={errorMessage}
                onRetry={retry}
              />
            )}
            {status === 'loading' ? <CompositionProgress state={loading} /> : null}
          </div>

          {pipeline === null || composition === null ? null : (
            <ExtensionSlot
              pipeline={pipeline}
              composition={composition}
              eraId={eraId}
              qualityTier={tier.name}
              eraStore={eraStore}
              uiStore={uiStore}
            />
          )}

          <Overlay
            eraStore={eraStore}
            uiStore={uiStore}
            status={status}
            errorMessage={errorMessage}
            onRetry={retry}
          />
        </SceneProvider>
      </main>

      <footer className="app-footer" data-testid="scene-status">
        <span data-testid="scene-era">
          {`${era.shortLabel} · ${era.label}`}
        </span>
        <span>
          Quality tier: <strong>{tier.label}</strong>
        </span>
        <span>
          Target {tier.targetFps} fps · {tier.frameBudgetMs.toFixed(2)} ms frame budget ·{' '}
          {SCENE_ASSETS.length} external assets
        </span>
      </footer>
    </div>
  )
}
