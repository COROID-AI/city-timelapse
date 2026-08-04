import type { ControlMode } from './modeSwitch';

/**
 * Build the on-screen control prompt overlay. It explains the walk controls
 * while Pointer Lock is active and always shows the fallback toggle key, so
 * the user can switch to OrbitControls even when Pointer Lock is blocked.
 */
export function createHud(): HTMLDivElement {
  const hud = document.createElement('div');
  hud.id = 'controls-hud';
  hud.style.cssText = [
    'position: fixed',
    'top: 12px',
    'left: 12px',
    'z-index: 100',
    'background: rgba(10, 12, 18, 0.72)',
    'color: #eef1f6',
    'font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif',
    'padding: 10px 14px',
    'border-radius: 8px',
    'pointer-events: none',
    'user-select: none',
    'max-width: 340px',
    'text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6)',
    'box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35)',
  ].join('; ');

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 700; margin-bottom: 4px;';
  title.textContent = 'City Explorer';

  const walkLine = document.createElement('div');
  walkLine.textContent = 'Click to look around · WASD / arrows to walk · Shift sprint · Space jump';

  const toggleLine = document.createElement('div');
  toggleLine.style.cssText = 'opacity: 0.92; margin-top: 4px;';
  toggleLine.textContent = 'Press R to switch between walk and orbit view';

  hud.append(title, walkLine, toggleLine);
  return hud;
}

/** Keep the HUD text in sync with the active control mode. */
export function updateHudMode(hud: HTMLElement, mode: ControlMode): void {
  const toggleLine = hud.lastElementChild;
  if (!toggleLine) {
    return;
  }
  if (mode === 'walk') {
    toggleLine.textContent =
      'Press R to switch between walk and orbit view · Click to look around';
  } else {
    toggleLine.textContent =
      'Orbit view · drag to rotate, scroll to zoom · Press R to return to walk mode';
  }
}
