/**
 * Fixed-top era timeline slider — the control heart of the experience.
 *
 * Renders the five era stops (1945, 1965, 1985, 2005, 2025) on a styled
 * track with tick labels, a draggable playhead, the active-era HUD, and a
 * minimal sound/help cluster. All input (drag, click, arrow keys, Home/End,
 * Page Up/Down, and touch) drives era selection **exclusively through the
 * shared `EraTimelineCore`** — this module keeps no parallel selection state
 * and never touches scene objects. Scene morphing is the era-timeline-core /
 * morph-driver concern; the UI only selects years and visualizes the frames
 * the core produces.
 *
 * Input model:
 * - Pointer/touch/mouse gestures are unified behind a single "first family
 *   wins" gesture state machine, so browsers that fire both Pointer Events
 *   and compatibility Mouse/Touch events still produce exactly one gesture.
 * - Dragging moves the playhead continuously (nearest tick highlighted);
 *   releasing, clicking, or tapping snaps the core to the nearest stop with
 *   the core's eased `transitionTo`, which is what the HUD visualizes.
 * - Keyboard steps the stop list with full ARIA slider semantics
 *   (`aria-valuemin/max/now/text`, visible `:focus-visible` focus).
 *
 * Accessibility/layout contract: the root passes pointer events through so
 * orbit/walk input reaches the scene outside the bar; only the inner panel
 * opts back in as the interactive surface.
 *
 * Frame pump: with the default `autoAdvance`, an internal rAF loop calls
 * `tick` (core.advance + repaint) every frame. Apps that own a frame pump
 * should pass `autoAdvance: false` and either call `ui.tick(deltaSeconds)`
 * from that pump or advance the core elsewhere and call `ui.refresh()` —
 * exactly one component should advance the core.
 */

import './timeline.css';

import { ERA_YEARS, clamp01, EraTimelineCore, type EraYear } from '../era/timeline';
import { createControlCluster, type ControlCluster } from './controls';
import { createEraHUD, eraAccentForYear, eraNameForYear, type EraHUD } from './hud';

/** Longest frame the UI will integrate; guards tab-switch delta spikes. */
const MAX_FRAME_SECONDS = 0.1;

/** Slot marker class: neutralizes the shell's placeholder slot styling. */
const SLOT_MOUNTED_CLASS = 'timeline-slot--era';

/** Class/data markers used by styling and tests. */
const ROOT_TESTID = 'timeline-ui';
const SLIDER_TESTID = 'era-slider';
const TRACK_TESTID = 'era-slider-track';
const PLAYHEAD_TESTID = 'era-playhead';
const BUBBLE_TESTID = 'year-bubble';

export interface TimelineUIOptions {
  /**
   * Mount target. When the target (or a child of it) is the shell's reserved
   * `[data-timeline-slot]`, the UI replaces that slot's placeholder content;
   * otherwise it appends directly to the container. Defaults to the document's
   * timeline slot, falling back to `document.body`.
   */
  container?: HTMLElement;
  /**
   * Shared era timeline core this UI drives. Every input mutates this core —
   * there is no parallel selection state. Defaults to a fresh core exposed as
   * `TimelineUI.core` so the app can share it with scene morphing.
   */
  core?: EraTimelineCore;
  /**
   * Run the internal frame loop that calls `tick` (advancing the core and
   * repainting) every animation frame. Set `false` when the app owns a frame
   * pump: call `ui.tick(deltaSeconds)` from it, or advance the core elsewhere
   * and call `ui.refresh()` each frame. Defaults to `true`.
   */
  autoAdvance?: boolean;
  /** Called after the user confirms a year via pointer, touch, or keyboard. */
  onSelect?: (year: EraYear, core: EraTimelineCore) => void;
  /** Mute state changes from the control cluster (hook for the audio system). */
  onMuteChange?: (muted: boolean) => void;
  /** Document used for element creation; defaults to the container's document. */
  doc?: Document;
}

/** Imperative handle for the mounted timeline UI. */
export interface TimelineUI {
  /** Root element (`.timeline-ui`); carries `--era-accent` and drag state. */
  readonly element: HTMLElement;
  /** Glassy interactive panel (the only pointer-interactive surface). */
  readonly panel: HTMLElement;
  /** The `role="slider"` element users focus and operate. */
  readonly slider: HTMLElement;
  /** The track used for client-coordinate → position mapping. */
  readonly track: HTMLElement;
  readonly hud: EraHUD;
  readonly controls: ControlCluster;
  /** The shared core this UI drives. */
  readonly core: EraTimelineCore;
  /** Morph to the era stop nearest `year` (programmatic selection). */
  selectYear(year: number): EraYear;
  /** Advance the core by `deltaSeconds` and repaint HUD/playhead/stops. */
  tick(deltaSeconds: number): void;
  /** Repaint from the core's current frame without advancing it. */
  refresh(): void;
  /** Stop loops, detach listeners, and remove the UI from the DOM. */
  dispose(): void;
}

