/**
 * Era Specification Registry
 *
 * The single declarative source of truth for all five decades (1945–2025)
 * across every visual and audio category in the city timelapse scene.
 *
 * All data is pure, serializable, and free of runtime side effects. Consumers
 * (buildings, vehicles, storefronts, ads, pedestrians, audio) read from this
 * registry via the typed lookup helpers `getEra` and `getAllEras`.
 */

/* ------------------------------------------------------------------ */
/* Core type aliases                                                  */
/* ------------------------------------------------------------------ */

/** The five selectable timeline years, in chronological order. */
export type EraId = 1945 | 1965 | 1985 | 2005 | 2025;

/** An ordered list of all era ids, earliest first. */
export const ERA_IDS: readonly EraId[] = [1945, 1965, 1985, 2005, 2025] as const;

/** A CSS-compatible hex color string, e.g. `'#8B7355'`. */
export type HexColor = string;

/** A stable identifier for a named color palette used by a category. */
export type PaletteId = string;

/* ------------------------------------------------------------------ */
/* Category-specific interfaces                                       */
/* ------------------------------------------------------------------ */

/**
 * Building appearance and architectural descriptors for a single era.
 */
export interface BuildingEraData {
  /** Stable palette id consumed by the building material builder. */
  paletteId: PaletteId;
  /** Descriptive architecture style name, e.g. `'Art Deco'`. */
  architecturalStyle: string;
  /** Common building material descriptors for procedural selection. */
  materials: readonly string[];
  /** Typical façade colors (hex). */
  facadeColors: readonly HexColor[];
  /** Roof colors (hex). */
  roofColors: readonly HexColor[];
  /** Window treatment style descriptor. */
  windowStyle: string;
  /** Relative building height multiplier (1.0 = baseline). */
  heightMultiplier: number;
  /** Setback / footprint density descriptor. */
  footprintDensity: 'sparse' | 'medium' | 'dense';
  /** Whether illuminated neon or electric signage is present. */
  hasNeonSignage: boolean;
}

/**
 * Vehicle appearance and behaviour descriptors for a single era.
 */
export interface VehicleEraData {
  /** Stable palette id consumed by the vehicle material builder. */
  paletteId: PaletteId;
  /** Descriptive vehicle archetype, e.g. `'Sedan'`. */
  archetype: string;
  /** Body colors (hex) sampled per vehicle. */
  bodyColors: readonly HexColor[];
  /** Approximate top speed in scene units / second. */
  topSpeed: number;
  /** Traffic density on the roads — relative spawn multiplier. */
  densityMultiplier: number;
  /** Whether vehicles use headlight emissive materials at dusk/night. */
  hasHeadlights: boolean;
  /** Silhouette / proportion descriptor for procedural mesh shaping. */
  silhouette: string;
}

/**
 * Storefront signage and awning descriptors for a single era.
 */
export interface StorefrontEraData {
  /** Stable palette id consumed by the storefront builder. */
  paletteId: PaletteId;
  /** Era-appropriate sign copy strings drawn on storefront signage. */
  signCopy: readonly string[];
  /** Awning / canopy colors (hex). */
  awningColors: readonly HexColor[];
  /** Sign typography style descriptor. */
  signTypography: string;
  /** Whether signs use illuminated (back-lit) panels. */
  illuminatedSigns: boolean;
  /** Window display descriptor for procedural props. */
  windowDisplay: string;
}

/**
 * Advertisement billboard content and style for a single era.
 */
export interface AdvertisementEraData {
  /** Stable palette id consumed by the advertisement builder. */
  paletteId: PaletteId;
  /** Era-appropriate ad copy strings rendered on billboards. */
  adCopy: readonly string[];
  /** Billboard background colors (hex). */
  backgroundColors: readonly HexColor[];
  /** Billboard text colors (hex). */
  textColors: readonly HexColor[];
  /** Art direction / illustration style descriptor. */
  artStyle: string;
  /** Whether billboards are animated / scrolling digital panels. */
  isDigital: boolean;
}

/**
 * Pedestrian garment and appearance descriptors for a single era.
 */
export interface PedestrianOutfitEraData {
  /** Stable palette id consumed by the pedestrian material builder. */
  paletteId: PaletteId;
  /** Descriptive garment / fashion style name. */
  fashionStyle: string;
  /** Outerwear colors (hex). */
  outerwearColors: readonly HexColor[];
  /** Trouser / skirt colors (hex). */
  lowerGarmentColors: readonly HexColor[];
  /** Headwear descriptor, e.g. `'fedora'` or `'none'`. */
  headwear: string;
  /** Footwear descriptor. */
  footwear: string;
  /** Relative density of pedestrians on sidewalks (1.0 = baseline). */
  densityMultiplier: number;
}

