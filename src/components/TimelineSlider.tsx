import * as React from 'react';

import { getEraYears } from '../scenes/eras';
import type { EraStore } from '../state/eraStore';

/**
 * A polished, accessible top timeline slider.
 *
 * Renders exactly the five era years derived read-only from the shared era
 * registry (`getEraYears()`). The thumb position reflects the current era
 * index, and each step label is era-reflective (the year text). The slider is
 * fully keyboard accessible: it exposes `role="slider"`, `aria-valuemin` /
 * `aria-valuemax` / `aria-valuenow` based on the era index, and responds to
 * arrow-key input via `onKeyDown`.
 *
 * The component owns no state itself — it delegates to the passed-in
 * {@link EraStore}, which holds the current year plus the tweened progress
 * value so the scene transitions smoothly in front of the viewer.
 */

/** CSS-free inline style so the component renders standalone in any host. */
const TRACK_STYLE: React.CSSProperties = {
  position: 'relative',
  height: '6px',
  borderRadius: '3px',
  background: 'linear-gradient(90deg, #8a6d4b 0%, #c8b896 25%, #9aa7c4 50%, #6f86b8 75%, #4c7f5a 100%)',
};

const THUMB_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '-7px',
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  background: '#f5f5f5',
  border: '2px solid #2b2b2b',
  boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
};

const LABEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: '-20px',
  transform: 'translateX(-50%)',
  fontSize: '12px',
  fontFamily: 'system-ui, sans-serif',
  color: '#333',
  userSelect: 'none',
};

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'block',
  paddingTop: '8px',
  paddingBottom: '26px',
  width: '100%',
};

function eraIndex(year: number, years: readonly number[]): number {
  const idx = years.indexOf(year);
  return idx === -1 ? 0 : idx;
}

/**
 * The top timeline slider.
 *
 * @param store the era selection store (owns current year + tweened progress)
 * @param widthCss optional CSS width for the slider track (defaults to 100%)
 */
export function TimelineSlider({
  store,
  widthCss = '100%',
}: {
  store: EraStore;
  widthCss?: string;
}): React.ReactElement {
  const years: readonly number[] = store.years.length > 0
    ? store.years
    : getEraYears();
  const index = eraIndex(store.current.year, years);
  const maxIndex = years.length - 1;
  const percent = maxIndex > 0 ? (index / maxIndex) * 100 : 0;

  const move = (dir: -1 | 1): void => {
    const idx = eraIndex(store.current.year, years);
    const next = idx + dir;
    if (next >= 0 && next <= maxIndex) {
      store.select(years[next]);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const idx = eraIndex(store.current.year, years);
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        move(-1);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        move(1);
        break;
      case 'Home':
        e.preventDefault();
        store.select(years[0]);
        break;
      case 'End':
        e.preventDefault();
        store.select(years[maxIndex]);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="slider"
      aria-label="Timeline era"
      aria-valuemin={0}
      aria-valuemax={maxIndex}
      aria-valuenow={index}
      aria-valuetext={`${store.current.year}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={CONTAINER_STYLE}
    >
      <div style={TRACK_STYLE} />
      <div
        style={{
          ...THUMB_STYLE,
          left: `${percent}%`,
          transform: `translateX(-50%)`,
        }}
        aria-hidden="true"
      />
      {years.map((year, i) => (
        <span
          key={year}
          style={{
            ...LABEL_STYLE,
            left: `${maxIndex > 0 ? (i / maxIndex) * 100 : 0}%`,
            fontWeight: i === index ? 700 : 400,
          }}
        >
          {year}
        </span>
      ))}
    </div>
  );
}