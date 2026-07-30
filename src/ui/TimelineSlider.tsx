import { useEffect, useMemo, useState } from 'react';
import { useEra } from '../contexts/EraContext';
import type { EraYear } from '../types';
import timeline from '../scenes/eras';

function clampYearToEraYear(value: number): EraYear {
  // Ensure we only ever set/commit valid EraYear union members.
  // The slider might produce intermediate numeric values depending on
  // the step/keyboard interaction, so we snap to the closest era year.
  const years = timeline.map((e) => e.year);
  const closest = years.reduce((best, y) => {
    return Math.abs(y - value) < Math.abs(best - value) ? y : best;
  }, years[0]);

  return closest as EraYear;
}

function eraLabelFromEraData(eraYear: number): string {
  const era = timeline.find((e) => e.year === eraYear);
  const style = era?.buildingArchitecturalStyle ?? '';
  // buildingArchitecturalStyle is a descriptive sentence-ish string.
  // Extract the leading descriptor as a short era label.
  const leading = style.split(',')[0]?.trim();
  return leading || `${eraYear} Era`;
}

export default function TimelineSlider() {
  const { year, setYear } = useEra();

  // Let non-interactive evidence runs (that only load the page) know that the
  // user (or automation) interacted with the slider.
  // This prevents the auto-timelapse from fighting user input.
  const markUserInteracted = () => {
    (window as any).__CITY_TIMELAPSE_USER_INTERACTED__ = true;
  };

  const years = useMemo(() => timeline.map((e) => e.year) as EraYear[], []);
  const min = years[0];
  const max = years[years.length - 1];
  // Use step=1 so the range input can land on all era years (e.g. 2055).
  // We still snap in clampYearToEraYear.
  const step = 1;

  const [thumbYear, setThumbYear] = useState<EraYear>(year);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    setThumbYear(year);
  }, [year]);

  const percent = ((thumbYear - min) / (max - min)) * 100;
  const tooltipLeft = `${percent}%`;
  const tickPositions = years.map((y) => {
    const p = ((y - min) / (max - min)) * 100;
    return { year: y, percent: p };
  });

  return (
    <div className={`timeline-slider-container${isInteracting ? ' timeline-slider-container--active' : ''}`}
      aria-label="Timeline year selector"
    >
      <input
        className="timeline-slider-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={thumbYear}
        aria-label="Select year"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={thumbYear}
        aria-describedby="timeline-slider-tooltip"
        onChange={(e) => {
          const next = clampYearToEraYear(Number(e.target.value));
          setThumbYear(next);
          markUserInteracted();
          setYear(next); // immediate commit so all subsystems react in sync
        }}
        onFocus={() => setIsInteracting(true)}
        onBlur={() => setIsInteracting(false)}
        onPointerDown={() => {
          setIsInteracting(true);
          markUserInteracted();
        }}
        onPointerUp={() => setIsInteracting(false)}
        onPointerCancel={() => setIsInteracting(false)}
      />

      <div className="timeline-slider-visual" aria-hidden="true">
        <div className="timeline-slider-rail" />
        <div className="timeline-slider-ticks">
          {tickPositions.map(({ year: tickYear, percent: p }) => (
            <div
              key={tickYear}
              className="timeline-slider-tick"
              style={{ left: `${p}%` }}
            >
              <div className="timeline-slider-tick-mark" />
              <div className="timeline-slider-era-label">{eraLabelFromEraData(tickYear)}</div>
              <div className="timeline-slider-year-label">{tickYear}</div>
            </div>
          ))}
        </div>

        <div
          className="timeline-slider-thumb"
          style={{ left: tooltipLeft }}
        />
      </div>

      <div
        id="timeline-slider-tooltip"
        role="tooltip"
        aria-live="polite"
        className="timeline-slider-tooltip"
        style={{ left: tooltipLeft, opacity: 1 }}
      >
        {thumbYear}
      </div>
    </div>
  );
}

