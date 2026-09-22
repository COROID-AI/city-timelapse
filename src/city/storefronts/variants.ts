/**
 * Era storefront variant catalogue and canonical ground-floor bay-slot geometry.
 *
 * This module is pure data: it pins the bay-slot constants mandated by the
 * task contract (so shopfronts mount into building bays without editing
 * building files) and describes, for every timeline year, exactly which
 * signage, awning, window-display, billboard, kiosk, newsstand, and street
 * furniture treatments an era-correct shopfront carries. `signage.ts` turns
 * these declarations into procedural canvas textures, `displays.ts` turns
 * them into scene geometry, and `index.ts` composes both into the
 * `StorefrontsModule`.
 *
 * All brand names are invented for this scene; no real trademarks appear.
 */

import type { EraYear } from '../../era/timeline';

/* --------------------------------------------------------------------------
 * Canonical storefront bay-slot constants (pinned by the task contract).
 * -------------------------------------------------------------------------- */

/** Center-to-center distance between adjacent ground-floor bay slots, in world units. */
export const BAY_SLOT_PITCH = 6;

/** Clear opening width of one shopfront bay, in world units (piers fill the rest). */
export const BAY_CLEAR_WIDTH = 5;

/** Elevation of the bay base at sidewalk top, in world units. */
export const BAY_BASE_Y = 0.15;

/** Lower edge of the fascia sign band above the sidewalk, in world units. */
export const SIGN_BAND_MIN_Y = 3.2;

/** Upper edge of the fascia sign band above the sidewalk, in world units. */
export const SIGN_BAND_MAX_Y = 4.2;

/** Vertical size of the fascia sign band (4.2 - 3.2). */
export const SIGN_BAND_HEIGHT = SIGN_BAND_MAX_Y - SIGN_BAND_MIN_Y;

/** Centerline elevation of the fascia sign band above the sidewalk. */
export const SIGN_BAND_CENTER_Y = (SIGN_BAND_MIN_Y + SIGN_BAND_MAX_Y) / 2;

/* --------------------------------------------------------------------------
 * Bay slot geometry.
 * -------------------------------------------------------------------------- */

/** One computed ground-floor bay position along a facade. */
export interface BaySlot {
  /** Stable id used by pickable descriptors and audio events (`bay-0`, ...). */
  readonly id: string;
  /** Zero-based index along the facade. */
  readonly index: number;
  /** World X of the bay center (slot pitch applied from the origin). */
  readonly x: number;
  /** World Z of the bay center (facade line). */
  readonly z: number;
  /** Facade facing angle in radians; 0 faces +Z. */
  readonly rotationY: number;
}

/** Options for {@link createBaySlots}. */
export interface BaySlotOptions {
  /** World X of the first bay center. Defaults to 0. */
  originX?: number;
  /** World Z of the facade line. Defaults to 0. */
  originZ?: number;
  /** Facade facing angle in radians. Defaults to 0 (facing +Z). */
  rotationY?: number;
}

/**
 * Compute `count` bay slots spaced every {@link BAY_SLOT_PITCH} units along a
 * facade line. Slots never overlap: the 6-unit pitch leaves a 1-unit pier
 * between the 5-unit clear openings.
 */
export function createBaySlots(count: number, options: BaySlotOptions = {}): BaySlot[] {
  const { originX = 0, originZ = 0, rotationY = 0 } = options;
  const slots: BaySlot[] = [];
  const total = Math.max(0, Math.floor(count));
  for (let index = 0; index < total; index += 1) {
    slots.push({
      id: `bay-${index}`,
      index,
      x: originX + index * BAY_SLOT_PITCH,
      z: originZ,
      rotationY,
    });
  }
  return slots;
}

/* --------------------------------------------------------------------------
 * Era treatment vocabulary.
 * -------------------------------------------------------------------------- */

/** How the primary fascia sign (inside the 3.2..4.2 sign band) is built. */
export type FasciaSignKind =
  | 'enamel-plate'
  | 'pastel-channel-letters'
  | 'neon-tube'
  | 'push-through-plastic'
  | 'led-matrix';

