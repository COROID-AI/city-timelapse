// =============================================================================
// City Timelapse — Camera Controls UI
//
// A hand-rolled DOM/CSS overlay (no external UI library) that provides:
//
//   • Three preset view buttons — Overview, Street Level, Close-up.
//   • A 'Cinematic' auto-orbit toggle (with active indicator).
//   • A help overlay, toggled with '?' and closed with Esc, listing every
//     available control.
//
// All buttons are pure HTML/CSS overlaid on the WebGL canvas. The actual
// camera behavior lives in CameraController; this module only fires callbacks.
// =============================================================================

import type { CameraPresetId } from '../scene/cameraController';

// ---------------------------------------------------------------------------
// Callback contract — the host wires these to the CameraController.
// ---------------------------------------------------------------------------

export interface CameraUIHandlers {
  /** Fired when a preset button is clicked. */
  readonly onPreset: (id: CameraPresetId) => void;
  /** Fired when the Cinematic toggle is clicked. Returns the new state. */
  readonly onToggleCinematic: () => boolean;
  /** Fired when the help overlay is toggled (open or closed). */
  readonly onToggleHelp?: (open: boolean) => void;
}

/** Options for {@link mountCameraUI}. */
export interface CameraUIOptions extends CameraUIHandlers {}

// ---------------------------------------------------------------------------
// Styles (injected once as a <style> element)
// ---------------------------------------------------------------------------

const CAMERA_CSS = `
.city-camera-ui {
  position: fixed;
  left: 18px;
  bottom: 18px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
}

.city-camera-ui__group {
  display: flex;
  gap: 6px;
  pointer-events: auto;
  background: rgba(6, 10, 22, 0.72);
  backdrop-filter: blur(12px) saturate(1.3);
  -webkit-backdrop-filter: blur(12px) saturate(1.3);
  padding: 7px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}

.city-camera-ui__btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.78);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.4px;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  white-space: nowrap;
}

.city-camera-ui__btn:hover {
  background: rgba(120, 180, 255, 0.14);
  color: rgba(255, 255, 255, 0.96);
  border-color: rgba(120, 180, 255, 0.4);
}

.city-camera-ui__btn:focus-visible {
  outline: 2px solid rgba(100, 180, 255, 0.8);
  outline-offset: 2px;
}

.city-camera-ui__btn--active {
  background: rgba(100, 180, 255, 0.22);
  color: rgb(205, 232, 255);
  border-color: rgba(120, 180, 255, 0.6);
  box-shadow: 0 0 12px rgba(100, 180, 255, 0.35);
}

.city-camera-ui__cinematic .city-camera-ui__dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  margin-right: 7px;
  vertical-align: middle;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.city-camera-ui__btn--active .city-camera-ui__dot {
  background: rgb(130, 200, 255);
  box-shadow: 0 0 8px rgba(100, 180, 255, 0.9);
}

.city-camera-ui__help-btn {
  align-self: flex-start;
}

/* ---- Help overlay -------------------------------------------------------- */

.city-help-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 7, 16, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.22s ease;
}

.city-help-overlay--open {
  opacity: 1;
  pointer-events: auto;
}

.city-help-overlay__panel {
  width: min(520px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  background: rgba(10, 15, 28, 0.94);
  border: 1px solid rgba(120, 180, 255, 0.22);
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  padding: 26px 28px 22px;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
  transform: translateY(8px) scale(0.98);
  transition: transform 0.22s ease;
}

.city-help-overlay--open .city-help-overlay__panel {
  transform: translateY(0) scale(1);
}

.city-help-overlay__title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: rgb(205, 232, 255);
}

.city-help-overlay__subtitle {
  margin: 0 0 18px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.city-help-overlay__list {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.city-help-overlay__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.city-help-overlay__row:last-child {
  border-bottom: none;
}

.city-help-overlay__keys {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}

.city-help-overlay__key {
  display: inline-block;
  min-width: 26px;
  text-align: center;
  padding: 3px 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-bottom-width: 2px;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
}

.city-help-overlay__desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
  text-align: right;
}

.city-help-overlay__close {
  appearance: none;
  border: 1px solid rgba(120, 180, 255, 0.4);
  background: rgba(120, 180, 255, 0.14);
  color: rgb(205, 232, 255);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.city-help-overlay__close:hover {
  background: rgba(120, 180, 255, 0.26);
}

@media (max-width: 768px) {
  .city-camera-ui {
    left: 10px;
    bottom: 10px;
  }
  .city-camera-ui__btn {
    font-size: 10px;
    padding: 6px 9px;
  }
  .city-help-overlay__panel {
    padding: 20px;
  }
}
`;

