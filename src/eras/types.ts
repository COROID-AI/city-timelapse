/**
 * City Time Period Timelapse — Era Data Layer
 * ==========================================
 * Declarative, serializable type system and registry describing five decades
 * of a city block (1945, 1965, 1985, 2005, 2025).
 *
 * Every interface and constant in this file is pure data — no runtime
 * side-effects, no DOM or Web Audio access — so downstream phases (procedural
 * asset builders, SFX mixer, camera, scene composition) can consume it freely.
 *
 * Design goals:
 *  - Strictly typed, immutable, and JSON-serializable.
 *  - Period-accurate richness: buildings, vehicles, storefronts, advertisements,
 *    pedestrian outfits, and sound parameters evolve convincingly across eras.
 *  - Self-documenting field names and JSDoc so asset builders need no external spec.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Numeric year of every selectable decade on the timeline slider. */
export type EraId = '1945' | '1965' | '1985' | '2005' | '2025';

/** Ordered list of all era identifiers, earliest first. */
export const ERA_IDS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'] as const;

/** Normalised [0,1] RGB triplet consumed by procedural material builders. */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Human-readable name + colour pair, used for swatches, uniforms, signage. */
export interface NamedColor {
  readonly name: string;
  readonly color: RgbColor;
}

// ---------------------------------------------------------------------------
// Category-specific era data
// ---------------------------------------------------------------------------

/**
 * Architectural vocabulary for the decade.
 * Drives procedural building geometry, facade materials, window grids, and
 * rooftop detailing.
 */
export interface BuildingEraData {
  /** Dominant architectural styles, used to pick facade generator variants. */
  readonly styles: readonly string[];
  /** Typical number of floors for a mid-block building. */
  readonly typicalFloors: number;
  /** Maximum floors for landmark / corner buildings. */
  readonly maxFloors: number;
  /** Exterior wall materials and their base colours. */
  readonly wallMaterials: readonly NamedColor[];
  /** Window rhythm: fraction of facade width covered by glazing. */
  readonly windowGlazingRatio: number;
  /** Window treatment descriptor (e.g. "double-hung sash", "curtain wall"). */
  readonly windowStyle: string;
  /** Common roofline silhouette. */
  readonly roofStyle: string;
  /** Rooftop features (water tanks, HVAC units, solar panels, etc.). */
  readonly rooftopFeatures: readonly string[];
  /** Accent trim colour for cornices, lintels, sills. */
  readonly trimColor: RgbColor;
  /** Whether neon / illuminated signage is common on building exteriors. */
  readonly hasNeonSignage: boolean;
  /** Air-conditioner window units visible on facades. */
  readonly hasWindowAC: boolean;
}

/**
 * Road-vehicle vocabulary for the decade.
 * Drives procedural car meshes, colour palettes, and traffic-system spawning.
 */
export interface VehicleEraData {
  /** Body styles present in traffic (sedan, pickup, tram, e-scooter…). */
  readonly bodyStyles: readonly string[];
  /** Common paint colours for procedurally spawned vehicles. */
  readonly palette: readonly NamedColor[];
  /** Approximate vehicle length in metres (used for mesh scaling). */
  readonly typicalLengthM: number;
  /** Approximate vehicle height in metres. */
  readonly typicalHeightM: number;
  /** Wheel radius in metres. */
  readonly wheelRadiusM: number;
  /** Whether the era is predominantly internal-combustion (affects SFX). */
  readonly combustionEngine: boolean;
  /** Whether electric / hybrid vehicles are common. */
  readonly electricVehicles: boolean;
  /** Headlight descriptor ("round tungsten", "LED strip", …). */
  readonly headlightStyle: string;
  /** Traffic density multiplier vs. 1945 baseline (1.0). */
  readonly densityMultiplier: number;
}

/**
 * Ground-floor commercial vocabulary.
 * Drives storefront awnings, signage typography, window-display props, and
 * the business types that populate the block.
 */
export interface StorefrontEraData {
  /** Business categories that line the street. */
  readonly businessTypes: readonly string[];
  /** Awning colours and stripe patterns. */
  readonly awningColors: readonly NamedColor[];
  /** Sign typography descriptor ("hand-painted serif", "backlit channel", …). */
  readonly signTypography: string;
  /** Whether signage is internally illuminated. */
  readonly illuminatedSigns: boolean;
  /** Window-display prop descriptors. */
  readonly windowDisplayProps: readonly string[];
  /** Typical storefront entrance door material. */
  readonly doorMaterial: string;
  /** Whether plate-glass display windows dominate. */
  readonly hasPlateGlassWindows: boolean;
}

