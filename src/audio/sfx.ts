/**
 * Procedural SFX catalog for the city timelapse.
 *
 * Every cue in this module is synthesized on demand from oscillators and
 * shaped noise written into an {@link AudioBuffer}. No external audio assets are
 * loaded — the catalog is entirely procedural, deterministic (seeded by era so
 * the same era always renders the same character) and keyed by {@link Era} and
 * {@link SfxEvent} so the timeline-driven mixer in {@link ./mixer} can look cues
 * up in constant time.
 *
 * The module is playback-agnostic: it only knows how to *render* buffers. The
 * actual Web Audio graph (source nodes, gain ramps, panners) is owned by the
 * mixer, which calls {@link createAmbientLoop}, {@link createTransitionSting},
 * {@link createVehiclePassBy} and {@link createFootstep} to obtain buffers and
 * then schedules them.
 */

import type { Era } from '../eras/types.js';

/** Sample rate used for all synthesized buffers, in Hz. */
export const SFX_SAMPLE_RATE = 44100;

/**
 * One-shot / ambient event kinds the catalog can render. These are the values
 * the mixer dispatches on when the timeline emits ticks and era changes.
 */
export type SfxEvent =
  | 'eraChange'
  | 'eraTick'
  | 'vehiclePassBy'
  | 'footstep';

/**
 * Subset of events that resolve to discrete one-shots (as opposed to looping
 * ambient beds). Used by the mixer to choose between looped and one-shot nodes.
 */
export type SfxOneShotEvent = 'transition' | 'vehiclePassBy' | 'footstep';

/** Footstep surface flavors, reflecting the dominant street texture per era. */
export type FootstepSurface = 'cobble' | 'asphalt' | 'concrete';

/** Vehicle engine character used to color the pass-by doppler sweep. */
export type VehicleCharacter = 'rumble' | 'combustion' | 'electric';

/**
 * Deterministic per-era SFX recipe. The numbers below are deliberately small
 * and hand-tuned so each era reads as a distinct place in time:
 *
 * - **1945 Postwar** — sparse, low murmur, cobblestone footsteps, heavy
 *   low-RPM rumble. Quiet and intimate.
 * - **1965 Boom** — busier street hum, combustion engines, concrete footsteps.
 *   Louder and mid-forward.
 * - **1985 Downtown** — dense traffic, sharper combustion, asphalt footsteps.
 *   Brightest and loudest.
 * - **2005 Modern** — heavier traffic but starting to mellow, smooth asphalt
 *   footsteps, tamer engine character.
 * - **2025 Future** — quieter EV-dominated streets, soft footstep ticks, gentle
 *   high shimmer. Calmest.
 */
export interface EraSfxRecipe {
  /** Era this recipe describes. */
  readonly era: Era;
  /** Human-readable label for diagnostics. */
  readonly label: string;
  /** Base drone frequency for the ambient bed, in Hz. */
  readonly ambientBase: number;
  /** Detune (in cents) of the second ambient oscillator for a chorusing pad. */
  readonly ambientDetune: number;
  /** Noise color weight (0..1) blended into the ambient bed for street hiss. */
  readonly ambientNoise: number;
  /** Target loop loudness (linear gain) for the ambient bed. */
  readonly ambientGain: number;
  /** Ambient loop length in seconds. */
  readonly ambientSeconds: number;
  /** Fundamental of the era-change transition sting, in Hz. */
  readonly stingRoot: number;
  /** Sting duration in seconds. */
  readonly stingSeconds: number;
  /** Vehicle engine character for pass-by cues. */
  readonly vehicleCharacter: VehicleCharacter;
  /** Approximate vehicle speed (m/s) feeding the doppler sweep. */
  readonly vehicleSpeed: number;
  /** Dominant footstep surface for pedestrians of this era. */
  readonly footstepSurface: FootstepSurface;
}

/**
 * Canonical, frozen recipe table keyed by era. Iteration order is chronological.
 */
