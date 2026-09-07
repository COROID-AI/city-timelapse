import { createSfxContext, SfxContext } from '../../audio/sfxContext';

/**
 * 1945 ambience and SFX stems.
 *
 * Registers the era's soundscape: a propeller-plane flyover, a distant tram
 * bell, sparse engine rumble, newspaper-boy shouts and an era radio jingle
 * loop from a shop window. The foundation SfxContext is a minimal WebAudio
 * hook (blip + dispose), so each stem is described as structured metadata and
 * optionally played through the hook as a short blip.
 */

/** A single 1945 SFX stem. */
export interface SfxStem {
  /** Stable stem id. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description. */
  description: string;
  /** Whether the stem loops. */
  loop: boolean;
  /** Approximate base frequency for the placeholder hook. */
  frequency: number;
}

/** The 1945 SFX stem set. */
export const era1945SfxStems: readonly SfxStem[] = Object.freeze([
  {
    id: 'propeller_plane_flyover',
    name: 'Propeller plane flyover',
    description: 'A low droning propeller plane passes overhead.',
    loop: false,
    frequency: 90,
  },
  {
    id: 'distant_tram_bell',
    name: 'Distant tram bell',
    description: 'A faint tram bell rings on the cross street.',
    loop: true,
    frequency: 620,
  },
  {
    id: 'engine_rumble',
    name: 'Sparse engine rumble',
    description: 'The low rumble of an idling 1940s delivery truck.',
    loop: true,
    frequency: 55,
  },
  {
    id: 'newspaper_boy_shout',
    name: 'Newspaper boy shout',
    description: '"Extra! Extra! Read all about it!" from a corner stand.',
    loop: false,
    frequency: 440,
  },
  {
    id: 'radio_jingle_loop',
    name: 'Era radio jingle loop',
    description: 'A tinny period radio jingle drifting from a shop window.',
    loop: true,
    frequency: 330,
  },
]);

/** The 1945 audio rig. */
export interface EraAudio {
  /** The registered SFX stems. */
  readonly stems: readonly SfxStem[];
  /** Whether the audio hook is active. */
  readonly active: boolean;
  /** Play a stem through the hook (no-op if not initialized). */
  play(stemId: string): void;
  /** Dispose: release the underlying SFX context. */
  dispose(): void;
}

/**
 * Create the 1945 audio rig, registering all stems against the foundation
 * SfxContext hook.
 */
export function createEraAudio(sfx: SfxContext): EraAudio {
  const stems = era1945SfxStems;

  return {
    stems,
    get active() {
      return sfx.initialized;
    },
    play(stemId: string) {
      const stem = stems.find((s) => s.id === stemId);
      if (!stem) return;
      sfx.blip(stem.frequency);
    },
    dispose() {
      // The foundation SfxContext is owned by the app assembler; we do not
      // dispose it here (only release our references).
    },
  };
}

/**
 * Convenience: build an SfxContext and immediately register the 1945 stems.
 * Used by tests and the composition harness.
 */
export function createEra1945Audio(): { sfx: SfxContext; audio: EraAudio } {
  const sfx = createSfxContext();
  const audio = createEraAudio(sfx);
  return { sfx, audio };
}