/**
 * Era-driven storefront & advertisement content.
 *
 * Every era ships: a storefront profile (signage style/kinds, business-name
 * pools, awning style/density, window-dressing props, window emissives) and
 * an advertisement profile (medium, ad kinds, copy pool, brightness, colors,
 * density, emissive flag). The palette and signage colors themselves come
 * from `src/era/palette.ts`; this module owns the commercial content so that
 * "theme edits change output" stays true: the builders consume these slices
 * and `resolveStorefrontData` re-resolves them from any overridden
 * `EraStorefronts`/`EraAds` slices supplied by callers (or tests).
 */
import type { EraAds, EraPalette, EraStorefronts, EraId } from '../../era/types';

// ============================================================================
// Shared kinds
// ============================================================================

export type SignageKind =
  | 'painted-fascia'
  | 'neon-tube'
  | 'blade-sign'
  | 'backlit-box'
  | 'led-media-facade';

export type AdKind =
  | 'painted-wall'
  | 'painted-billboard'
  | 'neon-sign'
  | 'poster'
  | 'backlit-sign'
  | 'backlit-billboard'
  | 'led-media-sign'
  | 'digital-billboard';

/** Window-dressing prop descriptor (silhouette geometry + lighting). */
export interface WindowPropSpec {
  kind: string;
  shape: 'box' | 'cylinder' | 'sphere' | 'figure' | 'flat';
  w: number;
  h: number;
  d: number;
  color: ColorHex;
  emissive?: boolean;
  lightColor?: ColorHex;
}

/** One business category with era-plausible shop names. */
export interface BusinessSpec {
  category: string;
  names: readonly string[];
}

export interface EraStorefrontsData {
  /** Mirrors `EraStorefronts.signStyle`. */
  signStyle: string;
  /** Effective signage kinds used on storefronts of this era. */
  signageKinds: readonly SignageKind[];
  /** Letterform paint treatment. */
  fasciaLetterform: LetterformStyle;
  businessPool: readonly BusinessSpec[];
  awningStyle: string;
  awningColors: readonly ColorHex[];
  awningDensity: number;
  windowDressing: string;
  windowProps: readonly WindowPropSpec[];
  windowLightColor: ColorHex;
  windowLightIntensity: number;
}

export interface EraAdsData {
  /** Mirrors `EraAds.medium`. */
  medium: string;
  effectiveKinds: readonly AdKind[];
  copyPool: readonly string[];
  brightness: number;
  colors: readonly ColorHex[];
  density: number;
  emissive: boolean;
}

export type LetterformStyle = 'painted' | 'neon' | 'backlit' | 'led';

type ColorHex = string;

// ============================================================================
// Era content tables
// ============================================================================

const BUSINESS_1945: readonly BusinessSpec[] = [
  { category: 'grocer', names: ['HOOVER GROCERY', 'AMERICAN GROCERS', 'JACKSON MARKET'] },
  { category: 'drugstore', names: ['CITY DRUG STORE', 'THE MAIN APOTHECARY', 'JEFFERSON DRUGS'] },
  { category: 'bakery', names: ['FRESH OVEN BAKERY', 'MORNING LOAF BAKERY'] },
  { category: 'barber', names: ["TONY'S BARBER SHOP", "JIM'S BARBER SHOP"] },
  { category: 'shoe-repair', names: ['SOLE & HEEL REPAIR', 'BRIGHT SHOE SHINE'] },
  { category: 'hardware', names: ['UNION HARDWARE', 'ACE & BOLT HARDWARE'] },
  { category: 'soda-fountain', names: ['ICE COLD SODA', 'MAIN STREET SODA'] },
  { category: 'clothing', names: ['HARRIS CLOTHING', 'BROADWAY TAILORS'] },
  { category: 'five-dime', names: ['MAIN FIVE & DIME', 'CORNER VARIETY'] },
];

const BUSINESS_1965: readonly BusinessSpec[] = [
  { category: 'diner', names: ['STARLITE DINER', 'MOON RAY DINER', 'GREYHOUND DINER'] },
  { category: 'records', names: ['HI-FI RECORDS', 'TURNTABLE RECORDS', '45 RECORDS'] },
  { category: 'travel', names: ['SKYWAY TRAVEL', 'HOLIDAY TRAVEL BUREAU'] },
  { category: 'salon', names: ["MISS MARGIE'S SALON", 'CURL UP SALON'] },
  { category: 'tv-repair', names: ['BAXTER TV & RADIO', 'BROADCAST TV & RADIO'] },
  { category: 'department', names: ['GRANDWAY DEPARTMENT', 'MIDTOWN MERCHANDISE'] },
  { category: 'ice-cream', names: ['VELVET CONE', 'FROSTY FREEZE'] },
  { category: 'camera', names: ['SHUTTERBUG CAMERAS', 'FOCAL POINT PHOTO'] },
  { category: 'bank', names: ['LIBERTY SAVINGS & LOAN', 'MAIN STREET BANK'] },
];