/** Which input family owns the gesture in flight (dedup: first wins). */
type GestureSource = 'pointer' | 'mouse' | 'touch';

/** Input families bound per gesture, keyed by their source tag. */
interface GestureBindings {
  move: string;
  up: string;
  cancel: string | null;
}

const GESTURE_BINDINGS: Record<GestureSource, GestureBindings> = {
  pointer: { move: 'pointermove', up: 'pointerup', cancel: 'pointercancel' },
  mouse: { move: 'mousemove', up: 'mouseup', cancel: null },
  touch: { move: 'touchmove', up: 'touchend', cancel: 'touchcancel' },
};

/**
 * Extract the horizontal client coordinate from a pointer, mouse, or touch
 * event. Touch "end/cancel" events carry the final point in
 * `changedTouches` (their `touches` list is already empty).
 */
function clientXFrom(event: Event): number | null {
  const touchEvent = event as Event & {
    touches?: ArrayLike<{ clientX: number }>;
    changedTouches?: ArrayLike<{ clientX: number }>;
  };
  const touches = touchEvent.touches;
  if (touches && touches.length > 0) return touches[0].clientX;
  const changed = touchEvent.changedTouches;
  if (changed && changed.length > 0) return changed[0].clientX;
  const mouse = event as MouseEvent;
  return typeof mouse.clientX === 'number' && Number.isFinite(mouse.clientX)
    ? mouse.clientX
    : null;
}

/**
 * Resolve where to mount: the container's own `[data-timeline-slot]` child if
 * present (the shell's reserved slot), else the container/document slot, else
 * the container/body.
 */
function resolveMountTarget(options: TimelineUIOptions, doc: Document): HTMLElement {
  const preferred = options.container;
  if (preferred) {
    return preferred.querySelector<HTMLElement>('[data-timeline-slot]') ?? preferred;
  }
  return doc.querySelector<HTMLElement>('[data-timeline-slot]') ?? doc.body;
}

/**
 * Mount the fixed-top timeline UI and return its handle. The core is created
 * lazily (or injected), the slider/HUD/controls are built once, listeners are
 * registered, and the initial frame is rendered synchronously so the DOM is
 * truthful the moment this returns.
 */
