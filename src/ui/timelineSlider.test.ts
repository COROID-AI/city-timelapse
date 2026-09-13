// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EraStore } from '../era/state';
import { ERA_YEARS, type EraId } from '../era/types';
import {
  createTimelineSlider,
  type TimelineSlider,
  type TimelineSliderAudio,
} from './timelineSlider';

const EXPECTED_STOP_LABELS = ['1945', '1965', '1985', '2005', '2025'];

/** Stub audio surface implementing TimelineSliderAudio with observable mute state. */
class StubAudio implements TimelineSliderAudio {
  muted = false;
  clicks = 0;

  isMuted(): boolean {
    return this.muted;
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  playClick(): unknown {
    this.clicks += 1;
    return null;
  }
}

interface Mounted {
  slider: TimelineSlider;
  container: HTMLElement;
  store: EraStore;
  audio: StubAudio;
  onSelect: ReturnType<typeof vi.fn>;
}

function mount(initialEra?: EraId): Mounted {
  const container = document.createElement('div');
  document.body.append(container);
  const store = new EraStore(initialEra ? { initialEra } : {});
  const audio = new StubAudio();
  const onSelect = vi.fn();
  const slider = createTimelineSlider({ container, store, audio, onSelect });
  return { slider, container, store, audio, onSelect };
}

function stopByYear(slider: TimelineSlider, year: number): HTMLElement | null {
  const yearKey = String(year);
  for (const stop of Array.from(slider.element.querySelectorAll<HTMLElement>('[data-hud-stop]'))) {
    if (stop.getAttribute('data-year') === yearKey) {
      return stop;
    }
  }
  return null;
}

function stopsOf(slider: TimelineSlider): HTMLElement[] {
  return Array.from(slider.element.querySelectorAll<HTMLElement>('[data-hud-stop]'));
}

function readoutText(slider: TimelineSlider): string {
  const year = slider.element.querySelector('[data-hud-readout-year]');
  return year?.textContent ?? '';
}

function isCurrent(stop: HTMLElement): boolean {
  return stop.classList.contains('is-current') && stop.getAttribute('aria-current') === 'true';
}

/** jsdom does not set `key` on KeyboardEvent from its init dict — inject it. */
function keydown(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'key', { configurable: true, value: key });
  return event;
}

function pointerEvent(type: string, x: number): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: 20,
    button: 0,
  });
  return event as PointerEvent;
}

/** Fake track geometry: 400px wide rail, stops at x = 0, 100, 200, 300, 400. */
const TRACK_RECT: DOMRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 400,
  bottom: 40,
  width: 400,
  height: 40,
} as DOMRect;

afterEach(() => {
  document.body.replaceChildren();
});