const BUSINESS_1985: readonly BusinessSpec[] = [
  { category: 'arcade', names: ['STAR CASTLE ARCADE', 'GALACTIC GAMES', 'PINBALL PALACE'] },
  { category: 'electronics', names: ['STEREO CITY', 'VIDEO VISION', 'ELECTRO SOUND'] },
  { category: 'video', names: ['PALACE VIDEO', 'VIDEO RANCH', 'SCREEN GEMS VIDEO'] },
  { category: 'pizza', names: ['PEPPERONI PARLOR', 'NEW YORK PIZZA PIE'] },
  { category: 'hair', names: ['NEW WAVE HAIR', 'ELECTRO CUTS'] },
  { category: 'sneakers', names: ['JUMP STREET SHOES', 'AEROBIC KICKS'] },
  { category: 'tapes', names: ['CASSETTE CITY', 'SHREDDER RECORDS'] },
  { category: 'bank', names: ['FIRST NATIONAL BANK', 'METRO SAVINGS'] },
  { category: 'pharmacy', names: ['SAVE-RITE DRUGS', 'MEDICARE PHARMACY'] },
  { category: 'fast-food', names: ['BURGER BLAST', 'CRUNCH TIME'] },
];

const BUSINESS_2005: readonly BusinessSpec[] = [
  { category: 'coffee', names: ['DAILY GRIND COFFEE', 'FRESH BREW COFFEE', 'BEAN COUNTER CAFE'] },
  { category: 'phones', names: ['CALLCO PHONE STORE', 'RINGTONE WIRELESS', 'SIM CARD CITY'] },
  { category: 'bank', names: ['CITYWIDE BANK', 'FIRST CHOICE BANK'] },
  { category: 'electronics', names: ['MEGAHERTZ ELECTRONICS', 'FLATSCREEN PLUS'] },
  { category: 'sandwich', names: ['SUBS & MORE', 'ROAST HOUSE CAFE'] },
  { category: 'pharmacy', names: ['MEDIPLUS PHARMACY', 'CARE RX'] },
  { category: 'books', names: ['PAPERBACK ROW', 'NOOK & CRANNIE BOOKS'] },
  { category: 'gym', names: ['24/7 FITNESS', 'CURVEBALL GYM'] },
  { category: 'yogurt', names: ['SWIRL FROZEN YOGURT', 'FROSTY CUP'] },
];

const BUSINESS_2025: readonly BusinessSpec[] = [
  { category: 'cafe', names: ['CLOUD CAFE', 'FERMENT & BLOOM', 'MATCHA NOW'] },
  { category: 'e-mobility', names: ['VOLT E-SCOOTERS', 'CHARGE & GO', 'SPARK E-MOBILITY'] },
  { category: 'plant-grocer', names: ['GREENHARVEST MARKET', 'LEAF & ROOT GROCERS'] },
  { category: 'cowork', names: ['THE HIVE CO-WORK', 'NODE SPACE'] },
  { category: 'fitness', names: ['PULSE STUDIO', 'BIOREBOOT YOGA'] },
  { category: 'ev-lounge', names: ['CHARGE LOUNGE', 'KILOWATT KITCHEN'] },
  { category: 'phones', names: ['NEOPHONE', 'PRISM DEVICES'] },
  { category: 'plant-shop', names: ['TERRARIUM HOUSE', 'SUCCULENT CITY'] },
  { category: 'boba', names: ['BOBA BLOOM', 'MATCHA NOW'] },
];

const WINDOW_PROPS_1945: readonly WindowPropSpec[] = [
  { kind: 'canned-goods-pyramid', shape: 'cylinder', w: 0.9, h: 0.5, d: 0.9, color: '#8a5a2b' },
  { kind: 'fabric-bolt-stack', shape: 'box', w: 1.4, h: 0.8, d: 0.7, color: '#5a6a4a' },
  { kind: 'wartime-mannequin', shape: 'figure', w: 0.5, h: 1.7, d: 0.35, color: '#b0a493', emissive: true, lightColor: '#f2a03c' },
  { kind: 'bread-basket', shape: 'box', w: 0.8, h: 0.5, d: 0.6, color: '#a88660' },
  { kind: 'soda-fountain', shape: 'cylinder', w: 0.7, h: 1.1, d: 0.7, color: '#3a5f3f' },
  { kind: 'tin-soldiers', shape: 'box', w: 1.0, h: 0.2, d: 0.5, color: '#5a4633' },
];

