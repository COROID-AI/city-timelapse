import { EraState } from '../types/era';
import { eraRegistry } from '../state/eraRegistry';

/**
 * UiRoot: a permanent DOM overlay root placed above the canvas. All HUD
 * elements (timeline slider, era readout, joystick, orbit button) live here.
 */
export interface UiRoot {
  /** The DOM element that hosts all overlay UI. */
  readonly element: HTMLDivElement;
  /** The era readout element (updates on era change). */
  readonly eraReadout: HTMLDivElement;
}

export function createUiRoot(
  app: HTMLElement,
  eraState: EraState,
): UiRoot {
  const overlay = document.createElement('div');
  overlay.className = 'ui-overlay';
  app.appendChild(overlay);

  const eraReadout = document.createElement('div');
  eraReadout.className = 'era-readout';
  overlay.appendChild(eraReadout);

  const updateReadout = (year: number) => {
    const meta = eraRegistry.find(year);
    eraReadout.textContent = meta ? `${meta.label} · ${meta.description}` : String(year);
  };
  updateReadout(eraState.year);
  eraState.subscribe(updateReadout);

  return {
    element: overlay,
    eraReadout,
  };
}