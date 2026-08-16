/**
 * Info panel UI component factory stub.
 *
 * Displays era description text (from EraSpec.description) in a
 * corner overlay. The concrete implementation will animate in on
 * era change and show historical facts or controls.
 */

import { getEraSpec } from '../eras.js';
import { subscribe } from '../state/eraState.js';

export interface InfoPanelOptions {
  /** DOM element to mount the panel into. Defaults to #ui-placeholder. */
  container?: HTMLElement;
}

export interface InfoPanel {
  /** Destroy the info panel DOM and detach listeners. */
  dispose(): void;
}

/**
 * Factory function for creating an InfoPanel component.
 * Currently shows the era description in a small card.
 */
export function createInfoPanel(options: InfoPanelOptions = {}): InfoPanel {
  const container = options.container ?? document.getElementById('ui-placeholder')!;

  const panel = document.createElement('div');
  panel.style.cssText = `
    position: absolute; bottom: 16px; left: 16px; z-index: 20;
    max-width: 320px; padding: 12px 16px; background: rgba(0,0,0,0.8);
    border-radius: 8px; color: #eee; font-family: system-ui, sans-serif;
    font-size: 13px; line-height: 1.5; pointer-events: auto;
    backdrop-filter: blur(8px);
  `;

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight: bold; margin-bottom: 4px; font-size: 15px;';

  const descEl = document.createElement('div');

  panel.appendChild(titleEl);
  panel.appendChild(descEl);
  container.appendChild(panel);

  function render(eraId: string) {
    try {
      const spec = getEraSpec(eraId as never);
      titleEl.textContent = spec.label;
      descEl.textContent = spec.description;
    } catch {
      titleEl.textContent = eraId;
      descEl.textContent = '';
    }
  }

  // Render initial era
  render('1945');

  // Subscribe to era changes
  const unsub = subscribe((era) => {
    render(era);
  });

  return {
    dispose() {
      unsub();
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    },
  };
}
