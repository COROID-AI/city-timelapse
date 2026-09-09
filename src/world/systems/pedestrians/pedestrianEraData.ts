/**
 * Era-specific pedestrian fashion, crowd density, and prop specifications.
 *
 * Covers all five historical eras:
 * - 1945: Tailored double-breasted suits, trench coats, fedoras, cloche hats, pleated tea dresses; props: briefcase, newspaper, umbrella
 * - 1965: Mod color-block shift dresses, slim suits, skinny ties; props: transistor radio, paperback, attache
 * - 1985: Neon windbreakers, acid-wash denim, power suits with shoulder pads; props: boombox, cassette walkman
 * - 2005: Low-rise denim, cargo pants, track jackets, hoodies; props: flip phone, mp3 player, coffee cup
 * - 2025: Minimalist athleisure, technical waterproof outerwear, tailored eco-linen; props: smartphone, smart glasses
 */

import type { PedestriansEraSpec, TimelineChannel } from '../../../era/types';
import { type EraId, ERAS } from '../../../era/years';
import { lerpNumber } from '../../../era/transition';

export const pedestrianEraData: Record<EraId, PedestriansEraSpec> = {
  '1945': {
    fashionStyle: 'Double-Breasted Suits, Trench Coats, Cloche Hats & Tea Dresses',
    crowdDensity: 6,
    walkSpeed: 1.2,
    outfits: [
      {
        description: 'Fedora & Tailored Trench Suit',
        topPalette: ['#78716c', '#44403c', '#292524', '#57534e'],
        bottomPalette: ['#44403c', '#1c1917', '#292524'],
        accessories: ['fedora', 'leather_briefcase', 'overcoat'],
      },
      {
        description: 'Pleated Tea Dress & Wool Cardigan',
        topPalette: ['#047857', '#991b1b', '#1e3a8a', '#854d0e'],
        bottomPalette: ['#065f46', '#7f1d1d', '#1e293b', '#713f12'],
        accessories: ['cloche_hat', 'leather_purse', 'dress'],
      },
    ],
    propProbability: 0.65,
    typicalProps: ['folded_newspaper', 'leather_briefcase', 'umbrella', 'pocket_watch'],
  },

  '1965': {
    fashionStyle: 'Mod Shift Dresses, Slim Suits, Skinny Ties & Bell-Bottom Accents',
    crowdDensity: 8,
    walkSpeed: 1.3,
    outfits: [
      {
        description: 'Slim Charcoal Suit & Skinny Tie',
        topPalette: ['#334155', '#475569', '#1e293b', '#0f172a'],
        bottomPalette: ['#334155', '#1e293b', '#0f172a'],
        accessories: ['sunglasses_wayfarer', 'leather_attache', 'skinny_tie'],
      },
      {
        description: 'Geometric Mod Color-Block Shift Dress',
        topPalette: ['#e11d48', '#f59e0b', '#0284c7', '#10b981'],
        bottomPalette: ['#f8fafc', '#0f172a', '#fbbf24'],
        accessories: ['cat_eye_glasses', 'tote_bag', 'mod_dress'],
      },
    ],
    propProbability: 0.55,
    typicalProps: ['transistor_radio', 'paperback_book', 'attache_case', 'cigarette_case'],
  },

  '1985': {
    fashionStyle: 'Padded Shoulders, Acid-Wash Denim, Neon Windbreakers & High Tops',
    crowdDensity: 10,
    walkSpeed: 1.35,
    outfits: [
      {
        description: 'Neon Windbreaker & Acid Wash Denim',
        topPalette: ['#38bdf8', '#f43f5e', '#a855f7', '#22c55e'],
        bottomPalette: ['#93c5fd', '#374151', '#60a5fa'],
        accessories: ['boombox', 'cassette_walkman', 'headphones', 'windbreaker'],
      },
      {
        description: 'Power Suit with Shoulder Pads',
        topPalette: ['#1e1b4b', '#831843', '#064e3b', '#4c1d95'],
        bottomPalette: ['#1e1b4b', '#831843', '#064e3b'],
        accessories: ['aviator_glasses', 'leather_portfolio', 'shoulder_pads'],
      },
    ],
    propProbability: 0.7,
    typicalProps: ['portable_cassette_walkman', 'shoulder_boombox', 'analog_camera', 'rolled_magazine'],
  },

  '2005': {
    fashionStyle: 'Low-Rise Denim, Cargo Pants, Track Jackets, Flip Phones & MP3 Players',
    crowdDensity: 11,
    walkSpeed: 1.4,
    outfits: [
      {
        description: 'Sporty Track Jacket & Baggy Cargo Pants',
        topPalette: ['#1e3a8a', '#047857', '#b91c1c', '#334155'],
        bottomPalette: ['#64748b', '#475569', '#374151'],
        accessories: ['messenger_bag', 'flip_phone', 'cargo_pants'],
      },
      {
        description: 'Fitted Layered Hoodie & Low-Rise Denim',
        topPalette: ['#f43f5e', '#3b82f6', '#10b981', '#6366f1'],
        bottomPalette: ['#3b82f6', '#1e293b', '#475569'],
        accessories: ['wired_earbuds', 'backpack', 'hoodie'],
      },
    ],
    propProbability: 0.75,
    typicalProps: ['flip_phone', 'white_earbud_mp3', 'takeout_coffee_cup', 'messenger_bag'],
  },

  '2025': {
    fashionStyle: 'Athleisure, Technical Waterproof Outerwear, Minimalist Tailoring & Smart Glass',
    crowdDensity: 12,
    walkSpeed: 1.45,
    outfits: [
      {
        description: 'Technical Outerwear & Minimalist Monochromatic Athleisure',
        topPalette: ['#0f172a', '#f8fafc', '#334155', '#0d9488'],
        bottomPalette: ['#0f172a', '#1e293b', '#334155'],
        accessories: ['smart_ar_glasses', 'smartwatch', 'athleisure'],
      },
      {
        description: 'Oversized Eco-Linen Blazer & Tailored Trousers',
        topPalette: ['#d6d3d1', '#78716c', '#0284c7', '#e2e8f0'],
        bottomPalette: ['#d6d3d1', '#292524', '#0f172a'],
        accessories: ['wireless_headband', 'smartphone', 'phone'],
      },
    ],
    propProbability: 0.9,
    typicalProps: ['bezel_less_smartphone', 'smart_glasses', 'hydro_flask', 'electric_scooter'],
  },
};