export const ERA_SFX_RECIPES: Readonly<Record<Era, EraSfxRecipe>> =
  Object.freeze({
    1945: {
      era: 1945,
      label: 'Postwar murmur',
      ambientBase: 58,
      ambientDetune: -6,
      ambientNoise: 0.18,
      ambientGain: 0.16,
      ambientSeconds: 6,
      stingRoot: 196,
      stingSeconds: 1.6,
      vehicleCharacter: 'rumble',
      vehicleSpeed: 9,
      footstepSurface: 'cobble',
    },
    1965: {
      era: 1965,
      label: 'Boom bustle',
      ambientBase: 66,
      ambientDetune: 4,
      ambientNoise: 0.26,
      ambientGain: 0.2,
      ambientSeconds: 6,
      stingRoot: 220,
      stingSeconds: 1.4,
      vehicleCharacter: 'combustion',
      vehicleSpeed: 12,
      footstepSurface: 'concrete',
    },
    1985: {
      era: 1985,
      label: 'Downtown roar',
      ambientBase: 73,
      ambientDetune: 7,
      ambientNoise: 0.34,
      ambientGain: 0.24,
      ambientSeconds: 6,
      stingRoot: 247,
      stingSeconds: 1.2,
      vehicleCharacter: 'combustion',
      vehicleSpeed: 15,
      footstepSurface: 'asphalt',
    },
    2005: {
      era: 2005,
      label: 'Modern hum',
      ambientBase: 70,
      ambientDetune: 3,
      ambientNoise: 0.28,
      ambientGain: 0.2,
      ambientSeconds: 6,
      stingRoot: 233,
      stingSeconds: 1.3,
      vehicleCharacter: 'combustion',
      vehicleSpeed: 14,
      footstepSurface: 'asphalt',
    },
    2025: {
      era: 2025,
      label: 'Quiet EV shimmer',
      ambientBase: 62,
      ambientDetune: 0,
      ambientNoise: 0.14,
      ambientGain: 0.14,
      ambientSeconds: 6,
      stingRoot: 261.63,
      stingSeconds: 1.1,
      vehicleCharacter: 'electric',
      vehicleSpeed: 13,
      footstepSurface: 'concrete',
    },
  });

/** Chronological era list for ordered lookups. */
export const SFX_ERAS: readonly Era[] = [1945, 1965, 1985, 2005, 2025];

/**
 * Look up the recipe for an era. Throws for an unknown era so callers fail loud
 * rather than silently rendering silence.
 */
export function getEraSfxRecipe(era: Era): EraSfxRecipe {
  const recipe = ERA_SFX_RECIPES[era];
  if (!recipe) {
    throw new Error(`No SFX recipe registered for era ${era}`);
  }
  return recipe;
}

/**
 * Small deterministic PRNG (mulberry32). Seeding by era keeps each era's
 * stochastic textures (noise, footstep jitter) reproducible across renders so
 * the catalog is stable for a given era.
 */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a stereo {@link AudioBuffer} of the given length. */
function makeBuffer(
  ctx: BaseAudioContext,
  seconds: number,
): AudioBuffer {
  const length = Math.max(1, Math.round(SFX_SAMPLE_RATE * seconds));
  return ctx.createBuffer(2, length, SFX_SAMPLE_RATE);
}

/**
 * Render a procedural ambient loop for an era.
 *
 * The bed is two detuned sine oscillators (a slow chorusing drone) plus shaped
 * band-passed noise evoking distant street hiss, with a slow LFO modulating the
 * overall level so the loop breathes instead of droning flatly. The buffer is
 * exactly {@link EraSfxRecipe.ambientSeconds} long and seamless when looped
 * (all shaping windows are period-integer or start/end matched to zero).
 */
export function createAmbientLoop(
  ctx: BaseAudioContext,
  era: Era,
): AudioBuffer {
  const recipe = getEraSfxRecipe(era);
  const rng = createRng(era * 7919);
  const buffer = makeBuffer(ctx, recipe.ambientSeconds);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const { ambientBase, ambientDetune, ambientNoise, ambientGain } = recipe;
  // Detune in cents -> frequency ratio.
  const secondFreq = ambientBase * Math.pow(2, ambientDetune / 1200);
  const lfoRate = 0.08 + rng() * 0.04; // very slow breathing
  const samples = left.length;

  for (let i = 0; i < samples; i++) {
    const t = i / SFX_SAMPLE_RATE;
    // Continuous-time oscillators -> identical on both channels.
    const drone =
      Math.sin(2 * Math.PI * ambientBase * t) +
      0.7 * Math.sin(2 * Math.PI * secondFreq * t);
    // Band-limited-ish noise: average two uncorrelated streams per channel.
    const noiseL =
      (rng() * 2 - 1) * 0.5 + (rng() * 2 - 1) * 0.5;
    const noiseR =
      (rng() * 2 - 1) * 0.5 + (rng() * 2 - 1) * 0.5;
    // Slow tremolo so the bed never feels static.
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * lfoRate * t);
    const amp = ambientGain * (0.75 + 0.25 * lfo);

    left[i] = (drone * (1 - ambientNoise) + noiseL * ambientNoise) * amp;
    right[i] = (drone * (1 - ambientNoise) + noiseR * ambientNoise) * amp;
  }

  // Fade the very first/last few hundred samples to zero so a looping source
  // never clicks at the wrap point.
  const ramp = Math.min(256, samples >>> 1);
  for (let i = 0; i < ramp; i++) {
    const gain = i / ramp;
    left[i] *= gain;
    right[i] *= gain;
    left[samples - 1 - i] *= gain;
    right[samples - 1 - i] *= gain;
  }

  return buffer;
}

