import { ERA_KEYS, ERA_LABELS, type EraKey } from './eras/eraConfig.js';

export interface Timeline {
  /** Re-enable interaction once era transforms are wired in a downstream task. */
  enable: () => void;
  /** Mark an era as the active selection (updates label + button state). */
  setActive: (era: EraKey) => void;
  /** Register a listener fired when the user selects a new era. */
  onChange: (handler: (era: EraKey) => void) => void;
}

const eraLabelEl = document.getElementById('era-label');

/**
 * Build the top timeline with exactly the six era buttons (1945, 1965, 1985,
 * 2005, 2025, 2055). Buttons start disabled — the era transforms are wired in
 * downstream tasks, at which point `timeline.enable()` makes them interactive.
 *
 * Era identity and labels are sourced from `eraConfig.ts`, the single source of
 * era truth, so this UI never hardcodes era values.
 */
export function createTimeline(): Timeline {
  const container = document.getElementById('era-buttons');
  if (!container) {
    throw new Error('Timeline container #era-buttons not found in the DOM');
  }

  const buttons = new Map<EraKey, HTMLButtonElement>();
  const changeHandlers = new Set<(era: EraKey) => void>();

  for (const era of ERA_KEYS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'era-btn';
    button.textContent = era;
    button.dataset.era = era;
    button.setAttribute('aria-label', `Jump to ${era}`);
    // Disabled until the era scene transforms are implemented.
    button.disabled = true;
    button.addEventListener('click', () => setActiveEra(era));
    container.appendChild(button);
    buttons.set(era, button);
  }

  function setActiveEra(era: EraKey): void {
    for (const [key, btn] of buttons) {
      btn.setAttribute('aria-pressed', key === era ? 'true' : 'false');
      btn.classList.toggle('is-active', key === era);
    }
    if (eraLabelEl) {
      eraLabelEl.textContent = ERA_LABELS[era];
    }
    for (const handler of changeHandlers) {
      handler(era);
    }
  }

  function enable(): void {
    const nav = document.getElementById('timeline');
    nav?.removeAttribute('data-state');
    for (const btn of buttons.values()) {
      btn.disabled = false;
    }
    if (eraLabelEl) {
      eraLabelEl.textContent = 'Select an era to begin';
    }
  }

  function onChange(handler: (era: EraKey) => void): void {
    changeHandlers.add(handler);
  }

  return { enable, setActive: setActiveEra, onChange };
}
