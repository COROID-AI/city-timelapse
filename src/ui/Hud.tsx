/**
 * HUD overlay: era info card + control buttons (audio, reset/focus, quality).
 * Non-blocking pointer-events so orbit/pan still work over the canvas.
 */
import { ERAS, ERA_YEARS } from '../era/config'
import { useCityStore, eraLabel } from '../era/store'

export function Hud() {
  const selectedEra = useCityStore((s) => s.selectedEra)
  const audioEnabled = useCityStore((s) => s.audioEnabled)
  const toggleAudio = useCityStore((s) => s.toggleAudio)
  const requestReset = useCityStore((s) => s.requestReset)
  const cycleQuality = useCityStore((s) => s.cycleQuality)
  const quality = useCityStore((s) => s.quality)
  const reducedMotion = useCityStore((s) => s.reducedMotion)
  const setReducedMotion = useCityStore((s) => s.setReducedMotion)

  const era = ERAS[selectedEra]

  return (
    <>
      <div className="hud-card">
        <div className="hud-era">{eraLabel(selectedEra)}</div>
        <p className="hud-blurb">{era.blurb}</p>
        <dl className="hud-meta">
          <div>
            <dt>Ambient</dt>
            <dd>{era.audio.ambient}</dd>
          </div>
          <div>
            <dt>Motif</dt>
            <dd>{era.audio.motif}</dd>
          </div>
        </dl>
      </div>

      <div className="hud-controls">
        <button
          className="ctrl-btn"
          onClick={toggleAudio}
          aria-pressed={audioEnabled}
          title={audioEnabled ? 'Mute audio' : 'Enable audio'}
        >
          <span aria-hidden="true">{audioEnabled ? '🔊' : '🔇'}</span>
          <span className="ctrl-label">
            {audioEnabled ? 'Audio On' : 'Audio Off'}
          </span>
        </button>
        <button
          className="ctrl-btn"
          onClick={requestReset}
          title="Reset camera to default view"
        >
          <span aria-hidden="true">🎯</span>
          <span className="ctrl-label">Reset View</span>
        </button>
        <button
          className="ctrl-btn"
          onClick={cycleQuality}
          title="Toggle render quality"
        >
          <span aria-hidden="true">{quality === 'high' ? '✨' : '⚡'}</span>
          <span className="ctrl-label">{quality === 'high' ? 'High' : 'Fast'}</span>
        </button>
        <button
          className="ctrl-btn"
          onClick={() => setReducedMotion(!reducedMotion)}
          aria-pressed={reducedMotion}
          title="Reduced motion: snap transitions"
        >
          <span aria-hidden="true">{reducedMotion ? '⏱' : '🎬'}</span>
          <span className="ctrl-label">
            {reducedMotion ? 'Snap' : 'Smooth'}
          </span>
        </button>
      </div>

      <div className="hud-hint" aria-hidden="true">
        Drag to orbit · Scroll to zoom · Right-drag to pan
      </div>
      <div className="hud-year" aria-hidden="true">
        {ERA_YEARS[selectedEra]}
      </div>
    </>
  )
}