/**
 * Sound-effect palette and ambience descriptors for a single era.
 */
export interface SfxEraData {
  /** Stable palette id consumed by the audio manager. */
  paletteId: PaletteId;
  /** Human-readable ambience descriptor, e.g. `'Jazz street corner'`. */
  ambience: string;
  /** Engine / vehicle sfx descriptor. */
  vehicleSfx: string;
  /** Footstep sfx descriptor. */
  footstepSfx: string;
  /** Relative ambient volume (0–1). */
  ambientVolume: number;
  /** Whether music is diegetic (from storefronts) or background. */
  musicStyle: string;
}

/* ------------------------------------------------------------------ */
/* Top-level EraSpec                                                   */
/* ------------------------------------------------------------------ */

/**
 * Top-level configuration for a single era. Aggregates every category-
 * specific data block so that consumers need only one lookup call.
 */
export interface EraSpec {
  /** The timeline year this spec describes. */
  id: EraId;
  /** Short human-readable label for the timeline HUD. */
  label: string;
  /** Longer descriptive subtitle shown in the HUD. */
  subtitle: string;
  /** Time-of-day lighting descriptor, e.g. `'golden-hour'`. */
  lighting: string;
  /** Sky / atmosphere color (hex). */
  skyColor: HexColor;
  /** Ground / pavement color (hex). */
  groundColor: HexColor;
  /** Fog color (hex). */
  fogColor: HexColor;
  /** Fog density (0 = none). */
  fogDensity: number;
  /** Building category data. */
  buildings: BuildingEraData;
  /** Vehicle category data. */
  vehicles: VehicleEraData;
  /** Storefront category data. */
  storefronts: StorefrontEraData;
  /** Advertisement category data. */
  advertisements: AdvertisementEraData;
  /** Pedestrian outfit category data. */
  pedestrians: PedestrianOutfitEraData;
  /** Sound-effect category data. */
  sfx: SfxEraData;
}

/* ------------------------------------------------------------------ */
/* Registry                                                           */
/* ------------------------------------------------------------------ */

/**
 * The complete era registry. A `Record` keyed by `EraId` guarantees that
 * every era is present at compile time — the TypeScript compiler will error
 * if any of the five entries is missing or mistyped.
 */