/** How lettering on the entry transom glass is applied. */
export type TransomSignKind =
  | 'gold-leaf-glass'
  | 'pastel-channel-letters'
  | 'neon-tube'
  | 'push-through-plastic'
  | 'led-matrix';

/** Secondary projecting blade sign hung from the pier. */
export type BladeSignKind = 'enamel-plate' | 'backlit-box';

/** Awning/canopy treatment above the display window. */
export type AwningKind =
  | 'scalloped-fabric'
  | 'pastel-scalloped'
  | 'slim-metal'
  | 'wedge-fabric'
  | 'none';

/** Merchandising treatment inside the display window. */
export type WindowDisplayKind =
  | 'butcher-paper'
  | 'animated-pastel'
  | 'arcade-glow'
  | 'chain-merch'
  | 'projection-mapped';

/** Rooftop / wall billboard treatment. */
export type BillboardKind =
  | 'painted-rooftop'
  | 'pastel-wall-painted'
  | 'bold-neon-rooftop'
  | 'backlit-billboard'
  | 'led-digital';

/** Freestanding pavement advertising kiosk treatment. */
export type KioskKind =
  | 'lit-poster-column'
  | 'poster-pillar'
  | 'backlit-poster-kiosk'
  | 'lcd-ad-panel'
  | 'led-wrap-kiosk';

/** Newsstand / periodical rack treatment. */
export type NewsstandKind =
  | 'wooden-paper-rack'
  | 'metal-magazine-rack'
  | 'backlit-newsstand'
  | 'chain-kiosk'
  | 'smart-glass-kiosk';

/** Per-era emissive drive character for animated sign materials. */
export type EmissiveDrive = 'incandescent' | 'fluorescent' | 'neon' | 'backlit' | 'led';

/**
 * Complete era storefront variant: every treatment one bay renders for a
 * single timeline year, plus the invented brand vocabulary the procedural
 * signage textures draw.
 */
export interface EraStorefrontVariant {
  readonly year: EraYear;
  readonly label: string;
  /** Sign mounted inside the 3.2..4.2 fascia band. */
  readonly fasciaSign: FasciaSignKind;
  /** Lettering applied to the entry transom glass. */
  readonly transomSign: TransomSignKind;
  /** Projecting blade sign, or null when the era does not use one. */
  readonly bladeSign: BladeSignKind | null;
  /** Awning treatment, or 'none'. */
  readonly awning: AwningKind;
  /** Window display merchandising treatment. */
  readonly windowDisplay: WindowDisplayKind;
  /** Backlit menu board present under the fascia (chain identity eras). */
  readonly menuBoard: boolean;
  /** Scrolling window ticker strip present at the head of the display. */
  readonly ticker: boolean;
  /** Projection-mapped glass overlay across the display glazing. */
  readonly projectionGlass: boolean;
  /** Billboard treatment for rooftop + wall advertising faces. */
  readonly billboard: BillboardKind;
  /** Freestanding pavement advertising kiosk treatment. */
  readonly kiosk: KioskKind;
  /** Newsstand / periodical rack treatment. */
  readonly newsstand: NewsstandKind;
  /** Whether a street vending cart appears on the sidewalk. */
  readonly pushcart: boolean;
  /** Emissive drive character and intensity for lit signage. */
  readonly emissive: {
    readonly character: EmissiveDrive;
    /** Baseline emissive intensity applied to lit sign materials. */
    readonly baseIntensity: number;
  };
  /** Documented audio hooks this era's ambience emits (see index.ts). */
  readonly audioHooks: readonly StorefrontAudioHook[];
  /** Invented shop names used for fascia/transom lettering. */
  readonly brands: readonly string[];
  /** Invented taglines stamped under brand names. */
  readonly taglines: readonly string[];
  /** Era products stocked in the window display (instanced props). */
  readonly windowProducts: readonly string[];
  /** Invented headline/poster copy for poster walls and billboards. */
  readonly headlines: readonly string[];
}

/* --------------------------------------------------------------------------
 * Audio hook names shared by all variants (documented for t-audio-sfx).
 * -------------------------------------------------------------------------- */

