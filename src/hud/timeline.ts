/**
 * src/hud/timeline.ts
 * ----------------------------------------------------------------------------
 * Top-of-screen timeline HUD for the "City Timelapse 1945-2055" scene.
 *
 * Dependency rule (acceptance criterion #2): this module depends ONLY on the
 * {@link EraController} and the shared era data model (`src/eras.ts`). It never
 * imports a builder, the audio mixer or the particle system — those systems
 * subscribe to the same controller independently.
 *
 * Behaviour (acceptance criteria #3 & #4):
 *   - Clicking a year tick        -> controller.tweenToEra(id)   (animated)
 *   - Dragging the track / handle -> controller.tweenToEra(id)   (animated, retargets)
 *   - Pressing keys 1-6           -> controller.setEra(id)       (instant jump)
 *   - Arrow Left / Right          -> tween to the previous / next era
 *   - The big year label tweens numerically between stops, driven by the
 *     controller's per-frame interpolatedYear.
 *
 * The HUD is vanilla DOM (no UI framework) so it stays decoupled and trivially
 * removable.
 * ----------------------------------------------------------------------------
 */

import type { EraId } from '../eras';
import { ALL_ERAS, ERA_IDS } from '../eras';
import type { EraController, EraTransitionSnapshot } from '../eraController';

/** Opaque handle letting the scene tear the HUD down. */
export interface TimelineHud {
  dispose(): void;
}

const MIN_YEAR = ALL_ERAS[0].year;
const MAX_YEAR = ALL_ERAS[ALL_ERAS.length - 1].year;
const YEAR_SPAN = MAX_YEAR - MIN_YEAR;

/** Map an absolute year to a 0..1 position along the track. */
function yearToFraction(year: number): number {
  if (YEAR_SPAN <= 0) return 0;
  return Math.max(0, Math.min(1, (year - MIN_YEAR) / YEAR_SPAN));
}

/** Map a 0..1 fraction to the index of the nearest era tick. */
function fractionToIndex(fraction: number): number {
  const clamped = Math.max(0, Math.min(1, fraction));
  return Math.round(clamped * (ERA_IDS.length - 1));
}

const STYLES = `
.ct-timeline{position:fixed;top:18px;left:50%;transform:translateX(-50%);
  width:min(960px,calc(100vw - 32px));z-index:50;display:flex;flex-direction:column;
  align-items:center;gap:10px;padding:14px 22px 12px;
  background:rgba(12,14,20,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.12);border-radius:18px;
  box-shadow:0 12px 44px rgba(0,0,0,.5);color:#f4f6fb;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  user-select:none;-webkit-user-select:none}
.ct-year{font-size:36px;font-weight:700;letter-spacing:3px;line-height:1;
  text-shadow:0 2px 20px rgba(0,0,0,.65);font-variant-numeric:tabular-nums}
.ct-track{position:relative;width:100%;height:46px;display:flex;align-items:center;
  cursor:pointer;touch-action:none}
.ct-rail{position:absolute;left:0;right:0;top:50%;height:4px;transform:translateY(-50%);
  background:rgba(255,255,255,.14);border-radius:999px}
.ct-fill{position:absolute;left:0;top:50%;height:4px;transform:translateY(-50%);
  background:linear-gradient(90deg,#6ea8ff,#b388ff,#ff8a65);border-radius:999px}
.ct-ticks{position:relative;width:100%;height:100%;display:flex;justify-content:space-between;align-items:center}
.ct-tick{position:relative;display:flex;flex-direction:column;align-items:center;gap:9px;
  background:none;border:0;padding:0;cursor:pointer;color:rgba(244,246,251,.7);
  font-size:12px;font-weight:600;letter-spacing:.5px;transition:color .2s ease,transform .2s ease}
.ct-tick:hover{color:#fff;transform:translateY(-1px)}
.ct-tick__dot{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.45);
  border:2px solid rgba(255,255,255,.25);transition:all .2s ease}
.ct-tick.is-active{color:#fff}
.ct-tick.is-active .ct-tick__dot{background:#fff;transform:scale(1.15);
  box-shadow:0 0 0 4px rgba(179,136,255,.35),0 0 18px rgba(255,255,255,.85)}
.ct-handle{position:absolute;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);
  border-radius:50%;pointer-events:none;
  background:radial-gradient(circle at 35% 30%,#fff,#c9d4ff 60%,#8a7bff);
  box-shadow:0 0 0 4px rgba(255,255,255,.18),0 6px 16px rgba(0,0,0,.45)}
.ct-hint{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(244,246,251,.5)}
.ct-hint kbd{display:inline-block;padding:1px 6px;margin:0 2px;border-radius:5px;
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);
  font-size:10px;font-family:inherit;color:#fff}
`;

/** Small helper to create an element with attributes + children. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  opts: { className?: string; text?: string; attrs?: Record<string, string> } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [key, value] of Object.entries(opts.attrs)) {
      node.setAttribute(key, value);
    }
  }
  return node;
}

/**
 * Build and mount the timeline HUD into `root`, bound to `controller`.
 *
 * @returns a {@link TimelineHud} handle whose `dispose()` removes the HUD and
 *          all of its listeners.
 */
