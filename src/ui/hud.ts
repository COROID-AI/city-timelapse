// ─── HUD — Era Info Card ────────────────────────────────────────────
// Displays year + description from EraSpec with era-change fade and
// optional year ticker animation when switching eras.
// Does NOT import scene modules.

import { ERA_REGISTRY, type EraId, getEraSpec } from '../eras.js';
import './ui.css';
import type { EraChangeDetail } from './timeline.js';

// ── Constants ───────────────────────────────────────────────────────

const TICKER_DURATION = 300; // ms per digit transition
const FADE_DURATION = 300;   // ms fade out/in

// ── DOM Creation ────────────────────────────────────────────────────

let container: HTMLElement | null = null;
let yearEl: HTMLElement | null = null;
let labelEl: HTMLElement | null = null;
let descEl: HTMLElement | null = null;
let tickerInner: HTMLElement | null = null;

let isAnimatingYear = false;

function buildHUD(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hud-card';
  el.id = 'hud-card';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');

  const yearWrap = document.createElement('div');
  yearWrap.className = 'hud-year-ticker';
  yearWrap.id = 'hud-year-ticker';

  tickerInner = document.createElement('div');
  tickerInner.className = 'hud-year-ticker-inner';

  const yearDigit = document.createElement('span');
  yearDigit.className = 'hud-year-digit';
  yearDigit.textContent = '1945';
  tickerInner.appendChild(yearDigit);

  yearWrap.appendChild(tickerInner);
  el.appendChild(yearWrap);

  const eraLabel = document.createElement('div');
  eraLabel.className = 'hud-era-label';
  eraLabel.id = 'hud-era-label';
  el.appendChild(eraLabel);

  const eraDesc = document.createElement('div');
  eraDesc.className = 'hud-era-desc';
  eraDesc.id = 'hud-era-desc';
  el.appendChild(eraDesc);

  return el;
}

// ── Rendering ───────────────────────────────────────────────────────

function renderEra(eraId: EraId): void {
  const spec = getEraSpec(eraId);
  if (!spec) return;

  const hudEl = container;
  if (!hudEl || !yearEl || !labelEl || !descEl) return;

  // Update text content
  if (tickerInner) {
    tickerInner.innerHTML = '';
    const digit = document.createElement('span');
    digit.className = 'hud-year-digit';
    digit.textContent = String(spec.year);
    tickerInner.appendChild(digit);
  }

  if (labelEl) labelEl.textContent = spec.label;
  if (descEl) descEl.textContent = spec.description;

  // Set data-era for CSS theming
  hudEl.setAttribute('data-era', eraId);
}

/**
 * Perform a fade-out → change → fade-in cycle on the HUD card.
 */
function flashFade(): Promise<void> {
  const hudEl = container;
  if (!hudEl) return Promise.resolve();

  return new Promise((resolve) => {
    hudEl.classList.add('fading');
    setTimeout(() => {
      hudEl.classList.remove('fading');
      setTimeout(resolve, FADE_DURATION);
    }, FADE_DURATION / 2);
  });
}

/**
 * Animate the year digits counting up or down to the target value.
 * Each digit position scrolls through intermediate values.
 */
