/**
 * Era audio layer registry.
 *
 * Aggregates the five per-year ambient soundscapes (1945 → 2025) keyed by
 * year. The `AudioManager` consumes this to look up the layer for the active
 * era and crossfade into it on year change.
 *
 * Lifecycle: `eraAudioLayers(ctx)` is the `bootstrap` step that builds every
 * layer against a live `AudioContext`. Each layer's `createAmbient` is the
 * `update`/`dispose` owner for its continuous bed; the manager handles that.
 */
import type { EraKey } from '../../data/eraDefinition';
import type { EraAudioLayer } from './types';
import { createEraLayer as layer1945 } from './era1945';
import { createEraLayer as layer1965 } from './era1965';
import { createEraLayer as layer1985 } from './era1985';
import { createEraLayer as layer2005 } from './era2005';
import { createEraLayer as layer2025 } from './era2025';

/**
 * Build all five era audio layers against a live context.
 *
 * This is the `bootstrap` hook of the audio era-layers module: it constructs
 * every layer (the per-era ambient-bed factory plus one-shot SFX pool) so the
 * manager can crossfade between them without build latency.
 */
export function eraAudioLayers(ctx: AudioContext): Record<EraKey, EraAudioLayer> {
  return {
    1945: layer1945(ctx),
    1965: layer1965(ctx),
    1985: layer1985(ctx),
    2005: layer2005(ctx),
    2025: layer2025(ctx),
  };
}

/** Chronological order of the audio layers (matches ERA_KEYS). */
export const AUDIO_ERA_KEYS: readonly EraKey[] = [1945, 1965, 1985, 2005, 2025];