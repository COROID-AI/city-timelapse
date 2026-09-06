/**
 * 1945 ambient soundscape.
 *
 * A quiet pre-war block: a distant propeller plane droning overhead, an
 * occasional hand-cranked car horn, and far-away church bells. Everything is
 * synthesized from WebAudio oscillators and noise — no audio files.
 */
import type { AmbientHandle, EraAudioLayer, SfxTrigger } from './types';
import { makeSfx, noiseBed } from './helpers';

/** Build the continuous 1945 ambient bed. */
function createAmbient(ctx: AudioContext, out: AudioNode): AmbientHandle {
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(out);

  // --- Distant propeller plane overhead (low drone + rhythmic rumble) ---
  const planeMix = ctx.createGain();
  planeMix.gain.value = 0.35;
  planeMix.connect(master);

  // A slow, low "putt-putt" engine pulse.
  const engine = ctx.createOscillator();
  engine.type = 'triangle';
  engine.frequency.value = 55;
  const engineLfo = ctx.createOscillator();
  engineLfo.type = 'sine';
  engineLfo.frequency.value = 7;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 14; // frequency modulation depth in Hz
  engineLfo.connect(lfoGain);
  lfoGain.connect(engine.frequency);
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0.5;
  engine.connect(engineGain);
  engineGain.connect(planeMix);

  // A soft wind/wash layer behind the plane.
  const wash = noiseBed(ctx, 180, 0.7, 0.12);
  wash.node.connect(planeMix);

  // --- Faint street air (very low traffic murmur) ---
  const air = noiseBed(ctx, 420, 0.5, 0.05);
  air.node.connect(master);

  const sources: AudioScheduledSourceNode[] = [
    engine,
    engineLfo,
    wash.source,
    air.source,
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

/** One-shot SFX pool for 1945. */
function buildSfx(ctx: AudioContext): SfxTrigger[] {
  return [
    // Hand-cranked car horn: a short, raucous double honk.
    {
      kind: 'carHorn',
      weight: 3,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const honk = (freq: number, dur: number) => {
          const osc = c.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq;
          const g = c.createGain();
          g.gain.value = 0.0;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.35, t0 + 0.01);
          g.gain.setValueAtTime(0.35, t0 + dur - 0.05);
          g.gain.linearRampToValueAtTime(0, t0 + dur);
          osc.connect(g);
          g.connect(out);
          osc.start(t0);
          osc.stop(t0 + dur + 0.02);
        };
        honk(220, 0.28);
        honk(233, 0.28);
      },
    },
    // Distant church bell: a struck metal "ding" with a long decay.
    {
      kind: 'churchBell',
      weight: 2,
      play: (c: AudioContext, out: AudioNode) => {
        const t0 = c.currentTime + 0.02;
        const partials: Array<[number, number]> = [
          [330, 0.7],
          [660, 0.4],
          [495, 0.25],
        ];
        for (const [freq, amp] of partials) {
          const osc = c.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = c.createGain();
          g.gain.value = 0.0;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(amp * 0.5, t0 + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
          osc.connect(g);
          g.connect(out);
          osc.start(t0);
          osc.stop(t0 + 2.3);
        }
      },
    },
    // Propeller plane flyover blip (occasional).
    makeSfx(ctx, {
      kind: 'planeFlyover',
      weight: 1,
      freq: 70,
      type: 'sawtooth',
      oscGain: 0.2,
      noiseGain: 0.15,
      noiseFreq: 220,
      attack: 0.4,
      sustain: 2.0,
      release: 0.6,
      baseGain: 0.25,
    }),
  ];
}

/** Build the full 1945 audio layer against a live context. */
export function createEraLayer(ctx: AudioContext): EraAudioLayer {
  return {
    year: 1945,
    createAmbient,
    sfx: buildSfx(ctx),
  };
}