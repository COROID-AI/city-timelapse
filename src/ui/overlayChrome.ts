import { EraState } from '../types/era';
import { eraRegistry } from '../state/eraRegistry';
import { SfxContext } from '../audio/sfxContext';
import { CameraRig } from '../camera/cameraRig';
import { EraYear } from '../types/city';

/**
 * Storage key for persisted audio mute preference.
 */
export const SFX_MUTE_STORAGE_KEY = 'city-timelapse-sfx-mute';

/**
 * Era accent color mapping.
 * Shifts with the current era label from EraRegistry:
 * - 1945: warm sepia (#b08968 / #c9a67a)
 * - 1965: warm mid-century (#d4a373)
 * - 1985: saturated teal / magenta (#ff007f / #00f0ff / #7f9cf5)
 * - 2005: contemporary cyan (#38bdf8)
 * - 2025: cool crisp white / lime (#f8fafc / #a3e635)
 */
export const ERA_ACCENT_MAP: Record<EraYear, { primary: string; glow: string; text: string; bg: string }> = {
  1945: {
    primary: '#c9a67a', // warm sepia
    glow: 'rgba(201, 166, 122, 0.4)',
    text: '#f5ebe0',
    bg: 'rgba(38, 28, 20, 0.85)',
  },
  1965: {
    primary: '#d4a373',
    glow: 'rgba(212, 163, 115, 0.4)',
    text: '#faedcd',
    bg: 'rgba(40, 32, 24, 0.85)',
  },
  1985: {
    primary: '#00f0ff', // saturated teal/magenta neon
    glow: 'rgba(255, 0, 128, 0.5)',
    text: '#ff007f',
    bg: 'rgba(20, 10, 35, 0.88)',
  },
  2005: {
    primary: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.4)',
    text: '#e0f2fe',
    bg: 'rgba(15, 23, 42, 0.85)',
  },
  2025: {
    primary: '#f8fafc', // cool white
    glow: 'rgba(248, 250, 252, 0.5)',
    text: '#ffffff',
    bg: 'rgba(15, 23, 42, 0.85)',
  },
};

export interface OverlayChromeOptions {
  overlayRoot: HTMLElement;
  eraState: EraState;
  sfxContext?: SfxContext | null;
  cameraRig?: CameraRig | null;
  storage?: Storage | null;
}

export interface OverlayChrome {
  readonly element: HTMLDivElement;
  readonly muteButton: HTMLButtonElement;
  readonly cameraModeButton: HTMLButtonElement;
  readonly helpButton: HTMLButtonElement;
  readonly helpModal: HTMLDivElement;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  isHelpOpen(): boolean;
  openHelp(): void;
  closeHelp(): void;
  syncTheming(): void;
  dispose(): void;
}

/**
 * Creates the unified overlay chrome controls (Mute, Camera Mode, Help)
 * with era-themed accents, ARIA accessibility, keyboard modal controls (ESC close),
 * and persisted mute preference.
 */
