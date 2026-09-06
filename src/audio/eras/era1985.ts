/**
 * 1985 ambient soundscape.
 *
 * A neon-lit mid-decade block: synth-pop bleeding from a storefront, arcade /
 * game blips, and heavier, busier traffic than before. Fully synthesized.
 */
import type { AmbientHandle, EraAudioLayer, SfxTrigger } from './types';
import { makeSfx, noiseBed } from './helpers';

/** Build the continuous 1985 ambient bed. */
function createAmbient(ctx: AudioContext, out: AudioNode): AmbientHandle {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(out);

  // --- Heavier traffic (more cars, denser rumble) ---
  const trafficMix = ctx.createGain();
  trafficMix.gain.value = 0.42;
  trafficMix.connect(master);

  const rumble = ctx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 70;
  const rumble2 = ctx.createOscillator();
  rumble2.type = 'sawtooth';
  rumble2.frequency.value = 76;
  const rGain = ctx.createGain();
  rGain.gain.value = 0.32;
  const rGain2 = ctx.createGain();
  rGain2.gain.value = 0.32;
  rumble.connect(rGain);
  rumble2.connect(rGain2);
  rGain.connect(trafficMix);
  rGain2.connect(trafficMix);

  // Denser road noise.
  const road = noiseBed(ctx, 400, 0.6, 0.22);
  road.node.connect(trafficMix);

  // A higher, busier hum from more vehicles idling.
  const idle = ctx.createOscillator();
  idle.type = 'triangle';
  idle.frequency.value = 110;
  const idleGain = ctx.createGain();
  idleGain.gain.value = 0.12;
  idle.connect(idleGain);
  idleGain.connect(trafficMix);

  // --- Synth-pop bleed from a shop (bright, square-wave arpeggio) ---
  const synth = ctx.createGain();
  synth.gain.value = 0.14;
  synth.connect(master);

  const lead = ctx.createOscillator();
  lead.type = 'square';
  lead.frequency.value = 220;
  const leadGain = ctx.createGain();
  leadGain.gain.value = 0.4;
  lead.connect(leadGain);
  leadGain.connect(synth);

  const lead2 = ctx.createOscillator();
  lead2.type = 'square';
  lead2.frequency.value = 330;
  const lead2Gain = ctx.createGain();
  lead2Gain.gain.value = 0.28;
  lead2.connect(lead2Gain);
  lead2Gain.connect(synth);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.8;
  synth.connect(lp);
  lp.connect(master);

  const sources: AudioScheduledSourceNode[] = [
    rumble,
    rumble2,
    road.source,
    idle,
    lead,
    lead2,
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

/** One-shot SFX pool for 1985. */
function buildSfx(ctx: AudioContext): SfxTrigger[] {
  return [
    // Arcade / game blip: a quick rising "pew".
    {
      kind: 'arcadeBlip',
      weight: 3,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const osc = c.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 440;
        const g = c.createGain();
        g.gain.value = 0.0;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.25, t0 + 0.01);
        g.gain.linearRampToValueAtTime(0, t0 + 0.14);
        osc.connect(g);
        g.connect(out);
        // Rising pitch sweep.
        osc.frequency.setValueAtTime(440, t0);
        osc.frequency.linearRampToValueAtTime(880, t0 + 0.12);
        osc.start(t0);
        osc.stop(t0 + 0.16);
      },
    },
    // Coin drop / 8-bit pickup.
    makeSfx(ctx, {
      kind: 'gameCoin',
      weight: 2,
      freq: 660,
      detuneHz: 0,
      type: 'square',
      oscGain: 0.3,
      attack: 0.002,
      sustain: 0.08,
      release: 0.12,
      baseGain: 0.4,
    }),
    // Deeper car horn (denser traffic era).
    makeSfx(ctx, {
      kind: 'carHorn',
      weight: 3,
      freq: 196,
      type: 'sawtooth',
      oscGain: 0.5,
      attack: 0.01,
      sustain: 0.4,
      release: 0.12,
      baseGain: 0.5,
    }),
  ];
}

/** Build the full 1985 audio layer against a live context. */
export function createEraLayer(ctx: AudioContext): EraAudioLayer {
  return {
    year: 1985,
    createAmbient,
    sfx: buildSfx(ctx),
  };
}