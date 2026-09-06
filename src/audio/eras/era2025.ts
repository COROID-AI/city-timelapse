/**
 * 2025 ambient soundscape.
 *
 * A contemporary block: EV whir, e-scooter beeps, cafe chatter, and
 * notification pings. Fully synthesized — no audio files.
 */
import type { AmbientHandle, EraAudioLayer, SfxTrigger } from './types';
import { makeSfx, noiseBed } from './helpers';

/** Build the continuous 2025 ambient bed. */
function createAmbient(ctx: AudioContext, out: AudioNode): AmbientHandle {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(out);

  // --- EV whir: a smooth high-frequency electric motor hum ---
  const evMix = ctx.createGain();
  evMix.gain.value = 0.3;
  evMix.connect(master);

  const whir = ctx.createOscillator();
  whir.type = 'sine';
  whir.frequency.value = 220;
  const whir2 = ctx.createOscillator();
  whir2.type = 'triangle';
  whir2.frequency.value = 330;
  const wGain = ctx.createGain();
  wGain.gain.value = 0.3;
  const wGain2 = ctx.createGain();
  wGain2.gain.value = 0.18;
  whir.connect(wGain);
  whir2.connect(wGain2);
  wGain.connect(evMix);
  wGain2.connect(evMix);

  // Very light electric "tire" noise.
  const evRoad = noiseBed(ctx, 900, 0.8, 0.1);
  evRoad.node.connect(evMix);

  // --- Cafe chatter: soft broadband murmur with a gentle pulse ---
  const cafe = ctx.createGain();
  cafe.gain.value = 0.2;
  cafe.connect(master);
  const chatter = noiseBed(ctx, 1100, 0.5, 0.3);
  chatter.node.connect(cafe);

  const sources: AudioScheduledSourceNode[] = [
    whir,
    whir2,
    evRoad.source,
    chatter.source,
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

/** One-shot SFX pool for 2025. */
function buildSfx(ctx: AudioContext): SfxTrigger[] {
  return [
    // E-scooter beep: a short, bright double chirp.
    {
      kind: 'scooterBeep',
      weight: 3,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const chirp = (when: number) => {
          const osc = c.createOscillator();
          osc.type = 'square';
          osc.frequency.value = 1244;
          const g = c.createGain();
          g.gain.value = 0.0;
          g.gain.setValueAtTime(0, when);
          g.gain.linearRampToValueAtTime(0.2, when + 0.004);
          g.gain.linearRampToValueAtTime(0, when + 0.09);
          osc.connect(g);
          g.connect(out);
          osc.start(when);
          osc.stop(when + 0.1);
        };
        chirp(t0);
        chirp(t0 + 0.14);
      },
    },
    // Notification ping: a soft two-tone "ding".
    {
      kind: 'notificationPing',
      weight: 2,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const ping = (freq: number, when: number) => {
          const osc = c.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = c.createGain();
          g.gain.value = 0.0;
          g.gain.setValueAtTime(0, when);
          g.gain.linearRampToValueAtTime(0.2, when + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
          osc.connect(g);
          g.connect(out);
          osc.start(when);
          osc.stop(when + 0.45);
        };
        ping(1318, t0); // E6
        ping(1568, t0 + 0.1); // G6
      },
    },
    // EV motor whir blip (occasional).
    makeSfx(ctx, {
      kind: 'evWhir',
      weight: 1,
      freq: 240,
      type: 'triangle',
      oscGain: 0.25,
      attack: 0.05,
      sustain: 0.4,
      release: 0.3,
      baseGain: 0.3,
    }),
  ];
}

/** Build the full 2025 audio layer against a live context. */
export function createEraLayer(ctx: AudioContext): EraAudioLayer {
  return {
    year: 2025,
    createAmbient,
    sfx: buildSfx(ctx),
  };
}