/**
 * 1965 ambient soundscape.
 *
 * A mid-century block: a different (deeper, V-8) car engine pitch, jukebox
 * rock 'n' roll bleeding from a shop, and the distinctive "ding" of a street
 * trolley bell. Fully synthesized — no audio files.
 */
import type { AmbientHandle, EraAudioLayer, SfxTrigger } from './types';
import { makeSfx, noiseBed } from './helpers';

/** Build the continuous 1965 ambient bed. */
function createAmbient(ctx: AudioContext, out: AudioNode): AmbientHandle {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(out);

  // --- Traffic with a deeper, throatier V-8 engine pitch ---
  const trafficMix = ctx.createGain();
  trafficMix.gain.value = 0.35;
  trafficMix.connect(master);

  // Low engine rumble: detuned saws around 60–75 Hz (deeper than 1945's 55 Hz).
  const rumble = ctx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 68;
  const rumble2 = ctx.createOscillator();
  rumble2.type = 'sawtooth';
  rumble2.frequency.value = 73;
  const rGain = ctx.createGain();
  rGain.gain.value = 0.3;
  const rGain2 = ctx.createGain();
  rGain2.gain.value = 0.3;
  rumble.connect(rGain);
  rumble2.connect(rGain2);
  rGain.connect(trafficMix);
  rGain2.connect(trafficMix);

  // Mid rumble noise for the road surface.
  const road = noiseBed(ctx, 320, 0.6, 0.18);
  road.node.connect(trafficMix);

  // --- Jukebox rock 'n' roll bleed from a shop (muffled, distant) ---
  const jukebox = ctx.createGain();
  jukebox.gain.value = 0.16;
  jukebox.connect(master);

  // Simple rock riff (E2) on a low saw + a fifth up for body.
  const riff = ctx.createOscillator();
  riff.type = 'sawtooth';
  riff.frequency.value = 82.4; // E2
  const riffGain = ctx.createGain();
  riffGain.gain.value = 0.5;
  riff.connect(riffGain);
  riffGain.connect(jukebox);

  const chord = ctx.createOscillator();
  chord.type = 'triangle';
  chord.frequency.value = 123.5; // B2
  const chordGain = ctx.createGain();
  chordGain.gain.value = 0.25;
  chord.connect(chordGain);
  chordGain.connect(jukebox);

  // Soft lowpass so it reads as muffled through a shop window.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 480;
  lp.Q.value = 0.7;
  jukebox.connect(lp);
  lp.connect(master);

  const sources: AudioScheduledSourceNode[] = [
    rumble,
    rumble2,
    road.source,
    riff,
    chord,
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

/** One-shot SFX pool for 1965. */
function buildSfx(ctx: AudioContext): SfxTrigger[] {
  return [
    // Trolley bell: two bright "ding-ding" strikes.
    {
      kind: 'trolleyBell',
      weight: 2,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const ding = (when: number) => {
          const osc = c.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = 880;
          const osc2 = c.createOscillator();
          osc2.type = 'sine';
          osc2.frequency.value = 1760;
          const g = c.createGain();
          g.gain.value = 0.0;
          g.gain.setValueAtTime(0, when);
          g.gain.linearRampToValueAtTime(0.3, when + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
          osc.connect(g);
          osc2.connect(g);
          g.connect(out);
          osc.start(when);
          osc2.start(when);
          osc.stop(when + 0.55);
          osc2.stop(when + 0.55);
        };
        ding(t0);
        ding(t0 + 0.22);
      },
    },
    // A deeper car horn (different pitch from 1945's 220 Hz).
    makeSfx(ctx, {
      kind: 'carHorn',
      weight: 3,
      freq: 175,
      type: 'sawtooth',
      oscGain: 0.5,
      attack: 0.01,
      sustain: 0.35,
      release: 0.12,
      baseGain: 0.5,
    }),
    // Jukebox guitar strum blip.
    makeSfx(ctx, {
      kind: 'jukeboxStrum',
      weight: 2,
      freq: 196,
      detuneHz: 2,
      type: 'sawtooth',
      oscGain: 0.3,
      noiseGain: 0.12,
      noiseFreq: 1200,
      attack: 0.005,
      sustain: 0.18,
      release: 0.3,
      baseGain: 0.4,
    }),
  ];
}

/** Build the full 1965 audio layer against a live context. */
export function createEraLayer(ctx: AudioContext): EraAudioLayer {
  return {
    year: 1965,
    createAmbient,
    sfx: buildSfx(ctx),
  };
}