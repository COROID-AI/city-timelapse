/**
 * Timeline slider — top of the screen, six labeled years.
 *
 * Operable by mouse (range input + clickable ticks), keyboard (arrows on the
 * range input natively, plus dedicated Left/Right handler), and touch (native
 * range input works on touch; ticks have onTouchStart). Shows the eased era as
 * it sweeps, plus the per-era label.
 */

import { useCallback, useEffect, useRef } from "react";
import { ERA_YEARS } from "../data/eras";
import { useAppStore } from "../state/store";
import { eraState } from "../runtime/eraState";

export function Timeline() {
  const targetEra = useAppStore((s) => s.targetEra);
  const selectEraIndex = useAppStore((s) => s.selectEraIndex);
  const stepEra = useAppStore((s) => s.stepEra);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  // Track the live eased era for the progress indicator (rAF, no React state).
  const fillRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const ef = eraState.eraFloat;
      const pct = (ef / (ERA_YEARS.length - 1)) * 100;
      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      const nearest = Math.round(ef);
      if (labelRef.current) {
        labelRef.current.textContent = ERA_YEARS[nearest]!.toString();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        stepEra(-1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        stepEra(1);
      } else if (e.key === "Home") {
        e.preventDefault();
        selectEraIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        selectEraIndex(ERA_YEARS.length - 1);
      }
    },
    [stepEra, selectEraIndex]
  );

  return (
    <div
      className="timeline"
      role="group"
      aria-label="Era timeline"
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <div className="timeline-track" aria-hidden="true">
        <div ref={fillRef} className="timeline-fill" />
      </div>
      <div className="timeline-ticks">
        {ERA_YEARS.map((year, i) => (
          <button
            key={year}
            type="button"
            className={`tick ${i === targetEra ? "tick-active" : ""}`}
            aria-pressed={i === targetEra}
            aria-label={`Select year ${year}`}
            onClick={() => selectEraIndex(i)}
            onTouchStart={(e) => {
              e.preventDefault();
              selectEraIndex(i);
            }}
          >
            <span className="tick-year">{year}</span>
          </button>
        ))}
      </div>
      {/* Native range for full keyboard + touch + mouse-drag semantics */}
      <input
        className="timeline-range"
        type="range"
        min={0}
        max={ERA_YEARS.length - 1}
        step={1}
        value={targetEra}
        onChange={(e) => selectEraIndex(Number(e.target.value))}
        aria-label="Era year slider"
        aria-valuetext={ERA_YEARS[targetEra]?.toString()}
      />
      <div className="timeline-readout">
        <span ref={labelRef}>{ERA_YEARS[targetEra]}</span>
        {reducedMotion && <span className="rm-badge">Reduced motion</span>}
      </div>
    </div>
  );
}
