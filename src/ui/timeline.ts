/**
 * Top-mounted era timeline slider (1945 → 2025).
 *
 * Renders a fixed, glassmorphic bar pinned to the top of the viewport with
 * exactly five labeled stops taken from `ERA_REGISTRY`. Stops are clickable
 * era chips connected by a track line; the thumb is a native
 * `<input type="range">` (one notch per era step) styled to ride the track
 * and snap to the nearest stop.
 *
 * Interaction contract:
 * - Clicking a chip (or tapping/dragging on the track) fires `onEraChange`
 *   with the corresponding `EraId`.
 * - Keyboard: chips rove focus with ←/→/Home/End and commit with Enter/Space;
 *   the thumb is a real WAI-ARIA `slider` form control whose arrow keys step
 *   the selected era natively, with `aria-valuenow` reflecting the year.
 * - Being a genuine form control, the thumb also accepts programmatic value
 *   writes reported via `input`/`change` events — the path browser automation
 *   (e.g. Playwright's `fill()`) exercises.
 * - `handle.setEra(id)` updates the visual highlight programmatically WITHOUT
 *   re-triggering `onEraChange`.
 *
 * All styling is injected from this module so the component stays a single,
 * self-contained UI file (no external CSS assets).
 */

import { ERA_REGISTRY } from '../eras';
import type { EraId } from '../eras';

/** Public handle returned by {@link createTimelineSlider}. */
export interface TimelineSliderHandle {
  /** The mounted root element (pinned to the top of the viewport). */
  readonly root: HTMLElement;
  /** Currently highlighted era id. */
  getEra(): EraId;
  /** Highlight `id` without firing `onEraChange`. Throws on unknown ids. */
  setEra(id: EraId): void;
  /** Detach all listeners and remove the slider from the DOM. */
  dispose(): void;
}

interface AccentSpec {
  readonly hex: string;
  readonly rgb: string;
}

/** Per-era accent hues so the whole control re-tints itself per era. */
const ACCENTS: Readonly<Record<EraId, AccentSpec>> = {
  '1945': { hex: '#d9a05b', rgb: '217, 160, 91' }, // sepia amber
  '1965': { hex: '#ff7e67', rgb: '255, 126, 103' }, // mid-century coral
  '1985': { hex: '#ff4fd8', rgb: '255, 79, 216' }, // neon magenta
  '2005': { hex: '#4da3ff', rgb: '77, 163, 255' }, // LED blue
  '2025': { hex: '#35e0c2', rgb: '53, 224, 194' }, // electric teal
};

const STYLE_ID = 'era-timeline-styles';