const WINDOW_PROPS_1965: readonly WindowPropSpec[] = [
  { kind: 'pastel-mannequin', shape: 'figure', w: 0.5, h: 1.75, d: 0.35, color: '#f2c9d0', emissive: true, lightColor: '#ff6f91' },
  { kind: 'record-spinner', shape: 'cylinder', w: 0.6, h: 1.0, d: 0.6, color: '#2a4d8f' },
  { kind: 'television-set', shape: 'box', w: 1.0, h: 0.8, d: 0.9, color: '#1fa3a3', emissive: true, lightColor: '#9fd8ff' },
  { kind: 'ice-cream-stand', shape: 'box', w: 0.9, h: 1.4, d: 0.7, color: '#f5e6c8' },
  { kind: 'travel-poster', shape: 'flat', w: 1.1, h: 1.4, d: 0.05, color: '#ff6f91' },
];

const WINDOW_PROPS_1985: readonly WindowPropSpec[] = [
  { kind: 'neon-mannequin', shape: 'figure', w: 0.5, h: 1.8, d: 0.35, color: '#2a2a35', emissive: true, lightColor: '#ff2bd6' },
  { kind: 'arcade-cabinet', shape: 'box', w: 0.8, h: 1.6, d: 0.9, color: '#30304a', emissive: true, lightColor: '#00e5ff' },
  { kind: 'vcr-stack', shape: 'box', w: 0.9, h: 1.0, d: 0.6, color: '#9aa0a6' },
  { kind: 'boombox', shape: 'box', w: 0.8, h: 0.35, d: 0.25, color: '#3f3f44' },
  { kind: 'sneaker-rack', shape: 'box', w: 1.2, h: 1.3, d: 0.6, color: '#c2b9a8' },
];

const WINDOW_PROPS_2005: readonly WindowPropSpec[] = [
  { kind: 'casual-mannequin', shape: 'figure', w: 0.5, h: 1.7, d: 0.35, color: '#e6eef2', emissive: true, lightColor: '#bfe3ff' },
  { kind: 'coffee-machine', shape: 'box', w: 0.9, h: 1.0, d: 0.7, color: '#b9c4cc' },
  { kind: 'phone-display', shape: 'box', w: 1.3, h: 0.8, d: 0.5, color: '#1f6feb', emissive: true, lightColor: '#bfe3ff' },
  { kind: 'laptop-stand', shape: 'box', w: 1.2, h: 0.5, d: 0.4, color: '#8fa3ad' },
  { kind: 'yogurt-freezer', shape: 'box', w: 1.0, h: 1.2, d: 0.8, color: '#c9cdd4', emissive: true, lightColor: '#e8ecf4' },
];

const WINDOW_PROPS_2025: readonly WindowPropSpec[] = [
  { kind: 'eco-mannequin', shape: 'figure', w: 0.5, h: 1.75, d: 0.35, color: '#d8e8df', emissive: true, lightColor: '#9dffd0' },
  { kind: 'e-scooter', shape: 'box', w: 1.1, h: 0.9, d: 0.5, color: '#4f9f7f', emissive: true, lightColor: '#2ee6a8' },
  { kind: 'plant-wall', shape: 'flat', w: 1.8, h: 1.6, d: 0.2, color: '#7fbf9c' },
  { kind: 'charging-pile', shape: 'box', w: 0.5, h: 1.3, d: 0.4, color: '#33363a', emissive: true, lightColor: '#9dffd0' },
  { kind: 'grocery-bot', shape: 'box', w: 0.8, h: 0.7, d: 0.6, color: '#b5c4bd', emissive: true, lightColor: '#2ee6a8' },
];

const ADS_1945: EraAdsData = {
  medium: 'painted-wall',
  effectiveKinds: ['painted-wall', 'painted-billboard', 'poster'],
  copyPool: [
    'BUY WAR BONDS',
    'ICE COLD SODA',
    'FRESH BREAD DAILY',
    'RATION BOOKS HERE',
    'VICTORY GARDEN SEED',
    'SHOES REPAIRED',
    'SWEEPSTAKES TONIGHT',
    'TRADE & SAVE',
  ],
  brightness: 0.25,
  colors: ['#b03a2e', '#8a5a2b', '#3a5f3f', '#5a4633'],
  density: 0.35,
  emissive: false,
};

