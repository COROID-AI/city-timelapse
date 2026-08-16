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