describe('createTimelineSlider', () => {
  it('renders exactly the five ERA_YEARS stops — no 2055 — and mounts a top bar', () => {
    const m = mount();

    const stops = stopsOf(m.slider);
    expect(stops).toHaveLength(5);
    expect(stops.map((s) => s.getAttribute('data-year'))).toEqual(EXPECTED_STOP_LABELS);
    expect(m.slider.years).toEqual([...ERA_YEARS]);
    expect(m.slider.element.textContent).not.toContain('2055');

    // Top-bar mount: fixed-position HUD root inside the provided container.
    expect(m.slider.element.parentElement).toBe(m.container);
    expect(m.slider.element.classList.contains('hud-root')).toBe(true);
    expect(m.slider.element.getAttribute('data-hud')).toBe('timeline');
    expect(m.container.querySelector('[data-hud-bar]')).not.toBeNull();
  });

  it('exposes a focusable ARIA slider with labeled, keyboard-reachable stops', () => {
    const m = mount();
    const track = m.container.querySelector('[data-hud-track]') as HTMLElement;

    expect(track.getAttribute('role')).toBe('slider');
    expect(track.tabIndex).toBe(0);
    expect(track.getAttribute('aria-valuemin')).toBe('1945');
    expect(track.getAttribute('aria-valuemax')).toBe('2025');
    expect(track.getAttribute('aria-orientation')).toBe('horizontal');

    const firstStop = stopByYear(m.slider, 1945);
    expect(firstStop).not.toBeNull();
    expect(firstStop?.getAttribute('aria-label')).toBe('Select era 1945');
  });

  it('clicking a stop selects it, updates the readout and fires onSelect once', () => {
    const m = mount();
    const stop1985 = stopByYear(m.slider, 1985);
    expect(stop1985).not.toBeNull();
    expect(m.store.current).toBe(1945);

    stop1985!.click();

    expect(m.store.current).toBe(1985);
    expect(readoutText(m.slider)).toBe('1985');
    expect(isCurrent(stop1985!)).toBe(true);
    expect(isCurrent(stopByYear(m.slider, 1945)!)).toBe(false);
    expect(m.onSelect).toHaveBeenCalledTimes(1);
    expect(m.onSelect).toHaveBeenCalledWith(1985);

    // Clicking the current stop again is an idempotent no-op: no new publish.
    stop1985!.click();
    expect(m.onSelect).toHaveBeenCalledTimes(1);
    expect(m.store.current).toBe(1985);
  });

  it('pointer drag snaps to the nearest of the five years as it moves', () => {
    const m = mount();
    const track = m.container.querySelector('[data-hud-track]') as HTMLElement;
    track.getBoundingClientRect = () => TRACK_RECT;

    track.dispatchEvent(pointerEvent('pointerdown', 300)); // => 2005
    expect(m.store.current).toBe(2005);

    window.dispatchEvent(pointerEvent('pointermove', 100)); // => 1965
    expect(m.store.current).toBe(1965);

    window.dispatchEvent(pointerEvent('pointermove', 400)); // => 2025
    expect(m.store.current).toBe(2025);

    window.dispatchEvent(pointerEvent('pointerup', 400));
    expect(m.store.current).toBe(2025);
    expect(readoutText(m.slider)).toBe('2025');

    // One publish per genuine stop change during the drag, never a repeat.
    expect(m.onSelect.mock.calls.map((call) => call[0])).toEqual([2005, 1965, 2025]);
  });

  it('clicking the rail snaps to the nearest stop without a drag', () => {
    const m = mount();
    const track = m.container.querySelector('[data-hud-track]') as HTMLElement;
    track.getBoundingClientRect = () => TRACK_RECT;

    track.dispatchEvent(pointerEvent('pointerdown', 210)); // 0.525 * 4 => index 2
    window.dispatchEvent(pointerEvent('pointerup', 210));

    expect(m.store.current).toBe(1985);
    expect(m.onSelect).toHaveBeenCalledTimes(1);
    expect(m.onSelect).toHaveBeenCalledWith(1985);
  });

  it('ArrowLeft/ArrowRight move between adjacent years and Home/End jump to first/last', () => {
    const m = mount();
    const track = m.container.querySelector('[data-hud-track]') as HTMLElement;
    track.focus();

    track.dispatchEvent(keydown('ArrowRight'));
    expect(m.store.current).toBe(1965);
    track.dispatchEvent(keydown('ArrowRight'));
    expect(m.store.current).toBe(1985);
    track.dispatchEvent(keydown('ArrowLeft'));
    expect(m.store.current).toBe(1965);
    track.dispatchEvent(keydown('Home'));
    expect(m.store.current).toBe(1945);
    track.dispatchEvent(keydown('End'));
    expect(m.store.current).toBe(2025);

    expect(m.onSelect.mock.calls.map((call) => call[0])).toEqual([1965, 1985, 1965, 1945, 2025]);

    // Visible focus follows the selection (focus ring on the current stop).
    expect(document.activeElement).toBe(stopByYear(m.slider, 2025));
  });

  it('arrow keys work from a focused stop button without double-stepping', () => {
    const m = mount();
    const stop1945 = stopByYear(m.slider, 1945);
    expect(stop1945).not.toBeNull();
    stop1945!.focus();

    stop1945!.dispatchEvent(keydown('ArrowRight'));
    expect(m.store.current).toBe(1965);
    expect(document.activeElement).toBe(stopByYear(m.slider, 1965));

    const stop1965 = stopByYear(m.slider, 1965);
    expect(stop1965).not.toBeNull();
    stop1965!.dispatchEvent(keydown('ArrowRight'));
    expect(m.store.current).toBe(1985);
  });

  it('is bounded at the first and last stop', () => {
    const m = mount(1945);
    const track = m.container.querySelector('[data-hud-track]') as HTMLElement;
    track.focus();

    track.dispatchEvent(keydown('ArrowLeft'));
    expect(m.store.current).toBe(1945);

    const mEnd = mount(2025);
    const trackEnd = mEnd.container.querySelector('[data-hud-track]') as HTMLElement;
    trackEnd.focus();
    trackEnd.dispatchEvent(keydown('ArrowRight'));
    expect(mEnd.store.current).toBe(2025);
  });

  it('store changes drive the highlight, readout and transition progress indicator', () => {
    const m = mount();
    m.store.requestEra(2025);

    expect(readoutText(m.slider)).toBe('2025');
    expect(isCurrent(stopByYear(m.slider, 2025)!)).toBe(true);
    expect(isCurrent(stopByYear(m.slider, 1945)!)).toBe(false);
    expect(m.slider.isTransitioning).toBe(true);
    expect(m.slider.transitionProgress).toBe(0);

    const status = m.container.querySelector('[data-hud-transition-status]') as HTMLElement;
    expect(status.hasAttribute('hidden')).toBe(false);
    expect(status.textContent).toContain('1945');
    expect(status.textContent).toContain('2025');
    expect(status.textContent).toContain('0%');

    m.store.setTransitionProgress(0.5);
    expect(m.slider.transitionProgress).toBe(0.5);
    expect(status.textContent).toContain('50%');

    const fill = m.container.querySelector('[data-hud-progress]') as HTMLElement;
    expect(fill.style.width).toBe('50%');

    const thumb = m.container.querySelector('[data-hud-thumb]') as HTMLElement;
    expect(thumb.style.left).toBe('100%');

    m.store.setTransitionProgress(1);
    expect(m.slider.isTransitioning).toBe(false);
    expect(m.slider.transitionProgress).toBe(0);
    expect(status.hasAttribute('hidden')).toBe(true);
    expect(fill.style.width).toBe('0%');
  });

  it('help overlay toggles via its button and the ? key, dismissed by Escape and the close button', () => {
    const m = mount();
    const helpButton = m.container.querySelector('[data-hud-help]') as HTMLButtonElement;
    const overlay = m.container.querySelector('[data-hud-help-overlay]') as HTMLElement;

    expect(m.slider.helpVisible).toBe(false);
    expect(helpButton.getAttribute('aria-expanded')).toBe('false');
    expect(overlay.hasAttribute('hidden')).toBe(true);

    helpButton.click();
    expect(m.slider.helpVisible).toBe(true);
    expect(helpButton.getAttribute('aria-expanded')).toBe('true');
    expect(overlay.hasAttribute('hidden')).toBe(false);

    window.dispatchEvent(keydown('?'));
    expect(m.slider.helpVisible).toBe(false);
    expect(overlay.hasAttribute('hidden')).toBe(true);

    window.dispatchEvent(keydown('?'));
    expect(m.slider.helpVisible).toBe(true);

    window.dispatchEvent(keydown('Escape'));
    expect(m.slider.helpVisible).toBe(false);

    helpButton.click();
    const closeButton = m.container.querySelector('[data-hud-help-close]') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();
    closeButton.click();
    expect(m.slider.helpVisible).toBe(false);

    // Escape with the overlay closed must not throw or swallow focus behavior.
    window.dispatchEvent(keydown('Escape'));
    expect(m.slider.helpVisible).toBe(false);
  });

  it('mute toggle routes through the audio engine and reflects state on a real button', () => {
    const m = mount();
    const muteButton = m.container.querySelector('[data-hud-mute]') as HTMLButtonElement;

    // A native button: keyboard-operable (Enter/Space activation) in browsers.
    expect(muteButton).toBeInstanceOf(HTMLButtonElement);
    expect(m.slider.muted).toBe(false);
    expect(muteButton.getAttribute('aria-pressed')).toBe('false');
    expect(muteButton.getAttribute('aria-label')).toBe('Mute sound');

    muteButton.click();
    expect(m.audio.muted).toBe(true);
    expect(m.slider.muted).toBe(true);
    expect(muteButton.getAttribute('aria-pressed')).toBe('true');
    expect(muteButton.getAttribute('data-muted')).toBe('true');
    expect(muteButton.getAttribute('aria-label')).toBe('Unmute sound');

    muteButton.click();
    expect(m.audio.muted).toBe(false);
    expect(m.slider.muted).toBe(false);
    expect(muteButton.getAttribute('aria-pressed')).toBe('false');
    expect(muteButton.getAttribute('data-muted')).toBe('false');
  });

  it('selectEra publishes through the store and click feedback hooks the audio surface', () => {
    const m = mount();
    expect(m.slider.selectEra(1945)).toBe(false);
    expect(m.store.current).toBe(1945);
    expect(m.onSelect).not.toHaveBeenCalled();
    expect(m.audio.clicks).toBe(0);

    expect(m.slider.selectEra(2005)).toBe(true);
    expect(m.store.current).toBe(2005);
    expect(m.onSelect).toHaveBeenCalledTimes(1);
    expect(m.onSelect).toHaveBeenCalledWith(2005);
    expect(m.audio.clicks).toBe(1);
  });

  it('setHelpVisible opens and closes the overlay programmatically', () => {
    const m = mount();
    m.slider.setHelpVisible(true);
    expect(m.slider.helpVisible).toBe(true);
    m.slider.setHelpVisible(true); // idempotent
    expect(m.slider.helpVisible).toBe(true);
    m.slider.setHelpVisible(false);
    expect(m.slider.helpVisible).toBe(false);
  });

  it('dispose detaches the HUD, unsubscribes from the store and is idempotent', () => {
    const m = mount();
    const element = m.slider.element;

    m.slider.dispose();
    m.slider.dispose();
    expect(element.isConnected).toBe(false);

    // Selection after disposal must not publish or mutate the store.
    expect(m.slider.selectEra(1965)).toBe(false);
    expect(m.store.current).toBe(1945);
    expect(m.onSelect).not.toHaveBeenCalled();

    // The store listener was removed: later store changes do not touch the HUD.
    m.store.requestEra(1965);
    expect(m.onSelect).not.toHaveBeenCalled();
  });
});