const STYLES = `
.era-timeline-root {
  --etl-font: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI Variable Display",
    "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --etl-accent: #d9a05b;
  --etl-accent-rgb: 217, 160, 91;
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: min(720px, calc(100vw - 24px));
  z-index: 120;
  font-family: var(--etl-font);
  color: #eef2fb;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.era-timeline-bar {
  position: relative;
  border-radius: 18px;
  padding: 13px 22px 15px;
  background: linear-gradient(180deg, rgba(15, 19, 28, 0.86), rgba(13, 16, 24, 0.68));
  border: 1px solid rgba(148, 166, 200, 0.16);
  box-shadow:
    0 18px 44px rgba(2, 4, 10, 0.55),
    0 2px 10px rgba(2, 4, 10, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  animation: etl-rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes etl-rise {
  from { opacity: 0; transform: translateY(-14px); }
  to { opacity: 1; transform: translateY(0); }
}
.era-timeline-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 2px;
}
.era-timeline-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  color: rgba(203, 214, 236, 0.42);
}
.era-timeline-caption {
  text-align: right;
  line-height: 1.2;
}
.era-timeline-caption-year {
  display: block;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: #f5f8ff;
  font-variant-numeric: tabular-nums;
  transition: color 0.4s ease;
}
.era-timeline-caption-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--etl-accent);
  opacity: 0.85;
  transition: color 0.4s ease;
}
.era-timeline-rail {
  position: relative;
  height: 56px;
  margin: 4px 34px 0;
  touch-action: none;
  cursor: pointer;
}
.era-timeline-rail.is-dragging {
  cursor: grabbing;
}
.era-timeline-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 11px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.05),
    rgba(255, 255, 255, 0.14),
    rgba(255, 255, 255, 0.05));
}
.era-timeline-fill {
  position: absolute;
  left: 0;
  bottom: 11px;
  height: 3px;
  width: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(var(--etl-accent-rgb) / 0.35), var(--etl-accent));
  box-shadow: 0 0 12px rgb(var(--etl-accent-rgb) / 0.55);
  transition: width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.era-timeline-tick {
  position: absolute;
  bottom: 9px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  transform: translateX(-50%);
  background: #232c3d;
  border: 1px solid rgba(190, 205, 230, 0.35);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  z-index: 1;
}
.era-timeline-tick.is-active {
  background: var(--etl-accent);
  border-color: rgb(var(--etl-accent-rgb) / 0.9);
  box-shadow: 0 0 10px rgb(var(--etl-accent-rgb) / 0.8);
}
.era-timeline-thumb {
  /* Native <input type="range"> styled as the era thumb. The transparent
     control strip spans the full rail width and is vertically centred on the
     track line, so the browser-rendered thumb rides exactly where the classic
     knob sat (centre 12.5px above the rail's bottom edge). Being a real form
     control keeps pointer drags, keyboard stepping and automation fill()
     working through native semantics. */
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.5px;
  width: auto;
  height: 24px;
  margin: 0;
  padding: 0;
  z-index: 3;
  cursor: grab;
  touch-action: none;
  background: transparent;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
}
.era-timeline-thumb:active {
  cursor: grabbing;
}
.era-timeline-thumb::-webkit-slider-runnable-track {
  height: 24px;
  background: transparent;
  border: none;
}
.era-timeline-thumb::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 17px;
  height: 17px;
  border: none;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%,
    #ffffff 0%,
    var(--etl-accent) 58%,
    rgb(var(--etl-accent-rgb) / 0.65) 100%);
  box-shadow:
    0 0 0 5px rgb(var(--etl-accent-rgb) / 0.2),
    0 3px 12px rgba(0, 0, 0, 0.55);
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.25s ease;
}
.era-timeline-thumb::-moz-range-track {
  height: 24px;
  background: transparent;
  border: none;
}
.era-timeline-thumb::-moz-range-thumb {
  width: 17px;
  height: 17px;
  border: none;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%,
    #ffffff 0%,
    var(--etl-accent) 58%,
    rgb(var(--etl-accent-rgb) / 0.65) 100%);
  box-shadow:
    0 0 0 5px rgb(var(--etl-accent-rgb) / 0.2),
    0 3px 12px rgba(0, 0, 0, 0.55);
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.25s ease;
}
.era-timeline-thumb:hover::-webkit-slider-thumb,
.era-timeline-thumb:hover::-moz-range-thumb {
  transform: scale(1.14);
}
.era-timeline-thumb:focus-visible::-webkit-slider-thumb {
  outline: 2px solid rgb(var(--etl-accent-rgb) / 0.95);
  outline-offset: 4px;
}
.era-timeline-thumb:active::-webkit-slider-thumb,
.era-timeline-thumb:active::-moz-range-thumb,
.era-timeline-thumb.is-dragging::-webkit-slider-thumb,
.era-timeline-thumb.is-dragging::-moz-range-thumb {
  transform: scale(1.28);
  box-shadow:
    0 0 0 8px rgb(var(--etl-accent-rgb) / 0.16),
    0 6px 20px rgba(0, 0, 0, 0.6);
}
.era-timeline-thumb.is-dragging {
  cursor: grabbing;
}
.era-timeline-thumb.is-dragging ~ .era-timeline-stop {
  pointer-events: none;
}

/* Decorative halo trailing the thumb. It keeps the signature eased glide on
   programmatic era changes (the native thumb itself moves instantly). */
.era-timeline-thumb-glow {
  position: absolute;
  bottom: -2.5px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  transform: translateX(-50%);
  z-index: 2;
  pointer-events: none;
  opacity: 0.85;
  background: radial-gradient(circle,
    rgb(var(--etl-accent-rgb) / 0.5) 0%,
    rgb(var(--etl-accent-rgb) / 0.18) 46%,
    transparent 72%);
  transition:
    left 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.25s ease;
}
.era-timeline-thumb:hover ~ .era-timeline-thumb-glow {
  transform: translateX(-50%) scale(1.12);
}
.era-timeline-thumb:focus-visible ~ .era-timeline-thumb-glow {
  opacity: 1;
  transform: translateX(-50%) scale(1.18);
}
.era-timeline-thumb.is-dragging ~ .era-timeline-thumb-glow {
  opacity: 1;
  transform: translateX(-50%) scale(1.38);
}
.era-timeline-stop {
  position: absolute;
  top: 0;
  z-index: 4;
  appearance: none;
  -webkit-appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 13px;
  border-radius: 999px;
  border: 1px solid rgba(158, 176, 208, 0.22);
  background: rgba(255, 255, 255, 0.055);
  color: rgba(228, 236, 250, 0.78);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  transform: translate(-50%, 0);
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    background 0.28s ease,
    border-color 0.28s ease,
    color 0.28s ease,
    box-shadow 0.28s ease;
}
.era-timeline-stop:hover {
  color: #ffffff;
  border-color: rgba(210, 222, 244, 0.45);
  background: rgba(255, 255, 255, 0.11);
  transform: translate(-50%, -2px);
}
.era-timeline-stop:focus-visible {
  outline: 2px solid rgb(var(--etl-accent-rgb) / 0.95);
  outline-offset: 3px;
}
.era-timeline-stop.is-active {
  color: #ffffff;
  border-color: rgb(var(--etl-accent-rgb) / 0.85);
  background: linear-gradient(180deg,
    rgb(var(--etl-accent-rgb) / 0.30),
    rgb(var(--etl-accent-rgb) / 0.14));
  box-shadow:
    inset 0 0 0 1px rgb(var(--etl-accent-rgb) / 0.35),
    0 6px 18px rgb(var(--etl-accent-rgb) / 0.35);
  transform: translate(-50%, -3px) scale(1.05);
}
.era-timeline-live {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 620px) {
  .era-timeline-bar { padding: 10px 12px 12px; }
  .era-timeline-rail { margin: 4px 22px 0; }
  .era-timeline-stop { padding: 5px 9px; font-size: 11px; }
  .era-timeline-caption-year { font-size: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .era-timeline-bar,
  .era-timeline-fill,
  .era-timeline-thumb,
  .era-timeline-thumb-glow,
  .era-timeline-stop,
  .era-timeline-tick,
  .era-timeline-caption-year,
  .era-timeline-caption-label {
    transition: none !important;
    animation: none !important;
  }
}
`;

