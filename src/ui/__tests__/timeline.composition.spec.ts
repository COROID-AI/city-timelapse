// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import type { EraContent, EraId } from '../../types';
import { EraRegistry } from '../../eras/registry';
import { createTimeline } from '../timeline';
import { createOverlay } from '../overlay';
import { ERA_SUBTITLES } from '../subtitles';

/**
 * Composition test — wires the timeline, overlay, and a stubbed era registry
 * together the way the integration will. Verifies the five stops drive era
 * selection, arrow keys walk stops, drag snaps, the progress bar reflects the
 * selection, and the overlay shows/hides through its API.
 */

const STOPS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

/** jsdom lacks PointerEvent; provide a minimal polyfill used by the drag tests. */
function installPointerSupport(): void {
  if (typeof (globalThis as Record<string, unknown>).PointerEvent === 'undefined') {
    (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    };
  }
  const proto = Element.prototype as unknown as {
    setPointerCapture?: (id: number) => void;
    releasePointerCapture?: (id: number) => void;
    hasPointerCapture?: (id: number) => boolean;
  };
  if (!proto.setPointerCapture) proto.setPointerCapture = () => undefined;
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => undefined;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
}

const makeStub = (): EraContent => ({
  build: () => undefined,
  update: () => undefined,
  dispose: () => undefined,
  interactivePoints: [],
  isFastPath: false,
});

/** A minimal controller that mirrors how main-integration will drive the scene. */
class Player {
  readonly registry = new EraRegistry();
  current: EraId | null = null;
  readonly transitionLog: string[] = [];

  constructor() {
    for (const era of STOPS) this.registry.registerEra(era, makeStub());
  }

  /** Called by the timeline on selection. Returns the composed era info. */
  onSelect(era: EraId, index: number): void {
    this.current = era;
    const info = this.registry.eraCompositionInfo().find((e) => e.era === era);
    if (!info) throw new Error(`Era ${era} missing from registry`);
    this.transitionLog.push(`select:${era}:${index}:${info.isFastPath === false ? 'composed' : 'composed'}`);
  }
}

function mount(): {
  container: HTMLElement;
  player: Player;
  timeline: ReturnType<typeof createTimeline>;
  overlay: ReturnType<typeof createOverlay>;
  overlayHost: HTMLElement;
} {
  installPointerSupport();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const overlayHost = document.createElement('div');
  document.body.appendChild(overlayHost);

  const player = new Player();
  const timeline = createTimeline(container, { onSelect: (era, index) => player.onSelect(era, index) });
  const overlay = createOverlay(overlayHost, { durationMs: 60 });
  return { container, player, timeline, overlay, overlayHost };
}

describe('timeline + registry + overlay composition', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders exactly five stops in order from the shared era list', () => {
    const { container } = mount();
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    expect(stops.map((s) => s.textContent)).toEqual(STOPS);
    expect(stops.map((s) => s.dataset.era)).toEqual(STOPS);
  });

  it('clicking each of the five stops selects its era in the registry', () => {
    const { container, player } = mount();
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    // The slider starts at 1945, so click the other four in order, then 1945 last.
    const clickOrder = [1, 2, 3, 4, 0];
    for (const i of clickOrder) {
      stops[i].click();
      expect(player.current).toBe(stops[i].dataset.era as EraId);
    }
    // Each distinct era was selected.
    expect(new Set(player.transitionLog.map((l) => l.split(':')[1]))).toEqual(new Set(STOPS));
  });

  it('arrow keys walk stops 1945 -> 2025 and back', () => {
    const { container, player } = mount();
    const track = container.querySelector<HTMLElement>('.timeline-track')!;
    const press = (key: string) => track.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

    for (let i = 0; i < 4; i++) press('ArrowRight');
    expect(player.current).toBe('2025');

    for (let i = 0; i < 4; i++) press('ArrowLeft');
    expect(player.current).toBe('1945');
  });

  it('dragging snaps the thumb to the nearest stop', () => {
    const { container, player } = mount();
    const track = container.querySelector<HTMLElement>('.timeline-track')!;
    track.getBoundingClientRect = () =>
      ({ left: 0, width: 400, right: 400, top: 0, bottom: 0, height: 28, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    const pid = 5;
    track.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, pointerId: pid, bubbles: true }));
    // 300/400 => 0.75 => round(0.75*4)=3 => 2005
    expect(player.current).toBe('2005');

    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 50, pointerId: pid, bubbles: true }));
    // 50/400 => 0.125 => round(0.5)=1 => 1965
    expect(player.current).toBe('1965');
  });

  it('progress bar reflects the selected stop', () => {
    const { container } = mount();
    const progress = container.querySelector<HTMLElement>('.timeline-progress')!;
    const stops = Array.from(container.querySelectorAll<HTMLElement>('.timeline-stop'));
    stops[4].click();
    expect(progress.style.width).toBe('100%');
    stops[1].click();
    expect(progress.style.width).toBe('25%');
  });

  it('overlay shows a label+subtitle and hides on completion', async () => {
    const { overlay } = mount();
    overlay.showTransition('1985');
    const root = overlayHostOf(overlay);
    expect(root.hidden).toBe(false);
    expect(root.querySelector('.overlay-year')?.textContent).toBe('1985');
    const sub = ERA_SUBTITLES.find((s) => s.era === '1985');
    expect(root.querySelector('.overlay-subtitle')?.textContent).toBe(sub?.text);

    await new Promise((r) => setTimeout(r, 120));
    expect(root.hidden).toBe(true);
  });

  it('overlay hide() hides immediately and onUnlock fires on completion', async () => {
    const { overlay } = mount();
    let unlocked = 0;
    overlay.onUnlock(() => unlocked++);

    overlay.showTransition('2025');
    const root = overlayHostOf(overlay);
    expect(root.hidden).toBe(false);

    // Immediate hide via API.
    overlay.hide();
    expect(root.hidden).toBe(true);

    // A fresh transition unlocks after its duration.
    overlay.showTransition('2005');
    await new Promise((r) => setTimeout(r, 120));
    expect(root.hidden).toBe(true);
    expect(unlocked).toBe(1);
  });
});

function overlayHostOf(overlay: ReturnType<typeof createOverlay>): HTMLElement {
  const root = document.body.querySelector<HTMLElement>('.overlay');
  if (!root) throw new Error('overlay root not found');
  void overlay;
  return root;
}