let styleElement: HTMLStyleElement | null = null;

/** Inject the camera CSS into <head> exactly once. */
function ensureStyles(): void {
  if (styleElement) return;
  styleElement = document.createElement('style');
  styleElement.id = 'city-camera-ui-styles';
  styleElement.textContent = CAMERA_CSS;
  document.head.appendChild(styleElement);
}

// ---------------------------------------------------------------------------
// Preset + help definitions
// ---------------------------------------------------------------------------

interface PresetDef {
  readonly id: CameraPresetId;
  readonly label: string;
}

const PRESETS: readonly PresetDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'street', label: 'Street' },
  { id: 'closeup', label: 'Close-up' },
];

interface HelpRow {
  readonly keys: readonly string[];
  readonly desc: string;
}

const HELP_ROWS: readonly HelpRow[] = [
  { keys: ['Drag'], desc: 'Orbit the camera around the block' },
  { keys: ['Right-drag'], desc: 'Pan the view' },
  { keys: ['Scroll'], desc: 'Zoom in / out (smoothed)' },
  { keys: ['W', 'A', 'S', 'D'], desc: 'Pan the orbit target' },
  { keys: ['\u2190', '\u2192'], desc: 'Pan left / right' },
  { keys: ['\u2191', '\u2193'], desc: 'Move between eras on the timeline' },
  { keys: ['1', '2', '3'], desc: 'Jump to Overview / Street / Close-up' },
  { keys: ['C'], desc: 'Toggle Cinematic auto-orbit' },
  { keys: ['?'], desc: 'Toggle this help overlay' },
  { keys: ['Esc'], desc: 'Close this help overlay' },
];

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

/**
 * Mount the camera control buttons + help overlay. Returns a cleanup function.
 *
 * @param handlers  Callbacks fired on user actions.
 * @returns         Disposer — removes DOM and all listeners.
 */
