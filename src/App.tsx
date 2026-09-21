import { Canvas } from '@react-three/fiber'
import { Component, useMemo, type ErrorInfo, type ReactElement, type ReactNode } from 'react'
import { Color } from 'three'
import { DEFAULT_QUALITY_TIER, resolveQualityTier, type QualityTierName } from './lib/quality'
import { createRng } from './lib/rng'

/**
 * Placeholder scene host for the city timelapse.
 *
 * This module intentionally contains no city content: later tasks own the
 * scene graph, the era data and the overlay UI. What it does provide is the
 * wiring every later task can rely on — a WebGL-capable `<Canvas>` mounted into
 * a stable `data-testid="scene-host"` element, a guarded fallback for machines
 * without WebGL, and a deterministic handful of placeholder volumes that proves
 * the procedural pipeline (seeded PRNG to three.js meshes) is live.
 */

/** Seed of the placeholder massing; kept stable so screenshots are comparable. */
export const PLACEHOLDER_SCENE_SEED = 'city-timelapse:placeholder-scene'

/**
 * Manifest of external scene assets. It is deliberately empty: every texture,
 * mesh and sound in this project is generated in code, so there is nothing to
 * download at build time or at runtime.
 */
export const SCENE_ASSETS: readonly string[] = []

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
  if (typeof WebGLRenderingContext === 'undefined' && typeof WebGL2RenderingContext === 'undefined') {
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

interface SceneErrorBoundaryProps {
  readonly fallback: ReactNode
  readonly children: ReactNode
}

interface SceneErrorBoundaryState {
  readonly failed: boolean
}

/** Keeps a renderer failure inside the scene host instead of breaking the app. */
class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  override state: SceneErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true }
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Swallow: the fallback below already reports the degraded state in the UI.
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

interface PlaceholderMassing {
  readonly key: string
  readonly position: readonly [number, number, number]
  readonly size: readonly [number, number, number]
  readonly color: string
}

/** Deterministic stand-in massing until the real era buildings land. */
function createPlaceholderMassing(): PlaceholderMassing[] {
  const rng = createRng(PLACEHOLDER_SCENE_SEED, 'placeholder-massing')
  return Array.from({ length: 9 }, (_unused, index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const height = rng.float(1.6, 4.4)
    const width = rng.float(0.8, 1.2)
    const depth = rng.float(0.8, 1.2)
    const color = new Color().setHSL(0.58 + rng.float(-0.04, 0.04), 0.22, rng.float(0.38, 0.62))
    return {
      key: `placeholder-block-${index}`,
      position: [(column - 1) * 2.6, height / 2, (row - 1) * 2.6],
      size: [width, height, depth],
      color: `#${color.getHexString()}`,
    }
  })
}

function PlaceholderMassing(): ReactElement {
  const blocks = useMemo(createPlaceholderMassing, [])
  return (
    <group name="placeholder-massing">
      {blocks.map((block) => (
        <mesh key={block.key} position={block.position} castShadow receiveShadow>
          <boxGeometry args={[block.size[0], block.size[1], block.size[2]]} />
          <meshStandardMaterial color={block.color} roughness={0.72} metalness={0.06} />
        </mesh>
      ))}
    </group>
  )
}

function SceneFallback({ reason }: { readonly reason: string }): ReactElement {
  return (
    <div className="scene-fallback" data-testid="scene-fallback" role="status">
      {reason}
    </div>
  )
}

export interface SceneHostProps {
  /** Quality tier driving the renderer settings. */
  readonly qualityTier?: QualityTierName
}

/**
 * Mount point for the 3D city block. Later tasks replace the placeholder group
 * with the real scene graph but keep this element as the browser-test handle.
 */
export function SceneHost({ qualityTier = DEFAULT_QUALITY_TIER }: SceneHostProps): ReactElement {
  const webgl = useMemo(supportsWebGL, [])
  const tier = resolveQualityTier(qualityTier)

  return (
    <div
      className="scene-host"
      data-testid="scene-host"
      data-webgl={webgl ? 'true' : 'false'}
      data-quality-tier={tier.name}
    >
      {webgl ? (
        <SceneErrorBoundary
          fallback={<SceneFallback reason="The WebGL renderer failed to start on this device." />}
        >
          <Canvas
            shadows
            dpr={[tier.pixelRatio.min, tier.pixelRatio.max]}
            camera={{
              position: [7.5, 5.5, 9.5],
              fov: 46,
              near: 0.1,
              far: tier.density.drawDistance,
            }}
          >
            <color attach="background" args={['#070b14']} />
            <hemisphereLight args={['#9fc4ff', '#1b2130', 0.45]} />
            <directionalLight
              position={[6, 9, 4]}
              intensity={1.15}
              castShadow
              shadow-mapSize-width={tier.effects.shadowMapSize}
              shadow-mapSize-height={tier.effects.shadowMapSize}
            />
            <PlaceholderMassing />
            <mesh rotation-x={-Math.PI / 2} receiveShadow>
              <planeGeometry args={[48, 48]} />
              <meshStandardMaterial color="#141a26" roughness={0.95} metalness={0.02} />
            </mesh>
          </Canvas>
        </SceneErrorBoundary>
      ) : (
        <SceneFallback reason="WebGL is unavailable in this browser, so the placeholder scene host renders without the 3D canvas." />
      )}
    </div>
  )
}

export interface AppProps {
  /** Overrides the quality tier, mainly for tests and diagnostics. */
  readonly qualityTier?: QualityTierName
}

/** Application shell: header, scene host and a status line. */
export default function App({ qualityTier = DEFAULT_QUALITY_TIER }: AppProps): ReactElement {
  const tier = resolveQualityTier(qualityTier)

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">City Time Period Timelapse</h1>
        <p className="app-subtitle">
          Placeholder scene host — eras, timeline slider, SFX and navigation arrive in later tasks.
        </p>
      </header>
      <main className="app-main">
        <SceneHost qualityTier={tier.name} />
      </main>
      <footer className="app-footer" data-testid="scene-status">
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