export const ERA_REGISTRY: Record<EraId, EraSpec> = {
  /* -------------------------------------------------------------- 1945 */
  1945: {
    id: 1945,
    label: '1945',
    subtitle: 'Post-war recovery & classic Americana',
    lighting: 'warm-golden-hour',
    skyColor: '#E8C9A0',
    groundColor: '#6B6357',
    fogColor: '#D4B896',
    fogDensity: 0.012,
    buildings: {
      paletteId: 'buildings-1945',
      architecturalStyle: 'Art Deco & Streamline Moderne',
      materials: ['limestone', 'terracotta', 'buff-brick'],
      facadeColors: ['#C9B79C', '#A89178', '#8B7355'],
      roofColors: ['#4A3728', '#5C4033'],
      windowStyle: 'steel-sash-casement',
      heightMultiplier: 0.7,
      footprintDensity: 'sparse',
      hasNeonSignage: false,
    },
    vehicles: {
      paletteId: 'vehicles-1945',
      archetype: 'Classic Sedan',
      bodyColors: ['#2B2B2B', '#4A2C2A', '#5C5C5C', '#7A4B3A'],
      topSpeed: 6,
      densityMultiplier: 0.4,
      hasHeadlights: true,
      silhouette: 'rounded-fender',
    },
    storefronts: {
      paletteId: 'storefronts-1945',
      signCopy: [
        'DINER',
        '5¢ COFFEE',
        'APOTHECARY',
        'FRESH BREAD DAILY',
        'BARBER',
      ],
      awningColors: ['#8B3A3A', '#2F4F4F', '#6B4226'],
      signTypography: 'painted-goldleaf-serif',
      illuminatedSigns: false,
      windowDisplay: 'crated-groceries',
    },
    advertisements: {
      paletteId: 'ads-1945',
      adCopy: [
        'BUY WAR BONDS',
        'Coca-Cola — 5¢',
        'SEE THE NEW 1946 FORD',
        'LUCKY STRIKES',
      ],
      backgroundColors: ['#B22222', '#1E3A5F', '#D4A017'],
      textColors: ['#F5F5DC', '#FFFFFF', '#FFF8DC'],
      artStyle: 'painted-illustration',
      isDigital: false,
    },
    pedestrians: {
      paletteId: 'pedestrians-1945',
      fashionStyle: 'Zoot-suit & Swing',
      outerwearColors: ['#3C3C3C', '#5C4033', '#1E3A5F', '#6B4226'],
      lowerGarmentColors: ['#2B2B2B', '#3C3C3C', '#4A3728'],
      headwear: 'fedora',
      footwear: 'leather-oxford',
      densityMultiplier: 0.5,
    },
    sfx: {
      paletteId: 'sfx-1945',
      ambience: 'Quiet street corner, distant tram',
      vehicleSfx: 'low-rumble-flathead',
      footstepSfx: 'leather-heel-click',
      ambientVolume: 0.35,
      musicStyle: 'Big Band Jazz',
    },
  },

  /* -------------------------------------------------------------- 1965 */
  1965: {
    id: 1965,
    label: '1965',
    subtitle: 'Mid-century boom & chrome optimism',
    lighting: 'bright-daylight',
    skyColor: '#87B5D9',
    groundColor: '#7A7468',
    fogColor: '#B0C4DE',
    fogDensity: 0.008,
    buildings: {
      paletteId: 'buildings-1965',
      architecturalStyle: 'Mid-Century Modern & Brutalist',
      materials: ['exposed-concrete', 'glass-curtain-wall', 'roman-brick'],
      facadeColors: ['#BEBEBE', '#A0A0A0', '#9E7B5A'],
      roofColors: ['#4A4A4A', '#696969'],
      windowStyle: 'anodized-aluminum-sliding',
      heightMultiplier: 1.0,
      footprintDensity: 'medium',
      hasNeonSignage: true,
    },
    vehicles: {
      paletteId: 'vehicles-1965',
      archetype: 'Muscle Coupe',
      bodyColors: ['#C0392B', '#2980B9', '#E8E8E8', '#2C3E50', '#27AE60'],
      topSpeed: 9,
      densityMultiplier: 0.7,
      hasHeadlights: true,
      silhouette: 'long-low-fastback',
    },
    storefronts: {
      paletteId: 'storefronts-1965',
      signCopy: [
        'GAS — 29¢/GAL',
        'DRIVE-IN',
        'TV REPAIR',
        'ICE COLD COLA',
        'AUTO PARTS',
      ],
      awningColors: ['#C0392B', '#2980B9', '#F1C40F'],
      signTypography: 'channel-letter-plastic',
      illuminatedSigns: true,
      windowDisplay: 'television-sets',
    },
    advertisements: {
      paletteId: 'ads-1965',
      adCopy: [
        'KEEP ON TRUCKIN\'',
        'MARLBORO COUNTRY',
        'GOODYEAR — BEST IN TIRES',
        'THE NEW MUSTANG',
      ],
      backgroundColors: ['#C0392B', '#2C3E50', '#E8E8E8'],
      textColors: ['#FFFFFF', '#F1C40F', '#000000'],
      artStyle: 'bold-pop-art',
      isDigital: false,
    },
    pedestrians: {
      paletteId: 'pedestrians-1965',
      fashionStyle: 'Mod & Mad Men',
      outerwearColors: ['#2C3E50', '#7F8C8D', '#C0392B', '#16A085'],
      lowerGarmentColors: ['#2B2B2B', '#34495E', '#7F8C8D'],
      headwear: 'pillbox-hat',
      footwear: 'pointed-pump',
      densityMultiplier: 0.8,
    },
    sfx: {
      paletteId: 'sfx-1965',
      ambience: 'Bustling midtown, V8 engines',
      vehicleSfx: 'v8-rumble-chrome',
      footstepSfx: 'hard-sole-tap',
      ambientVolume: 0.5,
      musicStyle: 'Motown Soul',
    },
  },

  /* -------------------------------------------------------------- 1985 */
  1985: {
    id: 1985,
    label: '1985',
    subtitle: 'Neon grid & corporate glass canyons',
    lighting: 'dusk-magenta',
    skyColor: '#4A3B6B',
    groundColor: '#3A3A3A',
    fogColor: '#6B4E8F',
    fogDensity: 0.02,
    buildings: {
      paletteId: 'buildings-1985',
      architecturalStyle: 'Post-Modern Glass Tower',
      materials: ['tinted-glass', 'reflective-mirror', 'aluminum-panel'],
      facadeColors: ['#5A6A7A', '#4A5A6A', '#3A4A5A'],
      roofColors: ['#2A2A2A', '#3A3A3A'],
      windowStyle: 'tinted-reflective-curtain-wall',
      heightMultiplier: 1.5,
      footprintDensity: 'dense',
      hasNeonSignage: true,
    },
    vehicles: {
      paletteId: 'vehicles-1985',
      archetype: 'Box Sedan',
      bodyColors: ['#2C3E50', '#7F8C8D', '#BDC3C7', '#34495E', '#8E44AD'],
      topSpeed: 11,
      densityMultiplier: 1.0,
      hasHeadlights: true,
      silhouette: 'boxy-square',
    },
    storefronts: {
      paletteId: 'storefronts-1985',
      signCopy: [
        'ARCADE',
        'VIDEO RENTALS',
        'PIZZA HUT',
        '29¢ WALKMAN',
        'COMPUTERS',
      ],
      awningColors: ['#8E44AD', '#E74C3C', '#2C3E50'],
      signTypography: 'neon-tube-script',
      illuminatedSigns: true,
      windowDisplay: 'cathode-ray-tvs',
    },
    advertisements: {
      paletteId: 'ads-1985',
      adCopy: [
        'WHERE\'S THE BEEF?',
        'APPLE MACINTOSH',
        'COCA-COLA — THE PAUSE',
        'NIKE — JUST DO IT',
      ],
      backgroundColors: ['#1A1A2E', '#16213E', '#0F3460'],
      textColors: ['#E94560', '#00FF7F', '#FFD700'],
      artStyle: 'airbrush-vaporwave',
      isDigital: false,
    },
    pedestrians: {
      paletteId: 'pedestrians-1985',
      fashionStyle: 'Power Suit & Acid Wash',
      outerwearColors: ['#2C3E50', '#8E44AD', '#16A085', '#E74C3C'],
      lowerGarmentColors: ['#2B2B2B', '#34495E', '#7F8C8D'],
      headwear: 'scrunchie',
      footwear: 'high-top-sneaker',
      densityMultiplier: 1.0,
    },
    sfx: {
      paletteId: 'sfx-1985',
      ambience: 'Arcade hum & synthesizer street',
      vehicleSfx: 'whine-electronic-ignition',
      footstepSfx: 'sneaker-squeak',
      ambientVolume: 0.6,
      musicStyle: 'Synth Pop',
    },
  },

  /* -------------------------------------------------------------- 2005 */
  2005: {
    id: 2005,
    label: '2005',
    subtitle: 'Early digital millennium & glass condos',
    lighting: 'overcast-bright',
    skyColor: '#A8C0D0',
    groundColor: '#5A5A5A',
    fogColor: '#C5D0DD',
    fogDensity: 0.01,
    buildings: {
      paletteId: 'buildings-2005',
      architecturalStyle: 'Contemporary Glass & Steel',
      materials: ['low-iron-glass', 'stainless-steel', 'composite-panel'],
      facadeColors: ['#8FA8B8', '#A0B0C0', '#7A8A9A'],
      roofColors: ['#3A3A3A', '#4A4A4A'],
      windowStyle: 'double-glazed-curtain-wall',
      heightMultiplier: 1.3,
      footprintDensity: 'dense',
      hasNeonSignage: false,
    },
    vehicles: {
      paletteId: 'vehicles-2005',
      archetype: 'SUV & Compact',
      bodyColors: ['#BDC3C7', '#34495E', '#E74C3C', '#27AE60', '#F39C12'],
      topSpeed: 13,
      densityMultiplier: 1.2,
      hasHeadlights: true,
      silhouette: 'tall-aerodynamic-suv',
    },
    storefronts: {
      paletteId: 'storefronts-2005',
      signCopy: [
        'STARBUCKS COFFEE',
        'APPLE STORE',
        'BLOCKBUSTER',
        'WIFI — FREE',
        'ORGANIC MARKET',
      ],
      awningColors: ['#27AE60', '#2C3E50', '#E67E22'],
      signTypography: 'backlit-acrylic-sans',
      illuminatedSigns: true,
      windowDisplay: 'laptops-phones',
    },
    advertisements: {
      paletteId: 'ads-2005',
      adCopy: [
        'IPOD — 1000 SONGS',
        'GOT MILK?',
        'THINK DIFFERENT',
        'CAN YOU HEAR ME NOW?',
      ],
      backgroundColors: ['#FFFFFF', '#2C3E50', '#F1F2F6'],
      textColors: ['#2C3E50', '#E74C3C', '#27AE60'],
      artStyle: 'minimal-product-photo',
      isDigital: true,
    },
    pedestrians: {
      paletteId: 'pedestrians-2005',
      fashionStyle: 'Y2K Casual & Low-Rise Denim',
      outerwearColors: ['#7F8C8D', '#3498DB', '#E74C3C', '#2ECC71'],
      lowerGarmentColors: ['#2C3E50', '#5D6D7E', '#7F8C8D'],
      headwear: 'none',
      footwear: 'skater-sneaker',
      densityMultiplier: 1.1,
    },
    sfx: {
      paletteId: 'sfx-2005',
      ambience: 'Cellphone chatter & espresso machine',
      vehicleSfx: 'quiet-fuel-injection',
      footstepSfx: 'rubber-sole-pad',
      ambientVolume: 0.55,
      musicStyle: 'Indie Alternative',
    },
  },

  /* -------------------------------------------------------------- 2025 */
  2025: {
    id: 2025,
    label: '2025',
    subtitle: 'Smart city & electric skyline',
    lighting: 'cool-twilight',
    skyColor: '#2A3B5C',
    groundColor: '#2A2A2A',
    fogColor: '#3A4A6A',
    fogDensity: 0.015,
    buildings: {
      paletteId: 'buildings-2025',
      architecturalStyle: 'Parametric Eco-Tower',
      materials: ['photovoltaic-glass', 'green-wall', 'carbon-fiber-panel'],
      facadeColors: ['#3A5A7A', '#2A4A6A', '#4A6A8A'],
      roofColors: ['#1E3A5F', '#2A4A3A'],
      windowStyle: 'smart-electrochromic-glass',
      heightMultiplier: 1.7,
      footprintDensity: 'dense',
      hasNeonSignage: false,
    },
    vehicles: {
      paletteId: 'vehicles-2025',
      archetype: 'Electric Crossover',
      bodyColors: ['#E8E8E8', '#2C3E50', '#1ABC9C', '#34495E', '#16A085'],
      topSpeed: 14,
      densityMultiplier: 1.0,
      hasHeadlights: true,
      silhouette: 'sleek-silent-ev',
    },
    storefronts: {
      paletteId: 'storefronts-2025',
      signCopy: [
        'COFFEE & CODE',
        'PLANT-BASED KITCHEN',
        'EVTOL HUB',
        'BIKE SHARE',
        'COLD BREW',
      ],
      awningColors: ['#1ABC9C', '#2C3E50', '#16A085'],
      signTypography: 'oled-ambient-display',
      illuminatedSigns: true,
      windowDisplay: 'ar-screens-drones',
    },
    advertisements: {
      paletteId: 'ads-2025',
      adCopy: [
        'SUSTAINABLE FUTURE',
        'AI — POWERED EVERYTHING',
        'GO ELECTRIC',
        'YOUR DATA, SECURED',
      ],
      backgroundColors: ['#0A0A0F', '#0F1A2A', '#1A2A3A'],
      textColors: ['#00FF88', '#00D4FF', '#FFFFFF'],
      artStyle: 'holographic-motion',
      isDigital: true,
    },
    pedestrians: {
      paletteId: 'pedestrians-2025',
      fashionStyle: 'Tech-wear & Athleisure',
      outerwearColors: ['#2C3E50', '#1ABC9C', '#34495E', '#16A085'],
      lowerGarmentColors: ['#2B2B2B', '#34495E', '#1A1A2E'],
      headwear: 'wireless-earbud',
      footwear: 'knit-runner',
      densityMultiplier: 1.0,
    },
    sfx: {
      paletteId: 'sfx-2025',
      ambience: 'Quiet electric hum & drone buzz',
      vehicleSfx: 'silent-ev-whir',
      footstepSfx: 'soft-knit-sole',
      ambientVolume: 0.45,
      musicStyle: 'Lo-fi Electronic',
    },
  },
};

/* ------------------------------------------------------------------ */
/* Typed lookup helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Returns the {@link EraSpec} for the given era id.
 *
 * @param id - The era year to look up.
 * @returns The fully-populated era specification.
 * @throws `Error` if the id is not present in the registry (should be
 *   impossible at compile time for a well-typed `EraId`).
 */
export function getEra(id: EraId): EraSpec {
  const spec = ERA_REGISTRY[id];
  if (!spec) {
    throw new Error(`No EraSpec registered for era id ${id}`);
  }
  return spec;
}

/**
 * Returns all era specs as an ordered array, earliest first.
 *
 * The returned array is a shallow copy so callers can freely sort or filter
 * without mutating the canonical registry.
 */
export function getAllEras(): EraSpec[] {
  return ERA_IDS.map((id) => ERA_REGISTRY[id]);
}
