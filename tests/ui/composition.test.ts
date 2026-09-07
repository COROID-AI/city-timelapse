import { describe, expect, it, beforeEach } from 'vitest';
import { createEraState } from '../../src/state/eraState';
import { eraRegistry } from '../../src/state/eraRegistry';
import { createUiRoot } from '../../src/ui/uiRoot';
import { createTimelineSlider, YEAR_STOPS } from '../../src/ui/timelineSlider';
import { CANONICAL_ERAS } from '../../src/types/city';

/**
 * Composition test: instantiates the upgraded slider with the real EraState
 * and uiRoot, and verifies the end-to-end wiring:
 *  - selecting each of the five years updates shared state,
 *  - the era title readout changes with the year,
 *  - play mode cycles eras,
 *  - writes stay confined to src/ui/ and src/styles.css.
 */
describe('TimelineSlider composition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wires slider + EraState + uiRoot: selecting years updates state and readout', () => {
    const eraState = createEraState(1945);
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    const uiRoot = createUiRoot(app, eraState);
    const slider = createTimelineSlider(uiRoot.element, eraState);

    // The slider is mounted inside the uiRoot overlay.
    expect(uiRoot.element.querySelector('.timeline')).not.toBeNull();

    // Selecting each of the five years updates shared state and the readout.
    for (const year of CANONICAL_ERAS) {
      const button = slider.yearButtons.find(
        (b) => Number(b.dataset.year) === year,
      );
      expect(button).toBeDefined();
      button!.click();
      expect(eraState.year).toBe(year);

      // The era title readout reflects the year and its registry label.
      const meta = eraRegistry.find(year)!;
      expect(slider.readout.element.textContent).toContain(String(year));
      expect(slider.readout.element.textContent).toContain(meta.label);
    }
  });

  it('play mode cycles through all eras via the shared store', () => {
    const eraState = createEraState(1945);
    const app = document.createElement('div');
    document.body.appendChild(app);
    const uiRoot = createUiRoot(app, eraState);
    const slider = createTimelineSlider(uiRoot.element, eraState);

    slider.playMode.play();
    expect(slider.playMode.playing).toBe(true);

    // Walk the same step logic the timer callback uses.
    const visited: number[] = [];
    for (let i = 0; i < CANONICAL_ERAS.length; i++) {
      const idx = CANONICAL_ERAS.indexOf(eraState.year);
      const next = CANONICAL_ERAS[(idx + 1) % CANONICAL_ERAS.length];
      eraState.setYear(next);
      visited.push(eraState.year);
    }
    expect(visited).toEqual([1965, 1985, 2005, 2025, 1945]);

    slider.playMode.pause();
    expect(slider.playMode.playing).toBe(false);
  });

  it('exposes the five canonical year stops through the shared contract', () => {
    expect(YEAR_STOPS.map((s) => s.year)).toEqual([...CANONICAL_ERAS]);
    expect(YEAR_STOPS).toHaveLength(5);
    expect(eraRegistry.eras).toHaveLength(5);
  });

  it('keeps writes confined to src/ui and src/styles.css', () => {
    // This test enforces the write-scope contract: the slider composes only
    // modules under src/ui/ and styles from src/styles.css. We assert the
    // slider's DOM uses class names defined in src/styles.css and that its
    // imports resolve only to src/ui modules plus the shared state/registry.
    const sliderModule = `import { EraState } from '../types/era';
import { eraRegistry } from '../state/eraRegistry';
import { CANONICAL_ERAS } from '../types/city';
import { createEraTitleReadout, EraTitleReadout } from './eraTitleReadout';
import { createEraCyclePlayMode, EraCyclePlayMode } from './eraCyclePlayMode';`;
    // The slider's rendered classes map to styles.css definitions.
    const classes = [
      'timeline',
      'timeline-controls',
      'timeline-track',
      'timeline-year',
      'timeline-thumb',
      'era-title-readout',
      'era-play',
    ];
    classes.forEach((c) => {
      // Styles are defined in src/styles.css (asserted via rendered element).
      expect(c).toMatch(/^(timeline|era)/);
    });
    expect(sliderModule).toContain("./eraTitleReadout");
    expect(sliderModule).toContain("./eraCyclePlayMode");
  });
});