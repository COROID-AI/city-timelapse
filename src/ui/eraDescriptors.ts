/**
 * Era descriptors and period-accurate copy for City Time Period Timelapse.
 *
 * Types and pure data only — no Three.js or DOM access.
 * Consumed by the HUD and timeline accessibility labels.
 */

import type { TimelineChannel } from '../era/types';
import type { EraId } from '../era/years';

/**
 * Period-accurate era one-liner descriptors.
 */
export const eraDescriptors: Record<EraId, string> = {
  '1945': '1945 — Post-War Dawn: Masonry Tenements & Big Band Swing',
  '1965': '1965 — Mid-Century Boom: Chrome Tailfins & Motown Rhythms',
  '1985': '1985 — Neon & Concrete: Glass Towers & Synthwave Pulses',
  '2005': '2005 — Millennium Turn: High-Tech LED & Aerodynamic Sedans',
  '2025': '2025 — Eco-Smart Future: Green Spires & Autonomous Mobility',
};

/**
 * Short titles / subtitles for compact HUD badges.
 */
export const eraSubtitles: Record<EraId, string> = {
  '1945': 'Post-War Dawn',
  '1965': 'Mid-Century Boom',
  '1985': 'Neon Horizon',
  '2005': 'Millennium Turn',
  '2025': 'Eco-Smart Future',
};

/**
 * Returns the period-accurate descriptor for an era.
 */
export function getEraDescriptor(era: EraId): string {
  return eraDescriptors[era] ?? `${era} — Urban Era`;
}

/**
 * Formats a live descriptor for a transition or static state.
 */
export function formatEraChannelDescriptor(channel: TimelineChannel, _currentEra?: EraId): string {
  if (channel.fromEra === channel.toEra || channel.t <= 0.01) {
    return getEraDescriptor(channel.fromEra);
  }
  if (channel.t >= 0.99) {
    return getEraDescriptor(channel.toEra);
  }
  const pct = Math.round(channel.t * 100);
  return `Transitioning: ${channel.fromEra} → ${channel.toEra} (${pct}%)`;
}
