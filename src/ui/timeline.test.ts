/**
 * Composition and behavior tests for the fixed-top era timeline UI.
 *
 * These tests mount the real UI against the real `EraTimelineCore` (the
 * shared era-timeline-core contract) and drive it through the same input
 * events users produce: pointer drag/click, mouse fallback, touch, and
 * keyboard. They assert that every input mutates the shared core, that the
 * HUD/progress mirror core frames, and that ARIA/focus/pointer-events
 * contracts hold.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERA_YEARS, EraTimelineCore, yearToPosition } from '../era/timeline';
import { ERA_NAMES, eraNameForYear } from './hud';
import { mountTimelineUI, type TimelineUI, type TimelineUIOptions } from './timeline';

/** Simulated layout for the track (jsdom has no layout engine). */
const TRACK_LEFT = 20;
const TRACK_WIDTH = 100;
const TRACK_HEIGHT = 40;

const ERA_COPY: ReadonlyArray<readonly [number, string]> = [
  [1945, 'Postwar Rebuild'],
  [1965, 'Mid-Century Boom'],
  [1985, 'Neon Decade'],
  [2005, 'Digital Dawn'],
  [2025, 'Near Future'],
];

interface Harness {
  host: HTMLElement;
  core: EraTimelineCore;
  ui: TimelineUI;
  slider: HTMLElement;
  track: HTMLElement;
}

