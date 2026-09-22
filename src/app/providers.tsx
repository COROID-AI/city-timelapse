/**
 * Provider tree of the composed application.
 *
 * The composition lives outside React's render path — it is an imperative
 * controller over the render pipeline's scene graph — so React only needs a way
 * to hand it to the parts of the tree that want it: the timeline overlay, the
 * extension slot and anything a later phase adds. This context is that channel.
 *
 * The provider holds no state of its own: the application owns the status, the
 * composition owns the scene, and both stores are the shared singletons. That
 * keeps a single source for every value and avoids a second, drifting copy of
 * anything.
 *
 * ```tsx
 * <SceneProvider value={value}>
 *   <SceneCanvas>…</SceneCanvas>
 *   <Overlay />
 * </SceneProvider>
 * ```
 */

import { createContext, useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
// Type-only reference to react-three-fiber: the era layer components render its
// JSX primitives (`<primitive>`, `<group>`), and its ambient JSX augmentation is
// only loaded when the package's declarations are part of the program. Nothing
// from the package reaches the bundle at runtime.
import type {} from '@react-three/fiber'
import type { EraId } from '../era'
import type { QualityTierName } from '../lib/quality'
import type { RenderPipeline } from '../scene'
import type { EraStore } from '../state/eraStore'
import type { SceneStatus, UIControlsStore } from '../ui'
import type { AudioBridge } from './audioBridge'
import type { SceneComposition } from './index'
import type { LoadingState } from './loading'

/** Everything a composed subtree may read. */
export interface SceneContextValue {
  /** Live render pipeline; null until the canvas host has created it. */
  readonly pipeline: RenderPipeline | null
  /** Composed experience; null while it is still being built (or after failure). */
  readonly composition: SceneComposition | null
  readonly eraStore: EraStore
  readonly uiStore: UIControlsStore
  /** Era currently selected, kept fresh by the application. */
  readonly eraId: EraId
  readonly qualityTier: QualityTierName
  /** Lifecycle the overlay renders: `loading`, `ready` or `error`. */
  readonly status: SceneStatus
  readonly errorMessage: string | null
  readonly failedLayer: string | null
  readonly loading: LoadingState
  /** The audio bridge the composition drives, when the host has sound. */
  readonly audio: AudioBridge | null
}

/** Context of the composed application. */
export const SceneContext = createContext<SceneContextValue | null>(null)

/** Props of the {@link SceneProvider}. */
export interface SceneProviderProps {
  readonly value: SceneContextValue
  readonly children?: ReactNode
}

/** Provides the composed scene to a subtree. */
export function SceneProvider({ value, children }: SceneProviderProps): ReactElement {
  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
}

/** Reads the composed scene; throws when used outside the provider. */
export function useSceneContext(): SceneContextValue {
  const value = useContext(SceneContext)
  if (value === null) {
    throw new Error('useSceneContext must be used inside a <SceneProvider>.')
  }
  return value
}

/** Reads the composed scene, or null outside the provider (for optional hosts). */
export function useOptionalSceneContext(): SceneContextValue | null {
  return useContext(SceneContext)
}

/** Reads the composed experience; throws while it is still being built. */
export function useSceneComposition(): SceneComposition {
  const { composition } = useSceneContext()
  if (composition === null) {
    throw new Error('The composed scene is not ready yet; read it after the pipeline reports ready.')
  }
  return composition
}

/** The audio bridge of the composed scene, or null when the host is silent. */
export function useSceneAudio(): AudioBridge | null {
  return useSceneContext().composition?.audio ?? null
}

/** The two stores the composition consumes. */
export function useSceneStores(): { readonly eraStore: EraStore; readonly uiStore: UIControlsStore } {
  const { eraStore, uiStore } = useSceneContext()
  return { eraStore, uiStore }
}
