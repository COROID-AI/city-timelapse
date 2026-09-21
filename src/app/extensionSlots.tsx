/**
 * Extension slot: where later phases add features without editing composition.
 *
 * Phase boundaries in this project are file boundaries: navigation, inspection
 * and overlay work belongs to a later task, and that task must be able to add
 * its behaviour without touching the composition files. It does that by dropping
 * a module into `src/interaction/extensions/`; this slot discovers it with a
 * **non-eager** `import.meta.glob`, so
 *
 * - an empty directory is valid (the glob resolves to `{}` and nothing mounts),
 * - an extension never lands in the initial bundle (the glob returns lazy
 *   importers, and each module is loaded on mount),
 * - and no composition file lists the extensions by name.
 *
 * Contract for an extension module: export a React component as the default
 * export, or as `SceneExtension` / `extension`. It receives the live pipeline,
 * the composition, the selected era and the two stores.
 *
 * ```tsx
 * // src/interaction/extensions/example.tsx
 * export default function Example({ composition, eraId }: ExtensionProps) {
 *   return <div className="hint">{eraId}</div>
 * }
 * ```
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { EraId } from '../era'
import type { QualityTierName } from '../lib/quality'
import type { RenderPipeline } from '../scene'
import type { EraStore } from '../state/eraStore'
import type { UIControlsStore } from '../ui'
import type { SceneComposition } from './index'

/** Everything an extension may use. */
export interface ExtensionProps {
  readonly pipeline: RenderPipeline
  readonly composition: SceneComposition
  readonly eraId: EraId
  readonly qualityTier: QualityTierName
  readonly eraStore: EraStore
  readonly uiStore: UIControlsStore
}

/** Component shape an extension module must provide. */
export type SceneExtension = (props: ExtensionProps) => ReactElement | null

/** Shape of a lazily loaded extension module. */
export interface ExtensionModule {
  readonly default?: unknown
  readonly SceneExtension?: unknown
  readonly extension?: unknown
}

/** Directory later phases drop their modules into. */
export const EXTENSION_DIRECTORY = 'src/interaction/extensions'

/**
 * Glob pattern of the slot; matches nothing until an extension lands.
 *
 * Kept as documentation: `import.meta.glob` only accepts a literal pattern, so
 * the call below repeats it verbatim.
 */
export const EXTENSION_GLOB = '../interaction/extensions/*.tsx'

/**
 * Lazy importers of every present extension module.
 *
 * Non-eager on purpose: `{}` when the directory holds no module, and a map of
 * `() => import(...)` otherwise.
 */
export const extensionModules: Readonly<Record<string, () => Promise<unknown>>> =
  import.meta.glob('../interaction/extensions/*.tsx')

/** Module paths the slot discovered, sorted for deterministic mounting. */
export function extensionModulePaths(
  modules: Readonly<Record<string, unknown>> = extensionModules,
): readonly string[] {
  return Object.keys(modules).sort()
}

/**
 * Narrows a loaded module (or a bare function export) to an extension component.
 *
 * Never throws: an extension that does not follow the contract is skipped, so a
 * half-finished module in the directory cannot break the composed page.
 */
export function resolveExtension(module: unknown): SceneExtension | null {
  if (typeof module === 'function') {
    return module as SceneExtension
  }
  if (module === null || typeof module !== 'object') {
    return null
  }
  const record = module as ExtensionModule
  const candidate = record.SceneExtension ?? record.extension ?? record.default
  return typeof candidate === 'function' ? (candidate as SceneExtension) : null
}

/**
 * Loads every extension module that is present.
 *
 * A module that fails to import (a syntax error while it is being written, for
 * instance) is skipped with a warning: extensions are additive, so one broken
 * extension must not take the city down with it.
 */
export async function loadExtensions(
  modules: Readonly<Record<string, () => Promise<unknown>>> = extensionModules,
): Promise<readonly SceneExtension[]> {
  const paths = extensionModulePaths(modules)
  if (paths.length === 0) {
    return []
  }
  const loaded = await Promise.all(
    paths.map(async (path) => {
      const importer = modules[path]
      if (importer === undefined) {
        return null
      }
      try {
        return resolveExtension(await importer())
      } catch {
        if (typeof console !== 'undefined') {
          console.warn(`[scene] extension ${path} failed to load and was skipped`)
        }
        return null
      }
    }),
  )
  return loaded.filter((extension): extension is SceneExtension => extension !== null)
}

/**
 * Loads the extensions once per mount.
 *
 * An empty directory resolves to an empty list on the first effect, so the slot
 * is a no-op until a later phase adds a module.
 */
export function useSceneExtensions(
  modules: Readonly<Record<string, () => Promise<unknown>>> = extensionModules,
): readonly SceneExtension[] {
  const [extensions, setExtensions] = useState<readonly SceneExtension[]>([])
  const modulesRef = useRef(modules)
  modulesRef.current = modules

  useEffect(() => {
    let active = true
    void loadExtensions(modulesRef.current).then((loaded) => {
      if (active) {
        setExtensions(loaded)
      }
    })
    return () => {
      active = false
    }
  }, [])

  return extensions
}

/**
 * Mounts every extension module that is present.
 *
 * Renders nothing when the directory is empty, which is the shipped state of
 * this revision.
 */
export function ExtensionSlot(props: ExtensionProps): ReactElement | null {
  const extensions = useSceneExtensions()
  if (extensions.length === 0) {
    return null
  }
  return (
    <>
      {extensions.map((Extension, index) => (
        <Extension key={`${EXTENSION_DIRECTORY}#${index}`} {...props} />
      ))}
    </>
  )
}