/**
 * Documented storefront audio hook events. The module emits these through
 * `StorefrontsModule.onAudioEvent` / the `onAudioEvent` option whenever the
 * matching ambience is active, with `{ sourceId, era, intensity, time }`
 * payloads. t-audio-sfx subscribes and maps them to synthesized one-shots
 * or loops; nothing in this module plays audio itself.
 */
export const STOREFRONT_AUDIO_HOOKS = {
  /** A sign band swapped its era treatment during a staged transition. */
  SIGN_SWAP: 'storefront:sign-swap',
  /** 1965 fluorescent/channel-letter ballast hum loop tick. */
  FLUORESCENT_HUM: 'storefront:fluorescent-hum',
  /** 1985 neon transfomer hum loop tick. */
  NEON_HUM: 'storefront:neon-hum',
  /** 1985 neon tube dropout/flicker one-shot. */
  NEON_FLICKER: 'storefront:neon-flicker',
  /** 2005 backlit acrylic box/menu-board buzz loop tick. */
  BACKLIT_BUZZ: 'storefront:backlit-buzz',
  /** 2005/2025 window ticker motor scroll loop tick. */
  LED_SCROLL: 'storefront:led-scroll',
  /** 2025 LED matrix refresh tick one-shot. */
  LED_TICK: 'storefront:led-tick',
} as const;

/** Union of all documented storefront audio hook names. */
export type StorefrontAudioHook = (typeof STOREFRONT_AUDIO_HOOKS)[keyof typeof STOREFRONT_AUDIO_HOOKS];

/** All documented hook names as a plain array (stable order). */
export const STOREFRONT_AUDIO_HOOK_LIST: readonly StorefrontAudioHook[] = Object.values(
  STOREFRONT_AUDIO_HOOKS,
);

/* --------------------------------------------------------------------------
 * The five era variants.
 * -------------------------------------------------------------------------- */

/**
 * Authoritative per-era storefront treatments.
 *
 * - 1945: hand-painted gold-leaf glass lettering, enamel wall/blade signs,
 *   scalloped fabric awnings, butcher-paper window displays, pushcarts.
 * - 1965: pastel plastic channel letters, animated window displays,
 *   record-shop poster walls, pastel scalloped awnings.
 * - 1985: neon tubing, backlit plastic box signs, video-arcade glow,
 *   bold rooftop billboards.
 * - 2005: illuminated push-through plastic, backlit menu boards,
 *   chain-brand identity, scrolling window tickers.
 * - 2025: animated LED matrix screens, projection-mapped glass,
 *   minimal digital brand systems.
 */