let current: { ui: TimelineUI; host: HTMLElement } | null = null;

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing expected element: ${selector}`);
  return element;
}

/** Simulate a laid-out track so clientX → position mapping works in jsdom. */
function mockTrackRect(track: HTMLElement): void {
  const rect = {
    x: TRACK_LEFT,
    y: 0,
    left: TRACK_LEFT,
    top: 0,
    right: TRACK_LEFT + TRACK_WIDTH,
    bottom: TRACK_HEIGHT,
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    toJSON: (): unknown => ({}),
  } as unknown as DOMRect;
  vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(rect);
}

/** Client X for a 0..1 track position. */
function clientXFor(position: number): number {
  return TRACK_LEFT + TRACK_WIDTH * position;
}

/**
 * Mount the UI inside a slot shaped like the app shell's, against a fresh
 * real core. `autoAdvance: false` keeps frame pumping test-controlled.
 */
function setup(overrides: Partial<Omit<TimelineUIOptions, 'container'>> = {}): Harness {
  const host = document.createElement('div');
  host.className = 'timeline-slot';
  host.setAttribute('data-timeline-slot', '');
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Timeline');
  const placeholder = document.createElement('span');
  placeholder.className = 'timeline-slot__label';
  placeholder.textContent = 'Timeline';
  host.appendChild(placeholder);
  document.body.appendChild(host);

  const core = new EraTimelineCore();
  const ui = mountTimelineUI({ container: host, core, autoAdvance: false, ...overrides });
  current = { ui, host };

  const slider = required<HTMLElement>(ui.element, '[role="slider"]');
  const track = required<HTMLElement>(ui.element, '[data-testid="era-slider-track"]');
  mockTrackRect(track);
  return { host, core, ui, slider, track };
}

/** Dispatch a pointer/mouse-style event carrying `clientX`. */
function fireMouse(target: EventTarget, type: string, position: number): void {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: clientXFor(position),
      clientY: 4,
    }),
  );
}

/**
 * Dispatch a touch-style event. jsdom cannot construct real `TouchEvent`s, so
 * the point lists are attached to a plain bubbling event — the UI reads them
 * structurally, exactly as it reads native touch events.
 */
function fireTouch(target: EventTarget, type: string, position: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: clientXFor(position), clientY: 4 };
  const isEnd = type === 'touchend' || type === 'touchcancel';
  Object.defineProperty(event, 'touches', { value: isEnd ? [] : [point] });
  Object.defineProperty(event, 'changedTouches', { value: [point] });
  target.dispatchEvent(event);
}

/**
 * Dispatch a keydown on the slider; returns whether the slider consumed the
 * key (`defaultPrevented`), i.e. handled navigation keys return `true`.
 */
function pressKey(slider: HTMLElement, key: string): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  slider.dispatchEvent(event);
  return event.defaultPrevented;
}

function activeStop(ui: TimelineUI): HTMLElement | null {
  return ui.element.querySelector<HTMLElement>('.era-slider__stop[data-active="true"]');
}

afterEach(() => {
  current?.ui.dispose();
  current?.host.remove();
  current = null;
  document.body.replaceChildren();
});

describe('era timeline UI — structure and ARIA', () => {
  it('presents exactly the five era stops with tick labels and a playhead', () => {
    const { ui } = setup();

    const stops = Array.from(ui.element.querySelectorAll<HTMLElement>('.era-slider__stop'));
    expect(stops).toHaveLength(ERA_YEARS.length);
    expect(
      stops.map((stop) => stop.querySelector('.era-slider__label')?.textContent),
    ).toEqual(ERA_YEARS.map(String));
    expect(
      stops.map((stop) => stop.dataset.year),
    ).toEqual(ERA_YEARS.map(String));
    expect(ui.element.querySelectorAll('.era-slider__tick')).toHaveLength(5);
    expect(ui.element.querySelector('[data-testid="era-playhead"]')).not.toBeNull();
    // Tick labels are presentational duplicates of aria-valuetext, so they
    // never add stray tab stops or screen-reader clutter.
    expect(ui.element.querySelector('.era-slider__stops')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('exposes full ARIA slider semantics on a focusable slider', () => {
    const { slider } = setup();

    expect(slider.getAttribute('role')).toBe('slider');
    expect(slider.tabIndex).toBe(0);
    expect(slider.getAttribute('aria-orientation')).toBe('horizontal');
    expect(slider.getAttribute('aria-valuemin')).toBe('1945');
    expect(slider.getAttribute('aria-valuemax')).toBe('2025');
    expect(slider.getAttribute('aria-valuenow')).toBe('1945');
    expect(slider.getAttribute('aria-valuetext')).toBe('1945 \u2014 Postwar Rebuild');
    expect(slider.getAttribute('aria-label')).toBeTruthy();

    slider.focus();
    expect(document.activeElement).toBe(slider);
  });

  it('mounts into the shell overlay reserved slot, replacing the placeholder', () => {
    const overlay = document.createElement('div');
    overlay.className = 'ui-overlay';
    const slot = document.createElement('div');
    slot.className = 'timeline-slot';
    slot.setAttribute('data-timeline-slot', '');
    const placeholder = document.createElement('span');
    placeholder.className = 'timeline-slot__label';
    placeholder.textContent = 'Timeline';
    slot.appendChild(placeholder);
    overlay.appendChild(slot);
    document.body.appendChild(overlay);

    const ui = mountTimelineUI({ container: overlay, autoAdvance: false });
    current = { ui, host: overlay };

    expect(slot.querySelector('[data-testid="timeline-ui"]')).toBe(ui.element);
    expect(slot.querySelector('.timeline-slot__label')).toBeNull();
    expect(slot.classList.contains('timeline-slot--era')).toBe(true);
    expect(overlay.querySelectorAll('.timeline-ui')).toHaveLength(1);
  });

  it('keeps pointer events passing through the root; only the panel is interactive', () => {
    const { ui } = setup();

    // Outside the panel's bounds the overlay must not swallow orbit/walk
    // input, so the root is a pass-through and the panel opts back in.
    expect(getComputedStyle(ui.element).pointerEvents).toBe('none');
    expect(getComputedStyle(ui.panel).pointerEvents).toBe('auto');
  });
});

describe('era timeline UI — input drives the shared era timeline core', () => {
  it('arrow keys step between stops and start an eased morph on the core', () => {
    const onSelect = vi.fn();
    const { core, ui, slider } = setup({ onSelect });

    expect(pressKey(slider, 'ArrowRight')).toBe(true);
    expect(core.selectedYear).toBe(1965);
    expect(core.isTransitioning).toBe(true);
    expect(ui.element.dataset.transitioning).toBe('true');
    expect(slider.getAttribute('aria-valuenow')).toBe('1965');
    expect(slider.getAttribute('aria-valuetext')).toBe('1965 \u2014 Mid-Century Boom');
    expect(activeStop(ui)?.dataset.year).toBe('1965');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1965, core);

    ui.tick(2); // settle the morph
    expect(core.isTransitioning).toBe(false);
    expect(core.position).toBeCloseTo(yearToPosition(1965), 10);

    expect(pressKey(slider, 'ArrowLeft')).toBe(true);
    ui.tick(2);
    expect(core.selectedYear).toBe(1945);
    expect(core.position).toBeCloseTo(yearToPosition(1945), 10);
  });

  it('Home, End, Page Up, and Page Down jump across the stop list', () => {
    const { core, ui, slider } = setup();

    expect(pressKey(slider, 'End')).toBe(true);
    expect(core.selectedYear).toBe(2025);
    ui.tick(2);

    expect(pressKey(slider, 'PageDown')).toBe(true);
    expect(core.selectedYear).toBe(1985);
    ui.tick(2);

    expect(pressKey(slider, 'Home')).toBe(true);
    expect(core.selectedYear).toBe(1945);
    ui.tick(2);

    expect(pressKey(slider, 'PageUp')).toBe(true);
    expect(core.selectedYear).toBe(1985);
    ui.tick(2);

    expect(pressKey(slider, 'ArrowLeft')).toBe(true);
    expect(core.selectedYear).toBe(1965);
    ui.tick(2);

    expect(pressKey(slider, 'ArrowLeft')).toBe(true);
    expect(core.selectedYear).toBe(1945);
    ui.tick(2);

    // Arrows are clamped at both ends and still consume the event so the
    // scene's document-level orbit/walk handlers don't also react.
    const sceneHandler = vi.fn();
    document.addEventListener('keydown', sceneHandler);
    try {
      const atStart = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        bubbles: true,
        cancelable: true,
      });
      slider.dispatchEvent(atStart);
      expect(atStart.defaultPrevented).toBe(true);
      expect(core.selectedYear).toBe(1945);
      expect(sceneHandler).not.toHaveBeenCalled();

      // Unrelated keys keep default behavior and keep bubbling (they belong
      // to other controls, e.g. navigation's document-level shortcuts).
      expect(pressKey(slider, 'a')).toBe(false);
      expect(pressKey(slider, 'Tab')).toBe(false);
      expect(sceneHandler).toHaveBeenCalledTimes(2);
    } finally {
      document.removeEventListener('keydown', sceneHandler);
    }
  });

  it('clicking the track snaps to the nearest stop with an eased morph', () => {
    const onSelect = vi.fn();
    const { core, ui, slider } = setup({ onSelect });

    // 66% along the track lands at year 1997.8 → nearest stop 2005.
    fireMouse(slider, 'pointerdown', 0.66);
    expect(core.position).toBeCloseTo(0.66, 10);
    fireMouse(window, 'pointerup', 0.66);

    expect(core.selectedYear).toBe(2005);
    expect(core.isTransitioning).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(2005, core);

    ui.tick(2);
    expect(core.position).toBeCloseTo(yearToPosition(2005), 10);
    expect(ui.element.dataset.transitioning).toBe('false');
    expect(slider.getAttribute('aria-valuenow')).toBe('2005');
  });

  it('dragging follows the pointer continuously and snaps on release', () => {
    const { core, ui, slider } = setup();
    const bubble = required<HTMLElement>(ui.element, '[data-testid="year-bubble"]');

    fireMouse(slider, 'pointerdown', 0.1); // year 1953 → nearest 1945
    expect(core.position).toBeCloseTo(0.1, 10);
    expect(core.selectedYear).toBe(1945);
    expect(bubble.hidden).toBe(false);

    fireMouse(window, 'pointermove', 0.5); // exactly 1985
    expect(core.position).toBeCloseTo(0.5, 10);
    expect(core.selectedYear).toBe(1985);
    expect(activeStop(ui)?.dataset.year).toBe('1985');
    expect(bubble.textContent).toBe('1985');

    fireMouse(window, 'pointermove', 0.55); // year 1989 → still nearest 1985
    expect(core.position).toBeCloseTo(0.55, 10);
    expect(core.selectedYear).toBe(1985);

    fireMouse(window, 'pointerup', 0.55); // release → snap glide to 1985
    expect(core.isTransitioning).toBe(true);
    expect(bubble.hidden).toBe(true);

    ui.tick(2);
    expect(core.position).toBeCloseTo(yearToPosition(1985), 10);
    expect(core.selectedYear).toBe(1985);
    expect(
      required<HTMLElement>(ui.element, '[data-testid="era-playhead"]').style.left,
    ).toBe('50%');
  });

  it('touch input drives selection, snapping, and the HUD', () => {
    const onSelect = vi.fn();
    const { core, ui, slider } = setup({ onSelect });
    const bubble = required<HTMLElement>(ui.element, '[data-testid="year-bubble"]');

    fireTouch(slider, 'touchstart', 0.2); // year 1961 → nearest 1965
    expect(core.selectedYear).toBe(1965);
    expect(bubble.hidden).toBe(false);

    fireTouch(window, 'touchmove', 0.66); // year 1997.8 → nearest 2005
    expect(core.position).toBeCloseTo(0.66, 10);
    expect(core.selectedYear).toBe(2005);
    expect(activeStop(ui)?.dataset.year).toBe('2005');

    fireTouch(window, 'touchend', 0.66);
    expect(core.isTransitioning).toBe(true);
    expect(bubble.hidden).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(2005, core);

    ui.tick(2);
    expect(core.position).toBeCloseTo(yearToPosition(2005), 10);
    expect(ui.hud.element.querySelector('.era-hud__year')?.textContent).toBe('2005');
    expect(ui.hud.element.querySelector('.era-hud__name')?.textContent).toBe('Digital Dawn');
  });

  it('collapses pointer + mouse compatibility events into a single gesture', () => {
    // Real browsers fire pointerdown/mousedown for one press; the UI must
    // commit exactly once instead of double-handling.
    const onSelect = vi.fn();
    const { core, slider } = setup({ onSelect });

    fireMouse(slider, 'pointerdown', 0.66);
    fireMouse(slider, 'mousedown', 0.66);
    fireMouse(window, 'pointermove', 0.66);
    fireMouse(window, 'mousemove', 0.66);
    fireMouse(window, 'pointerup', 0.66);
    fireMouse(window, 'mouseup', 0.66);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(core.selectedYear).toBe(2005);
    expect(core.isTransitioning).toBe(true);
  });

  it('supports the mouse-only fallback path', () => {
    const onSelect = vi.fn();
    const { core, ui, slider } = setup({ onSelect });

    fireMouse(slider, 'mousedown', 0.5); // exactly the 1985 stop
    fireMouse(window, 'mousemove', 0.5);
    fireMouse(window, 'mouseup', 0.5);

    expect(core.selectedYear).toBe(1985);
    expect(core.position).toBeCloseTo(yearToPosition(1985), 10);
    // Clicking the already-active stop settles immediately (no morph needed).
    expect(core.isTransitioning).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(ui.element.dataset.transitioning).toBe('false');
  });

  it('notifies core subscribers on every UI-driven selection', () => {
    const { core, ui, slider } = setup();
    const listener = vi.fn();
    const unsubscribe = core.subscribe(listener);

    pressKey(slider, 'End');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].selectedYear).toBe(2025);
    expect(ui.core).toBe(core); // one shared core, no parallel UI state

    fireMouse(slider, 'pointerdown', 0);
    expect(listener.mock.calls.at(-1)?.[0].selectedYear).toBe(1945);
    fireMouse(window, 'pointerup', 0);
    unsubscribe();
    const callsAfterInput = listener.mock.calls.length;
    pressKey(slider, 'End');
    expect(listener.mock.calls.length).toBe(callsAfterInput);
  });

  it('selectYear() morphs through the same core for programmatic callers', () => {
    const { core, ui } = setup();

    expect(ui.selectYear(2025)).toBe(2025);
    expect(core.selectedYear).toBe(2025);
    expect(core.isTransitioning).toBe(true);
    ui.tick(2);
    expect(core.position).toBeCloseTo(1, 10);
    expect(core.isTransitioning).toBe(false);
  });
});

describe('era timeline UI — HUD and progress feedback', () => {
  it('shows the active year and era name in a polite live region', () => {
    const { ui, slider } = setup();

    const year = required<HTMLElement>(ui.element, '[data-testid="era-hud-year"]');
    const name = required<HTMLElement>(ui.element, '[data-testid="era-hud-name"]');
    const readout = required<HTMLElement>(ui.element, '.era-hud__readout');
    expect(year.textContent).toBe('1945');
    expect(name.textContent).toBe('Postwar Rebuild');
    expect(readout.getAttribute('aria-live')).toBe('polite');
    expect(ui.hud.element.getAttribute('role')).toBe('group');

    pressKey(slider, 'End');
    expect(year.textContent).toBe('2025');
    expect(name.textContent).toBe('Near Future');
    expect(ui.hud.element.getAttribute('aria-label')).toBe('Active era');
  });

  it('visualizes transition progress during morphs and clears on completion', () => {
    const { ui, slider } = setup();
    const progress = required<HTMLElement>(ui.element, '[data-testid="era-hud-progress"]');

    expect(progress.getAttribute('role')).toBe('progressbar');
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('100');
    expect(progress.hidden).toBe(true); // idle → no morph feedback
    expect(ui.element.dataset.transitioning).toBe('false');

    pressKey(slider, 'ArrowRight'); // 1.5s default morph 1945 → 1965
    expect(progress.hidden).toBe(false);
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(ui.element.dataset.transitioning).toBe('true');

    ui.tick(0.75); // half of the default morph → eased progress 50%
    expect(progress.getAttribute('aria-valuenow')).toBe('50');
    expect(
      required<HTMLElement>(ui.element, '.era-hud__progress-fill').style.transform,
    ).toBe('scaleX(0.5)');

    ui.tick(2);
    expect(progress.hidden).toBe(true);
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(ui.element.dataset.transitioning).toBe('false');
  });

  it('re-tints the era accent with the active stop', () => {
    const { ui, slider } = setup();

    expect(ui.element.style.getPropertyValue('--era-accent')).toBe('#e6b25e'); // 1945
    pressKey(slider, 'PageUp'); // → 1985
    expect(ui.element.style.getPropertyValue('--era-accent')).toBe('#ff5ea8');
    pressKey(slider, 'End');
    expect(ui.element.style.getPropertyValue('--era-accent')).toBe('#a084ff'); // 2025
  });
});

describe('era timeline UI — control cluster', () => {
  it('offers a mute toggle with proper pressed semantics', () => {
    const onMuteChange = vi.fn();
    const { ui } = setup({ onMuteChange });
    const mute = ui.controls.muteButton;

    expect(mute.getAttribute('aria-pressed')).toBe('false');
    expect(mute.getAttribute('aria-label')).toBe('Mute sound');
    expect(mute.classList.contains('is-muted')).toBe(false);

    mute.click();
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(mute.getAttribute('aria-label')).toBe('Unmute sound');
    expect(ui.controls.isMuted).toBe(true);
    expect(onMuteChange).toHaveBeenCalledWith(true);

    mute.click();
    expect(mute.getAttribute('aria-pressed')).toBe('false');
    expect(onMuteChange).toHaveBeenLastCalledWith(false);
    expect(onMuteChange).toHaveBeenCalledTimes(2);
  });

  it('offers a help toggle that reveals control hints and closes with Escape', () => {
    const { ui } = setup();
    const { helpButton, hints } = ui.controls;

    expect(hints.hidden).toBe(true);
    expect(helpButton.getAttribute('aria-expanded')).toBe('false');
    expect(helpButton.getAttribute('aria-controls')).toBe(hints.id);

    helpButton.click();
    expect(hints.hidden).toBe(false);
    expect(helpButton.getAttribute('aria-expanded')).toBe('true');
    expect(ui.controls.isHelpOpen).toBe(true);
    const hintText = hints.textContent ?? '';
    expect(hintText).toContain('Arrow keys');
    expect(hintText).toContain('Home');
    expect(hintText).toContain('End');
    expect(hintText).toContain('1945');

    helpButton.focus();
    helpButton.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(hints.hidden).toBe(true);
    expect(helpButton.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(helpButton);
  });

  it('keeps keyboard focus order: slider, then mute, then help', () => {
    const { ui } = setup();

    const tabbables = Array.from(
      ui.panel.querySelectorAll<HTMLElement>('button, [tabindex="0"]'),
    );
    expect(tabbables.map((element) => element.getAttribute('data-testid'))).toEqual([
      'era-slider',
      'mute-toggle',
      'help-toggle',
    ]);
    // Tick labels and the playhead are never extra tab stops.
    expect(ui.panel.querySelectorAll('.era-slider__label[tabindex]')).toHaveLength(0);
  });
});

describe('era timeline UI — lifecycle', () => {
  it('dispose detaches the UI and stops it driving the core', () => {
    const { core, ui, slider, host } = setup();

    ui.dispose();
    expect(host.contains(ui.element)).toBe(false);
    expect(host.classList.contains('timeline-slot--era')).toBe(false);

    pressKey(slider, 'ArrowRight');
    fireMouse(slider, 'pointerdown', 0.9);
    fireMouse(window, 'pointerup', 0.9);
    expect(core.selectedYear).toBe(1945);
    expect(core.position).toBe(0);
  });

  it('maps every era stop to its documented HUD copy, nearest-stop resolved', () => {
    setup();

    for (const [year, name] of ERA_COPY) {
      expect(ERA_NAMES[year as (typeof ERA_YEARS)[number]]).toBe(name);
      expect(eraNameForYear(year)).toBe(name);
    }
    // Out-of-stop input resolves to the nearest era's copy.
    expect(eraNameForYear(1946)).toBe('Postwar Rebuild');
    expect(eraNameForYear(2014)).toBe('Digital Dawn');
    expect(eraNameForYear(2016)).toBe('Near Future');
    expect(eraNameForYear(2035)).toBe('Near Future');
  });
});
