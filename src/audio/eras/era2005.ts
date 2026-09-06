/**
 * 2005 ambient soundscape.
 *
 * A mid-2000s block: ringtone snippets, bus hiss, and modern traffic. Fully
 * synthesized — no audio files.
 */
import type { AmbientHandle, EraAudioLayer, SfxTrigger } from './types';
import { makeSfx, noiseBed } from './helpers';

/** Build the continuous 2005 ambient bed. */
function createAmbient(ctx: AudioContext, out: AudioNode): AmbientHandle {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(out);

  // --- Modern traffic (smoother, less rumbly than 1985 — more sedans) ---
  const trafficMix = ctx.createGain();
  trafficMix.gain.value = 0.38;
  trafficMix.connect(master);

  const rumble = ctx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 82; // higher, smoother pitch
  const rumble2 = ctx.createOscillator();
  rumble2.type = 'sawtooth';
  rumble2.frequency.value = 88;
  const rGain = ctx.createGain();
  rGain.gain.value = 0.28;
  const rGain2 = ctx.createGain();
  rGain2.gain.value = 0.28;
  rumble.connect(rGain);
  rumble2.connect(rGain2);
  rGain.connect(trafficMix);
  rGain2.connect(trafficMix);

  const road = noiseBed(ctx, 480, 0.6, 0.2);
  road.node.connect(trafficMix);

  // --- Bus hiss: a mid-frequency air noise that gently breathes ---
  const bus = ctx.createGain();
  bus.gain.value = 0.16;
  bus.connect(master);
  const hiss = noiseBed(ctx, 1400, 0.9, 0.35);
  hiss.node.connect(bus);
  // Slow amplitude LFO on the hiss so it feels like an idling air brake.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain);
  lfoGain.connect(bus.gain);

  // --- Ringtone melody loop (distant, in a pocket) ---
  const ring = ctx.createGain();
  ring.gain.value = 0.05;
  ring.connect(master);
  const melody = ctx.createOscillator();
  melody.type = 'sine';
  melody.frequency.value = 1046; // C6
  const melodyGain = ctx.createGain();
  melodyGain.gain.value = 0.4;
  melody.connect(melodyGain);
  melodyGain.connect(ring);

  const sources: AudioScheduledSourceNode[] = [
    rumble,
    rumble2,
    road.source,
    hiss.source,
    lfo,
    melody,
  ];
  for (const s of sources) {
    s.start(0);
  }

  return {
    sourceCount: sources.length,
    setGain(level: number): void {
      master.gain.value = level;
    },
    dispose(): void {
      const now = ctx.currentTime;
      for (const s of sources) {
        try {
          s.stop(now + 0.05);
        } catch {
          /* already stopped */
        }
      }
      try {
        master.disconnect();
      } catch {
        /* already disconnected */
      }
    },
  };
}

/** One-shot SFX pool for 2005. */
function buildSfx(ctx: AudioContext): SfxTrigger[] {
  return [
    // Ringtone snippet: a short, bright two-note "ring-ring".
    {
      kind: 'ringtone',
      weight: 2,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const note = (freq: number, when: number) => {
          const osc = c.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const osc2 = c.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.value = freq * 1.5;
          const g = c.createGain();
          g.gain.value = 0.0;
          g.gain.setValueAtTime(0, when);
          g.gain.linearRampToValueAtTime(0.25, when + 0.005);
          g.gain.linearRampToValueAtTime(0, when + 0.14);
          osc.connect(g);
          osc2.connect(g);
          g.connect(out);
          osc.start(when);
          osc2.start(when);
          osc.stop(when + 0.16);
          osc2.stop(when + 0.16);
        };
        note(880, t0);
        note(880, t0 + 0.16);
      },
    },
    // Bus air-brake hiss burst.
    makeSfx(ctx, {
      kind: 'busHiss',
      weight: 3,
      freq: 120,
      type: 'sine',
      oscGain: 0.1,
      noiseGain: 0.4,
      noiseFreq: 2000,
      noiseQ: 0.5,
      attack: 0.06,
      sustain: 0.4,
      release: 0.35,
      baseGain: 0.5,
    }),
    // Modern car horn.
    makeSfx(ctx, {
      kind: 'carHorn',
      weight: 3,
      freq: 208,
      type: 'sawtooth',
      oscGain: 0.5,
      attack: 0.01,
      sustain: 0.35,
      release: 0.12,
      baseGain: 0.5,
    }),
  ];
}

/** Build the full 2005 audio layer against a live context. */
export function createEraLayer(ctx: AudioContext): EraAudioLayer {
  return {
    year: 2005,
    createAmbient,
    sfx: buildSfx(ctx),
  };
}