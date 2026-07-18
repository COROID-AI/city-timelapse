import { useEraStore } from './store';
import { ERAS } from './era-data';

/**
 * Procedural ambient + transition audio engine.
 *
 * Everything is synthesized with the Web Audio API — no external assets.
 * Audio is autoplay-gated: nothing sounds until the first user gesture
 * unlocks the context (handled in {@link App}). Muting is reflected by a
 * master gain that is ramped to 0 so transitions stay smooth.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let started = false;
let prevTargetForSfx = 0;

/** Lazily create (or resume) the AudioContext after a user gesture. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const m = ctx.createGain();
    m.gain.value = 0;
    m.connect(ctx.destination);
    master = m;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function startAmbient(): void {
  const c = ctx;
  const m = master;
  if (!c || !m || started) return;
  started = true;

  // Low drone: two detuned oscillators through a low-pass filter.
  const droneGain = c.createGain();
  droneGain.gain.value = 0.05;
  const droneFilter = c.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 320;
  droneFilter.Q.value = 0.7;
  droneFilter.connect(droneGain);
  droneGain.connect(m);

  const o1 = c.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = 55;
  const o2 = c.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = 55.6;
  o1.connect(droneFilter);
  o2.connect(droneFilter);
  o1.start();
  o2.start();

  // Slow LFO on the filter for movement.
  const lfo = c.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 120;
  lfo.connect(lfoGain);
  lfoGain.connect(droneFilter.frequency);
  lfo.start();

  // Soft airy noise bed via a looping buffer.
  const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 600;
  noiseFilter.Q.value = 0.4;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.012;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(m);
  noise.start();
}

/** Play a short "whoosh/chime" transition SFX. */
function playTransitionSfx(direction: number): void {
  const c = ctx;
  const m = master;
  if (!c || !m) return;
  const now = c.currentTime;
  const dir = direction >= 0 ? 1 : -1;

  // Whoosh: filtered noise sweep.
  const dur = 1.2;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass';
  filt.Q.value = 1.2;
  const startF = dir > 0 ? 400 : 1800;
  const endF = dir > 0 ? 1800 : 400;
  filt.frequency.setValueAtTime(startF, now);
  filt.frequency.exponentialRampToValueAtTime(endF, now + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(m);
  src.start(now);
  src.stop(now + dur + 0.05);

  // Bright chime — two notes in the direction of travel.
  const chime = (freq: number, at: number) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const cg = c.createGain();
    cg.gain.setValueAtTime(0.0001, now + at);
    cg.gain.exponentialRampToValueAtTime(0.07, now + at + 0.03);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
    osc.connect(cg);
    cg.connect(m);
    osc.start(now + at);
    osc.stop(now + at + 0.55);
  };
  const base = dir > 0 ? 440 : 587;
  chime(base, 0.1);
  chime(base * 1.5, 0.22);
}

/** Subscribe to store changes to drive SFX and mute. Call once at app start. */
export function wireAudio(): () => void {
  let firstReady = false;
  const unsubReady = useEraStore.subscribe((s) => {
    if (s.ready && !firstReady) {
      firstReady = true;
      startAmbient();
      applyMute(s.muted);
    }
  });

  let lastMuted = useEraStore.getState().muted;
  const unsubMute = useEraStore.subscribe((s) => {
    if (s.muted !== lastMuted) {
      lastMuted = s.muted;
      applyMute(s.muted);
    }
  });

  const unsubTarget = useEraStore.subscribe((s, prev) => {
    if (s.targetEra !== prev.targetEra) {
      playTransitionSfx(s.targetEra - prevTargetForSfx);
      prevTargetForSfx = s.targetEra;
    }
  });
  prevTargetForSfx = useEraStore.getState().targetEra;

  return () => {
    unsubReady();
    unsubMute();
    unsubTarget();
  };
}

function applyMute(muted: boolean): void {
  const c = ctx;
  const m = master;
  if (!c || !m) return;
  const now = c.currentTime;
  m.gain.cancelScheduledValues(now);
  m.gain.setValueAtTime(m.gain.value, now);
  m.gain.linearRampToValueAtTime(muted ? 0 : 0.9, now + 0.2);
}

/** Play the transition SFX immediately (used after first unlock gesture). */
export function triggerUnlockChime(): void {
  unlockAudio();
  startAmbient();
  applyMute(useEraStore.getState().muted);
}

export const ERA_LABELS = ERAS.map((e) => e.label);
