import { useRef, useEffect, useCallback } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { ERAS } from '../data/eras';
import { ERA_COUNT, ERA_MAX } from '../engine/eraSampler';
import { audioEngine } from '../audio/AudioEngine';

// ---------------------------------------------------------------------------
// HUD — the DOM overlay on top of the Canvas.
//
// Contains:
//  - The top timeline slider (exactly six era stops, keyboard operable, ARIA).
//  - Era name + blurb readout.
//  - SFX toggle (initialised on first gesture).
//  - Reduced-motion toggle.
//  - Auto-rotate toggle.
//  - Camera reset button.
// ---------------------------------------------------------------------------

const ERA_LABELS = ERAS.map((e) => `${e.label} — ${e.name}`);

export function Hud() {
  const targetEra = useSceneStore((s) => s.targetEra);
  const eraFloat = useSceneStore((s) => s.eraFloat);
  const isTransitioning = useSceneStore((s) => s.isTransitioning);
  const sfxEnabled = useSceneStore((s) => s.sfxEnabled);
  const reducedMotion = useSceneStore((s) => s.reducedMotion);
  const autoRotate = useSceneStore((s) => s.autoRotate);
  const setEra = useSceneStore((s) => s.setEra);
  const stepEra = useSceneStore((s) => s.stepEra);
  const toggleSfx = useSceneStore((s) => s.toggleSfx);
  const setSfxEnabled = useSceneStore((s) => s.setSfxEnabled);
  const toggleReducedMotion = useSceneStore((s) => s.toggleReducedMotion);
  const setAutoRotate = useSceneStore((s) => s.setAutoRotate);
  const resetCamera = useSceneStore((s) => s.resetCamera);

  const sliderRef = useRef<HTMLInputElement>(null);

  // Current era info for the readout panel.
  const currentEraIdx = Math.round(eraFloat);
  const currentEra = ERAS[currentEraIdx] ?? ERAS[0];

  // --- SFX: must be initialised on the first user gesture ---
  const handleSfxToggle = useCallback(() => {
    const next = !sfxEnabled;
    if (next) {
      // First-enable: lazily create the AudioContext within this gesture.
      audioEngine.init();
      audioEngine.resume();
    } else {
      audioEngine.suspend();
    }
    setSfxEnabled(next);
  }, [sfxEnabled, setSfxEnabled]);

  // --- Global keyboard: number keys 1-6 jump to an era; arrows step ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack typing in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        setEra(parseInt(e.key, 10) - 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepEra(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepEra(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setEra, stepEra]);

  // --- Slider change ---
  const onSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEra(parseInt(e.target.value, 10));
    },
    [setEra],
  );

  // --- Slider keyboard: let the native range handle arrows, but we also
  // provide explicit number-key + arrow handling above for full operability.
  const onSliderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Home') {
        e.preventDefault();
        setEra(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setEra(ERA_MAX);
      }
    },
    [setEra],
  );

  return (
    <div className="hud">
      {/* ---- Top timeline ---- */}
      <div className="hud__timeline" role="group" aria-label="Era timeline">
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={ERA_MAX}
          step={1}
          value={targetEra}
          onChange={onSliderChange}
          onKeyDown={onSliderKeyDown}
          className="hud__slider"
          aria-label="Timeline year selector"
          aria-valuemin={1945}
          aria-valuemax={2055}
          aria-valuenow={ERAS[targetEra]?.year ?? 1945}
          aria-valuetext={ERA_LABELS[targetEra] ?? '1945'}
        />
        <div className="hud__ticks" aria-hidden="true">
          {ERAS.map((era, i) => (
            <button
              key={era.year}
              className={`hud__tick ${i === targetEra ? 'hud__tick--active' : ''}`}
              onClick={() => setEra(i)}
              tabIndex={-1}
            >
              <span className="hud__tick-year">{era.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Era readout ---- */}
      <div className="hud__readout" aria-live="polite">
        <div className="hud__year">{currentEra.label}</div>
        <div className="hud__name">{currentEra.name}</div>
        <div className="hud__blurb">{currentEra.blurb}</div>
        {isTransitioning && <div className="hud__transition">Transforming…</div>}
      </div>

      {/* ---- Control panel ---- */}
      <div className="hud__controls" role="group" aria-label="Scene controls">
        <button
          className="hud__btn"
          onClick={handleSfxToggle}
          aria-pressed={sfxEnabled}
          aria-label={sfxEnabled ? 'Mute ambient sound effects' : 'Enable ambient sound effects'}
          title="Toggle procedural ambient audio"
        >
          {sfxEnabled ? '🔊' : '🔈'} SFX
        </button>
        <button
          className="hud__btn"
          onClick={toggleReducedMotion}
          aria-pressed={reducedMotion}
          aria-label={reducedMotion ? 'Disable reduced motion' : 'Enable reduced motion'}
          title="Instant era transitions, no auto-rotate"
        >
          {reducedMotion ? '🚫' : '🎞️'} Motion
        </button>
        <button
          className="hud__btn"
          onClick={() => setAutoRotate(!autoRotate)}
          aria-pressed={autoRotate}
          aria-label={autoRotate ? 'Stop auto-rotate camera' : 'Start auto-rotate camera'}
          disabled={reducedMotion}
          title="Orbit the camera automatically"
        >
          {autoRotate ? '⏸️' : '🔄'} Rotate
        </button>
        <button
          className="hud__btn"
          onClick={resetCamera}
          aria-label="Reset camera to default view"
          title="Reset camera position"
        >
          🎯 Reset View
        </button>
      </div>

      {/* ---- Keyboard hint ---- */}
      <div className="hud__hint" aria-hidden="true">
        <kbd>1</kbd>–<kbd>6</kbd> or <kbd>←</kbd>/<kbd>→</kbd> · drag to orbit · scroll to zoom
      </div>

      <span className="hud__sr-only" aria-hidden="true">
        {ERA_COUNT} eras available. Use number keys 1 through 6 or arrow keys to navigate.
      </span>
    </div>
  );
}
