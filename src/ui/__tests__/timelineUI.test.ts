import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTimelineController } from '../../state/timelineStore';
import {
  eraDescriptors,
  formatEraChannelDescriptor,
  getEraDescriptor,
} from '../eraDescriptors';
import { createHud } from '../hud';
import { createStartOverlay } from '../startOverlay';
import {
  createTimelineUI,
  eraToProgress,
  progressToNearestEra,
} from '../timelineUI';

describe('eraDescriptors', () => {
  it('contains descriptors for all 5 eras', () => {
    expect(eraDescriptors['1945']).toContain('1945');
    expect(eraDescriptors['1965']).toContain('1965');
    expect(eraDescriptors['1985']).toContain('1985');
    expect(eraDescriptors['2005']).toContain('2005');
    expect(eraDescriptors['2025']).toContain('2025');
  });

  it('getEraDescriptor returns correct descriptor or fallback', () => {
    expect(getEraDescriptor('1985')).toBe(eraDescriptors['1985']);
    // @ts-expect-error fallback test
    expect(getEraDescriptor('1900')).toContain('1900');
  });

  it('formatEraChannelDescriptor handles static and transition states', () => {
    const staticChannel = { fromEra: '1945' as const, toEra: '1945' as const, t: 0 };
    expect(formatEraChannelDescriptor(staticChannel, '1945')).toBe(eraDescriptors['1945']);

    const transitionChannel = { fromEra: '1945' as const, toEra: '1965' as const, t: 0.5 };
    expect(formatEraChannelDescriptor(transitionChannel, '1965')).toBe('Transitioning: 1945 → 1965 (50%)');
  });
});

describe('Mapping utilities', () => {
  it('eraToProgress maps all 5 eras accurately', () => {
    expect(eraToProgress('1945')).toBe(0.0);
    expect(eraToProgress('1965')).toBe(0.25);
    expect(eraToProgress('1985')).toBe(0.5);
    expect(eraToProgress('2005')).toBe(0.75);
    expect(eraToProgress('2025')).toBe(1.0);
  });

  it('progressToNearestEra converts continuous progress to nearest era', () => {
    expect(progressToNearestEra(0.0)).toBe('1945');
    expect(progressToNearestEra(0.12)).toBe('1945');
    expect(progressToNearestEra(0.13)).toBe('1965');
    expect(progressToNearestEra(0.25)).toBe('1965');
    expect(progressToNearestEra(0.38)).toBe('1985');
    expect(progressToNearestEra(0.5)).toBe('1985');
    expect(progressToNearestEra(0.63)).toBe('2005');
    expect(progressToNearestEra(0.75)).toBe('2005');
    expect(progressToNearestEra(0.88)).toBe('2025');
    expect(progressToNearestEra(1.0)).toBe('2025');
  });
});

describe('createStartOverlay', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('renders start overlay with Enter the scene button and triggers onStart', () => {
    const onStart = vi.fn();
    const overlay = createStartOverlay(root, { onStart });

    expect(overlay.isVisible()).toBe(true);
    expect(overlay.element.getAttribute('role')).toBe('dialog');
    expect(overlay.button.textContent).toContain('Enter the scene');

    overlay.button.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(overlay.element.classList.contains('fade-out')).toBe(true);
    overlay.dispose();
  });

  it('dismiss() programmatically triggers onStart and fades out', () => {
    const onStart = vi.fn();
    const overlay = createStartOverlay(root, { onStart });

    overlay.dismiss();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(overlay.element.classList.contains('fade-out')).toBe(true);
    overlay.dispose();
  });
});

describe('createHud', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('renders era descriptor, POI chips, navigation hints, and mute control', () => {
    const onSelectPoi = vi.fn();
    const onToggleMute = vi.fn();
    const hud = createHud(root, { onSelectPoi, onToggleMute });

    expect(hud.descriptorElement.textContent).toBe(eraDescriptors['1945']);

    // Check POI chips
    const cornerBtn = hud.poiButtons.get('corner');
    const midblockBtn = hud.poiButtons.get('midblock');
    const rooftopBtn = hud.poiButtons.get('rooftop');

    expect(cornerBtn).toBeDefined();
    expect(midblockBtn).toBeDefined();
    expect(rooftopBtn).toBeDefined();
    expect(cornerBtn?.classList.contains('is-active')).toBe(true);

    midblockBtn?.click();
    expect(onSelectPoi).toHaveBeenCalledWith('midblock');
    expect(midblockBtn?.classList.contains('is-active')).toBe(true);
    expect(cornerBtn?.classList.contains('is-active')).toBe(false);

    // Check Mute button
    expect(hud.muteButton.getAttribute('aria-pressed')).toBe('false');
    hud.muteButton.click();
    expect(onToggleMute).toHaveBeenCalledWith(true);
    expect(hud.muteButton.getAttribute('aria-pressed')).toBe('true');
    expect(hud.muteButton.textContent).toContain('Muted');

    hud.muteButton.click();
    expect(onToggleMute).toHaveBeenCalledWith(false);
    expect(hud.muteButton.getAttribute('aria-pressed')).toBe('false');
    expect(hud.muteButton.textContent).toContain('Audio ON');

    hud.dispose();
  });
});