/**
 * Render a transition sting for an era change (or any "eraChange"-style event).
 *
 * A short upward arpeggio of three sine partials with a fast exponential decay,
 * colored by a splash of high-passed noise so it reads as a shimmer rather than
 * a pure organ tone.
 */
export function createTransitionSting(
  ctx: BaseAudioContext,
  era: Era,
): AudioBuffer {
  const recipe = getEraSfxRecipe(era);
  const rng = createRng(era * 104729 + 13);
  const buffer = makeBuffer(ctx, recipe.stingSeconds);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const samples = left.length;
  const root = recipe.stingRoot;

  // Major triad arpeggio (root, major third, fifth) one octave up for sparkle.
  const partials = [1, 1.25, 1.5];
  // Entry times for each partial (staggered).
  const entries = [0, 0.09, 0.18];

  for (let i = 0; i < samples; i++) {
    const t = i / SFX_SAMPLE_RATE;
    let sample = 0;
    for (let p = 0; p < partials.length; p++) {
      const localT = t - entries[p];
      if (localT < 0) continue;
      // Fast exponential decay per partial.
      const env = Math.exp(-3.2 * localT);
      sample += Math.sin(2 * Math.PI * root * partials[p] * t) * env;
    }
    // High-pass-ish noise splash, decaying with the sting.
    const hpNoise =
      ((rng() * 2 - 1) * 0.5 + (rng() * 2 - 1) * 0.5) *
      Math.exp(-4 * t) * 0.18;
    const out = (sample / partials.length + hpNoise) * 0.5;
    left[i] = out;
    right[i] = out;
  }

  return buffer;
}

/**
 * Render a vehicle pass-by one-shot for an era.
 *
 * Models a vehicle crossing the listener at {@link EraSfxRecipe.vehicleSpeed}:
 * a pitched engine tone whose frequency is swept by a doppler curve (high when
 * approaching, lower when receding), panned hard left -> center -> hard right,
 * and shaped by an amplitude envelope peaking at the closest point of approach.
 * The engine character ({@link VehicleCharacter}) retunes the base tone and
 * saw-vs-sine balance.
 */
export function createVehiclePassBy(
  ctx: BaseAudioContext,
  era: Era,
): AudioBuffer {
  const recipe = getEraSfxRecipe(era);
  const rng = createRng(era * 1299721 + 7);
  const seconds = 2.4;
  const buffer = makeBuffer(ctx, seconds);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const samples = left.length;

  const char = recipe.vehicleCharacter;
  const baseFreq =
    char === 'rumble' ? 42 : char === 'combustion' ? 70 : 120;
  // Saw content adds the buzzy combustion texture; EVs stay near-pure sine.
  const sawMix = char === 'rumble' ? 0.35 : char === 'combustion' ? 0.5 : 0.08;
  const speed = recipe.vehicleSpeed;
  const speedOfSound = 343;
  // Listener is at the closest point of approach at t = seconds/2.
  const cpa = seconds / 2;

  for (let i = 0; i < samples; i++) {
    const t = i / SFX_SAMPLE_RATE;
    // Distance along the road (m). Negative = approaching.
    const pos = speed * (t - cpa);
    // Radial distance to the listener (assume 4 m lateral offset).
    const lateral = 4;
    const distance = Math.hypot(pos, lateral);
    // Doppler shift: frequency observed by the listener.
    const approachVel = (speed * -pos) / Math.max(distance, 0.001);
    const observed = baseFreq * (speedOfSound / (speedOfSound + approachVel));

    // Engine tone: sine + sawtooth mix.
    const sine = Math.sin(2 * Math.PI * observed * t);
    const saw = 2 * (observed * t - Math.floor(observed * t + 0.5));
    const tone = sine * (1 - sawMix) + saw * sawMix;

    // Amplitude falls off with 1/distance (clamped), peaking at CPA.
    const distGain = Math.min(1, lateral / Math.max(distance, lateral));
    // Smooth bell envelope centered on CPA.
    const env = Math.exp(-Math.pow((t - cpa) / (seconds * 0.34), 2));

    // Pan: -1 (left) approaching -> 0 at CPA -> +1 (right) receding.
    const pan = Math.max(-1, Math.min(1, pos / (speed * cpa)));
    // Equal-power pan law.
    const gainL = Math.cos(((pan + 1) / 2) * (Math.PI / 2));
    const gainR = Math.sin(((pan + 1) / 2) * (Math.PI / 2));

    // Add light tire hiss near CPA.
    const hiss =
      ((rng() * 2 - 1) * 0.5 + (rng() * 2 - 1) * 0.5) * env * 0.12;

    const amp = 0.55 * distGain * env;
    left[i] = (tone * gainL + hiss * gainL) * amp;
    right[i] = (tone * gainR + hiss * gainR) * amp;
  }

  return buffer;
}