/**
 * Outdoor advertising vocabulary.
 * Drives billboard geometry, poster art palettes, and advertisement content.
 */
export interface AdvertisementEraData {
  /** Billboard / poster sizes available ("small", "spectacular", …). */
  readonly formats: readonly string[];
  /** Dominant art-direction palette for poster art. */
  readonly artPalette: readonly NamedColor[];
  /** Advertising subject matter ("war bonds", "smartphones", …). */
  readonly subjectMatter: readonly string[];
  /** Whether animated / digital billboards exist. */
  readonly hasDigitalBillboards: boolean;
  /** Whether neon tube signage is prevalent. */
  readonly hasNeon: boolean;
  /** Typography style for ad copy. */
  readonly typography: string;
}

/**
 * Pedestrian fashion vocabulary.
 * Drives procedural character mesh colours, hat / hair, and accessory props.
 */
export interface PedestrianOutfitEraData {
  /** Outerwear garment descriptors. */
  readonly outerwear: readonly string[];
  /** Headwear descriptors ("fedora", "baseball cap", "none", …). */
  readonly headwear: readonly string[];
  /** Footwear descriptors. */
  readonly footwear: readonly string[];
  /** Garment colour palette. */
  readonly palette: readonly NamedColor[];
  /** Whether visible portable tech (phones, earbuds) is common. */
  readonly portableTech: string;
  /** Silhouette descriptor for mesh proportioning. */
  readonly silhouette: string;
  /** Density of pedestrians on sidewalks (0–1 normalised). */
  readonly sidewalkDensity: number;
}

/**
 * Sound-design parameters for the decade.
 * Pure data — the SFX mixer (src/audio) synthesises AudioBuffers from these.
 * No DOM / Web Audio types here so the file stays serializable and testable.
 */
export interface SfxEraData {
  /** Ambient drone frequencies (Hz) layered beneath the street. */
  readonly ambientTones: readonly number[];
  /** Relative gain of the ambient bed (0–1). */
  readonly ambientGain: number;
  /** Filter cutoff (Hz) applied to the traffic noise bed. */
  readonly trafficCutoffHz: number;
  /** Filter resonance (Q) for the traffic noise bed. */
  readonly trafficResonance: number;
  /** Relative gain of the traffic loop (0–1). */
  readonly trafficGain: number;
  /** One-shot event types the mixer can trigger ("horn", "tram_bell", …). */
  readonly eventTypes: readonly string[];
  /** Mean interval between random one-shot events, in seconds. */
  readonly eventIntervalSec: number;
  /** Relative gain of one-shot events (0–1). */
  readonly eventGain: number;
  /** Musical bed descriptor ("big-band brass", "synthwave pad", …). */
  readonly musicStyle: string;
  /** Root note of the musical bed (MIDI note number). */
  readonly musicRootMidi: number;
  /** Relative gain of the musical bed (0–1). */
  readonly musicGain: number;
}

// ---------------------------------------------------------------------------
// Top-level era spec
// ---------------------------------------------------------------------------

/**
 * Complete, self-contained description of a single decade on the timeline.
 * Aggregates all category-specific data so the scene can transform in-place
 * when the user moves the slider.
 */