export function createTimeline(root: HTMLElement, controller: EraController): TimelineHud {
  // --- Inject the stylesheet once -----------------------------------------
  const style = el('style', { text: STYLES });
  document.head.appendChild(style);

  // --- Build the DOM tree -------------------------------------------------
  const panel = el('div', { className: 'ct-timeline' });

  const yearLabel = el('div', { className: 'ct-year', text: String(ALL_ERAS[0].year) });

  const track = el('div', { className: 'ct-track' });
  const rail = el('div', { className: 'ct-rail' });
  const fill = el('div', { className: 'ct-fill' });
  const handle = el('div', { className: 'ct-handle' });
  const ticks = el('div', { className: 'ct-ticks' });

  track.append(rail, fill, ticks, handle);

  const tickButtons = new Map<EraId, HTMLButtonElement>();
  for (const era of ALL_ERAS) {
    const tick = el('button', {
      className: 'ct-tick',
      text: String(era.year),
      attrs: {
        type: 'button',
        'data-era': era.id,
        'aria-label': `Travel to ${era.year}`,
      },
    });
    const dot = el('span', { className: 'ct-tick__dot' });
    tick.insertBefore(dot, tick.firstChild);
    tick.addEventListener('click', () => controller.tweenToEra(era.id));
    ticks.appendChild(tick);
    tickButtons.set(era.id, tick);
  }

  const hint = el('div', { className: 'ct-hint' });
  hint.innerHTML =
    'Click a year to travel &middot; <kbd>1</kbd>–<kbd>6</kbd> jump &middot; <kbd>&larr;</kbd><kbd>&rarr;</kbd> step';

  panel.append(yearLabel, track, hint);
  root.appendChild(panel);

  // --- Render from a snapshot --------------------------------------------
  function render(snapshot: EraTransitionSnapshot): void {
    const year = Math.round(snapshot.interpolatedYear);
    yearLabel.textContent = String(year);

    const fraction = yearToFraction(snapshot.interpolatedYear);
    const pct = `${(fraction * 100).toFixed(3)}%`;
    handle.style.left = pct;
    fill.style.width = pct;

    // Highlight the tick nearest the live position (matches the handle).
    const activeIndex = fractionToIndex(fraction);
    const activeId = ERA_IDS[activeIndex];
    for (const [id, button] of tickButtons) {
      button.classList.toggle('is-active', id === activeId);
    }
  }

  // Initialize from the controller's present state.
  render(controller.getSnapshot());

  // --- Subscribe to the controller ---------------------------------------
  const unsubscribe = controller.subscribe({
    onEraChange: render,
  });

  // --- Track scrubbing (pointer drag -> tweenToEra) ----------------------
  let dragging = false;

  function fractionFromPointer(clientX: number): number {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return (clientX - rect.left) / rect.width;
  }

  function scrubTo(clientX: number): void {
    const fraction = fractionFromPointer(clientX);
    const index = fractionToIndex(fraction);
    controller.tweenToEra(ERA_IDS[index]);
  }

  function onPointerDown(event: PointerEvent): void {
    dragging = true;
    track.setPointerCapture(event.pointerId);
    scrubTo(event.clientX);
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    scrubTo(event.clientX);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    try {
      track.releasePointerCapture(event.pointerId);
    } catch {
      /* pointerId may already be released; safe to ignore */
    }
  }

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointercancel', onPointerUp);

  // --- Keyboard shortcuts -------------------------------------------------
  function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || isTypingTarget(event.target)) return;

    // Digits 1-6 -> instant jump to the corresponding era.
    if (event.key >= '1' && event.key <= '9') {
      const index = Number(event.key) - 1;
      if (index < ERA_IDS.length) {
        event.preventDefault();
        controller.setEra(ERA_IDS[index]);
        return;
      }
    }

    // Arrow keys -> tween one stop left / right.
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const base = controller.targetEra;
      let index = ERA_IDS.indexOf(base);
      if (index < 0) index = 0;
      index += event.key === 'ArrowLeft' ? -1 : 1;
      index = Math.max(0, Math.min(ERA_IDS.length - 1, index));
      if (ERA_IDS[index] !== base) {
        controller.tweenToEra(ERA_IDS[index]);
      }
    }
  }

  window.addEventListener('keydown', onKeyDown);

  // --- Cleanup -----------------------------------------------------------
  function dispose(): void {
    unsubscribe();
    window.removeEventListener('keydown', onKeyDown);
    track.removeEventListener('pointerdown', onPointerDown);
    track.removeEventListener('pointermove', onPointerMove);
    track.removeEventListener('pointerup', onPointerUp);
    track.removeEventListener('pointercancel', onPointerUp);
    style.remove();
    panel.remove();
  }

  return { dispose };
}
