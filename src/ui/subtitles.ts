import type { EraId } from '../types';

/**
 * Subtitle copy shown during the cinematic in-view transformation.
 *
 * Each era gets one short, evocative line that the overlay renders beneath the
 * big year label while the scene morphs. The copy is static data consumed by
 * `createOverlay` (via the integration) and is intentionally registry-agnostic.
 */

export interface EraSubtitle {
  era: EraId;
  text: string;
}

/** Per-era subtitle copy, keyed in canonical ERA_IDS order. */
export const ERA_SUBTITLES: readonly EraSubtitle[] = Object.freeze([
  { era: '1945', text: 'Post-war reconstruction — brick, steam, and rationed optimism.' },
  { era: '1965', text: 'Mid-century modern rises — glass, chrome, and the automobile age.' },
  { era: '1985', text: 'Neon-lit nights — concrete, CRT glow, and analog energy.' },
  { era: '2005', text: 'Connected beginnings — LCDs, glass towers, and the early web.' },
  { era: '2025', text: 'A smart, green present — LEDs, solar, and clean density.' },
]);

const SUBTITLE_BY_ERA = new Map<EraId, string>(ERA_SUBTITLES.map((s) => [s.era, s.text]));

/** Resolve the subtitle line for a given era, or an empty string if unknown. */
export function subtitleFor(era: EraId): string {
  return SUBTITLE_BY_ERA.get(era) ?? '';
}