export interface EraSpec {
  /** Timeline identifier (matches a value in ERA_IDS). */
  readonly id: EraId;
  /** Numeric year for display. */
  readonly year: number;
  /** Short human label, e.g. "Post-War Boom". */
  readonly label: string;
  /** One-sentence flavour text for the HUD. */
  readonly description: string;
  /** Sky / atmosphere tint for the lighting rig. */
  readonly skyTint: RgbColor;
  /** Sun direction elevation in degrees (affects shadow length). */
  readonly sunElevationDeg: number;
  /** Overall scene ambience descriptor ("sepia warmth", "neon glow", …). */
  readonly ambience: string;
  readonly buildings: BuildingEraData;
  readonly vehicles: VehicleEraData;
  readonly storefronts: StorefrontEraData;
  readonly advertisements: AdvertisementEraData;
  readonly pedestrians: PedestrianOutfitEraData;
  readonly sfx: SfxEraData;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Ordered registry of all five eras. Index order matches ERA_IDS so callers
 * can zip the two arrays safely.
 */
export const ERA_REGISTRY: readonly EraSpec[] = [
  // -------------------------------------------------------------------------
  // 1945 — Post-War Boom
  // -------------------------------------------------------------------------
  {
    id: '1945',
    year: 1945,
    label: 'Post-War Boom',
    description: 'Victory gardens give way to bustling main streets as GIs return home.',
    skyTint: { r: 0.75, g: 0.68, b: 0.55 },
    sunElevationDeg: 38,
    ambience: 'Sepia warmth with coal-smoke haze',
    buildings: {
      styles: ['Art Deco', 'Beaux-Arts', 'Streamline Moderne', 'Brownstone Walk-up'],
      typicalFloors: 5,
      maxFloors: 12,
      wallMaterials: [
        { name: 'Cream Terracotta', color: { r: 0.86, g: 0.78, b: 0.62 } },
        { name: 'Soot-Stained Brick', color: { r: 0.45, g: 0.35, b: 0.30 } },
        { name: 'Limestone', color: { r: 0.80, g: 0.77, b: 0.68 } },
      ],
      windowGlazingRatio: 0.28,
      windowStyle: 'Double-hung sash, six-over-six panes',
      roofStyle: 'Flat with parapet cornice',
      rooftopFeatures: ['Wooden water tanks', 'Tar-gravel surface', 'Chimney pots'],
      trimColor: { r: 0.92, g: 0.88, b: 0.74 },
      hasNeonSignage: true,
      hasWindowAC: false,
    },
    vehicles: {
      bodyStyles: ['Sedan', 'Roadster', 'Panel Truck', 'Streetcar'],
      palette: [
        { name: 'Gloss Black', color: { r: 0.05, g: 0.05, b: 0.05 } },
        { name: 'Brewster Green', color: { r: 0.10, g: 0.18, b: 0.12 } },
        { name: 'Turing Maroon', color: { r: 0.45, g: 0.12, b: 0.10 } },
        { name: 'Cotswold Cream', color: { r: 0.88, g: 0.82, b: 0.55 } },
      ],
      typicalLengthM: 4.7,
      typicalHeightM: 1.6,
      wheelRadiusM: 0.38,
      combustionEngine: true,
      electricVehicles: false,
      headlightStyle: 'Round sealed-beam tungsten',
      densityMultiplier: 1.0,
    },
    storefronts: {
      businessTypes: ['Diner', 'Drugstore Soda Fountain', 'Haberdashery', 'Barber Shop', 'Movie Palace'],
      awningColors: [
        { name: 'Red-White Striped', color: { r: 0.70, g: 0.12, b: 0.12 } },
        { name: 'Forest Green', color: { r: 0.18, g: 0.32, b: 0.20 } },
        { name: 'Canvas Tan', color: { r: 0.82, g: 0.74, b: 0.52 } },
      ],
      signTypography: 'Hand-painted serif with gold leaf',
      illuminatedSigns: true,
      windowDisplayProps: ['Mannequins', 'Cigar Boxes', 'Soda-Fountain Stools', 'War-Bond Posters'],
      doorMaterial: 'Oak with brass push-bar',
      hasPlateGlassWindows: true,
    },
    advertisements: {
      formats: ['Hand-painted wall mural', 'Spectacular neon', 'Pole poster'],
      artPalette: [
        { name: 'Patriotic Red', color: { r: 0.62, g: 0.12, b: 0.12 } },
        { name: 'Navy Blue', color: { r: 0.10, g: 0.18, b: 0.40 } },
        { name: 'Poster Cream', color: { r: 0.92, g: 0.88, b: 0.72 } },
      ],
      subjectMatter: ['War Bonds', 'Cigarettes', 'Travel by Train', 'Hollywood Features'],
      hasDigitalBillboards: false,
      hasNeon: true,
      typography: 'Bold condensed sans with drop shadow',
    },
    pedestrians: {
      outerwear: ['Double-breasted suit', 'Trench coat', 'Housedress', 'Zoot suit'],
      headwear: ['Fedora', 'Pillbox hat', 'Newsboy cap', 'Beret'],
      footwear: ['Oxford brogues', 'Saddle shoes', 'Mary Janes'],
      palette: [
        { name: 'Charcoal Suit', color: { r: 0.22, g: 0.22, b: 0.24 } },
        { name: 'Olive Overcoat', color: { r: 0.34, g: 0.36, b: 0.24 } },
        { name: 'Navy Dress', color: { r: 0.12, g: 0.16, b: 0.34 } },
      ],
      portableTech: 'None',
      silhouette: 'Structured shoulders, knee-length hemlines',
      sidewalkDensity: 0.55,
    },
    sfx: {
      ambientTones: [55, 110, 165],
      ambientGain: 0.35,
      trafficCutoffHz: 1800,
      trafficResonance: 1.2,
      trafficGain: 0.45,
      eventTypes: ['trolley_bell', 'newsie_call', 'steam_whistle', 'horse_hooves'],
      eventIntervalSec: 9,
      eventGain: 0.30,
      musicStyle: 'Big-band brass stabs',
      musicRootMidi: 50,
      musicGain: 0.12,
    },
  },

  // -------------------------------------------------------------------------
  // 1965 — Jet Age Suburbia
  // -------------------------------------------------------------------------
  {
    id: '1965',
    year: 1965,
    label: 'Jet Age Suburbia',
    description: 'Tail-fins cruise past mid-century motels and the dawn of colour television.',
    skyTint: { r: 0.62, g: 0.72, b: 0.82 },
    sunElevationDeg: 44,
    ambience: 'Kodachrome clarity with chrome reflections',
    buildings: {
      styles: ['Mid-Century Modern', 'International Style', 'Googie', 'Brutalist'],
      typicalFloors: 8,
      maxFloors: 20,
      wallMaterials: [
        { name: 'Pale Curtain Wall', color: { r: 0.78, g: 0.82, b: 0.86 } },
        { name: 'Exposed Concrete', color: { r: 0.58, g: 0.56, b: 0.52 } },
        { name: 'Coral Brick Veneer', color: { r: 0.78, g: 0.42, b: 0.34 } },
      ],
      windowGlazingRatio: 0.55,
      windowStyle: 'Ribbon windows, floor-to-ceiling plate glass',
      roofStyle: 'Flat with cantilevered slab overhang',
      rooftopFeatures: [' Rooftop radio masts', 'Cantilevered signage pylons', 'Concrete planter boxes'],
      trimColor: { r: 0.90, g: 0.90, b: 0.90 },
      hasNeonSignage: true,
      hasWindowAC: true,
    },
    vehicles: {
      bodyStyles: ['Land Yacht Sedan', 'Station Wagon', 'Pickup', 'City Bus'],
      palette: [
        { name: 'Seafoam Green', color: { r: 0.40, g: 0.70, b: 0.62 } },
        { name: 'Candy Apple Red', color: { r: 0.70, g: 0.08, b: 0.08 } },
        { name: 'Turquoise', color: { r: 0.20, g: 0.70, b: 0.80 } },
        { name: 'Ivory White', color: { r: 0.92, g: 0.90, b: 0.82 } },
      ],
      typicalLengthM: 5.4,
      typicalHeightM: 1.5,
      wheelRadiusM: 0.42,
      combustionEngine: true,
      electricVehicles: false,
      headlightStyle: 'Round sealed-beam, quad headlights',
      densityMultiplier: 1.4,
    },
    storefronts: {
      businessTypes: ['Coffee Shop Diner', 'Supermarket', 'Dry Cleaner', 'Record Shop', 'TV Repair'],
      awningColors: [
        { name: 'Mustard Yellow', color: { r: 0.82, g: 0.66, b: 0.18 } },
        { name: 'Aquamarine', color: { r: 0.20, g: 0.64, b: 0.72 } },
        { name: 'Salmon Pink', color: { r: 0.88, g: 0.56, b: 0.50 } },
      ],
      signTypography: 'Googie script with starburst motifs',
      illuminatedSigns: true,
      windowDisplayProps: ['Console Televisions', 'Vinyl LPs', 'Boomerang Formica', 'Toaster Ovens'],
      doorMaterial: 'Anodised aluminium with glass insert',
      hasPlateGlassWindows: true,
    },
    advertisements: {
      formats: ['Googie pylon', 'Painted bulletin', 'Backlit translucent'],
      artPalette: [
        { name: 'Atomic Orange', color: { r: 0.90, g: 0.42, b: 0.12 } },
        { name: 'Pastel Mint', color: { r: 0.52, g: 0.82, b: 0.70 } },
        { name: 'Coral Pink', color: { r: 0.92, g: 0.50, b: 0.46 } },
      ],
      subjectMatter: ['Airline Travel', 'Filter Cigarettes', 'Kitchen Appliances', 'Drive-In Movies'],
      hasDigitalBillboards: false,
      hasNeon: true,
      typography: 'Space-age italic sans with starbursts',
    },
    pedestrians: {
      outerwear: ['Tweed Blazer', 'Shift Dress', 'Bouffant Coat', 'Ivy League Button-down'],
      headwear: ['Pillbox hat', 'Bowler', 'None', 'Knit Beanie'],
      footwear: ['Penny Loafers', 'White Go-Go Boots', 'Wingtips'],
      palette: [
        { name: 'Mustard Coat', color: { r: 0.78, g: 0.60, b: 0.18 } },
        { name: 'Aqua Shift', color: { r: 0.24, g: 0.66, b: 0.74 } },
        { name: 'Ivy Navy', color: { r: 0.12, g: 0.20, b: 0.38 } },
      ],
      portableTech: 'Transistor radio (occasional)',
      silhouette: 'Slim lapels, above-knee hemlines, structured bouffant hair',
      sidewalkDensity: 0.6,
    },
    sfx: {
      ambientTones: [62, 124, 186],
      ambientGain: 0.30,
      trafficCutoffHz: 2200,
      trafficResonance: 1.5,
      trafficGain: 0.50,
      eventTypes: ['car_horn', 'jet_flyover', 'radio_muzak', 'jackhammer'],
      eventIntervalSec: 7,
      eventGain: 0.32,
      musicStyle: 'Surf-rock reverb guitar',
      musicRootMidi: 55,
      musicGain: 0.14,
    },
  },

  // -------------------------------------------------------------------------
  // 1985 — Neon Decade
  // -------------------------------------------------------------------------
  {
    id: '1985',
    year: 1985,
    label: 'Neon Decade',
    description: 'Glass towers rise above video-arcade glow and boxy imported sedans.',
    skyTint: { r: 0.18, g: 0.16, b: 0.28 },
    sunElevationDeg: 30,
    ambience: 'Magenta-cyan neon wash over wet asphalt',
    buildings: {
      styles: ['Postmodern', 'High-Tech', 'Late Brutalist', 'Glass Curtain Wall'],
      typicalFloors: 15,
      maxFloors: 40,
      wallMaterials: [
        { name: 'Smoked Glass', color: { r: 0.20, g: 0.22, b: 0.26 } }, // 1985
        { name: 'Pink Granite Cladding', color: { r: 0.70, g: 0.58, b: 0.56 } },
        { name: 'Mirror Glass', color: { r: 0.30, g: 0.42, b: 0.50 } },
      ],
      windowGlazingRatio: 0.72,
      windowStyle: 'Reflective tinted curtain wall, bronze spandrel',
      roofStyle: 'Flat with mechanical penthouse',
      rooftopFeatures: ['Roofmount satellite dishes', 'Cooling towers', 'Neon roof signage', 'Heliostat mirrors'],
      trimColor: { r: 0.85, g: 0.20, b: 0.60 },
      hasNeonSignage: true,
      hasWindowAC: false,
    },
    vehicles: {
      bodyStyles: ['Boxy Sedan', 'Hatchback', 'Minivan', 'Delivery Van'],
      palette: [
        { name: 'Magenta', color: { r: 0.80, g: 0.10, b: 0.60 } },
        { name: 'Electric Cyan', color: { r: 0.10, g: 0.70, b: 0.90 } },
        { name: 'Champagne Metallic', color: { r: 0.82, g: 0.74, b: 0.58 } },
        { name: 'Federal Gray', color: { r: 0.50, g: 0.50, b: 0.52 } },
      ],
      typicalLengthM: 4.5,
      typicalHeightM: 1.4,
      wheelRadiusM: 0.34,
      combustionEngine: true,
      electricVehicles: false,
      headlightStyle: 'Rectangular sealed-beam halogen',
      densityMultiplier: 1.8,
    },
    storefronts: {
      businessTypes: ['Video Rental', 'Arcade', 'Chain Burger', 'Cellular Dealer', 'Aerobics Studio'],
      awningColors: [
        { name: 'Hot Pink', color: { r: 0.90, g: 0.20, b: 0.60 } },
        { name: 'Laser Cyan', color: { r: 0.10, g: 0.80, b: 0.90 } },
        { name: 'Black', color: { r: 0.08, g: 0.08, b: 0.08 } },
      ],
      signTypography: 'Neon tube script with chromed trim',
      illuminatedSigns: true,
      windowDisplayProps: ['VHS Racks', 'Arcade Cabinets', 'Boomboxes', 'Leg Warmers'],
      doorMaterial: 'Smoked glass with aluminium frame',
      hasPlateGlassWindows: true,
    },
    advertisements: {
      formats: ['Spectacular neon wall', 'Rear-lit transparency', 'Vinyl banner'],
      artPalette: [
        { name: 'Magenta', color: { r: 0.85, g: 0.15, b: 0.65 } },
        { name: 'Cyan', color: { r: 0.15, g: 0.80, b: 0.95 } },
        { name: 'Sunset Purple', color: { r: 0.35, g: 0.12, b: 0.55 } },
      ],
      subjectMatter: ['Blockbuster Movies', 'Cassette Players', 'Fitness VHS', 'Coca-Cola'],
      hasDigitalBillboards: false,
      hasNeon: true,
      typography: 'Airbrush gradient italic',
    },
    pedestrians: {
      outerwear: ['Members-Only Jacket', 'Acid-Wash Denim', 'Leather Bomber', 'Windbreaker Suit'],
      headwear: ['None', 'Baseball Cap', 'Headband', 'Perm Mullet'],
      footwear: ['High-Top Sneakers', 'Deck Shoes', 'Jelly Sandals'],
      palette: [
        { name: 'Acid Wash Blue', color: { r: 0.42, g: 0.52, b: 0.62 } },
        { name: 'Hot Pink Windbreaker', color: { r: 0.90, g: 0.25, b: 0.55 } },
        { name: 'Black Leather', color: { r: 0.10, g: 0.10, b: 0.10 } },
      ],
      portableTech: 'Sony Walkman cassette',
      silhouette: 'Shoulder-padded, high-waisted, oversized tops',
      sidewalkDensity: 0.7,
    },
    sfx: {
      ambientTones: [49, 98, 196],
      ambientGain: 0.32,
      trafficCutoffHz: 2600,
      trafficResonance: 2.0,
      trafficGain: 0.55,
      eventTypes: ['car_alarm', 'arcade_blips', 'boombox_bass', 'siren_wail'],
      eventIntervalSec: 6,
      eventGain: 0.35,
      musicStyle: 'Synthwave FM bass + saw pads',
      musicRootMidi: 45,
      musicGain: 0.18,
    },
  },

  // -------------------------------------------------------------------------
  // 2005 — Dot-Com Glass Canyon
  // -------------------------------------------------------------------------
  {
    id: '2005',
    year: 2005,
    label: 'Glass Canyon',
    description: 'Loft conversions and SUVs crowd streets wired for the broadband boom.',
    skyTint: { r: 0.55, g: 0.63, b: 0.74 },
    sunElevationDeg: 42,
    ambience: 'Cool overcast with blue-screen glow in windows',
    buildings: {
      styles: ['Deconstructivist', 'Glass Tower', 'Adaptive-Reuse Loft', 'Starbucks Vernacular'],
      typicalFloors: 20,
      maxFloors: 60,
      wallMaterials: [
        { name: 'Low-E Blue Glass', color: { r: 0.30, g: 0.46, b: 0.62 } },
        { name: 'Stainless Steel Panel', color: { r: 0.70, g: 0.70, b: 0.72 } },
        { name: 'Red Brick Conversion', color: { r: 0.52, g: 0.28, b: 0.22 } },
      ],
      windowGlazingRatio: 0.85,
      windowStyle: 'Floor-to-ceiling low-E curtain wall',
      roofStyle: 'Flat with green-roof overlay',
      rooftopFeatures: ['HVAC condenser farm', 'Green-roof sedum', 'Cell antenna array', 'Solar thermal panels'],
      trimColor: { r: 0.72, g: 0.74, b: 0.76 },
      hasNeonSignage: false,
      hasWindowAC: false,
    },
    vehicles: {
      bodyStyles: ['SUV', 'Hybrid Sedan', 'Crossover', 'Delivery Sprinter'],
      palette: [
        { name: 'Silver Metallic', color: { r: 0.72, g: 0.72, b: 0.74 } },
        { name: 'Black', color: { r: 0.08, g: 0.08, b: 0.08 } },
        { name: 'Champagne Pearl', color: { r: 0.80, g: 0.74, b: 0.60 } },
        { name: 'Deep Blue', color: { r: 0.12, g: 0.22, b: 0.45 } },
      ],
      typicalLengthM: 4.8,
      typicalHeightM: 1.7,
      wheelRadiusM: 0.36,
      combustionEngine: true,
      electricVehicles: true,
      headlightStyle: 'Projector halogen with clear lens',
      densityMultiplier: 2.2,
    },
    storefronts: {
      businessTypes: ['Starbucks', 'Yoga Studio', 'Smartphone Kiosk', 'Gym Chain', 'Condo Sales Office'],
      awningColors: [
        { name: 'Canvas Green', color: { r: 0.30, g: 0.48, b: 0.28 } },
        { name: 'Charcoal', color: { r: 0.20, g: 0.20, b: 0.22 } },
        { name: 'Sand', color: { r: 0.80, g: 0.72, b: 0.56 } },
      ],
      signTypography: 'Brushed-metal channel letters on raceway',
      illuminatedSigns: true,
      windowDisplayProps: ['Laptops', 'Yoga Mats', 'Condo Renderings', 'Smoothie Menus'],
      doorMaterial: 'Frameless glass with patch hardware',
      hasPlateGlassWindows: true,
    },
    advertisements: {
      formats: ['Digital LED panel', 'Vinyl mesh wrap', 'Backlit lightbox'],
      artPalette: [
        { name: 'Web 2.0 Green', color: { r: 0.40, g: 0.78, b: 0.36 } },
        { name: 'Gradient Blue', color: { r: 0.18, g: 0.40, b: 0.78 } },
        { name: 'Pure White', color: { r: 0.96, g: 0.96, b: 0.96 } },
      ],
      subjectMatter: ['Smartphones', 'Broadband ISP', 'Reality TV', 'Hybrid Cars'],
      hasDigitalBillboards: true,
      hasNeon: false,
      typography: 'Clean grotesque sans, web-safe',
    },
    pedestrians: {
      outerwear: ['Hoodie', 'Yoga Jacket', 'Blazer over Tee', 'North Face Fleece'],
      headwear: ['None', 'Beanie', 'Baseball Cap', 'Trucker Cap'],
      footwear: ['Skater Sneakers', 'Flip-Flops', 'Running Shoes'],
      palette: [
        { name: 'Heather Grey', color: { r: 0.66, g: 0.64, b: 0.62 } },
        { name: 'North Face Black', color: { r: 0.12, g: 0.12, b: 0.14 } },
        { name: 'Indigo Denim', color: { r: 0.20, g: 0.28, b: 0.48 } },
      ],
      portableTech: 'iPod + flip phone',
      silhouette: 'Low-rise denim, layered casual, athletic footwear',
      sidewalkDensity: 0.75,
    },
    sfx: {
      ambientTones: [58, 116, 174],
      ambientGain: 0.28,
      trafficCutoffHz: 3000,
      trafficResonance: 1.8,
      trafficGain: 0.58,
      eventTypes: ['cell_chime', 'suv_reverse_beep', 'ringtone_polyphonic', 'construction_beep'],
      eventIntervalSec: 5,
      eventGain: 0.34,
      musicStyle: 'Bloghouse filtered disco loop',
      musicRootMidi: 52,
      musicGain: 0.16,
    },
  },

  // -------------------------------------------------------------------------
  // 2025 — Augmented Present
  // -------------------------------------------------------------------------
  {
    id: '2025',
    year: 2025,
    label: 'Augmented Present',
    description: 'Delivery bots weave past glass towers draped in programmable LED skin.',
    skyTint: { r: 0.48, g: 0.52, b: 0.62 },
    sunElevationDeg: 40,
    ambience: 'Crisp digital clarity with subtle data-overlay shimmer',
    buildings: {
      styles: ['Parametric', 'Mass-Timber Hybrid', 'Supertall Slim', 'Adaptive Facade'],
      typicalFloors: 30,
      maxFloors: 90,
      wallMaterials: [
        { name: 'Electrochromic Glass', color: { r: 0.22, g: 0.30, b: 0.40 } },
        { name: 'CLT Timber Panel', color: { r: 0.62, g: 0.48, b: 0.32 } },
        { name: 'White Aluminium Mesh', color: { r: 0.88, g: 0.88, b: 0.90 } },
      ],
      windowGlazingRatio: 0.90,
      windowStyle: 'Dynamic electrochromic curtain wall',
      roofStyle: 'Twisted parametric crown',
      rooftopFeatures: ['Drone delivery pads', 'Vertical farm modules', 'Building-integrated PV', 'Wind micro-turbines'],
      trimColor: { r: 0.90, g: 0.92, b: 0.95 },
      hasNeonSignage: false,
      hasWindowAC: false,
    },
    vehicles: {
      bodyStyles: ['Electric Crossover', 'Robotaxi', 'E-Bike', 'Delivery Rover'],
      palette: [
        { name: 'Matte White', color: { r: 0.90, g: 0.90, b: 0.90 } },
        { name: 'Stealth Black', color: { r: 0.06, g: 0.06, b: 0.06 } },
        { name: 'Sonic Silver', color: { r: 0.66, g: 0.68, b: 0.70 } },
        { name: 'Azure Blue', color: { r: 0.14, g: 0.34, b: 0.72 } },
      ],
      typicalLengthM: 4.6,
      typicalHeightM: 1.6,
      wheelRadiusM: 0.35,
      combustionEngine: false,
      electricVehicles: true,
      headlightStyle: 'Full-width LED light bar with matrix pixels',
      densityMultiplier: 2.0,
    },
    storefronts: {
      businessTypes: ['Ghost Kitchen', 'Specialty Coffee', 'EV Fast-Charge Lounge', 'AR Experience Store', 'Vertical Farm Market'],
      awningColors: [
        { name: 'Matte Black', color: { r: 0.10, g: 0.10, b: 0.10 } },
        { name: 'Sage Green', color: { r: 0.50, g: 0.60, b: 0.42 } },
        { name: 'Warm White', color: { r: 0.92, g: 0.90, b: 0.84 } },
      ],
      signTypography: 'Programmable LED matrix with motion graphics',
      illuminatedSigns: true,
      windowDisplayProps: ['AR Mirrors', 'Specialty Coffee Bars', 'EV Chargers', 'Drone Lockers'],
      doorMaterial: 'Automatic sliding glass with sensors',
      hasPlateGlassWindows: true,
    },
    advertisements: {
      formats: ['Programmable LED mesh', 'Holographic projection', 'AR geo-tagged overlay'],
      artPalette: [
        { name: 'Electric Indigo', color: { r: 0.20, g: 0.18, b: 0.85 } },
        { name: 'Cyber Mint', color: { r: 0.20, g: 0.90, b: 0.70 } },
        { name: 'Pure White', color: { r: 0.98, g: 0.98, b: 0.98 } },
      ],
      subjectMatter: ['Streaming Services', 'EV Brands', 'AI Assistants', 'Climate Tech'],
      hasDigitalBillboards: true,
      hasNeon: false,
      typography: 'Variable-weight geometric sans',
    },
    pedestrians: {
      outerwear: ['Technical Shell', 'Oversized Hoodie', 'Athleisure Set', 'Puffer Vest'],
      headwear: ['None', 'Beanie', 'Baseball Cap', 'Wireless Earbuds (visible)'],
      footwear: ['All-Terrain Sneakers', 'Slip-On Knit', 'Platform Runner'],
      palette: [
        { name: 'Techwear Black', color: { r: 0.10, g: 0.10, b: 0.12 } },
        { name: 'Sage Athleisure', color: { r: 0.50, g: 0.58, b: 0.42 } },
        { name: 'Cobalt Puffer', color: { r: 0.16, g: 0.30, b: 0.70 } },
      ],
      portableTech: 'Smartphone + wireless earbuds',
      silhouette: 'Oversized technical layers, tapered pants, chunky soles',
      sidewalkDensity: 0.8,
    },
    sfx: {
      ambientTones: [60, 120, 180],
      ambientGain: 0.25,
      trafficCutoffHz: 3400,
      trafficResonance: 1.0,
      trafficGain: 0.50,
      eventTypes: ['ev_whir', 'drone_buzz', 'notification_chime', 'scooter_beep'],
      eventIntervalSec: 4,
      eventGain: 0.32,
      musicStyle: 'Ambient electronic granular pad',
      musicRootMidi: 57,
      musicGain: 0.15,
    },
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a full {@link EraSpec} by its identifier.
 * @throws if the id is not a known era (should never happen with typed callers).
 */
export function getEra(id: EraId): EraSpec {
  const found = ERA_REGISTRY.find((era) => era.id === id);
  if (!found) {
    throw new Error(`[eras] Unknown EraId: "${id}". Known eras: ${ERA_IDS.join(', ')}`);
  }
  return found;
}

/** Convenience accessor returning the full ordered registry array. */
export function getAllEras(): readonly EraSpec[] {
  return ERA_REGISTRY;
}