const ADS_1965: EraAdsData = {
  medium: 'neon',
  effectiveKinds: ['neon-sign', 'painted-billboard', 'poster'],
  copyPool: [
    'POLAR ICE CREAM',
    'FLY SKYWAY AIR',
    'NEW! HI-FI STEREO',
    'AMERICA\'S MAIN STREET',
    'VISIT THE WORLD',
    'CIGARS & TOBACCO',
    'LUNCH SERVED 11-2',
    'OPEN ALL NIGHT',
  ],
  brightness: 0.5,
  colors: ['#ff6f91', '#1fa3a3', '#f5e6c8', '#2a4d8f'],
  density: 0.4,
  emissive: true,
};

const ADS_1985: EraAdsData = {
  medium: 'neon',
  effectiveKinds: ['neon-sign', 'painted-billboard', 'poster'],
  copyPool: [
    'TODAY ONLY!',
    'VHS RENTALS $2.99',
    'DIET SODA 99 CENT',
    'ARCADE OPEN LATE',
    'STEREO BLOWOUT',
    'CALL COLLECT!',
    'NEW RELEASES NOW',
  ],
  brightness: 0.8,
  colors: ['#00e5ff', '#ff2bd6', '#ffd27d', '#2a2a35'],
  density: 0.45,
  emissive: true,
};

const ADS_2005: EraAdsData = {
  medium: 'backlit',
  effectiveKinds: ['backlit-sign', 'backlit-billboard'],
  copyPool: [
    'NOW WIRELESS',
    'LATTE $3.99',
    'TEXT TO WIN',
    'LIMITED TIME OFFER',
    'FREE WIFI',
    'UNLIMITED MINUTES',
    'GRAND REOPENING',
  ],
  brightness: 0.72,
  colors: ['#1f6feb', '#e6eef2', '#8fa3ad', '#c9cdd4'],
  density: 0.45,
  emissive: true,
};

const ADS_2025: EraAdsData = {
  medium: 'digital-screen',
  effectiveKinds: ['led-media-sign', 'digital-billboard'],
  copyPool: [
    'CHARGE & GO',
    '100% RENEWABLE',
    'PLANT-BASED MENU',
    'FARM TO TABLE',
    'SHARE A RIDE',
    'NET ZERO TODAY',
    'APPS + AI',
    'ORDER AHEAD',
  ],
  brightness: 1.0,
  colors: ['#2ee6a8', '#9dffd0', '#4f9f7f', '#d8e8df'],
  density: 0.55,
  emissive: true,
};

interface EraStorefrontContent {
  storefronts: EraStorefrontsData;
  ads: EraAdsData;
}

/** Canonical per-era storefront + ad profiles. */
export const STOREFRONT_CONTENT_BY_ERA: Record<EraId, EraStorefrontContent> = {
  1945: {
    storefronts: {
      signStyle: 'painted',
      signageKinds: ['painted-fascia'],
      fasciaLetterform: 'painted',
      businessPool: BUSINESS_1945,
      awningStyle: 'striped',
      awningColors: ['#b03a2e', '#f5e6c8', '#8a5a2b'],
      awningDensity: 0.85,
      windowDressing: 'war-ration-displays',
      windowProps: WINDOW_PROPS_1945,
      windowLightColor: '#f2a03c',
      windowLightIntensity: 0.18,
    },
    ads: ADS_1945,
  },
  1965: {
    storefronts: {
      signStyle: 'neon',
      signageKinds: ['neon-tube'],
      fasciaLetterform: 'neon',
      businessPool: BUSINESS_1965,
      awningStyle: 'flat',
      awningColors: ['#f2c9d0', '#b8e0d2', '#f5e6c8'],
      awningDensity: 0.7,
      windowDressing: 'pastel-modern',
      windowProps: WINDOW_PROPS_1965,
      windowLightColor: '#ff6f91',
      windowLightIntensity: 0.4,
    },
    ads: ADS_1965,
  },
  1985: {
    storefronts: {
      signStyle: 'neon',
      signageKinds: ['neon-tube', 'blade-sign'],
      fasciaLetterform: 'neon',
      businessPool: BUSINESS_1985,
      awningStyle: 'metal-blade',
      awningColors: ['#9aa0a6', '#ff2bd6'],
      awningDensity: 0.3,
      windowDressing: 'neon-retail',
      windowProps: WINDOW_PROPS_1985,
      windowLightColor: '#00e5ff',
      windowLightIntensity: 0.65,
    },
    ads: ADS_1985,
  },
  2005: {
    storefronts: {
      signStyle: 'backlit-box',
      signageKinds: ['backlit-box'],
      fasciaLetterform: 'backlit',
      businessPool: BUSINESS_2005,
      awningStyle: 'glass-canopy',
      awningColors: ['#c9cdd4', '#b9c4cc'],
      awningDensity: 0.4,
      windowDressing: 'clean-minimal',
      windowProps: WINDOW_PROPS_2005,
      windowLightColor: '#e8ecf4',
      windowLightIntensity: 0.55,
    },
    ads: ADS_2005,
  },
  2025: {
    storefronts: {
      signStyle: 'led-media',
      signageKinds: ['led-media-facade'],
      fasciaLetterform: 'led',
      businessPool: BUSINESS_2025,
      awningStyle: 'recessed-minimal',
      awningColors: ['#33363a', '#4f9f7f'],
      awningDensity: 0.22,
      windowDressing: 'live-sustain',
      windowProps: WINDOW_PROPS_2025,
      windowLightColor: '#9dffd0',
      windowLightIntensity: 0.95,
    },
    ads: ADS_2025,
  },
};