export function mountCameraUI(handlers: CameraUIHandlers): () => void {
  ensureStyles();

  const container = document.createElement('div');
  container.className = 'city-camera-ui';

  // --- Preset group --------------------------------------------------------
  const presetGroup = document.createElement('div');
  presetGroup.className = 'city-camera-ui__group';

  const presetButtons = new Map<CameraPresetId, HTMLButtonElement>();
  for (const preset of PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'city-camera-ui__btn';
    btn.dataset.preset = preset.id;
    btn.textContent = preset.label;
    btn.setAttribute('aria-label', `Camera view: ${preset.label}`);
    btn.addEventListener('click', () => {
      setActivePreset(preset.id);
      handlers.onPreset(preset.id);
    });
    presetButtons.set(preset.id, btn);
    presetGroup.appendChild(btn);
  }

  // --- Cinematic toggle ----------------------------------------------------
  const cinematicGroup = document.createElement('div');
  cinematicGroup.className = 'city-camera-ui__group';

  const cinematicBtn = document.createElement('button');
  cinematicBtn.type = 'button';
  cinematicBtn.className = 'city-camera-ui__btn city-camera-ui__cinematic';
  cinematicBtn.setAttribute('aria-pressed', 'false');
  cinematicBtn.innerHTML =
    '<span class="city-camera-ui__dot"></span>Cinematic';
  cinematicBtn.addEventListener('click', () => {
    const on = handlers.onToggleCinematic();
    cinematicBtn.classList.toggle('city-camera-ui__btn--active', on);
    cinematicBtn.setAttribute('aria-pressed', String(on));
  });
  cinematicGroup.appendChild(cinematicBtn);

  // --- Help button ---------------------------------------------------------
  const helpGroup = document.createElement('div');
  helpGroup.className = 'city-camera-ui__group';

  const helpBtn = document.createElement('button');
  helpBtn.type = 'button';
  helpBtn.className = 'city-camera-ui__btn city-camera-ui__help-btn';
  helpBtn.textContent = '? Help';
  helpBtn.setAttribute('aria-label', 'Toggle controls help (question mark)');
  helpGroup.appendChild(helpBtn);

  container.appendChild(presetGroup);
  container.appendChild(cinematicGroup);
  container.appendChild(helpGroup);
  document.body.appendChild(container);

  // --- Help overlay --------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.className = 'city-help-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Camera controls help');

  const panel = document.createElement('div');
  panel.className = 'city-help-overlay__panel';

  const title = document.createElement('h2');
  title.className = 'city-help-overlay__title';
  title.textContent = 'Controls';

  const subtitle = document.createElement('p');
  subtitle.className = 'city-help-overlay__subtitle';
  subtitle.textContent =
    'Navigate, inspect, and let the scene showcase itself.';

  const list = document.createElement('ul');
  list.className = 'city-help-overlay__list';
  for (const row of HELP_ROWS) {
    const li = document.createElement('li');
    li.className = 'city-help-overlay__row';

    const keysWrap = document.createElement('span');
    keysWrap.className = 'city-help-overlay__keys';
    for (const k of row.keys) {
      const key = document.createElement('span');
      key.className = 'city-help-overlay__key';
      key.textContent = k;
      keysWrap.appendChild(key);
    }

    const desc = document.createElement('span');
    desc.className = 'city-help-overlay__desc';
    desc.textContent = row.desc;

    li.appendChild(keysWrap);
    li.appendChild(desc);
    list.appendChild(li);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'city-help-overlay__close';
  closeBtn.textContent = 'Close (Esc)';

  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(list);
  panel.appendChild(closeBtn);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // --- Overlay open/close logic -------------------------------------------
  let helpOpen = false;

  function setHelpOpen(open: boolean): void {
    helpOpen = open;
    overlay.classList.toggle('city-help-overlay--open', open);
    handlers.onToggleHelp?.(open);
  }

  function toggleHelp(): void {
    setHelpOpen(!helpOpen);
  }

  helpBtn.addEventListener('click', toggleHelp);
  closeBtn.addEventListener('click', () => setHelpOpen(false));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) setHelpOpen(false);
  });

  // --- Active preset tracking ---------------------------------------------
  function setActivePreset(id: CameraPresetId): void {
    for (const [pid, btn] of presetButtons) {
      btn.classList.toggle('city-camera-ui__btn--active', pid === id);
    }
  }

  // --- Global keyboard: '?' toggle, Esc close, 1/2/3 presets, C cinematic -
  function onGlobalKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    // '?' (Shift+/) toggles help.
    if (e.key === '?') {
      e.preventDefault();
      toggleHelp();
      return;
    }

    // Esc closes help.
    if (e.key === 'Escape' && helpOpen) {
      e.preventDefault();
      setHelpOpen(false);
      return;
    }

    // 1/2/3 → presets.
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      const map: Record<string, CameraPresetId> = {
        '1': 'overview',
        '2': 'street',
        '3': 'closeup',
      };
      const id = map[e.key];
      setActivePreset(id);
      handlers.onPreset(id);
      return;
    }

    // C → cinematic toggle.
    if (e.key === 'c' || e.key === 'C') {
      const on = handlers.onToggleCinematic();
      cinematicBtn.classList.toggle('city-camera-ui__btn--active', on);
      cinematicBtn.setAttribute('aria-pressed', String(on));
    }
  }

  window.addEventListener('keydown', onGlobalKeyDown);

  // --- Cleanup -------------------------------------------------------------
  return () => {
    window.removeEventListener('keydown', onGlobalKeyDown);
    container.remove();
    overlay.remove();
  };
}