/** Inject the component stylesheet once per document. */
function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  doc.head.appendChild(style);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Query a mandatory element, failing loudly instead of leaking `null`. */
function requireEl<T extends Element>(scope: ParentNode, selector: string): T {
  const el = scope.querySelector<T>(selector);
  if (el === null) {
    throw new Error(`era-timeline: internal scaffold failed to build (${selector}).`);
  }
  return el;
}

/**
 * Create the top-mounted era timeline slider inside `container`.
 *
 * The root element is `position: fixed` and pinned to the top of the viewport,
 * independent of the container's own layout position.
 */
export function createTimelineSlider(
  container: HTMLElement,
  onEraChange: (id: EraId) => void,
): TimelineSliderHandle {
  const doc = container.ownerDocument;
  ensureStyles(doc);

  // Every listener registers through this signal so dispose() is one call.
  const controller = new AbortController();

  const stops = ERA_REGISTRY.map((spec) => ({ id: spec.id, spec }));
  const count = stops.length;
  const indexByEra = new Map<EraId, number>(stops.map((stop, i) => [stop.id, i]));
  const pctOfIndex = (index: number): string => `${(index / (count - 1)) * 100}%`;

  // ---- DOM scaffold ----------------------------------------------------
  const root = doc.createElement('section');
  root.className = 'era-timeline-root';
  root.dataset.testid = 'era-timeline';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'City era timeline');

  root.innerHTML = `
    <div class="era-timeline-bar">
      <header class="era-timeline-head">
        <span class="era-timeline-eyebrow">City Era Timelapse</span>
        <span class="era-timeline-caption">
          <span class="era-timeline-caption-year"></span>
          <span class="era-timeline-caption-label"></span>
        </span>
      </header>
      <div class="era-timeline-rail" data-testid="era-timeline-rail">
        <div class="era-timeline-line" aria-hidden="true"></div>
        <div class="era-timeline-fill" aria-hidden="true"></div>
      </div>
    </div>
    <div class="era-timeline-live" role="status" aria-live="polite"></div>
  `;

  const rail = requireEl<HTMLElement>(root, '.era-timeline-rail');
  const fill = requireEl<HTMLElement>(root, '.era-timeline-fill');
  const captionYear = requireEl<HTMLElement>(root, '.era-timeline-caption-year');
  const captionLabel = requireEl<HTMLElement>(root, '.era-timeline-caption-label');
  const liveRegion = requireEl<HTMLElement>(root, '.era-timeline-live');

  // Thumb: a real <input type="range"> — the canonical slider form control.
  // Native semantics give us the slider role, pointer dragging and keyboard
  // stepping for free, and automation harnesses can drive it with fill().
  // Years are evenly spaced, so min/max/step map each stop onto one notch.
  const thumb = doc.createElement('input');
  thumb.type = 'range';
  thumb.className = 'era-timeline-thumb';
  thumb.dataset.testid = 'era-timeline-thumb';
  thumb.min = String(stops[0].spec.year);
  thumb.max = String(stops[count - 1].spec.year);
  thumb.step = String((stops[count - 1].spec.year - stops[0].spec.year) / (count - 1));
  thumb.value = String(stops[0].spec.year);
  thumb.setAttribute('role', 'slider'); // explicit twin of the implicit range role
  thumb.setAttribute('aria-label', 'Selected city era');
  thumb.setAttribute('aria-orientation', 'horizontal');
  thumb.setAttribute('aria-valuemin', String(stops[0].spec.year));
  thumb.setAttribute('aria-valuemax', String(stops[count - 1].spec.year));

  // Per-stop tick dot on the track line.
  const ticks: HTMLElement[] = stops.map((_stop, i) => {
    const tick = doc.createElement('div');
    tick.className = 'era-timeline-tick';
    tick.setAttribute('aria-hidden', 'true');
    tick.style.left = pctOfIndex(i);
    rail.appendChild(tick);
    return tick;
  });

  rail.appendChild(thumb);

  // Decorative halo trailing the native thumb (see .era-timeline-thumb-glow).
  // Placed after the input in the DOM so the sibling selectors in the
  // stylesheet (:hover/:focus-visible/.is-dragging ~) can reach it.
  const glow = doc.createElement('div');
  glow.className = 'era-timeline-thumb-glow';
  glow.setAttribute('aria-hidden', 'true');
  rail.appendChild(glow);

  // Clickable era chips sitting above the track line.
  const buttons: HTMLButtonElement[] = stops.map((stop, i) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'era-timeline-stop';
    button.dataset.eraId = stop.id;
    button.dataset.testid = `era-stop-${stop.id}`;
    button.textContent = stop.id;
    button.setAttribute('aria-label', `${stop.spec.year} — ${stop.spec.label}`);
    button.style.left = pctOfIndex(i);
    button.addEventListener('click', () => commit(stop.id), { signal: controller.signal });
    rail.appendChild(button);
    return button;
  });

  container.appendChild(root);

  // ---- State & rendering -----------------------------------------------
  let currentEra: EraId = stops[0].id;

  function applyEra(id: EraId): void {
    const index = indexByEra.get(id);
    if (index === undefined) {
      throw new Error(`Unknown era id: ${String(id)}`);
    }
    const spec = stops[index].spec;
    const accent = ACCENTS[id];
    const pct = pctOfIndex(index);

    stops.forEach((_stop, i) => {
      const active = i === index;
      buttons[i].classList.toggle('is-active', active);
      buttons[i].setAttribute('aria-current', active ? 'true' : 'false');
      ticks[i].classList.toggle('is-active', active);
    });

    thumb.value = String(spec.year); // re-snap the native control onto the stop
    thumb.setAttribute('aria-valuenow', String(spec.year));
    thumb.setAttribute('aria-valuetext', `${spec.year} — ${spec.label}`);
    glow.style.left = pct;
    fill.style.width = pct;

    root.style.setProperty('--etl-accent', accent.hex);
    root.style.setProperty('--etl-accent-rgb', accent.rgb);
    captionYear.textContent = String(spec.year);
    captionLabel.textContent = spec.label;
  }

  /** Interactive commit: highlight + announce + notify. */
  function commit(id: EraId): void {
    currentEra = id;
    applyEra(id);
    const spec = stops[indexByEra.get(id) as number].spec;
    liveRegion.textContent = `${spec.year} — ${spec.label}`;
    onEraChange(id);
  }

  // ---- Slider commits ------------------------------------------------------
  // The native <input type="range"> owns pointer drags, track taps and
  // keyboard stepping (←/→/↑/↓/PageUp/PageDown/Home/End); every gesture
  // settles into a `change` event, which is exactly what automation fill()
  // dispatches too. Off-stop values snap to the chronologically closest era.
  function eraIndexForValue(value: number): number {
    if (!Number.isFinite(value)) {
      return indexByEra.get(currentEra) ?? 0;
    }
    const yearMin = stops[0].spec.year;
    const yearStep = (stops[count - 1].spec.year - yearMin) / (count - 1);
    const index = Math.round((value - yearMin) / yearStep);
    return Math.min(count - 1, Math.max(0, index));
  }

  thumb.addEventListener(
    'change',
    () => {
      commit(stops[eraIndexForValue(Number(thumb.value))].id);
    },
    { signal: controller.signal },
  );

  // Drag affordance: mirror the pressed state onto the control so CSS can
  // swell the thumb and mute the chips while a native drag is in flight.
  thumb.addEventListener(
    'pointerdown',
    () => {
      thumb.classList.add('is-dragging');
    },
    { signal: controller.signal },
  );
  window.addEventListener(
    'pointerup',
    () => {
      thumb.classList.remove('is-dragging');
    },
    { signal: controller.signal },
  );
  window.addEventListener(
    'pointercancel',
    () => {
      thumb.classList.remove('is-dragging');
      applyEra(currentEra); // spring back to the committed stop
    },
    { signal: controller.signal },
  );

  // Taps that land on the rail but outside the slider strip (e.g. the gaps
  // between chips) still jump to the nearest stop.
  rail.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('.era-timeline-stop')) return; // chip click handles it
      if (target?.closest?.('input')) return; // the native slider handles it
      if (event.button !== undefined && event.button !== 0) return; // primary button only
      const rect = rail.getBoundingClientRect();
      if (rect.width <= 0) return;
      const fraction = clamp01((event.clientX - rect.left) / rect.width);
      commit(stops[Math.round(fraction * (count - 1))].id);
    },
    { signal: controller.signal },
  );

  // ---- Keyboard ------------------------------------------------------------
  // Chips rove focus with arrows and commit with Enter/Space. The thumb's own
  // keyboard support is native (<input type="range"> steps with ←/→/↑/↓/
  // PageUp/PageDown/Home/End and reports each settled step as a `change`
  // event, handled in the slider-commits section above).
  rail.addEventListener(
    'keydown',
    (event) => {
      const target = event.target as Element | null;
      const button = target?.closest?.('.era-timeline-stop') as HTMLButtonElement | null;
      if (!button) return;
      const index = indexByEra.get(button.dataset.eraId as EraId) ?? 0;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          focusStop(Math.max(0, index - 1));
          event.preventDefault();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          focusStop(Math.min(count - 1, index + 1));
          event.preventDefault();
          break;
        case 'Home':
          focusStop(0);
          event.preventDefault();
          break;
        case 'End':
          focusStop(count - 1);
          event.preventDefault();
          break;
        case 'Enter':
        case ' ':
          commit(button.dataset.eraId as EraId);
          event.preventDefault();
          break;
        default:
          break;
      }
    },
    { signal: controller.signal },
  );

  function focusStop(index: number): void {
    buttons[index]?.focus();
  }

  applyEra(currentEra);

  // ---- Public handle -----------------------------------------------------
  return {
    root,
    getEra: () => currentEra,
    setEra(id: EraId): void {
      if (!indexByEra.has(id)) {
        throw new Error(`Unknown era id: ${String(id)}`);
      }
      currentEra = id;
      applyEra(id); // visual only — deliberately no callback, no announcement
    },
    dispose(): void {
      controller.abort();
      root.remove();
    },
  };
}