function animateYearTicker(fromYear: number, toYear: number): Promise<void> {
  return new Promise((resolve) => {
    if (isAnimatingYear) {
      resolve();
      return;
    }
    isAnimatingYear = true;

    const steps = Math.abs(toYear - fromYear);
    if (steps === 0) {
      isAnimatingYear = false;
      resolve();
      return;
    }

    const totalDuration = TICKER_DURATION * Math.min(steps, 8);
    let elapsed = 0;
    const startTime = performance.now();

    function tick(now: number): void {
      elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      // Current interpolated year (integer)
      const currentYear = Math.round(fromYear + (toYear - fromYear) * progress);

      if (tickerInner) {
        tickerInner.innerHTML = '';
        const digit = document.createElement('span');
        digit.className = 'hud-year-digit';
        digit.textContent = String(currentYear);
        tickerInner.appendChild(digit);
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Ensure final value is exact
        if (tickerInner) {
          tickerInner.innerHTML = '';
          const digit = document.createElement('span');
          digit.className = 'hud-year-digit';
          digit.textContent = String(toYear);
          tickerInner.appendChild(digit);
        }
        isAnimatingYear = false;
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

// ── Event Listener ──────────────────────────────────────────────────

let prevEraIndex = 0;

function handleEraChange(e: CustomEvent<EraChangeDetail>): void {
  const detail = e.detail;
  const eraId = detail.eraId as EraId;
  const idx = ERA_REGISTRY.findIndex((r) => r.id === eraId);

  if (idx < 0) return;

  const prevIdx = prevEraIndex;
  prevEraIndex = idx;

  // Run ticker animation + fade in parallel
  const fromYear = ERA_REGISTRY[prevIdx].year;
  const toYear = ERA_REGISTRY[idx].year;

  Promise.all([
    flashFade(),
    animateYearTicker(fromYear, toYear),
  ]).then(() => {
    // Final render ensures correctness after animations
    renderEra(eraId);
  });
}

// ── Public API ──────────────────────────────────────────────────────

/** Mount the HUD era-info card into the given parent (or body). */
export function mountHud(parent?: HTMLElement): HTMLElement {
  container = buildHUD();
  yearEl = container.querySelector('#hud-year-ticker') ?? null;
  labelEl = container.querySelector('#hud-era-label') ?? null;
  descEl = container.querySelector('#hud-era-desc') ?? null;

  (parent ?? document.body).appendChild(container);

  // Render initial era
  renderEra('1945');

  // Listen for era-change events from timeline
  document.addEventListener('erachange', handleEraChange as EventListener);

  return container;
}

/** Remove the HUD from the DOM. */
export function unmountHud(): void {
  document.removeEventListener('erachange', handleEraChange as EventListener);
  container?.remove();
  container = null;
  yearEl = null;
  labelEl = null;
  descEl = null;
  tickerInner = null;
  prevEraIndex = 0;
}

// ── Time-of-Day Control ─────────────────────────────────────────────

/** Minimal interface for the environment manager — avoids importing scene code. */
export interface EnvManagerLike {
  setTimeOfDay(hour: number): void;
  getTimeOfDay(): number;
  toggleAutoCycle(enabled?: boolean): void;
  isAutoCycling(): boolean;
}

let todSlider: HTMLInputElement | null = null;
let todLabel: HTMLElement | null = null;
let autoToggle: HTMLButtonElement | null = null;

function formatHourDisplay(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Inject a time-of-day slider + auto-cycle toggle into the HUD card. */
export function injectTimeOfDayControl(hudElement: HTMLElement, envManager: EnvManagerLike): void {
  // Skip if already injected
  if (hudElement.querySelector('#tod-control')) return;

  const controlDiv = document.createElement('div');
  controlDiv.id = 'tod-control';
  controlDiv.style.marginTop = '12px';
  controlDiv.style.paddingTop = '10px';
  controlDiv.style.borderTop = '1px solid var(--ui-border)';
  controlDiv.style.display = 'flex';
  controlDiv.style.flexDirection = 'column';
  controlDiv.style.gap = '6px';

  // Row 1: label + slider
  const rowTop = document.createElement('div');
  rowTop.style.display = 'flex';
  rowTop.style.alignItems = 'center';
  rowTop.style.gap = '8px';

  todLabel = document.createElement('span');
  todLabel.style.fontSize = '11px';
  todLabel.style.color = 'var(--ui-text-muted)';
  todLabel.style.minWidth = '52px';
  todLabel.style.fontFamily = 'monospace';
  todLabel.textContent = formatHourDisplay(envManager.getTimeOfDay());
  rowTop.appendChild(todLabel);

  todSlider = document.createElement('input');
  todSlider.type = 'range';
  todSlider.min = '0';
  todSlider.max = '24';
  todSlider.step = '0.25';
  todSlider.value = String(envManager.getTimeOfDay());
  todSlider.setAttribute('aria-label', 'Time of day');
  todSlider.style.flex = '1';
  todSlider.style.height = '4px';
  todSlider.style.cursor = 'pointer';
  todSlider.style.appearance = 'none';
  todSlider.style.webkitAppearance = 'none';
  todSlider.style.background = 'var(--ui-track)';
  todSlider.style.borderRadius = '2px';
  todSlider.style.outline = 'none';

  // Thumb styling
  const thumbStyle = `
    height: 14px; width: 14px; border-radius: 50%; background: var(--ui-accent);
    border: 2px solid #fff; cursor: grab; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  `;
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `#tod-control input[type="range"]::-webkit-slider-thumb { ${thumbStyle} }`;
  styleSheet.textContent += `#tod-control input[type="range"]::-moz-range-thumb { ${thumbStyle.replace(/cursor: grab;/g, '')} border:none; }`;
  document.head.appendChild(styleSheet);

  rowTop.appendChild(todSlider);

  // Row 2: Auto-cycle button
  const rowBottom = document.createElement('div');
  rowBottom.style.display = 'flex';
  rowBottom.style.justifyContent = 'flex-end';

  autoToggle = document.createElement('button');
  autoToggle.className = 'control-btn';
  autoToggle.title = 'Toggle automatic day/night cycle (T)';
  autoToggle.setAttribute('aria-pressed', 'false');
  autoToggle.setAttribute('aria-label', 'Auto day/night cycle');
  autoToggle.textContent = '⏵'; // play icon
  autoToggle.style.width = '28px';
  autoToggle.style.height = '28px';
  autoToggle.style.fontSize = '14px';
  autoToggle.addEventListener('click', () => {
    const cycling = envManager.isAutoCycling();
    envManager.toggleAutoCycle(!cycling);
    autoToggle!.textContent = envManager.isAutoCycling() ? '⏸' : '⏵';
    autoToggle!.setAttribute('aria-pressed', String(envManager.isAutoCycling()));
  });
  rowBottom.appendChild(autoToggle);

  controlDiv.appendChild(rowTop);
  controlDiv.appendChild(rowBottom);
  hudElement.appendChild(controlDiv);

  // Slider event
  todSlider!.addEventListener('input', () => {
    const hour = parseFloat(todSlider!.value);
    envManager.setTimeOfDay(hour);
    if (todLabel) todLabel.textContent = formatHourDisplay(hour);
  });
}
