/**
 * Per-era storefronts & advertisements (1945–2025).
 *
 * This subsystem owns the visual dressing of the storefront spans defined by
 * the city block layout. It consumes two shared modules strictly read-only:
 *  - the era registry (`src/scenes/eras/`) for era-authentic design values,
 *  - the city block layout (`src/scenes/layout/`) for the storefront spans.
 *
 * For every era it produces:
 *  - storefront dressing (awning/canopy, door closure, glass front, window
 *    displays, mannequins, lighting),
 *  - one piece of signage per storefront span,
 *  - as many advertisements as the era prescribes.
 *
 * During era transitions the numeric values (lighting, glass, intensity, ad
 * count, animated ratio) interpolate linearly via the shared interpolation
 * engine, while discrete content (sign text, materials, ad copy) follows the
 * era-domain endpoint rule (from below 0.5, to at/above 0.5).
 *
 * @packageDocumentation
 */

import { getEra, getInterpolatedEra } from '../eras/index.js';
import type { EraData } from '../eras/index.js';
import { CITY_BLOCK_LAYOUT } from '../layout/index.js';
import type { Storefront } from '../layout/index.js';
import { ERA_CONTENT_YEARS, ERA_STOREFRONT_CONTENT } from './content.js';
import type {
  Advertisement,
  Signage,
  StorefrontsComponent,
  StorefrontsScene,
  StorefrontsState,
  StorefrontDressing,
} from './types.js';

/** Clamp a value into [0, 1]. */
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Resolve the era data for a frame. When `t` is provided in (0,1) the shared
 * interpolation engine blends the given year toward the next one; otherwise
 * the exact era is used.
 */
function resolveEra(year: number, t?: number): EraData {
  if (t !== undefined && t !== 0) {
    return getInterpolatedEra(year, clamp01(t));
  }
  return getEra(year);
}

/** Pick the nearest content catalogue for the interpolated year. */
function contentForYear(year: number) {
  const years = ERA_CONTENT_YEARS;
  let best = years[0]!;
  for (const y of years) {
    if (y <= year) {
      best = y;
    } else {
      break;
    }
  }
  return ERA_STOREFRONT_CONTENT[best]!;
}

/** Deterministic pick from an array (wraps around). */
const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length]!;

/** Build one dressing per layout storefront span. */
function buildStorefronts(
  spans: readonly Storefront[],
  era: EraData,
): StorefrontDressing[] {
  return spans.map((span, i) => {
    const s = era.storefronts;
    const lot = CITY_BLOCK_LAYOUT.lots.find((l) => l.id === span.lotId);
    return {
      storefrontId: span.id,
      lotId: span.lotId,
      awning: s.awning,
      doorClosure: s.doorClosure,
      glassFront: clamp01(s.glassFront),
      windowDressing: clamp01(s.windowDressing),
      // Mannequins scale with window dressing richness (0..4).
      mannequins: Math.round(clamp01(s.windowDressing) * 4 * (spanStart(i))),
      canopy: s.awning !== 'none',
      lighting: clamp01(s.signageLighting),
    };
  });
}

/** Deterministic per-span factor in (0,1] so mannequin counts vary by span. */
function spanStart(i: number): number {
  return 0.5 + ((i * 37) % 50) / 100;
}

/** Build one sign per layout storefront span. */
function buildSignage(
  spans: readonly Storefront[],
  era: EraData,
  year: number,
): Signage[] {
  const content = contentForYear(year);
  return spans.map((span, i) => {
    const c = era.storefronts;
    return {
      id: `${span.id}-sign`,
      storefrontId: span.id,
      text: pick(content.signText, i),
      style: pick(content.signStyles, i),
      material: pick(content.signMaterials, i),
      lighting: clamp01(c.signageLighting),
      color: pick(era.advertisements.panelPalette, i),
    };
  });
}

/** Build the era's advertisements, anchored onto the storefront spans. */
function buildAdvertisements(
  spans: readonly Storefront[],
  era: EraData,
  year: number,
): Advertisement[] {
  const ads = era.advertisements;
  const count = Math.max(0, Math.round(ads.count));
  const content = contentForYear(year);
  const result: Advertisement[] = [];
  for (let i = 0; i < count; i++) {
    const span = spans[i % spans.length]!;
    result.push({
      id: `ad-${i}`,
      storefrontId: span.id,
      medium: ads.medium,
      content: pick(content.adCopy, i),
      intensity: clamp01(ads.intensity),
      color: pick(ads.panelPalette, i),
      animated: (i / count) < clamp01(ads.animatedRatio),
    });
  }
  return result;
}

/** Compose the full scene state from an era and the layout spans. */
function composeState(era: EraData): StorefrontsState {
  const spans = CITY_BLOCK_LAYOUT.storefronts;
  return {
    year: era.year,
    eraStyleId: era.storefronts.styleId,
    storefronts: buildStorefronts(spans, era),
    signage: buildSignage(spans, era, era.year),
    advertisements: buildAdvertisements(spans, era, era.year),
  };
}

/**
 * Concrete `Storefronts` component. Implements the
 * instantiate → attach → update → dispose lifecycle.
 */
export const Storefronts: StorefrontsComponent = {
  instantiate(): StorefrontsScene {
    let state: StorefrontsState | null = null;
    let attached = false;
    let disposed = false;

    const scene: StorefrontsScene = {
      get state() {
        if (state === null) {
          throw new Error('Storefronts not yet updated; call update(year) first.');
        }
        return state;
      },

      attach() {
        if (disposed) {
          throw new Error('Cannot attach a disposed Storefronts scene.');
        }
        attached = true;
      },

      update(year: number, t?: number): StorefrontsState {
        if (disposed) {
          throw new Error('Cannot update a disposed Storefronts scene.');
        }
        const era = resolveEra(year, t);
        state = composeState(era);
        return scene.state;
      },

      dispose() {
        disposed = true;
        attached = false;
        state = null;
      },
    };

    return scene;
  },
};