describe('createTimelineUI', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('validates input parameters', () => {
    const controller = createTimelineController();
    // @ts-expect-error test invalid root
    expect(() => createTimelineUI(null, controller)).toThrow(/HTMLElement/);
    // @ts-expect-error test invalid controller
    expect(() => createTimelineUI(root, null)).toThrow(/TimelineController/);
    controller.dispose();
  });

  it('renders top slider with 5 labeled stops and ARIA slider attributes', () => {
    const controller = createTimelineController();
    const ui = createTimelineUI(root, controller);

    expect(ui.sliderElement).toBeDefined();
    expect(ui.sliderElement.getAttribute('data-testid')).toBe('timeline-top');

    // Check ARIA attributes on thumb
    expect(ui.thumbElement.getAttribute('role')).toBe('slider');
    expect(ui.thumbElement.getAttribute('aria-label')).toBe('Timeline Era');
    expect(ui.thumbElement.getAttribute('aria-valuemin')).toBe('1945');
    expect(ui.thumbElement.getAttribute('aria-valuemax')).toBe('2025');
    expect(ui.thumbElement.getAttribute('aria-valuenow')).toBe('1945');
    expect(ui.thumbElement.getAttribute('aria-valuetext')).toBe(eraDescriptors['1945']);

    // Check labeled stops
    const stopButtons = ui.sliderElement.querySelectorAll<HTMLButtonElement>('.timeline-stop');
    expect(stopButtons.length).toBe(5);
    expect(stopButtons[0].textContent).toBe('1945');
    expect(stopButtons[1].textContent).toBe('1965');
    expect(stopButtons[2].textContent).toBe('1985');
    expect(stopButtons[3].textContent).toBe('2005');
    expect(stopButtons[4].textContent).toBe('2025');

    // 1945 is active initially
    expect(stopButtons[0].classList.contains('is-active')).toBe(true);
    expect(stopButtons[0].getAttribute('aria-current')).toBe('step');

    ui.dispose();
    controller.dispose();
  });

  it('handles keyboard navigation on slider thumb', () => {
    const controller = createTimelineController();
    const onYearRequested = vi.fn();
    const ui = createTimelineUI(root, controller, { onYearRequested });

    // ArrowRight step (+1) -> 1965
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1965');
    expect(onYearRequested).toHaveBeenCalledWith('1965');
    expect(ui.thumbElement.getAttribute('aria-valuenow')).toBe('1965');

    // Number key '4' -> 2005
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
    expect(controller.getState().currentEra).toBe('2005');
    expect(onYearRequested).toHaveBeenCalledWith('2005');

    // ArrowLeft step (-1) -> 1985
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1985');

    // Home -> 1945
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(controller.getState().currentEra).toBe('1945');

    // End -> 2025
    ui.thumbElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(controller.getState().currentEra).toBe('2025');

    ui.dispose();
    controller.dispose();
  });

  it('handles global window number keys 1-5', () => {
    const controller = createTimelineController();
    const onYearRequested = vi.fn();
    const ui = createTimelineUI(root, controller, { onYearRequested });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(controller.getState().currentEra).toBe('1985');
    expect(onYearRequested).toHaveBeenCalledWith('1985');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(controller.getState().currentEra).toBe('1945');

    ui.dispose();
    controller.dispose();
  });

  it('toggles transition shimmer state', () => {
    const controller = createTimelineController();
    const ui = createTimelineUI(root, controller);

    expect(ui.sliderElement.classList.contains('is-transitioning')).toBe(false);

    controller.setYear('1985');
    expect(controller.getState().isTransitioning).toBe(true);
    expect(ui.sliderElement.classList.contains('is-transitioning')).toBe(true);

    controller.update(1.5);
    expect(controller.getState().isTransitioning).toBe(false);
    expect(ui.sliderElement.classList.contains('is-transitioning')).toBe(false);

    ui.dispose();
    controller.dispose();
  });

  it('supports attach, update, setMuted, setActivePoi and dispose lifecycle methods', () => {
    const controller = createTimelineController();
    const ui = createTimelineUI(root, controller);

    ui.setMuted(true);
    expect(ui.hud.muteButton.getAttribute('aria-pressed')).toBe('true');

    ui.setActivePoi('rooftop');
    expect(ui.hud.poiButtons.get('rooftop')?.classList.contains('is-active')).toBe(true);

    ui.update();
    expect(ui.thumbElement.getAttribute('aria-valuenow')).toBe('1945');

    ui.dispose();
    expect(root.children.length).toBe(0);
    controller.dispose();
  });
});