export function createOverlayChrome(options: OverlayChromeOptions): OverlayChrome {
  const {
    overlayRoot,
    eraState,
    sfxContext = null,
    cameraRig = null,
    storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : null,
  } = options;

  // Root container for chrome buttons
  const container = document.createElement('div');
  container.className = 'overlay-chrome';
  container.setAttribute('role', 'toolbar');
  container.setAttribute('aria-label', 'Scene controls');
  container.style.position = 'absolute';
  container.style.top = '14px';
  container.style.right = '16px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';
  container.style.pointerEvents = 'auto';
  container.style.zIndex = '50';

  // Inject common base styling for chrome buttons
  const baseButtonStyle = (btn: HTMLButtonElement) => {
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.minWidth = '36px';
    btn.style.height = '36px';
    btn.style.padding = '0 12px';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    btn.style.borderRadius = '8px';
    btn.style.background = 'rgba(10, 12, 18, 0.75)';
    btn.style.color = '#e6e6e6';
    btn.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    btn.style.fontSize = '13px';
    btn.style.fontWeight = '600';
    btn.style.cursor = 'pointer';
    btn.style.userSelect = 'none';
    btn.style.transition = 'all 0.2s ease';
    btn.style.backdropFilter = 'blur(6px)';
    btn.style.outline = 'none';

    btn.addEventListener('focus', () => {
      btn.style.boxShadow = `0 0 0 2px rgba(255, 255, 255, 0.5)`;
    });
    btn.addEventListener('blur', () => {
      btn.style.boxShadow = 'none';
    });
  };

  // 1. Mute/Unmute state & button
  let muted = false;
  if (storage) {
    try {
      const saved = storage.getItem(SFX_MUTE_STORAGE_KEY);
      if (saved !== null) {
        muted = saved === 'true';
      }
    } catch {
      // ignore storage error
    }
  }

  // Intercept blip on sfxContext if muted
  let originalBlip: ((freq?: number) => void) | null = null;
  if (sfxContext) {
    originalBlip = sfxContext.blip.bind(sfxContext);
    sfxContext.blip = (freq?: number) => {
      if (muted) return;
      if (originalBlip) originalBlip(freq);
    };
  }

  const muteBtn = document.createElement('button');
  muteBtn.className = 'overlay-btn mute-btn';
  muteBtn.type = 'button';
  muteBtn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
  muteBtn.setAttribute('aria-pressed', String(muted));
  baseButtonStyle(muteBtn);

  const updateMuteUi = () => {
    muteBtn.setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.innerHTML = muted
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg><span style="margin-left:6px;">Muted</span>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg><span style="margin-left:6px;">Sound</span>`;
  };
  updateMuteUi();

  const setMuted = (value: boolean) => {
    muted = value;
    if (storage) {
      try {
        storage.setItem(SFX_MUTE_STORAGE_KEY, String(muted));
      } catch {
        // ignore
      }
    }
    updateMuteUi();
  };

  muteBtn.addEventListener('click', () => {
    setMuted(!muted);
  });

  // 2. Camera Mode Toggle (Free-Fly vs Orbit)
  const cameraBtn = document.createElement('button');
  cameraBtn.className = 'overlay-btn camera-mode-btn';
  cameraBtn.type = 'button';
  baseButtonStyle(cameraBtn);

  const updateCameraUi = () => {
    const isOrbit = cameraRig ? cameraRig.orbiting : false;
    cameraBtn.setAttribute('aria-label', isOrbit ? 'Switch to Free-fly camera mode' : 'Switch to Orbit camera mode');
    cameraBtn.setAttribute('aria-pressed', String(isOrbit));
    cameraBtn.innerHTML = isOrbit
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3.6 9h16.8M3.6 15h16.8"></path></svg><span style="margin-left:6px;">Orbit</span>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg><span style="margin-left:6px;">Free</span>`;
  };
  updateCameraUi();

  cameraBtn.addEventListener('click', () => {
    if (cameraRig) {
      if (cameraRig.orbiting) {
        cameraRig.stopOrbit();
      } else {
        cameraRig.startOrbit();
      }
    }
    updateCameraUi();
  });

  // 3. Help modal & Help button ('?')
  const helpBtn = document.createElement('button');
  helpBtn.className = 'overlay-btn help-btn';
  helpBtn.type = 'button';
  helpBtn.setAttribute('aria-label', 'Open navigation controls help');
  helpBtn.setAttribute('aria-haspopup', 'dialog');
  baseButtonStyle(helpBtn);
  helpBtn.style.padding = '0';
  helpBtn.style.width = '36px';
  helpBtn.textContent = '?';

  // Help Modal DOM
  const modalBackdrop = document.createElement('div');
  modalBackdrop.className = 'help-modal-backdrop';
  modalBackdrop.style.position = 'fixed';
  modalBackdrop.style.inset = '0';
  modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
  modalBackdrop.style.backdropFilter = 'blur(4px)';
  modalBackdrop.style.display = 'none';
  modalBackdrop.style.alignItems = 'center';
  modalBackdrop.style.justifyContent = 'center';
  modalBackdrop.style.zIndex = '1000';
  modalBackdrop.style.pointerEvents = 'auto';

  const modalDialog = document.createElement('div');
  modalDialog.className = 'help-modal-dialog';
  modalDialog.setAttribute('role', 'dialog');
  modalDialog.setAttribute('aria-modal', 'true');
  modalDialog.setAttribute('aria-labelledby', 'help-dialog-title');
  modalDialog.style.width = '90%';
  modalDialog.style.maxWidth = '460px';
  modalDialog.style.backgroundColor = 'rgba(15, 20, 28, 0.95)';
  modalDialog.style.border = '1px solid rgba(255, 255, 255, 0.2)';
  modalDialog.style.borderRadius = '12px';
  modalDialog.style.padding = '24px';
  modalDialog.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.6)';
  modalDialog.style.color = '#e6e6e6';
  modalDialog.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  modalDialog.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <h2 id="help-dialog-title" style="margin:0; font-size:18px; font-weight:700; color:#fff;">Scene Controls & Navigation</h2>
      <button class="help-close-btn" type="button" aria-label="Close help modal" style="background:transparent; border:none; color:#aaa; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1; border-radius:4px;">✕</button>
    </div>
    <div style="font-size:14px; line-height:1.6; color:#cfd3d8;">
      <div style="margin-bottom:12px;">
        <strong style="color:#fff;">Keyboard:</strong>
        <ul style="margin:4px 0 8px 20px; padding:0;">
          <li><kbd style="background:rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px;">W</kbd> <kbd style="background:rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px;">A</kbd> <kbd style="background:rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px;">S</kbd> <kbd style="background:rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px;">D</kbd> : Move camera in free-fly mode</li>
          <li><kbd style="background:rgba(255,255,255,0.15); padding:2px 6px; border-radius:4px;">ESC</kbd> : Close this help dialog</li>
        </ul>
      </div>
      <div style="margin-bottom:12px;">
        <strong style="color:#fff;">Mouse / Pointer:</strong>
        <ul style="margin:4px 0 8px 20px; padding:0;">
          <li>Click &amp; Drag on scene: Look around</li>
        </ul>
      </div>
      <div style="margin-bottom:12px;">
        <strong style="color:#fff;">Touch / Mobile:</strong>
        <ul style="margin:4px 0 8px 20px; padding:0;">
          <li>Joystick (bottom-left): Move camera in free-fly mode</li>
        </ul>
      </div>
      <div>
        <strong style="color:#fff;">Timeline &amp; Audio:</strong>
        <ul style="margin:4px 0 0 20px; padding:0;">
          <li>Top slider: Switch between 1945, 1965, 1985, 2005, and 2025 eras</li>
          <li>Sound button: Toggle audio sound effects</li>
          <li>Orbit / Free button: Toggle automated orbit camera</li>
        </ul>
      </div>
    </div>
  `;

  modalBackdrop.appendChild(modalDialog);
  overlayRoot.appendChild(modalBackdrop);

  const closeBtn = modalDialog.querySelector('.help-close-btn') as HTMLButtonElement;

  let helpOpen = false;

  const openHelp = () => {
    helpOpen = true;
    modalBackdrop.style.display = 'flex';
    closeBtn.focus();
  };

  const closeHelp = () => {
    helpOpen = false;
    modalBackdrop.style.display = 'none';
    helpBtn.focus();
  };

  helpBtn.addEventListener('click', () => {
    openHelp();
  });

  closeBtn.addEventListener('click', () => {
    closeHelp();
  });

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) {
      closeHelp();
    }
  });

  const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && helpOpen) {
      closeHelp();
      e.stopPropagation();
    }
  };
  window.addEventListener('keydown', onKeydown);

  // 4. Era-themed accents styling
  const syncTheming = () => {
    const currentYear = eraState.year;
    const meta = eraRegistry.find(currentYear);
    const customPalette = ERA_ACCENT_MAP[currentYear as EraYear];
    const accent = customPalette ? customPalette.primary : (meta?.accentColor || '#ffffff');
    const glow = customPalette ? customPalette.glow : 'rgba(255,255,255,0.3)';

    [muteBtn, cameraBtn, helpBtn].forEach((btn) => {
      btn.style.borderColor = accent;
      btn.style.color = '#ffffff';
    });

    // Style help button icon / text specifically
    helpBtn.style.color = accent;
    helpBtn.style.boxShadow = `0 0 8px ${glow}`;
    muteBtn.style.boxShadow = `0 0 6px ${glow}`;
    cameraBtn.style.boxShadow = `0 0 6px ${glow}`;

    modalDialog.style.borderColor = accent;
    modalDialog.style.boxShadow = `0 8px 30px ${glow}`;
    const titleEl = modalDialog.querySelector('#help-dialog-title') as HTMLElement | null;
    if (titleEl) {
      titleEl.style.color = accent;
    }
  };

  const unsubscribeEra = eraState.subscribe(() => {
    syncTheming();
  });

  syncTheming();

  // Mount buttons into container
  container.appendChild(muteBtn);
  container.appendChild(cameraBtn);
  container.appendChild(helpBtn);
  overlayRoot.appendChild(container);

  return {
    element: container,
    muteButton: muteBtn,
    cameraModeButton: cameraBtn,
    helpButton: helpBtn,
    helpModal: modalBackdrop,
    isMuted() {
      return muted;
    },
    setMuted,
    isHelpOpen() {
      return helpOpen;
    },
    openHelp,
    closeHelp,
    syncTheming,
    dispose() {
      unsubscribeEra();
      window.removeEventListener('keydown', onKeydown);
      if (sfxContext && originalBlip) {
        sfxContext.blip = originalBlip;
      }
      container.remove();
      modalBackdrop.remove();
    },
  };
}