/**
 * Retrieves the PedestriansEraSpec for the given era ID.
 */
export function getPedestrianEraSpec(era: EraId): PedestriansEraSpec {
  const spec = pedestrianEraData[era];
  if (!spec) {
    throw new Error(`Unknown EraId for pedestrian data: ${era}`);
  }
  return spec;
}

/**
 * Interpolates target crowd density continuously across an era transition channel.
 */
export function interpolateCrowdDensity(channel: TimelineChannel): number {
  const fromSpec = getPedestrianEraSpec(channel.fromEra);
  const toSpec = getPedestrianEraSpec(channel.toEra);
  return Math.round(lerpNumber(fromSpec.crowdDensity, toSpec.crowdDensity, channel.t));
}

/**
 * Interpolates average walking speed continuously across an era transition channel.
 */
export function interpolateWalkSpeed(channel: TimelineChannel): number {
  const fromSpec = getPedestrianEraSpec(channel.fromEra);
  const toSpec = getPedestrianEraSpec(channel.toEra);
  return lerpNumber(fromSpec.walkSpeed, toSpec.walkSpeed, channel.t);
}

/**
 * Validates that pedestrian data is fully configured for all standard eras.
 */
export function validatePedestrianEraData(): boolean {
  for (const era of ERAS) {
    const spec = pedestrianEraData[era];
    if (!spec) {
      throw new Error(`Missing pedestrian data for era ${era}`);
    }
    if (typeof spec.crowdDensity !== 'number' || spec.crowdDensity <= 0) {
      throw new Error(`Invalid crowdDensity for era ${era}`);
    }
    if (typeof spec.walkSpeed !== 'number' || spec.walkSpeed <= 0) {
      throw new Error(`Invalid walkSpeed for era ${era}`);
    }
    if (!Array.isArray(spec.outfits) || spec.outfits.length === 0) {
      throw new Error(`Missing outfits for era ${era}`);
    }
    if (!Array.isArray(spec.typicalProps) || spec.typicalProps.length === 0) {
      throw new Error(`Missing typicalProps for era ${era}`);
    }
  }
  return true;
}
