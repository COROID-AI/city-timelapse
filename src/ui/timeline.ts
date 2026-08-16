/**
 * Timeline UI component factory stub.
 *
 * Renders a horizontal slider / pill selector showing the five eras
 * at the top of the viewport. On click, calls setEra() from eraState.
 * The concrete implementation will mount into #ui-placeholder.
 */

import { subscribe, setEra } from '../state/eraState.js';
import type { EraId } from '../eras.js';

export interface TimelineOptions {
  /** DOM element to mount the timeline into. Defaults to #ui-placeholder. */
  container?: HTMLElement;
}

export interface Timeline {
  /** Destroy the timeline DOM and detach listeners. */
  dispose(): void;
}

/**
 * Factory function for creating a Timeline UI component.
 * Currently renders a simple row of clickable era buttons.
 */
export function createTimeline(options: TimelineOptions = {}): Timeline {
  const container = options.container ?? document.getElementById('ui-placeholder')!;

  const buttonGroup = document.createElement('div');
  buttonGroup.style.cssText = `
    display: flex; gap: 8px; padding: 12px 16px; pointer-events: auto;
    background: rgba(0,0,0,0.7); border-radius: 0 0 8px 8px;
  `;

  const eraLabels: Record<EraId, string> = {
    '1945': '1945',
    '1965': '1965',
    '1985': '1985',
    '2005': '2005',
    '2025': '2025',
  };

  Object.entries(eraLabels).forEach(([id, label]) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      padding: 6px 14px; border: 1px solid #555; border-radius: 4px;
      background: #222; color: #ccc; cursor: pointer; font-size: 14px;
    `;
    btn.addEventListener('click', () => {
      setEra(id as EraId);
    });
    buttonGroup.appendChild(btn);
  });

  container.appendChild(buttonGroup);

  // Subscribe to external era changes so UI stays in sync
  const unsub = subscribe((_era: EraId) => {
    Array.from(buttonGroup.children).forEach((child) => {
      const b = child as HTMLButtonElement;
      b.style.background = b.textContent === _era ? '#4488ff' : '#222';
      b.style.borderColor = b.textContent === _era ? '#4488ff' : '#555';
      b.style.color = b.textContent === _era ? '#fff' : '#ccc';
    });
  });

  return {
    dispose() {
      unsub();
      container.removeChild(buttonGroup);
    },
  };
}
