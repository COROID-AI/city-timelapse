/**
 * Loading + WebGL-error DOM overlays.
 *
 * `Loader` shows while the scene initialises (R3F suspense / first render),
 * then hides once the store flips `ready`. `ErrorState` shows a friendly
 * message when WebGL is unavailable, with a retry button.
 */
import { useCityStore } from '../era/store'

export function Loader() {
  const ready = useCityStore((s) => s.ready)
  if (ready) return null
  return (
    <div className="overlay loader-overlay" role="status" aria-live="polite">
      <div className="loader-content">
        <div className="loader-spinner" aria-hidden="true" />
        <p className="loader-text">Building the city…</p>
        <p className="loader-sub">Composing 80 years of architecture</p>
      </div>
    </div>
  )
}

export function ErrorState() {
  const webglError = useCityStore((s) => s.webglError)
  const setWebglError = useCityStore((s) => s.setWebglError)
  if (!webglError) return null
  return (
    <div className="overlay error-overlay" role="alert">
      <div className="error-content">
        <h2>WebGL Unavailable</h2>
        <p>
          Your browser doesn't support WebGL2, which is required for this 3D
          experience. Try a modern browser with hardware acceleration enabled.
        </p>
        <button
          className="ctrl-btn"
          onClick={() => {
            setWebglError(false)
            window.location.reload()
          }}
        >
          Retry
        </button>
      </div>
    </div>
  )
}
