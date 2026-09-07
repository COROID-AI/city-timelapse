/**
 * Era-specific ambience and SFX stems for the 2025 smart-city EV era.
 *
 * Quiet EV whir, e-scooter hum, notification pings, delivery-app couriers,
 * outdoor cafe chatter, distant construction of the new tower, and a subtle
 * modern ambient loop.
 */

/** Category of an audio stem. */
export type StemCategory = 'ambient' | 'sfx' | 'loop';

/** A single registered ambience/SFX stem. */
export interface AudioStem {
  /** Stable stem id. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Whether this is ambient bed, discrete SFX, or the master loop. */
  category: StemCategory;
  /** Short description of the sound. */
  description: string;
}

/** The full set of era audio stems. */
export interface AudioStems {
  /** Registered era audio stems. */
  stems: readonly AudioStem[];
  /** Id of the primary ambient loop. */
  loopId: string;
}

/** The 2025 era audio stems. */
export const audioStems: AudioStems = {
  loopId: 'modern-ambient-loop',
  stems: Object.freeze([
    {
      id: 'ev-whir',
      label: 'Quiet EV whir',
      category: 'ambient',
      description: 'Low electric motor whir of passing EVs.',
    },
    {
      id: 'escooter-hum',
      label: 'E-scooter hum',
      category: 'sfx',
      description: 'High-pitched electric scooter motor hum.',
    },
    {
      id: 'notification-ping',
      label: 'Notification pings',
      category: 'sfx',
      description: 'App notification pings from phones and screens.',
    },
    {
      id: 'courier-chatter',
      label: 'Delivery-app couriers',
      category: 'ambient',
      description: 'Couriers coordinating handoffs at storefronts.',
    },
    {
      id: 'cafe-chatter',
      label: 'Outdoor cafe chatter',
      category: 'ambient',
      description: 'Remote workers chatting at cafe patios.',
    },
    {
      id: 'tower-construction',
      label: 'Distant construction',
      category: 'ambient',
      description: 'Distant construction of the new tower.',
    },
    {
      id: 'modern-ambient-loop',
      label: 'Modern ambient loop',
      category: 'loop',
      description: 'Subtle modern ambient loop.',
    },
  ]),
};