export const ERA_STOREFRONT_VARIANTS: Readonly<Record<EraYear, EraStorefrontVariant>> = Object.freeze({
  1945: {
    year: 1945,
    label: 'Wartime hand-painted shopfronts',
    fasciaSign: 'enamel-plate',
    transomSign: 'gold-leaf-glass',
    bladeSign: 'enamel-plate',
    awning: 'scalloped-fabric',
    windowDisplay: 'butcher-paper',
    menuBoard: false,
    ticker: false,
    projectionGlass: false,
    billboard: 'painted-rooftop',
    kiosk: 'lit-poster-column',
    newsstand: 'wooden-paper-rack',
    pushcart: true,
    emissive: { character: 'incandescent', baseIntensity: 0.35 },
    audioHooks: [STOREFRONT_AUDIO_HOOKS.SIGN_SWAP],
    brands: [
      'GOLDFELL & SON BUTCHERY',
      'ATLAS HARDWARE & PAINT',
      'ROSEWOOD TAILORING',
      'LIBERTY CANDY KITCHEN',
      'MERIDIAN BARBER SHOP',
      'OAKLEAF GROCERY',
    ],
    taglines: [
      'PURVEYORS OF FINE GOODS',
      'CASH CREDIT & TRADE',
      'SINCE 1912 • QUALITY ASSURED',
      'YOUR NEIGHBORHOOD STORE',
    ],
    windowProducts: ['flour sack', 'enamel pot', 'radio valve set', 'leather boots', 'canned peaches'],
    headlines: [
      'WAR BONDS SOLD HERE',
      'FRESH CUTS DAILY',
      'VICTORY GARDEN SEEDS',
      'RADIos REPAIRED WHILE-U-WAIT',
    ],
  },
  1965: {
    year: 1965,
    label: 'Pastel plastic & chrome shopfronts',
    fasciaSign: 'pastel-channel-letters',
    transomSign: 'pastel-channel-letters',
    bladeSign: null,
    awning: 'pastel-scalloped',
    windowDisplay: 'animated-pastel',
    menuBoard: false,
    ticker: false,
    projectionGlass: false,
    billboard: 'pastel-wall-painted',
    kiosk: 'poster-pillar',
    newsstand: 'metal-magazine-rack',
    pushcart: true,
    emissive: { character: 'fluorescent', baseIntensity: 0.9 },
    audioHooks: [STOREFRONT_AUDIO_HOOKS.SIGN_SWAP, STOREFRONT_AUDIO_HOOKS.FLUORESCENT_HUM],
    brands: [
      'TUTTI FRUTTI RECORDS',
      'PASTEL PALACE DINER',
      'SUNNY SIDE LAUNDROMAT',
      'BOW-LANE BOOKS',
      'CHERRY COLA COMMISSARY',
      'MOD MODE DRESSING ROOM',
    ],
    taglines: [
      'HI-FI LPs & SHELLAC',
      'DRIVE-IN SERVICE DAILY',
      'GO GO FASHIONS FOR ALL',
      'ICE COLD • EXTRA THICK',
    ],
    windowProducts: ['vinyl LP crate', 'transistor radio', 'pastel stand mixer', 'waffle iron', 'sunglass rack'],
    headlines: [
      'NOW OPEN: SUNDAY MATINEE',
      'THE SOUND OF THE CITY',
      'TWIST COMPETITION TONIGHT',
      'ALL YOU CAN SIP 25c',
    ],
  },
  1985: {
    year: 1985,
    label: 'Neon & backlit arcade era',
    fasciaSign: 'neon-tube',
    transomSign: 'neon-tube',
    bladeSign: 'backlit-box',
    awning: 'slim-metal',
    windowDisplay: 'arcade-glow',
    menuBoard: false,
    ticker: false,
    projectionGlass: false,
    billboard: 'bold-neon-rooftop',
    kiosk: 'backlit-poster-kiosk',
    newsstand: 'backlit-newsstand',
    pushcart: false,
    emissive: { character: 'neon', baseIntensity: 2.4 },
    audioHooks: [
      STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
      STOREFRONT_AUDIO_HOOKS.NEON_HUM,
      STOREFRONT_AUDIO_HOOKS.NEON_FLICKER,
    ],
    brands: [
      'VOLTAGE VIDEO ARCADE',
      'NEON NOODLE HOUSE',
      'CASSETTE CORNER',
      'CHROME WHEELS AUTO',
      'PIXEL PALACE THEATRE',
      'SLUSH PUNK FROZEN TREATS',
    ],
    taglines: [
      'INSERT COIN • PLAY ALL NIGHT',
      'OPEN TILL 2AM',
      'MIXTAPES MADE WHILE-U-WAIT',
      'BIG HAIR BIG BURGERS',
    ],
    windowProducts: ['arcade marquee', 'VHS cassette wall', 'boombox', 'hi-top sneakers', 'joystick box'],
    headlines: [
      'SUMMER OF SEQUELS',
      'LIVE BAND NIGHT • NO COVER',
      'NEW TURBO TAXI FLEET',
      'AEROBICS ATHON SUNDAY',
    ],
  },
  2005: {
    year: 2005,
    label: 'Backlit chain-identity era',
    fasciaSign: 'push-through-plastic',
    transomSign: 'push-through-plastic',
    bladeSign: 'backlit-box',
    awning: 'wedge-fabric',
    windowDisplay: 'chain-merch',
    menuBoard: true,
    ticker: true,
    projectionGlass: false,
    billboard: 'backlit-billboard',
    kiosk: 'lcd-ad-panel',
    newsstand: 'chain-kiosk',
    pushcart: false,
    emissive: { character: 'backlit', baseIntensity: 1.8 },
    audioHooks: [
      STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
      STOREFRONT_AUDIO_HOOKS.BACKLIT_BUZZ,
      STOREFRONT_AUDIO_HOOKS.LED_SCROLL,
    ],
    brands: [
      'DRIP & BEAN COFFEE',
      'CITYGRID WIRELESS',
      'FRESH & FORTH SALADS',
      'PIZZA PORTICO',
      'SMOOTHEASE JUICE BAR',
      'BYTE-SIZE BURGERS',
    ],
    taglines: [
      'WELCOME. HOW CAN WE HELP YOU?',
      'FREE WI-FI INSIDE',
      'FAST • FRESH • FRIENDLY',
      'NOW WITH LOYALTY POINTS',
    ],
    windowProducts: ['flat-panel display', 'espresso machine', 'wired headphones', 'energy cooler', 'cargo shorts stack'],
    headlines: [
      'NEW LOW FARES EVERY DAY',
      'UNLIMITED TALK + TEXT',
      'SUPER SIZED VALUE MENU',
      'SIGN UP AND SAVE 20%',
    ],
  },
  2025: {
    year: 2025,
    label: 'LED matrix & projection minimal era',
    fasciaSign: 'led-matrix',
    transomSign: 'led-matrix',
    bladeSign: null,
    awning: 'none',
    windowDisplay: 'projection-mapped',
    menuBoard: true,
    ticker: true,
    projectionGlass: true,
    billboard: 'led-digital',
    kiosk: 'led-wrap-kiosk',
    newsstand: 'smart-glass-kiosk',
    pushcart: false,
    emissive: { character: 'led', baseIntensity: 2.6 },
    audioHooks: [
      STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
      STOREFRONT_AUDIO_HOOKS.LED_SCROLL,
      STOREFRONT_AUDIO_HOOKS.LED_TICK,
    ],
    brands: [
      'AURA WELLNESS LAB',
      'LOOP GROCER',
      'NOVA MOBILITY HUB',
      'FIELD & FIBER KITCHEN',
      'SIGNAL & SOUL STUDIO',
      'TERRA REFILL MARKET',
    ],
    taglines: [
      'CARBON NEUTRAL • LOCALLY SOURCED',
      'REFILL NOT LANDFILL',
      'MEMBERS ONLY RATES',
      'ZERO WASTE DAILY',
    ],
    windowProducts: ['display plinth', 'AR visor stand', 'refill jar wall', 'smart ring dock', 'sneaker drop pedestal'],
    headlines: [
      'GRID-SORTED DELIVERY',
      'CITY AS A PLATFORM',
      'SEASON PASS NOW LIVE',
      'CIRCULAR BY DESIGN',
    ],
  },
});