/**
 * Render a single footstep one-shot for an era.
 *
 * A short percussive tick whose spectrum is shaped by the era's dominant surface:
 * cobble is clicky and bright, concrete is mid-thuddy, asphalt is soft and
 * muffled. A tiny bit of pre-delay noise gives the "heel strike".
 */
export function createFootstep(
  ctx: BaseAudioContext,
  era: Era,
): AudioBuffer {
  const recipe = getEraSfxRecipe(era);
  const rng = createRng(era * 2741 + 101);
  const surface = recipe.footstepSurface;
  const seconds = 0.18;
  const buffer = makeBuffer(ctx, seconds);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const samples = left.length;

  const { decay, baseFreq, brightness, gain } = FOOTSTEP_PROFILES[surface];

  for (let i = 0; i < samples; i++) {
    const t = i / SFX_SAMPLE_RATE;
    const env = Math.exp(-decay * t);
    // Body tone: a low thud.
    const body = Math.sin(2 * Math.PI * baseFreq * t) * env;
    // Click: highpassed noise shaped by surface brightness.
    const click =
      ((rng() * 2 - 1) * 0.5 + (rng() * 2 - 1) * 0.5) *
      env *
      brightness;
    const out = (body * 0.6 + click * 0.4) * gain;
    left[i] = out;
    right[i] = out;
  }

  return buffer;
}

/** Per-surface footstep spectral profile. */
const FOOTSTEP_PROFILES: Readonly<
  Record<FootstepSurface, { decay: number; baseFreq: number; brightness: number; gain: number }>
> = Object.freeze({
  cobble: { decay: 26, baseFreq: 150, brightness: 0.5, gain: 0.42 },
  concrete: { decay: 22, baseFreq: 120, brightness: 0.32, gain: 0.4 },
  asphalt: { decay: 18, baseFreq: 95, brightness: 0.2, gain: 0.34 },
});

/**
 * Map a timeline {@link SfxEvent} to the buffer that should be rendered for it.
 * This is the single key the mixer uses to go from "era changed" or "a tick
 * happened" to a concrete synthesized buffer.
 */
export function resolveEventBuffer(
  ctx: BaseAudioContext,
  era: Era,
  event: SfxEvent,
): AudioBuffer {
  switch (event) {
    case 'eraChange':
      return createTransitionSting(ctx, era);
    case 'eraTick':
      // A tick is a low-key ambient refresh; reuse the ambient bed so the mixer
      // can swap loops without a hard cut.
      return createAmbientLoop(ctx, era);
    case 'vehiclePassBy':
      return createVehiclePassBy(ctx, era);
    case 'footstep':
      return createFootstep(ctx, era);
    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

/**
 * Convenience: the canonical one-shot events the mixer schedules as discrete
 * (non-looping) buffers. Kept here so the catalog owns its own taxonomy.
 */
export const ONE_SHOT_EVENTS: readonly SfxEvent[] = [
  'eraChange',
  'vehiclePassBy',
  'footstep',
];

/**
 * Convenience: is the given event a looping ambient bed (vs. a one-shot)?
 */
export function isAmbientEvent(event: SfxEvent): boolean {
  return event === 'eraTick';
}