// ============================================================================
// Style → kind resolution (theme-edit sensitivity)
// ============================================================================

const SIGNAGE_KINDS_BY_STYLE: Readonly<Record<string, readonly SignageKind[]>> = {
  painted: ['painted-fascia'],
  neon: ['neon-tube'],
  'neon+blade': ['neon-tube', 'blade-sign'],
  'backlit-box': ['backlit-box'],
  'led-media': ['led-media-facade'],
};

const LETTERFORM_BY_STYLE: Readonly<Record<string, LetterformStyle>> = {
  painted: 'painted',
  neon: 'neon',
  'neon+blade': 'neon',
  'backlit-box': 'backlit',
  'led-media': 'led',
};

const AD_KINDS_BY_MEDIUM: Readonly<Record<string, readonly AdKind[]>> = {
  'painted-wall': ['painted-wall', 'painted-billboard', 'poster'],
  neon: ['neon-sign', 'painted-billboard'],
  billboard: ['painted-billboard'],
  backlit: ['backlit-sign', 'backlit-billboard'],
  'digital-screen': ['led-media-sign', 'digital-billboard'],
};

/** Optional era-theme slice overrides (theme sensitivity hook). */
export interface StorefrontThemeOverrides {
  storefronts?: Partial<EraStorefronts>;
  ads?: Partial<EraAds>;
  palette?: Partial<EraPalette>;
}

/** Fully resolved storefront + ad profile for one era (after overrides). */
export interface ResolvedStorefrontData {
  era: EraId;
  storefronts: EraStorefrontsData;
  ads: EraAdsData;
}

/**
 * Resolve the effective storefront/ad content for an era. Any overridden
 * theme slice changes which signage/ad styles, kinds and densities drive the
 * build — the builders read *only* from the resolved result.
 */
export function resolveStorefrontData(
  eraId: EraId,
  overrides?: StorefrontThemeOverrides,
): ResolvedStorefrontData {
  const base = STOREFRONT_CONTENT_BY_ERA[eraId];
  let sf = base.storefronts;
  let ads = base.ads;

  const sfOverride = overrides?.storefronts;
  if (sfOverride !== undefined) {
    let signStyle = sf.signStyle;
    let signageKinds = sf.signageKinds;
    let letterform = sf.fasciaLetterform;
    if (sfOverride.signStyle !== undefined) {
      signStyle = sfOverride.signStyle;
      signageKinds = SIGNAGE_KINDS_BY_STYLE[signStyle] ?? sf.signageKinds;
      letterform = LETTERFORM_BY_STYLE[signStyle] ?? sf.fasciaLetterform;
    }
    sf = {
      ...sf,
      signStyle,
      signageKinds,
      fasciaLetterform: letterform,
      awningStyle: sfOverride.awningStyle ?? sf.awningStyle,
      awningColors: sf.awningColors,
      awningDensity: sfOverride.awningDensity ?? sf.awningDensity,
      windowDressing: sfOverride.windowDressing ?? sf.windowDressing,
    };
  }

  const adsOverride = overrides?.ads;
  if (adsOverride !== undefined) {
    let medium = ads.medium;
    let effectiveKinds = ads.effectiveKinds;
    if (adsOverride.medium !== undefined) {
      medium = adsOverride.medium;
      effectiveKinds = AD_KINDS_BY_MEDIUM[medium] ?? ads.effectiveKinds;
    }
    ads = {
      ...ads,
      medium,
      effectiveKinds,
      brightness: adsOverride.brightness ?? ads.brightness,
      density: adsOverride.density ?? ads.density,
      colors: adsOverride.colors ?? ads.colors,
    };
  }

  return { era: eraId, storefronts: sf, ads };
}