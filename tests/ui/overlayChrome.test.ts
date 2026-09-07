/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createOverlayChrome, SFX_MUTE_STORAGE_KEY } from '../../src/ui/overlayChrome';
import { createEraState } from '../../src/state/eraState';
import { SfxContext } from '../../src/audio/sfxContext';
import { CameraRig } from '../../src/camera/cameraRig';
import { Vector3 } from 'three';

describe('OverlayChrome Unit Tests', () => {
  let root: HTMLElement;
  let mockStorage: Storage;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    mockStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: (_i: number) => null,
      length: 0,
    };
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('renders toolbar with ARIA roles and correct buttons', () => {
    const eraState = createEraState(1945);
    const chrome = createOverlayChrome({
      overlayRoot: root,
      eraState,
      storage: mockStorage,
    });

    expect(chrome.element.getAttribute('role')).toBe('toolbar');
    expect(chrome.element.getAttribute('aria-label')).toBe('Scene controls');
    expect(chrome.muteButton).toBeTruthy();
    expect(chrome.cameraModeButton).toBeTruthy();
    expect(chrome.helpButton).toBeTruthy();

    expect(chrome.helpModal.querySelector('[role="dialog"]')).toBeTruthy();
    expect(chrome.helpModal.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(chrome.helpButton.getAttribute('aria-haspopup')).toBe('dialog');

    chrome.dispose();
  });

  it('wires mute/unmute button with SfxContext and persists preference', () => {
    let blipCount = 0;
    const mockSfx: SfxContext = {
      initialized: true,
      blip: vi.fn(() => {
        blipCount++;
      }),
      dispose: vi.fn(),
    };

    const eraState = createEraState(1945);
    const chrome = createOverlayChrome({
      overlayRoot: root,
      eraState,
      sfxContext: mockSfx,
      storage: mockStorage,
    });

    expect(chrome.isMuted()).toBe(false);
    expect(chrome.muteButton.getAttribute('aria-pressed')).toBe('false');

    // Test blip when unmuted
    mockSfx.blip(440);
    expect(blipCount).toBe(1);

    // Click mute
    chrome.muteButton.click();
    expect(chrome.isMuted()).toBe(true);
    expect(chrome.muteButton.getAttribute('aria-pressed')).toBe('true');
    expect(mockStorage.getItem(SFX_MUTE_STORAGE_KEY)).toBe('true');

    // Test blip when muted -> should be suppressed
    mockSfx.blip(440);
    expect(blipCount).toBe(1);

    chrome.dispose();

    // Recreate overlay with same storage -> should restore muted state
    const chrome2 = createOverlayChrome({
      overlayRoot: root,
      eraState,
      sfxContext: mockSfx,
      storage: mockStorage,
    });
    expect(chrome2.isMuted()).toBe(true);
    expect(chrome2.muteButton.getAttribute('aria-pressed')).toBe('true');

    chrome2.muteButton.click();
    expect(chrome2.isMuted()).toBe(false);
    expect(mockStorage.getItem(SFX_MUTE_STORAGE_KEY)).toBe('false');

    chrome2.dispose();
  });

  it('wires camera-mode toggle to CameraRig (orbit vs free-fly)', () => {
    let isOrbiting = false;
    const mockCameraRig: CameraRig = {
      update: vi.fn(),
      look: vi.fn(),
      setJoystick: vi.fn(),
      startOrbit: vi.fn(() => {
        isOrbiting = true;
      }),
      stopOrbit: vi.fn(() => {
        isOrbiting = false;
      }),
      get orbiting() {
        return isOrbiting;
      },
      position: new Vector3(),
      dispose: vi.fn(),
    };

    const eraState = createEraState(1945);
    const chrome = createOverlayChrome({
      overlayRoot: root,
      eraState,
      cameraRig: mockCameraRig,
      storage: mockStorage,
    });

    expect(chrome.cameraModeButton.getAttribute('aria-pressed')).toBe('false');
    expect(chrome.cameraModeButton.textContent).toContain('Free');

    // Click to switch to Orbit
    chrome.cameraModeButton.click();
    expect(mockCameraRig.startOrbit).toHaveBeenCalled();
    expect(chrome.cameraModeButton.getAttribute('aria-pressed')).toBe('true');
    expect(chrome.cameraModeButton.textContent).toContain('Orbit');

    // Click to switch to Free-fly
    chrome.cameraModeButton.click();
    expect(mockCameraRig.stopOrbit).toHaveBeenCalled();
    expect(chrome.cameraModeButton.getAttribute('aria-pressed')).toBe('false');
    expect(chrome.cameraModeButton.textContent).toContain('Free');

    chrome.dispose();
  });

  it('handles help modal open, close via close button, click backdrop, and ESC key', () => {
    const eraState = createEraState(1945);
    const chrome = createOverlayChrome({
      overlayRoot: root,
      eraState,
      storage: mockStorage,
    });

    expect(chrome.isHelpOpen()).toBe(false);
    expect(chrome.helpModal.style.display).toBe('none');

    // Click help button
    chrome.helpButton.click();
    expect(chrome.isHelpOpen()).toBe(true);
    expect(chrome.helpModal.style.display).toBe('flex');

    // Close via close button
    const closeBtn = chrome.helpModal.querySelector('.help-close-btn') as HTMLButtonElement;
    closeBtn.click();
    expect(chrome.isHelpOpen()).toBe(false);
    expect(chrome.helpModal.style.display).toBe('none');

    // Re-open
    chrome.openHelp();
    expect(chrome.isHelpOpen()).toBe(true);

    // Close via backdrop click
    chrome.helpModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(chrome.isHelpOpen()).toBe(false);

    // Re-open and close via ESC key
    chrome.openHelp();
    expect(chrome.isHelpOpen()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(chrome.isHelpOpen()).toBe(false);

    chrome.dispose();
  });

  it('updates accent colors dynamically on era change', () => {
    const eraState = createEraState(1945);
    const chrome = createOverlayChrome({
      overlayRoot: root,
      eraState,
      storage: mockStorage,
    });

    const border1945 = chrome.helpButton.style.borderColor;
    expect(border1945).toBeTruthy();

    // Switch to 1985 (teal/magenta)
    eraState.setYear(1985);
    const border1985 = chrome.helpButton.style.borderColor;
    expect(border1985).not.toBe(border1945);
    expect(border1985).toMatch(/(#00f0ff|rgb\(0,\s*240,\s*255\))/);

    // Switch to 2025 (cool white)
    eraState.setYear(2025);
    const border2025 = chrome.helpButton.style.borderColor;
    expect(border2025).not.toBe(border1985);
    expect(border2025).toMatch(/(#f8fafc|rgb\(248,\s*250,\s*252\))/);

    chrome.dispose();
  });
});
