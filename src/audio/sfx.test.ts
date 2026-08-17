import { describe, it, expect, vi } from 'vitest';
import { AudioEngine } from './engine';

describe('SFX engine', () => {
  it('init returns false when AudioContext is unavailable', () => {
    const orig = global.AudioContext;
    // @ts-ignore - we want to simulate unavailability
    global.AudioContext = undefined;
    const eng = new AudioEngine();
    expect(eng.init()).toBe(false);
    global.AudioContext = orig;
  });

  it('isAvailable checks for AudioContext', () => {
    const eng = new AudioEngine();
    if (typeof AudioContext === 'undefined') {
      expect(eng.isAvailable()).toBe(false);
    }
  });

  it('setVolume and setMute work without init', () => {
    const eng = new AudioEngine();
    eng.setVolume(0.8);
    eng.setMuted(true);
  });

  it('destroy cleans up without error', () => {
    const eng = new AudioEngine();
    eng.destroy();
  });

  it('playClick does not throw', () => {
    const eng = new AudioEngine();
    // Should be safe even without init
    eng.playClick();
  });

  it('playWhoosh does not throw', () => {
    const eng = new AudioEngine();
    eng.playWhoosh();
  });
});
