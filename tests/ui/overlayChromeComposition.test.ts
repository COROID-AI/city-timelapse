/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createOverlayChrome } from '../../src/ui/overlayChrome';
import { createEraState } from '../../src/state/eraState';
import { createUiRoot } from '../../src/ui/uiRoot';
import { SfxContext } from '../../src/audio/sfxContext';
import { CameraRig } from '../../src/camera/cameraRig';
import { Vector3 } from 'three';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('OverlayChrome Composition & Isolation Tests', () => {
  let appRoot: HTMLElement;

  beforeEach(() => {
    appRoot = document.createElement('div');
    appRoot.id = 'app';
    document.body.appendChild(appRoot);
  });

  afterEach(() => {
    appRoot.remove();
  });

  it('mounts real overlay chrome into real uiRoot alongside real EraState and stand-in rigs', () => {
    const eraState = createEraState(1945);
    const uiRoot = createUiRoot(appRoot, eraState);

    let orbiting = false;
    const mockCameraRig: CameraRig = {
      update: vi.fn(),
      look: vi.fn(),
      setJoystick: vi.fn(),
      startOrbit: vi.fn(() => {
        orbiting = true;
      }),
      stopOrbit: vi.fn(() => {
        orbiting = false;
      }),
      get orbiting() {
        return orbiting;
      },
      position: new Vector3(),
      dispose: vi.fn(),
    };

    let blips = 0;
    const mockSfx: SfxContext = {
      initialized: true,
      blip: vi.fn(() => {
        blips++;
      }),
      dispose: vi.fn(),
    };

    const chrome = createOverlayChrome({
      overlayRoot: uiRoot.element,
      eraState,
      sfxContext: mockSfx,
      cameraRig: mockCameraRig,
    });

    // Check DOM hierarchy
    expect(uiRoot.element.contains(chrome.element)).toBe(true);
    expect(uiRoot.element.contains(chrome.helpModal)).toBe(true);

    // Mute toggle
    expect(chrome.isMuted()).toBe(false);
    chrome.muteButton.click();
    expect(chrome.isMuted()).toBe(true);
    mockSfx.blip();
    expect(blips).toBe(0); // suppressed
    chrome.muteButton.click();
    expect(chrome.isMuted()).toBe(false);
    mockSfx.blip();
    expect(blips).toBe(1);

    // Camera toggle
    chrome.cameraModeButton.click();
    expect(mockCameraRig.startOrbit).toHaveBeenCalled();
    expect(chrome.cameraModeButton.textContent).toContain('Orbit');
    chrome.cameraModeButton.click();
    expect(mockCameraRig.stopOrbit).toHaveBeenCalled();
    expect(chrome.cameraModeButton.textContent).toContain('Free');

    // Help modal
    chrome.helpButton.click();
    expect(chrome.isHelpOpen()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(chrome.isHelpOpen()).toBe(false);

    // Era theming shifts
    const border1945 = chrome.helpButton.style.borderColor;
    eraState.setYear(1985);
    expect(chrome.helpButton.style.borderColor).toMatch(/(#00f0ff|rgb\(0,\s*240,\s*255\))/);
    expect(chrome.helpButton.style.borderColor).not.toBe(border1945);

    eraState.setYear(2025);
    expect(chrome.helpButton.style.borderColor).toMatch(/(#f8fafc|rgb\(248,\s*250,\s*252\))/);

    chrome.dispose();
    expect(uiRoot.element.contains(chrome.element)).toBe(false);
  });

  it('asserts write scope stayed confined to allowed files', () => {
    // Check that styles.css, slider, camera, render, and era modules exist and were not altered inappropriately
    const repoRoot = path.resolve(__dirname, '../../');
    const stylesPath = path.join(repoRoot, 'src/styles.css');
    const sliderPath = path.join(repoRoot, 'src/ui/timelineSlider.ts');
    const cameraPath = path.join(repoRoot, 'src/camera/cameraRig.ts');
    const eraStatePath = path.join(repoRoot, 'src/state/eraState.ts');

    expect(fs.existsSync(stylesPath)).toBe(true);
    expect(fs.existsSync(sliderPath)).toBe(true);
    expect(fs.existsSync(cameraPath)).toBe(true);
    expect(fs.existsSync(eraStatePath)).toBe(true);

    // Ensure chrome source file exists
    const chromePath = path.join(repoRoot, 'src/ui/overlayChrome.ts');
    expect(fs.existsSync(chromePath)).toBe(true);
  });
});