export function mountTimelineUI(options: TimelineUIOptions = {}): TimelineUI {
  const container = options.container;
  const doc = options.doc ?? container?.ownerDocument ?? document;
  const core = options.core ?? new EraTimelineCore();
  const autoAdvance = options.autoAdvance ?? true;

  /* ---------------------------------------------------------- DOM build */

  const root = doc.createElement('div');
  root.className = 'timeline-ui';
  root.setAttribute('data-testid', ROOT_TESTID);

  const panel = doc.createElement('div');
  panel.className = 'timeline-ui__panel';
  root.appendChild(panel);

  const hud = createEraHUD(doc);
  panel.appendChild(hud.element);

  const slider = doc.createElement('div');
  slider.className = 'era-slider';
  slider.setAttribute('data-testid', SLIDER_TESTID);
  slider.setAttribute('role', 'slider');
  slider.tabIndex = 0;
  slider.setAttribute('aria-label', 'Era timeline year');
  slider.setAttribute('aria-orientation', 'horizontal');
  slider.setAttribute('aria-valuemin', String(ERA_YEARS[0]));
  slider.setAttribute('aria-valuemax', String(ERA_YEARS[ERA_YEARS.length - 1]));
  slider.setAttribute('aria-valuenow', String(core.selectedYear));
  slider.setAttribute('aria-valuetext', '');

  const track = doc.createElement('div');
  track.className = 'era-slider__track';
  track.setAttribute('data-testid', TRACK_TESTID);

  const rail = doc.createElement('div');
  rail.className = 'era-slider__rail';

  const fill = doc.createElement('div');
  fill.className = 'era-slider__fill';

  const stopsLayer = doc.createElement('div');
  stopsLayer.className = 'era-slider__stops';
  stopsLayer.setAttribute('aria-hidden', 'true');

  const stops: HTMLElement[] = [];
  ERA_YEARS.forEach((year, index) => {
    const stop = doc.createElement('div');
    stop.className = 'era-slider__stop';
    stop.dataset.year = String(year);
    stop.dataset.active = 'false';
    stop.style.left = `${(index / (ERA_YEARS.length - 1)) * 100}%`;

    const tick = doc.createElement('span');
    tick.className = 'era-slider__tick';

    const label = doc.createElement('span');
    label.className = 'era-slider__label';
    label.textContent = String(year);

    stop.append(tick, label);
    stopsLayer.appendChild(stop);
    stops.push(stop);
  });

  const playhead = doc.createElement('div');
  playhead.className = 'era-slider__playhead';
  playhead.setAttribute('data-testid', PLAYHEAD_TESTID);
  playhead.setAttribute('aria-hidden', 'true');

  const bubble = doc.createElement('div');
  bubble.className = 'era-slider__bubble';
  bubble.setAttribute('data-testid', BUBBLE_TESTID);
  bubble.setAttribute('aria-hidden', 'true');
  bubble.hidden = true;

  track.append(rail, fill, stopsLayer, playhead, bubble);
  slider.appendChild(track);

  const controls = createControlCluster({
    doc,
    onMuteChange: options.onMuteChange,
  });

  panel.append(slider, controls.element);

  // Pointer-events contract (also declared in timeline.css): the root lets
  // events through to the scene; only the panel is an interactive surface.
  root.style.pointerEvents = 'none';
  panel.style.pointerEvents = 'auto';

  /* -------------------------------------------------------- mount + prep */

  const target = resolveMountTarget(options, doc);
  for (const stale of target.querySelectorAll<HTMLElement>('.timeline-ui')) stale.remove();
  const isSlot = target.matches('[data-timeline-slot]');
  if (isSlot) {
    target.replaceChildren(); // drop the shell's "Timeline" placeholder label
    target.classList.add(SLOT_MOUNTED_CLASS);
  }
  target.appendChild(root);

  /* -------------------------------------------------------- frame pump */

  const win = doc.defaultView;
  const gestureTarget: EventTarget = win ?? doc;
  const cleanups: Array<() => void> = [];

  function listen(
    target: EventTarget,
    type: string,
    handler: (event: Event) => void,
    listenerOptions?: AddEventListenerOptions,
  ): void {
    target.addEventListener(type, handler, listenerOptions);
    cleanups.push(() => target.removeEventListener(type, handler, listenerOptions));
  }

  let running = false;
  let rafId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastTimestamp: number | null = null;
  const useRaf = typeof win?.requestAnimationFrame === 'function';

  function scheduleFrame(): void {
    if (!running) return;
    if (useRaf && win) {
      rafId = win.requestAnimationFrame(onFrame);
    } else {
      timeoutId = setTimeout(() => onFrame(nowMs()), 16);
    }
  }

  function onFrame(timestamp: number): void {
    if (!running) return;
    const previous = lastTimestamp;
    lastTimestamp = timestamp;
    const rawSeconds = previous === null ? 0 : (timestamp - previous) / 1000;
    const deltaSeconds = Math.min(Math.max(rawSeconds, 0), MAX_FRAME_SECONDS);
    tick(deltaSeconds);
    scheduleFrame();
  }

  function nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function cancelFrame(): void {
    if (rafId !== null && win) win.cancelAnimationFrame(rafId);
    if (timeoutId !== null) clearTimeout(timeoutId);
    rafId = null;
    timeoutId = null;
  }

  /* ----------------------------------------------------------- gestures */

  let gesture: GestureSource | null = null;
  let capturedPointer: number | null = null;
  let renderedKey: string | null = null;

  function positionFromClientX(clientX: number): number | null {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return null; // no layout yet (hidden container)
    return clamp01((clientX - rect.left) / rect.width);
  }

  function capturePointer(event: Event): void {
    const pointerId = (event as PointerEvent).pointerId;
    if (typeof pointerId !== 'number' || typeof slider.setPointerCapture !== 'function') return;
    try {
      slider.setPointerCapture(pointerId);
      capturedPointer = pointerId;
    } catch {
      /* pointer capture is an enhancement; window listeners cover input */
    }
  }

  function releasePointer(): void {
    if (capturedPointer === null) return;
    const pointerId = capturedPointer;
    capturedPointer = null;
    if (typeof slider.releasePointerCapture !== 'function') return;
    try {
      slider.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }

  function beginGesture(event: Event, source: GestureSource): void {
    if (gesture !== null) return; // an earlier family already owns this gesture
    const clientX = clientXFrom(event);
    if (clientX === null) return;
    const position = positionFromClientX(clientX);
    if (position === null) return;
    gesture = source;
    if (source === 'touch') event.preventDefault(); // no scroll/emulated mouse
    root.classList.add('is-dragging');
    bubble.hidden = false;
    if (source === 'pointer') capturePointer(event);
    core.setPosition(position); // repaint comes via the core subscription
  }

  function moveGesture(event: Event, source: GestureSource): void {
    if (gesture !== source) return;
    const clientX = clientXFrom(event);
    if (clientX === null) return;
    const position = positionFromClientX(clientX);
    if (position === null) return;
    core.setPosition(position);
  }

  function finishGesture(event: Event | null, source: GestureSource, commit: boolean): void {
    if (gesture !== source) return;
    if (event !== null) {
      const clientX = clientXFrom(event);
      if (clientX !== null) {
        const position = positionFromClientX(clientX);
        if (position !== null) core.setPosition(position);
      }
    }
    gesture = null;
    root.classList.remove('is-dragging');
    bubble.hidden = true;
    releasePointer();
    // Glide the playhead onto the snapped stop via the core's eased driver —
    // this is the morph the HUD progress bar visualizes.
    const snapped = core.transitionTo(core.selectedYear);
    if (commit) options.onSelect?.(snapped, core);
  }

  function handleKeydown(event: Event): void {
    const keyEvent = event as KeyboardEvent;
    const index = ERA_YEARS.indexOf(core.selectedYear);
    let nextIndex: number;
    switch (keyEvent.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        nextIndex = index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        nextIndex = index - 1;
        break;
      case 'PageUp':
        nextIndex = index + 2;
        break;
      case 'PageDown':
        nextIndex = index - 2;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = ERA_YEARS.length - 1;
        break;
      default:
        return; // unhandled keys keep their default behavior
    }
    // Consume handled keys so the scene's document-level arrow handlers
    // (orbit/walk) don't also react while the slider has focus.
    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    const clamped = Math.min(Math.max(nextIndex, 0), ERA_YEARS.length - 1);
    const target = ERA_YEARS.at(clamped) ?? ERA_YEARS[0];
    if (target === core.selectedYear) return;
    core.transitionTo(target);
    options.onSelect?.(target, core);
  }

  /* ----------------------------------------------------------- repaint */

  function refresh(): void {
    const frame = core.frame();
    const activeYear = core.selectedYear;
    const percent = clamp01(frame.position) * 100;
    const progressPercent = Math.round(clamp01(frame.progress) * 100);
    const key =
      `${percent.toFixed(3)}|${activeYear}|${frame.transitioning ? 1 : 0}|${progressPercent}`;
    if (key === renderedKey) return;
    renderedKey = key;

    playhead.style.left = `${percent}%`;
    fill.style.transform = `scaleX(${clamp01(frame.position)})`;
    bubble.style.left = `${percent}%`;
    bubble.textContent = String(activeYear);

    for (const stop of stops) {
      const active = Number(stop.dataset.year) === activeYear;
      stop.classList.toggle('is-active', active);
      stop.dataset.active = String(active);
    }

    slider.setAttribute('aria-valuenow', String(activeYear));
    slider.setAttribute('aria-valuetext', `${activeYear} — ${eraNameForYear(activeYear)}`);
    root.dataset.transitioning = String(frame.transitioning);
    root.style.setProperty('--era-accent', eraAccentForYear(activeYear));

    hud.render({
      year: activeYear,
      eraName: eraNameForYear(activeYear),
      transitioning: frame.transitioning,
      progress: frame.progress,
    });
  }

  function tick(deltaSeconds: number): void {
    core.advance(deltaSeconds);
    refresh();
  }

  /* -------------------------------------------------------- subscriptions */

  listen(slider, 'pointerdown', (event) => beginGesture(event, 'pointer'));
  listen(slider, 'mousedown', (event) => beginGesture(event, 'mouse'));
  listen(slider, 'touchstart', (event) => beginGesture(event, 'touch'), { passive: false });
  listen(slider, 'keydown', handleKeydown);

  for (const source of Object.keys(GESTURE_BINDINGS) as GestureSource[]) {
    const bindings = GESTURE_BINDINGS[source];
    listen(gestureTarget, bindings.move, (event) => moveGesture(event, source));
    listen(gestureTarget, bindings.up, (event) => finishGesture(event, source, true));
    if (bindings.cancel !== null) {
      listen(gestureTarget, bindings.cancel, (event) => finishGesture(event, source, false));
    }
  }
  // Aborting a drag (alt-tab, lost window) still settles on the snapped stop.
  listen(gestureTarget, 'blur', () => {
    if (gesture === null) return;
    finishGesture(null, gesture, false);
  });

  const unsubscribe = core.subscribe(refresh);

  if (autoAdvance) {
    running = true;
    scheduleFrame();
  }

  refresh(); // truthful DOM before the first animation frame

  return {
    element: root,
    panel,
    slider,
    track,
    hud,
    controls,
    core,
    selectYear(year: number): EraYear {
      return core.transitionTo(year);
    },
    tick,
    refresh,
    dispose(): void {
      running = false;
      cancelFrame();
      unsubscribe();
      for (const off of cleanups) off();
      cleanups.length = 0;
      controls.dispose();
      hud.dispose();
      if (isSlot) target.classList.remove(SLOT_MOUNTED_CLASS);
      root.remove();
      renderedKey = null;
    },
  };
}