/** All five era variants in ascending chronological order. */
export const STOREFRONT_VARIANT_YEARS = [1945, 1965, 1985, 2005, 2025] as const;

/** Retrieve the storefront variant for a supported timeline year. */
export function getStorefrontVariant(year: EraYear): EraStorefrontVariant {
  return ERA_STOREFRONT_VARIANTS[year];
}

/**
 * Deterministically pick a shop name for one bay in one era. Bay index and
 * era year seed the pick so callouts, fascia lettering, and taglines stay
 * stable across reloads and consistent with each other.
 */
export function brandForBay(variant: EraStorefrontVariant, bayIndex: number): string {
  const brands = variant.brands;
  const pick = Math.abs(Math.round(bayIndex) * 31 + variant.year) % brands.length;
  return brands[pick];
}

/** Deterministically pick a tagline for one bay in one era. */
export function taglineForBay(variant: EraStorefrontVariant, bayIndex: number): string {
  const taglines = variant.taglines;
  const pick = Math.abs(Math.round(bayIndex) * 17 + variant.year) % taglines.length;
  return taglines[pick];
}

/** Deterministically pick a headline (poster/billboard copy) for one era slot. */
export function headlineForSlot(variant: EraStorefrontVariant, slot: number): string {
  const headlines = variant.headlines;
  const pick = Math.abs(Math.round(slot) * 13 + variant.year) % headlines.length;
  return headlines[pick];
}
