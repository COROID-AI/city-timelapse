import { describe, expect, it, beforeEach } from 'vitest';
import { createEraState } from '../../src/state/eraState';
import { createTimelineSlider, YEAR_STOPS } from '../../src/ui/timelineSlider';
import { eraTitleFor } from '../../src/ui/eraTitleReadout';
import { CANONICAL_ERAS } from '../../src/types/city';

/**
 * UI tests for the polished timeline slider. Run under happy-dom (see
 * vite.config.ts environmentMatchGlobs) so DOM construction and events work.
 */

function makeSlider() {
  const eraState = createEraState(1945);
  const host = document.createElement('div');
  host.className = 'ui-overlay';
  document.body.appendChild(host);
  const slider = createTimelineSlider(host, eraState);
  return { eraState, host, slider };
}

describe('TimelineSlider', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('exposes exactly the five canonical year stops with labels', () => {
    const { slider } = makeSlider();
    expect(YEAR_STOPS.map((s) => s.year)).toEqual([1945, 1965, 1985, 2005, 2025]);
    expect(slider.yearButtons).toHaveLength(5);
    slider.yearButtons.forEach((btn, i) => {
      expect(btn.textContent).toBe(String(CANONICAL_ERAS[i]));
      expect(btn.dataset.year).toBe(String(CANONICAL_ERAS[i]));
    });
  });

  it('maps tick stops to the five canonical years', () => {
    const { slider } = makeSlider();
    // Each stop button carries a tick marker (::after pseudo-element in CSS)
    // and the thumb positions at 0%, 25%, 50%, 75%, 100%.
    expect(slider.yearButtons.map((b) => Number(b.dataset.year))).toEqual([
      ...CANONICAL_ERAS,
    ]);
    const thumb = slider.element.querySelector('.timeline-thumb');
    expect(thumb).not.toBeNull();
  });

  it('selecting each of the five years updates EraState and the active class', () => {
    const { eraState, slider } = makeSlider();
    for (let i = 0; i < CANONICAL_ERAS.length; i++) {
      const year = CANONICAL_ERAS[i];
      slider.yearButtons[i].click();
      expect(eraState.year).toBe(year);
      slider.yearButtons.forEach((btn, j) => {
        expect(btn.classList.contains('active')).toBe(j === i);
      });
    }
  });

  it('moves between years with arrow keys and Home/End', () => {
    const { eraState, slider } = makeSlider();
    const track = slider.element.querySelector('.timeline-track')!;

    const key = (k: string) =>
      track.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      );

    // Start at 1945 (index 0). ArrowRight -> 1965.
    key('ArrowRight');
    expect(eraState.year).toBe(1965);
    // ArrowUp -> 1985.
    key('ArrowUp');
    expect(eraState.year).toBe(1985);
    // ArrowLeft -> 1965.
    key('ArrowLeft');
    expect(eraState.year).toBe(1965);
    // ArrowDown -> 1945.
    key('ArrowDown');
    expect(eraState.year).toBe(1945);
    // Home -> 1945 (no change), End -> 2025.
    key('Home');
    expect(eraState.year).toBe(1945);
    key('End');
    expect(eraState.year).toBe(2025);
    // ArrowRight at the last stop clamps (stays 2025).
    key('ArrowRight');
    expect(eraState.year).toBe(2025);
    // ArrowLeft -> 2005.
    key('ArrowLeft');
    expect(eraState.year).toBe(2005);
  });

  it('exposes ARIA slider roles, labels, and live values', () => {
    const { eraState, slider } = makeSlider();
    const track = slider.element.querySelector('.timeline-track')!;
    expect(track.getAttribute('role')).toBe('slider');
    expect(track.getAttribute('aria-label')).toBe('Era timeline');
    expect(track.getAttribute('aria-valuemin')).toBe('0');
    expect(track.getAttribute('aria-valuemax')).toBe('4');
    expect(track.getAttribute('tabindex')).toBe('0');
    expect(track.getAttribute('aria-valuenow')).toBe('0');

    eraState.setYear(2025);
    expect(track.getAttribute('aria-valuenow')).toBe('4');
    expect(track.getAttribute('aria-valuetext')).toContain('Modern');
  });

  it('updates the era title readout with year — era label', () => {
    const { eraState, slider } = makeSlider();
    expect(eraTitleFor(1945)).toBe('Post-War');
    expect(eraTitleFor(2025)).toBe('Smart City');
    expect(slider.readout.element.textContent).toBe('1945 — Post-War');
    eraState.setYear(2025);
    expect(slider.readout.element.textContent).toBe('2025 — Smart City');
    expect(slider.readout.element.getAttribute('aria-live')).toBe('polite');
  });

  it('cycles eras through play mode and pauses', () => {
    const { eraState, slider } = makeSlider();
    const play = slider.playMode;
    expect(play.playing).toBe(false);
    play.play();
    expect(play.playing).toBe(true);
    expect(play.button.textContent).toBe('Pause');

    // Step through all five years using the same logic as the timer callback.
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      const idx = CANONICAL_ERAS.indexOf(eraState.year);
      const next = CANONICAL_ERAS[(idx + 1) % CANONICAL_ERAS.length];
      eraState.setYear(next);
      seen.push(eraState.year);
    }
    expect(seen).toEqual([1965, 1985, 2005, 2025, 1945]);

    play.pause();
    expect(play.playing).toBe(false);
    expect(play.button.textContent).toBe('Play');
    play.toggle();
    expect(play.playing).toBe(true);
    play.toggle();
    expect(play.playing).toBe(false);
  });

  it('dispose removes the element and unsubscribes from state', () => {
    const { eraState, host, slider } = makeSlider();
    slider.dispose();
    expect(host.querySelector('.timeline')).toBeNull();
    // After dispose, setting the year must not throw (listener removed).
    eraState.setYear(1965);
    expect(eraState.year).toBe(1965);
  });
});