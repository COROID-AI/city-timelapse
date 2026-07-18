import { useCallback, useRef } from 'react';
import { ERAS } from '../lib/era-data';
import { useEraStore } from '../lib/store';

/**
 * Top timeline slider exposing exactly six eras. Operable by mouse (click +
 * drag), touch, and keyboard (arrow keys / Home / End). Shows a visible active
 * indicator and the selected era's year + mood label.
 *
 * The underlying native range input guarantees cross-device keyboard/touch
 * support and accessibility; the custom track/ticks layer the visual active
 * indicator on top.
 */
export function Timeline() {
  const targetEra = useEraStore((s) => s.targetEra);
  const setEra = useEraStore((s) => s.setEra);
  const reduced = useEraStore((s) => s.reducedMotion || s.prefersReducedMotion);
  const toggleReducedMotion = useEraStore((s) => s.toggleReducedMotion);
  const muted = useEraStore((s) => s.muted);
  const toggleMute = useEraStore((s) => s.toggleMute);
  const resetView = useEraStore((s) => s.resetView);

  const sliderRef = useRef<HTMLInputElement>(null);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEra(Number(e.target.value));
    },
    [setEra],
  );

  // Keyboard handler on the slider — native arrows already move by step, but we
  // also expose Home/End and coarse left/right for convenience.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      let next = targetEra;
      if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = ERAS.length - 1;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = targetEra + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = targetEra - 1;
      else return;
      e.preventDefault();
      setEra(next);
      // keep the native input in sync visually
      if (sliderRef.current) sliderRef.current.value = String(Math.max(0, Math.min(ERAS.length - 1, next)));
    },
    [targetEra, setEra],
  );

  const current = ERAS[targetEra];
  const pct = (targetEra / (ERAS.length - 1)) * 100;

  return (
    <div className="timeline" role="group" aria-label="Era timeline">
      <div className="timeline-header">
        <span className="timeline-year" aria-live="polite">
          {current.year}
        </span>
        <span className="timeline-mood">{current.mood}</span>
      </div>

      <div className="timeline-track-wrap">
        {/* Filled progress up to active era */}
        <div className="timeline-fill" style={{ width: `${pct}%` }} aria-hidden="true" />
        {/* Era tick marks */}
        <div className="timeline-ticks" aria-hidden="true">
          {ERAS.map((era, i) => (
            <button
              key={era.year}
              type="button"
              className={`tick ${i === targetEra ? 'active' : ''}`}
              style={{ left: `${(i / (ERAS.length - 1)) * 100}%` }}
              onClick={() => setEra(i)}
              aria-label={`Select era ${era.year}`}
              aria-pressed={i === targetEra}
            >
              <span className="tick-dot" />
              <span className="tick-label">{era.year}</span>
            </button>
          ))}
        </div>
        {/* Native range input for drag / touch / keyboard */}
        <input
          ref={sliderRef}
          className="timeline-range"
          type="range"
          min={0}
          max={ERAS.length - 1}
          step={1}
          value={targetEra}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label="Era"
          aria-valuetext={current.label}
        />
      </div>

      <div className="timeline-controls">
        <button
          type="button"
          className="ctrl-btn"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        >
          <span className="ctrl-icon">{muted ? '🔇' : '🔊'}</span>
          <span className="ctrl-text">{muted ? 'Muted' : 'Sound'}</span>
        </button>
        <button
          type="button"
          className="ctrl-btn"
          onClick={toggleReducedMotion}
          aria-pressed={reduced}
          aria-label={reduced ? 'Disable reduced motion' : 'Enable reduced motion'}
        >
          <span className="ctrl-icon">{reduced ? '⏸' : '▶'}</span>
          <span className="ctrl-text">{reduced ? 'Snap' : 'Motion'}</span>
        </button>
        <button
          type="button"
          className="ctrl-btn"
          onClick={resetView}
          aria-label="Reset camera view"
        >
          <span className="ctrl-icon">⟲</span>
          <span className="ctrl-text">Reset View</span>
        </button>
      </div>
    </div>
  );
}
