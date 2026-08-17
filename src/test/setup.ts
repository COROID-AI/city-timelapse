import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Three.js WebWorker usage
vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  return actual;
});

// Mock AudioContext for tests
if (typeof window !== 'undefined' && !window.AudioContext) {
  // @ts-ignore
  window.AudioContext = class MockAudioContext {
    state = 'closed';
    destination = {} as any;
    createGain() { return { connect: vi.fn(), gain: { value: 1 } }; }
    createOscillator() { return { type: 'sine', frequency: { value: 440 }, start: vi.fn(), stop: vi.fn(), connect: vi.fn() }; }
    createBufferSource() { return { buffer: null, loop: false, start: vi.fn(), connect: vi.fn() }; }
    createBiquadFilter() { return { type: 'lowpass', frequency: { value: 1000 }, Q: { value: 1 }, connect: vi.fn() }; }
    createScriptProcessor() { return {}; }
    createAnalyser() { return {}; }
    currentTime = 0;
    sampleRate = 44100;
    close() { return Promise.resolve(); }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
  };
}
