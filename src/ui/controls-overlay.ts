// ─── Controls Overlay ───────────────────────────────────────────────
// Sound toggle, camera reset button, and help overlay (H key).
// Does NOT import scene modules — only DOM manipulation and events.

import './ui.css';

// ── SfxMixer type contract ──────────────────────────────────────────
// This module does not import SfxMixer directly; instead it accepts a
// reference at mount time so the dependency is injected by the host app.

export interface SfxMixerLike {
  muted: boolean;
  setMuted(mute: boolean): void;
}

// ── Events ──────────────────────────────────────────────────────────

export interface CameraResetEvent extends CustomEvent<void> {
  type: 'camerareset';
}

export class CameraResetEvent extends Event {
  constructor() {
    super('camerareset', { bubbles: true });
  }
}

// ── Help state ──────────────────────────────────────────────────────

let helpVisible = false;

// ── DOM Construction ────────────────────────────────────────────────

function buildSoundToggle(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'control-btn sound-toggle';
  btn.id = 'sound-toggle';
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-label', 'Toggle sound');
  btn.title = 'Toggle Sound (S)';

  const icon = document.createElement('span');
  icon.className = 'sound-mute-indicator';
  icon.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
  `;
  btn.appendChild(icon);

  return btn;
}

function buildCameraResetBtn(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'control-btn camera-reset-btn';
  btn.id = 'camera-reset';
  btn.setAttribute('aria-label', 'Reset camera view');
  btn.title = 'Reset Camera (R)';

  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
      <path d="M3 3v5h5"></path>
    </svg>
  `;

  return btn;
}

function buildHelpOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.id = 'help-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Navigation Help');

  const panel = document.createElement('div');
  panel.className = 'help-panel';

  const title = document.createElement('div');
  title.className = 'help-title';
  title.textContent = 'Navigation Help';

  // Keyboard section
  const navSection = document.createElement('div');
  navSection.className = 'help-section';
  navSection.innerHTML = `
    <div class="help-section-title">Timeline Navigation</div>
    <div class="help-row">
      <span class="help-key">← →</span>
      <span class="help-label">Move between eras</span>
    </div>
    <div class="help-row">
      <span class="help-key">Click / Drag</span>
      <span class="help-label">Jump to specific era</span>
    </div>
  `;

  // Toggle section
  const toggleSection = document.createElement('div');
  toggleSection.className = 'help-section';
  toggleSection.innerHTML = `
    <div class="help-section-title">Controls</div>
    <div class="help-row">
      <span class="help-key">H</span>
      <span class="help-label">Toggle help overlay</span>
    </div>
    <div class="help-row">
      <span class="help-key">S</span>
      <span class="help-label">Toggle sound on/off</span>
    </div>
    <div class="help-row">
      <span class="help-key">R</span>
      <span class="help-label">Reset camera position</span>
    </div>
  `;

  const closeHint = document.createElement('div');
  closeHint.className = 'help-close-hint';
  closeHint.textContent = 'Press H or Escape to close';

  panel.appendChild(title);
  panel.appendChild(navSection);
  panel.appendChild(toggleSection);
  panel.appendChild(closeHint);

  overlay.appendChild(panel);

  return overlay;
}

// ── Mount ───────────────────────────────────────────────────────────

let container: HTMLElement | null = null;
let soundToggleEl: HTMLButtonElement | null = null;
let cameraResetEl: HTMLButtonElement | null = null;
let helpOverlayEl: HTMLElement | null = null;
let sfxMixerRef: SfxMixerLike | null = null;

/**
 * Inject the SFX mixer reference. Called after mount when the host app
 * has created its SfxMixer instance.
 */
export function injectSfxMixer(mixer: SfxMixerLike): void {
  sfxMixerRef = mixer;
  updateSoundUI();
}

function updateSoundUI(): void {
  if (!soundToggleEl || !sfxMixerRef) return;
  const muted = sfxMixerRef.muted;
  soundToggleEl.classList.toggle('muted', muted);
  soundToggleEl.setAttribute('aria-pressed', String(!muted));
  soundToggleEl.setAttribute('aria-label', muted ? 'Sound off — click to enable' : 'Sound on — click to mute');
  soundToggleEl.title = muted ? 'Enable Sound (S)' : 'Mute Sound (S)';
}

function toggleSound(): void {
  if (!sfxMixerRef) return;
  const newState = !sfxMixerRef.muted;
  sfxMixerRef.setMuted(newState);
  updateSoundUI();
}

function showHelp(): void {
  helpVisible = true;
  helpOverlayEl?.classList.add('visible');
  // Focus the overlay panel for accessibility
  helpOverlayEl?.setAttribute('aria-hidden', 'false');
}

function hideHelp(): void {
  helpVisible = false;
  helpOverlayEl?.classList.remove('visible');
  helpOverlayEl?.setAttribute('aria-hidden', 'true');
}

function toggleHelp(): void {
  helpVisible ? hideHelp() : showHelp();
}

function handleCameraReset(): void {
  container?.dispatchEvent(new CameraResetEvent());
}

export function mountControls(parent?: HTMLElement): HTMLElement {
  container = document.createElement('div');
  container.className = 'controls-overlay-wrapper';
  container.style.position = 'absolute';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '100';

  // ── Controls row (bottom-right) ─────────────────────────────────
  const controlsRow = document.createElement('div');
  controlsRow.className = 'controls-overlay';
  controlsRow.style.position = 'absolute';
  controlsRow.style.bottom = '16px';
  controlsRow.style.right = '16px';
  controlsRow.style.display = 'flex';
  controlsRow.style.flexDirection = 'column';
  controlsRow.style.gap = '8px';
  controlsRow.style.alignItems = 'flex-end';

  soundToggleEl = buildSoundToggle();
  cameraResetEl = buildCameraResetBtn();

  soundToggleEl.addEventListener('click', toggleSound);
  cameraResetEl.addEventListener('click', handleCameraReset);

  controlsRow.appendChild(soundToggleEl);
  controlsRow.appendChild(cameraResetEl);

  // ── Help overlay ────────────────────────────────────────────────
  helpOverlayEl = buildHelpOverlay();
  helpOverlayEl.addEventListener('click', (e) => {
    // Close when clicking outside the panel
    if (e.target === helpOverlayEl) hideHelp();
  });

  container.appendChild(controlsRow);
  container.appendChild(helpOverlayEl);

  (parent ?? document.body).appendChild(container);

  // Set initial sound state
  updateSoundUI();

  // Global keyboard handler for H/S/R
  initGlobalKeys();

  return container;
}

function initGlobalKeys(): void {
  document.addEventListener('keydown', (e) => {
    // Don't capture keys when typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      toggleHelp();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toggleSound();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      handleCameraReset();
    } else if (e.key === 'Escape' && helpVisible) {
      e.preventDefault();
      hideHelp();
    }
  });
}

/** Remove all control elements from the DOM. */
export function unmountControls(): void {
  container?.remove();
  container = null;
  soundToggleEl = null;
  cameraResetEl = null;
  helpOverlayEl = null;
  sfxMixerRef = null;
  helpVisible = false;
}
